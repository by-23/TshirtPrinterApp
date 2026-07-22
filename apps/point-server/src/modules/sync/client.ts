import { io as ioClient, type Socket } from "socket.io-client";
import type { FastifyBaseLogger } from "fastify";
import {
  SYNC_SNAPSHOT_EVENT,
  UPLOAD_PHOTO_READY_EVENT,
  CATALOG_MANUAL_UPSERT_EVENT,
  CATALOG_MANUAL_DELETE_EVENT,
  type SyncSnapshotPayload,
  type UploadPhotoReadyPayload,
} from "@tshirt/shared-types";
import { env } from "../../env.js";
import { emitAiPhotoReceivedEvent } from "../../realtime/socket.js";
import { applySnapshot } from "./handlers.js";
import { drainSyncQueue } from "./queue.js";
import { drainManualCatalogQueue, handleManualDelete, handleManualUpsert } from "./manualCatalog.js";

let activeSocket: Socket | null = null;

/** The live outbound socket to central-relay, if sync is configured and ever connected — used by `enqueueOrderPush` callers to nudge an immediate drain. */
export function getSyncSocket(): Socket | null {
  return activeSocket;
}

/**
 * Outbound WebSocket to central-relay (Stage 6/7). Reports online/offline
 * presence, receives full `sync:snapshot` pulls (catalog/pricing/point
 * status — see `./handlers.ts`), and drains the offline order-push queue
 * (`./queue.ts`) on every (re)connect.
 *
 * Fail-open: if `CENTRAL_RELAY_URL`/`POINT_SYNC_ID`/`POINT_SYNC_TOKEN` aren't
 * configured, or the relay is unreachable, the point keeps working entirely
 * offline — socket.io-client retries connecting forever in the background,
 * and orders simply pile up in `sync_queue` until it succeeds.
 */
export function connectToCentralRelay(log: FastifyBaseLogger): Socket | null {
  const { CENTRAL_RELAY_URL, POINT_SYNC_ID, POINT_SYNC_TOKEN } = env;
  if (!CENTRAL_RELAY_URL || !POINT_SYNC_ID || !POINT_SYNC_TOKEN) {
    log.info("Central-relay sync disabled (CENTRAL_RELAY_URL/POINT_SYNC_ID/POINT_SYNC_TOKEN not set)");
    return null;
  }

  const socket = ioClient(CENTRAL_RELAY_URL, {
    path: "/relay-socket",
    auth: { pointId: POINT_SYNC_ID, token: POINT_SYNC_TOKEN },
    reconnection: true,
  });
  activeSocket = socket;

  socket.on("connect", () => {
    log.info("Connected to central-relay");
    void drainSyncQueue(socket, log);
    void drainManualCatalogQueue(socket, log);
  });

  socket.on(SYNC_SNAPSHOT_EVENT, (payload: SyncSnapshotPayload) => {
    void applySnapshot(payload, log);
  });

  // Admin panel's "Каталог" tab (manual PNG uploads) fanned out from
  // central-relay — see `./manualCatalog.ts`. Room-broadcast, not an ack
  // callback: the result is reported back separately via
  // `CATALOG_MANUAL_ACK_EVENT`, which both handlers emit themselves.
  socket.on(CATALOG_MANUAL_UPSERT_EVENT, (payload: unknown) => {
    void handleManualUpsert(payload, socket, log);
  });
  socket.on(CATALOG_MANUAL_DELETE_EVENT, (payload: unknown) => {
    void handleManualDelete(payload, socket, log);
  });

  // ИИ-раздел (Этап 9), `uploadMode: "relay"` — central-relay pushes this
  // once a phone posts a photo to `POST /upload/:token/photo`. Re-emitted
  // locally as the same `AI_PHOTO_RECEIVED_EVENT` the kiosk listens for in
  // `uploadMode: "wifi"` too (see `modules/ai/routes.ts`), so the frontend
  // doesn't need to care which mode is active.
  socket.on(UPLOAD_PHOTO_READY_EVENT, (payload: UploadPhotoReadyPayload) => {
    emitAiPhotoReceivedEvent({ sessionId: payload.token, imageBase64: payload.imageBase64 });
  });

  socket.on("disconnect", (reason) => {
    log.warn({ reason }, "Disconnected from central-relay");
  });

  socket.on("connect_error", (err) => {
    log.warn({ err: err.message }, "Central-relay connection error, will retry");
  });

  return socket;
}
