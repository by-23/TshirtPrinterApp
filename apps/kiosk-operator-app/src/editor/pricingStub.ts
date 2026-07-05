import type { GarmentType } from "@tshirt/shared-types";

/**
 * Rough placeholder used only to render the price block in the editor UI
 * (`docs/ui-mockups/editor.png` requires it visually on Stage 2). The real
 * formula (`price = f(тип одежды, ткань, размер, размер принта)`) is
 * `shared-pricing`, planned for Stage 4 — do not build it out here.
 */
const BASE_PRICE_TENGE: Record<GarmentType, number> = {
  tshirt: 6990,
  hoodie: 11990,
};

const SIZE_SURCHARGE_TENGE: Record<string, number> = {
  XS: 0,
  S: 0,
  M: 0,
  L: 0,
  XL: 500,
  XXL: 1000,
  "3XL": 1500,
};

export function estimatePriceTenge(garmentType: GarmentType, size: string): number {
  const base = BASE_PRICE_TENGE[garmentType] ?? BASE_PRICE_TENGE.tshirt;
  const surcharge = SIZE_SURCHARGE_TENGE[size] ?? 0;
  return base + surcharge;
}

export const ESTIMATED_LEAD_TIME_KEY = "editor.price.leadTimeValue";
