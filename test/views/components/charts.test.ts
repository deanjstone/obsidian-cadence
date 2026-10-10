import { describe, expect, it, vi } from "vitest";
import { FakeElement } from "../../mocks/obsidian";
import { makeAppView } from "../../helpers/app-view";

/* Characterization tests for the chart primitives shared by the CRM,
   Projects and PRM dashboards and the #chart- H2 sections: _drawChart,
   _drawChartEmpty, _drawDonutChart, _drawBarChart, _drawKpiGrid and
   _drawSimpleList. Driven through the class, read back from the DOM stub. */

const CIRC = 2 * Math.PI * 50;
const COLORS = ["#38bdf8", "#34d399", "#f43f5e", "#a855f7", "#f97316", "#06b6d4", "#eab308"];

function setup() {
  const { view } = makeAppView();
  const parent = new FakeElement("div");
  return { view, parent };
}

const byClass = (root: FakeElement, cls: string) => root.querySelectorAll(`.${cls}`);
const isEmptyState = (parent: FakeElement) =>
  parent.children.length === 1 && parent.children[0].classes[0] === "cad-empty" && parent.children[0].text === "No data";

describe("_drawChart", () => {
  it.each([
    ["donut", "_drawDonutChart"],
    ["bar", "_drawBarChart"],
    ["kpi", "_drawKpiGrid"],
    ["list", "_drawSimpleList"],
    ["pie", "_drawSimpleList"],
    [undefined, "_drawSimpleList"],
  ])("routes style %s to %s", (style, method) => {
    const { view, parent } = setup();
    const spies = Object.fromEntries(
      ["_drawDonutChart", "_drawBarChart", "_drawKpiGrid", "_drawSimpleList"].map((m) => [m, vi.spyOn(view, m).mockImplementation(() => {})]),
    );
    const data = [{ label: "a", count: 1 }];
    view._drawChart(parent, style, data);
    for (const [name, spy] of Object.entries(spies)) {
      expect(spy.mock.calls).toEqual(name === method ? [[parent, data]] : []);
    }
  });
});

describe("_drawChartEmpty", () => {
  it("appends a centred 'No data' empty state", () => {
    const { view, parent } = setup();
    view._drawChartEmpty(parent);
    expect(isEmptyState(parent)).toBe(true);
    expect(parent.children[0].style.cssText).toBe("text-align: center; padding: 16px;");
  });
});

describe("_drawDonutChart", () => {
  it.each([[[]], [[{ label: "a", count: 0 }, { label: "b", count: 0 }]]])("shows the empty state when the total is 0 (%j)", (data) => {
    const { view, parent } = setup();
    view._drawDonutChart(parent, data);
    expect(isEmptyState(parent)).toBe(true);
  });

  it("draws a 140px SVG with a track circle and one stroked segment per item, offset by the running length", () => {
    const { view, parent } = setup();
    view._drawDonutChart(parent, [{ label: "Won", count: 3 }, { label: "Lost", count: 1 }]);
    const [container] = parent.children;
    expect(container.classes).toEqual(["cad-donut-chart-container"]);
    const svg = container.querySelectorAll("svg")[0];
    expect(svg.attrs).toEqual({ width: "140", height: "140", viewBox: "0 0 140 140" });
    const circles = svg.children;
    expect(circles.map((c) => c.localName)).toEqual(["circle", "circle", "circle"]);
    expect(circles[0].attrs).toEqual({
      cx: "70", cy: "70", r: "50", fill: "transparent", stroke: "var(--background-secondary)", "stroke-width": "12",
    });
    const first = 0.75 * CIRC;
    const second = 0.25 * CIRC;
    expect(circles[1].classes).toEqual(["cad-donut-segment"]);
    expect(circles[1].attrs).toEqual({
      cx: "70", cy: "70", r: "50", fill: "transparent", stroke: COLORS[0], "stroke-width": "12",
      "stroke-dasharray": `${first} ${CIRC}`, "stroke-dashoffset": "0", transform: "rotate(-90 70 70)",
    });
    expect(circles[2].attrs["stroke-dasharray"]).toBe(`${second} ${CIRC}`);
    expect(circles[2].attrs["stroke-dashoffset"]).toBe(String(-first));
    expect(circles[2].attrs.stroke).toBe(COLORS[1]);
  });

  it("shows the total in the centre and a legend row per item with its colour, label, count and rounded share", () => {
    const { view, parent } = setup();
    view._drawDonutChart(parent, [{ label: "A", count: 2 }, { label: 7, count: 1 }]);
    expect(byClass(parent, "cad-donut-center-total")[0].text).toBe("3");
    expect(byClass(parent, "cad-donut-center-label")[0].text).toBe("Total");
    const rows = byClass(parent, "cad-donut-legend-item");
    expect(rows.map((r) => r.children.map((c) => c.text))).toEqual([["", "A", "2 (67%)"], ["", "7", "1 (33%)"]]);
    expect(rows[1].children[0].style.cssText).toContain(`background-color: ${COLORS[1]};`);
  });

  it("cycles the seven colours from the eighth item", () => {
    const { view, parent } = setup();
    const data = Array.from({ length: 8 }, (_, i) => ({ label: `L${i}`, count: 1 }));
    view._drawDonutChart(parent, data);
    const strokes = byClass(parent, "cad-donut-segment").map((s) => s.attrs.stroke);
    expect(strokes).toEqual([...COLORS, COLORS[0]]);
  });

  it("QUIRK: draws a zero-length segment and a 0% legend row for zero-count items", () => {
    const { view, parent } = setup();
    view._drawDonutChart(parent, [{ label: "A", count: 2 }, { label: "B", count: 0 }]);
    const segments = byClass(parent, "cad-donut-segment");
    expect(segments[1].attrs["stroke-dasharray"]).toBe(`0 ${CIRC}`);
    expect(byClass(parent, "cad-donut-legend-count").map((c) => c.text)).toEqual(["2 (100%)", "0 (0%)"]);
  });
});

