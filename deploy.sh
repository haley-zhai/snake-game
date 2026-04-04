#!/bin/bash
# 腾讯云 CloudBase 部署脚本

echo "=== 贪吃蛇游戏部署脚本 ==="
echo ""

# 检查是否安装了 cloudbase-cli
if ! command -v cloudbase &> /dev/null; then
    echo "正在安装 cloudbase-cli..."
    npm install -g @cloudbase/cli
fi

# 登录腾讯云
echo "请登录腾讯云账号..."
cloudbase login

# 部署到静态托管
echo ""
echo "正在部署到 CloudBase 静态托管..."
cloudbase hosting deploy ./index.html snake-game -e snake-game-5gvtkwf262c3ddc4

echo ""
echo "=== 部署完成 ==="
echo "访问地址: https://snake-game-5gvtkwf262c3ddc4.tcloudbaseapp.com"
