import { describe, expect, it, vi } from "vitest";
import type { FakeElement } from "../mocks/obsidian";
import { ALL_SURFACES } from "../../src/constants/nav";
import { buttonByText } from "../helpers/dom";
import { flush, makeAppView, stubSurfaces, surfaceCalls } from "../helpers/app-view";

/* Characterization tests for CadenceAppView.render(): the top bar, the
   grouped nav, the detail-form routing, the surface route table and the
   re-render guard. The routed surfaces belong to later view tickets, so
   they are replaced with spies; the shell's own surfaces (renderComingSoon,
   openSettingsTab and _renderPageHeader) are rendered for real. */

const byClass = (root: FakeElement, tag: string, cls: string) => root.findAll(tag).filter((e) => e.classes.includes(cls));
const one = (root: FakeElement, tag: string, cls: string) => {
  const found = byClass(root, tag, cls);
  if (found.length !== 1) throw new Error(`expected one ${tag}.${cls}, found ${found.length}`);
  return found[0];
};

async function rendered(opts: Parameters<typeof makeAppView>[0] = {}) {
  const made = makeAppView(opts);
  const spies = stubSurfaces(made.view);
  await made.view.render();
  return { ...made, spies };
}

const navItems = (root: FakeElement) => byClass(root, "div", "cad-app-nav-item");
const navLabels = (root: FakeElement) =>
  navItems(root).map((item) => byClass(item, "span", "cad-app-nav-label")[0].text);

/* The route table: every nav surface id and what it renders. */
const ROUTES: Record<string, [string, ...unknown[]]> = {
  "home": ["renderHome"],
  "planner.inbox": ["renderInbox"],
  "planner.today": ["renderTodayPane"],
  "planner.calendar": ["renderPlannerPane"],
  "projects.dashboard": ["renderProjectsDashboard"],
  "projects.projects": ["renderEntityList", "project"],
  "crm.dashboard": ["renderDashboard"],
  "crm.pipeline": ["renderEntityList", "deal"],
  "crm.contacts": ["renderEntityList", "contact"],
  "crm.companies": ["renderEntityList", "company"],
  "crm.activities": ["renderEntityList", "activity"],
  "prm.partners": ["renderEntityList", "partner"],
  "prm.registrations": ["renderEntityList", "registration"],
  "prm.commissions": ["renderEntityList", "commission"],
  "prm.leads": ["renderEntityList", "lead"],
  "prm.certifications": ["renderEntityList", "certification"],
  "prm.analytics": ["renderPRMAnalytics"],
  "workflow.sequences": ["renderEntityList", "sequence"],
  "reports.pipeline": ["renderReportPipeline"],
  "reports.sales": ["renderReportSales"],
  "reports.partners": ["renderReportPartners"],
  "reports.activity": ["renderReportActivity"],
  "reports.productivity": ["renderProductivity"],
  "reports.graph": ["renderReportGraph"],
  "team": ["renderTeam"],
  "templates": ["renderTemplatesDashboard"],
};

