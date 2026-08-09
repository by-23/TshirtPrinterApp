@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Publish shell (full Operator/Kiosk) update
echo.
echo  Full Electron shell update (rare). For UI/CSS use publish-ui.bat instead.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-windows-update.ps1" %*
set ERR=%ERRORLEVEL%
echo.
if not "%ERR%"=="0" (
  echo PUBLISH SHELL FAILED with code %ERR%.
  pause
  exit /b %ERR%
)
echo Done.
pause
