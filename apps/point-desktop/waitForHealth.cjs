const http = require("http");

/**
 * Wait until `origin/health` responds, but fail immediately if `child` already
 * exited — otherwise a crash loops for the full timeout while the UI says
 * "Перезапуск сервера…".
 *
 * @param {{
 *   origin: string,
 *   timeoutMs?: number,
 *   child?: import('node:child_process').ChildProcess | null,
 *   path?: string,
 * }} opts
 */
function waitForHealth(opts) {
  const origin = opts.origin;
  const timeoutMs = opts.timeoutMs == null ? 60_000 : opts.timeoutMs;
  const child = opts.child || null;
  const healthPath = opts.path || "/health";
  const started = Date.now();

  function childDead() {
    if (!child) return null;
    if (child.killed) return child.exitCode == null ? "killed" : child.exitCode;
    if (child.exitCode != null) return child.exitCode;
    return null;
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;

    const finish = (err) => {
      if (settled) return;
      settled = true;
      if (child) child.off("exit", onExit);
      if (timer) clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    };

    const onExit = (code, signal) => {
      finish(
        new Error(
          `point-server exited before ready (code=${code} signal=${signal || "null"})`,
        ),
      );
    };

    const dead = childDead();
    if (dead != null) {
      finish(new Error(`point-server exited before ready (code=${dead})`));
      return;
    }
    if (child) child.once("exit", onExit);

    const tick = () => {
      if (settled) return;
      const req = http.get(`${origin}${healthPath}`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          finish();
          return;
        }
        retry();
      });
      req.on("error", retry);
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (settled) return;
      if (Date.now() - started > timeoutMs) {
        finish(new Error(`point-server did not become ready at ${origin}${healthPath}`));
        return;
      }
      timer = setTimeout(tick, 400);
    };

    tick();
  });
}

module.exports = { waitForHealth };
