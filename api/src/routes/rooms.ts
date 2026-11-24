// Public room endpoints (read-only).
//   GET /rooms        -> all active room types, with amenities and photos
//   GET /rooms/:slug  -> one room type
import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { photos, roomTypes } from "../db/schema.js";
import { HttpError } from "../middleware/errors.js";

export const roomsRouter = Router();

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
