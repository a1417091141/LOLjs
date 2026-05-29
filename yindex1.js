// ==UserScript==
// @name         修改RP显示
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      1.0.0
// ==/UserScript==

(function() {
    'use strict';

    function modifyRP() {
        const rpElements = document.querySelectorAll('.currency-rp-top-up-enabled');
        for (const el of rpElements) {
            if (el.textContent.trim() !== '999999') {
                el.textContent = '999999';
            }
        }
    }

    setInterval(modifyRP, 1000);
    modifyRP();
})();
