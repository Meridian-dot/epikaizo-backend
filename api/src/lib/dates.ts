// Small helpers for calendar dates written as "YYYY-MM-DD" strings.
//
// We deliberately keep booking dates as plain strings, not JavaScript Date objects.
// A check-in date is a day on the calendar, not a moment in time, and Date objects
// silently shift days when the server and the guest are in different time zones.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True if `value` is a real calendar date written as YYYY-MM-DD (rejects 2026-02-30). */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Adds (or subtracts) whole days: addDays("2026-12-31", 1) -> "2027-01-01". */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Number of nights between two dates: nightsBetween("2026-12-20", "2026-12-23") -> 3. */
export function nightsBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Every night from `from` up to, but NOT including, `to`.
 * eachNight("2026-12-20", "2026-12-23") -> ["2026-12-20", "2026-12-21", "2026-12-22"]
 */
export function eachNight(from: string, to: string): string[] {
  const nights: string[] = [];
  for (let night = from; night < to; night = addDays(night, 1)) nights.push(night);
  return nights;
}

/** Today's date in Windhoek, as YYYY-MM-DD. The guesthouse's "today", not the server's. */
export function todayInWindhoek(now: Date = new Date()): string {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Windhoek",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
