// ==UserScript==
// @name         宠物管理器 (原生方块完美版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      23.0.0
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
        const versionBar = document.querySelector('.version-bar-container');
        if (!versionBar) return;

        // 🚨 核心：直接找一个原生的按钮作为模板（语音按钮或反馈按钮）
        const nativeBtn = document.querySelector('.social-button') || document.querySelector('.bug-report-button-always-top');
        
        let btn;
        if (nativeBtn) {
            // 克隆原生按钮的外壳（这会自动继承所有的黑底、金边、尺寸和悬停效果）
            btn = nativeBtn.cloneNode(true);
            btn.className = ''; // 去除原本特有的行为 class，防止报错
            // 清理内部元素，只留外壳
            btn.innerHTML = ''; 
            btn.style.cssText = 'display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; margin-right: 5px; cursor: pointer; border-radius: 2px;';
        } else {
            // 如果没找到原生按钮（兜底），就手写一个相似的
            btn = document.createElement('button');
            btn.style.cssText = 'display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; margin-right: 5px; cursor: pointer; background: #0f1114; border: 1px solid #5b4a22; border-radius: 2px;';
        }

        btn.id = 'pet-manager-btn';

        // 内部放一个小巧的金色爪印图标
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="#C8AA6E">
                <path d="M12 11c-1.1 0-2 .9-2 2 0 1.1.9 2 2 2s2-.9 2-2c0-1.1-.9-2-2-2zm4-5c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-8 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 4c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm7.7 7.5c-.6-.8-1.5-1.3-2.5-1.3s-2 .5-2.7 1.3c-.5.6-.2 1.5.5 1.7 1.5.4 3 .4 4.4 0 .7-.2.9-1.1.3-1.7z"/>
            </svg>
        `;

        btn.onclick = () => {
            const nextIndex = (PET_LIST.indexOf(currentPetKey) + 1) % PET_LIST.length;
            switchPet(PET_LIST[nextIndex]);
        };

        // 插入到版本号前面
        versionBar.prepend(btn);
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
