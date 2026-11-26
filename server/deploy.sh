#!/usr/bin/env bash
# 全局世界书管理 · 反馈接收服务 一键部署脚本（Ubuntu/Debian）
# 用法（在 FinalShell 等 SSH 终端里，root 或 sudo 用户执行）：
#   curl -fsSL https://cdn.jsdelivr.net/gh/nfmtZXNF/wb-manager@main/server/deploy.sh | bash
set -euo pipefail

TOKEN="${1:-4a3d80e2e77ce903595b61bc0b08cf0d8579}"
APP_DIR="/opt/wb-feedback"
NODE_VER="v20.18.1"
CDN_BASE="https://cdn.jsdelivr.net/gh/nfmtZXNF/wb-manager@main/server"

echo "======================================"
echo "  全局世界书管理 · 反馈服务一键部署"
echo "======================================"

SUDO=""
if [ "$(id -u)" != "0" ]; then
  if command -v sudo >/dev/null 2>&1; then SUDO="sudo"; else
    echo "请用 root 用户运行，或先安装 sudo。"; exit 1
  fi
fi

# ---------- 1. 安装 Node.js（优先用国内 npmmirror 二进制，免编译） ----------
need_node=1
if command -v node >/dev/null 2>&1; then
  major=$(node -v | sed 's/v\([0-9]*\).*/\1/')
  [ "$major" -ge 18 ] && need_node=0
fi
if [ "$need_node" = "1" ]; then
  echo "[1/5] 安装 Node.js ${NODE_VER} ..."
  arch=$(uname -m)
  case "$arch" in
    x86_64) narch="x64" ;;
    aarch64|arm64) narch="arm64" ;;
    *) echo "不支持的架构: $arch"; exit 1 ;;
  esac
  tmp=$(mktemp -d)
  curl -fsSL "https://registry.npmmirror.com/-/binary/node/${NODE_VER}/node-${NODE_VER}-linux-${narch}.tar.xz" -o "$tmp/node.tar.xz"
  $SUDO mkdir -p /usr/local/lib/nodejs
  $SUDO tar -xJf "$tmp/node.tar.xz" -C /usr/local/lib/nodejs
  $SUDO ln -sf "/usr/local/lib/nodejs/node-${NODE_VER}-linux-${narch}/bin/node" /usr/local/bin/node
  $SUDO ln -sf "/usr/local/lib/nodejs/node-${NODE_VER}-linux-${narch}/bin/npm" /usr/local/bin/npm
  rm -rf "$tmp"
else
  echo "[1/5] 已有 Node.js $(node -v)，跳过安装。"
fi

# ---------- 2. 下载服务端文件 ----------
echo "[2/5] 下载反馈服务文件到 ${APP_DIR} ..."
$SUDO mkdir -p "$APP_DIR"
$SUDO curl -fsSL "${CDN_BASE}/feedback-server.js" -o "$APP_DIR/feedback-server.js"
$SUDO curl -fsSL "${CDN_BASE}/package.json" -o "$APP_DIR/package.json"

# ---------- 3. 安装依赖 ----------
echo "[3/5] 安装依赖 ..."
cd "$APP_DIR"
$SUDO /usr/local/bin/npm install --omit=dev --registry=https://registry.npmmirror.com

# ---------- 4. 写配置（已存在则不覆盖） ----------
if [ ! -f "$APP_DIR/config.json" ]; then
  echo "[4/5] 生成 config.json ..."
  $SUDO tee "$APP_DIR/config.json" >/dev/null <<EOF
{
  "token": "${TOKEN}",
  "httpPort": 8437
}
EOF
else
  echo "[4/5] config.json 已存在，保留原配置。"
fi

# ---------- 5. systemd 常驻 + 防火墙 ----------
echo "[5/5] 注册 systemd 服务并启动 ..."
$SUDO tee /etc/systemd/system/wb-feedback.service >/dev/null <<EOF
[Unit]
Description=wb-manager feedback server
After=network.target

[Service]
WorkingDirectory=${APP_DIR}
ExecStart=/usr/local/bin/node feedback-server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
$SUDO systemctl daemon-reload
$SUDO systemctl enable wb-feedback
$SUDO systemctl restart wb-feedback

if command -v ufw >/dev/null 2>&1 && $SUDO ufw status 2>/dev/null | grep -q "Status: active"; then
  echo "检测到 ufw 已启用，放通 8437 ..."
  $SUDO ufw allow 8437/tcp >/dev/null || true
fi

IP=$(curl -fsSL --max-time 5 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo ""
echo "======================================"
echo "  部署完成！服务状态："
systemctl --no-pager --full status wb-feedback 2>/dev/null | head -5 || true
echo ""
echo "  反馈箱查看页： http://${IP}:8437/?token=${TOKEN}"
echo ""
echo "  还差一步（脚本替你做不了的）："
echo "  腾讯云控制台 → 轻量服务器 → 防火墙，放通 TCP 8437"
echo "======================================"
