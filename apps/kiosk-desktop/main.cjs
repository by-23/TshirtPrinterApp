const { app, BrowserWindow, ipcMain, screen, dialog } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

/** @type {BrowserWindow | null} */
let kioskWindow = null;
/** @type {BrowserWindow | null} */
let setupWindow = null;
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

function configPath() {
  return path.join(app.getPath("userData"), "config.json");
}

/**
 * @returns {{ host: string, port: number }}
 */
function readConfig() {
  try {
    const raw = fs.readFileSync(configPath(), "utf8");
    const json = JSON.parse(raw);
    const host = typeof json.host === "string" ? json.host.trim() : "";
    const port = Number(json.port) || 4000;
    if (!host) return { host: "", port: 4000 };
    return { host, port };
  } catch {
    return { host: "", port: 4000 };
  }
}

/**
 * @param {{ host: string, port: number }} config
 */
function writeConfig(config) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(
    configPath(),
    JSON.stringify({ host: config.host.trim(), port: Number(config.port) || 4000 }, null, 2),
    "utf8",
  );
}

/**
 * @param {{ host: string, port: number }} config
 */
function pointOrigin(config) {
  return `http://${config.host}:${config.port}`;
}

/**
 * @param {{ host: string, port: number }} config
 * @param {number} [timeoutMs]
 */
function checkHealth(config, timeoutMs = 4000) {
  const url = `${pointOrigin(config)}/health`;
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 500));
    });
    req.on("error", () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function closeSetup() {
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.close();
  }
  setupWindow = null;
}

function closeKiosk() {
  if (kioskWindow && !kioskWindow.isDestroyed()) {
    kioskWindow.close();
  }
  kioskWindow = null;
}

function setupHtml(statusText, host, port) {
  const safeStatus = JSON.stringify(statusText);
  const safeHost = JSON.stringify(host || "");
  const safePort = JSON.stringify(String(port || 4000));
  return `<!DOCTYPE html>
<html lang="ru"><head>
<meta charset="utf-8"/>
<title>Tshirt Printer Kiosk</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: Segoe UI, system-ui, sans-serif;
    background: #0b0d14; color: #f4f6fb;
    display: flex; align-items: center; justify-content: center; min-height: 100vh;
  }
  .card {
    width: min(440px, 92vw); background: #151925; border: 1px solid #2a3144;
    border-radius: 16px; padding: 28px 24px; box-shadow: 0 16px 48px rgba(0,0,0,.45);
  }
  h1 { margin: 0 0 6px; font-size: 22px; }
  p { margin: 0 0 18px; color: #9aa3b8; font-size: 14px; line-height: 1.45; }
  label { display: block; font-size: 12px; color: #9aa3b8; margin-bottom: 6px; }
  input {
    width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid #2a3144;
    background: #0b0d14; color: #fff; font-size: 16px; margin-bottom: 14px;
  }
  input:focus { outline: 2px solid #3b82f6; border-color: transparent; }
  .row { display: flex; gap: 12px; }
  .row > div:first-child { flex: 1; }
  .row > div:last-child { width: 110px; }
  button {
    width: 100%; margin-top: 6px; padding: 14px; border: 0; border-radius: 10px;
    background: #2563eb; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
  }
  button:disabled { opacity: .55; cursor: default; }
  #status { min-height: 20px; margin: 12px 0 0; font-size: 13px; color: #fbbf24; }
  #status.ok { color: #34d399; }
  #status.err { color: #f87171; }
</style>
</head><body>
  <div class="card">
    <h1>Киоск</h1>
    <p>Укажите IP или имя ПК оператора, где запущен Tshirt Printer Operator. Оба ПК должны быть в одной сети.</p>
    <div class="row">
      <div>
        <label for="host">Адрес сервера</label>
        <input id="host" type="text" placeholder="192.168.1.10" autocomplete="off" spellcheck="false"/>
      </div>
      <div>
        <label for="port">Порт</label>
        <input id="port" type="number" min="1" max="65535"/>
      </div>
    </div>
    <button id="connect" type="button">Подключить</button>
    <div id="status"></div>
  </div>
<script>
  const hostEl = document.getElementById('host');
  const portEl = document.getElementById('port');
  const statusEl = document.getElementById('status');
  const btn = document.getElementById('connect');
  hostEl.value = ${safeHost};
  portEl.value = ${safePort};
  statusEl.textContent = ${safeStatus};

  async function connect() {
    const host = hostEl.value.trim();
    const port = Number(portEl.value) || 4000;
    if (!host) {
      statusEl.className = 'err';
      statusEl.textContent = 'Введите IP адрес ПК оператора';
      return;
    }
    btn.disabled = true;
    statusEl.className = '';
    statusEl.textContent = 'Проверка связи…';
    try {
      const result = await window.kioskDesktop.saveAndConnect({ host, port });
      if (!result.ok) {
        statusEl.className = 'err';
        statusEl.textContent = result.error || 'Сервер недоступен';
        btn.disabled = false;
        return;
      }
      statusEl.className = 'ok';
      statusEl.textContent = 'Подключено';
    } catch (e) {
      statusEl.className = 'err';
      statusEl.textContent = e && e.message ? e.message : String(e);
      btn.disabled = false;
    }
  }
  btn.addEventListener('click', connect);
  hostEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(); });
  portEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(); });
</script>
</body></html>`;
}

