import type { FastifyInstance } from "fastify";
import { listEnabledFonts } from "./service.js";

/** Kiosk editor font catalog — enabled faces only (built-in + synced custom). */
export async function fontsRoutes(app: FastifyInstance) {
  app.get("/fonts", async () => listEnabledFonts());
}
