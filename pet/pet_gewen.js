// ==UserScript==
// @name         3D 格温宠物 (纯净待机版 - 防缓存)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      7.0.0
// ==/UserScript==

(function () {
    'use strict';

    const CDN_BASE = 'https://cdn.jsdmirror.com/gh/a1417091141/LOLjs@main';
    
    const CONF = {
        name: 'gewen',
        // 🚨 核心：加了 ?v=2 强制打破 CDN 缓存，拉取最新的模型
        url: `${CDN_BASE}/pet/gewen.glb?v=2`,
        idle: 'idle_base',
        run: 'run'
    };

    let container = null;
    let scene, camera, renderer, mixer, clock;
    let petModel = null; 
    let actions = {};
    let currentAction = null;
    
    let isDragging = false;
    let isRotating = false;
    let prevMouseX = 0, prevMouseY = 0;
    
    let targetRotationX = 0, targetRotationY = 0;
    let currentRotationX = 0, currentRotationY = 0;

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

    async function initEngine() {
        // 防止重复初始化
        if (document.getElementById('three-pet-container')) return;

        await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');

        const THREE = window.THREE;

        container = document.createElement('div');
        container.id = 'three-pet-container';
        container.style.cssText = `
            position: fixed; bottom: 50px; right: 50px; 
            width: 350px; height: 400px;
            z-index: 9999; pointer-events: auto; cursor: grab;
        `;
        document.body.appendChild(container);

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(45, 350 / 400, 0.1, 1000);
        
        // 适配格温的远距离镜头
        camera.position.set(0, 1.0, 8.5); 

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(350, 400);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        if(THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 6)); 
        const dirLight = new THREE.DirectionalLight(0xffffff, 5);
        dirLight.position.set(5, 10, 7); scene.add(dirLight);
        const fillLight = new THREE.DirectionalLight(0xffffff, 3);
        fillLight.position.set(-5, 5, -5); scene.add(fillLight);

        clock = new THREE.Clock();
        
        setupInteractions(THREE);
        loadPet();
        animate(THREE);
    }

    function loadPet() {
        const THREE = window.THREE;
        const loader = new THREE.GLTFLoader();

        loader.load(CONF.url, (gltf) => {
            if (petModel) {
                scene.remove(petModel.parent);
            }
            if (mixer) mixer.stopAllAction();
            actions = {};
            currentAction = null;

            petModel = gltf.scene;
            
            const box = new THREE.Box3().setFromObject(petModel);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            petModel.position.sub(center); 
            
            // 缩放适配
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 3.5 / maxDim; 
            petModel.scale.set(scale, scale, scale);
            
            const scaledBox = new THREE.Box3().setFromObject(petModel);
            petModel.position.y -= scaledBox.min.y; 

            petModel.traverse((child) => {
                if (child.isMesh && child.material) child.material.metalness = 0.1; 
            });

            const modelGroup = new THREE.Group();
            modelGroup.add(petModel);
            scene.add(modelGroup);

            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(petModel);
                gltf.animations.forEach(clip => {
                    actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
                });
                
                playAction(CONF.idle);
            }
        }, undefined, (error) => {
            console.error(`[Pet] ${CONF.name} 加载失败:`, error);
        });
    }

    function playAction(actionName, loop = true) {
        const actualKey = Object.keys(actions).find(n => n === actionName) || 
                          Object.keys(actions).find(n => n.includes(actionName));
                          
        if (!actualKey) return;
        
        const newAction = actions[actualKey];
        if (currentAction === newAction) return; 

        if (currentAction) currentAction.fadeOut(0.2);
        newAction.reset().fadeIn(0.2);
        newAction.setLoop(loop ? window.THREE.LoopRepeat : window.THREE.LoopOnce);
        if(!loop) newAction.clampWhenFinished = true;
        newAction.play();
        currentAction = newAction;
    }

    function setupInteractions(THREE) {
        container.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (e.button === 0) {
                isDragging = true; 
                container.style.cursor = 'grabbing';
                prevMouseX = e.clientX; 
                prevMouseY = e.clientY;
                
                const rect = container.getBoundingClientRect();
                container.style.bottom = 'auto'; 
                container.style.right = 'auto';
                container.style.left = rect.left + 'px'; 
                container.style.top = rect.top + 'px';
            } else if (e.button === 2) {
                isRotating = true; 
                container.style.cursor = 'move';
                prevMouseX = e.clientX; 
                prevMouseY = e.clientY;
            }
        });

        container.addEventListener('contextmenu', e => e.preventDefault());

        window.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - prevMouseX; 
                const dy = e.clientY - prevMouseY;
                prevMouseX = e.clientX; 
                prevMouseY = e.clientY;
                
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
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false; 
                container.style.cursor = 'grab';
                playAction(CONF.idle);
            }
            isRotating = false;
        });

        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) camera.position.z -= 0.2; 
            else camera.position.z += 0.2;
            camera.position.z = Math.max(4, Math.min(12, camera.position.z));
        }, { passive: false });
    }

    let lastRenderTime = 0;
    function animate(THREE) {
        window.currentAnimFrameId = requestAnimationFrame(() => animate(THREE));
        const time = performance.now();
        if (time - lastRenderTime < 33) return; 
        lastRenderTime = time;

        const delta = clock.getDelta();
        if (mixer) mixer.update(delta);

        if (petModel && petModel.parent) {
            currentRotationX += (targetRotationX - currentRotationX) * 0.1;
            currentRotationY += (targetRotationY - currentRotationY) * 0.1;
            petModel.parent.rotation.x = currentRotationX;
            petModel.parent.rotation.y = currentRotationY;
        }
        renderer.render(scene, camera);
    }

    window.stopPetAnimation = function() {
        if (window.currentAnimFrameId) cancelAnimationFrame(window.currentAnimFrameId);
    };

    // ==========================================
    // 🚨 核心：主动加载 + 严格防重 + 监听广播
    // ==========================================
    function safeStart() {
        // 如果场上已经有模型了（不管是自己还是别人），直接退出
        if (document.getElementById('three-pet-container')) return;
        initEngine();
    }

    // 1. 监听管理器发来的切换指令
    window.addEventListener('spawn_pet', function(e) {
        if (e.detail === CONF.name) {
            safeStart();
        }
    });

    // 2. 默认主动加载（如果是上次记住的宠物，或者没有记录）
    const savedPet = localStorage.getItem('pet_current_model');
    if (!savedPet || savedPet === CONF.name) {
        // 延迟 3 秒等客户端 UI 加载完，直接自己蹦出来
        setTimeout(safeStart, 3000);
    }

})();
