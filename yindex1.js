// ==UserScript==
// @name         (RP/磨砂/金字)
// @namespace    ultimate-lobby-plugin
// @version      1.0.0
// @match        https://riot:*/*
// @grant        none
// @description  合并修改RP/BE、极简独立磨砂卡片、海克斯鎏金名字(选区安全)
// ==/UserScript==

(function () {
    'use strict';

    // ==========================================
    // 模块 1：注入所有核心 CSS (磨砂卡片 + 金色名字)
    // ==========================================
    const injectCSS = (doc) => {
        if (!doc || doc.getElementById('ultimate-lobby-style')) return;
        
        const style = doc.createElement('style');
        style.id = 'ultimate-lobby-style';
        style.innerHTML = `
            /* --- 极简独立磨砂卡片 --- */
            ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
            .custom-game-team-container-scroll-wrapper { overflow: hidden !important; }
            
            .custom-game-team {
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                position: static !important; 
            }
            
            .team-header {
                background: transparent !important;
                color: rgba(255, 255, 255, 0.6) !important;
                font-size: 14px !important;
                font-weight: bold !important;
                letter-spacing: 1px !important;
                margin-bottom: 10px !important;
                padding-left: 5px !important;
                border-bottom: none !important;
            }
            
            .custom-game-team-members {
                display: flex !important;
                flex-direction: column !important;
                gap: 6px !important;
                height: auto !important;
            }
            
            .custom-game-team-member,
            .custom-game-team-member-placeholder {
                background: rgba(10, 15, 20, 0.35) !important; 
                backdrop-filter: blur(8px) !important;
                -webkit-backdrop-filter: blur(8px) !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
                border-radius: 6px !important;
                height: 48px !important;
                margin: 0 !important;
                padding: 0 10px !important;
                transition: background 0.2s, border 0.2s !important;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important;
            }
            
            .custom-game-team-member:hover,
            .custom-game-team-member-placeholder:hover {
                background: rgba(255, 255, 255, 0.1) !important;
                border-color: rgba(255, 255, 255, 0.3) !important;
            }
            
            .custom-game-team-member.is-current-custom-player {
                border-left: 3px solid #c89b3c !important; 
                background: rgba(200, 155, 60, 0.15) !important;
                border-color: rgba(200, 155, 60, 0.3) !important;
            }
            
            .custom-game-team-member-placeholder {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: rgba(255, 255, 255, 0.2) !important;
                border-style: dashed !important; 
            }

            /* --- 海克斯鎏金名字 --- */
            .hextech-gold-text {
                background: linear-gradient(to right, #785a28 0%, #c89b3c 20%, #f0e6d2 40%, #c89b3c 60%, #785a28 100%) !important;
                background-size: 200% auto !important;
                -webkit-background-clip: text !important;
                color: transparent !important;
                font-weight: 800 !important;
                animation: gold-shimmer 3s linear infinite !important;
                filter: drop-shadow(0 0 6px rgba(200, 155, 60, 0.7)) !important; 
            }
            
            @keyframes gold-shimmer {
                0% { background-position: 0% center; }
                100% { background-position: 200% center; }
            }
        `;
        (doc.head || doc.documentElement).appendChild(style);
    };

    const scanAndInjectCSS = () => {
        injectCSS(document);
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                if (iframe.contentDocument) injectCSS(iframe.contentDocument);
            } catch (e) {}
        });
    };


    // ==========================================
    // 模块 2：修改 RP 和 BE 显示
    // ==========================================
    function modifyCurrency(el, selector) {
        var target = el ? el : document.querySelector(selector);
        if (!target) return;
        if (target.textContent.trim() === '999999') return;
        while (target.firstChild) target.removeChild(target.firstChild);
        target.appendChild(document.createTextNode('999999'));
    }

    function modifyAllCurrency() {
        modifyCurrency(null, '.currency-rp-top-up-enabled');
        modifyCurrency(null, '.currency-be-text');
    }


    // ==========================================
    // 模块 3：获取名字并应用金色特效
    // ==========================================
    let myGameName = null;

    const fetchMyName = async () => {
        try {
            const response = await fetch('/lol-summoner/v1/current-summoner');
            if (!response.ok) return;
            const data = await response.json();
            
            if (data.gameName) {
                myGameName = data.gameName;
                applyGoldName();
            }
        } catch (error) {
            console.error('获取 LCU 名字失败:', error);
        }
    };

    const applyGoldName = () => {
        if (!myGameName) return;

        // 【核心防崩】选人阶段直接跳过，防止引发界面错乱
        const isChampSelect = document.querySelector('.champ-select-root') || document.querySelector('.champion-select');
        if (isChampSelect) return;

        const elements = document.querySelectorAll('span, div, p, h1, h2, h3, l-ol-player-name');
        
        elements.forEach(el => {
            if (
                el.innerText && 
                el.innerText.includes(myGameName) && 
                !el.classList.contains('hextech-gold-text') && 
                el.children.length === 0 
            ) {
                if (el.innerText.length > 30) return; // 过滤长文本（如聊天记录）
                el.classList.add('hextech-gold-text');
            }
        });
    };


    // ==========================================
    // 模块 4：统一的启动引擎
    // ==========================================
    const init = () => {
        scanAndInjectCSS();
        modifyAllCurrency();
        fetchMyName();

        // 统一用 MutationObserver 监听所有变化
        const observer = new MutationObserver(() => {
            scanAndInjectCSS();
            modifyAllCurrency();
            applyGoldName();
        });

        if (document.body) {
            observer.observe(document.body, { 
                childList: true, 
                subtree: true, 
                characterData: true 
            });
        }
    };

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 兜底定时器（确保切页面、进房间时生效）
    setInterval(() => {
        scanAndInjectCSS();
        modifyAllCurrency();
        applyGoldName();
    }, 1000);

    setTimeout(init, 3000);

})();
