# Force-install Operator from TshirtPrinterOperator-app.zip in the same folder.
$ErrorActionPreference = "Stop"

$Root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$Zip = Join-Path $Root "TshirtPrinterOperator-app.zip"
# Avoid "@" in path — Expand-Archive / some tools break on it (@tshirtpoint-desktop).
$Inst = Join-Path $env:LOCALAPPDATA "Programs\TshirtPrinterOperator"
$InstLegacy = Join-Path $env:LOCALAPPDATA "Programs\@tshirtpoint-desktop"
$Exe = Join-Path $Inst "TshirtPrinterOperator.exe"
$ExeOld = Join-Path $Inst "Tshirt Printer Operator.exe"
$sw = [System.Diagnostics.Stopwatch]::StartNew()

function Write-Step([string]$msg) {
  Write-Host ("[{0:mm\:ss}] {1}" -f $sw.Elapsed, $msg)
}

function Remove-TreeFast([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return }
  $null = cmd /c "rd /s /q `"$path`"" 2>&1
  Start-Sleep -Milliseconds 200
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Expand-ZipFast([string]$zipPath, [string]$dest) {
  # Always extract into a fresh empty directory.
  Remove-TreeFast $dest
  New-Item -ItemType Directory -Force -Path $dest | Out-Null

  $tar = Join-Path $env:SystemRoot "System32\tar.exe"
  if (Test-Path -LiteralPath $tar) {
    Write-Host "  using tar.exe"
    $p = Start-Process -FilePath $tar -ArgumentList @("-xf", $zipPath, "-C", $dest) -Wait -PassThru -NoNewWindow
    if ($p.ExitCode -eq 0) { return }
    Write-Host "  tar failed (code $($p.ExitCode)), trying .NET ZipFile..."
    Remove-TreeFast $dest
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
  } else {
    Write-Host "  tar.exe missing, using .NET ZipFile..."
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $dest)
}

function Resolve-AppExe([string]$root) {
  $candidates = @(
    (Join-Path $root "TshirtPrinterOperator.exe"),
    (Join-Path $root "Tshirt Printer Operator.exe")
  )
  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath $c) { return $c }
  }
  $nested = Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Where-Object {
    (Test-Path -LiteralPath (Join-Path $_.FullName "TshirtPrinterOperator.exe")) -or
    (Test-Path -LiteralPath (Join-Path $_.FullName "Tshirt Printer Operator.exe"))
  } | Select-Object -First 1
  if (-not $nested) { return $null }

  Write-Step "Flatten $($nested.Name)..."
  Get-ChildItem -LiteralPath $nested.FullName -Force | ForEach-Object {
    $target = Join-Path $root $_.Name
    if (Test-Path -LiteralPath $target) { Remove-TreeFast $target }
    Move-Item -LiteralPath $_.FullName -Destination $root -Force
  }
  Remove-TreeFast $nested.FullName

  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath $c) { return $c }
  }
  return $null
}

Write-Host ""
Write-Host "=== Tshirt Printer Operator force install ===" -ForegroundColor Cyan
Write-Host "Folder: $Root"
if (-not (Test-Path -LiteralPath $Zip)) {
  throw "Missing TshirtPrinterOperator-app.zip next to INSTALL.bat. Extract the whole dist-operator-install zip into one folder, then run INSTALL.bat from there."
}

Write-Step "Kill old processes..."
foreach ($name in @("Tshirt Printer Operator", "TshirtPrinterOperator")) {
  Get-Process -Name $name -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
foreach ($dir in @($Inst, $InstLegacy)) {
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($dir, "CurrentCultureIgnoreCase") } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Milliseconds 400

Write-Step "Remove old installs..."
Remove-TreeFast $Inst
Remove-TreeFast $InstLegacy
Get-ChildItem "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall" -ErrorAction SilentlyContinue | ForEach-Object {
  $p = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
  if ($p.DisplayName -like "Tshirt Printer Operator*") {
    Remove-Item -LiteralPath $_.PSPath -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# Client-only corruption lives here (failed module zip extract). Must wipe or
# a new shell still serves the broken modules/ui → blank Operator window.
$modulesDir = Join-Path $env:LOCALAPPDATA "TshirtPrinter\modules"
Write-Step "Wipe broken modules cache..."
Remove-TreeFast $modulesDir

$stage = Join-Path $env:TEMP ("tshirt-operator-extract-" + [guid]::NewGuid().ToString("n"))
try {
  Write-Step "Extract app zip..."
  Expand-ZipFast -zipPath $Zip -dest $stage

  Write-Step "Move into Programs\TshirtPrinterOperator..."
  New-Item -ItemType Directory -Force -Path (Split-Path $Inst -Parent) | Out-Null
  Move-Item -LiteralPath $stage -Destination $Inst -Force
  $stage = $null
} finally {
  if ($stage) { Remove-TreeFast $stage }
}

$resolved = Resolve-AppExe $Inst
if (-not $resolved) {
  throw "TshirtPrinterOperator.exe missing after extract. Zip layout unexpected."
}
if ($resolved -ne $Exe -and (Split-Path -Leaf $resolved) -eq "Tshirt Printer Operator.exe") {
  Rename-Item -LiteralPath $resolved -NewName "TshirtPrinterOperator.exe"
  $resolved = $Exe
}

Write-Step "Desktop shortcut..."
$ws = New-Object -ComObject WScript.Shell
$lnkPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "Tshirt Printer Operator.lnk"
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath = $Exe
$lnk.Arguments = ""
$lnk.WorkingDirectory = $Inst
$lnk.Save()

Write-Step "Start..."
Start-Process -FilePath $Exe

$ver = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($Exe).FileVersion
Write-Host ""
Write-Host "OK: $Exe" -ForegroundColor Green
Write-Host "FileVersion=$ver"
Write-Host ("Total time: {0:mm\:ss}" -f $sw.Elapsed) -ForegroundColor Green
