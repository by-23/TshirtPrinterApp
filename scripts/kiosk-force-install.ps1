# Force-install Kiosk from TshirtPrinterKiosk-app.zip in the same folder.
$ErrorActionPreference = "Stop"

$Root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$Zip = Join-Path $Root "TshirtPrinterKiosk-app.zip"
# Avoid "@" in path — Expand-Archive / some tools break on it.
$Inst = Join-Path $env:LOCALAPPDATA "Programs\TshirtPrinterKiosk"
$InstLegacy = Join-Path $env:LOCALAPPDATA "Programs\@tshirtkiosk-desktop"
$Exe = Join-Path $Inst "TshirtPrinterKiosk.exe"
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
    (Join-Path $root "TshirtPrinterKiosk.exe"),
    (Join-Path $root "Tshirt Printer Kiosk.exe")
  )
  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath $c) { return $c }
  }
  $nested = Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Where-Object {
    (Test-Path -LiteralPath (Join-Path $_.FullName "TshirtPrinterKiosk.exe")) -or
    (Test-Path -LiteralPath (Join-Path $_.FullName "Tshirt Printer Kiosk.exe"))
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
Write-Host "=== Tshirt Printer Kiosk force install ===" -ForegroundColor Cyan
Write-Host "Folder: $Root"
if (-not (Test-Path -LiteralPath $Zip)) {
  throw "Missing TshirtPrinterKiosk-app.zip next to INSTALL.bat. Extract the whole dist-kiosk-install zip into one folder, then run INSTALL.bat from there."
}

Write-Step "Kill old processes..."
foreach ($name in @("Tshirt Printer Kiosk", "TshirtPrinterKiosk")) {
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
  if ($p.DisplayName -like "Tshirt Printer Kiosk*") {
    Remove-Item -LiteralPath $_.PSPath -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$stage = Join-Path $env:TEMP ("tshirt-kiosk-extract-" + [guid]::NewGuid().ToString("n"))
try {
  Write-Step "Extract app zip..."
  Expand-ZipFast -zipPath $Zip -dest $stage

  Write-Step "Move into Programs\TshirtPrinterKiosk..."
  New-Item -ItemType Directory -Force -Path (Split-Path $Inst -Parent) | Out-Null
  Move-Item -LiteralPath $stage -Destination $Inst -Force
  $stage = $null
} finally {
  if ($stage) { Remove-TreeFast $stage }
}

$resolved = Resolve-AppExe $Inst
if (-not $resolved) {
  throw "TshirtPrinterKiosk.exe missing after extract. Zip layout unexpected."
}
if ($resolved -ne $Exe -and (Split-Path -Leaf $resolved) -eq "Tshirt Printer Kiosk.exe") {
  Rename-Item -LiteralPath $resolved -NewName "TshirtPrinterKiosk.exe"
  $resolved = $Exe
}

Write-Step "Desktop shortcut..."
$desktopCandidates = @(
  [Environment]::GetFolderPath("Desktop"),
  (Join-Path $env:USERPROFILE "Desktop"),
  (Join-Path $env:USERPROFILE "OneDrive\Desktop"),
  (Join-Path $env:USERPROFILE "OneDrive - Personal\Desktop")
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -Unique

$ws = New-Object -ComObject WScript.Shell
$lnkName = "Tshirt Printer Kiosk.lnk"
$created = @()
foreach ($desk in $desktopCandidates) {
  $lnkPath = Join-Path $desk $lnkName
  try {
    $lnk = $ws.CreateShortcut($lnkPath)
    $lnk.TargetPath = $Exe
    $lnk.WorkingDirectory = $Inst
    $lnk.IconLocation = "$Exe,0"
    $lnk.Description = "Tshirt Printer Kiosk"
    $lnk.Save()
    if (Test-Path -LiteralPath $lnkPath) {
      $created += $lnkPath
      Write-Host "  shortcut: $lnkPath"
    }
  } catch {
    Write-Host "  shortcut failed ($desk): $($_.Exception.Message)"
  }
}
$startMenu = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs"
if ($startMenu -and (Test-Path -LiteralPath $startMenu)) {
  $smLnk = Join-Path $startMenu $lnkName
  try {
    $lnk = $ws.CreateShortcut($smLnk)
    $lnk.TargetPath = $Exe
    $lnk.WorkingDirectory = $Inst
    $lnk.IconLocation = "$Exe,0"
    $lnk.Description = "Tshirt Printer Kiosk"
    $lnk.Save()
    Write-Host "  start menu: $smLnk"
  } catch {
    Write-Host "  start menu shortcut failed: $($_.Exception.Message)"
  }
}
if ($created.Count -eq 0) {
  Write-Host "WARNING: desktop shortcut was not created. App will recreate it on next launch." -ForegroundColor Yellow
}

Write-Step "Start..."
Start-Process -FilePath $Exe

$ver = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($Exe).FileVersion
Write-Host ""
Write-Host "OK: $Exe" -ForegroundColor Green
Write-Host "FileVersion=$ver"
Write-Host ("Total time: {0:mm\:ss}" -f $sw.Elapsed) -ForegroundColor Green
