// ==UserScript==
// @name         大厅终极缝合怪 (带透明度调节)
// @namespace    ultimate-lobby-plugin
// @match        https://riot:*/*
// @grant        none
// @version      2.0.0
// @description  合并RP修改、磨砂卡片(可调透明度)、鎏金名字
// ==/UserScript==

(function () {
    'use strict';

    // ==========================================
    // 模块 1：动态生成 CSS
    // ==========================================
    // 从本地读取透明度设置，默认 0.35
    let currentOpacity = parseFloat(localStorage.getItem('glass_card_opacity') || '0.35');

    const getRoomCSS = () => `
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
            /* 💡 这里的透明度被改成了动态变量 */
            background: rgba(10, 15, 20, ${currentOpacity}) !important; 
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
            background: rgba(200, 155, 60, ${currentOpacity}) !important;
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

    const injectCSS = (doc) => {
        if (!doc) return;
        let style = doc.getElementById('ultimate-lobby-style');
        
        if (!style) {
            style = doc.createElement('style');
            style.id = 'ultimate-lobby-style';
            (doc.head || doc.documentElement).appendChild(style);
        }
        
        // 每次注入时，更新 CSS 内容（读取最新的透明度）
        style.innerHTML = getRoomCSS();
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
        } catch (error) {}
    };

    const applyGoldName = () => {
        if (!myGameName) return;

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
                if (el.innerText.length > 30) return; 
                el.classList.add('hextech-gold-text');
            }
        });
    };


    // ==========================================
    // 模块 4：悬浮透明度控制面板
    // ==========================================
    const createControlPanel = () => {
        if (document.getElementById('glass-opacity-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'glass-opacity-panel';
        panel.style.cssText = `
            position: fixed; top: 80px; right: 20px; z-index: 999999;
            background: rgba(0, 0, 0, 0.85); border: 1px solid #c89b3c;
            padding: 10px 15px; border-radius: 8px; color: white;
            font-family: sans-serif; font-size: 12px; display: flex;
            flex-direction: column; gap: 5px; backdrop-filter: blur(10px);
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        `;

        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span>磨砂透明度: <span id="opacity-val" style="color:#c89b3c; font-weight:bold;">${currentOpacity}</span></span>
                <span id="close-panel" style="cursor:pointer; color:#ff5555; margin-left:10px;">✖</span>
            </div>
            <input type="range" id="opacity-slider" min="0" max="0.9" step="0.05" value="${currentOpacity}" 
                style="width: 150px; cursor: pointer; accent-color: #c89b3c;">
        `;

        document.body.appendChild(panel);

        // 绑定事件
        const slider = document.getElementById('opacity-slider');
        const valText = document.getElementById('opacity-val');
        const closeBtn = document.getElementById('close-panel');

        slider.addEventListener('input', (e) => {
            currentOpacity = parseFloat(e.target.value);
            valText.innerText = currentOpacity;
            // 保存到本地
            localStorage.setItem('glass_card_opacity', currentOpacity);
            // 瞬间刷新样式
            scanAndInjectCSS(); 
        });

        closeBtn.addEventListener('click', () => {
            panel.style.display = 'none';
        });
    };


    // ==========================================
    // 模块 5：统一启动引擎
    // ==========================================
    const init = () => {
        scanAndInjectCSS();
        modifyAllCurrency();
        fetchMyName();
        createControlPanel();

        const observer = new MutationObserver(() => {
            scanAndInjectCSS();
            modifyAllCurrency();
            applyGoldName();
            createControlPanel(); // 防止被官方刷没
        });

        if (document.body) {
            observer.observe(document.body, { 
                childList: true, 
                subtree: true, 
                characterData: true 
            });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 兜底定时器
    setInterval(() => {
        scanAndInjectCSS();
        modifyAllCurrency();
        applyGoldName();
        createControlPanel();
    }, 1000);

    setTimeout(init, 3000);

})();
