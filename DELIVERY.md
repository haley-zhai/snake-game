# 🐍 贪吃蛇 v4.1 - 道具系统开发完成

## ✅ 已完成的功能

### 1. 四种道具类型
| 道具 | Emoji | 颜色 | 效果 | 持续时间 | 得分倍数 |
|------|-------|------|------|----------|----------|
| 加速 | ⚡ | 红色 | 移动速度翻倍 | 5秒 | x2 |
| 减速 | 🐌 | 蓝色 | 移动速度减半 | 5秒 | x1.5 |
| 穿墙 | 🌀 | 紫色 | 可以穿墙不死 | 5秒 | x1 |
| 双倍积分 | 💎 | 金色 | 得分翻倍 | 10秒 | x2 |

### 2. 道具显示
- ✅ 道具在画布上以 emoji + 光晕效果显示
- ✅ 拾取后屏幕顶部显示当前生效的道具图标和倒计时
- ✅ 支持道具叠加（同时有多个道具效果）

### 3. 生成规则
- ✅ 每吃掉3个食物有30%概率生成一个道具
- ✅ 道具在地图上持续8秒，过期消失
- ✅ 同时最多存在2个道具

### 4. 版本更新
- ✅ 版本号更新到 v4.1
- ✅ 标题显示 "⚡ v4.1 道具版"

---

## 📁 修改的文件

1. **game.js** - 添加道具系统核心逻辑
2. **index.html** - 添加道具UI显示和样式
3. **netlify.toml** - 修复格式问题
4. **V41_RELEASE.md** - 发布说明文档

---

## 🔧 关键代码片段

### game.js - 道具配置
```javascript
const POWERUPS = {
    speed: { emoji: '⚡', color: '#ff4444', duration: 5000, multiplier: 2, name: '加速' },
    slow: { emoji: '🐌', color: '#4444ff', duration: 5000, multiplier: 1.5, name: '减速' },
    ghost: { emoji: '🌀', color: '#9944ff', duration: 5000, multiplier: 1, name: '穿墙' },
    double: { emoji: '💎', color: '#ffd700', duration: 10000, multiplier: 2, name: '双倍' }
};
```

### game.js - 道具生成
```javascript
function spawnPowerup() {
    if (powerups.length >= 2) return; // 最多2个道具
    
    const types = Object.keys(POWERUPS);
    const type = types[Math.floor(Math.random() * types.length)];
    
    // 随机位置生成道具...
    powerups.push({ x, y, type, createdAt: Date.now() });
}

// 每吃掉3个食物检查生成
if (foodSinceLastPowerup >= 3) {
    foodSinceLastPowerup = 0;
    if (Math.random() < 0.3) spawnPowerup(); // 30%概率
}
```

### game.js - 道具效果应用
```javascript
function updatePowerupEffects() {
    let speedMod = 1;
    scoreMultiplier = 1;
    
    for (const [type, data] of Object.entries(activePowerups)) {
        if (Date.now() < data.expiresAt) {
            if (type === 'speed') speedMod *= 0.5;  // 速度翻倍
            if (type === 'slow') speedMod *= 2;     // 速度减半
            if (type === 'ghost') /* 穿墙模式 */;
            scoreMultiplier = Math.max(scoreMultiplier, data.multiplier);
        }
    }
    
    currentSpeed = baseSpeed * speedMod;
}
```

### game.js - 穿墙检测
```javascript
const isGhost = activePowerups.ghost && Date.now() < activePowerups.ghost.expiresAt;

if (!isGhost) {
    // 正常撞墙检测
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        gameOver();
        return;
    }
} else {
    // 穿墙处理
    if (head.x < 0) head.x = tileCount - 1;
    if (head.x >= tileCount) head.x = 0;
    if (head.y < 0) head.y = tileCount - 1;
    if (head.y >= tileCount) head.y = 0;
}
```

### index.html - 道具状态显示
```html
<!-- 道具状态区域 -->
<div class="powerup-status" id="activePowerups"></div>

<!-- 道具UI样式 -->
<style>
.powerup-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 20px;
    border: 2px solid var(--pu-color);
    animation: powerupPulse 1s ease-in-out infinite;
}
</style>
```

