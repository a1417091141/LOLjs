// ==UserScript==
// @name         自定义在线状态文字
// @namespace    custom-status-plugin
// @version      1.0.0
// @description  通过 LCU 接口修改自定义状态文字，好友可见，本地永久保存
// @match        https://riot:*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'custom_status_message';
    let statusPanel = null;

    // 获取当前的 LCU 端口 (通过读取客户端自身的进程信息)
    async function getLcuAuth() {
        try {
            const res = await fetch('/lol-summoner/v1/current-summoner');
            if (!res.ok) return null;
            return true;
        } catch (e) {
            return null;
        }
    }

    // 更新状态文字
    async function updateStatus(message) {
        try {
            const res = await fetch('/lol-chat/v1/me', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    statusMessage: message
                })
            });
            if (res.ok) {
                localStorage.setItem(STORAGE_KEY, message);
                return true;
            }
            return false;
        } catch (e) {
            console.error('更新状态失败:', e);
            return false;
        }
    }

    // 注入 UI 界面
    function injectUI() {
        // 防止重复创建
        if (document.getElementById('custom-status-btn')) return;

        // 1. 创建悬浮按钮
        const btn = document.createElement('div');
        btn.id = 'custom-status-btn';
        btn.innerHTML = '💬';
        btn.style.cssText = `
            position: fixed; bottom: 120px; right: 30px;
            width: 40px; height: 40px;
            background: linear-gradient(180deg, #1E2328 0%, #0A0E12 100%);
            border: 1px solid #785A28;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            color: #C8AA6E; font-size: 20px; cursor: pointer;
            z-index: 999999; box-shadow: 0 4px 6px rgba(0,0,0,0.5);
            transition: all 0.3s ease;
            user-select: none;
        `;

        btn.onmouseenter = () => {
            btn.style.borderColor = '#C8AA6E';
            btn.style.boxShadow = '0 0 15px rgba(200,170,110,0.8)';
            btn.style.color = '#F0E6D2';
        };
        btn.onmouseleave = () => {
            btn.style.borderColor = '#785A28';
            btn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.5)';
            btn.style.color = '#C8AA6E';
        };

        btn.onclick = () => {
            if (!statusPanel) return;
            const isVisible = statusPanel.style.display === 'flex';
            statusPanel.style.display = isVisible ? 'none' : 'flex';
            if (!isVisible) {
                // 打开时自动聚焦输入框
                const input = document.getElementById('custom-status-input');
                if (input) input.focus();
            }
        };

        document.body.appendChild(btn);

        // 2. 创建配置面板
        statusPanel = document.createElement('div');
        statusPanel.id = 'custom-status-panel';
        statusPanel.style.cssText = `
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 320px; padding: 20px;
            background: #010A13;
            border: 1px solid #785A28;
            box-shadow: 0 0 30px rgba(0,0,0,0.9);
            z-index: 9999999; display: none;
            flex-direction: column; gap: 15px;
            font-family: 'Microsoft YaHei', sans-serif;
        `;

        statusPanel.innerHTML = `
            <div style="color: #F0E6D2; font-size: 16px; font-weight: bold; text-align: center; border-bottom: 1px solid #3C2E14; padding-bottom: 10px;">
                修改状态文字
            </div>
            <div style="font-size: 12px; color: #A09B8C; line-height: 1.5;">
                提示：好友在好友列表和聊天窗口中能看到这行文字。
            </div>
            <input type="text" id="custom-status-input" placeholder="输入你要显示的状态..." 
                style="background: #000; border: 1px solid #3C2E14; color: #C8AA6E; padding: 10px; 
                       font-size: 14px; outline: none; transition: border 0.3s;"
                maxlength="100">
            
            <div style="display: flex; gap: 10px; justify-content: space-between; margin-top: 10px;">
                <button id="custom-status-save" style="flex: 1; padding: 8px; background: #C8AA6E; color: #010A13; border: none; cursor: pointer; font-weight: bold; transition: 0.2s;">保存并生效</button>
                <button id="custom-status-clear" style="flex: 1; padding: 8px; background: rgba(30,35,40,0.8); color: #A09B8C; border: 1px solid #3C2E14; cursor: pointer; font-weight: bold; transition: 0.2s;">清除状态</button>
            </div>
        `;

        document.body.appendChild(statusPanel);

        // 3. 绑定事件
        const input = document.getElementById('custom-status-input');
        const saveBtn = document.getElementById('custom-status-save');
        const clearBtn = document.getElementById('custom-status-clear');

        // 读取上次保存的文字
        const savedText = localStorage.getItem(STORAGE_KEY);
        if (savedText) input.value = savedText;

        // 保存文字
        saveBtn.onclick = async () => {
            const text = input.value.trim();
            if (text === '') {
                alert('请输入状态文字！');
                return;
            }
            saveBtn.innerText = '更新中...';
            saveBtn.disabled = true;

            const success = await updateStatus(text);
            
            saveBtn.innerText = '保存并生效';
            saveBtn.disabled = false;

            if (success) {
                saveBtn.innerText = '✅ 已生效';
                setTimeout(() => saveBtn.innerText = '保存并生效', 2000);
                statusPanel.style.display = 'none'; // 成功后关闭面板
            } else {
                alert('设置失败，请检查网络或客户端。');
            }
        };

        // 清除状态
        clearBtn.onclick = async () => {
            clearBtn.innerText = '清除中...';
            clearBtn.disabled = true;
            
            const success = await updateStatus('');
            
            clearBtn.innerText = '清除状态';
            clearBtn.disabled = false;
            
            if (success) {
                input.value = '';
                localStorage.removeItem(STORAGE_KEY);
                clearBtn.innerText = '✅ 已清除';
                setTimeout(() => clearBtn.innerText = '清除状态', 2000);
            }
        };

        // 回车键直接保存
        input.onkeydown = (e) => {
            if (e.key === 'Enter') saveBtn.click();
        };
    }

    // 启动逻辑
    const init = async () => {
        const auth = await getLcuAuth();
        if (!auth) return; // 只有在登录后注入UI

        // 检查是否有保存的历史记录，如果有，且当前游戏还没应用，尝试静默应用一次
        const savedText = localStorage.getItem(STORAGE_KEY);
        if (savedText) {
            await updateStatus(savedText);
        }

        // 每秒检查一次 UI 是否被客户端刷新干掉
        setInterval(injectUI, 1000);
        injectUI();
    };

    // 延迟启动，等待客户端加载完毕
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 2000);
    } else {
        window.addEventListener('DOMContentLoaded', () => setTimeout(init, 2000));
    }

})();
