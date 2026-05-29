// ==UserScript==
// @name         动态插件加载器
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      1.0.0
// ==/UserScript==

(async function() {
    const BASE = 'https://cdn.jsdelivr.net/gh/a1417091141/LOLjs@latest';
    const cacheKey = 'dynamic_plugins_loaded';
    
    if (sessionStorage.getItem(cacheKey)) return;
    sessionStorage.setItem(cacheKey, '1');

    try {
        const config = await fetch(`${BASE}/plugins.json`).then(r => r.json());
        const list = config.plugins || [];

        for (const file of list) {
            try {
                const code = await fetch(`${BASE}/${file}`).then(r => r.text());
                const clean = code.replace(/\/\/ ==UserScript==[\s\S]*?==\/UserScript==/, '');
                new Function(clean)();
                console.log('[加载器] ✅', file);
            } catch(e) {
                console.log('[加载器] ❌', file, e.message);
            }
        }
    } catch(e) {
        console.log('[加载器] ❌ 加载失败:', e.message);
    }
})();
