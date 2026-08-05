@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Publish Tshirt Printer desktop updates to GitHub Releases

echo.
echo  Build + publish Operator/Kiosk updates to GitHub Releases
echo  Repo: by-23/TshirtPrinterApp
echo.
echo  Optional signing:
echo    set CSC_LINK=C:\path\to\cert.pfx
echo    set CSC_KEY_PASSWORD=...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-windows-update.ps1" %*
set ERR=%ERRORLEVEL%

echo.
if not "%ERR%"=="0" (
  echo  PUBLISH FAILED with code %ERR%.
  pause
  exit /b %ERR%
)

echo  Done.
pause
