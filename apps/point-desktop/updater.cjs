const { autoUpdater } = require("electron-updater");

/**
 * Background download + user-triggered install for Operator desktop.
 * Emits status to all BrowserWindows via IPC channel "desktop-update:status".
 *
 * @param {{
 *   log: (msg: string) => void,
 *   BrowserWindow: typeof import("electron").BrowserWindow,
 *   ipcMain: typeof import("electron").ipcMain,
 *   channel: string,
 * }} opts
 */
function setupAutoUpdater(opts) {
  const { log, BrowserWindow, ipcMain, channel } = opts;

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
    log(`updater: ${status.state}${status.version ? ` v${status.version}` : ""}${status.error ? ` — ${status.error}` : ""}`);
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  if (channel) autoUpdater.channel = channel;

  autoUpdater.on("checking-for-update", () => {
    if (status.state === "ready" || status.state === "downloading") return;
    setStatus({ state: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    setStatus({
      state: "downloading",
      version: info.version,
      percent: 0,
    });
  });

  autoUpdater.on("update-not-available", () => {
    if (status.state === "ready" || status.state === "downloading") return;
    setStatus({ state: "idle" });
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
  });

  autoUpdater.on("error", (err) => {
    const message = err && err.message ? String(err.message) : String(err);
    // Keep "ready" if a previous download already finished.
    if (status.state === "ready") {
      log(`updater error (ignored, update ready): ${message}`);
      return;
    }
    setStatus({ state: "error", error: message, version: status.version });
  });

  ipcMain.handle("desktop-update:getStatus", () => status);
  ipcMain.handle("desktop-update:install", () => {
    if (status.state !== "ready") {
      return { ok: false, error: "update not ready" };
    }
    setStatus({ ...status, state: "installing" });
    // isSilent=false, isForceRunAfter=true — relaunch after NSIS install.
    setImmediate(() => {
      try {
        autoUpdater.quitAndInstall(false, true);
      } catch (err) {
        const message = err && err.message ? String(err.message) : String(err);
        log(`quitAndInstall failed: ${message}`);
        setStatus({ state: "ready", version: status.version, percent: 100, error: message });
      }
    });
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
    const { app } = require("electron");
    if (!app.isPackaged) {
      log("updater: skipped (not packaged)");
      return;
    }

    const check = () => {
      autoUpdater.checkForUpdates().catch((err) => {
        log(`checkForUpdates failed: ${err && err.message ? err.message : err}`);
      });
    };

    // Slight delay so UI windows can subscribe first.
    setTimeout(check, 8_000);
    setInterval(check, 4 * 60 * 60 * 1000);
  }

  return { start, getStatus: () => status };
}

module.exports = { setupAutoUpdater };
