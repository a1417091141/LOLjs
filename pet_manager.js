// ==UserScript==
// @name         宠物管理器 (极简断网安全版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      17.0.0
// ==/UserScript==

(function () {
    'use strict';

    // 纯粹的本地变量，不需要任何网络
    const PET_LIST = ['yasuo', 'gewen'];
    let currentPetKey = localStorage.getItem('pet_current_model') || PET_LIST[0];
    window.stopPetAnimation = null;

    // 核心逻辑：只在页面加载完成后延迟 2 秒执行一次
    window.addEventListener('load', () => {
        setTimeout(() => {
            // 1. 召唤默认宠物
            window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));

            // 2. 寻找版本号节点并注入按钮
            const versionBar = document.querySelector('.version-bar-container');
            if (!versionBar || document.getElementById('pet-manager-btn')) return;

            const btn = document.createElement('div');
            btn.id = 'pet-manager-btn';
            btn.innerText = '🐾'; // 用一个最简单的 emoji 代替复杂的 SVG，绝对不报错
            btn.style.cssText = `
                display: inline-flex; cursor: pointer; font-size: 12px;
                margin-right: 6px; opacity: 0.8; transition: opacity 0.2s;
            `;
            btn.onmouseover = () => btn.style.opacity = '1';
            btn.onmouseout = () => btn.style.opacity = '0.8';
            
            btn.onclick = () => {
                const nextIndex = (PET_LIST.indexOf(currentPetKey) + 1) % PET_LIST.length;
                switchPet(PET_LIST[nextIndex]);
            };

            versionBar.prepend(btn);
            console.log("✅ 宠物管理器加载完毕");

        }, 2000); // 延迟 2 秒，等所有插件都加载完
    });

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

})();
