import { z } from "zod";

/** One day's aggregate over `orders_archive` — powers the Recharts line/bar chart on `StatsPage`. */
export const dailyStatBucketSchema = z.object({
  date: z.string(),
  ordersCount: z.number().int().nonnegative(),
  revenueTenge: z.number().nonnegative(),
});
export type DailyStatBucket = z.infer<typeof dailyStatBucketSchema>;

export const pointStatSchema = z.object({
  pointId: z.string(),
  pointName: z.string(),
  ordersCount: z.number().int().nonnegative(),
  revenueTenge: z.number().nonnegative(),
});
export type PointStat = z.infer<typeof pointStatSchema>;

export const statsSummarySchema = z.object({
  daily: z.array(dailyStatBucketSchema),
  byPoint: z.array(pointStatSchema),
  totals: z.object({
    ordersCount: z.number().int().nonnegative(),
    revenueTenge: z.number().nonnegative(),
  }),
});
export type StatsSummary = z.infer<typeof statsSummarySchema>;
