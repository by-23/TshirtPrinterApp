import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { waitForHealth } = require("./waitForHealth.cjs");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

test("waitForHealth succeeds when /health returns 200", async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  });
  const port = await listen(server);
  try {
    await waitForHealth({ origin: `http://127.0.0.1:${port}`, timeoutMs: 5_000 });
  } finally {
    server.close();
  }
});

test("waitForHealth fails immediately when the child already exited", async () => {
  const child = spawn(process.execPath, ["-e", "process.exit(7)"], { windowsHide: true });
  await new Promise((resolve) => child.once("exit", resolve));
  const started = Date.now();
  await assert.rejects(
    () => waitForHealth({ origin: "http://127.0.0.1:1", timeoutMs: 30_000, child }),
    /exited before ready/,
  );
  assert.ok(Date.now() - started < 3_000, "must not wait the full health timeout");
});

test("waitForHealth fails when the child exits during the wait", async () => {
  const child = spawn(process.execPath, ["-e", "setTimeout(() => process.exit(1), 200)"], {
    windowsHide: true,
  });
  const started = Date.now();
  await assert.rejects(
    () => waitForHealth({ origin: "http://127.0.0.1:1", timeoutMs: 30_000, child }),
    /exited before ready/,
  );
  assert.ok(Date.now() - started < 5_000);
});
