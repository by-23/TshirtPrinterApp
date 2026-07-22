import {
  DEFAULT_PRINT_AREAS,
  MOCKUP_HEIGHT,
  MOCKUP_WIDTH,
  type GarmentSide,
  type PrintAreaRect,
} from "@tshirt/shared-types";

export { MOCKUP_WIDTH, MOCKUP_HEIGHT };
export type { PrintAreaRect };

/**
 * Shared coordinate space for all garment mockup SVGs, so the Fabric.js
 * print-area overlay (see FabricCanvas.tsx) can be positioned as simple
 * percentages regardless of the rendered pixel size.
 */
export const MOCKUP_VIEW_BOX = `0 0 ${MOCKUP_WIDTH} ${MOCKUP_HEIGHT}`;

/**
 * How many screen pixels correspond to one mockup viewBox unit. Kept as a
 * single fixed scale (rather than a fluid/responsive one) since the kiosk
 * runs full-screen on known hardware; both the mockup SVG and the Fabric
 * canvas are sized off this constant so the print-area overlay always lines
 * up pixel-for-pixel with the garment artwork.
 */
export const MOCKUP_DISPLAY_SCALE = 2;

const NECKLINE_FRONT = "125,48 150,62 175,48";
const NECKLINE_BACK = "125,46 150,42 175,46";

/**
 * Body + sleeves silhouette shared by the t-shirt and hoodie mockups.
 * Only the neckline differs between front/back.
 */
export function bodyPolygonPoints(side: GarmentSide): string {
  const neckline = side === "front" ? NECKLINE_FRONT : NECKLINE_BACK;
  return ["55,70", "95,35", neckline, "205,35", "245,70", "222,118", "205,100", "205,300", "95,300", "95,100", "78,118"].join(
    " ",
  );
}

export function collarPath(side: GarmentSide): string {
  return side === "front" ? "M120,46 Q150,58 180,46" : "M120,44 Q150,40 180,44";
}

/** Fallback until `printAreaStore` loads the operator-tuned config from point-server. */
export const PRINT_AREAS = DEFAULT_PRINT_AREAS;

export interface GarmentMockupProps {
  color: string;
  side: GarmentSide;
  className?: string;
  /** Override flat-lay photo (e.g. home popular-prints mockup). */
  imageUrl?: string;
  /** CSS aspect-ratio for the photo box; defaults to editor flat-lay ratio. */
  aspectRatio?: string;
}
