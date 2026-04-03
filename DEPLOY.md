# 🐍 贪吃蛇 v4-v5 版本部署说明

## 📦 文件清单

本次交付包含以下文件：

| 文件 | 说明 |
|------|------|
| `game.js` | 游戏核心代码 (v5.0 终极版) |
| `index.html` | 游戏页面 |
| `style.css` | 样式文件 |
| `manifest.json` | PWA配置 |
| `sw.js` | Service Worker (离线支持) |

## ✨ 版本功能

### v4.1 道具系统版
- ⚡ 加速道具 - 速度翻倍，得分x2
- 🐌 减速道具 - 速度减半，得分x1.5
- 🌀 穿墙道具 - 5秒内可穿墙
- 💎 双倍积分 - 10秒内得分翻倍
- 道具光晕效果 + 倒计时UI

### v4.2 视觉革命版
- 动态渐变背景
- 3D阴影效果
- 粒子爆发特效
- 蛇身光晕拖尾
- 食物旋转动画

### v4.5 AI对战版
- 智能AI蛇对手
- 路径自动寻路
- 单人vs AI模式
- AI自动避障

### v5.0 终极形态版
- PWA支持（可添加到主屏幕）
- 离线可玩
- 全功能整合

## 🚀 部署方法（选一）

### 方法一：GitHub CLI（推荐）

```bash
# 1. 安装 GitHub CLI
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh -y

# 2. 登录（浏览器会打开授权页面）
gh auth login

# 3. 进入项目目录并推送
cd /root/.openclaw/workspace/snake-game
git push origin HEAD:main --force
```

### 方法二：手动上传

1. 在GitHub创建新仓库 `snake-game`
2. 下载代码：`/root/snake-game-v4-v5.tar.gz`
3. 解压后上传到仓库
4. 启用 GitHub Pages（Settings → Pages → Source: main branch）

### 方法三：GitHub Desktop

1. 下载 GitHub Desktop
2. 克隆仓库到本地
3. 复制代码文件到仓库目录
4. 提交并推送

## 🔗 访问地址

部署成功后访问：
```
https://haley-zhai.github.io/snake-game/
```

## 📱 PWA安装

1. 用手机浏览器访问链接
2. 点击"添加到主屏幕"
3. 离线也能玩！

## 📝 代码统计

```
game.js    : 1376 行 (道具+视觉+AI+PWA)
index.html : 794 行
style.css  : 已有
manifest   : 35 行
sw.js      : 53 行
```

## 🎯 快速测试

```bash
# 本地测试
cd /root/.openclaw/workspace/snake-game
python3 -m http.server 8080
# 访问 http://localhost:8080
```

---
生成时间: 2026-03-27
