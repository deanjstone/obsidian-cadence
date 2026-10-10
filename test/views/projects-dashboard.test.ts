import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeElement, Notice, Platform, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";
import { ENTITIES } from "../../src/constants/entities";
import { CadenceWidgetCreateModal } from "../../src/modals/widget-create";

/* Characterization tests for the Projects dashboard, renderProjectsDashboard:
   the header, the total and per-status cards, the priority board, drag and
   drop between cards, and the custom chart widgets (counting, style change,
   delete and add). */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Platform.isMobile = false;
  Notice.messages.length = 0;
});

function setup(files: MockFileSpec[] = [], settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files, settings });
  made.view.mode = "projects.dashboard";
  const root = new FakeElement("div");
  const rendered = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
  const opened = vi.spyOn(made.view, "openEntityDetail").mockResolvedValue(undefined);
  const created = vi.spyOn(made.view, "_createEntityFromPrompt").mockResolvedValue(undefined);
  const charts = vi.spyOn(made.view, "_drawChart").mockImplementation(() => {});
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path);
  const fm = (path: string) => made.app.metadataCache.getFileCache(file(path) as Any)?.frontmatter;
  return { ...made, root, rendered, opened, created, charts, file, fm };
}

const project = (name: string, frontmatter: Record<string, unknown>): MockFileSpec => ({ path: `Cadence/Projects/${name}.md`, frontmatter });
const ALPHA = project("Alpha", { name: "Alpha launch", status: "active", priority: "high", tags: ["[[Launch]]", "web", " "] });
const BETA = project("Beta", { name: "Beta", status: "Done", priority: "Medium", tags: "web" });
const GAMMA = project("Gamma", { status: "on-hold", priority: "urgent", tags: [] });
const DELTA = project("Delta", { name: "Delta" });
const EPSILON = project("Epsilon", { name: "Epsilon", status: ["active"], priority: "high" });
const PROJECTS = [ALPHA, BETA, GAMMA, DELTA, EPSILON];

const header = (root: FakeElement) => root.children[0];
const headerTexts = (root: FakeElement) => header(root).children[0].children.map((c) => c.text);
const statGrid = (root: FakeElement) => root.children[1];
const statusCards = (root: FakeElement) => statGrid(root).children.slice(1);
const statusCard = (root: FakeElement, status: string) => statusCards(root).find((c) => c.dataset.stage === status)!;
const board = (root: FakeElement) => root.children[3];
const prioCard = (root: FakeElement, prio: string) => board(root).children.find((c) => c.dataset.stage === prio)!;
const cardRows = (card: FakeElement) => card.children[2].children;
const rowView = (row: FakeElement) => row.children.map((c) => (c.classes.length ? [c.text, c.classes] : c.text));
const analyticsHeader = (root: FakeElement) => root.children[4];
const widgetsGrid = (root: FakeElement) => root.children[5];

function dataTransfer(data: Record<string, string> = {}) {
  const store: Record<string, string> = { ...data };
  return {
    store,
    dropEffect: "",
    effectAllowed: "",
    getData: (k: string) => store[k] ?? "",
    setData: (k: string, v: string) => {
      store[k] = v;
    },
  };
}

