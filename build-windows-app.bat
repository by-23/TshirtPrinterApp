@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Build Tshirt Printer Windows apps (Operator + Kiosk + combined setup)

echo.
echo  Building Operator + Kiosk + unified installer...
echo  Packs apps\point-server\.env (cloud relay https://api.kyoma.uk).
echo  Result: dist-combined\TshirtPrinter-Setup-*.exe
echo  (choice: Operator or Kiosk, desktop shortcut)
echo  This downloads Node.js runtime and may take several minutes.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-windows-app.ps1"
set ERR=%ERRORLEVEL%

echo.
if not "%ERR%"=="0" (
  echo  BUILD FAILED with code %ERR%.
  pause
  exit /b %ERR%
)

echo  Done.
echo  Unified setup: dist-combined\
echo  Operator:      apps\point-desktop\release\
echo  Kiosk:         apps\kiosk-desktop\release\
if exist "%~dp0dist-combined" explorer "%~dp0dist-combined"
pause
