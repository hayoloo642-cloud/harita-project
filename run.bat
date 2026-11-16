@echo off
REM MyAct — jalankan server lokal lalu buka dashboard (Windows)
set "PORT=8777"
if not "%MYACT_PORT%"=="" set "PORT=%MYACT_PORT%"
if not "%MYACT_TAB%"=="" set "MYACT_TAB=%MYACT_TAB%"

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Python tidak ditemukan. Install dari https://python.org lalu coba lagi.
    pause
    exit /b 1
)

start /b python server.py
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:%PORT%"
