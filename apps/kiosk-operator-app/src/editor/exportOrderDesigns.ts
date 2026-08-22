import type { Canvas } from "fabric";
import {
  DEFAULT_DTF_PRINTER_CONFIG,
  garmentHasSelectableBackSide,
  getPrintSizeMm,
  type GarmentSide,
  type GarmentType,
  type PrintSize,
} from "@tshirt/shared-types";
import { snapshotCanvasJson } from "./applyGarmentClipToCanvas.js";
import { computePrintSize } from "./printSize.js";
import { useEditorStore } from "./store.js";
import { usePrintAreaStore } from "../lib/printAreaStore.js";
import {
  canvasHasDesign,
  computeDtfExportMultiplier,
  computeDtfExportMultiplierForArea,
  exportPrintAreaDataURL,
  exportPrintAreaFromSnapshot,
  fabricJsonHasDesign,
} from "./selectionControlOverscan.js";

export interface ExportedSideDesign {
  side: GarmentSide;
  printSize: PrintSize;
  designImageBase64: string;
  canvasSnapshot: string;
}

/**
 * Exports every side that actually has artwork. The live canvas is snapshotted
 * first so switching front/back never drops the hidden side on "Печать".
 */
export async function exportDesignedSides(
  liveCanvas: Canvas,
  liveSide: GarmentSide,
  garmentType: GarmentType,
): Promise<ExportedSideDesign[]> {
  const liveSnapshot = snapshotCanvasJson(liveCanvas);
  const livePrintSize = computePrintSize(liveCanvas);
  useEditorStore.getState().setCanvasSnapshot(liveSide, liveSnapshot);
  useEditorStore.getState().setPrintSize(liveSide, livePrintSize);

  const sides: GarmentSide[] = garmentHasSelectableBackSide(garmentType) ? ["front", "back"] : ["front"];
  const snapshots = useEditorStore.getState().canvasSnapshots;
  const printSizeBySide = useEditorStore.getState().printSizeBySide;
  const printAreas = usePrintAreaStore.getState().areas;
  const exported: ExportedSideDesign[] = [];

  for (const side of sides) {
    const isLive = side === liveSide;
    const snapshot = isLive ? liveSnapshot : snapshots[side];
    const hasDesign = isLive ? canvasHasDesign(liveCanvas) : fabricJsonHasDesign(snapshot);
    if (!hasDesign || !snapshot) continue;

    const dtfSizeMm = getPrintSizeMm(DEFAULT_DTF_PRINTER_CONFIG, garmentType, side);
    const designImageBase64 = isLive
      ? exportPrintAreaDataURL(liveCanvas, {
          multiplier: computeDtfExportMultiplier(
            liveCanvas,
            dtfSizeMm.widthMm,
            DEFAULT_DTF_PRINTER_CONFIG.dpi,
          ),
        })
      : await exportPrintAreaFromSnapshot(snapshot, printAreas[garmentType][side], {
          multiplier: computeDtfExportMultiplierForArea(
            printAreas[garmentType][side],
            dtfSizeMm.widthMm,
            DEFAULT_DTF_PRINTER_CONFIG.dpi,
          ),
        });

    exported.push({
      side,
      printSize: isLive ? livePrintSize : printSizeBySide[side],
      designImageBase64,
      canvasSnapshot: snapshot,
    });
  }

  return exported;
}
