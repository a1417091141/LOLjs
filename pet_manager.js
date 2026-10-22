// ==UserScript==
// @name         宠物管理器 (稳妥兼容版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      6.0.0
// ==/UserScript==

(async function () {
    'use strict';

    const REPO = 'a1417091141/LOLjs';
    const CDN_BASE = `https://cdn.jsdmirror.com/gh/${REPO}@main`;
    const API_PROXY = 'http://127.0.0.1:18888/github-api';

    let currentPetKey = localStorage.getItem('pet_current_model') || 'yasuo';
    let PET_LIST = [];

    window.stopPetAnimation = null;

    // 🚨 核心：通过读取 plugins.json 来扫描宠物
    async function scanPets() {
        try {
            let jsonUrl = `${CDN_BASE}/plugins.json?t=${Date.now()}`;
            
            // 尝试获取最新的 Commit 哈希，打破缓存
            try {
                const commitRes = await fetch(API_PROXY);
                if (commitRes.ok) {
                    const commitHash = await commitRes.text();
                    if (commitHash && commitHash.length > 5) {
                        jsonUrl = `https://cdn.jsdmirror.com/gh/${REPO}@${commitHash.trim()}/plugins.json`;
                    }
                }
            } catch(e) {
                console.log("⚠️ 代理未开启或失败，使用默认 main 分支");
            }

            const res = await fetch(jsonUrl);
            const config = await res.json();
            
            const petFiles = config.plugins.filter(file => 
                file.includes('pet_') && file.endsWith('.js') && !file.includes('pet_manager')
            );

            PET_LIST = petFiles.map(file => {
                const match = file.match(/pet_([a-zA-Z0-9]+)\.js/);
                return match ? match[1] : null;
            }).filter(Boolean);

            console.log("🔍 自动扫描到的宠物列表:", PET_LIST);

            if (PET_LIST.length === 0) {
                console.log("⚠️ 没有在 plugins.json 中找到宠物文件");
                return;
            }

            if (!PET_LIST.includes(currentPetKey)) {
                currentPetKey = PET_LIST[0];
            }

            if (!document.getElementById('pet-switch-btn')) {
                createUI();
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
                }, 1000);
            } else {
                updateButtonText();
                console.log("✅ 宠物列表已热更新！");
            }

        } catch(e) {
            console.error("扫描宠物失败:", e);
        }
    }

    function cleanOldPet() {
        if (window.stopPetAnimation) {
            try { window.stopPetAnimation(); } catch(e){}
            window.stopPetAnimation = null;
        }
        const old = document.getElementById('three-pet-container');
        if (old) old.remove();
    }

    function switchPet(nextKey) {
        const btn = document.getElementById('pet-switch-btn');
        if (btn) btn.innerText = '切换中...';

        cleanOldPet();
        currentPetKey = nextKey;
        localStorage.setItem('pet_current_model', nextKey);

        window.dispatchEvent(new CustomEvent('spawn_pet', { detail: nextKey }));
        updateButtonText();
    }

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

        window.addEventListener('keydown', (e) => {
            if (e.key === 'F9') {
                console.log('🔄 正在强制刷新宠物列表...');
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

    setTimeout(() => {
        if (document.querySelector('lol-uikit-flat-button') || document.querySelector('.client-root')) {
            scanPets();
        } else {
            setTimeout(arguments.callee, 2000);
        }
    }, 5000);

})();
