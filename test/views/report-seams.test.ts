import { afterEach, describe, expect, it, vi } from "vitest";
import type { TFile } from "obsidian";
import { ENTITIES } from "../../src/constants/entities";
import {
  activityReport, partnersReport, pipelineReport, productivityDates, productivityReport, reportBar, salesReport,
} from "../../src/views/reports";
import { crmSummary, dealValue, sumValues } from "../../src/utils/deals";
import * as crm from "../../src/views/crm-dashboard";
import { DEAL_STAGES } from "../../src/constants/entities";
import { ymd } from "../../src/utils/dates";
import { fmtValue } from "../../src/utils/format";
import type { Entity } from "../../src/types/entities";

/* Direct tests for the report seams: each report's maths over plain
   entities (or daily-note contents), with no view and no vault. */

const DAY = 86400000;
// Sunday 11 October 2026, midday UTC (the suite runs in UTC).
const NOW = Date.UTC(2026, 9, 11, 12);
const entity = (basename: string, frontmatter: Record<string, unknown>, mtime?: number): Entity =>
  ({ file: { path: `${basename}.md`, basename, ...(mtime === undefined ? {} : { stat: { mtime, ctime: mtime, size: 0 } }) } as TFile, frontmatter, basename });
const names = (list: Entity[]) => list.map((e) => e.basename);
const cur = (n: number) => fmtValue(n, "currency");
const { deal, activity } = ENTITIES;

afterEach(() => {
  vi.useRealTimers();
});

describe("reportBar", () => {
  it("scales to the max and bands at 0, under 0.34, under 0.67 and above", () => {
    expect([0, 33, 34, 66, 67, 100].map((v) => reportBar(v, 100))).toEqual([
      { height: "0%", band: "empty" },
      { height: "33%", band: "low" },
      { height: "34%", band: "mid" },
      { height: "66%", band: "mid" },
      { height: "67%", band: "high" },
      { height: "100%", band: "high" },
    ]);
  });

  it("bands by ratio, not by height rounding", () => {
    expect(reportBar(1, 3)).toEqual({ height: `${(1 / 3) * 100}%`, band: "low" });
    expect(reportBar(2, 3).band).toBe("mid");
  });
});

describe("src/utils/deals", () => {
  it("is what the CRM dashboard re-exports", () => {
    expect(crm.dealValue).toBe(dealValue);
    expect(crm.crmSummary).toBe(crmSummary);
  });

  it("sums deal values, blank and non-numeric as 0", () => {
    expect(sumValues([entity("a", { value: 5 }), entity("b", { value: "7" }), entity("c", { value: "x" }), entity("d", {})], deal)).toBe(12);
  });
});

