import type { Canvas } from "fabric";
import {
  DEFAULT_PRINT_COVERAGE_THRESHOLDS,
  garmentHasSelectableBackSide,
  type GarmentSide,
  type GarmentType,
  type PrintCoverageThresholds,
  type PrintSize,
} from "@tshirt/shared-types";
import { printSizeFromCoverageRatio } from "@tshirt/shared-pricing";
import { usePricingConfigStore } from "../lib/pricingConfigStore.js";
import { canvasHasDesign, fabricJsonHasDesign, getDesignAreaSize } from "./selectionControlOverscan.js";
import {
  useEditorStore,
  type CanvasSnapshots,
  type HasDesignBySide,
  type PrintSizeBySide,
} from "./store.js";

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

/** Recompute coverage for `side` and persist both the tier and whether it has artwork. */
export function syncPrintSizeFromCanvas(side: GarmentSide, canvas: Canvas | null): PrintSize {
  const printSize = computePrintSize(canvas);
  useEditorStore.getState().setPrintSize(side, printSize, Boolean(canvas && canvasHasDesign(canvas)));
  return printSize;
}

/**
 * Print-size tiers of every side that actually has artwork.
 * Uses the live flag and the saved snapshot so switching front/back cannot
 * drop the hidden side from the price.
 * Empty editor → `["small"]` so the live price still matches the single-side default.
 */
export function collectDesignedPrintSizes(
  garmentType: GarmentType,
  printSizeBySide: PrintSizeBySide,
  hasDesignBySide: HasDesignBySide,
  canvasSnapshots: CanvasSnapshots,
): PrintSize[] {
  const sides: GarmentSide[] = garmentHasSelectableBackSide(garmentType) ? ["front", "back"] : ["front"];
  const designed = sides.filter(
    (side) => hasDesignBySide[side] || fabricJsonHasDesign(canvasSnapshots[side]),
  );
  return designed.length > 0 ? designed.map((side) => printSizeBySide[side]) : ["small"];
}
