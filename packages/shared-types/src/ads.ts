import { z } from "zod";

/**
 * Реклама-заставка (Этап 8) — ролик из `point-server`'s `ads_videos`, отдаётся
 * через `GET /ads/videos`. `fileUrl` — `/files/ads-videos/...`, резолвится на
 * клиенте через `resolveDesignImageUrl`.
 */
export const adsVideoSchema = z.object({
  id: z.number(),
  title: z.string(),
  fileUrl: z.string(),
  sortOrder: z.number(),
  enabled: z.boolean(),
  createdAt: z.string(),
});
export type AdsVideo = z.infer<typeof adsVideoSchema>;

/** Body of `PATCH /ads/videos/:id` — every field optional. */
export const updateAdsVideoInputSchema = z.object({
  title: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  enabled: z.boolean().optional(),
});
export type UpdateAdsVideoInput = z.infer<typeof updateAdsVideoInputSchema>;

/** Body of `PUT /ads/videos/reorder`. */
export const reorderAdsVideosInputSchema = z.object({
  ids: z.array(z.number().int()).min(1),
});
export type ReorderAdsVideosInput = z.infer<typeof reorderAdsVideosInputSchema>;
