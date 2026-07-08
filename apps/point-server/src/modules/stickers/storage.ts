import path from "node:path";
import { access, mkdir } from "node:fs/promises";
import sharp from "sharp";
import { downloadToFile } from "../catalog-scraper/sources/download.js";

// Own cache dir, separate from `catalog/` (scraped category designs) —
// stickers are picked one-off from a live Giphy search, not backfilled by
// the scraper job, so they get their own small on-disk cache instead.
const DATA_ROOT = path.resolve("data");
const STICKERS_DIR = path.join(DATA_ROOT, "stickers-cache");
const STICKERS_TMP_DIR = path.join(DATA_ROOT, "stickers-tmp");
const PUBLIC_STICKERS_PREFIX = "/files/stickers-cache/";

function cacheFilename(giphyId: string): string {
  return `giphy-${giphyId}.png`;
}

export function publicStickerUrl(giphyId: string): string {
  return `${PUBLIC_STICKERS_PREFIX}${cacheFilename(giphyId)}`;
}

export async function isStickerCached(giphyId: string): Promise<boolean> {
  try {
    await access(path.join(STICKERS_DIR, cacheFilename(giphyId)));
    return true;
  } catch {
    return false;
  }
}

/** Downloads `sourceUrl` (any Giphy rendition — often an animated GIF/WebP) and caches it as a still PNG keyed by `giphyId`, idempotent across repeat picks. */
export async function downloadAndCacheSticker(sourceUrl: string, giphyId: string): Promise<string> {
  if (await isStickerCached(giphyId)) {
    return publicStickerUrl(giphyId);
  }

  await mkdir(STICKERS_DIR, { recursive: true });
  await mkdir(STICKERS_TMP_DIR, { recursive: true });
  const rawExt = path.extname(new URL(sourceUrl).pathname) || ".gif";
  const rawPath = await downloadToFile(sourceUrl, STICKERS_TMP_DIR, `${giphyId}-${Date.now()}${rawExt}`);
  const pngPath = path.join(STICKERS_DIR, cacheFilename(giphyId));
  await sharp(rawPath).png().toFile(pngPath);
  return publicStickerUrl(giphyId);
}
