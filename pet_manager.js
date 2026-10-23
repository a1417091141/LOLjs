// ==UserScript==
// @name         宠物管理器 (完美原生无缝版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      15.0.0
// ==/UserScript==

(function () {
    'use strict';

    // 写死保底列表
    const PET_LIST = ['yasuo', 'gewen'];
    let currentPetKey = localStorage.getItem('pet_current_model') || PET_LIST[0];
    window.stopPetAnimation = null;

    // 1. 生成/注入原生样式按钮
    function injectButton() {
        const versionBar = document.querySelector('.version-bar-container');
        if (!versionBar) return;

        // 如果已经注入过，先不重复注入，但需要确保版本号被缩短
        if (!document.getElementById('pet-manager-btn')) {
            // 🚨 核心：克隆原生的 Bug 按钮，完美继承它的所有 CSS 样式（颜色、大小、悬停效果）
            const nativeBugBtn = document.querySelector('.bug-report-button-always-top');
            let btn;

            if (nativeBugBtn) {
                btn = nativeBugBtn.cloneNode(true);
                btn.removeAttribute('data-dd-action-name'); // 移除原生特有的行为
                btn.className = ''; // 清空原本的特定类，靠外部节点维持样式
            } else {
                // 如果没找到原生 Bug 按钮，给个兜底样式
                btn = document.createElement('button');
                btn.style.cssText = 'width:16px; height:16px; margin-right:4px; fill:#C8AA6E; cursor:pointer;';
            }

            btn.id = 'pet-manager-btn';
            // 稍微缩小一点，让它看起来更精致
            btn.style.cssText += 'width:16px; height:16px; margin-right:6px; cursor:pointer; transform:scale(0.9); transition:transform 0.2s;';
            
            // 替换里面的图标为一个小齿轮
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>`;
            
            btn.onmouseover = () => btn.style.transform = 'scale(1.1)';
            btn.onmouseout = () => btn.style.transform = 'scale(0.9)';
            
            btn.onclick = () => {
                const currentIndex = PET_LIST.indexOf(currentPetKey);
                const nextIndex = (currentIndex + 1) % PET_LIST.length;
                switchPet(PET_LIST[nextIndex]);
            };

            // 把克隆的按钮插到版本号前面
            versionBar.prepend(btn);
            console.log("✅ 原生样式宠物按钮已注入");
        }

        // 🚨 核心修改：缩短版本号显示
        // 查找内部包含 "V16.21" 的文本节点并截断
        if (!versionBar.dataset.shortened) {
            versionBar.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('V')) {
                    // 将 V16.21 截断为 V16.2
                    node.textContent = node.textContent.replace(/V[\d.]+/, 'V16.2');
                    versionBar.dataset.shortened = 'true';
                }
            });
        }
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
        
        // 按钮闪一下反馈
        const btn = document.getElementById('pet-manager-btn');
        if(btn) {
            btn.style.color = '#fff';
            setTimeout(() => btn.style.color = '', 300);
        }
    }

    // 3. 启动引擎 (轻量、防卡死)
    const init = () => {
        // 唤醒宠物
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
        }, 1000);

        // 监听 DOM，一旦版本号栏出现就注入
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

    // 兜底定时器，防丢
    setInterval(injectButton, 2000);

})();
