import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { healthRoutes } from "./routes/health.js";
import { catalogRoutes } from "./modules/catalog/routes.js";
import { catalogScrapeRoutes } from "./modules/catalog-scraper/routes.js";
import { ordersRoutes } from "./modules/orders/routes.js";
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
  await app.register(healthRoutes);
  await app.register(catalogRoutes);
  await app.register(catalogScrapeRoutes);
  await app.register(ordersRoutes);

  return app;
}
