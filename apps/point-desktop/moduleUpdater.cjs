/**
 * Downloads ui/server(/runtime) module zips from GitHub release tag `modules`.
 * Manifests: ui.yml / server.yml / runtime.yml next to the zip assets.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");
const { createWriteStream, createReadStream } = require("fs");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

const {
  ZONE_IDS,
  zoneDir,
  modulesRoot,
  readZoneVersion,
  setZoneVersion,
  listLocalZones,
} = require("./modules.cjs");

const GH_OWNER = "by-23";
const GH_REPO = "TshirtPrinterApp";
const MODULES_TAG = "modules";

/**
 * @param {{
 *   log: (msg: string) => void,
 *   BrowserWindow: typeof import("electron").BrowserWindow,
 *   ipcMain: typeof import("electron").ipcMain,
 *   beforeApply?: (zone: string) => Promise<void> | void,
 *   onApplied?: (zone: string) => Promise<void> | void,
 * }} opts
 */
function setupModuleUpdater(opts) {
  const { log, BrowserWindow, ipcMain, beforeApply, onApplied } = opts;

  /** @type {{ zones: Array<Record<string, unknown>>, error?: string }} */
  let snapshot = { zones: listLocalZones() };

  function broadcast() {
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        if (win.isDestroyed()) continue;
        const wc = win.webContents;
        if (!wc || wc.isDestroyed()) continue;
        wc.send("modules-update:status", snapshot);
      } catch {
        // Render frame disposed during reload — ignore.
      }
    }
  }

  function setSnapshot(next) {
    snapshot = next;
    broadcast();
  }

  function updateZone(id, patch) {
    const zones = snapshot.zones.map((z) => (z.id === id ? { ...z, ...patch } : z));
    // Ensure zone exists
    if (!zones.some((z) => z.id === id)) {
      zones.push({ id, ...patch });
    }
    setSnapshot({ ...snapshot, zones, error: undefined });
  }

  function downloadUrl(fileName) {
    return `https://github.com/${GH_OWNER}/${GH_REPO}/releases/download/${MODULES_TAG}/${fileName}`;
  }

  function fetchText(url) {
    return new Promise((resolve, reject) => {
      const lib = url.startsWith("https") ? https : http;
      const req = lib.get(
        url,
        {
          headers: { "User-Agent": "TshirtPrinter-ModuleUpdater", Accept: "application/octet-stream" },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            fetchText(res.headers.location).then(resolve, reject);
            return;
          }
          if (!res.statusCode || res.statusCode >= 400) {
            res.resume();
            reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            return;
          }
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
          res.on("error", reject);
        },
      );
      req.on("error", reject);
      req.setTimeout(30_000, () => {
        req.destroy();
        reject(new Error(`timeout fetching ${url}`));
      });
    });
  }

  function downloadFile(url, dest, onProgress) {
    return new Promise((resolve, reject) => {
      const lib = url.startsWith("https") ? https : http;
      const req = lib.get(
        url,
        { headers: { "User-Agent": "TshirtPrinter-ModuleUpdater", Accept: "application/octet-stream" } },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            downloadFile(res.headers.location, dest, onProgress).then(resolve, reject);
            return;
          }
          if (!res.statusCode || res.statusCode >= 400) {
            res.resume();
            reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
            return;
          }
          const total = Number(res.headers["content-length"] || 0);
          let received = 0;
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          const out = createWriteStream(dest);
          res.on("data", (chunk) => {
            received += chunk.length;
            if (total > 0 && onProgress) {
              onProgress(Math.round((received / total) * 100));
            }
          });
          res.pipe(out);
          out.on("finish", () => out.close(() => resolve(dest)));
          out.on("error", reject);
          res.on("error", reject);
        },
      );
      req.on("error", reject);
      req.setTimeout(10 * 60_000, () => {
        req.destroy();
        reject(new Error(`timeout downloading ${url}`));
      });
    });
  }

  function parseSimpleYml(text) {
    /** @type {Record<string, string>} */
    const out = {};
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z0-9_]+):\s*(.+)\s*$/);
      if (!m) continue;
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[m[1]] = value;
    }
    return out;
  }

  async function sha512File(filePath) {
    const hash = crypto.createHash("sha512");
    await pipeline(createReadStream(filePath), hash);
    return hash.digest("base64");
  }

  async function extractZip(zipPath, destDir) {
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
    fs.mkdirSync(destDir, { recursive: true });

    if (process.platform === "win32") {
      const tar = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
      if (fs.existsSync(tar)) {
        try {
          await execFileAsync(tar, ["-xf", zipPath, "-C", destDir], {
            windowsHide: true,
            maxBuffer: 10 * 1024 * 1024,
          });
          return;
        } catch (err) {
          log(`tar extract failed, falling back to .NET ZipFile: ${err && err.message ? err.message : err}`);
          if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
          fs.mkdirSync(destDir, { recursive: true });
        }
      }

      // Expand-Archive is buggy on some Windows builds (Remove-Item PathNotFound) — avoid it.
      const ps = `
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::ExtractToDirectory('${zipPath.replace(/'/g, "''")}', '${destDir.replace(/'/g, "''")}')
      `;
      await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], {
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
      });
      return;
    }
    throw new Error("zip extract only implemented on Windows");
  }

  /**
   * Zip may contain a single top-level folder or files at root.
   * Normalize so zoneDir has index.html (ui) or dist/index.js (server).
   */
  function normalizeExtracted(zone, extractDir) {
    const entries = fs.readdirSync(extractDir);
    if (entries.length === 1) {
      const only = path.join(extractDir, entries[0]);
      if (fs.statSync(only).isDirectory()) {
        const marker =
          zone === "ui"
            ? path.join(only, "index.html")
            : zone === "server"
              ? path.join(only, "dist", "index.js")
              : path.join(only, "node.exe");
        if (fs.existsSync(marker)) return only;
      }
    }
    return extractDir;
  }

  async function checkZone(zone) {
    updateZone(zone, {
      id: zone,
      localVersion: readZoneVersion(zone) || undefined,
      state: "checking",
      error: undefined,
    });
    try {
      const ymlText = await fetchText(downloadUrl(`${zone}.yml`));
      const meta = parseSimpleYml(ymlText);
      const remoteVersion = meta.version;
      const fileName = meta.path || meta.file;
      if (!remoteVersion || !fileName) {
        throw new Error(`${zone}.yml missing version/path`);
      }
      const localVersion = readZoneVersion(zone);
      const newer = !localVersion || localVersion !== remoteVersion;
      updateZone(zone, {
        id: zone,
        localVersion: localVersion || undefined,
        remoteVersion,
        path: fileName,
        sha512: meta.sha512,
        state: newer ? "ready" : "idle",
        error: undefined,
      });
      return newer;
    } catch (err) {
      const message = err && err.message ? String(err.message) : String(err);
      // Missing release is not fatal — zone stays idle.
      const soft = /HTTP 404/.test(message);
      updateZone(zone, {
        id: zone,
        localVersion: readZoneVersion(zone) || undefined,
        state: soft ? "idle" : "error",
        error: soft ? undefined : message,
      });
      if (!soft) log(`module check ${zone}: ${message}`);
      return false;
    }
  }

  async function checkAll(opts = {}) {
    // Default OFF: client PCs were auto-applying remote zips, Expand-Archive
    // failed mid-way, UI reloaded into a broken modules/ tree → blank window.
    // Dev PCs often already matched remote versions so never hit this path.
    const autoApply = opts.autoApply === true;
    setSnapshot({ zones: listLocalZones(), error: undefined });
    for (const zone of ["ui", "server"]) {
      const newer = await checkZone(zone);
      if (newer && autoApply) {
        log(`module ${zone}: newer available — auto-applying`);
        await applyZone(zone);
      }
    }
    cleanupTmp();
    return { ok: true, status: snapshot };
  }

  /** Drop stale zip/extract leftovers so modules/_tmp does not grow forever. */
  function cleanupTmp() {
    const tmpRoot = path.join(modulesRoot(), "_tmp");
    if (!fs.existsSync(tmpRoot)) return;
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(tmpRoot)) {
      const full = path.join(tmpRoot, name);
      try {
        const st = fs.statSync(full);
        if (st.mtimeMs < cutoff) {
          fs.rmSync(full, { recursive: true, force: true });
          log(`module tmp cleaned: ${name}`);
        }
      } catch (err) {
        log(`module tmp cleanup skip ${name}: ${err && err.message ? err.message : err}`);
      }
    }
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Finish a previous crash mid-swap (e.g. server.next left behind because
   * point-server still held file locks on modules/server).
   */
  function recoverStuckSwap(zone) {
    const target = zoneDir(zone);
    const next = `${target}.next`;
    const prev = `${target}.prev`;
    const marker =
      zone === "ui"
        ? path.join(next, "index.html")
        : zone === "server"
          ? path.join(next, "dist", "index.js")
          : path.join(next, "node.exe");
    if (!fs.existsSync(marker)) return false;
    log(`module ${zone}: recovering stuck ${path.basename(next)}`);
    if (fs.existsSync(prev)) fs.rmSync(prev, { recursive: true, force: true });
    if (fs.existsSync(target)) fs.renameSync(target, prev);
    fs.renameSync(next, target);
    if (fs.existsSync(prev)) {
      try {
        fs.rmSync(prev, { recursive: true, force: true });
      } catch (err) {
        log(`module ${zone}: prev cleanup deferred: ${err && err.message ? err.message : err}`);
      }
    }
    return true;
  }

  async function applyZone(zone) {
    const current = snapshot.zones.find((z) => z.id === zone);
    const nextPath = `${zoneDir(zone)}.next`;
    const stuckMarker =
      zone === "ui"
        ? path.join(nextPath, "index.html")
        : zone === "server"
          ? path.join(nextPath, "dist", "index.js")
          : path.join(nextPath, "node.exe");
    const hasStuckNext = fs.existsSync(stuckMarker);
    const isReady = Boolean(current && current.state === "ready" && current.path && current.remoteVersion);

    if (!isReady && !hasStuckNext) {
      return { ok: false, error: "update not ready" };
    }

    const fileName = current && current.path;
    const remoteVersion = (current && current.remoteVersion) || readZoneVersion(zone);
    const expectedSha = current && current.sha512;

    updateZone(zone, {
      state: "applying",
      percent: 0,
      error: undefined,
      remoteVersion: remoteVersion || undefined,
      phase: "prepare",
    });

    try {
      // MUST stop point-server before renaming modules/server (Windows file locks).
      if (beforeApply) {
        updateZone(zone, { state: "applying", percent: 5, phase: "stopping-server" });
        await beforeApply(zone);
        await sleep(600);
      }

      if (recoverStuckSwap(zone)) {
        const ver = readZoneVersion(zone) || remoteVersion;
        if (ver) setZoneVersion(zone, ver);
        updateZone(zone, {
          id: zone,
          localVersion: ver || undefined,
          remoteVersion: ver || undefined,
          state: "idle",
          percent: 100,
          phase: "done",
          error: undefined,
        });
        log(`module ${zone} recovered stuck swap v${ver}`);
        if (onApplied) await onApplied(zone);
        updateZone(zone, {
          id: zone,
          localVersion: ver || undefined,
          remoteVersion: ver || undefined,
          state: "idle",
          percent: 100,
          phase: "done",
          error: undefined,
        });
        return { ok: true, recovered: true };
      }

      if (!isReady) {
        return { ok: false, error: "update not ready" };
      }

      updateZone(zone, { state: "downloading", percent: 0, phase: "download", remoteVersion });
      const tmpRoot = path.join(modulesRoot(), "_tmp");
      fs.mkdirSync(tmpRoot, { recursive: true });
      const zipPath = path.join(tmpRoot, `${zone}-${remoteVersion}.zip`);
      const extractPath = path.join(tmpRoot, `${zone}-${remoteVersion}-out`);

      await downloadFile(downloadUrl(fileName), zipPath, (percent) => {
        updateZone(zone, { state: "downloading", percent, remoteVersion, phase: "download" });
      });

      if (expectedSha) {
        updateZone(zone, { state: "applying", percent: 92, phase: "verify", remoteVersion });
        const actual = await sha512File(zipPath);
        if (actual !== expectedSha) {
          throw new Error(`sha512 mismatch for ${fileName}`);
        }
      }

      updateZone(zone, { state: "applying", percent: 94, phase: "extract", remoteVersion });
      if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });
      await extractZip(zipPath, extractPath);
      const contentRoot = normalizeExtracted(zone, extractPath);

      const target = zoneDir(zone);
      const next = `${target}.next`;
      const prev = `${target}.prev`;
      updateZone(zone, { state: "applying", percent: 97, phase: "swap", remoteVersion });
      if (fs.existsSync(next)) fs.rmSync(next, { recursive: true, force: true });
      // Same-volume rename is instant vs copying 100MB+ node_modules trees.
      fs.renameSync(contentRoot, next);

      if (fs.existsSync(prev)) fs.rmSync(prev, { recursive: true, force: true });
      if (fs.existsSync(target)) fs.renameSync(target, prev);
      fs.renameSync(next, target);
      if (fs.existsSync(prev)) {
        try {
          fs.rmSync(prev, { recursive: true, force: true });
        } catch (err) {
          log(`module ${zone}: prev cleanup deferred: ${err && err.message ? err.message : err}`);
        }
      }

      setZoneVersion(zone, remoteVersion);
      log(`module ${zone} applied v${remoteVersion}`);

      try {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      } catch {
        // ignore
      }
      try {
        if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });
      } catch {
        // ignore
      }
      cleanupTmp();

      if (onApplied) {
        updateZone(zone, { state: "applying", percent: 100, phase: "restart", remoteVersion });
        await onApplied(zone);
      }

      updateZone(zone, {
        id: zone,
        localVersion: remoteVersion,
        remoteVersion,
        state: "idle",
        percent: 100,
        phase: "done",
        error: undefined,
      });
      return { ok: true };
    } catch (err) {
      const message = err && err.message ? String(err.message) : String(err);
      log(`module apply ${zone} failed: ${message}`);
      updateZone(zone, { state: "error", error: message, remoteVersion, phase: "error" });
      // Best-effort: bring server back so Operator UI is not dead after a failed swap.
      if (onApplied) {
        try {
          await onApplied(zone);
        } catch {
          // ignore
        }
      }
      return { ok: false, error: message };
    }
  }

  ipcMain.handle("modules-update:getStatus", () => snapshot);
  ipcMain.handle("modules-update:check", async () => {
    try {
      // Manual "check" from UI — report only; user still presses Apply.
      return await checkAll({ autoApply: false });
    } catch (err) {
      const message = err && err.message ? String(err.message) : String(err);
      setSnapshot({ ...snapshot, error: message });
      return { ok: false, error: message, status: snapshot };
    }
  });
  ipcMain.handle("modules-update:apply", async (_event, zone) => {
    if (!ZONE_IDS.includes(zone)) return { ok: false, error: "unknown zone" };
    return applyZone(zone);
  });

  function start() {
    setSnapshot({ zones: listLocalZones() });
    // Check-only: never auto-apply on launch/interval (blank-screen root cause on clients).
    // Stuck *.next recovery still runs — extract path no longer uses Expand-Archive.
    setTimeout(() => {
      void (async () => {
        for (const zone of ["ui", "server"]) {
          const nextPath = `${zoneDir(zone)}.next`;
          const marker =
            zone === "ui" ? path.join(nextPath, "index.html") : path.join(nextPath, "dist", "index.js");
          if (!fs.existsSync(marker)) continue;
          log(`module ${zone}: found stuck ${path.basename(nextPath)} — finishing apply`);
          updateZone(zone, { state: "ready", remoteVersion: readZoneVersion(zone) || "pending" });
          await applyZone(zone);
        }
        await checkAll({ autoApply: false }).catch((err) =>
          log(`module check failed: ${err && err.message ? err.message : err}`),
        );
      })();
    }, 15_000);
    setInterval(
      () => {
        checkAll({ autoApply: false }).catch(() => undefined);
      },
      4 * 60 * 60 * 1000,
    );
  }

  return { start, getStatus: () => snapshot, checkAll, applyZone };
}

module.exports = { setupModuleUpdater, MODULES_TAG, GH_OWNER, GH_REPO };
