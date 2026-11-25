// Admin endpoints used by the staff dashboard (web/lib/admin-api.ts).
// Every route here needs a logged-in session (see middleware/auth.ts).
// Response shapes follow web/types/api.ts (Docking Spec v1.1).
//
// Built: summary, rooms + setups + amenities, photo upload + photos, menu, page content,
//        settings, users, room/table bookings (list + confirm/decline/cancel), blocked dates.
// Not built yet: food orders (no table yet;
//        GET /admin/orders returns an empty list).
import { Router } from "express";
import { and, asc, count, desc, eq, gt, ilike, inArray, lt, lte, max, min, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import {
  adminUsers,
  amenities,
  blockedDates,
  menuCategories,
  menuItems,
  pageContent,
  photos,
  restaurantSettings,
  roomBookings,
  roomSetups,
  roomTypeAmenities,
  roomTypes,
  siteSettings,
  tableBookings,
} from "../db/schema.js";
import { HttpError } from "../middleware/errors.js";
import { requireManager, requireStaff } from "../middleware/auth.js";
import { CONTENT_KEYS, sectionsToBody } from "../lib/content.js";
import { DEFAULT_SETTINGS, SiteSettingsSchema } from "../lib/settings.js";
import { deleteUploadedFile, uploadPhoto } from "../lib/uploads.js";

export const adminRouter = Router();
adminRouter.use(requireStaff);

const notFound = (what = "That record") => new HttpError(404, "not_found", `${what} no longer exists.`);
const IdParams = z.object({ id: z.coerce.number().int().positive() });
const id = (params: unknown) => IdParams.parse(params).id;

const Text = (maxLen: number) => z.string().trim().max(maxLen);
const Name = z.string().trim().min(1, "Enter a name").max(120);
const Price = z.number().min(0).max(1_000_000);

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const windhoekToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Windhoek" }).format(new Date());

// ---------------------------------------------------------------------------
// Dashboard home
// ---------------------------------------------------------------------------
adminRouter.get("/summary", async (_req, res) => {
  const today = windhoekToday();
  const n = async (table: typeof roomBookings | typeof tableBookings, where: SQL | undefined) =>
    (await db.select({ n: count() }).from(table).where(where))[0].n;
  res.json({
    pendingRoomRequests: await n(roomBookings, eq(roomBookings.status, "pending")),
    pendingTableRequests: await n(tableBookings, eq(tableBookings.status, "pending")),
    arrivalsToday: await n(roomBookings, and(eq(roomBookings.status, "confirmed"), eq(roomBookings.checkIn, today))),
    departuresToday: await n(roomBookings, and(eq(roomBookings.status, "confirmed"), eq(roomBookings.checkOut, today))),
    tableBookingsToday: await n(tableBookings, and(eq(tableBookings.status, "confirmed"), eq(tableBookings.date, today))),
    newOrders: 0, // food orders are not built yet
    ordersInProgress: 0,
  });
});

// ---------------------------------------------------------------------------
// Rooms, setups and amenities
// ---------------------------------------------------------------------------
async function loadAdminRooms(where?: SQL) {
  const rooms = await db.query.roomTypes.findMany({
    where,
    orderBy: [asc(roomTypes.sortOrder), asc(roomTypes.name)],
    with: {
      amenities: true,
      photos: { orderBy: [asc(photos.sortOrder)] },
      setups: { orderBy: [asc(roomSetups.sortOrder), asc(roomSetups.id)] },
    },
  });
  return rooms.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    totalUnits: r.totalUnits,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
    amenityIds: r.amenities.map((a) => a.amenityId),
    photos: r.photos.map((p) => ({ id: p.id, url: p.url, alt: p.alt, sortOrder: p.sortOrder })),
    setups: r.setups.map((s) => ({
      id: s.id,
      name: s.name,
      maxGuests: s.maxGuests,
      pricePerNight: s.pricePerNight,
      onRequest: s.onRequest,
      isActive: s.isActive,
      sortOrder: s.sortOrder,
    })),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

async function loadAdminRoom(roomId: number) {
  const [room] = await loadAdminRooms(eq(roomTypes.id, roomId));
  if (!room) throw notFound("That room");
  return room;
}

// Keep room_types.price_per_night / max_guests (used by GET /rooms) in step with the setups:
// the cheapest active setup's price and the most guests any active setup takes.
async function syncRoomFromSetups(roomId: number) {
  const [agg] = await db
    .select({ price: min(roomSetups.pricePerNight), guests: max(roomSetups.maxGuests) })
    .from(roomSetups)
    .where(and(eq(roomSetups.roomTypeId, roomId), eq(roomSetups.isActive, true)));
  if (agg?.price == null || agg.guests == null) return;
  await db
    .update(roomTypes)
    .set({ pricePerNight: Number(agg.price), maxGuests: agg.guests })
    .where(eq(roomTypes.id, roomId));
}

async function setAmenities(roomId: number, amenityIds: number[]) {
  await db.delete(roomTypeAmenities).where(eq(roomTypeAmenities.roomTypeId, roomId));
  const unique = [...new Set(amenityIds)];
  if (unique.length) await db.insert(roomTypeAmenities).values(unique.map((amenityId) => ({ roomTypeId: roomId, amenityId })));
}

const RoomBody = z.object({
  name: Name,
  description: Text(5000),
  totalUnits: z.number().int().min(0).max(500),
  amenityIds: z.array(z.number().int().positive()).max(100),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

adminRouter.get("/rooms", async (_req, res) => {
  res.json(await loadAdminRooms());
});

adminRouter.get("/rooms/:id", async (req, res) => {
  res.json(await loadAdminRoom(id(req.params)));
});

adminRouter.post("/rooms", async (req, res) => {
  const body = RoomBody.parse(req.body);
  const slug = slugify(body.name);
  if (!slug) throw new HttpError(400, "invalid_input", "Some fields are invalid", { name: ["Use some letters or numbers."] });
  if (await db.query.roomTypes.findFirst({ where: eq(roomTypes.slug, slug) }))
    throw new HttpError(409, "conflict", "Already used", { name: ["A room with this name already exists."] });
  const [{ n }] = await db.select({ n: count() }).from(roomTypes);
  const [room] = await db
    .insert(roomTypes)
    .values({
      name: body.name,
      slug,
      description: body.description,
      totalUnits: body.totalUnits,
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? n + 1,
      // Filled in from the setups once the first one is added.
      pricePerNight: 0,
      maxGuests: 1,
    })
    .returning();
  await setAmenities(room.id, body.amenityIds);
  res.status(201).json(await loadAdminRoom(room.id));
});

// The slug (web address) stays the same when a room is renamed, so old links keep working.
adminRouter.patch("/rooms/:id", async (req, res) => {
  const roomId = id(req.params);
  const { amenityIds, ...changes } = RoomBody.partial().parse(req.body);
  if (!(await db.query.roomTypes.findFirst({ where: eq(roomTypes.id, roomId) }))) throw notFound("That room");
  if (Object.keys(changes).length) await db.update(roomTypes).set(changes).where(eq(roomTypes.id, roomId));
  if (amenityIds) await setAmenities(roomId, amenityIds);
  res.json(await loadAdminRoom(roomId));
});

const SetupBody = z.object({
  name: Name,
  maxGuests: z.number().int().min(1).max(50),
  pricePerNight: Price,
  onRequest: z.boolean(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const toSetup = (s: typeof roomSetups.$inferSelect) => ({
  id: s.id,
  name: s.name,
  maxGuests: s.maxGuests,
  pricePerNight: s.pricePerNight,
  onRequest: s.onRequest,
  isActive: s.isActive,
  sortOrder: s.sortOrder,
});

adminRouter.post("/rooms/:id/setups", async (req, res) => {
  const roomId = id(req.params);
  const body = SetupBody.parse(req.body);
  if (!(await db.query.roomTypes.findFirst({ where: eq(roomTypes.id, roomId) }))) throw notFound("That room");
  const [{ n }] = await db.select({ n: count() }).from(roomSetups).where(eq(roomSetups.roomTypeId, roomId));
  const [setup] = await db
    .insert(roomSetups)
    .values({ ...body, roomTypeId: roomId, sortOrder: body.sortOrder ?? n + 1 })
    .returning();
  await syncRoomFromSetups(roomId);
  res.status(201).json(toSetup(setup));
});

adminRouter.patch("/setups/:id", async (req, res) => {
  const changes = SetupBody.partial().parse(req.body);
  const [setup] = await db.update(roomSetups).set(changes).where(eq(roomSetups.id, id(req.params))).returning();
  if (!setup) throw notFound("That setup");
  await syncRoomFromSetups(setup.roomTypeId);
  res.json(toSetup(setup));
});

adminRouter.get("/amenities", async (_req, res) => {
  res.json(await db.select().from(amenities).orderBy(asc(amenities.name)));
});

adminRouter.post("/amenities", async (req, res) => {
  const { name } = z.object({ name: Name }).parse(req.body);
  const [existing] = await db.select().from(amenities).where(ilike(amenities.name, name));
  if (existing) throw new HttpError(409, "conflict", "Already used", { name: ["This amenity already exists."] });
  const [a] = await db.insert(amenities).values({ name }).returning();
  res.status(201).json(a);
});

// ---------------------------------------------------------------------------
// Photos: upload the file (POST /admin/uploads), then attach its URL (POST /admin/photos).
// ---------------------------------------------------------------------------
const toPhoto = (p: typeof photos.$inferSelect) => ({ id: p.id, url: p.url, alt: p.alt, sortOrder: p.sortOrder });

adminRouter.post("/uploads", ...uploadPhoto);

adminRouter.get("/photos", async (req, res) => {
  const { gallery } = z.object({ gallery: z.string().optional() }).parse(req.query);
  const where = gallery === "true" ? eq(photos.isGallery, true) : undefined;
  res.json((await db.select().from(photos).where(where).orderBy(asc(photos.sortOrder), asc(photos.id))).map(toPhoto));
});

adminRouter.post("/photos", async (req, res) => {
  const body = z
    .object({
      url: z.string().url().max(2000),
      alt: Text(300),
      roomTypeId: z.number().int().positive().optional(),
      menuItemId: z.number().int().positive().optional(),
      isGallery: z.boolean().optional(),
    })
    .parse(req.body);
  const where = body.roomTypeId
    ? eq(photos.roomTypeId, body.roomTypeId)
    : body.menuItemId
      ? eq(photos.menuItemId, body.menuItemId)
      : eq(photos.isGallery, true);
  // A menu item has at most one photo: replace the old one.
  if (body.menuItemId) {
    const old = await db.delete(photos).where(eq(photos.menuItemId, body.menuItemId)).returning();
    for (const p of old) await deleteUploadedFile(p.url);
  }
  const [{ n }] = await db.select({ n: count() }).from(photos).where(where);
  const [p] = await db
    .insert(photos)
    .values({
      url: body.url,
      alt: body.alt,
      roomTypeId: body.roomTypeId ?? null,
      menuItemId: body.menuItemId ?? null,
      isGallery: !body.roomTypeId && !body.menuItemId,
      sortOrder: n + 1,
    })
    .returning();
  res.status(201).json(toPhoto(p));
});

adminRouter.put("/photos/order", async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.number().int().positive()).max(200) }).parse(req.body);
  await db.transaction(async (tx) => {
    for (const [i, photoId] of ids.entries()) await tx.update(photos).set({ sortOrder: i + 1 }).where(eq(photos.id, photoId));
  });
  res.status(204).end();
});

adminRouter.patch("/photos/:id", async (req, res) => {
  const { alt } = z.object({ alt: Text(300) }).parse(req.body);
  const [p] = await db.update(photos).set({ alt }).where(eq(photos.id, id(req.params))).returning();
  if (!p) throw notFound("That photo");
  res.json(toPhoto(p));
});

adminRouter.delete("/photos/:id", async (req, res) => {
  const [removed] = await db.delete(photos).where(eq(photos.id, id(req.params))).returning();
  if (removed) await deleteUploadedFile(removed.url);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
const DIETARY = ["vegetarian", "vegan", "halal", "gluten-free", "contains-nuts", "spicy"] as const;

adminRouter.get("/menu/categories", async (_req, res) => {
  const rows = await db
    .select({
      id: menuCategories.id,
      name: menuCategories.name,
      sortOrder: menuCategories.sortOrder,
      itemCount: sql<number>`count(${menuItems.id})::int`,
    })
    .from(menuCategories)
    .leftJoin(menuItems, eq(menuItems.categoryId, menuCategories.id))
    .groupBy(menuCategories.id)
    .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));
  res.json(rows);
});

adminRouter.post("/menu/categories", async (req, res) => {
  const { name } = z.object({ name: Name }).parse(req.body);
  const [{ n }] = await db.select({ n: count() }).from(menuCategories);
  const [c] = await db.insert(menuCategories).values({ name, sortOrder: n + 1 }).returning();
  res.status(201).json({ ...c, itemCount: 0 });
});

adminRouter.patch("/menu/categories/:id", async (req, res) => {
  const changes = z.object({ name: Name, sortOrder: z.number().int() }).partial().parse(req.body);
  const catId = id(req.params);
  const [c] = await db.update(menuCategories).set(changes).where(eq(menuCategories.id, catId)).returning();
  if (!c) throw notFound("That category");
  const [{ n }] = await db.select({ n: count() }).from(menuItems).where(eq(menuItems.categoryId, catId));
  res.json({ ...c, itemCount: n });
});

adminRouter.delete("/menu/categories/:id", async (req, res) => {
  const catId = id(req.params);
  const [{ n }] = await db.select({ n: count() }).from(menuItems).where(eq(menuItems.categoryId, catId));
  if (n > 0) throw new HttpError(409, "not_empty", "This category still has dishes. Move or delete them first.");
  await db.delete(menuCategories).where(eq(menuCategories.id, catId));
  res.status(204).end();
});

async function loadMenuItems(where?: SQL) {
  const items = await db.query.menuItems.findMany({
    where,
    orderBy: [asc(menuItems.sortOrder), asc(menuItems.name)],
    with: { photos: { orderBy: [asc(photos.sortOrder)] } },
  });
  return items.map((i) => ({
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
  }));
}

const MenuItemBody = z.object({
  categoryId: z.number().int().positive(),
  name: Name,
  description: Text(2000),
  price: Price,
  dietaryTags: z.array(z.enum(DIETARY)).max(DIETARY.length),
  isAvailable: z.boolean(),
  sortOrder: z.number().int(),
  sideOptions: z.array(z.string().trim().min(1).max(60)).max(20),
});

async function categoryMustExist(categoryId: number | undefined) {
  if (categoryId === undefined) return;
  if (!(await db.query.menuCategories.findFirst({ where: eq(menuCategories.id, categoryId) })))
    throw new HttpError(400, "invalid_input", "Some fields are invalid", { categoryId: ["Choose a category."] });
}

adminRouter.get("/menu/items", async (req, res) => {
  const { categoryId } = z.object({ categoryId: z.coerce.number().int().positive().optional() }).parse(req.query);
  res.json(await loadMenuItems(categoryId ? eq(menuItems.categoryId, categoryId) : undefined));
});

adminRouter.post("/menu/items", async (req, res) => {
  const body = MenuItemBody.parse(req.body);
  await categoryMustExist(body.categoryId);
  const [item] = await db.insert(menuItems).values(body).returning();
  res.status(201).json((await loadMenuItems(eq(menuItems.id, item.id)))[0]);
});

adminRouter.patch("/menu/items/:id", async (req, res) => {
  const itemId = id(req.params);
  const changes = MenuItemBody.partial().parse(req.body);
  await categoryMustExist(changes.categoryId);
  const [item] = await db.update(menuItems).set(changes).where(eq(menuItems.id, itemId)).returning();
  if (!item) throw notFound("That dish");
  res.json((await loadMenuItems(eq(menuItems.id, itemId)))[0]);
});

adminRouter.delete("/menu/items/:id", async (req, res) => {
  await db.delete(menuItems).where(eq(menuItems.id, id(req.params)));
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Website text
// ---------------------------------------------------------------------------
const toPage = (p: typeof pageContent.$inferSelect) => ({
  key: p.key,
  title: p.title,
  subtitle: p.subtitle,
  sections: p.sections,
  updatedAt: p.updatedAt,
});

adminRouter.get("/content", async (_req, res) => {
  const rows = await db.select().from(pageContent);
  // Always in the same order as the dashboard's page list.
  res.json(
    CONTENT_KEYS.flatMap((key) => {
      const row = rows.find((r) => r.key === key);
      return row ? [toPage(row)] : [];
    }),
  );
});

const ContentBody = z.object({
  title: z.string().trim().min(1, "Enter a title").max(200),
  subtitle: Text(500),
  sections: z.array(z.object({ heading: Text(200), body: Text(10000) })).max(30),
});

adminRouter.put("/content/:key", async (req, res) => {
  const { key } = z.object({ key: z.enum(CONTENT_KEYS) }).parse(req.params);
  const body = ContentBody.parse(req.body);
  const values = { ...body, body: sectionsToBody(body.sections) };
  const [page] = await db
    .insert(pageContent)
    .values({ key, ...values })
    .onConflictDoUpdate({ target: pageContent.key, set: { ...values, updatedAt: new Date() } })
    .returning();
  res.json(toPage(page));
});

// ---------------------------------------------------------------------------
// Settings (reading: anyone logged in; saving: manager only)
// ---------------------------------------------------------------------------
adminRouter.get("/settings", async (_req, res) => {
  const row = await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) });
  res.json(row ? SiteSettingsSchema.parse(row.data) : DEFAULT_SETTINGS);
});

adminRouter.put("/settings", requireManager, async (req, res) => {
  const data = SiteSettingsSchema.parse(req.body);
  await db.transaction(async (tx) => {
    await tx
      .insert(siteSettings)
      .values({ id: 1, data })
      .onConflictDoUpdate({ target: siteSettings.id, set: { data, updatedAt: new Date() } });
    // Keep Dev B's restaurant_settings row (used for table slots) in step.
    const r = data.restaurant;
    const rest = { openingTime: r.openingTime, closingTime: r.closingTime, slotMinutes: r.slotMinutes, maxCoversPerSlot: r.maxCoversPerSlot };
    await tx
      .insert(restaurantSettings)
      .values({ id: 1, ...rest })
      .onConflictDoUpdate({ target: restaurantSettings.id, set: rest });
  });
  res.json(data);
});

// ---------------------------------------------------------------------------
// Staff logins (manager only)
// ---------------------------------------------------------------------------
const userColumns = { id: adminUsers.id, name: adminUsers.name, username: adminUsers.username, role: adminUsers.role };
const Password = z.string().min(10, "Use at least 10 characters.").max(200);
const Role = z.enum(["manager", "staff"]);

adminRouter.get("/users", requireManager, async (_req, res) => {
  res.json(await db.select(userColumns).from(adminUsers).orderBy(asc(adminUsers.name)));
});

adminRouter.post("/users", requireManager, async (req, res) => {
  const body = z
    .object({
      name: Name,
      username: z.string().trim().toLowerCase().regex(/^[a-z0-9.]{3,30}$/, "3 to 30 lowercase letters, numbers or dots."),
      password: Password,
      role: Role,
    })
    .parse(req.body);
  if (await db.query.adminUsers.findFirst({ where: eq(adminUsers.username, body.username) }))
    throw new HttpError(409, "conflict", "Already used", { username: ["Someone already has this username."] });
  const [u] = await db
    .insert(adminUsers)
    .values({ name: body.name, username: body.username, role: body.role, passwordHash: await bcrypt.hash(body.password, 10) })
    .returning(userColumns);
  res.status(201).json(u);
});

async function managerCount(exceptId: number) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(adminUsers)
    .where(and(eq(adminUsers.role, "manager"), ne(adminUsers.id, exceptId)));
  return n;
}

adminRouter.patch("/users/:id", requireManager, async (req, res) => {
  const userId = id(req.params);
  const body = z.object({ name: Name, role: Role, password: Password }).partial().parse(req.body);
  if (body.role === "staff" && (await managerCount(userId)) === 0)
    throw new HttpError(409, "invalid_state", "There must be at least one manager.");
  const { password, ...rest } = body;
  const changes = { ...rest, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) };
  const [u] = Object.keys(changes).length
    ? await db.update(adminUsers).set(changes).where(eq(adminUsers.id, userId)).returning(userColumns)
    : await db.select(userColumns).from(adminUsers).where(eq(adminUsers.id, userId));
  if (!u) throw notFound("That login");
  res.json(u);
});

