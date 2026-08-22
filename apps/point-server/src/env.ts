import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load `apps/point-server/.env` when present (local dev). Production should
// inject env vars via the host/process manager instead.
const envFile = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

function resolveDataDir(): string {
  if (process.env.DATA_DIR?.trim()) {
    return resolve(process.env.DATA_DIR.trim());
  }
  // Same folder the desktop app and cashiers already open.
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return resolve(process.env.LOCALAPPDATA, "TshirtPrinter", "data");
  }
  return resolve("./data");
}

const DATA_DIR = resolveDataDir();

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  /** Writable data root — catalog, orders PNGs, ads, SQLite sibling path, etc. */
  DATA_DIR,
  // Default DB lives inside DATA_DIR so one folder owns everything for the point.
  DATABASE_PATH: process.env.DATABASE_PATH?.trim()
    ? resolve(process.env.DATABASE_PATH.trim())
    : resolve(DATA_DIR, "point.db"),
  // Outbound sync to central-relay (Stage 6) — all optional; when unset the
  // point simply runs offline-only, per the fail-open principle in PLAN.md.
  // Set these from the `syncToken`/`id` returned once by `POST /points` on central-relay.
  CENTRAL_RELAY_URL: process.env.CENTRAL_RELAY_URL,
  POINT_SYNC_ID: process.env.POINT_SYNC_ID,
  POINT_SYNC_TOKEN: process.env.POINT_SYNC_TOKEN,
  // Optional — fallback Giphy API key when not set in the operator panel
  // (docs/PLAN.md Этап 3, "Несколько источников"). Unset = that source is
  // silently skipped unless the panel stores a key, same fail-open principle.
  GIPHY_API_KEY: process.env.GIPHY_API_KEY,
  // ИИ-раздел (Этап 9) — Pollinations' current image-edit API expects a
  // bearer token (`gen.pollinations.ai/v1/images/edits`), unlike the fully
  // anonymous API docs/PLAN.md originally assumed. Optional/fail-open: unset
  // means `POST /ai/stylize` just answers 503 (see modules/ai/pollinations.ts).
  POLLINATIONS_API_TOKEN: process.env.POLLINATIONS_API_TOKEN,
  // Premium AI stylization (ChatGPT / Gemini) — optional; when unset the
  // corresponding provider is hidden on the kiosk (`GET /ai/providers`).
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  // ИИ-раздел (Этап 9), `uploadMode: "wifi"` — overrides the QR upload URL's
  // host:port (see `modules/ai/routes.ts`). Needed because the kiosk
  // frontend always talks to point-server over a fixed `localhost:PORT`
  // (see `POINT_SERVER_URL` in the kiosk app), so `request.headers.host`
  // is *always* "localhost" regardless of what LAN IP a phone would need —
  // unset means the QR falls back to that (broken-for-a-phone) default.
  // Set to this point's real LAN IP, e.g. `192.168.1.13:4000` (see `ipconfig`/`ip addr`).
  PUBLIC_LAN_HOST: process.env.PUBLIC_LAN_HOST,
  // Packaged Windows app / point release — directory with Vite `dist` (index.html).
  // When unset, `server.ts` looks for `../kiosk-operator-app/dist` or `./ui-dist`.
  UI_DIST_PATH: process.env.UI_DIST_PATH,
  /**
   * Daily local backups of essentials only: SQLite + `orders/` + `order-sources/` PNGs.
   * Default on — disable with BACKUP_ENABLED=0 for smoke tests / CI.
   */
  BACKUP_ENABLED: process.env.BACKUP_ENABLED !== "0" && process.env.BACKUP_ENABLED !== "false",
  /** How many daily backup folders to keep (default: 365 = one year). */
  BACKUP_KEEP_DAYS: Math.max(1, Number(process.env.BACKUP_KEEP_DAYS ?? 365) || 365),
  /**
   * Where to write backups. Default: sibling of DATA_DIR
   * (`…/TshirtPrinter/backups` next to `…/TshirtPrinter/data`).
   */
  BACKUP_DIR: process.env.BACKUP_DIR?.trim()
    ? resolve(process.env.BACKUP_DIR.trim())
    : resolve(DATA_DIR, "..", "backups"),
};
