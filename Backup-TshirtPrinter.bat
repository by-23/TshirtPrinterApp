@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title TshirtPrinter backup

echo.
echo  Creating daily backup (point + central if available)...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\backup-all.ps1"
set ERR=%ERRORLEVEL%

echo.
if not "%ERR%"=="0" (
  echo  BACKUP FAILED with code %ERR%.
  pause
  exit /b %ERR%
)

echo  Done.
echo  Point backups: %LOCALAPPDATA%\TshirtPrinter\backups
echo  Central backups: %LOCALAPPDATA%\TshirtPrinter\backups-central
echo.
pause
