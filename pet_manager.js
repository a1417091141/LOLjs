// ==UserScript==
// @name         宠物管理器 (强插防丢版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      9.0.0
// ==/UserScript==

(function () {
    'use strict';

    const REPO = 'a1417091141/LOLjs';
    const CDN_BASE = `https://cdn.jsdmirror.com/gh/${REPO}@main`;
    const API_PROXY = 'http://127.0.0.1:18888/github-api';

    let currentPetKey = localStorage.getItem('pet_current_model') || 'yasuo';
    let PET_LIST = ['yasuo', 'gewen'];

    window.stopPetAnimation = null;

    function createUI() {
        if (document.getElementById('pet-switch-btn')) return;

        // 🚨 如果 body 还没出来，等 100 毫秒再试
        if (!document.body) {
            setTimeout(createUI, 100);
            return;
        }

        const btn = document.createElement('button');
        btn.id = 'pet-switch-btn';
        btn.style.cssText = `
            position: fixed !important; 
            bottom: 20px !important; 
            left: 20px !important;
            padding: 8px 16px !important; 
            background: linear-gradient(90deg, #1e2328, #3d4450) !important;
            color: #C8AA6E !important; 
            border: 1px solid #C8AA6E !important; 
            border-radius: 4px !important;
            font-weight: bold !important; 
            font-size: 14px !important; 
            z-index: 2147483647 !important;
            cursor: pointer !important; 
            box-shadow: 0 0 10px rgba(0,0,0,0.5) !important;
            text-transform: capitalize !important;
            display: block !important;
        `;
        btn.onclick = () => {
            const currentIndex = PET_LIST.indexOf(currentPetKey);
            const nextIndex = (currentIndex + 1) % PET_LIST.length;
            switchPet(PET_LIST[nextIndex]);
        };
        
        document.body.appendChild(btn);
        console.log("✅ 按钮已成功插入 DOM！");
        updateButtonText();
    }

    function updateButtonText() {
        const btn = document.getElementById('pet-switch-btn');
        if (!btn) return;
        const currentIndex = PET_LIST.indexOf(currentPetKey);
        const nextIndex = (currentIndex + 1) % PET_LIST.length;
        btn.innerText = `切换到: ${PET_LIST[nextIndex]}`;
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

    function scanPetsInBackground() {
        fetch(API_PROXY)
            .then(res => res.ok ? res.text() : Promise.reject())
            .then(hash => {
                let jsonUrl = `${CDN_BASE}/plugins.json?t=${Date.now()}`;
                if (hash && hash.length > 5) {
                    jsonUrl = `https://cdn.jsdmirror.com/gh/${REPO}@${hash.trim()}/plugins.json`;
                }
                return fetch(jsonUrl);
            })
            .catch(() => {
                return fetch(`${CDN_BASE}/plugins.json?t=${Date.now()}`);
            })
            .then(res => res.json())
            .then(config => {
                const petFiles = config.plugins.filter(file => 
                    file.includes('pet_') && file.endsWith('.js') && !file.includes('pet_manager')
                );

                const scannedPets = petFiles.map(file => {
                    const match = file.match(/pet_([a-zA-Z0-9]+)\.js/);
                    return match ? match[1] : null;
                }).filter(Boolean);

                if (scannedPets.length > 0) {
                    if (JSON.stringify(PET_LIST) !== JSON.stringify(scannedPets)) {
                        console.log("🔄 后台发现新宠物，更新列表:", scannedPets);
                        PET_LIST = scannedPets;
                        if (!PET_LIST.includes(currentPetKey)) switchPet(PET_LIST[0]);
                        updateButtonText();
                    }
                }
            })
            .catch(e => console.log("ℹ️ 扫描失败，保持保底名单"));
    }

    // 🚨 核心修复：使用 setInterval 强制检测，直到按钮插进去为止
    let booted = false;
    const bootInterval = setInterval(() => {
        // 1. 如果还没启动，先检测客户端加载完成没
        if (!booted) {
            const isReady = document.querySelector('lol-uikit-flat-button') || 
                            document.querySelector('.client-root') || 
                            document.querySelector('.parties-game-navs');
            
            if (isReady) {
                booted = true;
                clearInterval(bootInterval);
                
                // 画按钮
                createUI();
                // 唤醒宠物
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
                }, 500);
                // 后台更新
                scanPetsInBackground();
            }
        }
    }, 1000);

    // 如果 15 秒后还没检测到，强行破门而入
    setTimeout(() => {
        if (!booted) {
            booted = true;
            createUI();
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
            }, 500);
            scanPetsInBackground();
        }
    }, 15000);

    window.addEventListener('keydown', (e) => {
        if (e.key === 'F9') {
            console.log('🔄 强制刷新...');
            scanPetsInBackground();
        }
    });

})();
