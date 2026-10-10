import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  advanceReminder, COMPLETE_PATCH, dueReminders, isDue, newReminder, snoozePatch,
} from "../../src/plugin/reminders-engine";
import type { Reminder } from "../../src/types/reminders";

/* Direct tests for the reminders engine's plain-data seams. The clock is
   passed in; fake timers pin it where a seam reads none. */

const NOW = new Date("2026-03-10T09:00:00.000Z");
const T = NOW.getTime();
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: "rem_a", text: "Call Jane", when: new Date(T - MIN).toISOString(), repeat: "none", notes: "", project: null,
    notified: false, done: false, createdAt: "2026-03-01T00:00:00.000Z", ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("newReminder", () => {
  it("builds an open reminder stamped with the given time", () => {
    expect(newReminder({ text: "x", when: "2026-03-11T08:00:00.000Z", repeat: "daily", notes: "n", project: "P.md" }, new Date(0))).toEqual({
      id: expect.stringMatching(/^rem_[a-z0-9]+$/),
      text: "x", when: "2026-03-11T08:00:00.000Z", repeat: "daily", notes: "n", project: "P.md",
      notified: false, done: false, createdAt: "1970-01-01T00:00:00.000Z",
    });
  });

  it("falls back for empty optional fields", () => {
    expect(newReminder({ text: "x", when: "", repeat: "", notes: "", project: "" }, NOW)).toMatchObject({
      when: null, repeat: "none", notes: "", project: null,
    });
  });

  it("gives each reminder a new id", () => {
    expect(newReminder({ text: "a" }, NOW).id).not.toBe(newReminder({ text: "a" }, NOW).id);
  });
});

describe("isDue and dueReminders", () => {
  it("is due at or before now, not after", () => {
    expect(isDue(reminder({ when: new Date(T).toISOString() }), T)).toBe(true);
    expect(isDue(reminder({ when: new Date(T - DAY).toISOString() }), T)).toBe(true);
    expect(isDue(reminder({ when: new Date(T + 1).toISOString() }), T)).toBe(false);
  });

  it("is never due when done, notified, unscheduled or unparseable", () => {
    expect(isDue(reminder({ done: true }), T)).toBe(false);
    expect(isDue(reminder({ notified: true }), T)).toBe(false);
    expect(isDue(reminder({ when: null }), T)).toBe(false);
    expect(isDue(reminder({ when: "" }), T)).toBe(false);
    expect(isDue(reminder({ when: "soon" }), T)).toBe(false);
  });

  it("returns the due reminders themselves, in order", () => {
    const list = [reminder({ id: "a" }), reminder({ id: "b", when: null }), reminder({ id: "c" })];
    const due = dueReminders(list, T);
    expect(due.map((r) => r.id)).toEqual(["a", "c"]);
    expect(due[0]).toBe(list[0]);
  });
});

describe("advanceReminder", () => {
  it("schedules a daily reminder one day after its own time", () => {
    const next = advanceReminder(reminder({ repeat: "daily" }), new Date(T + 5 * MIN));
    expect(next).toEqual({
      id: expect.stringMatching(/^rem_/), text: "Call Jane", when: new Date(T - MIN + DAY).toISOString(), repeat: "daily",
      notes: "", project: null, notified: false, done: false, createdAt: new Date(T + 5 * MIN).toISOString(),
    });
  });

  it("schedules a weekly reminder seven days on", () => {
    expect(advanceReminder(reminder({ repeat: "weekly" }), NOW)?.when).toBe(new Date(T - MIN + 7 * DAY).toISOString());
  });

  it("returns null for a one-off or unknown repeat", () => {
    expect(advanceReminder(reminder({ repeat: "none" }), NOW)).toBeNull();
    expect(advanceReminder(reminder({ repeat: "monthly" }), NOW)).toBeNull();
  });

  it("keeps notes and project", () => {
    const next = advanceReminder(reminder({ repeat: "daily", notes: "n", project: "P.md" }), NOW);
    expect(next).toMatchObject({ notes: "n", project: "P.md" });
  });

  it("an overdue occurrence skips to the first occurrence after now", () => {
    const next = advanceReminder(reminder({ repeat: "daily", when: new Date(T - 3 * DAY).toISOString() }), NOW)!;
    expect(isDue(next, T)).toBe(false);
    expect(next.when).toBe(new Date(T + DAY).toISOString());
  });

  it("an occurrence landing exactly on now is skipped too, so it never fires twice in a row", () => {
    expect(advanceReminder(reminder({ repeat: "daily", when: new Date(T - DAY).toISOString() }), NOW)?.when)
      .toBe(new Date(T + DAY).toISOString());
  });

  it("returns null for an unscheduled or unparseable reminder", () => {
    expect(advanceReminder(reminder({ repeat: "daily", when: null }), NOW)).toBeNull();
    expect(advanceReminder(reminder({ repeat: "daily", when: "soon" }), NOW)).toBeNull();
  });
});

describe("snoozePatch and COMPLETE_PATCH", () => {
  it("snoozes to now + ms and clears notified only", () => {
    expect(snoozePatch(10 * MIN, T)).toEqual({ when: new Date(T + 10 * MIN).toISOString(), notified: false });
  });

  it("completes by setting done and notified", () => {
    expect(COMPLETE_PATCH).toEqual({ done: true, notified: true });
  });
});
