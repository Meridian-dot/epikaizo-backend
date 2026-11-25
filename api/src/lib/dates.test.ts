// Tests for the date helpers. Run with: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, eachNight, isIsoDate, nightsBetween, todayInWindhoek } from "./dates.js";

describe("date helpers", () => {
  it("accepts real dates and rejects impossible ones", () => {
    assert.equal(isIsoDate("2026-12-20"), true);
    assert.equal(isIsoDate("2028-02-29"), true); // leap year
    assert.equal(isIsoDate("2026-02-29"), false);
    assert.equal(isIsoDate("2026-13-01"), false);
    assert.equal(isIsoDate("20-12-2026"), false);
    assert.equal(isIsoDate("2026-12-20T10:00"), false);
  });

  it("adds days across month and year ends", () => {
    assert.equal(addDays("2026-11-30", 1), "2026-12-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2027-01-01", -1), "2026-12-31");
  });

  it("counts nights and lists them, excluding the check-out day", () => {
    assert.equal(nightsBetween("2026-12-20", "2026-12-23"), 3);
    assert.deepEqual(eachNight("2026-12-20", "2026-12-23"), ["2026-12-20", "2026-12-21", "2026-12-22"]);
    assert.deepEqual(eachNight("2026-12-20", "2026-12-20"), []);
  });

  it("uses Windhoek's date, not the server's", () => {
    // 23:30 UTC on 1 Dec is already 01:30 on 2 Dec in Windhoek (UTC+2).
    assert.equal(todayInWindhoek(new Date("2026-12-01T23:30:00Z")), "2026-12-02");
  });
});
