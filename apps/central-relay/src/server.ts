import path from "node:path";
import { mkdir } from "node:fs/promises";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { healthRoutes } from "./routes/health.js";
import { registerAuth } from "./modules/auth/plugin.js";
import { authRoutes } from "./modules/auth/routes.js";
import { pointsRoutes } from "./modules/points/routes.js";
import { catalogMasterRoutes } from "./modules/catalog-master/routes.js";
import { pricingRoutes } from "./modules/pricing/routes.js";
import { statsRoutes } from "./modules/stats/routes.js";
import { initRealtime } from "./realtime/socket.js";
import { env } from "./env.js";

export async function buildServer() {
  const app = Fastify({ logger: true });

  // Attached before any route registration, same rationale as point-server:
  // safe to rely on the inbound point socket as soon as the server accepts traffic.
  initRealtime(app);

  await mkdir(path.resolve(env.UPLOADS_DIR), { recursive: true });

  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  // Serves catalog master images uploaded via `POST /catalog/designs/:id/image`.
  await app.register(fastifyStatic, {
    root: path.resolve(env.UPLOADS_DIR),
    prefix: "/uploads/",
  });

  await registerAuth(app);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(pointsRoutes);
  await app.register(catalogMasterRoutes);
  await app.register(pricingRoutes);
  await app.register(statsRoutes);

  return app;
}
