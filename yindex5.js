// ==PenguLoader==
// @name         海克斯登场率 (物理坐标追踪版)
// @description  绕过WebGL事件吞噬，使用全局鼠标监听实现100%可拖拽和折叠
// @version      19.0.0
// ==/PenguLoader==

(function () {
    'use strict';

    const DATA_API_ORIGIN = "https://data.dtodo.cn";
    const DATA_API_PREFIX = "/api/client/v1";
    const WATCH_AUGMENTS = [
        "钢化你心", "坦克引擎", "尖端发明家", "歌利亚巨人", "科学狂人",
        "炽燃利息", "有始有终", "升级：献祭", "掷骰狂人", "生机迸发"
    ];

    let manifestCache = null;
    let lastChampionId = null;
    let isShowing = false;
    let isCollapsed = false;
    let panel = null;
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    // ==========================================
    // 1. 全局物理坐标追踪 (绝杀事件吞噬)
    // ==========================================
    const handleGlobalMouseDown = (e) => {
        if (!isShowing || !panel) return;

        const toggleBtn = document.getElementById('augment-toggle');
        const headerEl = document.getElementById('augment-header');
        if (!toggleBtn || !headerEl) return;

        const btnRect = toggleBtn.getBoundingClientRect();
        const headerRect = headerEl.getBoundingClientRect();

        // 判断是否点中折叠按钮
        if (e.clientX >= btnRect.left - 10 && e.clientX <= btnRect.right + 10 && 
            e.clientY >= btnRect.top - 10 && e.clientY <= btnRect.bottom + 10) {
            
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            isCollapsed = !isCollapsed;
            const bodyEl = document.getElementById('augment-body');
            
            if (isCollapsed) {
                bodyEl.style.display = 'none';
                headerEl.style.borderBottom = 'none';
                headerEl.style.marginBottom = '0';
                headerEl.style.paddingBottom = '0';
                toggleBtn.innerText = '[+]';
                
                panel.style.width = '220px';
                panel.style.top = '80px';
                panel.style.left = 'auto';
                panel.style.right = '20px';
                panel.style.transform = 'none';
            } else {
                bodyEl.style.display = 'flex';
                headerEl.style.borderBottom = '1px solid #3C2E14';
                headerEl.style.marginBottom = '8px';
                headerEl.style.paddingBottom = '6px';
                toggleBtn.innerText = '[-]';
                
                panel.style.width = '420px';
                panel.style.right = 'auto';
                panel.style.top = '50%';
                panel.style.left = '50%';
                panel.style.transform = 'translate(-50%, -50%)';
            }
            return;
        }

        // 判断是否点中标题栏（拖拽区域）
        if (e.clientX >= headerRect.left && e.clientX <= headerRect.right && 
            e.clientY >= headerRect.top && e.clientY <= headerRect.bottom) {
            
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = panel.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            // 解除 transform 和 right，改用 left/top 绝对定位
            panel.style.transform = 'none';
            panel.style.right = 'auto';
            panel.style.left = initialLeft + 'px';
            panel.style.top = initialTop + 'px';
            panel.style.cursor = 'grabbing';
        }
    };

    const handleGlobalMouseMove = (e) => {
        if (!isDragging || !panel) return;
        e.preventDefault();
        e.stopPropagation();
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        panel.style.left = (initialLeft + dx) + 'px';
        panel.style.top = (initialTop + dy) + 'px';
    };

    const handleGlobalMouseUp = (e) => {
        if (isDragging) {
            isDragging = false;
            if (panel) panel.style.cursor = 'default';
        }
    };

    // 绑定全局事件，必须拦截在最外层
    window.addEventListener('mousedown', handleGlobalMouseDown, true);
    window.addEventListener('mousemove', handleGlobalMouseMove, true);
    window.addEventListener('mouseup', handleGlobalMouseUp, true);


    // ==========================================
    // 2. 创建面板
    // ==========================================
    function createPanel() {
        if (document.getElementById('augment-center-panel')) {
            panel = document.getElementById('augment-center-panel');
            return;
        }

        panel = document.createElement('div');
        panel.id = 'augment-center-panel';
        
        panel.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 420px !important;
            background: rgba(1, 10, 19, 0.95) !important;
            border: 1px solid #785A28 !important;
            border-radius: 4px !important;
            z-index: 2147483647 !important;
            display: none !important;
            flex-direction: column !important;
            font-family: 'Microsoft YaHei', sans-serif !important;
            color: #A09B8C !important;
            padding: 10px !important;
            box-sizing: border-box !important;
            box-shadow: 0 5px 25px rgba(0,0,0,0.95) !important;
            pointer-events: auto !important;
            user-select: none !important;
        `;

        panel.innerHTML = `
            <div id="augment-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #3C2E14; padding-bottom: 6px; margin-bottom: 8px; cursor: move !important;">
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span style="font-size: 13px; font-weight: bold; color: #C8AA6E; letter-spacing: 1px;">海克斯登场率</span>
                    <span id="augment-hero" style="font-size: 13px; color: #F0E6D2; font-weight: bold;">加载中...</span>
                </div>
                <div id="augment-toggle" style="cursor: pointer !important; color: #C8AA6E; font-weight: bold; padding: 2px 8px; user-select: none; background: rgba(200,155,60,0.2); border-radius: 3px;" title="收缩/展开">[-]</div>
            </div>
            <div id="augment-body" style="display: flex; gap: 15px;">
                <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                    <div style="font-size: 11px; color: #5B5A56; border-bottom: 1px solid #1E2328; padding-bottom: 3px;">登场率 TOP 10</div>
                    <div id="augment-top-list"><div style="color:#888; font-size:12px; padding:5px 0;">请求中...</div></div>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                    <div style="font-size: 11px; color: #5B5A56; border-bottom: 1px solid #1E2328; padding-bottom: 3px;">重点关注</div>
                    <div id="augment-watch-list"></div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        const toggleBtn = document.getElementById('augment-toggle');
        const bodyEl = document.getElementById('augment-body');
        const headerEl = document.getElementById('augment-header');

        if (isCollapsed) {
            bodyEl.style.display = 'none';
            headerEl.style.borderBottom = 'none';
            headerEl.style.marginBottom = '0';
            headerEl.style.paddingBottom = '0';
            toggleBtn.innerText = '[+]';
            panel.style.width = '220px';
            panel.style.top = '80px';
            panel.style.left = 'auto';
            panel.style.right = '20px';
            panel.style.transform = 'none';
        }
    }

    // ==========================================
    // 3. 数据获取与渲染
    // ==========================================
    async function fetchManifest() {
        if (manifestCache) return manifestCache;
        try {
            const res = await fetch(`${DATA_API_ORIGIN}${DATA_API_PREFIX}/config`);
            const conf = await res.json();
            if (!conf.manifest) return null;
            const res2 = await fetch(`${DATA_API_ORIGIN}${conf.manifest}`);
            manifestCache = await res2.json();
            return manifestCache;
        } catch (e) { return null; }
    }

    async function fetchChampionData(championId) {
        const manifest = await fetchManifest();
        if (!manifest) return null;
        const fileInfo = manifest.files.find(f => f.path === `champions/${championId}.json`);
        if (!fileInfo) return null;
        try {
            const res = await fetch(`${DATA_API_ORIGIN}${fileInfo.url}`);
            return await res.json();
        } catch (e) { return null; }
    }

    function createRow(name, pickRate, winRate, nameColor, pickColor) {
        let displayName = name.length > 6 ? name.substring(0, 5) + '…' : name;
        const pr = pickRate != null ? (pickRate * 100).toFixed(1) : "0.0";
        const wr = winRate != null ? (winRate * 100).toFixed(1) : "0.0";
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; padding: 2px 0;">
                <div style="color: ${nameColor}; width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayName}</div>
                <div style="color: ${pickColor}; font-family: Consolas, monospace; font-weight: bold; text-align: right; width: 40px;">${pr}</div>
                <div style="color: #5B5A56; font-family: Consolas, monospace; text-align: right; width: 40px;">${wr}</div>
            </div>
        `;
    }

    function renderData(championName, championTitle, augments) {
        if (!document.getElementById('augment-hero')) return;

        document.getElementById('augment-hero').innerText = `${championName}`;
        
        const sortedByPick = [...augments].sort((a, b) => (b.stats?.pickRate || 0) - (a.stats?.pickRate || 0));
        let topHtml = '';
        sortedByPick.slice(0, 10).forEach(aug => {
            topHtml += createRow(aug.name || '未知', aug.stats?.pickRate, aug.stats?.winRate, '#F0E6D2', '#2ECC71');
        });
        document.getElementById('augment-top-list').innerHTML = topHtml;

        const nameIndex = {};
        augments.forEach(aug => { nameIndex[(aug.name || '').replace(/\s+/g, '')] = aug; });
        let watchItems = WATCH_AUGMENTS.map(wn => {
            const aug = nameIndex[wn.replace(/\s+/g, '')];
            return aug ? { name: aug.name, pick: aug.stats?.pickRate || 0, win: aug.stats?.winRate, has: true } : { name: wn, pick: 0.0, win: null, has: false };
        }).sort((a, b) => b.pick - a.pick);

        let watchHtml = '';
        watchItems.forEach(item => {
            watchHtml += item.has ? createRow(item.name, item.pick, item.win, '#C8AA6E', '#2ECC71') : createRow(item.name, 0.0, 0.0, '#5B5A56', '#E74C3C');
        });
        document.getElementById('augment-watch-list').innerHTML = watchHtml;
    }

    // ==========================================
    // 4. 轮询
    // ==========================================
    async function pollChampSelect() {
        try {
            createPanel();

            const isChampSelect = document.querySelector('.champion-select-main-container');
            if (!isChampSelect) {
                if (panel && panel.style.display !== 'none') panel.style.display = 'none';
                isShowing = false;
                lastChampionId = null;
                return;
            }

            const sessionRes = await fetch('/lol-champ-select/v1/session');
            if (!sessionRes.ok) {
                if (panel) panel.style.display = 'none';
                isShowing = false;
                return;
            }

            const session = await sessionRes.json();
            let lockedId = null;
            if (session.localPlayerCellId !== undefined) {
                const me = session.myTeam.find(p => p.cellId === session.localPlayerCellId);
                if (me && me.championId > 0) lockedId = me.championId;
            }

            if (!lockedId) {
                if (isShowing && panel) { panel.style.display = 'none'; isShowing = false; }
                lastChampionId = null;
                return;
            }

            if (!isShowing && panel) { panel.style.display = 'flex'; isShowing = true; }

            if (lockedId !== lastChampionId) {
                lastChampionId = lockedId;
                if (document.getElementById('augment-hero')) {
                    document.getElementById('augment-hero').innerText = "数据请求中...";
                    document.getElementById('augment-top-list').innerHTML = '<div style="color:#888; font-size:12px; padding:5px 0;">请求中...</div>';
                    document.getElementById('augment-watch-list').innerHTML = '';
                }

                const data = await fetchChampionData(lockedId);
                if (data) {
                    const detail = data.data || data;
                    renderData(detail.champion?.name || '未知', detail.champion?.title || '', detail.augments || []);
                } else {
                    if (document.getElementById('augment-hero')) {
                        document.getElementById('augment-hero').innerText = "接口超时";
                        document.getElementById('augment-top-list').innerHTML = '<div style="color:#E74C3C; font-size:12px; padding:5px 0;">无法连接数据源</div>';
                    }
                }
            }
        } catch (e) {}
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setInterval(pollChampSelect, 500);
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            setInterval(pollChampSelect, 500);
        });
    }

})();
