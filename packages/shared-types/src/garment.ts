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
  { id: "red", hex: "#dc2626" },
  { id: "navy", hex: "#1e3a8a" },
  { id: "gray", hex: "#6b7280" },
  { id: "yellow", hex: "#eab308" },
];

export const GARMENT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export const GARMENT_FABRICS = ["cotton", "polyester", "blend"] as const;
