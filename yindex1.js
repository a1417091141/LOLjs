// ==UserScript==
// @name         修改RP显示
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      1.0.3
// ==/UserScript==

(function() {
    'use strict';

    function modifyRP() {
        const els = document.querySelectorAll('.currency-rp-top-up-enabled');
        for (let i = 0; i < els.length; i++) {
            // 直接改文本节点
            for (let j = 0; j < els[i].childNodes.length; j++) {
                if (els[i].childNodes[j].nodeType === 3) {
                    els[i].childNodes[j].nodeValue = '999999';
                }
            }
            // 也改 innerHTML 兜底
            if (els[i].innerHTML.trim() !== '999999') {
                els[i].innerHTML = '999999';
            }
        }
    }

    // MutationObserver 监听所有变化
    const observer = new MutationObserver(modifyRP);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    setInterval(modifyRP, 50);
    modifyRP();
})();
