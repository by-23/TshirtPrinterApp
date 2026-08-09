#Requires -Version 5.1
<#
.SYNOPSIS
  Build and publish only the UI module (~15-40 MB) to GitHub release tag `modules`.
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

$pkgPath = Join-Path $Root "apps\kiosk-operator-app\package.json"
if (-not $Version) {
  $Version = node -e "const p=require('./apps/kiosk-operator-app/package.json'); const [a,b,c]=String(p.version||'0.0.0').split('.').map(Number); const n=[a||0,b||0,(c||0)+1].join('.'); p.version=n; require('fs').writeFileSync('./apps/kiosk-operator-app/package.json', JSON.stringify(p,null,2)+'\n'); console.log(n)"
  if ($LASTEXITCODE -ne 0) { throw "version bump failed" }
  $Version = $Version.Trim()
}

Write-Step "UI module version $Version"
$uiApp = Join-Path $Root "apps\kiosk-operator-app"
$dist = Join-Path $uiApp "dist"
$versionJson = Join-Path $uiApp "public\ui-version.json"
New-Item -ItemType Directory -Force -Path (Join-Path $uiApp "public") | Out-Null
$verJsonEarly = (@{ version = $Version } | ConvertTo-Json)
[System.IO.File]::WriteAllText($versionJson, $verJsonEarly + "`n")

Write-Step "Build UI"
pnpm --filter @tshirt/kiosk-operator-app build
if ($LASTEXITCODE -ne 0) { throw "UI build failed" }
if (-not (Test-Path (Join-Path $dist "index.html"))) { throw "dist/index.html missing" }

# Ensure version file is in dist even if public copy was skipped. No BOM вЂ” Node JSON.parse rejects it.
$verJson = (@{ version = $Version } | ConvertTo-Json)
[System.IO.File]::WriteAllText((Join-Path $dist "ui-version.json"), $verJson + "`n")
[System.IO.File]::WriteAllText((Join-Path $dist "module-version.json"), $verJson + "`n")
[System.IO.File]::WriteAllText($versionJson, $verJson + "`n")

$outDir = Join-Path $Root "dist-modules"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$zipName = "ui-$Version.zip"
$zipPath = Join-Path $outDir $zipName
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

Write-Step "Zip $zipName"
Compress-Archive -Path (Join-Path $dist "*") -DestinationPath $zipPath -Force

$sha = [Convert]::ToBase64String([System.Security.Cryptography.SHA512]::Create().ComputeHash(
  [System.IO.File]::ReadAllBytes($zipPath)
))
$size = (Get-Item $zipPath).Length
$ymlPath = Join-Path $outDir "ui.yml"
@(
  "version: $Version"
  "path: $zipName"
  "sha512: $sha"
  "size: $size"
) | Set-Content -Path $ymlPath -Encoding ASCII

Write-Host ("UI zip: {0} ({1:N1} MB)" -f $zipPath, ($size / 1MB))

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
Write-Host "Published UI v$Version -> https://github.com/by-23/TshirtPrinterApp/releases/tag/$tag" -ForegroundColor Green

