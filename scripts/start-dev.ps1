#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Assert-Command([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Command not found: $name. Install it and reopen the terminal."
  }
}

function Wait-Postgres {
  $deadline = (Get-Date).AddMinutes(2)
  do {
    docker exec tshirt-central-postgres pg_isready -U tshirt -d tshirt_central 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { return }
    Start-Sleep -Seconds 1
  } while ((Get-Date) -lt $deadline)
  throw "Postgres did not become ready in 2 minutes. Check Docker Desktop."
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

function Get-PointSyncCreds {
  $raw = docker exec tshirt-central-postgres `
    psql -U tshirt -d tshirt_central -t -A -F "|" `
    -c "SELECT id, sync_token FROM points ORDER BY created_at NULLS LAST, id LIMIT 1;"
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
    throw "No points in DB. central-relay seed did not create a demo point."
  }
  $parts = $raw.Trim().Split("|")
  if ($parts.Length -lt 2) {
    throw "Failed to read id/sync_token from Postgres."
  }
  return @{ Id = $parts[0]; Token = $parts[1] }
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
  # Only kill processes whose command line looks like OUR pnpm filter services.
  # Never blind taskkill by stale PID (PID reuse can kill this launcher).
  # taskkill "process not found" must never abort startup.
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
        # Redirect inside cmd so stderr never becomes a PS terminating error
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
  # Use cmd /c with CreateNoWindow. Do NOT WindowStyle Hidden on a shared console.
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

$exitCode = 0
try {
  Write-Host "TshirtPrinterApp auto-start" -ForegroundColor Green
  Write-Host "Root: $Root"

  Write-Step "Checking tools"
  Assert-Command docker
  Assert-Command node
  Assert-Command pnpm

  $nodeMajor = [int]((node -v).TrimStart("v").Split(".")[0])
  if ($nodeMajor -lt 22) {
    throw "Need Node.js >= 22 (preferably 24+). Current: $(node -v)"
  }
  if ($nodeMajor -lt 24) {
    Write-Host "Warning: package.json wants Node >= 24, you have $(node -v). Usually fine." -ForegroundColor Yellow
  }

  docker info 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "Docker is not responding. Start Docker Desktop and wait until Ready."
  }

  Write-Step "pnpm install"
  pnpm install
  if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }

  Write-Step "Docker Postgres"
  docker compose up -d
  if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }
  Wait-Postgres
  Write-Host "Postgres is ready."

  Write-Step "central-relay: migrate + seed"
  pnpm --filter @tshirt/central-relay db:migrate
  if ($LASTEXITCODE -ne 0) { throw "central-relay migrate failed" }
  pnpm --filter @tshirt/central-relay db:seed
  if ($LASTEXITCODE -ne 0) { throw "central-relay seed failed" }

  $creds = Get-PointSyncCreds
  Write-Host "Point id=$($creds.Id)"
  Write-Host "Token=$($creds.Token)"

  Write-Step "point-server .env"
  $pointEnv = Join-Path $Root "apps\point-server\.env"
  $pointExample = Join-Path $Root "apps\point-server\.env.example"
  if (-not (Test-Path $pointEnv)) {
    if (-not (Test-Path $pointExample)) {
      throw "Missing apps/point-server/.env.example"
    }
    Copy-Item $pointExample $pointEnv
    Write-Host "Created apps/point-server/.env from .env.example"
  }

  Upsert-EnvValue $pointEnv "CENTRAL_RELAY_URL" "http://localhost:4100"
  Upsert-EnvValue $pointEnv "POINT_SYNC_ID" $creds.Id
  Upsert-EnvValue $pointEnv "POINT_SYNC_TOKEN" $creds.Token
  Write-Host "Wrote CENTRAL_RELAY_URL / POINT_SYNC_ID / POINT_SYNC_TOKEN"

  Write-Step "point-server: migrate + seed"
  pnpm --filter @tshirt/point-server db:migrate
  if ($LASTEXITCODE -ne 0) { throw "point-server migrate failed" }
  pnpm --filter @tshirt/point-server db:seed
  if ($LASTEXITCODE -ne 0) { throw "point-server seed failed" }

  Write-Step "Starting services (background)"
  $logDir = Join-Path $Root "logs"
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null

  Stop-OldDevServices

  $services = @(
    @{ Name = "central-relay"; Args = "--filter @tshirt/central-relay dev" },
    @{ Name = "admin-panel";   Args = "--filter @tshirt/admin-panel dev" },
    @{ Name = "point-server";  Args = "--filter @tshirt/point-server dev" },
    @{ Name = "kiosk";         Args = "--filter @tshirt/kiosk-operator-app dev" }
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
Local:
  Kiosk:      http://localhost:5173/kiosk
  Operator:   http://localhost:5173/operator
  Admin:      http://localhost:5174
  Point API:  http://localhost:4000
  Relay:      http://localhost:4100

LAN ($lanIp):
  Kiosk (dev):     http://${lanIp}:5173/kiosk
  Kiosk (release): http://${lanIp}:5173/kiosk?native=1
  Operator:        http://${lanIp}:5173/operator
  Admin:           http://${lanIp}:5174
  Point API:       http://${lanIp}:4000
  Relay:           http://${lanIp}:4100

Admin login:  admin / admin123

POINT_SYNC_ID:    $($creds.Id)
POINT_SYNC_TOKEN: $($creds.Token)

Logs: logs\*.log
Stop: stop-dev.bat
"@

  Write-Host ""
  Write-Host "========================================" -ForegroundColor Green
  Write-Host "  STARTED"
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
