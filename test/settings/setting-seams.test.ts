import { describe, expect, it } from "vitest";
import {
  completedReminderCount,
  defaultTabOptions,
  defaultTabValue,
  ensureModules,
  MODULE_TOGGLES,
  notificationPermissionDesc,
  openReminders,
  shouldRequestPermission,
  taskNotesStatus,
  weekStartsOnFromOption,
} from "../../src/settings/setting-tab";
import type { NavGroup } from "../../src/constants/nav";
import { DEFAULT_SETTINGS } from "../../src/constants/settings";
import type { Reminder } from "../../src/types/reminders";
import type { SettingTabSettings } from "../../src/types/settings";

/* Direct tests for the plain-data seams behind the Modules, Reminders and
   App sections of the settings tab. */

const settings = (extra: Partial<SettingTabSettings> = {}) =>
  ({ dailyNoteFolder: "daily", tasksHeading: "## Today", journalHeading: "## Journal", cadenceApiUrl: "", cadenceApiToken: "", ...extra }) as SettingTabSettings;

const reminder = (id: string, done: boolean) => ({ id, done }) as Reminder;

describe("ensureModules", () => {
  it("returns the stored object itself when complete", () => {
    const modules = { crm: false, prm: false, planner: true, projects: false };
    const s = settings({ modules });
    expect(ensureModules(s)).toBe(modules);
    expect(modules).toEqual({ crm: false, prm: false, planner: true, projects: false });
  });

  it("creates the default modules (PRM off) when missing, as a copy, and backfills projects", () => {
    const s = settings();
    expect(ensureModules(s)).toEqual({ crm: true, prm: false, planner: true, projects: true });
    expect(s.modules).toEqual({ crm: true, prm: false, planner: true, projects: true });
    expect(s.modules).not.toBe(DEFAULT_SETTINGS.modules);
    const old = settings({ modules: { crm: false } });
    expect(ensureModules(old)).toEqual({ crm: false, projects: true });
  });

  it("lists the four module toggles in display order", () => {
    expect(MODULE_TOGGLES.map((m) => [m.key, m.label])).toEqual([["planner", "Planner"], ["projects", "Projects"], ["crm", "CRM"], ["prm", "PRM"]]);
  });
});

describe("notification seams", () => {
  it("asks only when switching on with an undecided permission", () => {
    expect(shouldRequestPermission(true, { permission: "default" })).toBe(true);
    expect(shouldRequestPermission(false, { permission: "default" })).toBe(false);
    expect(shouldRequestPermission(true, { permission: "granted" })).toBe(false);
    expect(shouldRequestPermission(true, { permission: "denied" })).toBe(false);
    expect(shouldRequestPermission(true, undefined)).toBe(false);
  });

  it("describes the permission or the missing API", () => {
    expect(notificationPermissionDesc(undefined)).toBe("Notifications API not available in this environment.");
    expect(notificationPermissionDesc({ permission: "granted" })).toBe("Current status: granted");
  });
});

describe("reminder seams", () => {
  it("counts done reminders and keeps the open ones in order, as a new list", () => {
    const list = [reminder("a", true), reminder("b", false), { id: "c" } as Reminder, reminder("d", true)];
    expect(completedReminderCount(list)).toBe(2);
    const open = openReminders(list);
    expect(open.map((r) => r.id)).toEqual(["b", "c"]);
    expect(open).not.toBe(list);
    expect(completedReminderCount(undefined)).toBe(0);
    expect(openReminders(undefined)).toEqual([]);
  });
});

describe("App seams", () => {
  it("describes TaskNotes as connected or missing", () => {
    expect(taskNotesStatus(true)).toEqual({
      name: "TaskNotes Status",
      desc: "TaskNotes is currently installed, activated and successfully connected to Cadence.",
      text: "🟢 Active and Connected",
      color: "#27ae60",
    });
    expect(taskNotesStatus(false)).toMatchObject({ name: "TaskNotes not detected", text: "🔴 Inactive / Not installed", color: "#c0392b" });
  });

  it("maps the week-start option to 0 only for Sunday", () => {
    expect(["0", "1", "", "6", "x", "00"].map(weekStartsOnFromOption)).toEqual([0, 1, 0, 1, 1, 0]);
  });

  it("labels default-tab options by group, leaving unlabelled groups bare", () => {
    const groups: NavGroup[] = [
      { id: "g0", label: "", items: [{ id: "home", label: "Home", icon: "", desc: "" }] },
      { id: "g1", label: "CRM", items: [{ id: "crm.a", label: "A", icon: "", desc: "" }, { id: "crm.b", label: "B", icon: "", desc: "" }] },
      { id: "g2", label: "Empty", items: [] },
    ];
    expect(defaultTabOptions(groups)).toEqual([
      { value: "home", label: "Home" },
      { value: "crm.a", label: "CRM · A" },
      { value: "crm.b", label: "CRM · B" },
    ]);
  });

  it("falls back to home for an unset default tab", () => {
    expect(defaultTabValue(settings({ defaultTab: "crm.pipeline" }))).toBe("crm.pipeline");
    expect(defaultTabValue(settings({ defaultTab: "" }))).toBe("home");
    expect(defaultTabValue(settings())).toBe("home");
  });
});
