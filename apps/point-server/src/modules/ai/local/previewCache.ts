import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyBaseLogger } from "fastify";
import { decodeDataUrl, encodeDataUrl } from "./imageIO.js";
import { stylizeLocally } from "./index.js";

/** Served by the existing `@fastify/static` mount at `/files/` (see `server.ts`) — same convention as order/design images. */
export const AI_STYLE_PREVIEWS_DIR = path.resolve("data", "ai-style-previews");

const SAMPLE_PORTRAIT_PATH = path.resolve("assets", "ai-sample-portrait.jpg");

let samplePortraitDataUrl: string | null = null;

/** Bundled generic (AI-generated) portrait used only to pre-render style preview thumbnails — never shown to real customers. */
async function loadSamplePortrait(): Promise<string> {
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
 * style, using the local offline engine — previews always come from the
 * local engine, even for styles whose *actual* stylize call prefers
 * Pollinations, so generating them never depends on internet/API tokens.
 */
export async function regeneratePreview(key: string, engineKey: string): Promise<void> {
  mkdirSync(AI_STYLE_PREVIEWS_DIR, { recursive: true });
  const sample = await loadSamplePortrait();
  const styledDataUrl = await stylizeLocally(sample, engineKey);
  const { buffer } = decodeDataUrl(styledDataUrl);
  await writeFile(previewPathForKey(key), buffer);
}

/**
 * Fire-and-forget on boot (see `index.ts`) — renders a preview for every
 * style that doesn't have one cached yet. Fails open per-style: a style
 * whose engine/model isn't ready yet just keeps showing no thumbnail until
 * a later boot (or an explicit "Обновить превью" in the admin panel)
 * succeeds.
 */
export async function ensureStylePreviews(
  styles: { key: string; engineKey: string }[],
  logger: FastifyBaseLogger,
): Promise<void> {
  mkdirSync(AI_STYLE_PREVIEWS_DIR, { recursive: true });
  for (const style of styles) {
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
