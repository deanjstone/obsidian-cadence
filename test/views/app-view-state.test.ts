import { describe, expect, it, vi } from "vitest";
import { NAV_GROUPS } from "../../src/constants/nav";
import { flush, makeAppView } from "../helpers/app-view";

/* Characterization tests for CadenceAppView's state and nav methods: the
   constructor, the mode-id migration, surface resolution, the visible nav
   groups, the mobile-nav and dark-mode toggles, setMode/toggleGroup and the
   entity-detail open/close methods. render() is spied on where a method
   calls it; render's own output is in app-view-render.test.ts. */

const pages = [
  { id: "custom.1", label: "Vendors", icon: "truck", sectionId: "crm", entityKey: "vendor" },
  { id: "custom.2", label: "Notes", sectionId: "workflow", entityKey: "note" },
];

describe("CadenceAppView constructor and View contract", () => {
  it("starts on the migrated default tab with empty today, detail and mobile-nav state", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-08T15:30:00Z") });
    const { view, plugin, app, leaf } = makeAppView({ settings: { defaultTab: "today" } });
    vi.useRealTimers();
    expect(view.plugin).toBe(plugin);
    expect(view.app).toBe(app);
    expect(view.leaf).toBe(leaf);
    expect(view.mode).toBe("planner.today");
    expect(view.todayFile).toBeNull();
    expect(view.todayParsed).toBeNull();
    expect(view._journalSaveTimer).toBeNull();
    expect(view.plannerAnchor).toEqual(new Date(2026, 9, 8));
    expect(view.detailFile).toBeNull();
    expect(view.detailEntityKey).toBeNull();
    expect(view.mobileNavOpen).toBe(false);
  });

  it("falls back to planner.today when no default tab is set, and to home for an unknown one", () => {
    expect(makeAppView({ settings: { defaultTab: "" } }).view.mode).toBe("planner.today");
    expect(makeAppView({ settings: { defaultTab: undefined } }).view.mode).toBe("planner.today");
    expect(makeAppView({ settings: { defaultTab: "crm.nope" } }).view.mode).toBe("home");
    expect(makeAppView({ settings: { defaultTab: "custom.1", customPages: pages } }).view.mode).toBe("custom.1");
  });

  it("reports the cadence-app view type, the Cadence title and the sparkles icon", async () => {
    const { view } = makeAppView();
    expect(view.getViewType()).toBe("cadence-app");
    expect(view.getDisplayText()).toBe("Cadence");
    expect(view.getIcon()).toBe("sparkles");
    await expect(view.onClose()).resolves.toBeUndefined();
  });
});

describe("CadenceAppView _migrateModeId", () => {
  it("maps the pre-group ids, keeps known surfaces and custom pages, and sends anything else home", () => {
    const { view } = makeAppView({ settings: { customPages: pages } });
    expect(view._migrateModeId("today")).toBe("planner.today");
    expect(view._migrateModeId("planner")).toBe("planner.calendar");
    expect(view._migrateModeId("crm.pipeline")).toBe("crm.pipeline");
    expect(view._migrateModeId("settings")).toBe("settings");
    expect(view._migrateModeId("custom.2")).toBe("custom.2");
    expect(view._migrateModeId("custom.9")).toBe("home");
    expect(view._migrateModeId("pipeline")).toBe("home");
    expect(view._migrateModeId(undefined)).toBe("home");
  });

  it("keeps a custom page id even when it shadows a surface, and works with no customPages setting", () => {
    const { view, plugin } = makeAppView({ settings: { customPages: [{ id: "today", label: "T", sectionId: "crm" }] } });
    // The pre-group mapping runs first, so a custom page called "today" is unreachable by id.
    expect(view._migrateModeId("today")).toBe("planner.today");
    plugin.settings.customPages = undefined;
    expect(view._migrateModeId("home")).toBe("home");
  });

  it("QUIRK: accepts Object.prototype member names as surface ids", () => {
    const { view } = makeAppView();
    // SURFACE_BY_ID is a plain object, so inherited members count as known ids.
    expect(view._migrateModeId("toString")).toBe("toString");
    expect(view._migrateModeId("constructor")).toBe("constructor");
  });
});

describe("CadenceAppView _resolveSurface", () => {
  it("describes a custom page from its settings, defaulting the icon to file-text", () => {
    const { view } = makeAppView({ settings: { customPages: pages } });
    expect(view._resolveSurface("custom.1")).toEqual({
      id: "custom.1", label: "Vendors", icon: "truck", desc: "Custom page displaying vendor entity.",
    });
    expect(view._resolveSurface("custom.2")).toEqual({
      id: "custom.2", label: "Notes", icon: "file-text", desc: "Custom page displaying note entity.",
    });
  });

  it("returns the nav surface itself for a known id and the Home surface otherwise", () => {
    const { view } = makeAppView();
    const pipeline = view._resolveSurface("crm.pipeline");
    expect(pipeline).toBe(NAV_GROUPS[3].items[1]);
    expect(view._resolveSurface("nope")).toBe(NAV_GROUPS[0].items[0]);
    expect(view._resolveSurface(null).id).toBe("home");
  });
});

