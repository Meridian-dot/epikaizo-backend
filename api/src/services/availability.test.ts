// Tests for the availability maths. Run with: npm test
// Each test describes one rule a guesthouse booking system must get right.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type BlockForAvailability,
  type BookingForAvailability,
  computeNights,
  holdsRoom,
  minAvailable,
} from "./availability.js";

const NOW = new Date("2026-12-01T10:00:00Z");
const HOUR = 3_600_000;

function confirmed(checkIn: string, checkOut: string): BookingForAvailability {
  return { checkIn, checkOut, status: "confirmed", expiresAt: null };
}

// Runs computeNights for a room type with `totalUnits` rooms and returns { date: available }.
function availability(
  totalUnits: number,
  from: string,
  to: string,
  bookings: BookingForAvailability[] = [],
  blocks: BlockForAvailability[] = [],
) {
  const nights = computeNights({ totalUnits, from, to, bookings, blocks, now: NOW });
  return Object.fromEntries(nights.map((n) => [n.date, n.available]));
}

describe("computeNights", () => {
  it("shows every room free when there are no bookings", () => {
    assert.deepEqual(availability(4, "2026-12-20", "2026-12-23"), {
      "2026-12-20": 4,
      "2026-12-21": 4,
      "2026-12-22": 4,
    });
  });

  it("takes a room on each night from check-in up to, but not including, check-out", () => {
    assert.deepEqual(availability(4, "2026-12-19", "2026-12-24", [confirmed("2026-12-20", "2026-12-23")]), {
      "2026-12-19": 4,
      "2026-12-20": 3,
      "2026-12-21": 3,
      "2026-12-22": 3,
      "2026-12-23": 4, // the guest leaves on the 23rd, so that night is free
    });
  });

  it("lets one guest check out and another check in on the same day without a clash", () => {
    const back2back = [confirmed("2026-12-20", "2026-12-23"), confirmed("2026-12-23", "2026-12-25")];
    assert.deepEqual(availability(1, "2026-12-20", "2026-12-25", back2back), {
      "2026-12-20": 0,
      "2026-12-21": 0,
      "2026-12-22": 0,
      "2026-12-23": 0, // taken by the second guest only
      "2026-12-24": 0,
    });
  });

  it("reaches zero when every room is taken", () => {
    const twoGuests = [confirmed("2026-12-20", "2026-12-21"), confirmed("2026-12-20", "2026-12-22")];
    assert.deepEqual(availability(2, "2026-12-20", "2026-12-22", twoGuests), {
      "2026-12-20": 0,
      "2026-12-21": 1,
    });
  });

  it("never goes below zero, even if a room type was overbooked by hand", () => {
    const three = [1, 2, 3].map(() => confirmed("2026-12-20", "2026-12-21"));
    assert.deepEqual(availability(2, "2026-12-20", "2026-12-21", three), { "2026-12-20": 0 });
  });

  it("subtracts rooms blocked by staff, counting every unit in the block", () => {
    const block = { startDate: "2026-12-21", endDate: "2026-12-23", units: 2 };
    assert.deepEqual(availability(4, "2026-12-20", "2026-12-24", [], [block]), {
      "2026-12-20": 4,
      "2026-12-21": 2,
      "2026-12-22": 2,
      "2026-12-23": 4, // a block ends the same way a stay does
    });
  });

  it("combines bookings and blocks on the same night", () => {
    const block = { startDate: "2026-12-20", endDate: "2026-12-21", units: 1 };
    assert.deepEqual(availability(3, "2026-12-20", "2026-12-21", [confirmed("2026-12-20", "2026-12-22")], [block]), {
      "2026-12-20": 1,
    });
  });

  it("ignores bookings outside the range asked for", () => {
    const outside = [confirmed("2026-12-01", "2026-12-05"), confirmed("2026-12-30", "2027-01-02")];
    assert.deepEqual(availability(2, "2026-12-20", "2026-12-22", outside), { "2026-12-20": 2, "2026-12-21": 2 });
  });

  it("works across the end of the year", () => {
    assert.deepEqual(availability(1, "2026-12-30", "2027-01-02", [confirmed("2026-12-31", "2027-01-01")]), {
      "2026-12-30": 1,
      "2026-12-31": 0,
      "2027-01-01": 1,
    });
  });
});

describe("holdsRoom", () => {
  it("counts confirmed bookings", () => {
    assert.equal(holdsRoom(confirmed("2026-12-20", "2026-12-21"), NOW), true);
  });

  it("counts a pending request until it expires", () => {
    const pending: BookingForAvailability = {
      checkIn: "2026-12-20",
      checkOut: "2026-12-21",
      status: "pending",
      expiresAt: new Date(NOW.getTime() + HOUR),
    };
    assert.equal(holdsRoom(pending, NOW), true);
    assert.equal(holdsRoom({ ...pending, expiresAt: new Date(NOW.getTime() - HOUR) }, NOW), false);
  });

  it("counts a pending request with no expiry until staff decide", () => {
    assert.equal(
      holdsRoom({ checkIn: "2026-12-20", checkOut: "2026-12-21", status: "pending", expiresAt: null }, NOW),
      true,
    );
  });

  it("ignores declined, cancelled and expired bookings", () => {
    for (const status of ["declined", "cancelled", "expired"] as const) {
      assert.equal(holdsRoom({ checkIn: "2026-12-20", checkOut: "2026-12-21", status, expiresAt: null }, NOW), false);
    }
  });
});

describe("minAvailable", () => {
  it("returns the tightest night of the stay", () => {
    assert.equal(
      minAvailable([
        { date: "2026-12-20", available: 3 },
        { date: "2026-12-21", available: 0 },
        { date: "2026-12-22", available: 2 },
      ]),
      0,
    );
  });
});
