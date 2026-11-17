@echo off
REM Harita installer wrapper — menjalankan install.ps1 dengan policy dari script ini.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
if errorlevel 1 (
  echo.
  echo Installer gagal. Lihat pesan di atas, atau jalankan ulang setelah install Python.
  pause
  exit /b 1
)
