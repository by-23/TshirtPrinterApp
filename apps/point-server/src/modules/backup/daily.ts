import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FastifyBaseLogger } from "fastify";
import { sqlite } from "../../db/client.js";
import { env } from "../../env.js";
import { getDataDir } from "../../lib/dataDir.js";

/** Irreplaceable: order PNGs. Catalog/ads/stickers/AI are regenerable or non-critical. */
const INCLUDE_DIRS = ["orders"] as const;

/** Regenerable / scratch — skipped to keep backups smaller and safer. */
const SKIP_DIRS = new Set([
  "catalog-tmp",
  "stickers-tmp",
  "stickers-cache",
  "ai-models",
  "ai-style-previews",
  "backups",
]);

function todayStamp(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function msUntilNextLocalHour(hour: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function pruneOldBackups(backupRoot: string, keepDays: number, log: FastifyBaseLogger): void {
  if (!existsSync(backupRoot)) return;
  const dirs = readdirSync(backupRoot)
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .map((name) => ({ name, path: join(backupRoot, name), mtime: statSync(join(backupRoot, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const entry of dirs.slice(keepDays)) {
    try {
      rmSync(entry.path, { recursive: true, force: true });
      log.info({ path: entry.path }, "Pruned old daily backup");
    } catch (err) {
      log.warn({ err, path: entry.path }, "Failed to prune old backup");
    }
  }
}

/**
 * Consistent SQLite snapshot via better-sqlite3 online backup API (safe while
 * the point is serving traffic — no need to stop WAL writers).
 */
function backupSqlite(destDbPath: string): void {
  sqlite.backup(destDbPath);
}

function copyDataDirs(dataDir: string, destRoot: string, log: FastifyBaseLogger): void {
  for (const name of INCLUDE_DIRS) {
    if (SKIP_DIRS.has(name)) continue;
    const src = join(dataDir, name);
    if (!existsSync(src)) continue;
    const dest = join(destRoot, name);
    try {
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true, force: true });
    } catch (err) {
      log.warn({ err, src }, "Failed to copy data folder into backup (continuing)");
    }
  }
}

/**
 * Writes one daily snapshot under `BACKUP_DIR/YYYY-MM-DD/`.
 * Idempotent for the calendar day: if today's folder already has `DONE`, skip.
 * Fail-open: errors are logged, never thrown to callers — backups must not
 * take down the kiosk.
 */
export function runDailyBackup(log: FastifyBaseLogger): { ran: boolean; path?: string } {
  if (!env.BACKUP_ENABLED) {
    return { ran: false };
  }

  const backupRoot = resolve(env.BACKUP_DIR);
  const stamp = todayStamp();
  const dest = join(backupRoot, stamp);
  const doneMarker = join(dest, "DONE");

  try {
    mkdirSync(backupRoot, { recursive: true });

    if (existsSync(doneMarker)) {
      log.info({ path: dest }, "Daily backup already exists for today — skipping");
      pruneOldBackups(backupRoot, env.BACKUP_KEEP_DAYS, log);
      return { ran: false, path: dest };
    }

    mkdirSync(dest, { recursive: true });

    const dbDest = join(dest, "point.db");
    backupSqlite(dbDest);

    const dataDir = getDataDir();
    copyDataDirs(dataDir, dest, log);

    writeFileSync(
      doneMarker,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          dataDir,
          databasePath: env.DATABASE_PATH,
          keepDays: env.BACKUP_KEEP_DAYS,
        },
        null,
        2,
      ),
      "utf8",
    );

    pruneOldBackups(backupRoot, env.BACKUP_KEEP_DAYS, log);
    log.info({ path: dest }, "Daily backup completed");
    return { ran: true, path: dest };
  } catch (err) {
    log.error({ err, dest }, "Daily backup failed");
    return { ran: false };
  }
}

/**
 * Runs a backup on boot (if today's is missing), then schedules the next run
 * for ~03:00 local time every day. Never blocks HTTP startup.
 */
export function startDailyBackupScheduler(log: FastifyBaseLogger): void {
  if (!env.BACKUP_ENABLED) {
    log.info("Daily backups disabled (BACKUP_ENABLED=0)");
    return;
  }

  log.info(
    { backupDir: env.BACKUP_DIR, keepDays: env.BACKUP_KEEP_DAYS },
    "Daily backup scheduler starting",
  );

  // Defer first run slightly so listen() finishes and the kiosk isn't competing
  // for disk during the cold-start catalog fill.
  setTimeout(() => {
    runDailyBackup(log);
    scheduleNext();
  }, 15_000);

  function scheduleNext(): void {
    const delay = msUntilNextLocalHour(3);
    log.info({ delayMs: delay }, "Next daily backup scheduled (~03:00 local)");
    setTimeout(() => {
      runDailyBackup(log);
      scheduleNext();
    }, delay);
  }
}
