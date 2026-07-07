import { asc, eq } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import type { Socket } from "socket.io-client";
import { SYNC_ORDER_PUSH_EVENT, type SyncOrderPushAck, type SyncOrderPushPayload } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { syncQueue } from "../../db/schema.js";

const ACK_TIMEOUT_MS = 5000;
const MAX_BACKOFF_MS = 60_000;
const BASE_BACKOFF_MS = 2000;

let draining = false;

/**
 * Queues an order push for central-relay (docs/PLAN.md Этап 7,
 * "Офлайн-очередь с ретраями"). Never throws and never blocks the caller —
 * local order create/status-change flows (kiosk/operator) must keep working
 * exactly the same whether central-relay is reachable or not.
 */
export async function enqueueOrderPush(payload: SyncOrderPushPayload): Promise<void> {
  await db.insert(syncQueue).values({ payloadJson: payload });
}

function backoffElapsed(updatedAt: string, attempts: number): boolean {
  const waitMs = Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS);
  return Date.now() - new Date(updatedAt).getTime() >= waitMs;
}

/**
 * Drains `sync_queue` over the given (already-connected) socket, oldest
 * first. Safe to call repeatedly/concurrently (e.g. on `connect` and from a
 * periodic safety-net timer) — a module-level flag makes re-entrant calls a
 * no-op instead of racing each other.
 */
export async function drainSyncQueue(socket: Socket, log: FastifyBaseLogger): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    const rows = await db.select().from(syncQueue).orderBy(asc(syncQueue.id));
    for (const row of rows) {
      if (!socket.connected) break;
      if (!backoffElapsed(row.updatedAt, row.attempts)) continue;

      try {
        const ack = await socket
          .timeout(ACK_TIMEOUT_MS)
          .emitWithAck(SYNC_ORDER_PUSH_EVENT, row.payloadJson as SyncOrderPushPayload);
        const result = ack as SyncOrderPushAck;
        if (!result?.ok) {
          throw new Error(result?.error ?? "central-relay rejected the order push");
        }
        await db.delete(syncQueue).where(eq(syncQueue.id, row.id));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        log.warn({ err: message, queueId: row.id }, "Order push failed, will retry later");
        await db
          .update(syncQueue)
          .set({
            status: "failed",
            attempts: row.attempts + 1,
            lastError: message,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(syncQueue.id, row.id));
      }
    }
  } finally {
    draining = false;
  }
}
