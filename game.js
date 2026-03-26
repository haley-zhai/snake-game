// ==================== 配置 ====================
const API_BASE = 'https://api.qinjiang.top';
const VERSION = 'v4.1';

// ==================== 道具系统 ====================
const POWERUPS = {
    speed: { emoji: '⚡', color: '#ff4444', duration: 5000, multiplier: 2, name: '加速' },
    slow: { emoji: '🐌', color: '#4444ff', duration: 5000, multiplier: 1.5, name: '减速' },
    ghost: { emoji: '🌀', color: '#9944ff', duration: 5000, multiplier: 1, name: '穿墙' },
    double: { emoji: '💎', color: '#ffd700', duration: 10000, multiplier: 2, name: '双倍' }
};

// ==================== 状态管理 ====================
let leaderboardData = [];

// ==================== 游戏状态 ====================
let snake = [];
let food = {};
let dx = 0, dy = 0;
let score = 0;
let gameLoop = null;
let isPaused = false;
let isGameOver = false;
let isGameStarted = false;
let difficulty = 'easy';
let soundEnabled = true;
let currentSpeed = 150;
let directionQueue = [];
let currentPlayerName = '';

// ==================== 道具状态 ====================
let powerups = []; // 地图上的道具
let activePowerups = {}; // 激活的道具效果
let foodSinceLastPowerup = 0; // 吃掉食物计数
let baseSpeed = 150; // 基础速度
let scoreMultiplier = 1; // 得分倍率

// ==================== 粒子系统 ====================
let particles = [];
const particleCanvas = document.getElementById('particleCanvas');
const pCtx = particleCanvas ? particleCanvas.getContext('2d') : null;

if (particleCanvas) {
    particleCanvas.width = 350 * (window.devicePixelRatio || 1);
    particleCanvas.height = 350 * (window.devicePixelRatio || 1);
    pCtx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    particleCanvas.style.width = '100%';
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.life = 1;
        this.decay = 0.02 + Math.random() * 0.02;
        this.color = color;
        this.size = 2 + Math.random() * 4;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.life -= this.decay;
        this.size *= 0.98;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function spawnParticles(x, y, color, count = 15) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function updateParticles() {
    if (!pCtx) return;
    
    pCtx.clearRect(0, 0, 350, 350);
    
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw(pCtx);
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
}

const difficulties = {
    easy: { speed: 150, label: '简单' },
    normal: { speed: 100, label: '普通' },
    hard: { speed: 60, label: '困难' }
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const dpr = window.devicePixelRatio || 1;
const gridSize = 20;
const tileCount = 350 / gridSize;

// ==================== 音频系统 ====================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (!soundEnabled) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        if (type === 'eat') {
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.15);
        } else if (type === 'die') {
            osc.frequency.setValueAtTime(300, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.5);
        } else if (type === 'start') {
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.2);
        } else if (type === 'powerup') {
            osc.frequency.setValueAtTime(600, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.3);
        }
    } catch (e) {}
}

function vibrate(ms = 30) {
    if (navigator.vibrate) navigator.vibrate(ms);
}

// ==================== 初始化画布 ====================
canvas.width = 350 * dpr;
canvas.height = 350 * dpr;
ctx.scale(dpr, dpr);
canvas.style.width = '100%';

// ==================== 食物动画 ====================
let foodPulse = 0;

// ==================== 云端 API 接口 ====================
async function fetchLeaderboard() {
    try {
        const res = await fetch(`${API_BASE}/api/leaderboard`);
        const data = await res.json();
        
        leaderboardData = data.map(item => ({
            name: item.name || '匿名',
            score: parseInt(item.score) || 0,
            date: new Date(item.timestamp).toLocaleString('zh-CN'),
            timestamp: item.timestamp
        }));
        
        return leaderboardData;
    } catch (e) {
        leaderboardData = [];
        return [];
    }
}

async function submitScoreToCloud(name, scoreValue) {
    try {
        const res = await fetch(`${API_BASE}/api/leaderboard`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                name: name,
                score: scoreValue,
                time: Math.floor(scoreValue / 10 * currentSpeed / 1000) + 's'
            })
        });
        
        const result = await res.json();
        return result.rank || null;
    } catch (e) {
        return null;
    }
}

