#!/bin/bash
set -e

echo "========================================"
echo "  贪吃蛇后端一键部署脚本"
echo "========================================"

# 配置
APP_DIR="/opt/snake-game"
NGINX_CONF="/etc/nginx/sites-available/game.qinjiang.top"
NGINX_ENABLED="/etc/nginx/sites-enabled/game.qinjiang.top"

# 1. 检查/安装 Node.js
echo "[1/6] 检查 Node.js..."
if ! command -v node &> /dev/null; then
    echo "Node.js 未安装，正在安装..."
    apt-get update -qq
    apt-get install -y -qq nodejs npm curl
    # 如果 apt 安装的 node 版本太低，用 n 或 nvm 升级
    if ! command -v node &> /dev/null; then
        echo "通过 apt 安装失败，尝试用 NodeSource..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y -qq nodejs
    fi
fi
NODE_VER=$(node -v 2>/dev/null || echo "unknown")
echo "  Node.js 版本: $NODE_VER"

# 2. 创建应用目录
echo "[2/6] 创建应用目录..."
mkdir -p "$APP_DIR/public"
cd "$APP_DIR"

# 3. 写 package.json
cat > package.json <<'EOF'
{
  "name": "snake-backend",
  "version": "1.0.0",
  "description": "Snake game leaderboard backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "sqlite3": "^5.1.6"
  }
}
EOF

# 4. 写 server.js
cat > server.js <<'EOF'
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database(path.join(__dirname, 'leaderboard.db'));

db.run(`CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

app.get('/api/leaderboard', (req, res) => {
    db.all(
        `SELECT name, score, created_at FROM leaderboard ORDER BY score DESC LIMIT 50`,
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                success: true,
                data: rows.map((r, i) => ({
                    rank: i + 1,
                    name: r.name,
                    score: r.score
                }))
            });
        }
    );
});

app.post('/api/leaderboard', (req, res) => {
    const { name, score } = req.body;
    if (!name || typeof score !== 'number' || score < 0) {
        return res.status(400).json({ error: '参数错误' });
    }
    if (name.length > 10) {
        return res.status(400).json({ error: '名字最多10个字符' });
    }
    const trimmedName = name.trim();
    db.run(
        `INSERT INTO leaderboard (name, score) VALUES (?, ?)`,
        [trimmedName, score],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const lastId = this.lastID;
            db.run(`DELETE FROM leaderboard WHERE id NOT IN (
                SELECT id FROM leaderboard ORDER BY score DESC LIMIT 50
            )`);
            db.all(
                `SELECT id FROM leaderboard ORDER BY score DESC`,
                (err, rows) => {
                    if (err) return res.status(500).json({ error: err.message });
                    const rank = rows.findIndex(r => r.id === lastId) + 1;
                    res.json({ success: true, rank });
                }
            );
        }
    );
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Snake backend running on http://127.0.0.1:${PORT}`);
});
EOF

# 5. 安装依赖
echo "[3/6] 安装 Node.js 依赖..."
npm install --production

# 6. 前端 index.html
echo "[4/6] 前端文件..."
if [ -f "index.html" ]; then
    cp index.html "$APP_DIR/public/"
    echo "  ✅ 已复制 index.html"
elif [ -f "$APP_DIR/public/index.html" ]; then
    echo "  ✅ 前端文件已存在"
else
    echo "  ⚠️  未找到 index.html，请手动复制到 $APP_DIR/public/"
fi

# 7. 配置 nginx
echo "[5/6] 配置 nginx..."
if [ -d "/etc/nginx/sites-available" ]; then
    cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name game.qinjiang.top;

    location / {
        root $APP_DIR/public;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

    # 检查是否已存在同名配置
    if [ ! -L "$NGINX_ENABLED" ]; then
        ln -s "$NGINX_CONF" "$NGINX_ENABLED"
    fi

    # 测试并重载 nginx
    nginx -t &> /dev/null && systemctl reload nginx || echo "  nginx 重载失败，请手动检查配置"
else
    echo "  未找到 nginx sites-available 目录，跳过 nginx 配置"
    echo "  请手动在 nginx 中添加反向代理配置"
fi

# 8. 创建 systemd 服务
echo "[6/6] 创建 systemd 服务..."
cat > /etc/systemd/system/snake-game.service <<EOF
[Unit]
Description=Snake Game Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable snake-game.service
systemctl restart snake-game.service

echo ""
echo "========================================"
echo "  ✅ 部署完成！"
echo "========================================"
echo "  前端地址: http://game.qinjiang.top"
echo "  API 地址: http://game.qinjiang.top/api/leaderboard"
echo "  后端状态: systemctl status snake-game"
echo "  日志查看: journalctl -u snake-game -f"
echo "========================================"
