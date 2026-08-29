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
 * Hardcoded catalog option lists for the editor UI. Per-option enable/disable
 * flags live in `GarmentAvailabilityConfig` on point-server and are edited
 * from the operator «Материалы» panel.
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
];

export const GARMENT_SIZES = ["S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL"] as const;
export type GarmentSize = (typeof GARMENT_SIZES)[number];

export const GARMENT_FABRICS = ["cotton", "premium"] as const;
export type GarmentFabric = (typeof GARMENT_FABRICS)[number];

/** Fixed fabric written to the order when `garmentUsesSizeFabric` is false — kept valid (zero surcharge) rather than special-cased. */
export const FIXED_GARMENT_FABRIC: GarmentFabric = "cotton";

/** Size button text in the kiosk editor — kept short so the 3-column grid stays intact. */
export const SIZE_LABEL_MAX_LENGTH = 7;
export const CATALOG_LABEL_MAX_LENGTH = 24;
export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const garmentCatalogColorSchema = z.object({
  label: z.string().trim().min(1).max(CATALOG_LABEL_MAX_LENGTH),
  hex: z.string().regex(HEX_COLOR_PATTERN),
});

export const garmentCatalogLabelSchema = z.object({
  label: z.string().trim().min(1).max(CATALOG_LABEL_MAX_LENGTH),
});

export const garmentCatalogSizeSchema = z.object({
  label: z.string().trim().min(1).max(SIZE_LABEL_MAX_LENGTH),
});

/** Admin-edited names and color swatches. Internal ids stay stable for orders and pricing. */
export const garmentCatalogConfigSchema = z.object({
  types: z.record(z.string(), garmentCatalogLabelSchema),
  colors: z.record(z.string(), garmentCatalogColorSchema),
  sizes: z.record(z.string(), garmentCatalogSizeSchema),
  fabrics: z.record(z.string(), garmentCatalogLabelSchema),
});

export type GarmentCatalogConfig = z.infer<typeof garmentCatalogConfigSchema>;

const DEFAULT_COLOR_LABELS: Record<string, string> = {
  white: "Белый",
  black: "Чёрный",
  gray: "Серый",
  cream: "Бежевый",
  pink: "Розовый",
  lightBlue: "Голубой",
  green: "Зелёный",
  yellow: "Жёлтый",
  red: "Красный",
};

export const DEFAULT_GARMENT_CATALOG: GarmentCatalogConfig = {
  types: {
    tshirt: { label: "Футболка" },
    sweatshirt: { label: "Свитшот" },
    cap: { label: "Кепка" },
    shopper: { label: "Шоппер" },
  },
  colors: Object.fromEntries(
    GARMENT_COLORS.map((color) => [
      color.id,
      { label: DEFAULT_COLOR_LABELS[color.id] ?? color.id, hex: color.hex },
    ]),
  ),
  sizes: Object.fromEntries(GARMENT_SIZES.map((size) => [size, { label: size }])),
  fabrics: {
    cotton: { label: "Хлопок" },
    premium: { label: "Премиум" },
  },
};

function clipLabel(value: string | undefined, max: number, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return fallback;
  return trimmed.slice(0, max);
}

/** Merge a stored (possibly partial / stale-key) catalog onto current defaults. */
export function withGarmentCatalogDefaults(
  stored: Partial<GarmentCatalogConfig> | null | undefined,
): GarmentCatalogConfig {
  const types = { ...DEFAULT_GARMENT_CATALOG.types };
  for (const type of garmentTypeSchema.options) {
    types[type] = {
      label: clipLabel(stored?.types?.[type]?.label, CATALOG_LABEL_MAX_LENGTH, types[type]!.label),
    };
  }

  const colors = { ...DEFAULT_GARMENT_CATALOG.colors };
  for (const color of GARMENT_COLORS) {
    const override = stored?.colors?.[color.id];
    const fallback = colors[color.id]!;
    const hex = override?.hex && HEX_COLOR_PATTERN.test(override.hex) ? override.hex : fallback.hex;
    colors[color.id] = {
      label: clipLabel(override?.label, CATALOG_LABEL_MAX_LENGTH, fallback.label),
      hex,
    };
  }

  const sizes = { ...DEFAULT_GARMENT_CATALOG.sizes };
  for (const size of GARMENT_SIZES) {
    sizes[size] = {
      label: clipLabel(stored?.sizes?.[size]?.label, SIZE_LABEL_MAX_LENGTH, sizes[size]!.label),
    };
  }

  const fabrics = { ...DEFAULT_GARMENT_CATALOG.fabrics };
  for (const fabric of GARMENT_FABRICS) {
    fabrics[fabric] = {
      label: clipLabel(stored?.fabrics?.[fabric]?.label, CATALOG_LABEL_MAX_LENGTH, fabrics[fabric]!.label),
    };
  }

  return { types, colors, sizes, fabrics };
}

export function resolvedGarmentColors(catalog: GarmentCatalogConfig): GarmentColorOption[] {
  return GARMENT_COLORS.map((color) => ({
    id: color.id,
    hex: catalog.colors[color.id]?.hex ?? color.hex,
  }));
}

