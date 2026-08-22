import { z } from "zod";
import { garmentSchema, garmentSideSchema, printSizeSchema, type GarmentSide } from "./garment.js";

export const orderStatusSchema = z.enum(["new", "accepted", "printing", "done", "cancelled"]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderSchema = z.object({
  id: z.string(),
  garment: garmentSchema,
  side: garmentSideSchema,
  printSize: printSizeSchema,
  price: z.number().nonnegative(),
  status: orderStatusSchema,
  /** How many times the operator actually sent this order to the printer (including reprints). */
  printCount: z.number().int().nonnegative(),
  mockupImageUrl: z.string().nullable(),
  designImageUrl: z.string().nullable(),
  /** Ready-to-RIP DTF PNG (300 DPI, physical mm, optional mirror) — null until first prepare. */
  dtfPrintImageUrl: z.string().nullable().optional(),
  /**
   * Second print side when the customer designed both front and back.
   * Absent/null on legacy single-side orders.
   */
  otherSide: garmentSideSchema.nullable().optional(),
  otherPrintSize: printSizeSchema.nullable().optional(),
  otherMockupImageUrl: z.string().nullable().optional(),
  otherDesignImageUrl: z.string().nullable().optional(),
  otherDtfPrintImageUrl: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type Order = z.infer<typeof orderSchema>;

/** One printable side of an order (primary columns, or the optional `other*` pair). */
export interface OrderPrintSide {
  side: GarmentSide;
  printSize: z.infer<typeof printSizeSchema>;
  mockupImageUrl: string | null;
  designImageUrl: string | null;
  dtfPrintImageUrl: string | null;
}

/**
 * Front then back when both exist, otherwise the single stored side.
 * Used by the operator preview toggles and DTF prepare-print.
 */
export function getOrderPrintSides(order: Order): OrderPrintSide[] {
  const primary: OrderPrintSide = {
    side: order.side,
    printSize: order.printSize,
    mockupImageUrl: order.mockupImageUrl,
    designImageUrl: order.designImageUrl,
    dtfPrintImageUrl: order.dtfPrintImageUrl ?? null,
  };
  if (!order.otherSide || !order.otherDesignImageUrl) {
    return [primary];
  }
  const extra: OrderPrintSide = {
    side: order.otherSide,
    printSize: order.otherPrintSize ?? order.printSize,
    mockupImageUrl: order.otherMockupImageUrl ?? null,
    designImageUrl: order.otherDesignImageUrl,
    dtfPrintImageUrl: order.otherDtfPrintImageUrl ?? null,
  };
  return primary.side === "back" && extra.side === "front" ? [extra, primary] : [primary, extra];
}

const extraPrintSideSchema = z.object({
  side: garmentSideSchema,
  printSize: printSizeSchema,
  designImageBase64: z.string().min(1),
});

/**
 * Input for `POST /orders` — flat garment fields (matching the `orders`
 * table columns on point-server) rather than a nested `garment` object,
 * since a garment isn't a persisted catalog entity yet.
 *
 * `designImageBase64` is a data URL (`data:image/png;base64,...`) exported
 * straight from the Fabric canvas (transparent background, print-area crop
 * only) — point-server saves it and composites the garment mockup PNG
 * server-side via `sharp` (see Stage 5).
 *
 * `extraSides` is the other of front/back when the customer designed both.
 */
export const createOrderSchema = z
  .object({
    garmentType: garmentSchema.shape.type,
    garmentColor: z.string(),
    garmentSize: z.string(),
    garmentFabric: z.string(),
    side: garmentSideSchema,
    printSize: printSizeSchema,
    price: z.number().nonnegative(),
    designImageBase64: z.string().min(1).optional(),
    extraSides: z.array(extraPrintSideSchema).max(1).optional(),
  })
  .refine((data) => !data.extraSides?.[0] || data.extraSides[0].side !== data.side, {
    message: "extraSides.side must differ from side",
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
