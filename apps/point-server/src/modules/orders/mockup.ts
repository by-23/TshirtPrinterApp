import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import type { GarmentSide, GarmentType } from "@tshirt/shared-types";
import { dataPath } from "../../lib/dataDir.js";
import { MOCKUP_HEIGHT, MOCKUP_WIDTH, getPrintAreas } from "./garmentGeometry.js";

/** Per-order mockup / DTF PNGs under DATA_DIR/orders (served at /files/orders/...). */
const ORDERS_DIR = dataPath("orders");
/** Original unmirrored print-area — kept out of the cashier-facing order folder. */
const SOURCES_DIR = dataPath("order-sources");
const ASSETS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../assets/garments");

/** Matches the client's `MOCKUP_DISPLAY_SCALE` — arbitrary (cancels out in the math below) but kept for readability/parity. */
const RENDER_SCALE = 2;

function garmentPhotoPath(type: GarmentType, side: GarmentSide): string {
  const suffix = side === "back" ? "-back" : "";
  return path.join(ASSETS_DIR, `${type}-white${suffix}.png`);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  const int = Number.parseInt(value, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Maps the print-area rect (defined in the shared 300×340 mockup viewBox
 * space) into the native pixel space of a raster garment photo that's been
 * letterboxed into that box via `object-contain` — mirrors what the CSS in
 * `PhotoGarmentMockup.tsx` does visually, so the composited design lands in
 * the same place the customer saw on the kiosk screen.
 */
function printAreaToPhotoPixels(
  photoWidth: number,
  photoHeight: number,
  side: GarmentSide,
  type: GarmentType,
  printAreas: Awaited<ReturnType<typeof getPrintAreas>>,
): Rect {
  const printArea = printAreas[type][side];
  const boxWidth = MOCKUP_WIDTH * RENDER_SCALE;
  const boxHeight = MOCKUP_HEIGHT * RENDER_SCALE;
  const containScale = Math.min(boxWidth / photoWidth, boxHeight / photoHeight);
  const renderedWidth = photoWidth * containScale;
  const renderedHeight = photoHeight * containScale;
  const offsetX = (boxWidth - renderedWidth) / 2;
  const offsetY = (boxHeight - renderedHeight) / 2;

  const areaXInBox = printArea.x * RENDER_SCALE;
  const areaYInBox = printArea.y * RENDER_SCALE;
  const areaWInBox = printArea.width * RENDER_SCALE;
  const areaHInBox = printArea.height * RENDER_SCALE;

  const left = Math.round((areaXInBox - offsetX) / containScale);
  const top = Math.round((areaYInBox - offsetY) / containScale);
  const width = Math.round(areaWInBox / containScale);
  const height = Math.round(areaHInBox / containScale);

  return clampRect({ left, top, width, height }, photoWidth, photoHeight);
}

function clampRect(rect: Rect, maxWidth: number, maxHeight: number): Rect {
  const left = Math.max(0, Math.min(rect.left, maxWidth - 1));
  const top = Math.max(0, Math.min(rect.top, maxHeight - 1));
  const width = Math.max(1, Math.min(rect.width, maxWidth - left));
  const height = Math.max(1, Math.min(rect.height, maxHeight - top));
  return { left, top, width, height };
}

/**
 * Every garment type is a photographed flat-lay (white PNG with real alpha
 * silhouette) — tinting a non-white color multiplies a solid-color layer
 * over the white photo, then re-masks with the original alpha so the
 * transparent background stays transparent (sharp's `tint()` alone looks
 * washed out on a near-white base since it preserves per-pixel luminance).
 * Mirrors the client's CSS `mix-blend-mode: multiply` overlay in
 * `PhotoGarmentMockup.tsx`.
 */
async function tintedGarmentBase(
  type: GarmentType,
  color: string,
  side: GarmentSide,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const isWhite = color.toLowerCase() === "#ffffff";
  const basePath = garmentPhotoPath(type, side);

  const base = sharp(basePath).ensureAlpha();
  const metadata = await base.metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  if (isWhite) {
    return { buffer: await base.png().toBuffer(), width, height };
  }

  const { r, g, b } = hexToRgb(color);
  const solid = await sharp({
    create: { width, height, channels: 4, background: { r, g, b, alpha: 1 } },
  })
    .png()
    .toBuffer();

  const buffer = await sharp(basePath)
    .ensureAlpha()
    .composite([
      { input: solid, blend: "multiply" },
      { input: basePath, blend: "dest-in" },
    ])
    .png()
    .toBuffer();
  return { buffer, width, height };
}

async function designRect(
  type: GarmentType,
  side: GarmentSide,
  baseWidth: number,
  baseHeight: number,
): Promise<Rect> {
  const printAreas = await getPrintAreas();
  return printAreaToPhotoPixels(baseWidth, baseHeight, side, type, printAreas);
}

/**
 * Multiply-blends the garment photo's own (desaturated) folds/shadows onto
 * the flat design so the print looks like it sits in the fabric rather than
 * being pasted on top of it. `linear(1, SHADING_BRIGHTEN)` pushes the
 * photo's near-white lit areas to true white first, so the highlight zones
 * of the design aren't darkened — only the real shadow creases are.
 */
const SHADING_BRIGHTEN = 25;

async function applyFabricShading(baseBuffer: Buffer, designBuffer: Buffer, rect: Rect): Promise<Buffer> {
  const shadingMap = await sharp(baseBuffer)
    .extract(rect)
    .greyscale()
    .linear(1, SHADING_BRIGHTEN)
    .toBuffer();

  return sharp(designBuffer)
    .composite([
      { input: shadingMap, blend: "multiply" },
      // Multiplying an opaque shading layer over the design can flatten its
      // alpha to fully opaque; re-mask with the design's own alpha so
      // transparent areas around the artwork stay transparent.
      { input: designBuffer, blend: "dest-in" },
    ])
    .png()
    .toBuffer();
}

function decodeDataUrl(dataUrl: string): Buffer {
  const commaIndex = dataUrl.indexOf(",");
  const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  return Buffer.from(base64, "base64");
}

export interface GenerateOrderImagesInput {
  orderId: string;
  garmentType: GarmentType;
  garmentColor: string;
  side: GarmentSide;
  designImageBase64: string;
  /** Appended to filenames (`mockup-back.png`) so a second side doesn't overwrite the primary. */
  nameSuffix?: string;
}

export interface GenerateOrderImagesResult {
  designImagePath: string;
  mockupImagePath: string;
}

function fileSuffixFor(nameSuffix?: string): string {
  return nameSuffix ? `-${nameSuffix}` : "";
}

export function orderMockupRelativePath(orderId: string, nameSuffix?: string): string {
  return `orders/${orderId}/mockup${fileSuffixFor(nameSuffix)}.png`;
}

export function orderSourceRelativePath(orderId: string, nameSuffix?: string): string {
  return `order-sources/${orderId}${fileSuffixFor(nameSuffix)}.png`;
}

function absoluteFromRelative(relativePath: string): string {
  return dataPath(...relativePath.split("/").filter(Boolean));
}

/**
 * Finds the original print-area PNG for a side. Extra sides never fall back
 * to the unsuffixed primary file.
 */
export function resolveOrderDesignAbsolutePath(input: {
  orderId: string;
  storedRelativePath: string | null;
  nameSuffix?: string;
  allowUnsuffixed?: boolean;
}): string | null {
  if (input.storedRelativePath) {
    const storedAbs = absoluteFromRelative(input.storedRelativePath);
    if (existsSync(storedAbs)) return storedAbs;
  }

  const candidates = [
    dataPath("order-sources", `${input.orderId}${fileSuffixFor(input.nameSuffix)}.png`),
    input.allowUnsuffixed ? dataPath("order-sources", `${input.orderId}.png`) : null,
    dataPath("orders", input.orderId, `design${fileSuffixFor(input.nameSuffix)}.png`),
    input.allowUnsuffixed ? dataPath("orders", input.orderId, "design.png") : null,
  ];
  return candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate))) ?? null;
}

