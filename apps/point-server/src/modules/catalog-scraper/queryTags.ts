import { eq } from "drizzle-orm";
import type { CategoryQueryTags, GalleryCategory } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { catalogScrapeQueryTags } from "../../db/schema.js";
import { DEFAULT_QUERY_VARIANTS } from "./queryVariants.js";

type Row = typeof catalogScrapeQueryTags.$inferSelect;

function parseTags(row: Row): string[] {
  try {
    const parsed = JSON.parse(row.tagsJson);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((tag) => typeof tag === "string")) {
      return parsed;
    }
  } catch {
    // Malformed JSON (shouldn't happen outside manual DB edits) — fall
    // through to the code-level defaults below instead of crashing the run.
  }
  return DEFAULT_QUERY_VARIANTS[row.category as GalleryCategory];
}

function serialize(row: Row): CategoryQueryTags {
  return {
    category: row.category as GalleryCategory,
    tags: parseTags(row),
    updatedAt: row.updatedAt,
  };
}

/**
 * Reads the query tags for `category`, seeding the row from
 * `DEFAULT_QUERY_VARIANTS` on first access. Uses `onConflictDoNothing` +
 * re-select for the same reason as `config.ts` — startup can fire this
 * concurrently for all 3 gallery categories.
 */
async function getOrCreateRow(category: GalleryCategory): Promise<Row> {
  const [existing] = await db
    .select()
    .from(catalogScrapeQueryTags)
    .where(eq(catalogScrapeQueryTags.category, category));
  if (existing) return existing;

  await db
    .insert(catalogScrapeQueryTags)
    .values({ category, tagsJson: JSON.stringify(DEFAULT_QUERY_VARIANTS[category]) })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(catalogScrapeQueryTags)
    .where(eq(catalogScrapeQueryTags.category, category));
  return row!;
}

export async function getQueryTags(category: GalleryCategory): Promise<CategoryQueryTags> {
  return serialize(await getOrCreateRow(category));
}

export async function getAllQueryTags(categories: readonly GalleryCategory[]): Promise<CategoryQueryTags[]> {
  return Promise.all(categories.map((category) => getQueryTags(category)));
}

export async function setQueryTags(category: GalleryCategory, tags: string[]): Promise<CategoryQueryTags> {
  const cleaned = tags.map((tag) => tag.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    throw new Error("At least one query tag is required");
  }
  await getOrCreateRow(category);
  const [updated] = await db
    .update(catalogScrapeQueryTags)
    .set({ tagsJson: JSON.stringify(cleaned), updatedAt: new Date().toISOString() })
    .where(eq(catalogScrapeQueryTags.category, category))
    .returning();
  return serialize(updated!);
}
