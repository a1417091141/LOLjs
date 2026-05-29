// ==UserScript==
// @name         修改RP显示
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      1.0.4
// ==/UserScript==

(function() {
    'use strict';

    function modifyRP() {
        var el = document.querySelector('.currency-rp-top-up-enabled');
        if (!el) return;
        // 直接改文本
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        var node;
        while (node = walker.nextNode()) {
            if (node.nodeValue.trim()) {
                node.nodeValue = '999999';
            }
        }
        el.innerHTML = '999999';
        el.textContent = '999999';
    }

    modifyRP();
    setInterval(modifyRP, 50);
    new MutationObserver(modifyRP).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
