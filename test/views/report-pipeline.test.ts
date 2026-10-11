import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeElement, type MockFileSpec } from "../mocks/obsidian";
import { makeAppView } from "../helpers/app-view";
import { ENTITIES } from "../../src/constants/entities";
import { fmtValue } from "../../src/utils/format";

/* Characterization tests for the Pipeline report, renderReportPipeline:
   the five stat cards (open, weighted forecast, won, lost, win rate), the
   by-stage table, the open pipeline by owner, the aging cohorts by file
   mtime, and the stale-deal list. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 11, 12);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup(files: MockFileSpec[] = [], settings: Record<string, unknown> = {}) {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  const made = makeAppView({ files, settings });
  made.view.mode = "reports.pipeline";
  const root = new FakeElement("div");
  const sections = vi.spyOn(made.view, "_dashCardSection").mockImplementation(() => {});
  return { ...made, root, sections };
}

const deal = (name: string, frontmatter: Record<string, unknown>, mtime?: number): MockFileSpec => ({ path: `Cadence/Pipeline/${name}.md`, frontmatter, mtime });
const A = deal("A", { title: "Alpha", stage: "Lead", value: 1000, owner: "[[Jane]]" }, NOW - 2 * DAY);
const B = deal("B", { title: "Bravo", stage: "Qualified", value: "2000", owner: "Jane" }, NOW - 10 * DAY);
const C = deal("C", { title: "Charlie", stage: ["Proposal"], value: 4000 }, NOW - 40 * DAY);
const D = deal("D", { stage: "Negotiation", value: 8000, owner: "Bob" }, NOW - 100 * DAY);
const E = deal("E", { title: "Echo", stage: "Won", value: 5000, owner: "Jane" }, NOW - 50 * DAY);
const F = deal("F", { title: "Fox", stage: "Lost", value: 3000 }, NOW - 60 * DAY);
const G = deal("G", { title: "Golf", stage: "won", value: 700 }, NOW - 7 * DAY);
const H = deal("H", { title: "Hotel", stage: "Custom", value: "abc" });
const DEALS = [A, B, C, D, E, F, G, H];

const cur = (n: number) => fmtValue(n, "currency");
const headerTexts = (root: FakeElement) => root.children[0].children[0].children.map((c) => c.text);
const stats = (root: FakeElement) => root.children[1].children.map((c) => [c.dataset.accent, ...c.children.map((x) => x.text)]);
const tableRows = (root: FakeElement) => root.children[3].children[0].children[1].children.map((tr) => tr.children.map((td) => td.text));
const right = (root: FakeElement) => root.children[4].children[1];
const aging = (root: FakeElement) => right(root).children[0].children[1].children.map((m) => [m.dataset.accent, m.children[0].text, m.children[1].text, m.children[2].text, m.children[2].style.marginTop]);
const section = (sections: Any, title: string) => sections.mock.calls.find((c: Any[]) => String(c[1]).startsWith(title));

describe("renderReportPipeline: layout and stats", () => {
  it("adds the report class, renders the header and lays out stats, table and two columns", async () => {
    const { view, root } = setup(DEALS);
    await view.renderReportPipeline(root);
    expect(root.classes).toEqual(["cadence-report"]);
    expect(headerTexts(root)).toEqual(["CADENCE", "Pipeline report", "Coverage, forecast and aging across all deals"]);
    expect(root.children.map((c) => [c.classes, c.text])).toEqual([
      [["cad-page-header"], ""],
      [["cad-stat-grid"], ""],
      [["cad-section-label-lg"], "BY STAGE"],
      [["cad-table-wrap"], ""],
      [["cad-dash-cols"], ""],
    ]);
    expect(root.children[4].children.map((c) => c.classes)).toEqual([["cad-dash-col"], ["cad-dash-col"]]);
  });

  it("Won and Lost match in any case, so 'won' is won; an off-list stage is open", async () => {
    const { view, root } = setup(DEALS);
    await view.renderReportPipeline(root);
    expect(stats(root)).toEqual([
      ["sky", "OPEN", "5", cur(15000)],
      ["mint", "WEIGHTED", cur(8600), "forecast on open"],
      ["emerald", "WON", "2", cur(5700)],
      ["rose", "LOST", "1", cur(3000)],
      ["warn", "WIN RATE", "67%", "2/3 closed"],
    ]);
  });

  it("rounds the win rate", async () => {
    const files = [deal("W1", { stage: "Won" }), deal("W2", { stage: "Won" }), deal("L1", { stage: "Lost" })];
    const { view, root } = setup(files);
    await view.renderReportPipeline(root);
    expect(stats(root)[4]).toEqual(["warn", "WIN RATE", "67%", "2/3 closed"]);
  });

  it("shows zeros with no deals", async () => {
    const { view, root } = setup();
    await view.renderReportPipeline(root);
    expect(stats(root)).toEqual([
      ["sky", "OPEN", "0", cur(0)],
      ["mint", "WEIGHTED", cur(0), "forecast on open"],
      ["emerald", "WON", "0", cur(0)],
      ["rose", "LOST", "0", cur(0)],
      ["warn", "WIN RATE", "0%", "0/0 closed"],
    ]);
  });
});

describe("renderReportPipeline: by stage", () => {
  it("draws a Stage/Count/Value table with one row per deal stage", async () => {
    const { view, root } = setup(DEALS);
    await view.renderReportPipeline(root);
    const table = root.children[3].children[0];
    expect([table.localName, table.classes]).toEqual(["table", ["cad-table"]]);
    expect(table.children[0].children[0].children.map((th) => [th.localName, th.text])).toEqual([["th", "Stage"], ["th", "Count"], ["th", "Value"]]);
    expect(tableRows(root)).toEqual([
      ["Lead", "1", cur(1000)],
      ["Qualified", "1", cur(2000)],
      ["Proposal", "1", cur(4000)],
      ["Negotiation", "1", cur(8000)],
      ["Won", "2", cur(5700)],
      ["Lost", "1", cur(3000)],
      ["Custom", "1", cur(0)],
    ]);
  });

  it("puts every deal in one row: 'won' in Won, a stage off the list ('Custom') in its own row", async () => {
    const { view, root } = setup([G, H]);
    await view.renderReportPipeline(root);
    expect(tableRows(root).map((r) => r[0] + ":" + r[1])).toEqual(["Lead:0", "Qualified:0", "Proposal:0", "Negotiation:0", "Won:1", "Lost:0", "Custom:1"]);
  });

  it("weighs a custom configured stage between its built-in neighbours, and a built-in stage in any case", async () => {
    const field = ENTITIES.deal.fields.find((f) => f.key === "stage")!;
    const original = field.options;
    field.options = ["Discovery", "Lead", "Demo", "Negotiation", "Won", "Lost"];
    try {
      const files = [
        deal("X", { stage: "Discovery", value: 1000 }),
        deal("Y", { stage: "Demo", value: 1000 }),
        deal("Z", { stage: "negotiation", value: 1000 }),
        deal("Q", { stage: "Elsewhere", value: 1000 }),
      ];
      const { view, root } = setup(files);
      await view.renderReportPipeline(root);
      // Discovery sits halfway from 0 to Lead (0.10), Demo halfway from Lead to Negotiation (0.75); off the list weighs 0.
      expect(stats(root)[1]).toEqual(["mint", "WEIGHTED", cur(1000 * 0.05 + 1000 * 0.425 + 1000 * 0.75), "forecast on open"]);
    } finally {
      field.options = original;
    }
  });

  it("follows the configured deal stages", async () => {
    const field = ENTITIES.deal.fields.find((f) => f.key === "stage")!;
    const original = field.options;
    field.options = ["Discovery", "Lead"];
    try {
      const { view, root } = setup([deal("X", { stage: "Discovery", value: 50 }), A]);
      await view.renderReportPipeline(root);
      expect(tableRows(root)).toEqual([["Discovery", "1", cur(50)], ["Lead", "1", cur(1000)]]);
    } finally {
      field.options = original;
    }
  });
});

describe("renderReportPipeline: by owner", () => {
  it("groups open deals by owner string, sorts by value and links owners to contacts", async () => {
    const { view, root, sections } = setup(DEALS);
    await view.renderReportPipeline(root);
    const [parent, title, rows, empty] = section(sections, "OPEN PIPELINE BY OWNER");
    expect(parent).toBe(root.children[4].children[0]);
    expect(title).toBe("OPEN PIPELINE BY OWNER · top 4");
    expect(rows).toEqual([
      { title: "Bob", titleEntityKey: "contact", meta: `1 deal · ${cur(8000)}` },
      { title: "(unassigned)", titleEntityKey: null, meta: `2 deals · ${cur(4000)}` },
      { title: "Jane", titleEntityKey: "contact", meta: `1 deal · ${cur(2000)}` },
      { title: "[[Jane]]", titleEntityKey: "contact", meta: `1 deal · ${cur(1000)}` },
    ]);
    expect(empty).toBe("No open deals to attribute.");
  });

  it("QUIRK: an owner list is joined into one owner string", async () => {
    const { view, root, sections } = setup([deal("X", { stage: "Lead", value: 1, owner: ["Ann", "Bo"] })]);
    await view.renderReportPipeline(root);
    expect(section(sections, "OPEN PIPELINE BY OWNER")[2].map((r: Any) => r.title)).toEqual(["Ann,Bo"]);
  });

  it("keeps the top 8 owners and says so in the title", async () => {
    const files = Array.from({ length: 10 }, (_, i) => deal(`O${i}`, { stage: "Lead", value: i * 10, owner: `Owner ${i}` }));
    const { view, root, sections } = setup(files);
    await view.renderReportPipeline(root);
    const [, title, rows] = section(sections, "OPEN PIPELINE BY OWNER");
    expect(title).toBe("OPEN PIPELINE BY OWNER · top 8");
    expect(rows.map((r: Any) => r.title)).toEqual(["Owner 9", "Owner 8", "Owner 7", "Owner 6", "Owner 5", "Owner 4", "Owner 3", "Owner 2"]);
  });

  it("passes no rows and 'top 0' with no open deals", async () => {
    const { view, root, sections } = setup([E, F]);
    await view.renderReportPipeline(root);
    expect(section(sections, "OPEN PIPELINE BY OWNER").slice(1, 3)).toEqual(["OPEN PIPELINE BY OWNER · top 0", []]);
  });
});

describe("renderReportPipeline: aging and stale", () => {
  it("buckets open deals by days since last edit; exactly 7 days is 0–7 and a deal with no stat is 0 days old", async () => {
    const { view, root } = setup(DEALS);
    await view.renderReportPipeline(root);
    const card = right(root).children[0];
    expect(card.classes).toEqual(["cad-dash-card"]);
    expect(card.children[0].children[0].text).toBe("AGING · OPEN DEALS BY LAST EDIT");
    expect(card.children[1].classes).toEqual(["cad-dash-card-body", "cad-mini-stat-row"]);
    expect(aging(root)).toEqual([
      ["emerald", "2", "0–7 DAYS", cur(1000), "4px"],
      ["mint", "1", "8–30 DAYS", cur(2000), "4px"],
      ["warn", "1", "31–90 DAYS", cur(4000), "4px"],
      ["rose", "1", "90+ DAYS", cur(8000), "4px"],
    ]);
  });

  it("puts a fraction of a day past a cutoff in the next cohort, and a future mtime in 0–7", async () => {
    const files = [
      deal("X", { stage: "Lead", value: 1 }, NOW - 7 * DAY - 1),
      deal("Y", { stage: "Lead", value: 2 }, NOW - 30 * DAY - 1),
      deal("Z", { stage: "Lead", value: 4 }, NOW + 5 * DAY),
    ];
    const { view, root } = setup(files);
    await view.renderReportPipeline(root);
    expect(aging(root).map((a) => [a[1], a[3]])).toEqual([["1", cur(4)], ["1", cur(1)], ["1", cur(2)], ["0", cur(0)]]);
  });

  it("lists up to 5 open deals quiet for over 30 days, oldest first", async () => {
    const { view, root, sections, app } = setup(DEALS);
    await view.renderReportPipeline(root);
    const [parent, title, rows, empty] = section(sections, "STALE");
    expect(parent).toBe(right(root));
    expect(title).toBe("STALE · 30+ DAYS NO EDITS");
    expect(rows).toEqual([
      { title: "D", meta: `Negotiation · 100d quiet · ${cur(8000)}`, file: app.vault.getAbstractFileByPath("Cadence/Pipeline/D.md") },
      { title: "Charlie", meta: `Proposal · 40d quiet · ${cur(4000)}`, file: app.vault.getAbstractFileByPath("Cadence/Pipeline/C.md") },
    ]);
    expect(empty).toBe("No deals over 30 days quiet — nice.");
  });

  it("caps the stale list at 5, rounds the days and shows a blank stage as —", async () => {
    const files = Array.from({ length: 7 }, (_, i) => deal(`S${i}`, { stage: "", value: 1 }, NOW - (31 + i) * DAY - DAY / 2));
    const { view, root, sections } = setup(files);
    await view.renderReportPipeline(root);
    expect(section(sections, "STALE")[2].map((r: Any) => [r.title, r.meta])).toEqual([
      ["S6", `— · 38d quiet · ${cur(1)}`],
      ["S5", `— · 37d quiet · ${cur(1)}`],
      ["S4", `— · 36d quiet · ${cur(1)}`],
      ["S3", `— · 35d quiet · ${cur(1)}`],
      ["S2", `— · 34d quiet · ${cur(1)}`],
    ]);
  });

  it("calls the owner card, then the stale card", async () => {
    const { view, root, sections } = setup(DEALS);
    await view.renderReportPipeline(root);
    expect(sections.mock.calls.map((c: Any[]) => c[1])).toEqual(["OPEN PIPELINE BY OWNER · top 4", "STALE · 30+ DAYS NO EDITS"]);
  });
});
