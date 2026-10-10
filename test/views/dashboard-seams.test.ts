import { describe, expect, it } from "vitest";
import type { TFile } from "obsidian";
import { ENTITIES } from "../../src/constants/entities";
import {
  WIDGET_STYLE_OPTIONS, chartData, dashboardWidgets, removeWidget,
} from "../../src/views/components/charts";
import {
  crmStatCards, crmSummary, customerBase, dealValue, hotDeals, pipelineByStage, recentActivities, staleDeals,
} from "../../src/views/crm-dashboard";
import {
  PROJECT_PRIORITIES, PROJECT_STATUSES, acceptsDrop, dashRowPill, dashboardOptions, priorityAccent, projectCardPills,
  projectRowName, projectsSummary, projectsViewGroups, statusAccent, type ProjectCardData,
} from "../../src/views/projects-dashboard";
import { fmtValue } from "../../src/utils/format";
import type { Entity, EntityDef, ProjectMeta } from "../../src/types/entities";
import type { WidgetConfig } from "../../src/types/modals";

/* Direct tests for the plain-data seams lifted out of the Projects and CRM
   dashboards and the uncalled card grid. No view, no vault: entities are
   plain objects. */

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 11, 12);
const entity = (basename: string, frontmatter: Record<string, unknown>, mtime?: number): Entity =>
  ({ file: { path: `${basename}.md`, basename, ...(mtime === undefined ? {} : { stat: { mtime, ctime: mtime, size: 0 } }) } as TFile, frontmatter, basename });
const names = (list: Entity[]) => list.map((e) => e.basename);
const cur = (n: number) => fmtValue(n, "currency");
const { project, deal, activity } = ENTITIES;
const withFields = (def: EntityDef, fields: EntityDef["fields"]): EntityDef => ({ ...def, fields });

describe("dashboardOptions", () => {
  it("reads the field's options, or the fallback when the field or its options are missing", () => {
    expect(dashboardOptions(project, "status", ["x"])).toEqual(PROJECT_STATUSES);
    expect(dashboardOptions(project, "nope", ["x"])).toEqual(["x"]);
    expect(dashboardOptions(withFields(project, [{ key: "status", label: "S" }]), "status", ["x"])).toEqual(["x"]);
  });

  it("QUIRK: keeps an empty options list (getEnumOptions would fall back), so there are no cards", () => {
    expect(dashboardOptions(withFields(project, [{ key: "status", label: "S", options: [] }]), "status", ["x"])).toEqual([]);
  });
});

describe("statusAccent / priorityAccent", () => {
  it("maps known statuses, ignoring case and reading only the first '-' as '_'", () => {
    expect(["active", "Done", "cancelled", "backlog", "on_hold", "On-Hold"].map((s, i) => statusAccent(s, i))).toEqual([
      "emerald", "mint", "rose", "purple", "warn", "warn",
    ]);
  });

  it("cycles the fallback accents by position for an unknown status", () => {
    expect([0, 1, 5, 6].map((i) => statusAccent("idea", i))).toEqual(["sky", "emerald", "mint", "sky"]);
    expect(statusAccent("on-hold-x", 2)).toBe("rose");
  });

  it("maps low/medium/high, else sky", () => {
    expect(["LOW", "medium", "High", "urgent"].map(priorityAccent)).toEqual(["sky", "warn", "rose", "sky"]);
  });
});

