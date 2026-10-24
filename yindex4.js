// ==PenguLoader==
// @name         Opponent Champ Display
// @description  在选人界面显示对方英雄及备选池 (全队监控 + 左对齐优化)
// @version      12.6.0
// ==/PenguLoader==

(function () {
    'use strict';

    const SERVER_BASE = 'https://140.245.73.30/yaofan/hksxr.php';
    const POLL_INTERVAL = 1500;

    let myPuuid = null;
    let partyId = null;
    let lastOpponentSig = '';
    let pollTimer = null;
    let champMap = {};
    let champMapLoaded = false;
    const injectedNodes = new Set();
    
    let floatingIcon = null;
    let enemyBenchContainer = null;
    let lastPhase = '';

    async function lcuGet(path) {
        try {
            const res = await fetch(path);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) { return null; }
    }

    async function loadChampionMap() {
        if (champMapLoaded) return;
        const data = await lcuGet('/lol-game-data/assets/v1/champion-summary.json');
        if (Array.isArray(data)) {
            for (const c of data) {
                if (c.id && c.id > 0) champMap[c.id] = { name: c.name || '', alias: c.alias || '' };
            }
            champMapLoaded = true;
        }
    }

    function champName(id) {
        if (!id) return '未知';
        const info = champMap[id];
        return info ? (info.name || info.alias || `ID:${id}`) : `ID:${id}`;
    }

    async function fetchMyPuuid() {
        const summoner = await lcuGet('/lol-summoner/v1/current-summoner');
        if (summoner && summoner.puuid) myPuuid = summoner.puuid;
    }

    async function updatePartyId() {
        const lobby = await lcuGet('/lol-lobby/v2/lobby');
        if (lobby && lobby.partyId) {
            if (partyId !== lobby.partyId) {
                partyId = lobby.partyId;
                sessionStorage.setItem('opp_display_party_id', partyId);
            }
        }
    }

    async function uploadMyTeam(session) {
        if (!partyId || !myPuuid) return;
        
        const players = (session.myTeam || []).map(p => ({
            puuid: p.puuid,
            cellId: p.cellId,
            championId: p.championId || 0,
            championPickIntent: p.championPickIntent || 0,
        }));

        let bench = [];
        if (Array.isArray(session.benchChampions)) {
            bench = session.benchChampions.map(b => b.championId).filter(id => id && id > 0);
        }

        const formData = new FormData();
        formData.append('action', 'upload');
        formData.append('partyId', partyId);
        formData.append('uploaderPuuid', myPuuid);
        formData.append('players', JSON.stringify(players));
        formData.append('bench', JSON.stringify(bench));

        try { await fetch(SERVER_BASE, { method: 'POST', body: formData }); } catch (e) {}
    }

    async function fetchOpponent() {
        if (!partyId || !myPuuid) return null;
        const formData = new FormData();
        formData.append('action', 'opponent');
        formData.append('partyId', partyId);
        formData.append('selfPuuid', myPuuid);

        try {
            const res = await fetch(SERVER_BASE, { method: 'POST', body: formData });
            if (res.status === 204) return null;
            if (!res.ok) return null;
            return await res.json();
        } catch (e) { return null; }
    }

    async function clearServerData() {
        if (!partyId) return;
        const formData = new FormData();
        formData.append('action', 'clear');
        formData.append('partyId', partyId);
        try { await fetch(SERVER_BASE, { method: 'POST', body: formData }); } catch (e) {}
        console.log('[OpponentDisplay] 已通知服务器物理清空数据');
    }

    function createFloatingIcon() {
        if (document.getElementById('opp-display-icon')) return;
        floatingIcon = document.createElement('div');
        floatingIcon.id = 'opp-display-icon';
        floatingIcon.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 24px; height: 24px; transition: all 0.3s ease;">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
            </svg>
        `;
        floatingIcon.style.cssText = `
            position: fixed; top: 30px; right: 30px; width: 40px; height: 40px;
            background: rgba(0, 0, 0, 0.7); border: 2px solid #555; border-radius: 50%;
            display: flex; align-items: center; justify-content: center; color: #888;
            z-index: 999999; pointer-events: none; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: all 0.3s ease;
        `;
        document.body.appendChild(floatingIcon);
    }

    function updateIconStatus(hasData) {
        if (!floatingIcon) return;
        const svg = floatingIcon.querySelector('svg');
        if (hasData) {
            floatingIcon.style.borderColor = '#c8aa6e';
            floatingIcon.style.color = '#c8aa6e';
            floatingIcon.style.boxShadow = '0 0 15px rgba(200, 170, 110, 0.8)';
            svg.style.transform = 'scale(1.1)';
        } else {
            floatingIcon.style.borderColor = '#555';
            floatingIcon.style.color = '#888';
            floatingIcon.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
            svg.style.transform = 'scale(1)';
        }
    }

    function removeFloatingIcon() {
        if (floatingIcon && floatingIcon.parentNode) {
            floatingIcon.parentNode.removeChild(floatingIcon);
            floatingIcon = null;
        }
        if (enemyBenchContainer && enemyBenchContainer.parentNode) {
            enemyBenchContainer.parentNode.removeChild(enemyBenchContainer);
            enemyBenchContainer = null;
        }
    }

    function clearInjected() {
        for (const rec of injectedNodes) {
            if (!rec.el) continue;
            try {
                if (rec.type === 'portrait') {
                    rec.el.style.display = '';
                    rec.el.style.backgroundImage = '';
                } else if (rec.type === 'primaryText') {
                    rec.el.classList.add('hidden');
                    for (const n of Array.from(rec.el.childNodes)) {
                        if (n.nodeType === Node.TEXT_NODE) n.textContent = '';
                    }
                    const glow = rec.el.querySelector('.summoner-primary-text-glow');
                    if (glow) glow.textContent = '';
                } else if (rec.type === 'summonerName') {
                    rec.el.style.display = '';
                }
            } catch(e) {}
        }
        injectedNodes.clear();
    }

    function applyChampionToObject(obj, championId, isLocked) {
        if (!obj || !championId) return;

        const wrapper = obj.closest('.summoner-wrapper');
        if (wrapper) {
            wrapper.classList.remove('removed');
            wrapper.classList.add('visible');
        }
        obj.classList.remove('removed');
        obj.classList.add('visible');

        const iconContainer = obj.querySelector('.champion-icon-container');
        if (iconContainer) iconContainer.classList.remove('dim');

        const portrait = obj.querySelector('.portrait-icon');
        if (portrait) {
            portrait.style.setProperty('display', 'block', 'important');
            portrait.style.backgroundImage = `url('/lol-game-data/assets/v1/champion-icons/${championId}.png')`;
            portrait.style.backgroundSize = 'cover';
            portrait.style.backgroundPosition = 'center';
            portrait.style.width = '100%';
            portrait.style.height = '100%';
            injectedNodes.add({ el: portrait, type: 'portrait' });
        }

        const primary = obj.querySelector('.summoner-primary-text');
        if (primary) {
            primary.classList.remove('hidden');
            for (const n of Array.from(primary.childNodes)) {
                if (n.nodeType === Node.TEXT_NODE) n.textContent = '';
            }
            const label = champName(championId) + (isLocked ? '' : '(预选)');
            primary.insertBefore(document.createTextNode(label), primary.firstChild);
            
            const glow = primary.querySelector('.summoner-primary-text-glow');
            if (glow) glow.textContent = champName(championId);
            injectedNodes.add({ el: primary, type: 'primaryText' });
        }

        const summonerName = obj.querySelector('.summoner-name');
        if (summonerName) {
            summonerName.style.display = 'none';
            injectedNodes.add({ el: summonerName, type: 'summonerName' });
        }
    }

    function renderEnemyBench(benchIds) {
        const myBench = document.querySelector('.champion-bench.ember-view');
        if (!myBench) return;

        if (!benchIds || benchIds.length === 0) {
            if (enemyBenchContainer) enemyBenchContainer.style.display = 'none';
            return;
        }

        const uniqueBenchIds = [...new Set(benchIds)];

        if (!enemyBenchContainer || !enemyBenchContainer.parentNode) {
            enemyBenchContainer = myBench.cloneNode(true);
            enemyBenchContainer.id = 'enemy-bench-display';
            const label = enemyBenchContainer.querySelector('.bench-label');
            if (label) {
                label.innerHTML = '敌方可用';
                label.style.color = '#E74C3C';
                label.style.textShadow = '0 0 5px rgba(231, 76, 60, 0.5)';
            }
            const container = enemyBenchContainer.querySelector('.bench-container');
            if (container) {
                container.innerHTML = '';
                // 🚨 核心修复：强制靠左对齐，防止两端顶满
                container.style.display = 'flex';
                container.style.flexDirection = 'row';
                container.style.flexWrap = 'wrap';
                container.style.justifyContent = 'flex-start';
                container.style.gap = '5px';
            }
            
            myBench.parentNode.insertBefore(enemyBenchContainer, myBench.nextSibling);
            enemyBenchContainer.style.marginTop = '10px';
        }

        enemyBenchContainer.style.display = 'block';

        const enemyContainer = enemyBenchContainer.querySelector('.bench-container');
        if (!enemyContainer) return;

        const currentSig = JSON.stringify(uniqueBenchIds);
        if (enemyContainer.getAttribute('data-sig') === currentSig) return;
        enemyContainer.setAttribute('data-sig', currentSig);

        enemyContainer.innerHTML = '';

        uniqueBenchIds.forEach(cid => {
            const item = document.createElement('div');
            item.className = 'champion-bench-item ember-view';
            item.style.width = '48px';
            item.style.height = '48px';
            item.innerHTML = `
                <div class="bench-champion-icon" style="border: 2px solid #E74C3C; border-radius: 50%; box-sizing: border-box; background-color: #000; width: 48px; height: 48px;">
                    <div style="background-image: url('/lol-game-data/assets/v1/champion-icons/${cid}.png'); width: 100%; height: 100%; background-size: cover; border-radius: 50%;"></div>
                </div>
            `;
            enemyContainer.appendChild(item);
        });
    }

    function renderOpponent(opponent) {
        if (!opponent) return;

        if (opponent.enemyTeam && opponent.enemyTeam.length > 0) {
            const enemyPlayers = opponent.enemyTeam.filter(p => p.championId || p.championPickIntent);
            const sig = JSON.stringify(enemyPlayers);
            
            if (sig !== lastOpponentSig && enemyPlayers.length > 0) {
                lastOpponentSig = sig;
                clearInjected();
                
                const enemyObjects = Array.from(document.querySelectorAll('.summoner-object.right'));
                if (enemyObjects.length > 0) {
                    enemyPlayers.forEach((p, index) => {
                        if (index >= enemyObjects.length) return;
                        const obj = enemyObjects[index];
                        const cid = p.championId || p.championPickIntent;
                        applyChampionToObject(obj, cid, !!p.championId);
                    });
                }
            }
            updateIconStatus(true);
        } else {
            updateIconStatus(false);
            clearInjected();
        }

        if (opponent.enemyBench) {
            renderEnemyBench(opponent.enemyBench);
        } else {
            renderEnemyBench([]);
        }
    }

    async function poll() {
        const phase = await lcuGet('/lol-gameflow/v1/gameflow-phase');
        
        if (phase === 'Lobby' || phase === 'Matchmaking' || phase === 'ChampSelect') {
            await updatePartyId();
        }

        if (lastPhase === 'ChampSelect' && phase !== 'ChampSelect') {
            clearServerData();
            clearInjected();
            if (floatingIcon || enemyBenchContainer) removeFloatingIcon();
        }
        lastPhase = phase;

        if (phase === 'ChampSelect') {
            if (!floatingIcon) createFloatingIcon();
            const session = await lcuGet('/lol-champ-select/v1/session');
            
            if (session && session.myTeam) {
                if (!myPuuid) await fetchMyPuuid();
                if (!champMapLoaded) await loadChampionMap();
                
                if (!partyId) partyId = sessionStorage.getItem('opp_display_party_id');

                if (partyId && myPuuid) await uploadMyTeam(session);

                const opponent = await fetchOpponent();
                if (opponent) {
                    renderOpponent(opponent);
                } else {
                    updateIconStatus(false);
                    clearInjected();
                    renderEnemyBench([]);
                }
            }
        } else {
            if (injectedNodes.size > 0) clearInjected();
            if (floatingIcon || enemyBenchContainer) removeFloatingIcon();
            
            if (phase === 'InProgress' || phase === 'EndOfGame' || phase === 'None') {
                lastOpponentSig = '';
            }
        }
    }

    function start() {
        console.log('[OpponentDisplay] 插件已启动');
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(() => { poll().catch(() => {}); }, POLL_INTERVAL);
        poll().catch(() => {});
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(start, 1000);
    } else {
        window.addEventListener('DOMContentLoaded', () => setTimeout(start, 1000));
    }
})();
