import type { FastifyInstance } from "fastify";
import { updatePrintAreaConfigSchema } from "@tshirt/shared-types";
import { getPrintAreaConfig, updatePrintAreaConfig } from "./config.js";

/** Operator «Настройки печати» + kiosk editor read from these endpoints. */
export async function printAreaRoutes(app: FastifyInstance) {
  app.get("/print-area-config", async () => {
    return getPrintAreaConfig();
  });

  app.patch("/print-area-config", async (request, reply) => {
    const parsed = updatePrintAreaConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    return updatePrintAreaConfig(parsed.data);
  });
}
