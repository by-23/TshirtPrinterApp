import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";

const require = createRequire(import.meta.url);
const {
  inspectZone,
  swapKeepPrev,
  rollbackToPrev,
  removePrev,
  copyDereferenced,
} = require("./moduleIntegrity.cjs");
const { zipDirectory, extractZip } = require("./zipTree.cjs");

const tmpRoot = path.join(os.tmpdir(), `tshirt-apply-${process.pid}`);

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function writeMarker(dir, zone, version) {
  fs.mkdirSync(dir, { recursive: true });
  if (zone === "ui") {
    fs.writeFileSync(path.join(dir, "index.html"), `<html data-v="${version}"><div id="root"></div></html>`);
  } else {
    fs.mkdirSync(path.join(dir, "dist"), { recursive: true });
    fs.writeFileSync(path.join(dir, "dist", "index.js"), `export const version = "${version}";\n`);
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({
        name: "@tshirt/point-server",
        type: "module",
        dependencies: { "@tshirt/shared-types": "file:./vendor/shared-types" },
      }) + "\n",
    );
    const vendor = path.join(dir, "vendor", "shared-types");
    fs.mkdirSync(path.join(vendor, "dist"), { recursive: true });
    fs.writeFileSync(
      path.join(vendor, "package.json"),
      JSON.stringify({ name: "@tshirt/shared-types", type: "module", main: "./dist/index.js" }) + "\n",
    );
    fs.writeFileSync(path.join(vendor, "dist", "index.js"), "export const ok = true;\n");
    copyDereferenced(vendor, path.join(dir, "node_modules", "@tshirt", "shared-types"));
  }
  fs.writeFileSync(path.join(dir, "module-version.json"), JSON.stringify({ version }) + "\n");
}

function readVersion(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, "module-version.json"), "utf8")).version;
}

/**
 * Same order as moduleUpdater applyPipeline: verify next, swap keep prev,
 * restart, rollback on failure, drop prev on success.
 */
function applyPipeline(items, restart) {
  for (const item of items) {
    const gate = inspectZone(item.zone, item.next);
    if (!gate.ok) throw new Error(gate.error);
  }
  for (const item of items) {
    swapKeepPrev(item.target, item.next);
  }
  try {
    restart();
  } catch (err) {
    for (const item of items.slice().reverse()) rollbackToPrev(item.target);
    throw err;
  }
  for (const item of items) removePrev(item.target);
}

before(() => {
  rimraf(tmpRoot);
  fs.mkdirSync(tmpRoot, { recursive: true });
});
after(() => rimraf(tmpRoot));

test("ui-only apply replaces the tree and keeps it after a successful restart", () => {
  const target = path.join(tmpRoot, "ui-only", "ui");
  const next = path.join(tmpRoot, "ui-only", "ui.next");
  writeMarker(target, "ui", "0.0.1");
  writeMarker(next, "ui", "0.0.2");
  applyPipeline([{ zone: "ui", target, next }], () => undefined);
  assert.equal(readVersion(target), "0.0.2");
  assert.equal(fs.existsSync(`${target}.prev`), false);
});

test("server-only apply: restart failure rolls back to the previous working tree", () => {
  const target = path.join(tmpRoot, "server-rollback", "server");
  const next = path.join(tmpRoot, "server-rollback", "server.next");
  writeMarker(target, "server", "old");
  writeMarker(next, "server", "new");
  assert.throws(
    () => applyPipeline([{ zone: "server", target, next }], () => { throw new Error("boot failed"); }),
    /boot failed/,
  );
  assert.equal(readVersion(target), "old");
});

test("server-only apply: successful restart drops .prev", () => {
  const target = path.join(tmpRoot, "server-ok", "server");
  const next = path.join(tmpRoot, "server-ok", "server.next");
  writeMarker(target, "server", "old");
  writeMarker(next, "server", "new");
  applyPipeline([{ zone: "server", target, next }], () => undefined);
  assert.equal(readVersion(target), "new");
  assert.equal(fs.existsSync(`${target}.prev`), false);
});

test("ui+server pipeline: restart failure rolls both zones back", () => {
  const root = path.join(tmpRoot, "pipeline-fail");
  const ui = path.join(root, "ui");
  const server = path.join(root, "server");
  writeMarker(ui, "ui", "ui-old");
  writeMarker(server, "server", "srv-old");
  writeMarker(path.join(root, "ui.next"), "ui", "ui-new");
  writeMarker(path.join(root, "server.next"), "server", "srv-new");
  assert.throws(
    () =>
      applyPipeline(
        [
          { zone: "ui", target: ui, next: path.join(root, "ui.next") },
          { zone: "server", target: server, next: path.join(root, "server.next") },
        ],
        () => { throw new Error("health timeout"); },
      ),
    /health timeout/,
  );
  assert.equal(readVersion(ui), "ui-old");
  assert.equal(readVersion(server), "srv-old");
});

test("ui+server pipeline: both stay on the new trees after a healthy restart", () => {
  const root = path.join(tmpRoot, "pipeline-ok");
  const ui = path.join(root, "ui");
  const server = path.join(root, "server");
  writeMarker(ui, "ui", "ui-old");
  writeMarker(server, "server", "srv-old");
  writeMarker(path.join(root, "ui.next"), "ui", "ui-new");
  writeMarker(path.join(root, "server.next"), "server", "srv-new");
  applyPipeline(
    [
      { zone: "ui", target: ui, next: path.join(root, "ui.next") },
      { zone: "server", target: server, next: path.join(root, "server.next") },
    ],
    () => undefined,
  );
  assert.equal(readVersion(ui), "ui-new");
  assert.equal(readVersion(server), "srv-new");
});

test("broken extracted server is refused and the current tree is not swapped", () => {
  const target = path.join(tmpRoot, "refuse-broken", "server");
  const next = path.join(tmpRoot, "refuse-broken", "server.next");
  writeMarker(target, "server", "working");
  writeMarker(next, "server", "broken");
  fs.rmSync(path.join(next, "node_modules", "@tshirt", "shared-types"), { recursive: true, force: true });
  assert.throws(
    () => applyPipeline([{ zone: "server", target, next }], () => undefined),
    /shared-types/,
  );
  assert.equal(readVersion(target), "working");
});

test("zip of a good tree can be extracted and applied as a server update", () => {
  const root = path.join(tmpRoot, "zip-apply");
  const target = path.join(root, "server");
  const packed = path.join(root, "packed");
  const zip = path.join(root, "server.zip");
  const extracted = path.join(root, "server.next");
  writeMarker(target, "server", "v1");
  writeMarker(packed, "server", "v2");
  zipDirectory(packed, zip);
  extractZip(zip, extracted);
  applyPipeline([{ zone: "server", target, next: extracted }], () => undefined);
  assert.equal(readVersion(target), "v2");
});
