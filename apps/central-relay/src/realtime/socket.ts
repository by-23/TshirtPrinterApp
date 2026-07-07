import type { FastifyInstance } from "fastify";
import { Server, type Socket } from "socket.io";
import { eq, and } from "drizzle-orm";
import {
  SYNC_ORDER_PUSH_EVENT,
  SYNC_SNAPSHOT_EVENT,
  syncOrderPushSchema,
  type SyncOrderPushAck,
} from "@tshirt/shared-types";
import { db } from "../db/client.js";
import { ordersArchive, points } from "../db/schema.js";
import { buildSnapshotForPoint, getAllPointIds } from "./buildSnapshot.js";

let io: Server | null = null;

interface PointSocketData {
  pointId: string;
}

/**
 * Inbound side of the point ↔ central sync channel — point-server connects
 * out (see `apps/point-server/src/modules/sync/client.ts`) with
 * `{ pointId, token }` in the handshake `auth`. Tracks online/offline
 * presence for `PointsPage`, pushes a full `sync:snapshot` on every connect
 * and whenever an admin changes something relevant (see
 * `pushSnapshotToPoint`/`pushSnapshotToAllPoints`, called from the
 * points/pricing route modules), and accepts
 * `sync:order-push` from points for `orders_archive`/stats.
 */
export function initRealtime(app: FastifyInstance): Server {
  io = new Server(app.server, { cors: { origin: true }, path: "/relay-socket" });

  io.use(async (socket, next) => {
    const { pointId, token } = socket.handshake.auth as { pointId?: string; token?: string };
    if (!pointId || !token) {
      next(new Error("Missing pointId/token"));
      return;
    }

    const [point] = await db.select().from(points).where(eq(points.id, pointId));
    if (!point || point.syncToken !== token) {
      next(new Error("Invalid pointId/token"));
      return;
    }

    (socket.data as PointSocketData).pointId = pointId;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const { pointId } = socket.data as PointSocketData;
    app.log.info({ pointId }, "Point connected to central-relay");
    void socket.join(pointId);
    void setPointOnlineStatus(pointId, true);
    void pushSnapshotToPoint(pointId);

    socket.on(
      SYNC_ORDER_PUSH_EVENT,
      (payload: unknown, ack?: (response: SyncOrderPushAck) => void) => {
        void handleOrderPush(pointId, payload)
          .then(() => ack?.({ ok: true }))
          .catch((err: unknown) => {
            const error = err instanceof Error ? err.message : "Unknown error";
            app.log.error({ pointId, err }, "Failed to apply sync:order-push");
            ack?.({ ok: false, error });
          });
      },
    );

    socket.on("disconnect", () => {
      app.log.info({ pointId }, "Point disconnected from central-relay");
      void setPointOnlineStatus(pointId, false);
    });
  });

  return io;
}

async function handleOrderPush(pointId: string, rawPayload: unknown): Promise<void> {
  const parsed = syncOrderPushSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new Error(`Invalid order-push payload: ${parsed.error.message}`);
  }
  const { pointOrderId, status, garmentType, printSize, price, createdAt } = parsed.data;

  const [existing] = await db
    .select({ id: ordersArchive.id })
    .from(ordersArchive)
    .where(and(eq(ordersArchive.pointId, pointId), eq(ordersArchive.pointOrderId, pointOrderId)));

  if (existing) {
    await db
      .update(ordersArchive)
      .set({ status, garmentType, printSize, price })
      .where(eq(ordersArchive.id, existing.id));
    return;
  }

  await db.insert(ordersArchive).values({
    pointId,
    pointOrderId,
    status,
    garmentType,
    printSize,
    price,
    createdAt: new Date(createdAt),
  });
}

async function setPointOnlineStatus(pointId: string, isOnline: boolean): Promise<void> {
  await db
    .update(points)
    .set({ isOnline, lastSeenAt: new Date() })
    .where(eq(points.id, pointId));
}

/** Pushes a fresh `sync:snapshot` to a single point (e.g. after `PATCH /points/:id`). No-op if it's offline. */
export async function pushSnapshotToPoint(pointId: string): Promise<void> {
  if (!io) return;
  const snapshot = await buildSnapshotForPoint(pointId);
  if (!snapshot) return;
  io.to(pointId).emit(SYNC_SNAPSHOT_EVENT, snapshot);
}

/** Pushes a fresh `sync:snapshot` to every point (e.g. after a global pricing/catalog change). */
export async function pushSnapshotToAllPoints(): Promise<void> {
  if (!io) return;
  const pointIds = await getAllPointIds();
  await Promise.all(pointIds.map((id) => pushSnapshotToPoint(id)));
}
