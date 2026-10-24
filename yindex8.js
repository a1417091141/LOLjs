// ==PenguLoader==
// @name         非房主强行开始游戏 (绝对原版)
// @description  保留所有原生结构，强制将蓝色渲染为淡绿色
// @version      5.9.0
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

    // ============ 核心：破解按钮 + 强制转绿 ============
    async function hackStartButton() {
        const btn = document.querySelector('.confirm-button-container .confirm');
        if (!btn) return;

        // 查身份
        const lobby = await lcuGet('/lol-lobby/v2/lobby');
        if (!lobby || !lobby.localMember) return;

        const isNowHost = lobby.localMember.isLeader;

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

        // 🚨 彻底修复 CSS
        if (!document.getElementById('green-start-style')) {
            const style = document.createElement('style');
            style.id = 'green-start-style';
            style.innerHTML = `
                .confirm-button-container .confirm.force-hacked {
                    filter: hue-rotate(80deg) !important;
                    transition: filter 0.2s ease;
                }
                .confirm-button-container .confirm.force-hacked .middle-confirm {
                    filter: hue-rotate(-80deg) !important;
                    color: #ffffff !important; 
                    font-weight: bold;
                }
            `;
            document.head.appendChild(style);
        }

        // 🚨 关键点：确保 onclick 能挂载成功
        btn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 打印检查
            console.log("========== [AutoStart] 按钮被点击了！ ==========");
            
            if (!partyId) {
                console.warn('[AutoStart] 错误：partyId 为空，可能还没进入房间！');
                return;
            }

            // 文字反馈
            const textEl = btn.querySelector('.middle-confirm') || btn;
            const originalText = textEl.innerText;
            textEl.innerText = '发送中...';

            const fd = new FormData();
            fd.append('action', 'request_start');
            fd.append('partyId', partyId);
            
            try { 
                console.log('[AutoStart] 正在向服务器发送 POST 请求...');
                // 原封不动的 fetch
                const response = await fetch(START_API_URL, { method: 'POST', body: fd });
                console.log('[AutoStart] 服务器响应状态码:', response.status);
                
                if (response.ok) {
                    textEl.innerText = '已请求';
                } else {
                    textEl.innerText = '请求异常';
                }
            } catch(err) {
                console.error('[AutoStart] fetch 网络报错:', err);
                textEl.innerText = '网络错误';
            }
            
            setTimeout(() => { 
                textEl.innerText = originalText;
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
            const res = await fetch(START_API_URL, { method: 'POST', body: fd });
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