describe("pipelineReport", () => {
  const deals = [
    entity("A", { stage: "Lead", value: 1000, owner: "Jane" }, NOW - 2 * DAY),
    entity("B", { stage: "Qualified", value: 2000, owner: "Jane" }, NOW - 31 * DAY),
    entity("C", { stage: "Proposal", value: 4000 }, NOW - 91 * DAY),
    entity("D", { stage: "Negotiation", value: 8000, owner: "Bob" }),
    entity("E", { stage: "Won", value: 5000 }),
    entity("F", { stage: "Lost", value: 3000 }),
    entity("G", { stage: "Custom", value: 100 }),
  ];
  const report = pipelineReport(deals, deal, DEAL_STAGES, NOW);

  it("splits open, won and lost and weighs open value by built-in stage confidence", () => {
    expect([names(report.open), names(report.won), names(report.lost)]).toEqual([["A", "B", "C", "D", "G"], ["E"], ["F"]]);
    expect(report.weighted).toBe(1000 * 0.1 + 2000 * 0.25 + 4000 * 0.5 + 8000 * 0.75);
    expect(report.winRate).toBe(50);
  });

  it("builds the five stat cards", () => {
    expect(report.stats).toEqual([
      { label: "OPEN", value: 5, sub: cur(15100), accent: "sky" },
      { label: "WEIGHTED", value: cur(8600), sub: "forecast on open", accent: "mint" },
      { label: "WON", value: 1, sub: cur(5000), accent: "emerald" },
      { label: "LOST", value: 1, sub: cur(3000), accent: "rose" },
      { label: "WIN RATE", value: "50%", sub: "1/2 closed", accent: "warn" },
    ]);
  });

  it("counts every configured stage, closed ones included", () => {
    expect(report.byStage.map((s) => [s.stage, s.count, s.value])).toEqual([
      ["Lead", 1, 1000], ["Qualified", 1, 2000], ["Proposal", 1, 4000], ["Negotiation", 1, 8000], ["Won", 1, 5000], ["Lost", 1, 3000],
    ]);
    expect(pipelineReport(deals, deal, ["Custom"], NOW).byStage).toEqual([{ stage: "Custom", count: 1, value: 100 }]);
  });

  it("ranks open owners by value", () => {
    expect(report.owners).toEqual([
      { title: "Bob", titleEntityKey: "contact", meta: `1 deal · ${cur(8000)}` },
      { title: "(unassigned)", titleEntityKey: null, meta: `2 deals · ${cur(4100)}` },
      { title: "Jane", titleEntityKey: "contact", meta: `2 deals · ${cur(3000)}` },
    ]);
  });

  it("buckets open deals into aging cohorts, a deal with no stat as new", () => {
    expect(report.cohorts).toEqual([
      { label: "0–7 DAYS", value: "3", accent: "emerald", sub: cur(9100), count: 3, total: 9100 },
      { label: "8–30 DAYS", value: "0", accent: "mint", sub: cur(0), count: 0, total: 0 },
      { label: "31–90 DAYS", value: "1", accent: "warn", sub: cur(2000), count: 1, total: 2000 },
      { label: "90+ DAYS", value: "1", accent: "rose", sub: cur(4000), count: 1, total: 4000 },
    ]);
  });

  it("lists stale open deals oldest first", () => {
    expect(report.stale.map((r) => [r.title, r.meta])).toEqual([
      ["C", `Proposal · 91d quiet · ${cur(4000)}`],
      ["B", `Qualified · 31d quiet · ${cur(2000)}`],
    ]);
    expect(report.stale[0].file).toBe(deals[2].file);
  });

  it("does not treat exactly 30 days as stale", () => {
    expect(pipelineReport([entity("X", { stage: "Lead" }, NOW - 30 * DAY)], deal, DEAL_STAGES, NOW).stale).toEqual([]);
  });
});

describe("salesReport", () => {
  const deals = [
    entity("W1", { title: "One", stage: "Won", value: 300, owner: "Jane", company: "Acme" }, Date.UTC(2026, 9, 2)),
    entity("W2", { stage: "Won", value: 100, owner: "Jane" }, Date.UTC(2026, 4, 31)),
    entity("W3", { stage: "Won", value: 200 }, Date.UTC(2026, 3, 30)),
    entity("L1", { stage: "Lost", value: 400 }),
  ];
  const report = salesReport(deals, deal, new Date(NOW));

  it("computes the stat cards and the capture rate by value", () => {
    expect(report.captureRate).toBe(60);
    expect(report.stats).toEqual([
      { label: "REVENUE", value: cur(600), sub: "3 deals", accent: "emerald" },
      { label: "LOST", value: cur(400), sub: "1 deals", accent: "rose" },
      { label: "CAPTURE", value: "60%", sub: "of closed value", accent: "mint" },
      { label: "AVG DEAL", value: cur(200), sub: "won deals", accent: "sky" },
    ]);
  });

  it("windows revenue into the 6 calendar months up to now", () => {
    expect(report.months.map((m) => [ymd(m.date), m.label, m.revenue, m.count])).toEqual([
      ["2026-05-01", "May", 100, 1], ["2026-06-01", "Jun", 0, 0], ["2026-07-01", "Jul", 0, 0],
      ["2026-08-01", "Aug", 0, 0], ["2026-09-01", "Sep", 0, 0], ["2026-10-01", "Oct", 300, 1],
    ]);
    expect(report.bars.map((b) => [b.label, b.band, b.title]).at(0)).toEqual(["May", "low", `May — ${cur(100)} · 1 deals`]);
  });

  it("ranks wins and owners", () => {
    expect(report.topWins.map((r) => [r.title, r.metaParts])).toEqual([
      ["One", [{ text: "Acme", entityKey: "company" }, { text: ` · ${cur(300)}` }]],
      ["W3", [{ text: "—", entityKey: "company" }, { text: ` · ${cur(200)}` }]],
      ["W2", [{ text: "—", entityKey: "company" }, { text: ` · ${cur(100)}` }]],
    ]);
    expect(report.owners.map((r) => [r.title, r.meta])).toEqual([["Jane", `2 won · ${cur(400)}`], ["(unassigned)", `1 won · ${cur(200)}`]]);
  });
});

