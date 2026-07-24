import { z } from "zod";

export const designCategorySchema = z.enum([
  "memes",
  "anime_movies",
  "games",
  "text",
  "custom",
  "ai_style",
]);
export type DesignCategory = z.infer<typeof designCategorySchema>;

/** Categories the Pinterest catalog scraper (Этап 3) fills in — the ones with a gallery page. */
export const galleryCategorySchema = z.enum(["memes", "anime_movies", "games"]);
export type GalleryCategory = z.infer<typeof galleryCategorySchema>;

/** Which scraper source found a given design — `null` for manually-added ones (admin/seed). */
export const scraperSourceIdSchema = z.enum(["pinterest", "giphy", "cleanpng"]);
export type ScraperSourceId = z.infer<typeof scraperSourceIdSchema>;

export const designSchema = z.object({
  id: z.string(),
  category: designCategorySchema,
  title: z.string(),
  imageUrl: z.string(),
  isFeatured: z.boolean().default(false),
  /** How many completed print orders used this design — powers the hearts badge and popularity ranking. */
  useCount: z.number().int().nonnegative().default(0),
  /** True once an operator "isolates" this design from the Designs → Галерея panel — it keeps its
   * original `category`, but is excluded from the kiosk gallery and lives only in the panel's
   * dedicated "Изолированные" filter until restored. */
  isolated: z.boolean().default(false),
  /**
   * `"admin"` for designs synced down from the central admin panel's manual catalog upload
   * (see `catalogManualUpsertPayloadSchema`); a scraper id (`"pinterest"` etc.) for scraped
   * designs; `null`/absent for anything else. Powers the operator panel's read-only "Из
   * админки" badge and the gallery's admin-before-scraped sort tiebreak.
   */
  source: z.union([scraperSourceIdSchema, z.literal("admin")]).nullable().optional(),
});
export type Design = z.infer<typeof designSchema>;

export const createDesignSchema = z.object({
  category: designCategorySchema,
  title: z.string().min(1),
  imageUrl: z.string().default(""),
  isFeatured: z.boolean().default(false),
});
export type CreateDesignInput = z.infer<typeof createDesignSchema>;

export const updateDesignSchema = createDesignSchema.partial();
export type UpdateDesignInput = z.infer<typeof updateDesignSchema>;

/** Body of `PATCH /catalog/designs/:id/isolate` — point-server only (docs/PLAN.md, "изолировать картинку"). */
export const setDesignIsolatedSchema = z.object({ isolated: z.boolean() });
export type SetDesignIsolatedInput = z.infer<typeof setDesignIsolatedSchema>;

/** Paginated response shape for `GET /catalog/designs` when `offset`/`limit` are passed. */
export const designsPageSchema = z.object({
  items: z.array(designSchema),
  total: z.number().int().nonnegative(),
  /** True while the background Pinterest scraper is still topping up this category — the
   * gallery keeps showing the loading spinner card (instead of stopping) while this is true,
   * even if `items.length` has already caught up with `total`. */
  scraping: z.boolean().default(false),
});
export type DesignsPage = z.infer<typeof designsPageSchema>;

/** Default number of slides `GET /catalog/designs/popular` returns when `limit` is omitted. */
export const POPULAR_DESIGNS_DEFAULT_LIMIT = 15;

export const catalogScrapeConfigSchema = z.object({
  minResolutionEnabled: z.boolean(),
  minResolutionPx: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  bufferSize: z.number().int().positive(),
  requestDelayMs: z.number().int().nonnegative(),
  maxRequestsPerHour: z.number().int().positive(),
  /** Extra image sources run in parallel with Pinterest on every top-up (Этап 3, "Несколько источников"). */
  giphyEnabled: z.boolean(),
  /** Giphy Developers API key — editable from the operator panel; `.env` `GIPHY_API_KEY` is a fallback. */
  giphyApiKey: z.string().nullable(),
  /** Best-effort: gated behind a Cloudflare JS challenge that a headless browser often can't clear. */
  cleanpngEnabled: z.boolean(),
  /** Read-only: true once a Giphy API key is set (panel or `.env`) — lets the operator panel explain why
   * turning `giphyEnabled` on might still yield nothing. */
  giphyKeyConfigured: z.boolean(),
  /** Max total on-disk size (across all gallery categories combined) the background cache filler will grow the catalog to. */
  cacheLimitMb: z.number().int().positive(),
  /** Pause/resume the slow background cache filler without touching the limit itself. */
  cacheFillEnabled: z.boolean(),
  /** How many designs the filler downloads per category before pausing again — small = gentler on network/CPU. */
  cacheFillBatchSize: z.number().int().positive(),
  /** Pause between filler portions, in seconds — the "не торопясь" knob. */
  cacheFillIntervalSec: z.number().int().positive(),
  updatedAt: z.string(),
});
export type CatalogScrapeConfig = z.infer<typeof catalogScrapeConfigSchema>;

export const updateCatalogScrapeConfigSchema = catalogScrapeConfigSchema
  .omit({ updatedAt: true, giphyKeyConfigured: true })
  .partial();
export type UpdateCatalogScrapeConfigInput = z.infer<typeof updateCatalogScrapeConfigSchema>;

/** Result of `POST /catalog/scrape-config/giphy/test` — verifies the key against Giphy Stickers API. */
export const giphyApiKeyTestResultSchema = z.object({
  ok: z.boolean(),
  stickerCount: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
});
export type GiphyApiKeyTestResult = z.infer<typeof giphyApiKeyTestResultSchema>;

export const testGiphyApiKeyInputSchema = z.object({
  /** When omitted, uses the saved panel key or `.env` fallback. */
  apiKey: z.string().optional(),
});
export type TestGiphyApiKeyInput = z.infer<typeof testGiphyApiKeyInputSchema>;

