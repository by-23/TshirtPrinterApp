import type { FastifyInstance } from "fastify";
import { gte } from "drizzle-orm";
import type { StatsSummary } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { ordersArchive, points } from "../../db/schema.js";

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Aggregates `orders_archive` in JS rather than SQL `GROUP BY` — the table is
 * small (single relay, pushed via Stage 7 sync) and this keeps the daily
 * bucket list gap-free (days with zero orders still show up on the chart).
 */
export async function statsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/stats/summary", async (request) => {
    const daysParam = Number((request.query as Record<string, unknown>).days);
    const days =
      Number.isFinite(daysParam) && daysParam > 0 ? Math.min(Math.trunc(daysParam), MAX_DAYS) : DEFAULT_DAYS;

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const [archiveRows, pointRows] = await Promise.all([
      db.select().from(ordersArchive).where(gte(ordersArchive.createdAt, since)),
      db.select().from(points),
    ]);

    const pointNameById = new Map(pointRows.map((p) => [p.id, p.name]));

    const dailyMap = new Map<string, { ordersCount: number; revenueTenge: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      dailyMap.set(toDateKey(d), { ordersCount: 0, revenueTenge: 0 });
    }

    const byPointMap = new Map<
      string,
      { pointName: string; ordersCount: number; revenueTenge: number }
    >();

    let totalOrders = 0;
    let totalRevenue = 0;

    for (const row of archiveRows) {
      const dateKey = toDateKey(row.createdAt);
      const bucket = dailyMap.get(dateKey);
      if (bucket) {
        bucket.ordersCount += 1;
        bucket.revenueTenge += row.price;
      }

      const pointName = pointNameById.get(row.pointId) ?? "Неизвестная точка";
      const pointBucket = byPointMap.get(row.pointId) ?? {
        pointName,
        ordersCount: 0,
        revenueTenge: 0,
      };
      pointBucket.ordersCount += 1;
      pointBucket.revenueTenge += row.price;
      byPointMap.set(row.pointId, pointBucket);

      totalOrders += 1;
      totalRevenue += row.price;
    }

    const summary: StatsSummary = {
      daily: Array.from(dailyMap.entries()).map(([date, bucket]) => ({ date, ...bucket })),
      byPoint: Array.from(byPointMap.entries()).map(([pointId, bucket]) => ({ pointId, ...bucket })),
      totals: { ordersCount: totalOrders, revenueTenge: totalRevenue },
    };
    return summary;
  });
}
