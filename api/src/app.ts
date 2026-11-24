// Builds the Express app: security headers, CORS, JSON parsing, routes, errors.
// Kept separate from index.ts so tests can import the app without starting a server.
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { corsOrigins } from "./env.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { contentRouter } from "./routes/content.js";
import { healthRouter } from "./routes/health.js";
import { menuRouter } from "./routes/menu.js";
import { roomsRouter } from "./routes/rooms.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ limit: "100kb" }));

  app.use("/health", healthRouter);
  app.use("/rooms", roomsRouter);
  app.use("/menu", menuRouter);
  app.use("/content", contentRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
