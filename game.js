// ==================== 配置 ====================
const API_BASE = 'https://api.qinjiang.top';
const VERSION = 'v5.0';

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

// ==================== v4.5 AI对战系统 ====================
let aiSnake = []; // AI蛇
let aiDx = 0, aiDy = 0;
let aiScore = 0;
let aiAlive = false;
let aiDifficulty = 'normal'; // easy, normal, hard
let gameMode = 'solo'; // 'solo' 或 'vs-ai'

// AI路径寻找
class AISnakeController {
    constructor() {
        this.path = [];
        this.lastDecision = 0;
        this.decisionInterval = 150; // AI决策间隔
    }
    
    // 计算到食物的最佳方向
    findDirectionToFood(head, foodPos) {
        const directions = [
            { dx: 0, dy: -1, name: 'up' },
            { dx: 0, dy: 1, name: 'down' },
            { dx: -1, dy: 0, name: 'left' },
            { dx: 1, dy: 0, name: 'right' }
        ];
        
        // 过滤掉会撞墙或撞自己的方向
        const safeDirections = directions.filter(dir => {
            const newX = head.x + dir.dx;
            const newY = head.y + dir.dy;
            
            // 检查撞墙
            if (newX < 0 || newX >= tileCount || newY < 0 || newY >= tileCount) {
                return false;
            }
            
            // 检查撞自己
            if (aiSnake.some(seg => seg.x === newX && seg.y === newY)) {
                return false;
            }
            
            // 检查撞玩家（AI难度相关）
            if (aiDifficulty === 'hard' && snake.some(seg => seg.x === newX && seg.y === newY)) {
                return false;
            }
            
            return true;
        });
        
        if (safeDirections.length === 0) return null;
        
        // 根据难度添加随机性
        if (aiDifficulty === 'easy' && Math.random() < 0.4) {
            return safeDirections[Math.floor(Math.random() * safeDirections.length)];
        }
        
        // 找到最接近食物的方向
        let bestDir = safeDirections[0];
        let minDist = Infinity;
        
        safeDirections.forEach(dir => {
            const newX = head.x + dir.dx;
            const newY = head.y + dir.dy;
            const dist = Math.abs(newX - foodPos.x) + Math.abs(newY - foodPos.y);
            
            if (dist < minDist) {
                minDist = dist;
                bestDir = dir;
            }
        });
        
        return bestDir;
    }
    
    update() {
        if (!aiAlive || aiSnake.length === 0) return;
        
        const now = Date.now();
        if (now - this.lastDecision < this.decisionInterval) return;
        this.lastDecision = now;
        
        const head = aiSnake[0];
        const dir = this.findDirectionToFood(head, food);
        
        if (dir) {
            aiDx = dir.dx;
            aiDy = dir.dy;
        }
    }
}

let aiController = new AISnakeController();

function initAISnake() {
    aiSnake = [{x: 5, y: 5}];
    aiDx = 1;
    aiDy = 0;
    aiScore = 0;
    aiAlive = true;
    aiController = new AISnakeController();
}

function updateAISnake() {
    if (!aiAlive || !isGameStarted || isGameOver) return;
    
    aiController.update();
    
    const head = {x: aiSnake[0].x + aiDx, y: aiSnake[0].y + aiDy};
    
    // 撞墙检测
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        aiAlive = false;
        return;
    }
    
    // 撞自己检测
    for (let seg of aiSnake) {
        if (head.x === seg.x && head.y === seg.y) {
            aiAlive = false;
            return;
        }
    }
    
    // 撞玩家检测
    for (let seg of snake) {
        if (head.x === seg.x && head.y === seg.y) {
            aiAlive = false;
            return;
        }
    }
    
    aiSnake.unshift(head);
    
    // 吃食物
    if (head.x === food.x && head.y === food.y) {
        aiScore += 10;
        placeFood();
        // 玩家也得分（合作模式）
        if (gameMode === 'coop') {
            score += 5;
            document.getElementById('score').textContent = score;
        }
    } else {
        aiSnake.pop();
    }
}

function drawAISnake(ctx) {
    if (!aiAlive || aiSnake.length === 0) return;
    
    aiSnake.forEach((seg, i) => {
        const x = seg.x * gridSize;
        const y = seg.y * gridSize;
        const size = gridSize - 2;
        
        ctx.save();
        
        if (i === 0) {
            // AI蛇头 - 红色系
            ctx.fillStyle = '#ff4444';
            ctx.shadowBlur = 25;
            ctx.shadowColor = '#ff4444';
            ctx.beginPath();
            ctx.arc(x + gridSize/2, y + gridSize/2, gridSize/1.8, 0, Math.PI * 2);
            ctx.fill();
            
            // AI眼睛
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x + 7, y + 7, 2.5, 0, Math.PI * 2);
            ctx.arc(x + 13, y + 7, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(x + 7 + aiDx, y + 7 + aiDy, 1, 0, Math.PI * 2);
            ctx.arc(x + 13 + aiDx, y + 7 + aiDy, 1, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const alpha = Math.max(0.3, 0.9 - i * 0.015);
            ctx.fillStyle = `rgba(255,68,68,${alpha})`;
            ctx.shadowBlur = i < 5 ? 12 - i * 2 : 0;
            ctx.shadowColor = '#ff4444';
            ctx.fillRect(x + 1, y + 1, size, size);
        }
        
        ctx.restore();
    });
}

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

// ==================== v4.2 视觉增强系统 ====================

// 蛇身轨迹系统
let snakeTrails = [];
const MAX_TRAIL_LENGTH = 8;

class TrailSegment {
    constructor(x, y, color, alpha) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.alpha = alpha;
        this.life = 1.0;
    }
    
    update() {
        this.life -= 0.08;
        this.alpha *= 0.95;
    }
    
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.alpha * this.life;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15 * this.life;
        ctx.shadowColor = this.color;
        const size = gridSize - 4;
        ctx.fillRect(this.x * gridSize + 2, this.y * gridSize + 2, size, size);
        ctx.restore();
    }
}