adminRouter.delete("/users/:id", requireManager, async (req, res) => {
  const userId = id(req.params);
  const target = await db.query.adminUsers.findFirst({ where: eq(adminUsers.id, userId) });
  if (userId === req.user!.id || (target?.role === "manager" && (await managerCount(userId)) === 0))
    throw new HttpError(409, "invalid_state", "You can't remove your own login or the last manager.");
  await db.delete(adminUsers).where(eq(adminUsers.id, userId));
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Room and table bookings (list and decide). Guests can't send requests yet
// (POST /bookings/* is Dev B's next step), so these lists start empty.
// ---------------------------------------------------------------------------
const STATUSES = ["pending", "confirmed", "declined", "cancelled", "expired"] as const;
type Status = (typeof STATUSES)[number];
const ACTION_RESULT = { confirm: "confirmed", decline: "declined", cancel: "cancelled" } as const;
const ALLOWED: Record<Status, (keyof typeof ACTION_RESULT)[]> = {
  pending: ["confirm", "decline"],
  confirmed: ["cancel"],
  expired: ["confirm"],
  declined: [],
  cancelled: [],
};

const Paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const StatusList = z
  .string()
  .optional()
  .transform((s) => (s ? s.split(",") : []))
  .pipe(z.array(z.enum(STATUSES)));
const DateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const DecideBody = z.object({ action: z.enum(["confirm", "decline", "cancel"]), message: Text(2000).optional() });

const nightsBetween = (from: string, to: string) =>
  Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) -
    Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86_400_000);

