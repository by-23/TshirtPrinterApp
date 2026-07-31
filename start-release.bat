@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title TshirtPrinterApp RELEASE - keep open
color 0A

echo.
echo  TshirtPrinterApp RELEASE mode
echo  Kiosk + Operator fullscreen Chrome windows
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
echo  Operator: sidebar -^> «Экраны» to pick monitors.
echo  Stop all: stop-release.bat
echo.

:hold
timeout /t 3600 /nobreak >nul
goto hold
