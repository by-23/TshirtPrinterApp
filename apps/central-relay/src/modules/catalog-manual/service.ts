import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { CatalogManualDesign, CatalogManualPointStatus, GalleryCategory } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { catalogManualDesigns, catalogManualPointState, points } from "../../db/schema.js";
import { computePerceptualHash, isNearDuplicate } from "./phash.js";
import { deleteManualDesignFile, storeManualDesignFile } from "./storage.js";

type ManualDesignRow = typeof catalogManualDesigns.$inferSelect;
type ManualPointStateRow = typeof catalogManualPointState.$inferSelect;

export class DuplicateManualDesignError extends Error {
  constructor() {
    super("An image with the same content already exists in this category");
  }
}

async function loadKnownHashes(category: GalleryCategory): Promise<string[]> {
  const rows = await db
    .select({ contentHash: catalogManualDesigns.contentHash })
    .from(catalogManualDesigns)
    .where(and(eq(catalogManualDesigns.category, category), isNull(catalogManualDesigns.deletedAt)));
  return rows.map((row) => row.contentHash);
}

/** Seeds a `pending` sync row for every currently non-deleted manual design — called once from `POST /points`. */
export async function seedManualStateForNewPoint(pointId: string): Promise<void> {
  const designs = await db
    .select({ id: catalogManualDesigns.id })
    .from(catalogManualDesigns)
    .where(isNull(catalogManualDesigns.deletedAt));
  if (designs.length === 0) return;
  await db
    .insert(catalogManualPointState)
    .values(designs.map((design) => ({ pointId, designId: design.id })))
    .onConflictDoNothing();
}

/** Creates a manual design: validates against near-duplicates in the same category, stores the file, and seeds `pending` state for every existing point. */
export async function createManualDesign(input: {
  category: GalleryCategory;
  title: string;
  tempFilePath: string;
}): Promise<ManualDesignRow> {
  const hash = await computePerceptualHash(input.tempFilePath);
  const knownHashes = await loadKnownHashes(input.category);
  if (isNearDuplicate(hash, knownHashes)) {
    throw new DuplicateManualDesignError();
  }

  const storagePath = await storeManualDesignFile(input.tempFilePath);
  const [row] = await db
    .insert(catalogManualDesigns)
    .values({ category: input.category, title: input.title, contentHash: hash, storagePath })
    .returning();

  const pointRows = await db.select({ id: points.id }).from(points);
  if (pointRows.length > 0) {
    await db.insert(catalogManualPointState).values(pointRows.map((point) => ({ pointId: point.id, designId: row!.id })));
  }

  return row!;
}

/** Title/category edit — bumps `revision` and resets every point's sync state to `pending` so the next push/catch-up re-applies it. */
export async function updateManualDesign(
  id: string,
  patch: { title?: string; category?: GalleryCategory },
): Promise<ManualDesignRow | null> {
  const [row] = await db
    .update(catalogManualDesigns)
    .set({ ...patch, revision: sql`${catalogManualDesigns.revision} + 1`, updatedAt: new Date() })
    .where(and(eq(catalogManualDesigns.id, id), isNull(catalogManualDesigns.deletedAt)))
    .returning();
  if (!row) return null;

  await db
    .update(catalogManualPointState)
    .set({ status: "pending", lastError: null, updatedAt: new Date() })
    .where(eq(catalogManualPointState.designId, id));

  return row;
}

/** Soft-deletes (tombstone) + bumps revision + resets every point to `pending` (a "pending delete") + frees the on-disk file. */
export async function deleteManualDesign(id: string): Promise<ManualDesignRow | null> {
  const [row] = await db
    .update(catalogManualDesigns)
    .set({ deletedAt: new Date(), revision: sql`${catalogManualDesigns.revision} + 1`, updatedAt: new Date() })
    .where(and(eq(catalogManualDesigns.id, id), isNull(catalogManualDesigns.deletedAt)))
    .returning();
  if (!row) return null;

  await db
    .update(catalogManualPointState)
    .set({ status: "pending", lastError: null, updatedAt: new Date() })
    .where(eq(catalogManualPointState.designId, id));

  void deleteManualDesignFile(row.storagePath);
  return row;
}

