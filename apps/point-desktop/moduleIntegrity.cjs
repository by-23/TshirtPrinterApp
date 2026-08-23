/**
 * Server/UI module trees must be self-contained real files.
 *
 * Workspace packages (`file:` / `workspace:*`) become NTFS junctions under
 * node_modules. Compress-Archive, Windows tar, and most zippers store the
 * junction as an empty directory or a 9-byte symlink stub — Node then dies
 * with ERR_MODULE_NOT_FOUND. pnpm deploy / a dereferenced copy is the
 * portable layout: https://pnpm.io/cli/deploy
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function isSymlink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function isRealFile(p) {
  try {
    const st = fs.lstatSync(p);
    return st.isFile() && !st.isSymbolicLink();
  } catch {
    return false;
  }
}

function isRealDir(p) {
  try {
    const st = fs.lstatSync(p);
    return st.isDirectory() && !st.isSymbolicLink();
  } catch {
    return false;
  }
}

/** Recursively copy `src` → `dest`, replacing junctions/symlinks with real files. */
function copyDereferenced(src, dest) {
  const st = fs.lstatSync(src);
  if (st.isSymbolicLink()) {
    const target = fs.realpathSync(src);
    const rst = fs.statSync(target);
    if (rst.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const name of fs.readdirSync(target)) {
        copyDereferenced(path.join(target, name), path.join(dest, name));
      }
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(target, dest);
    }
    return;
  }
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyDereferenced(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function findSymlinks(root, acc = [], cap = 50) {
  if (!fs.existsSync(root) || acc.length >= cap) return acc;
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    if (acc.length >= cap) break;
    const full = path.join(root, ent.name);
    if (ent.isSymbolicLink()) {
      acc.push(path.relative(root, full) || ent.name);
      continue;
    }
    if (ent.isDirectory()) findSymlinks(full, acc, cap);
  }
  return acc;
}

function packageJsonPath(root, depName) {
  return path.join(root, "node_modules", ...depName.split("/"), "package.json");
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function productionDepNames(root) {
  const pkgPath = path.join(root, "package.json");
  if (!isRealFile(pkgPath)) return [];
  let pkg;
  try {
    pkg = readJson(pkgPath);
  } catch {
    return [];
  }
  return Object.keys((pkg && pkg.dependencies) || {});
}

/**
 * Replace any junction/symlink under node_modules with a real copy.
 * Always materialize vendor/shared-types → node_modules/@tshirt/shared-types.
 * @returns {string[]} paths that were materialized
 */
function materializeNodeModules(root) {
  const done = [];
  const vendorTypes = path.join(root, "vendor", "shared-types");
  const scoped = path.join(root, "node_modules", "@tshirt", "shared-types");
  if (isRealDir(vendorTypes) || fs.existsSync(vendorTypes)) {
    fs.mkdirSync(path.dirname(scoped), { recursive: true });
    if (fs.existsSync(scoped)) fs.rmSync(scoped, { recursive: true, force: true });
    copyDereferenced(vendorTypes, scoped);
    done.push("@tshirt/shared-types");
  }

  const nm = path.join(root, "node_modules");
  if (!fs.existsSync(nm)) return done;

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isSymbolicLink()) {
        const tmp = `${full}.__real`;
        if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
        copyDereferenced(full, tmp);
        fs.rmSync(full, { recursive: true, force: true });
        fs.renameSync(tmp, full);
        done.push(path.relative(nm, full));
        continue;
      }
      if (ent.isDirectory()) walk(full);
    }
  }
  walk(nm);
  return done;
}

