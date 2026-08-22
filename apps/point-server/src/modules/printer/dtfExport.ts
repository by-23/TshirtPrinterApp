import { copyFile, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
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
  /** Absolute path to the original unmirrored print-area PNG. */
  designAbsolutePath: string;
  config: DtfPrinterConfig;
  /** Appended to filenames so dual-side jobs don't overwrite each other. */
  nameSuffix?: string;
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

function fileSuffixFor(nameSuffix?: string): string {
  return nameSuffix ? `-${nameSuffix}` : "";
}

function sanitizeHotfolderName(name: string): string {
  const cleaned = name.replace(/[<>:"|?*\\/]/g, "").trim();
  return cleaned || "dtf-print-jobs";
}

export function hotfolderDirFor(config: DtfPrinterConfig): string {
  return dataPath(sanitizeHotfolderName(config.hotfolderName));
}

export function hotfolderFileName(orderId: string, kind: "dtf-print" | "mockup", nameSuffix?: string): string {
  return `order-${orderId}${fileSuffixFor(nameSuffix)}-${kind}.png`;
}

/** Copies a PNG into the cashier/RIP hotfolder (`dtf-print-jobs`). */
export async function copyOrderFileToHotfolder(input: {
  orderId: string;
  kind: "dtf-print" | "mockup";
  sourceAbsolutePath: string;
  config: DtfPrinterConfig;
  nameSuffix?: string;
}): Promise<{ hotfolderDir: string; hotfolderAbsolutePath: string }> {
  ensureDataDir();
  const hotfolderDir = hotfolderDirFor(input.config);
  await mkdir(hotfolderDir, { recursive: true });
  const hotfolderAbsolutePath = path.join(
    hotfolderDir,
    hotfolderFileName(input.orderId, input.kind, input.nameSuffix),
  );
  await copyFile(input.sourceAbsolutePath, hotfolderAbsolutePath);
  const legacyName = `order-${input.orderId}${fileSuffixFor(input.nameSuffix)}.png`;
  const legacyPath = path.join(hotfolderDir, legacyName);
  if (legacyName !== path.basename(hotfolderAbsolutePath) && existsSync(legacyPath)) {
    await unlink(legacyPath);
  }
  return { hotfolderDir, hotfolderAbsolutePath };
}

/**
 * Builds a RIP-ready DTF PNG: physical size at configured DPI, optional
 * horizontal mirror, density metadata. Copies into the hotfolder as
 * `order-{id}-dtf-print.png` (overwrites on reprint).
 */
export async function prepareDtfPrint(input: PrepareDtfPrintInput): Promise<PrepareDtfPrintResult> {
  ensureDataDir();
  const sizeMm = getPrintSizeMm(input.config, input.garmentType, input.side);
  const dpi = input.config.dpi;
  const widthPx = mmToPx(sizeMm.widthMm, dpi);
  const heightPx = mmToPx(sizeMm.heightMm, dpi);

  const orderDir = dataPath("orders", input.orderId);
  await mkdir(orderDir, { recursive: true });
  const absolutePath = path.join(orderDir, `dtf-print${fileSuffixFor(input.nameSuffix)}.png`);

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

  const { hotfolderDir, hotfolderAbsolutePath } = await copyOrderFileToHotfolder({
    orderId: input.orderId,
    kind: "dtf-print",
    sourceAbsolutePath: absolutePath,
    config: input.config,
    nameSuffix: input.nameSuffix,
  });

  return {
    dtfPrintImagePath: `orders/${input.orderId}/dtf-print${fileSuffixFor(input.nameSuffix)}.png`,
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
