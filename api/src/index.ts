// Starts the API server.
import { createApp } from "./app.js";
import { pool } from "./db/index.js";
import { env } from "./env.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`Epikaizo API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Close the server and database pool cleanly on Ctrl+C or when the host restarts us.
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    pool.end().then(() => process.exit(0));
  });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
