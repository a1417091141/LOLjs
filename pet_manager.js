// ==UserScript==
// @name         宠物管理器 (防缓存全自动雷达版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      5.0.0
// ==/UserScript==

(async function () {
    'use strict';

    const REPO = 'a1417091141/LOLjs';
    const CDN_BASE = `https://cdn.jsdmirror.com/gh/${REPO}@main`;
    // 借用你云端加载器的代理来打破 CDN 缓存
    const API_PROXY = 'http://127.0.0.1:18888/github-api';

    let currentPetKey = localStorage.getItem('pet_current_model') || 'yasuo';
    let PET_LIST = [];

    // 全局清理接口
    window.stopPetAnimation = null;

    // ==========================================
    // 核心：自动扫描 plugins.json 获取所有宠物
    // ==========================================
    async function scanPets() {
        try {
            let jsonUrl = `${CDN_BASE}/plugins.json?t=${Date.now()}`;
            
            // 尝试获取最新的 Commit 哈希，打破 jsDelivr 的 CDN 缓存
            try {
                const commitRes = await fetch(API_PROXY);
                if (commitRes.ok) {
                    const commitHash = await commitRes.text();
                    if (commitHash && commitHash.length > 5) {
                        jsonUrl = `https://cdn.jsdmirror.com/gh/${REPO}@${commitHash.trim()}/plugins.json`;
                        console.log("🔍 获取到最新哈希，强制拉取最新 JSON:", commitHash.trim());
                    }
                }
            } catch(e) {
                console.log("⚠️ 代理未开启或失败，使用默认 main 分支");
            }

            const res = await fetch(jsonUrl);
            const config = await res.json();
            
            // 过滤出所有包含 pet_ 并且以 .js 结尾的文件，排除管理器自己
            const petFiles = config.plugins.filter(file => 
                file.includes('pet_') && file.endsWith('.js') && !file.includes('pet_manager')
            );

            // 从 "pet/pet_yasuo.js" 中提取出 "yasuo"
            PET_LIST = petFiles.map(file => {
                const match = file.match(/pet_([a-zA-Z0-9]+)\.js/);
                return match ? match[1] : null;
            }).filter(Boolean); // 过滤掉匹配失败的

            console.log("🔍 自动扫描到的宠物列表:", PET_LIST);

            if (PET_LIST.length === 0) {
                console.log("⚠️ 没有在 plugins.json 中找到宠物文件");
                return;
            }

            // 如果本地记录的宠物不在了，默认切到第一个
            if (!PET_LIST.includes(currentPetKey)) {
                currentPetKey = PET_LIST[0];
            }

            if (!document.getElementById('pet-switch-btn')) {
                createUI();
                // 首次启动，叫醒默认宠物
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
                }, 1000);
            } else {
                // 如果按钮已存在，说明是按了 F9 热更新
                updateButtonText();
                console.log("✅ 宠物列表已热更新！");
            }

        } catch(e) {
            console.error("扫描宠物失败:", e);
        }
    }

    // ==========================================
    // 清理旧宠物内存
    // ==========================================
    function cleanOldPet() {
        if (window.stopPetAnimation) {
            try { window.stopPetAnimation(); } catch(e){}
            window.stopPetAnimation = null;
        }
        const old = document.getElementById('three-pet-container');
        if (old) old.remove();
    }

    // ==========================================
    // 切换宠物
    // ==========================================
    function switchPet(nextKey) {
        const btn = document.getElementById('pet-switch-btn');
        if (btn) btn.innerText = '切换中...';

        cleanOldPet();
        currentPetKey = nextKey;
        localStorage.setItem('pet_current_model', nextKey);

        // 广播叫醒对应的宠物
        window.dispatchEvent(new CustomEvent('spawn_pet', { detail: nextKey }));
        updateButtonText();
    }

    // ==========================================
    // UI 生成与更新
    // ==========================================
    function createUI() {
        if (document.getElementById('pet-switch-btn')) return;
        
        const btn = document.createElement('button');
        btn.id = 'pet-switch-btn';
        btn.style.cssText = `
            position: fixed; bottom: 20px; left: 20px;
            padding: 8px 16px; background: linear-gradient(90deg, #1e2328, #3d4450);
            color: #C8AA6E; border: 1px solid #C8AA6E; border-radius: 4px;
            font-weight: bold; font-size: 14px; z-index: 2147483647;
            cursor: pointer; box-shadow: 0 0 10px rgba(0,0,0,0.5);
            text-transform: capitalize;
        `;
        
        btn.onclick = () => {
            const currentIndex = PET_LIST.indexOf(currentPetKey);
            const nextIndex = (currentIndex + 1) % PET_LIST.length;
            switchPet(PET_LIST[nextIndex]);
        };
        
        document.body.appendChild(btn);
        updateButtonText();

        // 🚨 开发调试神器：按 F9 立刻去 GitHub 重新扫描最新列表
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F9') {
                console.log('🔄 正在强制刷新宠物列表...');
                btn.innerText = '扫描中...';
                scanPets(); 
            }
        });
    }

    function updateButtonText() {
        const btn = document.getElementById('pet-switch-btn');
        if (!btn) return;
        const currentIndex = PET_LIST.indexOf(currentPetKey);
        const nextIndex = (currentIndex + 1) % PET_LIST.length;
        btn.innerText = `切换到: ${PET_LIST[nextIndex]}`;
    }

    // ==========================================
    // 启动
    // ==========================================
    setTimeout(() => {
        if (document.querySelector('lol-uikit-flat-button') || document.querySelector('.client-root')) {
            scanPets();
        } else {
            setTimeout(arguments.callee, 2000);
        }
    }, 5000);

})();
