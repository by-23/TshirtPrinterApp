import { eq } from "drizzle-orm";
import {
  DEFAULT_DTF_PRINTER_CONFIG,
  withDtfPrinterConfigDefaults,
  type DtfPrinterConfig,
  type UpdateDtfPrinterConfigInput,
} from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { printerConfig } from "../../db/schema.js";

const CONFIG_ID = 1;

type ConfigRow = typeof printerConfig.$inferSelect;

function serialize(row: ConfigRow): { config: DtfPrinterConfig; updatedAt: string } {
  return { config: withDtfPrinterConfigDefaults(row.configJson), updatedAt: row.updatedAt };
}

/** Reads singleton DTF/Epson settings, seeding defaults on first access. */
export async function getDtfPrinterConfig(): Promise<{ config: DtfPrinterConfig; updatedAt: string }> {
  const [existing] = await db.select().from(printerConfig).where(eq(printerConfig.id, CONFIG_ID));
  if (existing) return serialize(existing);

  await db
    .insert(printerConfig)
    .values({ id: CONFIG_ID, configJson: DEFAULT_DTF_PRINTER_CONFIG })
    .onConflictDoNothing();
  const [row] = await db.select().from(printerConfig).where(eq(printerConfig.id, CONFIG_ID));
  return serialize(row!);
}

export async function updateDtfPrinterConfig(
  input: UpdateDtfPrinterConfigInput,
): Promise<{ config: DtfPrinterConfig; updatedAt: string }> {
  await getDtfPrinterConfig();
  const next = withDtfPrinterConfigDefaults(input.config);
  const [updated] = await db
    .update(printerConfig)
    .set({ configJson: next, updatedAt: new Date().toISOString() })
    .where(eq(printerConfig.id, CONFIG_ID))
    .returning();
  return serialize(updated!);
}