export function garmentCatalogTypeLabel(catalog: GarmentCatalogConfig, type: string, fallback: string): string {
  return catalog.types[type]?.label?.trim() || fallback;
}

export function garmentCatalogColorLabel(catalog: GarmentCatalogConfig, colorId: string, fallback: string): string {
  return catalog.colors[colorId]?.label?.trim() || fallback;
}

export function garmentCatalogSizeLabel(catalog: GarmentCatalogConfig, size: string, fallback = size): string {
  return catalog.sizes[size]?.label?.trim() || fallback;
}

export function garmentCatalogFabricLabel(catalog: GarmentCatalogConfig, fabric: string, fallback: string): string {
  return catalog.fabrics[fabric]?.label?.trim() || fallback;
}

export function findGarmentColorByHex(
  catalog: GarmentCatalogConfig,
  hex: string,
): GarmentColorOption | undefined {
  const needle = hex.toLowerCase();
  const fromCatalog = resolvedGarmentColors(catalog).find((color) => color.hex.toLowerCase() === needle);
  if (fromCatalog) return fromCatalog;
  return GARMENT_COLORS.find((color) => color.hex.toLowerCase() === needle);
}

/**
 * Per-option enable flags for the kiosk editor. Disabled options stay visible
 * but inactive (not clickable). Managed from the operator «Материалы» panel
 * and stored on point-server — same singleton pattern as print-area config.
 */
export const garmentAvailabilityConfigSchema = z.object({
  types: z.record(z.string(), z.boolean()),
  colors: z.record(z.string(), z.boolean()),
  sizes: z.record(z.string(), z.boolean()),
  fabrics: z.record(z.string(), z.boolean()),
});

export type GarmentAvailabilityConfig = z.infer<typeof garmentAvailabilityConfigSchema>;

export const updateGarmentAvailabilityConfigSchema = z.object({
  availability: garmentAvailabilityConfigSchema,
});

export type UpdateGarmentAvailabilityConfigInput = z.infer<typeof updateGarmentAvailabilityConfigSchema>;

function allEnabled<T extends string>(ids: readonly T[]): Record<T, boolean> {
  return Object.fromEntries(ids.map((id) => [id, true])) as Record<T, boolean>;
}

/** Defaults — everything available until the operator turns options off. */
export const DEFAULT_GARMENT_AVAILABILITY: GarmentAvailabilityConfig = {
  types: allEnabled(garmentTypeSchema.options),
  colors: allEnabled(GARMENT_COLORS.map((color) => color.id)),
  sizes: allEnabled(GARMENT_SIZES),
  fabrics: allEnabled(GARMENT_FABRICS),
};

/** Merge a stored (possibly partial / stale-key) config onto current catalog defaults. */
export function withGarmentAvailabilityDefaults(
  stored: Partial<GarmentAvailabilityConfig> | null | undefined,
): GarmentAvailabilityConfig {
  const merge = <T extends string>(
    defaults: Record<T, boolean>,
    override: Record<string, boolean> | undefined,
  ): Record<T, boolean> => {
    const next = { ...defaults };
    if (!override) return next;
    for (const key of Object.keys(defaults) as T[]) {
      if (typeof override[key] === "boolean") next[key] = override[key]!;
    }
    return next;
  };

  return {
    types: merge(DEFAULT_GARMENT_AVAILABILITY.types as Record<GarmentType, boolean>, stored?.types),
    colors: merge(DEFAULT_GARMENT_AVAILABILITY.colors as Record<string, boolean>, stored?.colors),
    sizes: merge(DEFAULT_GARMENT_AVAILABILITY.sizes as Record<GarmentSize, boolean>, stored?.sizes),
    fabrics: merge(DEFAULT_GARMENT_AVAILABILITY.fabrics as Record<GarmentFabric, boolean>, stored?.fabrics),
  };
}

export function isGarmentTypeEnabled(availability: GarmentAvailabilityConfig, type: GarmentType): boolean {
  return availability.types[type] !== false;
}

export function isGarmentColorEnabled(availability: GarmentAvailabilityConfig, colorId: string): boolean {
  return availability.colors[colorId] !== false;
}

export function isGarmentSizeEnabled(availability: GarmentAvailabilityConfig, size: string): boolean {
  return availability.sizes[size] !== false;
}

export function isGarmentFabricEnabled(availability: GarmentAvailabilityConfig, fabric: string): boolean {
  return availability.fabrics[fabric] !== false;
}

export const pointGarmentAvailabilityOverrideSchema = z.object({
  pointId: z.string(),
  availability: garmentAvailabilityConfigSchema,
});
export type PointGarmentAvailabilityOverride = z.infer<typeof pointGarmentAvailabilityOverrideSchema>;

/** Payload broadcast to kiosk/operator after local write or central sync. */
export const garmentAvailabilityEventSchema = z.object({
  availability: garmentAvailabilityConfigSchema,
  adminOverrideActive: z.boolean(),
});
export type GarmentAvailabilityEvent = z.infer<typeof garmentAvailabilityEventSchema>;

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
