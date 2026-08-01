import { runMigrations } from "./db/migrate.js";
import { buildServer } from "./server.js";
import { connectToCentralRelay } from "./modules/sync/client.js";
import { drainSyncQueue } from "./modules/sync/queue.js";
import { drainManualCatalogQueue } from "./modules/sync/manualCatalog.js";
import { ensureAllCategoriesStocked, startCacheFiller, GALLERY_CATEGORIES } from "./modules/catalog-scraper/job.js";
import { clearInterruptedRuns } from "./modules/catalog-scraper/state.js";
import { ensurePortAvailable } from "./lib/ensurePort.js";
import { ensureDataDir } from "./lib/dataDir.js";
import { env } from "./env.js";
import { ensureAiModelsDownloaded } from "./modules/ai/local/downloadModels.js";
import { ensureStylePreviews } from "./modules/ai/local/previewCache.js";
import { getAllStylesForPreviewRender } from "./modules/ai/styles.js";
import { repairOrderImagePaths } from "./modules/orders/repairImagePaths.js";
import { startDailyBackupScheduler } from "./modules/backup/daily.js";
import { ensureLocalBuiltinFonts } from "./modules/fonts/service.js";
import { backfillCatalogThumbs } from "./modules/catalog-scraper/thumbs.js";

/** Safety-net interval for `sync_queue` retries — connect/order-create already nudge a drain, this just catches anything left behind after a failed attempt. */
const SYNC_QUEUE_DRAIN_INTERVAL_MS = 30_000;

// Create DATA_DIR (+ catalog/orders/…) before SQLite or scrapers touch disk.
ensureDataDir();

// Applies any pending migrations before anything else touches the DB, so a
// point never needs a manual `db:migrate` step after pulling new code —
// see docs/PLAN.md Этап 3 discussion. Safe on every boot: drizzle no-ops
// once a migration is already recorded as applied.
runMigrations();
void ensureLocalBuiltinFonts();

const app = await buildServer();
void repairOrderImagePaths(app.log);// Dev restarts (tsx watch reloads, crashed terminals, killed processes) can
// leave port `env.PORT` either still bound by a stale copy of this same
// process or held by something else entirely. Both used to surface as a
// raw EADDRINUSE crash — or worse, no crash at all on *this* side while the
// kiosk app just failed every order with a generic "can't reach the point
// server" toast. Resolve/report that explicitly before even trying to bind.
const portGuard = await ensurePortAvailable(env.PORT);
switch (portGuard.action) {
  case "already-healthy":
    app.log.warn(portGuard.message);
    process.exit(0);
    break;
  case "killed-stale":
    app.log.warn(portGuard.message);
    break;
  case "occupied-by-other":
    app.log.error(portGuard.message);
    process.exit(1);
    break;
  case "free":
    break;
}

// Ensures the port is actually released on every restart/shutdown — without
// this, Node's default SIGTERM/SIGINT handling can leave the listening
// socket (and open socket.io connections) lingering just long enough for
// the *next* `tsx watch` reload to hit EADDRINUSE, which is what the guard
// above exists to recover from in the first place.
let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.warn(`Received ${signal}, closing point-server gracefully…`);
  try {
    await app.close();
  } finally {
    process.exit(0);
  }
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then(() => {
    // Started after the HTTP server is up, but never blocks kiosk/operator
    // traffic — see the fail-open note in `modules/sync/client.ts`.
    const syncSocket = connectToCentralRelay(app.log);
    if (syncSocket) {
      setInterval(() => {
        if (syncSocket.connected) {
          void drainSyncQueue(syncSocket, app.log);
          void drainManualCatalogQueue(syncSocket, app.log);
        }
      }, SYNC_QUEUE_DRAIN_INTERVAL_MS);
    }
    // Eagerly top up the gallery categories from Pinterest, in the
    // background — docs/PLAN.md Этап 3 "Наполнение и подгрузка".
    // Drop any `running` flags left by a killed previous process first,
    // otherwise every top-up no-ops for up to 10 minutes.
    void clearInterruptedRuns(GALLERY_CATEGORIES).then(() => {
      ensureAllCategoriesStocked(app.log);
      // Then keep slowly growing the on-disk cache (evenly across categories)
      // up to the operator's configured GB limit — docs/PLAN.md "кэш картинок
      // по ГБ". Independent of the eager fill above: this one paces itself
      // indefinitely instead of stopping at the gallery's minimum stock.
      startCacheFiller(app.log);
    });
    // Hybrid AI stylization (Pollinations + local fallback) — downloads any
    // missing .onnx weights, then pre-renders every style's preview
    // thumbnail from the local engine, so the "Выберите стиль" screen never
    // depends on internet just to show its cards. Both are best-effort and
    // never block kiosk/operator traffic — see modules/ai/local/.
    void ensureAiModelsDownloaded(app.log).then(async () => {
      const styles = await getAllStylesForPreviewRender();
      await ensureStylePreviews(styles, app.log);
    });
    // Local durability net — SQLite + orders/ only (essentials), once per day.
    // Fail-open; keep last N days under BACKUP_DIR.
    startDailyBackupScheduler(app.log);
    // Half-size gallery thumbs for existing catalog images (LAN Android).
    void backfillCatalogThumbs().then((stats) => {
      app.log.info(`Catalog thumbs backfill: scanned=${stats.scanned} written=${stats.written}`);
    });
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
