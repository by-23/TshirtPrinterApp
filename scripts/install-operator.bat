@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Install Tshirt Printer Operator (force)

set "SETUP=%~dp0..\apps\point-desktop\release\TshirtPrinterOperator-Setup-1.0.19-win-x64.exe"
if not exist "%SETUP%" (
  for %%F in ("%~dp0..\apps\point-desktop\release\TshirtPrinterOperator-Setup-*-win-x64.exe") do set "SETUP=%%~fF"
)

if not exist "%SETUP%" (
  echo Не найден setup в apps\point-desktop\release\
  pause
  exit /b 1
)

echo Setup: %SETUP%
echo.
echo 1^) Убиваю процессы из папки установки...
taskkill /F /IM "Tshirt Printer Operator.exe" /T >nul 2>&1
taskkill /F /IM "TshirtPrinterOperator.exe" /T >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$inst=$env:LOCALAPPDATA+'\Programs\@tshirtpoint-desktop';" ^
  "Get-CimInstance Win32_Process | ? { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($inst,'CurrentCultureIgnoreCase') } | %% { Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue };" ^
  "Start-Sleep -Milliseconds 500;" ^
  "Remove-Item -LiteralPath (Join-Path $inst 'Uninstall Tshirt Printer Operator.exe') -Force -EA SilentlyContinue;" ^
  "Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' | %% { $p=Get-ItemProperty $_.PSPath -EA SilentlyContinue; if ($p.DisplayName -like 'Tshirt Printer Operator*') { Remove-Item $_.PSPath -Recurse -Force -EA SilentlyContinue } }"

echo 2^) Запуск установщика...
start "" /wait "%SETUP%"
set ERR=%ERRORLEVEL%
echo ExitCode=%ERR%

powershell -NoProfile -Command ^
  "Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -EA SilentlyContinue | ? { $_.DisplayName -like 'Tshirt Printer Operator*' } | Select-Object DisplayName, DisplayVersion, UninstallString | Format-List;" ^
  "Get-ChildItem ($env:LOCALAPPDATA+'\Programs\@tshirtpoint-desktop\*.exe') -EA SilentlyContinue | Select-Object Name, Length, LastWriteTime"

pause
exit /b %ERR%
