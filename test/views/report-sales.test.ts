import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeElement, type MockFileSpec } from "../mocks/obsidian";
import { makeAppView } from "../helpers/app-view";
import { withTimezone, ZONES } from "../helpers/timezone";
import { fmtValue } from "../../src/utils/format";

/* Characterization tests for the Sales report, renderReportSales: the four
   stat cards (revenue, lost, capture rate, average deal), revenue by month
   over the last 6 months (by file mtime), the top wins and the owner
   leaderboard. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const NOW = Date.UTC(2026, 9, 11, 12);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup(files: MockFileSpec[] = [], now: number = NOW) {
  vi.useFakeTimers({ toFake: ["Date"], now });
  const made = makeAppView({ files });
  made.view.mode = "reports.sales";
  const root = new FakeElement("div");
  const sections = vi.spyOn(made.view, "_dashCardSection").mockImplementation(() => {});
  return { ...made, root, sections };
}

const deal = (name: string, frontmatter: Record<string, unknown>, mtime?: number): MockFileSpec => ({ path: `Cadence/Pipeline/${name}.md`, frontmatter, mtime });
const W1 = deal("W1", { title: "Big win", stage: "Won", value: 5000, owner: "Jane", company: "[[Acme]]" }, Date.UTC(2026, 9, 1));
const W2 = deal("W2", { title: "Mid win", stage: ["Won"], value: "3000", owner: "Bob" }, Date.UTC(2026, 7, 15));
const W3 = deal("W3", { title: "Old win", stage: "Won", value: 2000 }, Date.UTC(2026, 2, 3));
const W4 = deal("W4", { stage: "Won", value: 1000, owner: "Jane" });
const L1 = deal("L1", { title: "Loss", stage: "Lost", value: 4000 }, Date.UTC(2026, 9, 2));
const W5 = deal("W5", { title: "Lower", stage: "won", value: 9000 }, Date.UTC(2026, 9, 3));
const O1 = deal("O1", { title: "Open", stage: "Lead", value: 600 }, Date.UTC(2026, 9, 4));
const DEALS = [W1, W2, W3, W4, L1, W5, O1];

const cur = (n: number) => fmtValue(n, "currency");
const headerTexts = (root: FakeElement) => root.children[0].children[0].children.map((c) => c.text);
const stats = (root: FakeElement) => root.children[1].children.map((c) => [c.dataset.accent, ...c.children.map((x) => x.text)]);
const bars = (root: FakeElement) => root.children[3].children.map((col) => {
  const [bar, label] = col.children;
  return [label.text, bar.style.height, bar.dataset.band, bar.title];
});
const section = (sections: Any, title: string) => sections.mock.calls.find((c: Any[]) => String(c[1]).startsWith(title));

describe("renderReportSales: layout and stats", () => {
  it("adds the report class, renders the header and lays out stats, the chart and two columns", async () => {
    const { view, root } = setup(DEALS);
    await view.renderReportSales(root);
    expect(root.classes).toEqual(["cadence-report"]);
    expect(headerTexts(root)).toEqual(["CADENCE", "Sales report", "Closed-won and lost · performance over time"]);
    expect(root.children.map((c) => [c.classes, c.text])).toEqual([
      [["cad-page-header"], ""],
      [["cad-stat-grid"], ""],
      [["cad-section-label-lg"], "REVENUE — LAST 6 MONTHS"],
      [["cad-bar-chart", "cad-bar-chart-tall"], ""],
      [["cad-dash-cols"], ""],
    ]);
  });

  it("totals Won and Lost in any case, so a lower-case 'won' is revenue; open deals are in no card", async () => {
    const { view, root } = setup(DEALS);
    await view.renderReportSales(root);
    expect(stats(root)).toEqual([
      ["emerald", "REVENUE", cur(20000), "5 deals"],
      ["rose", "LOST", cur(4000), "1 deals"],
      ["mint", "CAPTURE", "83%", "of closed value"],
      ["sky", "AVG DEAL", cur(4000), "won deals"],
    ]);
  });

  it("shows zeros with no closed deals", async () => {
    const { view, root } = setup([O1]);
    await view.renderReportSales(root);
    expect(stats(root)).toEqual([
      ["emerald", "REVENUE", cur(0), "0 deals"],
      ["rose", "LOST", cur(0), "0 deals"],
      ["mint", "CAPTURE", "0%", "of closed value"],
      ["sky", "AVG DEAL", cur(0), "won deals"],
    ]);
  });
});

describe("renderReportSales: revenue by month", () => {
  it("draws the last 6 calendar months, oldest first, from each won deal's file mtime", async () => {
    const { view, root } = setup(DEALS);
    await view.renderReportSales(root);
    expect(bars(root)).toEqual([
      ["May", "0%", "empty", `May — ${cur(0)} · 0 deals`],
      ["Jun", "0%", "empty", `Jun — ${cur(0)} · 0 deals`],
      ["Jul", "0%", "empty", `Jul — ${cur(0)} · 0 deals`],
      ["Aug", `${(3000 / 14000) * 100}%`, "low", `Aug — ${cur(3000)} · 1 deals`],
      ["Sep", "0%", "empty", `Sep — ${cur(0)} · 0 deals`],
      ["Oct", "100%", "high", `Oct — ${cur(14000)} · 2 deals`],
    ]);
    expect(root.children[3].children[0].children.map((c) => c.classes)).toEqual([["cad-bar"], ["cad-bar-label"]]);
  });

  it("bands each bar by its share of the largest month: under 0.34 low, under 0.67 mid, else high", async () => {
    const months = [4, 5, 6, 7, 8, 9];
    const values = [33, 34, 66, 67, 100, 1];
    const files = months.map((m, i) => deal(`M${m}`, { stage: "Won", value: values[i] }, Date.UTC(2026, m, 10)));
    const { view, root } = setup(files);
    await view.renderReportSales(root);
    expect(bars(root).map((b) => [b[0], b[2]])).toEqual([["May", "low"], ["Jun", "mid"], ["Jul", "mid"], ["Aug", "high"], ["Sep", "high"], ["Oct", "low"]]);
  });

  it("scales to at least 1 so an all-zero chart has no NaN heights", async () => {
    const { view, root } = setup([deal("Z", { stage: "Won", value: 0 }, Date.UTC(2026, 9, 1))]);
    await view.renderReportSales(root);
    expect(bars(root).map((b) => [b[1], b[2], b[3]]).at(-1)).toEqual(["0%", "empty", `Oct — ${cur(0)} · 1 deals`]);
  });

  it("windows by calendar month across a year boundary", async () => {
    const files = [
      deal("Y1", { stage: "Won", value: 10 }, Date.UTC(2025, 9, 31)),
      deal("Y2", { stage: "Won", value: 20 }, Date.UTC(2025, 10, 1)),
      deal("Y3", { stage: "Won", value: 40 }, Date.UTC(2026, 0, 20)),
    ];
    const { view, root } = setup(files, Date.UTC(2026, 3, 15, 12));
    await view.renderReportSales(root);
    expect(bars(root).map((b) => [b[0], b[3]])).toEqual([
      ["Nov", `Nov — ${cur(20)} · 1 deals`],
      ["Dec", `Dec — ${cur(0)} · 0 deals`],
      ["Jan", `Jan — ${cur(40)} · 1 deals`],
      ["Feb", `Feb — ${cur(0)} · 0 deals`],
      ["Mar", `Mar — ${cur(0)} · 0 deals`],
      ["Apr", `Apr — ${cur(0)} · 0 deals`],
    ]);
  });

  it("dates a win by its `closed` date, else its file mtime; one with neither (no stat, or an mtime of 0) is in no month", async () => {
    const closed = deal("Closed", { stage: "Won", value: 7, closed: "1970-01-15" });
    const { view, root } = setup([W4, deal("Zero", { stage: "Won", value: 5 }, 0), closed], Date.UTC(1970, 2, 1));
    await view.renderReportSales(root);
    expect(bars(root).map((b) => b[3]).at(-3)).toEqual(`Jan — ${cur(7)} · 1 deals`);
  });

  it("an edit doesn't move a win with a `closed` date, in any zone", async () => {
    for (const tz of ZONES) {
      await withTimezone(tz, async () => {
        const { view, root } = setup([deal("Edited", { stage: ["Won"], value: 10, closed: "2026-08-01" }, Date.UTC(2026, 9, 5))]);
        await view.renderReportSales(root);
        expect(bars(root).map((b) => [b[0], b[3]]).slice(3)).toEqual([
          ["Aug", `Aug — ${cur(10)} · 1 deals`], ["Sep", `Sep — ${cur(0)} · 0 deals`], ["Oct", `Oct — ${cur(0)} · 0 deals`],
        ]);
        vi.useRealTimers();
        vi.restoreAllMocks();
      });
    }
  });

  it("falls back to the file mtime for an unreadable `closed` value", async () => {
    const { view, root } = setup([deal("Odd", { stage: "Won", value: 3, closed: "someday" }, Date.UTC(2026, 9, 2))]);
    await view.renderReportSales(root);
    expect(bars(root).at(-1)![3]).toBe(`Oct — ${cur(3)} · 1 deals`);
  });
});

describe("renderReportSales: top wins and owners", () => {
  it("lists the top 6 wins by value with the company linked", async () => {
    const { view, root, sections, app } = setup(DEALS);
    await view.renderReportSales(root);
    const [parent, title, rows, empty] = section(sections, "TOP WINS");
    expect(parent).toBe(root.children[4].children[0]);
    expect(title).toBe("TOP WINS · top 6");
    const file = (n: string) => app.vault.getAbstractFileByPath(`Cadence/Pipeline/${n}.md`);
    expect(rows).toEqual([
      { title: "Lower", metaParts: [{ text: "—", entityKey: "company" }, { text: ` · ${cur(9000)}` }], file: file("W5") },
      { title: "Big win", metaParts: [{ text: "[[Acme]]", entityKey: "company" }, { text: ` · ${cur(5000)}` }], file: file("W1") },
      { title: "Mid win", metaParts: [{ text: "—", entityKey: "company" }, { text: ` · ${cur(3000)}` }], file: file("W2") },
      { title: "Old win", metaParts: [{ text: "—", entityKey: "company" }, { text: ` · ${cur(2000)}` }], file: file("W3") },
      { title: "W4", metaParts: [{ text: "—", entityKey: "company" }, { text: ` · ${cur(1000)}` }], file: file("W4") },
    ]);
    expect(empty).toBe("No wins logged yet — close one and tag it Won.");
  });

  it("caps the top wins at 6", async () => {
    const files = Array.from({ length: 8 }, (_, i) => deal(`T${i}`, { stage: "Won", value: i }));
    const { view, root, sections } = setup(files);
    await view.renderReportSales(root);
    expect(section(sections, "TOP WINS")[2].map((r: Any) => r.title)).toEqual(["T7", "T6", "T5", "T4", "T3", "T2"]);
  });

  it("ranks owners by won revenue, linking all but (unassigned)", async () => {
    const { view, root, sections } = setup(DEALS);
    await view.renderReportSales(root);
    const [parent, title, rows, empty] = section(sections, "OWNER LEADERBOARD");
    expect(parent).toBe(root.children[4].children[1]);
    expect(title).toBe("OWNER LEADERBOARD · top 6 by revenue");
    expect(rows).toEqual([
      { title: "(unassigned)", titleEntityKey: null, meta: `2 won · ${cur(11000)}` },
      { title: "Jane", titleEntityKey: "contact", meta: `2 won · ${cur(6000)}` },
      { title: "Bob", titleEntityKey: "contact", meta: `1 won · ${cur(3000)}` },
    ]);
    expect(empty).toBe("No revenue attributed to owners yet.");
  });

  it("ranks an owner once whatever the case or link form, and credits each owner of a shared win", async () => {
    const files = [
      deal("A", { stage: "Won", value: 10, owner: ["[[Jane]]"] }), deal("B", { stage: "Won", value: 20, owner: "jane" }),
      deal("C", { stage: "Won", value: 5, owner: ["Jane", "[[Bob|Robert]]"] }),
    ];
    const { view, root, sections } = setup(files);
    await view.renderReportSales(root);
    expect(section(sections, "OWNER LEADERBOARD")[2].map((r: Any) => [r.title, r.meta])).toEqual([
      ["Jane", `3 won · ${cur(35)}`], ["Bob", `1 won · ${cur(5)}`],
    ]);
  });

  it("caps the leaderboard at 6 owners", async () => {
    const files = Array.from({ length: 8 }, (_, i) => deal(`P${i}`, { stage: "Won", value: i, owner: `O${i}` }));
    const { view, root, sections } = setup(files);
    await view.renderReportSales(root);
    expect(section(sections, "OWNER LEADERBOARD")[2].map((r: Any) => r.title)).toEqual(["O7", "O6", "O5", "O4", "O3", "O2"]);
  });

  it("passes empty lists with no wins", async () => {
    const { view, root, sections } = setup([L1]);
    await view.renderReportSales(root);
    expect(sections.mock.calls.map((c: Any[]) => [c[1], c[2]])).toEqual([["TOP WINS · top 6", []], ["OWNER LEADERBOARD · top 6 by revenue", []]]);
  });

  it("counts a win only in its own year's month", async () => {
    const { view, root } = setup([deal("Y", { stage: "Won", value: 10 }, Date.UTC(2025, 9, 5))]);
    await view.renderReportSales(root);
    expect(bars(root).at(-1)).toEqual(["Oct", "0%", "empty", `Oct — ${cur(0)} · 0 deals`]);
  });
});
