import sharp from "sharp";
import { decodeDataUrl, encodeDataUrl } from "../imageIO.js";

export type FilterKey = "noir" | "sepia" | "popArt" | "pencilSketch";

const FILTER_KEYS: readonly FilterKey[] = ["noir", "sepia", "popArt", "pencilSketch"];

export function isFilterKey(value: string): value is FilterKey {
  return (FILTER_KEYS as readonly string[]).includes(value);
}

/** Grayscale + contrast boost + radial vignette (SVG overlay, `multiply` blend) — no ML needed. */
async function applyNoir(source: Buffer): Promise<Buffer> {
  const base = sharp(source).rotate().grayscale().linear(1.25, -20);
  const meta = await base.clone().metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;
  const vignette = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="v" cx="50%" cy="50%" r="72%">
          <stop offset="55%" stop-color="#ffffff" stop-opacity="1"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="1"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#v)"/>
    </svg>`,
  );
  return base.composite([{ input: vignette, blend: "multiply" }]).jpeg({ quality: 90 }).toBuffer();
}

/** Warm tint (desaturates internally while preserving luminance) — classic sepia look. NOTE: don't `.grayscale()` first — sharp's `tint` loses its color cast on an already single-channel image. */
async function applySepia(source: Buffer): Promise<Buffer> {
  return sharp(source).rotate().tint({ r: 112, g: 66, b: 20 }).modulate({ brightness: 1.05 }).jpeg({ quality: 90 }).toBuffer();
}

/** Saturation boost + sharpen + manual posterize (quantized raw pixels) — offline stand-in for a bold comic/poster look. */
async function applyPopArt(source: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(source)
    .rotate()
    .removeAlpha()
    .modulate({ saturation: 2.4, brightness: 1.05 })
    .sharpen({ sigma: 2 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const levels = 5;
  const step = 255 / (levels - 1);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.min(255, Math.round(Math.round(data[i]! / step) * step));
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

/** Grayscale + inverted-blur "color dodge" blend — the classic digital pencil-sketch trick. */
async function applyPencilSketch(source: Buffer): Promise<Buffer> {
  const gray = await sharp(source).rotate().grayscale().toBuffer();
  const invertedBlur = await sharp(gray).negate().blur(18).toBuffer();
  return sharp(gray)
    .composite([{ input: invertedBlur, blend: "colour-dodge" }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function stylizeWithFilter(imageBase64: string, filter: FilterKey): Promise<string> {
  const { buffer } = decodeDataUrl(imageBase64);
  let styled: Buffer;
  switch (filter) {
    case "noir":
      styled = await applyNoir(buffer);
      break;
    case "sepia":
      styled = await applySepia(buffer);
      break;
    case "popArt":
      styled = await applyPopArt(buffer);
      break;
    case "pencilSketch":
      styled = await applyPencilSketch(buffer);
      break;
  }
  return encodeDataUrl(styled, "image/jpeg");
}