// ==================== 本地存储 ====================
const PERSONAL_KEY = 'snakeGame_personal_v3';

function getGameData() {
    try {
        const data = localStorage.getItem(PERSONAL_KEY);
        return data ? JSON.parse(data) : { highScore: 0, playerName: '' };
    } catch (e) {
        return { highScore: 0, playerName: '' };
    }
}

function saveGameData(data) {
    localStorage.setItem(PERSONAL_KEY, JSON.stringify(data));
}

function getHighScore() {
    return getGameData().highScore;
}

function saveHighScore(s) {
    const data = getGameData();
    if (s > data.highScore) {
        data.highScore = s;
        saveGameData(data);
        return true;
    }
    return false;
}

function getPlayerName() {
    return getGameData().playerName || '';
}

function savePlayerName(name) {
    const data = getGameData();
    data.playerName = name;
    saveGameData(data);
}

// ==================== 道具系统函数 ====================

// 生成道具
function spawnPowerup() {
    if (powerups.length >= 2) return; // 最多2个道具
    
    const types = Object.keys(POWERUPS);
    const type = types[Math.floor(Math.random() * types.length)];
    
    let attempts = 0;
    let pu;
    do {
        pu = {
            x: Math.floor(Math.random() * tileCount),
            y: Math.floor(Math.random() * tileCount),
            type: type,
            createdAt: Date.now()
        };
        attempts++;
    } while (attempts < 100 && (
        snake.some(s => s.x === pu.x && s.y === pu.y) ||
        (food.x === pu.x && food.y === pu.y) ||
        powerups.some(p => p.x === pu.x && p.y === pu.y)
    ));
    
    powerups.push(pu);
}

// 清理过期道具
function cleanupPowerups() {
    const now = Date.now();
    powerups = powerups.filter(p => now - p.createdAt < 8000); // 8秒过期
}

// 激活道具效果
function activatePowerup(type) {
    const pu = POWERUPS[type];
    activePowerups[type] = {
        expiresAt: Date.now() + pu.duration,
        ...pu
    };
    
    // 应用效果
    updatePowerupEffects();
    
    // 播放音效
    playSound('powerup');
    vibrate(50);
    
    // 更新UI
    updatePowerupUI();
}

// 更新道具效果
function updatePowerupEffects() {
    let speedMod = 1;
    scoreMultiplier = 1;
    
    for (const [type, data] of Object.entries(activePowerups)) {
        if (Date.now() < data.expiresAt) {
            if (type === 'speed') speedMod *= 0.5;
            if (type === 'slow') speedMod *= 2;
            scoreMultiplier = Math.max(scoreMultiplier, data.multiplier);
        }
    }
    
    currentSpeed = Math.max(30, Math.min(300, baseSpeed * speedMod));
    
    // 更新游戏循环速度
    if (gameLoop && isGameStarted && !isGameOver && !isPaused) {
        clearInterval(gameLoop);
        gameLoop = setInterval(updateGame, currentSpeed);
    }
}

// 清理过期道具效果
function cleanupActivePowerups() {
    const now = Date.now();
    let hasExpired = false;
    
    for (const type of Object.keys(activePowerups)) {
        if (now >= activePowerups[type].expiresAt) {
            delete activePowerups[type];
            hasExpired = true;
        }
    }
    
    if (hasExpired) {
        updatePowerupEffects();
        updatePowerupUI();
    }
}

