import type { Canvas } from "fabric";
import type { PrintCoverageThresholds, PrintSize } from "@tshirt/shared-types";
import { DEFAULT_PRINT_COVERAGE_THRESHOLDS } from "@tshirt/shared-types";
import { printSizeFromCoverageRatio } from "@tshirt/shared-pricing";
import { usePricingConfigStore } from "../lib/pricingConfigStore.js";
import { getDesignAreaSize } from "./selectionControlOverscan.js";

/**
 * There's no S/M/L print-size picker on the editor mockup — the price
 * formula's "размер принта" is instead inferred from how much of the print
 * area the customer's design actually fills, using the combined bounding box
 * of every object on the canvas (scene coords = print area; see
 * `FabricCanvas.tsx` / `MOCKUP_DISPLAY_SCALE`).
 *
 * Thresholds (default 30% / 60%) come from admin `PriceConfig.printCoverageThresholds`.
 */
export function computePrintSize(
  canvas: Canvas | null,
  thresholds?: PrintCoverageThresholds,
): PrintSize {
  const effectiveThresholds =
    thresholds ??
    usePricingConfigStore.getState().config.printCoverageThresholds ??
    DEFAULT_PRINT_COVERAGE_THRESHOLDS;

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

  const design = getDesignAreaSize(canvas);
  const canvasArea = design.width * design.height;
  if (canvasArea <= 0) return "small";

  const boundingArea = Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
  const ratio = boundingArea / canvasArea;

  return printSizeFromCoverageRatio(ratio, effectiveThresholds);
}
