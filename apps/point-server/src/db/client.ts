import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { Database as BetterSqliteDatabase } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { env } from "../env.js";

const dir = dirname(env.DATABASE_PATH);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

const sqlite: BetterSqliteDatabase = new Database(env.DATABASE_PATH);
sqlite.pragma("journal_mode = WAL");

/** Raw better-sqlite3 handle — used for online `.backup()` snapshots. */
export { sqlite };

export const db = drizzle(sqlite, { schema });
