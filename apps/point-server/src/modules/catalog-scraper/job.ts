import type { FastifyBaseLogger } from "fastify";
import type { GalleryCategory } from "@tshirt/shared-types";
import { getScrapeConfig } from "./config.js";
import { getEmptyStreak, noteFillResult } from "./rateLimit.js";
import { topUpCategory, topUpCategoryBy } from "./scrapeService.js";
import { getCategoryStorageStats } from "./storage.js";

export const GALLERY_CATEGORIES: readonly GalleryCategory[] = ["memes", "anime_movies", "games"];
const BYTES_PER_MB = 1024 * 1024;

// In-process guard so overlapping calls in the same server instance don't
// pile up redundant scrape attempts while one is already running for a
// category. `state.ts`'s `status: "running"` is the cross-restart guard;
// this is just the same-process fast path.
const pending = new Set<GalleryCategory>();

async function runExclusive(
  category: GalleryCategory,
  run: () => Promise<number>,
  log?: FastifyBaseLogger,
): Promise<number> {
  if (pending.has(category)) return 0;
  pending.add(category);
  try {
    const downloaded = await run();
    noteFillResult(category, downloaded);
    if (downloaded > 0) {
      log?.info({ category, downloaded }, "Catalog scraper topped up category");
    }
    return downloaded;
  } catch (error) {
    noteFillResult(category, 0);
    log?.warn({ category, err: error }, "Catalog scraper run failed");
    return 0;
  } finally {
    pending.delete(category);
  }
}

/**
 * Fire-and-forget: called once at server startup to eagerly fill all 3
 * gallery categories up to their minimum stock (`pageSize + bufferSize`),
 * without waiting for anyone to actually open the section — docs/PLAN.md
 * Этап 3, "Наполнение и подгрузка".
 */
export function ensureAllCategoriesStocked(log?: FastifyBaseLogger): void {
  for (const category of GALLERY_CATEGORIES) {
    void (async () => {
      try {
        const config = await getScrapeConfig();
        await runExclusive(category, () => topUpCategory(category, config.pageSize + config.bufferSize), log);
      } catch (error) {
        // Never let a scraper hiccup take down the kiosk/operator server —
        // same fail-open principle as `modules/sync/client.ts`.
        log?.warn({ category, err: error }, "Catalog scraper startup fill failed");
      }
    })();
  }
}

/**
 * Fire-and-forget: called from the designs route once a page request gets
 * close to the end of what's already cached, keeping the buffer ahead of
 * however far the user has scrolled (absolute target, e.g. `offset + limit
 * + bufferSize`).
 */
export function ensureCategoryStocked(category: GalleryCategory, targetCount: number, log?: FastifyBaseLogger): void {
  void runExclusive(category, () => topUpCategory(category, targetCount), log);
}

/**
 * True the instant a top-up run for `category` has been kicked off (set
 * synchronously by `runExclusive`, before any `await`), so callers checking
 * right after `ensureCategoryStocked`/`ensureAllCategoriesStocked` don't miss
 * it in a race with `state.ts`'s DB-backed `isRunning` (which only flips
 * after the run's first `await`).
 */
export function isCategoryPending(category: GalleryCategory): boolean {
  return pending.has(category);
}

/** Fire-and-forget: the "Докачать сейчас" button in the operator settings panel. */
export function triggerManualRun(category: GalleryCategory, log?: FastifyBaseLogger): void {
  void (async () => {
    try {
      const config = await getScrapeConfig();
      await runExclusive(category, () => topUpCategoryBy(category, config.bufferSize), log);
    } catch (error) {
      log?.warn({ category, err: error }, "Catalog scraper manual run failed");
    }
  })();
}

async function totalCacheBytes(): Promise<number> {
  const stats = await Promise.all(GALLERY_CATEGORIES.map((category) => getCategoryStorageStats(category)));
  return stats.reduce((sum, item) => sum + item.bytes, 0);
}

/**
 * Picks the gallery category with the *least* on-disk usage right now
 * (skipping any already mid-run) so the slow filler below grows all 3
 * categories evenly instead of one racing ahead of the others.
 *
 * Categories that recently returned 0 downloads are deprioritized — otherwise
 * an exhausted least-bytes category monopolizes every tick and the other two
 * never grow, even though the cache is still well under its GB limit.
 */
async function pickFillerCategory(): Promise<GalleryCategory | null> {
  const idle = GALLERY_CATEGORIES.filter((category) => !pending.has(category));
  if (idle.length === 0) return null;

  const withScore = await Promise.all(
    idle.map(async (category) => ({
      category,
      bytes: (await getCategoryStorageStats(category)).bytes,
      streak: getEmptyStreak(category),
    })),
  );
  withScore.sort((a, b) => a.streak - b.streak || a.bytes - b.bytes);
  return withScore[0]!.category;
}

let fillerStarted = false;

/**
 * Slow, unhurried background filler for the "сколько ГБ может занимать кэш
 * картинок" setting (docs/PLAN.md). Every `cacheFillIntervalSec` it tops up
 * whichever gallery category currently has the least disk usage by
 * `cacheFillBatchSize` designs — small portions with a pause in between, so
 * it never hammers the sources or the point's disk/network, and all 3
 * categories fill up roughly evenly rather than one finishing first.
 * Re-reads the config on every tick, so toggling "Пауза"/the GB limit from
 * the operator panel takes effect on the very next portion — no restart
 * needed. Idempotent: safe to call more than once (e.g. hot reload), only
 * the first call actually starts the loop.
 */
export function startCacheFiller(log?: FastifyBaseLogger): void {
  if (fillerStarted) return;
  fillerStarted = true;

  const tick = async () => {
    let intervalSec = 20;
    try {
      const config = await getScrapeConfig();
      intervalSec = config.cacheFillIntervalSec;

      if (config.cacheFillEnabled) {
        const limitBytes = config.cacheLimitMb * BYTES_PER_MB;
        const usedBytes = await totalCacheBytes();
        if (usedBytes < limitBytes) {
          const category = await pickFillerCategory();
          if (category) {
            await runExclusive(category, () => topUpCategoryBy(category, config.cacheFillBatchSize), log);
          }
        }
      }
    } catch (error) {
      log?.warn({ err: error }, "Catalog cache filler tick failed");
    } finally {
      setTimeout(() => void tick(), Math.max(1, intervalSec) * 1000);
    }
  };

  void tick();
}
