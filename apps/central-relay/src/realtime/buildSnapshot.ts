import { eq } from "drizzle-orm";
import { DEFAULT_PRICE_CONFIG, type PriceConfig, type SyncSnapshotPayload } from "@tshirt/shared-types";
import { db } from "../db/client.js";
import { globalPriceConfig, pointPriceOverrides, points } from "../db/schema.js";

const GLOBAL_ROW_ID = "global";

/** Shallow-merges a point's partial override on top of the global config, map by map. */
function mergePriceConfig(global: PriceConfig, override: Partial<PriceConfig> | undefined): PriceConfig {
  if (!override) return global;
  return {
    basePriceTenge: { ...global.basePriceTenge, ...override.basePriceTenge },
    fabricSurchargeTenge: { ...global.fabricSurchargeTenge, ...override.fabricSurchargeTenge },
    sizeSurchargeTenge: { ...global.sizeSurchargeTenge, ...override.sizeSurchargeTenge },
    printSizeSurchargeTenge: { ...global.printSizeSurchargeTenge, ...override.printSizeSurchargeTenge },
  };
}

/**
 * Builds the full `sync:snapshot` payload for a single point — point
 * identity/status and its effective (global + override) price config.
 * Returns `null` if the point no longer exists (e.g. deleted between the
 * triggering write and the push).
 */
export async function buildSnapshotForPoint(pointId: string): Promise<SyncSnapshotPayload | null> {
  const [point] = await db.select().from(points).where(eq(points.id, pointId));
  if (!point) return null;

  const [globalRow] = await db
    .select()
    .from(globalPriceConfig)
    .where(eq(globalPriceConfig.id, GLOBAL_ROW_ID));
  const [overrideRow] = await db
    .select()
    .from(pointPriceOverrides)
    .where(eq(pointPriceOverrides.pointId, pointId));

  const global = globalRow?.config ?? DEFAULT_PRICE_CONFIG;
  const priceConfig = mergePriceConfig(global, overrideRow?.config);

  return {
    pointConfig: { name: point.name, status: point.status, uploadMode: point.uploadMode },
    priceConfig,
  };
}

export async function getAllPointIds(): Promise<string[]> {
  const rows = await db.select({ id: points.id }).from(points);
  return rows.map((row) => row.id);
}
