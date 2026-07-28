#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  《第二绿洲》一键启动脚本 (macOS / Linux / Git Bash)
#  功能：选择启动模式 → 启动服务
#  v1.0
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# ---- 颜色 ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN} ╔══════════════════════════════════════════════╗"
echo -e " ║     《第二绿洲》The Second Oasis            ║"
echo -e " ║     一键启动脚本  v1.0                      ║"
echo -e " ╚══════════════════════════════════════════════╝${NC}"
echo ""
echo "  请选择启动模式:"
echo ""
echo "    [1] 开发模式 (Vite HMR 热更新, 仅前端)"
echo "    [2] 联机模式 (前端 + WebSocket 服务器, 端口 9528)"
echo "    [3] 预览模式 (预览构建产物 dist/)"
echo "    [4] 测试模式 (运行全部测试)"
echo ""

read -r -p "  请输入选项 [1-4] (默认 1): " MODE
MODE=${MODE:-1}

case "$MODE" in
  1)
    echo ""
    echo -e "${CYAN}── 开发模式启动 ──${NC}"
    echo "  前端地址: http://localhost:5173"
    echo "  按 Ctrl+C 停止"
    echo ""
    npx vite --open
    ;;
  2)
    echo ""
    echo -e "${CYAN}── 联机模式启动 ──${NC}"
    echo "  前端地址: http://localhost:5173"
    echo "  服务端地址: ws://localhost:9528"
    echo "  按 Ctrl+C 停止"
    echo ""
    npx tsx server/index.ts &
    SERVER_PID=$!
    sleep 1
    # 注册清理：Ctrl+C 时同时关闭服务端
    cleanup() {
      echo ""
      echo -e "${YELLOW}正在关闭服务端...${NC}"
      kill "$SERVER_PID" 2>/dev/null
      wait "$SERVER_PID" 2>/dev/null
    }
    trap cleanup EXIT INT TERM
    npx vite --open
    ;;
  3)
    if [ ! -d "dist" ]; then
      echo ""
      echo -e "  ${RED}[错误]${NC} 未找到 dist/ 目录，请先运行 deploy.sh 构建"
      exit 1
    fi
    echo ""
    echo -e "${CYAN}── 预览模式启动 ──${NC}"
    echo "  预览地址: http://localhost:4173"
    echo "  按 Ctrl+C 停止"
    echo ""
    npx vite preview --open
    ;;
  4)
    echo ""
    echo -e "${CYAN}── 测试模式 ──${NC}"
    echo ""
    npx vitest run
    ;;
  *)
    echo -e "  ${RED}无效选项${NC}"
    exit 1
    ;;
esac
