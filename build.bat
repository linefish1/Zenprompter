@echo off
chcp 65001 >nul
title ZenPrompter 构建工具
echo ============================================
echo   ZenPrompter 一键构建脚本
echo ============================================
echo.

:: 检查 Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未找到 Node.js！请先安装 Node.js：https://nodejs.org/
    pause
    exit /b 1
)
echo [✓] Node.js 已找到:
node -v

:: 检查 npm
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未找到 npm！
    pause
    exit /b 1
)
echo [✓] npm 已找到:
npm -v
echo.

:: 安装依赖
echo [1/3] 正在安装依赖...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 依赖安装失败！
    pause
    exit /b 1
)
echo [✓] 依赖安装完成
echo.

:: 清理旧的构建
echo [2/3] 正在构建 Web 版本...
if exist dist rmdir /s /q dist

:: 构建 Web
call npm run build:web
if %ERRORLEVEL% NEQ 0 (
    echo [错误] Web 构建失败！
    pause
    exit /b 1
)
echo [✓] Web 构建完成
echo.

:: Android 构建选项
echo ============================================
echo   Web 构建已完成！输出目录：dist/
echo ============================================
echo.
echo  如需打包 Android APK，请确保已配置：
echo   - Android SDK
echo   - Android Studio
echo   - Gradle
echo.
echo  然后运行: npm run build:android
echo.
echo ============================================
echo  构建完成！
pause
