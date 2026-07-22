import sharp from "sharp";

// Same 16x16 grayscale average-hash as `point-server`'s catalog scraper
// (`apps/point-server/src/modules/catalog-scraper/phash.ts`) — duplicated
// here rather than shared, since the two apps don't share an internal
// package for algorithms (only `@tshirt/shared-types` schemas). Kept in
// sync deliberately: the same hash value has to mean the same thing on
// both sides for the near-duplicate check in `service.ts`.
const HASH_SIZE = 16;

/** Computes a perceptual "average hash" for the PNG at `filePath` — see the point-server copy of this function for the full rationale. */
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

// Mirrors `DUPLICATE_HASH_MAX_DISTANCE` in the point-server scraper.
export const DUPLICATE_HASH_MAX_DISTANCE = 10;

/** True if `hash` is a near-duplicate (or exact match) of anything in `knownHashes`. */
export function isNearDuplicate(hash: string, knownHashes: Iterable<string>): boolean {
  for (const known of knownHashes) {
    if (hammingDistance(hash, known) <= DUPLICATE_HASH_MAX_DISTANCE) return true;
  }
  return false;
}
