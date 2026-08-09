/**
 * Writable module zones under %LOCALAPPDATA%\TshirtPrinter\modules\
 *   ui/      — Vite SPA (kiosk + operator)
 *   server/ — point-server dist + node_modules (no catalog data)
 *   runtime/— portable node.exe
 *
 * Bundled resources/ are the fallback until a zone is seeded or updated.
 */

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const ZONE_IDS = ["ui", "server", "runtime"];

function modulesRoot() {
  if (process.env.TSHIRT_MODULES_DIR && process.env.TSHIRT_MODULES_DIR.trim()) {
    return path.resolve(process.env.TSHIRT_MODULES_DIR.trim());
  }
  const localAppData =
    process.env.LOCALAPPDATA || path.join(app.getPath("home"), "AppData", "Local");
  return path.join(localAppData, "TshirtPrinter", "modules");
}

function zoneDir(zone) {
  return path.join(modulesRoot(), zone);
}

function manifestPath() {
  return path.join(modulesRoot(), "manifest.json");
}

function readManifest() {
  try {
    const raw = fs.readFileSync(manifestPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // missing / invalid
  }
  return { zones: {} };
}

function writeManifest(manifest) {
  const root = modulesRoot();
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2), "utf8");
}

function readZoneVersion(zone) {
  const versionFile = path.join(zoneDir(zone), "module-version.json");
  try {
    const raw = fs.readFileSync(versionFile, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.version === "string") return parsed.version;
  } catch {
    // fall through
  }
  const manifest = readManifest();
  const entry = manifest.zones && manifest.zones[zone];
  if (entry && typeof entry.version === "string") return entry.version;
  return null;
}

function setZoneVersion(zone, version) {
  const dir = zoneDir(zone);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "module-version.json"),
    JSON.stringify({ version, updatedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
  const manifest = readManifest();
  if (!manifest.zones) manifest.zones = {};
  manifest.zones[zone] = { version, updatedAt: new Date().toISOString() };
  writeManifest(manifest);
}

function dirHasFile(dir, fileName) {
  try {
    return fs.existsSync(path.join(dir, fileName));
  } catch {
    return false;
  }
}

/**
 * Client PCs often keep a broken modules/ tree after a failed remote apply
 * (Expand-Archive, partial swap). Dev machines usually already have a good
 * tree — so the bug only shows up remotely. On each new Operator shell
 * version, wipe ui/server/_tmp and re-seed from the bundled resources.
 * @param {{ shellVersion: string, log: (msg: string) => void }} opts
 */
function resetModulesIfShellChanged(opts) {
  const { shellVersion, log } = opts;
  const root = modulesRoot();
  fs.mkdirSync(root, { recursive: true });
  const marker = path.join(root, "shell-seed-version.json");
  let prev = null;
  try {
    const parsed = JSON.parse(fs.readFileSync(marker, "utf8"));
    if (parsed && typeof parsed.version === "string") prev = parsed.version;
  } catch {
    // missing
  }
  if (prev === shellVersion) return false;

  for (const name of [
    "ui",
    "ui.next",
    "ui.prev",
    "server",
    "server.next",
    "server.prev",
    "_tmp",
  ]) {
    const full = path.join(root, name);
    if (!fs.existsSync(full)) continue;
    try {
      fs.rmSync(full, { recursive: true, force: true });
      log(`modules reset: removed ${name} (shell ${prev || "none"} → ${shellVersion})`);
    } catch (err) {
      log(`modules reset: failed to remove ${name}: ${err && err.message ? err.message : err}`);
    }
  }
  fs.writeFileSync(
    marker,
    JSON.stringify({ version: shellVersion, resetAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
  return true;
}

/**
 * Seed modules from bundled resources on first launch (copy once).
 * @param {{ resourcesRoot: string, log: (msg: string) => void }} opts
 */
function ensureModulesSeeded(opts) {
  const { resourcesRoot, log } = opts;
  const root = modulesRoot();
  fs.mkdirSync(root, { recursive: true });

  const bundledUi = path.join(resourcesRoot, "point-server", "ui-dist");
  const uiTarget = zoneDir("ui");
  if (dirHasFile(bundledUi, "index.html") && !dirHasFile(uiTarget, "index.html")) {
    fs.cpSync(bundledUi, uiTarget, { recursive: true });
    setZoneVersion("ui", readZoneVersion("ui") || "bundled");
    log(`Seeded modules/ui from bundled ui-dist`);
  }

  const bundledServer = path.join(resourcesRoot, "point-server");
  const serverTarget = zoneDir("server");
  if (
    dirHasFile(path.join(bundledServer, "dist"), "index.js") &&
    !dirHasFile(path.join(serverTarget, "dist"), "index.js")
  ) {
    fs.mkdirSync(serverTarget, { recursive: true });
    for (const name of ["dist", "node_modules", "drizzle", "vendor", "assets", "package.json", ".env"]) {
      const from = path.join(bundledServer, name);
      if (!fs.existsSync(from)) continue;
      fs.cpSync(from, path.join(serverTarget, name), { recursive: true });
    }
    setZoneVersion("server", readZoneVersion("server") || "bundled");
    log(`Seeded modules/server from bundled point-server (no data/)`);
  }

  const bundledNode = path.join(resourcesRoot, "node", "node.exe");
  const runtimeTarget = zoneDir("runtime");
  if (fs.existsSync(bundledNode) && !fs.existsSync(path.join(runtimeTarget, "node.exe"))) {
    fs.mkdirSync(runtimeTarget, { recursive: true });
    fs.copyFileSync(bundledNode, path.join(runtimeTarget, "node.exe"));
    setZoneVersion("runtime", readZoneVersion("runtime") || "bundled");
    log(`Seeded modules/runtime from bundled node`);
  }
}

function resolveUiDistPath(resourcesRoot) {
  const moduleUi = zoneDir("ui");
  if (dirHasFile(moduleUi, "index.html")) return moduleUi;
  const bundled = path.join(resourcesRoot, "point-server", "ui-dist");
  if (dirHasFile(bundled, "index.html")) return bundled;
  return null;
}

function resolveServerRoot(resourcesRoot) {
  const moduleServer = zoneDir("server");
  if (dirHasFile(path.join(moduleServer, "dist"), "index.js")) return moduleServer;
  const bundled = path.join(resourcesRoot, "point-server");
  if (dirHasFile(path.join(bundled, "dist"), "index.js")) return bundled;
  return null;
}

function resolveNodeBinary(resourcesRoot) {
  const moduleNode = path.join(zoneDir("runtime"), "node.exe");
  if (fs.existsSync(moduleNode)) return moduleNode;
  const bundled = path.join(resourcesRoot, "node", "node.exe");
  if (fs.existsSync(bundled)) return bundled;
  return process.env.NODE_BINARY || "node";
}

function listLocalZones() {
  return ZONE_IDS.map((id) => ({
    id,
    localVersion: readZoneVersion(id) || undefined,
    state: "idle",
  }));
}

module.exports = {
  ZONE_IDS,
  modulesRoot,
  zoneDir,
  readManifest,
  writeManifest,
  readZoneVersion,
  setZoneVersion,
  ensureModulesSeeded,
  resetModulesIfShellChanged,
  resolveUiDistPath,
  resolveServerRoot,
  resolveNodeBinary,
  listLocalZones,
};
