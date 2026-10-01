@echo off
title JARVIS - Local Server
color 0B
cd /d "%~dp0"

echo.
echo  ============================================
echo   JARVIS - Personal AI Assistant
echo  ============================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found!
    echo  Install from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0server.js" (
    echo  [ERROR] server.js not found!
    pause
    exit /b 1
)

echo  Server starting on http://localhost:3000
echo  DO NOT close this window while using JARVIS.
echo  Press Ctrl+C to stop.
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

node "%~dp0server.js"

echo.
echo  Server stopped. Press any key to close.
pause >nul