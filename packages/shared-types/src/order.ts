import { z } from "zod";
import { garmentSchema, garmentSideSchema, printSizeSchema } from "./garment.js";

export const orderStatusSchema = z.enum(["new", "accepted", "printing", "done"]);
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
 */
export const createOrderSchema = z.object({
  garmentType: garmentSchema.shape.type,
  garmentColor: z.string(),
  garmentSize: z.string(),
  garmentFabric: z.string(),
  side: garmentSideSchema,
  printSize: printSizeSchema,
  price: z.number().nonnegative(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({ status: orderStatusSchema });
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
