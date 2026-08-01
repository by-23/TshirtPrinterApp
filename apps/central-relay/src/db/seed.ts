import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { DEFAULT_PRICE_CONFIG } from "@tshirt/shared-types";
import { db, pool } from "./client.js";
import { admins, globalPriceConfig, ordersArchive, points } from "./schema.js";
import { env } from "../env.js";
import { ensureBuiltinFontsSeeded } from "../modules/fonts/service.js";

const SALT_ROUNDS = 10;
const GLOBAL_ROW_ID = "global";

async function seedAdmin() {
  const [existing] = await db.select().from(admins).where(eq(admins.login, env.DEFAULT_ADMIN_LOGIN));
  if (existing) {
    console.log(`Admin "${env.DEFAULT_ADMIN_LOGIN}" already exists, skipping`);
    return;
  }

  const passwordHash = await bcrypt.hash(env.DEFAULT_ADMIN_PASSWORD, SALT_ROUNDS);
  await db.insert(admins).values({ login: env.DEFAULT_ADMIN_LOGIN, passwordHash });
  console.log(
    `Created admin "${env.DEFAULT_ADMIN_LOGIN}" / "${env.DEFAULT_ADMIN_PASSWORD}" — change this before any real deployment!`,
  );
}

async function seedGlobalPriceConfig() {
  const [existing] = await db
    .select()
    .from(globalPriceConfig)
    .where(eq(globalPriceConfig.id, GLOBAL_ROW_ID));
  if (existing) {
    console.log("Global price config already seeded, skipping");
    return;
  }

  await db.insert(globalPriceConfig).values({ id: GLOBAL_ROW_ID, config: DEFAULT_PRICE_CONFIG });
  console.log("Global price config seeded");
}

/** Demo point + `orders_archive` rows so `StatsPage` has something to chart before Stage 7 wires real order push. */
async function seedDemoPointAndStats() {
  const existingPoints = await db.select().from(points);
  if (existingPoints.length > 0) {
    console.log(`${existingPoints.length} point(s) already exist, skipping demo point/stats seed`);
    return;
  }

  const operatorPasswordHash = await bcrypt.hash("operator123", SALT_ROUNDS);
  const [point] = await db
    .insert(points)
    .values({
      name: "Демо-точка №1",
      status: "open",
      uploadMode: "relay",
      operatorLogin: "operator1",
      operatorPasswordHash,
      syncToken: randomUUID(),
    })
    .returning();

  console.log(`Created demo point "${point!.name}" (id: ${point!.id}, syncToken: ${point!.syncToken})`);

  const garmentTypes = ["tshirt", "sweatshirt", "cap", "shopper"] as const;
  const printSizes = ["small", "medium", "large"] as const;
  const prices = [6990, 7990, 8990, 11990, 12990];

  const demoRows: (typeof ordersArchive.$inferInsert)[] = [];
  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const ordersOnDay = Math.floor(Math.random() * 5);
    for (let i = 0; i < ordersOnDay; i++) {
      const createdAt = new Date();
      createdAt.setUTCDate(createdAt.getUTCDate() - dayOffset);
      createdAt.setUTCHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
      demoRows.push({
        pointId: point!.id,
        status: "done",
        garmentType: garmentTypes[Math.floor(Math.random() * garmentTypes.length)]!,
        printSize: printSizes[Math.floor(Math.random() * printSizes.length)]!,
        price: prices[Math.floor(Math.random() * prices.length)]!,
        printCount: Math.random() < 0.15 ? 2 + Math.floor(Math.random() * 2) : 1,
        createdAt,
      });
    }
  }

  if (demoRows.length > 0) {
    await db.insert(ordersArchive).values(demoRows);
  }
  console.log(`Seeded ${demoRows.length} demo order(s) into orders_archive`);
}

async function seed() {
  await seedAdmin();
  await seedGlobalPriceConfig();
  await ensureBuiltinFontsSeeded();
  console.log("Built-in editor fonts seeded");
  await seedDemoPointAndStats();
}

await seed();
await pool.end();