/** Per-category slice of `CatalogCacheUsage` — on-disk size of already-downloaded designs. */
export const categoryCacheUsageSchema = z.object({
  category: galleryCategorySchema,
  count: z.number().int().nonnegative(),
  bytes: z.number().nonnegative(),
});
export type CategoryCacheUsage = z.infer<typeof categoryCacheUsageSchema>;

/**
 * Snapshot of the image cache's disk usage vs. its configured limit — powers
 * the "Обзор" tab of the operator's Designs panel (GB limit + progress bars).
 */
export const catalogCacheUsageSchema = z.object({
  totalBytes: z.number().nonnegative(),
  limitBytes: z.number().nonnegative(),
  categories: z.array(categoryCacheUsageSchema),
  /** Mirrors `CatalogScrapeConfig.cacheFillEnabled` — included here so the usage poll doubles as a config read. */
  fillEnabled: z.boolean(),
  /** True while the background filler (or an eager/manual top-up) is actively downloading right now. */
  filling: z.boolean(),
  updatedAt: z.string(),
});
export type CatalogCacheUsage = z.infer<typeof catalogCacheUsageSchema>;

/** Search query tags the scraper tries in order, editable per gallery category. */
export const categoryQueryTagsSchema = z.object({
  category: galleryCategorySchema,
  tags: z.array(z.string().min(1)),
  updatedAt: z.string(),
});
export type CategoryQueryTags = z.infer<typeof categoryQueryTagsSchema>;

export const updateCategoryQueryTagsSchema = z.object({
  tags: z.array(z.string().min(1)).min(1),
});
export type UpdateCategoryQueryTagsInput = z.infer<typeof updateCategoryQueryTagsSchema>;

export const catalogScrapeStatusSchema = z.object({
  category: galleryCategorySchema,
  status: z.enum(["idle", "running", "success", "error"]),
  lastRunAt: z.string().nullable(),
  lastError: z.string().nullable(),
  lastDownloadedCount: z.number().int().nonnegative(),
  totalDownloaded: z.number().int().nonnegative(),
});
export type CatalogScrapeStatus = z.infer<typeof catalogScrapeStatusSchema>;

// --- Admin-panel manual catalog upload → central-relay → point fan-out ---
// (docs/PLAN.md: admin uploads curated PNGs per gallery category from the
// central admin panel; central-relay stores the master copy and pushes a
// sync signal to every point, which downloads the file over plain HTTP and
// applies it into its own local `designs` table with `source: "admin"`.)

/** Socket.IO event names on the `/relay-socket` channel for the manual catalog fan-out. */
export const CATALOG_MANUAL_UPSERT_EVENT = "catalog:manual-upsert";
export const CATALOG_MANUAL_DELETE_EVENT = "catalog:manual-delete";
/** Fire-and-forget point → central ack (both the immediate attempt and any later background retry report through this same event). */
export const CATALOG_MANUAL_ACK_EVENT = "catalog:manual-ack";

/**
 * Pushed from central-relay to a point (room-broadcast, no ack expected —
 * see `CATALOG_MANUAL_ACK_EVENT`) whenever an admin creates or edits a
 * manual design. `fileUrl` is a path on the *central-relay* origin the
 * point fetches with its own `pointId`/`token` as `x-point-id`/`x-point-token`
 * headers (see `apps/point-server/src/modules/sync/manualCatalog.ts`).
 */
export const catalogManualUpsertPayloadSchema = z.object({
  id: z.string(),
  revision: z.number().int().nonnegative(),
  category: galleryCategorySchema,
  title: z.string(),
  contentHash: z.string(),
  fileUrl: z.string(),
});
export type CatalogManualUpsertPayload = z.infer<typeof catalogManualUpsertPayloadSchema>;

/** Pushed from central-relay to a point when an admin deletes a manual design. */
export const catalogManualDeletePayloadSchema = z.object({ id: z.string() });
export type CatalogManualDeletePayload = z.infer<typeof catalogManualDeletePayloadSchema>;

/** Point → central-relay report of whether a given manual design was applied locally. */
export const catalogManualAckSchema = z.object({
  id: z.string(),
  ok: z.boolean(),
  error: z.string().optional(),
});
export type CatalogManualAck = z.infer<typeof catalogManualAckSchema>;

export const createCatalogManualDesignSchema = z.object({
  category: galleryCategorySchema,
  title: z.string().min(1),
});
export type CreateCatalogManualDesignInput = z.infer<typeof createCatalogManualDesignSchema>;

export const updateCatalogManualDesignSchema = z
  .object({
    title: z.string().min(1).optional(),
    category: galleryCategorySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No fields to update" });
export type UpdateCatalogManualDesignInput = z.infer<typeof updateCatalogManualDesignSchema>;

/** Per-point sync state shown in the admin panel's "N/M точек применили" rollup for one manual design. */
export const catalogManualPointStatusSchema = z.object({
  pointId: z.string(),
  pointName: z.string(),
  isOnline: z.boolean(),
  status: z.enum(["pending", "applied", "error"]),
  lastError: z.string().nullable(),
  updatedAt: z.string(),
});
export type CatalogManualPointStatus = z.infer<typeof catalogManualPointStatusSchema>;

export const catalogManualDesignSchema = z.object({
  id: z.string(),
  category: galleryCategorySchema,
  title: z.string(),
  revision: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  appliedCount: z.number().int().nonnegative(),
  totalPoints: z.number().int().nonnegative(),
  points: z.array(catalogManualPointStatusSchema),
});
export type CatalogManualDesign = z.infer<typeof catalogManualDesignSchema>;
