const { app, BrowserWindow, ipcMain, screen, dialog, shell } = require("electron");

// Client GPU: without this Electron dies ("GPU process isn't usable").
// Heavy --use-gl=swiftshader stacks then crashed the renderer (blank window).
// Keep the minimum that keeps the process alive.
if (app.isPackaged) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu-sandbox");
}

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { setupAutoUpdater } = require("./updater.cjs");
const {
  ensureModulesSeeded,
  resetModulesIfShellChanged,
  resolveUiDistPath: resolveModuleUiDist,
  resolveServerRoot: resolveModuleServerRoot,
  resolveNodeBinary: resolveModuleNodeBinary,
} = require("./modules.cjs");
const { setupModuleUpdater } = require("./moduleUpdater.cjs");

// Never inherit a random PORT from the parent shell (breaks packaged launches).
const POINT_PORT = Number(process.env.TSHIRT_POINT_PORT || 4000);
const POINT_ORIGIN = `http://127.0.0.1:${POINT_PORT}`;

/** Best non-internal IPv4 for LAN kiosk, or override via TSHIRT_PUBLIC_LAN_HOST. */
function resolvePublicLanHost() {
  const fromEnv = (process.env.TSHIRT_PUBLIC_LAN_HOST || "").trim();
  if (fromEnv) return fromEnv.includes(":") ? fromEnv : `${fromEnv}:${POINT_PORT}`;

  const ifaces = os.networkInterfaces();
  /** @type {{ address: string, name: string, score: number }[]} */
  const candidates = [];
  for (const [name, entries] of Object.entries(ifaces)) {
    if (!entries) continue;
    const lower = String(name).toLowerCase();
    const virtual =
      lower.includes("vethernet") ||
      lower.includes("hyper-v") ||
      lower.includes("wsl") ||
      lower.includes("docker") ||
      lower.includes("vbox") ||
      lower.includes("virtualbox") ||
      lower.includes("vmware") ||
      lower.includes("bluetooth");
    for (const entry of entries) {
      if (entry.family !== "IPv4" && entry.family !== 4) continue;
      if (entry.internal) continue;
      let score = 100;
      if (virtual) score += 500;
      if (entry.address.startsWith("192.168.")) score -= 40;
      else if (entry.address.startsWith("10.")) score -= 30;
      else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(entry.address)) score -= 10;
      if (/ethernet|wi-?fi|wlan|wifi/i.test(name)) score -= 5;
      candidates.push({ address: entry.address, name, score });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0];
  return best ? `${best.address}:${POINT_PORT}` : "";
}

/** @type {import('node:child_process').ChildProcess | null} */
let pointProcess = null;
/** @type {BrowserWindow | null} */
let kioskWindow = null;
/** @type {BrowserWindow | null} */
let operatorWindow = null;
/** @type {BrowserWindow | null} */
let splashWindow = null;
/** @type {string} */
let logFile = "";
/** True until operator UI is open (or fatal error shown). Prevents silent quit if splash closes. */
let bootInProgress = false;

function resolveLogFile() {
  try {
    return path.join(app.getPath("userData"), "desktop.log");
  } catch {
    return path.join(os.tmpdir(), "tshirt-operator-desktop.log");
  }
}

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    if (!logFile) logFile = resolveLogFile();
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, line + "\n", "utf8");
  } catch {
    try {
      const fallback = path.join(os.tmpdir(), "tshirt-operator-desktop.log");
      fs.appendFileSync(fallback, line + "\n", "utf8");
    } catch {
      // ignore
    }
  }
}

/** Always under %LOCALAPPDATA%\TshirtPrinter — easy path to ask the client for. */
function clientBootLogPath() {
  const base =
    process.env.LOCALAPPDATA ||
    path.join(os.homedir(), "AppData", "Local");
  return path.join(base, "TshirtPrinter", "operator-boot.log");
}

function writeClientBoot(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    const file = clientBootLogPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, line, "utf8");
  } catch {
    // ignore
  }
}

// Survive crashes before app.whenReady (no splash / no dialog otherwise).
process.on("uncaughtException", (err) => {
  const msg = `uncaughtException: ${err && err.stack ? err.stack : String(err)}`;
  log(msg);
  writeClientBoot(msg);
});
process.on("unhandledRejection", (reason) => {
  const msg = `unhandledRejection: ${reason && reason.stack ? reason.stack : String(reason)}`;
  log(msg);
  writeClientBoot(msg);
});