describe("partnersReport", () => {
  const deals = [
    entity("D1", { stage: "Won", value: 10, partner: "[[A]]" }),
    entity("D2", { stage: "Lead", value: 20, partner: "[[A]]" }),
    entity("D3", { stage: "Lead", value: 40 }),
  ];
  const partners = [entity("P1", { tier: "Silver" }), entity("P2", {}), entity("P3", { tier: "Silver" })];
  const certs = [
    entity("C1", { name: "Later", expires: "2026-12-01" }),
    entity("C2", { name: "Soon", partner: "[[A]]", expires: "2026-10-12" }),
    entity("C3", { expires: "2027-03-01" }),
  ];
  const report = partnersReport(deals, partners, certs, NOW);

  it("totals partner-sourced deals and revenue, and counts direct as a source", () => {
    expect([names(report.partnerSourced), names(report.partnerWon)]).toEqual([["D1", "D2"], ["D1"]]);
    expect(report.stats).toEqual([
      { label: "PARTNERS", value: 3, sub: "on the books", accent: "sky" },
      { label: "PARTNER DEALS", value: 2, sub: cur(30), accent: "mint" },
      { label: "PARTNER REV", value: cur(10), sub: "1 won", accent: "emerald" },
      { label: "UNIQUE SOURCES", value: 2, sub: "including direct", accent: "warn" },
    ]);
  });

  it("counts tiers, most first", () => {
    expect(report.tiers).toEqual([{ label: "SILVER", value: "2", accent: "sky" }, { label: "UNTIERED", value: "1", accent: "sky" }]);
  });

  it("groups deals by source", () => {
    expect(report.sources).toEqual([
      { partner: "[[A]]", count: 2, meta: `2 deals · ${cur(30)}` },
      { partner: "(direct)", count: 1, meta: `1 deal · ${cur(40)}` },
    ]);
    expect(partnersReport([], [], [], NOW).sources).toEqual([]);
  });

  it("lists certs inside the 90-day horizon, soonest first", () => {
    expect(report.certs.map((r) => [r.title, r.metaParts![0].text])).toEqual([["Soon", "[[A]]"], ["Later", "—"]]);
  });
});

describe("activityReport", () => {
  const acts = [
    entity("A", { type: "Call", with: "Jane", when: "2026-10-05" }),
    entity("B", { type: "Call", with: "Jane", when: "2026-10-04T23:59" }),
    entity("C", { with: "Bob", when: "2026-08-16" }),
  ];
  const now = new Date(NOW);

  it("counts by type and builds a card each", () => {
    expect(activityReport(acts, activity, now, 1).stats).toEqual([
      { label: "TOTAL", value: 3, sub: "all activities", accent: "emerald" },
      { label: "CALL", value: 2, sub: "", accent: "sky" },
      { label: "UNSPECIFIED", value: 1, sub: "", accent: "mint" },
    ]);
  });

  it("windows activities into 8 half-open weeks from the configured start", () => {
    const monday = activityReport(acts, activity, now, 1);
    expect(monday.weeks.map((w) => [ymd(w.start), ymd(w.end), w.count])).toEqual([
      ["2026-08-17", "2026-08-24", 0], ["2026-08-24", "2026-08-31", 0], ["2026-08-31", "2026-09-07", 0], ["2026-09-07", "2026-09-14", 0],
      ["2026-09-14", "2026-09-21", 0], ["2026-09-21", "2026-09-28", 0], ["2026-09-28", "2026-10-05", 1], ["2026-10-05", "2026-10-12", 1],
    ]);
    const sunday = activityReport(acts, activity, now, 0);
    expect(sunday.weeks.map((w) => [ymd(w.start), w.count]).slice(-2)).toEqual([["2026-10-04", 2], ["2026-10-11", 0]]);
    expect(sunday.bars.at(-2)).toEqual({ label: "Oct 4", title: "Week of Oct 4 — 2 activities", height: "100%", band: "high" });
  });

  it("defaults the week start to Monday", () => {
    expect(ymd(activityReport([], activity, now).weeks[7].start)).toBe("2026-10-05");
  });

  it("ranks contacts and lists the latest", () => {
    const report = activityReport(acts, activity, now, 1);
    expect(report.topContacts.map((r) => [r.title, r.meta])).toEqual([["Jane", "2 activities"], ["Bob", "1 activity"]]);
    expect(report.recent.map((r) => r.title)).toEqual(["A", "B", "C"]);
  });
});

