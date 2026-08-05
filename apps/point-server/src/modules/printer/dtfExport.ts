import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  getPrintSizeMm,
  mmToPx,
  type DtfPrinterConfig,
  type GarmentSide,
  type GarmentType,
} from "@tshirt/shared-types";
import { dataPath, ensureDataDir } from "../../lib/dataDir.js";

export interface PrepareDtfPrintInput {
  orderId: string;
  garmentType: GarmentType;
  side: GarmentSide;
  /** Absolute path to the source design.png (transparent print-area). */
  designAbsolutePath: string;
  config: DtfPrinterConfig;
}

export interface PrepareDtfPrintResult {
  /** Relative path under DATA_DIR, e.g. `orders/12/dtf-print.png`. */
  dtfPrintImagePath: string;
  absolutePath: string;
  hotfolderAbsolutePath: string;
  hotfolderDir: string;
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  dpi: number;
  mirrored: boolean;
  mediaSize: "A3" | "A3+";
  printerModel: string;
}

/**
 * Builds a RIP-ready DTF PNG: physical size at configured DPI, optional
 * horizontal mirror, density metadata. Copies into the hotfolder as
 * `order-{id}.png` (overwrites on reprint).
 */
export async function prepareDtfPrint(input: PrepareDtfPrintInput): Promise<PrepareDtfPrintResult> {
  ensureDataDir();
  const sizeMm = getPrintSizeMm(input.config, input.garmentType, input.side);
  const dpi = input.config.dpi;
  const widthPx = mmToPx(sizeMm.widthMm, dpi);
  const heightPx = mmToPx(sizeMm.heightMm, dpi);

  const orderDir = dataPath("orders", input.orderId);
  await mkdir(orderDir, { recursive: true });
  const absolutePath = path.join(orderDir, "dtf-print.png");

  let pipeline = sharp(input.designAbsolutePath, { failOn: "none" })
    .ensureAlpha()
    .resize(widthPx, heightPx, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    });

  if (input.config.mirror) {
    pipeline = pipeline.flop();
  }

  await pipeline
    .withMetadata({ density: dpi })
    .png({ compressionLevel: 6, adaptiveFiltering: true })
    .toFile(absolutePath);

  const hotfolderName = sanitizeHotfolderName(input.config.hotfolderName);
  const hotfolderDir = dataPath(hotfolderName);
  await mkdir(hotfolderDir, { recursive: true });
  const hotfolderAbsolutePath = path.join(hotfolderDir, `order-${input.orderId}.png`);
  await copyFile(absolutePath, hotfolderAbsolutePath);

  return {
    dtfPrintImagePath: `orders/${input.orderId}/dtf-print.png`,
    absolutePath,
    hotfolderAbsolutePath,
    hotfolderDir,
    widthMm: sizeMm.widthMm,
    heightMm: sizeMm.heightMm,
    widthPx,
    heightPx,
    dpi,
    mirrored: input.config.mirror,
    mediaSize: input.config.mediaSize,
    printerModel: input.config.printerModel,
  };
}

function sanitizeHotfolderName(name: string): string {
  const cleaned = name.replace(/[<>:"|?*\\/]/g, "").trim();
  return cleaned || "dtf-print-jobs";
}
