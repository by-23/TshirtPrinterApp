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

export interface GarmentColorOption {
  id: string;
  hex: string;
}

/**
 * Hardcoded catalog defaults for the editor UI (Stage 2). Once catalog
 * management moves to the admin panel (Stage 3/6), these should come from
 * point-server / central-relay instead.
 */
export const GARMENT_COLORS: readonly GarmentColorOption[] = [
  { id: "white", hex: "#ffffff" },
  { id: "black", hex: "#111111" },
  { id: "gray", hex: "#959594" },
  { id: "cream", hex: "#e8ddc9" },
  { id: "pink", hex: "#ecb9c0" },
  { id: "lightBlue", hex: "#8cb6d2" },
  { id: "green", hex: "#7ec196" },
  { id: "yellow", hex: "#e2b954" },
  { id: "red", hex: "#a52525" },
  { id: "darkGreen", hex: "#556540" },
  { id: "purple", hex: "#7a449a" },
  { id: "navy", hex: "#10152a" },
];

export const GARMENT_SIZES = ["S", "M", "L", "XL", "XXL", "3XL"] as const;

export const GARMENT_FABRICS = ["cotton", "premium"] as const;
export type GarmentFabric = (typeof GARMENT_FABRICS)[number];