---

## 🧪 本地测试方法

### 方式1：直接打开（最简单）
```bash
# 在文件管理器中双击 index.html
# 或用浏览器打开
open /root/.openclaw/workspace/snake-game/index.html
```

### 方式2：Python 本地服务器
```bash
cd /root/.openclaw/workspace/snake-game
python3 -m http.server 8080
# 访问 http://localhost:8080
```

### 方式3：Node.js
```bash
cd /root/.openclaw/workspace/snake-game
npx serve . -p 8080
```

---

## 📤 GitHub 推送方法

由于 GitHub 已更新认证方式，请使用以下方法之一推送：

### 方法1：使用 GitHub CLI（推荐）
```bash
# 安装 GitHub CLI
sudo apt install gh

# 登录
gh auth login

# 推送
cd /root/.openclaw/workspace/snake-game
gh repo create haley-zhai/snake-game --public --source=. --push
```

### 方法2：使用 Personal Access Token
```bash
# 1. 访问 https://github.com/settings/tokens
# 2. 创建新的 Token (classic)，勾选 repo 权限
# 3. 推送
cd /root/.openclaw/workspace/snake-game
git remote set-url origin https://haley-zhai:YOUR_NEW_TOKEN@github.com/haley-zhai/snake-game.git
git push origin HEAD:v4.1-powerups
```

### 方法3：使用 SSH
```bash
# 配置 SSH 密钥后
git remote set-url origin git@github.com:haley-zhai/snake-game.git
git push origin HEAD:v4.1-powerups
```

---

## 🎯 道具功能测试说明

### 测试步骤：

1. **启动游戏**
   - 打开游戏页面
   - 点击"开始游戏"或按方向键

2. **道具生成测试**
   - 吃掉3个食物
   - 观察是否有30%概率生成道具
   - 确认地图上最多2个道具

3. **道具拾取测试**
   - 移动蛇吃到道具
   - 确认播放拾取音效
   - 确认屏幕顶部显示道具状态

4. **各道具效果测试**

   | 道具 | 测试方法 | 预期结果 |
   |------|----------|----------|
   | ⚡ 加速 | 拾取后观察移动速度 | 蛇移动明显变快 |
   | 🐌 减速 | 拾取后观察移动速度 | 蛇移动明显变慢 |
   | 🌀 穿墙 | 拾取后撞墙 | 从对面出现，不死亡 |
   | 💎 双倍 | 拾取后吃食物 | 分数增加20分(10x2) |

5. **道具叠加测试**
   - 同时拾取多个道具
   - 确认多个效果同时生效
   - 确认UI显示多个道具倒计时

6. **道具过期测试**
   - 等待道具倒计时结束
   - 确认效果消失
   - 确认UI不再显示该道具

7. **地图道具过期测试**
   - 观察地图上的道具
   - 等待8秒后确认自动消失

---

## 📂 项目位置

所有修改后的代码位于：
```
/root/.openclaw/workspace/snake-game/
├── game.js          # 游戏逻辑（道具系统）
├── index.html       # 页面（道具UI）
├── netlify.toml     # 部署配置
└── V41_RELEASE.md   # 发布说明
```

---

## 📝 提交信息

```
v4.1: Add power-up system with 4 types

- Add 4 power-up types: speed(⚡), slow(🐌), ghost(🌀), double(💎)
- Add power-up spawn logic: 30% chance every 3 foods
- Add power-up display with emoji and glow effect
- Add active power-up UI with countdown
- Support power-up stacking effects
- Update version to v4.1
```

---

## 🔗 部署链接

代码已准备就绪，推送后可访问：
- GitHub Pages: `https://haley-zhai.github.io/snake-game`
- 或 Netlify: 连接仓库后自动部署

本地测试地址：
- `file:///root/.openclaw/workspace/snake-game/index.html`
- 或 `http://localhost:8080` (使用本地服务器)