// 更新道具UI
function updatePowerupUI() {
    const container = document.getElementById('activePowerups');
    if (!container) return;
    
    const now = Date.now();
    let html = '';
    
    for (const [type, data] of Object.entries(activePowerups)) {
        const remaining = Math.max(0, data.expiresAt - now);
        const seconds = Math.ceil(remaining / 1000);
        
        html += `
            <div class="powerup-badge" style="--pu-color: ${data.color}">
                <span class="pu-emoji">${data.emoji}</span>
                <span class="pu-time">${seconds}s</span>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ==================== 游戏核心 ====================

function drawGame() {
    // 清空画布
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, 350, 350);

    // 绘制发光网格
    for (let i = 0; i <= tileCount; i++) {
        const alpha = 0.02 + Math.sin(Date.now() * 0.001 + i * 0.1) * 0.01;
        ctx.strokeStyle = `rgba(0,255,136,${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, 350);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(350, i * gridSize);
        ctx.stroke();
    }

    // 绘制蛇身
    const isGhost = activePowerups.ghost && Date.now() < activePowerups.ghost.expiresAt;
    
    snake.forEach((seg, i) => {
        const x = seg.x * gridSize;
        const y = seg.y * gridSize;
        
        ctx.save();
        
        if (i === 0) {
            // 蛇头
            ctx.fillStyle = isGhost ? '#9944ff' : '#00ff88';
            ctx.shadowBlur = isGhost ? 30 : 20;
            ctx.shadowColor = isGhost ? '#9944ff' : '#00ff88';
            ctx.globalAlpha = isGhost ? 0.7 : 1;
        } else {
            const alpha = Math.max(0.3, 0.9 - i * 0.02);
            ctx.fillStyle = isGhost ? `rgba(153,68,255,${alpha * 0.7})` : `rgba(0,255,136,${alpha})`;
            ctx.shadowBlur = 0;
        }
        
        const size = gridSize - 2;
        ctx.fillRect(x + 1, y + 1, size, size);
        
        // 蛇头眼睛
        if (i === 0) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#000';
            ctx.fillRect(x + 6, y + 6, 3, 3);
            ctx.fillRect(x + 13, y + 6, 3, 3);
        }
        
        ctx.restore();
    });

    // 绘制食物
    foodPulse += 0.05;
    const pulseSize = Math.sin(foodPulse) * 2;
    const fx = food.x * gridSize + gridSize/2;
    const fy = food.y * gridSize + gridSize/2;
    
    ctx.fillStyle = '#ff6b6b';
    ctx.shadowBlur = 20 + pulseSize * 2;
    ctx.shadowColor = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(fx, fy, gridSize/2 - 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff9999';
    ctx.beginPath();
    ctx.arc(fx - 2, fy - 2, gridSize/5, 0, Math.PI * 2);
    ctx.fill();

    // 绘制道具
    cleanupPowerups();
    powerups.forEach(pu => {
        const px = pu.x * gridSize + gridSize/2;
        const py = pu.y * gridSize + gridSize/2;
        const config = POWERUPS[pu.type];
        const age = Date.now() - pu.createdAt;
        const remaining = 8000 - age;
        const blink = remaining < 2000 ? Math.sin(Date.now() * 0.02) * 0.3 + 0.7 : 1;
        
        ctx.save();
        ctx.globalAlpha = blink;
        
        // 光晕效果
        ctx.shadowBlur = 25;
        ctx.shadowColor = config.color;
        ctx.fillStyle = config.color;
        ctx.beginPath();
        ctx.arc(px, py, gridSize/2 - 2, 0, Math.PI * 2);
        ctx.fill();
        
        // emoji
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.emoji, px, py + 1);
        
        ctx.restore();
    });
}

