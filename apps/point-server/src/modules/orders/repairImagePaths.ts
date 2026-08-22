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
 * If mockup/design paths were cleared but PNGs still exist on disk,
 * restore the relative paths so /files/... works again.
 */
export async function repairOrderImagePaths(log?: FastifyBaseLogger): Promise<number> {
  const rows = await db.select().from(orders);
  let repaired = 0;

  for (const row of rows) {
    const orderId = String(row.id);
    const sourceRel = `order-sources/${orderId}.png`;
    const extraSourceRel = row.otherSide ? `order-sources/${orderId}-${row.otherSide}.png` : null;
    const primarySourceRel = row.otherSide ? `order-sources/${orderId}-${row.side}.png` : sourceRel;
    const legacyDesignRel = `orders/${orderId}/design.png`;
    const mockupRel = `orders/${orderId}/mockup.png`;
    const primaryMockupRel = row.otherSide ? `orders/${orderId}/mockup-${row.side}.png` : mockupRel;
    const extraMockupRel = row.otherSide ? `orders/${orderId}/mockup-${row.otherSide}.png` : null;
    const sourceAbs = dataPath("order-sources", `${orderId}.png`);
    const extraSourceAbs = row.otherSide ? dataPath("order-sources", `${orderId}-${row.otherSide}.png`) : null;
    const primarySourceAbs = row.otherSide ? dataPath("order-sources", `${orderId}-${row.side}.png`) : sourceAbs;
    const legacyDesignAbs = dataPath("orders", orderId, "design.png");
    const mockupAbs = dataPath("orders", orderId, "mockup.png");
    const primaryMockupAbs = row.otherSide ? dataPath("orders", orderId, `mockup-${row.side}.png`) : mockupAbs;
    const extraMockupAbs = extraMockupRel ? dataPath("orders", orderId, `mockup-${row.otherSide}.png`) : null;

    const nextDesign = fileExistsForRelative(row.designImagePath)
      ? row.designImagePath
      : existsSync(primarySourceAbs)
        ? primarySourceRel
        : existsSync(sourceAbs)
          ? sourceRel
          : existsSync(legacyDesignAbs)
            ? legacyDesignRel
            : row.designImagePath;
    const nextMockup = fileExistsForRelative(row.mockupImagePath)
      ? row.mockupImagePath
      : existsSync(primaryMockupAbs)
        ? primaryMockupRel
        : existsSync(mockupAbs)
          ? mockupRel
          : row.mockupImagePath;

    const nextOtherDesign =
      !row.otherSide
        ? row.otherDesignImagePath
        : fileExistsForRelative(row.otherDesignImagePath)
          ? row.otherDesignImagePath
          : extraSourceAbs && existsSync(extraSourceAbs)
            ? extraSourceRel
            : row.otherDesignImagePath;
    const nextOtherMockup =
      !row.otherSide
        ? row.otherMockupImagePath
        : fileExistsForRelative(row.otherMockupImagePath)
          ? row.otherMockupImagePath
          : extraMockupAbs && existsSync(extraMockupAbs)
            ? extraMockupRel
            : row.otherMockupImagePath;

    if (
      nextDesign === row.designImagePath &&
      nextMockup === row.mockupImagePath &&
      nextOtherDesign === row.otherDesignImagePath &&
      nextOtherMockup === row.otherMockupImagePath
    ) {
      continue;
    }

    await db
      .update(orders)
      .set({
        designImagePath: nextDesign,
        mockupImagePath: nextMockup,
        otherDesignImagePath: nextOtherDesign,
        otherMockupImagePath: nextOtherMockup,
      })
      .where(eq(orders.id, row.id));
    repaired += 1;
  }

  if (repaired > 0) {
    log?.info(`Repaired image paths for ${repaired} order(s)`);
  }
  return repaired;
}
