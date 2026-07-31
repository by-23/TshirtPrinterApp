import path from "node:path";
import { mkdir, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import type { GalleryCategory } from "@tshirt/shared-types";
import { dataPath } from "../../lib/dataDir.js";

// Same DATA_DIR root the rest of point-server uses (served at `/files/` —
// see `server.ts`), so downloaded pins survive restarts and are reachable
// by the kiosk without a separate static route.
const CATALOG_DIR = dataPath("catalog");
const CATALOG_TMP_DIR = dataPath("catalog-tmp");
const PUBLIC_CATALOG_PREFIX = "/files/catalog/";

function categoryStorageDir(category: GalleryCategory): string {
  return path.join(CATALOG_DIR, category);
}

// Manual (admin-panel) designs live in a `manual/` subdirectory of each
// category — `readdir` in `getCategoryStorageStats` below is non-recursive,
// so files in here are invisible to the scraper's "ГБ кэша" accounting on
// purpose (see `modules/sync/manualCatalog.ts` / docs/PLAN.md grill-me:
// admin uploads shouldn't eat into the scraper's own cache budget).
function manualCategoryStorageDir(category: GalleryCategory): string {
  return path.join(categoryStorageDir(category), "manual");
}

export function manualImageFilePath(category: GalleryCategory, centralDesignId: string): string {
  return path.join(manualCategoryStorageDir(category), `${centralDesignId}.png`);
}

export function publicManualImageUrl(category: GalleryCategory, centralDesignId: string): string {
  return `${PUBLIC_CATALOG_PREFIX}${category}/manual/${centralDesignId}.png`;
}

/** Writes (or overwrites) a manual design's PNG at its category's path — creates the `manual/` subdirectory on first use. */
export async function writeManualImageFile(
  category: GalleryCategory,
  centralDesignId: string,
  data: Buffer,
): Promise<string> {
  const dir = manualCategoryStorageDir(category);
  await mkdir(dir, { recursive: true });
  const destination = manualImageFilePath(category, centralDesignId);
  await writeFile(destination, data);
  return destination;
}


export async function ensureCatalogDirs(
  category: GalleryCategory,
): Promise<{ tempDir: string; storageDir: string }> {
  const storageDir = categoryStorageDir(category);
  const tempDir = path.join(CATALOG_TMP_DIR, `${category}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(storageDir, { recursive: true });
  await mkdir(tempDir, { recursive: true });
  return { tempDir, storageDir };
}

export async function moveToStorage(filePath: string, storageDir: string): Promise<string> {
  const filename = path.basename(filePath);
  const destination = path.join(storageDir, filename);
  await rename(filePath, destination);
  return destination;
}

export function publicImageUrl(category: GalleryCategory, filename: string): string {
  return `${PUBLIC_CATALOG_PREFIX}${category}/${filename}`;
}

/**
 * On-disk footprint of a category's downloaded designs — powers the "ГБ
 * кэша" usage panel (docs/PLAN.md "кэш картинок по ГБ"). Best-effort: a
 * missing directory (nothing downloaded yet) or a file that vanishes
 * mid-scan just contributes 0, never throws.
 */
export async function getCategoryStorageStats(category: GalleryCategory): Promise<{ count: number; bytes: number }> {
  const dir = categoryStorageDir(category);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return { count: 0, bytes: 0 };
  }

  let count = 0;
  let bytes = 0;
  for (const entry of entries) {
    try {
      const info = await stat(path.join(dir, entry));
      if (info.isFile()) {
        count += 1;
        bytes += info.size;
      }
    } catch {
      // Removed concurrently (e.g. a delete racing this scan) — just skip it.
    }
  }
  return { count, bytes };
}

/**
 * Deletes the on-disk file behind a design's `imageUrl`, so removing a
 * design from the operator's "Галерея" tab actually frees the reported
 * cache usage instead of just hiding the DB row. Best-effort/fail-open —
 * matches the rest of this module — and only ever touches paths under our
 * own `catalog/` storage dir, never arbitrary `imageUrl` values.
 */
export async function deleteStoredImageFile(imageUrl: string): Promise<void> {
  if (!imageUrl.startsWith(PUBLIC_CATALOG_PREFIX)) return;
  const relative = imageUrl.slice(PUBLIC_CATALOG_PREFIX.length);
  const filePath = path.resolve(CATALOG_DIR, relative);
  if (filePath !== CATALOG_DIR && !filePath.startsWith(CATALOG_DIR + path.sep)) return;
  try {
    await unlink(filePath);
  } catch {
    // Best-effort — file may already be gone.
  }
}

// On Windows, sharp/libvips can briefly hold the file handle open after
// `probeImage` resolves, so an immediate `unlink` sometimes fails with
// EBUSY. It's just a discarded temp file either way — `cleanupTempDir`
// wipes the whole directory once the run ends, so a failed delete here is
// harmless and must never abort the scrape run over it.
async function safeRemove(filePath: string): Promise<void> {
  try {
    await rm(filePath, { force: true });
  } catch {
    // Best-effort — see comment above.
  }
}

/** Deletes a downloaded pin (image + its `--caption json` sidecar) that we decided not to keep. */
export async function discardTempFile(filePath: string): Promise<void> {
  await safeRemove(filePath);
  await safeRemove(`${filePath}.json`);
}

export async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await rm(tempDir, { recursive: true, force: true });
  } catch {
    // Best-effort — a leftover temp dir/file (e.g. Windows EBUSY on a
    // just-read image) must never turn an otherwise-successful scrape run
    // into a reported failure.
  }
}
