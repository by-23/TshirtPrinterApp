import path from "node:path";
import { and, eq, isNotNull } from "drizzle-orm";
import type { CatalogScrapeConfig, GalleryCategory } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { designs } from "../../db/schema.js";
import { getScrapeConfig, resolveGiphyApiKey } from "./config.js";
import { getQueryTags } from "./queryTags.js";
import { variantAt } from "./queryVariants.js";
import { probeImage } from "./transparency.js";
import { computePerceptualHash, isNearDuplicate } from "./phash.js";
import { ensureCatalogDirs, moveToStorage, publicImageUrl, discardTempFile, cleanupTempDir } from "./storage.js";
import { markRunning, markSuccess, markError, advanceQueryVariant, getOrCreateState, isRunning } from "./state.js";
import { getEnabledSources, type ScraperSource, type SourceCandidate } from "./sources/index.js";
import {
  canMakeRequest,
  getGiphyOffset,
  isGiphyInBackoff,
  RateLimitError,
  recordRequest,
  setGiphyOffset,
} from "./rateLimit.js";

// One source's "run" tries at most this many query variants before giving up
// on that source for this call — protects against looping forever if every
// variant is dry. Giphy is capped lower because each attempt is a rate-limited
// API call and pagination is handled via `offset`, not by burning variants.
const MAX_VARIANT_ATTEMPTS_PER_RUN = 6;
const MAX_GIPHY_PAGES_PER_RUN = 3;
const RAW_LIMIT_MULTIPLIER = 3;
const MIN_RAW_LIMIT = 5;
const MAX_RAW_LIMIT = 50;

async function categoryDesignCount(category: GalleryCategory): Promise<number> {
  const rows = await db.select({ id: designs.id }).from(designs).where(eq(designs.category, category));
  return rows.length;
}

async function dedupeKeyKnown(dedupeKey: string): Promise<boolean> {
  const [row] = await db.select({ id: designs.id }).from(designs).where(eq(designs.sourcePinId, dedupeKey));
  return Boolean(row);
}

/** All perceptual hashes already stored for `category` — the seed set a run's `knownHashes` registry starts from. */
async function loadKnownHashes(category: GalleryCategory): Promise<string[]> {
  const rows = await db
    .select({ contentHash: designs.contentHash })
    .from(designs)
    .where(and(eq(designs.category, category), isNotNull(designs.contentHash)));
  return rows.map((row) => row.contentHash!);
}

async function acceptCandidates(
  candidates: SourceCandidate[],
  source: ScraperSource,
  category: GalleryCategory,
  needed: number,
  alreadyDownloaded: number,
  storageDir: string,
  config: CatalogScrapeConfig,
  knownHashes: Set<string>,
): Promise<number> {
  let downloaded = 0;
  for (const candidate of candidates) {
    const dedupeKey = `${source.id}:${candidate.externalId}`;
    try {
      if (alreadyDownloaded + downloaded >= needed) {
        await discardTempFile(candidate.filePath);
        continue;
      }
      if (await dedupeKeyKnown(dedupeKey)) {
        await discardTempFile(candidate.filePath);
        continue;
      }

      const probe = await probeImage(candidate.filePath).catch(() => null);
      if (!probe || !probe.hasTransparency) {
        await discardTempFile(candidate.filePath);
        continue;
      }
      if (
        config.minResolutionEnabled &&
        (probe.width < config.minResolutionPx || probe.height < config.minResolutionPx)
      ) {
        await discardTempFile(candidate.filePath);
        continue;
      }

      // Catches the case `sourcePinId`'s exact-match dedup can't: the
      // *same* picture arriving under a different id (Pinterest re-pin,
      // or picked up by a second source) — see `phash.ts`.
      const hash = await computePerceptualHash(candidate.filePath).catch(() => null);
      if (hash && isNearDuplicate(hash, knownHashes)) {
        await discardTempFile(candidate.filePath);
        continue;
      }
      // Reserve the hash immediately (before the `await`s below) so a
      // concurrently-running source for this same category sees it too —
      // no two sources in this run can both slip a near-duplicate past
      // each other while this one is mid-insert.
      if (hash) knownHashes.add(hash);

      const storedPath = await moveToStorage(candidate.filePath, storageDir);
      await db.insert(designs).values({
        category,
        title: candidate.alt || `${category}-${dedupeKey}`,
        imageUrl: publicImageUrl(category, path.basename(storedPath)),
        isFeatured: false,
        sourcePinId: dedupeKey,
        source: source.id,
        contentHash: hash,
      });

      downloaded += 1;
    } catch {
      // One flaky candidate (e.g. a locked file, a corrupt download) must
      // never abort the whole run — just skip it and keep going.
      await discardTempFile(candidate.filePath);
    }
  }
  return downloaded;
}

/**
 * Runs one source's search/validate/store loop for `category` until it has
 * contributed `needed` designs or its query-variant budget runs out. Shares
 * the category's query-variant index with every other source running
 * alongside it (`advanceQueryVariant`) — concurrent, slightly racy advances
 * are harmless here since it's just "which tag to try next", not a
 * correctness-critical counter. `knownHashes` is likewise shared (and
 * mutated in place) across every source racing on this same category/run —
 * see `topUpCategory` — so one source's freshly-accepted image is visible
 * to the others' near-duplicate check before any of them finish this run.
 */
