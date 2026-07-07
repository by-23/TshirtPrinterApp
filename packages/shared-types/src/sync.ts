import { z } from "zod";
import { pointStatusSchema, uploadModeSchema } from "./point.js";
import { priceConfigSchema } from "./pricing.js";
import { garmentTypeSchema, printSizeSchema } from "./garment.js";
import { orderStatusSchema } from "./order.js";

/** Socket.IO event names on the `/relay-socket` channel (Stage 7). */
export const SYNC_SNAPSHOT_EVENT = "sync:snapshot";
export const SYNC_ORDER_PUSH_EVENT = "sync:order-push";

/** Point identity/status fields a point caches locally and the kiosk gates on. */
export const pointConfigSnapshotSchema = z.object({
  name: z.string(),
  status: pointStatusSchema,
  uploadMode: uploadModeSchema,
});
export type PointConfigSnapshot = z.infer<typeof pointConfigSnapshotSchema>;

/**
 * Full state central-relay pushes to a point: sent right after a successful
 * `/relay-socket` connection, and again whenever an admin changes anything
 * relevant (point status, global/point pricing). Points apply it wholesale
 * (fail-open: keep the last-applied snapshot if the connection drops before
 * the next one arrives).
 */
export const syncSnapshotSchema = z.object({
  pointConfig: pointConfigSnapshotSchema,
  priceConfig: priceConfigSchema,
});
export type SyncSnapshotPayload = z.infer<typeof syncSnapshotSchema>;

/**
 * A single point-side order (create or status change) pushed up to
 * central-relay for `orders_archive`/stats. `pointOrderId` is the point's
 * local SQLite `orders.id` — central upserts on `(pointId, pointOrderId)`
 * so retried/queued pushes never create duplicates.
 */
export const syncOrderPushSchema = z.object({
  pointOrderId: z.number().int().nonnegative(),
  status: orderStatusSchema,
  garmentType: garmentTypeSchema,
  printSize: printSizeSchema,
  price: z.number().nonnegative(),
  createdAt: z.string(),
});
export type SyncOrderPushPayload = z.infer<typeof syncOrderPushSchema>;

export const syncOrderPushAckSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});
export type SyncOrderPushAck = z.infer<typeof syncOrderPushAckSchema>;
