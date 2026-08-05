#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

# Cloud central-relay (Oracle Always Free). Local Postgres / relay / admin are not started.
$RemoteRelayUrl = "https://api.kyoma.uk"
$RemoteAdminUrl = "https://api.kyoma.uk/admin/"

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Assert-Command([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Command not found: $name. Install it and reopen the terminal."
  }
}

function Get-EnvFileValue([string]$path, [string]$key) {
  if (-not (Test-Path $path)) { return $null }
  foreach ($line in Get-Content -Path $path -Encoding UTF8) {
    if ($line -match "^\s*#") { continue }
    if ($line -match ("^\s*" + [regex]::Escape($key) + "\s*=\s*(.*)\s*$")) {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return $null
}

function Upsert-EnvValue([string]$path, [string]$key, [string]$value) {
  $lines = @()
  if (Test-Path $path) {
    $lines = Get-Content -Path $path -Encoding UTF8
  }

  $found = $false
  $updated = foreach ($line in $lines) {
    if ($line -match "^\s*#") { $line; continue }
    if ($line -match ("^\s*" + [regex]::Escape($key) + "\s*=")) {
      $found = $true
      "$key=$value"
    } else {
      $line
    }
  }

  if (-not $found) {
    $updated = @($updated) + "$key=$value"
  }

  Set-Content -Path $path -Value $updated -Encoding UTF8
}

function Get-LanIp {
  try {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.PrefixOrigin -ne "WellKnown"
      } |
      Sort-Object InterfaceMetric |
      Select-Object -ExpandProperty IPAddress -First 1
    if ($ip) { return $ip }
  } catch {}
  return "localhost"
}

function Stop-OldDevServices {
  $markers = @(
    "@tshirt/central-relay",
    "@tshirt/admin-panel",
    "@tshirt/point-server",
    "@tshirt/kiosk-operator-app"
  )
  $myPid = $PID
  $parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId=$myPid" -ErrorAction SilentlyContinue).ParentProcessId

  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  try {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object {
        $cl = $_.CommandLine
        if ([string]::IsNullOrWhiteSpace($cl)) { return $false }
        if ($_.ProcessId -eq $myPid -or $_.ProcessId -eq $parentPid) { return $false }
        foreach ($m in $markers) {
          if ($cl -like "*$m*") { return $true }
        }
        return $false
      } |
      ForEach-Object {
        cmd.exe /c "taskkill /PID $($_.ProcessId) /T /F >nul 2>&1"
      }
  } finally {
    $ErrorActionPreference = $prevEap
  }

  $pidFile = Join-Path $Root "dev-pids.txt"
  if (Test-Path $pidFile) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  }
}

function Start-DevService([string]$name, [string]$filterArgs, [string]$logFile) {
  $pnpmCmd = (Get-Command pnpm.cmd -ErrorAction SilentlyContinue)
  if (-not $pnpmCmd) { $pnpmCmd = Get-Command pnpm }
  $pnpmPath = $pnpmCmd.Source

  $arg = "/d /c `"`"$pnpmPath`" $filterArgs > `"$logFile`" 2>&1`""
  $proc = Start-Process -FilePath "$env:ComSpec" `
    -ArgumentList $arg `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -PassThru

  return $proc.Id
}

function Ensure-RemotePointEnv {
  $pointEnv = Join-Path $Root "apps\point-server\.env"
  $pointExample = Join-Path $Root "apps\point-server\.env.example"
  $oracleEnv = Join-Path $Root ".tmp-pw\oracle-kyoma.env"

  if (-not (Test-Path $pointEnv)) {
    if (-not (Test-Path $pointExample)) {
      throw "Missing apps/point-server/.env.example"
    }
    Copy-Item $pointExample $pointEnv
    Write-Host "Created apps/point-server/.env from .env.example"
  }

  Upsert-EnvValue $pointEnv "CENTRAL_RELAY_URL" $RemoteRelayUrl

  $syncId = Get-EnvFileValue $pointEnv "POINT_SYNC_ID"
  $syncToken = Get-EnvFileValue $pointEnv "POINT_SYNC_TOKEN"

  if ([string]::IsNullOrWhiteSpace($syncId) -or [string]::IsNullOrWhiteSpace($syncToken)) {
    $syncId = Get-EnvFileValue $oracleEnv "POINT_SYNC_ID"
    $syncToken = Get-EnvFileValue $oracleEnv "POINT_SYNC_TOKEN"
    if (-not [string]::IsNullOrWhiteSpace($syncId) -and -not [string]::IsNullOrWhiteSpace($syncToken)) {
      Upsert-EnvValue $pointEnv "POINT_SYNC_ID" $syncId
      Upsert-EnvValue $pointEnv "POINT_SYNC_TOKEN" $syncToken
      Write-Host "Filled POINT_SYNC_* from .tmp-pw\oracle-kyoma.env"
    }
  }

  $syncId = Get-EnvFileValue $pointEnv "POINT_SYNC_ID"
  $syncToken = Get-EnvFileValue $pointEnv "POINT_SYNC_TOKEN"
  if ([string]::IsNullOrWhiteSpace($syncId) -or [string]::IsNullOrWhiteSpace($syncToken)) {
    throw "POINT_SYNC_ID / POINT_SYNC_TOKEN missing in apps/point-server/.env. Create a point in $RemoteAdminUrl and paste id + syncToken."
  }

  return @{
    EnvPath = $pointEnv
    Id = $syncId
    Token = $syncToken
  }
}

