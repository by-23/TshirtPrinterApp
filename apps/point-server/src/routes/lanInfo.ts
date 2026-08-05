import type { FastifyInstance } from "fastify";
import { buildLanInfo } from "../lib/lanAddresses.js";

export async function lanInfoRoutes(app: FastifyInstance) {
  app.get("/point/lan-info", async () => buildLanInfo());
}