writeClientBoot(
  `process start v${app.getVersion()} pid=${process.pid} packaged=${app.isPackaged} exec=${process.execPath}`,
);
log(`process start v${app.getVersion()} pid=${process.pid} packaged=${app.isPackaged}`);

function resourcesRoot() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, "resources");
}

/**
 * Writable point data on Windows: %LOCALAPPDATA%\TshirtPrinter\data
 * Holds SQLite, catalog/, orders/, stickers/, ads — same folder /files serves.
 * Created on first launch; seeded from packaged resources when empty.
 */
function resolveWindowsDataDir() {
  if (process.env.TSHIRT_DATA_DIR && process.env.TSHIRT_DATA_DIR.trim()) {
    return path.resolve(process.env.TSHIRT_DATA_DIR.trim());
  }
  const localAppData =
    process.env.LOCALAPPDATA ||
    path.join(app.getPath("home"), "AppData", "Local");
  return path.join(localAppData, "TshirtPrinter", "data");
}

function dirHasEntries(dir) {
  try {
    return fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

function copyMissingTree(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let copied = 0;
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (!fs.existsSync(to)) {
      fs.cpSync(from, to, { recursive: true });
      copied += 1;
    }
  }
  return copied;
}

/**
 * Always use one durable data root on Windows (packaged + unpackaged Electron),
 * so rebuilds of `resources/` don't wipe orders/history/admin catalog.
 * Override: TSHIRT_DATA_DIR.
 */
function ensurePointDataDir(pointRoot) {
  const dataDir =
    process.platform === "win32"
      ? resolveWindowsDataDir()
      : path.join(pointRoot, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  for (const sub of [
    "catalog",
    "catalog-tmp",
    "orders",
    "ads-videos",
    "stickers-cache",
    "stickers-tmp",
    "ai-models",
    "ai-style-previews",
  ]) {
    fs.mkdirSync(path.join(dataDir, sub), { recursive: true });
  }

  const targetDb = path.join(dataDir, "point.db");
  const legacyDir = path.join(app.getPath("userData"), "point-data");
  const legacyDb = path.join(legacyDir, "point.db");

  // Migrate previous Electron userData/point-data → LOCALAPPDATA\TshirtPrinter\data
  if (!fs.existsSync(targetDb) && fs.existsSync(legacyDb)) {
    log(`Migrating legacy point-data from ${legacyDir}`);
    copyMissingTree(legacyDir, dataDir);
  }

  // Unpackaged: prefer monorepo apps/point-server/data if LOCALAPPDATA is still empty.
  if (!app.isPackaged && !fs.existsSync(targetDb)) {
    const monorepoData = path.resolve(__dirname, "..", "point-server", "data");
    const monorepoDb = path.join(monorepoData, "point.db");
    if (fs.existsSync(monorepoDb)) {
      log(`Seeding from monorepo point-server data: ${monorepoData}`);
      copyMissingTree(monorepoData, dataDir);
    }
  }

  // Catalog + order PNGs live in DATA_DIR (sync / runtime) — never seed from pack.
  log(`Point DATA_DIR=${dataDir}`);
  return dataDir;
}

/** Parse KEY=VALUE lines from a .env file (no expansion). */
function readDotEnvFile(filePath) {
  /** @type {Record<string, string>} */
  const out = {};
  try {
    if (!fs.existsSync(filePath)) return out;
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
  } catch {
    // ignore
  }
  return out;
}

/** Sync credentials: process env > monorepo/point .env > empty (offline). */
function resolveSyncEnv(pointRoot) {
  const fromProcess = {
    CENTRAL_RELAY_URL: (process.env.CENTRAL_RELAY_URL || "").trim(),
    POINT_SYNC_ID: (process.env.POINT_SYNC_ID || "").trim(),
    POINT_SYNC_TOKEN: (process.env.POINT_SYNC_TOKEN || "").trim(),
  };
  const candidates = [
    path.join(pointRoot, ".env"),
    path.resolve(__dirname, "..", "point-server", ".env"),
  ];
  /** @type {Record<string, string>} */
  let fileEnv = {};
  for (const candidate of candidates) {
    const parsed = readDotEnvFile(candidate);
    if (parsed.CENTRAL_RELAY_URL || parsed.POINT_SYNC_ID || parsed.POINT_SYNC_TOKEN) {
      fileEnv = parsed;
      log(`Loaded sync env from ${candidate}`);
      break;
    }
  }
  return {
    CENTRAL_RELAY_URL: fromProcess.CENTRAL_RELAY_URL || fileEnv.CENTRAL_RELAY_URL || "",
    POINT_SYNC_ID: fromProcess.POINT_SYNC_ID || fileEnv.POINT_SYNC_ID || "",
    POINT_SYNC_TOKEN: fromProcess.POINT_SYNC_TOKEN || fileEnv.POINT_SYNC_TOKEN || "",
  };
}

function displaysConfigPath() {
  return path.join(app.getPath("userData"), "displays.json");
}

function readDisplayConfig() {
  try {
    const raw = fs.readFileSync(displaysConfigPath(), "utf8");
    const json = JSON.parse(raw);
    return {
      kioskIndex: Number.isInteger(json.kioskIndex) ? json.kioskIndex : null,
      operatorIndex: Number.isInteger(json.operatorIndex) ? json.operatorIndex : null,
    };
  } catch {
    return { kioskIndex: null, operatorIndex: null };
  }
}

function writeDisplayConfig(config) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(displaysConfigPath(), JSON.stringify(config, null, 2), "utf8");
}

function listDisplayPayloads() {
  return screen.getAllDisplays().map((display, index) => ({
    id: String(index),
    index,
    label: `Monitor ${index + 1}`,
    width: display.bounds.width,
    height: display.bounds.height,
    x: display.bounds.x,
    y: display.bounds.y,
    isPrimary: display.id === screen.getPrimaryDisplay().id,
    isPortrait: display.bounds.height > display.bounds.width,
  }));
}

function pickDisplays(config) {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  let kiosk = null;
  let operator = null;

  if (config.kioskIndex != null && displays[config.kioskIndex]) {
    kiosk = displays[config.kioskIndex];
  }
  if (config.operatorIndex != null && displays[config.operatorIndex]) {
    operator = displays[config.operatorIndex];
  }

  // Operator always prefers the primary monitor so the user always sees a window.
  if (!operator) {
    operator = primary || displays[0];
  }
  if (!kiosk) {
    kiosk =
      displays.find((d) => d.id !== operator.id && d.bounds.height > d.bounds.width) ||
      displays.find((d) => d.id !== operator.id) ||
      operator;
  }

  return { kiosk, operator };
}

function placeOnDisplay(win, display) {
  const { x, y, width, height } = display.bounds;
  // Fill the monitor with a frameless window. Avoid setFullScreen() — on
  // multi-monitor Windows it frequently creates invisible / stuck windows
  // while still reporting success in logs.
  if (win.isFullScreen()) {
    try {
      win.setFullScreen(false);
    } catch {
      // ignore
    }
  }
  win.setBounds({ x, y, width, height });
  win.setSize(width, height);
  win.setPosition(x, y);
  win.show();
  win.focus();
  win.moveTop();
  log(`placed window bounds=${JSON.stringify(win.getBounds())} visible=${win.isVisible()} minimized=${win.isMinimized()}`);
}

function createFramelessWindow(display, url) {
  const { x, y, width, height } = display.bounds;
  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    fullscreen: false,
    autoHideMenuBar: true,
    backgroundColor: "#05060f",
    show: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox:true crashed renderer on client (render-process-gone, blank UI)
      // while /operator still returned HTTP 200.
      sandbox: false,
    },
  });
  win.setMenuBarVisibility(false);

  let crashReloads = 0;
  const loadOperator = () => {
    if (win.isDestroyed()) return;
    const bust = url.includes("?") ? `${url}&_=${Date.now()}` : `${url}?_=${Date.now()}`;
    log(`loadURL ${bust}`);
    void win.loadURL(bust);
  };

  win.webContents.on("did-fail-load", (_e, code, desc, validatedURL) => {
    log(`did-fail-load code=${code} desc=${desc} url=${validatedURL}`);
  });
  win.webContents.on("did-finish-load", () => {
    log(`did-finish-load ${win.webContents.getURL()}`);
  });
  win.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    if (level >= 2) log(`renderer[${level}] ${message} (${sourceId}:${line})`);
  });
  win.webContents.on("render-process-gone", (_e, details) => {
    log(
      `render-process-gone reason=${details && details.reason} exit=${details && details.exitCode} reloads=${crashReloads}`,
    );
    if (win.isDestroyed()) return;
    if (crashReloads < 2) {
      crashReloads += 1;
      setTimeout(loadOperator, 400);
      return;
    }
    const html = `<!doctype html><html><body style="margin:0;font-family:Segoe UI,sans-serif;background:#111827;color:#f9fafb;display:flex;align-items:center;justify-content:center;height:100vh;padding:24px;box-sizing:border-box">
      <div style="max-width:520px">
        <div style="font-size:20px;font-weight:700;margin-bottom:12px">Сбой отображения</div>
        <div style="font-size:14px;line-height:1.5;opacity:.9">Окно открылось, но движок Chromium упал (render-process-gone). Сервер при этом может быть жив. Перезапустите приложение. Лог: desktop.log</div>
      </div></body></html>`;
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    placeOnDisplay(win, display);
  });

  win.once("ready-to-show", () => {
    placeOnDisplay(win, display);
    log(`shown window url=${url} bounds=${JSON.stringify(win.getBounds())} fullscreen=${win.isFullScreen()}`);
  });

  // Fallback if ready-to-show never fires
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      log(`ready-to-show timeout — forcing show for ${url}`);
      placeOnDisplay(win, display);
    }
  }, 4000);

  loadOperator();
  win.on("closed", () => {
    if (win === kioskWindow) kioskWindow = null;
    if (win === operatorWindow) operatorWindow = null;
  });
  return win;
}

