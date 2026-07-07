import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import type { PriceConfig } from "@tshirt/shared-types";

/**
 * Singleton (single row, id=1) cache of what central-relay last pushed down
 * over `sync:snapshot` (Stage 7) — name/status/uploadMode plus the effective
 * (global + point override) price config. Fail-open: if this table has no
 * row yet (point never connected to central-relay, or `.env` sync vars are
 * unset), `GET /point-config` reports `status: "open"` and `GET /pricing`
 * falls back to `DEFAULT_PRICE_CONFIG` — see `modules/sync/handlers.ts`.
 */
export const pointConfig = sqliteTable("point_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  status: text("status", { enum: ["open", "closed"] })
    .notNull()
    .default("closed"),
  uploadMode: text("upload_mode", { enum: ["relay", "wifi"] })
    .notNull()
    .default("relay"),
  priceConfigJson: text("price_config_json", { mode: "json" }).$type<PriceConfig>(),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const operators = sqliteTable("operators", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  login: text("login").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const designs = sqliteTable("designs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category", {
    enum: ["memes", "anime_movies", "games", "text", "custom", "ai_style"],
  }).notNull(),
  title: text("title").notNull(),
  imageUrl: text("image_url").notNull().default(""),
  isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
  // `{source}:{externalId}` (e.g. `pinterest:123`, `giphy:abcXYZ`) — set only
  // for designs pulled in by the catalog scraper (Этап 3). Used to dedupe
  // against items already downloaded for a category; null for manually-added
  // designs (admin panel / seed). The column is still named after Pinterest
  // (the original, only source) — kept as-is to avoid a pointless rename now
  // that it holds a namespaced key for any source.
  sourcePinId: text("source_pin_id").unique(),
  // Which scraper source found this design ("pinterest" | "giphy" | "cleanpng") —
  // null for manually-added designs. Informational only (status/debugging in
  // the operator panel); dedup itself relies on `sourcePinId` above.
  source: text("source"),
  // 256-bit average-hash (16x16 grayscale) of the image content, hex-encoded —
  // catches *visually* duplicate images that arrive under a different
  // `sourcePinId` (e.g. the same picture re-pinned on Pinterest under a new
  // pin id, or picked up by two different sources). Null for manually-added
  // designs or ones scraped before this column existed. Not `unique()` on
  // purpose: matching is by Hamming-distance threshold (near-duplicates),
  // not exact equality — see `catalog-scraper/phash.ts`.
  contentHash: text("content_hash"),
  // How many times a customer actually printed a t-shirt with this design
  // (incremented on successful order creation — see `POST /catalog/designs/:id/use`,
  // called from the kiosk editor's "Печать" flow). Powers the hearts badge on
  // gallery cards and the usage-based ranking for both the category page
  // (highest-use first) and the home page "Популярные принты" banner.
  useCount: integer("use_count").notNull().default(0),
  // Set from the operator's Designs → Галерея panel ("Изолировать"). Keeps
  // its original `category` — isolation is a separate filter, not a real
  // category — but is excluded from the kiosk gallery (and from the
  // operator's normal per-category browsing) while true, living only under
  // the panel's "Изолированные" filter until restored.
  isolated: integer("isolated", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Singleton (single row, id=1) of operator-tunable knobs for the Pinterest
 * catalog scraper (Этап 3) — edited from the "Дизайны" tab in the operator
 * panel. Lives on point-server only: central-relay has no pull-sync for
 * catalog config yet (Stage 7), see docs/PLAN.md.
 */
export const catalogScrapeConfig = sqliteTable("catalog_scrape_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  minResolutionEnabled: integer("min_resolution_enabled", { mode: "boolean" }).notNull().default(false),
  minResolutionPx: integer("min_resolution_px").notNull().default(1000),
  pageSize: integer("page_size").notNull().default(12),
  bufferSize: integer("buffer_size").notNull().default(12),
  requestDelayMs: integer("request_delay_ms").notNull().default(1500),
  maxRequestsPerHour: integer("max_requests_per_hour").notNull().default(60),
  // Extra sources run in parallel with Pinterest on every top-up (Этап 3,
  // "Несколько источников") — see `modules/catalog-scraper/sources/`.
  giphyEnabled: integer("giphy_enabled", { mode: "boolean" }).notNull().default(true),
  /** Operator-editable API key — overrides `GIPHY_API_KEY` from `.env` when set. */
  giphyApiKey: text("giphy_api_key"),
  // Best-effort: CleanPNG gates real downloads behind a Cloudflare JS
  // challenge a headless browser often can't clear — see `sources/cleanpngSource.ts`.
  cleanpngEnabled: integer("cleanpng_enabled", { mode: "boolean" }).notNull().default(true),
  // Background cache filler (docs/PLAN.md "кэш картинок по ГБ") — grows the
  // on-disk catalog slowly, evenly across the 3 gallery categories, up to
  // this total size. See `modules/catalog-scraper/job.ts` `startCacheFiller`.
  cacheLimitMb: integer("cache_limit_mb").notNull().default(1024),
  cacheFillEnabled: integer("cache_fill_enabled", { mode: "boolean" }).notNull().default(true),
  cacheFillBatchSize: integer("cache_fill_batch_size").notNull().default(6),
  cacheFillIntervalSec: integer("cache_fill_interval_sec").notNull().default(20),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * One row per gallery category — the search query tags the scraper tries in
 * order for that category (docs/PLAN.md Этап 3, "Исчерпание результатов
 * поиска"). Editable from the "Дизайны" tab; `tagsJson` is seeded from
 * `queryVariants.ts` defaults on first read.
 */
export const catalogScrapeQueryTags = sqliteTable("catalog_scrape_query_tags", {
  category: text("category", { enum: ["memes", "anime_movies", "games"] }).primaryKey(),
  tagsJson: text("tags_json").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/** One row per gallery category — tracks scraper progress/health (Этап 3). */
export const catalogScrapeState = sqliteTable("catalog_scrape_state", {
  category: text("category", { enum: ["memes", "anime_movies", "games"] }).primaryKey(),
  queryVariantIndex: integer("query_variant_index").notNull().default(0),
  status: text("status", { enum: ["idle", "running", "success", "error"] })
    .notNull()
    .default("idle"),
  lastRunAt: text("last_run_at"),
  lastError: text("last_error"),
  lastDownloadedCount: integer("last_downloaded_count").notNull().default(0),
  totalDownloaded: integer("total_downloaded").notNull().default(0),
});

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status", { enum: ["new", "accepted", "printing", "done", "cancelled"] })
    .notNull()
    .default("new"),
  garmentType: text("garment_type", { enum: ["tshirt", "hoodie"] }).notNull(),
  garmentColor: text("garment_color").notNull(),
  garmentSize: text("garment_size").notNull(),
  garmentFabric: text("garment_fabric").notNull(),
  side: text("side", { enum: ["front", "back"] }).notNull(),
  printSize: text("print_size", { enum: ["small", "medium", "large"] }).notNull(),
  price: real("price").notNull(),
  mockupImagePath: text("mockup_image_path"),
  designImagePath: text("design_image_path"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * ИИ-раздел (Этап 9) — style presets offered on the "Выберите стиль" screen.
 * Seeded lazily from `DEFAULT_AI_STYLES` on first `GET /ai/styles` (same
 * pattern as `catalogScrapeQueryTags` — see `modules/catalog-scraper/queryTags.ts`),
 * only when the table is empty — from then on this table (edited via the
 * "ИИ-стили" operator panel, see `modules/ai/routes.ts` admin routes) is the
 * source of truth, not `defaultStyles.ts`. `key` is what the kiosk sends
 * back in `POST /ai/stylize` and what names its cached preview thumbnail
 * (`data/ai-style-previews/{key}.jpg`).
 *
 * `promptTemplate` is used for the cloud path (Pollinations); `engineKey`
 * (`{kind}:{variant}`, e.g. `animegan:hayao`, `fast-neural-style:mosaic`,
 * `filter:noir`) picks the offline fallback engine — see `modules/ai/local/`.
 */
export const aiStyles = sqliteTable("ai_styles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  promptTemplate: text("prompt_template").notNull(),
  engineKey: text("engine_key").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
});

/**
 * Offline/retry queue for `sync:order-push` (Stage 7, docs/PLAN.md
 * "Офлайн-очередь с ретраями"). Every order create/status-change enqueues a
 * row here; `modules/sync/queue.ts` drains it whenever the central-relay
 * socket is connected and deletes a row once central acks it. Fail-open:
 * while offline, rows simply accumulate — nothing here blocks local order
 * flow (kiosk/operator) at all.
 */
export const syncQueue = sqliteTable("sync_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  payloadJson: text("payload_json", { mode: "json" }).notNull(),
  status: text("status", { enum: ["pending", "failed"] })
    .notNull()
    .default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
