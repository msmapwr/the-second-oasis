@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================================
::  《第二绿洲》一键部署脚本
::  功能：检查环境 → 安装依赖 → 类型检查 → 编译构建
::  v1.0
:: ============================================================

set "PROJECT_DIR=%~dp0.."
cd /d "%PROJECT_DIR%"

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║     《第二绿洲》The Second Oasis            ║
echo  ║     一键部署脚本  v1.0                      ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: ---- Step 1: 检查 Node.js ----
echo [1/5] 检查 Node.js 环境...
where node >nul 2>&1
if errorlevel 1 (
    echo   [错误] 未找到 Node.js，请先安装 Node.js ^>= 18
    echo          https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set "NODE_VER=%%i"
echo   Node.js 版本: %NODE_VER%

for /f "tokens=*" %%i in ('npm -v') do set "NPM_VER=%%i"
echo   npm    版本: %NPM_VER%
echo   [√] 环境检查通过

:: ---- Step 2: 清理旧构建 ----
echo.
echo [2/5] 清理旧构建产物...
if exist "dist" (
    rmdir /s /q "dist"
    echo   已删除 dist/
)
if exist "node_modules\.vite" (
    rmdir /s /q "node_modules\.vite"
    echo   已清除 Vite 缓存
)
echo   [√] 清理完成

:: ---- Step 3: 安装依赖 ----
echo.
echo [3/5] 安装项目依赖...
if exist "node_modules" (
    echo   已存在 node_modules，跳过安装
    echo   如需重新安装，请先手动删除 node_modules
) else (
    call npm install --loglevel=warn
    if errorlevel 1 (
        echo   [错误] npm install 失败
        pause
        exit /b 1
    )
)
echo   [√] 依赖就绪

:: ---- Step 4: 类型检查 ----
echo.
echo [4/5] TypeScript 类型检查...
call npx tsc --noEmit
if errorlevel 1 (
    echo   [错误] 类型检查未通过，请修复后重试
    pause
    exit /b 1
)
echo   [√] 类型检查通过，零错误

:: ---- Step 5: 构建 ----
echo.
echo [5/5] 生产构建...
call npx vite build
if errorlevel 1 (
    echo   [错误] 构建失败
    pause
    exit /b 1
)
echo   [√] 构建完成

:: ---- 完成 ----
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║  部署成功！                                 ║
echo  ║  产物目录: dist\                            ║
echo  ║  运行 start.bat 或 npm run preview 启动     ║
echo  ╚══════════════════════════════════════════════╝
echo.

pause
