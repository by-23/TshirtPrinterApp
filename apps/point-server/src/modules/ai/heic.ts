import convert from "heic-convert";

/**
 * iPhone photos are HEIC/HEIF by default, and `sharp`'s prebuilt binary
 * cannot decode that patent-encumbered codec (see `lovell/sharp` docs on
 * HEIF support) — feeding it a HEIC buffer throws and the phone sees a
 * generic "не удалось загрузить" error, while regular JPEG/PNG downloads
 * from the web upload fine. Detect HEIC by container brand (not just
 * mimetype/filename — mobile Safari doesn't always set either reliably)
 * and pre-convert to JPEG with a pure-JS decoder before `sharp` ever sees it.
 * Mirrors `apps/central-relay/src/modules/upload-relay/heic.ts` — kept
 * independently per-app, same as other central-relay/point-server literal
 * duplication.
 */
const HEIC_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs", "mif1", "msf1"]);

export function looksLikeHeic(buffer: Buffer, filename?: string, mimetype?: string): boolean {
  if (mimetype && /hei[cf]/i.test(mimetype)) return true;
  if (filename && /\.hei[cf]$/i.test(filename)) return true;
  if (buffer.length > 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    return HEIC_BRANDS.has(buffer.toString("ascii", 8, 12).toLowerCase());
  }
  return false;
}

export async function convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  const jpeg = await convert({ buffer, format: "JPEG", quality: 0.9 });
  return Buffer.from(jpeg);
}
