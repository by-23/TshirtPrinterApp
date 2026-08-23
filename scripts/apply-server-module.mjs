import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { materializeNodeModules, inspectZone } = require("../apps/point-desktop/moduleIntegrity.cjs");

const root = path.join(process.env.LOCALAPPDATA, "TshirtPrinter", "modules");

function fetchBuf(url, n = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, { headers: { "User-Agent": "tshirt-apply" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && n < 8) {
          res.resume();
          fetchBuf(res.headers.location, n + 1).then(resolve, reject);
          return;
        }
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const go = (u) => {
      const lib = u.startsWith("https") ? https : http;
      lib
        .get(u, { headers: { "User-Agent": "tshirt-apply" } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            go(res.headers.location);
            return;
          }
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          const out = fs.createWriteStream(dest);
          let received = 0;
          const total = Number(res.headers["content-length"] || 0);
          res.on("data", (c) => {
            received += c.length;
            if (total) process.stdout.write(`\r  ${Math.round((received / total) * 100)}%`);
          });
          res.pipe(out);
          out.on("finish", () => out.close(() => resolve()));
        })
        .on("error", reject);
    };
    go(url);
  });
}

function parseYml(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.+)\s*$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const yml = parseYml(
  (await fetchBuf("https://github.com/by-23/TshirtPrinterApp/releases/download/modules/server.yml")).toString(
    "utf8",
  ),
);
console.log("remote server", yml);
const zip = path.join(root, "_tmp", yml.path);
const out = path.join(root, "_tmp", `server-${yml.version}-apply-out`);
if (fs.existsSync(out)) fs.rmSync(out, { recursive: true, force: true });
await download(`https://github.com/by-23/TshirtPrinterApp/releases/download/modules/${yml.path}`, zip);
process.stdout.write("\n");
const hash = crypto.createHash("sha512");
await pipeline(fs.createReadStream(zip), hash);
const sha = hash.digest("base64");
if (sha !== yml.sha512) throw new Error(`sha mismatch\n${yml.sha512}\n${sha}`);
console.log("sha OK, extract");
execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-Command",
    `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${out.replace(/'/g, "''")}' -Force`,
  ],
  { stdio: "inherit", windowsHide: true },
);

const runtime = path.join(root, "runtime", "node.exe");
try {
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.ExecutablePath -eq '${runtime.replace(/'/g, "''")}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
    ],
    { stdio: "inherit", windowsHide: true },
  );
} catch {
  // ignore
}
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 800);

const target = path.join(root, "server");
const next = `${target}.next`;
const prev = `${target}.prev`;
if (fs.existsSync(next)) fs.rmSync(next, { recursive: true, force: true });
fs.renameSync(out, next);
if (fs.existsSync(prev)) fs.rmSync(prev, { recursive: true, force: true });
if (fs.existsSync(target)) fs.renameSync(target, prev);
fs.renameSync(next, target);
fs.writeFileSync(
  path.join(target, "module-version.json"),
  JSON.stringify({ version: yml.version, updatedAt: new Date().toISOString() }, null, 2),
);
const manPath = path.join(root, "manifest.json");
const man = JSON.parse(fs.readFileSync(manPath, "utf8"));
man.zones = man.zones || {};
man.zones.server = { version: yml.version, updatedAt: new Date().toISOString() };
fs.writeFileSync(manPath, JSON.stringify(man, null, 2));
if (fs.existsSync(prev)) {
  try {
    fs.rmSync(prev, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

materializeNodeModules(target);
const gate = inspectZone("server", target);
if (!gate.ok) throw new Error(gate.error);
console.log("server applied", yml.version);
