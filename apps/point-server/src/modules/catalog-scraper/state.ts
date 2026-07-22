import { eq } from "drizzle-orm";
import type { CatalogScrapeStatus, GalleryCategory } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { catalogScrapeState } from "../../db/schema.js";

type StateRow = typeof catalogScrapeState.$inferSelect;

function serialize(row: StateRow): CatalogScrapeStatus {
  return {
    category: row.category as GalleryCategory,
    status: row.status,
    lastRunAt: row.lastRunAt,
    lastError: row.lastError,
    lastDownloadedCount: row.lastDownloadedCount,
    totalDownloaded: row.totalDownloaded,
  };
}

export async function getOrCreateState(category: GalleryCategory): Promise<StateRow> {
  const [existing] = await db.select().from(catalogScrapeState).where(eq(catalogScrapeState.category, category));
  if (existing) return existing;

  // `onConflictDoNothing` + re-select: a route request and the startup job
  // can both race to create the same category's row.
  await db.insert(catalogScrapeState).values({ category }).onConflictDoNothing();
  const [row] = await db.select().from(catalogScrapeState).where(eq(catalogScrapeState.category, category));
  return row!;
}

export async function getAllStatuses(categories: readonly GalleryCategory[]): Promise<CatalogScrapeStatus[]> {
  const rows = await Promise.all(categories.map((category) => getOrCreateState(category)));
  return rows.map(serialize);
}

// If point-server crashes/restarts mid-run, the row is left stuck on
// "running" forever with nothing left alive to ever mark it done. Treat a
// "running" status older than this as abandoned so a later run can retry.
const STALE_RUN_MS = 10 * 60 * 1000;

export async function isRunning(category: GalleryCategory): Promise<boolean> {
  const state = await getOrCreateState(category);
  if (state.status !== "running") return false;
  if (!state.lastRunAt) return false;
  return Date.now() - Date.parse(state.lastRunAt) < STALE_RUN_MS;
}

export async function markRunning(category: GalleryCategory): Promise<void> {
  await getOrCreateState(category);
  await db
    .update(catalogScrapeState)
    .set({ status: "running", lastRunAt: new Date().toISOString() })
    .where(eq(catalogScrapeState.category, category));
}

export async function markSuccess(category: GalleryCategory, downloadedCount: number): Promise<void> {
  const state = await getOrCreateState(category);
  await db
    .update(catalogScrapeState)
    .set({
      status: "success",
      lastError: null,
      lastDownloadedCount: downloadedCount,
      totalDownloaded: state.totalDownloaded + downloadedCount,
    })
    .where(eq(catalogScrapeState.category, category));
}

export async function markError(category: GalleryCategory, error: string): Promise<void> {
  await getOrCreateState(category);
  await db
    .update(catalogScrapeState)
    .set({ status: "error", lastError: error })
    .where(eq(catalogScrapeState.category, category));
}

/**
 * Clears any `running` rows left behind when the previous point-server
 * process was killed mid-scrape. Without this, `isRunning` blocks every
 * top-up for up to `STALE_RUN_MS` (10 min) after a restart — the background
 * cache filler appears "on" but downloads nothing.
 */
export async function clearInterruptedRuns(categories: readonly GalleryCategory[]): Promise<void> {
  for (const category of categories) {
    const state = await getOrCreateState(category);
    if (state.status === "running") {
      await markError(category, "Interrupted by server restart");
    }
  }
}

/** Advances to the next search query variant once the current one is exhausted (see `queryVariants.ts`). */
export async function advanceQueryVariant(category: GalleryCategory): Promise<number> {
  const state = await getOrCreateState(category);
  const next = state.queryVariantIndex + 1;
  await db
    .update(catalogScrapeState)
    .set({ queryVariantIndex: next })
    .where(eq(catalogScrapeState.category, category));
  return next;
}
