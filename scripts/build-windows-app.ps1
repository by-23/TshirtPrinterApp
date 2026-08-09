#Requires -Version 5.1
<#
  Optional Windows code signing (recommended OV cert for SmartScreen):
    $env:CSC_LINK = "C:\path\to\certificate.pfx"
    $env:CSC_KEY_PASSWORD = "your-pfx-password"
  electron-builder picks these up automatically when set.
#>
$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Assert-Command([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Command not found: $name"
  }
}

Write-Host "Build Windows apps (Operator + Kiosk)" -ForegroundColor Green
Write-Host "Root: $Root"

Assert-Command node
Assert-Command pnpm
Assert-Command npm

$nodeVersion = (node -v).TrimStart("v")
$nodeMajor = [int]($nodeVersion.Split(".")[0])
if ($nodeMajor -lt 22) {
  throw "Need Node.js >= 22 to build. Current: $(node -v)"
}

Write-Step "pnpm install"
pnpm install
if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }

Write-Step "Build workspace packages + UI + point-server"
pnpm --filter @tshirt/shared-types build
if ($LASTEXITCODE -ne 0) { throw "shared-types build failed" }
pnpm --filter @tshirt/shared-pricing build
if ($LASTEXITCODE -ne 0) { throw "shared-pricing build failed" }
pnpm --filter @tshirt/i18n build
if ($LASTEXITCODE -ne 0) { throw "i18n build failed" }
pnpm --filter @tshirt/ui-kit build
if ($LASTEXITCODE -ne 0) { throw "ui-kit build failed" }

pnpm --filter @tshirt/kiosk-operator-app build
if ($LASTEXITCODE -ne 0) { throw "kiosk-operator-app build failed" }

pnpm --filter @tshirt/point-server build
if ($LASTEXITCODE -ne 0) { throw "point-server build failed" }

$desktop = Join-Path $Root "apps\point-desktop"
$resources = Join-Path $desktop "resources"
$pointPack = Join-Path $resources "point-server"
$nodePack = Join-Path $resources "node"
$uiDistSrc = Join-Path $Root "apps\kiosk-operator-app\dist"
$pointSrc = Join-Path $Root "apps\point-server"

if (-not (Test-Path (Join-Path $uiDistSrc "index.html"))) {
  throw "UI dist missing: $uiDistSrc"
}

Write-Step "Prepare resources folder"
if (Test-Path $resources) {
  Remove-Item -Recurse -Force $resources
}
New-Item -ItemType Directory -Force -Path $pointPack | Out-Null
New-Item -ItemType Directory -Force -Path $nodePack | Out-Null

Write-Step "Assemble point-server pack (npm nested - real files, no pnpm symlinks)"
# electron-builder does not reliably copy Windows SYMLINKD from pnpm deploy.
Copy-Item -Recurse -Force (Join-Path $pointSrc "dist") (Join-Path $pointPack "dist")
Copy-Item -Recurse -Force (Join-Path $pointSrc "drizzle") (Join-Path $pointPack "drizzle")
Copy-Item -Recurse -Force $uiDistSrc (Join-Path $pointPack "ui-dist")

$vendorTypes = Join-Path $pointPack "vendor\shared-types"
New-Item -ItemType Directory -Force -Path (Join-Path $vendorTypes "dist") | Out-Null
Copy-Item -Recurse -Force (Join-Path $Root "packages\shared-types\dist\*") (Join-Path $vendorTypes "dist")
@(
  '{'
  '  "name": "@tshirt/shared-types",'
  '  "version": "0.0.0",'
  '  "type": "module",'
  '  "main": "./dist/index.js",'
  '  "types": "./dist/index.d.ts",'
  '  "dependencies": {'
  '    "zod": "^3.24.1"'
  '  }'
  '}'
) | Set-Content -Path (Join-Path $vendorTypes "package.json") -Encoding ASCII

$pkgText = Get-Content -Path (Join-Path $pointSrc "package.json") -Raw -Encoding UTF8
$pkgText = $pkgText -replace '"@tshirt/shared-types"\s*:\s*"workspace:\*"', '"@tshirt/shared-types": "file:./vendor/shared-types"'
# Drop scripts that need tsx/dev tools in the packaged app.
Set-Content -Path (Join-Path $pointPack "package.json") -Value $pkgText -Encoding UTF8

$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1"
Push-Location $pointPack
try {
  # nested = classic node_modules tree without symlinks/junctions (safe for electron-builder copy)
  npm install --omit=dev --install-strategy=nested --no-fund --no-audit
  if ($LASTEXITCODE -ne 0) { throw "npm install --omit=dev failed for point-server pack" }
} finally {
  Pop-Location
}

