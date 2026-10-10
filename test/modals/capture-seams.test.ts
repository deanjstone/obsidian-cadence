import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCaptureResult, defaultCaptureWhen, quickPickTime } from "../../src/modals/capture";

/* Direct tests for the quick-capture modal's pure seams. TZ is UTC. */

const form = (over: Partial<Parameters<typeof buildCaptureResult>[0]> = {}) => ({
  text: "Call Jane",
  scheduled: true,
  datetimeValue: "2026-10-09T09:30",
  repeat: "weekly",
  ...over,
});

describe("buildCaptureResult", () => {
  it("returns null for a blank or whitespace text", () => {
    expect(buildCaptureResult(form({ text: "" }))).toBeNull();
    expect(buildCaptureResult(form({ text: "  \t" }))).toBeNull();
  });

  it("trims the text and keeps the ISO time and repeat when scheduled", () => {
    expect(buildCaptureResult(form({ text: "  Call Jane " }))).toEqual({
      text: "Call Jane",
      when: "2026-10-09T09:30:00.000Z",
      repeat: "weekly",
    });
  });

  it("defaults a blank repeat to none", () => {
    expect(buildCaptureResult(form({ repeat: "" }))?.repeat).toBe("none");
  });

  it("drops the time and repeat when unscheduled, blank or unparseable", () => {
    const inbox = { text: "Call Jane", when: null, repeat: "none" };
    expect(buildCaptureResult(form({ scheduled: false }))).toEqual(inbox);
    expect(buildCaptureResult(form({ datetimeValue: "" }))).toEqual(inbox);
    expect(buildCaptureResult(form({ datetimeValue: "garbage" }))).toEqual(inbox);
  });
});

describe("defaultCaptureWhen", () => {
  it("rounds now + 1h up to the next quarter hour, rolling the hour", () => {
    expect(defaultCaptureWhen(new Date("2026-10-08T10:07:30Z")).toISOString()).toBe("2026-10-08T11:15:00.000Z");
    expect(defaultCaptureWhen(new Date("2026-10-08T10:50:00Z")).toISOString()).toBe("2026-10-08T12:00:00.000Z");
    expect(defaultCaptureWhen(new Date("2026-10-08T23:46:00Z")).toISOString()).toBe("2026-10-09T01:00:00.000Z");
  });

  it("drops seconds without rounding up on an exact quarter hour (flagged)", () => {
    expect(defaultCaptureWhen(new Date("2026-10-08T10:00:45Z")).toISOString()).toBe("2026-10-08T11:00:00.000Z");
  });
});

describe("quickPickTime", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-10-08T10:07:30.500Z") });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("offsets now by 15m, 1h and 3h with seconds and milliseconds dropped", () => {
    expect(quickPickTime("+15m", new Date()).toISOString()).toBe("2026-10-08T10:22:00.000Z");
    expect(quickPickTime("+1h", new Date()).toISOString()).toBe("2026-10-08T11:07:00.000Z");
    expect(quickPickTime("+3h", new Date()).toISOString()).toBe("2026-10-08T13:07:00.000Z");
  });

  it("picks 9:00 tomorrow, across a month end", () => {
    expect(quickPickTime("Tomorrow 9am", new Date()).toISOString()).toBe("2026-10-09T09:00:00.000Z");
    vi.setSystemTime(new Date("2026-10-31T23:59:00Z"));
    expect(quickPickTime("Tomorrow 9am", new Date()).toISOString()).toBe("2026-11-01T09:00:00.000Z");
  });

  it("does not mutate the date it is given", () => {
    const now = new Date();
    quickPickTime("Tomorrow 9am", now);
    quickPickTime("+1h", now);
    expect(now.toISOString()).toBe("2026-10-08T10:07:30.500Z");
  });
});
