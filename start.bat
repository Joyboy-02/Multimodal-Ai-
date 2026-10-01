@echo off
title JARVIS - AI Assistant Server
color 0B
cd /d "%~dp0"

echo.
echo  ==========================================
echo   JARVIS - Personal AI Assistant
echo  ==========================================
echo.

:: Kill any stale processes on our ports
for %%p in (3000 3001 3002 8080 8081) do (
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%%p "') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  [ERROR] Node.js is NOT installed.
    echo.
    echo  Download from: https://nodejs.org/en/download
    echo  Install it, then run this file again.
    echo.
    pause
    exit /b 1
)

:: Check server.js exists
if not exist "%~dp0server.js" (
    color 0C
    echo  [ERROR] server.js missing from: %~dp0
    pause
    exit /b 1
)

echo  Starting server...
echo.

:: Start server in background, capture port
start "" /B node "%~dp0server.js"

:: Wait for server to be ready (check port 3000)
echo  Waiting for server to be ready...
:WAIT
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":3000 " >nul 2>&1
if %errorlevel% neq 0 (
    netstat -ano | findstr ":3001 " >nul 2>&1
    if %errorlevel% neq 0 goto WAIT
    set JARVIS_URL=http://127.0.0.1:3001
    goto OPEN
)
set JARVIS_URL=http://127.0.0.1:3000

:OPEN
echo  Server is READY!
echo.
echo  ==========================================
echo   Open this in Chrome or Edge:
echo   %JARVIS_URL%
echo  ==========================================
echo.
echo  Opening browser automatically...
start "" "%JARVIS_URL%"

echo.
echo  Server is running. DO NOT close this window.
echo  Press any key to STOP the server.
echo.
pause >nul

:: Kill server on exit
for %%p in (3000 3001 3002 8080 8081) do (
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%%p "') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)
echo  Server stopped.