function showSplash(statusText) {
  const primary = screen.getPrimaryDisplay();
  const width = 480;
  const height = 220;
  const x = Math.round(primary.bounds.x + (primary.bounds.width - width) / 2);
  const y = Math.round(primary.bounds.y + (primary.bounds.height - height) / 2);

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.executeJavaScript(
      `document.getElementById('status').textContent = ${JSON.stringify(statusText)}`,
    ).catch(() => undefined);
    splashWindow.show();
    splashWindow.focus();
    return;
  }

  splashWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    closable: !bootInProgress,
    alwaysOnTop: true,
    backgroundColor: "#111827",
    title: "Tshirt Printer",
    show: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWindow.setMenuBarVisibility(false);
  // Closing the only window during boot used to fire window-all-closed → silent app.quit().
  splashWindow.on("close", (event) => {
    if (bootInProgress) {
      event.preventDefault();
      log("splash close ignored while bootInProgress");
    }
  });
  const html = `<!doctype html><html><body style="margin:0;font-family:Segoe UI,sans-serif;background:#111827;color:#f9fafb;display:flex;align-items:center;justify-content:center;height:100vh;">
    <div style="text-align:center;padding:24px">
      <div style="font-size:22px;font-weight:700;margin-bottom:12px">Tshirt Printer Operator</div>
      <div id="status" style="font-size:14px;opacity:.85">${statusText}</div>
    </div></body></html>`;
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  splashWindow.focus();
  splashWindow.moveTop();
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }
  splashWindow = null;
}

