// ==UserScript==
// @name         3D 格温宠物 (纯净互动版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      16.0.0
// ==/UserScript==

(function () {
    'use strict';

    const CDN_BASE = 'https://cdn.jsdmirror.com/gh/a1417091141/LOLjs@main';
    const CONF = { name: 'gewen', url: `${CDN_BASE}/pet/gewen1.glb?v=3`, idle: 'idle_base', run: 'run' };

    let container = null, scene, camera, renderer, mixer, clock;
    let petModel = null, actions = {}, currentAction = null, modelGroup = null;
    let ambientLight = null, dirLight = null;
    let isDragging = false, isRotating = false, dragDistance = 0;
    let prevMouseX = 0, prevMouseY = 0, targetRotationX = 0, targetRotationY = 0, currentRotationX = 0, currentRotationY = 0;
    let idleTimer = null; 

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (window.THREE && window.THREE.GLTFLoader) return resolve();
            const script = document.createElement('script');
            script.src = src; script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
        });
    }

    async function initEngine() {
        if (document.getElementById('three-pet-container')) return;
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');

        const THREE = window.THREE;
        const cfg = window.petConfig || { scale: 3.5, cameraZ: 8.5, ambientLight: 6, dirLight: 5, brightness: 1, hueRotate: 0, posX: 0, posY: 0 };

        container = document.createElement('div');
        container.id = 'three-pet-container';
        container.style.cssText = `position: fixed; bottom: 50px; right: 50px; width: 350px; height: 400px; z-index: 9999; pointer-events: auto; cursor: grab;`;
        document.body.appendChild(container);

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(45, 350 / 400, 0.1, 1000);
        camera.position.set(0, 1.0, cfg.cameraZ); 

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(350, 400); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        if(THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(renderer.domElement);

        ambientLight = new THREE.AmbientLight(0xffffff, cfg.ambientLight); scene.add(ambientLight); 
        dirLight = new THREE.DirectionalLight(0xffffff, cfg.dirLight); dirLight.position.set(5, 10, 7); scene.add(dirLight);
        const fillLight = new THREE.DirectionalLight(0xffffff, 3); fillLight.position.set(-5, 5, -5); scene.add(fillLight);

        clock = new THREE.Clock();
        setupInteractions(THREE);
        loadPet();
        animate(THREE);

        window.updatePetConfig = function() {
            if (!camera || !modelGroup) return;
            const currentCfg = window.petConfig;
            camera.position.z = currentCfg.cameraZ;
            modelGroup.position.set(currentCfg.posX, currentCfg.posY, 0);
            modelGroup.scale.set(currentCfg.scale, currentCfg.scale, currentCfg.scale);
            if (ambientLight) ambientLight.intensity = currentCfg.ambientLight;
            if (dirLight) dirLight.intensity = currentCfg.dirLight;
            if (renderer) renderer.domElement.style.filter = `brightness(${currentCfg.brightness}) hue-rotate(${currentCfg.hueRotate}deg)`;
        };
        renderer.domElement.style.filter = `brightness(${cfg.brightness}) hue-rotate(${cfg.hueRotate}deg)`;
    }

    function loadPet() {
        const THREE = window.THREE;
        const loader = new THREE.GLTFLoader();
        loader.load(CONF.url, (gltf) => {
            if (petModel) scene.remove(petModel.parent);
            if (mixer) mixer.stopAllAction();
            actions = {}; currentAction = null;
            petModel = gltf.scene;

            const box = new THREE.Box3().setFromObject(petModel);
            const size = box.getSize(new THREE.Vector3());
            petModel.position.sub(box.getCenter(new THREE.Vector3())); 
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const baseScale = 1 / maxDim; 
            petModel.scale.set(baseScale, baseScale, baseScale);
            petModel.position.y -= new THREE.Box3().setFromObject(petModel).min.y; 

            petModel.traverse((child) => { if (child.isMesh && child.material) child.material.metalness = 0.1; });

            modelGroup = new THREE.Group(); modelGroup.add(petModel); scene.add(modelGroup);

            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(petModel);
                gltf.animations.forEach(clip => actions[clip.name.toLowerCase()] = mixer.clipAction(clip));
                playAction(CONF.idle);
                startIdleEasterEgg(); 
            }
            if(window.petConfig) {
                modelGroup.scale.set(window.petConfig.scale, window.petConfig.scale, window.petConfig.scale);
                modelGroup.position.set(window.petConfig.posX, window.petConfig.posY, 0);
            }
        });
    }

    function playAction(actionName, loop = true) {
        if (!actions) return;
        const actualKey = Object.keys(actions).find(n => n === actionName) || Object.keys(actions).find(n => n.includes(actionName));
        if (!actualKey) return;
        const newAction = actions[actualKey];
        if (currentAction === newAction) return; 

        if (currentAction) currentAction.fadeOut(0.2);
        newAction.reset().fadeIn(0.2).setLoop(loop ? window.THREE.LoopRepeat : window.THREE.LoopOnce);
        if(!loop) newAction.clampWhenFinished = true;
        newAction.play(); currentAction = newAction;
    }

    function startIdleEasterEgg() {
        if (idleTimer) clearInterval(idleTimer);
        idleTimer = setInterval(() => {
            if (isDragging || isRotating || !currentAction) return;
            if (currentAction._clip.name.toLowerCase().includes(CONF.idle)) {
                const interactPool = ['laugh', 'taunt', 'joke', 'dance'];
                const availableEggs = Object.keys(actions).filter(name => interactPool.some(k => name.includes(k)));
                if (availableEggs.length > 0) {
                    playAction(availableEggs[Math.floor(Math.random() * availableEggs.length)], false);
                    setTimeout(() => { if (!isDragging) playAction(CONF.idle); }, 3500);
                }
            }
        }, 45000); 
    }

    function setupInteractions(THREE) {
        container.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (e.button === 0) {
                isDragging = true; dragDistance = 0; container.style.cursor = 'grabbing';
                prevMouseX = e.clientX; prevMouseY = e.clientY;
                const rect = container.getBoundingClientRect();
                container.style.bottom = 'auto'; container.style.right = 'auto';
                container.style.left = rect.left + 'px'; container.style.top = rect.top + 'px';
            } else if (e.button === 2) {
                isRotating = true; container.style.cursor = 'move';
                prevMouseX = e.clientX; prevMouseY = e.clientY;
            }
        });
        container.addEventListener('contextmenu', e => e.preventDefault());

        window.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - prevMouseX, dy = e.clientY - prevMouseY;
                prevMouseX = e.clientX; prevMouseY = e.clientY;
                dragDistance += Math.abs(dx) + Math.abs(dy);
                const rect = container.getBoundingClientRect();
                container.style.left = (rect.left + dx) + 'px'; container.style.top = (rect.top + dy) + 'px';
                if (dx > 2) targetRotationY = Math.PI / 2; else if (dx < -2) targetRotationY = -Math.PI / 2; 
                playAction(CONF.run);
            } else if (isRotating) {
                const dx = e.clientX - prevMouseX, dy = e.clientY - prevMouseY;
                prevMouseX = e.clientX; prevMouseY = e.clientY;
                targetRotationY += dx * 0.02; targetRotationX += dy * 0.02;
                targetRotationX = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, targetRotationX));
            }
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false; container.style.cursor = 'grab'; playAction(CONF.idle);
                if (dragDistance < 10) {
                    const availableAnims = Object.keys(actions).filter(name => ['laugh', 'taunt', 'joke', 'dance'].some(k => name.includes(k)));
                    if (availableAnims.length > 0) {
                        playAction(availableAnims[Math.floor(Math.random() * availableAnims.length)], false); 
                        setTimeout(() => { if (!isDragging) playAction(CONF.idle); }, 3500);
                    }
                }
            }
            isRotating = false;
        });

        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            camera.position.z += (e.deltaY < 0 ? -0.2 : 0.2);
            camera.position.z = Math.max(4, Math.min(12, camera.position.z));
        }, { passive: false });
    }

    let lastRenderTime = 0;
    function animate(THREE) {
        window.currentAnimFrameId = requestAnimationFrame(() => animate(THREE));
        if (performance.now() - lastRenderTime < 33) return; 
        lastRenderTime = performance.now();
        const delta = clock.getDelta();
        if (mixer) mixer.update(delta);
        if (petModel && petModel.parent) {
            currentRotationX += (targetRotationX - currentRotationX) * 0.1; currentRotationY += (targetRotationY - currentRotationY) * 0.1;
            petModel.parent.rotation.x = currentRotationX; petModel.parent.rotation.y = currentRotationY;
        }
        renderer.render(scene, camera);
    }

    window.stopPetAnimation = function() {
        if (window.currentAnimFrameId) cancelAnimationFrame(window.currentAnimFrameId);
        if (idleTimer) clearInterval(idleTimer);
    };

    function safeStart() { if (!document.getElementById('three-pet-container')) initEngine(); }
    window.addEventListener('spawn_pet', e => { if (e.detail === CONF.name) safeStart(); });
    if (!localStorage.getItem('pet_current_model') || localStorage.getItem('pet_current_model') === CONF.name) setTimeout(safeStart, 3000);
})();