describe("_drawBarChart", () => {
  it("shows the empty state when the total is 0", () => {
    const { view, parent } = setup();
    view._drawBarChart(parent, [{ label: "a", count: 0 }]);
    expect(isEmptyState(parent)).toBe(true);
  });

  it("sizes each bar against the largest count and labels it with its share of the total", () => {
    const { view, parent } = setup();
    view._drawBarChart(parent, [{ label: "Lead", count: 4 }, { label: "Won", count: 1 }, { label: "Lost", count: 3 }]);
    const [bars] = parent.children;
    expect(bars.classes).toEqual(["cad-stage-bars"]);
    const rows = bars.children;
    expect(rows.map((r) => r.children.map((c) => c.classes[0]))).toEqual(
      Array(3).fill(["cad-stage-bar-name", "cad-stage-bar-count", "cad-stage-bar", "cad-stage-bar-value"]),
    );
    expect(rows.map((r) => [r.children[0].text, r.children[1].text, r.children[3].text])).toEqual([
      ["Lead", "4", "50%"], ["Won", "1", "13%"], ["Lost", "3", "38%"],
    ]);
    const fills = byClass(parent, "cad-stage-bar-fill").map((f) => f.style.cssText);
    expect(fills[0]).toBe(`width: 100%; background-color: ${COLORS[0]}; height: 100%; border-radius: 4px; transition: width 0.3s ease;`);
    expect(fills[1]).toContain("width: 25%;");
    expect(fills[2]).toContain(`width: 75%; background-color: ${COLORS[2]};`);
  });
});

describe("_drawKpiGrid", () => {
  it("shows the empty state only when there are no items", () => {
    const { view, parent } = setup();
    view._drawKpiGrid(parent, []);
    expect(isEmptyState(parent)).toBe(true);
  });

  it("renders a stat card per item: upper-cased label, count and share of the total, with cycling accents", () => {
    const { view, parent } = setup();
    const data = Array.from({ length: 7 }, (_, i) => ({ label: `tier ${i}`, count: i === 0 ? 4 : 1 }));
    view._drawKpiGrid(parent, data);
    const [grid] = parent.children;
    expect(grid.classes).toEqual(["cad-stat-grid"]);
    const cards = grid.children;
    expect(cards.map((c) => c.attrs["data-accent"])).toEqual(["sky", "emerald", "rose", "purple", "warn", "mint", "sky"]);
    expect(cards[0].children.map((c) => [c.classes[0], c.text])).toEqual([
      ["cad-stat-label", "TIER 0"], ["cad-stat-value", "4"], ["cad-stat-sub", "40% of total"],
    ]);
    expect(cards[1].children[2].text).toBe("10% of total");
  });

  it("QUIRK: unlike donut and bar, all-zero counts still render cards, at 0% of total", () => {
    const { view, parent } = setup();
    view._drawKpiGrid(parent, [{ label: "a", count: 0 }]);
    expect(byClass(parent, "cad-stat-sub").map((c) => c.text)).toEqual(["0% of total"]);
  });
});

describe("_drawSimpleList", () => {
  it("shows the empty state when there are no items", () => {
    const { view, parent } = setup();
    view._drawSimpleList(parent, []);
    expect(isEmptyState(parent)).toBe(true);
  });

  it("renders a label/count row per item, in the given order, zero counts included", () => {
    const { view, parent } = setup();
    view._drawSimpleList(parent, [{ label: "b", count: 0 }, { label: null, count: 2 }]);
    const [list] = parent.children;
    expect(list.classes).toEqual(["cad-simple-list"]);
    expect(list.children.map((r) => [r.classes[0], ...r.children.map((c) => c.text)])).toEqual([
      ["cad-list-item", "b", "0"], ["cad-list-item", "null", "2"],
    ]);
  });
});
