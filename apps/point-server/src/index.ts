import { runMigrations } from "./db/migrate.js";
import { buildServer } from "./server.js";
import { connectToCentralRelay } from "./modules/sync/client.js";
import { ensureAllCategoriesStocked, startCacheFiller } from "./modules/catalog-scraper/job.js";
import { env } from "./env.js";

// Applies any pending migrations before anything else touches the DB, so a
// point never needs a manual `db:migrate` step after pulling new code —
// see docs/PLAN.md Этап 3 discussion. Safe on every boot: drizzle no-ops
// once a migration is already recorded as applied.
runMigrations();

const app = await buildServer();

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then(() => {
    // Started after the HTTP server is up, but never blocks kiosk/operator
    // traffic — see the fail-open note in `modules/sync/client.ts`.
    connectToCentralRelay(app.log);
    // Eagerly top up the gallery categories from Pinterest, in the
    // background — docs/PLAN.md Этап 3 "Наполнение и подгрузка".
    ensureAllCategoriesStocked(app.log);
    // Then keep slowly growing the on-disk cache (evenly across categories)
    // up to the operator's configured GB limit — docs/PLAN.md "кэш картинок
    // по ГБ". Independent of the eager fill above: this one paces itself
    // indefinitely instead of stopping at the gallery's minimum stock.
    startCacheFiller(app.log);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
