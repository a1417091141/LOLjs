// ==UserScript==
// @name         宠物管理器 (缝合怪完美兼容版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      10.0.0
// ==/UserScript==

(function () {
    'use strict';

    const REPO = 'a1417091141/LOLjs';
    const CDN_BASE = `https://cdn.jsdmirror.com/gh/${REPO}@main`;
    const API_PROXY = 'http://127.0.0.1:18888/github-api';

    let currentPetKey = localStorage.getItem('pet_current_model') || 'yasuo';
    let PET_LIST = ['yasuo', 'gewen'];

    window.stopPetAnimation = null;

    // ==========================================
    // 模块 1：创建按钮
    // ==========================================
    function createUI() {
        if (document.getElementById('pet-switch-btn')) return;
        if (!document.body) return;

        const btn = document.createElement('button');
        btn.id = 'pet-switch-btn';
        btn.style.cssText = `
            position: fixed !important; bottom: 20px !important; left: 20px !important;
            padding: 8px 16px !important; background: linear-gradient(90deg, #1e2328, #3d4450) !important;
            color: #C8AA6E !important; border: 1px solid #C8AA6E !important; border-radius: 4px !important;
            font-weight: bold !important; font-size: 14px !important; z-index: 2147483647 !important;
            cursor: pointer !important; box-shadow: 0 0 10px rgba(0,0,0,0.5) !important;
            text-transform: capitalize !important; display: block !important;
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

    // ==========================================
    // 模块 2：切换与清理逻辑
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
    // 模块 3：后台扫描
    // ==========================================
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
                        console.log("🔄 后台发现最新宠物列表，已更新！");
                        PET_LIST = scannedPets;
                        if (!PET_LIST.includes(currentPetKey)) switchPet(PET_LIST[0]);
                        updateButtonText();
                    }
                }
            })
            .catch(e => console.log("ℹ️ 扫描失败，保持保底名单"));
    }

    // ==========================================
    // 模块 4：统一启动引擎 (抄你的完美模板)
    // ==========================================
    const init = () => {
        createUI();
        
        // 如果还没召唤宠物，立刻召唤默认宠物
        if (!document.getElementById('three-pet-container')) {
            window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
        }
        
        scanPetsInBackground();

        // 监听 DOM 变化（防止切页面按钮丢失）
        const observer = new MutationObserver(() => {
            createUI();
        });

        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
    };

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 兜底定时器（每 2 秒强刷一次，确保切大厅时按钮必然存在）
    setInterval(() => {
        createUI();
    }, 2000);

    // F9 强制刷新扫描
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F9') {
            console.log('🔄 强制刷新宠物列表...');
            scanPetsInBackground();
        }
    });

})();
