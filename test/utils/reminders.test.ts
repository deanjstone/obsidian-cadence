import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  findProjectTaskReminder,
  nextRepeat,
  reminderBucket,
  reminderId,
  reminderTimeStr,
} from "../../src/legacy/cadence.js";

/* Characterization tests for reminder helpers. Clock pinned to
   Thursday 2026-10-08 10:00 UTC (TZ=UTC in vitest config). */

const NOW = new Date("2026-10-08T10:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("reminderId", () => {
  it("is rem_ + up to 8 random base-36 chars + last 4 base-36 chars of Date.now()", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    vi.setSystemTime(1700000000000);
    expect(reminderId()).toBe("rem_4fzzzxjy3v28");
  });
  it("gets shorter when Math.random has a short base-36 expansion", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.setSystemTime(1700000000000);
    expect(reminderId()).toBe("rem_i3v28");
  });
  it("matches the id shape with real randomness", () => {
    expect(reminderId()).toMatch(/^rem_[0-9a-z]{0,8}[0-9a-z]{4}$/);
  });
});

describe("nextRepeat", () => {
  it("returns null without a time", () => {
    expect(nextRepeat(null, "daily")).toBeNull();
    expect(nextRepeat("", "daily")).toBeNull();
  });
  it("adds 24h for daily and 7×24h for weekly", () => {
    expect(nextRepeat("2026-10-08T09:00:00.000Z", "daily")).toEqual(new Date("2026-10-09T09:00:00.000Z"));
    expect(nextRepeat(new Date("2026-10-08T09:00:00.000Z"), "weekly")).toEqual(new Date("2026-10-15T09:00:00.000Z"));
  });
  it("returns null for any other repeat value", () => {
    expect(nextRepeat("2026-10-08T09:00:00.000Z", "none")).toBeNull();
    expect(nextRepeat("2026-10-08T09:00:00.000Z", "monthly")).toBeNull();
    expect(nextRepeat("2026-10-08T09:00:00.000Z", undefined)).toBeNull();
  });
  it("propagates an invalid date as Invalid Date", () => {
    expect(Number.isNaN(nextRepeat("garbage", "daily").getTime())).toBe(true);
  });
});

describe("reminderBucket", () => {
  it("puts missing times in later", () => {
    expect(reminderBucket(null)).toBe("later");
    expect(reminderBucket("")).toBe("later");
  });
  it("puts anything overdue or within the next hour in now", () => {
    expect(reminderBucket("2026-10-01T00:00:00Z")).toBe("now");
    expect(reminderBucket("2026-10-08T10:30:00Z")).toBe("now");
    expect(reminderBucket("2026-10-08T11:00:00Z")).toBe("now");
  });
  it("puts the rest of today in today", () => {
    expect(reminderBucket("2026-10-08T11:00:01Z")).toBe("today");
    expect(reminderBucket("2026-10-08T23:59:59Z")).toBe("today");
  });
  it("puts tomorrow through the next 6 days in week", () => {
    expect(reminderBucket("2026-10-09T00:00:00Z")).toBe("week");
    expect(reminderBucket("2026-10-14T23:59:59Z")).toBe("week");
  });
  it("puts 7+ days out in later", () => {
    expect(reminderBucket("2026-10-15T00:00:00Z")).toBe("later");
  });
  it("puts invalid dates in later (NaN comparisons are false)", () => {
    expect(reminderBucket("garbage")).toBe("later");
  });
});

describe("reminderTimeStr", () => {
  it("returns empty for missing or invalid times", () => {
    expect(reminderTimeStr(null)).toBe("");
    expect(reminderTimeStr("garbage")).toBe("");
  });
  it("shows only the time for today, past or future", () => {
    expect(reminderTimeStr("2026-10-08T15:30:00Z")).toBe("03:30 PM");
    expect(reminderTimeStr("2026-10-08T01:05:00Z")).toBe("01:05 AM");
  });
  it("prefixes Tomorrow", () => {
    expect(reminderTimeStr("2026-10-09T09:05:00Z")).toBe("Tomorrow 09:05 AM");
  });
  it("uses the short weekday for 2–6 days ahead", () => {
    expect(reminderTimeStr("2026-10-11T09:00:00Z")).toBe("Sun 09:00 AM");
    expect(reminderTimeStr("2026-10-14T09:00:00Z")).toBe("Wed 09:00 AM");
  });
  it("uses month and day for a week or more ahead and for the past", () => {
    expect(reminderTimeStr("2026-10-15T09:00:00Z")).toBe("Oct 15 09:00 AM");
    expect(reminderTimeStr("2026-10-07T09:00:00Z")).toBe("Oct 7 09:00 AM");
  });
});

describe("findProjectTaskReminder", () => {
  const plugin = {
    settings: {
      reminders: [
        { id: "a", project: "P/x.md", text: "Call", done: true },
        { id: "b", project: "P/x.md", text: "Call", done: false },
        { id: "c", project: "P/y.md", text: "Call", done: false },
      ],
    },
  };
  it("finds the first open reminder for the project + task text", () => {
    expect(findProjectTaskReminder(plugin, "P/x.md", "Call")?.id).toBe("b");
  });
  it("returns null when nothing matches or inputs are missing", () => {
    expect(findProjectTaskReminder(plugin, "P/x.md", "Email")).toBeNull();
    expect(findProjectTaskReminder(plugin, "", "Call")).toBeNull();
    expect(findProjectTaskReminder(plugin, "P/x.md", "")).toBeNull();
    expect(findProjectTaskReminder({ settings: {} }, "P/x.md", "Call")).toBeNull();
  });
});
