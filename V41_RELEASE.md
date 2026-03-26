# 贪吃蛇 v4.1 - 道具系统

## 更新内容

### 🎮 新增道具系统

#### 4种道具类型：

| 道具 | Emoji | 颜色 | 效果 | 持续时间 | 得分倍数 |
|------|-------|------|------|----------|----------|
| 加速 | ⚡ | 红色 | 移动速度翻倍 | 5秒 | x2 |
| 减速 | 🐌 | 蓝色 | 移动速度减半 | 5秒 | x1.5 |
| 穿墙 | 🌀 | 紫色 | 可以穿墙不死 | 5秒 | x1 |
| 双倍积分 | 💎 | 金色 | 得分翻倍 | 10秒 | x2 |

### 道具显示
- 道具在画布上以 emoji + 光晕效果显示
- 拾取后屏幕边缘显示当前生效的道具图标和倒计时
- 支持道具叠加（同时有多个道具效果）

### 生成规则
- 每吃掉3个食物有30%概率生成一个道具
- 道具在地图上持续8秒，过期消失
- 同时最多存在2个道具

---

## 本地测试方法

### 方式1：直接打开
1. 在文件管理器中打开 `index.html`
2. 使用浏览器直接访问即可游戏

### 方式2：本地服务器
```bash
cd snake-game
python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

### 方式3：Node.js
```bash
cd snake-game
npx serve .
```

---

## GitHub 部署步骤

由于 GitHub 更新了认证方式，请按以下步骤手动推送：

### 方法1：使用 GitHub Desktop
1. 下载 GitHub Desktop
2. 添加本地仓库 `snake-game` 文件夹
3. 提交更改并推送

### 方法2：使用 Personal Access Token
1. 访问 https://github.com/settings/tokens
2. 创建新的 Token (classic)，勾选 `repo` 权限
3. 使用以下命令推送：
```bash
cd snake-game
git remote set-url origin https://YOUR_USERNAME:YOUR_TOKEN@github.com/haley-zhai/snake-game.git
git push origin main
```

### 方法3：使用 SSH
```bash
# 配置 SSH 密钥后
git remote set-url origin git@github.com:haley-zhai/snake-game.git
git push origin main
```

---

## 代码修改摘要

### game.js 关键修改：

1. **版本号更新**: `VERSION = 'v4.1'`

2. **道具系统配置**:
```javascript
const POWERUP_TYPES = {
    SPEED: { emoji: '⚡', color: '#ff4444', duration: 5000, scoreMultiplier: 2 },
    SLOW: { emoji: '🐌', color: '#4488ff', duration: 5000, scoreMultiplier: 1.5 },
    GHOST: { emoji: '🌀', color: '#aa44ff', duration: 5000, scoreMultiplier: 1 },
    DOUBLE: { emoji: '💎', color: '#ffcc00', duration: 10000, scoreMultiplier: 2 }
};
```

3. **道具生成逻辑**:
```javascript
// 每吃掉3个食物检查生成
if (foodEatenCount % 3 === 0) {
    if (Math.random() < 0.3) spawnPowerUp();
}
```

4. **得分倍数计算**:
```javascript
function getScoreMultiplier() {
    let multiplier = 1;
    activePowerUps.forEach(p => {
        multiplier *= p.type.scoreMultiplier;
    });
    return multiplier;
}
```

5. **穿墙模式检测**:
```javascript
function hasGhostMode() {
    return activePowerUps.some(p => p.type === POWERUP_TYPES.GHOST);
}
```

### index.html 关键修改：

1. **版本标识**: `⚡ v4.1 道具版`

2. **道具状态显示区域**:
```html
<div class="powerup-status" id="activePowerUps"></div>
```

3. **道具图例**:
```html
<div class="powerup-legend">
    <div class="powerup-legend-item"><span>⚡</span> 加速x2</div>
    <div class="powerup-legend-item"><span>🐌</span> 减速x1.5</div>
    <div class="powerup-legend-item"><span>🌀</span> 穿墙</div>
    <div class="powerup-legend-item"><span>💎</span> 双倍x2</div>
</div>
```

4. **道具徽章样式**:
```css
.powerup-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 20px;
    border: 2px solid;
    animation: powerupPulse 1s ease-in-out infinite;
}
```

---

## 测试检查清单

- [ ] 开始游戏后正常移动
- [ ] 吃3个食物后有概率生成道具
- [ ] 道具显示 emoji 和光晕效果
- [ ] 拾取道具后屏幕显示道具状态
- [ ] ⚡ 加速道具使蛇速度翻倍
- [ ] 🐌 减速道具使蛇速度减半
- [ ] 🌀 穿墙道具可以穿墙不死
- [ ] 💎 双倍积分道具得分翻倍
- [ ] 道具叠加时效果正确计算
- [ ] 道具倒计时结束后效果消失
- [ ] 地图上的道具8秒后自动消失
- [ ] 同时最多只显示2个道具
- [ ] 分数正确计算（考虑倍数）
- [ ] 游戏结束后排行榜正常显示

---

## 已知问题

无

## 后续优化建议

1. 添加更多道具类型（如： magnet 自动吸附食物、shrink 缩短蛇身）
2. 道具连击奖励
3. 道具商店系统
4. 道具效果视觉特效增强