async function decidedByNames(ids: (number | null)[]) {
  const wanted = [...new Set(ids.filter((x): x is number => x !== null))];
  if (!wanted.length) return new Map<number, string>();
  const rows = await db.select({ id: adminUsers.id, name: adminUsers.name }).from(adminUsers).where(inArray(adminUsers.id, wanted));
  return new Map(rows.map((r) => [r.id, r.name]));
}

async function loadRoomBookings(where: SQL | undefined, order: SQL[], limit: number, offset: number) {
  const rows = await db
    .select({ b: roomBookings, roomName: roomTypes.name, price: roomTypes.pricePerNight })
    .from(roomBookings)
    .innerJoin(roomTypes, eq(roomBookings.roomTypeId, roomTypes.id))
    .where(where)
    .orderBy(...order)
    .limit(limit)
    .offset(offset);
  const names = await decidedByNames(rows.map((r) => r.b.decidedBy));
  return rows.map(({ b, roomName, price }) => {
    const nights = nightsBetween(b.checkIn, b.checkOut);
    return {
      id: b.id,
      reference: b.reference,
      roomType: { id: b.roomTypeId, name: roomName },
      // Bookings don't store a setup yet (Dev B: add room_bookings.setup_id with POST /bookings/rooms).
      setup: { id: 0, name: "Not recorded" },
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      nights,
      guests: b.guests,
      pricePerNight: price,
      totalPrice: price * nights,
      guestName: b.guestName,
      email: b.email,
      phone: b.phone,
      notes: b.notes,
      status: b.status,
      expiresAt: b.expiresAt,
      decidedAt: b.decidedAt,
      decidedBy: b.decidedBy ? { id: b.decidedBy, name: names.get(b.decidedBy) ?? "" } : null,
      createdAt: b.createdAt,
    };
  });
}

