
// ==UserScript==
// @name         测试插件
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      1.0.0
// ==/UserScript==

(function() {
    'use strict';
    console.log('🎉 云端插件加载成功！');
    
    // 在客户端左下角弹个提示
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: #1e1e2e;
        color: #cdbe91;
        border: 1px solid #c8aa6e;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 13px;
        z-index: 999999;
        pointer-events: none;
    `;
    div.textContent = '✅ 插件已连接';
    document.body.appendChild(div);
    
    setTimeout(() => div.remove(), 3000);
})();
