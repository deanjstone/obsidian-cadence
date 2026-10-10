import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeElement, type MockFileSpec } from "../mocks/obsidian";
import { makeAppView } from "../helpers/app-view";

/* Characterization tests for the Productivity report, renderProductivity,
   over the daily notes: the four stat cards (completion, streak, active
   days, journal characters), tasks done per day over the last 14 days,
   the 12-week completion trend and completion by weekday. */

// Sunday 11 October 2026.
const NOW = Date.UTC(2026, 9, 11, 12);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const SETTINGS = { tasksHeading: "## Today", journalHeading: "## Journal" };

function setup(files: MockFileSpec[] = [], settings: Record<string, unknown> = {}, now: number = NOW) {
  vi.useFakeTimers({ toFake: ["Date"], now });
  const made = makeAppView({ files, settings: { ...SETTINGS, ...settings } });
  made.view.mode = "reports.productivity";
  const root = new FakeElement("div");
  return { ...made, root };
}

const note = (date: string, body: string): MockFileSpec => ({ path: `daily/${date}.md`, body });
const NOTES = [
  note("2026-10-11", "## Today\n- [x] a\n- [ ] b\n## Journal\nHello"),
  note("2026-10-10", "## Today\n- [X] c\n- [x] d\n"),
  note("2026-10-09", "## Today\n- [ ] e\n## Journal\n"),
  note("2026-10-07", "## Journal\nWrote"),
  note("2026-10-01", "## Today\n- [x] f\n- [ ]\tg"),
  note("2026-09-12", "## Today\n- [x] h"),
  note("2026-09-11", "## Today\n- [x] old"),
];

const headerTexts = (root: FakeElement) => root.children[0].children[0].children.map((c) => c.text);
const stats = (root: FakeElement) => root.children[1].children.map((c) => [c.dataset.accent, ...c.children.map((x) => x.text)]);
const bars = (chart: FakeElement) => chart.children.map((col) => {
  const [bar, label] = col.children;
  return [label.text, bar.style.height, bar.dataset.band, bar.title];
});
const weekdays = (root: FakeElement) => root.children[7].children[0].children.map((m) => [m.dataset.accent, ...m.children.map((c) => c.text)]);
const localDate = (y: number, m: number, d: number) => new Date(y, m, d).toLocaleDateString();

