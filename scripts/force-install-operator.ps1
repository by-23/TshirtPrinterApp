#Requires -Version 5.1
<#
  Recovery: kill locks, move INSTDIR aside, silent NSIS (or zip fallback), start app.
#>
$ErrorActionPreference = "Continue"

$pending = Join-Path $env:LOCALAPPDATA "@tshirtpoint-desktop-updater\pending"
$release = "C:\Users\By23\Documents\TshirtPrinterApp\apps\point-desktop\release"
$installer = Get-ChildItem $pending -Filter "TshirtPrinterOperator-Setup-*.exe" -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $installer) {
  $installer = Get-ChildItem $release -Filter "TshirtPrinterOperator-Setup-*.exe" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
if (-not $installer) { throw "No Operator setup exe found in pending/ or release/" }

$instDir = Join-Path $env:LOCALAPPDATA "Programs\@tshirtpoint-desktop"
$exeName = "Tshirt Printer Operator.exe"
$exePath = Join-Path $instDir $exeName

Write-Host "Installer: $($installer.FullName)"
Write-Host "Install dir: $instDir"

function Kill-Under([string]$dir) {
  if (-not $dir) { return }
  Get-Process | Where-Object { $_.ProcessName -match 'Tshirt' } | Stop-Process -Force -ErrorAction SilentlyContinue
  if (-not (Test-Path $dir)) { return }
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($dir, "CurrentCultureIgnoreCase") } |
    ForEach-Object {
      Write-Host "Kill $($_.ProcessId) $($_.Name)"
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

Kill-Under $instDir
Start-Sleep 2
Kill-Under $instDir
Start-Sleep 1

$bak = $null
if (Test-Path $instDir) {
  $bak = "$instDir.__old_$(Get-Date -Format 'yyyyMMddHHmmss')"
  Write-Host "Rename -> $bak"
  Rename-Item -LiteralPath $instDir -NewName (Split-Path $bak -Leaf) -Force
}

$parent = Split-Path $instDir -Parent
if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }

Write-Host "Running silent install..."
$p = Start-Process -FilePath $installer.FullName -ArgumentList "/S","--updated","--force-run" -PassThru -Wait
Write-Host "Installer exit: $($p.ExitCode)"

$ok = (Test-Path $exePath) -and ($p.ExitCode -eq 0)

if (-not $ok) {
  $zip = [IO.Path]::ChangeExtension($installer.FullName, ".zip")
  if (-not (Test-Path $zip)) {
    $zip = Get-ChildItem (Split-Path $installer.FullName), $release -Filter "TshirtPrinterOperator-Setup-*.zip" -File -EA SilentlyContinue |
      Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
  }
  if ($zip -and (Test-Path $zip)) {
    Write-Host "Zip fallback: $zip"
    $staging = Join-Path $env:TEMP ("tshirt-op-zip-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $staging -Force | Out-Null
    Expand-Archive -Path $zip -DestinationPath $staging -Force
    $src = $staging
    if (-not (Test-Path (Join-Path $src $exeName))) {
      $found = Get-ChildItem $staging -Recurse -Filter $exeName -File -EA SilentlyContinue | Select-Object -First 1
      if ($found) { $src = $found.DirectoryName }
    }
    if (Test-Path (Join-Path $src $exeName)) {
      if (Test-Path $instDir) { Remove-Item -LiteralPath $instDir -Recurse -Force -EA SilentlyContinue }
      New-Item -ItemType Directory -Path $instDir -Force | Out-Null
      & robocopy $src $instDir /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
      $ok = Test-Path $exePath
    }
    Remove-Item -LiteralPath $staging -Recurse -Force -EA SilentlyContinue
  }
}

if ($bak -and (Test-Path $bak)) {
  if ($ok) {
    Write-Host "Remove bak"
    Remove-Item -LiteralPath $bak -Recurse -Force -EA SilentlyContinue
  } else {
    Write-Host "Restore bak (install failed)"
    if (Test-Path $instDir) { Remove-Item -LiteralPath $instDir -Recurse -Force -EA SilentlyContinue }
    Rename-Item -LiteralPath $bak -NewName (Split-Path $instDir -Leaf) -Force -EA SilentlyContinue
  }
}

if (Test-Path $exePath) {
  Write-Host "Starting $exePath"
  Start-Process $exePath
} else {
  Write-Host "WARN: exe not found after install"
  exit 1
}
