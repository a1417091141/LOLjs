// ==UserScript==
// @name         宠物管理器 (极限防卡死版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      14.0.0
// ==/UserScript==

(function () {
    'use strict';

    // 🚨 写死列表，绝对不发起任何网络请求！保证 0 阻塞
    const PET_LIST = ['yasuo', 'gewen'];
    let currentPetKey = localStorage.getItem('pet_current_model') || PET_LIST[0];
    window.stopPetAnimation = null;

    // 1. 生成那个小齿轮按钮
    function injectButton() {
        if (document.getElementById('pet-manager-btn')) return;
        const versionBar = document.querySelector('.version-bar-container');
        if (!versionBar) return;

        const btn = document.createElement('div');
        btn.id = 'pet-manager-btn';
        btn.style.cssText = `
            display: inline-flex; align-items: center; justify-content: center;
            width: 20px; height: 20px; margin-right: 6px;
            cursor: pointer; color: #C8AA6E;
        `;
        // 一个极简的小齿轮
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>`;
        
        // 点击切换宠物
        btn.onclick = () => {
            const currentIndex = PET_LIST.indexOf(currentPetKey);
            const nextIndex = (currentIndex + 1) % PET_LIST.length;
            switchPet(PET_LIST[nextIndex]);
        };

        versionBar.prepend(btn);
    }

    // 2. 切换逻辑
    function switchPet(nextKey) {
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

    // 3. 启动引擎（完全照搬你的缝合怪模板）
    const init = () => {
        // 唤醒默认宠物
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
        }, 1000);

        // 监听 DOM 变化，插入按钮
        const observer = new MutationObserver(() => {
            injectButton();
        });

        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
        injectButton();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 兜底定时器
    setInterval(() => {
        injectButton();
    }, 2000);

})();