function addSnakeTrail(x, y, color) {
    snakeTrails.push(new TrailSegment(x, y, color, 0.6));
    if (snakeTrails.length > MAX_TRAIL_LENGTH * 3) {
        snakeTrails.shift();
    }
}

function updateTrails() {
    for (let i = snakeTrails.length - 1; i >= 0; i--) {
        snakeTrails[i].update();
        if (snakeTrails[i].life <= 0) {
            snakeTrails.splice(i, 1);
        }
    }
}

function drawTrails(ctx) {
    snakeTrails.forEach(trail => trail.draw(ctx));
}

// 彩色爆发粒子
class BurstParticle extends Particle {
    constructor(x, y, colors) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        super(x, y, color);
        this.vx = (Math.random() - 0.5) * 15;
        this.vy = (Math.random() - 0.5) * 15;
        this.decay = 0.015 + Math.random() * 0.02;
        this.size = 3 + Math.random() * 5;
        this.gravity = 0.2;
    }
    
    update() {
        super.update();
        this.vy += this.gravity;
        this.size *= 0.97;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20 * this.life;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function spawnBurstParticles(x, y, colors, count = 30) {
    for (let i = 0; i < count; i++) {
        particles.push(new BurstParticle(x, y, colors));
    }
}

// 粒子风暴（死亡特效）
function spawnParticleStorm(x, y) {
    const stormColors = ['#ff6b6b', '#ffd93d', '#6bcf7f', '#4d96ff', '#9b59b6', '#ff9ff3'];
    for (let i = 0; i < 80; i++) {
        const angle = (Math.PI * 2 / 80) * i;
        const speed = 3 + Math.random() * 8;
        const p = new BurstParticle(x, y, stormColors);
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.size = 2 + Math.random() * 4;
        particles.push(p);
    }
}

// 3D阴影效果绘制
function draw3DShadow(ctx, x, y, size, depth) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + depth, y + depth, size, size);
    ctx.restore();
}

