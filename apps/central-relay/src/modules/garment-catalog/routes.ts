import type { FastifyInstance } from "fastify";
import { garmentCatalogConfigSchema, withGarmentCatalogDefaults } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { globalGarmentCatalog } from "../../db/schema.js";
import { pushSnapshotToAllPoints } from "../../realtime/socket.js";
import { getGlobalGarmentCatalog, GLOBAL_ROW_ID } from "./service.js";

export async function garmentCatalogRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/garment-catalog", async () => {
    return getGlobalGarmentCatalog();
  });

  app.put("/garment-catalog", async (request, reply) => {
    const parsed = garmentCatalogConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const config = withGarmentCatalogDefaults(parsed.data);
    const [row] = await db
      .insert(globalGarmentCatalog)
      .values({ id: GLOBAL_ROW_ID, config, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: globalGarmentCatalog.id,
        set: { config, updatedAt: new Date() },
      })
      .returning();
    void pushSnapshotToAllPoints();
    return withGarmentCatalogDefaults(row!.config);
  });
}
