// ==PenguLoader==
// @name         非房主强行开始游戏 (原生点击最终版)
// @description  仅拦截确认按钮，原生表单发送
// @version      6.2.0
// ==/PenguLoader==

(function () {
    'use strict';

    const START_API_URL = 'https://140.245.73.30/yaofan/start_api.php'; 
    const POLL_INTERVAL = 1000;

    let partyId = null;
    let amIHost = false;
    let pollTimer = null;

    async function lcuGet(path) {
        try {
            const res = await fetch(path);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) { return null; }
    }

    // ============ 核心：精准劫持确认按钮 ============
    async function hackStartButton() {
        const btn = document.querySelector('.confirm-button-container .confirm');
        if (!btn) return;

        // 查身份
        const lobby = await lcuGet('/lol-lobby/v2/lobby');
        if (!lobby || !lobby.localMember) return;

        const isNowHost = lobby.localMember.isLeader;

        // 如果是房主，恢复原样
        if (isNowHost) {
            if (btn.classList.contains('force-hacked')) {
                btn.classList.remove('force-hacked');
                btn.classList.add('disabled');
                btn.onclick = null;
                const styleEl = document.getElementById('green-start-style');
                if (styleEl) styleEl.remove();
            }
            return; 
        }

        // 非房主逻辑
        if (btn.classList.contains('force-hacked')) return;

        // 1. 把按钮变绿
        btn.classList.add('force-hacked');
        btn.classList.remove('disabled');
        if (!document.getElementById('green-start-style')) {
            const style = document.createElement('style');
            style.id = 'green-start-style';
            style.innerHTML = `
                .confirm-button-container .confirm.force-hacked {
                    filter: hue-rotate(80deg) !important;
                }
                .confirm-button-container .confirm.force-hacked .middle-confirm {
                    filter: hue-rotate(-80deg) !important;
                    color: #ffffff !important; 
                }
            `;
            document.head.appendChild(style);
        }

        // 2. 🚨 直接拦截原生点击（如果原生被吃，用 addEventListener 捕获）
        const handleStartClick = async (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            console.log("========== [AutoStart] 确认按钮被点击！ ==========");
            
            if (!partyId) {
                console.warn('[AutoStart] partyId 为空，请稍等。');
                return;
            }

            btn.style.opacity = '0.5';

            const bodyData = new URLSearchParams();
            bodyData.append('action', 'request_start');
            bodyData.append('partyId', partyId);
            
            try { 
                console.log('[AutoStart] 正在发送 POST...');
                const res = await fetch(START_API_URL, { 
                    method: 'POST', 
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: bodyData
                }); 
                
                const text = await res.text();
                console.log('[AutoStart] 服务器返回:', text);
                
            } catch(err) {
                console.error('[AutoStart] 网络错误:', err);
            }
            
            setTimeout(() => { btn.style.opacity = '1'; }, 1000);
        };

        // 覆盖 onclick
        btn.onclick = handleStartClick;
        // 加上事件监听，双保险
        btn.addEventListener('click', handleStartClick, true);
        
        console.log('[AutoStart] 强行开始已就绪（精准点击）');
    }

    // ============ 轮询与主逻辑 ============
    async function checkLobby() {
        const phase = await lcuGet('/lol-gameflow/v1/gameflow-phase');
        
        if (phase === 'Lobby' || phase === 'Matchmaking') {
            const lobby = await lcuGet('/lol-lobby/v2/lobby');
            if (lobby && lobby.partyId && lobby.localMember) {
                partyId = lobby.partyId;
                amIHost = lobby.localMember.isLeader;

                if (amIHost) {
                    checkStartCommand(); 
                }
            } else {
                cleanup();
            }
        } else {
            cleanup();
        }
    }

    // 房主监听并执行
    async function checkStartCommand() {
        if (!amIHost || !partyId) return;
        
        const bodyData = new URLSearchParams();
        bodyData.append('action', 'check_start');
        bodyData.append('partyId', partyId);
        
        try {
            const res = await fetch(START_API_URL, { 
                method: 'POST', 
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: bodyData
            });
            const data = await res.json();
            if (data.start) {
                console.log('[AutoStart] 收到队友开始请求，正在尝试发起...');
                for (let i = 0; i < 5; i++) {
                    const startRes = await fetch('/lol-lobby/v1/lobby/start', { method: 'POST' });
                    if (startRes.ok) {
                        console.log('[AutoStart] 开始游戏成功！');
                        break;
                    } else {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
            }
        } catch (e) {}
    }

    function cleanup() {
        partyId = null;
        amIHost = false;
    }

    function start() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(() => { checkLobby().catch(()=>{}); }, POLL_INTERVAL);

        const observer = new MutationObserver(() => { hackStartButton(); });
        observer.observe(document.body, { childList: true, subtree: true });
        
        checkLobby().catch(()=>{});
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(start, 1000);
    } else {
        window.addEventListener('DOMContentLoaded', () => setTimeout(start, 1000));
    }
})();
