import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "../env.js";

/**
 * Absolute path to the point's writable data root.
 * Dev default: `./data` (cwd = apps/point-server), except Windows which uses
 * `%LOCALAPPDATA%\TshirtPrinter\data` so the kiosk and cashiers share one folder.
 * Packaged Windows: same LOCALAPPDATA path via DATA_DIR env.
 *
 * All runtime files live here: SQLite, catalog/, orders/, ads/, stickers/, AI weights.
 * `/files/*` is served from this directory.
 */
export function getDataDir(): string {
  return resolve(env.DATA_DIR);
}

const RUNTIME_SUBDIRS = [
  "catalog",
  "catalog-tmp",
  "orders",
  "order-sources",
  "dtf-print-jobs",
  "ads-videos",
  "stickers",
  "stickers-tmp",
  "stickers-cache",
  "ai-models",
  "ai-style-previews",
] as const;

/** Ensures the data root and standard subfolders exist (safe to call repeatedly). */
export function ensureDataDir(): string {
  const root = getDataDir();
  mkdirSync(root, { recursive: true });
  for (const sub of RUNTIME_SUBDIRS) {
    mkdirSync(resolve(root, sub), { recursive: true });
  }
  return root;
}

export function dataPath(...parts: string[]): string {
  return resolve(getDataDir(), ...parts);
}

export function dataDirExists(): boolean {
  return existsSync(getDataDir());
}
