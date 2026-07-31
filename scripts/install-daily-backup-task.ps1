#Requires -Version 5.1
<#
.SYNOPSIS
  Register a Windows Task Scheduler job: daily backup at 03:15 local time.

.DESCRIPTION
  Creates task "TshirtPrinter-DailyBackup" that runs backup-all.ps1.
  Requires elevation for some Windows editions — run PowerShell as Administrator
  if registration fails.

.PARAMETER Uninstall
  Remove the scheduled task instead.
#>
param(
  [switch]$Uninstall,
  [string]$TaskName = "TshirtPrinter-DailyBackup",
  [string]$Time = "03:15"
)

$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "backup-all.ps1"
if (-not (Test-Path $script)) { throw "Missing $script" }

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed scheduled task: $TaskName" -ForegroundColor Green
  exit 0
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""

$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Force | Out-Null

Write-Host "Scheduled task '$TaskName' daily at $Time" -ForegroundColor Green
Write-Host "Script: $script"
Write-Host "To remove: powershell -File scripts\install-daily-backup-task.ps1 -Uninstall"
