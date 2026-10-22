// ==UserScript==
// @name         宠物管理器 (沙盒防卡死终极版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      8.0.0
// ==/UserScript==

(function () {
    'use strict';

    const REPO = 'a1417091141/LOLjs';
    const CDN_BASE = `https://cdn.jsdmirror.com/gh/${REPO}@main`;
    const API_PROXY = 'http://127.0.0.1:18888/github-api';

    let currentPetKey = localStorage.getItem('pet_current_model') || 'yasuo';
    // 🚨 极速保底，保证按钮绝对秒出
    let PET_LIST = ['yasuo', 'gewen']; 

    window.stopPetAnimation = null;

    // ==========================================
    // 1. 极简 UI 生成 (纯同步，0毫秒，绝不卡插件)
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
        const currentIndex = PET_LIST.indexOf(currentPetKey);
        const nextIndex = (currentIndex + 1) % PET_LIST.length;
        btn.innerText = `切换到: ${PET_LIST[nextIndex]}`;
    }

    // ==========================================
    // 2. 切换逻辑
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
    // 3. 用 iframe 沙盒偷偷联网（绝对不卡主进程）
    // ==========================================
    function scanPetsInSandbox() {
        // 创建一个隐藏的 iframe 去干脏活累活
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        // 把请求代码塞进去执行
        iframe.contentWindow.fetch(`${CDN_BASE}/plugins.json?t=${Date.now()}`)
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
                        if (JSON.stringify(PET_LIST) !== JSON.stringify(scannedPets)) {
                            console.log("🔄 沙盒扫描到最新宠物列表:", scannedPets);
                            PET_LIST = scannedPets;
                            if (!PET_LIST.includes(currentPetKey)) switchPet(PET_LIST[0]);
                            updateButtonText();
                        }
                    }
                }
                iframe.remove(); // 用完就删
            })
            .catch(e => {
                console.log("ℹ️ 沙盒联网失败，保持保底名单");
                iframe.remove();
            });
    }

    // ==========================================
    // 4. 启动
    // ==========================================
    function boot() {
        createUI();
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
        }, 500);

        // 延迟 3 秒，等 yindex 插件全部加载完毕，再通过 iframe 去联网
        setTimeout(() => {
            scanPetsInSandbox();
        }, 3000);
    }

    // 监听大厅就绪
    let checkTimer = setInterval(() => {
        const isReady = document.querySelector('lol-uikit-flat-button') || 
                        document.querySelector('.client-root') || 
                        document.querySelector('.parties-game-navs');
        if (isReady) {
            clearInterval(checkTimer);
            boot(); 
        }
    }, 500);

    // 按 F9 强制刷新
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F9') {
            scanPetsInSandbox();
        }
    });

})();
