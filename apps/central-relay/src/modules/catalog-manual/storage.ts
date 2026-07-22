import path from "node:path";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Separate from any point's own `data/catalog/` — this is the *central*
// master copy admins upload, independent of which/how many points exist.
const DATA_ROOT = path.resolve("data");
const CATALOG_MANUAL_DIR = path.join(DATA_ROOT, "catalog-manual");
const CATALOG_MANUAL_TMP_DIR = path.join(DATA_ROOT, "catalog-manual-tmp");

export async function ensureCatalogManualDir(): Promise<string> {
  await mkdir(CATALOG_MANUAL_DIR, { recursive: true });
  return CATALOG_MANUAL_DIR;
}

/** Buffers the raw upload to a scratch file before it's validated/hashed — `createManualDesign` moves it into permanent storage (or the route deletes it on rejection). */
export async function writeTempUploadFile(buffer: Buffer): Promise<string> {
  await mkdir(CATALOG_MANUAL_TMP_DIR, { recursive: true });
  const tempPath = path.join(CATALOG_MANUAL_TMP_DIR, `${randomUUID()}.png`);
  await writeFile(tempPath, buffer);
  return tempPath;
}

/** Best-effort cleanup for a temp upload that was rejected before `createManualDesign` could move it (bad format, duplicate hash, etc). */
export async function deleteTempUploadFile(tempFilePath: string): Promise<void> {
  await rm(tempFilePath, { force: true });
}

/** Moves a just-uploaded temp file into permanent storage under a fresh random name (PNG only, enforced by the route). */
export async function storeManualDesignFile(tempFilePath: string): Promise<string> {
  const dir = await ensureCatalogManualDir();
  const destination = path.join(dir, `${randomUUID()}.png`);
  await rename(tempFilePath, destination);
  return destination;
}

/** Best-effort delete — a missing file (already removed, or storage cleaned up out of band) is not an error. */
export async function deleteManualDesignFile(storagePath: string): Promise<void> {
  try {
    await rm(storagePath, { force: true });
  } catch {
    // fail-open — the DB row is the source of truth, not the file
  }
}
