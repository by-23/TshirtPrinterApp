@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Build Tshirt Printer Windows app

echo.
echo  Building Windows installer / portable exe...
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

echo  Done. Open apps\point-desktop\release\
explorer "%~dp0apps\point-desktop\release"
pause
