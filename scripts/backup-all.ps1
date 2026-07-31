#Requires -Version 5.1
<#
.SYNOPSIS
  Run point + central backups (best-effort; continues if one side is missing).
#>
param(
  [int]$KeepDays = 365
)

$ErrorActionPreference = "Continue"
$Root = $PSScriptRoot

Write-Host "TshirtPrinter daily backup" -ForegroundColor Green

$pointOk = $true
$centralOk = $true

try {
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "backup-point.ps1") -KeepDays $KeepDays
  if ($LASTEXITCODE -ne 0) { $pointOk = $false }
} catch {
  Write-Host "Point backup failed: $_" -ForegroundColor Yellow
  $pointOk = $false
}

try {
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "backup-central.ps1") -KeepDays $KeepDays
  if ($LASTEXITCODE -ne 0) { $centralOk = $false }
} catch {
  Write-Host "Central backup failed: $_" -ForegroundColor Yellow
  $centralOk = $false
}

if (-not $pointOk -and -not $centralOk) {
  Write-Host "Both backups failed." -ForegroundColor Red
  exit 1
}

if (-not $pointOk -or -not $centralOk) {
  Write-Host "Partial success (one side skipped/failed)." -ForegroundColor Yellow
  exit 0
}

Write-Host "All backups finished." -ForegroundColor Green
