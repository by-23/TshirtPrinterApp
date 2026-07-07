import { eq } from "drizzle-orm";
import type { AiStyle } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { aiStyles } from "../../db/schema.js";
import { DEFAULT_AI_STYLES } from "./defaultStyles.js";

type AiStyleRow = typeof aiStyles.$inferSelect;

function serialize(row: AiStyleRow): AiStyle {
  return { key: row.key, label: row.label, description: row.description };
}

/** Seeds `DEFAULT_AI_STYLES` on first read — same lazy-seed pattern as `catalog-scraper/queryTags.ts`. */
async function ensureSeeded(): Promise<void> {
  const existing = await db.select({ id: aiStyles.id }).from(aiStyles).limit(1);
  if (existing.length > 0) return;
  await db.insert(aiStyles).values(DEFAULT_AI_STYLES).onConflictDoNothing();
}

/** Active styles for the "Выберите стиль" screen, in display order. */
export async function getEnabledStyles(): Promise<AiStyle[]> {
  await ensureSeeded();
  const rows = await db.select().from(aiStyles).where(eq(aiStyles.enabled, true));
  return rows.sort((a, b) => a.sortOrder - b.sortOrder).map(serialize);
}

/** Looks up the raw row (needed for `promptTemplate`) by `key` — used by `POST /ai/stylize`. */
export async function getStyleByKey(key: string): Promise<AiStyleRow | null> {
  await ensureSeeded();
  const [row] = await db.select().from(aiStyles).where(eq(aiStyles.key, key));
  return row ?? null;
}
