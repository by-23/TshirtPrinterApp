import { io as ioClient, type Socket } from "socket.io-client";
import type { FastifyBaseLogger } from "fastify";
import { env } from "../../env.js";

/**
 * Outbound WebSocket to central-relay (Stage 6 requirement). This only
 * establishes the connection and reports online/offline presence — the
 * central-relay side tracks `isOnline`/`lastSeenAt` for `PointsPage`. Actual
 * catalog/price pull and order push over this same connection is Stage 7.
 *
 * Fail-open: if `CENTRAL_RELAY_URL`/`POINT_SYNC_ID`/`POINT_SYNC_TOKEN` aren't
 * configured, or the relay is unreachable, the point keeps working entirely
 * offline — socket.io-client retries connecting forever in the background.
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

  socket.on("connect", () => {
    log.info("Connected to central-relay");
  });

  socket.on("disconnect", (reason) => {
    log.warn({ reason }, "Disconnected from central-relay");
  });

  socket.on("connect_error", (err) => {
    log.warn({ err: err.message }, "Central-relay connection error, will retry");
  });

  return socket;
}
