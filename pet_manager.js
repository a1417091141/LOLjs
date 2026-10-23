// ==UserScript==
// @name         宠物管理器 (完美原生克隆版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      24.0.0
// ==/UserScript==

(function () {
    'use strict';

    const PET_LIST = ['yasuo', 'gewen'];
    let currentPetKey = localStorage.getItem('pet_current_model') || PET_LIST[0];
    window.stopPetAnimation = null;

    // 切换逻辑
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

    // 注入按钮
    function injectBtn() {
        if (document.getElementById('pet-manager-btn')) return;

        // 🚨 核心：直接找到原生的 Bug 按钮
        const bugBtn = document.querySelector('.bug-report-button-always-top');
        if (!bugBtn) return; // 如果没加载出来就等下次

        // 1. 完美克隆这个 Bug 按钮（连同它所有的原生样式、边框、悬停效果）
        const btn = bugBtn.cloneNode(true);
        btn.id = 'pet-manager-btn';
        btn.removeAttribute('data-dd-action-name'); // 移除原生自带的数据属性防冲突
        
        // 2. 保留原本的 class (如 bug-report-button-always-top) 以继承宽度、高度、黑底金边
        // 但我们需要替换掉里面的图标
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="margin-top: 2px;">
                <path d="M12 11c-1.1 0-2 .9-2 2 0 1.1.9 2 2 2s2-.9 2-2c0-1.1-.9-2-2-2zm4-5c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-8 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 4c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm7.7 7.5c-.6-.8-1.5-1.3-2.5-1.3s-2 .5-2.7 1.3c-.5.6-.2 1.5.5 1.7 1.5.4 3 .4 4.4 0 .7-.2.9-1.1.3-1.7z"/>
            </svg>
        `;

        // 3. 点击事件
        btn.onclick = (e) => {
            e.preventDefault();
            const nextIndex = (PET_LIST.indexOf(currentPetKey) + 1) % PET_LIST.length;
            switchPet(PET_LIST[nextIndex]);
        };

        // 4. 将它插在 Bug 按钮的左侧，作为兄弟节点
        bugBtn.parentNode.insertBefore(btn, bugBtn);
    }

    // 启动引擎
    const init = () => {
        injectBtn();
        window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
        
        const observer = new MutationObserver(() => {
            injectBtn();
        });
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    setTimeout(init, 3000);
    setInterval(injectBtn, 2000);

})();
