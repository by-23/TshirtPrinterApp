import type { CatalogCacheUsage, CategoryCacheUsage } from "@tshirt/shared-types";
import { getScrapeConfig } from "./config.js";
import { GALLERY_CATEGORIES, isCategoryPending } from "./job.js";
import { isRunning } from "./state.js";
import { getCategoryStorageStats } from "./storage.js";

export const BYTES_PER_MB = 1024 * 1024;

/**
 * Snapshot of the image cache's disk usage vs. the operator-configured
 * limit (docs/PLAN.md "кэш картинок по ГБ") — backs the "Обзор" tab's
 * progress bars and the `GET /catalog/cache-usage` poll.
 */
export async function getCacheUsage(): Promise<CatalogCacheUsage> {
  const config = await getScrapeConfig();

  const categories: CategoryCacheUsage[] = await Promise.all(
    GALLERY_CATEGORIES.map(async (category) => {
      const stats = await getCategoryStorageStats(category);
      return { category, count: stats.count, bytes: stats.bytes };
    }),
  );
  const totalBytes = categories.reduce((sum, item) => sum + item.bytes, 0);

  const runningFlags = await Promise.all(GALLERY_CATEGORIES.map((category) => isRunning(category)));
  const filling = runningFlags.some(Boolean) || GALLERY_CATEGORIES.some((category) => isCategoryPending(category));

  return {
    totalBytes,
    limitBytes: config.cacheLimitMb * BYTES_PER_MB,
    categories,
    fillEnabled: config.cacheFillEnabled,
    filling,
    updatedAt: new Date().toISOString(),
  };
}
