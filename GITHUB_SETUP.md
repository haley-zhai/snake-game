# GitHub Issues 排行榜配置指南

## 第一步：创建 GitHub Token

1. 登录 GitHub，点击右上角头像 → Settings
2. 左侧最下面找到 **Developer settings** → **Personal access tokens** → **Tokens (classic)**
3. 点击 **Generate new token (classic)**
4. 填写 Note: `Snake Game Leaderboard`
5. 有效期选择 **No expiration** (或自定义)
6. 勾选权限：
   - ✅ `repo` (完整的仓库权限)
   - 或者最小权限：`public_repo` (仅公开仓库)
7. 点击 Generate token
8. **复制生成的 Token**（只显示一次！）

## 第二步：配置游戏

把 Token 填到 `config.js` 里（下面会生成这个文件）。

Token 格式：`ghp_xxxxxxxxxxxxxxxx`

---

**注意**：这个 Token 有写权限，不要分享给其他人。如果你的仓库是公开的，建议用 Cloudflare Worker 中转来隐藏 Token。
