#!/usr/bin/env node
/**
 * Build a portable point-server tree: real files only, no junctions.
 *
 *   node scripts/pack-point-server.cjs --out <dir> [--include-ui] [--smoke]
 *   node scripts/pack-point-server.cjs --zip <file> --yml <file> --version <ver>
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync, spawn } = require("child_process");

const {
  materializeNodeModules,
  copyDereferenced,
  inspectZone,
  assertDepsResolve,
} = require("../apps/point-desktop/moduleIntegrity.cjs");
const { zipDirectory } = require("../apps/point-desktop/zipTree.cjs");
const { waitForHealth } = require("../apps/point-desktop/waitForHealth.cjs");

const repoRoot = path.resolve(__dirname, "..");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return fallback;
  return process.argv[i + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { cwd: repoRoot, stdio: "inherit", windowsHide: true, ...opts });
}

function writeVendorSharedTypes(staging) {
  const dist = path.join(repoRoot, "packages", "shared-types", "dist");
  if (!fs.existsSync(path.join(dist, "index.js"))) {
    throw new Error("packages/shared-types/dist missing — build shared-types first");
  }
  const vendor = path.join(staging, "vendor", "shared-types");
  const vendorDist = path.join(vendor, "dist");
  fs.mkdirSync(vendorDist, { recursive: true });
  for (const name of fs.readdirSync(dist)) {
    const from = path.join(dist, name);
    const to = path.join(vendorDist, name);
    const st = fs.statSync(from);
    if (st.isDirectory()) copyDereferenced(from, to);
    else fs.copyFileSync(from, to);
  }
  fs.writeFileSync(
    path.join(vendor, "package.json"),
    JSON.stringify(
      {
        name: "@tshirt/shared-types",
        version: "0.0.0",
        type: "module",
        main: "./dist/index.js",
        types: "./dist/index.d.ts",
        dependencies: { zod: "^3.24.1" },
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

function writePackagedPackageJson(staging, version) {
  const src = JSON.parse(fs.readFileSync(path.join(repoRoot, "apps", "point-server", "package.json"), "utf8"));
  src.dependencies = { ...(src.dependencies || {}) };
  src.dependencies["@tshirt/shared-types"] = "file:./vendor/shared-types";
  if (version) src.version = version;
  fs.writeFileSync(path.join(staging, "package.json"), JSON.stringify(src, null, 2) + "\n", "utf8");
}

function npmInstallNested(staging) {
  process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
  const args = ["install", "--omit=dev", "--install-strategy=nested", "--no-fund", "--no-audit"];
  // Node 22 on Windows often throws EINVAL for spawnSync("npm.cmd", …) without a shell.
  if (process.platform === "win32") {
    execFileSync("cmd.exe", ["/d", "/s", "/c", ["npm", ...args].join(" ")], {
      cwd: staging,
      stdio: "inherit",
      windowsHide: true,
      env: process.env,
    });
    return;
  }
  execFileSync("npm", args, {
    cwd: staging,
    stdio: "inherit",
    windowsHide: true,
    env: process.env,
  });
}

function sha512File(filePath) {
  return crypto.createHash("sha512").update(fs.readFileSync(filePath)).digest("base64");
}

async function smoke(staging, nodeBin) {
  const port = 4011;
  const dataDir = path.join(require("os").tmpdir(), `tshirt-pack-smoke-${process.pid}`);
  fs.mkdirSync(dataDir, { recursive: true });
  const child = spawn(nodeBin, ["dist/index.js"], {
    cwd: staging,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dataDir,
      DATABASE_PATH: path.join(dataDir, "point.db"),
      BACKUP_ENABLED: "0",
      UI_DIST_PATH: path.join(staging, "ui-dist"),
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
      CENTRAL_RELAY_URL: "",
      POINT_SYNC_ID: "",
      POINT_SYNC_TOKEN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stderr = "";
  child.stderr.on("data", (d) => {
    stderr += String(d);
  });
  try {
    await waitForHealth({ origin: `http://127.0.0.1:${port}`, timeoutMs: 25_000, child });
  } catch (err) {
    child.kill();
    throw new Error(`${err.message}\n${stderr.slice(-2000)}`);
  } finally {
    if (!child.killed) {
      try {
        child.kill();
      } catch {
        // ignore
      }
    }
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

async function packPointServer(opts) {
  const version = opts.version || "";
  const includeUi = Boolean(opts.includeUi);
  const staging = opts.outDir;
  const pointSrc = path.join(repoRoot, "apps", "point-server");

  if (!opts.skipBuild) {
    run("pnpm", ["--filter", "@tshirt/shared-types", "build"]);
    run("pnpm", ["--filter", "@tshirt/point-server", "build"]);
  }

  if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  copyDereferenced(path.join(pointSrc, "dist"), path.join(staging, "dist"));
  copyDereferenced(path.join(pointSrc, "drizzle"), path.join(staging, "drizzle"));
  const assets = path.join(pointSrc, "assets");
  if (fs.existsSync(assets)) copyDereferenced(assets, path.join(staging, "assets"));
  const envFile = path.join(pointSrc, ".env");
  if (fs.existsSync(envFile)) fs.copyFileSync(envFile, path.join(staging, ".env"));

  writeVendorSharedTypes(staging);
  writePackagedPackageJson(staging, version);

  if (includeUi) {
    const uiDist = path.join(repoRoot, "apps", "kiosk-operator-app", "dist");
    if (!fs.existsSync(path.join(uiDist, "index.html"))) {
      throw new Error(`UI dist missing: ${uiDist}`);
    }
    copyDereferenced(uiDist, path.join(staging, "ui-dist"));
  }

  if (!opts.skipNpmInstall) npmInstallNested(staging);
  materializeNodeModules(staging);

  if (version) {
    fs.writeFileSync(
      path.join(staging, "module-version.json"),
      JSON.stringify({ version, updatedAt: new Date().toISOString() }, null, 2) + "\n",
      "utf8",
    );
  }

  const inspected = inspectZone("server", staging);
  if (!inspected.ok) throw new Error(`pack integrity failed: ${inspected.error}`);
  assertDepsResolve(staging, process.execPath);

  if (opts.smoke) {
    await smoke(staging, opts.smokeNode || process.execPath);
  }

  if (opts.zipPath) {
    zipDirectory(staging, opts.zipPath);
    const extracted = `${opts.zipPath}__verify`;
    const { extractZip } = require("../apps/point-desktop/zipTree.cjs");
    extractZip(opts.zipPath, extracted);
    const after = inspectZone("server", extracted);
    if (!after.ok) {
      throw new Error(`zip round-trip failed: ${after.error}`);
    }
    assertDepsResolve(extracted, process.execPath);
    fs.rmSync(extracted, { recursive: true, force: true });

    if (opts.ymlPath) {
      const sha = sha512File(opts.zipPath);
      const size = fs.statSync(opts.zipPath).size;
      const zipName = path.basename(opts.zipPath);
      fs.writeFileSync(
        opts.ymlPath,
        `version: ${version}\npath: ${zipName}\nsha512: ${sha}\nsize: ${size}\n`,
        "utf8",
      );
    }
  }

  return staging;
}

async function main() {
  const outDir = arg("--out") || path.join(require("os").tmpdir(), `tshirt-server-pack-${process.pid}`);
  const zipPath = arg("--zip");
  const ymlPath = arg("--yml");
  const version = arg("--version");
  const includeUi = hasFlag("--include-ui");
  const smokeFlag = hasFlag("--smoke");
  const skipBuild = hasFlag("--skip-build");
  const skipNpm = hasFlag("--skip-npm");

  await packPointServer({
    outDir,
    zipPath: zipPath || "",
    ymlPath: ymlPath || "",
    version,
    includeUi,
    smoke: smokeFlag,
    skipBuild,
    skipNpmInstall: skipNpm,
  });

  console.log(`packed server -> ${outDir}${zipPath ? `\nzip -> ${zipPath}` : ""}`);
}

module.exports = { packPointServer, writeVendorSharedTypes, materializeNodeModules };

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}