describe("CadenceAppView _visibleNavGroups", () => {
  const ids = (groups: Array<{ id: string; items: Array<{ id: string }> }>) =>
    groups.map((g) => [g.id, g.items.map((i) => i.id)]);

  it("hides the PRM group and PRM-only report by default, and keeps unlabeled groups", () => {
    const { view } = makeAppView();
    expect(ids(view._visibleNavGroups())).toEqual([
      ["home_group", ["home"]],
      ["planner", ["planner.inbox", "planner.today", "planner.calendar"]],
      ["projects", ["projects.dashboard", "projects.projects"]],
      ["crm", ["crm.dashboard", "crm.pipeline", "crm.contacts", "crm.companies", "crm.activities"]],
      ["workflow", ["workflow.sequences"]],
      ["reports", ["reports.pipeline", "reports.sales", "reports.activity", "reports.productivity", "reports.graph"]],
      ["misc", ["team", "templates", "settings"]],
    ]);
  });

  it("drops a group left with no items, and shows every module when modules is unset", () => {
    const { view, plugin } = makeAppView({ settings: { modules: { crm: false, prm: false, planner: false, projects: false } } });
    expect(ids(view._visibleNavGroups()).map(([id]) => id)).toEqual(["home_group", "workflow", "reports", "misc"]);
    expect(ids(view._visibleNavGroups())[2]).toEqual(["reports", ["reports.productivity", "reports.graph"]]);
    plugin.settings.modules = undefined;
    expect(ids(view._visibleNavGroups()).map(([id]) => id)).toEqual([
      "home_group", "planner", "projects", "crm", "prm", "workflow", "reports", "misc",
    ]);
  });

  it("appends custom pages to their section, gated by the page module or its section", () => {
    const { view, plugin } = makeAppView({
      settings: {
        customPages: [
          ...pages,
          { id: "custom.3", label: "Lost", sectionId: "nowhere", entityKey: "x" },
          { id: "custom.4", label: "Partner page", sectionId: "workflow", module: "prm", entityKey: "y" },
        ],
      },
    });
    const groups = view._visibleNavGroups();
    expect(groups.find((g: { id: string }) => g.id === "crm").items.at(-1)).toEqual({
      id: "custom.1", label: "Vendors", icon: "truck", module: "crm", desc: "Custom page displaying vendor entity.",
    });
    expect(groups.find((g: { id: string }) => g.id === "workflow").items.map((i: { id: string }) => i.id)).toEqual([
      "workflow.sequences", "custom.2",
    ]);
    // A page whose section is unknown is dropped; one whose module is off is hidden.
    expect(JSON.stringify(groups)).not.toContain("custom.3");
    expect(JSON.stringify(groups)).not.toContain("custom.4");
    plugin.settings.modules.crm = false;
    expect(JSON.stringify(view._visibleNavGroups())).not.toContain("custom.1");
  });

  it("works on a deep copy, so NAV_GROUPS is never mutated", () => {
    const before = JSON.stringify(NAV_GROUPS);
    const { view } = makeAppView({ settings: { customPages: pages } });
    const groups = view._visibleNavGroups();
    groups[0].items.push({ id: "x" });
    expect(JSON.stringify(NAV_GROUPS)).toBe(before);
    expect(groups[0].items[0]).not.toBe(NAV_GROUPS[0].items[0]);
  });
});

describe("CadenceAppView _modeUsesEntityFolder", () => {
  it("is true for any path under Cadence/, whatever the mode", () => {
    const { view } = makeAppView();
    expect(view._modeUsesEntityFolder("Cadence/Contacts/Ann.md")).toBe(true);
    expect(view._modeUsesEntityFolder("Cadence/")).toBe(true);
    expect(view._modeUsesEntityFolder("cadence/Contacts/Ann.md")).toBe(false);
    expect(view._modeUsesEntityFolder("daily/2026-10-08.md")).toBe(false);
    expect(view._modeUsesEntityFolder("")).toBe(false);
    expect(view._modeUsesEntityFolder(undefined)).toBe(false);
  });
});

describe("CadenceAppView _toggleMobileNav", () => {
  it("flips the drawer state, or forces it, and mirrors it as a class on the content element", () => {
    const { view, root } = makeAppView();
    view._toggleMobileNav();
    expect(view.mobileNavOpen).toBe(true);
    expect(root.classes).toContain("cad-mobile-nav-open");
    view._toggleMobileNav(true);
    expect(view.mobileNavOpen).toBe(true);
    view._toggleMobileNav();
    expect(view.mobileNavOpen).toBe(false);
    expect(root.classes).not.toContain("cad-mobile-nav-open");
    view._toggleMobileNav("yes");
    expect(view.mobileNavOpen).toBe(true);
    view._toggleMobileNav(false);
    expect(view.mobileNavOpen).toBe(false);
  });

  it("still flips the state when the view has no content element", () => {
    const { view } = makeAppView();
    view.containerEl.children.length = 1;
    view._toggleMobileNav();
    expect(view.mobileNavOpen).toBe(true);
  });
});