/**
 * @param {string} zone
 * @param {string} root
 * @param {{ allowSymlinks?: boolean }} [opts]
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function inspectZone(zone, root, opts = {}) {
  const allowSymlinks = opts.allowSymlinks === true;
  if (!root || !fs.existsSync(root)) {
    return { ok: false, error: `${zone}: directory missing` };
  }

  if (zone === "ui") {
    const html = path.join(root, "index.html");
    if (!(allowSymlinks ? fs.existsSync(html) : isRealFile(html))) {
      return { ok: false, error: "ui: index.html missing after extract" };
    }
    return { ok: true };
  }

  if (zone === "runtime") {
    const exe = path.join(root, "node.exe");
    if (!(allowSymlinks ? fs.existsSync(exe) : isRealFile(exe))) {
      return { ok: false, error: "runtime: node.exe missing after extract" };
    }
    return { ok: true };
  }

  if (zone !== "server") return { ok: true };

  const entry = path.join(root, "dist", "index.js");
  if (!(allowSymlinks ? fs.existsSync(entry) : isRealFile(entry))) {
    return { ok: false, error: "server: dist/index.js missing after extract" };
  }
  if (!isRealFile(path.join(root, "package.json"))) {
    return { ok: false, error: "server: package.json missing after extract" };
  }

  const deps = productionDepNames(root);
  if (!deps.length) {
    return { ok: false, error: "server: package.json has no dependencies" };
  }
  for (const name of deps) {
    const depPkg = packageJsonPath(root, name);
    const present = allowSymlinks ? fs.existsSync(depPkg) : isRealFile(depPkg);
    if (!present) {
      return {
        ok: false,
        error: `server: ${name} is not a real package under node_modules (zip dropped a junction/symlink)`,
      };
    }
  }

  if (!allowSymlinks) {
    const links = findSymlinks(path.join(root, "node_modules"));
    if (links.length) {
      return {
        ok: false,
        error: `server: node_modules still has symlinks/junctions (${links.slice(0, 3).join(", ")})`,
      };
    }
  }

  return { ok: true };
}

function assertZoneReady(zone, root) {
  const result = inspectZone(zone, root);
  if (!result.ok) throw new Error(result.error);
  return result;
}

/**
 * Node must actually resolve every production dep (catches empty dirs that
 * look like packages). Uses require.resolve so ESM packages still work.
 * @param {string} root
 * @param {string} nodeBin
 */
function assertDepsResolve(root, nodeBin) {
  const resolved = inspectZone("server", root);
  if (!resolved.ok) throw new Error(resolved.error);
  const script = `
    const { createRequire } = require('module');
    const { join } = require('path');
    const req = createRequire(join(process.cwd(), 'package.json'));
    const pkg = req('./package.json');
    for (const name of Object.keys(pkg.dependencies || {})) {
      try { req.resolve(name); }
      catch (e) {
        console.error('UNRESOLVED ' + name);
        process.exit(2);
      }
    }
  `;
  execFileSync(nodeBin, ["-e", script], {
    cwd: root,
    timeout: 30_000,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function swapKeepPrev(target, next) {
  const prev = `${target}.prev`;
  if (fs.existsSync(prev)) fs.rmSync(prev, { recursive: true, force: true });
  if (fs.existsSync(target)) fs.renameSync(target, prev);
  fs.renameSync(next, target);
}

function rollbackToPrev(target) {
  const prev = `${target}.prev`;
  if (!fs.existsSync(prev)) return false;
  const broken = `${target}.broken`;
  if (fs.existsSync(broken)) {
    try {
      fs.rmSync(broken, { recursive: true, force: true });
    } catch {
      // keep going — rename below still works if broken was removed enough
    }
  }
  if (fs.existsSync(target)) fs.renameSync(target, broken);
  fs.renameSync(prev, target);
  return true;
}

function removePrev(target) {
  const prev = `${target}.prev`;
  if (!fs.existsSync(prev)) return;
  try {
    fs.rmSync(prev, { recursive: true, force: true });
  } catch {
    // Windows file lock — leave it, next boot cleans up
  }
}

function removeBroken(target) {
  const broken = `${target}.broken`;
  if (!fs.existsSync(broken)) return;
  try {
    fs.rmSync(broken, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

module.exports = {
  isSymlink,
  isRealFile,
  isRealDir,
  copyDereferenced,
  findSymlinks,
  materializeNodeModules,
  productionDepNames,
  inspectZone,
  assertZoneReady,
  assertDepsResolve,
  swapKeepPrev,
  rollbackToPrev,
  removePrev,
  removeBroken,
  readJson,
};
