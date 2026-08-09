@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
title Publish UI module update
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-ui.ps1" %*
set ERR=%ERRORLEVEL%
echo.
if not "%ERR%"=="0" (
  echo PUBLISH UI FAILED with code %ERR%.
  pause
  exit /b %ERR%
)
echo Done.
pause
