import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const pointConfig = sqliteTable("point_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  status: text("status", { enum: ["open", "closed"] })
    .notNull()
    .default("closed"),
  uploadMode: text("upload_mode", { enum: ["relay", "wifi"] })
    .notNull()
    .default("relay"),
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
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status", { enum: ["new", "accepted", "printing", "done"] })
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
