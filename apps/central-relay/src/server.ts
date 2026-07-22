import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { healthRoutes } from "./routes/health.js";
import { registerAuth } from "./modules/auth/plugin.js";
import { authRoutes } from "./modules/auth/routes.js";
import { pointsRoutes } from "./modules/points/routes.js";
import { pricingRoutes } from "./modules/pricing/routes.js";
import { statsRoutes } from "./modules/stats/routes.js";
import { uploadRelayRoutes } from "./modules/upload-relay/routes.js";
import { catalogManualRoutes } from "./modules/catalog-manual/routes.js";
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

  // Attached before any route registration, same rationale as point-server:
  // safe to rely on the inbound point socket as soon as the server accepts traffic.
  initRealtime(app);

  await app.register(cors, { origin: true });
  // Phone photo uploads for the ИИ-раздел QR flow (Этап 9, `uploadMode: "relay"`).
  // `fileSize` mirrors `bodyLimit` above — @fastify/multipart falls back to
  // Fastify's bodyLimit only when this isn't set, but being explicit here
  // avoids silently inheriting a future unrelated change to `bodyLimit`.
  await app.register(multipart, { limits: { fileSize: MAX_REQUEST_BODY_BYTES } });

  await registerAuth(app);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(pointsRoutes);
  await app.register(pricingRoutes);
  await app.register(statsRoutes);
  await app.register(uploadRelayRoutes);
  await app.register(catalogManualRoutes);

  return app;
}
