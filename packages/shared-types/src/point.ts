import { z } from "zod";

export const uploadModeSchema = z.enum(["relay", "wifi"]);
export type UploadMode = z.infer<typeof uploadModeSchema>;

export const pointStatusSchema = z.enum(["open", "closed"]);
export type PointStatus = z.infer<typeof pointStatusSchema>;

export const pointSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: pointStatusSchema,
  uploadMode: uploadModeSchema,
});
export type Point = z.infer<typeof pointSchema>;

/**
 * Central-relay's admin-facing view of a point — adds the operator login and
 * live connection state (from the inbound Socket.IO handshake), without the
 * password hash or sync token.
 */
export const pointDetailSchema = pointSchema.extend({
  operatorLogin: z.string(),
  isOnline: z.boolean(),
  lastSeenAt: z.string().nullable(),
  createdAt: z.string(),
});
export type PointDetail = z.infer<typeof pointDetailSchema>;

export const createPointSchema = z.object({
  name: z.string().min(1),
  uploadMode: uploadModeSchema.default("relay"),
  operatorLogin: z.string().min(1),
  operatorPassword: z.string().min(6),
});
export type CreatePointInput = z.infer<typeof createPointSchema>;

export const updatePointSchema = z.object({
  name: z.string().min(1).optional(),
  status: pointStatusSchema.optional(),
  uploadMode: uploadModeSchema.optional(),
  operatorLogin: z.string().min(1).optional(),
  operatorPassword: z.string().min(6).optional(),
});
export type UpdatePointInput = z.infer<typeof updatePointSchema>;

/**
 * Returned only once, right after `POST /points` — the plaintext `syncToken`
 * is needed to configure the point-server's `POINT_SYNC_TOKEN` env var and
 * is never exposed again afterwards (only its presence/absence matters later).
 */
export const pointCreatedResponseSchema = pointDetailSchema.extend({
  syncToken: z.string(),
});
export type PointCreatedResponse = z.infer<typeof pointCreatedResponseSchema>;
