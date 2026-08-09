@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Tshirt Printer Operator — диагностика
set "OUT=%USERPROFILE%\Desktop\tshirt-operator-diagnose.txt"
set "BOOT=%LOCALAPPDATA%\TshirtPrinter\operator-boot.log"
set "DESKTOP_LOG=%APPDATA%\@tshirt\point-desktop\desktop.log"
set "SERVER_LOG=%APPDATA%\@tshirt\point-desktop\point-server.log"
set "INST=%LOCALAPPDATA%\Programs\@tshirtpoint-desktop"

echo Сбор диагностики... > "%OUT%"
echo.>> "%OUT%"
echo === ПК ===>> "%OUT%"
echo USER=%USERNAME%>> "%OUT%"
echo COMPUTER=%COMPUTERNAME%>> "%OUT%"
ver >> "%OUT%" 2>&1
echo.>> "%OUT%"

echo === Процессы (убиваем Operator + orphan node/point-server) ===>> "%OUT%"
taskkill /F /IM "Tshirt Printer Operator.exe" /T >> "%OUT%" 2>&1
taskkill /F /IM "TshirtPrinterOperator.exe" /T >> "%OUT%" 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "$inst = $env:LOCALAPPDATA + '\Programs\@tshirtpoint-desktop'; Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and ($_.ExecutablePath.StartsWith($inst, 'CurrentCultureIgnoreCase') -or $_.ExecutablePath -match 'TshirtPrinter\\modules' -or ($_.CommandLine -and $_.CommandLine -match 'point-server')) } | ForEach-Object { Write-Output ('kill pid=' + $_.ProcessId + ' ' + $_.Name + ' ' + $_.ExecutablePath); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >> "%OUT%" 2>&1
timeout /t 2 /nobreak >nul

echo === Установка ===>> "%OUT%"
if exist "%INST%\Tshirt Printer Operator.exe" (
  echo EXE: %INST%\Tshirt Printer Operator.exe>> "%OUT%"
  powershell -NoProfile -Command "(Get-Item '%INST%\Tshirt Printer Operator.exe').VersionInfo | Format-List FileVersion,ProductVersion" >> "%OUT%" 2>&1
) else (
  echo EXE NOT FOUND: %INST%>> "%OUT%"
  dir "%LOCALAPPDATA%\Programs" >> "%OUT%" 2>&1
)
echo.>> "%OUT%"
echo resources\point-server\dist\index.js:>> "%OUT%"
if exist "%INST%\resources\point-server\dist\index.js" (echo OK>> "%OUT%") else (echo MISSING>> "%OUT%")
echo resources\node\node.exe:>> "%OUT%"
if exist "%INST%\resources\node\node.exe" (echo OK>> "%OUT%") else (echo MISSING>> "%OUT%")
echo.>> "%OUT%"

echo === VC++ Redistributable (x64) ===>> "%OUT%"
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" /v Version >> "%OUT%" 2>&1
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" /v Version >> "%OUT%" 2>&1
echo.>> "%OUT%"

echo === Порт 4000 ===>> "%OUT%"
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Format-Table -AutoSize" >> "%OUT%" 2>&1
echo.>> "%OUT%"

echo === Запуск Operator (15 сек) ===>> "%OUT%"
if exist "%INST%\Tshirt Printer Operator.exe" (
  set "ELECTRON_ENABLE_LOGGING=1"
  start "" "%INST%\Tshirt Printer Operator.exe"
  timeout /t 15 /nobreak >nul
  tasklist /FI "IMAGENAME eq Tshirt Printer Operator.exe" >> "%OUT%" 2>&1
) else (
  echo SKIP launch — exe missing>> "%OUT%"
)
echo.>> "%OUT%"

echo === operator-boot.log ===>> "%OUT%"
if exist "%BOOT%" (type "%BOOT%">> "%OUT%") else (echo MISSING: %BOOT%>> "%OUT%")
echo.>> "%OUT%"
echo === desktop.log (хвост) ===>> "%OUT%"
if exist "%DESKTOP_LOG%" (
  powershell -NoProfile -Command "Get-Content -LiteralPath '%DESKTOP_LOG%' -Tail 80" >> "%OUT%" 2>&1
) else (
  echo MISSING: %DESKTOP_LOG%>> "%OUT%"
)
echo.>> "%OUT%"
echo === point-server.log (хвост) ===>> "%OUT%"
if exist "%SERVER_LOG%" (
  powershell -NoProfile -Command "Get-Content -LiteralPath '%SERVER_LOG%' -Tail 80" >> "%OUT%" 2>&1
) else (
  echo MISSING: %SERVER_LOG%>> "%OUT%"
)

echo.
echo Готово. Файл на рабочем столе:
echo   %OUT%
echo Пришлите этот файл разработчику.
notepad "%OUT%"
pause
