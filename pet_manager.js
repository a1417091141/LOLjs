// ==UserScript==
// @name         宠物管理器 (秒出且防卡兼容版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      8.0.0
// ==/UserScript==

(async function () {
    'use strict';

    const REPO = 'a1417091141/LOLjs';
    const CDN_BASE = `https://cdn.jsdmirror.com/gh/${REPO}@main`;
    const API_PROXY = 'http://127.0.0.1:18888/github-api';

    let currentPetKey = localStorage.getItem('pet_current_model') || 'yasuo';
    
    // 🚨 保底名单：先不管网络，直接用这俩
    let PET_LIST = ['yasuo', 'gewen'];

    window.stopPetAnimation = null;

    // 1. 纯同步画按钮（绝对不会卡）
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

    // 2. 独立的后台网络请求（使用 .then 彻底解耦，不卡主线程）
    function scanPetsInBackground() {
        // 先拿哈希
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
                // 代理失败就拉主分支
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
                        console.log("🔄 后台扫描到了最新宠物列表，已更新！");
                        PET_LIST = scannedPets;
                        if (!PET_LIST.includes(currentPetKey)) switchPet(PET_LIST[0]);
                        updateButtonText();
                    }
                }
            })
            .catch(e => console.log("ℹ️ 扫描失败，保持保底名单"));
    }

    // 3. 启动流程
    setTimeout(() => {
        const isReady = document.querySelector('lol-uikit-flat-button') || document.querySelector('.client-root');
        if (isReady) {
            // 1. 秒出按钮
            createUI();
            // 2. 唤醒默认宠物
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
            }, 500);
            // 3. 后台悄悄刷新列表
            scanPetsInBackground();
        } else {
            setTimeout(arguments.callee, 2000);
        }
    }, 5000);

    // F9 强制刷新
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F9') {
            console.log('🔄 强制刷新...');
            scanPetsInBackground();
        }
    });

})();
