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
