import sharp, { type Sharp } from "sharp";
import { decode as decodeJpegJs } from "jpeg-js";
import { looksLikeHeic, convertHeicToJpeg } from "./heic.js";

/** Longest side a phone photo is downscaled to before it's pushed over the socket to point-server as base64. */
export const MAX_PHOTO_DIMENSION_PX = 1600;

/**
 * Phone cameras (especially Android) sometimes write JPEG files that
 * browsers display fine but libvips/libjpeg rejects — typically
 * `VipsJpeg: Invalid SOS parameters for sequential JPEG`. HEIC is the
 * other common phone format sharp cannot decode. Convert those first,
 * then try sharp; if JPEG decode still fails, re-encode via a lenient
 * JS decoder so the kiosk still gets a usable image.
 * Mirrors `apps/point-server/src/modules/ai/normalizePhoto.ts`.
 */
export async function normalizePhonePhoto(
  rawBuffer: Buffer,
  filename?: string,
  mimetype?: string,
): Promise<Buffer> {
  const input = looksLikeHeic(rawBuffer, filename, mimetype)
    ? await convertHeicToJpeg(rawBuffer)
    : rawBuffer;

  try {
    return await resizeWithSharp(input);
  } catch (err) {
    if (!looksLikeJpeg(input) || !isJpegDecodeFailure(err)) {
      throw err;
    }
    try {
      return await resizeFromLenientJpeg(input);
    } catch {
      throw err;
    }
  }
}

function resizeWithSharp(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize(MAX_PHOTO_DIMENSION_PX, MAX_PHOTO_DIMENSION_PX, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

function resizeFromLenientJpeg(input: Buffer): Promise<Buffer> {
  const decoded = decodeJpegJs(input, { tolerantDecoding: true, maxMemoryUsageInMB: 512 });
  const channels = decoded.data.length / (decoded.width * decoded.height);
  if (channels !== 3 && channels !== 4) {
    throw new Error("Unexpected JPEG channel count");
  }
  const pixels = Buffer.from(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength);
  return applyExifOrientation(
    sharp(pixels, { raw: { width: decoded.width, height: decoded.height, channels: channels as 3 | 4 } }),
    readJpegExifOrientation(input),
  )
    .resize(MAX_PHOTO_DIMENSION_PX, MAX_PHOTO_DIMENSION_PX, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

function looksLikeJpeg(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isJpegDecodeFailure(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /vipsjpeg|invalid sos|unsupported image format|corrupt/i.test(message);
}

function applyExifOrientation(image: Sharp, orientation: number): Sharp {
  switch (orientation) {
    case 2:
      return image.flop();
    case 3:
      return image.rotate(180);
    case 4:
      return image.flip();
    case 5:
      return image.rotate(90).flop();
    case 6:
      return image.rotate(90);
    case 7:
      return image.rotate(270).flop();
    case 8:
      return image.rotate(270);
    default:
      return image;
  }
}

/** Reads EXIF orientation (1–8) from a JPEG APP1 segment. Returns 1 if absent or unreadable. */
function readJpegExifOrientation(buffer: Buffer): number {
  if (!looksLikeJpeg(buffer)) return 1;
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1]!;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const size = buffer.readUInt16BE(offset + 2);
    if (size < 2) break;
    if (marker === 0xda) break;
    if (marker === 0xe1 && size >= 8) {
      const start = offset + 4;
      if (buffer.toString("ascii", start, start + 4) === "Exif") {
        return parseExifOrientation(buffer, start + 6, offset + 2 + size) ?? 1;
      }
    }
    offset += 2 + size;
  }
  return 1;
}

function parseExifOrientation(buffer: Buffer, tiffStart: number, end: number): number | undefined {
  if (tiffStart + 8 > end) return undefined;
  const le = buffer.toString("ascii", tiffStart, tiffStart + 2) === "II";
  const read16 = (o: number) => (le ? buffer.readUInt16LE(o) : buffer.readUInt16BE(o));
  const read32 = (o: number) => (le ? buffer.readUInt32LE(o) : buffer.readUInt32BE(o));
  if (read16(tiffStart + 2) !== 0x002a) return undefined;
  const ifd0 = tiffStart + read32(tiffStart + 4);
  if (ifd0 + 2 > end) return undefined;
  const count = read16(ifd0);
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > end) break;
    if (read16(entry) === 0x0112) {
      const value = read16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return undefined;
}
