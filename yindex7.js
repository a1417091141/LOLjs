// ==PenguLoader==
// @name         LOL 联机 Ping 轮盘 & 联机亮狗牌 (终极防误触版)
// @description  按住 Alt + 左键拖动呼出轮盘，按 Ctrl+6 亮狗牌，支持坐标精准同步
// @version      5.0.0
// ==/PenguLoader==

(function () {
    'use strict';

    const PING_API_URL = 'https://140.245.73.30/yaofan/ping_api.php';
    const ASSET_BASE = 'https://cdn.jsdmirror.com/gh/darrenprx/lolPing@main/assets';
    const PING_POLL_INTERVAL = 500;
    const ROOM_POLL_INTERVAL = 3000;

    const SECTIONS = [
        { name: '危险',         icon: `${ASSET_BASE}/textures/caution.png`,       sound: `${ASSET_BASE}/sounds/Danger.wav` },
        { name: '请求协助',     icon: `${ASSET_BASE}/textures/assist_me.png`,     sound: `${ASSET_BASE}/sounds/ComeHere.wav` },
        { name: '正在路上',     icon: `${ASSET_BASE}/textures/omw.png`,           sound: `${ASSET_BASE}/sounds/OnMyWay.wav` },
        { name: '全力进攻',     icon: `${ASSET_BASE}/textures/all_in.png`,        sound: `${ASSET_BASE}/sounds/Attack.wav` },
        { name: '推进',         icon: `${ASSET_BASE}/textures/push.png`,          sound: `${ASSET_BASE}/sounds/OnMyWay.wav` },
        { name: '需要视野',     icon: `${ASSET_BASE}/textures/need_vision.png`,   sound: `${ASSET_BASE}/sounds/Defend.wav` },
        { name: '敌人消失',     icon: `${ASSET_BASE}/textures/enemy_missing.png`, sound: `${ASSET_BASE}/sounds/MIA.wav` },
        { name: '敌方有视野',   icon: `${ASSET_BASE}/textures/enemy_vision.png`,  sound: `${ASSET_BASE}/sounds/MIA.wav` }
    ];

    let myPuuid = null;
    let myName = '未知玩家';
    let partyId = null;
    let cachedPartyId = null;
    let lastPingCursor = 0;
    let pingPollTimer = null;
    let roomPollTimer = null;

    let isDragging = false;
    let wheelEl = null;
    let highlightIndex = -1;

    // 🚨 拖拽判定状态
    let startMouseX = 0;
    let startMouseY = 0;
    let hasDragged = false;

    let lastLocalEventTime = 0;

    async function lcuGet(path) {
        try {
            const res = await fetch(path);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) { return null; }
    }

    async function fetchMyPuuid() {
        if (myPuuid) return;
        const summoner = await lcuGet('/lol-summoner/v1/current-summoner');
        if (summoner) {
            if (summoner.puuid) myPuuid = summoner.puuid;
            let baseName = summoner.gameName || summoner.displayName || summoner.summonerName || '';
            let tag = summoner.tagLine ? `#${summoner.tagLine}` : '';
            myName = baseName ? (baseName + tag) : ('玩家_' + (myPuuid ? myPuuid.substring(0, 4) : 'XXXX'));
        }
    }

    // ============ 音频 ============
    const audioCache = {};
    SECTIONS.forEach((sec, i) => {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.src = sec.sound;
        audio.volume = 0.65;
        audio.preload = 'auto';
        audioCache[i] = audio;
    });

    function playSound(index) {
        if (index === -1 || !audioCache[index]) return;
        try {
            const sound = audioCache[index].cloneNode();
            sound.volume = 0.65;
            sound.play().catch(() => {});
        } catch (e) {}
    }

    // ============ 房间获取 ============
    async function updatePartyId() {
        const lobby = await lcuGet('/lol-lobby/v2/lobby');
        if (lobby && lobby.partyId) {
            cachedPartyId = lobby.partyId;
            if (partyId !== lobby.partyId) {
                partyId = lobby.partyId;
                lastPingCursor = Date.now(); 
                console.log('[PingSync] 房间已更新:', partyId);

                const fd = new FormData();
                fd.append('action', 'heartbeat');
                fd.append('partyId', partyId);
                fetch(PING_API_URL, { method: 'POST', body: fd }).catch(()=>{});

                if (!pingPollTimer) startPingPolling();
            }
        }
    }

    async function checkPhase() {
        const phase = await lcuGet('/lol-gameflow/v1/gameflow-phase');
        if (!myPuuid && phase !== 'None') await fetchMyPuuid();

        if (phase === 'Lobby' || phase === 'Matchmaking' || phase === 'ChampSelect') {
            await updatePartyId();
        } else if (phase === 'InProgress') {
            if (cachedPartyId) {
                partyId = cachedPartyId;
                if (!pingPollTimer) startPingPolling();
            }
        } else if (phase === 'EndOfGame' || phase === 'None') {
            partyId = null; cachedPartyId = null; lastPingCursor = 0;
            if (pingPollTimer) { clearInterval(pingPollTimer); pingPollTimer = null; }
        }
    }

    // ============ 广播请求 ============
    async function broadcastEvent(type, index = -1, xRatio = 0.5, yRatio = 0.5) {
        if (!partyId || !myPuuid) return;
        let sendName = myName || ('玩家_' + myPuuid.substring(0, 4));
        const fd = new FormData();
        fd.append('action', 'send_ping');
        fd.append('partyId', partyId);
        fd.append('selfPuuid', myPuuid);
        fd.append('selfName', sendName);
        fd.append('type', type);
        fd.append('index', index);
        fd.append('xRatio', xRatio);
        fd.append('yRatio', yRatio);
        try { await fetch(PING_API_URL, { method: 'POST', body: fd }); } catch(e) {}
    }

    async function fetchRemoteEvents() {
        if (!partyId || !myPuuid) return;
        const fd = new FormData();
        fd.append('action', 'get_ping');
        fd.append('partyId', partyId);
        fd.append('selfPuuid', myPuuid);
        fd.append('lastSeen', lastPingCursor);
        try {
            const res = await fetch(PING_API_URL, { method: 'POST', body: fd });
            const data = await res.json();
            if (data.pings && data.pings.length > 0) {
                data.pings.forEach(p => {
                    if (p.from === myPuuid) return; 
                    if (p.ts <= lastPingCursor && lastPingCursor !== 0) return;

                    if (p.type === 'badge') {
                        showBadgeOnName(p.name);
                    } else {
                        const remoteX = (p.xRatio || 0.5) * window.innerWidth;
                        const remoteY = (p.yRatio || 0.5) * window.innerHeight;
                        
                        playSound(p.index);
                        renderPingAnimation(SECTIONS[p.index].icon, remoteX, remoteY);
                        highlightPlayerInDOM(p.name);
                    }
                });
            }
            if (data.cursor) lastPingCursor = data.cursor;
        } catch(e) {}
    }

    function startPingPolling() {
        if (pingPollTimer) clearInterval(pingPollTimer);
        pingPollTimer = setInterval(() => { fetchRemoteEvents().catch(()=>{}); }, PING_POLL_INTERVAL);
    }

    // ============ 寻找名字对应的 DOM ============
    function findNameElement(senderName) {
        if (!senderName) return null;
        const baseName = senderName.split('#')[0].trim();
        if (!baseName) return null;

        const cleanTarget = baseName.replace(/[\s\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
        const nameElements = document.querySelectorAll('.custom-member-name .player-name__game-name');
        for (const el of nameElements) {
            const domText = el.textContent.replace(/[\s\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
            if (domText === cleanTarget) return el;
        }
        return null;
    }

    // ============ 高亮特效 ============
    function highlightPlayerInDOM(senderName) {
        const nameEl = findNameElement(senderName);
        if (nameEl) {
            const row = nameEl.closest('.custom-game-team-member');
            if (row) {
                row.classList.remove('ping-highlight-flash');
                void row.offsetWidth;
                row.classList.add('ping-highlight-flash');
                setTimeout(() => { row.classList.remove('ping-highlight-flash'); }, 1500);
            }
        }
    }

    // ============ 在名字上方显示狗牌 ============
    function showBadgeOnName(senderName) {
        const nameEl = findNameElement(senderName);
        if (!nameEl) return;

        document.querySelectorAll('.remote-mastery-badge').forEach(el => el.remove());
        const rect = nameEl.getBoundingClientRect();
        const iconUrl = 'https://raw.communitydragon.org/12.21/game/assets/ux/mastery/mastery_icon_7.png';

        const badge = document.createElement('div');
        badge.className = 'remote-mastery-badge';
        badge.innerHTML = `<img src="${iconUrl}" style="width: 60px; height: 60px; object-fit: contain; filter: drop-shadow(0 0 8px rgba(200,170,110,0.9));">`;
        
        badge.style.cssText = `
            position: fixed;
            left: ${rect.left + rect.width / 2}px;
            top: ${rect.top - 55}px;
            transform: translateX(-50%) scale(0.5);
            display: flex; align-items: center; justify-content: center;
            pointer-events: none;
            z-index: 2147483647;
            animation: badgePopUp 2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        `;

        document.body.appendChild(badge);
        setTimeout(() => { if (badge.parentNode) badge.parentNode.removeChild(badge); }, 5000);
    }

    // ============ 本地按 Ctrl+6 逻辑 ============
    async function triggerLocalBadge() {
        const now = Date.now();
        if (now - lastLocalEventTime < 1000) return;
        lastLocalEventTime = now;

        if (!myPuuid || !myName || myName === '未知玩家') {
            await fetchMyPuuid();
        }
        
        let nameEl = findNameElement(myName);
        let retries = 0;
        while (!nameEl && retries < 5) {
            await new Promise(r => setTimeout(r, 500));
            nameEl = findNameElement(myName);
            retries++;
        }

        if (nameEl) {
            showBadgeOnName(myName); 
        } else {
            showStaticBadgeCenter(); 
        }
        
        broadcastEvent('badge'); 
    }

    // 兜底：屏幕中心牌子
    function showStaticBadgeCenter() {
        document.querySelectorAll('.remote-mastery-badge').forEach(el => el.remove());
        const badge = document.createElement('div');
        badge.className = 'remote-mastery-badge';
        const iconUrl = 'https://raw.communitydragon.org/12.21/game/assets/ux/mastery/mastery_icon_7.png';
        badge.innerHTML = `<img src="${iconUrl}" style="width: 150px; height: 150px; object-fit: contain; filter: drop-shadow(0 0 20px rgba(200,170,110,0.9));">`;
        badge.style.cssText = `
            position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(0.5);
            display: flex; align-items: center; justify-content: center;
            z-index: 2147483647; pointer-events: none;
            animation: masteryPop 2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        `;
        document.body.appendChild(badge);
        setTimeout(() => { if (badge.parentNode) badge.parentNode.removeChild(badge); }, 3000);
    }

    // ============ 轮盘 UI 绘制 ============
    function createWheel() {
        if (wheelEl) return;
        wheelEl = document.createElement('div');
        wheelEl.id = 'custom-ping-wheel';
        wheelEl.style.cssText = `position: fixed; width: 0; height: 0; z-index: 2147483647; display: none; pointer-events: none; user-select: none; overflow: visible;`;

        let icons = '', highlights = '', lines = '', extendedBeams = '', gradientDefs = '';
        const R_OUTER = 160, R_INNER = 75, R_EXTENDED = 255, ICON_RADIUS = 118;

        for (let i = 0; i < 8; i++) {
            const angle = (i * 45 - 90) * Math.PI / 180;
            const gapAngle = 0.8 * Math.PI / 180;
            const startA = angle - (22.5 * Math.PI / 180) + gapAngle;
            const endA = angle + (22.5 * Math.PI / 180) - gapAngle;
            const iconX = Math.cos(angle) * ICON_RADIUS, iconY = Math.sin(angle) * ICON_RADIUS;

            icons += `<image class="ping-icon" data-index="${i}" href="${SECTIONS[i].icon}" x="${iconX - 22}" y="${iconY - 22}" width="44" height="44" style="transition: transform 0.12s ease-out, filter 0.12s ease-out; transform-origin: ${iconX}px ${iconY}px; image-rendering: -webkit-optimize-contrast;" />`;

            const x1_in = Math.cos(startA) * R_INNER, y1_in = Math.sin(startA) * R_INNER;
            const x2_in = Math.cos(endA) * R_INNER,   y2_in = Math.sin(endA) * R_INNER;
            const x1_out = Math.cos(startA) * R_OUTER, y1_out = Math.sin(startA) * R_OUTER;
            const x2_out = Math.cos(endA) * R_OUTER,   y2_out = Math.sin(endA) * R_OUTER;

            if (i % 2 === 0) {
                const x1_ext = Math.cos(startA) * R_EXTENDED, y1_ext = Math.sin(startA) * R_EXTENDED;
                const x2_ext = Math.cos(endA) * R_EXTENDED,   y2_ext = Math.sin(endA) * R_EXTENDED;
                const gradx1 = Math.cos(angle) * R_OUTER,   grady1 = Math.sin(angle) * R_OUTER;
                const gradx2 = Math.cos(angle) * R_EXTENDED, grady2 = Math.sin(angle) * R_EXTENDED;

                gradientDefs += `
                    <linearGradient id="extBeamGrad_${i}" x1="${gradx1}" y1="${grady1}" x2="${gradx2}" y2="${grady2}" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stop-color="#3d4450" stop-opacity="0.8" /><stop offset="50%" stop-color="#3d4450" stop-opacity="0.3" /><stop offset="100%" stop-color="#3d4450" stop-opacity="0" />
                    </linearGradient>
                    <linearGradient id="extBeamHighlightGrad_${i}" x1="${gradx1}" y1="${grady1}" x2="${gradx2}" y2="${grady2}" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stop-color="#C8AA6E" stop-opacity="0.7" /><stop offset="55%" stop-color="#FFF2D6" stop-opacity="0.2" /><stop offset="100%" stop-color="#FFF2D6" stop-opacity="0" />
                    </linearGradient>`;
                extendedBeams += `<path class="ping-ext-beam" data-index="${i}" d="M ${x1_out} ${y1_out} L ${x1_ext} ${y1_ext} A ${R_EXTENDED} ${R_EXTENDED} 0 0 1 ${x2_ext} ${y2_ext} L ${x2_out} ${y2_out} A ${R_OUTER} ${R_OUTER} 0 0 0 ${x1_out} ${y1_out} Z" fill="url(#extBeamGrad_${i})" style="transition: fill 0.15s ease-out;" />`;
            }

            highlights += `<path class="ping-highlight" data-index="${i}" d="M ${x1_in} ${y1_in} L ${x1_out} ${y1_out} A ${R_OUTER} ${R_OUTER} 0 0 1 ${x2_out} ${y2_out} L ${x2_in} ${y2_in} A ${R_INNER} ${R_INNER} 0 0 0 ${x1_in} ${y1_in} Z" fill="url(#sectorHighlightGrad)" opacity="0" style="transition: opacity 0.12s ease-out;" />`;

            const lineAngle = angle - (22.5 * Math.PI / 180);
            lines += `<line x1="${Math.cos(lineAngle) * R_INNER}" y1="${Math.sin(lineAngle) * R_INNER}" x2="${Math.cos(lineAngle) * R_OUTER}" y2="${Math.sin(lineAngle) * R_OUTER}" stroke="#785A28" stroke-width="1.2" opacity="0.65" />`;
        }

        wheelEl.innerHTML = `
            <div style="position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); width: 560px; height: 560px; display: flex; align-items: center; justify-content: center; overflow: visible;">
                <svg width="560" height="560" viewBox="-280 -280 560 560" preserveAspectRatio="xMidYMid meet" style="position: absolute; width: 560px; height: 560px; overflow: visible; shape-rendering: geometricPrecision;">
                    <defs>${gradientDefs}<radialGradient id="sectorHighlightGrad" cx="50%" cy="50%" r="50%"><stop offset="50%" stop-color="#C8AA6E" stop-opacity="0.45" /><stop offset="100%" stop-color="#FFF2D6" stop-opacity="0.75" /></radialGradient></defs>
                    ${extendedBeams}
                    <circle cx="0" cy="0" r="160" fill="rgba(42, 47, 56, 0.82)" />
                    ${highlights}${lines}
                    <circle cx="0" cy="0" r="160" fill="none" stroke="#5B4A22" stroke-width="1.8" opacity="0.8" />
                    <circle cx="0" cy="0" r="158.5" fill="none" stroke="#C8AA6E" stroke-width="1" opacity="0.5" />
                    ${icons}
                    <circle cx="0" cy="0" r="75" fill="none" stroke="#5B4A22" stroke-width="1.8" opacity="0.8" />
                    <circle cx="0" cy="0" r="73.5" fill="none" stroke="#C8AA6E" stroke-width="1" opacity="0.6" />
                </svg>
                <div id="ping-center" style="position: absolute; width: 140px; height: 140px; border-radius: 50%; background: radial-gradient(circle at center, #1b4b54 0%, #0d2c33 65%, #051518 100%); border: 2px solid #C8AA6E; box-sizing: border-box; box-shadow: inset 0 0 14px rgba(0,0,0,0.85), 0 0 10px rgba(0,0,0,0.5); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; pointer-events: none; transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#C8AA6E" style="margin-bottom: 2px; filter: drop-shadow(0 0 3px rgba(200,170,110,0.6));"><path d="M6.92 5L5 6.92l3.06 3.06 1.41-1.41L6.92 5zm11.16 1.92L16.16 5l-2.57 2.57 1.41 1.41 3.09-3.06zM3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                    <div style="color: #00d8ff; font-size: 12px; font-weight: 800; letter-spacing: 2px; font-family: 'Friz Quadrata', 'Arial Black', sans-serif; text-shadow: 0 0 6px rgba(0, 216, 255, 0.6);">PING</div>
                    <div style="display: flex; align-items: center; gap: 3px; margin-top: 3px; color: rgba(240, 230, 210, 0.55); font-size: 10px; font-family: sans-serif;"><span style="font-size: 11px;">🖱️</span> BACK</div>
                </div>
            </div>`;
        document.body.appendChild(wheelEl);
    }

    // ============ 交互事件 (修复误触) ============
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && (e.key === '6' || e.code === 'Digit6')) {
            e.preventDefault(); e.stopPropagation(); 
            triggerLocalBadge(); 
            return;
        }
    }, true);

    window.addEventListener('mousedown', (e) => {
        // 🚨 强制检查 e.altKey，不依赖外部变量
        if (e.button === 0 && e.altKey && !isDragging) {
            isDragging = true;
            hasDragged = false; 
            startMouseX = e.clientX;
            startMouseY = e.clientY;
            
            createWheel();
            wheelEl.style.left = e.clientX + 'px';
            wheelEl.style.top = e.clientY + 'px';
            wheelEl.style.display = 'block';
            
            e.preventDefault(); e.stopPropagation();
        }
    }, true);

    window.addEventListener('mousemove', (e) => {
        if (!isDragging || !wheelEl) return;
        
        // 只有移动超过 15 像素才算真正拖拽，防止单点触发
        const moveDx = e.clientX - startMouseX;
        const moveDy = e.clientY - startMouseY;
        if (!hasDragged && Math.sqrt(moveDx * moveDx + moveDy * moveDy) > 15) {
            hasDragged = true;
        }

        if (!hasDragged) return; 

        const rect = wheelEl.getBoundingClientRect();
        const dx = e.clientX - rect.left, dy = e.clientY - rect.top;
        if (Math.sqrt(dx * dx + dy * dy) < 68) { highlightIndex = -1; updateHighlight(); return; }
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        angle = (angle + 90 + 360 + 22.5) % 360;
        highlightIndex = Math.floor(angle / 45);
        updateHighlight();
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0 && isDragging) {
            isDragging = false;
            if (wheelEl) {
                wheelEl.style.display = 'none';
                // 🚨 只有拖拽了并选中了方向，才触发
                if (hasDragged && highlightIndex !== -1) {
                    triggerPing(highlightIndex, e.clientX, e.clientY);
                }
            }
            highlightIndex = -1;
            hasDragged = false;
            e.preventDefault(); e.stopPropagation();
        }
    }, true);

    function updateHighlight() {
        const centerEl = document.getElementById('ping-center');
        if (!centerEl) return;
        const highlights = document.querySelectorAll('.ping-highlight');
        const extBeams = document.querySelectorAll('.ping-ext-beam');
        const icons = document.querySelectorAll('.ping-icon');

        if (highlightIndex === -1) {
            centerEl.style.transform = 'scale(1.02)';
            centerEl.style.boxShadow = 'inset 0 0 14px rgba(0,0,0,0.85), 0 0 10px rgba(0,0,0,0.5)';
        } else {
            centerEl.style.transform = 'scale(0.98)';
            centerEl.style.boxShadow = 'inset 0 0 14px rgba(0,0,0,0.9), 0 0 15px rgba(0,216,255,0.3)';
        }
        highlights.forEach((el, i) => { el.style.opacity = i === highlightIndex ? '1' : '0'; });
        extBeams.forEach((el) => {
            const idx = parseInt(el.getAttribute('data-index'));
            el.setAttribute('fill', idx === highlightIndex ? `url(#extBeamHighlightGrad_${idx})` : `url(#extBeamGrad_${idx})`);
        });
        icons.forEach((el, i) => {
            if (i === highlightIndex) {
                el.style.transform = 'scale(1.22)';
                el.style.filter = 'drop-shadow(0px 0px 8px rgba(255,230,150,0.95)) brightness(1.3)';
            } else {
                el.style.transform = 'scale(1)';
                el.style.filter = 'drop-shadow(0px 2px 3px rgba(0,0,0,0.8)) brightness(0.85)';
            }
        });
    }

    // ============ 本地 Ping 动画 ============
    function triggerPing(index, x, y) {
        const now = Date.now();
        if (now - lastLocalEventTime < 200) return; 
        lastLocalEventTime = now;

        playSound(index);
        renderPingAnimation(SECTIONS[index].icon, x, y);
        
        const xRatio = x / window.innerWidth;
        const yRatio = y / window.innerHeight;
        broadcastEvent('ping', index, xRatio, yRatio);
    }

    function renderPingAnimation(iconSrc, x, y) {
        const pingEl = document.createElement('div');
        // 容器从 70px 放大到 120px
        pingEl.style.cssText = `position: fixed; left: ${x}px; top: ${y}px; transform: translate(-50%, -50%); width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; z-index: 2147483647; pointer-events: none; animation: nativePingPop 3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;`;
        
        // 图标从 60px 放大到 100px，并且增强了阴影效果
        pingEl.innerHTML = `<div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; border: 3px solid #C8AA6E; animation: nativePingRing 1.2s ease-out forwards;"></div><img src="${iconSrc}" style="width: 100px; height: 100px; filter: drop-shadow(0 0 15px #C8AA6E); z-index: 2;">`;
        
        if (!document.getElementById('ping-anim-style')) {
            const style = document.createElement('style');
            style.id = 'ping-anim-style';
            style.innerHTML = `
                @keyframes nativePingPop { 0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; } 10% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; } 20% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 80% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; } }
                @keyframes nativePingRing { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(2.2); opacity: 0; } }
            `;
            document.head.appendChild(style);
        }
        document.body.appendChild(pingEl);
        setTimeout(() => { if (pingEl.parentNode) pingEl.parentNode.removeChild(pingEl); }, 3000);
    }

    // ============ 启动 ============
    function start() {
        console.log('[PingSync] 已启动 (防误触版)');
        
        if (!document.getElementById('ping-highlight-style')) {
            const style = document.createElement('style');
            style.id = 'ping-highlight-style';
            style.innerHTML = `
                @keyframes pingFlash {
                    0% { box-shadow: inset 0 0 0px 0 rgba(200, 170, 110, 0); background-color: transparent; }
                    50% { box-shadow: inset 0 0 20px 2px rgba(200, 170, 110, 0.8), 0 0 10px rgba(200, 170, 110, 0.5); background-color: rgba(200, 170, 110, 0.2); }
                    100% { box-shadow: inset 0 0 0px 0 rgba(200, 170, 110, 0); background-color: transparent; }
                }
                .ping-highlight-flash {
                    animation: pingFlash 0.5s ease-in-out 3 !important;
                    position: relative;
                    z-index: 10;
                }
                @keyframes badgePopUp {
                    0% { transform: translate(-50%, 0) scale(0.2); opacity: 0; }
                    15% { transform: translate(-50%, -20px) scale(1.15); opacity: 1; }
                    25% { transform: translate(-50%, -10px) scale(1); opacity: 1; }
                    75% { transform: translate(-50%, -10px) scale(1); opacity: 1; }
                    100% { transform: translate(-50%, -30px) scale(1.2); opacity: 0; }
                }
                @keyframes masteryPop {
                    0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
                    15% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
                    25% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                    75% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        if (roomPollTimer) clearInterval(roomPollTimer);
        roomPollTimer = setInterval(() => { checkPhase().catch(()=>{}); }, ROOM_POLL_INTERVAL);
        checkPhase().catch(()=>{});
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(start, 1000);
    } else {
        window.addEventListener('DOMContentLoaded', () => setTimeout(start, 1000));
    }
})();
