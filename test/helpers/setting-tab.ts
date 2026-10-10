import { vi } from "vitest";
import { createMockApp, type App, type FakeElement, type MockFileSpec, type Setting } from "../mocks/obsidian";
import { ENTITIES } from "../../src/constants/entities";
import { CadenceSettingTab } from "../../src/legacy/cadence.js";

/* Builds a CadenceSettingTab against the mock App, with a plugin stub that
   records saves, view refreshes and property-type registrations in one
   ordered `calls` log (display() is logged there too). Shared by the
   test/settings/ files. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export function defaultSettings(): Record<string, Any> {
  return {
    dailyNoteFolder: "daily",
    dailyNoteFormat: "YYYY-MM-DD",
    journalHeading: "## Journal",
    tasksHeading: "## Today",
    taskManagementSystem: "native",
    weekStartsOn: 1,
    defaultTab: "home",
    openOnStartup: true,
    collapsedGroups: {},
    currency: "USD",
    modules: { crm: true, prm: false, planner: true, projects: true },
    desktopNotifications: true,
    reminders: [],
    customPages: [],
    pageLayouts: {},
    cadenceApiUrl: "",
    cadenceApiToken: "",
    customEntities: {},
  };
}

export function makeSettingTab(opts: { settings?: Record<string, unknown>; files?: MockFileSpec[]; app?: App } = {}) {
  const app = opts.app ?? createMockApp(opts.files ?? []);
  const calls: string[] = [];
  const plugin = {
    app,
    settings: { ...defaultSettings(), ...opts.settings } as Record<string, Any>,
    /** A deep copy of the settings at each saveSettings() call. */
    saved: [] as Array<Record<string, Any>>,
    async saveSettings() {
      calls.push("save");
      this.saved.push(structuredClone(this.settings));
    },
    refreshOpenViews: vi.fn(() => {
      calls.push("refresh");
    }),
    registerCustomPropertyTypes: vi.fn(() => {
      calls.push("register");
    }),
  };
  const tab: Any = new CadenceSettingTab(app, plugin as Any);
  const display = tab.display.bind(tab);
  tab.display = vi.fn(() => {
    calls.push("display");
    return display();
  });
  const container = tab.containerEl as FakeElement;
  return { app, plugin, tab, container, calls };
}

/* Every Setting row under `root`, in document order. */
export function settingRows(root: FakeElement): Setting[] {
  return root.findAll("div").filter((d) => d.classes.includes("setting-item")).map((d) => (d as Any).setting as Setting);
}

export function settingByName(root: FakeElement, name: string): Setting {
  const row = settingRows(root).find((s) => s.name === name);
  if (!row) throw new Error(`No setting "${name}"`);
  return row;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function component<T = Any>(setting: Setting, index = 0): T {
  return setting.components[index] as T;
}

/* Text of the container's direct h2/h3/p children, in order. */
export function outline(root: FakeElement): string[] {
  return root.children
    .filter((c) => ["h2", "h3", "p"].includes(c.localName))
    .map((c) => `${c.localName}: ${c.text}${c.children.length ? ` [${c.children.map((k) => `${k.localName}: ${k.text}`).join(", ")}]` : ""}`);
}

/* ENTITIES is the live registry and the tab mutates it in place. Take a
   deep copy before a test and put it back after. */
export function snapshotEntities(): Record<string, Any> {
  return structuredClone(ENTITIES) as Record<string, Any>;
}

export function restoreEntities(snapshot: Record<string, Any>) {
  for (const key of Object.keys(ENTITIES)) delete (ENTITIES as Any)[key];
  Object.assign(ENTITIES, structuredClone(snapshot));
}

/* Let a chain of awaited promises run to completion. */
export async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
