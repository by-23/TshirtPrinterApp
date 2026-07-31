@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM Kill stale instances (including orphaned node point-server)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-CimInstance Win32_Process | Where-Object { $_.Name -like '*Tshirt*' -or ($_.CommandLine -and ($_.CommandLine -like '*Tshirt Printer*' -or $_.CommandLine -like '*point-server*dist*index.js*')) } | ForEach-Object { taskkill /PID $_.ProcessId /T /F 2>$null }; Remove-Item -Force -ErrorAction SilentlyContinue \"$env:APPDATA\@tshirt\point-desktop\SingletonLock\",\"$env:APPDATA\@tshirt\point-desktop\SingletonCookie\",\"$env:APPDATA\@tshirt\point-desktop\SingletonSocket\""

set "SETUP=%~dp0apps\point-desktop\release\Tshirt Printer-1.0.2-win-x64.exe"
set "UNPACKED=%~dp0apps\point-desktop\release\win-unpacked\Tshirt Printer.exe"

if exist "%UNPACKED%" (
  echo Starting Tshirt Printer 1.0.2 ...
  start "" "%UNPACKED%"
  exit /b 0
)

if exist "%SETUP%" (
  echo Starting installer ...
  start "" "%SETUP%"
  exit /b 0
)

echo Build not found. Run build-windows-app.bat
pause
exit /b 1
