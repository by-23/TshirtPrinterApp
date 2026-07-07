import type { FastifyBaseLogger } from "fastify";
import type { SyncSnapshotPayload } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { pointConfig } from "../../db/schema.js";
import { emitPointConfigEvent, emitPricingEvent } from "../../realtime/socket.js";

const POINT_CONFIG_ROW_ID = 1;

/**
 * Applies a full `sync:snapshot` from central-relay: caches point
 * identity/status/price config locally. Fail-open: a DB hiccup is logged
 * and skipped rather than throwing, so a bad snapshot can never crash the
 * socket connection.
 */
export async function applySnapshot(snapshot: SyncSnapshotPayload, log: FastifyBaseLogger): Promise<void> {
  await upsertPointConfig(snapshot, log);
}

async function upsertPointConfig(snapshot: SyncSnapshotPayload, log: FastifyBaseLogger): Promise<void> {
  try {
    const values = {
      id: POINT_CONFIG_ROW_ID,
      name: snapshot.pointConfig.name,
      status: snapshot.pointConfig.status,
      uploadMode: snapshot.pointConfig.uploadMode,
      priceConfigJson: snapshot.priceConfig,
      updatedAt: new Date().toISOString(),
    };
    await db
      .insert(pointConfig)
      .values(values)
      .onConflictDoUpdate({ target: pointConfig.id, set: values });
    // Kiosk should react (e.g. show/hide the "closed" screen, or the live
    // editor price) immediately, not on its next poll/reload.
    emitPointConfigEvent(snapshot.pointConfig);
    emitPricingEvent(snapshot.priceConfig);
  } catch (err) {
    log.error(err, "Failed to persist synced point config");
  }
}
