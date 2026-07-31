import type { FastifyInstance } from "fastify";
import { updateGarmentAvailabilityConfigSchema } from "@tshirt/shared-types";
import {
  GarmentAvailabilityLockedError,
  getGarmentAvailabilityConfig,
  updateGarmentAvailabilityConfig,
} from "./config.js";

/** Operator «Материалы» + kiosk editor read from these endpoints. */
export async function garmentAvailabilityRoutes(app: FastifyInstance) {
  app.get("/garment-availability-config", async () => {
    return getGarmentAvailabilityConfig();
  });

  app.patch("/garment-availability-config", async (request, reply) => {
    const parsed = updateGarmentAvailabilityConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    try {
      return await updateGarmentAvailabilityConfig(parsed.data);
    } catch (err) {
      if (err instanceof GarmentAvailabilityLockedError) {
        return reply.status(403).send({
          error: "Managed by central admin — disable the point override in admin to unlock local edits",
        });
      }
      throw err;
    }
  });
}
