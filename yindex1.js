// ==UserScript==
// @name         修改RP显示
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      1.0.2
// ==/UserScript==

(function() {
    'use strict';

    function modifyRP() {
        const els = document.querySelectorAll('.currency-rp-top-up-enabled');
        for (let i = 0; i < els.length; i++) {
            if (els[i].getAttribute('data-original-text') === null) {
                els[i].setAttribute('data-original-text', els[i].textContent);
            }
            // 劫持 textContent 的 getter
            Object.defineProperty(els[i], 'textContent', {
                get: function() { return '999999'; },
                set: function() {},
                configurable: true
            });
        }
    }

    setInterval(modifyRP, 200);
    modifyRP();
})();
