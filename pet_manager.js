// ==UserScript==
// @name         宠物管理器 (持久化记忆版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      4.1.0
// ==/UserScript==

(async function () {
    'use strict';

    const REPO = 'a1417091141/LOLjs';
    const CDN_BASE = `https://cdn.jsdmirror.com/gh/${REPO}@main`;
    const API_PROXY = 'http://127.0.0.1:18888/github-api';

    // 🚨 核心：读取本地记忆，如果没有记录则默认 'yasuo'
    let currentPetKey = localStorage.getItem('pet_current_model') || 'yasuo';
    let PET_LIST = [];

    window.stopPetAnimation = null;

    // 扫描 plugins.json 获取所有宠物
    async function scanPets() {
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
            } catch(e) {}

            const res = await fetch(jsonUrl);
            const config = await res.json();
            
            const petFiles = config.plugins.filter(file => 
                file.includes('pet_') && file.endsWith('.js') && !file.includes('pet_manager')
            );

            PET_LIST = petFiles.map(file => {
                const match = file.match(/pet_([a-zA-Z0-9]+)\.js/);
                return match ? match[1] : null;
            }).filter(Boolean);

            if (PET_LIST.length === 0) return;

            // 🚨 如果本地记录的宠物被删除了，自动回退到第一个宠物
            if (!PET_LIST.includes(currentPetKey)) {
                currentPetKey = PET_LIST[0];
                localStorage.setItem('pet_current_model', currentPetKey); // 更新本地记忆
            }

            if (!document.getElementById('pet-switch-btn')) {
                createUI();
                // 首次启动，唤醒当前宠物
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
                }, 1000);
            } else {
                updateButtonText();
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

    // 切换宠物并写入记忆
    function switchPet(nextKey) {
        const btn = document.getElementById('pet-switch-btn');
        if (btn) btn.innerText = '切换中...';

        cleanOldPet();
        currentPetKey = nextKey;
        
        // 🚨 核心：把切换后的宠物写入本地存储，下次启动生效
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

        // 按 F9 强制刷新扫描
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F9') {
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

    setTimeout(() => {
        if (document.querySelector('lol-uikit-flat-button') || document.querySelector('.client-root')) {
            scanPets();
        } else {
            setTimeout(arguments.callee, 2000);
        }
    }, 5000);

})();
