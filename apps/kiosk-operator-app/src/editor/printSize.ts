import type { Canvas } from "fabric";
import type { PrintSize } from "@tshirt/shared-types";

/** Combined-bounding-box-area ratio thresholds against the print area. */
const MEDIUM_THRESHOLD = 0.3;
const LARGE_THRESHOLD = 0.6;

/**
 * There's no S/M/L print-size picker on the editor mockup — the price
 * formula's "размер принта" is instead inferred from how much of the print
 * area the customer's design actually fills, using the combined bounding box
 * of every object on the canvas (which is already sized to the print area in
 * pixels, see `FabricCanvas.tsx` / `MOCKUP_DISPLAY_SCALE`).
 */
export function computePrintSize(canvas: Canvas | null): PrintSize {
  if (!canvas) return "small";
  const objects = canvas.getObjects();
  if (objects.length === 0) return "small";

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const object of objects) {
    const rect = object.getBoundingRect();
    minX = Math.min(minX, rect.left);
    minY = Math.min(minY, rect.top);
    maxX = Math.max(maxX, rect.left + rect.width);
    maxY = Math.max(maxY, rect.top + rect.height);
  }

  const canvasArea = canvas.getWidth() * canvas.getHeight();
  if (canvasArea <= 0) return "small";

  const boundingArea = Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
  const ratio = boundingArea / canvasArea;

  if (ratio < MEDIUM_THRESHOLD) return "small";
  if (ratio < LARGE_THRESHOLD) return "medium";
  return "large";
}
