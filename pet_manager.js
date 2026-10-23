// ==UserScript==
// @name         宠物管理器 (低负载分流版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      18.0.0
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

    // 核心逻辑：利用 requestIdleCallback 让浏览器在“空闲”时才执行
    // 如果客户端不支持，就用 setTimeout 延迟 5 秒
    const delayedStart = () => {
        // 1. 先延迟 5 秒，保证你所有的 yindex 插件早就加载完了
        setTimeout(() => {
            // 2. 唤醒宠物
            window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));

            // 3. 插入按钮
            const versionBar = document.querySelector('.version-bar-container');
            if (versionBar && !document.getElementById('pet-manager-btn')) {
                const btn = document.createElement('div');
                btn.id = 'pet-manager-btn';
                btn.innerText = '🐾'; // 用最简单的字符，避免渲染引擎压力
                btn.style.cssText = `
                    display: inline-flex; cursor: pointer; font-size: 14px;
                    margin-right: 8px; opacity: 0.8; color: #C8AA6E;
                `;
                btn.onclick = () => {
                    const nextIndex = (PET_LIST.indexOf(currentPetKey) + 1) % PET_LIST.length;
                    switchPet(PET_LIST[nextIndex]);
                };
                versionBar.prepend(btn);
                console.log("✅ 宠物按钮已延迟注入");
            }
        }, 5000); 
    };

    // 启动
    if (document.readyState === 'complete') {
        delayedStart();
    } else {
        window.addEventListener('load', delayedStart);
    }

})();
