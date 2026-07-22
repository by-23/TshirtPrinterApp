import { z } from "zod";

export const garmentTypeSchema = z.enum(["tshirt", "sweatshirt", "cap", "shopper"]);
export type GarmentType = z.infer<typeof garmentTypeSchema>;

export const garmentSideSchema = z.enum(["front", "back"]);
export type GarmentSide = z.infer<typeof garmentSideSchema>;

/** Garment types that let the customer pick size/fabric — cap and shopper are one-size/one-material. */
const SIZE_FABRIC_GARMENT_TYPES: readonly GarmentType[] = ["tshirt", "sweatshirt"];

export function garmentUsesSizeFabric(type: GarmentType): boolean {
  return SIZE_FABRIC_GARMENT_TYPES.includes(type);
}

/** Fixed size written to the order when `garmentUsesSizeFabric` is false — kept valid (zero surcharge) rather than special-cased. */
export const FIXED_GARMENT_SIZE = "M";

/** Garment types with no real back side — the shopper is only ever designed on `front`. */
const BACKLESS_GARMENT_TYPES: readonly GarmentType[] = ["shopper"];

export function garmentHasSelectableBackSide(type: GarmentType): boolean {
  return !BACKLESS_GARMENT_TYPES.includes(type);
}

/** Native pixel size of every garment flat-lay photo (client assets + point-server compositing). */
export const GARMENT_PHOTO_WIDTH = 1024;
export const GARMENT_PHOTO_HEIGHT = 1024;

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

/** Fixed fabric written to the order when `garmentUsesSizeFabric` is false — kept valid (zero surcharge) rather than special-cased. */
export const FIXED_GARMENT_FABRIC: GarmentFabric = "cotton";

/** Shared mockup coordinate space — kiosk editor and point-server compositing. */
export const MOCKUP_WIDTH = 300;
export const MOCKUP_HEIGHT = 340;

export interface PrintAreaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const printAreaRectSchema = z
  .object({
    x: z.number().min(0).max(MOCKUP_WIDTH),
    y: z.number().min(0).max(MOCKUP_HEIGHT),
    width: z.number().min(20).max(MOCKUP_WIDTH),
    height: z.number().min(20).max(MOCKUP_HEIGHT),
  })
  .refine((rect) => rect.x + rect.width <= MOCKUP_WIDTH, { message: "width exceeds mockup bounds" })
  .refine((rect) => rect.y + rect.height <= MOCKUP_HEIGHT, { message: "height exceeds mockup bounds" });

const garmentSideAreasSchema = z.object({
  front: printAreaRectSchema,
  back: printAreaRectSchema,
});

export const printAreaConfigSchema = z.object({
  tshirt: garmentSideAreasSchema,
  sweatshirt: garmentSideAreasSchema,
  cap: garmentSideAreasSchema,
  shopper: garmentSideAreasSchema,
});

export type PrintAreaConfig = z.infer<typeof printAreaConfigSchema>;

export const updatePrintAreaConfigSchema = z.object({
  areas: printAreaConfigSchema,
});

export type UpdatePrintAreaConfigInput = z.infer<typeof updatePrintAreaConfigSchema>;

/**
 * Hardcoded defaults — overridden per-point via `print_area_config` on
 * point-server. Cap/sweatshirt/shopper rectangles are first-pass drafts sized
 * against the new flat-lay photos; the operator's «Настройки печати» panel
 * is the intended place to fine-tune them per real garment.
 */
export const DEFAULT_PRINT_AREAS: PrintAreaConfig = {
  tshirt: {
    front: { x: 110, y: 115, width: 90, height: 150 },
    back: { x: 100, y: 105, width: 110, height: 175 },
  },
  sweatshirt: {
    front: { x: 110, y: 118, width: 90, height: 105 },
    back: { x: 100, y: 105, width: 110, height: 175 },
  },
  cap: {
    front: { x: 120, y: 128, width: 60, height: 36 },
    back: { x: 112, y: 118, width: 76, height: 40 },
  },
  shopper: {
    front: { x: 90, y: 140, width: 120, height: 140 },
    back: { x: 90, y: 140, width: 120, height: 140 },
  },
};