function showSetup(statusText = "") {
  const config = readConfig();
  const primary = screen.getPrimaryDisplay();
  const width = 520;
  const height = 420;
  const x = Math.round(primary.bounds.x + (primary.bounds.width - width) / 2);
  const y = Math.round(primary.bounds.y + (primary.bounds.height - height) / 2);

  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(setupHtml(statusText, config.host, config.port))}`,
    );
    setupWindow.show();
    setupWindow.focus();
    return;
  }

  setupWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b0d14",
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  setupWindow.setMenuBarVisibility(false);
  setupWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(setupHtml(statusText, config.host, config.port))}`,
  );
  setupWindow.on("closed", () => {
    setupWindow = null;
  });
}

function reconnectHtml(origin) {
  const safeOrigin = JSON.stringify(origin);
  return `<!DOCTYPE html>
<html lang="ru"><head>
<meta charset="utf-8"/>
<title>Нет связи</title>
<style>
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #05060f; color: #f4f6fb; font-family: Segoe UI, system-ui, sans-serif; text-align: center;
  }
  h1 { font-size: 28px; margin: 0 0 12px; }
  p { color: #9aa3b8; margin: 0 0 24px; }
  button {
    padding: 14px 28px; border: 0; border-radius: 10px; background: #2563eb; color: #fff;
    font-size: 15px; font-weight: 700; cursor: pointer; margin: 0 8px;
  }
  button.secondary { background: #2a3144; }
</style>
</head><body>
  <div>
    <h1>Нет связи с оператором</h1>
    <p>Сервер <span id="origin"></span> недоступен.<br/>Проверьте, что Operator запущен и порт открыт в брандмауэре.</p>
    <button id="retry" type="button">Повторить</button>
    <button id="setup" type="button" class="secondary">Сменить адрес</button>
  </div>
<script>
  document.getElementById('origin').textContent = ${safeOrigin};
  document.getElementById('retry').onclick = () => window.kioskDesktop.retryConnect();
  document.getElementById('setup').onclick = () => window.kioskDesktop.openSetup();
</script>
</body></html>`;
}

function showReconnect(config) {
  const primary = screen.getPrimaryDisplay();
  const { x, y, width, height } = primary.bounds;
  closeKiosk();

  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.setBounds({ x, y, width, height });
    setupWindow.setFullScreen(true);
    setupWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(reconnectHtml(pointOrigin(config)))}`,
    );
    return;
  }

  setupWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: "#05060f",
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  setupWindow.setMenuBarVisibility(false);
  setupWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(reconnectHtml(pointOrigin(config)))}`,
  );
  setupWindow.on("closed", () => {
    setupWindow = null;
  });
}

