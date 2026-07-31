#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Find-Chrome {
  $candidates = @(
    "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  )
  foreach ($path in $candidates) {
    if (Test-Path $path) { return $path }
  }
  return $null
}

function Get-DisplayScreens {
  Add-Type -AssemblyName System.Windows.Forms
  return [System.Windows.Forms.Screen]::AllScreens
}

function Wait-HttpReady([string]$url, [int]$timeoutSec = 90) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  do {
    try {
      $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { return }
    } catch {}
    Start-Sleep -Seconds 1
  } while ((Get-Date) -lt $deadline)
  throw "Service did not become ready: $url"
}

function Read-DisplayConfig {
  $configPath = Join-Path $Root "displays.json"
  if (-not (Test-Path $configPath)) {
    return @{ kioskIndex = $null; operatorIndex = $null }
  }
  try {
    $json = Get-Content -Path $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
    return @{
      kioskIndex = if ($null -ne $json.kioskIndex) { [int]$json.kioskIndex } else { $null }
      operatorIndex = if ($null -ne $json.operatorIndex) { [int]$json.operatorIndex } else { $null }
    }
  } catch {
    Write-Host "Warning: could not parse displays.json" -ForegroundColor Yellow
    return @{ kioskIndex = $null; operatorIndex = $null }
  }
}

function Select-Screens($screens, $config) {
  $kiosk = $null
  $operator = $null

  if ($null -ne $config.kioskIndex -and $config.kioskIndex -ge 0 -and $config.kioskIndex -lt $screens.Count) {
    $kiosk = $screens[$config.kioskIndex]
  }
  if ($null -ne $config.operatorIndex -and $config.operatorIndex -ge 0 -and $config.operatorIndex -lt $screens.Count) {
    $operator = $screens[$config.operatorIndex]
  }

  if (-not $kiosk) {
    $kiosk = $screens | Where-Object { $_.Bounds.Height -gt $_.Bounds.Width } | Select-Object -First 1
  }
  if (-not $kiosk) {
    $kiosk = if ($screens.Count -gt 1) { $screens[$screens.Count - 1] } else { $screens[0] }
  }

  if (-not $operator) {
    $operator = $screens | Where-Object { $_.DeviceName -ne $kiosk.DeviceName } | Select-Object -First 1
  }
  if (-not $operator) { $operator = $screens[0] }

  return @{ Kiosk = $kiosk; Operator = $operator }
}

function Stop-ReleaseBrowsers([string]$profilesRoot) {
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  try {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object {
        $cl = $_.CommandLine
        if ([string]::IsNullOrWhiteSpace($cl)) { return $false }
        return ($cl -like "*$profilesRoot*")
      } |
      ForEach-Object {
        cmd.exe /c "taskkill /PID $($_.ProcessId) /T /F >nul 2>&1"
      }
  } finally {
    $ErrorActionPreference = $prevEap
  }
}

$exitCode = 0
try {
  Write-Host "TshirtPrinterApp RELEASE start" -ForegroundColor Green
  Write-Host "Root: $Root"

  Write-Step "Starting backend services (same as start-dev)"
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "start-dev.ps1")
  $devExit = 0
  $devExitFile = Join-Path $Root "dev-exitcode.txt"
  if (Test-Path $devExitFile) {
    $devExit = [int](Get-Content $devExitFile -Raw).Trim()
  }
  if ($devExit -ne 0) {
    throw "start-dev.ps1 failed with code $devExit"
  }

  Write-Step "Waiting for kiosk UI"
  Wait-HttpReady "http://localhost:5173/kiosk"

  $chrome = Find-Chrome
  if (-not $chrome) {
    throw "Chrome/Edge not found. Install Google Chrome."
  }
  Write-Host "Browser: $chrome"

  $screens = @(Get-DisplayScreens)
  Write-Host ("Displays: {0}" -f $screens.Count)
  for ($i = 0; $i -lt $screens.Count; $i++) {
    $b = $screens[$i].Bounds
    $orient = if ($b.Height -gt $b.Width) { "portrait" } else { "landscape" }
    Write-Host ("  [{0}] {1}x{2} @ ({3},{4}) {5}" -f $i, $b.Width, $b.Height, $b.X, $b.Y, $orient)
  }

  $config = Read-DisplayConfig
  $picked = Select-Screens $screens $config
  $kioskScreen = $picked.Kiosk
  $operatorScreen = $picked.Operator

  $profilesRoot = Join-Path $env:LOCALAPPDATA "TshirtPrinterApp\chrome-profiles"
  $kioskProfile = Join-Path $profilesRoot "kiosk"
  $operatorProfile = Join-Path $profilesRoot "operator"
  New-Item -ItemType Directory -Force -Path $kioskProfile | Out-Null
  New-Item -ItemType Directory -Force -Path $operatorProfile | Out-Null

  Write-Step "Closing previous release browser windows"
  Stop-ReleaseBrowsers $profilesRoot

  $kioskUrl = "http://localhost:5173/kiosk?native=1"
  $operatorUrl = "http://localhost:5173/operator?native=1"

  $kb = $kioskScreen.Bounds
  $ob = $operatorScreen.Bounds

  Write-Step "Opening Chrome windows (frameless --kiosk on both)"
  Write-Host ("  Kiosk    -> {0}x{1} @ ({2},{3})" -f $kb.Width, $kb.Height, $kb.X, $kb.Y)
  Write-Host ("  Operator -> {0}x{1} @ ({2},{3})" -f $ob.Width, $ob.Height, $ob.X, $ob.Y)

  # Both windows: Chrome --kiosk = no title bar, no address bar, no OS window chrome.
  # Position the process on the target monitor first; --kiosk then fills that display.
  $commonArgs = @(
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-session-crashed-bubble",
    "--disable-features=TranslateUI",
    "--autoplay-policy=no-user-gesture-required",
    "--kiosk"
  )

  $kioskArgs = $commonArgs + @(
    "--user-data-dir=`"$kioskProfile`"",
    "--window-position=$($kb.X),$($kb.Y)",
    "--window-size=$($kb.Width),$($kb.Height)",
    $kioskUrl
  )

  $operatorArgs = $commonArgs + @(
    "--user-data-dir=`"$operatorProfile`"",
    "--window-position=$($ob.X),$($ob.Y)",
    "--window-size=$($ob.Width),$($ob.Height)",
    $operatorUrl
  )

  Start-Process -FilePath $chrome -ArgumentList $kioskArgs
  Start-Sleep -Milliseconds 400
  Start-Process -FilePath $chrome -ArgumentList $operatorArgs

  $configHint = @"
Optional displays.json (repo root):
  {
    "kioskIndex": 0,
    "operatorIndex": 1
  }
Indices match the list printed above.
In the operator UI: sidebar → «Экраны» to reassign monitors live.
"@

  Write-Host ""
  Write-Host "========================================" -ForegroundColor Green
  Write-Host "  RELEASE WINDOWS OPENED"
  Write-Host "========================================" -ForegroundColor Green
  Write-Host ""
  Write-Host $configHint
  Write-Host "Stop: stop-release.bat (or stop-dev.bat)" -ForegroundColor DarkGray
}
catch {
  Write-Host ""
  Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
  Write-Host ""
  $exitCode = 1
}

Set-Content -Path (Join-Path $Root "release-exitcode.txt") -Value "$exitCode" -Encoding ASCII
