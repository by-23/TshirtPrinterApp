import type { FastifyInstance } from "fastify";
import { selectStickerInputSchema, type StickerResult } from "@tshirt/shared-types";
import { getScrapeConfig, resolveGiphyApiKey } from "../catalog-scraper/config.js";
import { downloadAndCacheSticker } from "./storage.js";

const GIPHY_SEARCH_URL = "https://api.giphy.com/v1/stickers/search";
const GIPHY_TRENDING_URL = "https://api.giphy.com/v1/stickers/trending";
const RESULTS_LIMIT = 30;

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

interface GiphyListResponse {
  data: GiphySticker[];
}

// Prefer an actual still frame over the animated `original` — matches
// `catalog-scraper/sources/giphySource.ts`'s reasoning: sharp re-encodes
// whichever rendition is picked into a still PNG on select, and a
// purpose-made "still" avoids relying on sharp grabbing a sensible frame
// out of a GIF.
const RENDITION_PREFERENCE = ["480w_still", "fixed_width_still", "original_still", "downsized_still", "original"];

function pickRendition(images: Record<string, GiphyRendition>): GiphyRendition | null {
  for (const key of RENDITION_PREFERENCE) {
    const candidate = images[key];
    if (candidate?.url) return candidate;
  }
  return null;
}

async function fetchGiphyList(url: URL): Promise<StickerResult[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Giphy request failed: ${res.status}`);
  }
  const body = (await res.json()) as GiphyListResponse;
  const items: StickerResult[] = [];
  for (const sticker of body.data) {
    const rendition = pickRendition(sticker.images);
    if (!rendition) continue;
    items.push({
      giphyId: sticker.id,
      previewUrl: rendition.url,
      title: sticker.title?.trim() || `sticker-${sticker.id}`,
    });
  }
  return items;
}

/**
 * "Стикеры" editor tool (docs/PLAN.md) — thin proxy over the Giphy Stickers
 * API so the API key (`resolveGiphyApiKey`, shared with the catalog scraper's
 * Giphy source/operator panel setting) never reaches the kiosk browser.
 * Fail-open: no key configured means an empty result set + `keyConfigured:
 * false` instead of an error, same principle as the rest of point-server.
 */
export async function stickerRoutes(app: FastifyInstance) {
  app.get("/stickers/search", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const q = typeof query.q === "string" ? query.q.trim() : "";

    const config = await getScrapeConfig();
    const apiKey = resolveGiphyApiKey(config);
    if (!apiKey) return { items: [], keyConfigured: false };
    if (!q) return { items: [], keyConfigured: true };

    const url = new URL(GIPHY_SEARCH_URL);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("q", q);
    url.searchParams.set("limit", String(RESULTS_LIMIT));
    url.searchParams.set("rating", "g");

    try {
      const items = await fetchGiphyList(url);
      return { items, keyConfigured: true };
    } catch (err) {
      request.log.warn(err, "Giphy sticker search failed");
      return reply.status(502).send({ items: [], keyConfigured: true, error: "Giphy unavailable" });
    }
  });

  app.get("/stickers/trending", async (request, reply) => {
    const config = await getScrapeConfig();
    const apiKey = resolveGiphyApiKey(config);
    if (!apiKey) return { items: [], keyConfigured: false };

    const url = new URL(GIPHY_TRENDING_URL);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("limit", String(RESULTS_LIMIT));
    url.searchParams.set("rating", "g");

    try {
      const items = await fetchGiphyList(url);
      return { items, keyConfigured: true };
    } catch (err) {
      request.log.warn(err, "Giphy trending stickers failed");
      return reply.status(502).send({ items: [], keyConfigured: true, error: "Giphy unavailable" });
    }
  });

  // Only the sticker the customer actually taps gets downloaded + cached as
  // a PNG (see `storage.ts`) — search/trending results above link straight
  // to Giphy's own CDN, so browsing never touches disk.
  app.post("/stickers/select", async (request, reply) => {
    const parsed = selectStickerInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    try {
      const url = await downloadAndCacheSticker(parsed.data.previewUrl, parsed.data.giphyId);
      return { url };
    } catch (err) {
      request.log.error(err, "Failed to cache selected sticker");
      return reply.status(500).send({ error: "Failed to download sticker" });
    }
  });
}
