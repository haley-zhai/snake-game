// ==================== 配置 ====================
const API_BASE = 'https://api.qinjiang.top';
const VERSION = 'v3.1';

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

// ==================== 初始化画布 ====================
canvas.width = 350 * dpr;
canvas.height = 350 * dpr;
ctx.scale(dpr, dpr);
canvas.style.width = '100%';

// ==================== 食物动画 ====================
let foodPulse = 0;

// ==================== 云端 API 接口 ====================

// 获取排行榜（强制云端）
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
        
        console.log('[API] 排行榜获取成功:', leaderboardData.length, '条记录');
        return leaderboardData;
        
    } catch (e) {
        console.log('[API] 获取失败:', e.message);
        leaderboardData = [];
        return [];
    }
}

// 提交分数到云端
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
        console.log('[API] 提交成功:', result);
        return result.rank || null;
        
    } catch (e) {
        console.log('[API] 提交失败:', e.message);
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

// ==================== 游戏核心 ====================
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
        }
    } catch (e) {}
}

function vibrate(ms = 30) {
    if (navigator.vibrate) navigator.vibrate(ms);
}

function drawGame() {
    // 清空画布
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, 350, 350);

    // 绘制发光网格
    ctx.strokeStyle = 'rgba(0,255,136,0.03)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= tileCount; i++) {
        const alpha = 0.02 + Math.sin(Date.now() * 0.001 + i * 0.1) * 0.01;
        ctx.strokeStyle = `rgba(0,255,136,${alpha})`;
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
    snake.forEach((seg, i) => {
        const x = seg.x * gridSize;
        const y = seg.y * gridSize;
        
        if (i === 0) {
            // 蛇头 - 发光效果
            ctx.fillStyle = '#00ff88';
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00ff88';
        } else {
            // 蛇身 - 渐变透明度
            const alpha = Math.max(0.3, 0.9 - i * 0.02);
            ctx.fillStyle = `rgba(0,255,136,${alpha})`;
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
    });

    ctx.shadowBlur = 0;

    // 绘制食物 - 脉冲发光效果
    const fx = food.x * gridSize + gridSize/2;
    const fy = food.y * gridSize + gridSize/2;
    
    foodPulse += 0.05;
    const pulseSize = Math.sin(foodPulse) * 2;
    
    // 外发光
    ctx.fillStyle = '#ff6b6b';
    ctx.shadowBlur = 20 + pulseSize * 2;
    ctx.shadowColor = '#ff6b6b';
    
    // 食物本体
    ctx.beginPath();
    ctx.arc(fx, fy, gridSize/2 - 3, 0, Math.PI * 2);
    ctx.fill();
    
    // 内部高光
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff9999';
    ctx.beginPath();
    ctx.arc(fx - 2, fy - 2, gridSize/5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
}

function updateGame() {
    if (isPaused || isGameOver) return;

    if (directionQueue.length > 0) {
        const dir = directionQueue.shift();
        dx = dir.dx;
        dy = dir.dy;
    }

    const head = {x: snake[0].x + dx, y: snake[0].y + dy};

    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        gameOver();
        return;
    }

    for (let i = 0; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            gameOver();
            return;
        }
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        score += 10;
        document.getElementById('score').textContent = score;
        
        // 分数变化动画
        const scoreEl = document.getElementById('score');
        scoreEl.parentElement.classList.add('changed');
        setTimeout(() => scoreEl.parentElement.classList.remove('changed'), 300);
        
        playSound('eat');
        vibrate(20);
        
        // 生成粒子效果
        const fx = food.x * gridSize + gridSize/2;
        const fy = food.y * gridSize + gridSize/2;
        spawnParticles(fx, fy, '#00ff88', 20);
        
        if (score % 50 === 0 && currentSpeed > 50) {
            currentSpeed -= 5;
            clearInterval(gameLoop);
            gameLoop = setInterval(updateGame, currentSpeed);
        }
        
        placeFood();
    } else {
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
    } while (attempts < 100 && snake.some(s => s.x === f.x && s.y === f.y));
    food = f;
}

