#Requires -Version 5.1
<#
.SYNOPSIS
  Backup central-relay: Postgres dump + apps/central-relay/data files.

.PARAMETER BackupDir
  Root folder for dated backups (default: %LOCALAPPDATA%\TshirtPrinter\backups-central).

.PARAMETER KeepDays
  How many dated folders to keep (default 365 — one year).

.PARAMETER PostgresContainer
  Docker container name (default: tshirt-central-postgres).
#>
param(
  [string]$BackupDir = "",
  [int]$KeepDays = 365,
  [string]$PostgresContainer = "tshirt-central-postgres",
  [string]$PostgresUser = "tshirt",
  [string]$PostgresDb = "tshirt_central"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$relayData = Join-Path $Root "apps\central-relay\data"

if (-not $BackupDir -or -not $BackupDir.Trim()) {
  if ($env:BACKUP_CENTRAL_DIR -and $env:BACKUP_CENTRAL_DIR.Trim()) {
    $BackupDir = $env:BACKUP_CENTRAL_DIR.Trim()
  } else {
    $BackupDir = Join-Path $env:LOCALAPPDATA "TshirtPrinter\backups-central"
  }
}
$BackupDir = [IO.Path]::GetFullPath($BackupDir)
$stamp = Get-Date -Format "yyyy-MM-dd"
$dest = Join-Path $BackupDir $stamp

function Write-Step([string]$msg) {
  Write-Host "==> $msg" -ForegroundColor Cyan
}

Write-Host "Central backup" -ForegroundColor Green
Write-Host "Dest: $dest"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  throw "docker not found — needed for pg_dump of $PostgresContainer"
}

$running = docker ps --filter "name=^/${PostgresContainer}$" --format "{{.Names}}"
if (-not $running) {
  throw "Postgres container '$PostgresContainer' is not running. Start docker compose first."
}

Write-Step "pg_dump (custom format)"
$dumpPath = Join-Path $dest "tshirt_central.dump"
# Dump inside the container, then docker cp out — avoids Windows path mounts.
$remote = "/tmp/tshirt_central_$stamp.dump"
docker exec $PostgresContainer pg_dump -U $PostgresUser -d $PostgresDb -Fc -f $remote
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }
docker cp "${PostgresContainer}:${remote}" $dumpPath
if ($LASTEXITCODE -ne 0) { throw "docker cp dump failed" }
docker exec $PostgresContainer rm -f $remote | Out-Null

if (Test-Path $relayData) {
  Write-Step "Copy central-relay/data (catalog-manual PNGs)"
  $filesDest = Join-Path $dest "data"
  New-Item -ItemType Directory -Force -Path $filesDest | Out-Null
  & robocopy $relayData $filesDest /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) {
    throw "robocopy failed for central-relay/data (exit $LASTEXITCODE)"
  }
} else {
  Write-Host "WARNING: $relayData not found — skipping file copy" -ForegroundColor Yellow
}

$done = @{
  createdAt = (Get-Date).ToString("o")
  keepDays  = $KeepDays
  container = $PostgresContainer
  tool      = "backup-central.ps1"
} | ConvertTo-Json
Set-Content -Path (Join-Path $dest "DONE") -Value $done -Encoding UTF8

Write-Step "Prune backups older than $KeepDays days"
Get-ChildItem $BackupDir -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}$' } |
  Sort-Object Name -Descending |
  Select-Object -Skip $KeepDays |
  ForEach-Object {
    Write-Host "Removing $($_.FullName)"
    Remove-Item -Recurse -Force $_.FullName
  }

Write-Host "Done: $dest" -ForegroundColor Green
Write-Host "Restore tip: docker exec -i $PostgresContainer pg_restore -U $PostgresUser -d $PostgresDb --clean --if-exists < dump" -ForegroundColor DarkGray
