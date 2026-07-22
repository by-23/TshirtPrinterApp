import { asc, eq } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import type { Socket } from "socket.io-client";
import {
  CATALOG_MANUAL_ACK_EVENT,
  catalogManualDeletePayloadSchema,
  catalogManualUpsertPayloadSchema,
  type CatalogManualDeletePayload,
  type CatalogManualUpsertPayload,
} from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { catalogManualQueue, designs } from "../../db/schema.js";
import { env } from "../../env.js";
import { deleteStoredImageFile, publicManualImageUrl, writeManualImageFile } from "../catalog-scraper/storage.js";

const MAX_BACKOFF_MS = 60_000;
const BASE_BACKOFF_MS = 2000;

function ackSuccess(socket: Socket, id: string): void {
  socket.emit(CATALOG_MANUAL_ACK_EVENT, { id, ok: true });
}

function ackFailure(socket: Socket, id: string, error: string): void {
  socket.emit(CATALOG_MANUAL_ACK_EVENT, { id, ok: false, error });
}

async function downloadManualFile(fileUrl: string): Promise<Buffer> {
  const { CENTRAL_RELAY_URL, POINT_SYNC_ID, POINT_SYNC_TOKEN } = env;
  if (!CENTRAL_RELAY_URL || !POINT_SYNC_ID || !POINT_SYNC_TOKEN) {
    throw new Error("Central-relay sync is not configured");
  }
  const res = await fetch(`${CENTRAL_RELAY_URL}${fileUrl}`, {
    headers: { "x-point-id": POINT_SYNC_ID, "x-point-token": POINT_SYNC_TOKEN },
  });
  if (!res.ok) {
    throw new Error(`Failed to download manual design file: ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Applies one `catalog:manual-upsert` — idempotent, safe to re-run for the
 * same `centralDesignId` (retry, or the reconnect catch-up re-sending
 * something already applied at an older revision). Always re-downloads the
 * file even when only the title/category changed (no cheap way to tell
 * from the payload alone whether the bytes actually changed) — acceptable,
 * these are rare admin edits, not a hot path.
 */
async function applyManualUpsert(payload: CatalogManualUpsertPayload): Promise<void> {
  const [existing] = await db.select().from(designs).where(eq(designs.centralDesignId, payload.id));

  const data = await downloadManualFile(payload.fileUrl);
  await writeManualImageFile(payload.category, payload.id, data);
  if (existing && existing.category !== payload.category && existing.imageUrl) {
    // Moved to a new category's `manual/` subdirectory above — drop the stale copy under the old one.
    await deleteStoredImageFile(existing.imageUrl);
  }

  const imageUrl = publicManualImageUrl(payload.category, payload.id);
  const values = {
    category: payload.category,
    title: payload.title,
    imageUrl,
    isFeatured: false,
    sourcePinId: `admin:${payload.id}`,
    source: "admin",
    contentHash: payload.contentHash,
    centralDesignId: payload.id,
  };

  if (existing) {
    await db.update(designs).set(values).where(eq(designs.id, existing.id));
  } else {
    await db.insert(designs).values(values);
  }
}

/** Applies one `catalog:manual-delete`. A no-op if this point never actually applied the design in the first place (nothing to undo). */
async function applyManualDelete(payload: CatalogManualDeletePayload): Promise<void> {
  const [existing] = await db.select().from(designs).where(eq(designs.centralDesignId, payload.id));
  if (!existing) return;
  await db.delete(designs).where(eq(designs.id, existing.id));
  if (existing.imageUrl) {
    await deleteStoredImageFile(existing.imageUrl);
  }
}

/**
 * Handles a freshly-received `catalog:manual-upsert` push: tries to apply
 * it immediately and acks the result right away (success or failure) —
 * central updates its per-point sync state from that ack alone, it never
 * waits on a Socket.IO ack callback. On failure, also enqueues into
 * `catalog_manual_queue` for background retry (see
 * `drainManualCatalogQueue`) — the point keeps retrying on its own,
 * independent of whatever central does next.
 */
export async function handleManualUpsert(rawPayload: unknown, socket: Socket, log: FastifyBaseLogger): Promise<void> {
  const parsed = catalogManualUpsertPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    log.warn({ err: parsed.error.message }, "Invalid catalog:manual-upsert payload");
    return;
  }
  try {
    await applyManualUpsert(parsed.data);
    ackSuccess(socket, parsed.data.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.warn({ err: message, designId: parsed.data.id }, "catalog:manual-upsert failed, will retry");
    ackFailure(socket, parsed.data.id, message);
    await db.insert(catalogManualQueue).values({ kind: "upsert", payloadJson: parsed.data });
  }
}

/** Same as `handleManualUpsert`, for `catalog:manual-delete`. */
export async function handleManualDelete(rawPayload: unknown, socket: Socket, log: FastifyBaseLogger): Promise<void> {
  const parsed = catalogManualDeletePayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    log.warn({ err: parsed.error.message }, "Invalid catalog:manual-delete payload");
    return;
  }
  try {
    await applyManualDelete(parsed.data);
    ackSuccess(socket, parsed.data.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.warn({ err: message, designId: parsed.data.id }, "catalog:manual-delete failed, will retry");
    ackFailure(socket, parsed.data.id, message);
    await db.insert(catalogManualQueue).values({ kind: "delete", payloadJson: parsed.data });
  }
}

function backoffElapsed(updatedAt: string, attempts: number): boolean {
  const waitMs = Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS);
  return Date.now() - new Date(updatedAt).getTime() >= waitMs;
}

let draining = false;

/**
 * Drains `catalog_manual_queue`, oldest first — same backoff/re-entrancy
 * guard pattern as `sync/queue.ts`'s `drainSyncQueue`, just applying a
 * central push instead of pushing a local order up. Call on every
 * (re)connect and from a periodic safety-net timer (see `index.ts`).
 */
export async function drainManualCatalogQueue(socket: Socket, log: FastifyBaseLogger): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    const rows = await db.select().from(catalogManualQueue).orderBy(asc(catalogManualQueue.id));
    for (const row of rows) {
      if (!socket.connected) break;
      if (!backoffElapsed(row.updatedAt, row.attempts)) continue;

      try {
        if (row.kind === "upsert") {
          const payload = row.payloadJson as CatalogManualUpsertPayload;
          await applyManualUpsert(payload);
          ackSuccess(socket, payload.id);
        } else {
          const payload = row.payloadJson as CatalogManualDeletePayload;
          await applyManualDelete(payload);
          ackSuccess(socket, payload.id);
        }
        await db.delete(catalogManualQueue).where(eq(catalogManualQueue.id, row.id));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        log.warn({ err: message, queueId: row.id }, "Manual catalog retry failed, will retry again later");
        await db
          .update(catalogManualQueue)
          .set({ attempts: row.attempts + 1, lastError: message, updatedAt: new Date().toISOString() })
          .where(eq(catalogManualQueue.id, row.id));
      }
    }
  } finally {
    draining = false;
  }
}