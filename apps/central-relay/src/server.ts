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
import { initRealtime } from "./realtime/socket.js";

export async function buildServer() {
  const app = Fastify({ logger: true });

  // Attached before any route registration, same rationale as point-server:
  // safe to rely on the inbound point socket as soon as the server accepts traffic.
  initRealtime(app);

  await app.register(cors, { origin: true });
  // Phone photo uploads for the ИИ-раздел QR flow (Этап 9, `uploadMode: "relay"`).
  await app.register(multipart);

  await registerAuth(app);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(pointsRoutes);
  await app.register(pricingRoutes);
  await app.register(statsRoutes);
  await app.register(uploadRelayRoutes);

  return app;
}