describe("projectsSummary", () => {
  const projects = [
    entity("A", { status: "Active", priority: "high" }),
    entity("B", { status: ["done"], priority: "LOW" }),
    entity("C", { status: "on-hold" }),
    entity("D", {}),
  ];

  it("totals every project and builds a status and a priority card per option", () => {
    const summary = projectsSummary(projects, project);
    expect(summary.total).toBe(4);
    expect(summary.statuses.map((c) => [c.value, c.label, c.accent, names(c.items)])).toEqual([
      ["active", "ACTIVE PROJECTS", "emerald", ["A"]],
      ["on_hold", "ON HOLD PROJECTS", "warn", []],
      ["backlog", "BACKLOG PROJECTS", "purple", []],
      ["done", "DONE PROJECTS", "mint", ["B"]],
      ["cancelled", "CANCELLED PROJECTS", "rose", []],
    ]);
    expect(summary.priorities.map((c) => [c.value, c.label, c.accent, names(c.items)])).toEqual([
      ["low", "LOW PRIORITY", "sky", ["B"]],
      ["medium", "MEDIUM PRIORITY", "warn", []],
      ["high", "HIGH PRIORITY", "rose", ["A"]],
    ]);
  });

  it("falls back to the default statuses and priorities when the def has neither field", () => {
    const summary = projectsSummary([], withFields(project, [{ key: "name", label: "Name", primary: true }]));
    expect(summary.statuses.map((c) => c.value)).toEqual(PROJECT_STATUSES);
    expect(summary.priorities.map((c) => c.value)).toEqual(PROJECT_PRIORITIES);
  });
});

describe("dashboard rows", () => {
  it("projectRowName uses the name, else the basename", () => {
    expect(projectRowName(entity("A", { name: "Alpha" }), project)).toBe("Alpha");
    expect(projectRowName(entity("B", {}), project)).toBe("B");
  });

  it("dashRowPill: _ class, spaces from underscores, null when blank", () => {
    expect(dashRowPill("On Hold_x")).toEqual({ cls: "cad-pill cad-pill-on_hold_x", text: "On Hold x" });
    expect(dashRowPill(["high"])).toEqual({ cls: "cad-pill cad-pill-high", text: "high" });
    expect([dashRowPill(""), dashRowPill(undefined), dashRowPill(0)]).toEqual([null, null, null]);
  });

  it("acceptsDrop needs a path and a different source card", () => {
    expect(acceptsDrop("a.md", "", "done")).toBe(true);
    expect(acceptsDrop("a.md", "active", "done")).toBe(true);
    expect(acceptsDrop("", "active", "done")).toBe(false);
    expect(acceptsDrop("a.md", "done", "done")).toBe(false);
  });
});

describe("projectsViewGroups", () => {
  const meta = { done: 0, total: 0, percent: 0, next: null } as unknown as ProjectMeta;
  const card = (name: string, status?: unknown): ProjectCardData => ({ entity: entity(name, status === undefined ? {} : { status }), meta });
  const labelled = (groups: Array<{ label: string; items: ProjectCardData[] }>) => groups.map((g) => [g.label, g.items.map((p) => p.entity.basename)]);

  it("groups by status option order, dropping empty groups", () => {
    const groups = projectsViewGroups([card("A", "done"), card("B", "active"), card("C", "Done")], PROJECT_STATUSES, project);
    expect(labelled(groups)).toEqual([["ACTIVE", ["B"]], ["DONE", ["A", "C"]]]);
  });

  it("folds case and spaces, puts a blank status in the first option and an unknown one in the first group", () => {
    const options = ["In Flight", "Parked"];
    const groups = projectsViewGroups([card("A", "parked"), card("B"), card("C", "archived"), card("D", "in  flight")], options, project);
    expect(labelled(groups)).toEqual([["IN FLIGHT", ["B", "C", "D"]], ["PARKED", ["A"]]]);
  });

  it("QUIRK: two options that fold to the same key render that group twice", () => {
    const groups = projectsViewGroups([card("A", "on hold")], ["On Hold", "on_hold"], project);
    expect(labelled(groups)).toEqual([["ON HOLD", ["A"]], ["ON HOLD", ["A"]]]);
  });

  it("returns nothing with no options", () => {
    expect(projectsViewGroups([card("A", "x")], [], project)).toEqual([]);
  });
});

describe("projectCardPills", () => {
  it("status (dashes, default active) then priority (prio- class) when set", () => {
    expect(projectCardPills(entity("A", { status: "On Hold", priority: "High" }), project)).toEqual([
      { cls: "cad-pill cad-pill-on-hold", text: "On Hold" },
      { cls: "cad-pill cad-pill-prio-high", text: "High" },
    ]);
    expect(projectCardPills(entity("B", {}), project)).toEqual([{ cls: "cad-pill cad-pill-active", text: "active" }]);
  });
});

