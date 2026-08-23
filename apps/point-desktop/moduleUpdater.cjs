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

const {
  ZONE_IDS,
  zoneDir,
  modulesRoot,
  readZoneVersion,
  setZoneVersion,
  listLocalZones,
} = require("./modules.cjs");
const {
  inspectZone,
  assertDepsResolve,
  rollbackToPrev,
  removePrev,
  removeBroken,
  copyDereferenced,
  readJson,
} = require("./moduleIntegrity.cjs");
const { extractZip } = require("./zipTree.cjs");

const GH_OWNER = "by-23";
const GH_REPO = "TshirtPrinterApp";
const MODULES_TAG = "modules";

/**
 * @param {{
 *   log: (msg: string) => void,
 *   BrowserWindow: typeof import("electron").BrowserWindow,
 *   ipcMain: typeof import("electron").ipcMain,
 *   beforeApply?: (zone: string) => Promise<void> | void,
 *   onApplied?: (zone: string, meta?: { batch?: boolean }) => Promise<void> | void,
 * }} opts
 */
function setupModuleUpdater(opts) {
  const { log, BrowserWindow, ipcMain, beforeApply, onApplied } = opts;
  /** @type {Promise<unknown> | null} */
  let applyLock = null;

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

  function modulesBaseUrl() {
    const fromEnv = (process.env.TSHIRT_MODULES_BASE_URL || "").trim().replace(/\/+$/, "");
    if (fromEnv) return fromEnv;
    return `https://github.com/${GH_OWNER}/${GH_REPO}/releases/download/${MODULES_TAG}`;
  }

  function downloadUrl(fileName) {
    return `${modulesBaseUrl()}/${fileName}`;
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

  async function renameWithRetry(from, to, zone, opts = {}) {
    const stopOnLock = opts.stopOnLock === true;
    let lastErr;
    for (let i = 0; i < 10; i++) {
      try {
        fs.renameSync(from, to);
        return;
      } catch (err) {
        lastErr = err;
        const code = err && err.code;
        if (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES" && code !== "ENOTEMPTY") {
          throw err;
        }
        log(`module ${zone}: rename retry ${i + 1}/10: ${err && err.message ? err.message : err}`);
        if (stopOnLock && beforeApply) {
          try {
            await beforeApply(zone);
          } catch {
            // ignore
          }
        }
        await sleep(700 + i * 400);
      }
    }
    throw lastErr || new Error(`rename failed: ${from} -> ${to}`);
  }

  function runtimeNodeBin() {
    const bundled = path.join(zoneDir("runtime"), "node.exe");
    if (fs.existsSync(bundled)) return bundled;
    return process.execPath;
  }

  function nextPathFor(zone) {
    return `${zoneDir(zone)}.next`;
  }

  function gateExtracted(zone, root) {
    const inspected = inspectZone(zone, root);
    if (!inspected.ok) throw new Error(inspected.error);
    if (zone === "server") {
      assertDepsResolve(root, runtimeNodeBin());
    }
  }

  /**
   * Download + extract + integrity into zone.next while the current server
   * can keep running. Never swap a tree that Node cannot resolve.
   */
  async function prepareZone(zone) {
    const current = snapshot.zones.find((z) => z.id === zone);
    const nextPath = nextPathFor(zone);
    const remoteVersion = (current && current.remoteVersion) || readZoneVersion(zone);
    const isReady = Boolean(current && current.state === "ready" && current.path && current.remoteVersion);

    updateZone(zone, {
      state: "applying",
      percent: 0,
      error: undefined,
      remoteVersion: remoteVersion || undefined,
      phase: "prepare",
    });

    if (fs.existsSync(nextPath)) {
      try {
        const contentRoot = normalizeExtracted(zone, nextPath);
        gateExtracted(zone, contentRoot);
        const ver =
          remoteVersion ||
          readZoneVersion(zone) ||
          (fs.existsSync(path.join(contentRoot, "module-version.json"))
            ? readJson(path.join(contentRoot, "module-version.json")).version
            : "pending");
        log(`module ${zone}: reusing verified ${path.basename(nextPath)} v${ver}`);
        if (contentRoot !== nextPath) {
          const flat = `${nextPath}.flat`;
          if (fs.existsSync(flat)) fs.rmSync(flat, { recursive: true, force: true });
          copyDereferenced(contentRoot, flat);
          fs.rmSync(nextPath, { recursive: true, force: true });
          fs.renameSync(flat, nextPath);
        }
        return { ok: true, zone, nextPath, remoteVersion: ver, recovered: true };
      } catch (err) {
        const message = err && err.message ? String(err.message) : String(err);
        log(`module ${zone}: discarding broken ${path.basename(nextPath)}: ${message}`);
        try {
          fs.rmSync(nextPath, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
    }

    if (!isReady) {
      updateZone(zone, {
        state: current && current.state === "ready" ? "ready" : "idle",
        phase: undefined,
        error: undefined,
      });
      return { ok: false, error: "update not ready" };
    }

    const fileName = current.path;
    const expectedSha = current.sha512;
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
    extractZip(zipPath, extractPath);
    const contentRoot = normalizeExtracted(zone, extractPath);
    gateExtracted(zone, contentRoot);

    if (fs.existsSync(nextPath)) fs.rmSync(nextPath, { recursive: true, force: true });
    await renameWithRetry(contentRoot, nextPath, zone);

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

    return { ok: true, zone, nextPath, remoteVersion };
  }

  async function swapKeepPrevRetry(target, next, zone) {
    const prev = `${target}.prev`;
    if (fs.existsSync(prev)) {
      try {
        fs.rmSync(prev, { recursive: true, force: true });
      } catch {
        await sleep(400);
        fs.rmSync(prev, { recursive: true, force: true });
      }
    }
    if (fs.existsSync(target)) await renameWithRetry(target, prev, zone, { stopOnLock: true });
    await renameWithRetry(next, target, zone, { stopOnLock: true });
  }

  async function rollbackPrepared(prepared) {
    for (const item of prepared.slice().reverse()) {
      const target = zoneDir(item.zone);
      if (rollbackToPrev(target)) {
        log(`module ${item.zone}: rolled back to previous tree`);
        const ver = readZoneVersion(item.zone);
        updateZone(item.zone, {
          localVersion: ver || undefined,
          state: "error",
          phase: "error",
        });
      }
    }
  }

  /**
   * @param {string} zone
   */
  async function applyZone(zone) {
    return applyPipeline([zone]);
  }

  /** Download/verify all zones first; stop server only for the swap; rollback if restart fails. */
  async function applyPipeline(zones) {
    const list = (Array.isArray(zones) ? zones : []).filter((z) => ZONE_IDS.includes(z));
    if (!list.length) return { ok: false, error: "no zones" };

    const run = async () => {
      const prepared = [];
      try {
        for (const zone of list) {
          const res = await prepareZone(zone);
          if (!res.ok) {
            return { ok: false, error: res.error || `${zone} failed`, results: prepared, status: snapshot };
          }
          prepared.push(res);
        }

        if (beforeApply) {
          const last = list[list.length - 1];
          updateZone(last, { state: "applying", percent: 96, phase: "stopping-server" });
          await beforeApply(last);
          await sleep(1200);
        }

        for (const item of prepared) {
          updateZone(item.zone, {
            state: "applying",
            percent: 97,
            phase: "swap",
            remoteVersion: item.remoteVersion,
          });
          await swapKeepPrevRetry(zoneDir(item.zone), item.nextPath, item.zone);
          if (item.remoteVersion) setZoneVersion(item.zone, item.remoteVersion);
          log(`module ${item.zone} applied v${item.remoteVersion}`);
        }

        const last = list[list.length - 1];
        if (onApplied) {
          updateZone(last, { state: "applying", percent: 100, phase: "restart" });
          try {
            await onApplied(last, { batch: true });
          } catch (err) {
            const message = err && err.message ? String(err.message) : String(err);
            log(`module restart failed: ${message}`);
            await rollbackPrepared(prepared);
            try {
              await onApplied(last, { batch: true });
            } catch (restartErr) {
              log(
                `module restart after rollback failed: ${
                  restartErr && restartErr.message ? restartErr.message : restartErr
                }`,
              );
            }
            updateZone(last, { state: "error", error: message, phase: "error" });
            return { ok: false, error: message, results: prepared, status: snapshot };
          }
        }

        for (const item of prepared) {
          const target = zoneDir(item.zone);
          removePrev(target);
          removeBroken(target);
          updateZone(item.zone, {
            id: item.zone,
            localVersion: item.remoteVersion || readZoneVersion(item.zone) || undefined,
            remoteVersion: item.remoteVersion,
            state: "idle",
            percent: 100,
            phase: "done",
            error: undefined,
          });
        }
        cleanupTmp();
        return { ok: true, results: prepared, status: snapshot };
      } catch (err) {
        const message = err && err.message ? String(err.message) : String(err);
        const failedZone = list[prepared.length] || list[list.length - 1];
        log(`module apply ${failedZone} failed: ${message}`);
        updateZone(failedZone, { state: "error", error: message, phase: "error" });
        if (prepared.length && beforeApply) {
          try {
            await rollbackPrepared(prepared);
          } catch {
            // ignore
          }
        }
        if (onApplied) {
          try {
            await onApplied(failedZone, { batch: true });
          } catch {
            // ignore
          }
        }
        return { ok: false, error: message, results: prepared, status: snapshot };
      }
    };

    const prev = applyLock || Promise.resolve();
    let release;
    applyLock = new Promise((r) => {
      release = r;
    });
    await prev.catch(() => undefined);
    try {
      return await run();
    } finally {
      release();
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
  ipcMain.handle("modules-update:applyPipeline", async (_event, zones) => {
    return applyPipeline(zones);
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
          await applyPipeline([zone]);
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
