const { autoUpdater } = require("electron-updater");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

/**
 * Download in background while the app stays open.
 * On install: write a helper .cmd, quit the app, helper waits for exit,
 * kills leftovers, moves INSTDIR aside, runs NSIS /S (or zip fallback),
 * then relaunches. Avoids electron-updater quitAndInstall and the NSIS
 * "app still running" Retry dialog (false-positive on bundled node.exe).
 */
function setupAutoUpdater(opts) {
  const { log, BrowserWindow, ipcMain, channel, prepareInstall } = opts;

  /** @type {{ state: string, version?: string, percent?: number, error?: string }} */
  let status = { state: "idle" };

  function broadcast() {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("desktop-update:status", status);
      }
    }
  }

  function setStatus(next) {
    status = next;
    broadcast();
    log(
      `updater: ${status.state}${status.version ? ` v${status.version}` : ""}${
        status.error ? ` — ${status.error}` : ""
      }`
    );
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.allowDowngrade = false;
  if (channel) autoUpdater.channel = channel;

  function isNewerVersion(remote, local) {
    const parse = (v) =>
      String(v || "")
        .replace(/^v/i, "")
        .split(/[.-]/)
        .map((p) => {
          const n = parseInt(p, 10);
          return Number.isFinite(n) ? n : 0;
        });
    const a = parse(remote);
    const b = parse(local);
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
      const x = a[i] || 0;
      const y = b[i] || 0;
      if (x > y) return true;
      if (x < y) return false;
    }
    return false;
  }

  autoUpdater.on("checking-for-update", () => {
    if (status.state === "ready" || status.state === "downloading") return;
    setStatus({ state: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    const remote = info && info.version ? String(info.version) : "";
    const local = app.getVersion();
    if (!remote || !isNewerVersion(remote, local)) {
      log(`updater: ignore remote v${remote || "?"} (local v${local})`);
      setStatus({ state: "idle", version: local });
      return;
    }
    setStatus({
      state: "downloading",
      version: remote,
      percent: 0,
    });
    autoUpdater.downloadUpdate().catch((err) => {
      const message = err && err.message ? String(err.message) : String(err);
      log(`downloadUpdate failed: ${message}`);
      setStatus({ state: "error", error: message, version: remote });
    });
  });

  autoUpdater.on("update-not-available", (info) => {
    if (status.state === "ready" || status.state === "downloading") return;
    setStatus({
      state: "idle",
      version: (info && info.version) || app.getVersion(),
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    setStatus({
      state: "downloading",
      version: status.version,
      percent: Math.round(progress.percent || 0),
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    setStatus({
      state: "ready",
      version: info.version,
      percent: 100,
    });
    // Kiosk has no update UI — apply shell update automatically after download.
    setTimeout(() => {
      if (status.state !== "ready") return;
      log(`updater: auto-installing kiosk shell v${info.version}`);
      void (async () => {
        setStatus({ ...status, state: "installing" });
        try {
          if (typeof prepareInstall === "function") await prepareInstall();
        } catch (err) {
          log(`prepareInstall failed: ${err && err.message ? err.message : err}`);
        }
        const installerPath = resolveDownloadedInstaller();
        if (!installerPath) {
          setStatus({
            state: "ready",
            version: info.version,
            percent: 100,
            error: "installer file not found in updater cache",
          });
          return;
        }
        try {
          launchExternalInstaller(installerPath);
          setTimeout(() => app.quit(), 400);
        } catch (err) {
          const message = err && err.message ? String(err.message) : String(err);
          setStatus({ state: "ready", version: info.version, percent: 100, error: message });
        }
      })();
    }, 2_000);
  });

  autoUpdater.on("error", (err) => {
    const message = err && err.message ? String(err.message) : String(err);
    if (status.state === "ready") {
      log(`updater error (ignored, update ready): ${message}`);
      return;
    }
    setStatus({ state: "error", error: message, version: status.version });
  });

  function resolveDownloadedInstaller() {
    const updaterCache = path.join(app.getPath("localAppData"), "@tshirtkiosk-desktop-updater");
    const altCache = path.join(app.getPath("localAppData"), "tshirt-kiosk-desktop-updater");
    const pending = path.join(updaterCache, "pending");
    const candidates = [];
    for (const dir of [pending, updaterCache, altCache, path.join(altCache, "pending")]) {
      if (!fs.existsSync(dir)) continue;
      for (const name of fs.readdirSync(dir)) {
        if (!/\.exe$/i.test(name)) continue;
        if (/uninstall/i.test(name)) continue;
        candidates.push(path.join(dir, name));
      }
    }
    candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return candidates[0] || null;
  }

  /**
   * Detached cmd: wait for PID → kill INSTDIR procs → rename INSTDIR aside →
   * silent NSIS → zip/robocopy fallback → start app → cleanup.
   */
  function launchExternalInstaller(installerPath) {
    const installDir = path.dirname(process.execPath);
    const helper = path.join(app.getPath("temp"), `tshirt-apply-update-${Date.now()}.cmd`);
    const psHelper = path.join(app.getPath("temp"), `tshirt-apply-update-${Date.now()}.ps1`);
    const pid = process.pid;
    const exeName = path.basename(process.execPath);
    const zipPath = installerPath.replace(/\.exe$/i, ".zip");

    const ps = `
$ErrorActionPreference = 'Continue'
$pidWait = ${pid}
$installer = ${JSON.stringify(installerPath)}
$zipPath = ${JSON.stringify(zipPath)}
$instDir = ${JSON.stringify(installDir)}
$exeName = ${JSON.stringify(exeName)}
$exePath = Join-Path $instDir $exeName
$logFile = Join-Path $env:TEMP 'tshirt-apply-update.log'

function Log([string]$m) {
  $line = ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m)
  Add-Content -Path $logFile -Value $line -Encoding UTF8
}

Log "wait pid=$pidWait"
for ($i = 0; $i -lt 120; $i++) {
  $alive = Get-Process -Id $pidWait -ErrorAction SilentlyContinue
  if (-not $alive) { break }
  Start-Sleep -Seconds 1
}
Start-Sleep -Seconds 2

function Kill-Under([string]$dir) {
  if (-not $dir -or -not (Test-Path $dir)) { return }
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($dir, 'CurrentCultureIgnoreCase') } |
    ForEach-Object {
      Log ("kill {0} {1}" -f $_.ProcessId, $_.Name)
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
  Get-Process -Name ($exeName -replace '\\.exe$','') -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
}

Kill-Under $instDir
Start-Sleep -Seconds 2
Kill-Under $instDir
Start-Sleep -Seconds 1

$bak = $null
if (Test-Path $instDir) {
  $bak = "$instDir.__old_$(Get-Date -Format 'yyyyMMddHHmmss')"
  Log "rename $instDir -> $bak"
  try {
    Rename-Item -LiteralPath $instDir -NewName (Split-Path $bak -Leaf) -Force
  } catch {
    Log ("rename failed: {0}" -f $_.Exception.Message)
    # Last resort: delete what we can
    Remove-Item -LiteralPath $instDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$parent = Split-Path $instDir -Parent
if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }

$ok = $false
if (Test-Path $installer) {
  Log "nsis $installer"
  $p = Start-Process -FilePath $installer -ArgumentList @('/S','--updated','--force-run') -PassThru -Wait
  Log ("nsis exit={0}" -f $p.ExitCode)
  if ((Test-Path $exePath) -and $p.ExitCode -eq 0) { $ok = $true }
}

if (-not $ok) {
  # Prefer zip next to installer (electron-builder publishes both)
  $zip = $null
  if (Test-Path $zipPath) { $zip = $zipPath }
  else {
    $dir = Split-Path $installer -Parent
    $zip = Get-ChildItem $dir -Filter 'TshirtPrinterKiosk-Setup-*.zip' -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
  }
  if ($zip -and (Test-Path $zip)) {
    Log "zip fallback $zip"
    $staging = Join-Path $env:TEMP ("tshirt-kiosk-zip-" + [guid]::NewGuid().ToString('N'))
    if (Test-Path $staging) { Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Path $staging -Force | Out-Null
    try {
      $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
      $extracted = $false
      if (Test-Path -LiteralPath $tar) {
        $tp = Start-Process -FilePath $tar -ArgumentList @('-xf', $zip, '-C', $staging) -Wait -PassThru -WindowStyle Hidden
        if ($tp.ExitCode -eq 0) { $extracted = $true }
      }
      if (-not $extracted) {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $staging)
      }
      $src = $staging
      if (-not (Test-Path (Join-Path $src $exeName))) {
        $found = Get-ChildItem $staging -Recurse -Filter $exeName -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { $src = $found.DirectoryName }
      }
      if (Test-Path (Join-Path $src $exeName)) {
        if (Test-Path $instDir) { Remove-Item -LiteralPath $instDir -Recurse -Force -ErrorAction SilentlyContinue }
        New-Item -ItemType Directory -Path $instDir -Force | Out-Null
        & robocopy $src $instDir /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
        if (Test-Path $exePath) { $ok = $true; Log 'zip restore ok' }
      }
    } finally {
      Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

if ($bak -and (Test-Path $bak)) {
  if ($ok) {
    Log "remove bak $bak"
    Remove-Item -LiteralPath $bak -Recurse -Force -ErrorAction SilentlyContinue
  } else {
    Log "restore bak (install failed)"
    if (Test-Path $instDir) { Remove-Item -LiteralPath $instDir -Recurse -Force -ErrorAction SilentlyContinue }
    Rename-Item -LiteralPath $bak -NewName (Split-Path $instDir -Leaf) -Force -ErrorAction SilentlyContinue
  }
}

if (Test-Path $exePath) {
  Log "start $exePath"
  Start-Process -FilePath $exePath
} else {
  Log 'ERROR: exe missing after update'
}

Remove-Item -LiteralPath ${JSON.stringify(psHelper)} -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath ${JSON.stringify(helper)} -Force -ErrorAction SilentlyContinue
`.trim();

    fs.writeFileSync(psHelper, ps, "utf8");
    // Tiny .cmd so we can spawn detached without a visible console hanging on powershell profile.
    const cmd = [
      "@echo off",
      `powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${psHelper.replace(/"/g, "")}"`,
    ].join("\r\n");
    fs.writeFileSync(helper, cmd, "utf8");
    log(`updater: external helper ${helper}`);
    log(`updater: installer ${installerPath}`);
    spawn("cmd.exe", ["/c", helper], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
  }

  ipcMain.handle("desktop-update:getStatus", () => status);
  ipcMain.handle("desktop-update:install", async () => {
    if (status.state !== "ready") {
      return { ok: false, error: "update not ready" };
    }
    setStatus({ ...status, state: "installing" });
    try {
      if (typeof prepareInstall === "function") {
        await prepareInstall();
      }
    } catch (err) {
      const message = err && err.message ? String(err.message) : String(err);
      log(`prepareInstall failed: ${message}`);
    }

    const installerPath = resolveDownloadedInstaller();
    if (!installerPath) {
      setStatus({
        state: "ready",
        version: status.version,
        percent: 100,
        error: "installer file not found in updater cache",
      });
      return { ok: false, error: "installer file not found" };
    }

    try {
      launchExternalInstaller(installerPath);
    } catch (err) {
      const message = err && err.message ? String(err.message) : String(err);
      log(`launchExternalInstaller failed: ${message}`);
      setStatus({ state: "ready", version: status.version, percent: 100, error: message });
      return { ok: false, error: message };
    }

    setTimeout(() => {
      app.quit();
    }, 400);
    return { ok: true };
  });

  ipcMain.handle("desktop-update:check", async () => {
    try {
      await autoUpdater.checkForUpdates();
      return { ok: true, status };
    } catch (err) {
      const message = err && err.message ? String(err.message) : String(err);
      return { ok: false, error: message, status };
    }
  });

  function start() {
    if (!app.isPackaged) {
      log("updater: skipped (not packaged)");
      setStatus({ state: "idle", version: app.getVersion() });
      return;
    }

    setStatus({ state: "idle", version: app.getVersion() });

    const check = () => {
      autoUpdater.checkForUpdates().catch((err) => {
        log(`checkForUpdates failed: ${err && err.message ? err.message : err}`);
      });
    };

    setTimeout(check, 8_000);
    setInterval(check, 4 * 60 * 60 * 1000);
  }

  return { start, getStatus: () => status };
}

module.exports = { setupAutoUpdater };
