import { eq } from "drizzle-orm";
import { DEFAULT_GARMENT_CATALOG, withGarmentCatalogDefaults } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { globalGarmentCatalog } from "../../db/schema.js";

const GLOBAL_ROW_ID = "global";

export async function getGlobalGarmentCatalog() {
  const [row] = await db
    .select()
    .from(globalGarmentCatalog)
    .where(eq(globalGarmentCatalog.id, GLOBAL_ROW_ID));
  return withGarmentCatalogDefaults(row?.config ?? DEFAULT_GARMENT_CATALOG);
}

export { GLOBAL_ROW_ID };
