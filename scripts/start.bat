@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================================
::  《第二绿洲》一键启动脚本
::  功能：选择启动模式 → 启动服务
::  v1.0
:: ============================================================

set "PROJECT_DIR=%~dp0.."
cd /d "%PROJECT_DIR%"

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║     《第二绿洲》The Second Oasis            ║
echo  ║     一键启动脚本  v1.0                      ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo  请选择启动模式:
echo.
echo    [1] 开发模式 (Vite HMR 热更新, 仅前端)
echo    [2] 联机模式 (前端 + WebSocket 服务器, 端口 9528)
echo    [3] 预览模式 (预览构建产物 dist/)
echo    [4] 测试模式 (运行全部测试)
echo.
set /p MODE="  请输入选项 [1-4] (默认 1): "

if "%MODE%"=="" set MODE=1
if "%MODE%"=="1" goto DEV
if "%MODE%"=="2" goto FULL
if "%MODE%"=="3" goto PREVIEW
if "%MODE%"=="4" goto TEST
echo   无效选项，默认使用开发模式
goto DEV

:DEV
echo.
echo ── 开发模式启动 ──
echo   前端地址: http://localhost:5173
echo   按 Ctrl+C 停止
echo.
call npx vite --open
goto END

:FULL
echo.
echo ── 联机模式启动 ──
echo   前端地址: http://localhost:5173
echo   服务端地址: ws://localhost:9528
echo   按 Ctrl+C 停止
echo.
start "第二绿洲-服务端" cmd /c "npx tsx server/index.ts"
timeout /t 2 >nul
call npx vite --open
goto END

:PREVIEW
if not exist "dist" (
    echo.
    echo   [错误] 未找到 dist/ 目录，请先运行 deploy.bat 构建
    pause
    exit /b 1
)
echo.
echo ── 预览模式启动 ──
echo   预览地址: http://localhost:4173
echo   按 Ctrl+C 停止
echo.
call npx vite preview --open
goto END

:TEST
echo.
echo ── 测试模式 ──
echo.
call npx vitest run
goto END

:END
echo.
pause
