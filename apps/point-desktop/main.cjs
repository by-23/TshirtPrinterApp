const { app, BrowserWindow, ipcMain, screen, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

// Never inherit a random PORT from the parent shell (breaks packaged launches).
const POINT_PORT = Number(process.env.TSHIRT_POINT_PORT || 4000);
const POINT_ORIGIN = `http://127.0.0.1:${POINT_PORT}`;

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

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    if (logFile) fs.appendFileSync(logFile, line + "\n", "utf8");
  } catch {
    // ignore
  }
}

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

function ensurePointDataDir(pointRoot) {
  const dataDir = app.isPackaged ? resolveWindowsDataDir() : path.join(pointRoot, "data");
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

  if (!app.isPackaged) {
    return dataDir;
  }

  const seedRoot = path.join(pointRoot, "data");
  const targetDb = path.join(dataDir, "point.db");
  const legacyDir = path.join(app.getPath("userData"), "point-data");
  const legacyDb = path.join(legacyDir, "point.db");

  // Migrate previous Electron userData/point-data → LOCALAPPDATA\TshirtPrinter\data
  if (!fs.existsSync(targetDb) && fs.existsSync(legacyDb)) {
    log(`Migrating legacy point-data from ${legacyDir}`);
    copyMissingTree(legacyDir, dataDir);
  }

  const seedDb = path.join(seedRoot, "point.db.seed");
  if (!fs.existsSync(targetDb) && fs.existsSync(seedDb)) {
    fs.copyFileSync(seedDb, targetDb);
    log(`Seeded database from ${seedDb}`);
  }

  // Catalog + order PNGs must live next to the DB (not only in install dir).
  const seedCatalog = path.join(seedRoot, "catalog");
  const destCatalog = path.join(dataDir, "catalog");
  if (dirHasEntries(seedCatalog) && !dirHasEntries(destCatalog)) {
    fs.cpSync(seedCatalog, destCatalog, { recursive: true });
    log(`Seeded catalog images into ${destCatalog}`);
  } else if (dirHasEntries(seedCatalog)) {
    const n = copyMissingTree(seedCatalog, destCatalog);
    if (n > 0) log(`Merged ${n} missing catalog entries into ${destCatalog}`);
  }

  const seedOrders = path.join(seedRoot, "orders");
  const destOrders = path.join(dataDir, "orders");
  if (dirHasEntries(seedOrders)) {
    const n = copyMissingTree(seedOrders, destOrders);
    if (n > 0) log(`Seeded/merged ${n} order image folders into ${destOrders}`);
  }

  log(`Point DATA_DIR=${dataDir}`);
  return dataDir;
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
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);

  win.webContents.on("did-fail-load", (_e, code, desc, validatedURL) => {
    log(`did-fail-load code=${code} desc=${desc} url=${validatedURL}`);
  });
  win.webContents.on("did-finish-load", () => {
    log(`did-finish-load ${url}`);
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

  win.loadURL(url);
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
    alwaysOnTop: true,
    backgroundColor: "#111827",
    title: "Tshirt Printer",
    show: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWindow.setMenuBarVisibility(false);
  const html = `<!doctype html><html><body style="margin:0;font-family:Segoe UI,sans-serif;background:#111827;color:#f9fafb;display:flex;align-items:center;justify-content:center;height:100vh;">
    <div style="text-align:center;padding:24px">
      <div style="font-size:22px;font-weight:700;margin-bottom:12px">Tshirt Printer</div>
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
  const { kiosk, operator } = pickDisplays(config);
  log(`Opening UI kiosk=${JSON.stringify(kiosk.bounds)} operator=${JSON.stringify(operator.bounds)}`);

  if (kioskWindow && !kioskWindow.isDestroyed()) kioskWindow.close();
  if (operatorWindow && !operatorWindow.isDestroyed()) operatorWindow.close();

  // Operator first on primary — user always sees at least one window.
  operatorWindow = createFramelessWindow(operator, `${POINT_ORIGIN}/operator?native=1`);
  kioskWindow = createFramelessWindow(kiosk, `${POINT_ORIGIN}/kiosk?native=1`);
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
  const packagedNode = path.join(resourcesRoot(), "node", "node.exe");
  if (fs.existsSync(packagedNode)) return packagedNode;
  return process.env.NODE_BINARY || "node";
}

function resolvePointServerRoot() {
  const packaged = path.join(resourcesRoot(), "point-server");
  if (fs.existsSync(path.join(packaged, "dist", "index.js"))) return packaged;
  return path.resolve(__dirname, "..", "point-server");
}

async function ensurePointServer() {
  try {
    await waitForHealth(1500);
    log("point-server already healthy");
    return;
  } catch {
    // not up yet
  }

  const pointRoot = resolvePointServerRoot();
  const entry = path.join(pointRoot, "dist", "index.js");
  const nodeModules = path.join(pointRoot, "node_modules");
  if (!fs.existsSync(entry)) {
    throw new Error(`point-server build missing: ${entry}`);
  }
  if (!fs.existsSync(nodeModules)) {
    throw new Error(
      `point-server node_modules missing at ${nodeModules}. Rebuild with build-windows-app.bat`,
    );
  }

  const nodeBin = resolveNodeBinary();
  const uiDist = path.join(pointRoot, "ui-dist");
  // One writable root for DB + catalog + order images on any Windows PC:
  // %LOCALAPPDATA%\TshirtPrinter\data (created/seeded if missing).
  const dataDir = ensurePointDataDir(pointRoot);
  const dbPath = path.join(dataDir, "point.db");

  const serverLog = path.join(app.getPath("userData"), "point-server.log");
  const outFd = fs.openSync(serverLog, "a");

  log(`Starting point-server: node=${nodeBin} cwd=${pointRoot} DATA_DIR=${dataDir}`);
  pointProcess = spawn(nodeBin, [entry], {
    cwd: pointRoot,
    env: {
      ...process.env,
      PORT: String(POINT_PORT),
      DATA_DIR: dataDir,
      DATABASE_PATH: dbPath,
      UI_DIST_PATH: uiDist,
      CENTRAL_RELAY_URL: "",
      POINT_SYNC_ID: "",
      POINT_SYNC_TOKEN: "",
    },
    stdio: ["ignore", outFd, outFd],
    windowsHide: true,
  });

  pointProcess.on("exit", (code, signal) => {
    log(`point-server exited code=${code} signal=${signal}`);
    pointProcess = null;
  });

  await waitForHealth();
  log("point-server is healthy");
}

function stopPointServer() {
  if (!pointProcess || pointProcess.killed) return;
  try {
    pointProcess.kill();
  } catch {
    // ignore
  }
  pointProcess = null;
}

function registerIpc() {
  ipcMain.handle("displays:list", () => listDisplayPayloads());
  ipcMain.handle("displays:getAssignment", () => readDisplayConfig());
  ipcMain.handle("displays:apply", (_event, assignment) => {
    const config = {
      kioskIndex: Number(assignment?.kioskIndex),
      operatorIndex: Number(assignment?.operatorIndex),
    };
    if (!Number.isInteger(config.kioskIndex) || !Number.isInteger(config.operatorIndex)) {
      throw new Error("Invalid display indices");
    }
    writeDisplayConfig(config);
    openUiWindows(config);
    return { ok: true };
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Do not silently disappear — previous instance may be stuck invisible.
  app.whenReady().then(() => {
    dialog.showMessageBoxSync({
      type: "warning",
      title: "Tshirt Printer",
      message: "Приложение уже запущено.",
      detail:
        "Если окон не видно — завершите все процессы «Tshirt Printer» в Диспетчере задач и запустите снова через Start-TshirtPrinter.bat.",
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
    logFile = path.join(app.getPath("userData"), "desktop.log");
    try {
      fs.mkdirSync(app.getPath("userData"), { recursive: true });
      fs.writeFileSync(logFile, "", "utf8");
    } catch {
      // ignore
    }
    log(`App ready packaged=${app.isPackaged} resources=${resourcesRoot()}`);
    registerIpc();

    showSplash("Запуск сервера точки…");
    try {
      await ensurePointServer();
      showSplash("Открытие окон…");
      openUiWindows();
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      log(`FATAL: ${message}`);
      closeSplash();
      dialog.showErrorBox(
        "Tshirt Printer",
        `Не удалось запустить точку.\n\n${message}\n\nЛог: ${logFile}\nЛог сервера: ${path.join(app.getPath("userData"), "point-server.log")}`,
      );
      stopPointServer();
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    // Keep running only if splash is gone and both UI windows closed.
    if (splashWindow && !splashWindow.isDestroyed()) return;
    stopPointServer();
    app.quit();
  });

  app.on("before-quit", () => {
    stopPointServer();
  });
}
