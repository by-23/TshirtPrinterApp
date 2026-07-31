import type { FastifyInstance } from "fastify";
import { Server, type Socket } from "socket.io";
import { eq, and } from "drizzle-orm";
import {
  SYNC_ORDER_PUSH_EVENT,
  SYNC_SNAPSHOT_EVENT,
  UPLOAD_CREATE_SESSION_EVENT,
  UPLOAD_PHOTO_READY_EVENT,
  CATALOG_MANUAL_UPSERT_EVENT,
  CATALOG_MANUAL_DELETE_EVENT,
  CATALOG_MANUAL_ACK_EVENT,
  syncOrderPushSchema,
  catalogManualAckSchema,
  type SyncOrderPushAck,
  type UploadCreateSessionAck,
  type UploadPhotoReadyPayload,
  type CatalogManualUpsertPayload,
  type CatalogManualDeletePayload,
} from "@tshirt/shared-types";
import { db } from "../db/client.js";
import { ordersArchive, points } from "../db/schema.js";
import { buildSnapshotForPoint, getAllPointIds } from "./buildSnapshot.js";
import { createUploadSession } from "../modules/upload-relay/service.js";
import { listPendingManualSyncForPoint, recordManualAck } from "../modules/catalog-manual/service.js";

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
    // Catch-up for whatever manual-catalog uploads/edits/deletes this point
    // missed while offline (or never got, if it just joined) — see
    // `pushManualSyncToPoint` below.
    void pushManualSyncToPoint(pointId);

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

    // ИИ-раздел (Этап 9), `uploadMode: "relay"` — point asks for a fresh
    // QR photo-upload session; the resulting token/URL round-trips back to
    // the kiosk over the ack (see `apps/point-server/src/modules/ai/routes.ts`).
    socket.on(UPLOAD_CREATE_SESSION_EVENT, (_payload: unknown, ack?: (response: UploadCreateSessionAck) => void) => {
      void createUploadSession(pointId)
        .then((session) => ack?.({ ok: true, ...session }))
        .catch((err: unknown) => {
          const error = err instanceof Error ? err.message : "Unknown error";
          app.log.error({ pointId, err }, "Failed to create upload session");
          ack?.({ ok: false, error });
        });
    });

    // Point's report of whether it managed to apply a manual-catalog upsert/
    // delete — fired both right after receiving the push (success or first
    // failure) and again later from the point's own background retry queue
    // once/if it eventually succeeds (see
    // `apps/point-server/src/modules/sync/manualCatalog.ts`). No response
    // expected — this is itself the "ack" for `CATALOG_MANUAL_UPSERT_EVENT`/
    // `CATALOG_MANUAL_DELETE_EVENT`, which are plain room-broadcasts.
    socket.on(CATALOG_MANUAL_ACK_EVENT, (payload: unknown) => {
      const parsed = catalogManualAckSchema.safeParse(payload);
      if (!parsed.success) return;
      void recordManualAck(pointId, parsed.data.id, parsed.data.ok, parsed.data.error).catch((err: unknown) => {
        app.log.error({ pointId, err }, "Failed to record catalog:manual-ack");
      });
    });

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
  const { pointOrderId, status, garmentType, printSize, price, printCount, createdAt } = parsed.data;

  const [existing] = await db
    .select({ id: ordersArchive.id })
    .from(ordersArchive)
    .where(and(eq(ordersArchive.pointId, pointId), eq(ordersArchive.pointOrderId, pointOrderId)));

  if (existing) {
    await db
      .update(ordersArchive)
      .set({ status, garmentType, printSize, price, printCount })
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
    printCount,
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

/**
 * ИИ-раздел (Этап 9) — pushes a just-uploaded phone photo into a point's
 * room once `POST /upload/:token/photo` accepts it (see
 * `modules/upload-relay/routes.ts`). No-op if the point is offline (the
 * photo is simply lost — same fail-open posture as the rest of the AI flow,
 * which already requires internet).
 */
export function emitPhotoReadyToPoint(pointId: string, payload: UploadPhotoReadyPayload): void {
  if (!io) return;
  io.to(pointId).emit(UPLOAD_PHOTO_READY_EVENT, payload);
}

/**
 * Re-sends every manual-catalog design this point hasn't caught up to yet
 * (a create/edit it never got, or a delete it hasn't applied) — called on
 * every (re)connect, and again right after `POST/PATCH/DELETE
 * /catalog-manual*` so an already-online point picks up the change
 * immediately instead of waiting for its next reconnect. Plain
 * room-broadcast, no ack: whether it landed is reported back later via
 * `CATALOG_MANUAL_ACK_EVENT` (see the listener above), which is what
 * actually flips a point's `catalog_manual_point_state` row to `applied`.
 * No-op (and safe to call) if the point is offline — the row just stays
 * `pending` until it reconnects.
 */
export async function pushManualSyncToPoint(pointId: string): Promise<void> {
  if (!io) return;
  const pending = await listPendingManualSyncForPoint(pointId);
  for (const { design } of pending) {
    if (design.deletedAt) {
      const payload: CatalogManualDeletePayload = { id: design.id };
      io.to(pointId).emit(CATALOG_MANUAL_DELETE_EVENT, payload);
    } else {
      const payload: CatalogManualUpsertPayload = {
        id: design.id,
        revision: design.revision,
        category: design.category,
        title: design.title,
        contentHash: design.contentHash,
        fileUrl: `/catalog-manual/${design.id}/file`,
      };
      io.to(pointId).emit(CATALOG_MANUAL_UPSERT_EVENT, payload);
    }
  }
}

/** Same as `pushManualSyncToPoint`, fanned out to every point — called after every admin create/edit/delete in `modules/catalog-manual/routes.ts`. */
export async function pushManualSyncToAllPoints(): Promise<void> {
  if (!io) return;
  const pointIds = await getAllPointIds();
  await Promise.all(pointIds.map((id) => pushManualSyncToPoint(id)));
}
