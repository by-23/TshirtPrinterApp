import type { FastifyInstance } from "fastify";
import { and, eq, like, sql } from "drizzle-orm";
import {
  createDesignSchema,
  designCategorySchema,
  updateDesignSchema,
  setDesignIsolatedSchema,
  POPULAR_DESIGNS_CATEGORY_CAP_RATIO,
  POPULAR_DESIGNS_DEFAULT_LIMIT,
  type DesignCategory,
  type DesignsPage,
} from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { designs } from "../../db/schema.js";
import { GALLERY_CATEGORIES, ensureCategoryStocked, isCategoryPending } from "../catalog-scraper/job.js";
import { getScrapeConfig } from "../catalog-scraper/config.js";
import { deleteStoredImageFile } from "../catalog-scraper/storage.js";

type DesignRow = typeof designs.$inferSelect;

function isGalleryCategory(category: DesignCategory): category is (typeof GALLERY_CATEGORIES)[number] {
  return (GALLERY_CATEGORIES as readonly string[]).includes(category);
}

function serializeDesign(row: DesignRow) {
  return {
    id: String(row.id),
    category: row.category,
    title: row.title,
    imageUrl: row.imageUrl,
    isFeatured: row.isFeatured,
    useCount: row.useCount,
    isolated: row.isolated,
  };
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

/**
 * Most-used first (hearts badge count). Among ties, older rows (lower id)
 * come first so freshly-scraped designs append at the *end* of the bucket
 * instead of shuffling page 1 — keeps offset pagination stable while the
 * background filler is still downloading.
 */
function byUseCountDesc(a: DesignRow, b: DesignRow): number {
  if (b.useCount !== a.useCount) return b.useCount - a.useCount;
  return a.id - b.id;
}

/**
 * Builds the "Популярные принты" home banner list: highest `useCount` first
 * across every category, but capped so a single category can't dominate the
 * block (docs: "не больше 30% из одной категории от общего числа
 * отображаемых в этом блоке").
 *
 * `cap` is at least 1 so a category with genuinely popular designs still
 * gets a slot even when `limit` is small (a literal `floor(limit * 0.3)`
 * would round down to 0 and shut it out entirely). If capping leaves fewer
 * than `limit` items (e.g. too few categories have any designs at all), the
 * remaining slots are backfilled from the leftover pool ignoring the cap —
 * best-effort, since the ratio can't be honoured when there just isn't
 * enough variety yet.
 */
function selectPopularDesigns(rows: DesignRow[], limit: number): DesignRow[] {
  const sorted = [...rows].sort(byUseCountDesc);
  const cap = Math.max(1, Math.floor(limit * POPULAR_DESIGNS_CATEGORY_CAP_RATIO));

  const selected: DesignRow[] = [];
  const leftover: DesignRow[] = [];
  const perCategoryCount = new Map<string, number>();

  for (const row of sorted) {
    if (selected.length >= limit) break;
    const usedSoFar = perCategoryCount.get(row.category) ?? 0;
    if (usedSoFar < cap) {
      selected.push(row);
      perCategoryCount.set(row.category, usedSoFar + 1);
    } else {
      leftover.push(row);
    }
  }

  for (const row of leftover) {
    if (selected.length >= limit) break;
    selected.push(row);
  }

  return selected.sort(byUseCountDesc);
}

export async function catalogRoutes(app: FastifyInstance) {
  app.get("/catalog/designs", async (request, reply) => {
    const query = request.query as Record<string, unknown>;

    let categoryFilter: DesignCategory | undefined;
    if (query.category !== undefined) {
      const parsedCategory = designCategorySchema.safeParse(query.category);
      if (!parsedCategory.success) {
        return reply.status(400).send({ error: "Invalid category" });
      }
      categoryFilter = parsedCategory.data;
    }

    const search = typeof query.search === "string" ? query.search.trim() : "";
    const offsetParam = query.offset !== undefined ? Number(query.offset) : undefined;
    const limitParam = query.limit !== undefined ? Number(query.limit) : undefined;

    // Isolated designs (operator "Изолировать" action, see PATCH .../isolate
    // below) are hidden from every normal listing by default — that's the
    // whole point of isolating one. Only the operator panel's dedicated
    // "Изолированные" filter passes `?isolated=true` to see them (and
    // manage/restore them); nothing else needs to opt in explicitly.
    const isolatedFilter = query.isolated === "true" ? true : query.isolated === "false" ? false : false;

    const conditions = [
      ...(categoryFilter ? [eq(designs.category, categoryFilter)] : []),
      ...(search ? [like(designs.title, `%${search}%`)] : []),
      eq(designs.isolated, isolatedFilter),
    ];
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Legacy shape (plain array, no pagination) — kept for the admin panel's
    // CatalogPage and the operator "Дизайны" tab, which fetch everything at once.
    if (offsetParam === undefined && limitParam === undefined) {
      const rows = whereClause ? await db.select().from(designs).where(whereClause) : await db.select().from(designs);
      return rows.map(serializeDesign);
    }

    const offset = Number.isFinite(offsetParam) && offsetParam! >= 0 ? offsetParam! : 0;
    const limit = Number.isFinite(limitParam) && limitParam! > 0 ? Math.min(limitParam!, 100) : 12;

    const matching = whereClause ? await db.select().from(designs).where(whereClause) : await db.select().from(designs);
    // Most-used designs float to the top of the category page (docs:
    // "Картинки с большим количеством сердечек отображаются вверху на
    // страницах категорий").
    matching.sort(byUseCountDesc);
    const total = matching.length;
    const page = matching.slice(offset, offset + limit);

    // Keep the gallery's local cache ahead of the scroll position — see
    // docs/PLAN.md Этап 3 "Наполнение и подгрузка". Only for plain browsing
    // (no search filter): a search slice shouldn't drive what the scraper
    // downloads for the whole category.
    if (categoryFilter && !search && isGalleryCategory(categoryFilter)) {
      const config = await getScrapeConfig();
      if (total - (offset + limit) < config.bufferSize) {
        ensureCategoryStocked(categoryFilter, offset + limit + config.bufferSize, request.log);
      }
    }

    // Tells the gallery whether to keep showing the spinner card even once
    // `items` has caught up with `total` — otherwise the list would cut off
    // abruptly while the scraper is still mid-download for this category.
    const scraping = Boolean(
      categoryFilter && !search && isGalleryCategory(categoryFilter) && isCategoryPending(categoryFilter),
    );

    return { items: page.map(serializeDesign), total, scraping } satisfies DesignsPage;
  });

  // Home page "Популярные принты" banner — highest `useCount` first across
  // every category, capped per-category (see `selectPopularDesigns`).
  // Registered above the `:id` route below — distinct static path, but kept
  // in source order for clarity.
  app.get("/catalog/designs/popular", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const limitParam = query.limit !== undefined ? Number(query.limit) : undefined;
    const limit =
      Number.isFinite(limitParam) && limitParam! > 0
        ? Math.min(limitParam!, 100)
        : POPULAR_DESIGNS_DEFAULT_LIMIT;

    const rows = await db
      .select()
      .from(designs)
      .where(and(sql`${designs.imageUrl} != ''`, eq(designs.isolated, false)));
    const popular = selectPopularDesigns(rows, limit);
    return reply.send(popular.map(serializeDesign));
  });

  // Called from the kiosk editor once a print order using this design is
  // successfully created — the real "used by a customer" signal that powers
  // the hearts badge and popularity ranking (docs: "подсчет сколько раз
  // картинка была использована пользователями").
  app.post<{ Params: { id: string } }>("/catalog/designs/:id/use", async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) {
      return reply.status(400).send({ error: "Invalid id" });
    }

    const [row] = await db
      .update(designs)
      .set({ useCount: sql`${designs.useCount} + 1` })
      .where(eq(designs.id, id))
      .returning();
    if (!row) {
      return reply.status(404).send({ error: "Design not found" });
    }
    return serializeDesign(row);
  });

  // Operator "Изолировать"/"Вернуть" action (Designs → Галерея panel) —
  // hides a design from the kiosk gallery and the panel's normal
  // per-category listing without deleting it, by flipping `isolated`. The
  // design keeps its original `category`; isolation is just a filter (see
  // the `isolated` query param above and the panel's "Изолированные" chip
  // on the frontend).
  app.patch<{ Params: { id: string } }>("/catalog/designs/:id/isolate", async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) {
      return reply.status(400).send({ error: "Invalid id" });
    }

    const parsed = setDesignIsolatedSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const [row] = await db
      .update(designs)
      .set({ isolated: parsed.data.isolated })
      .where(eq(designs.id, id))
      .returning();
    if (!row) {
      return reply.status(404).send({ error: "Design not found" });
    }
    return serializeDesign(row);
  });

  app.get<{ Params: { id: string } }>("/catalog/designs/:id", async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) {
      return reply.status(400).send({ error: "Invalid id" });
    }

    const [row] = await db.select().from(designs).where(eq(designs.id, id));
    if (!row) {
      return reply.status(404).send({ error: "Design not found" });
    }
    return serializeDesign(row);
  });

  app.post("/catalog/designs", async (request, reply) => {
    const parsed = createDesignSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const [row] = await db.insert(designs).values(parsed.data).returning();
    return reply.status(201).send(serializeDesign(row!));
  });

  app.patch<{ Params: { id: string } }>("/catalog/designs/:id", async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) {
      return reply.status(400).send({ error: "Invalid id" });
    }

    const parsed = updateDesignSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }

    const [row] = await db.update(designs).set(parsed.data).where(eq(designs.id, id)).returning();
    if (!row) {
      return reply.status(404).send({ error: "Design not found" });
    }
    return serializeDesign(row);
  });

  // Bulk "clear category" for the operator's Designs → Галерея tab (cache
  // management) — deletes every design (DB row + on-disk file) in one
  // category, freeing the reported cache usage in one go instead of
  // one-by-one. Placed above `/catalog/designs/:id` — distinct static
  // route, Fastify matches them independently either way.
  app.delete("/catalog/designs", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const parsedCategory = designCategorySchema.safeParse(query.category);
    if (!parsedCategory.success) {
      return reply.status(400).send({ error: "Missing or invalid category" });
    }

    const rows = await db.select().from(designs).where(eq(designs.category, parsedCategory.data));
    await db.delete(designs).where(eq(designs.category, parsedCategory.data));
    await Promise.all(rows.filter((row) => row.imageUrl).map((row) => deleteStoredImageFile(row.imageUrl)));
    return reply.status(200).send({ deleted: rows.length });
  });

  app.delete<{ Params: { id: string } }>("/catalog/designs/:id", async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) {
      return reply.status(400).send({ error: "Invalid id" });
    }

    const [row] = await db.delete(designs).where(eq(designs.id, id)).returning();
    if (!row) {
      return reply.status(404).send({ error: "Design not found" });
    }
    if (row.imageUrl) {
      void deleteStoredImageFile(row.imageUrl);
    }
    return reply.status(204).send();
  });
}
