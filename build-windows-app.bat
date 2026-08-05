@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Build Tshirt Printer Windows apps (Operator + Kiosk)

echo.
echo  Building Operator + Kiosk Windows installers...
echo  Packs apps\point-server\.env (cloud relay https://api.kyoma.uk).
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
echo  Operator: apps\point-desktop\release\
echo  Kiosk:    apps\kiosk-desktop\release\
explorer "%~dp0apps\point-desktop\release"
explorer "%~dp0apps\kiosk-desktop\release"
pause