adminRouter.get("/bookings/rooms", async (req, res) => {
  const f = Paging.extend({
    status: StatusList,
    from: DateParam,
    to: DateParam,
    q: z.string().trim().max(100).optional(),
    sort: z.enum(["createdAt", "checkIn"]).optional(),
  }).parse(req.query);
  const like = f.q ? `%${f.q}%` : undefined;
  const where = and(
    f.status.length ? inArray(roomBookings.status, f.status) : undefined,
    f.to ? lte(roomBookings.checkIn, f.to) : undefined,
    f.from ? gt(roomBookings.checkOut, f.from) : undefined,
    like
      ? or(ilike(roomBookings.guestName, like), ilike(roomBookings.email, like), ilike(roomBookings.phone, like), ilike(roomBookings.reference, like))
      : undefined,
  );
  const [{ n }] = await db.select({ n: count() }).from(roomBookings).where(where);
  const order = f.sort === "checkIn" ? [asc(roomBookings.checkIn)] : [desc(roomBookings.createdAt)];
  const items = await loadRoomBookings(where, order, f.pageSize, (f.page - 1) * f.pageSize);
  res.json({ items, total: n, page: f.page, pageSize: f.pageSize });
});

adminRouter.get("/bookings/rooms/:id", async (req, res) => {
  const [b] = await loadRoomBookings(eq(roomBookings.id, id(req.params)), [], 1, 0);
  if (!b) throw notFound("That booking");
  res.json(b);
});

