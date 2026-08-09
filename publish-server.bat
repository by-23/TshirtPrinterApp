@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
title Publish server module update
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-server.ps1" %*
set ERR=%ERRORLEVEL%
echo.
if not "%ERR%"=="0" (
  echo PUBLISH SERVER FAILED with code %ERR%.
  pause
  exit /b %ERR%
)
echo Done.
pause
