import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client.js";

// Resolved from this file's own location (not `cwd`) so it works both for
// `tsx src/db/migrate.ts` (run from apps/point-server) and for
// `node dist/index.js` started from an arbitrary working directory —
// `dist/db/migrate.js` and `src/db/migrate.ts` are both exactly two levels
// under apps/point-server, so `../../drizzle` resolves correctly either way.
const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), "../../drizzle");

/**
 * Applies any pending SQL migrations in `drizzle/` to the point's SQLite
 * file. Drizzle tracks already-applied migrations in its own
 * `__drizzle_migrations` table, so this is a no-op once caught up — safe to
 * call on every server boot (see `index.ts`), not just via `db:migrate`.
 */
export function runMigrations(): void {
  migrate(db, { migrationsFolder });
}

// Also runnable directly as a standalone script (`npm run db:migrate`) for
// ops that want to apply migrations without starting the server.
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  runMigrations();
  // eslint-disable-next-line no-console
  console.log("Migrations applied");
}