function openUiWindows(config = readDisplayConfig()) {
  const { operator } = pickDisplays(config);
  log(`Opening operator UI bounds=${JSON.stringify(operator.bounds)} (kiosk is LAN Android, not opened here)`);

  // Close leftover kiosk windows from older builds that still opened a second display.
  if (kioskWindow && !kioskWindow.isDestroyed()) kioskWindow.close();
  if (operatorWindow && !operatorWindow.isDestroyed()) operatorWindow.close();

  // Kiosk UI runs on a separate Android display over LAN — only the operator window on the PC.
  operatorWindow = createFramelessWindow(operator, `${POINT_ORIGIN}/operator?native=1`);
  closeSplash();
}

function waitForHealth(timeoutMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`${POINT_ORIGIN}/health`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      req.on("error", retry);
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`point-server did not become ready at ${POINT_ORIGIN}/health`));
        return;
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

function resolveNodeBinary() {
  return resolveModuleNodeBinary(resourcesRoot());
}

function resolvePointServerRoot() {
  const fromModules = resolveModuleServerRoot(resourcesRoot());
  if (fromModules) return fromModules;
  return path.resolve(__dirname, "..", "point-server");
}

function resolveUiDist() {
  const fromModules = resolveModuleUiDist(resourcesRoot());
  if (fromModules) return fromModules;
  const bundled = path.join(resourcesRoot(), "point-server", "ui-dist");
  if (fs.existsSync(path.join(bundled, "index.html"))) return bundled;
  return path.join(resolvePointServerRoot(), "ui-dist");
}

