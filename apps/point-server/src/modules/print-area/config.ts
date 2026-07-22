import { eq } from "drizzle-orm";
import {
  DEFAULT_PRINT_AREAS,
  type PrintAreaConfig,
  type UpdatePrintAreaConfigInput,
} from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { printAreaConfig } from "../../db/schema.js";

const CONFIG_ID = 1;

type ConfigRow = typeof printAreaConfig.$inferSelect;

/**
 * Self-heals older rows saved before a garment type existed (e.g. the
 * `hoodie` → `sweatshirt` rename, or `cap`/`shopper` being added later) by
 * filling any missing type with its default rectangles, rather than
 * requiring a one-off data migration.
 */
function withDefaults(stored: Partial<PrintAreaConfig>): PrintAreaConfig {
  return {
    tshirt: stored.tshirt ?? DEFAULT_PRINT_AREAS.tshirt,
    sweatshirt: stored.sweatshirt ?? DEFAULT_PRINT_AREAS.sweatshirt,
    cap: stored.cap ?? DEFAULT_PRINT_AREAS.cap,
    shopper: stored.shopper ?? DEFAULT_PRINT_AREAS.shopper,
  };
}

function serialize(row: ConfigRow): { areas: PrintAreaConfig; updatedAt: string } {
  return { areas: withDefaults(row.areasJson), updatedAt: row.updatedAt };
}

/**
 * Reads the singleton print-area config, seeding defaults on first access.
 * Same race-safe pattern as `catalog-scraper/config.ts`.
 */
export async function getPrintAreaConfig(): Promise<{ areas: PrintAreaConfig; updatedAt: string }> {
  const [existing] = await db.select().from(printAreaConfig).where(eq(printAreaConfig.id, CONFIG_ID));
  if (existing) return serialize(existing);

  await db
    .insert(printAreaConfig)
    .values({ id: CONFIG_ID, areasJson: DEFAULT_PRINT_AREAS })
    .onConflictDoNothing();
  const [row] = await db.select().from(printAreaConfig).where(eq(printAreaConfig.id, CONFIG_ID));
  return serialize(row!);
}

export async function updatePrintAreaConfig(
  input: UpdatePrintAreaConfigInput,
): Promise<{ areas: PrintAreaConfig; updatedAt: string }> {
  await getPrintAreaConfig();
  const [updated] = await db
    .update(printAreaConfig)
    .set({ areasJson: input.areas, updatedAt: new Date().toISOString() })
    .where(eq(printAreaConfig.id, CONFIG_ID))
    .returning();
  return serialize(updated!);
}
