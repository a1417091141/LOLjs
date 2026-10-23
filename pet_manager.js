// ==UserScript==
// @name         宠物管理器 (本地缓存版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      19.0.0
// ==/UserScript==

(async function () {
    'use strict';

    const REPO = 'a1417091141/LOLjs';
    const CDN_BASE = `https://cdn.jsdmirror.com/gh/${REPO}@main`;
    const API_PROXY = 'http://127.0.0.1:18888/github-api';
    
    // 本地缓存 Key
    const CACHE_KEY = 'pet_list_cache';

    let currentPetKey = localStorage.getItem('pet_current_model') || 'yasuo';
    let PET_LIST = ['yasuo', 'gewen'];
    window.stopPetAnimation = null;

    // 1. 极速 UI：立刻画出按钮（永远不卡）
    function createUI() {
        if (document.getElementById('pet-manager-btn')) return;
        
        // 找地方塞按钮 (挂到版本号旁边)
        const versionBar = document.querySelector('.version-bar-container');
        if (!versionBar) {
            setTimeout(createUI, 500); // 没找到就等会儿再试
            return;
        }

        const btn = document.createElement('div');
        btn.id = 'pet-manager-btn';
        btn.innerText = '🐾';
        btn.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;margin-right:6px;cursor:pointer;color:#C8AA6E;font-size:14px;`;
        
        btn.onclick = () => {
            const nextIndex = (PET_LIST.indexOf(currentPetKey) + 1) % PET_LIST.length;
            switchPet(PET_LIST[nextIndex]);
        };
        versionBar.prepend(btn);
        console.log("✅ 按钮已秒出");
    }

    // 2. 切换逻辑
    function switchPet(nextKey) {
        if (window.stopPetAnimation) {
            try { window.stopPetAnimation(); } catch(e){}
            window.stopPetAnimation = null;
        }
        const old = document.getElementById('three-pet-container');
        if (old) old.remove();

        currentPetKey = nextKey;
        localStorage.setItem('pet_current_model', nextKey);
        window.dispatchEvent(new CustomEvent('spawn_pet', { detail: nextKey }));
    }

    // 3. 在后台偷偷用网络更新列表（不阻塞主线程）
    async function updateList() {
        try {
            // 顺便把模型文件预加载请求发出去
            PET_LIST.forEach(pet => {
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = `${CDN_BASE}/pet/${pet}.glb`;
                document.head.appendChild(link);
            });

            // 拉取最新的列表（仅在后台，不影响 UI 也不影响其他插件）
            let jsonUrl = `${CDN_BASE}/plugins.json?t=${Date.now()}`;
            const commitRes = await fetch(API_PROXY);
            if (commitRes.ok) {
                const commitHash = await commitRes.text();
                if (commitHash && commitHash.length > 5) {
                    jsonUrl = `https://cdn.jsdmirror.com/gh/${REPO}@${commitHash.trim()}/plugins.json`;
                }
            }
            const res = await fetch(jsonUrl);
            const config = await res.json();
            
            const petFiles = config.plugins.filter(file => 
                file.includes('pet_') && file.endsWith('.js') && !file.includes('pet_manager')
            );

            const scannedPets = petFiles.map(file => {
                const match = file.match(/pet_([a-zA-Z0-9]+)\.js/);
                return match ? match[1] : null;
            }).filter(Boolean);

            if (scannedPets.length > 0) {
                PET_LIST = scannedPets;
                localStorage.setItem(CACHE_KEY, JSON.stringify(PET_LIST)); // 保存到本地缓存
            }
        } catch(e) {
            console.log("⚠️ 网络更新失败，已回退到本地缓存列表");
        }
    }

    // 4. 启动
    setTimeout(() => {
        // 读取上次缓存的列表
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try { PET_LIST = JSON.parse(cached); } catch(e){}
        }

        // 立刻画按钮（0 毫秒）
        createUI();
        
        // 唤醒宠物
        window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));

        // 启动网络更新（在后台默默跑，绝不会卡你的 yindex 插件）
        updateList();
    }, 2000);

})();
