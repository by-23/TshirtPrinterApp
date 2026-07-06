import { pgTable, uuid, text, boolean, timestamp, real, jsonb, pgEnum } from "drizzle-orm/pg-core";
import type { PartialPriceConfig, PriceConfig } from "@tshirt/shared-types";

export const pointStatusEnum = pgEnum("point_status", ["open", "closed"]);
export const uploadModeEnum = pgEnum("upload_mode", ["relay", "wifi"]);
export const designCategoryEnum = pgEnum("design_category", [
  "memes",
  "anime_movies",
  "games",
  "text",
  "custom",
  "ai_style",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "new",
  "accepted",
  "printing",
  "done",
  "cancelled",
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
 * Master catalog — the source of truth admins edit; points pull from this
 * (Stage 7). Mirrors point-server's local `designs` table shape.
 */
export const catalogMaster = pgTable("catalog_master", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: designCategoryEnum("category").notNull(),
  title: text("title").notNull(),
  imageUrl: text("image_url").notNull().default(""),
  isFeatured: boolean("is_featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Aggregated order records pushed up from points for the stats dashboard.
 * Empty until Stage 7 wires the real push sync — seeded with demo rows for
 * now so `StatsPage` isn't blank during this stage's development/demo.
 */
export const ordersArchive = pgTable("orders_archive", {
  id: uuid("id").primaryKey().defaultRandom(),
  pointId: uuid("point_id")
    .notNull()
    .references(() => points.id, { onDelete: "cascade" }),
  status: orderStatusEnum("status").notNull(),
  garmentType: text("garment_type").notNull(),
  printSize: text("print_size").notNull(),
  price: real("price").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
