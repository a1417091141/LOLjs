// ==UserScript==
// @name         宠物管理器 (绝对防卡死版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      16.0.0
// ==/UserScript==

(function () {
    'use strict';

    // 写死列表，零网络请求
    const PET_LIST = ['yasuo', 'gewen'];
    let currentPetKey = localStorage.getItem('pet_current_model') || PET_LIST[0];
    window.stopPetAnimation = null;

    // 只执行一次的初始化函数
    function setup() {
        // 1. 唤醒宠物
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
        }, 1000);

        // 2. 把按钮插进去
        const versionBar = document.querySelector('.version-bar-container');
        if (!versionBar || document.getElementById('pet-manager-btn')) return;

        const btn = document.createElement('div');
        btn.id = 'pet-manager-btn';
        btn.style.cssText = `
            display: inline-flex; align-items: center; justify-content: center;
            width: 18px; height: 18px; margin-right: 6px;
            cursor: pointer; color: #C8AA6E;
        `;
        // 原生齿轮图标
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>`;
        
        btn.onclick = () => {
            const currentIndex = PET_LIST.indexOf(currentPetKey);
            const nextIndex = (currentIndex + 1) % PET_LIST.length;
            switchPet(PET_LIST[nextIndex]);
        };

        versionBar.prepend(btn);
        console.log("✅ 宠物按钮已成功注入");
    }

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

    // ==========================================
    // 🚨 终极防卡死启动策略
    // ==========================================
    // 既然不能监听 DOM 变化，我们就固定延迟 3 秒（等客户端完全加载完）去插入。
    // 绝对不占用主线程资源。
    
    if (document.readyState === 'complete') {
        setTimeout(setup, 3000);
    } else {
        window.addEventListener('load', () => {
            setTimeout(setup, 3000);
        });
    }

})();
