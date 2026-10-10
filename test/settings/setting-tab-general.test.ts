import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Notice, type ButtonComponent, type DropdownComponent, type FakeElement, type TextComponent, type ToggleComponent } from "../mocks/obsidian";
import { component, makeSettingTab, outline, settingByName, settingRows } from "../helpers/setting-tab";

/* Characterization tests for CadenceSettingTab.display(): the page outline
   and the Modules, Reminders, App and Cloud sync sections. Each control is
   driven through the mock Setting components. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

beforeEach(() => {
  Notice.messages.length = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function shown(opts: Parameters<typeof makeSettingTab>[0] = {}) {
  const made = makeSettingTab(opts);
  made.tab.display();
  made.calls.length = 0;
  return made;
}

describe("CadenceSettingTab outline", () => {
  it("keeps the app and plugin it was constructed with", () => {
    const { tab, app, plugin } = makeSettingTab();
    expect(tab.app).toBe(app);
    expect(tab.plugin).toBe(plugin);
  });

  it("draws the page headings and section notes in order", () => {
    const { container } = shown();
    expect(outline(container)).toEqual([
      "h2: Cadence",
      "h3: Modules",
      "p: Toggle entire sections of the app. Disabled modules disappear from the left nav and from Reports that depend on them.",
      "h3: Reminders",
      "h3: App",
      "h3: Cloud sync — coming soon",
      "p: Future option to two-way sync your vault with a live Cadence instance, so contacts, deals and partners stay aligned across desktop and mobile.  These fields are persisted but unused until the sync feature ships in a later release. [strong: Not active yet.]",
      "h3: Custom Navigation Pages",
      "p: Add custom pages to specific sections of your navigation sidebar. You can choose which entity they display and their default layout mode (Table, Kanban, or Card Grid).",
      "h3: Custom Entity Properties",
      "p: Customize the properties for each core entity (Projects, Pipelines/Deals, Contacts, Companies, and Activities). Critical system properties required for the calendar, Kanban, and dashboard features are locked against deletion or type changes, but their display labels can still be customized.",
    ]);
    const notes = container.children.filter((c) => c.localName === "p");
    expect(notes.every((p) => p.classes.includes("setting-item-description"))).toBe(true);
  });

  it("lists every setting row in order (native task system)", () => {
    const { container } = shown();
    expect(settingRows(container).map((s) => s.name)).toEqual([
      "Planner", "Projects", "CRM", "PRM",
      "Desktop notifications", "Notification permission", "Clear completed reminders",
      "Task management system", "Daily note folder", "Tasks heading", "Journal heading", "Currency",
      "Week starts on", "Open Cadence on Obsidian startup", "Default tab",
      "Cadence base URL", "API token",
      "Select entity",
    ]);
  });

  it("empties the container first, so a second display() draws one page", () => {
    const { tab, container } = shown();
    const count = container.children.length;
    tab.display();
    expect(container.children.length).toBe(count);
    expect(container.children[0].text).toBe("Cadence");
  });

  it("puts the custom-pages and property-editor containers after their notes", () => {
    const { container } = shown();
    const divs = container.children.filter((c) => c.localName === "div" && !c.classes.includes("setting-item"));
    expect(divs.map((d) => d.classes)).toEqual([["cad-custom-pages-container"], ["cad-prop-editor-container"]]);
  });
});

describe("Modules", () => {
  it("shows one toggle per module with its description, on unless false", () => {
    const { container } = shown();
    const rows = ["Planner", "Projects", "CRM", "PRM"].map((n) => settingByName(container, n));
    expect(rows.map((r) => r.desc)).toEqual([
      "Inbox, Today, Calendar.",
      "Projects with milestones, tasks, and status tracking.",
      "Dashboard, Pipeline, Contacts, Companies, Activities + CRM-driven Reports.",
      "Partners, Registrations, Commissions, Leads, Certifications, Analytics + Partner reports.",
    ]);
    expect(rows.map((r) => component<ToggleComponent>(r).value)).toEqual([true, true, true, false]);
  });

  it("writes the module flag, saves and refreshes open views", async () => {
    const { container, plugin, calls } = shown();
    await component<ToggleComponent>(settingByName(container, "PRM")).change(true);
    expect(plugin.settings.modules).toEqual({ crm: true, prm: true, planner: true, projects: true });
    await component<ToggleComponent>(settingByName(container, "Planner")).change(false);
    expect(plugin.settings.modules.planner).toBe(false);
    expect(calls).toEqual(["save", "refresh", "save", "refresh"]);
  });

  it("treats a missing flag as on", () => {
    const { container } = shown({ settings: { modules: { crm: true } } });
    expect(component<ToggleComponent>(settingByName(container, "Planner")).value).toBe(true);
    expect(component<ToggleComponent>(settingByName(container, "PRM")).value).toBe(true);
  });

  it("QUIRK: with no modules object, drawing the page creates one with PRM on (the defaults have it off)", () => {
    const { container, plugin } = shown({ settings: { modules: undefined } });
    expect(plugin.settings.modules).toEqual({ crm: true, prm: true, planner: true, projects: true });
    expect(component<ToggleComponent>(settingByName(container, "PRM")).value).toBe(true);
    expect(plugin.saved).toEqual([]);
  });

  it("backfills projects: true when an older modules object lacks it", () => {
    const { plugin } = shown({ settings: { modules: { crm: true, prm: false, planner: true } } });
    expect(plugin.settings.modules).toEqual({ crm: true, prm: false, planner: true, projects: true });
  });
});

describe("Reminders", () => {
  function stubNotification(permission: string, request: () => Promise<string> = async () => "granted") {
    const requestPermission = vi.fn(request);
    vi.stubGlobal("Notification", { permission, requestPermission });
    return requestPermission;
  }

  it("shows the desktop-notification toggle from the setting", () => {
    const { container } = shown({ settings: { desktopNotifications: undefined } });
    const row = settingByName(container, "Desktop notifications");
    expect(row.desc).toBe("In addition to the in-app banner, fire a system notification when a reminder is due. Requires browser permission.");
    expect(component<ToggleComponent>(row).value).toBe(false);
  });

  it("asks for permission when notifications are switched on and permission is undecided", async () => {
    const request = stubNotification("default");
    const { container, plugin, calls } = shown({ settings: { desktopNotifications: false } });
    await component<ToggleComponent>(settingByName(container, "Desktop notifications")).change(true);
    expect(plugin.settings.desktopNotifications).toBe(true);
    expect(calls).toEqual(["save"]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not ask when switching off, when already decided, or with no Notifications API", async () => {
    const request = stubNotification("granted");
    const { container, plugin } = shown();
    const toggle = component<ToggleComponent>(settingByName(container, "Desktop notifications"));
    await toggle.change(false);
    await toggle.change(true);
    expect(request).not.toHaveBeenCalled();
    vi.stubGlobal("Notification", undefined);
    await toggle.change(true);
    expect(plugin.saved).toHaveLength(3);
  });

  it("swallows a rejected permission request", async () => {
    stubNotification("default", async () => {
      throw new Error("blocked");
    });
    const { container, plugin } = shown({ settings: { desktopNotifications: false } });
    await component<ToggleComponent>(settingByName(container, "Desktop notifications")).change(true);
    expect(plugin.settings.desktopNotifications).toBe(true);
  });

  it("describes the permission status, or the missing API", () => {
    vi.stubGlobal("Notification", undefined);
    expect(settingByName(shown().container, "Notification permission").desc).toBe("Notifications API not available in this environment.");
    stubNotification("denied");
    const row = settingByName(shown().container, "Notification permission");
    expect(row.desc).toBe("Current status: denied");
    expect(component<ButtonComponent>(row).buttonEl.text).toBe("Request permission");
  });

  it("requests permission and redraws; does nothing without the API or when the request fails", async () => {
    const request = stubNotification("default");
    const made = shown();
    await component<ButtonComponent>(settingByName(made.container, "Notification permission")).click();
    expect(request).toHaveBeenCalledTimes(1);
    expect(made.calls).toEqual(["display"]);

    stubNotification("default", async () => {
      throw new Error("no");
    });
    const failed = shown();
    await component<ButtonComponent>(settingByName(failed.container, "Notification permission")).click();
    expect(failed.calls).toEqual([]);

    const none = shown();
    vi.stubGlobal("Notification", undefined);
    await component<ButtonComponent>(settingByName(none.container, "Notification permission")).click();
    expect(none.calls).toEqual([]);
  });

  it("counts completed reminders and clears them, keeping open ones in order", async () => {
    const reminders = [
      { id: "a", text: "A", done: true },
      { id: "b", text: "B", done: false },
      { id: "c", text: "C" },
      { id: "d", text: "D", done: true },
    ];
    const { container, plugin, calls } = shown({ settings: { reminders } });
    const row = settingByName(container, "Clear completed reminders");
    expect(row.desc).toBe("2 completed reminders stored.");
    expect(component<ButtonComponent>(row).buttonEl.text).toBe("Clear");
    await component<ButtonComponent>(row).click();
    expect(plugin.settings.reminders.map((r: Any) => r.id)).toEqual(["b", "c"]);
    expect(calls).toEqual(["save", "refresh", "display"]);
    expect(settingByName(container, "Clear completed reminders").desc).toBe("0 completed reminders stored.");
  });

  it("treats missing reminders as none, and clearing writes an empty list", async () => {
    const { container, plugin } = shown({ settings: { reminders: undefined } });
    const row = settingByName(container, "Clear completed reminders");
    expect(row.desc).toBe("0 completed reminders stored.");
    await component<ButtonComponent>(row).click();
    expect(plugin.settings.reminders).toEqual([]);
  });
});

describe("App", () => {
  it("offers the two task systems, defaulting to native", () => {
    const row = settingByName(shown({ settings: { taskManagementSystem: undefined } }).container, "Task management system");
    expect(row.desc).toBe("Choose between the native Cadence manager (using daily notes) or the external TaskNotes plugin.");
    const d = component<DropdownComponent>(row);
    expect(d.optionPairs).toEqual([["native", "Native (Cadence)"], ["tasknotes", "TaskNotes"]]);
    expect(d.getValue()).toBe("native");
  });

  it("switching the task system saves, redraws, then refreshes", async () => {
    const { container, plugin, calls } = shown();
    await component<DropdownComponent>(settingByName(container, "Task management system")).change("tasknotes");
    expect(plugin.settings.taskManagementSystem).toBe("tasknotes");
    expect(calls).toEqual(["save", "display", "refresh"]);
    expect(settingRows(container).map((s) => s.name)).toContain("TaskNotes not detected");
  });

  it("shows TaskNotes as connected when the plugin is enabled", () => {
    const made = makeSettingTab({ settings: { taskManagementSystem: "tasknotes" } });
    made.app.plugins.enabledPlugins.add("tasknotes");
    made.tab.display();
    const names = settingRows(made.container).map((s) => s.name);
    expect(names.slice(7, 10)).toEqual(["Task management system", "TaskNotes Status", "Daily note folder"]);
    const row = settingByName(made.container, "TaskNotes Status");
    expect(row.desc).toBe("TaskNotes is currently installed, activated and successfully connected to Cadence.");
    const span = row.controlEl.children[0];
    expect([span.localName, span.text, span.style.color, span.style.fontWeight]).toEqual(["span", "🟢 Active and Connected", "#27ae60", "bold"]);
    expect(names).not.toContain("Download TaskNotes");
  });

  it("shows TaskNotes as missing, with a download button, when the plugin is not enabled", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    const { container } = shown({ settings: { taskManagementSystem: "tasknotes" } });
    const names = settingRows(container).map((s) => s.name);
    expect(names.slice(7, 11)).toEqual(["Task management system", "TaskNotes not detected", "Download TaskNotes", "Daily note folder"]);
    const row = settingByName(container, "TaskNotes not detected");
    expect(row.desc).toBe("The TaskNotes plugin is not enabled or installed in your Obsidian vault.");
    const span = row.controlEl.children[0];
    expect([span.text, span.style.color, span.style.fontWeight]).toEqual(["🔴 Inactive / Not installed", "#c0392b", "bold"]);
    const download = settingByName(container, "Download TaskNotes");
    expect(download.desc).toBe("Click the button below to open the TaskNotes plugin GitHub page to install it on your Obsidian.");
    const button = component<ButtonComponent>(download);
    expect(button.buttonEl.text).toBe("Download TaskNotes");
    await button.click();
    expect(open).toHaveBeenCalledWith("https://github.com/callumalpass/obsidian-tasknotes", "_blank");
  });

  it("edits the daily-note folder and both headings as text, saving each change", async () => {
    const { container, plugin, calls } = shown({ settings: { dailyNoteFolder: "Journal/Daily", tasksHeading: "## Tasks", journalHeading: "## Log" } });
    const folder = settingByName(container, "Daily note folder");
    expect(folder.desc).toBe('Folder under which daily notes live, e.g. "daily" or "Journal/Daily".');
    expect(component<TextComponent>(folder).inputEl.placeholder).toBe("daily");
    expect(component<TextComponent>(folder).getValue()).toBe("Journal/Daily");
    const tasks = settingByName(container, "Tasks heading");
    expect(tasks.desc).toBe('The H2 inside each daily note where tasks live. Default "## Today".');
    expect(component<TextComponent>(tasks).getValue()).toBe("## Tasks");
    const journal = settingByName(container, "Journal heading");
    expect(journal.desc).toBe("The H2 where today's journal entry lives. Default \"## Journal\".");
    expect(component<TextComponent>(journal).getValue()).toBe("## Log");

    await component<TextComponent>(folder).change("notes/daily");
    await component<TextComponent>(tasks).change("## Todo");
    await component<TextComponent>(journal).change("## Diary");
    expect([plugin.settings.dailyNoteFolder, plugin.settings.tasksHeading, plugin.settings.journalHeading]).toEqual(["notes/daily", "## Todo", "## Diary"]);
    expect(calls).toEqual(["save", "save", "save"]);
  });

  it("lists the eleven currencies, defaulting to USD", () => {
    const row = settingByName(shown({ settings: { currency: undefined } }).container, "Currency");
    expect(row.desc).toBe("Used to format money values across Pipeline, Reports and Commissions.");
    const d = component<DropdownComponent>(row);
    expect(d.optionPairs).toEqual([
      ["USD", "USD — US Dollar"],
      ["EUR", "EUR — Euro"],
      ["GBP", "GBP — British Pound"],
      ["ZAR", "ZAR — South African Rand"],
      ["AUD", "AUD — Australian Dollar"],
      ["CAD", "CAD — Canadian Dollar"],
      ["CHF", "CHF — Swiss Franc"],
      ["JPY", "JPY — Japanese Yen"],
      ["INR", "INR — Indian Rupee"],
      ["BRL", "BRL — Brazilian Real"],
      ["AED", "AED — UAE Dirham"],
    ]);
    expect(d.getValue()).toBe("USD");
  });

  it("changing currency saves and re-renders each open Cadence leaf that can render, without refreshOpenViews", async () => {
    const made = shown({ settings: { currency: "EUR" } });
    const render = vi.fn();
    const leaves = [{ view: { render } }, { view: null }, { view: { render: "no" } }, { view: { render } }];
    const getLeaves = vi.spyOn(made.app.workspace, "getLeavesOfType").mockReturnValue(leaves);
    const d = component<DropdownComponent>(settingByName(made.container, "Currency"));
    expect(d.getValue()).toBe("EUR");
    await d.change("GBP");
    expect(made.plugin.settings.currency).toBe("GBP");
    expect(getLeaves).toHaveBeenCalledWith("cadence-app");
    expect(render).toHaveBeenCalledTimes(2);
    expect(made.calls).toEqual(["save"]);
  });

  it("maps the week-start option to 0 for Sunday and 1 for anything else", async () => {
    const { container, plugin } = shown({ settings: { weekStartsOn: 0 } });
    const row = settingByName(container, "Week starts on");
    expect(row.desc).toBe("First day of the week shown in the Planner tab.");
    const d = component<DropdownComponent>(row);
    expect(d.optionPairs).toEqual([["1", "Monday"], ["0", "Sunday"]]);
    expect(d.getValue()).toBe("0");
    await d.change("1");
    expect(plugin.settings.weekStartsOn).toBe(1);
    await d.change("0");
    expect(plugin.settings.weekStartsOn).toBe(0);
    await d.change("6");
    expect(plugin.settings.weekStartsOn).toBe(1);
    expect(plugin.saved).toHaveLength(3);
  });

  it("toggles opening on startup", async () => {
    const { container, plugin, calls } = shown({ settings: { openOnStartup: false } });
    const row = settingByName(container, "Open Cadence on Obsidian startup");
    expect(row.desc).toBe("Auto-open the Cadence Home command centre when Obsidian launches.");
    expect(component<ToggleComponent>(row).value).toBe(false);
    await component<ToggleComponent>(row).change(true);
    expect(plugin.settings.openOnStartup).toBe(true);
    expect(calls).toEqual(["save"]);
  });

  it("offers every nav surface as the default tab, prefixed by its group label", async () => {
    const { container, plugin } = shown({ settings: { defaultTab: "crm.pipeline" } });
    const row = settingByName(container, "Default tab");
    expect(row.desc).toBe("Which surface opens first when you launch the Cadence app.");
    const d = component<DropdownComponent>(row);
    expect(d.optionPairs).toEqual([
      ["home", "Home"],
      ["planner.inbox", "Planner · Inbox"],
      ["planner.today", "Planner · Today"],
      ["planner.calendar", "Planner · Calendar"],
      ["projects.dashboard", "Projects · Dashboard"],
      ["projects.projects", "Projects · Projects"],
      ["crm.dashboard", "CRM · Dashboard"],
      ["crm.pipeline", "CRM · Pipeline"],
      ["crm.contacts", "CRM · Contacts"],
      ["crm.companies", "CRM · Companies"],
      ["crm.activities", "CRM · Activities"],
      ["prm.partners", "PRM · Partners"],
      ["prm.registrations", "PRM · Registrations"],
      ["prm.commissions", "PRM · Commissions"],
      ["prm.leads", "PRM · Leads"],
      ["prm.certifications", "PRM · Certifications"],
      ["prm.analytics", "PRM · Analytics"],
      ["workflow.sequences", "Workflow · Sequences"],
      ["reports.pipeline", "Reports · Pipeline"],
      ["reports.sales", "Reports · Sales"],
      ["reports.partners", "Reports · Partners"],
      ["reports.activity", "Reports · Activity"],
      ["reports.productivity", "Reports · Productivity"],
      ["reports.graph", "Reports · Graph View"],
      ["team", "Team"],
      ["templates", "Templates"],
      ["settings", "Settings"],
    ]);
    expect(d.getValue()).toBe("crm.pipeline");
    await d.change("reports.sales");
    expect(plugin.settings.defaultTab).toBe("reports.sales");
    expect(plugin.saved).toHaveLength(1);
  });

  it("QUIRK: with no default tab set, the dropdown shows Planner · Today, not the Home default", () => {
    const d = component<DropdownComponent>(settingByName(shown({ settings: { defaultTab: "" } }).container, "Default tab"));
    expect(d.getValue()).toBe("planner.today");
  });
});

describe("Cloud sync (coming soon)", () => {
  it("shows both fields disabled, with their placeholders and stored values", () => {
    const { container } = shown({ settings: { cadenceApiUrl: "https://c.example", cadenceApiToken: "tok" } });
    const url = settingByName(container, "Cadence base URL");
    const token = settingByName(container, "API token");
    expect([url.desc, token.desc]).toEqual(["Coming soon", "Coming soon"]);
    const [u, t] = [component<TextComponent>(url), component<TextComponent>(token)];
    expect([u.inputEl.placeholder, u.getValue(), u.inputEl.disabled]).toEqual(["https://your-cadence-instance", "https://c.example", true]);
    expect([t.inputEl.placeholder, t.getValue(), t.inputEl.disabled]).toEqual(["paste JWT here when sync ships", "tok", true]);
  });

  it("still persists a change if one reaches the handlers", async () => {
    const { container, plugin, calls } = shown();
    await component<TextComponent>(settingByName(container, "Cadence base URL")).change("https://x");
    await component<TextComponent>(settingByName(container, "API token")).change("jwt");
    expect([plugin.settings.cadenceApiUrl, plugin.settings.cadenceApiToken]).toEqual(["https://x", "jwt"]);
    expect(calls).toEqual(["save", "save"]);
  });

  it("marks 'Not active yet.' in bold inside the note", () => {
    const note = shown().container.children.find((c) => c.localName === "p" && c.text.startsWith("Future")) as FakeElement;
    expect(note.children.map((c) => [c.localName, c.text])).toEqual([["strong", "Not active yet."]]);
  });
});
