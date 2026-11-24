// Public menu endpoint (read-only).
//   GET /menu -> categories in order, each with its items in order.
// Items marked unavailable are still sent (isAvailable: false) so the
// frontend can show them as "not available today" instead of hiding them.
import { Router } from "express";
import { asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { menuCategories, menuItems } from "../db/schema.js";

export const menuRouter = Router();

menuRouter.get("/", async (_req, res) => {
  const categories = await db.query.menuCategories.findMany({
    orderBy: [asc(menuCategories.sortOrder), asc(menuCategories.name)],
    with: {
      items: {
        orderBy: [asc(menuItems.sortOrder), asc(menuItems.name)],
        with: { photos: true },
      },
    },
  });

  res.json(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      items: c.items.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        price: i.price,
        dietaryTags: i.dietaryTags,
        isAvailable: i.isAvailable,
        photo: i.photos[0] ? { url: i.photos[0].url, alt: i.photos[0].alt } : null,
      })),
    })),
  );
});
