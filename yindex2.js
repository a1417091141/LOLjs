// ==UserScript==
// @name         随机皮肤背景
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      1.7.0
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
        "Lucian", "Lulu", "Lux", "Malphite", "Malzahar", "Maokai", "MasterYi", "Milio", "MissFortune", "Wukong",
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
    let validSkinCache = new Map();
    let failedAttempts = 0;
    const MAX_FAILED_ATTEMPTS = 5;

    function getSkinPaths() {
        // 随机打乱英雄列表，避免重复尝试
        const shuffled = [...CHAMPION_NAMES].sort(() => Math.random() - 0.5);
        const name = shuffled[0];
        const nameLower = name.toLowerCase();
        
        // 大多数英雄皮肤不超过20个
        const maxSkins = 20;
        const skinNum = Math.floor(Math.random() * maxSkins);
        
        const basePath = `/lol-game-data/assets/ASSETS/Characters/${name}/Skins/`;
        const paddedNum = skinNum.toString().padStart(2, '0');
        
        // 优先尝试最常见的路径格式
        return [
            `${basePath}Skin${paddedNum}/Images/${nameLower}_splash_centered_${skinNum}.jpg`,
            `${basePath}Skin${paddedNum}/Images/${nameLower}_splash_tile_${skinNum}.jpg`,
            `${basePath}Skin${skinNum}/Images/${nameLower}_splash_centered_${skinNum}.jpg`,
            `${basePath}Skin${skinNum}/Images/${nameLower}_splash_tile_${skinNum}.jpg`,
            `${basePath}base/Images/${nameLower}_splash_centered_${skinNum}.jpg`,
        ];
    }

    function loadImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            let resolved = false;
            
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    img.src = ''; // 中断加载
                    resolve(null);
                }
            }, 3000);
            
            img.onload = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    resolve(src);
                }
            };
            
            img.onerror = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    resolve(null);
                }
            };
            
            img.src = src;
        });
    }

    async function findValidSkin() {
        // 先检查缓存
        const cachedSkin = validSkinCache.get(lastPage);
        if (cachedSkin) {
            const isValid = await loadImage(cachedSkin);
            if (isValid) {
                console.log('[随机背景] 📦 使用缓存:', cachedSkin.split('/').pop());
                return cachedSkin;
            } else {
                validSkinCache.delete(lastPage);
            }
        }
        
        // 尝试加载新皮肤
        for (let attempt = 0; attempt < 30; attempt++) {
            const paths = getSkinPaths();
            for (const src of paths) {
                if (await loadImage(src)) {
                    validSkinCache.set(lastPage, src);
                    failedAttempts = 0;
                    return src;
                }
            }
        }
        
        failedAttempts++;
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
            opacity: 0;
            transition: opacity 0.8s ease-in-out;
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
            // 图片加载完成后淡入
            bg.onload = () => {
                bg.style.opacity = '1';
            };
            // 如果图片已经加载（缓存），直接显示
            if (bg.complete) {
                bg.style.opacity = '1';
            }
        }
        
        const mask = document.querySelector('.parties-background-mask');
        if (mask) {
            mask.style.opacity = '0.05';
        }
    }

    function getPageKey() {
        const gameSelect = document.querySelector('.parties-game-select-screen');
        const customRoot = document.querySelector('.custom-root');
        return [
            gameSelect && !gameSelect.classList.contains('game-select-hide') ? 'select' : 'lobby',
            customRoot && customRoot.classList.contains('custom-lobby-show') ? 'custom' : 'normal'
        ].join('-');
    }

    async function replaceBackground() {
        // 如果连续失败太多次，暂停尝试
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            console.warn('[随机背景] ⚠️ 连续失败次数过多，暂停尝试');
            return;
        }
        
        const pageKey = getPageKey();
        if (pageKey !== lastPage) {
            lastPage = pageKey;
            currentSrc = '';
            const oldBg = document.getElementById('custom-skin-bg');
            if (oldBg) {
                oldBg.style.opacity = '0';
                setTimeout(() => oldBg.remove(), 800);
            }
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
        } else {
            console.warn('[随机背景] ❌ 未找到有效皮肤');
        }
    }

    // 初始加载
    replaceBackground();
    
    // 定期检查并更新
    setInterval(replaceBackground, 3000);
    
    // 监听页面变化
    const observer = new MutationObserver(() => {
        const pageKey = getPageKey();
        if (pageKey !== lastPage) {
            replaceBackground();
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
    });
})();