describe("CadenceAppView render: shell", () => {
  it("rebuilds the content element as the Cadence app with the top bar, nav and content area", async () => {
    const { root } = await rendered({ settings: { defaultTab: "crm.pipeline" } });
    expect(root.classes).toEqual(["view-content", "cadence-app"]);
    expect(root.children.map((c) => c.classes[0])).toEqual(["cad-app-topbar", "cad-app-body"]);
    const topbar = root.children[0];
    expect(topbar.children.map((c) => [c.localName, c.classes[0]])).toEqual([
      ["button", "cad-mobile-burger"], ["div", "cad-app-brand"], ["div", "cad-app-topbar-right"],
    ]);
    const burger = topbar.children[0];
    expect([burger.icon, burger.title]).toEqual(["menu", "Show nav"]);
    expect(topbar.children[1].children.map((s) => s.text)).toEqual(["◐", "Cadence"]);
    expect(one(root, "div", "cad-app-topbar-meta").text).toBe("PIPELINE");
    const body = root.children[1];
    expect(body.children.map((c) => c.classes[0])).toEqual(["cad-mobile-backdrop", "cad-app-nav", "cad-app-content"]);
  });

  it("empties the previous render and toggles the scoped dark class and the theme button", async () => {
    const { root, view, plugin } = await rendered();
    const theme = one(root, "button", "cad-topbar-icon-btn");
    expect([theme.icon, theme.title]).toEqual(["moon", "Cadence: switch to dark"]);
    expect(root.classes).not.toContain("cad-dark");
    plugin.settings.cadenceAppDark = true;
    await view.render();
    expect(root.children).toHaveLength(2);
    expect(root.classes).toContain("cad-dark");
    const darkTheme = one(root, "button", "cad-topbar-icon-btn");
    expect([darkTheme.icon, darkTheme.title]).toEqual(["sun", "Cadence: switch to light"]);
  });

  it("wires the burger, backdrop and theme button to their toggles", async () => {
    const { root, view } = await rendered();
    const toggleNav = vi.spyOn(view, "_toggleMobileNav");
    const toggleDark = vi.spyOn(view, "_toggleCadenceDark").mockResolvedValue(undefined);
    one(root, "button", "cad-mobile-burger").trigger("click");
    one(root, "div", "cad-mobile-backdrop").trigger("click");
    one(root, "button", "cad-topbar-icon-btn").trigger("click");
    expect(toggleNav.mock.calls).toEqual([[], [false]]);
    expect(toggleDark).toHaveBeenCalledTimes(1);
  });

  it("labels the top bar with the custom page's name", async () => {
    const { root } = await rendered({
      settings: { defaultTab: "custom.1", customPages: [{ id: "custom.1", label: "Vendors", sectionId: "crm", entityKey: "vendor" }] },
    });
    expect(one(root, "div", "cad-app-topbar-meta").text).toBe("VENDORS");
  });

  it("QUIRK: a mode named after an Object.prototype member throws before routing", async () => {
    const { view, spies } = await rendered();
    view.mode = "toString";
    await expect(view.render()).rejects.toThrow(TypeError);
    expect(surfaceCalls(spies)).toEqual([["renderHome"]]);
    // The guard is released by the finally block, so the next render runs.
    view.mode = "home";
    await view.render();
    expect(spies.renderHome).toHaveBeenCalledTimes(2);
  });
});

