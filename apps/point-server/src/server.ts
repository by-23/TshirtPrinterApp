import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import multipart from "@fastify/multipart";
import { healthRoutes } from "./routes/health.js";
import { catalogRoutes } from "./modules/catalog/routes.js";
import { catalogScrapeRoutes } from "./modules/catalog-scraper/routes.js";
import { ordersRoutes } from "./modules/orders/routes.js";
import { configRoutes } from "./modules/config/routes.js";
import { aiRoutes } from "./modules/ai/routes.js";
import { initRealtime } from "./realtime/socket.js";

/**
 * Fastify's default `bodyLimit` is 1 MiB, which is comfortably exceeded by a
 * normal-quality phone photo (a modern phone JPEG/HEIC easily runs 3-15 MB) —
 * uploads above that were silently rejected by `@fastify/multipart` with a
 * `RequestFileTooLargeError`, while small images downloaded from the web
 * happened to sneak under the limit. 20 MB covers even high-megapixel phone
 * cameras with headroom.
 */
const MAX_REQUEST_BODY_BYTES = 20 * 1024 * 1024;

export async function buildServer() {
  const app = Fastify({ logger: true, bodyLimit: MAX_REQUEST_BODY_BYTES });

  // Attached before any route registration so `emitOrderEvent` is safe to
  // call from request handlers as soon as the server starts accepting traffic.
  initRealtime(app);

  await app.register(cors, { origin: true });
  // Serves generated per-order PNGs (design + mockup) — see modules/orders/mockup.ts.
  await app.register(fastifyStatic, {
    root: path.resolve("data"),
    prefix: "/files/",
  });
  // Phone photo uploads for the ИИ-раздел QR flow (Этап 9, `uploadMode: "wifi"`).
  // `fileSize` mirrors `bodyLimit` above — @fastify/multipart falls back to
  // Fastify's bodyLimit only when this isn't set, but being explicit here
  // avoids silently inheriting a future unrelated change to `bodyLimit`.
  await app.register(multipart, { limits: { fileSize: MAX_REQUEST_BODY_BYTES } });
  await app.register(healthRoutes);
  await app.register(catalogRoutes);
  await app.register(catalogScrapeRoutes);
  await app.register(ordersRoutes);
  await app.register(configRoutes);
  await app.register(aiRoutes);

  return app;
}
