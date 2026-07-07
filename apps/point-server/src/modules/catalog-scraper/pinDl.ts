import { createRequire } from "node:module";
import path from "node:path";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);

/**
 * `pin-dl`'s package.json maps `"."` to `dist/index.mjs` via `exports`, and
 * that file is a plain Node ESM script (its own `bin` entry points at the
 * same file) — so we can run it with `node <entry> <args>` directly instead
 * of going through the `.cmd`/shell-script wrapper `pnpm` generates for
 * `node_modules/.bin`. That sidesteps all Windows/POSIX shell-quoting
 * differences for multi-word search queries.
 */
function resolvePinDlEntry(): string {
  return require.resolve("pin-dl");
}

export interface PinDlResult {
  pinId: string;
  filePath: string;
  alt: string;
}

export interface PinDlSearchOptions {
  query: string;
  outputDir: string;
  limit: number;
  delayMs: number;
  minResolutionPx?: number;
  timeoutMs?: number;
}

/**
 * Runs `pin-dl search` for one query and returns the pins it downloaded,
 * with alt text read back from the `--caption json` sidecar files. Never
 * throws for "no results" — returns an empty array instead; only throws if
 * the CLI itself fails to run (missing/broken install, non-zero exit).
 */
export async function pinDlSearch(options: PinDlSearchOptions): Promise<PinDlResult[]> {
  const entry = resolvePinDlEntry();
  const args = [
    entry,
    "search",
    options.query,
    "-o",
    options.outputDir,
    "-n",
    String(options.limit),
    "--delay",
    String(options.delayMs / 1000),
    "--caption",
    "json",
    "--filename",
    "{id}",
    "--skip-existing",
  ];
  if (options.minResolutionPx) {
    args.push("--min-res", `${options.minResolutionPx}x${options.minResolutionPx}`);
  }

  await runProcess(process.execPath, args, options.timeoutMs ?? 120_000);
  return readDownloadedPins(options.outputDir);
}

function runProcess(command: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`pin-dl timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pin-dl exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });
  });
}

async function readDownloadedPins(dir: string): Promise<PinDlResult[]> {
  if (!existsSync(dir)) return [];
  const files = await readdir(dir);
  const imageFiles = files.filter((file) => !file.endsWith(".json") && !file.endsWith(".txt"));

  const results: PinDlResult[] = [];
  for (const file of imageFiles) {
    const pinId = path.parse(file).name;
    const captionPath = path.join(dir, `${pinId}.json`);
    let alt = "";
    if (existsSync(captionPath)) {
      try {
        const raw = await readFile(captionPath, "utf-8");
        alt = (JSON.parse(raw) as { alt?: string }).alt?.trim() ?? "";
      } catch {
        // Corrupt/missing caption file — fall back to empty alt text.
      }
    }
    results.push({ pinId, filePath: path.join(dir, file), alt });
  }
  return results;
}
