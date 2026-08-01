import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  real,
  integer,
  jsonb,
  pgEnum,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { GarmentAvailabilityConfig, PartialPriceConfig, PriceConfig } from "@tshirt/shared-types";

export const pointStatusEnum = pgEnum("point_status", ["open", "closed"]);
export const uploadModeEnum = pgEnum("upload_mode", ["relay", "wifi"]);
export const orderStatusEnum = pgEnum("order_status", [
  "new",
  "accepted",
  "printing",
  "done",
  "cancelled",
]);
export const uploadSessionStatusEnum = pgEnum("upload_session_status", [
  "pending",
  "uploaded",
  "expired",
]);

export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  login: text("login").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const points = pgTable("points", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: pointStatusEnum("status").notNull().default("closed"),
  uploadMode: uploadModeEnum("upload_mode").notNull().default("relay"),
  operatorLogin: text("operator_login").notNull(),
  operatorPasswordHash: text("operator_password_hash").notNull(),
  // Shared secret the point-server presents on its outbound Socket.IO handshake (see realtime/socket.ts).
  syncToken: text("sync_token").notNull().unique(),
  isOnline: boolean("is_online").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Aggregated order records pushed up from points for the stats dashboard
 * (Stage 7, `sync:order-push` — see `realtime/socket.ts`). Seeded with demo
 * rows when there are no points yet, so `StatsPage` isn't blank before any
 * point has synced; real pushes upsert on `(pointId, pointOrderId)` so
 * retried/queued pushes from a point's offline `sync_queue` never duplicate.
 */
export const ordersArchive = pgTable(
  "orders_archive",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pointId: uuid("point_id")
      .notNull()
      .references(() => points.id, { onDelete: "cascade" }),
    /** The point's local SQLite `orders.id` — `null` for legacy/demo-seeded rows. */
    pointOrderId: integer("point_order_id"),
    status: orderStatusEnum("status").notNull(),
    garmentType: text("garment_type").notNull(),
    printSize: text("print_size").notNull(),
    price: real("price").notNull(),
    /** Physical print attempts synced from the point (first + reprints). */
    printCount: integer("print_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("orders_archive_point_order_unique").on(table.pointId, table.pointOrderId)],
);

/** Single-row table (fixed id `"global"`) holding the global price config edited on `PricingPage`. */
export const globalPriceConfig = pgTable("global_price_config", {
  id: text("id").primaryKey().default("global"),
  config: jsonb("config").notNull().$type<PriceConfig>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One optional partial override per point; absence of a row means "inherit global config entirely". */
export const pointPriceOverrides = pgTable("point_price_overrides", {
  pointId: uuid("point_id")
    .primaryKey()
    .references(() => points.id, { onDelete: "cascade" }),
  config: jsonb("config").notNull().$type<PartialPriceConfig>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Full garment-availability override per point. Presence of a row means the
 * central admin owns materials for that point (locks the local operator panel).
 */
export const pointGarmentAvailabilityOverrides = pgTable("point_garment_availability_overrides", {
  pointId: uuid("point_id")
    .primaryKey()
    .references(() => points.id, { onDelete: "cascade" }),
  availability: jsonb("availability").notNull().$type<GarmentAvailabilityConfig>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * ИИ-раздел (Этап 9), `uploadMode: "relay"` — one-shot QR photo-upload
 * session minted over `/relay-socket` (`UPLOAD_CREATE_SESSION_EVENT`, see
 * `realtime/socket.ts`) when a point can't accept the upload directly
 * (kiosk and phone aren't on the same local network). The row's own `id` is
 * the token embedded in the QR's `uploadUrl` (`GET/POST /upload/:token`,
 * see `modules/upload-relay/routes.ts`); no separate token column needed.
 * `expiresAt` mirrors the 15-minute countdown shown on the kiosk.
 */
export const uploadSessions = pgTable("upload_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  pointId: uuid("point_id")
    .notNull()
    .references(() => points.id, { onDelete: "cascade" }),
  status: uploadSessionStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const catalogManualCategoryEnum = pgEnum("catalog_manual_category", ["memes", "anime_movies", "games"]);
export const catalogManualPointStatusEnum = pgEnum("catalog_manual_point_status", [
  "pending",
  "applied",
  "error",
]);

/**
 * Admin panel's "Каталог" tab (manual PNG uploads per gallery category) —
 * the central master copy fanned out to every point's own `designs` table
 * (`source: "admin"`). `revision` is bumped on every edit (title/category)
 * so `realtime/socket.ts`'s reconnect catch-up knows which points are still
 * behind; `deletedAt` is a tombstone (never hard-deleted) so a point that
 * was offline when an admin deleted a design still learns about it once it
 * reconnects. Only the 3 gallery categories are eligible — see grill-me
 * discussion in docs/PLAN.md: `text`/`custom`/`ai_style` have no designs
 * grid on the kiosk to upload into.
 */
export const catalogManualDesigns = pgTable("catalog_manual_designs", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: catalogManualCategoryEnum("category").notNull(),
  title: text("title").notNull(),
  /** 64-char hex perceptual hash of the PNG — rejects re-uploading a near-duplicate into the same category. */
  contentHash: text("content_hash").notNull(),
  /** Absolute path to the stored PNG on this central-relay host's disk (`data/catalog-manual/`). */
  storagePath: text("storage_path").notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/**
 * One row per `(point, manual design)` — tracks whether that point has
 * caught up to the design's current `revision` (or to its deletion).
 * Seeded as `pending` for every existing point when a design is created,
 * and for every design when a new point is created (see
 * `modules/catalog-manual/service.ts`). Read by the admin panel's "N/M
 * точек применили" rollup and by `realtime/socket.ts`'s reconnect catch-up.
 */
export const catalogManualPointState = pgTable(
  "catalog_manual_point_state",
  {
    pointId: uuid("point_id")
      .notNull()
      .references(() => points.id, { onDelete: "cascade" }),
    designId: uuid("design_id")
      .notNull()
      .references(() => catalogManualDesigns.id, { onDelete: "cascade" }),
    appliedRevision: integer("applied_revision").notNull().default(0),
    status: catalogManualPointStatusEnum("status").notNull().default("pending"),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.pointId, table.designId] })],
);

export const managedFontKindEnum = pgEnum("managed_font_kind", ["system", "local", "google", "custom"]);
export const managedFontFormatEnum = pgEnum("managed_font_format", ["truetype", "opentype", "woff", "woff2"]);

/**
 * Admin-managed editor fonts (built-in + custom uploads). Built-ins use
 * stable string ids (`pt-sans-narrow`); custom rows use UUIDs. Synced to
 * points via `sync:snapshot.fonts` — custom files are downloaded from
 * `GET /fonts/:id/file` with point credentials.
 */
export const managedFonts = pgTable("managed_fonts", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  family: text("family").notNull(),
  kind: managedFontKindEnum("kind").notNull(),
  googleFamily: text("google_family"),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  /** Absolute path on this host (`data/fonts/`) — only for `kind: "custom"`. */
  storagePath: text("storage_path"),
  format: managedFontFormatEnum("format"),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
