import { vi } from "vitest";
import { createMockApp, WorkspaceLeaf, type App, type FakeElement, type MockFileSpec } from "../mocks/obsidian";
import { CadenceAppView } from "../../src/views/app-view";
import type { AppViewPlugin } from "../../src/views/host";
import { completeReminder, snoozeReminder, updateReminder } from "../../src/plugin/reminders-engine";

/* Builds a CadenceAppView against the mock App, with a plugin stub carrying
   just the settings the shell reads. Shared by the test/views/ files. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export interface PluginStub {
  app: App;
  manifest: { id: string };
  settings: Record<string, Any>;
  saves: number;
  saveSettings(): Promise<void>;
}

export function makeAppView(opts: { settings?: Record<string, unknown>; files?: MockFileSpec[] } = {}) {
  const app = createMockApp(opts.files ?? []);
  const plugin: PluginStub = {
    app,
    manifest: { id: "cadence-planner" },
    settings: {
      dailyNoteFolder: "daily",
      dailyNoteFormat: "YYYY-MM-DD",
      weekStartsOn: 1,
      defaultTab: "home",
      collapsedGroups: {},
      cadenceAppDark: false,
      modules: { crm: true, prm: false, planner: true, projects: true },
      reminders: [],
      customPages: [],
      ...opts.settings,
    },
    saves: 0,
    async saveSettings() {
      this.saves++;
    },
  };
  const leaf = new WorkspaceLeaf(app);
  const view: Any = new CadenceAppView(leaf, plugin as unknown as AppViewPlugin);
  const root = view.containerEl.children[1] as FakeElement;
  return { app, plugin, leaf, view, root };
}

/* Give the stub the real reminders engine, so a test sees what an action
   does to settings.reminders (a repeating series' hand-on included). */
export function useRealReminderEngine(stub: PluginStub): void {
  const plugin = stub as Any;
  plugin.refreshOpenViews = () => {};
  plugin.updateReminder = (id: string, patch: Record<string, unknown>) => updateReminder(plugin, id, patch);
  plugin.snoozeReminder = (id: string, ms: number) => snoozeReminder(plugin, id, ms);
  plugin.completeReminder = (id: string) => completeReminder(plugin, id);
}

/* Every surface render() routes to that belongs to a later view ticket.
   The shell's own surfaces (renderComingSoon, openSettingsTab) stay real. */
export const ROUTED_SURFACES = [
  "renderHome", "renderInbox", "renderTodayPane", "renderPlannerPane", "renderProjectsDashboard",
  "renderEntityList", "renderDashboard", "renderPRMAnalytics", "renderReportPipeline", "renderReportSales",
  "renderReportPartners", "renderReportActivity", "renderReportGraph", "renderProductivity", "renderTeam",
  "renderTemplatesDashboard", "renderEntityDetail", "renderTemplateDetail",
] as const;

/* Replace the routed surfaces on this instance with spies, so render()'s
   shell and routing can be checked without the surfaces' own I/O. */
export function stubSurfaces(view: Any): Record<(typeof ROUTED_SURFACES)[number], ReturnType<typeof vi.fn>> {
  const spies: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ROUTED_SURFACES) {
    spies[name] = vi.fn(async () => {});
    view[name] = spies[name];
  }
  return spies as Record<(typeof ROUTED_SURFACES)[number], ReturnType<typeof vi.fn>>;
}

/* Which routed surfaces were called, with their non-root arguments. */
export function surfaceCalls(spies: Record<string, ReturnType<typeof vi.fn>>): Array<[string, ...unknown[]]> {
  return Object.entries(spies).flatMap(([name, spy]) =>
    spy.mock.calls.map((args) => [name, ...args.slice(1)] as [string, ...unknown[]]),
  );
}

/* Let a chain of awaited promises run to completion. */
export async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
