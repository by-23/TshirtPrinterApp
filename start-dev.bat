@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title TshirtPrinterApp LINKS - keep open
color 0A

echo.
echo  TshirtPrinterApp auto-start
echo  Local: kiosk + operator + point-server
echo  Cloud: https://api.kyoma.uk  (admin / QR / sync)
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-dev.ps1"

set "ERR=0"
if exist "%~dp0dev-exitcode.txt" (
  set /p ERR=<"%~dp0dev-exitcode.txt"
)

echo.
if not "%ERR%"=="0" (
  color 0C
  echo  ERROR: startup failed with code %ERR%.
) else (
  echo  Services running in background. Logs: logs\
)

echo.
if exist "%~dp0dev-urls.txt" (
  echo  ---------- URLS ----------
  type "%~dp0dev-urls.txt"
  echo  --------------------------
) else (
  echo  dev-urls.txt was not created. Check errors above.
)

echo.
echo  This window stays open. Close with the X button.
echo  Stop all local: stop-dev.bat
echo.

:hold
timeout /t 3600 /nobreak >nul
goto hold
