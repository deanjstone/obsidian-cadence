import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeElement, type MockFileSpec } from "../mocks/obsidian";
import { makeAppView } from "../helpers/app-view";
import { fmtValue } from "../../src/utils/format";

/* Characterization tests for the Activity report, renderReportActivity:
   the total and one stat card per activity type, activity per week over
   the last 8 weeks, the top contacts and the 10 latest activities. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// Sunday 11 October 2026, so the current Monday-start week began on the 5th.
const NOW = Date.UTC(2026, 9, 11, 12);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup(files: MockFileSpec[] = [], settings: Record<string, unknown> = {}) {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  const made = makeAppView({ files, settings });
  made.view.mode = "reports.activity";
  const root = new FakeElement("div");
  const sections = vi.spyOn(made.view, "_dashCardSection").mockImplementation(() => {});
  return { ...made, root, sections };
}

const activity = (name: string, frontmatter: Record<string, unknown>): MockFileSpec => ({ path: `Cadence/Activities/${name}.md`, frontmatter });
const A1 = activity("A1", { subject: "Kickoff", type: "Call", with: "[[Jane]]", when: "2026-10-06" });
const A2 = activity("A2", { subject: "Late call", type: "Call", with: "Jane", when: "2026-10-11T23:00" });
const A3 = activity("A3", { subject: "Follow-up", type: "Email", with: "[[Jane]]", when: "2026-09-30" });
const A4 = activity("A4", { subject: "Demo", type: "Meeting", with: "[[Bob]]", when: "2026-08-17" });
const A5 = activity("A5", { subject: "Too old", when: "2026-08-16" });
const A6 = activity("A6", { subject: "Notes", type: "Note" });
const A7 = activity("A7", {});
const A8 = activity("A8", { subject: "Next week", type: "Call", with: "  ", when: "2026-10-12" });
const ACTS = [A1, A2, A3, A4, A5, A6, A7, A8];

const headerTexts = (root: FakeElement) => root.children[0].children[0].children.map((c) => c.text);
const stats = (root: FakeElement) => root.children[1].children.map((c) => [c.dataset.accent, ...c.children.map((x) => x.text)]);
const bars = (root: FakeElement) => root.children[3].children.map((col) => {
  const [bar, label] = col.children;
  return [label.text, bar.style.height, bar.dataset.band, bar.title];
});
const section = (sections: Any, title: string) => sections.mock.calls.find((c: Any[]) => String(c[1]).startsWith(title));

describe("renderReportActivity: layout and stats", () => {
  it("adds the report class, renders the header and lays out stats, the chart and two columns", async () => {
    const { view, root } = setup(ACTS);
    await view.renderReportActivity(root);
    expect(root.classes).toEqual(["cadence-report"]);
    expect(headerTexts(root)).toEqual(["CADENCE", "Activity report", "Calls, meetings, emails and notes — mix and momentum"]);
    expect(root.children.map((c) => [c.classes, c.text])).toEqual([
      [["cad-page-header"], ""],
      [["cad-stat-grid"], ""],
      [["cad-section-label-lg"], "ACTIVITY — LAST 8 WEEKS"],
      [["cad-bar-chart", "cad-bar-chart-tall"], ""],
      [["cad-dash-cols"], ""],
    ]);
  });

  it("shows the total, then one card per type in first-seen order with cycling accents and no sub line", async () => {
    const { view, root } = setup(ACTS);
    await view.renderReportActivity(root);
    expect(stats(root)).toEqual([
      ["emerald", "TOTAL", "8", "all activities"],
      ["sky", "CALL", "3"],
      ["mint", "EMAIL", "1"],
      ["warn", "MEETING", "1"],
      ["rose", "UNSPECIFIED", "2"],
      ["sky", "NOTE", "1"],
    ]);
  });

  it("types are counted in any case, so 'call' and 'Call' are one CALL card; a blank type is unspecified", async () => {
    const { view, root } = setup([activity("X", { type: "call" }), activity("Y", { type: "Call" }), activity("Z", { type: " " })]);
    await view.renderReportActivity(root);
    expect(stats(root).slice(1)).toEqual([["sky", "CALL", "2"], ["mint", "UNSPECIFIED", "1"]]);
  });

  it("shows only the total with no activities", async () => {
    const { view, root } = setup();
    await view.renderReportActivity(root);
    expect(stats(root)).toEqual([["emerald", "TOTAL", "0", "all activities"]]);
  });
});

describe("renderReportActivity: activity by week", () => {
  it("counts dated activities into the last 8 weeks, from the start of this week back", async () => {
    const { view, root } = setup(ACTS);
    await view.renderReportActivity(root);
    expect(bars(root)).toEqual([
      ["Aug 17", "50%", "mid", "Week of Aug 17 — 1 activities"],
      ["Aug 24", "0%", "empty", "Week of Aug 24 — 0 activities"],
      ["Aug 31", "0%", "empty", "Week of Aug 31 — 0 activities"],
      ["Sep 7", "0%", "empty", "Week of Sep 7 — 0 activities"],
      ["Sep 14", "0%", "empty", "Week of Sep 14 — 0 activities"],
      ["Sep 21", "0%", "empty", "Week of Sep 21 — 0 activities"],
      ["Sep 28", "50%", "mid", "Week of Sep 28 — 1 activities"],
      ["Oct 5", "100%", "high", "Week of Oct 5 — 2 activities"],
    ]);
  });

  it("starts weeks on the configured day", async () => {
    const { view, root } = setup([A1, A2], { weekStartsOn: 0 });
    await view.renderReportActivity(root);
    expect(bars(root).map((b) => [b[0], b[3]]).slice(-2)).toEqual([
      ["Oct 4", "Week of Oct 4 — 1 activities"],
      ["Oct 11", "Week of Oct 11 — 1 activities"],
    ]);
  });

  it("skips an unparseable date and scales an empty chart to 1", async () => {
    const { view, root } = setup([activity("G", { when: "garbage" })]);
    await view.renderReportActivity(root);
    expect(bars(root).every((b) => b[1] === "0%" && b[2] === "empty")).toBe(true);
  });

  it("bands under 0.34 low, under 0.67 mid, else high", async () => {
    const weekOf = (day: number) => `2026-10-${String(day).padStart(2, "0")}`;
    const files = [
      ...Array.from({ length: 3 }, (_, i) => activity(`W${i}`, { when: weekOf(5) })),
      activity("V", { when: weekOf(1) }),
      ...Array.from({ length: 2 }, (_, i) => activity(`U${i}`, { when: "2026-09-22" })),
    ];
    const { view, root } = setup(files);
    await view.renderReportActivity(root);
    expect(bars(root).map((b) => b[2]).slice(-3)).toEqual(["mid", "low", "high"]);
  });
});

describe("renderReportActivity: contacts and recent", () => {
  it("ranks contacts by activity count, skipping blank ones", async () => {
    const { view, root, sections } = setup(ACTS);
    await view.renderReportActivity(root);
    const [parent, title, rows, empty] = section(sections, "TOP CONTACTS");
    expect(parent).toBe(root.children[4].children[0]);
    expect(title).toBe("TOP CONTACTS · by activity count");
    expect(rows).toEqual([
      { title: "[[Jane]]", titleEntityKey: "contact", meta: "2 activities" },
      { title: "Jane", titleEntityKey: "contact", meta: "1 activity" },
      { title: "[[Bob]]", titleEntityKey: "contact", meta: "1 activity" },
    ]);
    expect(empty).toBe("No activities tagged with a contact yet.");
  });

  it("keeps the top 8 contacts", async () => {
    const files = Array.from({ length: 10 }, (_, i) => activity(`C${i}`, { with: `P${i % 9}` }));
    const { view, root, sections } = setup(files);
    await view.renderReportActivity(root);
    expect(section(sections, "TOP CONTACTS")[2].map((r: Any) => r.title)).toEqual(["P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7"]);
  });

  it("lists the latest activities by when, newest first, undated last", async () => {
    const { view, root, sections, app } = setup(ACTS.filter((a) => a !== A6));
    await view.renderReportActivity(root);
    const [parent, title, rows, empty] = section(sections, "RECENT ACTIVITY");
    expect(parent).toBe(root.children[4].children[1]);
    expect(title).toBe("RECENT ACTIVITY · last 10");
    const file = (n: string) => app.vault.getAbstractFileByPath(`Cadence/Activities/${n}.md`);
    const row = (t: string, type: string, who: string, when: unknown, n: string) => ({
      title: t,
      metaParts: [{ text: type }, { text: " · " }, { text: who, entityKey: "contact" }, { text: ` · ${fmtValue(when, "date")}` }],
      file: file(n),
    });
    expect(rows).toEqual([
      row("Next week", "Call", "—", "2026-10-12", "A8"),
      row("Late call", "Call", "Jane", "2026-10-11T23:00", "A2"),
      row("Kickoff", "Call", "[[Jane]]", "2026-10-06", "A1"),
      row("Follow-up", "Email", "[[Jane]]", "2026-09-30", "A3"),
      row("Demo", "Meeting", "[[Bob]]", "2026-08-17", "A4"),
      row("Too old", "—", "—", "2026-08-16", "A5"),
      row("A7", "—", "—", "", "A7"),
    ]);
    expect(empty).toBe("No activities yet — log one under CRM > Activities.");
  });

  it("caps the recent list at 10", async () => {
    const files = Array.from({ length: 12 }, (_, i) => activity(`R${i}`, { when: `2026-09-${String(10 + i)}` }));
    const { view, root, sections } = setup(files);
    await view.renderReportActivity(root);
    expect(section(sections, "RECENT ACTIVITY")[2].map((r: Any) => r.title)).toEqual(["R11", "R10", "R9", "R8", "R7", "R6", "R5", "R4", "R3", "R2"]);
  });
});
