// ==================== 云端 API ====================
const API_BASE = '/.netlify/functions/api';

async function fetchLeaderboard() {
    try {
        const response = await fetch(`${API_BASE}/leaderboard`);
        const result = await response.json();
        return result.success ? result.data : [];
    } catch (e) {
        console.error('Failed to fetch leaderboard:', e);
        return [];
    }
}

async function submitScoreToCloud(name, score) {
    try {
        const response = await fetch(`${API_BASE}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, score })
        });
        const result = await response.json();
        return result.success ? result.rank : null;
    } catch (e) {
        console.error('Failed to submit score:', e);
        return null;
    }
}

// ==================== 游戏配置 ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const dpr = window.devicePixelRatio || 1;
canvas.width = 350 * dpr;
canvas.height = 350 * dpr;
ctx.scale(dpr, dpr);
canvas.style.width = '100%';

const gridSize = 20;
const tileCount = 350 / gridSize;

const difficulties = {
    easy: { speed: 150, label: '简单' },
    normal: { speed: 100, label: '普通' },
    hard: { speed: 60, label: '困难' }
};

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
let currentSpeed = difficulties.easy.speed;
let directionQueue = [];
let currentPlayerName = '';
let leaderboardData = [];

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
            osc.frequency.setValueAtTime(600, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.15);
        } else if (type === 'die') {
            osc.frequency.setValueAtTime(300, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.4);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.4);
        } else if (type === 'start') {
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.2);
        }
    } catch (e) {}
}

function vibrate(ms = 30) {
    if (navigator.vibrate) navigator.vibrate(ms);
}

// ==================== 本地存储（备用） ====================
const STORAGE_KEY = 'snakeGame_v5';

function getGameData() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : { highScore: 0, playerName: '' };
    } catch (e) {
        return { highScore: 0, playerName: '' };
    }
}

function saveGameData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
function drawGame() {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, 350, 350);

    ctx.strokeStyle = 'rgba(0,255,136,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= tileCount; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, 350);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(350, i * gridSize);
        ctx.stroke();
    }

    snake.forEach((seg, i) => {
        const x = seg.x * gridSize;
        const y = seg.y * gridSize;
        
        if (i === 0) {
            ctx.fillStyle = '#00ff88';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00ff88';
        } else {
            ctx.fillStyle = `rgba(0,255,136,${0.8 - i * 0.02})`;
            ctx.shadowBlur = 0;
        }
        
        ctx.fillRect(x + 1, y + 1, gridSize - 2, gridSize - 2);
        
        if (i === 0) {
            ctx.fillStyle = '#000';
            ctx.fillRect(x + 5, y + 5, 3, 3);
            ctx.fillRect(x + 12, y + 5, 3, 3);
        }
    });

    ctx.shadowBlur = 0;

    const fx = food.x * gridSize + gridSize/2;
    const fy = food.y * gridSize + gridSize/2;
    ctx.fillStyle = '#ff6b6b';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(fx, fy, gridSize/2 - 3, 0, Math.PI * 2);
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
        playSound('eat');
        vibrate(20);
        
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

function gameOver() {
    isGameOver = true;
    isGameStarted = false;
    clearInterval(gameLoop);
    playSound('die');
    vibrate([50, 50, 100]);
    
    const isNewRecord = saveHighScore(score);
    document.getElementById('highScore').textContent = getHighScore();
    
    document.getElementById('finalScore').textContent = score;
    if (isNewRecord) {
        document.getElementById('finalScore').innerHTML = score + '<div style="font-size:14px;color:#ffd700;margin-top:4px;">🎉 新纪录！</div>';
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

// ==================== 输入处理 ====================
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

let touchStartX = 0, touchStartY = 0;
let touchStartTime = 0;

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
function closeModal() {
    document.getElementById('gameOverModal').classList.remove('show');
    document.getElementById('gameOverlay').classList.remove('hidden');
    loadLeaderboard();
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

// ==================== 云端排行榜 ====================
async function loadLeaderboard() {
    leaderboardData = await fetchLeaderboard();
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
    
    leaderboardData.slice(0, 10).forEach((item, i) => {
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
    
    const rank = leaderboardData.findIndex(item => item.name === myName);
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
    
    // 提交到云端
    const rank = await submitScoreToCloud(name, score);
    
    // 刷新排行榜
    await loadLeaderboard();
    
    if (rank) {
        document.getElementById('myRank').textContent = '#' + rank;
    }
    
    closeModal();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== 初始化 ====================
document.getElementById('highScore').textContent = getHighScore();
loadLeaderboard();
drawGame();