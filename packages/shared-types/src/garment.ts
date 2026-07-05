import { z } from "zod";

export const garmentTypeSchema = z.enum(["tshirt", "hoodie"]);
export type GarmentType = z.infer<typeof garmentTypeSchema>;

export const garmentSideSchema = z.enum(["front", "back"]);
export type GarmentSide = z.infer<typeof garmentSideSchema>;

export const printSizeSchema = z.enum(["small", "medium", "large"]);
export type PrintSize = z.infer<typeof printSizeSchema>;

export const garmentSchema = z.object({
  id: z.string(),
  type: garmentTypeSchema,
  color: z.string(),
  size: z.string(),
  fabric: z.string(),
});
export type Garment = z.infer<typeof garmentSchema>;
