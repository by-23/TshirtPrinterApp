import { eq } from "drizzle-orm";
import {
  DEFAULT_GARMENT_AVAILABILITY,
  withGarmentAvailabilityDefaults,
  type GarmentAvailabilityConfig,
  type UpdateGarmentAvailabilityConfigInput,
} from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { garmentAvailabilityConfig } from "../../db/schema.js";
import { emitGarmentAvailabilityEvent } from "../../realtime/socket.js";

const CONFIG_ID = 1;

export class GarmentAvailabilityLockedError extends Error {
  constructor() {
    super("Garment availability is managed by central admin");
    this.name = "GarmentAvailabilityLockedError";
  }
}

type ConfigRow = typeof garmentAvailabilityConfig.$inferSelect;

export type GarmentAvailabilityConfigResult = {
  availability: GarmentAvailabilityConfig;
  adminOverrideActive: boolean;
  updatedAt: string;
};

function serialize(row: ConfigRow): GarmentAvailabilityConfigResult {
  return {
    availability: withGarmentAvailabilityDefaults(row.availabilityJson),
    adminOverrideActive: row.adminOverrideActive,
    updatedAt: row.updatedAt,
  };
}

/**
 * Reads the singleton garment-availability config, seeding defaults on first
 * access. Same race-safe pattern as `print-area/config.ts`.
 */
export async function getGarmentAvailabilityConfig(): Promise<GarmentAvailabilityConfigResult> {
  const [existing] = await db
    .select()
    .from(garmentAvailabilityConfig)
    .where(eq(garmentAvailabilityConfig.id, CONFIG_ID));
  if (existing) return serialize(existing);

  await db
    .insert(garmentAvailabilityConfig)
    .values({
      id: CONFIG_ID,
      availabilityJson: DEFAULT_GARMENT_AVAILABILITY,
      adminOverrideActive: false,
    })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(garmentAvailabilityConfig)
    .where(eq(garmentAvailabilityConfig.id, CONFIG_ID));
  return serialize(row!);
}

export async function updateGarmentAvailabilityConfig(
  input: UpdateGarmentAvailabilityConfigInput,
): Promise<GarmentAvailabilityConfigResult> {
  const current = await getGarmentAvailabilityConfig();
  if (current.adminOverrideActive) {
    throw new GarmentAvailabilityLockedError();
  }
  const availability = withGarmentAvailabilityDefaults(input.availability);
  const [updated] = await db
    .update(garmentAvailabilityConfig)
    .set({ availabilityJson: availability, updatedAt: new Date().toISOString() })
    .where(eq(garmentAvailabilityConfig.id, CONFIG_ID))
    .returning();
  const result = serialize(updated!);
  emitGarmentAvailabilityEvent({
    availability: result.availability,
    adminOverrideActive: result.adminOverrideActive,
  });
  return result;
}

/**
 * Applies a central-admin override from `sync:snapshot`.
 * - active + availability → overwrite local config and lock operator edits
 * - inactive → unlock only; keep the last local/synced availability values
 */
export async function applyGarmentAvailabilityFromSnapshot(input: {
  adminOverrideActive: boolean;
  availability?: GarmentAvailabilityConfig;
}): Promise<void> {
  await getGarmentAvailabilityConfig();

  if (input.adminOverrideActive && input.availability) {
    const availability = withGarmentAvailabilityDefaults(input.availability);
    const [updated] = await db
      .update(garmentAvailabilityConfig)
      .set({
        availabilityJson: availability,
        adminOverrideActive: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(garmentAvailabilityConfig.id, CONFIG_ID))
      .returning();
    const result = serialize(updated!);
    emitGarmentAvailabilityEvent({
      availability: result.availability,
      adminOverrideActive: result.adminOverrideActive,
    });
    return;
  }

  const [updated] = await db
    .update(garmentAvailabilityConfig)
    .set({
      adminOverrideActive: false,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(garmentAvailabilityConfig.id, CONFIG_ID))
    .returning();
  const result = serialize(updated!);
  emitGarmentAvailabilityEvent({
    availability: result.availability,
    adminOverrideActive: result.adminOverrideActive,
  });
}