describe("renderProjectsDashboard: header and stats", () => {
  it("adds the dashboard and list classes and renders the header with + New Project", async () => {
    const { view, root, created } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    expect(root.classes).toEqual(["cadence-dashboard", "cadence-list"]);
    expect(headerTexts(root)).toEqual(["CADENCE", "Projects Dashboard", "Status · priority · custom analytics"]);
    const [btn] = header(root).children[1].children;
    expect([btn.text, btn.classes]).toEqual(["+ New Project", ["cad-btn", "primary"]]);
    btn.trigger("click");
    expect(created.mock.calls).toEqual([["project"]]);
  });

  it("lays out stats, the priority board, the analytics header and the widgets grid in order", async () => {
    const { view, root } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    expect(root.children.map((c) => [c.classes, c.text])).toEqual([
      [["cad-page-header"], ""],
      [["cad-stat-grid"], ""],
      [["cad-section-label-lg"], "PROJECTS BY PRIORITY"],
      [["cad-stat-grid"], ""],
      [[], ""],
      [["cad-dash-cols"], ""],
    ]);
    expect(statGrid(root).attrs.style).toBe("padding-bottom: 24px;");
    expect(board(root).attrs.style).toBe("padding-top: 0; padding-bottom: 24px;");
  });

  it("counts every project in the total card", async () => {
    const { view, root } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    const total = statGrid(root).children[0];
    expect(total.dataset.accent).toBe("sky");
    expect(total.children.map((c) => c.text)).toEqual(["TOTAL PROJECTS", "5", "Across all active and custom statuses"]);
  });

  it("renders one card per status option with its accent, label and case-insensitive count", async () => {
    const { view, root } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    expect(statusCards(root).map((c) => [c.dataset.stage, c.dataset.accent, c.children[0].text, c.children[1].text])).toEqual([
      ["active", "emerald", "ACTIVE PROJECTS", "2"],
      ["on_hold", "warn", "ON HOLD PROJECTS", "0"],
      ["backlog", "purple", "BACKLOG PROJECTS", "0"],
      ["done", "mint", "DONE PROJECTS", "1"],
      ["cancelled", "rose", "CANCELLED PROJECTS", "0"],
    ]);
  });

  it("QUIRK: a project with no status or an off-list one ('on-hold') is in the total but in no status card", async () => {
    const { view, root } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    const listed = statusCards(root).flatMap((c) => cardRows(c).filter((r) => r.hasClass("cad-dash-row")).map((r) => r.children[0].text));
    expect(listed).toEqual(["Alpha launch", "Epsilon", "Beta"]);
    expect(statGrid(root).children[0].children[1].text).toBe("5");
  });

  it("lists each status card's projects with a priority pill, or 'No projects'", async () => {
    const { view, root } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    expect(cardRows(statusCard(root, "active")).map(rowView)).toEqual([
      ["Alpha launch", ["high", ["cad-pill", "cad-pill-high"]]],
      ["Epsilon", ["high", ["cad-pill", "cad-pill-high"]]],
    ]);
    expect(cardRows(statusCard(root, "done")).map(rowView)).toEqual([["Beta", ["Medium", ["cad-pill", "cad-pill-medium"]]]]);
    const empty = cardRows(statusCard(root, "backlog"));
    expect(empty.map((e) => [e.classes, e.text])).toEqual([[["cad-empty"], "No projects"]]);
    const pill = cardRows(statusCard(root, "active"))[0].children[1];
    expect([pill.style.fontSize, pill.style.padding]).toEqual(["0.7em", "1px 6px"]);
  });

  it("names a row by its basename when it has no name, and pills underscore→space with a _ class", async () => {
    const files = [project("Zeta", { status: "backlog", priority: "very_high" })];
    const { view, root } = setup(files);
    await view.renderProjectsDashboard(root);
    expect(cardRows(statusCard(root, "backlog")).map(rowView)).toEqual([["Zeta", ["very high", ["cad-pill", "cad-pill-very_high"]]]]);
  });

  it("takes the status cards from the project def's options, with fallback accents by index", async () => {
    const statusField = ENTITIES.project.fields.find((f) => f.key === "status")!;
    const saved = statusField.options;
    statusField.options = ["Idea", "on-hold", "active"];
    try {
      const { view, root } = setup([project("I", { status: "idea" })]);
      await view.renderProjectsDashboard(root);
      expect(statusCards(root).map((c) => [c.dataset.stage, c.dataset.accent, c.children[0].text, c.children[1].text])).toEqual([
        ["Idea", "sky", "IDEA PROJECTS", "1"],
        ["on-hold", "warn", "ON-HOLD PROJECTS", "0"],
        ["active", "emerald", "ACTIVE PROJECTS", "0"],
      ]);
    } finally {
      statusField.options = saved;
    }
  });

  it("clicking a row opens the project and stops propagation", async () => {
    const { view, root, opened, file } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    const event = cardRows(statusCard(root, "done"))[0].trigger("click");
    expect(event.propagationStopped).toBe(true);
    expect(opened.mock.calls).toEqual([["project", file("Cadence/Projects/Beta.md")]]);
  });

  it("shows Coming soon when there is no project entity", async () => {
    const saved = ENTITIES.project;
    delete (ENTITIES as Any).project;
    try {
      const { view, root } = setup();
      const soon = vi.spyOn(view, "renderComingSoon").mockImplementation(() => {});
      await view.renderProjectsDashboard(root);
      expect(root.classes).toEqual(["cadence-dashboard", "cadence-list"]);
      expect(soon.mock.calls).toEqual([[root, view._resolveSurface("projects.dashboard")]]);
      expect(root.children).toEqual([]);
    } finally {
      (ENTITIES as Any).project = saved;
    }
  });
});