describe("renderProductivity: layout and stats", () => {
  it("adds the report class, renders the header and lays out stats and the three charts", async () => {
    const { view, root } = setup(NOTES);
    await view.renderProductivity(root);
    expect(root.classes).toEqual(["cadence-report"]);
    expect(headerTexts(root)).toEqual(["CADENCE", "Productivity", "Last 30 days · across your daily notes"]);
    expect(root.children.map((c) => [c.classes, c.text])).toEqual([
      [["cad-page-header"], ""],
      [["cad-stat-grid"], ""],
      [["cad-section-label-lg"], "TASKS DONE — LAST 14 DAYS"],
      [["cad-bar-chart"], ""],
      [["cad-section-label-lg"], "COMPLETION TREND — LAST 12 WEEKS"],
      [["cad-bar-chart", "cad-bar-chart-tall"], ""],
      [["cad-section-label-lg"], "COMPLETION BY WEEKDAY · LAST 30 DAYS"],
      [["cad-dash-card"], ""],
    ]);
  });

  it("QUIRK: totals the last 30 days of notes; a task separated by a tab counts as neither open nor done", async () => {
    const { view, root } = setup(NOTES);
    await view.renderProductivity(root);
    expect(stats(root)).toEqual([
      ["emerald", "COMPLETION", "71%", "5/7 tasks"],
      ["mint", "STREAK", "2d", "consecutive active days"],
      ["sky", "ACTIVE", "6/30", "days with a note"],
      ["warn", "JOURNAL", "10", "characters written"],
    ]);
  });

  it("formats the journal count with thousands separators", async () => {
    const { view, root } = setup([note("2026-10-11", `## Journal\n${"x".repeat(1234)}`)]);
    await view.renderProductivity(root);
    expect(stats(root)[3]).toEqual(["warn", "JOURNAL", "1,234", "characters written"]);
  });

  it("shows zeros with no daily notes", async () => {
    const { view, root } = setup();
    await view.renderProductivity(root);
    expect(stats(root)).toEqual([
      ["emerald", "COMPLETION", "0%", "0/0 tasks"],
      ["mint", "STREAK", "0d", "consecutive active days"],
      ["sky", "ACTIVE", "0/30", "days with a note"],
      ["warn", "JOURNAL", "0", "characters written"],
    ]);
  });

  it("QUIRK: the streak counts back from today, so a day not yet started breaks it", async () => {
    const { view, root } = setup([note("2026-10-10", "## Today\n- [x] a"), note("2026-10-09", "## Today\n- [x] b")]);
    await view.renderProductivity(root);
    expect(stats(root)[1]).toEqual(["mint", "STREAK", "0d", "consecutive active days"]);
  });

  it("counts a journal-only day in the streak", async () => {
    const { view, root } = setup([note("2026-10-11", "## Journal\nx"), note("2026-10-10", "## Journal\ny"), note("2026-10-08", "## Journal\nz")]);
    await view.renderProductivity(root);
    expect(stats(root)[1][2]).toBe("2d");
  });

  it("reads the configured daily note folder and headings", async () => {
    const { view, root } = setup([{ path: "Journal/2026-10-11.md", body: "## Tasks\n- [x] a\n## Log\nabc" }], {
      dailyNoteFolder: "Journal/", tasksHeading: "## Tasks", journalHeading: "## Log",
    });
    await view.renderProductivity(root);
    expect(stats(root).map((s) => s[2])).toEqual(["100%", "1d", "1/30", "3"]);
  });
});

describe("renderProductivity: last 14 days", () => {
  it("draws one bar per day, oldest left, labelled with the day of month and scaled to the busiest day", async () => {
    const { view, root } = setup(NOTES);
    await view.renderProductivity(root);
    const rows = bars(root.children[3]);
    expect(rows.map((r) => r[0])).toEqual(["28", "29", "30", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]);
    expect(rows[3]).toEqual(["1", "50%", "mid", `${localDate(2026, 9, 1)} — 1 done, 0 open`]);
    expect(rows[11]).toEqual(["9", "0%", "empty", `${localDate(2026, 9, 9)} — 0 done, 1 open`]);
    expect(rows[12]).toEqual(["10", "100%", "high", `${localDate(2026, 9, 10)} — 2 done, 0 open`]);
    expect(rows[13]).toEqual(["11", "50%", "mid", `${localDate(2026, 9, 11)} — 1 done, 1 open`]);
    expect(rows.filter((r) => r[2] === "empty")).toHaveLength(11);
  });

  it("bands under 0.34 low, under 0.67 mid, else high", async () => {
    const tasks = (n: number) => `## Today\n${"- [x] t\n".repeat(n)}`;
    const files = [
      note("2026-10-11", tasks(100)), note("2026-10-10", tasks(67)), note("2026-10-09", tasks(66)),
      note("2026-10-08", tasks(34)), note("2026-10-07", tasks(33)),
    ];
    const { view, root } = setup(files);
    await view.renderProductivity(root);
    expect(bars(root.children[3]).slice(-5).map((r) => r[2])).toEqual(["low", "mid", "mid", "high", "high"]);
  });
});

