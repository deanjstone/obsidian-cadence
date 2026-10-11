import { expect, it } from "vitest";
import { describeInZones } from "../helpers/timezone";
import { addDays, parseYmd, ymd } from "../../src/utils/dates";

/* #46: parseYmd reads a bare YYYY-MM-DD as local midnight, so ymd() writes the
   same date back, in a zone west of UTC, UTC itself and a zone east of UTC. */

describeInZones("parseYmd", () => {
  it("is local midnight of the date", () => {
    expect(parseYmd("2026-10-11")?.getTime()).toBe(new Date(2026, 9, 11).getTime());
    expect(parseYmd("0099-01-02")?.getFullYear()).toBe(99);
  });

  it("round-trips through ymd as the identity, every day of 2026 and 2027 (DST included)", () => {
    const start = new Date(2026, 0, 1);
    for (let i = 0; i < 730; i++) {
      const day = ymd(addDays(start, i));
      expect(ymd(parseYmd(day)!)).toBe(day);
    }
  });

  it("is null for anything but a valid bare date, and rolls an overflowing day over as before", () => {
    expect([parseYmd(""), parseYmd("garbage"), parseYmd("2026-13-01"), parseYmd("2026-10-11T09:00"), parseYmd(20261011), parseYmd(null)])
      .toEqual([null, null, null, null, null, null]);
    expect(ymd(parseYmd("2026-02-31")!)).toBe("2026-03-03");
  });
});
