// ==PenguLoader==
// @name         非房主强行开始游戏 (最终优化版)
// @description  保留原生结构，安全通讯，带点击反馈
// @version      5.7.0
// ==/PenguLoader==

(function () {
    'use strict';

    // 🚨 请确保这个地址可以访问
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

    // ============ 核心：破解按钮 + 强制转绿 ============
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

        // --- 非房主逻辑 ---
        if (btn.classList.contains('force-hacked')) return;

        btn.classList.add('force-hacked');
        btn.classList.remove('disabled');

        // 修复了 CSS 的 drop-shadow 拼写错误，并加上了按钮点击变暗效果
        if (!document.getElementById('green-start-style')) {
            const style = document.createElement('style');
            style.id = 'green-start-style';
            style.innerHTML = `
                .confirm-button-container .confirm.force-hacked {
                    filter: hue-rotate(80deg) drop-shadow(0 0 8px rgba(140, 255, 140, 0.6)) !important;
                    transition: filter 0.2s ease, opacity 0.2s ease;
                }
                .confirm-button-container .confirm.force-hacked .middle-confirm {
                    filter: hue-rotate(-80deg) !important;
                    color: #ffffff !important;
                    font-weight: bold;
                }
            `;
            document.head.appendChild(style);
        }

        // 拦截点击
        btn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (!partyId) {
                console.warn('[AutoStart] 队伍ID获取失败，请稍等重试');
                return;
            }
            
            // 🚨 精准获取文字节点，加容错防报错
            const textEl = btn.querySelector('.middle-confirm') || btn;
            const originalText = textEl.innerText;
            textEl.innerText = '请求发送中...';
            btn.style.opacity = '0.6';

            const fd = new FormData();
            fd.append('action', 'request_start');
            fd.append('partyId', partyId);

            try { 
                // 🚨 增加 timeout 防止服务端由于文件锁卡住导致请求无响应
                const response = await fetch(START_API_URL, { 
                    method: 'POST', 
                    body: fd,
                    timeout: 3000 
                }); 
                if (!response.ok) {
                    console.error('[AutoStart] 请求服务器失败，HTTP:', response.status);
                    textEl.innerText = '请求失败';
                } else {
                    console.log('[AutoStart] 开始请求已成功发送给服务器');
                    textEl.innerText = '已请求开始';
                }
            } catch(err) {
                console.error('[AutoStart] 网络或跨域(CORS)错误:', err);
                textEl.innerText = '网络错误';
            }
            
            setTimeout(() => { 
                textEl.innerText = originalText;
                btn.style.opacity = '1'; 
            }, 1500);
        };
        
        console.log('[AutoStart] 强行开始按钮已激活 (原版绿边)');
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
        const fd = new FormData();
        fd.append('action', 'check_start');
        fd.append('partyId', partyId);
        try {
            const res = await fetch(START_API_URL, { method: 'POST', body: fd, timeout: 3000 });
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
