// Public room endpoints (read-only).
//   GET /rooms                                  -> all active room types, with amenities and photos
//   GET /rooms/:slug                            -> one room type
//   GET /rooms/:id/availability?from=&to=       -> rooms left on each night of a range
import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { photos, roomTypes } from "../db/schema.js";
import { isIsoDate, nightsBetween, todayInWindhoek } from "../lib/dates.js";
import { HttpError } from "../middleware/errors.js";
import { getRoomAvailability } from "../services/availability.js";

export const roomsRouter = Router();

// The longest range the availability calendar can ask for in one request.
const MAX_AVAILABILITY_NIGHTS = 90;

type RoomWithDetails = Awaited<ReturnType<typeof findRooms>>[number];

function findRooms() {
  return db.query.roomTypes.findMany({
    where: eq(roomTypes.isActive, true),
    orderBy: [asc(roomTypes.sortOrder), asc(roomTypes.name)],
    // Load each room's amenities and photos in the same query.
    with: {
      amenities: { with: { amenity: true } },
      photos: { orderBy: [asc(photos.sortOrder)] },
    },
  });
}

// Shape sent to the frontend: amenities as a flat list, no internal columns.
function toPublicRoom(room: RoomWithDetails) {
  return {
    id: room.id,
    name: room.name,
    slug: room.slug,
    description: room.description,
    pricePerNight: room.pricePerNight,
    maxGuests: room.maxGuests,
    amenities: room.amenities.map((a) => ({ id: a.amenity.id, name: a.amenity.name, icon: a.amenity.icon })),
    photos: room.photos.map((p) => ({ id: p.id, url: p.url, alt: p.alt })),
  };
}

roomsRouter.get("/", async (_req, res) => {
  const rooms = await findRooms();
  res.json(rooms.map(toPublicRoom));
});

// ---------- Availability ----------
// Registered before "/:slug" so the two routes are easy to tell apart when reading.

const AvailabilityParams = z.object({ id: z.coerce.number().int().positive() });

const isoDate = z.string().refine(isIsoDate, "Must be a real date in the format YYYY-MM-DD");

const AvailabilityQuery = z
  .object({ from: isoDate, to: isoDate })
  .refine((q) => q.from < q.to, { message: "'to' must be after 'from'", path: ["to"] })
  .refine((q) => q.from >= todayInWindhoek(), { message: "'from' cannot be in the past", path: ["from"] })
  .refine((q) => nightsBetween(q.from, q.to) <= MAX_AVAILABILITY_NIGHTS, {
    message: `Ask for at most ${MAX_AVAILABILITY_NIGHTS} nights at a time`,
    path: ["to"],
  });

roomsRouter.get("/:id/availability", async (req, res) => {
  const { id } = AvailabilityParams.parse(req.params);
  const { from, to } = AvailabilityQuery.parse(req.query);

  const result = await getRoomAvailability(db, id, from, to);
  if (!result) throw new HttpError(404, "not_found", "Room not found");

  res.json({ roomTypeId: result.roomTypeId, from, to, nights: result.nights });
});

// ---------- One room ----------

const SlugParams = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/) });

roomsRouter.get("/:slug", async (req, res) => {
  const { slug } = SlugParams.parse(req.params);
  const room = await db.query.roomTypes.findFirst({
    where: and(eq(roomTypes.slug, slug), eq(roomTypes.isActive, true)),
    with: {
      amenities: { with: { amenity: true } },
      photos: { orderBy: [asc(photos.sortOrder)] },
    },
  });
  if (!room) throw new HttpError(404, "not_found", "Room not found");
  res.json(toPublicRoom(room));
});
