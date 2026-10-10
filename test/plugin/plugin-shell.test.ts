import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Notice, WorkspaceLeaf } from "../mocks/obsidian";
import { CadenceCaptureModal } from "../../src/modals/capture";
import { CadenceImportModal } from "../../src/modals/import-modal";
import { CadenceAppView } from "../../src/views/app-view";
import { flush, makeLoadedPlugin, makePlugin } from "../helpers/plugin";

/* Characterization tests for CadencePlugin's shell: what onload wires up
   (and in what order), the command and ribbon callbacks, openQuickCapture,
   refreshOpenViews, openApp and onunload. The registration-parity smoke test
   checks what is registered; these check what each registration does. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const NOW = new Date("2026-03-10T09:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  Notice.messages.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/* Runs onload with registerView, addRibbonIcon and window.setInterval
   recorded, so a test can call what was registered. */
async function loadedShell(opts: { data?: Record<string, unknown> } = {}) {
  const made = makePlugin({ data: { reminders: [], ...opts.data } });
  const { plugin } = made;
  const views: Record<string, (leaf: unknown) => unknown> = {};
  const ribbons: Record<string, () => unknown> = {};
  const intervals: Array<{ callback: () => unknown; ms: number }> = [];
  const registerView = plugin.registerView.bind(plugin);
  plugin.registerView = (type: string, factory: (leaf: unknown) => unknown) => {
    views[type] = factory;
    registerView(type, factory);
  };
  const addRibbonIcon = plugin.addRibbonIcon.bind(plugin);
  plugin.addRibbonIcon = (icon: string, title: string, callback: () => unknown) => {
    ribbons[icon] = callback;
    return addRibbonIcon(icon, title, callback);
  };
  vi.spyOn(window, "setInterval").mockImplementation(((callback: () => unknown, ms: number) => {
    intervals.push({ callback, ms });
    return 7;
  }) as Any);
  await plugin.onload();
  const command = (id: string) => plugin.registered.commands.find((c: Any) => c.id === id);
  return { ...made, views, ribbons, intervals, command };
}

/* A workspace holding the given Cadence leaves, logging each call. */
function fakeWorkspace(app: Any, leaves: Any[]) {
  const calls: unknown[][] = [];
  app.workspace.getLeavesOfType = (type: string) => {
    calls.push(["getLeavesOfType", type]);
    return leaves;
  };
  app.workspace.getLeaf = (kind: string) => {
    calls.push(["getLeaf", kind]);
    const leaf: Any = {
      view: null,
      async setViewState(state: unknown) {
        calls.push(["setViewState", state]);
      },
    };
    leaves.push(leaf);
    return leaf;
  };
  app.workspace.revealLeaf = (leaf: unknown) => {
    calls.push(["revealLeaf", leaves.indexOf(leaf)]);
  };
  app.workspace.detachLeavesOfType = (type: string) => {
    calls.push(["detachLeavesOfType", type]);
  };
  return calls;
}

/* A leaf whose view records setMode calls. */
function modeLeaf(mode?: string) {
  const setModes: unknown[] = [];
  const view: Any = {
    mode,
    async setMode(m: string) {
      setModes.push(m);
    },
  };
  return { leaf: { view }, view, setModes };
}

function captureModals() {
  const opened: Any[] = [];
  vi.spyOn(CadenceCaptureModal.prototype, "open").mockImplementation(function (this: Any) {
    opened.push(this);
  });
  return opened;
}

