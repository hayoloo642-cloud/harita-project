@echo off
REM Harita — jalankan server lokal lalu buka dashboard (Windows)
setlocal EnableExtensions
set "PORT=8777"
if not "%HARITA_PORT%"=="" set "PORT=%HARITA_PORT%"
if "%HARITA_PORT%"=="" if not "%MYACT_PORT%"=="" set "PORT=%MYACT_PORT%"

cd /d "%~dp0"
if not exist data mkdir data

REM Temukan interpreter Python: py -3, python, atau python3.
set "PYTHON_CMD="
py -3 -c "import sys; print(sys.version)" >nul 2>&1
if not errorlevel 1 set "PYTHON_CMD=py -3"
if "%PYTHON_CMD%"=="" (
  python -c "import sys; print(sys.version)" >nul 2>&1
  if not errorlevel 1 set "PYTHON_CMD=python"
)
if "%PYTHON_CMD%"=="" (
  python3 -c "import sys; print(sys.version)" >nul 2>&1
  if not errorlevel 1 set "PYTHON_CMD=python3"
)
if "%PYTHON_CMD%"=="" (
  echo ERROR: Python tidak ditemukan.
  echo Install Python 3.10+ dari https://www.python.org/downloads/
  echo Centang "Add python.exe to PATH" saat install, lalu coba lagi.
  pause
  exit /b 1
)

REM Jika server sudah berjalan, cukup buka browser.
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:%PORT%/api/health'; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
  start "" "http://127.0.0.1:%PORT%/"
  exit /b 0
)

echo Menjalankan Harita di http://127.0.0.1:%PORT%/ ...
start "Harita Server" /min cmd /c "%PYTHON_CMD% server.py >> data\server.log 2>&1"

for /L %%I in (1,1,30) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:%PORT%/api/health'; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 (
    goto :open_browser
  )
  timeout /t 1 /nobreak >nul
)

echo ERROR: Harita tidak merespons di http://127.0.0.1:%PORT%/ setelah 30 detik.
echo Cek log: %CD%\data\server.log
if exist data\server.log type data\server.log
pause
exit /b 1

:open_browser
start "" "http://127.0.0.1:%PORT%/"
exit /b 0
