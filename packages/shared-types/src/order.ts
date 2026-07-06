import { z } from "zod";
import { garmentSchema, garmentSideSchema, printSizeSchema } from "./garment.js";

export const orderStatusSchema = z.enum(["new", "accepted", "printing", "done", "cancelled"]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderSchema = z.object({
  id: z.string(),
  garment: garmentSchema,
  side: garmentSideSchema,
  printSize: printSizeSchema,
  price: z.number().nonnegative(),
  status: orderStatusSchema,
  mockupImageUrl: z.string().nullable(),
  designImageUrl: z.string().nullable(),
  createdAt: z.string(),
});
export type Order = z.infer<typeof orderSchema>;

/**
 * Input for `POST /orders` — flat garment fields (matching the `orders`
 * table columns on point-server) rather than a nested `garment` object,
 * since a garment isn't a persisted catalog entity yet.
 *
 * `designImageBase64` is a data URL (`data:image/png;base64,...`) exported
 * straight from the Fabric canvas (transparent background, print-area crop
 * only) — point-server saves it and composites the garment mockup PNG
 * server-side via `sharp` (see Stage 5).
 */
export const createOrderSchema = z.object({
  garmentType: garmentSchema.shape.type,
  garmentColor: z.string(),
  garmentSize: z.string(),
  garmentFabric: z.string(),
  side: garmentSideSchema,
  printSize: printSizeSchema,
  price: z.number().nonnegative(),
  designImageBase64: z.string().min(1).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({ status: orderStatusSchema });
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

/**
 * Realtime contract broadcast by point-server over Socket.IO — the operator
 * feed and the kiosk checkout screen both listen on the same `order:event`
 * channel and narrow on `type`.
 */
export const orderEventSchema = z.object({
  type: z.enum(["created", "updated"]),
  order: orderSchema,
});
export type OrderEvent = z.infer<typeof orderEventSchema>;

export const ORDER_EVENT_CHANNEL = "order:event";
