import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildServer } from "./server.js";
import { env } from "./env.js";

function runNodeScript(relativeToIndex: string): void {
  const scriptPath = fileURLToPath(new URL(relativeToIndex, import.meta.url));
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${scriptPath} exited with code ${result.status ?? "null"}`);
  }
}

// Cloud/PaaS boot: apply migrations (and optional seed) before accepting traffic.
if (process.env.MIGRATE_ON_START === "1" || process.env.MIGRATE_ON_START === "true") {
  runNodeScript("./db/migrate.js");
}
if (env.SEED_ON_START) {
  runNodeScript("./db/seed.js");
}

const app = await buildServer();

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
