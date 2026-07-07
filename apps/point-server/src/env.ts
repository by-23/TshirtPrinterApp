import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load `apps/point-server/.env` when present (local dev). Production should
// inject env vars via the host/process manager instead.
const envFile = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_PATH: process.env.DATABASE_PATH ?? "./data/point.db",
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
  // ИИ-раздел (Этап 9), `uploadMode: "wifi"` — overrides the QR upload URL's
  // host:port (see `modules/ai/routes.ts`). Needed because the kiosk
  // frontend always talks to point-server over a fixed `localhost:PORT`
  // (see `POINT_SERVER_URL` in the kiosk app), so `request.headers.host`
  // is *always* "localhost" regardless of what LAN IP a phone would need —
  // unset means the QR falls back to that (broken-for-a-phone) default.
  // Set to this point's real LAN IP, e.g. `192.168.1.13:4000` (see `ipconfig`/`ip addr`).
  PUBLIC_LAN_HOST: process.env.PUBLIC_LAN_HOST,
};
