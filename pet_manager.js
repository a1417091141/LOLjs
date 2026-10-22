// ==UserScript==
// @name         宠物管理器 (纯同步极速版)
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

    // 🚨 绝对保底名单，不依赖任何网络，直接写死
    let PET_LIST = ['yasuo', 'gewen'];
    let currentPetKey = localStorage.getItem('pet_current_model') || 'yasuo';

    window.stopPetAnimation = null;

    // ==========================================
    // 1. 立即生成 UI（不包含任何 await，绝对秒出）
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

        // F9 手动刷新扫描
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F9') {
                if (btn) btn.innerText = '扫描中...';
                scanPetsInBackground(); 
            }
        });
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
    // 2. 宠物切换逻辑
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
    // 3. 后台静默扫描最新列表（仅后台运行，不影响 UI）
    // ==========================================
    async function scanPetsInBackground() {
        try {
            let jsonUrl = `${CDN_BASE}/plugins.json?t=${Date.now()}`;
            
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                const commitRes = await fetch(API_PROXY, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (commitRes.ok) {
                    const commitHash = await commitRes.text();
                    if (commitHash && commitHash.length > 5) {
                        jsonUrl = `https://cdn.jsdmirror.com/gh/${REPO}@${commitHash.trim()}/plugins.json`;
                    }
                }
            } catch(e) {}

            const res = await fetch(jsonUrl);
            if (!res.ok) throw new Error("HTTP " + res.status);
            
            const config = await res.json();
            
            if (config && config.plugins && Array.isArray(config.plugins)) {
                const petFiles = config.plugins.filter(file => 
                    file.includes('pet_') && file.endsWith('.js') && !file.includes('pet_manager')
                );

                const scannedPets = petFiles.map(file => {
                    const match = file.match(/pet_([a-zA-Z0-9]+)\.js/);
                    return match ? match[1] : null;
                }).filter(Boolean);

                if (scannedPets.length > 0) {
                    const isDifferent = JSON.stringify(PET_LIST) !== JSON.stringify(scannedPets);
                    if (isDifferent) {
                        console.log("🔄 发现新宠物列表，已自动更新。");
                        PET_LIST = scannedPets;
                        
                        if (!PET_LIST.includes(currentPetKey)) {
                            switchPet(PET_LIST[0]);
                        }
                        updateButtonText();
                    }
                }
            }
        } catch(e) {
            console.log("ℹ️ 后台列表同步失败（忽略即可，保底依然可用）", e);
        }
    }

    // ==========================================
    // 4. 主启动流程
    // ==========================================
    function boot() {
        // 直接画出按钮
        createUI();
        
        // 叫醒宠物
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
        }, 500);

        // 后台去拉取最新的列表（如果有新宠物，会偷偷更新按钮文字）
        scanPetsInBackground();
    }

    // 轮询检测客户端是否加载完毕
    let checkTimer = setInterval(() => {
        const isReady = document.querySelector('lol-uikit-flat-button') || 
                        document.querySelector('.client-root') || 
                        document.querySelector('.parties-game-navs');
        if (isReady) {
            clearInterval(checkTimer);
            boot(); // 客户端好了，立刻启动！
        }
    }, 500);

    // 极端情况下 10 秒后强制启动
    setTimeout(() => {
        if (!document.getElementById('pet-switch-btn')) {
            clearInterval(checkTimer);
            boot();
        }
    }, 10000);

})();
