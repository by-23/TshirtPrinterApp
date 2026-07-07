import { execFile } from "node:child_process";
import net from "node:net";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const HEALTH_CHECK_TIMEOUT_MS = 800;
const POST_KILL_SETTLE_MS = 400;

/**
 * Guesses whether a process squatting on our port is a stale copy of *this*
 * app (safe to auto-kill) vs. something unrelated (never touch it), from
 * its command line. `tsx watch` doesn't preserve the literal word "watch"
 * in the actual listening process's argv on Windows (it re-execs through
 * an internal loader) — what *does* survive is the entry script path, so
 * matching is keyed on that instead: `src/index.ts` for `pnpm dev` (tsx)
 * and `dist/index.js` for `pnpm start` (built), both scoped to a process
 * that's clearly running under this repo/app (`tsx` loader or the
 * `point-server` path segment) to avoid false-matching an unrelated
 * project that happens to also have a `src/index.ts`.
 */
function looksLikeOwnProcess(commandLine: string): boolean {
  const cmd = commandLine.toLowerCase();
  if (cmd.includes("point-server")) return true;
  if (cmd.includes("tsx") && (cmd.includes("src/index.ts") || cmd.includes("src\\index.ts"))) return true;
  if (cmd.includes("dist/index.js") || cmd.includes("dist\\index.js")) return true;
  return false;
}

async function isPortFree(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => tester.close(() => resolve(true)));
    tester.listen(port, host);
  });
}

/** If something on `port` answers like *our* `/health` route, it's almost certainly an already-running point-server, not a foreign app. */
async function respondsToOwnHealthCheck(port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    return body?.status === "ok";
  } catch {
    return false;
  }
}

async function findPidOnPort(port: number): Promise<number | null> {
  try {
    if (process.platform === "win32") {
      const { stdout } = await execFileAsync("netstat", ["-ano"]);
      const line = stdout
        .split("\n")
        .find((row) => row.includes(`:${port} `) && /LISTENING/i.test(row));
      const pid = line?.trim().split(/\s+/).pop();
      return pid && /^\d+$/.test(pid) ? Number(pid) : null;
    }
    const { stdout } = await execFileAsync("lsof", ["-t", `-i:${port}`, "-sTCP:LISTEN"]);
    const pid = stdout.trim().split("\n")[0];
    return pid && /^\d+$/.test(pid) ? Number(pid) : null;
  } catch {
    return null;
  }
}

/** Best-effort process description (command line) used only to decide whether a PID looks like one of ours — never trusted for anything security-sensitive. */
async function describeProcess(pid: number): Promise<string> {
  try {
    if (process.platform === "win32") {
      const { stdout } = await execFileAsync("wmic", [
        "process",
        "where",
        `ProcessId=${pid}`,
        "get",
        "CommandLine,Name",
        "/format:list",
      ]);
      return stdout;
    }
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "command="]);
    return stdout;
  } catch {
    return "";
  }
}

function killProcess(pid: number): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      execFile("taskkill", ["/PID", String(pid), "/F", "/T"], () => resolve());
      return;
    }
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
    resolve();
  });
}

export type PortGuardOutcome =
  | { action: "free" }
  | { action: "already-healthy"; message: string }
  | { action: "killed-stale"; message: string }
  | { action: "occupied-by-other"; message: string };

/**
 * Pre-flight check run before `app.listen()`. Dev restarts (tsx watch
 * reloads, crashed processes, closed terminals) can leave the port from a
 * previous run either still bound or held by something else entirely — both
 * used to surface as either a raw `EADDRINUSE` crash or, worse, a perfectly
 * healthy-looking kiosk app that just can't create orders ("Не удалось
 * создать заказ. Проверьте соединение с сервером точки.") with zero
 * indication of why. This makes the three real cases explicit:
 *
 * 1. Port is free — nothing to do.
 * 2. Something already answers `/health` there — almost certainly another
 *    copy of this same point-server (e.g. started twice); don't fight it
 *    for the socket, just say so so the caller can exit(0) quietly.
 * 3. Port is held but unresponsive — either a stale/crashed point-server
 *    process (safe to kill by command-line match) or a genuinely different
 *    app (never killed blindly; surfaced as a precise, actionable error
 *    instead of EADDRINUSE).
 */
export async function ensurePortAvailable(port: number, host = "0.0.0.0"): Promise<PortGuardOutcome> {
  if (await isPortFree(port, host)) {
    return { action: "free" };
  }

  if (await respondsToOwnHealthCheck(port)) {
    return {
      action: "already-healthy",
      message: `Порт ${port} уже занят работающим и здоровым point-server — повторный запуск не требуется.`,
    };
  }

  const pid = await findPidOnPort(port);
  if (pid == null) {
    return {
      action: "occupied-by-other",
      message: `Порт ${port} занят, но определить процесс не удалось. Освободите порт вручную или задайте PORT в apps/point-server/.env.`,
    };
  }

  const description = await describeProcess(pid);

  if (looksLikeOwnProcess(description)) {
    await killProcess(pid);
    await new Promise((resolve) => setTimeout(resolve, POST_KILL_SETTLE_MS));
    if (await isPortFree(port, host)) {
      return {
        action: "killed-stale",
        message: `Найден и завершён зависший процесс point-server (pid ${pid}), занимавший порт ${port}.`,
      };
    }
    return {
      action: "occupied-by-other",
      message: `Порт ${port} остался занят даже после попытки завершить процесс pid ${pid}.`,
    };
  }

  return {
    action: "occupied-by-other",
    message: `Порт ${port} занят посторонним процессом (pid ${pid}${description ? `: ${description.trim().split("\n")[0]}` : ""}). Освободите порт вручную (taskkill /PID ${pid} /F) или задайте другой PORT в apps/point-server/.env.`,
  };
}
