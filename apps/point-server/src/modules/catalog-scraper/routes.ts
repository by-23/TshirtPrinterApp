import type { FastifyInstance } from "fastify";
import {
  normalizeGalleryCategory,
  testGiphyApiKeyInputSchema,
  updateCatalogScrapeConfigSchema,
  updateCategoryQueryTagsSchema,
} from "@tshirt/shared-types";
import { getScrapeConfig, resolveGiphyApiKey, updateScrapeConfig } from "./config.js";
import { getCacheUsage } from "./cacheUsage.js";
import { getAllQueryTags, setQueryTags } from "./queryTags.js";
import { getAllStatuses } from "./state.js";
import { triggerManualRun, GALLERY_CATEGORIES } from "./job.js";
import { testGiphyApiKey } from "./testGiphyApiKey.js";

/**
 * Settings/status/manual-trigger API for the catalog scraper — Pinterest
 * plus the parallel Giphy/CleanPNG sources (Этап 3, "Несколько источников").
 * Lives on point-server only — see docs/PLAN.md for why this isn't in
 * central-relay/admin-panel yet.
 */
export async function catalogScrapeRoutes(app: FastifyInstance) {
  app.get("/catalog/scrape-config", async () => {
    return getScrapeConfig();
  });

  app.patch("/catalog/scrape-config", async (request, reply) => {
    const parsed = updateCatalogScrapeConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }
    return updateScrapeConfig(parsed.data);
  });

  app.post("/catalog/scrape-config/giphy/test", async (request, reply) => {
    const parsed = testGiphyApiKeyInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const config = await getScrapeConfig();
    const apiKey = parsed.data.apiKey?.trim() || resolveGiphyApiKey(config) || "";
    return testGiphyApiKey(apiKey);
  });

  app.get("/catalog/scrape-status", async () => {
    return getAllStatuses(GALLERY_CATEGORIES);
  });

  // Disk-usage snapshot for the "Обзор" tab (docs/PLAN.md "кэш картинок по
  // ГБ") — polled every few seconds while the background filler is active.
  app.get("/catalog/cache-usage", async () => {
    return getCacheUsage();
  });

  app.get("/catalog/query-tags", async () => {
    return getAllQueryTags(GALLERY_CATEGORIES);
  });

  app.patch<{ Params: { category: string } }>("/catalog/query-tags/:category", async (request, reply) => {
    const parsedCategory = normalizeGalleryCategory(request.params.category);
    if (!parsedCategory) {
      return reply.status(400).send({ error: "Invalid category" });
    }
    const parsedBody = updateCategoryQueryTagsSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({ error: parsedBody.error.flatten() });
    }
    try {
      return await setQueryTags(parsedCategory, parsedBody.data.tags);
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { category: string } }>("/catalog/scrape/:category/run", async (request, reply) => {
    const parsedCategory = normalizeGalleryCategory(request.params.category);
    if (!parsedCategory) {
      return reply.status(400).send({ error: "Invalid category" });
    }
    triggerManualRun(parsedCategory, request.log);
    return reply.status(202).send({ triggered: true });
  });
}
