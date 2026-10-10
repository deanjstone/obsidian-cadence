import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeElement, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";
import { CadenceWidgetCreateModal } from "../../src/modals/widget-create";
import { fmtValue, pctBand } from "../../src/utils/format";

/* Characterization tests for PRM analytics, renderPRMAnalytics: the four
   stat cards (partners, sourced deals, partner revenue, partner share),
   partners by tier with their won revenue, the top partners by won revenue,
   the partner funnel, the sourced → won conversion bar, and the custom chart
   widgets over the partners. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(files: MockFileSpec[] = [], settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files, settings });
  made.view.mode = "prm.analytics";
  const root = new FakeElement("div");
  const rendered = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
  const charts = vi.spyOn(made.view, "_drawChart").mockImplementation(() => {});
  const sections = vi.spyOn(made.view, "_dashCardSection").mockImplementation(() => {});
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path);
  return { ...made, root, rendered, charts, sections, file };
}

const partner = (name: string, frontmatter: Record<string, unknown> = {}): MockFileSpec => ({ path: `Cadence/Partners/${name}.md`, frontmatter });
const deal = (name: string, frontmatter: Record<string, unknown>): MockFileSpec => ({ path: `Cadence/Pipeline/${name}.md`, frontmatter });

const PARTNERS = [
  partner("Acme", { tier: "Gold", region: "EMEA" }),
  partner("Beta", { name: "Beta Ltd", tier: "Silver", region: ["[[EMEA]]", "APAC"] }),
  partner("Gamma", { tier: "Gold" }),
  partner("Delta"),
  partner("Eps", { tier: "Platinum", region: "" }),
];
const DEALS = [
  deal("D1", { stage: "Won", value: 1000, partner: "Acme" }),
  deal("D2", { stage: ["Won"], value: "2500", partner: "Beta Ltd" }),
  deal("D3", { stage: "Won", value: 400, partner: "[[Acme]]" }),
  deal("D4", { stage: "Lead", value: 300, partner: "Acme" }),
  deal("D5", { stage: "Lost", value: 200, partner: "Beta Ltd" }),
  deal("D6", { stage: "won", value: 50, partner: "Acme" }),
  deal("D7", { stage: "Won", value: 5000 }),
  deal("D8", { stage: "Lead", value: 100, partner: "" }),
  deal("D9", { stage: "Won", value: 70, partner: ["Acme"] }),
  deal("D10", { stage: "Proposal", value: "abc", partner: "Gamma" }),
];
const ALL = [...PARTNERS, ...DEALS];

const cur = (n: number) => fmtValue(n, "currency");
const headerTexts = (root: FakeElement) => root.children[0].children[0].children.map((c) => c.text);
const stats = (root: FakeElement) => root.children[1].children.map((c) => [c.dataset.accent, ...c.children.map((x) => x.text)]);
const miniStats = (row: FakeElement) => row.children.map((m) => [m.dataset.accent, ...m.children.map((c) => c.text), m.children[2].style.marginTop]);
const tail = (root: FakeElement, i: number) => root.children[root.children.length - i];
const cols = (root: FakeElement) => tail(root, 3);
const analyticsHeader = (root: FakeElement) => tail(root, 2);
const widgetsGrid = (root: FakeElement) => tail(root, 1);
const funnelCard = (root: FakeElement) => cols(root).children[1].children[0];
const convCard = (root: FakeElement) => cols(root).children[1].children[1];

describe("renderPRMAnalytics: layout and stats", () => {
  it("adds the report class, renders the header and lays out stats, tiers, two columns and the widgets", async () => {
    const { view, root } = setup(ALL);
    await view.renderPRMAnalytics(root);
    expect(root.classes).toEqual(["cadence-report"]);
    expect(headerTexts(root)).toEqual(["CADENCE", "PRM analytics", "Partner programme health, tier mix and revenue contribution"]);
    expect(root.children.map((c) => [c.classes, c.text])).toEqual([
      [["cad-page-header"], ""],
      [["cad-stat-grid"], ""],
      [["cad-section-label-lg"], "PARTNERS BY TIER"],
      [["cad-dash-card"], ""],
      [["cad-dash-cols"], ""],
      [[], ""],
      [["cad-dash-cols"], ""],
    ]);
    expect(cols(root).children.map((c) => c.classes)).toEqual([["cad-dash-col"], ["cad-dash-col"]]);
  });

  it("counts partners, partner-sourced deals and won revenue, and the sourced share of all deal value", async () => {
    const { view, root } = setup(ALL);
    await view.renderPRMAnalytics(root);
    // Sourced: D1–D6, D9, D10 (any partner value). Won: D1, D2, D3, D9. Total: sourced + D7 + D8.
    expect(stats(root)).toEqual([
      ["sky", "PARTNERS", "5", "on the books"],
      ["mint", "SOURCED DEALS", "8", cur(4520)],
      ["emerald", "PARTNER REVENUE", cur(3970), "4 won"],
      ["warn", "PARTNER SHARE", "47%", "of total pipeline value"],
    ]);
  });

  it("shows zeros, 0% share and no tier section with no partners or deals", async () => {
    const { view, root } = setup([]);
    await view.renderPRMAnalytics(root);
    expect(stats(root)).toEqual([
      ["sky", "PARTNERS", "0", "on the books"],
      ["mint", "SOURCED DEALS", "0", cur(0)],
      ["emerald", "PARTNER REVENUE", cur(0), "0 won"],
      ["warn", "PARTNER SHARE", "0%", "of total pipeline value"],
    ]);
    expect(root.children.map((c) => c.classes)).toEqual([["cad-page-header"], ["cad-stat-grid"], ["cad-dash-cols"], [], ["cad-dash-cols"]]);
  });

  it("rounds the share to a whole percent", async () => {
    const files = [deal("A", { value: 1, partner: "X" }), deal("B", { value: 2 })];
    const { view, root } = setup(files);
    await view.renderPRMAnalytics(root);
    expect(stats(root)[3][2]).toBe("33%");
  });
});

describe("renderPRMAnalytics: partners by tier", () => {
  it("counts partners per tier, most first, with each tier's won revenue from deals naming a partner exactly", async () => {
    const { view, root } = setup(ALL);
    await view.renderPRMAnalytics(root);
    const tierCard = root.children[3];
    expect(tierCard.style.margin).toBe("0 36px 18px 36px");
    const [row] = tierCard.children;
    expect(row.classes).toEqual(["cad-dash-card-body", "cad-mini-stat-row"]);
    // Gold: D1 and D9 (a one-item list reads as its item). D3's `[[Acme]]` names no partner.
    expect(miniStats(row)).toEqual([
      ["warn", "2", "GOLD", cur(1070), "4px"],
      ["sky", "1", "SILVER", cur(2500), "4px"],
      ["mint", "1", "UNTIERED", "—", "4px"],
      ["sky", "1", "PLATINUM", "—", "4px"],
    ]);
    expect(row.children.map((m) => m.classes)).toEqual(Array(4).fill(["cad-mini-stat"]));
  });

  it("matches a deal's partner to a partner's name, falling back to its file name", async () => {
    const files = [
      partner("Acme", { tier: "Bronze" }), partner("Beta", { name: "Beta Ltd", tier: "Standard" }),
      deal("A", { stage: "Won", value: 10, partner: "Acme" }), deal("B", { stage: "Won", value: 20, partner: "Beta" }),
    ];
    const { view, root } = setup(files);
    await view.renderPRMAnalytics(root);
    expect(miniStats(root.children[3].children[0])).toEqual([
      ["rose", "1", "BRONZE", cur(10), "4px"],
      ["mint", "1", "STANDARD", "—", "4px"],
    ]);
  });
});

describe("renderPRMAnalytics: top partners", () => {
  it("lists won revenue per partner value, most first, linking a row to the partner it names", async () => {
    const { view, root, sections, file } = setup(ALL);
    await view.renderPRMAnalytics(root);
    expect(sections.mock.calls).toEqual([[
      cols(root).children[0], "TOP PARTNERS · by won revenue",
      [
        { title: "Beta Ltd", meta: cur(2500), file: file("Cadence/Partners/Beta.md") },
        { title: "Acme", meta: cur(1070), file: file("Cadence/Partners/Acme.md") },
        { title: "[[Acme]]", meta: cur(400), file: null },
      ],
      "No partner-attributed wins yet.",
    ]]);
  });

  it("keeps the top 8", async () => {
    const files = Array.from({ length: 9 }, (_, i) => deal(`D${i}`, { stage: "Won", value: (i + 1) * 10, partner: `P${i}` }));
    const { view, root, sections } = setup(files);
    await view.renderPRMAnalytics(root);
    expect((sections.mock.calls[0][2] as Any[]).map((r: Any) => r.title)).toEqual(["P8", "P7", "P6", "P5", "P4", "P3", "P2", "P1"]);
  });

  it("passes an empty list with no partner wins", async () => {
    const { view, root, sections } = setup([deal("A", { stage: "Lead", value: 5, partner: "X" })]);
    await view.renderPRMAnalytics(root);
    expect(sections.mock.calls[0][2]).toEqual([]);
  });
});

describe("renderPRMAnalytics: funnel and conversion", () => {
  it("splits sourced deals into open (any stage but exactly Won or Lost), won and lost", async () => {
    const { view, root } = setup(ALL);
    await view.renderPRMAnalytics(root);
    const card = funnelCard(root);
    expect(card.classes).toEqual(["cad-dash-card"]);
    expect(card.children[0].children[0].text).toBe("PARTNER FUNNEL");
    // Open: D4, D6 (a lower-case 'won') and D10 (a non-numeric value counts 0).
    expect(miniStats(card.children[1])).toEqual([
      ["sky", "8", "SOURCED", cur(4520), "4px"],
      ["mint", "3", "OPEN", cur(350), "4px"],
      ["emerald", "4", "WON", cur(3970), "4px"],
      ["rose", "1", "LOST", cur(200), "4px"],
    ]);
  });

  it("shows won over sourced as a progress bar banded by pctBand", async () => {
    const { view, root } = setup(ALL);
    await view.renderPRMAnalytics(root);
    const card = convCard(root);
    expect(card.children[0].children[0].text).toBe("CONVERSION · sourced → won");
    const body = card.children[1];
    expect([body.classes, body.style.padding]).toEqual([["cad-dash-card-body"], "20px 16px"]);
    const wrap = body.children[0];
    expect([wrap.classes, wrap.dataset.pctBand]).toEqual([["cad-proj-progress-wrap"], pctBand(50)]);
    expect(wrap.children[0].children.map((s) => [s.classes, s.text])).toEqual([
      [[], "4/8 sourced deals won"],
      [["cad-proj-progress-pct"], "50%"],
    ]);
    expect(wrap.children[1].children[0].style.width).toBe("50%");
  });

  it("rounds the conversion, and shows 0% with nothing sourced", async () => {
    const files = [deal("A", { stage: "Won", partner: "X" }), deal("B", { partner: "X" }), deal("C", { partner: "X" })];
    const { view, root } = setup(files);
    await view.renderPRMAnalytics(root);
    expect(convCard(root).children[1].children[0].children[0].children[1].text).toBe("33%");
    const twoOfThree = setup([deal("A", { stage: "Won", partner: "X" }), deal("B", { stage: "Won", partner: "X" }), deal("C", { partner: "X" })]);
    await twoOfThree.view.renderPRMAnalytics(twoOfThree.root);
    expect(convCard(twoOfThree.root).children[1].children[0].children[0].children[1].text).toBe("67%");
    const empty = setup([]);
    await empty.view.renderPRMAnalytics(empty.root);
    const wrap = convCard(empty.root).children[1].children[0];
    expect([wrap.dataset.pctBand, wrap.children[0].children[0].text, wrap.children[1].children[0].style.width]).toEqual([
      pctBand(0), "0/0 sourced deals won", "0%",
    ]);
  });
});

describe("renderPRMAnalytics: quirks", () => {
  it("QUIRK: a deal whose partner is a wikilink names no partner, so its win adds to no tier and its row links nowhere", async () => {
    const files = [partner("Acme", { tier: "Gold" }), deal("A", { stage: "Won", value: 900, partner: "[[Acme]]" })];
    const { view, root, sections } = setup(files);
    await view.renderPRMAnalytics(root);
    expect(miniStats(root.children[3].children[0])).toEqual([["warn", "1", "GOLD", "—", "4px"]]);
    expect(sections.mock.calls[0][2]).toEqual([{ title: "[[Acme]]", meta: cur(900), file: null }]);
  });

  it("QUIRK: Won and Lost match case-sensitively, so a lower-case 'won' is open and earns no partner revenue", async () => {
    const { view, root } = setup([deal("A", { stage: "won", value: 900, partner: "X" }), deal("B", { stage: "lost", value: 1, partner: "X" })]);
    await view.renderPRMAnalytics(root);
    expect(stats(root)[2]).toEqual(["emerald", "PARTNER REVENUE", cur(0), "0 won"]);
    expect(miniStats(funnelCard(root).children[1]).map((m) => [m[2], m[1]])).toEqual([["SOURCED", "2"], ["OPEN", "2"], ["WON", "0"], ["LOST", "0"]]);
  });
});

describe("renderPRMAnalytics: custom chart widgets", () => {
  const W1 = { id: "widget.1", title: "By tier", groupBy: "tier", style: "list" };
  const W2 = { id: "widget.2", title: "Regions", groupBy: "region", style: "kpi" };

  it("shows the analytics header and an empty prompt with no prmDashboardWidgets", async () => {
    const { view, root, charts } = setup(ALL);
    await view.renderPRMAnalytics(root);
    const [label, add] = analyticsHeader(root).children;
    expect([label.text, label.classes, add.text, add.classes]).toEqual([
      "ANALYTICS & CHARTS", ["cad-section-label-lg"], "+ Add Custom Chart", ["cad-btn", "primary"],
    ]);
    expect(widgetsGrid(root).children[0].children[0].text).toBe('No custom charts added yet. Click "+ Add Custom Chart" to create one!');
    expect(charts).not.toHaveBeenCalled();
  });

  it("counts partners by each widget's groupBy: list items each, wikilinks unwrapped, blanks 'Unspecified'", async () => {
    const { view, root, charts } = setup(ALL, { prmDashboardWidgets: [W1, W2] });
    await view.renderPRMAnalytics(root);
    expect(widgetsGrid(root).children.map((c) => c.children[0].children[0].text)).toEqual(["BY TIER", "REGIONS"]);
    expect(charts.mock.calls.map((c, i) => [(c[0] as Any).parent === widgetsGrid(root).children[i].children[1], c[1], c[2]])).toEqual([
      [true, "list", [
        { label: "Gold", count: 2 },
        { label: "Silver", count: 1 },
        { label: "Unspecified", count: 1 },
        { label: "Platinum", count: 1 },
      ]],
      [true, "kpi", [{ label: "Unspecified", count: 3 }, { label: "EMEA", count: 2 }, { label: "APAC", count: 1 }]],
    ]);
  });

  it("reads the groupBy through entityValue with the partner def: 'name' falls back to the basename, 'type' to 'partner'", async () => {
    const files = [partner("A"), partner("B", { name: "Bee" })];
    const { view, root, charts } = setup(files, {
      prmDashboardWidgets: [{ ...W1, groupBy: "name" }, { ...W1, id: "w.t", groupBy: "type" }],
    });
    await view.renderPRMAnalytics(root);
    expect(charts.mock.calls.map((c) => c[2])).toEqual([
      [{ label: "A", count: 1 }, { label: "Bee", count: 1 }],
      [{ label: "partner", count: 2 }],
    ]);
  });

  it("changing the style saves and re-renders; × deletes after confirm(), and a refused confirm() keeps it", async () => {
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    vi.stubGlobal("confirm", confirm);
    const widgets = [{ ...W1 }, { ...W2 }];
    const { view, root, plugin, rendered } = setup(ALL, { prmDashboardWidgets: widgets });
    await view.renderPRMAnalytics(root);
    const [select, del] = widgetsGrid(root).children[1].children[0].children[1].children;
    expect(select.options.map((o) => [o.value, o.text, o.selected])).toEqual([
      ["donut", "🍩 Donut", false], ["bar", "📊 Bar", false], ["kpi", "🗃️ KPI Cards", true], ["list", "📋 List", false],
    ]);
    select.value = "donut";
    select.trigger("change");
    await flush();
    expect(widgets[1].style).toBe("donut");
    del.trigger("click");
    await flush();
    expect(plugin.settings.prmDashboardWidgets).toHaveLength(2);
    del.trigger("click");
    await flush();
    expect(confirm.mock.calls).toEqual([['Delete chart "Regions"?'], ['Delete chart "Regions"?']]);
    expect(plugin.settings.prmDashboardWidgets).toEqual([W1]);
    expect(plugin.saves).toBe(2);
    expect(rendered).toHaveBeenCalledTimes(2);
  });

  it("+ Add Custom Chart opens the widget modal for partners; its result is appended, saved and rendered", async () => {
    const open = vi.spyOn(CadenceWidgetCreateModal.prototype, "open").mockImplementation(() => {});
    const { view, root, plugin, rendered } = setup(ALL);
    await view.renderPRMAnalytics(root);
    analyticsHeader(root).children[1].trigger("click");
    const modal = open.mock.contexts[0] as Any;
    expect(modal.entityKey).toBe("partner");
    await modal.onSubmit(W1);
    await modal.onSubmit(W2);
    expect(plugin.settings.prmDashboardWidgets).toEqual([W1, W2]);
    expect(plugin.saves).toBe(2);
    expect(rendered).toHaveBeenCalledTimes(2);
  });
});