// 动态背景渐变
let bgOffset = 0;
function updateBackground() {
    bgOffset += 0.5;
    if (bgOffset > 360) bgOffset = 0;
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
    // 动态背景 - 流动渐变效果
    const time = Date.now() * 0.0005;
    const hue1 = (120 + Math.sin(time) * 20) % 360;
    const hue2 = (160 + Math.cos(time * 0.7) * 30) % 360;
    const gradient = ctx.createLinearGradient(0, 0, 350, 350);
    gradient.addColorStop(0, `hsla(${hue1}, 60%, 8%, 1)`);
    gradient.addColorStop(0.5, `hsla(${hue2}, 50%, 10%, 1)`);
    gradient.addColorStop(1, `hsla(${hue1}, 60%, 6%, 1)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 350, 350);

    // 绘制脉冲网格
    for (let i = 0; i <= tileCount; i++) {
        const pulseAlpha = 0.03 + Math.sin(Date.now() * 0.002 + i * 0.15) * 0.02;
        const hue = 140 + Math.sin(time + i * 0.1) * 20;
        ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${pulseAlpha})`;
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

    // 更新并绘制轨迹
    updateTrails();
    drawTrails(ctx);

    // 绘制蛇身（带3D效果）
    const isGhost = activePowerups.ghost && Date.now() < activePowerups.ghost.expiresAt;
    
    snake.forEach((seg, i) => {
        const x = seg.x * gridSize;
        const y = seg.y * gridSize;
        const size = gridSize - 2;
        
        // 3D阴影效果
        if (i < 3) {
            draw3DShadow(ctx, x + 1, y + 1, size, 3 - i);
        }
        
        ctx.save();
        
        if (i === 0) {
            // 蛇头 - 发光效果增强
            const headColor = isGhost ? '#9944ff' : '#00ff88';
            ctx.fillStyle = headColor;
            ctx.shadowBlur = isGhost ? 40 : 30;
            ctx.shadowColor = headColor;
            ctx.globalAlpha = isGhost ? 0.8 : 1;
            
            // 蛇头光晕
            ctx.beginPath();
            ctx.arc(x + gridSize/2, y + gridSize/2, gridSize/1.8, 0, Math.PI * 2);
            ctx.fill();
            
            // 添加轨迹
            addSnakeTrail(seg.x, seg.y, headColor);
        } else {
            // 蛇身 - 渐变发光
            const alpha = Math.max(0.3, 0.95 - i * 0.015);
            const bodyColor = isGhost ? `rgba(153,68,255,${alpha})` : `rgba(0,255,136,${alpha})`;
            ctx.fillStyle = bodyColor;
            ctx.shadowBlur = i < 5 ? 15 - i * 2 : 0;
            ctx.shadowColor = isGhost ? '#9944ff' : '#00ff88';
            ctx.fillRect(x + 1, y + 1, size, size);
            
            // 每隔一段添加轨迹
            if (i % 2 === 0 && i < 10) {
                addSnakeTrail(seg.x, seg.y, isGhost ? '#9944ff' : '#00ff88');
            }
        }
        
        // 蛇头眼睛（增强版）
        if (i === 0) {
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#000';
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(x + 7, y + 7, 3, 0, Math.PI * 2);
            ctx.arc(x + 14, y + 7, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(x + 7 + dx, y + 7 + dy, 1.5, 0, Math.PI * 2);
            ctx.arc(x + 14 + dx, y + 7 + dy, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    });

    ctx.shadowBlur = 0;

    // 绘制食物（增强动画）
    foodPulse += 0.08;
    const pulseSize = Math.sin(foodPulse) * 3;
    const rotateAngle = foodPulse * 0.3;
    const fx = food.x * gridSize + gridSize/2;
    const fy = food.y * gridSize + gridSize/2;
    
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(rotateAngle);
    
    // 外发光环
    ctx.strokeStyle = `rgba(255, 107, 107, ${0.5 + Math.sin(foodPulse) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, gridSize/2 + pulseSize, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
    
    // 食物本体
    ctx.fillStyle = '#ff6b6b';
    ctx.shadowBlur = 25 + pulseSize * 2;
    ctx.shadowColor = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(fx, fy, gridSize/2 - 2, 0, Math.PI * 2);
    ctx.fill();
    
    // 内部高光
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffcccc';
    ctx.beginPath();
    ctx.arc(fx - 3, fy - 3, gridSize/4, 0, Math.PI * 2);
    ctx.fill();
    
    // 星星效果
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
        const angle = (Math.PI * 2 / 4) * i + rotateAngle;
        const sx = fx + Math.cos(angle) * (gridSize/2 + 2);
        const sy = fy + Math.sin(angle) * (gridSize/2 + 2);
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // 绘制道具（增强版）
    cleanupPowerups();
    powerups.forEach(pu => {
        const px = pu.x * gridSize + gridSize/2;
        const py = pu.y * gridSize + gridSize/2;
        const config = POWERUPS[pu.type];
        const age = Date.now() - pu.createdAt;
        const remaining = 8000 - age;
        const blink = remaining < 2000 ? Math.sin(Date.now() * 0.015) * 0.4 + 0.6 : 1;
        const floatY = Math.sin(Date.now() * 0.005 + pu.x) * 2;
        
        ctx.save();
        ctx.globalAlpha = blink;
        
        // 外圈光环
        ctx.strokeStyle = config.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(px, py + floatY, gridSize/1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // 光晕效果
        ctx.fillStyle = config.color;
        ctx.shadowBlur = 30;
        ctx.shadowColor = config.color;
        ctx.beginPath();
        ctx.arc(px, py + floatY, gridSize/2 - 1, 0, Math.PI * 2);
        ctx.fill();
        
        // emoji（带浮动效果）
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.emoji, px, py + floatY + 1);
        
        ctx.restore();
    });
}
        
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
    
    // 绘制AI蛇（v4.5 AI对战）
    if (gameMode === 'vs-ai' || gameMode === 'coop') {
        drawAISnake(ctx);
    }
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
    
    // 更新AI蛇（v4.5 AI对战）
    if ((gameMode === 'vs-ai' || gameMode === 'coop') && aiAlive) {
        updateAISnake();
    }
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
    
    // 初始化AI蛇（v4.5 AI对战）
    if (gameMode === 'vs-ai' || gameMode === 'coop') {
        initAISnake();
    }
    
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

// ==================== 游戏模式切换 ====================
function setGameMode(mode) {
    gameMode = mode;
    
    // 更新按钮状态
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (mode === 'solo') {
        document.getElementById('modeSolo').classList.add('active');
        aiAlive = false;
    } else if (mode === 'vs-ai') {
        document.getElementById('modeVsAI').classList.add('active');
    }
}

// ==================== PWA Service Worker 注册 ====================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('[PWA] SW registered:', registration.scope);
            })
            .catch(error => {
                console.log('[PWA] SW registration failed:', error);
            });
    });
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('highScore').textContent = getHighScore();
    await loadLeaderboard();
    drawGame();
    setupDirectionButtons();
    
    console.log(`🐍 贪吃蛇 ${VERSION} 已加载 - PWA终极版`);
    console.log('💡 提示: 可添加到主屏幕，离线也能玩！');
});
