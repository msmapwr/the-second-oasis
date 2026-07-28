#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  《第二绿洲》一键部署脚本 (macOS / Linux / Git Bash)
#  功能：检查环境 → 安装依赖 → 类型检查 → 编译构建
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
echo -e " ║     一键部署脚本  v1.0                      ║"
echo -e " ╚══════════════════════════════════════════════╝${NC}"
echo ""

# ---- Step 1: 检查 Node.js ----
echo -e "${YELLOW}[1/5]${NC} 检查 Node.js 环境..."
if ! command -v node &>/dev/null; then
    echo -e "  ${RED}[错误]${NC} 未找到 Node.js，请先安装 Node.js >= 18"
    echo "          https://nodejs.org/"
    exit 1
fi

NODE_VER=$(node -v)
NPM_VER=$(npm -v)
echo "  Node.js 版本: $NODE_VER"
echo "  npm    版本: $NPM_VER"
echo -e "  ${GREEN}[√]${NC} 环境检查通过"

# ---- Step 2: 清理旧构建 ----
echo ""
echo -e "${YELLOW}[2/5]${NC} 清理旧构建产物..."
rm -rf dist
echo "  已删除 dist/"
rm -rf node_modules/.vite 2>/dev/null && echo "  已清除 Vite 缓存" || true
echo -e "  ${GREEN}[√]${NC} 清理完成"

# ---- Step 3: 安装依赖 ----
echo ""
echo -e "${YELLOW}[3/5]${NC} 安装项目依赖..."
if [ -d "node_modules" ]; then
    echo "  已存在 node_modules，跳过安装"
    echo "  如需重新安装，请先手动删除 node_modules"
else
    npm install --loglevel=warn
fi
echo -e "  ${GREEN}[√]${NC} 依赖就绪"

# ---- Step 4: 类型检查 ----
echo ""
echo -e "${YELLOW}[4/5]${NC} TypeScript 类型检查..."
npx tsc --noEmit
echo -e "  ${GREEN}[√]${NC} 类型检查通过，零错误"

# ---- Step 5: 构建 ----
echo ""
echo -e "${YELLOW}[5/5]${NC} 生产构建..."
npx vite build
echo -e "  ${GREEN}[√]${NC} 构建完成"

# ---- 完成 ----
echo ""
echo -e "${CYAN} ╔══════════════════════════════════════════════╗"
echo -e " ║  部署成功！                                 ║"
echo -e " ║  产物目录: dist/                            ║"
echo -e " ║  运行 start.sh 或 npm run preview 启动      ║"
echo -e " ╚══════════════════════════════════════════════╝${NC}"
echo ""
