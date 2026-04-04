// ==================== 腾讯云开发排行榜 API ====================

// 腾讯云环境配置
const CLOUDBASE_ENV = 'snake-game-5gvtkwf262c3ddc4';
let app = null;
let db = null;
let isCloudReady = false;

// 显示状态消息
function showStatus(message, type = 'info') {
    console.log(`[${type}] ${message}`);
}

// 初始化腾讯云开发
async function initCloudBase() {
    if (isCloudReady) return true;
    
    try {
        // 检查 cloudbase 是否已加载
        if (typeof cloudbase === 'undefined') {
            showStatus('腾讯云 SDK 未加载', 'warn');
            return false;
        }
        
        // 初始化
        app = cloudbase.init({
            env: CLOUDBASE_ENV
        });
        
        // 匿名登录
        await app.auth().anonymousAuthProvider().signIn();
        showStatus('腾讯云匿名登录成功', 'success');
        
        // 获取数据库实例
        db = app.database();
        isCloudReady = true;
        return true;
        
    } catch (e) {
        showStatus(`腾讯云初始化失败: ${e.message}`, 'error');
        return false;
    }
}

// 获取排行榜数据
async function fetchLeaderboard() {
    // 初始化云开发
    const cloudReady = await initCloudBase();
    
    if (!cloudReady || !db) {
        showStatus('云端连接失败', 'error');
        // 只返回缓存的数据，不返回本地个人记录
        return loadCachedLeaderboard();
    }
    
    try {
        showStatus('正在加载云端排行榜...', 'info');
        
        // 从数据库查询，按分数降序，最多50条
        const { data } = await db.collection('leaderboard')
            .orderBy('score', 'desc')
            .limit(50)
            .get();
        
        showStatus(`获取到 ${data.length} 条记录`, 'info');
        
        // 格式化数据
        const scores = data.map(item => ({
            name: item.name || '匿名',
            score: parseInt(item.score) || 0,
            date: item.date || new Date(item.timestamp).toLocaleString('zh-CN'),
            timestamp: item.timestamp || Date.now()
        }));
        
        // 缓存到本地（用于离线时显示）
        cacheLeaderboard(scores);
        
        return scores;
        
    } catch (e) {
        showStatus(`获取排行榜失败: ${e.message}`, 'error');
        // 云端失败时返回缓存的数据
        return loadCachedLeaderboard();
    }
}

// 提交分数到云端
async function submitScoreToCloud(name, score) {
    // 初始化云开发
    const cloudReady = await initCloudBase();
    
    if (!cloudReady || !db) {
        showStatus('云端不可用，保存到本地', 'info');
        return submitScoreLocal(name, score);
    }
    
    try {
        const date = new Date().toLocaleString('zh-CN');
        
        showStatus('正在提交分数...', 'info');
        
        // 添加到数据库
        await db.collection('leaderboard').add({
            name: name,
            score: score,
            date: date,
            timestamp: Date.now()
        });
        
        showStatus('✅ 分数已提交到云端', 'success');
        
        // 重新获取排行榜以计算排名
        const leaderboard = await fetchLeaderboard();
        
        // 去重后找排名
        const uniquePlayers = [];
        const seen = new Set();
        for (const item of leaderboard) {
            if (!seen.has(item.name)) {
                seen.add(item.name);
                uniquePlayers.push(item);
            }
        }
        
        const rank = uniquePlayers.findIndex(item => item.name === name && item.score === score) + 1;
        
        if (rank > 0) {
            showStatus(`你的排名: #${rank}`, 'success');
        }
        
        return rank > 0 ? rank : null;
        
    } catch (e) {
        showStatus(`提交失败: ${e.message}`, 'error');
        // 失败时保存到本地
        return submitScoreLocal(name, score);
    }
}

// ==================== 本地存储（备份）====================

const STORAGE_KEY = 'snakeGame_local_v2';
const CACHE_KEY = 'snakeGame_cache_v2';

// 缓存排行榜（用于离线时显示）
function cacheLeaderboard(scores) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: scores,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.error('缓存失败:', e);
    }
}

// 加载缓存的排行榜
function loadCachedLeaderboard() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { data } = JSON.parse(cached);
            return data || [];
        }
    } catch (e) {
        console.error('读取缓存失败:', e);
    }
    return [];
}

