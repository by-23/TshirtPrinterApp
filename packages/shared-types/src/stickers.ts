import { z } from "zod";

/**
 * Editor "Стикеры" tool (docs/PLAN.md) — live Giphy Stickers search, proxied
 * through point-server so the API key never reaches the kiosk browser.
 * Search/trending results link straight to Giphy's own CDN (`previewUrl`)
 * for the picker grid; only the sticker the customer actually taps gets
 * downloaded + cached as a PNG on the point (see `POST /stickers/select`).
 */
export const stickerResultSchema = z.object({
  giphyId: z.string(),
  previewUrl: z.string(),
  title: z.string(),
});
export type StickerResult = z.infer<typeof stickerResultSchema>;

export const stickerSearchResponseSchema = z.object({
  items: z.array(stickerResultSchema),
  /** `false` when no Giphy API key is configured anywhere (panel or `.env`) — lets the UI show a clear message instead of a silent empty grid. */
  keyConfigured: z.boolean(),
});
export type StickerSearchResponse = z.infer<typeof stickerSearchResponseSchema>;

export const selectStickerInputSchema = z.object({
  giphyId: z.string().min(1),
  previewUrl: z.string().min(1),
});
export type SelectStickerInput = z.infer<typeof selectStickerInputSchema>;

export const selectStickerResponseSchema = z.object({
  url: z.string(),
});
export type SelectStickerResponse = z.infer<typeof selectStickerResponseSchema>;
