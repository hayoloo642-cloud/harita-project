@echo off
REM MyAct - build distribusi Windows: PyInstaller one-file -> dist\MyAct.exe
REM Jalankan dari mana saja dengan double-click, atau: packaging\build-windows.bat
setlocal
cd /d "%~dp0.."

where python >nul 2>nul
if errorlevel 1 goto :no_python

python -m PyInstaller --version >nul 2>nul
if errorlevel 1 goto :no_pyinstaller

echo [1/2] Membersihkan build sebelumnya...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

echo [2/2] Membangun dist\MyAct.exe ...
python -m PyInstaller --clean --noconfirm packaging\myact.spec
if errorlevel 1 goto :fail

if not exist dist\MyAct.exe goto :fail

echo.
echo OK - executable: dist\MyAct.exe
echo Jalankan: dist\MyAct.exe
echo Lalu buka: http://127.0.0.1:8777
echo.
echo Catatan: set MYACT_DATA ke folder permanen agar data tidak hilang.
echo   contoh: set MYACT_DATA=%LOCALAPPDATA%\MyAct
exit /b 0

:no_python
echo ERROR: Python tidak ditemukan di PATH.
echo Install Python 3 dari https://www.python.org/downloads/windows/
echo dan centang "Add python.exe to PATH", lalu coba lagi.
exit /b 1

:no_pyinstaller
echo ERROR: PyInstaller belum terpasang.
echo Jalankan: python -m pip install --user pyinstaller
exit /b 1

:fail
echo.
echo ERROR: Build gagal. Periksa pesan di atas.
exit /b 1
