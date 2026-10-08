import { readFileSync } from "node:fs";
import * as obsidianMock from "../mocks/obsidian";
import { App, Plugin, TFile } from "../mocks/obsidian";

/* Evaluate a CommonJS plugin bundle (the shape Obsidian loads) with
   `require("obsidian")` resolved to the mock. Returns module.exports. */
export function loadBundle(path: string): unknown {
  const source = readFileSync(path, "utf8");
  const module = { exports: {} as unknown };
  const fakeRequire = (id: string) => {
    if (id === "obsidian") return obsidianMock;
    throw new Error(`Unexpected require("${id}") in bundle`);
  };
  new Function("require", "module", "exports", source)(fakeRequire, module, module.exports);
  return module.exports;
}

export interface Registrations {
  exportIsClass: boolean;
  commands: Array<{ id: unknown; name: unknown; hotkeys: unknown; hasCallback: boolean }>;
  views: string[];
  ribbonIcons: Array<{ icon: string; title: string }>;
  settingTabs: string[];
  events: string[];
  intervals: number;
  layoutReadyCallbacks: number;
  propertyTypes: Record<string, string>;
  defaultTemplates: Record<string, string>;
  settings: unknown;
}

/* Instantiate the exported plugin class against a fresh mock App, run onload,
   and record everything it registered with Obsidian. */
export async function collectRegistrations(path: string): Promise<Registrations> {
  const exported = loadBundle(path) as new (app: App, manifest: unknown) => Plugin & {
    onload(): Promise<void>;
    settings: unknown;
  };
  const app = new App();
  const plugin = new exported(app, { id: "cadence-planner" });
  await plugin.onload();
  // First layout-ready callback: property types + default templates. The
  // others (reminder tick, open-on-startup) need a rendered workspace.
  await app.workspace.layoutReadyCallbacks[0]();
  const defaultTemplates: Record<string, string> = {};
  for (const created of app.vault.created) {
    defaultTemplates[created] = await app.vault.read(app.vault.getAbstractFileByPath(created) as TFile);
  }
  return {
    exportIsClass: typeof exported === "function" && Object.getPrototypeOf(exported) === Plugin,
    commands: plugin.registered.commands.map((c) => ({
      id: c.id,
      name: c.name,
      hotkeys: c.hotkeys ?? null,
      hasCallback: typeof c.callback === "function",
    })),
    views: plugin.registered.views,
    ribbonIcons: plugin.registered.ribbonIcons,
    settingTabs: plugin.registered.settingTabs,
    events: plugin.registered.events,
    intervals: plugin.registered.intervals,
    layoutReadyCallbacks: app.workspace.layoutReadyCallbacks.length,
    propertyTypes: app.metadataTypeManager.types,
    defaultTemplates,
    settings: JSON.parse(JSON.stringify(plugin.settings)),
  };
}