describe("onload", () => {
  it("loads the settings before registering anything", async () => {
    const { plugin } = makePlugin({ data: { reminders: [], defaultTab: "crm.pipeline" } });
    let settingsAtRegister: Any;
    plugin.registerView = () => {
      settingsAtRegister = plugin.settings;
    };
    await plugin.onload();
    expect(settingsAtRegister.defaultTab).toBe("crm.pipeline");
  });

  it("queues the layout-ready callbacks in order: property types and templates, then the reminder tick", async () => {
    const { app, plugin } = await loadedShell({ data: { openOnStartup: false } });
    expect(app.workspace.layoutReadyCallbacks).toHaveLength(2);
    const order: string[] = [];
    plugin.registerCustomPropertyTypes = () => order.push("types");
    plugin.tickReminders = () => order.push("tick");
    await app.workspace.layoutReadyCallbacks[0]();
    await app.workspace.layoutReadyCallbacks[1]();
    expect(order).toEqual(["types", "tick"]);
    expect(app.vault.created).toContain("Cadence/Templates/daily.md");
  });

  it("adds a third layout-ready callback that opens Home when openOnStartup is on (the default)", async () => {
    const { app, plugin } = await loadedShell();
    expect(app.workspace.layoutReadyCallbacks).toHaveLength(3);
    const openApp = vi.fn();
    plugin.openApp = openApp;
    app.workspace.layoutReadyCallbacks[2]();
    expect(openApp).toHaveBeenCalledWith("home");
  });

  it("ticks the reminders every 30 seconds through plugin.tickReminders", async () => {
    const { plugin, intervals } = await loadedShell();
    expect(intervals.map((i) => i.ms)).toEqual([30000]);
    expect(plugin.registered.intervals).toBe(1);
    const tick = vi.fn();
    plugin.tickReminders = tick;
    intervals[0].callback();
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("registers a view factory that builds a CadenceAppView for the plugin", async () => {
    const { app, plugin, views } = await loadedShell();
    const view: Any = views["cadence-app"](new WorkspaceLeaf(app));
    expect(view).toBeInstanceOf(CadenceAppView);
    expect(view.plugin).toBe(plugin);
    expect(view.getViewType()).toBe("cadence-app");
  });

  it("wires the two ribbon icons to openApp() and openQuickCapture()", async () => {
    const { plugin, ribbons } = await loadedShell();
    plugin.openApp = vi.fn();
    plugin.openQuickCapture = vi.fn();
    ribbons["sparkles"]();
    expect(plugin.openApp).toHaveBeenCalledWith();
    ribbons["plus-circle"]();
    expect(plugin.openQuickCapture).toHaveBeenCalledWith();
  });

  it.each([
    ["open-cadence", undefined],
    ["open-cadence-home", "home"],
    ["open-cadence-today", "planner.today"],
    ["open-cadence-calendar", "planner.calendar"],
    ["open-cadence-pipeline", "crm.pipeline"],
    ["open-cadence-inbox", "planner.inbox"],
  ])("command %s opens the app at %s", async (id, mode) => {
    const { plugin, command } = await loadedShell();
    plugin.openApp = vi.fn();
    command(id).callback();
    expect(plugin.openApp.mock.calls[0]).toEqual(mode === undefined ? [] : [mode]);
  });

  it("quick-capture opens the capture modal with no prefill", async () => {
    const { plugin, command } = await loadedShell();
    plugin.openQuickCapture = vi.fn();
    command("quick-capture").callback();
    expect(plugin.openQuickCapture).toHaveBeenCalledWith();
  });

  it("new-daily-entry creates today's note and opens it in the current leaf", async () => {
    const { app, command } = await loadedShell();
    await command("new-daily-entry").callback();
    expect(app.vault.created).toContain("daily/2026-03-10.md");
    expect(app.workspace.openedLinks).toEqual([["daily/2026-03-10.md", "", false]]);
  });

  it("new-daily-entry opens an existing note without recreating it", async () => {
    const { app, command } = await loadedShell();
    app.vault.addFile({ path: "daily/2026-03-10.md", body: "# x" });
    await command("new-daily-entry").callback();
    expect(app.vault.created).not.toContain("daily/2026-03-10.md");
    expect(app.workspace.openedLinks).toEqual([["daily/2026-03-10.md", "", false]]);
  });

  it("registers a metadata 'changed' handler that syncs the changed file, and a vault 'delete' handler", async () => {
    const { app, plugin } = await loadedShell();
    expect(plugin._syncInProgress).toBe(false);
    expect(plugin.registered.events).toEqual(["changed", "delete"]);
    plugin.syncContactProjectRelationships = vi.fn(async () => {});
    plugin.handleProjectDeletion = vi.fn(async () => {});
    const file = { path: "x.md" };
    await app.metadataCache.trigger("changed", file);
    await app.vault.trigger("delete", file);
    expect(plugin.syncContactProjectRelationships).toHaveBeenCalledWith(file);
    expect(plugin.handleProjectDeletion).toHaveBeenCalledWith(file);
  });
});

describe("cadence-import-csv", () => {
  function importModals() {
    const opened: Any[] = [];
    vi.spyOn(CadenceImportModal.prototype, "open").mockImplementation(function (this: Any) {
      opened.push(this);
    });
    return opened;
  }

  it.each([
    ["crm.contacts", "contact"],
    ["crm.companies", "company"],
    ["crm.activities", "activity"],
    ["crm.pipeline", "deal"],
    ["prm.partners", "partner"],
    ["prm.registrations", "registration"],
    ["prm.commissions", "commission"],
    ["prm.leads", "lead"],
    ["prm.certifications", "certification"],
    ["workflow.sequences", "sequence"],
    ["projects.projects", "project"],
    ["home", "contact"],
    [undefined, "contact"],
  ])("from mode %s imports into %s", async (mode, entityKey) => {
    const { app, command } = await loadedShell();
    fakeWorkspace(app, [{ view: { mode } }]);
    const opened = importModals();
    command("cadence-import-csv").callback();
    expect(opened).toHaveLength(1);
    expect(opened[0].entityKey).toBe(entityKey);
  });

  it("imports into contact when no Cadence leaf is open, or the leaf has no view", async () => {
    const { app, command } = await loadedShell();
    const opened = importModals();
    fakeWorkspace(app, []);
    command("cadence-import-csv").callback();
    fakeWorkspace(app, [{ view: null }]);
    command("cadence-import-csv").callback();
    expect(opened.map((m) => m.entityKey)).toEqual(["contact", "contact"]);
  });
});

describe("openQuickCapture", () => {
  it("opens the capture modal with empty defaults when there is no prefill", async () => {
    const { plugin } = await makeLoadedPlugin();
    const opened = captureModals();
    plugin.openQuickCapture();
    expect(opened).toHaveLength(1);
    expect(opened[0].defaultText).toBe("");
    expect(opened[0].defaultWhen).toBe(null);
    expect(opened[0].defaultRepeat).toBe("none");
  });

  it("passes the prefill's text, when and repeat through", async () => {
    const { plugin } = await makeLoadedPlugin();
    const opened = captureModals();
    plugin.openQuickCapture({ text: "Call Jane", when: "2026-03-11T09:00:00.000Z", repeat: "weekly" });
    expect(opened[0].defaultText).toBe("Call Jane");
    expect(opened[0].defaultWhen).toBe("2026-03-11T09:00:00.000Z");
    expect(opened[0].defaultRepeat).toBe("weekly");
  });

  it("does nothing when the modal closes without a result", async () => {
    const { app, plugin } = await makeLoadedPlugin();
    const opened = captureModals();
    plugin.openQuickCapture();
    await opened[0].onSubmit(null);
    expect(plugin.settings.reminders).toEqual([]);
    expect(app.vault.created).toEqual([]);
    expect(Notice.messages).toEqual([]);
  });

  it("an unscheduled capture saves a reminder, appends a task to today's note and notices", async () => {
    const { app, plugin } = await makeLoadedPlugin();
    const opened = captureModals();
    plugin.openQuickCapture();
    await opened[0].onSubmit({ text: "Buy milk", when: null, repeat: undefined });
    expect(plugin.settings.reminders).toHaveLength(1);
    expect(plugin.settings.reminders[0]).toMatchObject({ text: "Buy milk", when: null, repeat: "none" });
    const note = await app.vault.read(app.vault.getAbstractFileByPath("daily/2026-03-10.md") as Any);
    expect(note).toContain("- [ ] Buy milk");
    expect(Notice.messages).toEqual(["Captured to Inbox · added to today's note"]);
  });

  it("adds the reminder before writing the daily note", async () => {
    const { app, plugin } = await makeLoadedPlugin();
    const opened = captureModals();
    const order: string[] = [];
    const addReminder = plugin.addReminder.bind(plugin);
    plugin.addReminder = async (partial: unknown) => {
      order.push("reminder");
      return addReminder(partial);
    };
    const modify = app.vault.modify.bind(app.vault);
    app.vault.modify = async (...args: Any[]) => {
      order.push("note");
      return (modify as Any)(...args);
    };
    plugin.openQuickCapture();
    await opened[0].onSubmit({ text: "Buy milk", when: null });
    expect(order).toEqual(["reminder", "note"]);
  });

  it("a capture scheduled for today notices the reminder time and today's note", async () => {
    const { app, plugin } = await makeLoadedPlugin();
    const opened = captureModals();
    plugin.openQuickCapture();
    await opened[0].onSubmit({ text: "Standup", when: "2026-03-10T15:00:00.000Z", repeat: "daily" });
    expect(plugin.settings.reminders[0]).toMatchObject({ when: "2026-03-10T15:00:00.000Z", repeat: "daily" });
    expect(app.vault.created).toContain("daily/2026-03-10.md");
    expect(Notice.messages).toEqual(["Reminder set · 03:00 PM · added to today's note"]);
  });

  it("a capture scheduled for another day writes that day's note and names it", async () => {
    const { app, plugin } = await makeLoadedPlugin();
    const opened = captureModals();
    plugin.openQuickCapture();
    await opened[0].onSubmit({ text: "Dentist", when: "2026-03-12T10:00:00.000Z" });
    const note = await app.vault.read(app.vault.getAbstractFileByPath("daily/2026-03-12.md") as Any);
    expect(note).toContain("- [ ] Dentist");
    expect(Notice.messages).toEqual(["Reminder set · Thu 10:00 AM · added to 2026-03-12 note"]);
  });

  it("QUIRK: an invalid when falls back to today's note but still notices as a reminder", async () => {
    const { app, plugin } = await makeLoadedPlugin();
    const opened = captureModals();
    plugin.openQuickCapture();
    await opened[0].onSubmit({ text: "Odd", when: "not a date" });
    expect(app.vault.created).toContain("daily/2026-03-10.md");
    expect(Notice.messages).toEqual(["Reminder set ·  · added to today's note"]);
  });

  it("appends after the existing tasks in the tasks section", async () => {
    const { app, plugin } = await makeLoadedPlugin({
      files: [{ path: "daily/2026-03-10.md", body: "# 2026-03-10\n\n## Today\n- [x] Done\n- [ ] Open\n\n## Journal\nhi\n" }],
    });
    const opened = captureModals();
    plugin.openQuickCapture();
    await opened[0].onSubmit({ text: "New", when: null });
    const note = await app.vault.read(app.vault.getAbstractFileByPath("daily/2026-03-10.md") as Any);
    expect(note).toBe("# 2026-03-10\n\n## Today\n- [x] Done\n- [ ] Open\n- [ ] New\n\n## Journal\nhi\n");
  });

  it("still saves the reminder and notices without the note suffix when the daily note fails", async () => {
    const { app, plugin } = await makeLoadedPlugin();
    const opened = captureModals();
    app.vault.create = async () => {
      throw new Error("disk full");
    };
    plugin.openQuickCapture();
    await opened[0].onSubmit({ text: "Buy milk", when: null });
    expect(plugin.settings.reminders).toHaveLength(1);
    expect(Notice.messages).toEqual(["Captured to Inbox"]);
  });
});

describe("refreshOpenViews", () => {
  it("re-renders every Cadence leaf whose view can render, and skips the rest", async () => {
    const { app, plugin } = makePlugin();
    const render = vi.fn();
    const calls = fakeWorkspace(app, [{ view: { render } }, { view: null }, { view: { render: "no" } }, { view: { render } }]);
    plugin.refreshOpenViews();
    expect(calls).toEqual([["getLeavesOfType", "cadence-app"]]);
    expect(render).toHaveBeenCalledTimes(2);
  });
});

describe("openApp", () => {
  it("reuses the first Cadence leaf, reveals it and sets the given mode", async () => {
    const { app, plugin } = makePlugin();
    const first = modeLeaf("crm.pipeline");
    const second = modeLeaf();
    const calls = fakeWorkspace(app, [first.leaf, second.leaf]);
    await plugin.openApp("planner.inbox");
    expect(calls).toEqual([["getLeavesOfType", "cadence-app"], ["revealLeaf", 0]]);
    expect(first.setModes).toEqual(["planner.inbox"]);
    expect(second.setModes).toEqual([]);
  });

  it("keeps the view's current mode when none is given, else Home", async () => {
    const { app, plugin } = makePlugin();
    const withMode = modeLeaf("crm.pipeline");
    fakeWorkspace(app, [withMode.leaf]);
    await plugin.openApp();
    expect(withMode.setModes).toEqual(["crm.pipeline"]);
    const without = modeLeaf();
    fakeWorkspace(app, [without.leaf]);
    await plugin.openApp(null);
    expect(without.setModes).toEqual(["home"]);
  });

  it("opens a new tab leaf with the Cadence view state when none is open", async () => {
    const { app, plugin } = makePlugin();
    const calls = fakeWorkspace(app, []);
    await plugin.openApp("home");
    expect(calls).toEqual([
      ["getLeavesOfType", "cadence-app"],
      ["getLeaf", "tab"],
      ["setViewState", { type: "cadence-app", active: true }],
      ["revealLeaf", 0],
    ]);
  });

  it("resets the planner anchor to today when opening the calendar", async () => {
    const { app, plugin } = makePlugin();
    const target = modeLeaf("home");
    target.view.plannerAnchor = new Date("2025-01-01T00:00:00.000Z");
    fakeWorkspace(app, [target.leaf]);
    await plugin.openApp("planner.calendar");
    expect(target.view.plannerAnchor.toISOString()).toBe("2026-03-10T00:00:00.000Z");
    expect(target.setModes).toEqual(["planner.calendar"]);
  });

  it("leaves the anchor alone for any other mode, and skips setMode on a view without it", async () => {
    const { app, plugin } = makePlugin();
    const anchor = new Date("2025-01-01T00:00:00.000Z");
    const target = modeLeaf("home");
    target.view.plannerAnchor = anchor;
    fakeWorkspace(app, [target.leaf, { view: { mode: "x" } }]);
    await plugin.openApp("planner.today");
    expect(target.view.plannerAnchor).toBe(anchor);
    const bare: Any = { view: { mode: "x" } };
    fakeWorkspace(app, [bare]);
    await expect(plugin.openApp("planner.calendar")).resolves.toBeUndefined();
    expect(bare.view.plannerAnchor).toBeUndefined();
  });

  it("awaits setMode before resolving", async () => {
    const { app, plugin } = makePlugin();
    const order: string[] = [];
    const view: Any = {
      async setMode() {
        await flush();
        order.push("setMode");
      },
    };
    fakeWorkspace(app, [{ view }]);
    await plugin.openApp("home");
    order.push("resolved");
    expect(order).toEqual(["setMode", "resolved"]);
  });
});

describe("onunload", () => {
  it("detaches every Cadence leaf", () => {
    const { app, plugin } = makePlugin();
    const calls = fakeWorkspace(app, []);
    plugin.onunload();
    expect(calls).toEqual([["detachLeavesOfType", "cadence-app"]]);
  });
});
