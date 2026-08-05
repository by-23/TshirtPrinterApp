import type { Canvas } from "fabric";
import { MOCKUP_DISPLAY_SCALE, MOCKUP_HEIGHT, MOCKUP_WIDTH, type PrintAreaRect } from "./mockup/garmentShape.js";

/** Padding around the print-area so selection controls cover the whole mockup. */
export interface ControlOverscanInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const overscanByCanvas = new WeakMap<Canvas, ControlOverscanInsets>();

/** Full mockup pixel size — the selection/control layer spans this entire block. */
export function getMockupPixelSize() {
  return {
    width: MOCKUP_WIDTH * MOCKUP_DISPLAY_SCALE,
    height: MOCKUP_HEIGHT * MOCKUP_DISPLAY_SCALE,
  };
}

/** Insets from mockup edges to the print-area rect (scene origin). */
export function computeMockupControlOverscan(printArea: PrintAreaRect): ControlOverscanInsets {
  const scale = MOCKUP_DISPLAY_SCALE;
  return {
    left: printArea.x * scale,
    top: printArea.y * scale,
    right: (MOCKUP_WIDTH - printArea.x - printArea.width) * scale,
    bottom: (MOCKUP_HEIGHT - printArea.y - printArea.height) * scale,
  };
}

export function getControlOverscanInsets(canvas: Canvas): ControlOverscanInsets {
  return overscanByCanvas.get(canvas) ?? { left: 0, top: 0, right: 0, bottom: 0 };
}

/** Print-area size in scene units (excludes mockup gutter around the design). */
export function getDesignAreaSize(canvas: Canvas): { width: number; height: number } {
  const insets = getControlOverscanInsets(canvas);
  return {
    width: canvas.getWidth() - insets.left - insets.right,
    height: canvas.getHeight() - insets.top - insets.bottom,
  };
}

/**
 * Keep scene coords print-area-relative while the bitmap covers the full mockup.
 * When called without `insets`, re-applies the last insets stored for this canvas
 * (e.g. after `loadFromJSON` / undo).
 */
export function applySelectionControlOverscan(canvas: Canvas, insets?: ControlOverscanInsets) {
  const resolved = insets ?? overscanByCanvas.get(canvas);
  if (!resolved) return;
  overscanByCanvas.set(canvas, resolved);
  canvas.setViewportTransform([1, 0, 0, 1, resolved.left, resolved.top]);
}

/** Cap Fabric export scale so a kiosk tablet doesn't OOM on huge print areas. */
const DTF_EXPORT_MAX_MULTIPLIER = 20;

/**
 * Fabric `toDataURL` multiplier so the PNG is ≈ `widthMm` at `dpi`
 * (server later resizes exactly). Falls back to 2 when size is unknown.
 */
export function computeDtfExportMultiplier(
  canvas: Canvas,
  widthMm: number,
  dpi = 300,
): number {
  const { width } = getDesignAreaSize(canvas);
  if (width <= 0 || widthMm <= 0) return 2;
  const targetPx = (widthMm / 25.4) * dpi;
  return Math.min(DTF_EXPORT_MAX_MULTIPLIER, Math.max(2, Math.ceil(targetPx / width)));
}

/** PNG of just the print-area design (no mockup gutter, no selection chrome). */
export function exportPrintAreaDataURL(
  canvas: Canvas,
  options?: { multiplier?: number; format?: "png" | "jpeg" },
): string {
  const insets = getControlOverscanInsets(canvas);
  const { width, height } = getDesignAreaSize(canvas);
  return canvas.toDataURL({
    format: options?.format ?? "png",
    multiplier: options?.multiplier ?? 2,
    left: insets.left,
    top: insets.top,
    width,
    height,
  });
}
