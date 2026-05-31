// ==UserScript==
// @name         贪吃蛇
// @namespace    pengu
// @match        https://riot:*
// @grant        none
// @version      3.3.2
// ==/UserScript==

(function () {
    'use strict';

    let canvas = null;
    let ctx = null;
    let toggleBtn = null;
    let enabled = false;
    let gameActive = false;
    let snakeInterval = null;
    let snake = [], food = {}, dir = { x: 1, y: 0 }, nextDir = { x: 1, y: 0 };
    let score = 0, highScore = 0;
    const GRID = 22;
    let particles = [];
    let hue = 140;

    function isInChampSelect() {
        return !!document.querySelector('.champ-select-container') 
            || !!document.querySelector('.champion-select')
            || !!document.querySelector('.ban-pick-container');
    }

    function createCanvas() {
        if (canvas) return;
        canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed;top:0;left:0;z-index:9999;pointer-events:none;';
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        ctx = canvas.getContext('2d');
        document.body.appendChild(canvas);
        window.addEventListener('resize', () => {
            if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        });
    }

    function removeCanvas() {
        if (canvas) { canvas.remove(); canvas = null; ctx = null; }
    }

    function spawnFood() {
        const cols = Math.floor(canvas.width / GRID);
        const rows = Math.floor(canvas.height / GRID);
        let fx, fy;
        do {
            fx = Math.floor(Math.random() * cols);
            fy = Math.floor(Math.random() * rows);
        } while (snake.some(s => s.x === fx && s.y === fy));
        food = { x: fx, y: fy, pulse: 0 };
    }

    function spawnParticle(x, y) {
        for (let i = 0; i < 5; i++) {
            particles.push({
                x: x * GRID + GRID/2,
                y: y * GRID + GRID/2,
                vx: (Math.random() - 0.5) * 3,
                vy: (Math.random() - 0.5) * 3,
                life: 1,
                size: Math.random() * 3 + 1,
                hue: hue
            });
        }
        hue = (hue + 15) % 360;
    }

    function updateParticles() {
        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.03;
        }
        particles = particles.filter(p => p.life > 0);
    }

    function drawParticles() {
        for (const p of particles) {
            ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.life})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function initGame() {
        snake = [];
        dir = { x: 1, y: 0 };
        nextDir = { x: 1, y: 0 };
        score = 0;
        hue = 140;
        particles = [];
        const sx = Math.floor(canvas.width / GRID / 2);
        const sy = Math.floor(canvas.height / GRID / 2);
        for (let i = 0; i < 5; i++) snake.push({ x: sx - i, y: sy });
        spawnFood();
        highScore = parseInt(localStorage.getItem('snake_high') || '0');
    }

    function update() {
        dir = nextDir;
        const cols = Math.floor(canvas.width / GRID);
        const rows = Math.floor(canvas.height / GRID);
        const h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (h.x < 0) h.x = cols - 1;
        if (h.x >= cols) h.x = 0;
        if (h.y < 0) h.y = rows - 1;
        if (h.y >= rows) h.y = 0;
        snake.unshift(h);
        if (h.x === food.x && h.y === food.y) {
            score += 10;
            spawnParticle(food.x, food.y);
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('snake_high', highScore);
            }
            spawnFood();
        } else {
            snake.pop();
        }
        for (let i = 1; i < snake.length; i++) {
            if (snake[i].x === h.x && snake[i].y === h.y) initGame();
        }
        food.pulse = (food.pulse || 0) + 0.1;
        updateParticles();
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 网格背景
        ctx.strokeStyle = 'rgba(255,255,255,0.02)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x < canvas.width; x += GRID) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += GRID) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        // 粒子
        drawParticles();

        // 蛇身
        for (let i = snake.length - 1; i >= 0; i--) {
            const s = snake[i];
            const t = i / snake.length;
            const alpha = 0.5 + t * 0.5;
            const size = GRID - 2 - t * 4;
            const offset = (GRID - size) / 2;
            const h = 140 + t * 40;

            // 身体
            ctx.fillStyle = `hsla(${h}, 70%, 50%, ${alpha})`;
            ctx.beginPath();
            ctx.roundRect(s.x * GRID + offset, s.y * GRID + offset, size, size, 4);
            ctx.fill();

            // 高光
            ctx.fillStyle = `rgba(255,255,255,${alpha * 0.2})`;
            ctx.beginPath();
            ctx.roundRect(s.x * GRID + offset + 2, s.y * GRID + offset + 2, size * 0.6, size * 0.3, 3);
            ctx.fill();

            // 蛇头
            if (i === 0) {
                ctx.fillStyle = `hsla(${h}, 80%, 60%, 1)`;
                ctx.beginPath();
                ctx.roundRect(s.x * GRID + 1, s.y * GRID + 1, GRID - 2, GRID - 2, 6);
                ctx.fill();

                // 眼睛
                const eyeSize = 5;
                const eyeOffset = 4;
                let ex1, ey1, ex2, ey2;
                if (dir.x === 1) {
                    ex1 = s.x * GRID + GRID - eyeOffset - eyeSize;
                    ey1 = s.y * GRID + eyeOffset;
                    ex2 = s.x * GRID + GRID - eyeOffset - eyeSize;
                    ey2 = s.y * GRID + GRID - eyeOffset - eyeSize;
                } else if (dir.x === -1) {
                    ex1 = s.x * GRID + eyeOffset;
                    ey1 = s.y * GRID + eyeOffset;
                    ex2 = s.x * GRID + eyeOffset;
                    ey2 = s.y * GRID + GRID - eyeOffset - eyeSize;
                } else if (dir.y === -1) {
                    ex1 = s.x * GRID + eyeOffset;
                    ey1 = s.y * GRID + eyeOffset;
                    ex2 = s.x * GRID + GRID - eyeOffset - eyeSize;
                    ey2 = s.y * GRID + eyeOffset;
                } else {
                    ex1 = s.x * GRID + eyeOffset;
                    ey1 = s.y * GRID + GRID - eyeOffset - eyeSize;
                    ex2 = s.x * GRID + GRID - eyeOffset - eyeSize;
                    ey2 = s.y * GRID + GRID - eyeOffset - eyeSize;
                }
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(ex1 + eyeSize/2, ey1 + eyeSize/2, eyeSize, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(ex2 + eyeSize/2, ey2 + eyeSize/2, eyeSize, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.arc(ex1 + eyeSize/2, ey1 + eyeSize/2, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(ex2 + eyeSize/2, ey2 + eyeSize/2, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 食物
        const fx = food.x * GRID + GRID/2;
        const fy = food.y * GRID + GRID/2;
        const pulse = 1 + Math.sin(food.pulse) * 0.2;
        const foodSize = GRID/2 * pulse;

        // 光晕
        const glow = ctx.createRadialGradient(fx, fy, foodSize * 0.5, fx, fy, foodSize * 2);
        glow.addColorStop(0, 'rgba(255, 80, 80, 0.5)');
        glow.addColorStop(1, 'rgba(255, 80, 80, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(fx, fy, foodSize * 2, 0, Math.PI * 2);
        ctx.fill();

        // 果实
        ctx.fillStyle = '#f44';
        ctx.beginPath();
        ctx.arc(fx, fy, foodSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f88';
        ctx.beginPath();
        ctx.arc(fx - foodSize * 0.2, fy - foodSize * 0.2, foodSize * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // UI
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.roundRect(12, 10, 180, 36, 8);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px Arial';
        ctx.fillText('🐍 ' + score, 22, 32);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('🏆 ' + highScore, 100, 32);

        // 控制提示
        if (snake.length <= 5) {
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('WASD / 方向键移动 | Esc 退出', canvas.width / 2, canvas.height / 2 + 40);
        }
    }

    function loop() {
        if (!gameActive) return;
        if (isInChampSelect()) { exitGame(); return; }
        update();
        draw();
        snakeInterval = setTimeout(loop, 80);
    }

    function onKey(e) {
        if (!gameActive) return;
        if (e.key === 'Escape') { e.preventDefault(); exitGame(); return; }
        const km = {
            ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
            ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
            w: { x: 0, y: -1 }, s: { x: 0, y: 1 },
            a: { x: -1, y: 0 }, d: { x: 1, y: 0 }
        };
        const nd = km[e.key];
        if (nd && (nd.x !== -dir.x || nd.y !== -dir.y)) {
            nextDir = nd;
            e.preventDefault();
            e.stopPropagation();
        }
    }

    function startGame() {
        if (!enabled || isInChampSelect()) return;
        createCanvas();
        initGame();
        document.addEventListener('keydown', onKey);
        gameActive = true;
        loop();
    }

    function exitGame() {
        gameActive = false;
        if (snakeInterval) { clearTimeout(snakeInterval); snakeInterval = null; }
        document.removeEventListener('keydown', onKey);
        removeCanvas();
        enabled = false;
        updateBtnStyle();
    }

    function updateBtnStyle() {
        if (!toggleBtn) return;
        toggleBtn.style.filter = enabled ? 'grayscale(0)' : 'grayscale(1)';
        toggleBtn.style.opacity = enabled ? '1' : '0.5';
        toggleBtn.title = '贪吃蛇: ' + (enabled ? '开' : '关');
    }

    function createButton() {
        if (toggleBtn) return;
        const container = document.querySelector('.custom-game-invite-button-container');
        if (!container) return;
        toggleBtn = document.createElement('button');
        toggleBtn.innerHTML = '🐍';
        toggleBtn.style.cssText = 'padding:4px 8px;background:transparent;border:none;cursor:pointer;font-size:20px;margin-right:4px;transition:all 0.3s ease;vertical-align:middle;';
        toggleBtn.addEventListener('click', () => {
            if (isInChampSelect()) return;
            enabled = !enabled;
            enabled ? startGame() : exitGame();
            updateBtnStyle();
        });
        updateBtnStyle();
        container.insertBefore(toggleBtn, container.firstChild);
    }

    setInterval(() => { if (!toggleBtn) createButton(); }, 500);

    const observer = new MutationObserver(() => {
        if (gameActive && isInChampSelect()) exitGame();
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
