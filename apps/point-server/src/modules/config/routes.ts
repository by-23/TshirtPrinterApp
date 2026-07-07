import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { DEFAULT_PRICE_CONFIG, type PointConfigSnapshot } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { pointConfig } from "../../db/schema.js";

const POINT_CONFIG_ROW_ID = 1;

/**
 * Fail-open defaults for a point that has never synced with central-relay
 * yet (fresh install, or `.env` sync vars unset entirely) — `status: "open"`
 * so a dev/offline stand keeps working out of the box, unlike the
 * `point_config.status` column's own DB default of `"closed"`, which only
 * kicks in once a real point actually exists on central and hasn't been
 * opened yet.
 */
const FAIL_OPEN_POINT_CONFIG: PointConfigSnapshot = {
  name: "",
  status: "open",
  uploadMode: "relay",
};

/** Kiosk (`ClosedScreen` gating) and operator panel read from these — both cached from the last `sync:snapshot`. */
export async function configRoutes(app: FastifyInstance) {
  app.get("/point-config", async () => {
    const [row] = await db.select().from(pointConfig).where(eq(pointConfig.id, POINT_CONFIG_ROW_ID));
    if (!row) return FAIL_OPEN_POINT_CONFIG;
    const result: PointConfigSnapshot = { name: row.name, status: row.status, uploadMode: row.uploadMode };
    return result;
  });

  app.get("/pricing", async () => {
    const [row] = await db.select().from(pointConfig).where(eq(pointConfig.id, POINT_CONFIG_ROW_ID));
    return row?.priceConfigJson ?? DEFAULT_PRICE_CONFIG;
  });
}