describe("CadenceAppView setMode, toggleGroup and _toggleCadenceDark", () => {
  it("setMode migrates the id, clears an open detail form and re-renders", async () => {
    const { view } = makeAppView();
    const render = vi.spyOn(view, "render").mockResolvedValue(undefined);
    view.detailFile = { path: "Cadence/Contacts/Ann.md" };
    view.detailEntityKey = "contact";
    await view.setMode("planner");
    expect(view.mode).toBe("planner.calendar");
    expect(view.detailFile).toBeNull();
    expect(view.detailEntityKey).toBeNull();
    expect(render).toHaveBeenCalledTimes(1);
    await view.setMode("gone");
    expect(view.mode).toBe("home");
  });

  it("toggleGroup flips the group's collapsed flag, saves and re-renders", async () => {
    const { view, plugin } = makeAppView({ settings: { collapsedGroups: undefined } });
    const render = vi.spyOn(view, "render").mockResolvedValue(undefined);
    await view.toggleGroup("crm");
    expect(plugin.settings.collapsedGroups).toEqual({ crm: true });
    await view.toggleGroup("crm");
    expect(plugin.settings.collapsedGroups).toEqual({ crm: false });
    expect(plugin.saves).toBe(2);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("_toggleCadenceDark flips the setting, saves, then re-renders without awaiting it", async () => {
    const { view, plugin } = makeAppView();
    let finishRender: () => void = () => {};
    const render = vi.spyOn(view, "render").mockImplementation(() => new Promise<void>((r) => (finishRender = r)));
    await view._toggleCadenceDark();
    expect(plugin.settings.cadenceAppDark).toBe(true);
    expect(plugin.saves).toBe(1);
    expect(render).toHaveBeenCalledTimes(1);
    finishRender();
    await view._toggleCadenceDark();
    expect(plugin.settings.cadenceAppDark).toBe(false);
  });
});

describe("CadenceAppView entity detail open/close", () => {
  const files = [{ path: "Cadence/Contacts/Ann.md", frontmatter: { name: "Ann" } }];

  it("openEntityDetail sets the detail state and renders; it ignores a missing file or key", async () => {
    const { view, app } = makeAppView({ files });
    const render = vi.spyOn(view, "render").mockResolvedValue(undefined);
    const file = app.vault.getAbstractFileByPath("Cadence/Contacts/Ann.md");
    await view.openEntityDetail("contact", null);
    await view.openEntityDetail("", file);
    expect(render).not.toHaveBeenCalled();
    expect(view.detailFile).toBeNull();
    await view.openEntityDetail("contact", file);
    expect(view.detailEntityKey).toBe("contact");
    expect(view.detailFile).toBe(file);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("openTemplateDetail prefixes the key with template: and has the same guard", async () => {
    const { view } = makeAppView();
    const render = vi.spyOn(view, "render").mockResolvedValue(undefined);
    const file = { path: "Templates/Contact.md" };
    await view.openTemplateDetail("contact", undefined);
    expect(render).not.toHaveBeenCalled();
    await view.openTemplateDetail("contact", file);
    expect(view.detailEntityKey).toBe("template:contact");
    expect(view.detailFile).toBe(file);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("openEntityDetailFromFile opens a Cadence entity, and opens any other note as markdown", async () => {
    const { view, app } = makeAppView({ files: [...files, { path: "Notes/Plain.md" }] });
    const render = vi.spyOn(view, "render").mockResolvedValue(undefined);
    await view.openEntityDetailFromFile(app.vault.getAbstractFileByPath("Notes/Plain.md"));
    expect(app.workspace.openedLinks).toEqual([["Notes/Plain.md", "", false]]);
    expect(view.detailFile).toBeNull();
    expect(render).not.toHaveBeenCalled();
    const ann = app.vault.getAbstractFileByPath("Cadence/Contacts/Ann.md");
    await view.openEntityDetailFromFile(ann);
    expect(view.detailEntityKey).toBe("contact");
    expect(view.detailFile).toBe(ann);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("closeEntityDetail clears the detail state and renders", async () => {
    const { view } = makeAppView();
    const render = vi.spyOn(view, "render").mockResolvedValue(undefined);
    view.detailFile = { path: "x.md" };
    view.detailEntityKey = "template:deal";
    await view.closeEntityDetail();
    await flush();
    expect(view.detailFile).toBeNull();
    expect(view.detailEntityKey).toBeNull();
    expect(render).toHaveBeenCalledTimes(1);
  });
});
