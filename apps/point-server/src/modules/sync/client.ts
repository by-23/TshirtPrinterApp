import { io as ioClient, type Socket } from "socket.io-client";
import type { FastifyBaseLogger } from "fastify";
import { SYNC_SNAPSHOT_EVENT, type SyncSnapshotPayload } from "@tshirt/shared-types";
import { env } from "../../env.js";
import { applySnapshot } from "./handlers.js";
import { drainSyncQueue } from "./queue.js";

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
  });

  socket.on(SYNC_SNAPSHOT_EVENT, (payload: SyncSnapshotPayload) => {
    void applySnapshot(payload, log);
  });

  socket.on("disconnect", (reason) => {
    log.warn({ reason }, "Disconnected from central-relay");
  });

  socket.on("connect_error", (err) => {
    log.warn({ err: err.message }, "Central-relay connection error, will retry");
  });

  return socket;
}
