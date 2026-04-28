const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 3001;

// 允许 GitHub Pages 和域名访问
app.use(cors({
  origin: ['https://haley-zhai.github.io', 'http://game.qinjiang.top', 'https://game.qinjiang.top', 'http://localhost:8080'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// SQLite 数据库
const db = new sqlite3.Database(path.join(__dirname, 'leaderboard.db'));

// 初始化表
db.run(`CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 获取排行榜 - GET /api/leaderboard
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

// 提交分数 - POST /api/leaderboard
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

            // 清理超出50条的记录
            db.run(`DELETE FROM leaderboard WHERE id NOT IN (
                SELECT id FROM leaderboard ORDER BY score DESC LIMIT 50
            )`);

            // 返回排名
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