describe("CadenceAppView render: nav", () => {
  it("lists the visible surfaces in order, marks the active one, and badges nothing as soon", async () => {
    const { root } = await rendered({ settings: { defaultTab: "crm.contacts" } });
    expect(navLabels(root)).toEqual([
      "Home", "Inbox", "Today", "Calendar", "Dashboard", "Projects",
      "Dashboard", "Pipeline", "Contacts", "Companies", "Activities", "Sequences",
      "Pipeline", "Sales", "Activity", "Productivity", "Graph View", "Team", "Templates", "Settings",
    ]);
    const active = navItems(root).filter((i) => i.classes.includes("active"));
    expect(active.map((i) => i.findAll("span")[1].text)).toEqual(["Contacts"]);
    expect(active[0].findAll("span")[0].icon).toBe("users");
    expect(byClass(root, "span", "cad-app-nav-badge")).toHaveLength(0);
  });

  it("renders labeled group heads with an upper-case label and a chevron, and skips them for unlabeled groups", async () => {
    const { root } = await rendered();
    const heads = byClass(root, "div", "cad-nav-group-head");
    expect(heads.map((h) => h.findAll("span").map((s) => s.text || s.icon))).toEqual([
      ["chevron-down", "PLANNER"], ["chevron-down", "PROJECTS"], ["chevron-down", "CRM"],
      ["chevron-down", "WORKFLOW"], ["chevron-down", "REPORTS"],
    ]);
    expect(byClass(root, "div", "cad-nav-group")).toHaveLength(7);
  });

  it("hides a collapsed group's items behind a right chevron; unlabeled groups never collapse", async () => {
    const { root, view } = await rendered({ settings: { collapsedGroups: { crm: true, misc: true } } });
    expect(navLabels(root)).not.toContain("Contacts");
    expect(navLabels(root)).toContain("Settings");
    const crmHead = byClass(root, "div", "cad-nav-group-head")[2];
    expect(crmHead.findAll("span")[0].icon).toBe("chevron-right");
    const toggle = vi.spyOn(view, "toggleGroup").mockResolvedValue(undefined);
    crmHead.trigger("click");
    expect(toggle).toHaveBeenCalledWith("crm");
  });

  it("badges the inbox with the count of due, undone reminders", async () => {
    const reminders = [
      { id: "a", when: "2000-01-01T09:00:00Z" },
      { id: "b", when: "2000-01-02T09:00:00Z" },
      { id: "c", when: "2000-01-02T09:00:00Z", done: true },
      { id: "d", when: "2999-01-01T09:00:00Z" },
      { id: "e" },
    ];
    const { root, plugin, view } = await rendered({ settings: { reminders } });
    const inbox = navItems(root)[1];
    expect(inbox.findAll("span").map((s) => [s.classes.join(" "), s.text])).toEqual([
      ["cad-app-nav-icon", ""], ["cad-app-nav-label", "Inbox"], ["cad-app-nav-badge cad-nav-badge-alert", "2"],
    ]);
    plugin.settings.reminders = [];
    await view.render();
    expect(byClass(root, "span", "cad-nav-badge-alert")).toHaveLength(0);
  });

  it("badges a non-built surface as soon, but not a custom.* page", async () => {
    const customPages = [
      { id: "custom.1", label: "Vendors", sectionId: "crm", entityKey: "vendor" },
      { id: "hand-edited", label: "Odd", sectionId: "crm", entityKey: "vendor" },
    ];
    const { root } = await rendered({ settings: { customPages } });
    const soon = byClass(root, "span", "cad-app-nav-badge").map((b) => [b.parent!.findAll("span")[1].text, b.text]);
    expect(soon).toEqual([["Odd", "soon"]]);
  });

  it("switches surface on click and closes the mobile drawer only when it is open", async () => {
    const { root, view } = await rendered();
    const setMode = vi.spyOn(view, "setMode").mockResolvedValue(undefined);
    const toggleNav = vi.spyOn(view, "_toggleMobileNav");
    navItems(root)[2].trigger("click");
    expect(setMode).toHaveBeenLastCalledWith("planner.today");
    expect(toggleNav).not.toHaveBeenCalled();
    view.mobileNavOpen = true;
    navItems(root)[0].trigger("click");
    expect(setMode).toHaveBeenLastCalledWith("home");
    expect(toggleNav.mock.calls).toEqual([[false]]);
    expect(view.mobileNavOpen).toBe(false);
  });
});

