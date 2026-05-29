// ==UserScript==
// @name         修改RP和BE显示
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      1.0.6
// ==/UserScript==

(function() {
    'use strict';

    function modifyCurrency(el, selector) {
        var target = el ? el : document.querySelector(selector);
        if (!target) return;
        if (target.textContent.trim() === '999999') return;
        while (target.firstChild) target.removeChild(target.firstChild);
        target.appendChild(document.createTextNode('999999'));
    }

    function modifyAll() {
        modifyCurrency(null, '.currency-rp-top-up-enabled');
        modifyCurrency(null, '.currency-be-text');
    }

    modifyAll();
    setInterval(modifyAll, 100);
    new MutationObserver(modifyAll).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
