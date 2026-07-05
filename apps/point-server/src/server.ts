import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { catalogRoutes } from "./modules/catalog/routes.js";

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(healthRoutes);
  await app.register(catalogRoutes);

  return app;
}