async function gameOver() {
    isGameOver = true;
    isGameStarted = false;
    clearInterval(gameLoop);
    playSound('die');
    vibrate([50, 50, 100]);
    
    // 死亡粒子效果
    const head = snake[0];
    const hx = head.x * gridSize + gridSize/2;
    const hy = head.y * gridSize + gridSize/2;
    spawnParticles(hx, hy, '#ff6b6b', 30);
    
    // 动画循环直到粒子消失
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
        finalScoreEl.innerHTML = score + '<div style="font-size:14px;color:#ffd700;margin-top:8px;"🎉 新纪录！</div>';
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
    
    snake = [{x: 10, y: 10}];
    dx = 1;
    dy = 0;
    directionQueue = [];
    score = 0;
    isGameOver = false;
    isPaused = false;
    isGameStarted = true;
    currentSpeed = difficulties[difficulty].speed;
    
    document.getElementById('score').textContent = '0';
    document.getElementById('gameOverlay').classList.add('hidden');
    document.getElementById('myRank').textContent = '-';
    
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

let touchStartX = 0, touchStartY = 0, touchStartTime = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
}, {passive: true});

document.addEventListener('touchmove', (e) => {
    if (isGameStarted && !isPaused && !isGameOver) {
        e.preventDefault();
    }
}, {passive: false});

document.addEventListener('touchend', (e) => {
    const touchDuration = Date.now() - touchStartTime;
    const tdx = e.changedTouches[0].clientX - touchStartX;
    const tdy = e.changedTouches[0].clientY - touchStartY;
    
    if (touchDuration < 200 && Math.abs(tdx) < 10 && Math.abs(tdy) < 10) return;
    if (Math.abs(tdx) < 25 && Math.abs(tdy) < 25) return;
    
    if (Math.abs(tdx) > Math.abs(tdy)) {
        handleDirection(tdx > 0 ? 'right' : 'left');
    } else {
        handleDirection(tdy > 0 ? 'down' : 'up');
    }
}, {passive: false});

// ==================== UI 控制 ====================
async function closeModal() {
    document.getElementById('gameOverModal').classList.remove('show');
    document.getElementById('gameOverlay').classList.remove('hidden');
    await loadLeaderboard();
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('soundBtn').textContent = soundEnabled ? '🔊' : '🔇';
}

function setDifficulty(d) {
    difficulty = d;
    currentSpeed = difficulties[d].speed;
    
    document.querySelectorAll('.control-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('btn' + d.charAt(0).toUpperCase() + d.slice(1)).classList.add('active');
    
    if (isGameStarted) {
        clearInterval(gameLoop);
        gameLoop = setInterval(updateGame, currentSpeed);
    }
}

// ==================== 排行榜展示 ====================
async function loadLeaderboard() {
    await fetchLeaderboard();
    renderLeaderboard();
}

function renderLeaderboard() {
    const listEl = document.getElementById('leaderboardList');
    const countEl = document.getElementById('leaderboardCount');
    
    countEl.textContent = leaderboardData.length + ' 人玩过';
    
    if (leaderboardData.length === 0) {
        listEl.innerHTML = `
            <div class="leaderboard-empty">
                <div class="icon">🏆</div>
                <div>还没有人上榜</div>
                <div style="font-size: 12px; margin-top: 8px;">成为第一个挑战者吧！</div>
            </div>
        `;
        return;
    }
    
    let html = '';
    const myName = currentPlayerName || getPlayerName();
    
    const uniquePlayers = [];
    const seen = new Set();
    
    for (const item of leaderboardData) {
        if (!seen.has(item.name)) {
            seen.add(item.name);
            uniquePlayers.push(item);
        }
    }
    
    uniquePlayers.slice(0, 10).forEach((item, i) => {
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal';
        const isMe = item.name === myName;
        
        html += `
            <div class="leaderboard-item ${isMe ? 'highlight' : ''}">
                <div class="rank-num ${rankClass}">${i + 1}</div>
                <div class="rank-info">
                    <div class="rank-name">${escapeHtml(item.name)}</div>
                    <div class="rank-time">${item.date}</div>
                </div>
                <div class="rank-score">${item.score}</div>
            </div>
        `;
    });
    
    listEl.innerHTML = html;
    updateMyRank();
}

function updateMyRank() {
    const myName = currentPlayerName || getPlayerName();
    if (!myName || leaderboardData.length === 0) {
        document.getElementById('myRank').textContent = '-';
        return;
    }
    
    const uniquePlayers = [];
    const seen = new Set();
    
    for (const item of leaderboardData) {
        if (!seen.has(item.name)) {
            seen.add(item.name);
            uniquePlayers.push(item);
        }
    }
    
    const rank = uniquePlayers.findIndex(item => item.name === myName);
    document.getElementById('myRank').textContent = rank >= 0 ? '#' + (rank + 1) : '-';
}

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
        console.error('提交失败:', e);
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
    
    console.log(`🐍 贪吃蛇 ${VERSION} 已加载`);
});
