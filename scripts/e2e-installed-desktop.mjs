#!/usr/bin/env node
/**
 * Full installed-app E2E: launches the real Operator/Kiosk EXEs, clicks the
 * operator update button, applies ui/server/broken-server, then opens Kiosk.
 *
 *   node scripts/e2e-installed-desktop.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { zipDirectory, extractZip } = require("../apps/point-desktop/zipTree.cjs");
const { inspectZone } = require("../apps/point-desktop/moduleIntegrity.cjs");

const OPERATOR_EXE = "C:\\Users\\By23\\AppData\\Local\\Programs\\TshirtPrinterOperator\\TshirtPrinterOperator.exe";
const KIOSK_EXE = "C:\\Users\\By23\\AppData\\Local\\Programs\\TshirtPrinterKiosk\\TshirtPrinterKiosk.exe";
const OPERATOR_ASAR = "C:\\Users\\By23\\AppData\\Local\\Programs\\TshirtPrinterOperator\\resources\\app.asar";
const LIVE_MODULES = path.join(process.env.LOCALAPPDATA, "TshirtPrinter", "modules");
const LIVE_DATA = path.join(process.env.LOCALAPPDATA, "TshirtPrinter", "data");
const KIOSK_CONFIG = path.join(process.env.APPDATA, "@tshirt", "kiosk-desktop", "config.json");

const playwright = require(path.join(repoRoot, "apps", "point-server", "node_modules", "playwright"));
const electron = playwright._electron;

const UPDATE_BTN =
  /Обновления|Установить обновлен|Ошибка обновления|Проверка|Скачивание|Установка|Перезапуск|Распаковка|Обновление/;
const BUSY_BTN = /Проверка|Скачивание|Установка|Перезапуск|Распаковка|Обновление…/;

const results = [];
let failed = 0;

function log(msg) {
  console.log(`[e2e] ${msg}`);
}

function step(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function killExe(name) {
  try {
    execFileSync("taskkill", ["/IM", name, "/F", "/T"], { stdio: "ignore", windowsHide: true });
  } catch {
    // not running
  }
}

function sha512File(filePath) {
  return crypto.createHash("sha512").update(fs.readFileSync(filePath)).digest("base64");
}

function writeYml(filePath, meta) {
  fs.writeFileSync(
    filePath,
    `version: ${meta.version}\npath: ${meta.path}\nsha512: ${meta.sha512}\nsize: ${meta.size}\n`,
    "utf8",
  );
}

function fetchJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} ${url} ${body.slice(0, 200)}`));
          return;
        }
        try {
          resolve({ status: res.statusCode, body, json: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body, json: null });
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`timeout ${url}`));
    });
  });
}

function startFeed(feedDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const name = path.basename(String(req.url || "/").split("?")[0]);
      const file = path.join(feedDir, name);
      if (!name || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

function runAsar(args) {
  execFileSync("npx.cmd", ["--yes", "@electron/asar", ...args], {
    cwd: repoRoot,
    stdio: "inherit",
    windowsHide: true,
    shell: true,
  });
}

function patchInstalledAsar() {
  if (!fs.existsSync(OPERATOR_ASAR)) throw new Error(`missing ${OPERATOR_ASAR}`);
  const bak = `${OPERATOR_ASAR}.bak`;
  if (!fs.existsSync(bak)) {
    fs.copyFileSync(OPERATOR_ASAR, bak);
    log(`asar backup ${bak}`);
  }
  const unpacked = path.join(os.tmpdir(), "tshirt-asar-e2e");
  if (fs.existsSync(unpacked)) fs.rmSync(unpacked, { recursive: true, force: true });
  log("extracting app.asar");
  runAsar(["extract", OPERATOR_ASAR, unpacked]);
  const src = path.join(repoRoot, "apps", "point-desktop");
  for (const name of [
    "main.cjs",
    "moduleUpdater.cjs",
    "moduleIntegrity.cjs",
    "waitForHealth.cjs",
    "zipTree.cjs",
    "modules.cjs",
    "updater.cjs",
  ]) {
    fs.copyFileSync(path.join(src, name), path.join(unpacked, name));
  }
  const packed = path.join(os.tmpdir(), "tshirt-app.asar.new");
  if (fs.existsSync(packed)) fs.unlinkSync(packed);
  log("packing app.asar");
  runAsar(["pack", unpacked, packed]);
  fs.copyFileSync(packed, OPERATOR_ASAR);
  log("installed Operator asar patched with new updater");
}

function packZoneZip(srcDir, zipPath) {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  zipDirectory(srcDir, zipPath);
  return {
    path: path.basename(zipPath),
    sha512: sha512File(zipPath),
    size: fs.statSync(zipPath).size,
  };
}

async function waitForOperatorWindow(app, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    for (const win of app.windows()) {
      try {
        const url = win.url();
        if (url.includes("/operator")) return win;
      } catch {
        // window gone
      }
    }
    await sleep(400);
  }
  const urls = [];
  for (const win of app.windows()) {
    try {
      urls.push(win.url());
    } catch {
      urls.push("(destroyed)");
    }
  }
  throw new Error(`operator window not found in ${timeoutMs}ms; windows=${urls.join(", ") || "none"}`);
}

function updateButton(page) {
  return page.locator("button").filter({ hasText: UPDATE_BTN }).first();
}

async function waitForUpdateIdle(page, timeoutMs = 8 * 60_000) {
  const started = Date.now();
  let last = "";
  while (Date.now() - started < timeoutMs) {
    if (page.isClosed()) {
      await sleep(500);
      return { text: "(window reloaded)", reloaded: true };
    }
    let text = "";
    try {
      text = ((await updateButton(page).textContent()) || "").replace(/\s+/g, " ").trim();
    } catch {
      return { text: "(window reloaded)", reloaded: true };
    }
    if (text && text !== last) {
      log(`button: ${text}`);
      last = text;
    }
    if (text && !BUSY_BTN.test(text)) return { text, reloaded: false };
    await sleep(400);
  }
  throw new Error(`update still busy after ${timeoutMs}ms (last="${last}")`);
}

async function modulesStatus(page) {
  return page.evaluate(async () => {
    const api = window.pointDesktop;
    if (!api?.getModulesStatus) return null;
    return api.getModulesStatus();
  });
}

async function assertOperatorAlive(page, label) {
  const health = await fetchJson("http://127.0.0.1:4000/health");
  if (health.status !== 200) throw new Error(`${label}: health HTTP ${health.status}`);
  const html = await fetchJson("http://127.0.0.1:4000/operator?native=1");
  if (!html.body.includes('id="root"') && !html.body.includes("id='root'")) {
    throw new Error(`${label}: operator HTML missing #root`);
  }
  if (page && !page.isClosed()) {
    const stats = page.getByText("Новые").or(page.getByText("Всего заказов"));
    await stats.first().waitFor({ timeout: 20_000 });
  }
}

async function clickUpdate(page) {
  const btn = updateButton(page);
  await btn.waitFor({ state: "visible", timeout: 30_000 });
  await btn.click({ timeout: 15_000 });
}

function zoneVersion(status, id) {
  const z = status?.zones?.find((x) => x.id === id);
  return z?.localVersion || null;
}

async function main() {
  if (!fs.existsSync(OPERATOR_EXE)) throw new Error(`Operator exe missing: ${OPERATOR_EXE}`);
  if (!fs.existsSync(KIOSK_EXE)) throw new Error(`Kiosk exe missing: ${KIOSK_EXE}`);
  if (!fs.existsSync(path.join(LIVE_MODULES, "ui", "index.html"))) {
    throw new Error("live modules/ui missing — start Operator once before E2E");
  }
  if (!inspectZone("server", path.join(LIVE_MODULES, "server")).ok) {
    throw new Error("live modules/server is not a runnable tree");
  }

  killExe("TshirtPrinterOperator.exe");
  killExe("TshirtPrinterKiosk.exe");
  await sleep(800);

  patchInstalledAsar();

  const work = path.join(os.tmpdir(), "tshirt-e2e-desktop");
  const feedDir = path.join(work, "feed");
  const modulesDir = path.join(work, "modules");
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(feedDir, { recursive: true });

  log("packing ui zip from live modules/ui");
  const uiZip = packZoneZip(path.join(LIVE_MODULES, "ui"), path.join(feedDir, "ui-e2e.zip"));
  log("packing server zip from live modules/server");
  const serverZip = packZoneZip(path.join(LIVE_MODULES, "server"), path.join(feedDir, "server-e2e.zip"));
  log("packing broken server zip (shared-types removed)");
  const brokenSrc = path.join(work, "server-broken");
  extractZip(path.join(feedDir, "server-e2e.zip"), brokenSrc);
  const scoped = path.join(brokenSrc, "node_modules", "@tshirt", "shared-types");
  if (fs.existsSync(scoped)) fs.rmSync(scoped, { recursive: true, force: true });
  fs.mkdirSync(path.join(brokenSrc, "node_modules", "@tshirt"), { recursive: true });
  const brokenZip = packZoneZip(brokenSrc, path.join(feedDir, "server-e2e-broken.zip"));
  if (inspectZone("server", brokenSrc).ok) throw new Error("broken fixture unexpectedly passed integrity");

  const UI_VER = "e2e.ui";
  const SRV_VER = "e2e.server";
  const BROKEN_VER = "e2e.broken";

  function publish(kind) {
    if (kind === "ui") {
      writeYml(path.join(feedDir, "ui.yml"), { version: UI_VER, ...uiZip });
      writeYml(path.join(feedDir, "server.yml"), { version: "bundled", path: serverZip.path, sha512: serverZip.sha512, size: serverZip.size });
    } else if (kind === "server") {
      writeYml(path.join(feedDir, "ui.yml"), { version: UI_VER, ...uiZip });
      writeYml(path.join(feedDir, "server.yml"), { version: SRV_VER, ...serverZip });
    } else if (kind === "broken") {
      writeYml(path.join(feedDir, "ui.yml"), { version: UI_VER, ...uiZip });
      writeYml(path.join(feedDir, "server.yml"), { version: BROKEN_VER, ...brokenZip });
    } else if (kind === "none") {
      writeYml(path.join(feedDir, "ui.yml"), { version: UI_VER, ...uiZip });
      writeYml(path.join(feedDir, "server.yml"), { version: SRV_VER, ...serverZip });
    }
  }

  publish("ui");
  const feed = await startFeed(feedDir);
  log(`module feed ${feed.origin}`);

  const env = {
    ...process.env,
    TSHIRT_MODULES_DIR: modulesDir,
    TSHIRT_DATA_DIR: LIVE_DATA,
    TSHIRT_MODULES_BASE_URL: feed.origin,
    TSHIRT_DISABLE_AUTO_UPDATER: "1",
  };

  log("launching installed Operator");
  const app = await electron.launch({
    executablePath: OPERATOR_EXE,
    timeout: 180_000,
    env,
  });

  let page;
  try {
    page = await waitForOperatorWindow(app);
    log(`operator url ${page.url()}`);
    await assertOperatorAlive(page, "boot");
    step("boot: Operator window + /health + заказы", true);

    await clickUpdate(page);
    let idle = await waitForUpdateIdle(page);
    if (idle.reloaded) page = await waitForOperatorWindow(app);
    await assertOperatorAlive(page, "after ui");
    let status = await modulesStatus(page);
    const uiOk = zoneVersion(status, "ui") === UI_VER;
    step("ui-only: кнопка Обновления применила интерфейс", uiOk, `local=${zoneVersion(status, "ui")} btn=${idle.text}`);
    if (!uiOk) throw new Error("ui version mismatch after update");

    publish("server");
    await clickUpdate(page);
    idle = await waitForUpdateIdle(page);
    if (idle.reloaded) page = await waitForOperatorWindow(app);
    await assertOperatorAlive(page, "after server");
    status = await modulesStatus(page);
    const srvOk = zoneVersion(status, "server") === SRV_VER;
    step("server-only: кнопка применила сервер, /health жив", srvOk, `local=${zoneVersion(status, "server")} btn=${idle.text}`);
    if (!srvOk) throw new Error("server version mismatch after update");

    const bothStill = zoneVersion(status, "ui") === UI_VER && zoneVersion(status, "server") === SRV_VER;
    step("pipeline leftover: ui+server оба на e2e-версиях", bothStill);

    const serverDir = path.join(modulesDir, "server");
    fs.writeFileSync(
      path.join(serverDir, "module-version.json"),
      JSON.stringify({ version: "e2e.old", updatedAt: new Date().toISOString() }, null, 2),
    );
    const manPath = path.join(modulesDir, "manifest.json");
    if (fs.existsSync(manPath)) {
      const man = JSON.parse(fs.readFileSync(manPath, "utf8"));
      if (man.zones?.server) man.zones.server.version = "e2e.old";
      fs.writeFileSync(manPath, JSON.stringify(man, null, 2));
    }
    publish("broken");
    await clickUpdate(page);
    idle = await waitForUpdateIdle(page);
    if (idle.reloaded) page = await waitForOperatorWindow(app);
    await assertOperatorAlive(page, "after broken");
    const stillGood = inspectZone("server", serverDir).ok;
    const notBroken = zoneVersion(await modulesStatus(page), "server") !== BROKEN_VER;
    const errorShown = /Ошибка/i.test(idle.text) || stillGood;
    step(
      "broken zip: отказ, рабочий сервер на месте, UI жив",
      stillGood && notBroken && errorShown,
      `integrity=${stillGood} ver!=broken=${notBroken} btn=${idle.text}`,
    );

    const kioskCfgPrev = fs.existsSync(KIOSK_CONFIG) ? fs.readFileSync(KIOSK_CONFIG, "utf8") : null;
    fs.mkdirSync(path.dirname(KIOSK_CONFIG), { recursive: true });
    fs.writeFileSync(KIOSK_CONFIG, JSON.stringify({ host: "127.0.0.1", port: 4000 }, null, 2));
    log("launching installed Kiosk");
    const kioskApp = await electron.launch({
      executablePath: KIOSK_EXE,
      timeout: 120_000,
      env: { ...process.env },
    });
    try {
      const kioskStarted = Date.now();
      let kioskPage = null;
      while (Date.now() - kioskStarted < 90_000) {
        for (const win of kioskApp.windows()) {
          try {
            const url = win.url();
            if (url.includes("/kiosk") || url.includes("/operator") || url.startsWith("http")) {
              kioskPage = win;
              break;
            }
          } catch {
            // gone
          }
        }
        if (kioskPage) break;
        await sleep(400);
      }
      if (!kioskPage) throw new Error("kiosk window not found");
      log(`kiosk url ${kioskPage.url()}`);
      const kioskHtml = await fetchJson("http://127.0.0.1:4000/kiosk?native=1");
      const kioskOk =
        kioskPage.url().includes("/kiosk") &&
        (kioskHtml.body.includes('id="root"') || kioskHtml.body.includes("id='root'"));
      step("kiosk: установленный Kiosk открыл /kiosk живого Operator", kioskOk, kioskPage.url());
    } finally {
      await kioskApp.close().catch(() => undefined);
      killExe("TshirtPrinterKiosk.exe");
      if (kioskCfgPrev != null) fs.writeFileSync(KIOSK_CONFIG, kioskCfgPrev);
    }
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    step("e2e aborted", false, message);
    try {
      if (page && !page.isClosed()) {
        const shot = path.join(os.tmpdir(), "tshirt-e2e-fail.png");
        await page.screenshot({ path: shot, fullPage: true });
        log(`screenshot ${shot}`);
      }
    } catch {
      // ignore
    }
    throw err;
  } finally {
    await app.close().catch(() => undefined);
    killExe("TshirtPrinterOperator.exe");
    killExe("TshirtPrinterKiosk.exe");
    feed.server.close();
  }
}

main()
  .then(() => {
    console.log("");
    for (const r of results) {
      console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
    }
    console.log(failed ? `\nFAILED (${failed})` : `\nALL ${results.length} E2E CHECKS PASSED`);
    process.exit(failed ? 1 : 0);
  })
  .catch((err) => {
    console.error("\nE2E FAILED:", err && err.stack ? err.stack : err);
    process.exit(1);
  });