describe("renderProductivity: 12-week trend", () => {
  it("totals done and open per week for 12 weeks up to today, labelled by week start", async () => {
    const { view, root } = setup(NOTES);
    await view.renderProductivity(root);
    const rows = bars(root.children[5]);
    expect(rows.map((r) => r[0])).toEqual(["Jul 20", "Jul 27", "Aug 3", "Aug 10", "Aug 17", "Aug 24", "Aug 31", "Sep 7", "Sep 14", "Sep 21", "Sep 28", "Oct 5"]);
    expect(rows.slice(7)).toEqual([
      ["Sep 7", `${(2 / 3) * 100}%`, "mid", "Week of Sep 7 — 2 done, 0 open"],
      ["Sep 14", "0%", "empty", "Week of Sep 14 — 0 done, 0 open"],
      ["Sep 21", "0%", "empty", "Week of Sep 21 — 0 done, 0 open"],
      ["Sep 28", `${(1 / 3) * 100}%`, "low", "Week of Sep 28 — 1 done, 0 open"],
      ["Oct 5", "100%", "high", "Week of Oct 5 — 3 done, 2 open"],
    ]);
  });

  it("stops at today, so a note dated later this week is not counted", async () => {
    const { view, root } = setup([note("2026-10-06", "## Today\n- [x] a"), note("2026-10-08", "## Today\n- [x] b")], {}, Date.UTC(2026, 9, 7, 12));
    await view.renderProductivity(root);
    expect(bars(root.children[5]).at(-1)).toEqual(["Oct 5", "100%", "high", "Week of Oct 5 — 1 done, 0 open"]);
  });

  it("starts weeks on the configured day", async () => {
    const { view, root } = setup(NOTES, { weekStartsOn: 0 });
    await view.renderProductivity(root);
    expect(bars(root.children[5]).at(-1)).toEqual(["Oct 11", "50%", "mid", "Week of Oct 11 — 1 done, 1 open"]);
  });
});

describe("renderProductivity: by weekday", () => {
  it("aggregates the 30 days by weekday from Monday, with — for days with no tasks", async () => {
    const { view, root } = setup(NOTES);
    await view.renderProductivity(root);
    const card = root.children[7];
    expect(card.style.margin).toBe("0 36px 24px 36px");
    expect(card.children[0].classes).toEqual(["cad-dash-card-body", "cad-mini-stat-row"]);
    expect(card.children[0].children[0].children[2].style.marginTop).toBe("4px");
    expect(weekdays(root)).toEqual([
      ["emerald", "—", "MON", "no data"],
      ["mint", "—", "TUE", "no data"],
      ["sky", "—", "WED", "no data"],
      ["warn", "100%", "THU", "1/1"],
      ["rose", "0%", "FRI", "0/1"],
      ["mint", "100%", "SAT", "3/3"],
      ["sky", "50%", "SUN", "1/2"],
    ]);
  });

  it("starts from Sunday when the week does", async () => {
    const { view, root } = setup(NOTES, { weekStartsOn: 0 });
    await view.renderProductivity(root);
    expect(weekdays(root).map((w) => [w[2], w[1]])).toEqual([["SUN", "50%"], ["MON", "—"], ["TUE", "—"], ["WED", "—"], ["THU", "100%"], ["FRI", "0%"], ["SAT", "100%"]]);
  });

  it("QUIRK: any other week start keeps the Sunday labels, so Saturday-start shows Sunday's tasks under MON", async () => {
    const { view, root } = setup([note("2026-10-11", "## Today\n- [x] a\n- [ ] b")], { weekStartsOn: 6 });
    await view.renderProductivity(root);
    expect(weekdays(root).map((w) => [w[2], w[1]])).toEqual([["SUN", "—"], ["MON", "50%"], ["TUE", "—"], ["WED", "—"], ["THU", "—"], ["FRI", "—"], ["SAT", "—"]]);
  });

  it("rounds the weekday percentage", async () => {
    const { view, root } = setup([note("2026-10-11", "## Today\n- [x] a\n- [x] b\n- [ ] c")]);
    await view.renderProductivity(root);
    expect(weekdays(root)[6]).toEqual(["sky", "67%", "SUN", "2/3"]);
  });
});
