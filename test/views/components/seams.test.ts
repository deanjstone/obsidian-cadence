import { describe, expect, it } from "vitest";
import { ENTITIES } from "../../../src/constants/entities";
import type { Entity, Frontmatter } from "../../../src/types/entities";
import { CHART_COLORS, barRows, chartData, donutGeometry, kpiCards, sectionChartData } from "../../../src/views/components/charts";
import { crossSectionRows, dynamicH2Kind, linksTo } from "../../../src/views/components/sections";

/* Direct tests for the pure parts of the shared view components. The
   characterization tests drive the same logic through the class. */

const entity = (basename: string, frontmatter: Frontmatter): Entity =>
  ({ file: { path: `${basename}.md` }, basename, frontmatter }) as unknown as Entity;

describe("chartData (dashboard widgets)", () => {
  it("counts list items once each, stripping wiki-link brackets and skipping blank items", () => {
    const deals = [
      entity("a", { owner: ["[[Sam]]", "[[Ann]]", " "] }),
      entity("b", { owner: ["[[Sam]]"] }),
      entity("c", { owner: [] }),
    ];
    expect(chartData(deals, { groupBy: "owner" }, ENTITIES.deal)).toEqual([{ label: "Sam", count: 2 }, { label: "Ann", count: 1 }]);
  });

  it("counts a blank scalar as Unspecified and reads through entityValue (stage arrays unwrap, the primary falls back to the basename)", () => {
    const deals = [
      entity("x", { stage: ["Won", "Lost"] }),
      entity("y", { stage: "Won" }),
      entity("z", { stage: "" }),
    ];
    expect(chartData(deals, { groupBy: "stage" }, ENTITIES.deal)).toEqual([{ label: "Won", count: 2 }, { label: "Unspecified", count: 1 }]);
    expect(chartData(deals, { groupBy: "title" }, ENTITIES.deal)).toEqual([{ label: "x", count: 1 }, { label: "y", count: 1 }, { label: "z", count: 1 }]);
  });

  it("sorts most frequent first, keeping first-seen order for ties", () => {
    const deals = ["B", "A", "A", "C", "B", "D"].map((s, i) => entity(`d${i}`, { stage: s }));
    expect(chartData(deals, { groupBy: "stage" }, ENTITIES.deal).map((d) => d.label)).toEqual(["B", "A", "C", "D"]);
  });
});

describe("sectionChartData (#chart- headings)", () => {
  const frontmatterOf = (e: Entity) => e.frontmatter;

  it("counts the raw frontmatter value: blank list items and null count as Unspecified, an empty list counts nothing", () => {
    const deals = [
      entity("a", { stage: ["[[Won]]", ""] }),
      entity("b", { stage: [] }),
      entity("c", { stage: null }),
      entity("d", {}),
    ];
    expect(sectionChartData(deals, "stage", frontmatterOf)).toEqual([{ label: "Unspecified", count: 3 }, { label: "Won", count: 1 }]);
  });

  it("does not fall back to the basename for the primary field, unlike chartData", () => {
    const deals = [entity("x", {})];
    expect(sectionChartData(deals, "title", frontmatterOf)).toEqual([{ label: "Unspecified", count: 1 }]);
    expect(chartData(deals, { groupBy: "title" }, ENTITIES.deal)).toEqual([{ label: "x", count: 1 }]);
  });

  it("reads frontmatter through the given lookup", () => {
    const lookup = () => ({ tier: "Gold" });
    expect(sectionChartData([entity("p", { tier: "Silver" })], "tier", lookup)).toEqual([{ label: "Gold", count: 1 }]);
  });
});

describe("donutGeometry", () => {
  it("lays segments end to end around a radius-50 circle, with rounded shares and cycling colours", () => {
    const circ = 2 * Math.PI * 50;
    const data = Array.from({ length: 8 }, (_, i) => ({ label: `L${i}`, count: i === 0 ? 2 : 1 }));
    const { total, r, circ: c, segments } = donutGeometry(data);
    expect([total, r, c]).toEqual([9, 50, circ]);
    expect(segments[0]).toEqual({ color: CHART_COLORS[0], length: (2 / 9) * circ, offset: 0, percent: 22 });
    expect(segments[1].offset).toBe((2 / 9) * circ);
    expect(segments[7].color).toBe(CHART_COLORS[0]);
    expect(segments.map((s) => s.percent)).toEqual([22, 11, 11, 11, 11, 11, 11, 11]);
  });

  it("gives NaN lengths for a zero total (the drawer shows the empty state first)", () => {
    const { total, segments } = donutGeometry([{ label: "a", count: 0 }]);
    expect(total).toBe(0);
    expect(segments[0].length).toBeNaN();
  });
});

