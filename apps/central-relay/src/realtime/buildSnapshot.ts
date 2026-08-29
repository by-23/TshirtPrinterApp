import { eq } from "drizzle-orm";
import {
  DEFAULT_PRICE_CONFIG,
  withGarmentAvailabilityDefaults,
  type PartialPriceConfig,
  type PriceConfig,
  type SyncSnapshotPayload,
} from "@tshirt/shared-types";
import { db } from "../db/client.js";
import {
  globalPriceConfig,
  pointGarmentAvailabilityOverrides,
  pointPriceOverrides,
  points,
} from "../db/schema.js";
import { getGlobalGarmentCatalog } from "../modules/garment-catalog/service.js";
import { listFontsForSnapshot } from "../modules/fonts/service.js";

const GLOBAL_ROW_ID = "global";

/** Ensures older DB rows (pre-coverage-thresholds) still produce a full `PriceConfig`. */
function withPriceConfigDefaults(config: PriceConfig | undefined): PriceConfig {
  if (!config) return DEFAULT_PRICE_CONFIG;
  return {
    ...DEFAULT_PRICE_CONFIG,
    ...config,
    basePriceTenge: { ...DEFAULT_PRICE_CONFIG.basePriceTenge, ...config.basePriceTenge },
    fabricSurchargeTenge: { ...DEFAULT_PRICE_CONFIG.fabricSurchargeTenge, ...config.fabricSurchargeTenge },
    sizeSurchargeTenge: { ...DEFAULT_PRICE_CONFIG.sizeSurchargeTenge, ...config.sizeSurchargeTenge },
    printSizeSurchargeTenge: {
      ...DEFAULT_PRICE_CONFIG.printSizeSurchargeTenge,
      ...config.printSizeSurchargeTenge,
    },
    aiProviderSurchargeTenge: {
      ...DEFAULT_PRICE_CONFIG.aiProviderSurchargeTenge,
      ...config.aiProviderSurchargeTenge,
    },
    printCoverageThresholds: {
      ...DEFAULT_PRICE_CONFIG.printCoverageThresholds,
      ...config.printCoverageThresholds,
    },
  };
}

/** Shallow-merges a point's partial override on top of the global config, map by map. */
function mergePriceConfig(global: PriceConfig, override: PartialPriceConfig | undefined): PriceConfig {
  const base = withPriceConfigDefaults(global);
  if (!override) return base;
  return {
    basePriceTenge: { ...base.basePriceTenge, ...override.basePriceTenge },
    fabricSurchargeTenge: { ...base.fabricSurchargeTenge, ...override.fabricSurchargeTenge },
    sizeSurchargeTenge: { ...base.sizeSurchargeTenge, ...override.sizeSurchargeTenge },
    printSizeSurchargeTenge: { ...base.printSizeSurchargeTenge, ...override.printSizeSurchargeTenge },
    aiProviderSurchargeTenge: {
      ...DEFAULT_PRICE_CONFIG.aiProviderSurchargeTenge,
      ...base.aiProviderSurchargeTenge,
      ...override.aiProviderSurchargeTenge,
    },
    printCoverageThresholds: {
      ...DEFAULT_PRICE_CONFIG.printCoverageThresholds,
      ...base.printCoverageThresholds,
      ...override.printCoverageThresholds,
    },
  };
}

/**
 * Builds the full `sync:snapshot` payload for a single point — point
 * identity/status, effective price config, optional garment-availability
 * admin override, and the editor font catalog.
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
  const [garmentOverrideRow] = await db
    .select()
    .from(pointGarmentAvailabilityOverrides)
    .where(eq(pointGarmentAvailabilityOverrides.pointId, pointId));

  const global = withPriceConfigDefaults(globalRow?.config);
  const priceConfig = mergePriceConfig(global, overrideRow?.config);
  const fonts = await listFontsForSnapshot();
  const garmentCatalog = await getGlobalGarmentCatalog();

  if (garmentOverrideRow) {
    return {
      pointConfig: { name: point.name, status: point.status, uploadMode: point.uploadMode },
      priceConfig,
      garmentAvailabilityOverrideActive: true,
      garmentAvailability: withGarmentAvailabilityDefaults(garmentOverrideRow.availability),
      garmentCatalog,
      fonts,
    };
  }

  return {
    pointConfig: { name: point.name, status: point.status, uploadMode: point.uploadMode },
    priceConfig,
    garmentAvailabilityOverrideActive: false,
    garmentCatalog,
    fonts,
  };
}

export async function getAllPointIds(): Promise<string[]> {
  const rows = await db.select({ id: points.id }).from(points);
  return rows.map((row) => row.id);
}
