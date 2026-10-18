// ==PenguLoader==
// @name         Opponent Champ Display
// @description  在选人界面显示对方英雄，并带有透视悬浮图标
// @version      4.3.0
// ==/PenguLoader==

(function () {
    'use strict';

    const SERVER_BASE = 'https://140.245.73.30/yaofan/hksxr.php';
    const POLL_INTERVAL = 1500;

    let myPuuid = null;
    let partyId = null;
    let lastOpponentSig = '';
    let lastUploadSig = '';
    let pollTimer = null;
    let champMap = {};
    let champMapLoaded = false;
    const injectedNodes = new Set();
    
    // 悬浮图标元素
    let floatingIcon = null;

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

    async function fetchPartyIdFromLobby() {
        const lobby = await lcuGet('/lol-lobby/v2/lobby');
        if (lobby && lobby.partyId) {
            partyId = lobby.partyId;
            sessionStorage.setItem('opp_display_party_id', partyId);
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

        const currentSig = JSON.stringify(players);
        if (currentSig === lastUploadSig) return;
        lastUploadSig = currentSig;

        const formData = new FormData();
        formData.append('action', 'upload');
        formData.append('partyId', partyId);
        formData.append('uploaderPuuid', myPuuid);
        formData.append('players', JSON.stringify(players));

        try {
            await fetch(SERVER_BASE, { method: 'POST', body: formData });
        } catch (e) {}
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

    // ============ 图标管理 ============
    function createFloatingIcon() {
        if (document.getElementById('opp-display-icon')) return;

        floatingIcon = document.createElement('div');
        floatingIcon.id = 'opp-display-icon';
        
        // 使用 SVG 绘制一个“眼睛/透视”图标
        floatingIcon.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 24px; height: 24px; transition: all 0.3s ease;">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
            </svg>
        `;
        
        // 默认状态（灰色、半透明）
        floatingIcon.style.cssText = `
            position: fixed;
            top: 30px;
            right: 30px;
            width: 40px;
            height: 40px;
            background: rgba(0, 0, 0, 0.7);
            border: 2px solid #555;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #888;
            z-index: 999999;
            pointer-events: none;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(floatingIcon);
    }

    function updateIconStatus(hasData) {
        if (!floatingIcon) return;
        const svg = floatingIcon.querySelector('svg');
        if (hasData) {
            // 有数据时：金黄色，带发光效果
            floatingIcon.style.borderColor = '#c8aa6e';
            floatingIcon.style.color = '#c8aa6e';
            floatingIcon.style.boxShadow = '0 0 15px rgba(200, 170, 110, 0.8)';
            svg.style.transform = 'scale(1.1)';
        } else {
            // 无数据时：灰色，平淡
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
    }

    // ============ 界面清理 ============
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
                }
            } catch(e) {}
        }
        injectedNodes.clear();
    }

    function applyChampionToObject(obj, championId, isLocked) {
        if (!obj || !championId) return;

        const portrait = obj.querySelector('.champion-icons .portrait-icon');
        if (portrait) {
            portrait.style.display = '';
            portrait.style.backgroundImage = `url('/lol-game-data/assets/v1/champion-icons/${championId}.png')`;
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
    }

    function renderOpponent(opponent) {
        if (!opponent || !opponent.players) return;
        const sig = JSON.stringify(opponent);
        if (sig === lastOpponentSig) return;
        lastOpponentSig = sig;

        clearInjected();
        
        const objects = Array.from(document.querySelectorAll('.summoner-object.right:not(.is-self)'));
        if (objects.length === 0) return;

        const bySlot = {};
        objects.forEach(obj => {
            const m = (obj.className || '').match(/slot-id-(\d+)/);
            if (m) bySlot[parseInt(m[1], 10)] = obj;
        });

        opponent.players.forEach(p => {
            const cid = p.championId || p.championPickIntent || 0;
            if (!cid) return;
            const slotId = 5 + (p.cellId || 0);
            const obj = bySlot[slotId];
            if (obj) applyChampionToObject(obj, cid, !!p.championId);
        });
        
        // 拉到数据了，图标亮起！
        updateIconStatus(true);
        console.log('[OpponentDisplay] 对方数据已同步刷新');
    }

    async function poll() {
        const phase = await lcuGet('/lol-gameflow/v1/gameflow-phase');
        
        if (phase === 'Lobby' && !partyId) {
            await fetchPartyIdFromLobby();
        }

        if (phase === 'ChampSelect') {
            // 进入选人界面，确保图标存在
            if (!floatingIcon) createFloatingIcon();

            const session = await lcuGet('/lol-champ-select/v1/session');
            if (session && session.myTeam) {
                if (!myPuuid) await fetchMyPuuid();
                if (!champMapLoaded) await loadChampionMap();
                if (!partyId) partyId = sessionStorage.getItem('opp_display_party_id');

                if (partyId && myPuuid) {
                    await uploadMyTeam(session);
                }

                const opponent = await fetchOpponent();
                if (opponent && opponent.players) {
                    renderOpponent(opponent);
                } else {
                    // 如果没拉取到对方数据，图标变灰
                    updateIconStatus(false);
                }
            }
        } else {
            // 离开选人界面，清理一切
            if (injectedNodes.size > 0) clearInjected();
            if (floatingIcon) removeFloatingIcon();
            
            if (phase === 'InProgress' || phase === 'EndOfGame' || phase === 'None') {
                partyId = null;
                lastUploadSig = '';
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
