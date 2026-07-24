/** Downsample size for luminance sampling — small enough for kiosk perf. */
const SAMPLE = 48;
/** Ignore near-transparent pixels (PNG stickers). */
const ALPHA_MIN = 24;
/** Average relative luminance (0–255) below this → treat as dark artwork. */
const LUMINANCE_DARK = 72;
/** Need at least this fraction of opaque pixels to decide. */
const MIN_OPAQUE_RATIO = 0.02;

const cache = new Map<string, boolean>();

/**
 * Heuristic: mostly-opaque pixels are dark → artwork will vanish on a dark
 * gallery card. Samples a tiny canvas; fails open (returns false) if the
 * canvas is tainted / CORS blocks readback.
 */
export function isMostlyDarkArtwork(img: HTMLImageElement, cacheKey?: string): boolean {
  const key = cacheKey ?? (img.currentSrc || img.src);
  if (key && cache.has(key)) return cache.get(key)!;

  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;

  let data: Uint8ClampedArray;
  try {
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
    data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    return false;
  }

  let lumSum = 0;
  let opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < ALPHA_MIN) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    lumSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    opaque += 1;
  }

  if (opaque < SAMPLE * SAMPLE * MIN_OPAQUE_RATIO) {
    if (key) cache.set(key, false);
    return false;
  }

  const dark = lumSum / opaque < LUMINANCE_DARK;
  if (key) cache.set(key, dark);
  return dark;
}
