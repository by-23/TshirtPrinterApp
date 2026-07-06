import { z } from "zod";
import { garmentTypeSchema, printSizeSchema } from "./garment.js";

/**
 * Mirrors the hardcoded maps in `@tshirt/shared-pricing` (`pricing.ts`).
 * Stage 6 only stores/edits this shape on central-relay via the admin panel —
 * wiring it into point-server's live price calculation is Stage 7 (pull sync).
 */
export const priceConfigSchema = z.object({
  basePriceTenge: z.record(garmentTypeSchema, z.number().nonnegative()),
  fabricSurchargeTenge: z.record(z.string(), z.number().nonnegative()),
  sizeSurchargeTenge: z.record(z.string(), z.number().nonnegative()),
  printSizeSurchargeTenge: z.record(printSizeSchema, z.number().nonnegative()),
});
export type PriceConfig = z.infer<typeof priceConfigSchema>;

/**
 * Per-point override — every map (and every key within a map) is optional;
 * whatever isn't present falls back to the global config.
 */
export const partialPriceConfigSchema = z.object({
  basePriceTenge: z.record(garmentTypeSchema, z.number().nonnegative()).optional(),
  fabricSurchargeTenge: z.record(z.string(), z.number().nonnegative()).optional(),
  sizeSurchargeTenge: z.record(z.string(), z.number().nonnegative()).optional(),
  printSizeSurchargeTenge: z.record(printSizeSchema, z.number().nonnegative()).optional(),
});
export type PartialPriceConfig = z.infer<typeof partialPriceConfigSchema>;

/** Seed value for central-relay's `global_price_config` row — matches shared-pricing's current constants. */
export const DEFAULT_PRICE_CONFIG: PriceConfig = {
  basePriceTenge: { tshirt: 6990, hoodie: 11990 },
  fabricSurchargeTenge: { cotton: 0, premium: 1500 },
  sizeSurchargeTenge: { S: 0, M: 0, L: 0, XL: 500, XXL: 1000, "3XL": 1500 },
  printSizeSurchargeTenge: { small: 0, medium: 1000, large: 2000 },
};

export const pointPriceOverrideSchema = z.object({
  pointId: z.string(),
  config: partialPriceConfigSchema,
});
export type PointPriceOverride = z.infer<typeof pointPriceOverrideSchema>;
