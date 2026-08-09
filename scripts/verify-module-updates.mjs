/**
 * End-to-end check: GitHub module/shell manifests download, sha512, extract markers.
 * Also repairs a stuck modules/server.next swap when --repair is passed.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";

const OWNER = "by-23";
const REPO = "TshirtPrinterApp";
const MODULES_TAG = "modules";
const repair = process.argv.includes("--repair");
const applyUi = process.argv.includes("--apply-ui");

function modulesRoot() {
  return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "TshirtPrinter", "modules");
}

function fetchBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers: { "User-Agent": "TshirtPrinter-Verify", Accept: "*/*" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 8) {
        res.resume();
        fetchBuffer(res.headers.location, redirects + 1).then(resolve, reject);
        return;
      }
      if (!res.statusCode || res.statusCode >= 400) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} ${url}`));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(120_000, () => {
      req.destroy();
      reject(new Error(`timeout ${url}`));
    });
  });
}

async function downloadToFile(url, dest, onProgress) {
  await new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers: { "User-Agent": "TshirtPrinter-Verify", Accept: "*/*" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        downloadToFile(res.headers.location, dest, onProgress).then(resolve, reject);
        return;
      }
      if (!res.statusCode || res.statusCode >= 400) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} ${url}`));
        return;
      }
      const total = Number(res.headers["content-length"] || 0);
      let received = 0;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const out = fs.createWriteStream(dest);
      res.on("data", (chunk) => {
        received += chunk.length;
        if (total && onProgress) onProgress(Math.round((received / total) * 100));
      });
      res.pipe(out);
      out.on("finish", () => out.close(() => resolve()));
      out.on("error", reject);
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(15 * 60_000, () => {
      req.destroy();
      reject(new Error(`timeout download ${url}`));
    });
  });
}

function parseYml(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.+)\s*$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

async function sha512File(filePath) {
  const hash = crypto.createHash("sha512");
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest("base64");
}

function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const ps = `
    $ErrorActionPreference = 'Stop'
    if (Test-Path -LiteralPath '${destDir.replace(/'/g, "''")}') {
      Remove-Item -LiteralPath '${destDir.replace(/'/g, "''")}' -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path '${destDir.replace(/'/g, "''")}' | Out-Null
    Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force
  `;
  execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], {
    windowsHide: true,
    stdio: "inherit",
  });
}

function killPointServerNode() {
  const runtimeNode = path.join(modulesRoot(), "runtime", "node.exe");
  try {
    const out = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.ExecutablePath -eq '${runtimeNode.replace(/'/g, "''")}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $_.ProcessId }`,
      ],
      { encoding: "utf8", windowsHide: true },
    );
    console.log("killed point-server node:", out.trim() || "(none)");
  } catch (err) {
    console.log("kill point-server node:", err.message);
  }
}

function repairStuckServerSwap() {
  const root = modulesRoot();
  const target = path.join(root, "server");
  const next = path.join(root, "server.next");
  const prev = path.join(root, "server.prev");
  if (!fs.existsSync(path.join(next, "dist", "index.js"))) {
    console.log("repair: no server.next to apply");
    return false;
  }
  console.log("repair: completing stuck server.next swap…");
  killPointServerNode();
  // Give Windows a moment to release locks.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 800);
  if (fs.existsSync(prev)) fs.rmSync(prev, { recursive: true, force: true });
  if (fs.existsSync(target)) fs.renameSync(target, prev);
  fs.renameSync(next, target);
  const versionFile = path.join(target, "module-version.json");
  let version = "0.0.1";
  try {
    version = JSON.parse(fs.readFileSync(versionFile, "utf8")).version || version;
  } catch {
    // ignore
  }
  fs.writeFileSync(
    versionFile,
    JSON.stringify({ version, updatedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
  const manifestPath = path.join(root, "manifest.json");
  let manifest = { zones: {} };
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    // ignore
  }
  if (!manifest.zones) manifest.zones = {};
  manifest.zones.server = { version, updatedAt: new Date().toISOString() };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  if (fs.existsSync(prev)) {
    try {
      fs.rmSync(prev, { recursive: true, force: true });
    } catch (err) {
      console.log("repair: could not remove server.prev yet:", err.message);
    }
  }
  console.log(`repair: server -> v${version}`);
  return true;
}

async function verifyZone(zone) {
  const ymlUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${MODULES_TAG}/${zone}.yml`;
  console.log(`\n==> check ${zone}.yml`);
  const yml = parseYml((await fetchBuffer(ymlUrl)).toString("utf8"));
  console.log(yml);
  if (!yml.version || !yml.path) throw new Error(`${zone}.yml incomplete`);
  const zipUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${MODULES_TAG}/${yml.path}`;
  const tmp = path.join(os.tmpdir(), `tshirt-verify-${zone}-${yml.version}`);
  const zipPath = `${tmp}.zip`;
  const outDir = `${tmp}-out`;
  console.log(`download ${yml.path}…`);
  let last = -1;
  await downloadToFile(zipUrl, zipPath, (p) => {
    if (p >= last + 10 || p === 100) {
      last = p;
      process.stdout.write(`\r  ${p}%`);
    }
  });
  process.stdout.write("\n");
  const sha = await sha512File(zipPath);
  if (yml.sha512 && sha !== yml.sha512) {
    throw new Error(`${zone} sha512 mismatch\n expected ${yml.sha512}\n got      ${sha}`);
  }
  console.log("sha512 OK");
  console.log("extract…");
  extractZip(zipPath, outDir);
  const marker =
    zone === "ui" ? path.join(outDir, "index.html") : path.join(outDir, "dist", "index.js");
  if (!fs.existsSync(marker)) throw new Error(`missing marker ${marker}`);
  console.log(`OK ${zone} v${yml.version}`);
  try {
    fs.rmSync(zipPath, { force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  return yml;
}

async function verifyShell(channel, tagHint) {
  const latest = JSON.parse(
    (await fetchBuffer(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`)).toString("utf8"),
  );
  const tag = tagHint || latest.tag_name;
  console.log(`\n==> shell ${channel} from ${tag}`);
  const ymlUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${tag}/${channel}.yml`;
  const ymlText = (await fetchBuffer(ymlUrl)).toString("utf8");
  const version = (ymlText.match(/^version:\s*(.+)$/m) || [])[1]?.trim();
  const file = (ymlText.match(/^path:\s*(.+)$/m) || [])[1]?.trim();
  const size = Number((ymlText.match(/^\s*size:\s*(\d+)/m) || [])[1] || 0);
  if (!version || !file) throw new Error(`${channel}.yml incomplete`);
  // HEAD-ish: download first 1 byte via range to prove asset exists without pulling 200MB.
  const assetUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${tag}/${file}`;
  await new Promise((resolve, reject) => {
    const req = https.get(
      assetUrl,
      { headers: { "User-Agent": "TshirtPrinter-Verify", Range: "bytes=0-0" } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          https
            .get(res.headers.location, { headers: { Range: "bytes=0-0" } }, (res2) => {
              res2.resume();
              if (res2.statusCode === 206 || res2.statusCode === 200) resolve();
              else reject(new Error(`HTTP ${res2.statusCode} ${file}`));
            })
            .on("error", reject);
          return;
        }
        res.resume();
        if (res.statusCode === 206 || res.statusCode === 200) resolve();
        else reject(new Error(`HTTP ${res.statusCode} ${file}`));
      },
    );
    req.on("error", reject);
  });
  console.log(`OK ${channel} v${version} (${file}, ${Math.round(size / 1e6)} MB)`);
  return { version, file, tag };
}