describe("crmSummary / crmStatCards", () => {
  const deals = [
    entity("A", { stage: "Proposal", value: 12000 }),
    entity("B", { stage: ["Won"], value: "4500" }),
    entity("C", { stage: "Lost", value: 1000 }),
    entity("D", { stage: "won", value: 300 }),
    entity("E", { value: "abc" }),
    entity("W", { stage: "Won", value: 500 }),
  ];

  it("dealValue reads value as a number, else 0", () => {
    expect(deals.map((d) => dealValue(d, deal))).toEqual([12000, 4500, 1000, 300, 0, 500]);
  });

  it("splits open, won and lost (case-sensitive), with values, win rate and the won average", () => {
    const s = crmSummary(deals, deal);
    expect([names(s.open), names(s.won), names(s.lost)]).toEqual([["A", "D", "E"], ["B", "W"], ["C"]]);
    expect([s.openValue, s.wonValue, s.lostValue, s.winRate, s.avgDeal]).toEqual([12300, 5000, 1000, 67, 2500]);
  });

  it("is all zeros with no deals", () => {
    const s = crmSummary([], deal);
    expect([s.openValue, s.wonValue, s.lostValue, s.winRate, s.avgDeal]).toEqual([0, 0, 0, 0, 0]);
  });

  it("formats the five cards in order", () => {
    expect(crmStatCards(crmSummary(deals, deal))).toEqual([
      { label: "OPEN PIPELINE", value: 3, sub: cur(12300), accent: "sky" },
      { label: "WON", value: 2, sub: cur(5000), accent: "emerald" },
      { label: "LOST", value: 1, sub: cur(1000), accent: "rose" },
      { label: "WIN RATE", value: "67%", sub: "2/3 closed", accent: "mint" },
      { label: "AVG DEAL", value: cur(2500), sub: "2 won deals", accent: "warn" },
    ]);
  });
});

describe("pipelineByStage", () => {
  it("counts and sums each stage, scaling widths to the largest", () => {
    const deals = [entity("A", { stage: "Lead", value: 200 }), entity("B", { stage: "Lead", value: 200 }), entity("C", { stage: "Won", value: 100 }), entity("D", { stage: "x", value: 9e9 })];
    expect(pipelineByStage(deals, deal, ["Lead", "Won", "Lost"])).toEqual([
      { stage: "Lead", count: 2, value: 400, width: "100%" },
      { stage: "Won", count: 1, value: 100, width: "25%" },
      { stage: "Lost", count: 0, value: 0, width: "0%" },
    ]);
  });

  it("scales against at least 1", () => {
    expect(pipelineByStage([entity("A", { stage: "Lead", value: 0.5 })], deal, ["Lead"])[0].width).toBe("50%");
  });
});

describe("hotDeals / staleDeals", () => {
  it("hotDeals: top 5 by value, ties in input order, title falling back to the basename", () => {
    const open = [1, 5, 3, 5, 2, 4, 0].map((v, i) => entity(`D${i}`, { title: i === 1 ? "" : `T${i}`, stage: i ? "Lead" : "", value: v }));
    const rows = hotDeals(open, deal);
    expect(rows.map((r) => [r.title, r.meta])).toEqual([
      ["D1", `Lead · ${cur(5)}`],
      ["T3", `Lead · ${cur(5)}`],
      ["T5", `Lead · ${cur(4)}`],
      ["T2", `Lead · ${cur(3)}`],
      ["T4", `Lead · ${cur(2)}`],
    ]);
    expect(rows[0].file).toBe(open[1].file);
    expect(hotDeals([entity("Z", {})], deal)[0].meta).toBe(`— · ${cur(0)}`);
  });

  it("staleDeals: older than 14 days before now, oldest first, at most 5, with days rounded", () => {
    const open = [
      entity("Edge", { stage: "Lead" }, NOW - 14 * DAY),
      entity("NoStat", { stage: "Lead" }),
      ...[15, 40, 20, 16, 17, 18].map((d) => entity(`S${d}`, { title: `S${d}`, stage: "Lead", value: d }, NOW - d * DAY - DAY / 3)),
    ];
    expect(staleDeals(open, deal, NOW).map((r) => [r.title, r.meta])).toEqual([
      ["S40", `Lead · 40d quiet · ${cur(40)}`],
      ["S20", `Lead · 20d quiet · ${cur(20)}`],
      ["S18", `Lead · 18d quiet · ${cur(18)}`],
      ["S17", `Lead · 17d quiet · ${cur(17)}`],
      ["S16", `Lead · 16d quiet · ${cur(16)}`],
    ]);
    expect(staleDeals(open, deal, NOW + DAY).map((r) => r.title)).toContain("S40");
    expect(staleDeals([entity("Edge", {}, NOW - 14 * DAY - 1)], deal, NOW).map((r) => r.meta)).toEqual([`— · 14d quiet · ${cur(0)}`]);
  });
});

