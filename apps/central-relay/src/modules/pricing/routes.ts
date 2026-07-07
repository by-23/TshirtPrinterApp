import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  DEFAULT_PRICE_CONFIG,
  partialPriceConfigSchema,
  priceConfigSchema,
  type PointPriceOverride,
} from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { globalPriceConfig, pointPriceOverrides, points } from "../../db/schema.js";
import { pushSnapshotToAllPoints, pushSnapshotToPoint } from "../../realtime/socket.js";

const GLOBAL_ROW_ID = "global";

export async function pricingRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/pricing/global", async () => {
    const [row] = await db
      .select()
      .from(globalPriceConfig)
      .where(eq(globalPriceConfig.id, GLOBAL_ROW_ID));
    return row?.config ?? DEFAULT_PRICE_CONFIG;
  });

  app.put("/pricing/global", async (request, reply) => {
    const parsed = priceConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const [row] = await db
      .insert(globalPriceConfig)
      .values({ id: GLOBAL_ROW_ID, config: parsed.data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: globalPriceConfig.id,
        set: { config: parsed.data, updatedAt: new Date() },
      })
      .returning();
    void pushSnapshotToAllPoints();
    return row!.config;
  });

  app.get("/pricing/overrides", async () => {
    const rows = await db.select().from(pointPriceOverrides);
    return rows.map(
      (row): PointPriceOverride => ({ pointId: row.pointId, config: row.config }),
    );
  });

  app.get<{ Params: { pointId: string } }>("/pricing/overrides/:pointId", async (request, reply) => {
    const [row] = await db
      .select()
      .from(pointPriceOverrides)
      .where(eq(pointPriceOverrides.pointId, request.params.pointId));
    if (!row) {
      return reply.status(404).send({ error: "No override for this point" });
    }
    const result: PointPriceOverride = { pointId: row.pointId, config: row.config };
    return result;
  });

  app.put<{ Params: { pointId: string } }>("/pricing/overrides/:pointId", async (request, reply) => {
    const parsed = partialPriceConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const [point] = await db.select().from(points).where(eq(points.id, request.params.pointId));
    if (!point) {
      return reply.status(404).send({ error: "Point not found" });
    }

    const [row] = await db
      .insert(pointPriceOverrides)
      .values({ pointId: request.params.pointId, config: parsed.data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: pointPriceOverrides.pointId,
        set: { config: parsed.data, updatedAt: new Date() },
      })
      .returning();
    void pushSnapshotToPoint(request.params.pointId);
    const result: PointPriceOverride = { pointId: row!.pointId, config: row!.config };
    return result;
  });

  app.delete<{ Params: { pointId: string } }>(
    "/pricing/overrides/:pointId",
    async (request, reply) => {
      const [row] = await db
        .delete(pointPriceOverrides)
        .where(eq(pointPriceOverrides.pointId, request.params.pointId))
        .returning();
      if (!row) {
        return reply.status(404).send({ error: "No override for this point" });
      }
      void pushSnapshotToPoint(request.params.pointId);
      return reply.status(204).send();
    },
  );
}