async function applyUiFromRelease(meta) {
  const root = modulesRoot();
  const zipUrl = `https://github.com/${OWNER}/${REPO}/releases/download/${MODULES_TAG}/${meta.path}`;
  const zipPath = path.join(root, "_tmp", meta.path);
  const outDir = path.join(root, "_tmp", `ui-${meta.version}-verify-out`);
  const target = path.join(root, "ui");
  const next = `${target}.next`;
  const prev = `${target}.prev`;
  console.log("\n==> apply UI module into local modules/ui");
  killPointServerNode();
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  await downloadToFile(zipUrl, zipPath, (p) => {
    if (p % 20 === 0) process.stdout.write(`\r  download ${p}%`);
  });
  process.stdout.write("\n");
  const sha = await sha512File(zipPath);
  if (meta.sha512 && sha !== meta.sha512) throw new Error("ui sha mismatch on apply");
  extractZip(zipPath, outDir);
  if (fs.existsSync(next)) fs.rmSync(next, { recursive: true, force: true });
  fs.renameSync(outDir, next);
  if (fs.existsSync(prev)) fs.rmSync(prev, { recursive: true, force: true });
  if (fs.existsSync(target)) fs.renameSync(target, prev);
  fs.renameSync(next, target);
  fs.writeFileSync(
    path.join(target, "module-version.json"),
    JSON.stringify({ version: meta.version, updatedAt: new Date().toISOString() }, null, 2),
  );
  if (fs.existsSync(prev)) fs.rmSync(prev, { recursive: true, force: true });
  console.log(`applied ui v${meta.version}`);
}

async function main() {
  console.log("modules root:", modulesRoot());
  if (repair) repairStuckServerSwap();

  const ui = await verifyZone("ui");
  const server = await verifyZone("server");
  const op = await verifyShell("operator");
  const kiosk = await verifyShell("kiosk", op.tag);

  if (applyUi) await applyUiFromRelease(ui);

  const localUi = path.join(modulesRoot(), "ui", "module-version.json");
  const localServer = path.join(modulesRoot(), "server", "module-version.json");
  const localUiVer = fs.existsSync(localUi) ? JSON.parse(fs.readFileSync(localUi, "utf8")).version : null;
  const localServerVer = fs.existsSync(localServer)
    ? JSON.parse(fs.readFileSync(localServer, "utf8")).version
    : null;
  console.log("\n==> local modules");
  console.log({ localUiVer, localServerVer, remoteUi: ui.version, remoteServer: server.version });
  console.log("\nALL CHECKS PASSED");
  console.log(
    JSON.stringify(
      {
        ui: ui.version,
        server: server.version,
        operatorShell: op.version,
        kioskShell: kiosk.version,
        localUiVer,
        localServerVer,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("\nFAILED:", err.message || err);
  process.exit(1);
});
