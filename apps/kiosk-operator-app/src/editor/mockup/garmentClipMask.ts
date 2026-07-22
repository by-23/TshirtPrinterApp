import type { CSSProperties } from "react";
import { GARMENT_PHOTO_HEIGHT, GARMENT_PHOTO_WIDTH, type GarmentSide, type GarmentType, type PrintAreaRect } from "@tshirt/shared-types";
import { MOCKUP_DISPLAY_SCALE, MOCKUP_HEIGHT, MOCKUP_WIDTH } from "./garmentShape.js";

/** Home "Популярные принты" mockups (`tshirt-popular-white/black.png`) — a separate, larger t-shirt-only render. */
export const TSHIRT_POPULAR_PHOTO_WIDTH = 768;
export const TSHIRT_POPULAR_PHOTO_HEIGHT = 892;

export interface GarmentClipMaskInput {
  garmentType: GarmentType;
  side: GarmentSide;
  printArea: PrintAreaRect;
  /** Alpha silhouette source for clipping (white flat-lay PNG for this garment type/side). */
  imageUrl?: string;
  /** Native photo size for letterbox math (defaults to the shared square garment photo size). */
  photoWidth?: number;
  photoHeight?: number;
}

function getGarmentLetterboxMetrics(photoWidth = GARMENT_PHOTO_WIDTH, photoHeight = GARMENT_PHOTO_HEIGHT) {
  const boxWidth = MOCKUP_WIDTH * MOCKUP_DISPLAY_SCALE;
  const boxHeight = MOCKUP_HEIGHT * MOCKUP_DISPLAY_SCALE;
  const containScale = Math.min(boxWidth / photoWidth, boxHeight / photoHeight);
  const renderedWidth = photoWidth * containScale;
  const renderedHeight = photoHeight * containScale;
  const offsetX = (boxWidth - renderedWidth) / 2;
  const offsetY = (boxHeight - renderedHeight) / 2;
  return { renderedWidth, renderedHeight, offsetX, offsetY };
}

export interface GarmentClipLayout {
  maskUrl: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

function resolveGarmentClipLayout(input: GarmentClipMaskInput): GarmentClipLayout | null {
  if (!input.imageUrl) return null;
  const { x, y } = input.printArea;
  const scale = MOCKUP_DISPLAY_SCALE;

  const metrics = getGarmentLetterboxMetrics(input.photoWidth, input.photoHeight);

  return {
    maskUrl: input.imageUrl,
    left: metrics.offsetX - x * scale,
    top: metrics.offsetY - y * scale,
    width: metrics.renderedWidth,
    height: metrics.renderedHeight,
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
 * design layer.
 */
export function getFabricShadingOverlayStyle(input: GarmentClipMaskInput): CSSProperties {
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