adminRouter.patch("/bookings/rooms/:id", async (req, res) => {
  const bookingId = id(req.params);
  const { action } = DecideBody.parse(req.body);
  const current = await db.query.roomBookings.findFirst({ where: eq(roomBookings.id, bookingId) });
  if (!current) throw notFound("That booking");
  if (!ALLOWED[current.status].includes(action))
    throw new HttpError(409, "invalid_state", "Someone else has already changed this booking. It has been reloaded.");
  const status = ACTION_RESULT[action];
  await db
    .update(roomBookings)
    .set({ status, decidedBy: req.user!.id, decidedAt: new Date(), ...(status === "confirmed" ? { expiresAt: null } : {}) })
    .where(eq(roomBookings.id, bookingId));
  // TODO (Dev B): email the guest with the optional message.
  res.json((await loadRoomBookings(eq(roomBookings.id, bookingId), [], 1, 0))[0]);
});

async function loadTableBookings(where: SQL | undefined, limit: number, offset: number) {
  const rows = await db
    .select()
    .from(tableBookings)
    .where(where)
    .orderBy(asc(tableBookings.date), asc(tableBookings.timeSlot))
    .limit(limit)
    .offset(offset);
  const names = await decidedByNames(rows.map((r) => r.decidedBy));
  return rows.map((b) => ({
    id: b.id,
    reference: b.reference,
    date: b.date,
    timeSlot: b.timeSlot.slice(0, 5),
    partySize: b.partySize,
    guestName: b.guestName,
    email: b.email,
    phone: b.phone,
    notes: b.notes,
    status: b.status,
    preOrderReference: null, // pre-orders are not built yet
    decidedAt: b.decidedAt,
    decidedBy: b.decidedBy ? { id: b.decidedBy, name: names.get(b.decidedBy) ?? "" } : null,
    createdAt: b.createdAt,
  }));
}

