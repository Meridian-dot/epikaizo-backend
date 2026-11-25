// Room availability: how many rooms of a type are free on each night.
//
// The rule, for every night in the range:
//   available = totalUnits - rooms held by bookings - rooms blocked by staff
//
// A booking "holds" a room on a night if:
//   - the night is on or after check-in AND before check-out
//     (a guest leaving on the 23rd does not occupy the night of the 23rd), and
//   - the booking is confirmed, OR it is pending and has not expired yet.
// Declined, cancelled and expired bookings hold nothing.
//
// The maths lives in computeNights(), which has no database code, so it can be
// tested on its own. getRoomAvailability() just loads the rows and calls it.

import { and, eq, gt, inArray, lt } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { blockedDates, roomBookings, roomTypes } from "../db/schema.js";
import { eachNight } from "../lib/dates.js";

// How long a pending request keeps the room before it lapses.
// 48 hours is our suggestion; change it once Dev C confirms the client's answer.
export const PENDING_HOLD_HOURS = 48;

export type BookingStatus = "pending" | "confirmed" | "declined" | "cancelled" | "expired";

export interface BookingForAvailability {
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD, the day the guest leaves
  status: BookingStatus;
  expiresAt: Date | null; // only matters while pending
}

export interface BlockForAvailability {
  startDate: string; // first blocked night
  endDate: string; // first night that is NOT blocked
  units: number;
}

export interface NightAvailability {
  date: string;
  available: number;
}

/** Does this booking take a room out of stock right now? */
export function holdsRoom(booking: BookingForAvailability, now: Date): boolean {
  if (booking.status === "confirmed") return true;
  if (booking.status === "pending") {
    // A pending request with no expiry set holds the room until staff decide.
    return booking.expiresAt === null || booking.expiresAt > now;
  }
  return false;
}

/** Pure calculation: no database, so it is easy to test. */
export function computeNights(input: {
  totalUnits: number;
  from: string;
  to: string;
  bookings: BookingForAvailability[];
  blocks: BlockForAvailability[];
  now: Date;
}): NightAvailability[] {
  const { totalUnits, from, to, bookings, blocks, now } = input;
  const active = bookings.filter((b) => holdsRoom(b, now));

  return eachNight(from, to).map((night) => {
    // String comparison works because YYYY-MM-DD sorts in date order.
    const booked = active.filter((b) => b.checkIn <= night && night < b.checkOut).length;
    const blocked = blocks
      .filter((bl) => bl.startDate <= night && night < bl.endDate)
      .reduce((sum, bl) => sum + bl.units, 0);
    // Never report a negative number, even if a room was overbooked by hand.
    return { date: night, available: Math.max(0, totalUnits - booked - blocked) };
  });
}

/** The smallest number of free rooms on any night of the stay. 0 means the stay cannot be booked. */
export function minAvailable(nights: NightAvailability[]): number {
  return nights.length === 0 ? 0 : Math.min(...nights.map((n) => n.available));
}

/**
 * Loads one room type's bookings and blocks for the range and works out each night.
 * Returns null if the room type does not exist or is hidden.
 *
 * `db` can be the normal connection or a transaction, so the booking endpoint
 * can re-check availability inside the same transaction that saves the booking.
 */
export async function getRoomAvailability(
  db: Pick<Db, "select">,
  roomTypeId: number,
  from: string,
  to: string,
  now: Date = new Date(),
): Promise<{ roomTypeId: number; totalUnits: number; nights: NightAvailability[] } | null> {
  const [room] = await db
    .select({ id: roomTypes.id, totalUnits: roomTypes.totalUnits })
    .from(roomTypes)
    .where(and(eq(roomTypes.id, roomTypeId), eq(roomTypes.isActive, true)));
  if (!room) return null;

  // Only bookings that overlap the range: they start before it ends and end after it starts.
  const bookings = await db
    .select({
      checkIn: roomBookings.checkIn,
      checkOut: roomBookings.checkOut,
      status: roomBookings.status,
      expiresAt: roomBookings.expiresAt,
    })
    .from(roomBookings)
    .where(
      and(
        eq(roomBookings.roomTypeId, roomTypeId),
        inArray(roomBookings.status, ["pending", "confirmed"]),
        lt(roomBookings.checkIn, to),
        gt(roomBookings.checkOut, from),
      ),
    );

  const blocks = await db
    .select({ startDate: blockedDates.startDate, endDate: blockedDates.endDate, units: blockedDates.units })
    .from(blockedDates)
    .where(
      and(eq(blockedDates.roomTypeId, roomTypeId), lt(blockedDates.startDate, to), gt(blockedDates.endDate, from)),
    );

  return {
    roomTypeId: room.id,
    totalUnits: room.totalUnits,
    nights: computeNights({ totalUnits: room.totalUnits, from, to, bookings, blocks, now }),
  };
}
