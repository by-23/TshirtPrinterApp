import path from "node:path";
import { access, readdir, stat, writeFile } from "node:fs/promises";
import sharp from "sharp";
import type { GalleryCategory } from "@tshirt/shared-types";
import { dataPath } from "../../lib/dataDir.js";

const CATALOG_DIR = dataPath("catalog");
const PUBLIC_CATALOG_PREFIX = "/files/catalog/";
const THUMB_SUFFIX = ".thumb.webp";
/** Half linear size ≈ ¼ pixels — first careful step for LAN Android gallery. */
const THUMB_SCALE = 0.5;
const THUMB_QUALITY = 78;

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function isThumbName(name: string): boolean {
  return name.endsWith(THUMB_SUFFIX);
}

/** Absolute path for a sibling half-size WebP next to a catalog image. */
export function thumbPathForImage(imagePath: string): string {
  return `${imagePath}${THUMB_SUFFIX}`;
}

/**
 * Public URL for gallery/list previews. Falls back to the original path if the
 * client cannot know whether a thumb exists — browsers 404 then need onError;
 * prefer probing disk when generating, and client onError → full image.
 */
export function publicThumbUrlFromImageUrl(imageUrl: string): string | null {
  if (!imageUrl.startsWith(PUBLIC_CATALOG_PREFIX)) return null;
  if (imageUrl.endsWith(THUMB_SUFFIX)) return imageUrl;
  return `${imageUrl}${THUMB_SUFFIX}`;
}

export async function ensureThumbForImage(imagePath: string): Promise<string | null> {
  if (isThumbName(path.basename(imagePath))) return null;
  const ext = path.extname(imagePath).toLowerCase();
  if (!IMAGE_EXT.has(ext)) return null;

  const thumbPath = thumbPathForImage(imagePath);
  try {
    await access(thumbPath);
    return thumbPath;
  } catch {
    // create below
  }

  try {
    const meta = await sharp(imagePath).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width < 2 || height < 2) return null;

    const targetW = Math.max(1, Math.round(width * THUMB_SCALE));
    const targetH = Math.max(1, Math.round(height * THUMB_SCALE));
    const buffer = await sharp(imagePath)
      .resize(targetW, targetH, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer();
    await writeFile(thumbPath, buffer);
    return thumbPath;
  } catch {
    return null;
  }
}

/** After scrape/manual write — best-effort half-size sibling. */
export async function writeThumbBeside(storedImagePath: string): Promise<void> {
  await ensureThumbForImage(storedImagePath);
}

/** One-shot / startup backfill for existing catalog files. */
export async function backfillCatalogThumbs(): Promise<{ scanned: number; written: number }> {
  let scanned = 0;
  let written = 0;

  async function walk(dir: string) {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      let info;
      try {
        info = await stat(full);
      } catch {
        continue;
      }
      if (info.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!info.isFile() || isThumbName(entry)) continue;
      const ext = path.extname(entry).toLowerCase();
      if (!IMAGE_EXT.has(ext)) continue;
      scanned += 1;
      const before = thumbPathForImage(full);
      let existed = true;
      try {
        await access(before);
      } catch {
        existed = false;
      }
      const result = await ensureThumbForImage(full);
      if (result && !existed) written += 1;
    }
  }

  await walk(CATALOG_DIR);
  return { scanned, written };
}

export function catalogThumbRelativeUrl(category: GalleryCategory, filename: string): string {
  return `${PUBLIC_CATALOG_PREFIX}${category}/${filename}${THUMB_SUFFIX}`;
}