adminRouter.get("/bookings/tables", async (req, res) => {
  const f = Paging.extend({
    date: DateParam,
    status: z.enum(STATUSES).optional(),
    q: z.string().trim().max(100).optional(),
  }).parse(req.query);
  const like = f.q ? `%${f.q}%` : undefined;
  const where = and(
    f.date ? eq(tableBookings.date, f.date) : undefined,
    f.status ? eq(tableBookings.status, f.status) : undefined,
    like
      ? or(ilike(tableBookings.guestName, like), ilike(tableBookings.email, like), ilike(tableBookings.phone, like), ilike(tableBookings.reference, like))
      : undefined,
  );
  const [{ n }] = await db.select({ n: count() }).from(tableBookings).where(where);
  const items = await loadTableBookings(where, f.pageSize, (f.page - 1) * f.pageSize);
  res.json({ items, total: n, page: f.page, pageSize: f.pageSize });
});

adminRouter.patch("/bookings/tables/:id", async (req, res) => {
  const bookingId = id(req.params);
  const { action } = DecideBody.parse(req.body);
  const current = await db.query.tableBookings.findFirst({ where: eq(tableBookings.id, bookingId) });
  if (!current) throw notFound("That booking");
  if (!ALLOWED[current.status].includes(action))
    throw new HttpError(409, "invalid_state", "Someone else has already changed this booking. It has been reloaded.");
  await db
    .update(tableBookings)
    .set({ status: ACTION_RESULT[action], decidedBy: req.user!.id, decidedAt: new Date() })
    .where(eq(tableBookings.id, bookingId));
  res.json((await loadTableBookings(eq(tableBookings.id, bookingId), 1, 0))[0]);
});