describe("barRows", () => {
  it("sizes against the largest count and labels with the share of the total", () => {
    expect(barRows([{ label: "a", count: 4 }, { label: "b", count: 1 }])).toEqual([
      { color: CHART_COLORS[0], width: 100, percent: 80 },
      { color: CHART_COLORS[1], width: 25, percent: 20 },
    ]);
  });

  it("uses a floor of 1 for the largest count", () => {
    expect(barRows([{ label: "a", count: 0 }]).map((r) => r.width)).toEqual([0]);
  });
});

describe("kpiCards", () => {
  it("cycles six accents and rounds each share, with 0% for a zero total", () => {
    const data = Array.from({ length: 7 }, (_, i) => ({ label: `L${i}`, count: 1 }));
    expect(kpiCards(data).map((c) => c.accent)).toEqual(["sky", "emerald", "rose", "purple", "warn", "mint", "sky"]);
    expect(kpiCards(data)[0].percent).toBe(14);
    expect(kpiCards([{ label: "a", count: 0 }])).toEqual([{ accent: "sky", percent: 0 }]);
  });
});

describe("linksTo", () => {
  it.each([
    ["[[Acme Corp]]", true],
    ["  acme corp ", true],
    [["[[Initech]]", "[[ACME CORP]]"], true],
    ["[[Acme Corp|Acme]]", false],
    ["[[Initech]], [[Acme Corp]]", false],
    [null, false],
    [undefined, false],
    [[], false],
  ])("%j names 'Acme Corp ': %s", (val, expected) => {
    expect(linksTo(val, "Acme Corp ")).toBe(expected);
  });

  it("compares numbers by their string form", () => {
    expect(linksTo(2026, "2026")).toBe(true);
  });
});

describe("crossSectionRows", () => {
  it("keeps the entities whose link field names the parent, in order, read through the lookup", () => {
    const rows = [entity("a", { company: "[[Acme]]" }), entity("b", { company: "[[Other]]" }), entity("c", { company: ["acme"] })];
    expect(crossSectionRows(rows, "company", "Acme", (e) => e.frontmatter).map((e) => e.basename)).toEqual(["a", "c"]);
    expect(crossSectionRows(rows, "company", "Acme", () => ({}))).toEqual([]);
  });
});

describe("dynamicH2Kind", () => {
  it.each([
    ["Tasks", { kind: "tasks", cleanLabel: "Tasks" }],
    ["To do #tasks", { kind: "tasks", cleanLabel: "To do" }],
    ["MILESTONES", { kind: "milestones", cleanLabel: "MILESTONES" }],
    ["Plan #milestones", { kind: "milestones", cleanLabel: "Plan" }],
    ["Tasks #cross-deal-company-table", { kind: "tasks", cleanLabel: "Tasks" }],
    ["Deals #cross-deal-company-kanban", { kind: "cross", cleanLabel: "Deals", targetEntity: "deal", linkField: "company", viewType: "kanban" }],
    ["X #cross-nope-a-b", { kind: "cross", cleanLabel: "X", targetEntity: "nope", linkField: "a", viewType: "b" }],
    ["Deals #cross-deal-company", { kind: "malformed", cleanLabel: "Deals" }],
    ["Deals #cross-deal-close-by-table", { kind: "malformed", cleanLabel: "Deals" }],
    ["By stage #chart-deal-company-stage-donut", {
      kind: "chart", cleanLabel: "By stage", targetEntity: "deal", linkField: "company", groupField: "stage", chartStyle: "donut",
    }],
    ["S #chart-deal-company-stage-big-donut", {
      kind: "chart", cleanLabel: "S", targetEntity: "deal", linkField: "company", groupField: "stage", chartStyle: "big-donut",
    }],
    ["S #chart-deal-company-stage", { kind: "malformed", cleanLabel: "S" }],
    ["Notes", { kind: "text", cleanLabel: "Notes" }],
    ["Notes #crossdeal", { kind: "text", cleanLabel: "Notes" }],
    ["Notes #text", { kind: "text", cleanLabel: "Notes" }],
  ])("classifies %j", (rawKey, expected) => {
    expect(dynamicH2Kind(rawKey)).toEqual(expected);
  });
});
