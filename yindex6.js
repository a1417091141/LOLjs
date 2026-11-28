// ==PenguLoader==
// @name         Opponent Champ Display
// @description  在选人界面显示对方英雄及备选池 (全队监控 + 大圣雷达 + 跨队喊猴)
// @version      15.2.0
// ==/PenguLoader==

(function () {
    'use strict';

    const SERVER_BASE = 'https://140.245.73.30/yaofan/hksxr.php';
    // 🚨 核心修改：从 1500 改为 500（半秒刷新一次）
    const POLL_INTERVAL = 500; 
    const WUKONG_ID = 62;

    // ---- 15.2.0 稳定性与实时性参数 ----
    const LCU_TIMEOUT_MS = 4000;
    const SERVER_TIMEOUT_MS = 6000;
    const UPLOAD_HEARTBEAT_MS = 4000;
    const OPP_FETCH_MIN_MS = 700;
    const UPLOAD_RETRY_MS = 1500;
    const POLL_STALL_MS = 12000;

    // 🚨 你的 11 个大圣音效
    const WUKONG_SOUNDS = [
        'https://140.245.73.30/yaofan/wukong/齐天大圣_默认皮肤_俺的取经之路才刚刚开始。_Voice_Champion_MonkeyKing_889ABBC7.wav',
        'https://140.245.73.30/yaofan/wukong/齐天大圣_默认皮肤_俺老孙来也。_Voice_Champion_MonkeyKing_Choose.mp3',
        'https://140.245.73.30/yaofan/wukong/齐天大圣_默认皮肤_俺一个跟头能翻十万八千里。_Voice_Champion_MonkeyKing_1A4BB531.wav',
        'https://140.245.73.30/yaofan/wukong/齐天大圣_默认皮肤_吃俺老孙一棒。_Voice_Champion_MonkeyKing_007EC1DA.wav',
        'https://140.245.73.30/yaofan/wukong/齐天大圣_默认皮肤_呔，妖怪哪里跑？_Voice_Champion_MonkeyKing_A2AD6101.wav',
        'https://140.245.73.30/yaofan/wukong/齐天大圣_默认皮肤_嘿嘿，俺老孙正等着呢。_Voice_Champion_MonkeyKing_5BF4C360.wav',
        'https://140.245.73.30/yaofan/wukong/齐天大圣_默认皮肤_领教下俺老孙的本事吧。_Voice_Champion_MonkeyKing_F5153B8E.wav',
        'https://140.245.73.30/yaofan/wukong/齐天大圣_默认皮肤_嗯，此地不宜久留。_Voice_Champion_MonkeyKing_75CB5BCD.wav',
        'https://140.245.73.30/yaofan/wukong/齐天大圣_默认皮肤_取经才是重中之重。_Voice_Champion_MonkeyKing_746D569D.wav',
        'https://140.245.73.30/yaofan/wukong/齐天大圣_默认皮肤_希望他们能和俺多过几招。_Voice_Champion_MonkeyKing_3CFB5826.wav',
        'https://140.245.73.30/yaofan/wukong/齐天大圣_默认皮肤_有妖气。_Voice_Champion_MonkeyKing_5E1E7EDE.wav'
    ];

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
    let wukongAlertPlayed = false;

    // ---- 15.2.0 运行状态 ----
    let pollInFlight = false;
    let pollStartedAt = 0;
    let uploadInFlight = false;
    let lastUploadSig = '';
    let lastUploadAt = 0;
    let lastOppFetchAt = 0;
    let lastOpponent = null;
    let lastOpponentAt = 0;
    // 本局统计：上传/拉取失败计数，仅用于诊断
    let uploadFailCount = 0;
    let lastUploadFailAt = 0;
    let fetchFailCount = 0;
    function fetchWithTimeout(url, opts, ms) {
        const ctrl = new AbortController();
        const timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms);
        const merged = Object.assign({}, opts || {}, { signal: ctrl.signal });
        return fetch(url, merged).then(function (res) {
            clearTimeout(timer);
            return res;
        }, function (err) {
            clearTimeout(timer);
            throw err;
        });
    } 

    // ================= 跨队消息（无面板） =================
    const PRE_GAME = '@lol-pre-game.pvp.net';
    const CHAMP_SELECT = '@lol-champ-select.pvp.net';
    const WUKONG_TEXT = '有猴！有猴！！有猴！！！';
    const DEDUP_WINDOW_MS = 15000;
    let roomConvId = null;
    let crossHooksInstalled = false;
    let lastWukongSentAt = 0;

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    function resolveRoomConv() {
        if (roomConvId) return roomConvId;
        if (!partyId) { try { partyId = sessionStorage.getItem('opp_display_party_id'); } catch (e) {} }
        if (partyId) roomConvId = partyId + PRE_GAME;
        return roomConvId;
    }

    async function refreshRoomConvFromChat() {
        const list = await lcuGet('/lol-chat/v1/conversations');
        if (!Array.isArray(list)) return null;
        for (const c of list) {
            if (c && typeof c.id === 'string' && c.id.indexOf(PRE_GAME) >= 0) { roomConvId = c.id; return c.id; }
        }
        return null;
    }

    function convMsgsUrl(cid) {
        return '/lol-chat/v1/conversations/' + encodeURIComponent(cid) + '/messages';
    }

    async function getRoomMessages() {
        let cid = resolveRoomConv();
        if (!cid) { cid = await refreshRoomConvFromChat(); }
        if (!cid) { return null; }
        try {
            let res = await fetch(convMsgsUrl(cid));
            if (res.status === 404) {
                const alt = await refreshRoomConvFromChat();
                if (!alt || alt === cid) { return null; }
                cid = alt;
                res = await fetch(convMsgsUrl(cid));
            }
            if (!res.ok) { return null; }
            const arr = await res.json();
            return { cid: cid, list: Array.isArray(arr) ? arr : [] };
        } catch (e) { return null; }
    }

    async function postToConv(cid, text) {
        return await fetch(convMsgsUrl(cid), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: text, type: 'chat' })
        });
    }

    async function hasRecentWukongMessage() {
        const got = await getRoomMessages();
        if (!got) { return false; }
        const now = Date.now();
        for (let i = got.list.length - 1; i >= 0; i--) {
            const m = got.list[i];
            if (!m) { continue; }
            if (String(m.body || '').trim() !== WUKONG_TEXT) { continue; }
            const ts = Number(m.timestamp || 0);
            if (!ts) { return true; }
            if (Math.abs(now - ts) <= DEDUP_WINDOW_MS) { return true; }
        }
        return false;
    }

    async function sendRoomMessage(text, reason) {
        let cid = resolveRoomConv();
        if (!cid) { cid = await refreshRoomConvFromChat(); }
        if (!cid) { console.warn('[OpponentDisplay] 未找到房间频道，跳过发送'); return false; }
        try {
            let res = await postToConv(cid, text);
            if (res.status === 404) {
                const alt = await refreshRoomConvFromChat();
                if (alt && alt !== cid) { cid = alt; res = await postToConv(cid, text); }
            }
            if (res.status === 404) {
                console.warn('[OpponentDisplay] 房间聊天频道尚未建立（房间里还没有其他真人），本次未发送');
                return false;
            }
            if (!res.ok) { console.warn('[OpponentDisplay] 跨队发送失败 HTTP', res.status); return false; }
            console.log('[OpponentDisplay] 已发送跨队消息:', text, '(' + (reason || '') + ')');
            return true;
} catch (e) { console.warn('[OpponentDisplay] 跨队发送异常', e && e.message); return false; }
    }

    async function sendWukongAlert() {
        const now = Date.now();
        if (now - lastWukongSentAt < 3000) { console.log('[OpponentDisplay] 猴子提醒刚触发过，跳过'); return; }
        lastWukongSentAt = now;
        const delay = Math.floor(Math.random() * 1500);
        if (delay > 0) await sleep(delay);
        const exists = await hasRecentWukongMessage();
        if (exists) { console.log('[OpponentDisplay] 房间里已有人发过猴子提醒，本机跳过（防刷屏）'); return; }
        await sendRoomMessage(WUKONG_TEXT, 'wukong');
    }

    function isChampSelectChannel(cid) {
        return typeof cid === 'string' && cid.indexOf(CHAMP_SELECT) >= 0;
    }

    function parseSendUrl(url) {
        if (!url) return null;
        const m = String(url).match(/\/lol-chat\/v1\/conversations\/([^\/?#]+)\/messages/);
        if (!m) return null;
        try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
    }

    function bodyTextOfString(s) {
        if (typeof s !== 'string') return null;
        try { const o = JSON.parse(s); return o && typeof o.body === 'string' ? o.body : null; } catch (e) { return null; }
    }

    function installCrossHooks() {
        if (crossHooksInstalled) return;
        crossHooksInstalled = true;
        try {
            const origFetch = window.fetch;
            if (typeof origFetch === 'function') {
                window.fetch = function (input, init) {
                    try {
                        const url = typeof input === 'string' ? input : (input && input.url);
                        const cid = parseSendUrl(url);
                        if (cid && isChampSelectChannel(cid)) {
                            const txt = init ? bodyTextOfString(init.body) : null;
                            if (txt) { resolveRoomConv(); sendRoomMessage(txt, 'mirror'); }
                        }
                    } catch (e) {}
                    return origFetch.apply(this, arguments);
                };
            }
        } catch (e) { console.warn('[OpponentDisplay] fetch 挂钩失败', e); }
        try {
            const XP = XMLHttpRequest.prototype;
            const origOpen = XP.open;
            const origSend = XP.send;
            XP.open = function (method, url) { try { this.__odUrl = url; } catch (e) {} return origOpen.apply(this, arguments); };
            XP.send = function (body) {
                try {
                    const cid = parseSendUrl(this.__odUrl);
                    if (cid && isChampSelectChannel(cid)) {
                        const txt = bodyTextOfString(body);
                        if (txt) { resolveRoomConv(); sendRoomMessage(txt, 'mirror'); }
                    }
                } catch (e) {}
                return origSend.apply(this, arguments);
            };
        } catch (e) { console.warn('[OpponentDisplay] XHR 挂钩失败', e); }
        console.log('[OpponentDisplay] 跨队转发已启用（无面板）');
    }

    async function lcuGet(path, ms) {
        try {
            const res = await fetchWithTimeout(path, {}, ms || LCU_TIMEOUT_MS);
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
                roomConvId = partyId + PRE_GAME;
            }
        }
    }

    function buildUploadForm(session) {
        const players = (session.myTeam || []).map(p => ({
            puuid: p.puuid,
            cellId: p.cellId,
            summonerId: p.summonerId || 0,
            championId: p.championId || 0,
            championPickIntent: p.championPickIntent || 0,
        }));

        let bench = [];
        if (Array.isArray(session.benchChampions)) {
            bench = session.benchChampions.map(b => b.championId).filter(id => id && id > 0);
        }

        let sig = '';
        try { sig = JSON.stringify(players) + '|' + JSON.stringify(bench); } catch (e) { sig = String(Date.now()); }

        const formData = new FormData();
        formData.append('action', 'upload');
        formData.append('partyId', partyId);
        formData.append('uploaderPuuid', myPuuid);
        formData.append('players', JSON.stringify(players));
        formData.append('bench', JSON.stringify(bench));
        return { formData: formData, sig: sig };
    }

    // 上传：「变化即传 + 心跳兜底」；失败立刻把签名清空，下一轮 500ms 就重试
    function uploadMyTeam(session) {
        if (!partyId || !myPuuid) return;

        const built = buildUploadForm(session);
        if (Date.now() - lastUploadFailAt < UPLOAD_RETRY_MS) return;
        const unchanged = built.sig === lastUploadSig;
        const fresh = Date.now() - lastUploadAt < UPLOAD_HEARTBEAT_MS;
        if (unchanged && fresh) return;
        if (uploadInFlight) return;

        uploadInFlight = true;
        lastUploadSig = built.sig;
        lastUploadAt = Date.now();

        fetchWithTimeout(SERVER_BASE, { method: "POST", body: built.formData }, SERVER_TIMEOUT_MS)
            .then(function (res) {
                uploadInFlight = false;
                if (!res || !res.ok) {
                    // 失败：作废签名，让下一轮立刻重传（不等 4s 心跳）
                    lastUploadSig = "";
                    lastUploadAt = 0;
                    uploadFailCount++;
                    lastUploadFailAt = Date.now();
                    console.warn("[OpponentDisplay] 上传失败 HTTP", res ? res.status : "network", "，下一轮重试");
                }
            }, function (err) {
                uploadInFlight = false;
                lastUploadSig = "";
                lastUploadAt = 0;
                uploadFailCount++;
                lastUploadFailAt = Date.now();
                console.warn("[OpponentDisplay] 上传异常", err && err.message, "，下一轮重试");
            });
    }
    function fetchOpponent() {
        if (!partyId || !myPuuid) return Promise.resolve(null);
        const formData = new FormData();
        formData.append("action", "opponent");
        formData.append("partyId", partyId);
        formData.append("selfPuuid", myPuuid);

        return fetchWithTimeout(SERVER_BASE, { method: "POST", body: formData }, SERVER_TIMEOUT_MS)
            .then(function (res) {
                if (res.status === 204) return null;
                if (!res.ok) { fetchFailCount++; return null; }
                return res.json();
            })
            .catch(function (err) {
                fetchFailCount++;
                console.warn("[OpponentDisplay] 拉取失败", err && err.message, "，下一轮重试");
                return null;
            });
    }
    async function clearServerData() {
        if (!partyId) return;
        const formData = new FormData();
        formData.append('action', 'clear');
        formData.append('partyId', partyId);
        try { await fetchWithTimeout(SERVER_BASE, { method: 'POST', body: formData }, SERVER_TIMEOUT_MS); } catch (e) {}
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

    function checkWukong(myTeam, enemyTeam, enemyBench) {
        if (wukongAlertPlayed) return;

        let hasWukong = false;

        if (myTeam) {
            for (const p of myTeam) {
                if (p.championId === WUKONG_ID || p.championPickIntent === WUKONG_ID) {
                    hasWukong = true;
                    break;
                }
            }
        }

        if (!hasWukong && enemyTeam) {
            for (const p of enemyTeam) {
                if (p.championId === WUKONG_ID || p.championPickIntent === WUKONG_ID) {
                    hasWukong = true;
                    break;
                }
            }
        }

        if (!hasWukong && enemyBench) {
            if (enemyBench.includes(WUKONG_ID)) {
                hasWukong = true;
            }
        }

        if (hasWukong) {
            wukongAlertPlayed = true; 
            console.log('[OpponentDisplay] 🐒 检测到齐天大圣！');
            
            const randomSound = WUKONG_SOUNDS[Math.floor(Math.random() * WUKONG_SOUNDS.length)];
            console.log('[OpponentDisplay] 播放音效:', randomSound);
            
            try {
                const audio = new Audio(randomSound);
                audio.volume = 1.0;
                audio.play().catch(e => console.warn('浏览器拦截了自动播放', e));
            } catch (e) {
                console.error('音效播放失败', e);
            }

            sendWukongAlert().catch(() => {});
        }
    }

    // 把「本地选人 session 的 theirTeam」与「服务器远端快照」按 puuid / cellId 合并，
    // 这样对手刚点选的意向（pickIntent）本机就能先看到，不必等对方上传。
    function buildEnemySlots(opponent, session) {
        const locals = (session && Array.isArray(session.theirTeam)) ? session.theirTeam : [];
        const remote = (opponent && Array.isArray(opponent.enemyTeam)) ? opponent.enemyTeam : [];

        const remoteByPuuid = Object.create(null);
        const remoteByCell = Object.create(null);
        const usedRemote = [];

        for (const p of remote) {
            if (!p) continue;
            if (p.puuid) remoteByPuuid[p.puuid] = p;
            if (p.cellId !== undefined && p.cellId !== null) remoteByCell[String(p.cellId)] = p;
        }

        const slots = [];
        const total = Math.max(locals.length, 5);

        for (let i = 0; i < total; i++) {
            const l = locals[i] || null;
            let r = null;
            if (l) {
                r = (l.puuid && remoteByPuuid[l.puuid]) ||
                    (l.cellId !== undefined && l.cellId !== null && remoteByCell[String(l.cellId)]) || null;
            }
            if (r) usedRemote.push(r);

            const entry = {
                index: i,
                puuid: (l && l.puuid) || (r && r.puuid) || null,
                summonerId: (l && l.summonerId) || (r && r.summonerId) || 0,
                cellId: (l && l.cellId !== undefined) ? l.cellId : ((r && r.cellId) || null),
                championId: (l && l.championId) || (r && r.championId) || 0,
                championPickIntent: (l && l.championPickIntent) || (r && r.championPickIntent) || 0
            };
            slots.push(entry);
        }

        // 远端有、本地 theirTeam 里没有的（例如本机还没拿到对方席位信息）：
        // 优先按 cellId-5 落回原生席位，其次找空闲席位，实在没位置才追加到末尾。
        // 关键：不能无脑 slots.length 追加，DOM 只有 5 个坑位，越界会被整批丢弃。
        const occupied = Object.create(null);
        for (let si = 0; si < slots.length; si++) {
            if (slots[si].championId || slots[si].championPickIntent) occupied[si] = true;
        }
        let extra = 0;
        for (const p of remote) {
            if (!p) continue;
            if (usedRemote.indexOf(p) >= 0) continue;
            if (!p.championId && !p.championPickIntent) continue;
            const entry = {
                index: slots.length,
                puuid: p.puuid || null,
                summonerId: p.summonerId || 0,
                cellId: p.cellId !== undefined ? p.cellId : null,
                championId: p.championId || 0,
                championPickIntent: p.championPickIntent || 0
            };
            let target = -1;
            const span = Math.max(slots.length, 5);
            if (p.cellId !== undefined && p.cellId !== null) {
                const guess = Number(p.cellId) - 5;
                if (guess >= 0 && guess < span && !occupied[guess]) target = guess;
            }
            if (target < 0) {
                for (let si = 0; si < span; si++) {
                    if (!occupied[si]) { target = si; break; }
                }
            }
            if (target >= 0) {
                entry.index = target;
                slots[target] = entry;
                occupied[target] = true;
            } else {
                slots.push(entry);
            }
            extra++;
        }

        return { slots: slots, extra: extra };
    }

    // 客户端重绘会把我们注入的节点换掉；签名没变时也必须补画一次
    function injectedDetached() {
        if (injectedNodes.size === 0) return true;
        for (const rec of injectedNodes) {
            if (!rec.el) return true;
            if (rec.el.isConnected === false) return true;
            if (!document.contains(rec.el)) return true;
        }
        return false;
    }

    function renderOpponent(opponent, session) {
        const sessionMyTeam = (session && session.myTeam) || null;

        checkWukong(sessionMyTeam, opponent ? opponent.enemyTeam : null, opponent ? opponent.enemyBench : null);

        const built = buildEnemySlots(opponent, session);
        const slots = built.slots;

        // 只用本局真实数据：对面没上传或上传失败就当作没有对手，不保留旧画面、不做记忆
        const resolved = [];
        for (const e of slots) {
            const cid = e.championId || e.championPickIntent || 0;
            if (cid) resolved.push({ slot: e, cid: cid, locked: !!e.championId });
        }

        if (resolved.length > 0) {
            const sig = JSON.stringify(resolved.map(function (x) {
                return [x.slot.puuid || x.slot.cellId || x.slot.index, x.cid, x.locked];
            }));

            const needPaint = (sig !== lastOpponentSig) || injectedDetached();
            if (needPaint) {
                lastOpponentSig = sig;
                clearInjected();

                const enemyObjects = Array.from(document.querySelectorAll(".summoner-object.right"));
                for (const item of resolved) {
                    const idx = item.slot.index;
                    if (idx >= enemyObjects.length) continue;
                    applyChampionToObject(enemyObjects[idx], item.cid, item.locked);
                }
            }
            updateIconStatus(true);
        } else {
            // 没有本局数据：把上一局残留的注入清掉，恢复原生空白
            if (lastOpponentSig !== "" || injectedNodes.size > 0) {
                lastOpponentSig = "";
                clearInjected();
            }
            updateIconStatus(false);
        }

        let bench = [];
        if (opponent && Array.isArray(opponent.enemyBench)) bench = opponent.enemyBench.slice();
        if (session && Array.isArray(session.theirTeam)) {
            for (const p of session.theirTeam) {
                const cid = (p && p.championId) || 0;
                if (cid && bench.indexOf(cid) < 0) bench.push(cid);
            }
        }
        renderEnemyBench(bench);
    }
    function resetRoundState() {
        lastOpponentSig = "";
        wukongAlertPlayed = false;
        lastWukongSentAt = 0;
        roomConvId = null;
        lastOpponent = null;
        lastOpponentAt = 0;
        lastUploadSig = "";
        lastUploadAt = 0;
        lastUploadFailAt = 0;
        lastOppFetchAt = 0;
    }
    async function poll() {
        // 单轮串行：上一轮没结束就直接跳过，避免网络慢时请求叠加
        if (pollInFlight) {
            if (Date.now() - pollStartedAt > POLL_STALL_MS) {
                console.warn("[OpponentDisplay] 上一轮轮询卡住超过 " + POLL_STALL_MS + "ms，强制解锁");
                pollInFlight = false;
            } else {
                return;
            }
        }
        pollInFlight = true;
        pollStartedAt = Date.now();

        try {
            const phase = await lcuGet("/lol-gameflow/v1/gameflow-phase");
            const prevPhase = lastPhase;

            if (phase === "Lobby" || phase === "Matchmaking" || phase === "ChampSelect") {
                await updatePartyId();
            }

            // 退出选人：清掉服务端本房间数据和本地状态，下一局不会带旧英雄
            if (prevPhase === "ChampSelect" && phase !== "ChampSelect") {
                clearServerData();
                clearInjected();
                if (floatingIcon || enemyBenchContainer) removeFloatingIcon();
                resetRoundState();
            }

            // 进入选人（新的一局）：清空本地状态，让本轮上传与拉取立刻发生
            if (phase === "ChampSelect" && prevPhase !== "ChampSelect") {
                resetRoundState();
            }
            lastPhase = phase;

            if (phase === "ChampSelect") {
                if (!floatingIcon) createFloatingIcon();
                const session = await lcuGet("/lol-champ-select/v1/session");

                if (session && session.myTeam) {
                    if (!myPuuid) await fetchMyPuuid();
                    if (!champMapLoaded) await loadChampionMap();
                    if (!partyId) partyId = sessionStorage.getItem("opp_display_party_id");

                    // 上传：不 await，节流在 uploadMyTeam 内部
                    if (partyId && myPuuid) uploadMyTeam(session);

                    // 拉取：限流 700ms；拿不到就清空，绝不沿用旧数据
                    const now = Date.now();
                    if (partyId && myPuuid && now - lastOppFetchAt >= OPP_FETCH_MIN_MS) {
                        lastOppFetchAt = now;
                        const opp = await fetchOpponent();
                        lastOpponent = opp || null;
                        lastOpponentAt = opp ? now : 0;
                    }

                    renderOpponent(lastOpponent, session);
                }
            } else {
                if (injectedNodes.size > 0) clearInjected();
                if (floatingIcon || enemyBenchContainer) removeFloatingIcon();

                if (phase === "InProgress" || phase === "EndOfGame" || phase === "None") {
                    resetRoundState();
                }
            }
        } catch (e) {
            console.warn("[OpponentDisplay] 轮询异常", e);
        } finally {
            pollInFlight = false;
        }
    }
    function start() {
        console.log('[OpponentDisplay] 插件已启动 v15.2.0');
        installCrossHooks();
        window.__oppDisplay = {
            version: '15.2.0',
            startedAt: Date.now(),
            getRoom: function () { return resolveRoomConv(); },
            roomMessages: function () { return getRoomMessages(); },
            sendTest: function (t) { return sendRoomMessage(t || '测试消息', 'manual'); },
            wukongAlert: function () { return sendWukongAlert(); },
            dedupCheck: function () { return hasRecentWukongMessage(); },
            stats: function () {
                return {
                    version: '15.2.0',
                    phase: lastPhase,
                    partyId: partyId,
                    roomConvId: roomConvId,
                    pollInFlight: pollInFlight,
                    uploadInFlight: uploadInFlight,
                    lastUploadAt: lastUploadAt,
                    lastOppFetchAt: lastOppFetchAt,
                    lastOpponentAt: lastOpponentAt,
                    enemyCount: (lastOpponent && lastOpponent.enemyTeam) ? lastOpponent.enemyTeam.length : 0,
                    uploadFailCount: uploadFailCount,
                    lastUploadFailAt: lastUploadFailAt,
                    fetchFailCount: fetchFailCount,
                    lastWukongSentAt: lastWukongSentAt
                };
            },
            forcePoll: function () { return poll(); },
            // 只读诊断：给定 session 与 opponent，返回槽位对齐结果（不修改 DOM）
            debugSlots: function (session, opponent) {
                const built = buildEnemySlots(opponent, session);
                return built.slots.map(function (e) {
                    const cid = e.championId || e.championPickIntent || 0;
                    return {
                        index: e.index,
                        puuid: e.puuid,
                        cellId: e.cellId,
                        championId: e.championId,
                        pickIntent: e.championPickIntent,
                        resolved: cid,
                        locked: !!e.championId
                    };
                });
            }
        };
        if (pollTimer) clearInterval(pollTimer);
        // 🚨 使用 500ms 的高频轮询
        pollTimer = setInterval(() => { poll().catch(() => {}); }, POLL_INTERVAL);
        poll().catch(() => {});
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(start, 1000);
    } else {
        window.addEventListener('DOMContentLoaded', () => setTimeout(start, 1000));
    }
})();