// ---------------------------------------------------------------------------
// Blocked dates (endDate is not included, same as check-out)
// ---------------------------------------------------------------------------
async function loadBlocked(where?: SQL) {
  const rows = await db
    .select({ b: blockedDates, roomTypeName: roomTypes.name })
    .from(blockedDates)
    .innerJoin(roomTypes, eq(blockedDates.roomTypeId, roomTypes.id))
    .where(where)
    .orderBy(asc(blockedDates.startDate));
  return rows.map(({ b, roomTypeName }) => ({
    id: b.id,
    roomTypeId: b.roomTypeId,
    roomTypeName,
    startDate: b.startDate,
    endDate: b.endDate,
    units: b.units,
    reason: b.reason,
  }));
}

adminRouter.get("/blocked-dates", async (req, res) => {
  const f = z
    .object({ roomTypeId: z.coerce.number().int().positive().optional(), from: DateParam, to: DateParam })
    .parse(req.query);
  res.json(
    await loadBlocked(
      and(
        f.roomTypeId ? eq(blockedDates.roomTypeId, f.roomTypeId) : undefined,
        f.to ? lt(blockedDates.startDate, f.to) : undefined,
        f.from ? gt(blockedDates.endDate, f.from) : undefined,
      ),
    ),
  );
});

adminRouter.post("/blocked-dates", async (req, res) => {
  const body = z
    .object({
      roomTypeId: z.number().int().positive(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      units: z.number().int().min(1),
      reason: Text(500),
    })
    .refine((b) => b.endDate > b.startDate, { message: "The end date must be after the start date.", path: ["endDate"] })
    .parse(req.body);
  const room = await db.query.roomTypes.findFirst({ where: eq(roomTypes.id, body.roomTypeId) });
  if (!room) throw new HttpError(400, "invalid_input", "Some fields are invalid", { roomTypeId: ["Choose a room."] });
  if (body.units > room.totalUnits) throw new HttpError(409, "unavailable", `${room.name} only has ${room.totalUnits} rooms.`);
  const [b] = await db.insert(blockedDates).values(body).returning();
  res.status(201).json((await loadBlocked(eq(blockedDates.id, b.id)))[0]);
});

adminRouter.delete("/blocked-dates/:id", async (req, res) => {
  await db.delete(blockedDates).where(eq(blockedDates.id, id(req.params)));
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Food orders: not built yet (no orders table). An empty list keeps the dashboard page working.
// ---------------------------------------------------------------------------
adminRouter.get("/orders", (req, res) => {
  const f = Paging.parse(req.query);
  res.json({ items: [], total: 0, page: f.page, pageSize: f.pageSize });
});
