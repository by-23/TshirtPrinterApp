import { pgTable, uuid, text, boolean, timestamp, real, integer, jsonb, pgEnum, unique } from "drizzle-orm/pg-core";
import type { PartialPriceConfig, PriceConfig } from "@tshirt/shared-types";

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
