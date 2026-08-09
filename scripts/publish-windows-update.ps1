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

# Collect uploadable artifacts; rename to hyphenated names so they match *.yml
# (gh release upload turns spaces into dots, which breaks electron-updater).
function Get-HyphenatedName([string]$name) {
  return ($name -replace "\s+", "-")
}

function Stage-ReleaseFile([string]$sourcePath) {
  $dir = Split-Path $sourcePath -Parent
  $leaf = Split-Path $sourcePath -Leaf
  $targetName = Get-HyphenatedName $leaf
  $targetPath = Join-Path $dir $targetName
  if ($leaf -ne $targetName) {
    Copy-Item -Force $sourcePath $targetPath
  }
  return $targetPath
}

function Patch-YmlPaths([string]$ymlPath) {
  $text = Get-Content $ymlPath -Raw
  # electron-builder already writes hyphenated / Setup paths; keep as-is if present.
  # Rewrite any legacy space-containing product paths just in case.
  $text = [regex]::Replace($text, "Tshirt Printer Operator", "Tshirt-Printer-Operator")
  $text = [regex]::Replace($text, "Tshirt Printer Kiosk", "Tshirt-Printer-Kiosk")
  Set-Content -Path $ymlPath -Value $text -Encoding ASCII -NoNewline
}

function Resolve-ReleaseArtifact([string]$dir, [string[]]$candidates) {
  foreach ($name in $candidates) {
    $path = Join-Path $dir $name
    if (Test-Path $path) { return $path }
  }
  throw "Missing artifact in $dir. Tried: $($candidates -join ', ')"
}

$files = @()
$operatorExe = Resolve-ReleaseArtifact $operatorRelease @(
  "TshirtPrinterOperator-Setup-$operatorVersion-win-x64.exe",
  "Tshirt Printer Operator-$operatorVersion-win-x64.exe",
  "Tshirt-Printer-Operator-$operatorVersion-win-x64.exe"
)
$operatorBlockmap = Resolve-ReleaseArtifact $operatorRelease @(
  "TshirtPrinterOperator-Setup-$operatorVersion-win-x64.exe.blockmap",
  "Tshirt Printer Operator-$operatorVersion-win-x64.exe.blockmap",
  "Tshirt-Printer-Operator-$operatorVersion-win-x64.exe.blockmap"
)
$operatorZip = Resolve-ReleaseArtifact $operatorRelease @(
  "TshirtPrinterOperator-Setup-$operatorVersion-win-x64.zip",
  "Tshirt Printer Operator-$operatorVersion-win-x64.zip",
  "Tshirt-Printer-Operator-$operatorVersion-win-x64.zip"
)
$kioskExe = Resolve-ReleaseArtifact $kioskRelease @(
  "TshirtPrinterKiosk-Setup-$kioskVersion-win-x64.exe",
  "Tshirt Printer Kiosk-$kioskVersion-win-x64.exe",
  "Tshirt-Printer-Kiosk-$kioskVersion-win-x64.exe"
)
$kioskBlockmap = Resolve-ReleaseArtifact $kioskRelease @(
  "TshirtPrinterKiosk-Setup-$kioskVersion-win-x64.exe.blockmap",
  "Tshirt Printer Kiosk-$kioskVersion-win-x64.exe.blockmap",
  "Tshirt-Printer-Kiosk-$kioskVersion-win-x64.exe.blockmap"
)
$kioskZip = Resolve-ReleaseArtifact $kioskRelease @(
  "TshirtPrinterKiosk-Setup-$kioskVersion-win-x64.zip",
  "Tshirt Printer Kiosk-$kioskVersion-win-x64.zip",
  "Tshirt-Printer-Kiosk-$kioskVersion-win-x64.zip"
)

$operatorYmlPath = Join-Path $operatorRelease "operator.yml"
$kioskYmlPath = Join-Path $kioskRelease "kiosk.yml"
if (-not (Test-Path $operatorYmlPath)) { throw "Missing $operatorYmlPath" }
if (-not (Test-Path $kioskYmlPath)) { throw "Missing $kioskYmlPath" }
Patch-YmlPaths $operatorYmlPath
Patch-YmlPaths $kioskYmlPath

$files += $operatorYmlPath
$files += (Stage-ReleaseFile $operatorExe)
$files += (Stage-ReleaseFile $operatorBlockmap)
$files += (Stage-ReleaseFile $operatorZip)
$files += $kioskYmlPath
$files += (Stage-ReleaseFile $kioskExe)
$files += (Stage-ReleaseFile $kioskBlockmap)
$files += (Stage-ReleaseFile $kioskZip)

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

# gh writes "release not found" to stderr; do not let that abort under Stop.
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$existing = gh release view $Tag --repo by-23/TshirtPrinterApp 2>$null
$viewExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap

if ($viewExit -eq 0 -and $existing) {
  Write-Host "Release $Tag exists - uploading/replacing assets"
  gh release upload $Tag @files --repo by-23/TshirtPrinterApp --clobber
  if ($LASTEXITCODE -ne 0) { throw "gh release upload failed" }
} else {
  gh release create $Tag @files `
    --repo by-23/TshirtPrinterApp `
    --title "Desktop Operator $operatorVersion / Kiosk $kioskVersion" `
    --notes $Notes `
    --latest
  if ($LASTEXITCODE -ne 0) { throw "gh release create failed" }
}

Write-Host ""
Write-Host "Published: https://github.com/by-23/TshirtPrinterApp/releases/tag/$Tag" -ForegroundColor Green
Write-Host "Ensure this release is the newest (or mark it latest) so both channel yml files are visible."
