import type { FastifyInstance } from "fastify";
import { getGarmentCatalogConfig } from "./config.js";

export async function garmentCatalogRoutes(app: FastifyInstance) {
  app.get("/garment-catalog", async () => {
    return getGarmentCatalogConfig();
  });
}