export async function getManualDesignRow(id: string): Promise<ManualDesignRow | null> {
  const [row] = await db.select().from(catalogManualDesigns).where(eq(catalogManualDesigns.id, id));
  return row ?? null;
}

async function loadPointStatuses(designIds: string[]): Promise<Map<string, CatalogManualPointStatus[]>> {
  if (designIds.length === 0) return new Map();
  const rows = await db
    .select({
      designId: catalogManualPointState.designId,
      pointId: catalogManualPointState.pointId,
      status: catalogManualPointState.status,
      lastError: catalogManualPointState.lastError,
      updatedAt: catalogManualPointState.updatedAt,
      pointName: points.name,
      isOnline: points.isOnline,
    })
    .from(catalogManualPointState)
    .innerJoin(points, eq(points.id, catalogManualPointState.pointId))
    .where(inArray(catalogManualPointState.designId, designIds));

  const byDesign = new Map<string, CatalogManualPointStatus[]>();
  for (const row of rows) {
    const list = byDesign.get(row.designId) ?? [];
    list.push({
      pointId: row.pointId,
      pointName: row.pointName,
      isOnline: row.isOnline,
      status: row.status,
      lastError: row.lastError,
      updatedAt: row.updatedAt.toISOString(),
    });
    byDesign.set(row.designId, list);
  }
  return byDesign;
}

function serializeManualDesign(row: ManualDesignRow, pointStatuses: CatalogManualPointStatus[]): CatalogManualDesign {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    appliedCount: pointStatuses.filter((point) => point.status === "applied").length,
    totalPoints: pointStatuses.length,
    points: pointStatuses,
  };
}

export async function listManualDesigns(category?: GalleryCategory): Promise<CatalogManualDesign[]> {
  const rows = await db
    .select()
    .from(catalogManualDesigns)
    .where(
      category
        ? and(eq(catalogManualDesigns.category, category), isNull(catalogManualDesigns.deletedAt))
        : isNull(catalogManualDesigns.deletedAt),
    );
  const statuses = await loadPointStatuses(rows.map((row) => row.id));
  return rows.map((row) => serializeManualDesign(row, statuses.get(row.id) ?? []));
}

export async function getManualDesign(id: string): Promise<CatalogManualDesign | null> {
  const row = await getManualDesignRow(id);
  if (!row || row.deletedAt) return null;
  const statuses = await loadPointStatuses([row.id]);
  return serializeManualDesign(row, statuses.get(row.id) ?? []);
}

/** Every `(point, design)` pair that isn't known-applied at the design's current revision — used both right after a create/edit/delete and on a point's reconnect catch-up. */
export async function listPendingManualSyncForPoint(
  pointId: string,
): Promise<Array<{ design: ManualDesignRow; state: ManualPointStateRow }>> {
  const rows = await db
    .select({ design: catalogManualDesigns, state: catalogManualPointState })
    .from(catalogManualPointState)
    .innerJoin(catalogManualDesigns, eq(catalogManualDesigns.id, catalogManualPointState.designId))
    .where(eq(catalogManualPointState.pointId, pointId));

  return rows.filter(
    ({ design, state }) => state.status !== "applied" || state.appliedRevision < design.revision,
  );
}

/** Applies a point's ack (immediate or a delayed background-retry report) for one design. */
export async function recordManualAck(
  pointId: string,
  designId: string,
  ok: boolean,
  error: string | undefined,
): Promise<void> {
  if (ok) {
    const design = await getManualDesignRow(designId);
    await db
      .update(catalogManualPointState)
      .set({ status: "applied", appliedRevision: design?.revision ?? 0, lastError: null, updatedAt: new Date() })
      .where(and(eq(catalogManualPointState.pointId, pointId), eq(catalogManualPointState.designId, designId)));
    return;
  }
  await db
    .update(catalogManualPointState)
    .set({ status: "error", lastError: error ?? "Unknown error", updatedAt: new Date() })
    .where(and(eq(catalogManualPointState.pointId, pointId), eq(catalogManualPointState.designId, designId)));
}