async function runSourceForCategory(
  source: ScraperSource,
  category: GalleryCategory,
  needed: number,
  tempDir: string,
  storageDir: string,
  config: CatalogScrapeConfig,
  knownHashes: Set<string>,
): Promise<number> {
  const tags = await getQueryTags(category);
  const isGiphy = source.id === "giphy";
  const variantBudget = isGiphy
    ? MAX_GIPHY_PAGES_PER_RUN
    : Math.min(MAX_VARIANT_ATTEMPTS_PER_RUN, tags.tags.length * 2);
  const sourceDir = path.join(tempDir, source.id);
  let downloaded = 0;

  for (let attempt = 0; attempt < variantBudget && downloaded < needed; attempt++) {
    if (isGiphy && isGiphyInBackoff()) break;
    if (!canMakeRequest(config.maxRequestsPerHour)) break;

    const state = await getOrCreateState(category);
    const query = variantAt(tags.tags, state.queryVariantIndex);
    const stillNeeded = needed - downloaded;
    // Pinterest has no pagination — ask for the full page so we still have a
    // chance of seeing pins past the ones we already kept. Giphy paginates
    // via `offset`, so a smaller page is enough.
    const rawLimit = isGiphy
      ? Math.min(MAX_RAW_LIMIT, Math.max(stillNeeded * RAW_LIMIT_MULTIPLIER, MIN_RAW_LIMIT))
      : MAX_RAW_LIMIT;
    const offset = isGiphy ? getGiphyOffset(category) : 0;

    recordRequest();
    let candidates: SourceCandidate[];
    try {
      candidates = await source.search({
        category,
        query,
        outputDir: sourceDir,
        limit: rawLimit,
        offset,
        delayMs: config.requestDelayMs,
        minResolutionPx: config.minResolutionEnabled ? config.minResolutionPx : undefined,
        giphyApiKey: resolveGiphyApiKey(config),
      });
    } catch (error) {
      if (error instanceof RateLimitError) {
        // Don't burn the rest of this source's budget — wait for backoff.
        break;
      }
      candidates = [];
    }

    if (candidates.length === 0) {
      if (isGiphy) {
        // End of this query's result list (or a transient empty page) — reset
        // the offset and move on to the next tag so the filler doesn't sit
        // forever on an exhausted offset for one query.
        setGiphyOffset(category, 0);
      }
      await advanceQueryVariant(category);
      continue;
    }

    const accepted = await acceptCandidates(
      candidates,
      source,
      category,
      needed,
      downloaded,
      storageDir,
      config,
      knownHashes,
    );
    downloaded += accepted;

    if (isGiphy) {
      // Walk forward even when every sticker was a dupe — otherwise the
      // background filler keeps re-requesting page 0 and downloading 0.
      setGiphyOffset(category, offset + candidates.length);
      if (candidates.length < rawLimit) {
        // Short page ⇒ no further results for this query.
        setGiphyOffset(category, 0);
        await advanceQueryVariant(category);
      }
    } else if (accepted === 0) {
      // Whole batch was dupes/opaque/too small — treat the variant as
      // exhausted too, same as an empty result from the source itself.
      await advanceQueryVariant(category);
    }
  }

  return downloaded;
}

/**
 * Downloads new designs for `category` from every enabled source (docs/PLAN.md
 * Этап 3, "Несколько источников") until it has at least `targetCount` designs
 * total, or every source's budget for this run is exhausted. Sources run
 * concurrently — a slow one (Pinterest, typically) never blocks a fast one
 * (Giphy) from landing its rows in the DB, so the gallery's poll picks up
 * fresh designs well before the overall run finishes. Safe to call
 * concurrently — a no-op (returns 0) if a run is already in progress for the
 * category (see `state.ts` `status: "running"`).
 */
export async function topUpCategory(category: GalleryCategory, targetCount: number): Promise<number> {
  if (await isRunning(category)) return 0;

  await markRunning(category);
  const errors: string[] = [];
  let downloaded = 0;

  try {
    const currentCount = await categoryDesignCount(category);
    const needed = targetCount - currentCount;
    if (needed <= 0) {
      await markSuccess(category, 0);
      return 0;
    }

    const config = await getScrapeConfig();
    const { tempDir, storageDir } = await ensureCatalogDirs(category);
    const sources = getEnabledSources(config);
    const knownHashes = new Set(await loadKnownHashes(category));

    try {
      const results = await Promise.allSettled(
        sources.map((source) =>
          runSourceForCategory(source, category, needed, tempDir, storageDir, config, knownHashes),
        ),
      );
      for (let i = 0; i < results.length; i++) {
        const result = results[i]!;
        if (result.status === "fulfilled") {
          downloaded += result.value;
        } else {
          const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
          errors.push(`${sources[i]!.label}: ${reason}`);
        }
      }
    } finally {
      await cleanupTempDir(tempDir);
    }

    if (downloaded > 0 || errors.length === 0) {
      await markSuccess(category, downloaded);
    } else {
      await markError(category, errors.join("; "));
    }
    return downloaded;
  } catch (error) {
    await markError(category, error instanceof Error ? error.message : String(error));
    return downloaded;
  }
}

/** Relative variant of `topUpCategory` — grows the category by `extraCount` beyond whatever it already has. */
export async function topUpCategoryBy(category: GalleryCategory, extraCount: number): Promise<number> {
  const currentCount = await categoryDesignCount(category);
  return topUpCategory(category, currentCount + extraCount);
}
