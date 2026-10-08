import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  dailyNotePath,
  dateInfo,
  greeting,
  pad,
  sameDay,
  startOfDay,
  startOfWeek,
  weekDates,
  ymd,
} from "../../src/utils/dates";

/* Characterization tests: they pin what the helpers do today (TZ=UTC,
   en-US), quirks included. */

afterEach(() => {
  vi.useRealTimers();
});

describe("pad", () => {
  it("left-pads single digits to two characters", () => {
    expect(pad(5)).toBe("05");
    expect(pad(0)).toBe("00");
  });
  it("leaves two or more digits untouched", () => {
    expect(pad(12)).toBe("12");
    expect(pad(123)).toBe("123");
  });
  it("stringifies non-numbers before padding", () => {
    expect(pad("7")).toBe("07");
    expect(pad(-1)).toBe("-1");
  });
});

describe("ymd", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    expect(ymd(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(ymd(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
  it("defaults to now", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-03-09T08:00:00Z") });
    expect(ymd()).toBe("2026-03-09");
  });
});

describe("dailyNotePath", () => {
  const date = new Date(2026, 4, 15);
  it("joins the folder and date", () => {
    expect(dailyNotePath({ dailyNoteFolder: "daily" }, date)).toBe("daily/2026-05-15.md");
  });
  it("strips exactly one trailing slash from the folder", () => {
    expect(dailyNotePath({ dailyNoteFolder: "daily/" }, date)).toBe("daily/2026-05-15.md");
    expect(dailyNotePath({ dailyNoteFolder: "daily//" }, date)).toBe("daily//2026-05-15.md");
  });
  it("puts the note at the vault root when the folder is empty or missing", () => {
    expect(dailyNotePath({ dailyNoteFolder: "" }, date)).toBe("2026-05-15.md");
    expect(dailyNotePath({}, date)).toBe("2026-05-15.md");
  });
  it("ignores dailyNoteFormat", () => {
    const settings = { dailyNoteFolder: "d", dailyNoteFormat: "DD-MM-YYYY" };
    expect(dailyNotePath(settings, date)).toBe("d/2026-05-15.md");
  });
  it("defaults to today", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-02-01T12:00:00Z") });
    expect(dailyNotePath({ dailyNoteFolder: "j" })).toBe("j/2026-02-01.md");
  });
});

describe("greeting", () => {
  const at = (iso: string) => vi.useFakeTimers({ toFake: ["Date"], now: new Date(iso) });
  it("says good morning before noon", () => {
    at("2026-01-01T00:00:00Z");
    expect(greeting()).toBe("Good morning");
    at("2026-01-01T11:59:59Z");
    expect(greeting()).toBe("Good morning");
  });
  it("says good afternoon from 12:00 to 17:59", () => {
    at("2026-01-01T12:00:00Z");
    expect(greeting()).toBe("Good afternoon");
    at("2026-01-01T17:59:00Z");
    expect(greeting()).toBe("Good afternoon");
  });
  it("says good evening from 18:00", () => {
    at("2026-01-01T18:00:00Z");
    expect(greeting()).toBe("Good evening");
    at("2026-01-01T23:59:00Z");
    expect(greeting()).toBe("Good evening");
  });
});

describe("dateInfo", () => {
  it("breaks a date into weekday, day, month and year", () => {
    expect(dateInfo(new Date(2026, 6, 4))).toEqual({ weekday: "Saturday", day: 4, month: "July", year: 2026 });
  });
  it("defaults to now", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-08T09:00:00Z") });
    expect(dateInfo()).toEqual({ weekday: "Thursday", day: 8, month: "October", year: 2026 });
  });
});

describe("startOfDay", () => {
  it("returns a new Date at local midnight", () => {
    const input = new Date(2026, 2, 3, 15, 45, 12, 999);
    const out = startOfDay(input);
    expect(out).toEqual(new Date(2026, 2, 3));
    expect(out).not.toBe(input);
    expect(input.getHours()).toBe(15);
  });
  it("accepts anything the Date constructor accepts", () => {
    expect(startOfDay("2026-03-03T22:00:00Z")).toEqual(new Date(2026, 2, 3));
    expect(startOfDay(0)).toEqual(new Date(1970, 0, 1));
  });
});

describe("addDays", () => {
  it("adds and subtracts calendar days without mutating the input", () => {
    const input = new Date(2026, 0, 30, 10);
    expect(addDays(input, 3)).toEqual(new Date(2026, 1, 2, 10));
    expect(addDays(input, -30)).toEqual(new Date(2025, 11, 31, 10));
    expect(input).toEqual(new Date(2026, 0, 30, 10));
  });
  it("handles leap years", () => {
    expect(addDays(new Date(2028, 1, 28), 1)).toEqual(new Date(2028, 1, 29));
  });
});

describe("startOfWeek", () => {
  const thursday = new Date(2026, 9, 8, 14, 30);
  it("defaults to Monday-start weeks and drops the time", () => {
    expect(startOfWeek(thursday)).toEqual(new Date(2026, 9, 5));
  });
  it("supports Sunday and Saturday starts", () => {
    expect(startOfWeek(thursday, 0)).toEqual(new Date(2026, 9, 4));
    expect(startOfWeek(thursday, 6)).toEqual(new Date(2026, 9, 3));
  });
  it("returns the same day when the date is already the start of week", () => {
    expect(startOfWeek(new Date(2026, 9, 5, 9), 1)).toEqual(new Date(2026, 9, 5));
  });
});

describe("weekDates", () => {
  it("returns the seven days of the anchor's week at midnight", () => {
    const days = weekDates(new Date(2026, 9, 8, 14), 1);
    expect(days).toHaveLength(7);
    expect(days.map((d: Date) => ymd(d))).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
  });
  it("crosses month boundaries and respects weekStartsOn", () => {
    expect(weekDates(new Date(2026, 9, 1), 0).map((d: Date) => ymd(d))[0]).toBe("2026-09-27");
  });
});

describe("sameDay", () => {
  it("compares local calendar days, ignoring time", () => {
    expect(sameDay(new Date(2026, 0, 1, 0, 0), new Date(2026, 0, 1, 23, 59))).toBe(true);
    expect(sameDay(new Date(2026, 0, 1), new Date(2026, 0, 2))).toBe(false);
    expect(sameDay(new Date(2026, 0, 1), new Date(2025, 0, 1))).toBe(false);
    expect(sameDay(new Date(2026, 0, 1), new Date(2026, 1, 1))).toBe(false);
  });
});
