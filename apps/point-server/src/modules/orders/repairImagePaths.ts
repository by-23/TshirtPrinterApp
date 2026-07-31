import { existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { db } from "../../db/client.js";
import { orders } from "../../db/schema.js";
import { dataPath } from "../../lib/dataDir.js";

function fileExistsForRelative(relativePath: string | null): boolean {
  if (!relativePath) return false;
  const parts = relativePath.split("/").filter(Boolean);
  if (parts.length === 0) return false;
  return existsSync(dataPath(...parts));
}

/**
 * If mockup/design paths were cleared but PNGs still exist under DATA_DIR/orders/<id>/,
 * restore the relative paths so /files/orders/... works again.
 */
export async function repairOrderImagePaths(log?: FastifyBaseLogger): Promise<number> {
  const rows = await db.select().from(orders);
  let repaired = 0;

  for (const row of rows) {
    const orderId = String(row.id);
    const designRel = `orders/${orderId}/design.png`;
    const mockupRel = `orders/${orderId}/mockup.png`;
    const designAbs = dataPath("orders", orderId, "design.png");
    const mockupAbs = dataPath("orders", orderId, "mockup.png");

    const nextDesign = fileExistsForRelative(row.designImagePath)
      ? row.designImagePath
      : existsSync(designAbs)
        ? designRel
        : row.designImagePath;
    const nextMockup = fileExistsForRelative(row.mockupImagePath)
      ? row.mockupImagePath
      : existsSync(mockupAbs)
        ? mockupRel
        : row.mockupImagePath;

    if (nextDesign === row.designImagePath && nextMockup === row.mockupImagePath) {
      continue;
    }

    await db
      .update(orders)
      .set({ designImagePath: nextDesign, mockupImagePath: nextMockup })
      .where(eq(orders.id, row.id));
    repaired += 1;
  }

  if (repaired > 0) {
    log?.info(`Repaired image paths for ${repaired} order(s) from DATA_DIR/orders`);
  }
  return repaired;
}
