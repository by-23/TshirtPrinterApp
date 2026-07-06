import type { FastifyInstance } from "fastify";
import { Server, type Socket } from "socket.io";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { points } from "../db/schema.js";

let io: Server | null = null;

interface PointSocketData {
  pointId: string;
}

/**
 * Inbound side of Stage 6's "outbound WebSocket от точки к central-relay" —
 * point-server connects out (see `apps/point-server/src/modules/sync/client.ts`)
 * with `{ pointId, token }` in the handshake `auth`. This only tracks
 * online/offline presence for `PointsPage`; actual catalog/price pull and
 * order push over this channel is Stage 7.
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
    void setPointOnlineStatus(pointId, true);

    socket.on("disconnect", () => {
      app.log.info({ pointId }, "Point disconnected from central-relay");
      void setPointOnlineStatus(pointId, false);
    });
  });

  return io;
}

async function setPointOnlineStatus(pointId: string, isOnline: boolean): Promise<void> {
  await db
    .update(points)
    .set({ isOnline, lastSeenAt: new Date() })
    .where(eq(points.id, pointId));
}
