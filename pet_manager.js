// ==UserScript==
// @name         宠物管理器 (云端无阻塞秒出版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      9.0.0
// ==/UserScript==

(function () {
    'use strict';

    const REPO = 'a1417091141/LOLjs';
    const CDN_BASE = `https://cdn.jsdmirror.com/gh/${REPO}@main`;
    
    // 🚨 保底名单：如果网络慢，先用这俩，绝对不卡界面
    let PET_LIST = ['yasuo', 'gewen']; 
    let currentPetKey = localStorage.getItem('pet_current_model') || 'yasuo';

    window.stopPetAnimation = null;

    // ==========================================
    // 1. 极速生成 UI（没有任何网络请求，0毫秒加载）
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
    // 3. 后台云端扫描（独立运行，不占用主线程，不卡加载）
    // ==========================================
    function scanPetsInBackground() {
        fetch(`${CDN_BASE}/plugins.json?t=${Date.now()}`)
            .then(res => res.json())
            .then(config => {
                if (config && config.plugins && Array.isArray(config.plugins)) {
                    const petFiles = config.plugins.filter(file => 
                        file.includes('pet_') && file.endsWith('.js') && !file.includes('pet_manager')
                    );

                    const scannedPets = petFiles.map(file => {
                        const match = file.match(/pet_([a-zA-Z0-9]+)\.js/);
                        return match ? match[1] : null;
                    }).filter(Boolean);

                    if (scannedPets.length > 0) {
                        // 判断和保底名单是否不一样，不一样才更新按钮
                        if (JSON.stringify(PET_LIST) !== JSON.stringify(scannedPets)) {
                            console.log("🔄 云端扫描到最新宠物列表:", scannedPets);
                            PET_LIST = scannedPets;
                            
                            if (!PET_LIST.includes(currentPetKey)) {
                                switchPet(PET_LIST[0]);
                            }
                            updateButtonText();
                        }
                    }
                }
            })
            .catch(e => {
                console.log("ℹ️ 云端列表拉取失败，继续使用保底名单", e);
            });
    }

    // ==========================================
    // 4. 启动
    // ==========================================
    function boot() {
        // 瞬间出按钮
        createUI();
        
        // 瞬间唤醒默认宠物
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
        }, 500);

        // 丢入后台默默扫描最新 JSON（不影响任何其他插件）
        scanPetsInBackground();
    }

    // 监听客户端就绪
    let checkTimer = setInterval(() => {
        const isReady = document.querySelector('lol-uikit-flat-button') || 
                        document.querySelector('.client-root') || 
                        document.querySelector('.parties-game-navs');
        if (isReady) {
            clearInterval(checkTimer);
            boot(); 
        }
    }, 500);

    // 极端兜底：10 秒后还没加载好也强行启动
    setTimeout(() => {
        if (!document.getElementById('pet-switch-btn')) {
            clearInterval(checkTimer);
            boot();
        }
    }, 10000);

})();
