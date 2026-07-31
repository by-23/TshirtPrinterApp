import { z } from "zod";
import { orderStatusSchema } from "./order.js";
import { garmentTypeSchema, printSizeSchema } from "./garment.js";

/** One day's aggregate over `orders_archive` — powers the Recharts line/bar chart on `StatsPage`. */
export const dailyStatBucketSchema = z.object({
  date: z.string(),
  ordersCount: z.number().int().nonnegative(),
  printsCount: z.number().int().nonnegative(),
  revenueTenge: z.number().nonnegative(),
});
export type DailyStatBucket = z.infer<typeof dailyStatBucketSchema>;

export const pointStatSchema = z.object({
  pointId: z.string(),
  pointName: z.string(),
  ordersCount: z.number().int().nonnegative(),
  printsCount: z.number().int().nonnegative(),
  revenueTenge: z.number().nonnegative(),
});
export type PointStat = z.infer<typeof pointStatSchema>;

export const statsSummarySchema = z.object({
  daily: z.array(dailyStatBucketSchema),
  byPoint: z.array(pointStatSchema),
  totals: z.object({
    ordersCount: z.number().int().nonnegative(),
    printsCount: z.number().int().nonnegative(),
    /** Extra prints beyond the first (printCount - 1, floored at 0). */
    reprintsCount: z.number().int().nonnegative(),
    revenueTenge: z.number().nonnegative(),
  }),
});
export type StatsSummary = z.infer<typeof statsSummarySchema>;

/** One archived order row for the admin orders table (cash-register audit). */
export const archivedOrderStatSchema = z.object({
  id: z.string(),
  pointId: z.string(),
  pointName: z.string(),
  pointOrderId: z.number().int().nullable(),
  status: orderStatusSchema,
  garmentType: garmentTypeSchema,
  printSize: printSizeSchema,
  price: z.number().nonnegative(),
  printCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type ArchivedOrderStat = z.infer<typeof archivedOrderStatSchema>;

export const statsOrdersListSchema = z.object({
  items: z.array(archivedOrderStatSchema),
  total: z.number().int().nonnegative(),
});
export type StatsOrdersList = z.infer<typeof statsOrdersListSchema>;