describe("renderProjectsDashboard: priority board", () => {
  it("renders one card per priority option with its accent, label, count and status pills", async () => {
    const { view, root } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    expect(board(root).children.map((c) => [c.dataset.stage, c.dataset.accent, c.children[0].text, c.children[1].text])).toEqual([
      ["low", "sky", "LOW PRIORITY", "0"],
      ["medium", "warn", "MEDIUM PRIORITY", "1"],
      ["high", "rose", "HIGH PRIORITY", "2"],
    ]);
    expect(cardRows(prioCard(root, "high")).map(rowView)).toEqual([
      ["Alpha launch", ["active", ["cad-pill", "cad-pill-active"]]],
      ["Epsilon", ["active", ["cad-pill", "cad-pill-active"]]],
    ]);
    expect(cardRows(prioCard(root, "medium")).map(rowView)).toEqual([["Beta", ["Done", ["cad-pill", "cad-pill-done"]]]]);
    expect(cardRows(prioCard(root, "low")).map((e) => e.text)).toEqual(["No projects"]);
  });

  it("drops a row without a status pill, and names are capped at 160px (140px on status cards)", async () => {
    const files = [project("P", { name: "P", priority: "low" }), project("Q", { name: "Q", status: "on_hold", priority: "low" })];
    const { view, root } = setup(files);
    await view.renderProjectsDashboard(root);
    expect(cardRows(prioCard(root, "low")).map(rowView)).toEqual([["P"], ["Q", ["on hold", ["cad-pill", "cad-pill-on_hold"]]]]);
    expect(cardRows(prioCard(root, "low"))[0].children[0].attrs.style).toContain("max-width: 160px;");
    expect(cardRows(statusCard(root, "on_hold"))[0].children[0].attrs.style).toContain("max-width: 140px;");
  });

  it("takes the priorities from the def, with sky for an unknown one", async () => {
    const field = ENTITIES.project.fields.find((f) => f.key === "priority")!;
    const saved = field.options;
    field.options = ["P1", "High"];
    try {
      const { view, root } = setup([project("A", { priority: "p1" })]);
      await view.renderProjectsDashboard(root);
      expect(board(root).children.map((c) => [c.dataset.stage, c.dataset.accent, c.children[0].text, c.children[1].text])).toEqual([
        ["P1", "sky", "P1 PRIORITY", "1"],
        ["High", "rose", "HIGH PRIORITY", "0"],
      ]);
    } finally {
      field.options = saved;
    }
  });

  it("clicking a priority row opens the project", async () => {
    const { view, root, opened, file } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    cardRows(prioCard(root, "medium"))[0].trigger("click");
    expect(opened.mock.calls).toEqual([["project", file("Cadence/Projects/Beta.md")]]);
  });
});

