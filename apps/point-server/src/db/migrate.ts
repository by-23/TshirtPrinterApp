import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client.js";

migrate(db, { migrationsFolder: "./drizzle" });
// eslint-disable-next-line no-console
console.log("Migrations applied");
