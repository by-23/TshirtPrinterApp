import { DEFAULT_PRINT_AREAS, MOCKUP_HEIGHT, MOCKUP_WIDTH, type PrintAreaRect } from "@tshirt/shared-types";
import { getPrintAreaConfig } from "../print-area/config.js";

export { MOCKUP_WIDTH, MOCKUP_HEIGHT };
export type { PrintAreaRect };

/** @deprecated Use `getPrintAreas()` — kept for type re-exports only. */
export const PRINT_AREAS = DEFAULT_PRINT_AREAS;

export async function getPrintAreas() {
  const { areas } = await getPrintAreaConfig();
  return areas;
}
