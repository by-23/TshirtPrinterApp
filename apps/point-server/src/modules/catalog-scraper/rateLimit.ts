import type { GalleryCategory } from "@tshirt/shared-types";

const HOUR_MS = 60 * 60 * 1000;
/** After a Giphy 429, pause that source so the free tier can recover. */
const GIPHY_BACKOFF_MS = 15 * 60 * 1000;

const requestTimestamps: number[] = [];
let giphyBackoffUntil = 0;

/** Per-category offset into Giphy's paginated sticker search — survives only in-process (restarts walk from 0 and skip known ids). */
const giphyOffsets = new Map<GalleryCategory, number>();

/** Consecutive filler ticks that downloaded nothing — used to stop fixating on one exhausted category. */
const emptyStreak = new Map<GalleryCategory, number>();

function pruneRequestWindow(now: number): void {
  const cutoff = now - HOUR_MS;
  while (requestTimestamps.length > 0 && requestTimestamps[0]! < cutoff) {
    requestTimestamps.shift();
  }
}

/** True if another outbound source search is still within `maxRequestsPerHour`. */
export function canMakeRequest(maxRequestsPerHour: number): boolean {
  const now = Date.now();
  pruneRequestWindow(now);
  return requestTimestamps.length < Math.max(1, maxRequestsPerHour);
}

export function recordRequest(): void {
  requestTimestamps.push(Date.now());
}

export function isGiphyInBackoff(): boolean {
  return Date.now() < giphyBackoffUntil;
}

export function noteGiphyRateLimited(): void {
  giphyBackoffUntil = Date.now() + GIPHY_BACKOFF_MS;
}

export function getGiphyOffset(category: GalleryCategory): number {
  return giphyOffsets.get(category) ?? 0;
}

export function setGiphyOffset(category: GalleryCategory, offset: number): void {
  giphyOffsets.set(category, Math.max(0, offset));
}

export function getEmptyStreak(category: GalleryCategory): number {
  return emptyStreak.get(category) ?? 0;
}

export function noteFillResult(category: GalleryCategory, downloaded: number): void {
  if (downloaded > 0) {
    emptyStreak.set(category, 0);
  } else {
    emptyStreak.set(category, getEmptyStreak(category) + 1);
  }
}

export class RateLimitError extends Error {
  constructor(message = "Source rate limit exceeded") {
    super(message);
    this.name = "RateLimitError";
  }
}
