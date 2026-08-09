# Builds one folder + one zip. Client extracts ALL files and runs INSTALL.bat
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Release = Join-Path $Root "apps\kiosk-desktop\release"
$OutDir = Join-Path $Root "dist-kiosk-install"
$Version = (Get-Content (Join-Path $Root "apps\kiosk-desktop\package.json") -Raw | ConvertFrom-Json).version

$zip = Get-ChildItem $Release -Filter "TshirtPrinterKiosk-Setup-*-win-x64.zip" |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $zip) {
  throw "Zip not found in $Release. Build Kiosk first."
}

if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Copy-Item $zip.FullName (Join-Path $OutDir "TshirtPrinterKiosk-app.zip")
Copy-Item (Join-Path $PSScriptRoot "kiosk-force-install.ps1") (Join-Path $OutDir "kiosk-force-install.ps1")

$batLines = @(
  '@echo off'
  'setlocal EnableExtensions'
  'cd /d "%~dp0"'
  'title Tshirt Printer Kiosk Install'
  ''
  'if not exist "%~dp0TshirtPrinterKiosk-app.zip" ('
  '  echo.'
  '  echo ERROR: TshirtPrinterKiosk-app.zip not found next to INSTALL.bat'
  '  echo Extract the WHOLE dist-kiosk-install zip, then run INSTALL.bat from that folder.'
  '  echo Do NOT copy INSTALL.bat alone to the Desktop.'
  '  echo.'
  '  pause'
  '  exit /b 1'
  ')'
  ''
  'if not exist "%~dp0kiosk-force-install.ps1" ('
  '  echo.'
  '  echo ERROR: kiosk-force-install.ps1 not found next to INSTALL.bat'
  '  echo Extract the WHOLE dist-kiosk-install zip, then run INSTALL.bat from that folder.'
  '  echo.'
  '  pause'
  '  exit /b 1'
  ')'
  ''
  'echo Installing from:'
  'echo   %~dp0'
  'echo.'
  'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kiosk-force-install.ps1"'
  'set ERR=%ERRORLEVEL%'
  'echo.'
  'if not "%ERR%"=="0" ('
  '  echo FAILED code %ERR%'
  '  pause'
  '  exit /b %ERR%'
  ')'
  'echo Done.'
  'pause'
)
$batPath = Join-Path $OutDir "INSTALL.bat"
[System.IO.File]::WriteAllLines($batPath, $batLines)

$readmeLines = @(
  "Tshirt Printer Kiosk install",
  "",
  "1. Extract THIS zip completely. You must have 3 files in one folder:",
  "   INSTALL.bat",
  "   kiosk-force-install.ps1",
  "   TshirtPrinterKiosk-app.zip",
  "",
  "2. Run INSTALL.bat from that folder.",
  "",
  "3. On first launch enter the Operator PC IP (same LAN).",
  "",
  "Do NOT copy INSTALL.bat alone to Desktop.",
  "",
  "Version: $Version"
)
[System.IO.File]::WriteAllLines((Join-Path $OutDir "README.txt"), $readmeLines)

$bundle = Join-Path $Root "dist-kiosk-install-$Version.zip"
if (Test-Path $bundle) { Remove-Item -Force $bundle }
Compress-Archive -Path (Join-Path $OutDir "*") -DestinationPath $bundle -Force

$desktop = [Environment]::GetFolderPath("Desktop")
$desktopBundle = Join-Path $desktop "dist-kiosk-install-$Version.zip"
Copy-Item $bundle $desktopBundle -Force

Write-Host ""
Write-Host "KIOSK FORCE INSTALLER READY" -ForegroundColor Green
Write-Host "  Folder: $OutDir"
Write-Host "  Bundle: $bundle"
Write-Host "  Desktop: $desktopBundle"
Write-Host "  Extract zip, run INSTALL.bat (keep all files together)"
Write-Host "  Version: $Version"
