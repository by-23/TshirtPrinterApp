import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";

const require = createRequire(import.meta.url);
const {
  inspectZone,
  assertDepsResolve,
  materializeNodeModules,
  copyDereferenced,
  findSymlinks,
} = require("./moduleIntegrity.cjs");
const { zipDirectory, extractZip, zipWithCompressArchive } = require("./zipTree.cjs");

const tmpRoot = path.join(os.tmpdir(), `tshirt-integrity-${process.pid}`);

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function writeMiniServer(root, { asJunction } = {}) {
  fs.mkdirSync(path.join(root, "dist"), { recursive: true });
  fs.writeFileSync(path.join(root, "dist", "index.js"), "export {};\n");
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "@tshirt/point-server",
      type: "module",
      dependencies: { "@tshirt/shared-types": "file:./vendor/shared-types" },
    }) + "\n",
  );
  const vendor = path.join(root, "vendor", "shared-types");
  fs.mkdirSync(path.join(vendor, "dist"), { recursive: true });
  fs.writeFileSync(
    path.join(vendor, "package.json"),
    JSON.stringify({
      name: "@tshirt/shared-types",
      type: "module",
      main: "./dist/index.js",
    }) + "\n",
  );
  fs.writeFileSync(path.join(vendor, "dist", "index.js"), "export const ok = true;\n");

  fs.mkdirSync(path.join(root, "node_modules", "@tshirt"), { recursive: true });
  const scoped = path.join(root, "node_modules", "@tshirt", "shared-types");
  if (asJunction) {
    fs.symlinkSync(vendor, scoped, "junction");
  } else {
    copyDereferenced(vendor, scoped);
  }
}

before(() => {
  rimraf(tmpRoot);
  fs.mkdirSync(tmpRoot, { recursive: true });
});
after(() => rimraf(tmpRoot));

test("inspectZone rejects a junction under node_modules/@tshirt/shared-types", () => {
  const dir = path.join(tmpRoot, "junction-tree");
  writeMiniServer(dir, { asJunction: true });
  const links = findSymlinks(path.join(dir, "node_modules"));
  assert.ok(links.length > 0, "expected a junction");
  const result = inspectZone("server", dir);
  assert.equal(result.ok, false);
  assert.match(result.error, /symlink|junction|not a real package/i);
});

test("inspectZone rejects the post-zip empty @tshirt folder (the live production failure)", () => {
  const dir = path.join(tmpRoot, "empty-scope");
  writeMiniServer(dir, { asJunction: false });
  const scoped = path.join(dir, "node_modules", "@tshirt", "shared-types");
  fs.rmSync(scoped, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "node_modules", "@tshirt"), { recursive: true });
  const result = inspectZone("server", dir);
  assert.equal(result.ok, false);
  assert.match(result.error, /@tshirt\/shared-types/);
});

test("Compress-Archive drops the junction — extracted tree must fail the gate", () => {
  const src = path.join(tmpRoot, "old-pack-src");
  const zip = path.join(tmpRoot, "old-pack.zip");
  const out = path.join(tmpRoot, "old-pack-out");
  writeMiniServer(src, { asJunction: true });
  zipWithCompressArchive(src, zip);
  extractZip(zip, out);
  const result = inspectZone("server", out);
  assert.equal(result.ok, false);
});

test("materialize + ZipFile round-trip keeps shared-types as a real package Node can resolve", () => {
  const src = path.join(tmpRoot, "new-pack-src");
  const zip = path.join(tmpRoot, "new-pack.zip");
  const out = path.join(tmpRoot, "new-pack-out");
  writeMiniServer(src, { asJunction: true });
  materializeNodeModules(src);
  assert.equal(inspectZone("server", src).ok, true);
  assert.equal(findSymlinks(path.join(src, "node_modules")).length, 0);
  zipDirectory(src, zip);
  extractZip(zip, out);
  assert.equal(inspectZone("server", out).ok, true);
  assertDepsResolve(out, process.execPath);
});

test("inspectZone reads package.json with a UTF-8 BOM", () => {
  const dir = path.join(tmpRoot, "bom");
  writeMiniServer(dir, { asJunction: false });
  const pkgPath = path.join(dir, "package.json");
  const body = fs.readFileSync(pkgPath);
  fs.writeFileSync(pkgPath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body]));
  assert.equal(inspectZone("server", dir).ok, true);
});

test("ui zone requires a real index.html", () => {
  const dir = path.join(tmpRoot, "ui-empty");
  fs.mkdirSync(dir, { recursive: true });
  assert.equal(inspectZone("ui", dir).ok, false);
  fs.writeFileSync(path.join(dir, "index.html"), "<div id='root'></div>");
  assert.equal(inspectZone("ui", dir).ok, true);
});
