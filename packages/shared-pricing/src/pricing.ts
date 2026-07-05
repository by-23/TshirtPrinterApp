import type { GarmentFabric, GarmentType, PrintSize } from "@tshirt/shared-types";

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

/** Garment type base price — the mockup's "Футболка" row. */
export const BASE_PRICE_TENGE: Record<GarmentType, number> = {
  tshirt: 6990,
  hoodie: 11990,
};

/** Fabric surcharge, folded into the same "Футболка" row as the base price. */
export const FABRIC_SURCHARGE_TENGE: Record<GarmentFabric, number> = {
  cotton: 0,
  premium: 1500,
};

/** Garment size surcharge — the mockup's "Размер" row. */
export const SIZE_SURCHARGE_TENGE: Record<string, number> = {
  S: 0,
  M: 0,
  L: 0,
  XL: 500,
  XXL: 1000,
  "3XL": 1500,
};

/**
 * Print-size surcharge, folded into the mockup's "Дизайн" row — there's no
 * dedicated S/M/L print-size row on `checkout.png`, and print size itself is
 * auto-detected from the canvas (see `editor/printSize.ts`), not picked by
 * the customer, so it reads most naturally as part of the design cost.
 */
export const PRINT_SIZE_SURCHARGE_TENGE: Record<PrintSize, number> = {
  small: 0,
  medium: 1000,
  large: 2000,
};

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
 */
export function getPriceBreakdown(input: PriceInput): PriceBreakdownLine[] {
  const garmentAmount =
    (BASE_PRICE_TENGE[input.garmentType] ?? BASE_PRICE_TENGE.tshirt) +
    (FABRIC_SURCHARGE_TENGE[input.fabric] ?? 0);
  const designAmount = PRINT_SIZE_SURCHARGE_TENGE[input.printSize] ?? 0;
  const sizeAmount = SIZE_SURCHARGE_TENGE[input.size] ?? 0;

  return [
    { key: "garment", amountTenge: garmentAmount },
    { key: "design", amountTenge: designAmount },
    { key: "size", amountTenge: sizeAmount },
    { key: "side", amountTenge: SIDE_SURCHARGE_TENGE },
  ];
}

export function calculatePriceTenge(input: PriceInput): number {
  return getPriceBreakdown(input).reduce((sum, line) => sum + line.amountTenge, 0);
}
