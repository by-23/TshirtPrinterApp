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
 * Shared coordinate space for all garment mockups, so the Fabric.js
 * print-area overlay (see FabricCanvas.tsx) can be positioned as simple
 * percentages regardless of the rendered pixel size.
 */
export const MOCKUP_VIEW_BOX = `0 0 ${MOCKUP_WIDTH} ${MOCKUP_HEIGHT}`;

/**
 * How many screen pixels correspond to one mockup viewBox unit. Kept as a
 * single fixed scale (rather than a fluid/responsive one) since the kiosk
 * runs full-screen on known hardware; both the mockup photo and the Fabric
 * canvas are sized off this constant so the print-area overlay always lines
 * up pixel-for-pixel with the garment artwork.
 */
export const MOCKUP_DISPLAY_SCALE = 2;

/** Fallback until `printAreaStore` loads the operator-tuned config from point-server. */
export const PRINT_AREAS = DEFAULT_PRINT_AREAS;

export interface GarmentMockupProps {
  color: string;
  side: GarmentSide;
  className?: string;
  /** Override flat-lay photo (e.g. home popular-prints mockup). */
  imageUrl?: string;
  /** CSS aspect-ratio for the photo box; defaults to the garment's native flat-lay ratio. */
  aspectRatio?: string;
}
