// Read-only endpoints for the public website (epikaizo-frontend, src/lib/api.ts).
// Same data as /rooms, /menu and /content, in the shapes the website expects
// (epikaizo-frontend src/lib/types.ts), plus setups and settings.
//   GET /public/rooms          active room types with setups
//   GET /public/rooms/:slug    one active room type
//   GET /public/menu           categories with items
//   GET /public/content/:key   page text (home, about, rooms, restaurant, events, contact)
//   GET /public/settings       contact details, hours, ordering times
import { Router } from "express";
import { and, asc, eq, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { menuCategories, menuItems, pageContent, photos, roomSetups, roomTypes, siteSettings } from "../db/schema.js";
import { HttpError } from "../middleware/errors.js";
import { CONTENT_KEYS } from "../lib/content.js";
import { DEFAULT_SETTINGS, SiteSettingsSchema } from "../lib/settings.js";

export const publicRouter = Router();

// Dashboard edits must show up on the next page load, so nothing here is cached.
publicRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const toPhoto = (p: typeof photos.$inferSelect) => ({ id: p.id, url: p.url, alt: p.alt, sortOrder: p.sortOrder });

async function loadRooms(where: SQL | undefined) {
  const rooms = await db.query.roomTypes.findMany({
    where: and(eq(roomTypes.isActive, true), where),
    orderBy: [asc(roomTypes.sortOrder), asc(roomTypes.name)],
    with: {
      amenities: { with: { amenity: true } },
      photos: { orderBy: [asc(photos.sortOrder)] },
      setups: { where: eq(roomSetups.isActive, true), orderBy: [asc(roomSetups.sortOrder), asc(roomSetups.id)] },
    },
  });
  return rooms.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    maxGuests: r.maxGuests,
    totalUnits: r.totalUnits,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
    amenities: r.amenities.map((a) => ({ id: a.amenity.id, name: a.amenity.name, icon: a.amenity.icon })),
    photos: r.photos.map(toPhoto),
    setups: r.setups.map((s) => ({
      id: s.id,
      roomTypeId: s.roomTypeId,
      name: s.name,
      maxGuests: s.maxGuests,
      pricePerNight: s.pricePerNight,
      isActive: s.isActive,
      sortOrder: s.sortOrder,
      onRequestOnly: s.onRequest,
    })),
  }));
}

publicRouter.get("/rooms", async (_req, res) => {
  res.json(await loadRooms(undefined));
});

publicRouter.get("/rooms/:slug", async (req, res) => {
  const { slug } = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/) }).parse(req.params);
  const [room] = await loadRooms(eq(roomTypes.slug, slug));
  if (!room) throw new HttpError(404, "not_found", "Room not found");
  res.json(room);
});

publicRouter.get("/menu", async (_req, res) => {
  const categories = await db.query.menuCategories.findMany({
    orderBy: [asc(menuCategories.sortOrder), asc(menuCategories.name)],
    with: {
      items: { orderBy: [asc(menuItems.sortOrder), asc(menuItems.name)], with: { photos: { orderBy: [asc(photos.sortOrder)] } } },
    },
  });
  res.json(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      items: c.items.map((i) => ({
        id: i.id,
        categoryId: i.categoryId,
        name: i.name,
        description: i.description,
        price: i.price,
        dietaryTags: i.dietaryTags,
        isAvailable: i.isAvailable,
        sortOrder: i.sortOrder,
        sideOptions: i.sideOptions,
        photo: i.photos[0] ? toPhoto(i.photos[0]) : null,
      })),
    })),
  );
});

publicRouter.get("/content/:key", async (req, res) => {
  const { key } = z.object({ key: z.enum(CONTENT_KEYS) }).parse(req.params);
  const page = await db.query.pageContent.findFirst({ where: eq(pageContent.key, key) });
  if (!page) throw new HttpError(404, "not_found", "Page content not found");
  res.json({
    key: page.key,
    title: page.title,
    body: page.body, // all section texts, blank line between them
    subtitle: page.subtitle,
    sections: page.sections,
    updatedAt: page.updatedAt,
  });
});

// The website's PublicSettings shape, built from the dashboard's settings.
// lateCheckOutFeePerHour, freeChildAgeMax and hallCapacity are not in the dashboard yet:
// PLACEHOLDER values until the client confirms them.
publicRouter.get("/settings", async (_req, res) => {
  const row = await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) });
  const s = row ? SiteSettingsSchema.parse(row.data) : DEFAULT_SETTINGS;
  res.json({
    phone: s.contact.phone,
    whatsapp: s.contact.whatsapp,
    email: s.contact.email,
    address: s.contact.address,
    mapsUrl: s.links.googleMaps,
    instagramUrl: s.links.instagram,
    checkInTime: s.checkInTime,
    checkOutTime: s.checkOutTime,
    lateCheckOutFeePerHour: 50, // PLACEHOLDER
    freeChildAgeMax: 12, // PLACEHOLDER
    hallCapacity: 60, // PLACEHOLDER
    restaurant: {
      openingTime: s.restaurant.openingTime,
      closingTime: s.restaurant.closingTime,
      slotMinutes: s.restaurant.slotMinutes,
      maxCoversPerSlot: s.restaurant.maxCoversPerSlot,
    },
    foodOrders: {
      isOrderingOpen: true,
      roomServiceFrom: s.ordering.roomService.from,
      roomServiceUntil: s.ordering.roomService.to,
      collectionFrom: s.ordering.collection.from,
      collectionUntil: s.ordering.collection.to,
      roomServiceFee: s.ordering.roomService.deliveryFee,
      prepMinutes: s.ordering.prepMinutes,
      preOrderNoticeHours: Math.round((s.restaurant.preOrderNoticeMinutes / 60) * 10) / 10,
    },
  });
});