function updateGame() {
    if (isPaused || isGameOver) return;

    // 清理过期道具效果
    cleanupActivePowerups();
    
    // 更新道具UI倒计时
    if (Object.keys(activePowerups).length > 0) {
        updatePowerupUI();
    }

    if (directionQueue.length > 0) {
        const dir = directionQueue.shift();
        dx = dir.dx;
        dy = dir.dy;
    }

    const head = {x: snake[0].x + dx, y: snake[0].y + dy};

    // 穿墙检测
    const isGhost = activePowerups.ghost && Date.now() < activePowerups.ghost.expiresAt;
    
    if (!isGhost) {
        if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
            gameOver();
            return;
        }
    } else {
        // 穿墙模式
        if (head.x < 0) head.x = tileCount - 1;
        if (head.x >= tileCount) head.x = 0;
        if (head.y < 0) head.y = tileCount - 1;
        if (head.y >= tileCount) head.y = 0;
    }

    // 撞自己检测
    for (let i = 0; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            gameOver();
            return;
        }
    }

    snake.unshift(head);

    // 吃食物
    if (head.x === food.x && head.y === food.y) {
        const points = Math.floor(10 * scoreMultiplier);
        score += points;
        document.getElementById('score').textContent = score;
        
        const scoreEl = document.getElementById('score');
        scoreEl.parentElement.classList.add('changed');
        setTimeout(() => scoreEl.parentElement.classList.remove('changed'), 300);
        
        playSound('eat');
        vibrate(20);
        
        const fx = food.x * gridSize + gridSize/2;
        const fy = food.y * gridSize + gridSize/2;
        spawnParticles(fx, fy, '#00ff88', 20);
        
        // 道具生成逻辑
        foodSinceLastPowerup++;
        if (foodSinceLastPowerup >= 3) {
            if (Math.random() < 0.3) {
                spawnPowerup();
            }
            foodSinceLastPowerup = 0;
        }
        
        placeFood();
    } else {
        // 吃道具检测
        const puIndex = powerups.findIndex(p => p.x === head.x && p.y === head.y);
        if (puIndex !== -1) {
            const pu = powerups[puIndex];
            activatePowerup(pu.type);
            powerups.splice(puIndex, 1);
            
            // 道具粒子效果
            const px = head.x * gridSize + gridSize/2;
            const py = head.y * gridSize + gridSize/2;
            spawnParticles(px, py, POWERUPS[pu.type].color, 25);
        }
        
        snake.pop();
    }

    drawGame();
    updateParticles();
}

function placeFood() {
    let attempts = 0;
    let f;
    do {
        f = {
            x: Math.floor(Math.random() * tileCount),
            y: Math.floor(Math.random() * tileCount)
        };
        attempts++;
    } while (attempts < 100 && (
        snake.some(s => s.x === f.x && s.y === f.y) ||
        powerups.some(p => p.x === f.x && p.y === f.y)
    ));
    food = f;
}

async function gameOver() {
    isGameOver = true;
    isGameStarted = false;
    clearInterval(gameLoop);
    playSound('die');
    vibrate([50, 50, 100]);
    
    const head = snake[0];
    const hx = head.x * gridSize + gridSize/2;
    const hy = head.y * gridSize + gridSize/2;
    spawnParticles(hx, hy, '#ff6b6b', 30);
    
    const particleLoop = setInterval(() => {
        drawGame();
        updateParticles();
        if (particles.length === 0) {
            clearInterval(particleLoop);
        }
    }, 16);
    
    const isNewRecord = saveHighScore(score);
    document.getElementById('highScore').textContent = getHighScore();
    
    document.getElementById('finalScore').textContent = score;
    const finalScoreEl = document.getElementById('finalScore');
    if (isNewRecord) {
        finalScoreEl.innerHTML = score + '<div style="font-size:14px;color:#ffd700;margin-top:8px;">🎉 新纪录！</div>';
        finalScoreEl.classList.add('new-record');
    } else {
        finalScoreEl.classList.remove('new-record');
    }
    
    const savedName = getPlayerName();
    if (savedName) {
        document.getElementById('playerName').value = savedName;
    }
    
    document.getElementById('gameOverModal').classList.add('show');
}

function startGame() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    // 重置道具状态
    powerups = [];
    activePowerups = {};
    foodSinceLastPowerup = 0;
    scoreMultiplier = 1;
    
    snake = [{x: 10, y: 10}];
    dx = 1;
    dy = 0;
    directionQueue = [];
    score = 0;
    isGameOver = false;
    isPaused = false;
    isGameStarted = true;
    baseSpeed = difficulties[difficulty].speed;
    currentSpeed = baseSpeed;
    
    document.getElementById('score').textContent = '0';
    document.getElementById('gameOverlay').classList.add('hidden');
    document.getElementById('myRank').textContent = '-';
    
    // 清空道具UI
    const puContainer = document.getElementById('activePowerups');
    if (puContainer) puContainer.innerHTML = '';
    
    playSound('start');
    placeFood();
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(updateGame, currentSpeed);
    drawGame();
}

function pauseGame() {
    if (isGameOver || !isGameStarted) return;
    isPaused = !isPaused;
}