describe("recentActivities", () => {
  it("sorts newest first, undated last, caps at 6 and links the with part to contacts", () => {
    const acts = [
      entity("Old", { subject: "Old", type: "Call", with: "[[Jane]]", when: "2026-01-01" }),
      entity("Undated", {}),
      ...[2, 3, 4, 5, 6, 7].map((m) => entity(`M${m}`, { when: `2026-0${m}-01` })),
    ];
    const rows = recentActivities(acts, activity);
    expect(rows.map((r) => r.title)).toEqual(["M7", "M6", "M5", "M4", "M3", "M2"]);
    expect(recentActivities([acts[0], acts[1]], activity)).toEqual([
      {
        title: "Old",
        metaParts: [{ text: "Call" }, { text: " · " }, { text: "[[Jane]]", entityKey: "contact" }, { text: ` · ${fmtValue("2026-01-01", "date")}` }],
        file: acts[0].file,
      },
      {
        title: "Undated",
        metaParts: [{ text: "—" }, { text: " · " }, { text: "—", entityKey: "contact" }, { text: ` · ${fmtValue("", "date")}` }],
        file: acts[1].file,
      },
    ]);
  });
});

describe("customerBase", () => {
  it("totals the records and lists the three mini stats with their modes", () => {
    expect(customerBase({ contacts: 3, companies: 2, partners: 1 })).toEqual({
      title: "CUSTOMER BASE · 6 records",
      stats: [
        { label: "CONTACTS", value: 3, accent: "warn", mode: "crm.contacts" },
        { label: "COMPANIES", value: 2, accent: "sky", mode: "crm.companies" },
        { label: "PARTNERS", value: 1, accent: "rose", mode: "prm.partners" },
      ],
    });
  });
});

describe("dashboard widgets", () => {
  const W1: WidgetConfig = { id: "w1", title: "A", groupBy: "stage", style: "bar" };
  const W2: WidgetConfig = { id: "w2", title: "B", groupBy: "owner", style: "kpi" };

  it("dashboardWidgets returns the saved list itself, or [] (there are no default widgets)", () => {
    const saved = [W1];
    expect(dashboardWidgets({ projectDashboardWidgets: saved }, "projectDashboardWidgets")).toBe(saved);
    expect(dashboardWidgets({ projectDashboardWidgets: saved }, "crmDashboardWidgets")).toEqual([]);
    expect(dashboardWidgets({}, "projectDashboardWidgets")).toEqual([]);
  });

  it("removeWidget drops every widget with the id, tolerating a missing list", () => {
    expect(removeWidget([W1, W2, { ...W1, title: "dup" }], "w1")).toEqual([W2]);
    expect(removeWidget(undefined, "w1")).toEqual([]);
  });

  it("offers donut, bar, KPI and list", () => {
    expect(WIDGET_STYLE_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ["donut", "🍩 Donut"], ["bar", "📊 Bar"], ["kpi", "🗃️ KPI Cards"], ["list", "📋 List"],
    ]);
  });

  it("chartData counts deals by stage, the swap both dashboards now use", () => {
    const deals = [entity("A", { stage: ["Won"] }), entity("B", { stage: "Won" }), entity("C", {})];
    expect(chartData(deals, W1, deal)).toEqual([{ label: "Won", count: 2 }, { label: "Unspecified", count: 1 }]);
  });
});
