import { z } from "zod";
import { garmentTypeSchema, printSizeSchema } from "./garment.js";

export const aiProviderSchema = z.enum(["standard", "chatgpt", "gemini"]);
export type AiProvider = z.infer<typeof aiProviderSchema>;

/**
 * Coverage of the print zone (bounding box of all designs ÷ zone area)
 * that bumps the auto-detected print size from small→medium / medium→large.
 * Stored as percents (0–100) for admin editing; kiosk converts to ratios.
 */
export const printCoverageThresholdsSchema = z.object({
  /** Inclusive lower bound for `medium` (e.g. 30 → ≥30% and < large). */
  mediumPercent: z.number().min(0).max(100),
  /** Inclusive lower bound for `large` (e.g. 60 → ≥60%). Must be > mediumPercent. */
  largePercent: z.number().min(0).max(100),
});
export type PrintCoverageThresholds = z.infer<typeof printCoverageThresholdsSchema>;

export const DEFAULT_PRINT_COVERAGE_THRESHOLDS: PrintCoverageThresholds = {
  mediumPercent: 30,
  largePercent: 60,
};

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
  /** Extra charge when the customer picks ChatGPT / Gemini stylization on the AI flow. */
  aiProviderSurchargeTenge: z
    .record(aiProviderSchema, z.number().nonnegative())
    .default({ standard: 0, chatgpt: 1500, gemini: 1500 }),
  /** % of print-zone area occupied → small / medium / large. */
  printCoverageThresholds: printCoverageThresholdsSchema.default(DEFAULT_PRINT_COVERAGE_THRESHOLDS),
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
  aiProviderSurchargeTenge: z.record(aiProviderSchema, z.number().nonnegative()).optional(),
  printCoverageThresholds: printCoverageThresholdsSchema.partial().optional(),
});
export type PartialPriceConfig = z.infer<typeof partialPriceConfigSchema>;

/** Seed value for central-relay's `global_price_config` row — matches shared-pricing's current constants. */
export const DEFAULT_PRICE_CONFIG: PriceConfig = {
  basePriceTenge: { tshirt: 6990, sweatshirt: 11990, cap: 4990, shopper: 3990 },
  fabricSurchargeTenge: { cotton: 0, premium: 1500 },
  sizeSurchargeTenge: { S: 0, M: 0, L: 0, XL: 500, XXL: 1000, "3XL": 1500 },
  printSizeSurchargeTenge: { small: 0, medium: 1000, large: 2000 },
  aiProviderSurchargeTenge: { standard: 0, chatgpt: 1500, gemini: 1500 },
  printCoverageThresholds: DEFAULT_PRINT_COVERAGE_THRESHOLDS,
};

export const pointPriceOverrideSchema = z.object({
  pointId: z.string(),
  config: partialPriceConfigSchema,
});
export type PointPriceOverride = z.infer<typeof pointPriceOverrideSchema>;
