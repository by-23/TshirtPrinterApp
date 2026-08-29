import { eq } from "drizzle-orm";
import {
  DEFAULT_GARMENT_CATALOG,
  withGarmentCatalogDefaults,
  type GarmentCatalogConfig,
} from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { garmentCatalogConfig } from "../../db/schema.js";
import { emitGarmentCatalogEvent } from "../../realtime/socket.js";

const CONFIG_ID = 1;

type ConfigRow = typeof garmentCatalogConfig.$inferSelect;

function serialize(row: ConfigRow): GarmentCatalogConfig {
  return withGarmentCatalogDefaults(row.catalogJson);
}

export async function getGarmentCatalogConfig(): Promise<GarmentCatalogConfig> {
  const [existing] = await db
    .select()
    .from(garmentCatalogConfig)
    .where(eq(garmentCatalogConfig.id, CONFIG_ID));
  if (existing) return serialize(existing);

  await db
    .insert(garmentCatalogConfig)
    .values({
      id: CONFIG_ID,
      catalogJson: DEFAULT_GARMENT_CATALOG,
    })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(garmentCatalogConfig)
    .where(eq(garmentCatalogConfig.id, CONFIG_ID));
  return serialize(row!);
}

export async function applyGarmentCatalogFromSnapshot(
  catalog: GarmentCatalogConfig | undefined,
): Promise<void> {
  if (!catalog) return;
  await getGarmentCatalogConfig();
  const next = withGarmentCatalogDefaults(catalog);
  const [updated] = await db
    .update(garmentCatalogConfig)
    .set({ catalogJson: next, updatedAt: new Date().toISOString() })
    .where(eq(garmentCatalogConfig.id, CONFIG_ID))
    .returning();
  emitGarmentCatalogEvent(serialize(updated!));
}
