import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import type { StatsOrdersList, StatsSummary } from "@tshirt/shared-types";
import { garmentTypeSchema, orderStatusSchema, printSizeSchema } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { ordersArchive, points } from "../../db/schema.js";

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;
const DEFAULT_ORDERS_LIMIT = 50;
const MAX_ORDERS_LIMIT = 200;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseQuery(query: Record<string, unknown>): {
  since: Date;
  until: Date | null;
  days: number;
  pointId: string | null;
} {
  const pointIdRaw = typeof query.pointId === "string" ? query.pointId.trim() : "";
  const pointId = pointIdRaw.length > 0 ? pointIdRaw : null;

  const fromRaw = typeof query.from === "string" ? query.from.trim() : "";
  const toRaw = typeof query.to === "string" ? query.to.trim() : "";

  if (fromRaw || toRaw) {
    const since = fromRaw ? new Date(`${fromRaw}T00:00:00.000Z`) : new Date(0);
    const until = toRaw ? new Date(`${toRaw}T23:59:59.999Z`) : null;
    const days =
      until && Number.isFinite(since.getTime()) && Number.isFinite(until.getTime())
        ? Math.max(1, Math.ceil((until.getTime() - since.getTime()) / 86_400_000) + 1)
        : DEFAULT_DAYS;
    return { since, until, days: Math.min(days, MAX_DAYS), pointId };
  }

  const daysParam = Number(query.days);
  const days =
    Number.isFinite(daysParam) && daysParam > 0 ? Math.min(Math.trunc(daysParam), MAX_DAYS) : DEFAULT_DAYS;

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  return { since, until: null, days, pointId };
}

function archiveFilters(since: Date, until: Date | null, pointId: string | null): SQL | undefined {
  const parts: SQL[] = [gte(ordersArchive.createdAt, since)];
  if (until) parts.push(lte(ordersArchive.createdAt, until));
  if (pointId) parts.push(eq(ordersArchive.pointId, pointId));
  return parts.length === 1 ? parts[0] : and(...parts);
}

/**
 * Aggregates `orders_archive` in JS rather than SQL `GROUP BY` — the table is
 * small (single relay, pushed via Stage 7 sync) and this keeps the daily
 * bucket list gap-free (days with zero orders still show up on the chart).
 */
export async function statsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/stats/summary", async (request) => {
    const { since, until, days, pointId } = parseQuery(request.query as Record<string, unknown>);
    const where = archiveFilters(since, until, pointId);

    const [archiveRows, pointRows] = await Promise.all([
      db.select().from(ordersArchive).where(where),
      db.select().from(points),
    ]);

    const pointNameById = new Map(pointRows.map((p) => [p.id, p.name]));

    const chartStart = new Date(since);
    chartStart.setUTCHours(0, 0, 0, 0);
    const chartDays = until
      ? Math.min(
          MAX_DAYS,
          Math.max(1, Math.ceil(((until.getTime() - chartStart.getTime()) / 86_400_000) + 1)),
        )
      : days;

    const dailyMap = new Map<string, { ordersCount: number; printsCount: number; revenueTenge: number }>();
    for (let i = 0; i < chartDays; i++) {
      const d = new Date(chartStart);
      d.setUTCDate(d.getUTCDate() + i);
      dailyMap.set(toDateKey(d), { ordersCount: 0, printsCount: 0, revenueTenge: 0 });
    }

    const byPointMap = new Map<
      string,
      { pointName: string; ordersCount: number; printsCount: number; revenueTenge: number }
    >();

    let totalOrders = 0;
    let totalPrints = 0;
    let totalReprints = 0;
    let totalRevenue = 0;

    for (const row of archiveRows) {
      const prints = row.printCount ?? 0;
      const dateKey = toDateKey(row.createdAt);
      const bucket = dailyMap.get(dateKey);
      if (bucket) {
        bucket.ordersCount += 1;
        bucket.printsCount += prints;
        bucket.revenueTenge += row.price;
      }

      const pointName = pointNameById.get(row.pointId) ?? "Неизвестная точка";
      const pointBucket = byPointMap.get(row.pointId) ?? {
        pointName,
        ordersCount: 0,
        printsCount: 0,
        revenueTenge: 0,
      };
      pointBucket.ordersCount += 1;
      pointBucket.printsCount += prints;
      pointBucket.revenueTenge += row.price;
      byPointMap.set(row.pointId, pointBucket);

      totalOrders += 1;
      totalPrints += prints;
      totalReprints += Math.max(0, prints - 1);
      totalRevenue += row.price;
    }

    const summary: StatsSummary = {
      daily: Array.from(dailyMap.entries()).map(([date, bucket]) => ({ date, ...bucket })),
      byPoint: Array.from(byPointMap.entries())
        .map(([id, bucket]) => ({ pointId: id, ...bucket }))
        .sort((a, b) => b.ordersCount - a.ordersCount),
      totals: {
        ordersCount: totalOrders,
        printsCount: totalPrints,
        reprintsCount: totalReprints,
        revenueTenge: totalRevenue,
      },
    };
    return summary;
  });

  /** Per-order audit list — orders + printCount for cash-register leak checks. */
  app.get("/stats/orders", async (request) => {
    const query = request.query as Record<string, unknown>;
    const { since, until, pointId } = parseQuery(query);
    const where = archiveFilters(since, until, pointId);

    const limitParam = Number(query.limit);
    const offsetParam = Number(query.offset);
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(Math.trunc(limitParam), MAX_ORDERS_LIMIT)
        : DEFAULT_ORDERS_LIMIT;
    const offset =
      Number.isFinite(offsetParam) && offsetParam > 0 ? Math.trunc(offsetParam) : 0;

    const reprintsOnly = query.reprintsOnly === "1" || query.reprintsOnly === "true";
    const statusRaw = typeof query.status === "string" ? query.status.trim() : "";
    const statusParsed = orderStatusSchema.safeParse(statusRaw);

    const filters: SQL[] = where ? [where] : [];
    if (reprintsOnly) filters.push(sql`${ordersArchive.printCount} > 1`);
    if (statusParsed.success) filters.push(eq(ordersArchive.status, statusParsed.data));
    const finalWhere = filters.length === 0 ? undefined : filters.length === 1 ? filters[0] : and(...filters);

    const [pointRows, countRow, rows] = await Promise.all([
      db.select().from(points),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(ordersArchive)
        .where(finalWhere),
      db
        .select()
        .from(ordersArchive)
        .where(finalWhere)
        .orderBy(desc(ordersArchive.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const pointNameById = new Map(pointRows.map((p) => [p.id, p.name]));

    const items = rows.map((row) => {
      const garmentParsed = garmentTypeSchema.safeParse(row.garmentType);
      const printSizeParsed = printSizeSchema.safeParse(row.printSize);
      return {
        id: row.id,
        pointId: row.pointId,
        pointName: pointNameById.get(row.pointId) ?? "Неизвестная точка",
        pointOrderId: row.pointOrderId,
        status: row.status,
        garmentType: garmentParsed.success ? garmentParsed.data : "tshirt",
        printSize: printSizeParsed.success ? printSizeParsed.data : "medium",
        price: row.price,
        printCount: row.printCount ?? 0,
        createdAt: row.createdAt.toISOString(),
      };
    });

    const result: StatsOrdersList = {
      items,
      total: Number(countRow[0]?.count ?? 0),
    };
    return result;
  });
}
