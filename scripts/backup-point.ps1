#Requires -Version 5.1
<#
.SYNOPSIS
  Backup point-server essentials only: SQLite (`point.db`) + `orders/` PNGs.
  Skips catalog, ads, stickers, AI weights (regenerable / non-critical).

.DESCRIPTION
  Prefer the built-in daily backup inside point-server (online SQLite .backup).
  This script is for manual runs / Task Scheduler when the app is stopped,
  or to copy an existing auto-backup elsewhere (USB / network share).

  Default source (packaged): %LOCALAPPDATA%\TshirtPrinter\data
  Default dest:             %LOCALAPPDATA%\TshirtPrinter\backups\yyyy-MM-dd

.PARAMETER DataDir
  Override source data folder.

.PARAMETER BackupDir
  Override backup root (date subfolder is created inside).

.PARAMETER KeepDays
  How many dated folders to keep (default 365 — one year).
#>
param(
  [string]$DataDir = "",
  [string]$BackupDir = "",
  [int]$KeepDays = 365
)

$ErrorActionPreference = "Stop"

function Resolve-PointDataDir {
  if ($DataDir -and $DataDir.Trim()) { return (Resolve-Path $DataDir).Path }
  if ($env:TSHIRT_DATA_DIR -and $env:TSHIRT_DATA_DIR.Trim()) {
    return [IO.Path]::GetFullPath($env:TSHIRT_DATA_DIR.Trim())
  }
  if ($env:DATA_DIR -and $env:DATA_DIR.Trim()) {
    return [IO.Path]::GetFullPath($env:DATA_DIR.Trim())
  }
  $packaged = Join-Path $env:LOCALAPPDATA "TshirtPrinter\data"
  if (Test-Path $packaged) { return $packaged }
  $dev = Join-Path $PSScriptRoot "..\apps\point-server\data"
  if (Test-Path $dev) { return (Resolve-Path $dev).Path }
  throw "Point data dir not found. Pass -DataDir or set TSHIRT_DATA_DIR."
}

function Resolve-BackupRoot([string]$sourceDataDir) {
  if ($BackupDir -and $BackupDir.Trim()) {
    return [IO.Path]::GetFullPath($BackupDir.Trim())
  }
  if ($env:BACKUP_DIR -and $env:BACKUP_DIR.Trim()) {
    return [IO.Path]::GetFullPath($env:BACKUP_DIR.Trim())
  }
  return [IO.Path]::GetFullPath((Join-Path $sourceDataDir "..\backups"))
}

function Write-Step([string]$msg) {
  Write-Host "==> $msg" -ForegroundColor Cyan
}

$source = Resolve-PointDataDir
$root = Resolve-BackupRoot $source
$stamp = Get-Date -Format "yyyy-MM-dd"
$dest = Join-Path $root $stamp

Write-Host "Point backup" -ForegroundColor Green
Write-Host "Source: $source"
Write-Host "Dest:   $dest"

New-Item -ItemType Directory -Force -Path $dest | Out-Null

$dbSrc = Join-Path $source "point.db"
if (Test-Path $dbSrc) {
  Write-Step "Copy SQLite (prefer stopping the app for a cold copy)"
  Copy-Item -Force $dbSrc (Join-Path $dest "point.db")
  foreach ($suffix in @("-wal", "-shm", "-journal")) {
    $side = "$dbSrc$suffix"
    if (Test-Path $side) {
      Copy-Item -Force $side (Join-Path $dest ("point.db" + $suffix))
    }
  }
} else {
  Write-Host "WARNING: point.db not found at $dbSrc" -ForegroundColor Yellow
}

$include = @("orders")
foreach ($name in $include) {
  $from = Join-Path $source $name
  if (-not (Test-Path $from)) { continue }
  Write-Step "Copy $name"
  $to = Join-Path $dest $name
  New-Item -ItemType Directory -Force -Path $to | Out-Null
  # /MIR = don't delete extras in dest; /NFL /NDL /NJH /NJS = quieter
  & robocopy $from $to /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) {
    throw "robocopy failed for $name (exit $LASTEXITCODE)"
  }
}

$done = @{
  createdAt = (Get-Date).ToString("o")
  dataDir   = $source
  keepDays  = $KeepDays
  tool      = "backup-point.ps1"
} | ConvertTo-Json
Set-Content -Path (Join-Path $dest "DONE") -Value $done -Encoding UTF8

Write-Step "Prune backups older than $KeepDays days"
if (Test-Path $root) {
  Get-ChildItem $root -Directory |
    Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}$' } |
    Sort-Object Name -Descending |
    Select-Object -Skip $KeepDays |
    ForEach-Object {
      Write-Host "Removing $($_.FullName)"
      Remove-Item -Recurse -Force $_.FullName
    }
}

Write-Host "Done: $dest" -ForegroundColor Green
