// Builds the Express app: security headers, CORS, JSON parsing, routes, errors.
// Kept separate from index.ts so tests can import the app without starting a server.
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { corsOrigins } from "./env.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { contentRouter } from "./routes/content.js";
import { healthRouter } from "./routes/health.js";
import { menuRouter } from "./routes/menu.js";
import { publicRouter } from "./routes/public.js";
import { roomsRouter } from "./routes/rooms.js";
import { serveUploads } from "./lib/uploads.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser()); // reads the admin session cookie

  app.use("/health", healthRouter);
  app.use("/rooms", roomsRouter);
  app.use("/menu", menuRouter);
  app.use("/content", contentRouter);
  app.use("/uploads", ...serveUploads); // uploaded photos
  app.use("/public", publicRouter); // shapes for the public website

  // Admin login. /admin/login, /admin/logout and /admin/me are aliases of /auth/*.
  app.use("/auth", authRouter);
  app.use("/admin", authRouter);
  app.use("/admin", adminRouter); // everything else under /admin needs a session

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
