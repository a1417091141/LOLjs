// ==PenguLoader==
// @name         海克斯核心 - 宠物管理器 (总开关 + 自动守护版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      72.0.0
// ==/PenguLoader==

(function () {
    'use strict';

    const PET_LIST = [
        { id: 'yasuo', name: '亚索', avatar: '/lol-game-data/assets/v1/profile-icons/4073.jpg' },
        { id: 'gewen', name: '格温', avatar: '/lol-game-data/assets/v1/profile-icons/5959.jpg' }
    ];

    let globalEnabled = DataStore.get('pet_global_enabled', true);
    let currentPetKey = DataStore.get('pet_current_model', 'yasuo');

    let allPetConfigs = DataStore.get('pet_all_configs', {});
    if (!allPetConfigs || typeof allPetConfigs !== 'object') allPetConfigs = {};

    PET_LIST.forEach(pet => {
        if (!allPetConfigs[pet.id]) {
            allPetConfigs[pet.id] = {
                scale: 3.5, posX: 0, posY: 0, cameraY: 2.0, cameraZ: 8.5,
                ambientLight: 6, dirLight: 5, brightness: 1.0, hueRotate: 0,
                fps: 30
            };
        }
        const keys = ['scale', 'posX', 'posY', 'cameraY', 'cameraZ', 'ambientLight', 'dirLight', 'brightness', 'hueRotate', 'fps'];
        keys.forEach(k => { if (allPetConfigs[pet.id][k] === undefined) allPetConfigs[pet.id][k] = (k === 'fps' ? 30 : 0); });
    });

    window.allPetConfigs = allPetConfigs;
    window.petConfig = window.allPetConfigs[currentPetKey];

    window.__petContainers = window.__petContainers || {};
    window.petHooks = window.petHooks || {};
    window.__petDestroy = window.__petDestroy || {};

    function isClientReady() {
        return !!document.querySelector('.bug-report-button-always-top');
    }

    function saveConfig() {
        DataStore.set('pet_all_configs', window.allPetConfigs);
        DataStore.set('pet_current_model', currentPetKey);
        DataStore.set('pet_global_enabled', globalEnabled);
    }

    // ============================================================
    // 唯一权威规则：容器可见 = globalEnabled && (容器归属 == currentPetKey)
    // 容器被 DOM 重建顶掉时，自动补 spawn（仅总闸开 + 客户端就绪时）
    // ============================================================
    let forceApplyTimer = null;
    function scheduleForceApply() {
        if (forceApplyTimer) return;
        forceApplyTimer = setTimeout(() => {
            forceApplyTimer = null;
            forceApplyConfig();
        }, 50);
    }

    function forceApplyConfig() {
        // 1) 应用当前宠物配置
        const hook = window.petHooks && window.petHooks[currentPetKey];
        if (hook && hook.update) { try { hook.update(); } catch (e) {} }
        else if (window.updatePetConfig) { try { window.updatePetConfig(); } catch (e) {} }

        // 2) 遍历注册容器，统一显隐；丢失则标记重建
        const reg = window.__petContainers || {};
        let needRespawn = false;
        Object.keys(reg).forEach(name => {
            const c = reg[name];
            if (!c || !c.parentNode) {
                delete reg[name];
                if (name === currentPetKey) needRespawn = true;
                return;
            }
            const visible = globalEnabled && (name === currentPetKey);
            c.style.display = visible ? 'block' : 'none';
        });

        // 3) 兜底：DOM 中未注册残留
        document.querySelectorAll('#three-pet-container').forEach(c => {
            const name = c.dataset.pet;
            const registered = name && reg[name] === c;
            if (!registered) {
                if (!globalEnabled) c.style.display = 'none';
                else c.remove();
            }
        });

        // 4) 当前宠物容器丢失 + 总闸开 + 客户端就绪 → 自动重建
        if (globalEnabled && needRespawn && isClientReady()) {
            window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
            setTimeout(() => {
                const c2 = (window.__petContainers || {})[currentPetKey];
                if (c2 && c2.parentNode) c2.style.display = globalEnabled ? 'block' : 'none';
            }, 800);
        }

        updateButtonVisualState(globalEnabled);
    }

    function stopCurrentPetAnim() {
        const hook = window.petHooks && window.petHooks[currentPetKey];
        if (hook && hook.stop) { try { hook.stop(); } catch (e) {} }
        else if (window.stopPetAnimation) { try { window.stopPetAnimation(); } catch (e) {} }
    }

    function destroyAllPets(exceptKey) {
        const reg = window.__petContainers || {};
        Object.keys(reg).forEach(name => {
            if (exceptKey && name === exceptKey) return;
            if (window.__petDestroy && window.__petDestroy[name]) {
                try { window.__petDestroy[name](); } catch (e) {}
            } else {
                const c = reg[name];
                if (c && c.parentNode) c.remove();
            }
            delete reg[name];
        });
        document.querySelectorAll('#three-pet-container').forEach(c => {
            if (exceptKey && c.dataset.pet === exceptKey) return;
            c.remove();
        });
    }

    function waitForCurrentPet(callback, maxTries = 40) {
        let tries = 0;
        const timer = setInterval(() => {
            const reg = window.__petContainers || {};
            const c = reg[currentPetKey];
            if (c && c.parentNode) {
                clearInterval(timer);
                callback();
            } else if (++tries >= maxTries) {
                clearInterval(timer);
                callback();
            }
        }, 100);
    }

    function switchPet(nextKey) {
        if (nextKey === currentPetKey) return;

        stopCurrentPetAnim();
        destroyAllPets(null);

        currentPetKey = nextKey;
        window.petConfig = window.allPetConfigs[currentPetKey];
        saveConfig();

        if (globalEnabled && isClientReady()) {
            window.dispatchEvent(new CustomEvent('spawn_pet', { detail: nextKey }));
        }

        const oldBtn = document.getElementById('pet-manager-btn');
        if (oldBtn) oldBtn.remove();
        injectBtn();

        waitForCurrentPet(() => forceApplyConfig());
    }

    // ============================================================
    // 设置面板
    // ============================================================
    function createPanel() {
        if (document.getElementById('pet-settings-panel')) return;

        const overlay = document.createElement('div');
        overlay.id = 'pet-settings-panel';
        overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); z-index: 2147483646; display: none; align-items: center; justify-content: center;`;

        const panel = document.createElement('div');
        panel.style.cssText = `background: #1e2328; border: 2px solid #785A28; border-radius: 4px; width: 380px; max-height: 85vh; padding: 20px; box-shadow: 0 0 20px rgba(0,0,0,0.8); font-family: 'Friz Quadrata', Arial, sans-serif; color: #A09B8C; overflow-y: auto;`;

        const createSlider = (id, label, min, max, step, val) => `
            <div style="margin-bottom: 10px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:12px;">
                    <span>${label}</span><span id="val-${id}">${val}</span>
                </div>
                <input type="range" id="slider-${id}" min="${min}" max="${max}" step="${step}" value="${val}" style="width:100%; cursor:pointer;">
            </div>
        `;

        let avatarHtml = `<div style="display:flex; gap:15px; justify-content:center; margin-bottom:20px;">`;
        PET_LIST.forEach(pet => {
            const isActive = currentPetKey === pet.id;
            avatarHtml += `
                <div class="pet-avatar-btn" data-pet="${pet.id}" style="display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: all 0.2s; opacity: ${isActive ? '1' : '0.4'};">
                    <div style="width: 44px; height: 44px; border-radius: 50%; background: url('${pet.avatar}') center/cover; border: 2px solid ${isActive ? '#C8AA6E' : '#3c3c41'}; box-shadow: ${isActive ? '0 0 12px rgba(200,170,110,0.9)' : 'none'}; transition: all 0.2s;"></div>
                    <div style="margin-top: 5px; font-size: 12px; font-weight: bold; color: ${isActive ? '#C8AA6E' : '#A09B8C'};">${pet.name}</div>
                </div>
            `;
        });
        avatarHtml += `</div>`;

        const switchColor = globalEnabled ? '#C8AA6E' : '#3c3c41';
        const switchKnobLeft = globalEnabled ? '18px' : '2px';

        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #3c3c41; padding-bottom:10px;">
                <h2 style="color:#F0E6D2; font-size:18px; margin:0;">3D 宠物设置</h2>
                <span id="close-pet-panel" style="cursor:pointer; color:#C8AA6E; font-size:16px;">✕</span>
            </div>
            ${avatarHtml}
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding: 10px; background: #111; border: 1px solid #3c3c41; border-radius: 4px;">
                <span style="font-size:14px; font-weight:bold; color:#F0E6D2;">启用 3D 宠物功能</span>
                <div id="pet-toggle-switch" style="width: 36px; height: 20px; background: ${switchColor}; border-radius: 10px; position: relative; cursor: pointer; transition: all 0.3s;">
                    <div style="width: 16px; height: 16px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: ${switchKnobLeft}; transition: all 0.3s;"></div>
                </div>
            </div>

            <div style="font-size:11px; color:#C8AA6E; margin-bottom:8px; margin-top:15px;">▶ 基础位置与大小</div>
            ${createSlider('scale', '模型大小', 1, 10, 0.1, window.petConfig.scale)}
            ${createSlider('posX', 'X轴偏移 (左右)', -5, 5, 0.1, window.petConfig.posX)}
            ${createSlider('posY', 'Y轴偏移 (上下)', -3, 5, 0.1, window.petConfig.posY)}
            ${createSlider('cameraY', '相机高度', 0, 5, 0.1, window.petConfig.cameraY)}
            ${createSlider('cameraZ', '相机距离', 3, 15, 0.5, window.petConfig.cameraZ)}
            
            <div style="font-size:11px; color:#C8AA6E; margin-bottom:8px; margin-top:15px;">▶ 光影与特效</div>
            ${createSlider('ambientLight', '环境光强度', 0, 15, 0.5, window.petConfig.ambientLight)}
            ${createSlider('dirLight', '平行光强度', 0, 15, 0.5, window.petConfig.dirLight)}
            ${createSlider('brightness', '模型亮度', 0.5, 2.0, 0.1, window.petConfig.brightness)}
            ${createSlider('hueRotate', '色调旋转 (变色)', 0, 360, 10, window.petConfig.hueRotate)}
            
            <div style="font-size:11px; color:#C8AA6E; margin-bottom:8px; margin-top:15px;">▶ 性能设置</div>
            ${createSlider('fps', '限制帧率 (FPS)', 15, 60, 1, window.petConfig.fps)}
            
            <button id="reset-pet-settings" style="width:100%; margin-top:15px; padding:10px; background:#3c3c41; color:#C8AA6E; border:1px solid #785A28; border-radius:4px; cursor:pointer; font-weight:bold; transition:background 0.2s;">恢复当前宠物默认参数</button>
        `;

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        document.getElementById('close-pet-panel').onclick = () => overlay.style.display = 'none';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };

        const toggleBtn = document.getElementById('pet-toggle-switch');
        const toggleKnob = toggleBtn.querySelector('div');
        toggleBtn.onclick = () => {
            globalEnabled = !globalEnabled;
            saveConfig();
            toggleBtn.style.background = globalEnabled ? '#C8AA6E' : '#3c3c41';
            toggleKnob.style.left = globalEnabled ? '18px' : '2px';

            if (globalEnabled) {
                const reg = window.__petContainers || {};
                const existing = reg[currentPetKey];
                if ((!existing || !existing.parentNode) && isClientReady()) {
                    destroyAllPets(null);
                    window.dispatchEvent(new CustomEvent('spawn_pet', { detail: currentPetKey }));
                    waitForCurrentPet(() => forceApplyConfig());
                } else {
                    forceApplyConfig();
                }
            } else {
                stopCurrentPetAnim();
                destroyAllPets(null);
                forceApplyConfig();
            }
        };

        const bindSlider = (id, key) => {
            const slider = document.getElementById(`slider-${id}`);
            const valDisplay = document.getElementById(`val-${id}`);
            if (!slider) return;
            slider.oninput = (e) => {
                const val = parseFloat(e.target.value);
                valDisplay.innerText = val;
                window.petConfig[key] = val;
                const hook = window.petHooks && window.petHooks[currentPetKey];
                if (hook && hook.update) { try { hook.update(); } catch (err) {} }
                else if (window.updatePetConfig) { try { window.updatePetConfig(); } catch (err) {} }
                saveConfig();
            };
        };
        ['scale', 'posX', 'posY', 'cameraY', 'cameraZ', 'ambientLight', 'dirLight', 'brightness', 'hueRotate', 'fps'].forEach(key => bindSlider(key, key));

        document.querySelectorAll('.pet-avatar-btn').forEach(btn => {
            btn.onclick = () => {
                const petId = btn.dataset.pet;
                if (petId === currentPetKey) return;
                switchPet(petId);
                overlay.style.display = 'none';
                document.getElementById('pet-settings-panel').remove();
                createPanel();
                document.getElementById('pet-settings-panel').style.display = 'flex';
            };
        });

        document.getElementById('reset-pet-settings').onclick = () => {
            window.petConfig = {
                scale: 3.5, posX: 0, posY: 0, cameraY: 2.0, cameraZ: 8.5,
                ambientLight: 6, dirLight: 5, brightness: 1.0, hueRotate: 0,
                fps: 30
            };
            window.allPetConfigs[currentPetKey] = window.petConfig;
            saveConfig();

            const hook = window.petHooks && window.petHooks[currentPetKey];
            if (hook && hook.update) { try { hook.update(); } catch (e) {} }
            else if (window.updatePetConfig) { try { window.updatePetConfig(); } catch (e) {} }

            forceApplyConfig();

            const oldBtn = document.getElementById('pet-manager-btn');
            if (oldBtn) oldBtn.remove();
            injectBtn();

            overlay.style.display = 'none';
            document.getElementById('pet-settings-panel').remove();
            createPanel();
            document.getElementById('pet-settings-panel').style.display = 'flex';
        };
    }

    // ============================================================
    // 按钮
    // ============================================================
    function updateButtonVisualState(isEnabled) {
        const petBtn = document.getElementById('pet-manager-btn');
        if (!petBtn) return;
        const img = petBtn.querySelector('img');
        if (!img) return;

        if (isEnabled) {
            img.style.filter = 'none';
            petBtn.style.borderColor = '#C8AA6E';
            petBtn.style.opacity = '1';
        } else {
            img.style.filter = 'grayscale(100%) brightness(0.6)';
            petBtn.style.borderColor = '#555';
            petBtn.style.opacity = '0.7';
        }
    }

    function injectBtn() {
        if (document.getElementById('pet-manager-btn')) return;

        const bugBtn = document.querySelector('.bug-report-button-always-top');
        if (!bugBtn) return;

        const currentPet = PET_LIST.find(p => p.id === currentPetKey);
        const avatarUrl = currentPet ? currentPet.avatar : PET_LIST[0].avatar;

        const btn = document.createElement('button');
        btn.id = 'pet-manager-btn';

        btn.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 30px;
            margin-right: 8px;
            background: rgba(10, 15, 20, 0.8);
            border: 1px solid #785A28;
            border-radius: 2px;
            cursor: pointer;
            padding: 0;
            outline: none;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
        `;

        const img = document.createElement('img');
        img.src = avatarUrl;
        img.style.cssText = `width: 100%; height: 100%; object-fit: cover; pointer-events: none;`;
        btn.appendChild(img);

        updateButtonVisualState(globalEnabled);

        btn.onmouseenter = () => { if (globalEnabled) btn.style.borderColor = '#C8AA6E'; };
        btn.onmouseleave = () => { if (globalEnabled) btn.style.borderColor = '#785A28'; };

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const panel = document.getElementById('pet-settings-panel');
                if (panel) {
                    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
                } else {
                    createPanel();
                    document.getElementById('pet-settings-panel').style.display = 'flex';
                }
            } catch (err) {
                console.error("面板打开失败:", err);
            }
        };

        bugBtn.parentNode.insertBefore(btn, bugBtn);

        // 不派发 spawn_pet，仅同步显隐
        forceApplyConfig();
    }

    // ============================================================
    // 初始化
    // ============================================================
    const init = () => {
        injectBtn();

        if (!isClientReady()) {
            setTimeout(init, 500);
        } else {
            if (!window.petObserver) {
                window.petObserver = new MutationObserver(() => {
                    injectBtn();
                    updateButtonVisualState(globalEnabled);
                    scheduleForceApply();   // 防抖校准，DOM 重建后自动补宠物
                });
                if (document.body) {
                    window.petObserver.observe(document.body, { childList: true, subtree: true });
                }
            }
            forceApplyConfig();
            setTimeout(forceApplyConfig, 1000);
            setTimeout(forceApplyConfig, 3000);   // 大厅重建常在 2~3 秒后
        }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    setInterval(injectBtn, 1000);
})();
