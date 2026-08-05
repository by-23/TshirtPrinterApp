import { z } from "zod";
import type { GarmentSide, GarmentType } from "./garment.js";

/** Physical print rectangle on the garment (full mockup print-area maps to this). */
export const printSizeMmSchema = z.object({
  widthMm: z.number().positive().max(500),
  heightMm: z.number().positive().max(600),
});
export type PrintSizeMm = z.infer<typeof printSizeMmSchema>;

const garmentSidePrintMmSchema = z.object({
  front: printSizeMmSchema,
  back: printSizeMmSchema,
});

export const garmentPrintSizeMmSchema = z.object({
  tshirt: garmentSidePrintMmSchema,
  sweatshirt: garmentSidePrintMmSchema,
  cap: garmentSidePrintMmSchema,
  shopper: garmentSidePrintMmSchema,
});
export type GarmentPrintSizeMm = z.infer<typeof garmentPrintSizeMmSchema>;

/** Operator-maintained tank levels — L1800 has no reliable ink telemetry over USB. */
export const dtfInkLevelsSchema = z.object({
  C: z.number().int().min(0).max(100),
  M: z.number().int().min(0).max(100),
  Y: z.number().int().min(0).max(100),
  K: z.number().int().min(0).max(100),
  Lc: z.number().int().min(0).max(100),
  Lm: z.number().int().min(0).max(100),
});
export type DtfInkLevels = z.infer<typeof dtfInkLevelsSchema>;

export const DEFAULT_DTF_INK_LEVELS: DtfInkLevels = {
  C: 100,
  M: 100,
  Y: 100,
  K: 100,
  Lc: 100,
  Lm: 100,
};

/**
 * Epson L1800 DTF settings for a print point — singleton on point-server.
 * The app prepares a 300 DPI PNG for RIP (AcroRIP etc.); the RIP drives USB.
 */
export const dtfPrinterConfigSchema = z.object({
  /** Display name in the operator panel. */
  printerModel: z.string().min(1).max(80),
  /**
   * Exact Windows printer queue name (from Get-Printer). Empty = auto-match
   * by model substring (e.g. "L1800" / "Epson").
   */
  windowsPrinterName: z.string().max(200),
  /** Informational film/paper size for the operator (RIP still sets media). */
  mediaSize: z.enum(["A3", "A3+"]),
  /** Raster density embedded in the PNG and used for px = mm × dpi / 25.4. */
  dpi: z.number().int().min(150).max(600),
  /**
   * Mirror horizontally for DTF film. Keep ON unless mirroring is already
   * enabled in the RIP (double mirror prints wrong-way).
   */
  mirror: z.boolean(),
  /** Folder under DATA_DIR where ready print PNGs are copied for the RIP. */
  hotfolderName: z.string().min(1).max(80),
  /** Full print-area → physical mm per garment type/side. */
  printSizeMm: garmentPrintSizeMmSchema,
  /** Manual ink/tank estimates (click in the panel to update after a refill). */
  inkLevels: dtfInkLevelsSchema,
});
export type DtfPrinterConfig = z.infer<typeof dtfPrinterConfigSchema>;

export const updateDtfPrinterConfigSchema = z.object({
  config: dtfPrinterConfigSchema,
});
export type UpdateDtfPrinterConfigInput = z.infer<typeof updateDtfPrinterConfigSchema>;

/**
 * Sensible DTF defaults for adult garments on A3/A3+ film.
 * Cap/shopper are smaller; operator can tune in the printer panel.
 */
export const DEFAULT_DTF_PRINTER_CONFIG: DtfPrinterConfig = {
  printerModel: "Epson L1800",
  windowsPrinterName: "",
  mediaSize: "A3+",
  dpi: 300,
  mirror: true,
  hotfolderName: "dtf-print-jobs",
  printSizeMm: {
    tshirt: {
      front: { widthMm: 280, heightMm: 380 },
      back: { widthMm: 300, heightMm: 400 },
    },
    sweatshirt: {
      front: { widthMm: 280, heightMm: 300 },
      back: { widthMm: 300, heightMm: 400 },
    },
    cap: {
      front: { widthMm: 100, heightMm: 55 },
      back: { widthMm: 80, heightMm: 40 },
    },
    shopper: {
      front: { widthMm: 300, heightMm: 350 },
      back: { widthMm: 300, heightMm: 350 },
    },
  },
  inkLevels: { ...DEFAULT_DTF_INK_LEVELS },
};

export function getPrintSizeMm(
  config: DtfPrinterConfig,
  garmentType: GarmentType,
  side: GarmentSide,
): PrintSizeMm {
  return config.printSizeMm[garmentType][side];
}

/** Pixels for a physical size at the configured DPI. */
export function mmToPx(mm: number, dpi: number): number {
  return Math.max(1, Math.round((mm / 25.4) * dpi));
}

/** Merge a stored (possibly partial) config onto defaults. */
export function withDtfPrinterConfigDefaults(
  stored: Partial<DtfPrinterConfig> | null | undefined,
): DtfPrinterConfig {
  const base = DEFAULT_DTF_PRINTER_CONFIG;
  if (!stored) return { ...base, printSizeMm: JSON.parse(JSON.stringify(base.printSizeMm)) as GarmentPrintSizeMm };

  const mergeSide = (
    defaults: { front: PrintSizeMm; back: PrintSizeMm },
    override: Partial<{ front: PrintSizeMm; back: PrintSizeMm }> | undefined,
  ) => ({
    front: { ...defaults.front, ...override?.front },
    back: { ...defaults.back, ...override?.back },
  });

  const ink = stored.inkLevels;
  const mergeInk = (key: keyof DtfInkLevels): number => {
    const value = ink?.[key];
    return typeof value === "number" && value >= 0 && value <= 100 ? Math.round(value) : base.inkLevels[key];
  };

  return {
    printerModel: stored.printerModel?.trim() || base.printerModel,
    windowsPrinterName: typeof stored.windowsPrinterName === "string" ? stored.windowsPrinterName : base.windowsPrinterName,
    mediaSize: stored.mediaSize === "A3" || stored.mediaSize === "A3+" ? stored.mediaSize : base.mediaSize,
    dpi: typeof stored.dpi === "number" && stored.dpi >= 150 && stored.dpi <= 600 ? stored.dpi : base.dpi,
    mirror: typeof stored.mirror === "boolean" ? stored.mirror : base.mirror,
    hotfolderName: stored.hotfolderName?.trim() || base.hotfolderName,
    printSizeMm: {
      tshirt: mergeSide(base.printSizeMm.tshirt, stored.printSizeMm?.tshirt),
      sweatshirt: mergeSide(base.printSizeMm.sweatshirt, stored.printSizeMm?.sweatshirt),
      cap: mergeSide(base.printSizeMm.cap, stored.printSizeMm?.cap),
      shopper: mergeSide(base.printSizeMm.shopper, stored.printSizeMm?.shopper),
    },
    inkLevels: {
      C: mergeInk("C"),
      M: mergeInk("M"),
      Y: mergeInk("Y"),
      K: mergeInk("K"),
      Lc: mergeInk("Lc"),
      Lm: mergeInk("Lm"),
    },
  };
}
