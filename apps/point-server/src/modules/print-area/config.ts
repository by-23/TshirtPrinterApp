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

function serialize(row: ConfigRow): { areas: PrintAreaConfig; updatedAt: string } {
  return { areas: row.areasJson, updatedAt: row.updatedAt };
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
