#Requires -Version 5.1
<#
.SYNOPSIS
  Build and publish point-server module zip (no catalog/data) to GitHub tag `modules`.
#>
param(
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) not found."
}

$pkgPath = Join-Path $Root "apps\point-server\package.json"
if (-not $Version) {
  $Version = node -e "const p=require('./apps/point-server/package.json'); const [a,b,c]=String(p.version||'0.0.0').split('.').map(Number); const n=[a||0,b||0,(c||0)+1].join('.'); p.version=n; require('fs').writeFileSync('./apps/point-server/package.json', JSON.stringify(p,null,2)+'\n'); console.log(n)"
  if ($LASTEXITCODE -ne 0) { throw "version bump failed" }
  $Version = $Version.Trim()
}

Write-Step "Server module version $Version"

Write-Step "Build shared + point-server"
pnpm --filter @tshirt/shared-types build
pnpm --filter @tshirt/point-server build
if ($LASTEXITCODE -ne 0) { throw "point-server build failed" }

$pointSrc = Join-Path $Root "apps\point-server"
$staging = Join-Path $env:TEMP "tshirt-server-module-$Version"
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Force -Path $staging | Out-Null

Copy-Item -Recurse -Force (Join-Path $pointSrc "dist") (Join-Path $staging "dist")
Copy-Item -Recurse -Force (Join-Path $pointSrc "drizzle") (Join-Path $staging "drizzle")
if (Test-Path (Join-Path $pointSrc "assets")) {
  Copy-Item -Recurse -Force (Join-Path $pointSrc "assets") (Join-Path $staging "assets")
}

$vendorTypes = Join-Path $staging "vendor\shared-types"
New-Item -ItemType Directory -Force -Path (Join-Path $vendorTypes "dist") | Out-Null
Copy-Item -Recurse -Force (Join-Path $Root "packages\shared-types\dist\*") (Join-Path $vendorTypes "dist")
@(
  '{'
  '  "name": "@tshirt/shared-types",'
  '  "version": "0.0.0",'
  '  "type": "module",'
  '  "main": "./dist/index.js",'
  '  "types": "./dist/index.d.ts",'
  '  "dependencies": { "zod": "^3.24.1" }'
  '}'
) | Set-Content -Path (Join-Path $vendorTypes "package.json") -Encoding ASCII

$pkgText = Get-Content -Path (Join-Path $pointSrc "package.json") -Raw -Encoding UTF8
$pkgText = $pkgText -replace '"@tshirt/shared-types"\s*:\s*"workspace:\*"', '"@tshirt/shared-types": "file:./vendor/shared-types"'
Set-Content -Path (Join-Path $staging "package.json") -Value $pkgText -Encoding UTF8

if (Test-Path (Join-Path $pointSrc ".env")) {
  Copy-Item -Force (Join-Path $pointSrc ".env") (Join-Path $staging ".env")
}

Write-Step "npm install --omit=dev (nested)"
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1"
Push-Location $staging
try {
  npm install --omit=dev --install-strategy=nested --no-fund --no-audit
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

  # Compress-Archive drops NTFS junctions/symlinks from file: deps — materialize a real copy.
  $linkDir = Join-Path $staging "node_modules\@tshirt\shared-types"
  New-Item -ItemType Directory -Force -Path (Join-Path $staging "node_modules\@tshirt") | Out-Null
  if (Test-Path $linkDir) { Remove-Item -Recurse -Force $linkDir }
  Copy-Item -Recurse -Force $vendorTypes $linkDir
  if (-not (Test-Path (Join-Path $linkDir "package.json"))) {
    throw "shared-types was not installed into node_modules/@tshirt/shared-types"
  }
  if (-not (Test-Path (Join-Path $staging "node_modules\zod"))) {
    npm install zod@3.24.1 --omit=dev --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { throw "zod install failed" }
  }
} finally {
  Pop-Location
}

$verJson = (@{ version = $Version } | ConvertTo-Json)
[System.IO.File]::WriteAllText((Join-Path $staging "module-version.json"), $verJson + "`n")

$outDir = Join-Path $Root "dist-modules"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$zipName = "server-$Version.zip"
$zipPath = Join-Path $outDir $zipName
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

Write-Step "Zip $zipName (no data/catalog)"
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force

$sha = [Convert]::ToBase64String([System.Security.Cryptography.SHA512]::Create().ComputeHash(
  [System.IO.File]::ReadAllBytes($zipPath)
))
$size = (Get-Item $zipPath).Length
$ymlPath = Join-Path $outDir "server.yml"
@(
  "version: $Version"
  "path: $zipName"
  "sha512: $sha"
  "size: $size"
) | Set-Content -Path $ymlPath -Encoding ASCII

Write-Host ("Server zip: {0} ({1:N1} MB)" -f $zipPath, ($size / 1MB))
if (($size / 1MB) -gt 120) {
  Write-Host "WARNING: server zip > 120 MB - consider trimming deps" -ForegroundColor Yellow
}

$tag = "modules"
Write-Step "Publish to GitHub release $tag"
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
gh release view $tag --repo by-23/TshirtPrinterApp 2>$null | Out-Null
$viewExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap

$files = @($ymlPath, $zipPath)
if ($viewExit -eq 0) {
  gh release upload $tag @files --repo by-23/TshirtPrinterApp --clobber
  if ($LASTEXITCODE -ne 0) { throw "gh release upload failed" }
} else {
  gh release create $tag @files `
    --repo by-23/TshirtPrinterApp `
    --title "Modules (ui/server)" `
    --notes "Modular updates: ui / server zips. Not a full desktop installer." `
    --latest=false
  if ($LASTEXITCODE -ne 0) { throw "gh release create failed" }
}

Write-Host ""
Write-Host "Published server v$Version -> https://github.com/by-23/TshirtPrinterApp/releases/tag/$tag" -ForegroundColor Green