function reloadAllUiWindows() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    // Skip splash (no URL / about:blank).
    const url = win.webContents.getURL();
    if (!url || url === "about:blank" || url.startsWith("data:")) continue;
    win.webContents.reloadIgnoringCache();
  }
}

/** Fail boot early if the SPA HTML is missing — health alone is not enough. */
function probeOperatorUi() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${POINT_ORIGIN}/operator?native=1&_probe=1`, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        const ok =
          res.statusCode === 200 &&
          /<div[^>]+id=["']root["']/i.test(body) &&
          /<script/i.test(body);
        log(
          `probe /operator status=${res.statusCode} bytes=${body.length} hasRoot=${ok}`,
        );
        if (!ok) {
          reject(
            new Error(
              `Operator UI HTML invalid (HTTP ${res.statusCode}, ${body.length} bytes). UI_DIST broken on this PC.`,
            ),
          );
          return;
        }
        resolve();
      });
    });
    req.on("error", (err) => reject(err));
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("probe /operator timed out"));
    });
  });
}

function notifyUiReload() {
  try {
    const req = http.request(
      `${POINT_ORIGIN}/internal/ui-reload`,
      { method: "POST", headers: { "Content-Type": "application/json" }, timeout: 3000 },
      (res) => res.resume(),
    );
    req.on("error", () => undefined);
    req.end("{}");
  } catch {
    // ignore
  }
}

async function restartPointServer() {
  stopPointServer();
  await new Promise((r) => setTimeout(r, 400));
  await ensurePointServer();
  reloadAllUiWindows();
}

async function ensurePointServer() {
  // Only reuse an already-healthy port if WE own the child process.
  // A stray `pnpm dev` on :4000 used to make packaged Operator skip spawn,
  // then look "updated" while serving the wrong binary.
  if (pointProcess && !pointProcess.killed) {
    try {
      await waitForHealth(1500);
      log("point-server already healthy");
      return;
    } catch {
      // fall through and restart
    }
  }

  // If something else (Vite-backed pnpm point-server) holds :4000, kill it
  // before we spawn — otherwise waitForHealth succeeds on the WRONG process.
  log(`ensurePointServer: freeing port ${POINT_PORT} if foreign`);
  await freePointPortIfForeign();

  log("ensurePointServer: seeding modules from resources (first run may take a while)");
  resetModulesIfShellChanged({ shellVersion: app.getVersion(), log });
  ensureModulesSeeded({ resourcesRoot: resourcesRoot(), log });

  const pointRoot = resolvePointServerRoot();
  if (!pointRoot) {
    throw new Error(
      `point-server root missing under resources and modules. resources=${resourcesRoot()}`,
    );
  }
  const entry = path.join(pointRoot, "dist", "index.js");
  const nodeModules = path.join(pointRoot, "node_modules");
  log(`ensurePointServer: root=${pointRoot}`);
  if (!fs.existsSync(entry)) {
    throw new Error(`point-server build missing: ${entry}`);
  }
  if (!fs.existsSync(nodeModules)) {
    throw new Error(
      `point-server node_modules missing at ${nodeModules}. Rebuild with build-windows-app.bat`,
    );
  }

  const nodeBin = resolveNodeBinary();
  if (!nodeBin || (path.isAbsolute(nodeBin) && !fs.existsSync(nodeBin))) {
    throw new Error(`bundled node.exe missing: ${nodeBin || "(empty)"}`);
  }
  const uiDist = resolveUiDist();
  // One writable root for DB + catalog + order images on any Windows PC:
  // %LOCALAPPDATA%\TshirtPrinter\data (created/seeded if missing).
  const dataDir = ensurePointDataDir(pointRoot);
  const dbPath = path.join(dataDir, "point.db");

  const serverLog = path.join(app.getPath("userData"), "point-server.log");
  log(`ensurePointServer: opening server log ${serverLog}`);
  const outFd = fs.openSync(serverLog, "a");

  const publicLanHost = resolvePublicLanHost();
  const syncEnv = resolveSyncEnv(pointRoot);
  log(
    `Starting point-server: node=${nodeBin} cwd=${pointRoot} UI_DIST_PATH=${uiDist} DATA_DIR=${dataDir} PUBLIC_LAN_HOST=${publicLanHost || "(none)"} sync=${syncEnv.CENTRAL_RELAY_URL ? "on" : "off"}`,
  );
  pointProcess = spawn(nodeBin, [entry], {
    cwd: pointRoot,
    env: {
      ...process.env,
      PORT: String(POINT_PORT),
      DATA_DIR: dataDir,
      DATABASE_PATH: dbPath,
      UI_DIST_PATH: uiDist,
      PUBLIC_LAN_HOST: publicLanHost,
      CENTRAL_RELAY_URL: syncEnv.CENTRAL_RELAY_URL,
      POINT_SYNC_ID: syncEnv.POINT_SYNC_ID,
      POINT_SYNC_TOKEN: syncEnv.POINT_SYNC_TOKEN,
    },
    stdio: ["ignore", outFd, outFd],
    windowsHide: true,
  });

  pointProcess.on("exit", (code, signal) => {
    log(`point-server exited code=${code} signal=${signal}`);
    pointProcess = null;
  });

  await waitForHealth();
  if (!pointProcess || pointProcess.killed) {
    throw new Error(
      `point-server exited before becoming ready (port ${POINT_PORT} may be taken by another process)`,
    );
  }
  log("point-server is healthy");
}

/** Kill any non-owned listener on POINT_PORT (typical: monorepo `pnpm point-server`). */
function freePointPortIfForeign() {
  return new Promise((resolve) => {
    if (process.platform !== "win32") {
      resolve();
      return;
    }
    const ps = `
