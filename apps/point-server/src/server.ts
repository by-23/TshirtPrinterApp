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

export async function buildServer() {
  const app = Fastify({ logger: true });

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
  await app.register(multipart);
  await app.register(healthRoutes);
  await app.register(catalogRoutes);
  await app.register(catalogScrapeRoutes);
  await app.register(ordersRoutes);
  await app.register(configRoutes);
  await app.register(aiRoutes);

  return app;
}
