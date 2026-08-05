@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title TshirtPrinterApp stop release

echo Stopping release Chrome/Edge profiles...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root=Join-Path $env:LOCALAPPDATA 'TshirtPrinterApp\chrome-profiles';" ^
  "Get-CimInstance Win32_Process | Where-Object { $cl=$_.CommandLine; if([string]::IsNullOrWhiteSpace($cl)){return $false}; return ($cl -like ('*'+$root+'*')) } | ForEach-Object { taskkill /PID $_.ProcessId /T /F 2>$null }"

echo Stopping local services (point-server / kiosk)...
echo Cloud relay at api.kyoma.uk is not stopped.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$markers=@('@tshirt/central-relay','@tshirt/admin-panel','@tshirt/point-server','@tshirt/kiosk-operator-app');" ^
  "Get-CimInstance Win32_Process | Where-Object { $cl=$_.CommandLine; if([string]::IsNullOrWhiteSpace($cl)){return $false}; foreach($m in $markers){ if($cl -like ('*'+$m+'*')){ return $true } }; return $false } | ForEach-Object { taskkill /PID $_.ProcessId /T /F 2>$null };" ^
  "if(Test-Path 'dev-pids.txt'){ Remove-Item 'dev-pids.txt' -Force }"

echo.
echo Done.
pause
