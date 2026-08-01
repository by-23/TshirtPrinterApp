import path from "node:path";
import { existsSync } from "node:fs";
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
import { garmentAvailabilityRoutes } from "./modules/garment-availability/routes.js";
import { aiRoutes } from "./modules/ai/routes.js";
import { stickerRoutes } from "./modules/stickers/routes.js";
import { adsRoutes } from "./modules/ads/routes.js";
import { fontsRoutes } from "./modules/fonts/routes.js";
import { initRealtime } from "./realtime/socket.js";
import { env } from "./env.js";
import { ensureDataDir } from "./lib/dataDir.js";

/**
 * Fastify's default `bodyLimit` is 1 MiB. Phone photos for the ИИ-раздел need
 * ~20 MB; attract-loop videos uploaded from the operator panel can be much
 * larger, so we allow up to 200 MB for multipart bodies.
 */
const MAX_REQUEST_BODY_BYTES = 200 * 1024 * 1024;

function resolveUiDistPath(): string | null {
  if (env.UI_DIST_PATH) {
    const configured = path.resolve(env.UI_DIST_PATH);
    if (existsSync(path.join(configured, "index.html"))) return configured;
  }
  // Default: monorepo sibling build output (dev/prod from apps/point-server cwd).
  const sibling = path.resolve("..", "kiosk-operator-app", "dist");
  if (existsSync(path.join(sibling, "index.html"))) return sibling;
  // Packaged point layout: `ui-dist/` next to server cwd root.
  const bundled = path.resolve("ui-dist");
  if (existsSync(path.join(bundled, "index.html"))) return bundled;
  return null;
}

export async function buildServer() {
  const app = Fastify({ logger: true, bodyLimit: MAX_REQUEST_BODY_BYTES });

  // Attached before any route registration so `emitOrderEvent` is safe to
  // call from request handlers as soon as the server starts accepting traffic.
  initRealtime(app);

  await app.register(cors, { origin: true });
  // All runtime media (catalog, order PNGs, ads, stickers) — DATA_DIR / ensureDataDir().
  const dataRoot = ensureDataDir();
  app.log.info(`Serving /files from data root ${dataRoot}`);
  await app.register(fastifyStatic, {
    root: dataRoot,
    prefix: "/files/",
    // Catalog thumbs + ads benefit from long cache on Android WebView over LAN.
    maxAge: "7d",
    immutable: false,
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
  await app.register(garmentAvailabilityRoutes);
  await app.register(aiRoutes);
  await app.register(stickerRoutes);
  await app.register(adsRoutes);
  await app.register(fontsRoutes);

  const uiDist = resolveUiDistPath();
  if (uiDist) {
    app.log.info(`Serving kiosk/operator UI from ${uiDist}`);
    await app.register(fastifyStatic, {
      root: uiDist,
      // First @fastify/static already decorated reply.sendFile — avoid FST_ERR_DEC_ALREADY_PRESENT.
      decorateReply: false,
      maxAge: "1y",
      // Vite hashed assets under /assets/ are content-addressed.
      immutable: true,
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET") {
        const urlPath = request.url.split("?")[0] ?? "";
        const isSpaRoute =
          urlPath === "/" ||
          urlPath.startsWith("/kiosk") ||
          urlPath.startsWith("/operator") ||
          urlPath === "/index.html";
        if (isSpaRoute) {
          return reply.type("text/html").sendFile("index.html", uiDist);
        }
      }
      return reply.status(404).send({ error: "Not Found" });
    });
  } else {
    app.log.warn("No kiosk UI dist found — API only (set UI_DIST_PATH or build kiosk-operator-app)");
  }

  return app;
}
