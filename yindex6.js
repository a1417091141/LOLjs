// ==PenguLoader==
// @name         海克斯自动选人 (重开修复版)
// @description  适配LOL原生风格，DataStore持久化，完美兼容国服海克斯大乱斗 (3270)
// @version      415.0.0
// ==/PenguLoader==

(function () {
    'use strict';

    // ===== 1. 持久化读取 =====
    const KEY_ENABLED = 'auto_pick_enabled';
    const KEY_FALLBACK = 'auto_pick_fallback';
    const KEY_PRIORITY = 'auto_pick_priority';
    const KEY_CUSTOM_ONLY = 'auto_pick_custom_only';

    let isEnabled = DataStore.get(KEY_ENABLED, false);
    let fallbackStrategy = DataStore.get(KEY_FALLBACK, 'random');
    let priorityList = DataStore.get(KEY_PRIORITY, []) || [];

    let customOnly = DataStore.get(KEY_CUSTOM_ONLY, false) === true;

    let allChampions = [];
    let checkTimer = null;
    let hasLockedInitial = false;
    let hasSwappedOnce = false;
    let isPanelOpen = false;
    let dragSrcIndex = null;
    const WUKONG_ID = 62;
    let swapTargetId = null;
    let lastSwapAttemptTime = 0;
    let isCustomGame = false;

    // 🚨 重开修复：跨局状态检测
    let lastSessionKey = null;
    let fallbackPickId = null;

    // ===== 2. 英雄数据加载 =====
    const DATA_API_ORIGIN = "https://data.dtodo.cn";
    const DATA_API_PREFIX = "/api/client/v1";

    async function loadAllChampions() {
        if (allChampions.length > 0) return;
        try {
            const confRes = await fetch(`${DATA_API_ORIGIN}${DATA_API_PREFIX}/config`);
            const conf = await confRes.json();
            const manifestRes = await fetch(`${DATA_API_ORIGIN}${conf.manifest}`);
            const manifest = await manifestRes.json();
            let champFile = null;
            for (const f of manifest.files || []) {
                if (f.path === "champions.json") { champFile = f.url; break; }
            }
            if (champFile) {
                const champsRes = await fetch(`${DATA_API_ORIGIN}${champFile}`);
                const champsData = await champsRes.json();
                const data = champsData.data || [];

                const uniqueMap = new Map();
                data.forEach(c => {
                    if (c.id && c.name && !uniqueMap.has(c.id)) {
                        uniqueMap.set(c.id, {
                            id: c.id,
                            name: c.name,
                            icon: `/lol-game-data/assets/v1/champion-icons/${c.id}.png`
                        });
                    }
                });
                allChampions = Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

                if (document.getElementById('augment-auto-pick-panel')) {
                    renderUI();
                }
            }
        } catch (e) {}
    }

    function champName(id) {
        if (!id || id === 'null') return '无';
        const c = allChampions.find(x => x.id === id);
        return c ? c.name : `#${id}`;
    }

    function champTag(id) {
        if (!id) return '无';
        const name = champName(id);
        if (id === WUKONG_ID) return `${name}[悟空]`;
        const idx = priorityList.indexOf(id);
        if (idx === -1) return `${name}(无)`;
        return `${name}(${idx + 1})`;
    }

    document.addEventListener('mousedown', (e) => {
        if (!isPanelOpen) return;
        const panel = document.getElementById('augment-auto-pick-panel');
        const triggerBtn = document.getElementById('augment-auto-pick-trigger');
        if (panel && !panel.contains(e.target) && triggerBtn && !triggerBtn.contains(e.target)) {
            isPanelOpen = false;
            panel.style.display = 'none';
        }
    }, true);

    // ===== 3. 界面注入 =====
    function injectUI() {
        const target = document.querySelector('.open-party-toggle');
        if (!target) return;
        target.style.transform = 'translateY(-15px)';

        if (!document.getElementById('augment-auto-pick-trigger')) {
            const triggerBtn = document.createElement('div');
            triggerBtn.id = 'augment-auto-pick-trigger';
            triggerBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#C8AA6E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

            triggerBtn.style.cssText = `position: absolute; bottom: -38px; right: 20px; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; background: linear-gradient(180deg, #1E2328 0%, #0A0E12 100%); border: 1px solid #785A28; border-radius: 4px; z-index: 9999; box-shadow: 0 2px 5px rgba(0,0,0,0.5); transition: all 0.2s;`;

            triggerBtn.onmouseenter = () => { triggerBtn.style.borderColor = '#C8AA6E'; triggerBtn.querySelector('svg').setAttribute('stroke', '#F0E6D2'); };
            triggerBtn.onmouseleave = () => { triggerBtn.style.borderColor = '#785A28'; triggerBtn.querySelector('svg').setAttribute('stroke', '#C8AA6E'); };

            triggerBtn.onclick = () => {
                isPanelOpen = !isPanelOpen;
                const p = document.getElementById('augment-auto-pick-panel');
                p.style.display = isPanelOpen ? 'flex' : 'none';
                if (isPanelOpen) renderUI();
            };
            if (window.getComputedStyle(target).position === 'static') target.style.position = 'relative';
            target.appendChild(triggerBtn);
        }

        if (!document.getElementById('augment-auto-pick-panel')) {
            const panel = document.createElement('div');
            panel.id = 'augment-auto-pick-panel';
            panel.style.cssText = `position: fixed; bottom: 80px; right: 310px; width: 520px; height: 560px; background: #010A13; border: 1px solid #785A28; box-shadow: 0 0 20px rgba(0,0,0,0.9); z-index: 99999; display: none; flex-direction: column; font-family: 'Microsoft YaHei';`;

            panel.innerHTML = `
                <div style="padding: 12px; border-bottom: 1px solid #3C2E14; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #F0E6D2; font-size: 14px; font-weight: bold;">海克斯自动选人</span>
                    <div id="native-toggle" style="width: 44px; height: 24px; background: ${isEnabled ? '#2ECC71' : '#3C2E14'}; border-radius: 12px; position: relative; cursor: pointer; transition: 0.3s;">
                        <div style="width: 20px; height: 20px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: ${isEnabled ? '22px' : '2px'}; transition: 0.3s;"></div>
                    </div>
                </div>
                <div style="display: flex; flex: 1; overflow: hidden; padding: 10px; gap: 15px;">
                    <div style="flex: 1; display: flex; flex-direction: column;">
                        <div style="font-size: 12px; color: #A09B8C; margin-bottom: 5px;">全部英雄</div>
                        <input type="text" id="aug-search" placeholder="搜索..." style="width: 100%; background: #000; border: 1px solid #3C2E14; color: #fff; padding: 6px; font-size: 12px; margin-bottom: 8px;">
                        <div id="aug-all-list" style="flex: 1; overflow-y: auto;"></div>
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column; border-left: 1px solid #3C2E14; padding-left: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <span style="font-size: 12px; color: #A09B8C;">已选优先级 <span style="color:#6B6B6B;font-size:10px;">(可拖动)</span></span>
                            <span id="aug-btn-clear" style="font-size: 12px; color: #E74C3C; cursor: pointer;">清空</span>
                        </div>
                        <div id="aug-priority-list" style="flex: 1; overflow-y: auto;"></div>
                    </div>
                </div>
                <div style="padding: 10px 15px; border-top: 1px solid #3C2E14; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2);">
                    <div style="display:flex; align-items:center; gap: 6px; cursor:pointer;" id="custom-checkbox-label">
                        <input type="checkbox" id="custom-only-checkbox" ${customOnly ? 'checked' : ''} style="cursor:pointer; accent-color: #C8AA6E;">
                        <span style="color: #A09B8C; font-size: 12px;">仅自定义/特殊模式生效</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="color: #F0E6D2; font-size: 13px; font-weight: bold;">保底策略</span>
                        <select id="fallback-select" style="background: #000; color: #C8AA6E; border: 1px solid #3C2E14; padding: 6px; font-size: 12px; cursor: pointer;">
                            <option value="random" ${fallbackStrategy === 'random' ? 'selected' : ''}>随机选一个</option>
                            <option value="rightmost" ${fallbackStrategy === 'rightmost' ? 'selected' : ''}>固定选最右侧</option>
                            <option value="none" ${fallbackStrategy === 'none' ? 'selected' : ''}>不秒选（等手动）</option>
                        </select>
                    </div>
                </div>
            `;
            document.body.appendChild(panel);

            const mainToggle = document.getElementById('native-toggle');
            mainToggle.onclick = () => {
                isEnabled = !isEnabled;
                DataStore.set(KEY_ENABLED, isEnabled);
                mainToggle.style.background = isEnabled ? '#2ECC71' : '#3C2E14';
                mainToggle.querySelector('div').style.left = isEnabled ? '22px' : '2px';
            };

            const fbSelect = document.getElementById('fallback-select');
            fbSelect.onchange = (e) => {
                fallbackStrategy = e.target.value;
                DataStore.set(KEY_FALLBACK, fallbackStrategy);
            };

            const customCheckbox = document.getElementById('custom-only-checkbox');
            customCheckbox.onchange = (e) => {
                customOnly = e.target.checked;
                DataStore.set(KEY_CUSTOM_ONLY, customOnly);
            };
            document.getElementById('custom-checkbox-label').onclick = (e) => {
                if (e.target !== customCheckbox) {
                    customCheckbox.checked = !customCheckbox.checked;
                    customOnly = customCheckbox.checked;
                    DataStore.set(KEY_CUSTOM_ONLY, customOnly);
                }
            };

            document.getElementById('aug-search').oninput = (e) => renderUI(e.target.value);
            document.getElementById('aug-btn-clear').onclick = () => {
                if (confirm('确定要清空所有优先级吗？')) {
                    priorityList = [];
                    DataStore.set(KEY_PRIORITY, priorityList);
                    renderUI();
                }
            };
            renderUI('');
        }
    }

    // ===== 4. 渲染函数 =====
    function renderUI(keyword = '') {
        const allList = document.getElementById('aug-all-list');
        const priorityListEl = document.getElementById('aug-priority-list');
        if (!allList || !priorityListEl) return;

        if (allChampions.length === 0) {
            priorityListEl.innerHTML = '<div style="color:#6B6B6B; font-size:12px;">正在加载英雄数据...</div>';
            return;
        }

        priorityListEl.innerHTML = '';
        priorityList.forEach((id, index) => {
            const champ = allChampions.find(c => c.id === id);
            if (!champ) return;
            const item = document.createElement('div');
            item.draggable = true;
            item.dataset.index = index;
            item.style.cssText = `display: flex; align-items: center; gap: 8px; padding: 4px; border-radius: 4px; position: relative; cursor: grab;`;

            item.innerHTML = `
                <span style="font-size: 14px; color: #5A4A2A; width: 12px;">⋮⋮</span>
                <span style="font-size: 10px; color: #C8AA6E; width: 15px;">${index + 1}</span>
                <img src="${champ.icon}" style="width: 24px; height: 24px; border-radius: 50%;">
                <span style="color: #A09B8C; font-size: 12px; flex: 1;">${champ.name}</span>
                <div style="display: flex; gap: 5px; opacity: 0.7;">
                    <span data-a="up" style="color: #C8AA6E; cursor: pointer; font-size: 12px;">↑</span>
                    <span data-a="down" style="color: #C8AA6E; cursor: pointer; font-size: 12px;">↓</span>
                    <span data-a="del" style="color: #E74C3C; cursor: pointer; font-size: 14px;">×</span>
                </div>
            `;

            item.ondragstart = (e) => { dragSrcIndex = index; item.style.opacity = '0.4'; e.dataTransfer.effectAllowed = 'move'; };
            item.ondragend = () => { dragSrcIndex = null; item.style.opacity = ''; };
            item.ondragover = (e) => {
                e.preventDefault();
                item.style.borderTop = (e.clientY - item.getBoundingClientRect().top < item.offsetHeight / 2) ? '2px solid #C8AA6E' : '';
                item.style.borderBottom = !(e.clientY - item.getBoundingClientRect().top < item.offsetHeight / 2) ? '2px solid #C8AA6E' : '';
            };
            item.ondragleave = () => { item.style.borderTop = ''; item.style.borderBottom = ''; };
            item.ondrop = (e) => {
                e.preventDefault();
                if (dragSrcIndex === null || dragSrcIndex === index) return;
                const before = (e.clientY - item.getBoundingClientRect().top) < item.offsetHeight / 2;
                const [moved] = priorityList.splice(dragSrcIndex, 1);
                let insertAt = (dragSrcIndex < index) ? (before ? index - 1 : index) : (before ? index : index + 1);
                priorityList.splice(insertAt, 0, moved);
                DataStore.set(KEY_PRIORITY, priorityList);
                renderUI();
            };

            item.querySelectorAll('span[data-a]').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const a = btn.dataset.a;
                    if (a === 'up' && index > 0) [priorityList[index - 1], priorityList[index]] = [priorityList[index], priorityList[index - 1]];
                    else if (a === 'down' && index < priorityList.length - 1) [priorityList[index + 1], priorityList[index]] = [priorityList[index], priorityList[index + 1]];
                    else if (a === 'del') priorityList.splice(index, 1);
                    DataStore.set(KEY_PRIORITY, priorityList);
                    renderUI();
                };
            });
            priorityListEl.appendChild(item);
        });

        allList.innerHTML = '';
        allChampions.forEach(champ => {
            if (keyword && !champ.name.includes(keyword)) return;
            if (priorityList.includes(champ.id)) return;
            const item = document.createElement('div');
            item.style.cssText = `display: flex; align-items: center; gap: 8px; padding: 4px; cursor: pointer;`;
            item.innerHTML = `<img src="${champ.icon}" style="width: 24px; height: 24px; border-radius: 50%;"><span style="color: #A09B8C; font-size: 12px;">${champ.name}</span>`;
            item.onclick = () => {
                priorityList.push(champ.id);
                DataStore.set(KEY_PRIORITY, priorityList);
                renderUI();
            };
            allList.appendChild(item);
        });
    }

    // ===== 5. 核心引擎 =====
    async function runEngine() {
        if (!isEnabled) return;

        try {
            const res = await fetch('/lol-champ-select/v1/session');
            if (!res.ok) return;
            const session = await res.json();
            if (!session.benchEnabled) return;

            // 🚨 重开修复 1：用 session 身份特征检测新一局，不依赖轮询是否采到非 ChampSelect
            const sessionKey = [
                session.gameId,
                session.chatDetails && session.chatDetails.gameId,
                session.queueId,
                session.localPlayerCellId,
                (session.actions || []).map(a => a.id).join(','),   // 每局唯一
                (session.myTeam || []).map(p => p.cellId).join(',')
            ].join('|');

            if (sessionKey !== lastSessionKey) {
                lastSessionKey = sessionKey;
                hasLockedInitial = false;
                hasSwappedOnce = false;
                swapTargetId = null;
                isCustomGame = false;
                fallbackPickId = null;
            }

            // 🚨 重开修复 2：queueId 未就绪时不误判
            const queueId = session.queueId;
            const isKiwi = (session.gameMode === 'KIWI');
            const knownCustomQueues = [0, 1700, 1710, 3100, 3130, 3270];
            const queueReady = queueId !== undefined && queueId !== null;

            isCustomGame = (queueReady && knownCustomQueues.includes(queueId))
                || isKiwi
                || session.isCustomGame === true;

            if (customOnly && !isCustomGame) {
                if (!queueReady && !isKiwi && session.isCustomGame === undefined) return; // 数据未就绪，等下一轮
                return;
            }

            const myCellId = session.localPlayerCellId;
            const myPlayer = session.myTeam.find(p => p.cellId === myCellId);
            if (!myPlayer) return;

            // 🚨 重开修复 3：offered 补全前置，避免"重置后第一轮数据未就绪"直接 return
            let offered = [];
            if (Array.isArray(session.benchChampions) && session.benchChampions.length > 0) {
                offered = session.benchChampions.map(b => b.championId).filter(id => id && id > 0);
            }
            if (offered.length === 0) {
                try {
                    const subsetRes = await fetch('/lol-lobby-team-builder/champ-select/v1/subset-champion-list');
                    if (subsetRes.ok) offered = await subsetRes.json();
                } catch (e) {}
            }
            if (!offered || offered.length === 0) return;

            // 🚨 重开修复 4：秒选条件加 myActions.length > 0 联合判断
            const myActions = (session.actions || []).flat().filter(a => a.actorCellId === myCellId && a.type === 'pick' && !a.completed);

            if (!hasLockedInitial && myActions.length > 0) {
                const action = myActions[0];

                let bestId = null;
                if (offered.includes(WUKONG_ID)) bestId = WUKONG_ID;
                else {
                    for (const myTargetId of priorityList) {
                        if (offered.includes(myTargetId)) { bestId = myTargetId; break; }
                    }
                }

                if (bestId === null) {
                    if (fallbackStrategy === 'none') return;
                    else if (fallbackStrategy === 'random') {
                        // 🚨 重开修复 5：随机同局固定，不反复横跳
                        if (fallbackPickId === null || !offered.includes(fallbackPickId)) {
                            fallbackPickId = offered[Math.floor(Math.random() * offered.length)];
                        }
                        bestId = fallbackPickId;
                    } else if (fallbackStrategy === 'rightmost') {
                        bestId = offered[offered.length - 1];
                    }
                }

                const lockRes = await fetch(`/lol-champ-select/v1/session/actions/${action.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ championId: bestId, completed: true })
                });
                if (lockRes.ok) hasLockedInitial = true;
                return;
            }

            if (hasSwappedOnce) return;
            if (myPlayer.championId === WUKONG_ID) return;

            if (swapTargetId !== null) {
                if (myPlayer.championId === swapTargetId) {
                    hasSwappedOnce = true;
                    swapTargetId = null;
                    return;
                }
                if (!offered.includes(swapTargetId)) {
                    swapTargetId = null;
                } else {
                    if (Date.now() - lastSwapAttemptTime > 800) {
                        lastSwapAttemptTime = Date.now();
                        await fetch(`/lol-champ-select/v1/session/bench/swap/${swapTargetId}`, { method: 'POST' });
                    }
                    return;
                }
            }

            let bestTargetId = null;
            if (offered.includes(WUKONG_ID)) bestTargetId = WUKONG_ID;
            else {
                let currentPriorityIndex = priorityList.indexOf(myPlayer.championId);
                if (currentPriorityIndex === -1) currentPriorityIndex = 999;
                let bestTargetPriorityIndex = currentPriorityIndex;
                for (const offeredId of offered) {
                    const pIndex = priorityList.indexOf(offeredId);
                    if (pIndex !== -1 && pIndex < bestTargetPriorityIndex) {
                        bestTargetId = offeredId;
                        bestTargetPriorityIndex = pIndex;
                    }
                }
            }

            if (bestTargetId !== null) {
                swapTargetId = bestTargetId;
                lastSwapAttemptTime = Date.now();
                await fetch(`/lol-champ-select/v1/session/bench/swap/${swapTargetId}`, { method: 'POST' });
            }
        } catch (e) {}
    }

    // ===== 启动 =====
    const init = async () => {
        loadAllChampions();

        // 🚨 重开修复：轮询 1s → 250ms，提高采到"退出选人瞬态"的概率（辅助，根治靠 sessionKey）
        setInterval(async () => {
            try {
                const phaseRes = await fetch('/lol-gameflow/v1/gameflow-phase');
                const phase = await phaseRes.json();

                if (phase === 'ChampSelect') {
                    if (!checkTimer) {
                        checkTimer = setInterval(runEngine, 300);
                    }
                } else {
                    if (checkTimer) {
                        clearInterval(checkTimer);
                        checkTimer = null;
                    }
                    // 兜底重置（主要重置靠 runEngine 内 sessionKey 检测）
                    hasLockedInitial = false;
                    hasSwappedOnce = false;
                    swapTargetId = null;
                    isCustomGame = false;
                    lastSessionKey = null;      // ← 保证下次进 ChampSelect 必触发 key 变化
                    fallbackPickId = null;
                }

                if (phase === 'Lobby' || phase === 'Matchmaking') {
                    injectUI();
                } else {
                    isPanelOpen = false;
                    const panel = document.getElementById('augment-auto-pick-panel');
                    if (panel) panel.style.display = 'none';
                }
            } catch (e) {}
        }, 500);
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 1000);
    } else {
        window.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
    }
})();
