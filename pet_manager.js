// ==UserScript==
// @name         宠物管理器 (原生版本号面板版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      13.0.0
// ==/UserScript==

(function () {
    'use strict';

    const REPO = 'a1417091141/LOLjs';
    const CDN_BASE = `https://cdn.jsdmirror.com/gh/${REPO}@main`;
    const API_PROXY = 'http://127.0.0.1:18888/github-api';

    let currentPetKey = localStorage.getItem('pet_current_model') || 'yasuo';
    let PET_LIST = ['yasuo', 'gewen']; // 保底名单
    window.stopPetAnimation = null;

    // ==========================================
    // 1. 把按钮插到版本号旁边
    // ==========================================
    function injectButton() {
        if (document.getElementById('pet-manager-btn')) return;

        const versionBar = document.querySelector('.version-bar-container');
        if (!versionBar) return; // 还没加载出来

        const btn = document.createElement('div');
        btn.id = 'pet-manager-btn';
        // 模仿客户端原生小图标的样式
        btn.style.cssText = `
            display: inline-flex; align-items: center; justify-content: center;
            width: 24px; height: 24px; margin-right: 8px;
            cursor: pointer; color: #C8AA6E; opacity: 0.8;
            transition: opacity 0.2s, transform 0.1s;
        `;
        // 用一个可爱的海克斯小齿轮/宠物图标（SVG）
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
            </svg>
        `;
        
        btn.onmouseover = () => { btn.style.opacity = '1'; btn.style.transform = 'scale(1.1)'; };
        btn.onmouseout = () => { btn.style.opacity = '0.8'; btn.style.transform = 'scale(1)'; };
        btn.onclick = openSettingsPanel;

        // 插在版本号文字的最前面
        versionBar.prepend(btn);
        console.log("✅ 按钮已成功插入版本号栏");
    }

    // ==========================================
    // 2. 设置面板 UI
    // ==========================================
    function openSettingsPanel() {
        if (document.getElementById('pet-settings-panel')) return;

        // 遮罩层
        const overlay = document.createElement('div');
        overlay.id = 'pet-settings-panel';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.6); z-index: 2147483647;
            display: flex; align-items: center; justify-content: center;
            font-family: 'Friz Quadrata', Arial, sans-serif;
        `;

        // 面板主体（海克斯暗金风格）
        const panel = document.createElement('div');
        panel.style.cssText = `
            background: linear-gradient(180deg, #1e2328 0%, #0a1014 100%);
            border: 2px solid #785A28; border-radius: 4px;
            width: 450px; padding: 20px; position: relative;
            box-shadow: 0 0 30px rgba(0,0,0,0.9), inset 0 0 20px rgba(200,170,110,0.1);
            color: #A09B8C;
        `;

        // 关闭按钮
        const closeBtn = document.createElement('div');
        closeBtn.innerText = '✕';
        closeBtn.style.cssText = `position: absolute; top: 10px; right: 15px; cursor: pointer; color: #C8AA6E; font-size: 18px;`;
        closeBtn.onclick = () => overlay.remove();

        // 标题
        const title = document.createElement('h2');
        title.innerText = '小小英雄管理器';
        title.style.cssText = `color: #F0E6D2; font-size: 20px; margin: 0 0 20px 0; border-bottom: 1px solid #3c3c41; padding-bottom: 10px;`;

        // 宠物列表容器
        const listContainer = document.createElement('div');
        listContainer.id = 'pet-list-container';
        listContainer.style.cssText = `display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;`;

        // 渲染宠物选项
        function renderList() {
            listContainer.innerHTML = '';
            PET_LIST.forEach(pet => {
                const isActive = pet === currentPetKey;
                const item = document.createElement('div');
                item.innerText = pet.toUpperCase();
                item.style.cssText = `
                    padding: 8px 16px; cursor: pointer; border-radius: 4px; font-weight: bold;
                    border: 1px solid ${isActive ? '#C8AA6E' : '#3c3c41'};
                    background: ${isActive ? 'rgba(200,170,110,0.2)' : 'transparent'};
                    color: ${isActive ? '#C8AA6E' : '#A09B8C'};
                    transition: all 0.2s;
                `;
                item.onclick = () => {
                    if (currentPetKey === pet) return;
                    switchPet(pet);
                    renderList(); // 刷新高亮
                };
                listContainer.appendChild(item);
            });
        }
        renderList();

        // 设置参数区 (预留)
        const settingsArea = document.createElement('div');
        settingsArea.style.cssText = `font-size: 12px; color: #5B5A56; border-top: 1px solid #3c3c41; padding-top: 15px;`;
        settingsArea.innerHTML = `
            <div style="margin-bottom: 8px;">✦ 加载速度跟随设备性能</div>
            <div>✦ 更多参数敬请期待...</div>
        `;

        panel.appendChild(closeBtn);
        panel.appendChild(title);
        panel.appendChild(listContainer);
        panel.appendChild(settingsArea);
        overlay.appendChild(panel);
        
        // 点击遮罩层关闭
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

        document.body.appendChild(overlay);
    }

    // ==========================================
    // 3. 切换宠物与清理
    // ==========================================
    function switchPet(nextKey) {
        // 面板里的小动画效果
        const items = document.querySelectorAll('#pet-list-container div');
        items.forEach(el => { if(el.innerText.toLowerCase() === nextKey) el.innerText = '加载中...'; });

        if (window.stopPetAnimation) {
            try { window.stopPetAnimation(); } catch(e){}
            window.stopPetAnimation = null;
        }
        const old = document.getElementById('three-pet-container');
        if (old) old.remove();

        currentPetKey = nextKey;
        localStorage.setItem('pet_current_model', nextKey);
        window.dispatchEvent(new CustomEvent('spawn_pet', { detail: nextKey }));
    }

    // ==========================================
    // 4. 后台获取最新列表
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

                if (scannedPets.length > 0 && JSON.stringify(PET_LIST) !== JSON.stringify(scannedPets)) {
                    PET_LIST = scannedPets;
                    if (!PET_LIST.includes(currentPetKey)) currentPetKey = PET_LIST[0];
                }
            })
            .catch(e => console.log("ℹ️ 云端列表同步失败，使用本地配置"));
    }

    // ==========================================
    // 5. 启动引擎
    // ==========================================
    const init = () => {
        // 提前唤醒默认宠物
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
        }, 1000);

        scanPetsInBackground();

        // 核心：用 MutationObserver 盯着版本号出来
        const observer = new MutationObserver(() => {
            const versionBar = document.querySelector('.version-bar-container');
            if (versionBar && !document.getElementById('pet-manager-btn')) {
                injectButton();
            }
        });

        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }

        // 启动时先尝试注入一次
        injectButton();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 兜底定时器
    setInterval(() => {
        const versionBar = document.querySelector('.version-bar-container');
        if (versionBar && !document.getElementById('pet-manager-btn')) {
            injectButton();
        }
    }, 2000);

})();
