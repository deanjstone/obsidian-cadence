import { vi } from "vitest";
import { createMockApp, type App, type MockFileSpec } from "../mocks/obsidian";
import { CadencePlugin } from "../../src/main";

/* Builds a CadencePlugin against the mock App. `data` is what loadData()
   returns. Shared by the test/plugin/ files. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export function makePlugin(opts: { data?: unknown; files?: MockFileSpec[]; app?: App } = {}) {
  const app = opts.app ?? createMockApp(opts.files ?? []);
  const plugin: Any = new CadencePlugin(app, { id: "cadence-planner" }, opts.data ?? null);
  return { app, plugin };
}

/* A plugin whose settings are loaded and whose saveSettings and
   refreshOpenViews calls are logged, in order, in `calls`. `saved` holds a
   deep copy of the settings at each save. */
export async function makeLoadedPlugin(opts: { data?: Record<string, unknown>; files?: MockFileSpec[] } = {}) {
  const made = makePlugin({ data: { reminders: [], ...opts.data }, files: opts.files });
  await made.plugin.loadSettings();
  const calls: string[] = [];
  const saved: Array<Record<string, Any>> = [];
  const save = made.plugin.saveSettings.bind(made.plugin);
  made.plugin.saveSettings = vi.fn(async () => {
    calls.push("save");
    saved.push(structuredClone(made.plugin.settings));
    await save();
  });
  made.plugin.refreshOpenViews = vi.fn(() => {
    calls.push("refresh");
  });
  return { ...made, calls, saved };
}

/* Records `new Notification(title, options)` and lets a test pick the
   permission. Install with vi.stubGlobal("Notification", …). */
export function fakeNotification(permission: string) {
  const shown: Array<{ title: string; options: unknown }> = [];
  class FakeNotification {
    static permission = permission;
    constructor(title: string, options: unknown) {
      shown.push({ title, options });
    }
  }
  return { FakeNotification, shown };
}

/* Let a chain of awaited promises run to completion. */
export async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
