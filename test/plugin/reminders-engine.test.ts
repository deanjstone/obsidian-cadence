import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Notice } from "../mocks/obsidian";
import { fakeNotification, flush, makeLoadedPlugin, makePlugin } from "../helpers/plugin";

/* Characterization tests for CadencePlugin's reminders engine: the CRUD
   methods, the 30-second ticker and _fireReminder. The clock is faked, so
   "due" and the repeat dates are exact. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const NOW = new Date("2026-03-10T09:00:00.000Z");
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const iso = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

function reminder(overrides: Record<string, unknown> = {}) {
  return {
    id: "rem_a",
    text: "Call Jane",
    when: iso(-MIN),
    repeat: "none",
    notes: "",
    project: null,
    notified: false,
    done: false,
    createdAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  Notice.messages.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("addReminder", () => {
  it("builds the reminder with defaults, appends it, saves, then refreshes", async () => {
    const { plugin, calls, saved } = await makeLoadedPlugin();
    const r = await plugin.addReminder({ text: "Call Jane" });
    expect(r).toEqual({
      id: expect.stringMatching(/^rem_[a-z0-9]+$/),
      text: "Call Jane",
      when: null,
      repeat: "none",
      notes: "",
      project: null,
      notified: false,
      done: false,
      createdAt: NOW.toISOString(),
    });
    expect(plugin.settings.reminders).toEqual([r]);
    expect(plugin.settings.reminders[0]).toBe(r);
    expect(calls).toEqual(["save", "refresh"]);
    expect(saved[0].reminders).toEqual([r]);
  });

  it("keeps when, repeat, notes and project, and drops any other field", async () => {
    const { plugin } = await makeLoadedPlugin();
    const r = await plugin.addReminder({
      text: "Ship it",
      when: iso(DAY),
      repeat: "weekly",
      notes: "bring slides",
      project: "Cadence/Projects/Apollo.md",
      notified: true,
      done: true,
      extra: 1,
    });
    expect(r).toMatchObject({
      text: "Ship it",
      when: iso(DAY),
      repeat: "weekly",
      notes: "bring slides",
      project: "Cadence/Projects/Apollo.md",
      notified: false,
      done: false,
    });
    expect(r).not.toHaveProperty("extra");
  });

  it("treats an empty when, repeat and project as unset", async () => {
    const { plugin } = await makeLoadedPlugin();
    const r = await plugin.addReminder({ text: "x", when: "", repeat: "", project: "" });
    expect(r).toMatchObject({ when: null, repeat: "none", project: null });
  });

  it("starts a new list when settings.reminders is not an array", async () => {
    const { plugin } = await makeLoadedPlugin({ data: { reminders: "broken" } });
    await plugin.addReminder({ text: "x" });
    expect(plugin.settings.reminders).toHaveLength(1);
  });

  it("appends after the existing reminders", async () => {
    const { plugin } = await makeLoadedPlugin({ data: { reminders: [reminder()] } });
    await plugin.addReminder({ text: "second" });
    expect(plugin.settings.reminders.map((r: Any) => r.text)).toEqual(["Call Jane", "second"]);
  });
});

describe("updateReminder", () => {
  it("replaces the reminder with a merged copy, saves, refreshes and returns it", async () => {
    const original = reminder();
    const { plugin, calls } = await makeLoadedPlugin({ data: { reminders: [original] } });
    const stored = plugin.settings.reminders[0];
    const updated = await plugin.updateReminder("rem_a", { text: "Call Sam", notes: "re: renewal" });
    expect(updated).toEqual({ ...original, text: "Call Sam", notes: "re: renewal" });
    expect(updated).not.toBe(stored);
    expect(plugin.settings.reminders[0]).toBe(updated);
    expect(stored.text).toBe("Call Jane");
    expect(calls).toEqual(["save", "refresh"]);
  });

  it("returns null without saving for an unknown id", async () => {
    const { plugin, calls } = await makeLoadedPlugin({ data: { reminders: [reminder()] } });
    expect(await plugin.updateReminder("rem_missing", { text: "x" })).toBeNull();
    expect(calls).toEqual([]);
  });

  it("returns null when there is no reminder list", async () => {
    const { plugin, calls } = await makeLoadedPlugin();
    plugin.settings.reminders = undefined;
    expect(await plugin.updateReminder("rem_a", { text: "x" })).toBeNull();
    expect(calls).toEqual([]);
  });

  it("updates only the first reminder with a duplicated id", async () => {
    const { plugin } = await makeLoadedPlugin({ data: { reminders: [reminder(), reminder({ text: "twin" })] } });
    await plugin.updateReminder("rem_a", { done: true });
    expect(plugin.settings.reminders.map((r: Any) => r.done)).toEqual([true, false]);
  });
});

describe("deleteReminder", () => {
  it("removes every reminder with the id, saves and refreshes", async () => {
    const { plugin, calls } = await makeLoadedPlugin({
      data: { reminders: [reminder(), reminder({ id: "rem_b" }), reminder({ text: "twin" })] },
    });
    expect(await plugin.deleteReminder("rem_a")).toBeUndefined();
    expect(plugin.settings.reminders.map((r: Any) => r.id)).toEqual(["rem_b"]);
    expect(calls).toEqual(["save", "refresh"]);
  });

  it("still saves for an unknown id, and creates the list when it is missing", async () => {
    const { plugin, calls } = await makeLoadedPlugin();
    plugin.settings.reminders = undefined;
    await plugin.deleteReminder("rem_missing");
    expect(plugin.settings.reminders).toEqual([]);
    expect(calls).toEqual(["save", "refresh"]);
  });
});

describe("snoozeReminder and completeReminder", () => {
  it("snoozes to now + ms and clears notified", async () => {
    const { plugin } = await makeLoadedPlugin({ data: { reminders: [reminder({ notified: true })] } });
    const r = await plugin.snoozeReminder("rem_a", 10 * MIN);
    expect(r).toMatchObject({ when: iso(10 * MIN), notified: false, done: false });
  });

  it("QUIRK: snoozing a done reminder leaves it done, so it never fires", async () => {
    const { plugin } = await makeLoadedPlugin({ data: { reminders: [reminder({ done: true })] } });
    await plugin.snoozeReminder("rem_a", MIN);
    expect(plugin.settings.reminders[0]).toMatchObject({ done: true, notified: false });
    vi.setSystemTime(NOW.getTime() + 2 * MIN);
    plugin.tickReminders();
    expect(Notice.messages).toEqual([]);
  });

  it("snoozing an unknown id returns null", async () => {
    const { plugin } = await makeLoadedPlugin();
    expect(await plugin.snoozeReminder("rem_missing", MIN)).toBeNull();
  });

  it("completes by setting done and notified", async () => {
    const { plugin, calls } = await makeLoadedPlugin({ data: { reminders: [reminder()] } });
    const r = await plugin.completeReminder("rem_a");
    expect(r).toMatchObject({ done: true, notified: true });
    expect(calls).toEqual(["save", "refresh"]);
  });

  it("QUIRK: completing a repeating reminder ends the series (no next occurrence)", async () => {
    const { plugin } = await makeLoadedPlugin({ data: { reminders: [reminder({ repeat: "daily", when: iso(MIN) })] } });
    await plugin.completeReminder("rem_a");
    vi.setSystemTime(NOW.getTime() + 2 * DAY);
    plugin.tickReminders();
    expect(plugin.settings.reminders).toHaveLength(1);
    expect(Notice.messages).toEqual([]);
  });

  it("QUIRK: snoozing a repeating reminder moves the rest of the series with it", async () => {
    const { plugin } = await makeLoadedPlugin({ data: { reminders: [reminder({ repeat: "daily" })] } });
    await plugin.snoozeReminder("rem_a", 30 * MIN);
    vi.setSystemTime(NOW.getTime() + 30 * MIN);
    plugin.tickReminders();
    expect(plugin.settings.reminders[1].when).toBe(iso(30 * MIN + DAY));
  });
});

describe("tickReminders", () => {
  it("does nothing when settings.reminders is not an array", async () => {
    const { plugin, calls } = await makeLoadedPlugin();
    plugin.settings.reminders = null;
    expect(() => plugin.tickReminders()).not.toThrow();
    expect(calls).toEqual([]);
  });

  it("fires reminders due now or earlier and marks them notified", async () => {
    const { plugin } = await makeLoadedPlugin({
      data: {
        reminders: [
          reminder({ id: "past", text: "past", when: iso(-DAY) }),
          reminder({ id: "exact", text: "exact", when: iso(0) }),
          reminder({ id: "future", text: "future", when: iso(1000) }),
        ],
      },
    });
    plugin.tickReminders();
    expect(Notice.messages).toEqual(["⏰  past", "⏰  exact"]);
    expect(plugin.settings.reminders.map((r: Any) => [r.id, r.notified])).toEqual([
      ["past", true],
      ["exact", true],
      ["future", false],
    ]);
  });

  it("skips done, already notified, unscheduled and unparseable reminders", async () => {
    const { plugin, calls } = await makeLoadedPlugin({
      data: {
        reminders: [
          reminder({ id: "done", done: true }),
          reminder({ id: "notified", notified: true }),
          reminder({ id: "inbox", when: null }),
          reminder({ id: "bad", when: "not a date" }),
        ],
      },
    });
    plugin.tickReminders();
    await flush();
    expect(Notice.messages).toEqual([]);
    expect(plugin.settings.reminders.map((r: Any) => r.notified)).toEqual([false, true, false, false]);
    expect(calls).toEqual([]);
  });

  it("saves, then refreshes the views, without being awaited", async () => {
    const { plugin, calls } = await makeLoadedPlugin({ data: { reminders: [reminder()] } });
    expect(plugin.tickReminders()).toBeUndefined();
    expect(calls).toEqual(["save"]);
    await flush();
    expect(calls).toEqual(["save", "refresh"]);
  });

  it("adds the next daily occurrence, one day after the reminder's own time", async () => {
    const { plugin } = await makeLoadedPlugin({ data: { reminders: [reminder({ repeat: "daily", when: iso(-3 * MIN) })] } });
    plugin.tickReminders();
    expect(plugin.settings.reminders[1]).toEqual({
      id: expect.stringMatching(/^rem_/),
      text: "Call Jane",
      when: iso(-3 * MIN + DAY),
      repeat: "daily",
      notes: "",
      project: null,
      notified: false,
      done: false,
      createdAt: NOW.toISOString(),
    });
    expect(plugin.settings.reminders[1].id).not.toBe("rem_a");
  });

  it("adds the next weekly occurrence seven days on", async () => {
    const { plugin } = await makeLoadedPlugin({ data: { reminders: [reminder({ repeat: "weekly" })] } });
    plugin.tickReminders();
    expect(plugin.settings.reminders[1].when).toBe(iso(-MIN + 7 * DAY));
  });

  it("adds nothing for a one-off or an unknown repeat", async () => {
    const { plugin } = await makeLoadedPlugin({
      data: { reminders: [reminder({ repeat: "none" }), reminder({ id: "m", repeat: "monthly" })] },
    });
    plugin.tickReminders();
    expect(plugin.settings.reminders).toHaveLength(2);
  });

  it("the next occurrence keeps the reminder's notes and project link", async () => {
    const { plugin } = await makeLoadedPlugin({
      data: { reminders: [reminder({ repeat: "daily", notes: "agenda", project: "Cadence/Projects/Apollo.md" })] },
    });
    plugin.tickReminders();
    expect(plugin.settings.reminders[1]).toMatchObject({ notes: "agenda", project: "Cadence/Projects/Apollo.md" });
  });

  it("QUIRK: a series missed for days catches up one occurrence per tick", async () => {
    const { plugin } = await makeLoadedPlugin({ data: { reminders: [reminder({ repeat: "daily", when: iso(-3 * DAY) })] } });
    plugin.tickReminders();
    expect(Notice.messages).toHaveLength(1);
    plugin.tickReminders();
    plugin.tickReminders();
    plugin.tickReminders();
    expect(Notice.messages).toHaveLength(4);
    expect(plugin.settings.reminders.map((r: Any) => r.when)).toEqual([
      iso(-3 * DAY), iso(-2 * DAY), iso(-DAY), iso(0), iso(DAY),
    ]);
  });

  it("runs every 30 seconds once the plugin has loaded", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ now: NOW });
    const { plugin, app } = makePlugin({ data: { openOnStartup: false, reminders: [reminder({ when: iso(20 * 1000) })] } });
    await plugin.onload();
    expect(app.workspace.layoutReadyCallbacks).toHaveLength(2);
    vi.advanceTimersByTime(29 * 1000);
    expect(Notice.messages).toEqual([]);
    vi.advanceTimersByTime(1000);
    expect(Notice.messages).toEqual(["⏰  Call Jane"]);
  });

  it("ticks once when the layout is ready", async () => {
    const { plugin, app } = makePlugin({ data: { openOnStartup: false, reminders: [reminder()] } });
    await plugin.onload();
    app.workspace.layoutReadyCallbacks[1]();
    expect(Notice.messages).toEqual(["⏰  Call Jane"]);
  });
});

describe("_fireReminder", () => {
  it("shows a Notice and a desktop notification when permission is granted", async () => {
    const { FakeNotification, shown } = fakeNotification("granted");
    vi.stubGlobal("Notification", FakeNotification);
    const { plugin } = await makeLoadedPlugin();
    expect(plugin._fireReminder(reminder())).toBeUndefined();
    expect(Notice.messages).toEqual(["⏰  Call Jane"]);
    expect(shown).toEqual([{ title: "Cadence reminder", options: { body: "Call Jane" } }]);
  });

  it("shows the Notice for 8 seconds", async () => {
    const { plugin } = await makeLoadedPlugin();
    Notice.durations.length = 0;
    plugin._fireReminder(reminder());
    expect(Notice.durations).toEqual([8000]);
  });

  it("skips the desktop notification without permission", async () => {
    const { FakeNotification, shown } = fakeNotification("default");
    vi.stubGlobal("Notification", FakeNotification);
    const { plugin } = await makeLoadedPlugin();
    plugin._fireReminder(reminder());
    expect(shown).toEqual([]);
    expect(Notice.messages).toEqual(["⏰  Call Jane"]);
  });

  it("skips the desktop notification when desktopNotifications is off", async () => {
    const { FakeNotification, shown } = fakeNotification("granted");
    vi.stubGlobal("Notification", FakeNotification);
    const { plugin } = await makeLoadedPlugin({ data: { desktopNotifications: false } });
    plugin._fireReminder(reminder());
    expect(shown).toEqual([]);
  });

  it("works where Notification does not exist", async () => {
    vi.stubGlobal("Notification", undefined);
    const { plugin } = await makeLoadedPlugin();
    expect(() => plugin._fireReminder(reminder())).not.toThrow();
    expect(Notice.messages).toEqual(["⏰  Call Jane"]);
  });

  it("swallows an error from the Notification constructor", async () => {
    class Throwing {
      static permission = "granted";
      constructor() {
        throw new Error("blocked");
      }
    }
    vi.stubGlobal("Notification", Throwing);
    const { plugin } = await makeLoadedPlugin();
    expect(() => plugin._fireReminder(reminder())).not.toThrow();
  });

  it("is what tickReminders calls for each due reminder", async () => {
    const { plugin } = await makeLoadedPlugin({ data: { reminders: [reminder(), reminder({ id: "b", text: "B" })] } });
    const fire = vi.spyOn(plugin, "_fireReminder");
    plugin.tickReminders();
    expect(fire.mock.calls.map(([r]: Any) => r.id)).toEqual(["rem_a", "b"]);
    expect(fire.mock.calls[0][0]).toBe(plugin.settings.reminders[0]);
  });
});