describe("CadenceAppView render: routing", () => {
  it("routes every built nav surface to its render method with the content element", async () => {
    const routed: Record<string, unknown[]> = {};
    for (const surface of ALL_SURFACES) {
      if (surface.id === "settings") continue;
      const { view, spies, root } = await rendered({
        settings: { defaultTab: surface.id, modules: { crm: true, prm: true, planner: true, projects: true } },
      });
      const calls = surfaceCalls(spies);
      expect(calls).toHaveLength(1);
      const [name] = calls[0];
      expect(spies[name as keyof typeof spies].mock.calls[0][0]).toBe(one(root, "div", "cad-app-content"));
      routed[view.mode] = calls[0];
    }
    expect(routed).toEqual(ROUTES);
  });

  it("routes settings to the settings card, and a custom page to its entity list", async () => {
    const { root, spies } = await rendered({ settings: { defaultTab: "settings" } });
    expect(surfaceCalls(spies)).toEqual([]);
    expect(one(root, "div", "cad-soon-title").text).toBe("Settings");
    const custom = await rendered({
      settings: { defaultTab: "custom.1", customPages: [{ id: "custom.1", label: "Vendors", sectionId: "crm", entityKey: "vendor" }] },
    });
    expect(surfaceCalls(custom.spies)).toEqual([["renderEntityList", "vendor"]]);
  });

  it("QUIRK: a custom page that shadows a built surface id renders the built surface", async () => {
    const { spies } = await rendered({
      settings: { defaultTab: "team", customPages: [{ id: "team", label: "Mine", sectionId: "crm", entityKey: "vendor" }] },
    });
    expect(surfaceCalls(spies)).toEqual([["renderTeam"]]);
  });

  it("QUIRK: a custom page whose id is an Object.prototype member renders nothing (or throws)", async () => {
    const page = (id: string) => [{ id, label: "Odd", sectionId: "crm", entityKey: "vendor" }];
    const blank = await rendered({ settings: { defaultTab: "toString", customPages: page("toString") } });
    expect(surfaceCalls(blank.spies)).toEqual([]);
    expect(one(blank.root, "div", "cad-app-content").children).toHaveLength(0);
    const { view } = makeAppView({ settings: { defaultTab: "__proto__", customPages: page("__proto__") } });
    const spies = stubSurfaces(view);
    await expect(view.render()).rejects.toThrow(TypeError);
    expect(surfaceCalls(spies)).toEqual([]);
  });

  it("falls through to the coming-soon card when the mode has no route", async () => {
    const { view, root, spies } = await rendered();
    view.mode = "crm.forecast";
    await view.render();
    expect(surfaceCalls(spies)).toEqual([["renderHome"]]);
    const content = one(root, "div", "cad-app-content");
    expect(content.classes).toEqual(["cad-app-content", "cadence-soon"]);
    // The top bar labels it Home: _resolveSurface falls back for an unknown id.
    expect(one(root, "div", "cad-app-topbar-meta").text).toBe("HOME");
    expect(one(root, "div", "cad-soon-title").text).toBe("Home");
  });
});

describe("CadenceAppView render: detail form", () => {
  const files = [{ path: "Cadence/Contacts/Ann.md", frontmatter: { name: "Ann" } }];

  it("renders the entity or template detail form instead of the surface", async () => {
    const { view, app, spies, root } = await rendered({ files });
    const file = app.vault.getAbstractFileByPath("Cadence/Contacts/Ann.md");
    view.detailFile = file;
    view.detailEntityKey = "contact";
    await view.render();
    view.detailEntityKey = "template:contact";
    await view.render();
    expect(surfaceCalls(spies)).toEqual([
      ["renderHome"],
      ["renderEntityDetail", "contact", file],
      ["renderTemplateDetail", "contact", file],
    ]);
    expect(spies.renderTemplateDetail.mock.calls[0][0]).toBe(one(root, "div", "cad-app-content"));
  });

  it("drops a detail form whose file is gone and renders the surface", async () => {
    const { view, spies } = await rendered();
    view.detailFile = { path: "Cadence/Contacts/Gone.md" };
    view.detailEntityKey = "contact";
    await view.render();
    expect(view.detailFile).toBeNull();
    expect(view.detailEntityKey).toBeNull();
    expect(surfaceCalls(spies)).toEqual([["renderHome"], ["renderHome"]]);
  });

  it("logs and falls back to the surface when the detail form throws, rendering into the same content", async () => {
    const { view, app, spies, root } = await rendered({ files });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    spies.renderEntityDetail.mockImplementation(async (content: FakeElement) => {
      content.createDiv({ text: "half-built" });
      throw new Error("boom");
    });
    view.detailFile = app.vault.getAbstractFileByPath("Cadence/Contacts/Ann.md");
    view.detailEntityKey = "contact";
    await view.render();
    expect(error).toHaveBeenCalledWith("Cadence: Failed to render detail view", expect.any(Error));
    expect(view.detailFile).toBeNull();
    expect(spies.renderHome).toHaveBeenCalledTimes(2);
    // The partial detail output stays above the surface.
    expect(one(root, "div", "cad-app-content").children.map((c) => c.text)).toEqual(["half-built"]);
    error.mockRestore();
  });
});

