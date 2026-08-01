@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title TshirtPrinterApp RELEASE - keep open
color 0A

echo.
echo  TshirtPrinterApp RELEASE mode
echo  Operator fullscreen on PC; kiosk on Android with ?native=1
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-release.ps1"

set "ERR=0"
if exist "%~dp0release-exitcode.txt" (
  set /p ERR=<"%~dp0release-exitcode.txt"
)

echo.
if not "%ERR%"=="0" (
  color 0C
  echo  ERROR: release start failed with code %ERR%.
) else (
  echo  Release windows should be open. Services: logs\
)

echo.
if exist "%~dp0dev-urls.txt" (
  echo  ---------- URLS ----------
  type "%~dp0dev-urls.txt"
  echo  --------------------------
)

echo.
echo  Android kiosk URL must include ?native=1
echo  Example: http://YOUR-PC-IP:5173/kiosk?native=1
echo  Stop all: stop-release.bat
echo.

:hold
timeout /t 3600 /nobreak >nul
goto hold
