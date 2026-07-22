import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import {
  createPointSchema,
  updatePointSchema,
  type PointCreatedResponse,
  type PointDetail,
} from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { points } from "../../db/schema.js";
import { pushSnapshotToPoint } from "../../realtime/socket.js";
import { seedManualStateForNewPoint } from "../catalog-manual/service.js";

const SALT_ROUNDS = 10;

type PointRow = typeof points.$inferSelect;

function serializePoint(row: PointRow): PointDetail {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    uploadMode: row.uploadMode,
    operatorLogin: row.operatorLogin,
    isOnline: row.isOnline,
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function pointsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/points", async () => {
    const rows = await db.select().from(points);
    return rows.map(serializePoint);
  });

  app.get<{ Params: { id: string } }>("/points/:id", async (request, reply) => {
    const [row] = await db.select().from(points).where(eq(points.id, request.params.id));
    if (!row) {
      return reply.status(404).send({ error: "Point not found" });
    }
    return serializePoint(row);
  });

  // Only response that ever includes the plaintext syncToken — copy it into
  // the point-server's `POINT_SYNC_TOKEN` env var right away.
  app.post("/points", async (request, reply) => {
    const parsed = createPointSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { operatorPassword, ...fields } = parsed.data;
    const operatorPasswordHash = await bcrypt.hash(operatorPassword, SALT_ROUNDS);
    const syncToken = randomUUID();

    const [row] = await db
      .insert(points)
      .values({ ...fields, operatorPasswordHash, syncToken })
      .returning();

    // So this new point's admin panel "N/M точек применили" rollup for
    // already-existing manual designs starts at "pending" (and fans them
    // out once it connects) instead of silently never counting it.
    await seedManualStateForNewPoint(row!.id);

    const response: PointCreatedResponse = { ...serializePoint(row!), syncToken };
    return reply.status(201).send(response);
  });

  app.patch<{ Params: { id: string } }>("/points/:id", async (request, reply) => {
    const parsed = updatePointSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }

    const { operatorPassword, ...rest } = parsed.data;
    const values: Partial<PointRow> = { ...rest };
    if (operatorPassword) {
      values.operatorPasswordHash = await bcrypt.hash(operatorPassword, SALT_ROUNDS);
    }

    const [row] = await db
      .update(points)
      .set(values)
      .where(eq(points.id, request.params.id))
      .returning();
    if (!row) {
      return reply.status(404).send({ error: "Point not found" });
    }
    // Status/name/uploadMode changes must reach the kiosk without waiting for
    // its own reconnect — push a fresh snapshot right away (Stage 7).
    void pushSnapshotToPoint(row.id);
    return serializePoint(row);
  });

  app.delete<{ Params: { id: string } }>("/points/:id", async (request, reply) => {
    const [row] = await db.delete(points).where(eq(points.id, request.params.id)).returning();
    if (!row) {
      return reply.status(404).send({ error: "Point not found" });
    }
    return reply.status(204).send();
  });
}
