#Requires -Version 5.1
<#
.SYNOPSIS
  Pack Operator + Kiosk NSIS setups into one chooser installer.
#>
param(
  [string]$OperatorSetup = "",
  [string]$KioskSetup = "",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

$operatorRelease = Join-Path $Root "apps\point-desktop\release"
$kioskRelease = Join-Path $Root "apps\kiosk-desktop\release"

if (-not $OperatorSetup) {
  $OperatorSetup = Get-ChildItem $operatorRelease -Filter "Tshirt Printer Operator-*-win-x64.exe" -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $KioskSetup) {
  $KioskSetup = Get-ChildItem $kioskRelease -Filter "Tshirt Printer Kiosk-*-win-x64.exe" -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $OutDir) {
  $OutDir = Join-Path $Root "dist-combined"
}

if (-not $OperatorSetup -or -not (Test-Path $OperatorSetup)) {
  throw "Operator setup.exe not found in $operatorRelease - run build-windows-app.ps1 first"
}
if (-not $KioskSetup -or -not (Test-Path $KioskSetup)) {
  throw "Kiosk setup.exe not found in $kioskRelease - run build-windows-app.ps1 first"
}

$operatorPkg = Get-Content (Join-Path $Root "apps\point-desktop\package.json") -Raw | ConvertFrom-Json
$kioskPkg = Get-Content (Join-Path $Root "apps\kiosk-desktop\package.json") -Raw | ConvertFrom-Json
$productVer = [string]$operatorPkg.version
$outName = "TshirtPrinter-Setup-$productVer.exe"
$outFile = Join-Path $OutDir $outName

function Find-Makensis {
  $candidates = @()
  $cacheRoots = @(
    (Join-Path $OutDir "tools"),
    (Join-Path $env:LOCALAPPDATA "electron-builder\Cache\nsis"),
    (Join-Path $env:USERPROFILE ".cache\electron-builder\nsis")
  )
  foreach ($cache in $cacheRoots) {
    if (Test-Path $cache) {
      Get-ChildItem $cache -Recurse -Filter "makensis.exe" -ErrorAction SilentlyContinue |
        ForEach-Object { $candidates += $_.FullName }
    }
  }
  foreach ($p in @(
      "C:\Program Files (x86)\NSIS\makensis.exe",
      "C:\Program Files\NSIS\makensis.exe"
    )) {
    if (Test-Path $p) { $candidates += $p }
  }
  $cmd = Get-Command makensis -ErrorAction SilentlyContinue
  if ($cmd) { $candidates += $cmd.Source }
  return @($candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1)
}

function Install-PortableNsis([string]$destRoot) {
  Write-Step "Download NSIS (electron-builder binaries)"
  $ver = "3.0.4.1"
  $url = "https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-$ver/nsis-$ver.7z"
  $archive = Join-Path $env:TEMP "nsis-$ver.7z"
  $extract = Join-Path $destRoot "nsis-$ver"
  New-Item -ItemType Directory -Force -Path $destRoot | Out-Null

  if (-not (Test-Path $archive)) {
    Write-Host "Downloading $url"
    Invoke-WebRequest -Uri $url -OutFile $archive -UseBasicParsing
  }

  if (Test-Path $extract) { Remove-Item -Recurse -Force $extract }
  New-Item -ItemType Directory -Force -Path $extract | Out-Null

  $sevenZip = @(
    (Join-Path $env:LOCALAPPDATA "electron-builder\Cache\7z\7za.exe"),
    "C:\Program Files\7-Zip\7z.exe",
    "C:\Program Files (x86)\7-Zip\7z.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1

  if (-not $sevenZip) {
    Write-Host "7z not found locally; falling back to SourceForge NSIS zip"
    $zip = Join-Path $env:TEMP "nsis-3.10.zip"
    if (-not (Test-Path $zip)) {
      Invoke-WebRequest -Uri "https://downloads.sourceforge.net/project/nsis/NSIS%203/3.10/nsis-3.10.zip" -OutFile $zip -UseBasicParsing
    }
    Expand-Archive -Path $zip -DestinationPath $extract -Force
    $foundZip = Get-ChildItem $extract -Recurse -Filter "makensis.exe" | Select-Object -First 1
    if (-not $foundZip) { throw "makensis.exe not found after extracting NSIS zip" }
    return [string]$foundZip.FullName
  }

  $null = & $sevenZip x "-o$extract" -y $archive 2>&1
  if ($LASTEXITCODE -ne 0) { throw "7z extract failed" }
  $found = Get-ChildItem $extract -Recurse -Filter "makensis.exe" | Select-Object -First 1
  if (-not $found) { throw "makensis.exe not found after extracting NSIS 7z" }
  return [string]$found.FullName
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Stage nested setups under paths without spaces (makensis /D breaks on spaces).
$stage = Join-Path $OutDir "nested"
New-Item -ItemType Directory -Force -Path $stage | Out-Null
$operatorStaged = Join-Path $stage "operator-setup.exe"
$kioskStaged = Join-Path $stage "kiosk-setup.exe"
$outStaged = Join-Path $stage "TshirtPrinter-Setup.exe"
Copy-Item -Force $OperatorSetup $operatorStaged
Copy-Item -Force $KioskSetup $kioskStaged
if (Test-Path $outStaged) { Remove-Item -Force $outStaged }
if (Test-Path $outFile) { Remove-Item -Force $outFile }

$makensis = [string](Find-Makensis)
if (-not $makensis -or -not (Test-Path $makensis)) {
  $makensis = [string](Install-PortableNsis (Join-Path $OutDir "tools"))
}
if (-not $makensis -or -not (Test-Path $makensis)) {
  throw "makensis.exe not available"
}
Write-Host "makensis: $makensis"

$nsi = Join-Path $Root "scripts\installer\combined.nsi"
if (-not (Test-Path $nsi)) { throw "Missing $nsi" }

Write-Step "Compile combined NSIS installer"
Write-Host "Operator setup: $OperatorSetup"
Write-Host "Kiosk setup:    $KioskSetup"
Write-Host "Operator v$productVer + Kiosk v$($kioskPkg.version) -> $outFile"

$makensisArgs = @(
  "/V2",
  "/DOPERATOR_SETUP=$operatorStaged",
  "/DKIOSK_SETUP=$kioskStaged",
  "/DOUT_FILE=$outStaged",
  "/DPRODUCT_VER=$productVer",
  $nsi
)
$p = Start-Process -FilePath $makensis -ArgumentList $makensisArgs -Wait -PassThru -NoNewWindow
if ($p.ExitCode -ne 0) { throw "makensis failed with code $($p.ExitCode)" }
if (-not (Test-Path $outStaged)) { throw "Installer not created: $outStaged" }
Copy-Item -Force $outStaged $outFile

$mb = [math]::Round((Get-Item $outFile).Length / 1MB, 1)
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  COMBINED INSTALLER READY"
Write-Host "========================================" -ForegroundColor Green
Write-Host "  $outFile"
Write-Host "  Size: $mb MB"
Write-Host "  Choice: Operator or Kiosk, desktop shortcut via nested setup"
Write-Host ""

$outFile