/**
 * @param {{ host: string, port: number }} config
 */
function openKiosk(config) {
  const url = `${pointOrigin(config)}/kiosk?native=1`;
  const primary = screen.getPrimaryDisplay();
  const { x, y, width, height } = primary.bounds;

  closeSetup();
  closeKiosk();

  kioskWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: "#05060f",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  kioskWindow.setMenuBarVisibility(false);

  kioskWindow.webContents.on("did-fail-load", (_e, code, desc, validatedURL) => {
    log(`did-fail-load code=${code} desc=${desc} url=${validatedURL}`);
    showReconnect(config);
  });

  kioskWindow.once("ready-to-show", () => {
    if (!kioskWindow || kioskWindow.isDestroyed()) return;
    kioskWindow.show();
    kioskWindow.focus();
    kioskWindow.setFullScreen(true);
    log(`kiosk shown ${url}`);
  });

  setTimeout(() => {
    if (kioskWindow && !kioskWindow.isDestroyed() && !kioskWindow.isVisible()) {
      kioskWindow.show();
      kioskWindow.setFullScreen(true);
    }
  }, 4000);

  kioskWindow.loadURL(url);
  kioskWindow.on("closed", () => {
    kioskWindow = null;
  });

  // Periodic health check — surface reconnect UI if operator PC goes away.
  const timer = setInterval(async () => {
    if (!kioskWindow || kioskWindow.isDestroyed()) {
      clearInterval(timer);
      return;
    }
    const ok = await checkHealth(config, 2500);
    if (!ok) {
      clearInterval(timer);
      log("health lost — showing reconnect");
      showReconnect(config);
    }
  }, 15_000);
}

async function tryConnect(config) {
  if (!config.host) {
    return { ok: false, error: "Введите IP адрес ПК оператора" };
  }
  const ok = await checkHealth(config);
  if (!ok) {
    return {
      ok: false,
      error: `Нет ответа от ${pointOrigin(config)}/health. Запустите Operator и откройте порт ${config.port} в брандмауэре.`,
    };
  }
  writeConfig(config);
  openKiosk(config);
  return { ok: true };
}

function registerIpc() {
  ipcMain.handle("kiosk:getConfig", () => readConfig());
  ipcMain.handle("kiosk:saveAndConnect", async (_event, payload) => {
    const host = typeof payload?.host === "string" ? payload.host.trim() : "";
    const port = Number(payload?.port) || 4000;
    return tryConnect({ host, port });
  });
  ipcMain.handle("kiosk:retryConnect", async () => {
    const config = readConfig();
    const result = await tryConnect(config);
    if (!result.ok) {
      showReconnect(config);
    }
    return result;
  });
  ipcMain.handle("kiosk:openSetup", () => {
    closeKiosk();
    showSetup("");
    return { ok: true };
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.whenReady().then(() => {
    dialog.showMessageBoxSync({
      type: "warning",
      title: "Tshirt Printer Kiosk",
      message: "Приложение уже запущено.",
    });
    app.quit();
  });
} else {
  app.on("second-instance", () => {
    if (kioskWindow && !kioskWindow.isDestroyed()) {
      kioskWindow.focus();
      kioskWindow.moveTop();
    } else if (setupWindow && !setupWindow.isDestroyed()) {
      setupWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    logFile = path.join(app.getPath("userData"), "kiosk-desktop.log");
    try {
      fs.mkdirSync(app.getPath("userData"), { recursive: true });
      fs.writeFileSync(logFile, "", "utf8");
    } catch {
      // ignore
    }
    log(`App ready packaged=${app.isPackaged}`);
    registerIpc();

    const config = readConfig();
    if (!config.host) {
      showSetup("Первый запуск — укажите адрес ПК оператора");
      return;
    }

    const ok = await checkHealth(config);
    if (ok) {
      openKiosk(config);
    } else {
      showSetup(
        `Не удалось подключиться к ${pointOrigin(config)}. Проверьте адрес и брандмауэр (порт ${config.port}).`,
      );
    }
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}