if (-not (Test-Path (Join-Path $pointPack "node_modules\drizzle-orm\package.json"))) {
  throw "Packaged node_modules incomplete (drizzle-orm missing)"
}
if (-not (Test-Path (Join-Path $pointPack "node_modules\better-sqlite3\package.json"))) {
  throw "Packaged node_modules incomplete (better-sqlite3 missing)"
}

New-Item -ItemType Directory -Force -Path (Join-Path $pointPack "data") | Out-Null

# Pack sync credentials so packaged Electron uses the cloud relay (api.kyoma.uk).
$pointEnvSrc = Join-Path $pointSrc ".env"
if (Test-Path $pointEnvSrc) {
  Copy-Item -Force $pointEnvSrc (Join-Path $pointPack ".env")
  Write-Host "Copied point-server .env (CENTRAL_RELAY_URL / POINT_SYNC_*) into pack"
} else {
  Write-Host "WARNING: apps/point-server/.env missing - packaged app will run without cloud sync" -ForegroundColor Yellow
}

# Bundled assets (garment templates for mockup rendering) - read from cwd/assets.
$assetsSrc = Join-Path $pointSrc "assets"
if (Test-Path $assetsSrc) {
  Copy-Item -Recurse -Force $assetsSrc (Join-Path $pointPack "assets")
}