$ErrorActionPreference='SilentlyContinue'
$conns = Get-NetTCPConnection -LocalPort ${POINT_PORT} -State Listen
foreach ($c in $conns) {
  $procId = $c.OwningProcess
  if ($procId -and $procId -ne ${process.pid}) {
    Write-Output "kill $procId"
    Stop-Process -Id $procId -Force
  }
}
`;
    const child = spawn(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    child.stdout.on("data", (d) => {
      out += String(d);
    });
    child.on("exit", () => {
      if (out.trim()) log(`freed :${POINT_PORT}: ${out.trim()}`);
      setTimeout(resolve, 800);
    });
    child.on("error", () => resolve());
  });
}

function stopPointServer() {
  if (!pointProcess) return;
  const child = pointProcess;
  pointProcess = null;
  const pid = child.pid;
  try {
    if (process.platform === "win32" && pid) {
      // Kill the whole tree — node + any workers holding module files.
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
        detached: true,
      }).unref();
    } else {
      child.kill();
    }
  } catch {
    try {
      child.kill();
    } catch {
      // ignore
    }
  }
}

async function prepareShellInstall() {
  // Only stop point-server here. Do NOT taskkill our own exe — that races
  // with the external update helper. The helper kills leftovers after we exit.
  log("prepareShellInstall: stopping point-server");
  stopPointServer();
  await new Promise((r) => setTimeout(r, 800));
}

function registerIpc() {
  ipcMain.handle("displays:list", () => listDisplayPayloads());
  ipcMain.handle("displays:getAssignment", () => readDisplayConfig());
  // Dual-monitor assignment retired: kiosk is a separate Android client on LAN.
  // Keep the IPC stub so older UI builds don't crash if they still call apply.
  ipcMain.handle("displays:apply", (_event, assignment) => {
    const config = {
      kioskIndex: Number(assignment?.kioskIndex),
      operatorIndex: Number(assignment?.operatorIndex),
    };
    if (Number.isInteger(config.operatorIndex)) {
      writeDisplayConfig({
        kioskIndex: Number.isInteger(config.kioskIndex) ? config.kioskIndex : 0,
        operatorIndex: config.operatorIndex,
      });
    }
    openUiWindows(readDisplayConfig());
    return { ok: true };
  });

  // DTF print jobs: reveal prepared PNG in Explorer so the operator can open it in RIP.
  ipcMain.handle("shell:showItemInFolder", (_event, filePath) => {
    const target = typeof filePath === "string" ? filePath.trim() : "";
    if (!target) return { ok: false, error: "empty path" };
    try {
      if (!fs.existsSync(target)) return { ok: false, error: "not found" };
      shell.showItemInFolder(target);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err && err.message ? String(err.message) : "failed" };
    }
  });

  ipcMain.handle("shell:openPath", async (_event, targetPath) => {
    const target = typeof targetPath === "string" ? targetPath.trim() : "";
    if (!target) return { ok: false, error: "empty path" };
    try {
      const error = await shell.openPath(target);
      return error ? { ok: false, error } : { ok: true };
    } catch (err) {
      return { ok: false, error: err && err.message ? String(err.message) : "failed" };
    }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Do not silently disappear — previous instance may be stuck invisible.
  log("second instance: single-instance lock busy — showing dialog and quitting");
  app.whenReady().then(() => {
    dialog.showMessageBoxSync({
      type: "warning",
      title: "Tshirt Printer Operator",
      message: "Приложение уже запущено.",
      detail:
        "Если окон не видно — завершите все процессы «Tshirt Printer Operator» в Диспетчере задач и запустите снова.",
    });
    app.quit();
  });
} else {
  app.on("second-instance", () => {
    if (operatorWindow && !operatorWindow.isDestroyed()) {
      if (operatorWindow.isMinimized()) operatorWindow.restore();
      placeOnDisplay(operatorWindow, screen.getPrimaryDisplay());
    } else if (kioskWindow && !kioskWindow.isDestroyed()) {
      kioskWindow.focus();
      kioskWindow.moveTop();
    } else if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    logFile = resolveLogFile();
    log(`App ready packaged=${app.isPackaged} version=${app.getVersion()} resources=${resourcesRoot()} log=${logFile}`);
    bootInProgress = true;
    try {
      log("boot: registerIpc");
      registerIpc();
      log("boot: setupAutoUpdater");
      const updater = setupAutoUpdater({
        log,
        BrowserWindow,
        ipcMain,
        channel: "operator",
        prepareInstall: prepareShellInstall,
      });
      log("boot: setupModuleUpdater");
      const moduleUpdater = setupModuleUpdater({
        log,
        BrowserWindow,
        ipcMain,
        beforeApply: async (zone) => {
          if (zone === "ui" || zone === "server" || zone === "runtime") {
            // Windows locks files under modules/server while point-server runs —
            // stop first or rename/swap hangs forever ("Обновление…").
            stopPointServer();
          }
        },
        onApplied: async (zone) => {
          if (zone === "ui" || zone === "server" || zone === "runtime") {
            await ensurePointServer();
            reloadAllUiWindows();
            await new Promise((r) => setTimeout(r, 800));
            notifyUiReload();
          }
        },
      });

      log("boot: showSplash");
      showSplash("Запуск сервера точки…");
      await ensurePointServer();
      showSplash("Проверка интерфейса…");
      await probeOperatorUi();
      showSplash("Открытие интерфейса оператора…");
      openUiWindows();
      bootInProgress = false;
      updater.start();
      moduleUpdater.start();
      log("boot: complete");
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      log(`FATAL: ${message}`);
      // Show error while splash still exists — closing splash first used to
      // trigger window-all-closed → app.quit() and swallow the dialog.
      dialog.showErrorBox(
        "Tshirt Printer Operator",
        `Не удалось запустить точку.\n\n${message}\n\nЛог: ${logFile}\nЛог сервера: ${path.join(app.getPath("userData"), "point-server.log")}\n\nЕсли киоск на другом ПК не подключается — откройте порт ${POINT_PORT} в брандмауэре Windows.`,
      );
      bootInProgress = false;
      closeSplash();
      stopPointServer();
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    // During boot the splash is the only window; closing it must not kill startup.
    if (bootInProgress) {
      log("window-all-closed ignored while bootInProgress");
      return;
    }
    if (splashWindow && !splashWindow.isDestroyed()) return;
    stopPointServer();
    app.quit();
  });

  app.on("before-quit", () => {
    stopPointServer();
  });
}
