// GET /health     -> is the API running?
// GET /health/db  -> can the API reach the database?
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

healthRouter.get("/db", async (_req, res) => {
  await db.execute(sql`select 1`);
  res.json({ status: "ok", database: "reachable" });
});