async function writeOrderMockup(input: {
  orderId: string;
  garmentType: GarmentType;
  garmentColor: string;
  side: GarmentSide;
  designBuffer: Buffer;
  nameSuffix?: string;
}): Promise<string> {
  const orderDir = path.join(ORDERS_DIR, input.orderId);
  await mkdir(orderDir, { recursive: true });

  const { buffer: baseBuffer, width, height } = await tintedGarmentBase(
    input.garmentType,
    input.garmentColor,
    input.side,
  );
  const rect = await designRect(input.garmentType, input.side, width, height);
  const resizedDesign = await sharp(input.designBuffer).resize(rect.width, rect.height, { fit: "fill" }).png().toBuffer();
  const finalDesignLayer = await applyFabricShading(baseBuffer, resizedDesign, rect);

  const relativePath = orderMockupRelativePath(input.orderId, input.nameSuffix);
  await sharp(baseBuffer)
    .composite([{ input: finalDesignLayer, left: rect.left, top: rect.top }])
    .png()
    .toFile(path.join(orderDir, `mockup${fileSuffixFor(input.nameSuffix)}.png`));

  return relativePath;
}

/**
 * Writes mockup.png (or mockup-front/back.png) into the cashier-facing order
 * folder from the stored print-area source.
 */
export async function ensureOrderMockup(input: {
  orderId: string;
  garmentType: GarmentType;
  garmentColor: string;
  side: GarmentSide;
  designAbsolutePath: string;
  nameSuffix?: string;
}): Promise<string> {
  const designBuffer = await readFile(input.designAbsolutePath);
  return writeOrderMockup({ ...input, designBuffer });
}

/**
 * Saves the original print-area PNG outside the cashier-facing order folder
 * (so they only see mockup + mirrored DTF) and composites a photorealistic
 * mockup. Paths returned are relative to `data/`, ready to be served under `/files`.
 */
export async function generateOrderImages(input: GenerateOrderImagesInput): Promise<GenerateOrderImagesResult> {
  await mkdir(path.join(ORDERS_DIR, input.orderId), { recursive: true });
  await mkdir(SOURCES_DIR, { recursive: true });

  const designBuffer = decodeDataUrl(input.designImageBase64);
  const designImagePath = orderSourceRelativePath(input.orderId, input.nameSuffix);
  await writeFile(path.join(SOURCES_DIR, `${input.orderId}${fileSuffixFor(input.nameSuffix)}.png`), designBuffer);

  const mockupImagePath = await writeOrderMockup({
    orderId: input.orderId,
    garmentType: input.garmentType,
    garmentColor: input.garmentColor,
    side: input.side,
    designBuffer,
    nameSuffix: input.nameSuffix,
  });

  return { designImagePath, mockupImagePath };
}
