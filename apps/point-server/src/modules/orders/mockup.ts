import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { GarmentSide, GarmentType } from "@tshirt/shared-types";
import { MOCKUP_HEIGHT, MOCKUP_WIDTH, getPrintAreas, hoodieSvg } from "./garmentGeometry.js";

/** Everything generated at runtime (per-order PNGs) lives under this dir, relative to cwd (same convention as `env.DATABASE_PATH`). */
const DATA_DIR = path.resolve("data");
const ORDERS_DIR = path.join(DATA_DIR, "orders");
const ASSETS_DIR = path.resolve("assets", "garments");

const TSHIRT_WHITE_PATH = path.join(ASSETS_DIR, "tshirt-white.png");
const TSHIRT_BLACK_PATH = path.join(ASSETS_DIR, "tshirt-black.png");

/** Matches the client's `MOCKUP_DISPLAY_SCALE` — arbitrary (cancels out in the math below) but kept for readability/parity. */
const RENDER_SCALE = 2;

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
 * `TshirtMockup.tsx` does visually, so the composited design lands in the
 * same place the customer saw on the kiosk screen.
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

async function tintedTshirtBase(color: string): Promise<{ buffer: Buffer; width: number; height: number }> {
  const normalized = color.toLowerCase();
  const isBlack = normalized === "#111111";
  const isWhite = normalized === "#ffffff";
  const basePath = isBlack ? TSHIRT_BLACK_PATH : TSHIRT_WHITE_PATH;

  const base = sharp(basePath).ensureAlpha();
  const metadata = await base.metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  if (isBlack || isWhite) {
    return { buffer: await base.png().toBuffer(), width, height };
  }

  // Mirrors the client's CSS `mix-blend-mode: multiply` overlay (see
  // TshirtMockup.tsx): a solid color multiplied over the white photo, then
  // re-masked with the original photo's alpha so the transparent background
  // stays transparent (sharp's `tint()` alone looks washed out on a
  // near-white base since it preserves per-pixel luminance).
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

async function garmentBase(
  type: GarmentType,
  color: string,
  side: GarmentSide,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  if (type === "tshirt") {
    return tintedTshirtBase(color);
  }

  const width = MOCKUP_WIDTH * RENDER_SCALE;
  const height = MOCKUP_HEIGHT * RENDER_SCALE;
  const svg = hoodieSvg(color, side, RENDER_SCALE);
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return { buffer, width, height };
}

async function designRect(
  type: GarmentType,
  side: GarmentSide,
  baseWidth: number,
  baseHeight: number,
): Promise<Rect> {
  const printAreas = await getPrintAreas();
  if (type === "tshirt") {
    return printAreaToPhotoPixels(baseWidth, baseHeight, side, type, printAreas);
  }
  // Hoodie base is rendered 1:1 in the same coordinate space as PRINT_AREAS — no object-contain offset needed.
  const printArea = printAreas[type][side];
  return clampRect(
    {
      left: Math.round(printArea.x * RENDER_SCALE),
      top: Math.round(printArea.y * RENDER_SCALE),
      width: Math.round(printArea.width * RENDER_SCALE),
      height: Math.round(printArea.height * RENDER_SCALE),
    },
    baseWidth,
    baseHeight,
  );
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
}

export interface GenerateOrderImagesResult {
  designImagePath: string;
  mockupImagePath: string;
}

/**
 * Saves the customer's design PNG and composites it onto a garment template
 * via `sharp`, producing the two files Stage 5 requires: a clean design PNG
 * and a photorealistic (t-shirt) / flat-vector (hoodie) mockup PNG. Paths
 * returned are relative to `data/`, ready to be served under `/files`.
 */
export async function generateOrderImages(input: GenerateOrderImagesInput): Promise<GenerateOrderImagesResult> {
  const orderDir = path.join(ORDERS_DIR, input.orderId);
  await mkdir(orderDir, { recursive: true });

  const designBuffer = decodeDataUrl(input.designImageBase64);
  const designPngPath = path.join(orderDir, "design.png");
  await writeFile(designPngPath, designBuffer);

  const { buffer: baseBuffer, width, height } = await garmentBase(input.garmentType, input.garmentColor, input.side);
  const rect = await designRect(input.garmentType, input.side, width, height);
  const resizedDesign = await sharp(designBuffer).resize(rect.width, rect.height, { fit: "fill" }).png().toBuffer();

  const mockupPngPath = path.join(orderDir, "mockup.png");
  await sharp(baseBuffer)
    .composite([{ input: resizedDesign, left: rect.left, top: rect.top }])
    .png()
    .toFile(mockupPngPath);

  return {
    designImagePath: `orders/${input.orderId}/design.png`,
    mockupImagePath: `orders/${input.orderId}/mockup.png`,
  };
}