// 本地排行榜
function fetchLocalLeaderboard() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        const scores = data ? JSON.parse(data) : [];
        scores.sort((a, b) => b.score - a.score);
        return scores.slice(0, 50);
    } catch (e) {
        console.error('读取本地排行榜失败:', e);
        return [];
    }
}

// 本地提交分数
function submitScoreLocal(name, score) {
    try {
        const scores = fetchLocalLeaderboard();
        const date = new Date().toLocaleString('zh-CN');
        
        scores.push({
            name: name,
            score: score,
            date: date,
            timestamp: Date.now()
        });
        
        scores.sort((a, b) => b.score - a.score);
        
        // 只保留50条
        const top50 = scores.slice(0, 50);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(top50));
        
        showStatus('已保存到本地', 'success');
        
        // 返回排名
        const rank = top50.findIndex(item => item.name === name && item.score === score) + 1;
        return rank > 0 ? rank : null;
        
    } catch (e) {
        console.error('本地保存失败:', e);
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

// ==================== 皮肤系统 ====================
let currentSkin = 'classic';

const SKINS = {
    classic: { snake: '#00ff88', snakeHead: '#00ff88', food: '#ff6b6b', bg: '#0a0a0f', name: '经典' },
    neon: { snake: '#ff00ff', snakeHead: '#ff00ff', food: '#00ffff', bg: '#1a0033', name: '霓虹' },
    fire: { snake: '#ff6600', snakeHead: '#ff6600', food: '#ffff00', bg: '#330000', name: '火焰' },
    ocean: { snake: '#0099ff', snakeHead: '#0099ff', food: '#00ffcc', bg: '#001a33', name: '海洋' }
};

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function setSkin(skinName) {
    currentSkin = skinName;
    localStorage.setItem('snakeSkin', skinName);
    
    const buttons = ['skinClassic', 'skinNeon', 'skinFire', 'skinOcean'];
    buttons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('active');
    });
    
    const activeBtn = document.getElementById('skin' + skinName.charAt(0).toUpperCase() + skinName.slice(1));
    if (activeBtn) activeBtn.classList.add('active');
    
    if (!isGameStarted || isGameOver) {
        drawGame();
    }
}
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

// ==================== 本地存储（个人记录）====================
const PERSONAL_KEY = 'snakeGame_personal_v2';

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
function drawGame() {
    const skin = SKINS[currentSkin];
    
    ctx.fillStyle = skin.bg;
    ctx.fillRect(0, 0, 350, 350);

    ctx.strokeStyle = hexToRgba(skin.snake, 0.05);
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
            ctx.fillStyle = skin.snakeHead;
            ctx.shadowBlur = 10;
            ctx.shadowColor = skin.snakeHead;
        } else {
            ctx.fillStyle = hexToRgba(skin.snake, Math.max(0.3, 0.8 - i * 0.02));
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
    ctx.fillStyle = skin.food;
    ctx.shadowBlur = 15;
    ctx.shadowColor = skin.food;
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

// ==================== 排行榜展示 ====================
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
    
    // 去重：同一玩家只显示最高分
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
    
    // 去重后找排名
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
    
    // 显示加载状态
    const submitBtn = document.querySelector('#gameOverModal .btn-full');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '提交中...';
    submitBtn.disabled = true;
    
    try {
        // 提交到云端
        const rank = await submitScoreToCloud(name, score);
        
        // 刷新排行榜
        await loadLeaderboard();
        
        if (rank) {
            document.getElementById('myRank').textContent = '#' + rank;
        }
        
        // 关闭弹窗
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
// 加载保存的皮肤设置
const savedSkin = localStorage.getItem('snakeSkin');
if (savedSkin && SKINS[savedSkin]) {
    currentSkin = savedSkin;
}

document.getElementById('highScore').textContent = getHighScore();
loadLeaderboard();
drawGame();

// 设置皮肤按钮状态
setTimeout(() => {
    const skinBtns = ['skinClassic', 'skinNeon', 'skinFire', 'skinOcean'];
    skinBtns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('active');
    });
    const activeBtn = document.getElementById('skin' + currentSkin.charAt(0).toUpperCase() + currentSkin.slice(1));
    if (activeBtn) activeBtn.classList.add('active');
}, 100);