describe("productivityDates", () => {
  it("runs from the start of the 12-week trend to today", () => {
    const dates = productivityDates(new Date(NOW), 1);
    expect([ymd(dates[0]), ymd(dates[dates.length - 1]), dates.length]).toEqual(["2026-07-20", "2026-10-11", 84]);
    expect(dates.every((d) => d.getHours() === 0)).toBe(true);
  });

  it("covers at least the last 30 days on the first day of a week", () => {
    const dates = productivityDates(new Date(Date.UTC(2026, 9, 5, 9)), 1);
    expect([ymd(dates[0]), dates.length]).toEqual(["2026-07-20", 78]);
  });
});

describe("productivityReport", () => {
  const settings = { tasksHeading: "## Today", journalHeading: "## Journal", weekStartsOn: 1 };
  const notes = (entries: Record<string, string>) => new Map(Object.entries(entries));

  it("totals tasks, journal characters, active days and the streak", () => {
    const report = productivityReport(notes({
      "2026-10-11": "## Today\n- [x] a\n- [ ] b",
      "2026-10-10": "## Journal\nabc",
      "2026-10-08": "## Today\n- [x] c",
    }), new Date(NOW), settings);
    expect([report.totalOpen, report.totalDone, report.journalChars, report.activeDays, report.streak, report.completion]).toEqual([1, 2, 3, 3, 2, 67]);
    expect(report.stats.map((s) => s.value)).toEqual(["67%", "2d", "3/30", "3"]);
  });

  it("QUIRK: a line matching both patterns counts as open and done over 30 days, but as done only in the trend", () => {
    const report = productivityReport(notes({ "2026-10-11": "## Today\n- [x] see [ ] here" }), new Date(NOW), settings);
    expect([report.totalOpen, report.totalDone]).toEqual([1, 1]);
    expect(report.weeks.at(-1)!.title).toBe("Week of Oct 5 — 1 done, 0 open");
  });

  it("ignores notes outside the 30 days for the totals but counts them in the trend", () => {
    const report = productivityReport(notes({ "2026-09-11": "## Today\n- [x] a" }), new Date(NOW), settings);
    expect([report.totalDone, report.activeDays]).toEqual([0, 0]);
    expect(report.weeks.at(-5)!.title).toBe("Week of Sep 7 — 1 done, 0 open");
  });

  it("bars the last 14 days and weeks, and buckets weekdays from the week start", () => {
    const report = productivityReport(notes({ "2026-10-10": "## Today\n- [x] a\n- [x] b", "2026-10-11": "## Today\n- [x] c" }), new Date(NOW), settings);
    expect(report.days).toHaveLength(14);
    expect(report.days.slice(-2).map((d) => [d.label, d.height, d.band])).toEqual([["10", "100%", "high"], ["11", "50%", "mid"]]);
    expect(report.weeks).toHaveLength(12);
    expect(report.weekdays.map((w) => w.value)).toEqual(["—", "—", "—", "—", "—", "100%", "100%"]);
    expect(report.weekdays[5]).toEqual({ label: "SAT", value: "100%", accent: "mint", sub: "2/2" });
  });

  it("uses the clock it is given, not the system clock", () => {
    vi.useFakeTimers({ toFake: ["Date"], now: Date.UTC(2030, 0, 1) });
    const report = productivityReport(notes({ "2026-10-11": "## Today\n- [x] a" }), new Date(NOW), settings);
    expect(report.totalDone).toBe(1);
  });

  it("leaves a note dated after today out of the trend", () => {
    const report = productivityReport(notes({ "2026-10-08": "## Today\n- [x] a" }), new Date(Date.UTC(2026, 9, 7, 12)), settings);
    expect(report.weeks.at(-1)!.title).toBe("Week of Oct 5 — 0 done, 0 open");
  });
});
