@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Ziwei-Doushu Local Site

echo ============================================
echo   Ziwei Doushu - Production Server
echo ============================================
echo.
echo   Local URL: http://localhost:3000
echo   Press Ctrl+C to stop
echo.

netstat -ano | findstr /r /c:":3000 .*LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [INFO] Port 3000 is already in use.
    echo        If the site is already running, open http://localhost:3000
    echo.
    pause
    goto :eof
)

if not exist "node_modules" (
    echo [1/4] Installing dependencies...
    call npm install
    if errorlevel 1 goto :fail
) else (
    echo [1/4] Dependencies ready.
)

if not exist ".data\ziwei.db" (
    echo [2/4] Initializing account database...
    call npm run db:init
    if errorlevel 1 goto :fail
) else (
    echo [2/4] Account database ready.
)

if not exist ".next\BUILD_ID" (
    echo [3/4] Building production site...
    call npm run build
    if errorlevel 1 goto :fail
) else (
    echo [3/4] Production build ready.
)

echo [4/4] Starting server...
call npm start
goto :eof

:fail
echo.
echo [ERROR] Setup failed. See the message above.
pause