function handleDirection(dir) {
    vibrate(15);
    
    if (!isGameStarted && !isGameOver) {
        const dirs = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
        dx = dirs[dir][0];
        dy = dirs[dir][1];
        startGame();
        return;
    }
    
    if (isGameOver || isPaused || !isGameStarted) return;
    
    let newDx = dx, newDy = dy;
    switch(dir) {
        case 'up': if (dy === 0) { newDx = 0; newDy = -1; } break;
        case 'down': if (dy === 0) { newDx = 0; newDy = 1; } break;
        case 'left': if (dx === 0) { newDx = -1; newDy = 0; } break;
        case 'right': if (dx === 0) { newDx = 1; newDy = 0; } break;
    }
    
    if (directionQueue.length < 2 && (newDx !== dx || newDy !== dy)) {
        directionQueue.push({ dx: newDx, dy: newDy });
    }
}

// ==================== 输入事件 ====================
document.addEventListener('keydown', (e) => {
    const keyMap = {
        'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right',
        'w': 'up', 's': 'down', 'a': 'left', 'd': 'right',
        'W': 'up', 'S': 'down', 'A': 'left', 'D': 'right'
    };
    if (keyMap[e.key]) {
        e.preventDefault();
        handleDirection(keyMap[e.key]);
    } else if (e.key === ' ') {
        e.preventDefault();
        if (isGameStarted) pauseGame();
        else startGame();
    }
});

// 触摸控制
let touchStartX = 0, touchStartY = 0;
document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const minSwipe = 30;
    
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minSwipe) {
        handleDirection(dx > 0 ? 'right' : 'left');
    } else if (Math.abs(dy) > minSwipe) {
        handleDirection(dy > 0 ? 'down' : 'up');
    }
}, { passive: true });

// 虚拟方向键
function setupDirectionButtons() {
    const btnMap = {
        'btnUp': 'up', 'btnDown': 'down',
        'btnLeft': 'left', 'btnRight': 'right'
    };
    
    for (const [id, dir] of Object.entries(btnMap)) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                handleDirection(dir);
            });
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                handleDirection(dir);
            });
        }
    }
}

// 难度切换
function setDifficulty(level) {
    difficulty = level;
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.level === level);
    });
    if (!isGameStarted) {
        baseSpeed = difficulties[level].speed;
        currentSpeed = baseSpeed;
    }
}

// 模态框控制
function closeModal() {
    document.getElementById('gameOverModal').classList.remove('show');
    document.getElementById('gameOverlay').classList.remove('hidden');
}

function showLeaderboard() {
    loadLeaderboard();
    document.getElementById('leaderboardModal').classList.add('show');
}

function closeLeaderboard() {
    document.getElementById('leaderboardModal').classList.remove('show');
}

// 加载排行榜
async function loadLeaderboard() {
    await fetchLeaderboard();
    
    const tbody = document.getElementById('leaderboardBody');
    if (!tbody) return;
    
    tbody.innerHTML = leaderboardData.slice(0, 10).map((item, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(item.name)}</td>
            <td>${item.score}</td>
        </tr>
    `).join('');
    
    // 显示我的排名
    const myName = getPlayerName();
    if (myName) {
        const myIndex = leaderboardData.findIndex(item => item.name === myName);
        if (myIndex !== -1) {
            document.getElementById('myRank').textContent = '#' + (myIndex + 1);
        }
    }
}

// 提交分数
async function submitScore() {
    const name = document.getElementById('playerName').value.trim();
    if (name.length < 1 || name.length > 10) {
        alert('请输入1-10个字符的名字');
        return;
    }
    
    currentPlayerName = name;
    savePlayerName(name);
    
    const submitBtn = document.querySelector('#gameOverModal .btn-full');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '提交中...';
    submitBtn.disabled = true;
    
    try {
        const rank = await submitScoreToCloud(name, score);
        await loadLeaderboard();
        
        if (rank) {
            document.getElementById('myRank').textContent = '#' + rank;
        }
        
        closeModal();
    } catch (e) {
        alert('提交失败，请重试');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('highScore').textContent = getHighScore();
    await loadLeaderboard();
    drawGame();
    setupDirectionButtons();
    
    console.log(`🐍 贪吃蛇 ${VERSION} 已加载`);
});
