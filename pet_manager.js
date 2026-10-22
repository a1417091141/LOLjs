// ==UserScript==
// @name         宠物管理器 (不死鸟稳定版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      5.0.0
// ==/UserScript==

(async function () {
    'use strict';

    const REPO = 'a1417091141/LOLjs';
    const CDN_BASE = `https://cdn.jsdmirror.com/gh/${REPO}@main`;
    const API_PROXY = 'http://127.0.0.1:18888/github-api';

    // 🚨 保底名单：就算网络全断、JSON 读不到，也绝对能加载这两个
    const FALLBACK_PETS = ['yasuo', 'gewen'];

    let currentPetKey = localStorage.getItem('pet_current_model') || 'yasuo';
    let PET_LIST = [...FALLBACK_PETS]; // 默认先塞入保底名单
    let retryCount = 0;

    window.stopPetAnimation = null;

    // ==========================================
    // 1. 自动扫描（带重试和防崩溃）
    // ==========================================
    async function scanPets() {
        try {
            let jsonUrl = `${CDN_BASE}/plugins.json?t=${Date.now()}`;
            
            // 尝试使用本地代理打破缓存，最多等 1.5 秒，超时就跳过
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1500);
                const commitRes = await fetch(API_PROXY, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (commitRes.ok) {
                    const commitHash = await commitRes.text();
                    if (commitHash && commitHash.length > 5) {
                        jsonUrl = `https://cdn.jsdmirror.com/gh/${REPO}@${commitHash.trim()}/plugins.json`;
                    }
                }
            } catch(e) {
                // 代理超时失败无所谓，继续用主分支的 URL 请求
            }

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

                // 如果扫描到了新宠物，合并更新列表
                if (scannedPets.length > 0) {
                    PET_LIST = scannedPets;
                }
            }
        } catch(e) {
            console.warn("⚠️ 在线扫描失败，已启用本地保底宠物名单:", e.message);
        } finally {
            // 无论扫描成功还是失败，都必定执行 UI 初始化
            initManager();
        }
    }

    // ==========================================
    // 2. 初始化管理器与 UI
    // ==========================================
    function initManager() {
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
            updateButtonText();
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
        
        // 确保 body 存在
        if (!document.body) {
            setTimeout(createUI, 500);
            return;
        }

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

        // 按 F9 热重载
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F9') {
                if (btn) btn.innerText = '扫描中...';
                scanPets(); 
            }
        });
    }

    function updateButtonText() {
        const btn = document.getElementById('pet-switch-btn');
        if (!btn) return;
        if (PET_LIST.length <= 1) {
            btn.innerText = '仅发现 1 个宠物';
            return;
        }
        const currentIndex = PET_LIST.indexOf(currentPetKey);
        const nextIndex = (currentIndex + 1) % PET_LIST.length;
        btn.innerText = `切换到: ${PET_LIST[nextIndex]}`;
    }

    // ==========================================
    // 3. 游戏启动引导
    // ==========================================
    function waitForClientReady() {
        const isReady = document.querySelector('lol-uikit-flat-button') || 
                        document.querySelector('.client-root') || 
                        document.querySelector('.parties-game-navs');
        
        if (isReady) {
            scanPets(); // 客户端就绪，开始扫描并初始化
        } else {
            // 如果没就绪，每 2 秒检查一次
            retryCount++;
            if (retryCount > 30) { // 超过 60 秒还是找不到客户端界面，强行初始化
                console.warn("⚠️ 等待客户端 UI 超时，强行启动管理器");
                scanPets();
            } else {
                setTimeout(waitForClientReady, 2000);
            }
        }
    }

    // 启动
    waitForClientReady();

})();
