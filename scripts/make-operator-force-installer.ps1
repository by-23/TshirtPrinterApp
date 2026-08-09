# Builds one folder + one zip. Client extracts ALL files and runs INSTALL.bat
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Release = Join-Path $Root "apps\point-desktop\release"
$OutDir = Join-Path $Root "dist-operator-install"
$Version = (Get-Content (Join-Path $Root "apps\point-desktop\package.json") -Raw | ConvertFrom-Json).version

$zip = Get-ChildItem $Release -Filter "TshirtPrinterOperator-Setup-*-win-x64.zip" |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $zip) {
  throw "Zip not found in $Release. Build Operator first."
}

if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Copy-Item $zip.FullName (Join-Path $OutDir "TshirtPrinterOperator-app.zip")
Copy-Item (Join-Path $PSScriptRoot "operator-force-install.ps1") (Join-Path $OutDir "operator-force-install.ps1")

$batLines = @(
  '@echo off'
  'setlocal EnableExtensions'
  'cd /d "%~dp0"'
  'title Tshirt Printer Operator Install'
  ''
  'if not exist "%~dp0TshirtPrinterOperator-app.zip" ('
  '  echo.'
  '  echo ERROR: TshirtPrinterOperator-app.zip not found next to INSTALL.bat'
  '  echo Extract the WHOLE dist-operator-install zip, then run INSTALL.bat from that folder.'
  '  echo Do NOT copy INSTALL.bat alone to the Desktop.'
  '  echo.'
  '  pause'
  '  exit /b 1'
  ')'
  ''
  'if not exist "%~dp0operator-force-install.ps1" ('
  '  echo.'
  '  echo ERROR: operator-force-install.ps1 not found next to INSTALL.bat'
  '  echo Extract the WHOLE dist-operator-install zip, then run INSTALL.bat from that folder.'
  '  echo.'
  '  pause'
  '  exit /b 1'
  ')'
  ''
  'echo Installing from:'
  'echo   %~dp0'
  'echo.'
  'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0operator-force-install.ps1"'
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
  "Tshirt Printer Operator install",
  "",
  "1. Extract THIS zip completely. You must have 3 files in one folder:",
  "   INSTALL.bat",
  "   operator-force-install.ps1",
  "   TshirtPrinterOperator-app.zip",
  "",
  "2. Run INSTALL.bat from that folder.",
  "",
  "Do NOT copy INSTALL.bat alone to Desktop.",
  "",
  "Version: $Version"
)
[System.IO.File]::WriteAllLines((Join-Path $OutDir "README.txt"), $readmeLines)

$bundle = Join-Path $Root "dist-operator-install-$Version.zip"
if (Test-Path $bundle) { Remove-Item -Force $bundle }
Compress-Archive -Path (Join-Path $OutDir "*") -DestinationPath $bundle -Force

$desktop = [Environment]::GetFolderPath("Desktop")
$desktopBundle = Join-Path $desktop "dist-operator-install-$Version.zip"
Copy-Item $bundle $desktopBundle -Force

$loneBat = Join-Path $desktop "INSTALL.bat"
if (Test-Path $loneBat) { Remove-Item $loneBat -Force -ErrorAction SilentlyContinue }

Write-Host ""
Write-Host "FORCE INSTALLER READY" -ForegroundColor Green
Write-Host "  Folder: $OutDir"
Write-Host "  Bundle: $bundle"
Write-Host "  Desktop: $desktopBundle"
Write-Host "  Extract zip, run INSTALL.bat (keep all files together)"
Write-Host "  Version: $Version"
