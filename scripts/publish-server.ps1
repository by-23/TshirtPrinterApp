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

$outDir = Join-Path $Root "dist-modules"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$zipName = "server-$Version.zip"
$zipPath = Join-Path $outDir $zipName
$ymlPath = Join-Path $outDir "server.yml"
$staging = Join-Path $env:TEMP "tshirt-server-module-$Version"

Write-Step "Pack portable server (dereferenced node_modules, zip round-trip gate)"
node (Join-Path $Root "scripts\pack-point-server.cjs") --out $staging --zip $zipPath --yml $ymlPath --version $Version --smoke
if ($LASTEXITCODE -ne 0) { throw "pack-point-server failed" }

$size = (Get-Item $zipPath).Length

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
