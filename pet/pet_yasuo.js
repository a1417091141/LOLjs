// ==UserScript==
// @name         3D 亚索宠物 (防误杀版)
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      20.0.0
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
    
    let isDragging = false;
    let isRotating = false;
    let prevMouseX = 0, prevMouseY = 0;
    let dragDistance = 0; 
    
    let targetRotationX = 0, targetRotationY = 0;
    let currentRotationX = 0, currentRotationY = 0;

    let idleTimer = null; 

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
        if (document.getElementById('three-pet-container')) return;

        await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');

        const THREE = window.THREE;
        
        let savedConfig = null;
        try {
            const allConfigs = DataStore.get('pet_all_configs', {});
            savedConfig = allConfigs[CONF.name];
        } catch (e) {}
        
        const cfg = savedConfig || { scale: 4.5, posX: 0, posY: 0, cameraY: 1.5, cameraZ: 6.5, ambientLight: 6, dirLight: 5, brightness: 1, hueRotate: 0, fps: 30 };

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
        camera.position.set(0, cfg.cameraY, cfg.cameraZ); 

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(350, 400);
        renderer.setPixelRatio(Math.min
