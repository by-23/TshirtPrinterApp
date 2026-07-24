import path from "node:path";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";

const DATA_ROOT = path.resolve("data");
export const ADS_VIDEOS_DIR = path.join(DATA_ROOT, "ads-videos");
const PUBLIC_ADS_PREFIX = "/files/ads-videos/";

const ALLOWED_MIME = new Set(["video/mp4", "video/webm", "video/ogg"]);
const ALLOWED_EXT = new Set([".mp4", ".webm", ".ogg"]);

export function publicAdsVideoUrl(filename: string): string {
  return `${PUBLIC_ADS_PREFIX}${filename}`;
}

export function isAllowedAdsVideo(mimetype: string, filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_MIME.has(mimetype) || ALLOWED_EXT.has(ext);
}

function sanitizeBaseName(originalName: string): string {
  const base = path.basename(originalName).replace(/[^a-zA-Z0-9._-]+/g, "_");
  return base.length > 0 ? base : "video.mp4";
}

function ensureVideoExt(name: string, mimetype: string): string {
  const ext = path.extname(name).toLowerCase();
  if (ALLOWED_EXT.has(ext)) return name;
  if (mimetype === "video/webm") return `${name}.webm`;
  if (mimetype === "video/ogg") return `${name}.ogg`;
  return `${name}.mp4`;
}

/** Streams an uploaded video into `data/ads-videos/`, returns the stored filename. */
export async function saveAdsVideoFile(
  stream: Readable,
  originalName: string,
  mimetype: string,
): Promise<string> {
  await mkdir(ADS_VIDEOS_DIR, { recursive: true });
  const safe = ensureVideoExt(sanitizeBaseName(originalName), mimetype);
  const filename = `${randomUUID()}-${safe}`;
  const dest = path.join(ADS_VIDEOS_DIR, filename);
  await pipeline(stream, createWriteStream(dest));
  return filename;
}

export async function deleteAdsVideoFile(filename: string): Promise<void> {
  // Guard against path traversal — only unlink files under ADS_VIDEOS_DIR.
  const resolved = path.resolve(ADS_VIDEOS_DIR, path.basename(filename));
  if (!resolved.startsWith(ADS_VIDEOS_DIR + path.sep) && resolved !== ADS_VIDEOS_DIR) {
    return;
  }
  try {
    await unlink(resolved);
  } catch {
    // Missing file is fine — DB row is the source of truth for cleanup.
  }
}

export function titleFromFilename(originalName: string): string {
  return path
    .basename(originalName)
    .replace(/\.(mp4|webm|ogg)$/i, "")
    .replace(/[_-]+/g, " ")
    .trim() || "Видео";
}
