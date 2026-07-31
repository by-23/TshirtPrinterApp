import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  garmentAvailabilityConfigSchema,
  withGarmentAvailabilityDefaults,
  type PointGarmentAvailabilityOverride,
} from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { pointGarmentAvailabilityOverrides, points } from "../../db/schema.js";
import { pushSnapshotToPoint } from "../../realtime/socket.js";

export async function garmentAvailabilityRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/garment-availability/overrides", async () => {
    const rows = await db.select().from(pointGarmentAvailabilityOverrides);
    return rows.map(
      (row): PointGarmentAvailabilityOverride => ({
        pointId: row.pointId,
        availability: withGarmentAvailabilityDefaults(row.availability),
      }),
    );
  });

  app.get<{ Params: { pointId: string } }>(
    "/garment-availability/overrides/:pointId",
    async (request, reply) => {
      const [row] = await db
        .select()
        .from(pointGarmentAvailabilityOverrides)
        .where(eq(pointGarmentAvailabilityOverrides.pointId, request.params.pointId));
      if (!row) {
        return reply.status(404).send({ error: "No garment availability override for this point" });
      }
      const result: PointGarmentAvailabilityOverride = {
        pointId: row.pointId,
        availability: withGarmentAvailabilityDefaults(row.availability),
      };
      return result;
    },
  );

  app.put<{ Params: { pointId: string } }>(
    "/garment-availability/overrides/:pointId",
    async (request, reply) => {
      const parsed = garmentAvailabilityConfigSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const [point] = await db.select().from(points).where(eq(points.id, request.params.pointId));
      if (!point) {
        return reply.status(404).send({ error: "Point not found" });
      }

      const availability = withGarmentAvailabilityDefaults(parsed.data);
      const [row] = await db
        .insert(pointGarmentAvailabilityOverrides)
        .values({ pointId: request.params.pointId, availability, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: pointGarmentAvailabilityOverrides.pointId,
          set: { availability, updatedAt: new Date() },
        })
        .returning();
      void pushSnapshotToPoint(request.params.pointId);
      const result: PointGarmentAvailabilityOverride = {
        pointId: row!.pointId,
        availability: withGarmentAvailabilityDefaults(row!.availability),
      };
      return result;
    },
  );

  app.delete<{ Params: { pointId: string } }>(
    "/garment-availability/overrides/:pointId",
    async (request, reply) => {
      const [row] = await db
        .delete(pointGarmentAvailabilityOverrides)
        .where(eq(pointGarmentAvailabilityOverrides.pointId, request.params.pointId))
        .returning();
      if (!row) {
        return reply.status(404).send({ error: "No garment availability override for this point" });
      }
      void pushSnapshotToPoint(request.params.pointId);
      return reply.status(204).send();
    },
  );
}
