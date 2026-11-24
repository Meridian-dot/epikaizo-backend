// Public page text (read-only).
//   GET /content/:key -> title and body for "home", "about" or "contact".
import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { pageContent } from "../db/schema.js";
import { HttpError } from "../middleware/errors.js";

export const contentRouter = Router();

const KeyParams = z.object({ key: z.enum(["home", "about", "contact"]) });

contentRouter.get("/:key", async (req, res) => {
  const { key } = KeyParams.parse(req.params);
  const page = await db.query.pageContent.findFirst({ where: eq(pageContent.key, key) });
  if (!page) throw new HttpError(404, "not_found", "Page content not found");
  res.json({ key: page.key, title: page.title, body: page.body, updatedAt: page.updatedAt });
});
