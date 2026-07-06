import { buildServer } from "./server.js";
import { connectToCentralRelay } from "./modules/sync/client.js";
import { env } from "./env.js";

const app = await buildServer();

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then(() => {
    // Started after the HTTP server is up, but never blocks kiosk/operator
    // traffic — see the fail-open note in `modules/sync/client.ts`.
    connectToCentralRelay(app.log);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
