import sharp from "sharp";

// 16x16 grayscale average-hash = 256 bits. Small enough that comparing it
// against every already-known hash for a category (a few hundred rows at
// most) per candidate is cheap, large enough to tell genuinely different
// pictures apart while still matching resized/recompressed re-uploads of
// the same picture.
const HASH_SIZE = 16;

/**
 * Computes a perceptual "average hash" for the image at `filePath`: shrink
 * to a tiny grayscale grid, flatten transparency onto white (so a cut-out's
 * hash doesn't depend on whatever background the *comparison* happens to
 * render against), then set one bit per pixel depending on whether it's
 * lighter or darker than the grid's mean brightness. Returns a 64-char hex
 * string (256 bits).
 *
 * Deliberately robust to re-encoding/resizing/minor recompression — the
 * kind of variation you get when the *same* picture is re-pinned on
 * Pinterest under a new id, or turns up via two different scraper sources —
 * which is exactly what `sourcePinId`'s exact-match dedup misses (see
 * `scrapeService.ts`).
 */
export async function computePerceptualHash(filePath: string): Promise<string> {
  const { data } = await sharp(filePath)
    .flatten({ background: "#ffffff" })
    .resize(HASH_SIZE, HASH_SIZE, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sum = 0;
  for (const byte of data) sum += byte;
  const mean = sum / data.length;

  let bits = "";
  const bytes: number[] = [];
  for (let i = 0; i < data.length; i++) {
    bits += data[i]! >= mean ? "1" : "0";
    if (bits.length === 8) {
      bytes.push(parseInt(bits, 2));
      bits = "";
    }
  }

  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexNibbleToPopcount(nibble: number): number {
  // Number of set bits in a 4-bit value (0-15) — tiny lookup beats a loop
  // for something called once per hex character during every comparison.
  const POPCOUNT_4BIT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
  return POPCOUNT_4BIT[nibble]!;
}

/** Hamming distance (bit differences) between two same-length hex hashes produced by `computePerceptualHash`. */
export function hammingDistance(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    const xored = parseInt(hashA[i]!, 16) ^ parseInt(hashB[i]!, 16);
    distance += hexNibbleToPopcount(xored);
  }
  return distance;
}

// Out of 256 bits — tolerant enough to catch resized/recompressed re-uploads
// of the same picture, tight enough that two different-but-similar pictures
// (e.g. two posters of the same movie) shouldn't normally collide.
export const DUPLICATE_HASH_MAX_DISTANCE = 10;

/** True if `hash` is a near-duplicate (or exact match) of anything in `knownHashes`. */
export function isNearDuplicate(hash: string, knownHashes: Iterable<string>): boolean {
  for (const known of knownHashes) {
    if (hammingDistance(hash, known) <= DUPLICATE_HASH_MAX_DISTANCE) return true;
  }
  return false;
}