describe("renderProjectsDashboard: drag and drop", () => {
  it("a status row drags its path, status and wiki link, dimming while dragged", async () => {
    const { view, root } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    const row = cardRows(statusCard(root, "done"))[0];
    expect(row.draggable).toBe(true);
    const dt = dataTransfer();
    row.trigger("dragstart", { dataTransfer: dt });
    expect(row.style.opacity).toBe("0.4");
    expect(dt.effectAllowed).toBe("move");
    expect(dt.store).toEqual({ "text/cadence-entity": "Cadence/Projects/Beta.md", "text/cadence-stage-status": "done", "text/plain": "[[Beta]]" });
    row.trigger("dragend");
    expect(row.style.opacity).toBe("");
  });

  it("a priority row drags its path and priority under text/cadence-stage", async () => {
    const { view, root } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    const dt = dataTransfer();
    cardRows(prioCard(root, "medium"))[0].trigger("dragstart", { dataTransfer: dt });
    expect(dt.store).toEqual({ "text/cadence-entity": "Cadence/Projects/Beta.md", "text/cadence-stage": "medium", "text/plain": "[[Beta]]" });
  });

  it("rows are not draggable on mobile", async () => {
    Platform.isMobile = true;
    const { view, root } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    expect(cardRows(statusCard(root, "done"))[0].draggable).toBe(false);
    expect(cardRows(prioCard(root, "medium"))[0].draggable).toBe(false);
  });

  it("dragover highlights a card and dragleave clears it unless still inside", async () => {
    const { view, root } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    const card = statusCard(root, "backlog");
    const dt = dataTransfer();
    const over = card.trigger("dragover", { dataTransfer: dt });
    expect(over.defaultPrevented).toBe(true);
    expect(dt.dropEffect).toBe("move");
    expect(card.style.boxShadow).toBe("0 0 0 2px var(--interactive-accent)");
    card.trigger("dragleave", { relatedTarget: card.children[2] });
    expect(card.style.boxShadow).toBe("0 0 0 2px var(--interactive-accent)");
    card.trigger("dragleave", { relatedTarget: null });
    expect(card.style.boxShadow).toBe("");
    const prio = prioCard(root, "low");
    prio.trigger("dragover", { dataTransfer: dt });
    expect(prio.style.boxShadow).toBe("0 0 0 2px var(--interactive-accent)");
    prio.trigger("dragleave", { relatedTarget: null });
    expect(prio.style.boxShadow).toBe("");
  });

  it("dropping on a status card writes the status, notices and re-renders", async () => {
    const { view, root, rendered, fm } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    const card = statusCard(root, "backlog");
    card.style.boxShadow = "x";
    const event = card.trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-entity": "Cadence/Projects/Beta.md", "text/cadence-stage-status": "done" }) });
    await flush();
    expect(event.defaultPrevented).toBe(true);
    expect(card.style.boxShadow).toBe("");
    expect(fm("Cadence/Projects/Beta.md")!.status).toBe("backlog");
    expect(Notice.messages).toEqual(["Project status set to backlog"]);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("dropping on a priority card writes the priority", async () => {
    const { view, root, rendered, fm } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    prioCard(root, "low").trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-entity": "Cadence/Projects/Beta.md", "text/cadence-stage": "medium" }) });
    await flush();
    expect(fm("Cadence/Projects/Beta.md")!.priority).toBe("low");
    expect(Notice.messages).toEqual(["Project priority set to low"]);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("ignores a drop with no path, from the same card, or for a missing file", async () => {
    const { view, root, rendered, fm } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    const card = statusCard(root, "done");
    card.trigger("drop", { dataTransfer: dataTransfer({}) });
    card.trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-entity": "Cadence/Projects/Alpha.md", "text/cadence-stage-status": "done" }) });
    card.trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-entity": "Cadence/Projects/Nope.md" }) });
    prioCard(root, "high").trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-entity": "Cadence/Projects/Beta.md", "text/cadence-stage": "high" }) });
    await flush();
    expect(fm("Cadence/Projects/Alpha.md")!.status).toBe("active");
    expect(fm("Cadence/Projects/Beta.md")!.priority).toBe("Medium");
    expect(Notice.messages).toEqual([]);
    expect(rendered).not.toHaveBeenCalled();
  });

  it("QUIRK: a status card ignores text/cadence-stage, so a priority row dropped on a status card writes the status", async () => {
    const { view, root, fm } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    statusCard(root, "cancelled").trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-entity": "Cadence/Projects/Alpha.md", "text/cadence-stage": "cancelled" }) });
    await flush();
    expect(fm("Cadence/Projects/Alpha.md")!.status).toBe("cancelled");
  });

  it("QUIRK: a drop writes status to any note, not only projects", async () => {
    const files = [...PROJECTS, { path: "Cadence/Contacts/Jane.md", frontmatter: { name: "Jane" } }];
    const { view, root, fm } = setup(files);
    await view.renderProjectsDashboard(root);
    statusCard(root, "active").trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-entity": "Cadence/Contacts/Jane.md" }) });
    await flush();
    expect(fm("Cadence/Contacts/Jane.md")!.status).toBe("active");
  });

  it("notices a failed write and does not re-render", async () => {
    const { view, root, app, rendered } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    vi.spyOn(app.fileManager, "processFrontMatter").mockRejectedValue(new Error("locked"));
    statusCard(root, "active").trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-entity": "Cadence/Projects/Beta.md" }) });
    prioCard(root, "low").trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-entity": "Cadence/Projects/Beta.md" }) });
    await flush();
    expect(Notice.messages).toEqual(["Failed to change status: locked", "Failed to change priority: locked"]);
    expect(rendered).not.toHaveBeenCalled();
  });
});

describe("renderProjectsDashboard: custom chart widgets", () => {
  const W1 = { id: "widget.1", title: "By tags", groupBy: "tags", style: "bar" };
  const W2 = { id: "widget.2", title: "Owners", groupBy: "owner", style: "donut" };

  it("shows the analytics header and an empty prompt when there are no widgets", async () => {
    const { view, root, charts } = setup(PROJECTS);
    await view.renderProjectsDashboard(root);
    const [label, add] = analyticsHeader(root).children;
    expect([label.localName, label.text, label.classes]).toEqual(["span", "ANALYTICS & CHARTS", ["cad-section-label-lg"]]);
    expect([add.text, add.classes]).toEqual(["+ Add Custom Chart", ["cad-btn", "primary"]]);
    expect(widgetsGrid(root).children.map((c) => c.children.map((x) => x.text))).toEqual([
      ['No custom charts added yet. Click "+ Add Custom Chart" to create one!'],
    ]);
    expect(charts).not.toHaveBeenCalled();
  });

  it("draws one card per projectDashboardWidgets entry, counting projects by its groupBy", async () => {
    const { view, root, charts } = setup(PROJECTS, { projectDashboardWidgets: [W1, W2] });
    await view.renderProjectsDashboard(root);
    const cards = widgetsGrid(root).children;
    expect(cards.map((c) => c.children[0].children[0].text)).toEqual(["BY TAGS", "OWNERS"]);
    expect(charts.mock.calls.map(([parent, style, data], i) => [(parent as Any).parent === cards[i].children[1], style, data])).toEqual([
      [true, "bar", [{ label: "web", count: 2 }, { label: "Unspecified", count: 2 }, { label: "Launch", count: 1 }]],
      [true, "donut", [{ label: "Unspecified", count: 5 }]],
    ]);
  });

  it("counts list items once each (wiki brackets stripped, blanks skipped) and a blank scalar as Unspecified", async () => {
    const files = [
      project("A", { tags: ["[[x]]", "y", "", "x"] }),
      project("B", { tags: "[[y]]" }),
      project("C", { tags: "" }),
      project("D", { tags: [] }),
    ];
    const { view, root, charts } = setup(files, { projectDashboardWidgets: [W1] });
    await view.renderProjectsDashboard(root);
    expect(charts.mock.calls[0][2]).toEqual([
      { label: "x", count: 2 },
      { label: "y", count: 2 },
      { label: "Unspecified", count: 1 },
    ]);
  });

  it("reads the groupBy through entityValue, so 'name' falls back to the basename and 'type' to the entity key", async () => {
    const files = [project("A", {}), project("B", { name: "Bee" })];
    const { view, root, charts } = setup(files, {
      projectDashboardWidgets: [{ ...W1, groupBy: "name" }, { ...W1, id: "w.t", groupBy: "type" }],
    });
    await view.renderProjectsDashboard(root);
    expect(charts.mock.calls.map((c) => c[2])).toEqual([
      [{ label: "A", count: 1 }, { label: "Bee", count: 1 }],
      [{ label: "project", count: 2 }],
    ]);
  });

  it("offers the four styles with the widget's selected; changing it saves and re-renders", async () => {
    const widgets = [{ ...W1 }];
    const { view, root, plugin, rendered } = setup(PROJECTS, { projectDashboardWidgets: widgets });
    await view.renderProjectsDashboard(root);
    const [select, del] = widgetsGrid(root).children[0].children[0].children[1].children;
    expect(select.classes).toEqual(["cad-prop-input"]);
    expect(select.options.map((o) => [o.value, o.text, o.selected])).toEqual([
      ["donut", "🍩 Donut", false],
      ["bar", "📊 Bar", true],
      ["kpi", "🗃️ KPI Cards", false],
      ["list", "📋 List", false],
    ]);
    expect([del.text, del.classes]).toEqual(["×", ["cad-btn"]]);
    select.value = "kpi";
    select.trigger("change");
    await flush();
    expect(widgets[0].style).toBe("kpi");
    expect(plugin.settings.projectDashboardWidgets).toBe(widgets);
    expect(plugin.saves).toBe(1);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("× deletes the widget by id after confirm(), then saves and re-renders", async () => {
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal("confirm", confirm);
    const { view, root, plugin, rendered } = setup(PROJECTS, { projectDashboardWidgets: [W1, W2] });
    await view.renderProjectsDashboard(root);
    const del = widgetsGrid(root).children[0].children[0].children[1].children[1];
    del.trigger("click");
    await flush();
    expect(plugin.settings.projectDashboardWidgets).toEqual([W1, W2]);
    expect(rendered).not.toHaveBeenCalled();
    del.trigger("click");
    await flush();
    expect(confirm.mock.calls).toEqual([['Delete chart "By tags"?'], ['Delete chart "By tags"?']]);
    expect(plugin.settings.projectDashboardWidgets).toEqual([W2]);
    expect(plugin.saves).toBe(1);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("+ Add Custom Chart opens the widget modal for projects; its result is appended, saved and rendered", async () => {
    const open = vi.spyOn(CadenceWidgetCreateModal.prototype, "open").mockImplementation(() => {});
    const { view, root, plugin, rendered } = setup(PROJECTS);
    delete plugin.settings.projectDashboardWidgets;
    await view.renderProjectsDashboard(root);
    analyticsHeader(root).children[1].trigger("click");
    const modal = open.mock.contexts[0] as Any;
    expect(modal.entityKey).toBe("project");
    await modal.onSubmit(W1);
    expect(plugin.settings.projectDashboardWidgets).toEqual([W1]);
    expect(plugin.saves).toBe(1);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("QUIRK: a widget with no title throws, so later widgets never draw", async () => {
    const { view, root, charts } = setup(PROJECTS, { projectDashboardWidgets: [{ id: "w", groupBy: "tags", style: "bar" }, W2] });
    await expect(view.renderProjectsDashboard(root)).rejects.toThrow(TypeError);
    expect(charts).not.toHaveBeenCalled();
  });
});
