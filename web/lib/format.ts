// web/lib/format.ts
// Every date, time and money display in the dashboard goes through these helpers.
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { IsoDate, Timestamp } from "@/types/api";

// 1450 -> "N$ 1,450.00"
export function money(amount: number): string {
  return "N$ " + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// "2026-12-20" -> "Sun 20 Dec 2026". parseISO reads it as a local calendar date, so it never
// slips back a day (new Date("2026-12-20") would).
export function niceDate(d: IsoDate): string {
  return format(parseISO(d), "EEE d MMM yyyy");
}
export function shortDate(d: IsoDate): string {
  return format(parseISO(d), "d MMM");
}

// "2027-01-13" + 1 -> "2027-01-14"
export function plusDays(d: IsoDate, days: number): IsoDate {
  return format(addDays(parseISO(d), days), "yyyy-MM-dd");
}

// Nights between two dates. checkOut is exclusive, so 20 -> 23 Dec is 3.
export function nightsBetween(checkIn: IsoDate, checkOut: IsoDate): number {
  return differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn));
}

// Today's date in Windhoek as "YYYY-MM-DD".
export function todayInWindhoek(): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Windhoek" }).format(new Date());
}

// A UTC timestamp shown in Windhoek time: "Tue 1 Dec, 12:00"
export function windhoekTime(ts: Timestamp): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Windhoek", weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(ts));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}, ${get("hour")}:${get("minute")}`;
}

// Blocked dates: "Blocked 12–13 Jan (free again 14 Jan)". endDate is exclusive.
export function blockedLabel(startDate: IsoDate, endDate: IsoDate): string {
  const first = parseISO(startDate);
  const last = parseISO(plusDays(endDate, -1));
  let range: string;
  if (startDate === plusDays(endDate, -1)) range = format(first, "d MMM");
  else if (format(first, "MMM yyyy") === format(last, "MMM yyyy")) range = `${format(first, "d")}–${format(last, "d MMM")}`;
  else range = `${format(first, "d MMM")}–${format(last, "d MMM")}`;
  return `Blocked ${range} (free again ${shortDate(endDate)})`;
}
