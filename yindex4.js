// ==PenguLoader==
// @name         Opponent Champ Display
// @description  在选人界面显示对方英雄
// @version      4.1.0
// ==/PenguLoader==

(function () {
    'use strict';

    const SERVER_BASE = 'https://140.245.73.30/yaofan/hksxr.php';
    const POLL_INTERVAL = 1500;

    let myPuuid = null;
    let partyId = null;
    let lastOpponentSig = '';
    let lastUploadSig = ''; // 记录上次上传的己方数据指纹
    let pollTimer = null;
    let champMap = {};
    let champMapLoaded = false;
    const injectedNodes = new Set();

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

        // 生成当前己方数据的指纹
        const currentSig = JSON.stringify(players);
        
        // 如果指纹没变，说明己方没人换英雄，直接跳过上传，节省服务器资源
        if (currentSig === lastUploadSig) return;
        lastUploadSig = currentSig;

        const formData = new FormData();
        formData.append('action', 'upload');
        formData.append('partyId', partyId);
        formData.append('uploaderPuuid', myPuuid);
        formData.append('players', JSON.stringify(players));

        try {
            await fetch(SERVER_BASE, {
                method: 'POST',
                body: formData
            });
            console.log('[OpponentDisplay] 己方数据已更新并上传');
        } catch (e) {}
    }

    async function fetchOpponent() {
        if (!partyId || !myPuuid) return null;
        
        const formData = new FormData();
        formData.append('action', 'opponent');
        formData.append('partyId', partyId);
        formData.append('selfPuuid', myPuuid);

        try {
            const res = await fetch(SERVER_BASE, {
                method: 'POST',
                body: formData
            });
            if (res.status === 204) return null;
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            return null;
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
        if (sig === lastOpponentSig) return; // 对方没换人，不更新界面
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
        
        console.log('[OpponentDisplay] 对方数据已同步刷新');
    }

    async function poll() {
        const phase = await lcuGet('/lol-gameflow/v1/gameflow-phase');
        
        if (phase === 'Lobby' && !partyId) {
            await fetchPartyIdFromLobby();
        }

        if (phase === 'ChampSelect') {
            const session = await lcuGet('/lol-champ-select/v1/session');
            if (session && session.myTeam) {
                if (!myPuuid) await fetchMyPuuid();
                if (!champMapLoaded) await loadChampionMap();
                if (!partyId) partyId = sessionStorage.getItem('opp_display_party_id');

                // 1. 上传己方数据（只有变了才上传）
                if (partyId && myPuuid) {
                    await uploadMyTeam(session);
                }

                // 2. 拉取对方数据
                const opponent = await fetchOpponent();
                if (opponent && opponent.players) {
                    renderOpponent(opponent);
                }
            }
        } else {
            // 离开选人界面，清理界面并重置状态
            if (injectedNodes.size > 0) clearInjected();
            if (phase === 'InProgress' || phase === 'EndOfGame' || phase === 'None') {
                partyId = null;
                lastUploadSig = ''; // 重置上传指纹
                lastOpponentSig = ''; // 重置对方数据指纹
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
