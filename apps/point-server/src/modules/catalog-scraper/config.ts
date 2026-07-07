import { eq } from "drizzle-orm";
import type { CatalogScrapeConfig, UpdateCatalogScrapeConfigInput } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { catalogScrapeConfig } from "../../db/schema.js";
import { env } from "../../env.js";

const CONFIG_ID = 1;

type ConfigRow = typeof catalogScrapeConfig.$inferSelect;

/** Panel-stored key wins over `.env` — both are optional (fail-open when unset). */
export function resolveGiphyApiKey(config: { giphyApiKey?: string | null }): string | undefined {
  const fromDb = config.giphyApiKey?.trim();
  if (fromDb) return fromDb;
  const fromEnv = env.GIPHY_API_KEY?.trim();
  return fromEnv || undefined;
}

function serialize(row: ConfigRow): CatalogScrapeConfig {
  return {
    minResolutionEnabled: row.minResolutionEnabled,
    minResolutionPx: row.minResolutionPx,
    pageSize: row.pageSize,
    bufferSize: row.bufferSize,
    requestDelayMs: row.requestDelayMs,
    maxRequestsPerHour: row.maxRequestsPerHour,
    giphyEnabled: row.giphyEnabled,
    giphyApiKey: row.giphyApiKey ?? null,
    cleanpngEnabled: row.cleanpngEnabled,
    giphyKeyConfigured: Boolean(resolveGiphyApiKey(row)),
    cacheLimitMb: row.cacheLimitMb,
    cacheFillEnabled: row.cacheFillEnabled,
    cacheFillBatchSize: row.cacheFillBatchSize,
    cacheFillIntervalSec: row.cacheFillIntervalSec,
    updatedAt: row.updatedAt,
  };
}

/**
 * Reads the (singleton) scraper config, creating the default row on first
 * access. Uses `onConflictDoNothing` + re-select because startup fires this
 * concurrently for all 3 gallery categories (`job.ts` `ensureAllCategoriesStocked`),
 * which would otherwise race on inserting the same `id=1` row.
 */
export async function getScrapeConfig(): Promise<CatalogScrapeConfig> {
  const [existing] = await db.select().from(catalogScrapeConfig).where(eq(catalogScrapeConfig.id, CONFIG_ID));
  if (existing) return serialize(existing);

  await db.insert(catalogScrapeConfig).values({ id: CONFIG_ID }).onConflictDoNothing();
  const [row] = await db.select().from(catalogScrapeConfig).where(eq(catalogScrapeConfig.id, CONFIG_ID));
  return serialize(row!);
}

export async function updateScrapeConfig(input: UpdateCatalogScrapeConfigInput): Promise<CatalogScrapeConfig> {
  await getScrapeConfig();
  const patch: UpdateCatalogScrapeConfigInput & { updatedAt: string } = {
    ...input,
    updatedAt: new Date().toISOString(),
  };
  if ("giphyApiKey" in patch) {
    patch.giphyApiKey = patch.giphyApiKey?.trim() || null;
  }
  const [updated] = await db
    .update(catalogScrapeConfig)
    .set(patch)
    .where(eq(catalogScrapeConfig.id, CONFIG_ID))
    .returning();
  return serialize(updated!);
}