describe("CadenceAppView render: re-render guard", () => {
  it("coalesces renders requested mid-render into one follow-up render", async () => {
    const { view, spies } = await rendered();
    let finish: () => void = () => {};
    spies.renderHome.mockImplementationOnce(() => new Promise<void>((r) => (finish = r)));
    const first = view.render();
    await expect(view.render()).resolves.toBeUndefined();
    await view.render();
    expect(view._isRendering).toBe(true);
    expect(view._needsRenderAgain).toBe(true);
    expect(spies.renderHome).toHaveBeenCalledTimes(2);
    finish();
    await first;
    await flush();
    expect(spies.renderHome).toHaveBeenCalledTimes(3);
    expect(view._isRendering).toBe(false);
    expect(view._needsRenderAgain).toBe(false);
  });
});

describe("CadenceAppView shell surfaces", () => {
  it("renderComingSoon describes the surface with its icon", () => {
    const { view } = makeAppView();
    const root = view.containerEl.children[0] as FakeElement;
    view.renderComingSoon(root, { label: "Forecast", desc: "Soon-ish.", icon: "telescope" });
    expect(root.classes).toContain("cadence-soon");
    const wrap = root.children[0];
    expect(wrap.classes).toEqual(["cad-soon-wrap"]);
    expect(wrap.children.map((c) => [c.classes[0], c.text || c.icon])).toEqual([
      ["cad-eyebrow", "COMING SOON"],
      ["cad-soon-title", "Forecast"],
      ["cad-soon-desc", "Soon-ish."],
      ["cad-soon-icon", "telescope"],
      ["cad-soon-meta", "This surface is scaffolded but not yet built. Tell the team to flesh it out next."],
    ]);
  });

  it("_renderPageHeader builds the eyebrow, title, optional subtitle and an actions slot", () => {
    const { view } = makeAppView();
    const root = view.containerEl.children[0] as FakeElement;
    let slot: FakeElement | null = null;
    const head = view._renderPageHeader(root, "Contacts", "12 people", (right: FakeElement) => {
      slot = right;
      right.createEl("button", { text: "New" });
    });
    expect(head).toBe(root.children[0]);
    expect(head.classes).toEqual(["cad-page-header"]);
    expect(head.children[0].children.map((c: FakeElement) => [c.classes[0], c.text])).toEqual([
      ["cad-eyebrow", "CADENCE"], ["cad-page-title", "Contacts"], ["cad-page-subtitle", "12 people"],
    ]);
    expect(slot).toBe(head.children[1]);
    expect(head.children[1].classes).toEqual(["cad-page-header-right"]);
    const bare = view._renderPageHeader(root, "Home", "", "not a function");
    expect(bare.children[0].children.map((c: FakeElement) => c.classes[0])).toEqual(["cad-eyebrow", "cad-page-title"]);
    expect(bare.children[1].children).toHaveLength(0);
  });

  it("openSettingsTab shows a card whose button opens Obsidian settings on the Cadence tab", async () => {
    const { view, app } = makeAppView();
    const root = view.containerEl.children[0] as FakeElement;
    await view.openSettingsTab(root);
    expect(root.classes).toContain("cadence-soon");
    const wrap = root.children[0];
    expect(wrap.children.map((c) => [c.classes.join(" "), c.text || c.icon])).toEqual([
      ["cad-soon-icon", "settings-2"],
      ["cad-eyebrow", "CADENCE"],
      ["cad-soon-title", "Settings"],
      ["cad-soon-desc", "Configure folders, headings, week start, default tab, and the (future) Cadence API connection."],
      ["cad-btn primary", "Open Cadence settings"],
    ]);
    const button = buttonByText(wrap, "Open Cadence settings");
    expect(button.style.marginTop).toBe("12px");
    button.trigger("click");
    expect(app.setting.calls).toEqual(["open", "openTabById:cadence-planner"]);
  });
});
