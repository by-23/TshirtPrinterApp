import type { GalleryCategory, ScraperSourceId } from "@tshirt/shared-types";

export interface SourceCandidate {
  /** Unique within this source — combined with the source id for global dedup (see `designs.sourcePinId`). */
  externalId: string;
  /** Path to the already-downloaded file on disk (inside the run's temp dir), ready for `probeImage`/`moveToStorage`. */
  filePath: string;
  alt: string;
}

export interface SourceSearchOptions {
  category: GalleryCategory;
  query: string;
  /** Where to write downloaded files — unique per source per run, so sources never collide on filenames. */
  outputDir: string;
  limit: number;
  delayMs: number;
  minResolutionPx?: number;
  /** Set by `scrapeService` from `catalog_scrape_config` (panel or `.env` fallback). */
  giphyApiKey?: string;
  /**
   * Pagination offset for sources that support it (Giphy). Ignored by
   * Pinterest/CleanPNG — those always return their first page of results.
   */
  offset?: number;
}

export interface ScraperSource {
  id: ScraperSourceId;
  /** Human label — used in logs and the `lastError` summary shown in the operator panel. */
  label: string;
  /**
   * Returns whatever this source could find for `query`, already downloaded
   * to `outputDir`. Must never throw for "no results" (return `[]` instead);
   * only reject if the source itself is broken (network down, bad API key,
   * browser crash, etc.) — `scrapeService.ts` treats a rejection as "this
   * source contributed nothing this run" without failing the others (fail-open).
   */
  search(options: SourceSearchOptions): Promise<SourceCandidate[]>;
}
