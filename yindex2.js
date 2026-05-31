// ==UserScript==
// @name         随机皮肤背景
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      1.6.2
// ==/UserScript==

(function () {
    'use strict';

    const CHAMPION_NAMES = [
        "Aatrox", "Ahri", "Akali", "Akshan", "Alistar", "Amumu", "Anivia", "Annie", "Aphelios", "Ashe",
        "AurelionSol", "Azir", "Bard", "Belveth", "Blitzcrank", "Brand", "Braum", "Briar", "Caitlyn", "Camille",
        "Chogath", "Corki", "Darius", "Diana", "Draven", "DrMundo", "Ekko", "Elise", "Evelynn", "Ezreal",
        "Fiddlesticks", "Fiora", "Fizz", "Galio", "Gangplank", "Garen", "Gnar", "Gragas", "Graves", "Gwen",
        "Hecarim", "Heimerdinger", "Illaoi", "Irelia", "Ivern", "Janna", "JarvanIV", "Jax", "Jayce", "Jhin",
        "Jinx", "Kaisa", "Kalista", "Karma", "Karthus", "Kassadin", "Katarina", "Kayle", "Kayn", "Kennen",
        "Khazix", "Kindred", "Kled", "KogMaw", "KSante", "Leblanc", "LeeSin", "Leona", "Lillia", "Lissandra",
        "Lucian", "Lulu", "Lux", "Malphite", "Malzahar", "Maokai", "MasterYi", "Milio", "MissFortune", "MonkeyKing",
        "Mordekaiser", "Morgana", "Nami", "Nasus", "Nautilus", "Neeko", "Nidalee", "Nilah", "Nocturne", "Nunu",
        "Olaf", "Orianna", "Ornn", "Pantheon", "Poppy", "Pyke", "Qiyana", "Quinn", "Rakan", "Rammus",
        "RekSai", "Rell", "Renata", "Renekton", "Rengar", "Riven", "Rumble", "Ryze", "Samira", "Sejuani",
        "Senna", "Seraphine", "Sett", "Shaco", "Shen", "Shyvana", "Singed", "Sion", "Sivir", "Skarner",
        "Sona", "Soraka", "Swain", "Sylas", "Syndra", "TahmKench", "Taliyah", "Talon", "Taric", "Teemo",
        "Thresh", "Tristana", "Trundle", "Tryndamere", "TwistedFate", "Twitch", "Udyr", "Urgot", "Varus", "Vayne",
        "Veigar", "Velkoz", "Vex", "Vi", "Viego", "Viktor", "Vladimir", "Volibear", "Warwick", "Xayah",
        "Xerath", "XinZhao", "Yasuo", "Yone", "Yorick", "Yuumi", "Zac", "Zed", "Zeri", "Ziggs",
        "Zilean", "Zoe", "Zyra"
    ];

    let currentSrc = '';
    let lastPage = '';

    function getSkinPaths() {
        const name = CHAMPION_NAMES[Math.floor(Math.random() * CHAMPION_NAMES.length)];
        const nameLower = name.toLowerCase();
        const skinNum = Math.floor(Math.random() * 30);
        const paths = [];
        const folders = [skinNum.toString().padStart(2, '0'), skinNum.toString(), 'base'];
        const files = [`${nameLower}_splash_centered_${skinNum}`, `${nameLower}_splash_tile_${skinNum}`];
        for (const f of folders) for (const n of files) {
            paths.push(`/lol-game-data/assets/ASSETS/Characters/${name}/Skins/Skin${f}/Images/${n}.jpg`);
        }
        return paths;
    }

    function loadImage(src) {
        return new Promise(r => {
            const img = new Image();
            const t = setTimeout(() => r(null), 2000);
            img.onload = () => { clearTimeout(t); r(src); };
            img.onerror = () => { clearTimeout(t); r(null); };
            img.src = src;
        });
    }

    async function findValidSkin() {
        for (let i = 0; i < 20; i++) {
            for (const src of getSkinPaths()) {
                if (await loadImage(src)) return src;
            }
        }
        return null;
    }

    function removeOriginalBg() {
        // 隐藏原来的背景 img
        const originalImg = document.querySelector('.bg-current .lol-uikit-background-switcher-image');
        if (originalImg) {
            originalImg.style.display = 'none';
        }
        // 清掉 bg-current 的 CSS 背景图
        const bgDiv = document.querySelector('.bg-current');
        if (bgDiv) {
            bgDiv.style.backgroundImage = 'none';
        }
    }

    function createBackground() {
        let bg = document.getElementById('custom-skin-bg');
        if (bg) return bg;

        const parent = document.querySelector('.parties-background');
        if (!parent) return null;

        parent.style.position = 'relative';
        parent.style.overflow = 'hidden';

        bg = document.createElement('img');
        bg.id = 'custom-skin-bg';
        bg.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: 0;
            pointer-events: none;
        `;
        parent.insertBefore(bg, parent.firstChild);
        return bg;
    }

    function applyBackground(src) {
        if (!src) return;
        removeOriginalBg();
        const bg = createBackground();
        if (!bg) return;
        if (bg.src !== src) {
            bg.src = src;
        }
        const mask = document.querySelector('.parties-background-mask');
        if (mask) {
            mask.style.opacity = '0.1';
        }
    }

    function getPageKey() {
        const gameSelect = document.querySelector('.parties-game-select-screen');
        const customRoot = document.querySelector('.custom-root');
        return [
            gameSelect && !gameSelect.classList.contains('game-select-hide') ? 'select' : '',
            customRoot && customRoot.classList.contains('custom-lobby-show') ? 'custom' : ''
        ].join('');
    }

    async function replaceBackground() {
        const pageKey = getPageKey();
        if (pageKey !== lastPage) {
            lastPage = pageKey;
            currentSrc = '';
            const oldBg = document.getElementById('custom-skin-bg');
            if (oldBg) oldBg.remove();
        }

        if (currentSrc) {
            applyBackground(currentSrc);
            return;
        }

        const src = await findValidSkin();
        if (src) {
            currentSrc = src;
            applyBackground(src);
            console.log('[随机背景] ✅', src.split('/').pop());
        }
    }

    replaceBackground();
    setInterval(replaceBackground, 2000);
})();
