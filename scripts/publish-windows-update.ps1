#Requires -Version 5.1
<#
.SYNOPSIS
  Build Operator + Kiosk and publish update artifacts to GitHub Releases.

.DESCRIPTION
  Uploads NSIS installers, blockmaps and channel manifests (operator.yml,
  kiosk.yml) into a single GitHub Release so both apps can update from
  the same "latest" release.

  Requires: gh auth login, GH_TOKEN or gh session with repo scope.

  Optional code signing (recommended - OV certificate):
    $env:CSC_LINK = "C:\path\to\certificate.pfx"
    $env:CSC_KEY_PASSWORD = "..."
#>
param(
  [switch]$SkipBuild,
  [string]$Tag = "",
  [string]$Notes = ""
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) not found. Install: https://cli.github.com/"
}

$operatorPkg = Get-Content (Join-Path $Root "apps\point-desktop\package.json") -Raw | ConvertFrom-Json
$kioskPkg = Get-Content (Join-Path $Root "apps\kiosk-desktop\package.json") -Raw | ConvertFrom-Json
$operatorVersion = [string]$operatorPkg.version
$kioskVersion = [string]$kioskPkg.version

if (-not $Tag) {
  $Tag = "desktop-op$operatorVersion-kiosk$kioskVersion"
}

if (-not $SkipBuild) {
  Write-Step "Build Windows apps"
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\build-windows-app.ps1")
  if ($LASTEXITCODE -ne 0) { throw "build-windows-app.ps1 failed" }
}

$operatorRelease = Join-Path $Root "apps\point-desktop\release"
$kioskRelease = Join-Path $Root "apps\kiosk-desktop\release"

$operatorYml = Join-Path $operatorRelease "operator.yml"
$kioskYml = Join-Path $kioskRelease "kiosk.yml"
if (-not (Test-Path $operatorYml)) {
  throw "Missing $operatorYml - rebuild Operator (channel must be 'operator')"
}
if (-not (Test-Path $kioskYml)) {
  throw "Missing $kioskYml - rebuild Kiosk (channel must be 'kiosk')"
}

# Collect uploadable artifacts (skip folders / unpacked).
$files = @()
foreach ($dir in @($operatorRelease, $kioskRelease)) {
  Get-ChildItem $dir -File | Where-Object {
    $_.Extension -in @(".exe", ".yml", ".yaml", ".zip", ".blockmap") -or
    $_.Name -like "*.exe.blockmap"
  } | ForEach-Object { $files += $_.FullName }
}

if ($files.Count -lt 4) {
  throw "Too few release artifacts found. Expected NSIS + yml (+ blockmap) for both apps."
}

Write-Step "Publishing GitHub release $Tag"
Write-Host "Operator v$operatorVersion | Kiosk v$kioskVersion"
Write-Host "Files:"
$files | ForEach-Object { Write-Host "  $_" }

if (-not $Notes) {
  $Notes = @"
Desktop update

- Operator: v$operatorVersion
- Kiosk: v$kioskVersion

Clients download automatically; install when the operator/kiosk presses «Обновить».
"@
}

$existing = gh release view $Tag --repo by-23/TshirtPrinterApp 2>$null
if ($LASTEXITCODE -eq 0 -and $existing) {
  Write-Host "Release $Tag exists - uploading/replacing assets"
  gh release upload $Tag @files --repo by-23/TshirtPrinterApp --clobber
  if ($LASTEXITCODE -ne 0) { throw "gh release upload failed" }
} else {
  gh release create $Tag @files `
    --repo by-23/TshirtPrinterApp `
    --title "Desktop Operator $operatorVersion / Kiosk $kioskVersion" `
    --notes $Notes
  if ($LASTEXITCODE -ne 0) { throw "gh release create failed" }
}

Write-Host ""
Write-Host "Published: https://github.com/by-23/TshirtPrinterApp/releases/tag/$Tag" -ForegroundColor Green
Write-Host "Ensure this release is the newest (or mark it latest) so both channel yml files are visible."
