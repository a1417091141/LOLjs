// ==UserScript==
// @name         宠物管理器 (完全分离秒出版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      7.0.0
// ==/UserScript==

(function () {
    'use strict';

    const REPO = 'a1417091141/LOLjs';
    const CDN_BASE = `https://cdn.jsdmirror.com/gh/${REPO}@main`;
    const API_PROXY = 'http://127.0.0.1:18888/github-api';

    let currentPetKey = localStorage.getItem('pet_current_model') || 'yasuo';
    // 极速保底列表
    let PET_LIST = ['yasuo', 'gewen']; 

    window.stopPetAnimation = null;

    // ==========================================
    // 1. 极速 UI 生成 (不包含任何 async/await，绝对不卡)
    // ==========================================
    function createUI() {
        if (document.getElementById('pet-switch-btn')) return;
        if (!document.body) return setTimeout(createUI, 100);

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
    }

    function updateButtonText() {
        const btn = document.getElementById('pet-switch-btn');
        if (!btn) return;
        if (PET_LIST.length <= 1) {
            btn.innerText = '仅 1 个宠物';
            return;
        }
        const currentIndex = PET_LIST.indexOf(currentPetKey);
        const nextIndex = (currentIndex + 1) % PET_LIST.length;
        btn.innerText = `切换到: ${PET_LIST[nextIndex]}`;
    }

    // ==========================================
    // 2. 核心宠物切换逻辑
    // ==========================================
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

    // ==========================================
    // 3. 后台延迟扫描 (不影响任何其他云端插件)
    // ==========================================
    async function scanPetsInBackground() {
        try {
            let jsonUrl = `${CDN_BASE}/plugins.json?t=${Date.now()}`;
            
            try {
                const commitRes = await fetch(API_PROXY);
                if (commitRes.ok) {
                    const commitHash = await commitRes.text();
                    if (commitHash && commitHash.length > 5) {
                        jsonUrl = `https://cdn.jsdmirror.com/gh/${REPO}@${commitHash.trim()}/plugins.json`;
                    }
                }
            } catch(e) {
                // 代理没开也不影响
            }

            const res = await fetch(jsonUrl);
            const config = await res.json();
            
            const petFiles = config.plugins.filter(file => 
                file.includes('pet_') && file.endsWith('.js') && !file.includes('pet_manager')
            );

            const scannedPets = petFiles.map(file => {
                const match = file.match(/pet_([a-zA-Z0-9]+)\.js/);
                return match ? match[1] : null;
            }).filter(Boolean);

            if (scannedPets.length > 0) {
                if (JSON.stringify(PET_LIST) !== JSON.stringify(scannedPets)) {
                    console.log("🔄 后台发现最新宠物列表:", scannedPets);
                    PET_LIST = scannedPets;
                    if (!PET_LIST.includes(currentPetKey)) {
                        switchPet(PET_LIST[0]);
                    }
                    updateButtonText();
                }
            }
        } catch(e) {
            console.log("ℹ️ 后台扫描失败，已忽略");
        }
    }

    // ==========================================
    // 4. 启动流程
    // ==========================================
    function boot() {
        // 1. 瞬间弹出按钮
        createUI();
        
        // 2. 瞬间加载上次保存的宠物
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
        }, 500);

        // 3. 给主线程 2 秒的休息时间，等云端加载器把其他插件全跑完，再偷偷去扫描新宠物
        setTimeout(() => {
            scanPetsInBackground();
        }, 2000);
    }

    // 监听客户端 UI 加载完毕
    let checkTimer = setInterval(() => {
        const isReady = document.querySelector('lol-uikit-flat-button') || 
                        document.querySelector('.client-root') || 
                        document.querySelector('.parties-game-navs');
        if (isReady) {
            clearInterval(checkTimer);
            boot(); 
        }
    }, 500);

    // 按 F9 强制刷新后台列表
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F9') {
            console.log('🔄 正在强制刷新宠物列表...');
            scanPetsInBackground();
        }
    });

})();