# Do NOT ship catalog/orders/data — points + admin sync own that.
# Guard: fail the build if top-level deps are still symlinks (would vanish in the exe).
$symlinkHit = cmd /c "dir /AL `"$pointPack\node_modules`" 2>nul"
if ($symlinkHit -match "SYMLINK") {
  Write-Host $symlinkHit
  throw "node_modules still contains symlinks - electron-builder would drop them"
}

Write-Step "Download portable Node.js $nodeVersion (win-x64)"
$nodeZip = Join-Path $env:TEMP "node-v$nodeVersion-win-x64.zip"
$nodeUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-win-x64.zip"
if (-not (Test-Path $nodeZip)) {
  Write-Host "Downloading $nodeUrl"
  Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip
} else {
  Write-Host "Using cached $nodeZip"
}

$nodeExtract = Join-Path $env:TEMP "node-v$nodeVersion-win-x64-extract"
if (Test-Path $nodeExtract) { Remove-Item -Recurse -Force $nodeExtract }
Expand-Archive -Path $nodeZip -DestinationPath $nodeExtract -Force
$extractedRoot = Get-ChildItem $nodeExtract -Directory | Select-Object -First 1
Copy-Item -Force (Join-Path $extractedRoot.FullName "node.exe") (Join-Path $nodePack "node.exe")

Write-Step "Smoke-test packaged point-server"
$smokeData = Join-Path $env:TEMP "tshirt-smoke-data"
if (Test-Path $smokeData) { Remove-Item -Recurse -Force $smokeData }
New-Item -ItemType Directory -Force -Path $smokeData | Out-Null
$smokeOut = Join-Path $env:TEMP "tshirt-smoke-out.txt"
$smokeErr = Join-Path $env:TEMP "tshirt-smoke-err.txt"
$prevPort = $env:PORT
$prevDataDir = $env:DATA_DIR
$prevDb = $env:DATABASE_PATH
$prevUi = $env:UI_DIST_PATH
$prevRelay = $env:CENTRAL_RELAY_URL
$prevId = $env:POINT_SYNC_ID
$prevTok = $env:POINT_SYNC_TOKEN
$env:PORT = "4011"
$env:DATA_DIR = $smokeData
$env:DATABASE_PATH = (Join-Path $smokeData "point.db")
$env:BACKUP_ENABLED = "0"
$env:UI_DIST_PATH = (Join-Path $pointPack "ui-dist")
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1"
$env:CENTRAL_RELAY_URL = ""
$env:POINT_SYNC_ID = ""
$env:POINT_SYNC_TOKEN = ""
try {
  $smokeProc = Start-Process -FilePath (Join-Path $nodePack "node.exe") `
    -ArgumentList "dist\index.js" `
    -WorkingDirectory $pointPack `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput $smokeOut `
    -RedirectStandardError $smokeErr
  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if ($smokeProc.HasExited) { break }
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:4011/health" -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
  }
  if (-not $smokeProc.HasExited) {
    Stop-Process -Id $smokeProc.Id -Force -ErrorAction SilentlyContinue
  }
  if (-not $ready) {
    Write-Host "--- smoke stdout ---" -ForegroundColor Yellow
    Get-Content $smokeOut -ErrorAction SilentlyContinue | Select-Object -Last 30
    Write-Host "--- smoke stderr ---" -ForegroundColor Yellow
    Get-Content $smokeErr -ErrorAction SilentlyContinue | Select-Object -Last 30
    throw "Packaged point-server failed smoke test on :4011"
  }
  Write-Host "Smoke test OK"
} finally {
  if ($null -ne $prevPort) { $env:PORT = $prevPort } else { Remove-Item Env:PORT -ErrorAction SilentlyContinue }
  if ($null -ne $prevDataDir) { $env:DATA_DIR = $prevDataDir } else { Remove-Item Env:DATA_DIR -ErrorAction SilentlyContinue }
  if ($null -ne $prevDb) { $env:DATABASE_PATH = $prevDb } else { Remove-Item Env:DATABASE_PATH -ErrorAction SilentlyContinue }
  if ($null -ne $prevUi) { $env:UI_DIST_PATH = $prevUi } else { Remove-Item Env:UI_DIST_PATH -ErrorAction SilentlyContinue }
  if ($null -ne $prevRelay) { $env:CENTRAL_RELAY_URL = $prevRelay } else { Remove-Item Env:CENTRAL_RELAY_URL -ErrorAction SilentlyContinue }
  if ($null -ne $prevId) { $env:POINT_SYNC_ID = $prevId } else { Remove-Item Env:POINT_SYNC_ID -ErrorAction SilentlyContinue }
  if ($null -ne $prevTok) { $env:POINT_SYNC_TOKEN = $prevTok } else { Remove-Item Env:POINT_SYNC_TOKEN -ErrorAction SilentlyContinue }
}

Write-Step "Install electron + electron-builder (operator)"
Push-Location $desktop
try {
  pnpm install
  if ($LASTEXITCODE -ne 0) { throw "point-desktop install failed" }

  Write-Step "electron-builder operator (NSIS + zip)"
  pnpm exec electron-builder --win
  if ($LASTEXITCODE -ne 0) { throw "electron-builder (operator) failed" }
} finally {
  Pop-Location
}

# Verify node_modules survived packaging
$packedNm = Join-Path $desktop "release\win-unpacked\resources\point-server\node_modules\drizzle-orm\package.json"
if (-not (Test-Path $packedNm)) {
  throw "FATAL: node_modules missing inside win-unpacked - packaging still broken"
}

$kioskDesktop = Join-Path $Root "apps\kiosk-desktop"
Write-Step "Install electron + electron-builder (kiosk)"
Push-Location $kioskDesktop
try {
  pnpm install
  if ($LASTEXITCODE -ne 0) { throw "kiosk-desktop install failed" }

  Write-Step "electron-builder kiosk (NSIS + zip)"
  pnpm exec electron-builder --win
  if ($LASTEXITCODE -ne 0) { throw "electron-builder (kiosk) failed" }
} finally {
  Pop-Location
}

$releaseDir = Join-Path $desktop "release"
$kioskReleaseDir = Join-Path $kioskDesktop "release"

Write-Step "Operator force installer (no NSIS Retry dialog)"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\make-operator-force-installer.ps1")
if ($LASTEXITCODE -ne 0) { throw "make-operator-force-installer failed" }

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  BUILD COMPLETE"
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Operator for client (USE THIS — run INSTALL.bat inside):" -ForegroundColor Green
Get-ChildItem $Root -Filter "dist-operator-install-*.zip" -ErrorAction SilentlyContinue | ForEach-Object {
  $mb = [math]::Round($_.Length / 1MB, 1)
  Write-Host ("  {0}  ({1} MB)" -f $_.FullName, $mb) -ForegroundColor Green
}
Write-Host "Folder: $(Join-Path $Root 'dist-operator-install')"
Write-Host ""
Write-Host "Kiosk NSIS installer:" -ForegroundColor Green
Get-ChildItem $kioskReleaseDir -Filter "TshirtPrinterKiosk-Setup-*-win-x64.exe" -ErrorAction SilentlyContinue | ForEach-Object {
  $mb = [math]::Round($_.Length / 1MB, 1)
  Write-Host ("  {0}  ({1} MB)" -f $_.FullName, $mb) -ForegroundColor Green
}
Write-Host "Folder: $kioskReleaseDir"
Write-Host ""
Write-Host "(NSIS Operator setup still in $releaseDir — prefer force zip above.)"
Write-Host "To publish updates to GitHub Releases:"
Write-Host "  powershell -File scripts\publish-windows-update.ps1"
Write-Host "  (or -SkipBuild if artifacts above are already fresh)"
if ($env:CSC_LINK) {
  Write-Host "Code signing: CSC_LINK is set"
} else {
  Write-Host "Code signing: not set (SmartScreen may warn). Set CSC_LINK + CSC_KEY_PASSWORD for OV/EV cert." -ForegroundColor Yellow
}
