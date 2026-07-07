import type { CatalogScrapeConfig } from "@tshirt/shared-types";
import { resolveGiphyApiKey } from "../config.js";
import { pinterestSource } from "./pinterestSource.js";
import { giphySource } from "./giphySource.js";
import { cleanpngSource } from "./cleanpngSource.js";
import type { ScraperSource } from "./types.js";

export type { ScraperSource, SourceCandidate, SourceSearchOptions } from "./types.js";

/**
 * Pinterest always runs; Giphy/CleanPNG are opt-in via the operator panel's
 * "Настройки автозаполнения" toggles (`catalogScrapeConfig`) — see
 * docs/PLAN.md Этап 3, "Несколько источников". Giphy additionally needs
 * an API key (panel or `.env`), so a toggled-on-but-unconfigured Giphy is
 * simply skipped (fail-open) rather than erroring the whole run.
 */
export function getEnabledSources(config: CatalogScrapeConfig): ScraperSource[] {
  const sources: ScraperSource[] = [pinterestSource];
  if (config.giphyEnabled && resolveGiphyApiKey(config)) sources.push(giphySource);
  if (config.cleanpngEnabled) sources.push(cleanpngSource);
  return sources;
}