function Test-RemoteRelay {
  $healthUrl = "$RemoteRelayUrl/health"
  try {
    $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 15
    if ($resp.StatusCode -lt 200 -or $resp.StatusCode -ge 300) {
      throw "Unexpected status $($resp.StatusCode)"
    }
    Write-Host "Remote relay OK: $healthUrl"
  } catch {
    throw "Remote relay unreachable ($healthUrl). Check internet / DNS / Oracle VM. $($_.Exception.Message)"
  }
}

$exitCode = 0
try {
  Write-Host "TshirtPrinterApp auto-start (remote relay)" -ForegroundColor Green
  Write-Host "Root: $Root"
  Write-Host "Relay: $RemoteRelayUrl"

  Write-Step "Checking tools"
  Assert-Command node
  Assert-Command pnpm

  $nodeMajor = [int]((node -v).TrimStart("v").Split(".")[0])
  if ($nodeMajor -lt 22) {
    throw "Need Node.js >= 22 (preferably 24+). Current: $(node -v)"
  }
  if ($nodeMajor -lt 24) {
    Write-Host "Warning: package.json wants Node >= 24, you have $(node -v). Usually fine." -ForegroundColor Yellow
  }

  Write-Step "pnpm install"
  pnpm install
  if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }

  Write-Step "Remote relay"
  Test-RemoteRelay

  Write-Step "point-server .env (cloud sync)"
  $creds = Ensure-RemotePointEnv
  Write-Host "CENTRAL_RELAY_URL=$RemoteRelayUrl"
  Write-Host "POINT_SYNC_ID=$($creds.Id)"

  Write-Step "point-server: migrate + seed"
  pnpm --filter @tshirt/point-server db:migrate
  if ($LASTEXITCODE -ne 0) { throw "point-server migrate failed" }
  pnpm --filter @tshirt/point-server db:seed
  if ($LASTEXITCODE -ne 0) { throw "point-server seed failed" }

  Write-Step "Starting local services (background)"
  $logDir = Join-Path $Root "logs"
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null

  Stop-OldDevServices

  # Local only: point API + kiosk/operator UI. Admin/relay live in the cloud.
  $services = @(
    @{ Name = "point-server"; Args = "--filter @tshirt/point-server dev" },
    @{ Name = "kiosk";        Args = "--filter @tshirt/kiosk-operator-app dev" }
  )

  $pids = @()
  foreach ($svc in $services) {
    $logFile = Join-Path $logDir ($svc.Name + ".log")
    $procId = Start-DevService -name $svc.Name -filterArgs $svc.Args -logFile $logFile
    $pids += $procId
    Write-Host ("  started {0} (pid {1}) -> logs\{0}.log" -f $svc.Name, $procId)
    Start-Sleep -Milliseconds 300
  }

  $pidFile = Join-Path $Root "dev-pids.txt"
  Set-Content -Path $pidFile -Value $pids -Encoding ASCII

  $lanIp = Get-LanIp

  $summary = @"
Local (this PC):
  Kiosk:      http://localhost:5173/kiosk
  Operator:   http://localhost:5173/operator
  Point API:  http://localhost:4000

LAN ($lanIp):
  Kiosk (dev):     http://${lanIp}:5173/kiosk
  Kiosk (release): http://${lanIp}:5173/kiosk?native=1
  Operator:        http://${lanIp}:5173/operator
  Point API:       http://${lanIp}:4000

Cloud:
  Relay:      $RemoteRelayUrl
  Admin:      $RemoteAdminUrl
  Health:     $RemoteRelayUrl/health

POINT_SYNC_ID:    $($creds.Id)
POINT_SYNC_TOKEN: $($creds.Token)

Logs: logs\*.log
Stop: stop-dev.bat
"@

  Write-Host ""
  Write-Host "========================================" -ForegroundColor Green
  Write-Host "  STARTED (remote relay)"
  Write-Host "========================================" -ForegroundColor Green
  Write-Host ""
  Write-Host $summary

  $summaryPath = Join-Path $Root "dev-urls.txt"
  Set-Content -Path $summaryPath -Value $summary -Encoding ASCII
  Write-Host "Saved copy: $summaryPath" -ForegroundColor DarkGray
  Write-Host ""
}
catch {
  Write-Host ""
  Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
  Write-Host ""
  $exitCode = 1
}

# Never use exit / SetShouldExit - they can tear down the parent console.
Set-Content -Path (Join-Path $Root "dev-exitcode.txt") -Value "$exitCode" -Encoding ASCII
