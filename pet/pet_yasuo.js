// ==UserScript==
// @name         3D 亚索宠物 (双重防穿透无特效版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      22.11.0
// ==/UserScript==

(function () {
    'use strict';

    const CDN_BASE = 'https://cdn.jsdmirror.com/gh/a1417091141/LOLjs@main';

    const CONF = {
        name: 'yasuo',
        url: `${CDN_BASE}/pet/yasuo.glb?v=2`,
        idle: 'idle_base',
        run: 'run_base'
    };

    let container = null;
    let scene, camera, renderer, mixer, clock;
    let petModel = null;
    let actions = {};
    let currentAction = null;
    let modelGroup = null;
    let ambientLight = null;
    let dirLight = null;
    let raycaster, mouse;

    let isDragging = false;
    let isRotating = false;
    let prevMouseX = 0, prevMouseY = 0;
    let dragDistance = 0;

    let targetRotationX = 0, targetRotationY = 0;
    let currentRotationX = 0, currentRotationY = 0;

    let idleTimer = null;
    let animFrameId = null;
    let onMouseMoveHandler = null;
    let onMouseUpHandler = null;
    let onGlobalPointerMove = null;

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (window.THREE && window.THREE.GLTFLoader) return resolve();
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function isGlobalEnabled() {
        try { return DataStore.get('pet_global_enabled', true); } catch (e) { return true; }
    }

    function isClientReady() {
        return !!document.querySelector('.bug-report-button-always-top');
    }

    async function initEngine() {
        if (!isGlobalEnabled()) return;
        if (!isClientReady()) return;

        const existing = document.getElementById('three-pet-container');
        if (existing) {
            if (existing.dataset.pet === CONF.name) return;
            existing.remove();
        }

        await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');

        const THREE = window.THREE;

        let savedConfig = null;
        try {
            const allConfigs = DataStore.get('pet_all_configs', {});
            savedConfig = allConfigs[CONF.name];
        } catch (e) {}

        const cfg = savedConfig || { scale: 4.5, posX: 0, posY: 0, cameraY: 1.5, cameraZ: 6.5, ambientLight: 6, dirLight: 5, brightness: 1, hueRotate: 0, fps: 30 };

        const W = 350;
        const H = 400;

        container = document.createElement('div');
        container.id = 'three-pet-container';
        container.dataset.pet = CONF.name;
        container.style.cssText = `
            position: fixed; bottom: 50px; right: 50px; 
            width: ${W}px; height: ${H}px;
            z-index: 9999; 
            pointer-events: none; /* 默认容器穿透 */
        `;
        document.body.appendChild(container);

        window.__petContainers = window.__petContainers || {};
        window.__petContainers[CONF.name] = container;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
        camera.position.set(0, cfg.cameraY, cfg.cameraZ);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.domElement.style.filter = `brightness(${cfg.brightness}) hue-rotate(${cfg.hueRotate}deg)`;
        renderer.domElement.style.pointerEvents = 'none';
        
        container.appendChild(renderer.domElement);

        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        ambientLight = new THREE.AmbientLight(0xffffff, cfg.ambientLight);
        scene.add(ambientLight);

        dirLight = new THREE.DirectionalLight(0xffffff, cfg.dirLight);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 3);
        fillLight.position.set(-5, 5, -5);
        scene.add(fillLight);

        clock = new THREE.Clock();

        setupInteractions(THREE);
        loadPet();
        animate(THREE);

        container.style.display = isGlobalEnabled() ? 'block' : 'none';

        window.petHooks = window.petHooks || {};
        window.petHooks[CONF.name] = {
            update: function () {
                if (!camera || !modelGroup) return;
                let currentCfg = window.petConfig;
                try {
                    const all = DataStore.get('pet_all_configs', {});
                    if (all[CONF.name]) currentCfg = all[CONF.name];
                } catch (e) {}

                camera.position.y = currentCfg.cameraY;
                camera.position.z = currentCfg.cameraZ;
                modelGroup.position.set(currentCfg.posX, currentCfg.posY, 0);
                modelGroup.scale.set(currentCfg.scale, currentCfg.scale, currentCfg.scale);

                if (ambientLight) ambientLight.intensity = currentCfg.ambientLight;
                if (dirLight) dirLight.intensity = currentCfg.dirLight;

                if (renderer) {
                    renderer.domElement.style.filter = `brightness(${currentCfg.brightness}) hue-rotate(${currentCfg.hueRotate}deg)`;
                }
            },
            stop: function () {
                if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
                if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
            }
        };

        window.updatePetConfig = window.petHooks[CONF.name].update;
        window.stopPetAnimation = window.petHooks[CONF.name].stop;

        window.__petDestroy = window.__petDestroy || {};
        window.__petDestroy[CONF.name] = function () {
            if (window.petHooks && window.petHooks[CONF.name]) {
                try { window.petHooks[CONF.name].stop(); } catch (e) {}
            }
            if (onMouseMoveHandler) window.removeEventListener('mousemove', onMouseMoveHandler);
            if (onMouseUpHandler) window.removeEventListener('mouseup', onMouseUpHandler);
            if (onGlobalPointerMove) window.removeEventListener('mousemove', onGlobalPointerMove);
            if (container && container.parentNode) container.parentNode.removeChild(container);
            if (window.__petContainers) delete window.__petContainers[CONF.name];
            if (renderer) { try { renderer.dispose(); } catch (e) {} renderer = null; }
            if (mixer) { try { mixer.stopAllAction(); } catch (e) {} mixer = null; }
            petModel = null;
            modelGroup = null;
            container = null;
        };
    }

    function loadPet() {
        const THREE = window.THREE;
        const loader = new THREE.GLTFLoader();

        loader.load(CONF.url, (gltf) => {
            if (petModel) scene.remove(petModel.parent);
            if (mixer) mixer.stopAllAction();
            actions = {};
            currentAction = null;

            petModel = gltf.scene;

            const box = new THREE.Box3().setFromObject(petModel);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            petModel.position.sub(center);

            const maxDim = Math.max(size.x, size.y, size.z);
            const baseScale = 1 / maxDim;
            petModel.scale.set(baseScale, baseScale, baseScale);

            const scaledBox = new THREE.Box3().setFromObject(petModel);
            petModel.position.y -= scaledBox.min.y;

            petModel.traverse((child) => {
                if (child.isMesh && child.material) child.material.metalness = 0.1;
            });

            modelGroup = new THREE.Group();
            modelGroup.add(petModel);
            scene.add(modelGroup);

            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(petModel);
                gltf.animations.forEach(clip => {
                    actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
                });

                const cfg = window.petConfig || {};
                const actualIdle = cfg.idleAnim || CONF.idle;
                playAction(actualIdle);

                startIdleEasterEgg();
            }

            let savedCfg = window.petConfig;
            try {
                const all = DataStore.get('pet_all_configs', {});
                if (all[CONF.name]) savedCfg = all[CONF.name];
            } catch (e) {}

            if (savedCfg) {
                modelGroup.scale.set(savedCfg.scale, savedCfg.scale, savedCfg.scale);
                modelGroup.position.set(savedCfg.posX, savedCfg.posY, 0);
                if (camera) {
                    camera.position.y = savedCfg.cameraY || 1.5;
                    camera.position.z = savedCfg.cameraZ || 6.5;
                }
                if (ambientLight) ambientLight.intensity = savedCfg.ambientLight;
                if (dirLight) dirLight.intensity = savedCfg.dirLight;
                if (renderer) {
                    renderer.domElement.style.filter = `brightness(${savedCfg.brightness}) hue-rotate(${savedCfg.hueRotate}deg)`;
                }
            }
        }, undefined, (error) => {
            console.error(`[Pet] ${CONF.name} 加载失败:`, error);
        });
    }

    function playAction(actionName, loop = true) {
        if (!actions) return;
        const actualKey = Object.keys(actions).find(n => n === actionName) ||
                          Object.keys(actions).find(n => n.includes(actionName));
        if (!actualKey) return;

        const newAction = actions[actualKey];
        if (currentAction === newAction) return;

        if (currentAction) currentAction.fadeOut(0.2);
        newAction.reset().fadeIn(0.2);
        newAction.setLoop(loop ? window.THREE.LoopRepeat : window.THREE.LoopOnce);
        if (!loop) newAction.clampWhenFinished = true;
        newAction.play();
        currentAction = newAction;
    }

    function startIdleEasterEgg() {
        if (idleTimer) clearInterval(idleTimer);
        idleTimer = setInterval(() => {
            if (isDragging || isRotating || !currentAction) return;

            const cfg = window.petConfig || {};
            const actualIdle = cfg.idleAnim || CONF.idle;

            if (currentAction._clip.name.toLowerCase().includes(actualIdle)) {
                const interactPool = ['laugh', 'taunt', 'joke', 'dance', 'idle01', 'idle02'];
                const availableEggs = Object.keys(actions).filter(name =>
                    interactPool.some(k => name.includes(k))
                );

                if (availableEggs.length > 0) {
                    const randomEgg = availableEggs[Math.floor(Math.random() * availableEggs.length)];
                    playAction(randomEgg, false);
                    setTimeout(() => { if (!isDragging) playAction(actualIdle); }, 3500);
                }
            }
        }, 45000);
    }

    function setupInteractions(THREE) {
        onGlobalPointerMove = (e) => {
            if (isDragging || isRotating || !scene || !camera || !petModel) return;

            const rect = renderer.domElement.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom) {
                
                // 1. 精确网格射线检测
                mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(scene.children, true);

                let isOverModel = intersects.length > 0;

                // 2. 2D 中心距离二次判定（容错 110px 范围）
                if (!isOverModel && modelGroup) {
                    const vector = new THREE.Vector3();
                    modelGroup.getWorldPosition(vector);
                    vector.project(camera);

                    const modelScreenX = rect.left + (vector.x * .5 + .5) * rect.width;
                    const modelScreenY = rect.top + (-(vector.y * .5 + .5)) * rect.height;

                    const distance = Math.hypot(e.clientX - modelScreenX, e.clientY - modelScreenY);
                    if (distance < 110) {
                        isOverModel = true;
                    }
                }

                if (isOverModel) {
                    renderer.domElement.style.pointerEvents = 'auto';
                    renderer.domElement.style.cursor = 'grab';
                } else {
                    renderer.domElement.style.pointerEvents = 'none';
                }
            } else {
                renderer.domElement.style.pointerEvents = 'none';
            }
        };
        window.addEventListener('mousemove', onGlobalPointerMove);

        renderer.domElement.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (e.button === 0) {
                isDragging = true;
                dragDistance = 0;
                renderer.domElement.style.cursor = 'grabbing';
                prevMouseX = e.clientX;
                prevMouseY = e.clientY;

                const rect = container.getBoundingClientRect();
                container.style.bottom = 'auto';
                container.style.right = 'auto';
                container.style.left = rect.left + 'px';
                container.style.top = rect.top + 'px';
            } else if (e.button === 2) {
                isRotating = true;
                renderer.domElement.style.cursor = 'move';
                prevMouseX = e.clientX;
                prevMouseY = e.clientY;
            }
        });

        renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

        onMouseMoveHandler = (e) => {
            if (isDragging) {
                const dx = e.clientX - prevMouseX;
                const dy = e.clientY - prevMouseY;
                prevMouseX = e.clientX;
                prevMouseY = e.clientY;

                dragDistance += Math.abs(dx) + Math.abs(dy);

                const rect = container.getBoundingClientRect();
                container.style.left = (rect.left + dx) + 'px';
                container.style.top = (rect.top + dy) + 'px';

                if (dx > 2) targetRotationY = Math.PI / 2;
                else if (dx < -2) targetRotationY = -Math.PI / 2;

                playAction(CONF.run);
            } else if (isRotating) {
                const dx = e.clientX - prevMouseX;
                const dy = e.clientY - prevMouseY;
                prevMouseX = e.clientX;
                prevMouseY = e.clientY;

                targetRotationY += dx * 0.02;
                targetRotationX += dy * 0.02;
                targetRotationX = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, targetRotationX));
            }
        };

        onMouseUpHandler = () => {
            if (isDragging) {
                isDragging = false;
                renderer.domElement.style.cursor = 'grab';

                const cfg = window.petConfig || {};
                const actualIdle = cfg.idleAnim || CONF.idle;
                playAction(actualIdle);

                if (dragDistance < 10) {
                    const interactPool = ['laugh', 'taunt', 'joke', 'dance'];
                    const availableAnims = Object.keys(actions).filter(name =>
                        interactPool.some(k => name.includes(k))
                    );

                    if (availableAnims.length > 0) {
                        const randomAnim = availableAnims[Math.floor(Math.random() * availableAnims.length)];
                        playAction(randomAnim, false);
                        setTimeout(() => { if (!isDragging) playAction(actualIdle); }, 3500);
                    }
                }
            }
            isRotating = false;
        };

        window.addEventListener('mousemove', onMouseMoveHandler);
        window.addEventListener('mouseup', onMouseUpHandler);

        renderer.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) camera.position.z -= 0.2;
            else camera.position.z += 0.2;
            camera.position.z = Math.max(3, Math.min(10, camera.position.z));
        }, { passive: false });
    }

    let lastRenderTime = 0;
    function animate(THREE) {
        animFrameId = requestAnimationFrame(() => animate(THREE));

        let targetFps = 30;
        try {
            const all = DataStore.get('pet_all_configs', {});
            if (all[CONF.name] && all[CONF.name].fps) targetFps = all[CONF.name].fps;
        } catch (e) {}
        if (window.petConfig && window.petConfig.fps) targetFps = window.petConfig.fps;

        const frameInterval = 1000 / targetFps;
        const now = performance.now();
        if (now - lastRenderTime < frameInterval) return;
        lastRenderTime = now;

        const delta = clock.getDelta();
        if (mixer) mixer.update(delta);

        if (petModel && petModel.parent) {
            currentRotationX += (targetRotationX - currentRotationX) * 0.1;
            currentRotationY += (targetRotationY - currentRotationY) * 0.1;
            petModel.parent.rotation.x = currentRotationX;
            petModel.parent.rotation.y = currentRotationY;
        }

        if (renderer && scene && camera) renderer.render(scene, camera);
    }

    function safeStart() {
        if (!isGlobalEnabled()) return;
        if (!isClientReady()) return;
        const existing = document.getElementById('three-pet-container');
        if (existing && existing.dataset.pet === CONF.name) return;
        initEngine();
    }

    window.addEventListener('spawn_pet', function (e) {
        if (e.detail === CONF.name) {
            if (!isGlobalEnabled()) return;
            if (!isClientReady()) return;
            const old = document.getElementById('three-pet-container');
            if (old && old.dataset.pet !== CONF.name) old.remove();
            if (window.__petDestroy && window.__petDestroy[CONF.name]) {
                try { window.__petDestroy[CONF.name](); } catch (err) {}
            }
            safeStart();
        }
    });

    function waitClientReadyThenStart(maxTries = 120) {
        if (isClientReady()) {
            const savedPet = DataStore.get('pet_current_model', 'yasuo');
            if ((!savedPet || savedPet === CONF.name) && isGlobalEnabled()) {
                safeStart();
            }
            return;
        }
        if (maxTries <= 0) return;
        setTimeout(() => waitClientReadyThenStart(maxTries - 1), 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitClientReadyThenStart());
    } else {
        waitClientReadyThenStart();
    }

})();
