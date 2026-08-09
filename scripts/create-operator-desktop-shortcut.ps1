# Creates Desktop + Start Menu shortcut for already-installed Operator.
# No reinstall. Send this file alone to the client and run it.
$ErrorActionPreference = "Stop"

$Exe = Join-Path $env:LOCALAPPDATA "Programs\TshirtPrinterOperator\TshirtPrinterOperator.exe"
$ExeSpaced = Join-Path $env:LOCALAPPDATA "Programs\TshirtPrinterOperator\Tshirt Printer Operator.exe"
if (-not (Test-Path -LiteralPath $Exe) -and (Test-Path -LiteralPath $ExeSpaced)) {
  $Exe = $ExeSpaced
}
if (-not (Test-Path -LiteralPath $Exe)) {
  throw "Operator not found at:`n$Exe`nInstall the app first."
}

$Inst = Split-Path -Parent $Exe
$lnkName = "Tshirt Printer Operator.lnk"
$ws = New-Object -ComObject WScript.Shell

$desktops = @(
  [Environment]::GetFolderPath("Desktop"),
  (Join-Path $env:USERPROFILE "Desktop"),
  (Join-Path $env:USERPROFILE "OneDrive\Desktop"),
  (Join-Path $env:USERPROFILE "OneDrive - Personal\Desktop")
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -Unique

$ok = $false
foreach ($desk in $desktops) {
  $lnkPath = Join-Path $desk $lnkName
  $lnk = $ws.CreateShortcut($lnkPath)
  $lnk.TargetPath = $Exe
  $lnk.WorkingDirectory = $Inst
  $lnk.IconLocation = "$Exe,0"
  $lnk.Description = "Tshirt Printer Operator"
  $lnk.Save()
  if (Test-Path -LiteralPath $lnkPath) {
    Write-Host "OK: $lnkPath" -ForegroundColor Green
    $ok = $true
  }
}

$startMenu = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs"
if ($startMenu -and (Test-Path -LiteralPath $startMenu)) {
  $sm = Join-Path $startMenu $lnkName
  $lnk = $ws.CreateShortcut($sm)
  $lnk.TargetPath = $Exe
  $lnk.WorkingDirectory = $Inst
  $lnk.IconLocation = "$Exe,0"
  $lnk.Description = "Tshirt Printer Operator"
  $lnk.Save()
  Write-Host "OK: $sm" -ForegroundColor Green
}

if (-not $ok) { throw "Could not create a desktop shortcut (Desktop folder not found?)." }
Write-Host "Done." -ForegroundColor Green
