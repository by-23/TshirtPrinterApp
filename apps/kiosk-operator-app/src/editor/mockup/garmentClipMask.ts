import type { CSSProperties } from "react";
import type { GarmentSide, GarmentType, PrintAreaRect } from "@tshirt/shared-types";
import { bodyPolygonPoints, MOCKUP_DISPLAY_SCALE, MOCKUP_HEIGHT, MOCKUP_WIDTH } from "./garmentShape.js";

/** Native flat-lay asset size — must match `TshirtMockup.tsx` / point-server compositing. */
const TSHIRT_PHOTO_WIDTH = 640;
const TSHIRT_PHOTO_HEIGHT = 677;

export interface GarmentClipMaskInput {
  garmentType: GarmentType;
  side: GarmentSide;
  printArea: PrintAreaRect;
  /** Alpha silhouette source for t-shirt clipping (white flat-lay PNG). */
  tshirtImageUrl?: string;
}

function getTshirtLetterboxMetrics() {
  const boxWidth = MOCKUP_WIDTH * MOCKUP_DISPLAY_SCALE;
  const boxHeight = MOCKUP_HEIGHT * MOCKUP_DISPLAY_SCALE;
  const containScale = Math.min(boxWidth / TSHIRT_PHOTO_WIDTH, boxHeight / TSHIRT_PHOTO_HEIGHT);
  const renderedWidth = TSHIRT_PHOTO_WIDTH * containScale;
  const renderedHeight = TSHIRT_PHOTO_HEIGHT * containScale;
  const offsetX = (boxWidth - renderedWidth) / 2;
  const offsetY = (boxHeight - renderedHeight) / 2;
  return { renderedWidth, renderedHeight, offsetX, offsetY };
}

function hoodieSilhouetteSvgDataUrl(side: GarmentSide): string {
  const bodyPoints = bodyPolygonPoints(side);
  const hoodPath = "M90,45 Q150,-15 210,45 Q190,65 150,58 Q110,65 90,45 Z";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MOCKUP_WIDTH} ${MOCKUP_HEIGHT}">` +
    `<path d="${hoodPath}" fill="white"/>` +
    `<polygon points="${bodyPoints}" fill="white"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export interface GarmentClipLayout {
  maskUrl: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

function resolveGarmentClipLayout(input: GarmentClipMaskInput): GarmentClipLayout | null {
  const scale = MOCKUP_DISPLAY_SCALE;
  const { x, y } = input.printArea;
  const mockupWidthPx = MOCKUP_WIDTH * scale;
  const mockupHeightPx = MOCKUP_HEIGHT * scale;

  let maskUrl: string;
  let maskWidth: number;
  let maskHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (input.garmentType === "tshirt") {
    if (!input.tshirtImageUrl) return null;
    const metrics = getTshirtLetterboxMetrics();
    maskUrl = input.tshirtImageUrl;
    maskWidth = metrics.renderedWidth;
    maskHeight = metrics.renderedHeight;
    offsetX = metrics.offsetX;
    offsetY = metrics.offsetY;
  } else {
    maskUrl = hoodieSilhouetteSvgDataUrl(input.side);
    maskWidth = mockupWidthPx;
    maskHeight = mockupHeightPx;
    offsetX = 0;
    offsetY = 0;
  }

  return {
    maskUrl,
    left: offsetX - x * scale,
    top: offsetY - y * scale,
    width: maskWidth,
    height: maskHeight,
  };
}

export function getGarmentClipLayout(input: GarmentClipMaskInput): GarmentClipLayout | null {
  return resolveGarmentClipLayout(input);
}

/**
 * CSS mask that clips the Fabric canvas to the garment silhouette. The mask is
 * aligned to the full mockup (600×680) and offset for the print-area overlay,
 * mirroring `printAreaToPhotoPixels()` letterboxing on the server.
 */
export function getGarmentClipMaskStyle(input: GarmentClipMaskInput): CSSProperties {
  const layout = resolveGarmentClipLayout(input);
  if (!layout) return {};

  return {
    WebkitMaskImage: `url("${layout.maskUrl}")`,
    maskImage: `url("${layout.maskUrl}")`,
    WebkitMaskSize: `${layout.width}px ${layout.height}px`,
    maskSize: `${layout.width}px ${layout.height}px`,
    WebkitMaskPosition: `${layout.left}px ${layout.top}px`,
    maskPosition: `${layout.left}px ${layout.top}px`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
  };
}

/**
 * Multiply-blend overlay that reuses the flat-lay photo itself (desaturated)
 * as a lighting/shadow map on top of the printed design, so a flat design
 * picks up the garment's real folds/shadows instead of looking pasted on
 * flat fabric. Self-contained (bundles its own garment-silhouette mask using
 * the same alignment math as `getGarmentClipMaskStyle`), so it can be
 * dropped in as a standalone absolutely-positioned overlay `div` above the
 * design layer. Only meaningful for the photographed t-shirt garment — the
 * hoodie mockup is a flat vector shape with no real shading to borrow.
 */
export function getFabricShadingOverlayStyle(input: GarmentClipMaskInput): CSSProperties {
  if (input.garmentType !== "tshirt" || !input.tshirtImageUrl) return {};
  const layout = resolveGarmentClipLayout(input);
  if (!layout) return {};

  return {
    backgroundImage: `url("${layout.maskUrl}")`,
    backgroundSize: `${layout.width}px ${layout.height}px`,
    backgroundPosition: `${layout.left}px ${layout.top}px`,
    backgroundRepeat: "no-repeat",
    WebkitMaskImage: `url("${layout.maskUrl}")`,
    maskImage: `url("${layout.maskUrl}")`,
    WebkitMaskSize: `${layout.width}px ${layout.height}px`,
    maskSize: `${layout.width}px ${layout.height}px`,
    WebkitMaskPosition: `${layout.left}px ${layout.top}px`,
    maskPosition: `${layout.left}px ${layout.top}px`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    // Brightness/contrast tuned so the photo's near-white lit areas wash out
    // to ~white (no darkening) while its fold shadows stay visible — tweak
    // here if real garment photos need more/less punch.
    filter: "grayscale(1) brightness(1.12) contrast(0.9)",
    mixBlendMode: "multiply",
    pointerEvents: "none",
  };
}
