import path from "node:path";
import sharp from "sharp";
import { downloadToFile } from "./download.js";
import type { ScraperSource, SourceCandidate } from "./types.js";

const GIPHY_SEARCH_URL = "https://api.giphy.com/v1/stickers/search";

interface GiphyRendition {
  url: string;
  width?: string;
  height?: string;
}

interface GiphySticker {
  id: string;
  title?: string;
  images: Record<string, GiphyRendition>;
}

interface GiphySearchResponse {
  data: GiphySticker[];
}

// Even GIPHY's "still" renditions are typically single-frame GIF/WebP, not
// raw PNG — `sharp(...).png()` below re-encodes whatever we get into a real
// PNG (grabbing just the first frame for an animated source), so any of
// these formats works. Prefer an actual still over the animated `original`
// so we're not relying on sharp picking a sensible frame out of a GIF.
const RENDITION_PREFERENCE = ["480w_still", "original_still", "fixed_width_still", "downsized_still", "original"];

function pickRendition(images: Record<string, GiphyRendition>): GiphyRendition | null {
  for (const key of RENDITION_PREFERENCE) {
    const candidate = images[key];
    if (candidate?.url) return candidate;
  }
  return null;
}

/**
 * Official, free (API-key-gated) JSON API — no browser, no rate-limit
 * roulette like Pinterest scraping. Stickers are the closest match GIPHY has
 * to "meme/anime/game png" (many are transparent cut-outs already).
 * Silently contributes nothing if no API key is configured — see
 * `config.resolveGiphyApiKey` and the operator panel's "Настройки автозаполнения".
 */
export const giphySource: ScraperSource = {
  id: "giphy",
  label: "Giphy Stickers",
  async search({ query, outputDir, limit, minResolutionPx, giphyApiKey }) {
    if (!giphyApiKey) return [];

    const url = new URL(GIPHY_SEARCH_URL);
    url.searchParams.set("api_key", giphyApiKey);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 50)));
    url.searchParams.set("rating", "g");

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Giphy search failed: ${res.status}`);
    }
    const body = (await res.json()) as GiphySearchResponse;

    const candidates: SourceCandidate[] = [];
    for (const sticker of body.data) {
      const rendition = pickRendition(sticker.images);
      if (!rendition) continue;
      if (minResolutionPx) {
        const width = Number(rendition.width ?? 0);
        const height = Number(rendition.height ?? 0);
        if (width < minResolutionPx || height < minResolutionPx) continue;
      }

      try {
        const rawExt = path.extname(new URL(rendition.url).pathname) || ".gif";
        const rawPath = await downloadToFile(rendition.url, outputDir, `giphy-${sticker.id}${rawExt}`);
        const pngPath = path.join(outputDir, `giphy-${sticker.id}.png`);
        await sharp(rawPath).png().toFile(pngPath);
        candidates.push({
          externalId: sticker.id,
          filePath: pngPath,
          alt: sticker.title?.trim() || `giphy-${sticker.id}`,
        });
      } catch {
        // One flaky sticker (bad download, sharp choking on a corrupt frame)
        // must never abort the whole source — skip it (fail-open).
      }
    }
    return candidates;
  },
};
