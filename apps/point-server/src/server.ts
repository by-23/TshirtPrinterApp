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
import { printAreaRoutes } from "./modules/print-area/routes.js";
import { aiRoutes } from "./modules/ai/routes.js";
import { stickerRoutes } from "./modules/stickers/routes.js";
import { adsRoutes } from "./modules/ads/routes.js";
import { initRealtime } from "./realtime/socket.js";

/**
 * Fastify's default `bodyLimit` is 1 MiB. Phone photos for the ИИ-раздел need
 * ~20 MB; attract-loop videos uploaded from the operator panel can be much
 * larger, so we allow up to 200 MB for multipart bodies.
 */
const MAX_REQUEST_BODY_BYTES = 200 * 1024 * 1024;

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
  // Phone photo uploads (ИИ-раздел) + operator ads-video uploads (Этап 8).
  // `fileSize` mirrors `bodyLimit` above — @fastify/multipart falls back to
  // Fastify's bodyLimit only when this isn't set, but being explicit here
  // avoids silently inheriting a future unrelated change to `bodyLimit`.
  await app.register(multipart, { limits: { fileSize: MAX_REQUEST_BODY_BYTES } });
  await app.register(healthRoutes);
  await app.register(catalogRoutes);
  await app.register(catalogScrapeRoutes);
  await app.register(ordersRoutes);
  await app.register(configRoutes);
  await app.register(printAreaRoutes);
  await app.register(aiRoutes);
  await app.register(stickerRoutes);
  await app.register(adsRoutes);

  return app;
}
