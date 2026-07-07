import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load `apps/central-relay/.env` when present (local dev/on-prem central-relay
// hosts) — mirrors `apps/point-server/src/env.ts`. Production PaaS hosting
// (Railway/Render/etc., see docs/PLAN.md "Допущения") should keep injecting
// env vars via the platform instead.
const envFile = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

export const env = {
  PORT: Number(process.env.PORT ?? 4100),
  DATABASE_URL:
    process.env.DATABASE_URL ?? "postgres://tshirt:tshirt@localhost:5432/tshirt_central",
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-insecure-secret-change-me",
  // Dev-only fallback credentials for `db:seed` — override via env before any real deployment.
  DEFAULT_ADMIN_LOGIN: process.env.DEFAULT_ADMIN_LOGIN ?? "admin",
  DEFAULT_ADMIN_PASSWORD: process.env.DEFAULT_ADMIN_PASSWORD ?? "admin123",
  // ИИ-раздел (Этап 9), `uploadMode: "relay"` — base URL embedded in the QR
  // upload link (`GET /upload/:token`). Unlike point-server's own
  // `POST /ai/upload-session` (which can read `request.headers.host`), this
  // is minted over a Socket.IO event with no HTTP request to read a Host
  // header from, so it needs an explicit public URL.
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? "http://localhost:4100",
};
