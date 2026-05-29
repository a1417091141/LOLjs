

(function() {
    'use strict';

    function modifyRP() {
        var el = document.querySelector('.currency-rp-top-up-enabled');
        if (!el) return;
        if (el.textContent.trim() === '999999') return;
        
        // 干掉所有子节点
        while (el.firstChild) el.removeChild(el.firstChild);
        // 新建文本节点
        el.appendChild(document.createTextNode('999999'));
    }

    modifyRP();
    setInterval(modifyRP, 100);
    new MutationObserver(modifyRP).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
