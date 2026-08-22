import {
  DEFAULT_PRICE_CONFIG,
  DEFAULT_PRINT_COVERAGE_THRESHOLDS,
  garmentUsesSizeFabric,
  type AiProvider,
  type GarmentFabric,
  type GarmentType,
  type PriceConfig,
  type PrintCoverageThresholds,
  type PrintSize,
} from "@tshirt/shared-types";

export interface PriceInput {
  garmentType: GarmentType;
  fabric: GarmentFabric;
  size: string;
  /** Print size of the first designed side (front or back). */
  printSize: PrintSize;
  /**
   * Print sizes of every extra designed side (the other of front/back).
   * Each side is charged on its own coverage tier and the surcharges are summed.
   */
  extraPrintSizes?: PrintSize[];
  /** AI stylization provider — only set for `ai_style` orders; defaults to no surcharge. */
  aiProvider?: AiProvider;
}

/** One row of the order summary (`ВАШ ЗАКАЗ` on `docs/ui-mockups/checkout.png`). */
export type PriceBreakdownKey = "garment" | "design" | "size" | "side" | "ai";

export interface PriceBreakdownLine {
  key: PriceBreakdownKey;
  amountTenge: number;
}

/**
 * Fallback pricing, used whenever the caller doesn't have (or doesn't need)
 * a live `PriceConfig` — e.g. before the point has ever synced with
 * central-relay. Mirrors `DEFAULT_PRICE_CONFIG` from `@tshirt/shared-types`,
 * which is the actual source of truth (also seeded as central-relay's
 * `global_price_config`).
 */
export const BASE_PRICE_TENGE = DEFAULT_PRICE_CONFIG.basePriceTenge;
export const FABRIC_SURCHARGE_TENGE = DEFAULT_PRICE_CONFIG.fabricSurchargeTenge;
export const SIZE_SURCHARGE_TENGE = DEFAULT_PRICE_CONFIG.sizeSurchargeTenge;
export const PRINT_SIZE_SURCHARGE_TENGE = DEFAULT_PRICE_CONFIG.printSizeSurchargeTenge;
export const AI_PROVIDER_SURCHARGE_TENGE = DEFAULT_PRICE_CONFIG.aiProviderSurchargeTenge;

function printSizeSurcharge(printSize: PrintSize, config: PriceConfig): number {
  return config.printSizeSurchargeTenge[printSize] ?? 0;
}

function singleSideAmounts(input: PriceInput, printSize: PrintSize, config: PriceConfig) {
  const usesSizeFabric = garmentUsesSizeFabric(input.garmentType);
  const garmentAmount =
    (config.basePriceTenge[input.garmentType] ?? DEFAULT_PRICE_CONFIG.basePriceTenge.tshirt ?? 0) +
    (usesSizeFabric ? config.fabricSurchargeTenge[input.fabric] ?? 0 : 0);
  const sizeAmount = usesSizeFabric ? config.sizeSurchargeTenge[input.size] ?? 0 : 0;
  const aiProvider = input.aiProvider ?? "standard";
  const aiSurchargeMap = config.aiProviderSurchargeTenge ?? DEFAULT_PRICE_CONFIG.aiProviderSurchargeTenge;
  return {
    garmentAmount,
    designAmount: printSizeSurcharge(printSize, config),
    sizeAmount,
    aiAmount: aiSurchargeMap[aiProvider] ?? 0,
  };
}

/**
 * Each designed side is priced on its own (garment + fabric + size + print + AI)
 * and the sides are added together. One side → same as before; front + back →
 * `цена(перед) + цена(зад)`.
 */
export function getPriceBreakdown(
  input: PriceInput,
  config: PriceConfig = DEFAULT_PRICE_CONFIG,
): PriceBreakdownLine[] {
  const printSizes = [input.printSize, ...(input.extraPrintSizes ?? [])];
  const totals = printSizes.reduce(
    (sum, printSize) => {
      const side = singleSideAmounts(input, printSize, config);
      return {
        garmentAmount: sum.garmentAmount + side.garmentAmount,
        designAmount: sum.designAmount + side.designAmount,
        sizeAmount: sum.sizeAmount + side.sizeAmount,
        aiAmount: sum.aiAmount + side.aiAmount,
      };
    },
    { garmentAmount: 0, designAmount: 0, sizeAmount: 0, aiAmount: 0 },
  );

  return [
    { key: "garment", amountTenge: totals.garmentAmount },
    { key: "design", amountTenge: totals.designAmount },
    { key: "size", amountTenge: totals.sizeAmount },
    { key: "side", amountTenge: 0 },
    { key: "ai", amountTenge: totals.aiAmount },
  ];
}

export function calculatePriceTenge(input: PriceInput, config: PriceConfig = DEFAULT_PRICE_CONFIG): number {
  return getPriceBreakdown(input, config).reduce((sum, line) => sum + line.amountTenge, 0);
}

/**
 * Maps print-zone coverage ratio (0–1) to the three-tier `PrintSize` used by
 * `printSizeSurchargeTenge`. Thresholds come from admin `PriceConfig`.
 *
 * - ratio < medium% → small
 * - medium% ≤ ratio < large% → medium
 * - ratio ≥ large% → large
 */
export function printSizeFromCoverageRatio(
  ratio: number,
  thresholds: PrintCoverageThresholds = DEFAULT_PRINT_COVERAGE_THRESHOLDS,
): PrintSize {
  const medium = Math.min(thresholds.mediumPercent, thresholds.largePercent) / 100;
  const large = Math.max(thresholds.mediumPercent, thresholds.largePercent) / 100;
  if (ratio < medium) return "small";
  if (ratio < large) return "medium";
  return "large";
}
