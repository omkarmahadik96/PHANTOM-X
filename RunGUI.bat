@echo off
chcp 65001 >nul
title AllHackingTools — Kali Security Console
color 0A

echo.
echo  ================================================
echo    AllHackingTools — Kali Security Console v4.0
echo  ================================================
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Python not found in PATH!
    echo  Install Python 3 from https://python.org
    pause
    exit /b 1
)

:: Kill any old instance on port 5000
echo  [*] Checking for existing server on port 5000...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5000 "') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Install required packages silently
echo  [*] Checking dependencies...
python -m pip install flask flask-socketio eventlet --quiet --disable-pip-version-check >nul 2>&1

:: Short delay then open browser
echo  [*] Starting server...
timeout /t 2 /nobreak >nul
start "" "http://localhost:5000"

echo.
echo  [+] Dashboard: http://localhost:5000
echo  [+] Close this window to stop the server.
echo.

:: Run server
python gui_server.py

pause
