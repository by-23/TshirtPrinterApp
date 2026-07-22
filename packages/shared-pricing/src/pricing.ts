import {
  DEFAULT_PRICE_CONFIG,
  garmentUsesSizeFabric,
  type GarmentFabric,
  type GarmentType,
  type PriceConfig,
  type PrintSize,
} from "@tshirt/shared-types";

export interface PriceInput {
  garmentType: GarmentType;
  fabric: GarmentFabric;
  size: string;
  printSize: PrintSize;
}

/** One row of the order summary (`ВАШ ЗАКАЗ` on `docs/ui-mockups/checkout.png`). */
export type PriceBreakdownKey = "garment" | "design" | "size" | "side";

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

/**
 * Single-side pricing only for now — the mockup's "Сторона печати" row is
 * always `+0 ₸`. Charging extra for a second (front + back) print is future
 * scope once orders support more than one side.
 */
const SIDE_SURCHARGE_TENGE = 0;

/**
 * `цена = f(тип одежды, ткань, размер, размер принта)` — see `docs/PLAN.md`.
 * Returns the four line items shown in the checkout order summary, in the
 * same order as the mockup: Футболка → Дизайн → Размер → Сторона печати.
 *
 * `config` defaults to `DEFAULT_PRICE_CONFIG` (Stage 6 hardcoded values) so
 * existing call sites keep working unchanged; pass the point's synced
 * `PriceConfig` (Stage 7, `GET /pricing` on point-server) once available.
 */
export function getPriceBreakdown(
  input: PriceInput,
  config: PriceConfig = DEFAULT_PRICE_CONFIG,
): PriceBreakdownLine[] {
  // Cap/shopper are one-size/one-material (see `garmentUsesSizeFabric`) — the
  // editor pins `size`/`fabric` to fixed values for them, so their surcharges
  // must stay excluded here too, or a leftover t-shirt selection would leak
  // into the price.
  const usesSizeFabric = garmentUsesSizeFabric(input.garmentType);
  const garmentAmount =
    (config.basePriceTenge[input.garmentType] ?? DEFAULT_PRICE_CONFIG.basePriceTenge.tshirt ?? 0) +
    (usesSizeFabric ? config.fabricSurchargeTenge[input.fabric] ?? 0 : 0);
  const designAmount = config.printSizeSurchargeTenge[input.printSize] ?? 0;
  const sizeAmount = usesSizeFabric ? config.sizeSurchargeTenge[input.size] ?? 0 : 0;

  return [
    { key: "garment", amountTenge: garmentAmount },
    { key: "design", amountTenge: designAmount },
    { key: "size", amountTenge: sizeAmount },
    { key: "side", amountTenge: SIDE_SURCHARGE_TENGE },
  ];
}

export function calculatePriceTenge(input: PriceInput, config: PriceConfig = DEFAULT_PRICE_CONFIG): number {
  return getPriceBreakdown(input, config).reduce((sum, line) => sum + line.amountTenge, 0);
}
