export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_PATH: process.env.DATABASE_PATH ?? "./data/point.db",
  // Outbound sync to central-relay (Stage 6) — all optional; when unset the
  // point simply runs offline-only, per the fail-open principle in PLAN.md.
  // Set these from the `syncToken`/`id` returned once by `POST /points` on central-relay.
  CENTRAL_RELAY_URL: process.env.CENTRAL_RELAY_URL,
  POINT_SYNC_ID: process.env.POINT_SYNC_ID,
  POINT_SYNC_TOKEN: process.env.POINT_SYNC_TOKEN,
};
