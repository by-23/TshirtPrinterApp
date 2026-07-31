import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyBaseLogger } from "fastify";
import sharp from "sharp";
import { dataPath } from "../../../lib/dataDir.js";
import { decodeDataUrl, encodeDataUrl } from "./imageIO.js";
import { stylizeLocally } from "./index.js";

/** Served by the existing `@fastify/static` mount at `/files/` (see `server.ts`) — same convention as order/design images. */
export const AI_STYLE_PREVIEWS_DIR = dataPath("ai-style-previews");

const SAMPLE_PORTRAIT_PATH = path.resolve("assets", "ai-sample-portrait.jpg");

let samplePortraitDataUrl: string | null = null;

/** Bundled generic (AI-generated) portrait used only to pre-render style preview thumbnails — never shown to real customers. */
export async function loadSamplePortrait(): Promise<string> {
  if (!samplePortraitDataUrl) {
    const buffer = await readFile(SAMPLE_PORTRAIT_PATH);
    samplePortraitDataUrl = encodeDataUrl(buffer, "image/jpeg");
  }
  return samplePortraitDataUrl;
}

export function previewPathForKey(key: string): string {
  return path.join(AI_STYLE_PREVIEWS_DIR, `${key}.jpg`);
}

/**
 * Renders and caches (overwriting any existing file) the preview for one
 * standard style, using the local offline engine.
 */
export async function regeneratePreview(key: string, engineKey: string): Promise<void> {
  mkdirSync(AI_STYLE_PREVIEWS_DIR, { recursive: true });
  const sample = await loadSamplePortrait();
  const styledDataUrl = await stylizeLocally(sample, engineKey);
  const { buffer } = decodeDataUrl(styledDataUrl);
  await writeFile(previewPathForKey(key), buffer);
}

/** Writes a JPEG preview from a stylized data URL (premium regenerate / upload). */
export async function savePreviewFromDataUrl(key: string, imageDataUrl: string): Promise<void> {
  mkdirSync(AI_STYLE_PREVIEWS_DIR, { recursive: true });
  const { buffer } = decodeDataUrl(imageDataUrl);
  const jpeg = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
  await writeFile(previewPathForKey(key), jpeg);
}

/** Writes a JPEG preview from an uploaded image buffer. */
export async function savePreviewFromBuffer(key: string, buffer: Buffer): Promise<void> {
  mkdirSync(AI_STYLE_PREVIEWS_DIR, { recursive: true });
  const jpeg = await sharp(buffer)
    .rotate()
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  await writeFile(previewPathForKey(key), jpeg);
}

/**
 * Fire-and-forget on boot — only standard styles with an engineKey get local
 * previews. Premium styles need an uploaded or API-generated preview.
 */
export async function ensureStylePreviews(
  styles: { key: string; engineKey: string; tier?: string }[],
  logger: FastifyBaseLogger,
): Promise<void> {
  mkdirSync(AI_STYLE_PREVIEWS_DIR, { recursive: true });
  for (const style of styles) {
    if (style.tier === "premium" || !style.engineKey) continue;
    if (existsSync(previewPathForKey(style.key))) continue;
    try {
      await regeneratePreview(style.key, style.engineKey);
      logger.info(`Rendered preview thumbnail for AI style "${style.key}"`);
    } catch (err) {
      logger.warn(
        err,
        `Failed to render preview thumbnail for AI style "${style.key}" — its card will show a blank preview until this succeeds`,
      );
    }
  }
}
