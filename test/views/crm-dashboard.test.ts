import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeElement, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";
import { ENTITIES } from "../../src/constants/entities";
import { CadenceWidgetCreateModal } from "../../src/modals/widget-create";
import { fmtValue } from "../../src/utils/format";

/* Characterization tests for the CRM dashboard, renderDashboard: the five
   stat cards (pipeline, won, lost, win rate, average deal), the pipeline by
   stage, the hot and stale deal cards, recent activity, the customer base,
   and the custom chart widgets. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 11, 12);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(files: MockFileSpec[] = [], settings: Record<string, unknown> = {}) {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  const made = makeAppView({ files, settings });
  made.view.mode = "crm.dashboard";
  const root = new FakeElement("div");
  const rendered = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
  const created = vi.spyOn(made.view, "_createEntityFromPrompt").mockResolvedValue(undefined);
  const modes = vi.spyOn(made.view, "setMode").mockResolvedValue(undefined);
  const charts = vi.spyOn(made.view, "_drawChart").mockImplementation(() => {});
  const sections = vi.spyOn(made.view, "_dashCardSection").mockImplementation(() => {});
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path);
  return { ...made, root, rendered, created, modes, charts, sections, file };
}

const deal = (name: string, frontmatter: Record<string, unknown>, mtime?: number): MockFileSpec => ({ path: `Cadence/Pipeline/${name}.md`, frontmatter, mtime });
const A = deal("A", { title: "Acme", stage: "Proposal", value: 12000 }, NOW - 20 * DAY);
const B = deal("B", { stage: ["Won"], value: "4500" }, NOW - DAY);
const C = deal("C", { title: "Cee", stage: "Lost", value: 1000 }, NOW - 40 * DAY);
const D = deal("D", { title: "Dee", stage: "won", value: 300 });
const E = deal("E", { title: "Eee", stage: "", value: "abc" }, NOW - 15 * DAY);
const F = deal("F", { title: "Fff", stage: "Negotiation", value: 7000 }, NOW - 30 * DAY);
const DEALS = [A, B, C, D, E, F];

const activity = (name: string, frontmatter: Record<string, unknown>): MockFileSpec => ({ path: `Cadence/Activities/${name}.md`, frontmatter });
const ACT1 = activity("Act1", { subject: "Call Jane", type: "Call", with: "[[Jane]]", when: "2026-10-01" });
const ACT2 = activity("Act2", { type: "Email", when: "2026-10-05" });
const ACT3 = activity("Act3", { subject: "Undated" });
const OTHERS: MockFileSpec[] = [
  { path: "Cadence/Contacts/Jane.md", frontmatter: { name: "Jane" } },
  { path: "Cadence/Contacts/Bob.md", frontmatter: { name: "Bob" } },
  { path: "Cadence/Companies/Acme Corp.md", frontmatter: { name: "Acme Corp" } },
];
const ALL = [...DEALS, ACT1, ACT2, ACT3, ...OTHERS];

const cur = (n: number) => fmtValue(n, "currency");
const headerTexts = (root: FakeElement) => root.children[0].children[0].children.map((c) => c.text);
const stats = (root: FakeElement) => root.children[1].children.map((c) => [c.dataset.accent, ...c.children.map((x) => x.text)]);
const stageRows = (root: FakeElement) => root.children[3].children;
const cols = (root: FakeElement) => root.children[4];
const analyticsHeader = (root: FakeElement) => root.children[5];
const widgetsGrid = (root: FakeElement) => root.children[6];
const section = (sections: Any, title: string) => sections.mock.calls.find((c: Any[]) => String(c[1]).startsWith(title));

describe("renderDashboard: header and stats", () => {
  it("adds the dashboard class and renders the header with + New Deal", async () => {
    const { view, root, created } = setup(ALL);
    await view.renderDashboard(root);
    expect(root.classes).toEqual(["cadence-dashboard"]);
    expect(headerTexts(root)).toEqual(["CADENCE", "CRM Dashboard", "Pipeline · momentum · recent activity"]);
    const [btn] = root.children[0].children[1].children;
    expect([btn.text, btn.classes]).toEqual(["+ New Deal", ["cad-btn", "primary"]]);
    btn.trigger("click");
    expect(created.mock.calls).toEqual([["deal"]]);
  });

  it("lays out stats, the stage bars, two columns, the analytics header and the widgets grid", async () => {
    const { view, root } = setup(ALL);
    await view.renderDashboard(root);
    expect(root.children.map((c) => [c.classes, c.text])).toEqual([
      [["cad-page-header"], ""],
      [["cad-stat-grid"], ""],
      [["cad-section-label-lg"], "PIPELINE BY STAGE"],
      [["cad-stage-bars"], ""],
      [["cad-dash-cols"], ""],
      [[], ""],
      [["cad-dash-cols"], ""],
    ]);
  });

  it("QUIRK: Won and Lost match case-sensitively, so 'won' and a blank stage count as open pipeline", async () => {
    const { view, root } = setup(ALL);
    await view.renderDashboard(root);
    expect(stats(root)).toEqual([
      ["sky", "OPEN PIPELINE", "4", cur(19300)],
      ["emerald", "WON", "1", cur(4500)],
      ["rose", "LOST", "1", cur(1000)],
      ["mint", "WIN RATE", "50%", "1/2 closed"],
      ["warn", "AVG DEAL", cur(4500), "1 won deals"],
    ]);
  });

  it("rounds the win rate and averages over won deals only", async () => {
    const files = [
      deal("W1", { stage: "Won", value: 100 }),
      deal("W2", { stage: "Won", value: 250 }),
      deal("L1", { stage: "Lost", value: 9000 }),
    ];
    const { view, root } = setup(files);
    await view.renderDashboard(root);
    expect(stats(root).slice(3)).toEqual([
      ["mint", "WIN RATE", "67%", "2/3 closed"],
      ["warn", "AVG DEAL", cur(175), "2 won deals"],
    ]);
  });

  it("shows zeros with no deals", async () => {
    const { view, root } = setup();
    await view.renderDashboard(root);
    expect(stats(root)).toEqual([
      ["sky", "OPEN PIPELINE", "0", cur(0)],
      ["emerald", "WON", "0", cur(0)],
      ["rose", "LOST", "0", cur(0)],
      ["mint", "WIN RATE", "0%", "0/0 closed"],
      ["warn", "AVG DEAL", cur(0), "0 won deals"],
    ]);
  });
});

describe("renderDashboard: pipeline by stage", () => {
  it("draws one bar per deal stage, its count and value, scaled to the largest", async () => {
    const { view, root } = setup(ALL);
    await view.renderDashboard(root);
    expect(stageRows(root).map((r) => [r.dataset.stage, r.children[0].text, r.children[1].text, r.children[2].children[0].style.width, r.children[3].text])).toEqual([
      ["Lead", "Lead", "0", "0%", cur(0)],
      ["Qualified", "Qualified", "0", "0%", cur(0)],
      ["Proposal", "Proposal", "1", "100%", cur(12000)],
      ["Negotiation", "Negotiation", "1", `${(7000 / 12000) * 100}%`, cur(7000)],
      ["Won", "Won", "1", `${(4500 / 12000) * 100}%`, cur(4500)],
      ["Lost", "Lost", "1", `${(1000 / 12000) * 100}%`, cur(1000)],
    ]);
  });

  it("QUIRK: a deal whose stage is off the list ('won', blank) is in no bar", async () => {
    const { view, root } = setup(ALL);
    await view.renderDashboard(root);
    const counted = stageRows(root).reduce((n, r) => n + Number(r.children[1].text), 0);
    expect(counted).toBe(4);
  });

  it("scales against at least 1, so all-zero values draw empty bars", async () => {
    const { view, root } = setup([deal("Z", { stage: "Lead", value: 0 })]);
    await view.renderDashboard(root);
    expect(stageRows(root)[0].children[2].children[0].style.width).toBe("0%");
  });

  it("follows the deal def's stage options", async () => {
    const field = ENTITIES.deal.fields.find((f) => f.key === "stage")!;
    const saved = field.options;
    field.options = ["Open", "Won"];
    try {
      const { view, root } = setup([deal("O", { stage: "Open", value: 5 })]);
      await view.renderDashboard(root);
      expect(stageRows(root).map((r) => [r.dataset.stage, r.children[1].text])).toEqual([["Open", "1"], ["Won", "0"]]);
    } finally {
      field.options = saved;
    }
  });

  it("QUIRK: clicking any stage bar opens the Pipeline, not that stage", async () => {
    const { view, root, modes } = setup(ALL);
    await view.renderDashboard(root);
    stageRows(root)[4].trigger("click");
    expect(modes.mock.calls).toEqual([["crm.pipeline"]]);
  });
});

describe("renderDashboard: deal and activity cards", () => {
  it("hot deals: the top 5 open deals by value, with stage and value", async () => {
    const { view, root, sections, file } = setup(ALL);
    await view.renderDashboard(root);
    const [parent, title, rows, empty] = section(sections, "HOT DEALS");
    expect(parent).toBe(cols(root).children[0]);
    expect(title).toBe("HOT DEALS · top 5 by value");
    expect(empty).toBe("No open deals yet — hit + New Deal above.");
    expect(rows).toEqual([
      { title: "Acme", meta: `Proposal · ${cur(12000)}`, file: file("Cadence/Pipeline/A.md") },
      { title: "Fff", meta: `Negotiation · ${cur(7000)}`, file: file("Cadence/Pipeline/F.md") },
      { title: "Dee", meta: `won · ${cur(300)}`, file: file("Cadence/Pipeline/D.md") },
      { title: "Eee", meta: `— · ${cur(0)}`, file: file("Cadence/Pipeline/E.md") },
    ]);
  });

  it("hot deals stop at five", async () => {
    const files = [1, 2, 3, 4, 5, 6].map((n) => deal(`H${n}`, { stage: "Lead", value: n }));
    const { view, root, sections } = setup(files);
    await view.renderDashboard(root);
    expect(section(sections, "HOT DEALS")[2].map((r: Any) => r.title)).toEqual(["H6", "H5", "H4", "H3", "H2"]);
  });

  it("stale deals: open deals not modified for 14+ days, oldest first, with days quiet", async () => {
    const { view, root, sections, file } = setup(ALL);
    await view.renderDashboard(root);
    const [parent, title, rows, empty] = section(sections, "STALE DEALS");
    expect(parent).toBe(cols(root).children[0]);
    expect(title).toBe("STALE DEALS · 14+ days no edits");
    expect(empty).toBe("No stale deals — momentum is good.");
    expect(rows).toEqual([
      { title: "Fff", meta: `Negotiation · 30d quiet · ${cur(7000)}`, file: file("Cadence/Pipeline/F.md") },
      { title: "Acme", meta: `Proposal · 20d quiet · ${cur(12000)}`, file: file("Cadence/Pipeline/A.md") },
      { title: "Eee", meta: `— · 15d quiet · ${cur(0)}`, file: file("Cadence/Pipeline/E.md") },
    ]);
  });

  it("stale deals skip a deal with no file stat and stop at five; exactly 14 days is not stale", async () => {
    const files = [
      ...[20, 21, 22, 23, 24, 25].map((d) => deal(`S${d}`, { stage: "Lead" }, NOW - d * DAY)),
      deal("Edge", { stage: "Lead" }, NOW - 14 * DAY),
      deal("NoStat", { stage: "Lead" }),
    ];
    const { view, root, sections } = setup(files);
    await view.renderDashboard(root);
    expect(section(sections, "STALE DEALS")[2].map((r: Any) => r.title)).toEqual(["S25", "S24", "S23", "S22", "S21"]);
  });

  it("stale deals: exactly 14 days or 13.5 days quiet is not stale, and days quiet round to the nearest day", async () => {
    const files = [
      deal("Exact", { title: "Exact", stage: "Lead" }, NOW - 14 * DAY),
      deal("Recent", { title: "Recent", stage: "Lead" }, NOW - 13.5 * DAY),
      deal("Old", { title: "Old", stage: "Lead" }, NOW - 20.6 * DAY),
    ];
    const { view, root, sections } = setup(files);
    await view.renderDashboard(root);
    expect(section(sections, "STALE DEALS")[2].map((r: Any) => r.meta)).toEqual([`Lead · 21d quiet · ${cur(0)}`]);
  });

  it("recent activity: newest first by when, undated last, with the total in the title", async () => {
    const { view, root, sections, file } = setup(ALL);
    await view.renderDashboard(root);
    const [parent, title, rows, empty] = section(sections, "RECENT ACTIVITY");
    expect(parent).toBe(cols(root).children[1]);
    expect(title).toBe("RECENT ACTIVITY · 3 total");
    expect(empty).toBe("No activity logged yet. Capture a call or meeting under CRM > Activities.");
    expect(rows).toEqual([
      {
        title: "Act2",
        metaParts: [{ text: "Email" }, { text: " · " }, { text: "—", entityKey: "contact" }, { text: ` · ${fmtValue("2026-10-05", "date")}` }],
        file: file("Cadence/Activities/Act2.md"),
      },
      {
        title: "Call Jane",
        metaParts: [{ text: "Call" }, { text: " · " }, { text: "[[Jane]]", entityKey: "contact" }, { text: ` · ${fmtValue("2026-10-01", "date")}` }],
        file: file("Cadence/Activities/Act1.md"),
      },
      {
        title: "Undated",
        metaParts: [{ text: "—" }, { text: " · " }, { text: "—", entityKey: "contact" }, { text: ` · ${fmtValue("", "date")}` }],
        file: file("Cadence/Activities/Act3.md"),
      },
    ]);
  });

  it("recent activity stops at six", async () => {
    const files = [1, 2, 3, 4, 5, 6, 7].map((n) => activity(`R${n}`, { subject: `R${n}`, when: `2026-10-0${n}` }));
    const { view, root, sections } = setup(files);
    await view.renderDashboard(root);
    expect(section(sections, "RECENT ACTIVITY")[2].map((r: Any) => r.title)).toEqual(["R7", "R6", "R5", "R4", "R3", "R2"]);
  });

  it("the customer base card counts contacts, companies and partners, each clicking through", async () => {
    const files = [...OTHERS, { path: "Cadence/Partners/P.md", frontmatter: { name: "P" } }];
    const { view, root, modes } = setup(files);
    await view.renderDashboard(root);
    const base = cols(root).children[1].children[0];
    expect(base.classes).toEqual(["cad-dash-card"]);
    expect(base.children[0].children[0].text).toBe("CUSTOMER BASE · 4 records");
    const minis = base.children[1].children;
    expect(base.children[1].classes).toEqual(["cad-dash-card-body", "cad-mini-stat-row"]);
    expect(minis.map((m) => [m.dataset.accent, m.children[0].text, m.children[1].text, m.style.cursor])).toEqual([
      ["warn", "2", "CONTACTS", "pointer"],
      ["sky", "1", "COMPANIES", "pointer"],
      ["rose", "1", "PARTNERS", "pointer"],
    ]);
    minis.forEach((m) => m.trigger("click"));
    expect(modes.mock.calls).toEqual([["crm.contacts"], ["crm.companies"], ["prm.partners"]]);
  });

  it("draws the cards into the real dash card component", async () => {
    const { view, root, sections } = setup(ALL);
    sections.mockRestore();
    await view.renderDashboard(root);
    const left = cols(root).children[0];
    expect(left.children.map((c) => c.children[0].children[0].text)).toEqual(["HOT DEALS · top 5 by value", "STALE DEALS · 14+ days no edits"]);
  });
});

describe("renderDashboard: custom chart widgets", () => {
  const W1 = { id: "widget.1", title: "By stage", groupBy: "stage", style: "list" };
  const W2 = { id: "widget.2", title: "Companies", groupBy: "company", style: "kpi" };

  it("shows the analytics header and an empty prompt with no crmDashboardWidgets", async () => {
    const { view, root, charts } = setup(ALL);
    await view.renderDashboard(root);
    const [label, add] = analyticsHeader(root).children;
    expect([label.text, add.text]).toEqual(["ANALYTICS & CHARTS", "+ Add Custom Chart"]);
    expect(widgetsGrid(root).children[0].children[0].text).toBe('No custom charts added yet. Click "+ Add Custom Chart" to create one!');
    expect(charts).not.toHaveBeenCalled();
  });

  it("counts deals by each widget's groupBy (a stage list counts its first item)", async () => {
    const files = [...DEALS, deal("G", { stage: "Lead", company: ["[[Acme Corp]]", "Globex"] })];
    const { view, root, charts } = setup(files, { crmDashboardWidgets: [W1, W2] });
    await view.renderDashboard(root);
    expect(widgetsGrid(root).children.map((c) => c.children[0].children[0].text)).toEqual(["BY STAGE", "COMPANIES"]);
    expect(charts.mock.calls.map((c) => [(c[0] as Any).parent === widgetsGrid(root).children[charts.mock.calls.indexOf(c)].children[1], c[1], c[2]])).toEqual([
      [true, "list", [
        { label: "Proposal", count: 1 },
        { label: "Won", count: 1 },
        { label: "Lost", count: 1 },
        { label: "won", count: 1 },
        { label: "Unspecified", count: 1 },
        { label: "Negotiation", count: 1 },
        { label: "Lead", count: 1 },
      ]],
      [true, "kpi", [{ label: "Unspecified", count: 6 }, { label: "Acme Corp", count: 1 }, { label: "Globex", count: 1 }]],
    ]);
  });

  it("reads the groupBy through entityValue with the deal def: 'title' falls back to the basename, 'type' to 'deal'", async () => {
    const files = [deal("A", { stage: "Lead" }), deal("B", { title: "Bee" })];
    const { view, root, charts } = setup(files, {
      crmDashboardWidgets: [{ ...W1, groupBy: "title" }, { ...W1, id: "w.t", groupBy: "type" }],
    });
    await view.renderDashboard(root);
    expect(charts.mock.calls.map((c) => c[2])).toEqual([
      [{ label: "A", count: 1 }, { label: "Bee", count: 1 }],
      [{ label: "deal", count: 2 }],
    ]);
  });

  it("changing the style saves and re-renders; × deletes after confirm()", async () => {
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal("confirm", confirm);
    const widgets = [{ ...W1 }, { ...W2 }];
    const { view, root, plugin, rendered } = setup(ALL, { crmDashboardWidgets: widgets });
    await view.renderDashboard(root);
    const [select, del] = widgetsGrid(root).children[1].children[0].children[1].children;
    expect(select.options.map((o) => [o.value, o.selected])).toEqual([["donut", false], ["bar", false], ["kpi", true], ["list", false]]);
    select.value = "donut";
    select.trigger("change");
    await flush();
    expect(widgets[1].style).toBe("donut");
    del.trigger("click");
    await flush();
    expect(confirm.mock.calls).toEqual([['Delete chart "Companies"?']]);
    expect(plugin.settings.crmDashboardWidgets).toEqual([W1]);
    expect(plugin.saves).toBe(2);
    expect(rendered).toHaveBeenCalledTimes(2);
  });

  it("+ Add Custom Chart opens the widget modal for deals; its result is appended, saved and rendered", async () => {
    const open = vi.spyOn(CadenceWidgetCreateModal.prototype, "open").mockImplementation(() => {});
    const { view, root, plugin, rendered } = setup(ALL);
    await view.renderDashboard(root);
    analyticsHeader(root).children[1].trigger("click");
    const modal = open.mock.contexts[0] as Any;
    expect(modal.entityKey).toBe("deal");
    await modal.onSubmit(W1);
    await modal.onSubmit(W2);
    expect(plugin.settings.crmDashboardWidgets).toEqual([W1, W2]);
    expect(plugin.saves).toBe(2);
    expect(rendered).toHaveBeenCalledTimes(2);
  });
});
