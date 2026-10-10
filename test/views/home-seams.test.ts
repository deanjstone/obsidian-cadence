import { describe, expect, it } from "vitest";
import { TFile } from "../mocks/obsidian";
import {
  computeBriefing, countTaskLines, countWeekTaskNotes, inboxRowMeta, isHomeActiveProject, selectInboxCard,
  selectPartnerRows, selectPipelineCard, selectRecentActivities, selectTodayCard, selectUpcomingItems, taskNotesToday,
  toggleTaskLine, visibleBriefing, weekProgress, type BriefingData,
} from "../../src/views/home";
import type { Entity } from "../../src/types/entities";
import type { Reminder } from "../../src/types/reminders";
import type { TaskNotesTask } from "../../src/types/entities";
import type { Milestone } from "../../src/utils/parsing";

/* Direct tests for the pure seams lifted out of Home (src/views/home.ts).
   Plain data in, plain data out: no view, no vault, no fake timers. */

const NOW = new Date("2026-10-10T09:00:00Z");

function entity(path: string, frontmatter: Record<string, unknown> = {}, mtime?: number): Entity {
  const file = new TFile(path) as unknown as TFile & { stat?: { ctime: number; mtime: number; size: number } };
  if (mtime !== undefined) file.stat = { ctime: mtime, mtime, size: 0 };
  return { file: file as never, frontmatter, basename: file.basename };
}

const reminder = (text: string, when: string | null, extra: Partial<Reminder> = {}): Reminder => ({
  id: text, text, when, repeat: "none", notes: "", project: null, notified: false, done: false, createdAt: "", ...extra,
});

const milestone = (date: string | null, title = "M", done = false): Milestone => ({ date: date ? new Date(date) : null, title, done, notes: "" });

const empty: BriefingData = { openTasks: 0, deals: [], contacts: [], projects: [] };

describe("computeBriefing", () => {
  it("returns nothing for an empty day", () => {
    expect(computeBriefing(empty, NOW)).toEqual([]);
  });

  it("treats unreadable tasks (null) like none", () => {
    expect(computeBriefing({ ...empty, openTasks: null }, NOW)).toEqual([]);
  });

  it("words the task count by task system, targeting Today", () => {
    expect(computeBriefing({ ...empty, openTasks: 1 }, NOW)).toEqual([
      { icon: "🎯", tone: "emerald", text: "1 open task on today's note", target: { kind: "mode", mode: "planner.today" } },
    ]);
    expect(computeBriefing({ ...empty, openTasks: 3, taskManagementSystem: "tasknotes" }, NOW)[0].text).toBe(
      "3 open tasks scheduled for today",
    );
  });

  it("splits reminders into overdue (≤ now) and later today (< midnight), skipping done", () => {
    const out = computeBriefing({
      ...empty,
      reminders: [
        reminder("Now", "2026-10-10T09:00:00Z"),
        reminder("Done", "2026-10-09T00:00:00Z", { done: true }),
        reminder("Tonight", "2026-10-10T23:59:59.999Z"),
        reminder("Midnight", "2026-10-11T00:00:00Z"),
      ],
    }, NOW);
    expect(out.map((e) => [e.text, e.target])).toEqual([
      ['Overdue reminder — "Now"', { kind: "mode", mode: "planner.inbox" }],
      ["1 reminder due later today", { kind: "mode", mode: "planner.inbox" }],
    ]);
  });

  it("counts open deals closing within the week, summing values", () => {
    const out = computeBriefing({
      ...empty,
      deals: [
        entity("Cadence/Pipeline/A.md", { stage: "Lead", value: 100, closeBy: "2026-10-17T00:00:00Z" }),
        entity("Cadence/Pipeline/B.md", { stage: ["Negotiation"], value: "50", closeBy: "2026-10-10" }),
        entity("Cadence/Pipeline/C.md", { stage: "Lead", value: 1, closeBy: "2026-10-17T00:00:00.001Z" }),
      ],
    }, NOW);
    expect(out).toEqual([{ icon: "💼", tone: "sky", text: "2 deals close this week · $150", target: { kind: "mode", mode: "crm.pipeline" } }]);
  });

  it("targets the stale contact's file", () => {
    const jane = entity("Cadence/Contacts/Jane.md", { name: "Jane", lastContact: "2026-09-09" });
    const out = computeBriefing({
      ...empty,
      deals: [entity("Cadence/Pipeline/Deal.md", { stage: "Lead", contact: "Jane", title: "Big" })],
      contacts: [jane],
    }, NOW);
    expect(out).toEqual([{ icon: "👤", tone: "warn", text: "Jane — 31 days quiet · Big", target: { kind: "file", file: jane.file } }]);
  });

  it("falls back to the deal's basename as its title", () => {
    const out = computeBriefing({
      ...empty,
      deals: [entity("Cadence/Pipeline/Basename deal.md", { stage: "Lead", contact: "Jane" })],
      contacts: [entity("Cadence/Contacts/Jane.md", { name: "Jane" })],
    }, NOW);
    expect(out[0].text).toBe("Jane — never contacted · Basename deal");
  });

  it("picks the soonest in-window next milestone, targeting its project, and words the days", () => {
    const a = new TFile("Cadence/Projects/A.md") as never;
    const b = new TFile("Cadence/Projects/B.md") as never;
    const out = computeBriefing({
      ...empty,
      projects: [
        { file: a, name: "A", next: milestone("2026-10-13", "Later") },
        { file: b, name: "B", next: milestone("2026-10-12", "") },
        { file: a, name: "C", next: milestone(null) },
        { file: a, name: "D", next: null },
        { file: a, name: "E", next: milestone("2026-10-25") },
        { file: a, name: "F", next: milestone("2026-10-09") },
      ],
    }, NOW);
    expect(out).toEqual([{ icon: "📅", tone: "mint", text: 'B · "milestone" — due in 2 days', target: { kind: "project", file: b } }]);
  });

  it("counts wins by file mtime within the last 7 days, targeting the sales report", () => {
    const week = 7 * 86400000;
    const out = computeBriefing({
      ...empty,
      deals: [
        entity("Cadence/Pipeline/A.md", { stage: "Won", value: 10 }, NOW.getTime() - week),
        entity("Cadence/Pipeline/B.md", { stage: "Won", value: 10 }, NOW.getTime() - week - 1),
        entity("Cadence/Pipeline/C.md", { stage: "Won", value: 10 }),
      ],
    }, NOW);
    expect(out).toEqual([{ icon: "🎉", tone: "emerald", text: "1 deal won this week · $10", target: { kind: "mode", mode: "reports.sales" } }]);
  });
});

describe("visibleBriefing", () => {
  it.each([
    [false, 5, 5, 0],
    [true, 5, 3, 2],
    [true, 4, 3, 1],
    [true, 3, 3, 0],
    [true, 0, 0, 0],
  ])("mobile=%s with %i items shows %i and hides %i", (isMobile, count, shown, hidden) => {
    const items = Array.from({ length: count }, (_, i) => i);
    const out = visibleBriefing(items, isMobile);
    expect(out.shown).toEqual(items.slice(0, shown));
    expect(out.hiddenCount).toBe(hidden);
  });
});

describe("selectInboxCard", () => {
  it("counts open items and overdue ones, and sorts five rows by time with unscheduled last", () => {
    const rs = [
      reminder("u", null), reminder("c", "2026-10-12T00:00:00Z"), reminder("a", "2026-10-01T00:00:00Z"),
      reminder("x", "2026-10-01T00:00:00Z", { done: true }), reminder("b", "2026-10-10T09:00:00Z"),
      reminder("d", "2026-10-13T00:00:00Z"), reminder("e", "2026-10-14T00:00:00Z"),
    ];
    const out = selectInboxCard(rs, NOW);
    expect([out.reminders.length, out.overdueCount, out.tone, out.title]).toEqual([6, 2, "rose", "INBOX — 6 items · 2 overdue"]);
    expect(out.rows.map((r) => [r.reminder.text, r.overdue])).toEqual([["a", true], ["b", true], ["c", false], ["d", false], ["e", false]]);
  });

  it("is sky with no overdue, singular for one, and copes with no reminders", () => {
    expect(selectInboxCard([reminder("u", null)], NOW)).toMatchObject({ tone: "sky", title: "INBOX — 1 item", overdueCount: 0 });
    expect(selectInboxCard(undefined, NOW)).toMatchObject({ title: "INBOX — 0 items", rows: [] });
  });
});

describe("inboxRowMeta", () => {
  const name = (path: string) => (path === "known.md" ? "Known" : null);

  it("joins project, repeat and the first non-blank note line, truncating past 60", () => {
    expect(inboxRowMeta(reminder("r", null, { project: "known.md", repeat: "daily", notes: `\n ${"n".repeat(60)}` }), name)).toEqual([
      "📁 Known", "↻ daily", `📝  ${"n".repeat(56)}…`,
    ]);
  });

  it("falls back to 'project', reads any other repeat as weekly, and skips blank notes", () => {
    expect(inboxRowMeta(reminder("r", null, { project: "gone.md", repeat: "monthly", notes: "  \n " }), name)).toEqual([
      "📁 project", "↻ weekly",
    ]);
    expect(inboxRowMeta(reminder("r", null), name)).toEqual([]);
  });
});

describe("Today card seams", () => {
  const task = (title: string, scheduled: string, done = false) =>
    ({ file: new TFile(`TaskNotes/Tasks/${title}.md`), title, status: done ? "done" : "open", scheduled, due: "", priority: "normal", projects: "", done }) as unknown as TaskNotesTask;

  it("taskNotesToday keeps today's tasks and renders them as checklist lines", () => {
    const out = taskNotesToday([task("a", "2026-10-10"), task("b", "2026-10-11"), task("c", "2026-10-10", true)], "2026-10-10");
    expect(out.tasks.map((t) => t.title)).toEqual(["a", "c"]);
    expect(out.lines).toEqual(["- [ ] a", "- [x] c"]);
  });

  it("selectTodayCard counts open and done, and strips the checkbox prefix", () => {
    const out = selectTodayCard(["- [ ] a", "  - [X] b c", "- [x] ", "- [ ]  spaced"]);
    expect([out.open, out.done, out.title]).toEqual([2, 2, "TODAY — 2 open · 2 done"]);
    expect(out.rows).toEqual([
      { checked: false, text: "a" }, { checked: true, text: "b c" }, { checked: true, text: "" }, { checked: false, text: " spaced" },
    ]);
  });

  it("toggleTaskLine ticks and unticks only the indexed line, returning its trimmed text", () => {
    expect(toggleTaskLine(["- [ ] a", "  - [ ]  b ", "- [ ] c"], 1, true)).toEqual({ tasks: ["- [ ] a", "- [x]  b ", "- [ ] c"], taskText: "b" });
    expect(toggleTaskLine(["- [X] a"], 0, false)).toEqual({ tasks: ["- [ ] a"], taskText: "a" });
  });

  it("QUIRK: toggleTaskLine leaves a line already in the target state, and an out-of-range index changes nothing", () => {
    expect(toggleTaskLine(["- [x] a"], 0, true)).toEqual({ tasks: ["- [x] a"], taskText: "a" });
    expect(toggleTaskLine(["- [ ] a"], 3, true)).toEqual({ tasks: ["- [ ] a"], taskText: "" });
  });
});

describe("week card seams", () => {
  it("countTaskLines counts done (x/X) and open lines", () => {
    expect(countTaskLines(["- [x] a", "- [X] b", "- [ ] c", "not a task"])).toEqual({ open: 1, done: 2 });
  });

  it("countWeekTaskNotes counts tasks scheduled on one of the week's days", () => {
    const t = (scheduled: string, done: boolean) => ({ scheduled, done }) as TaskNotesTask;
    expect(countWeekTaskNotes([t("2026-10-05", true), t("2026-10-06", false), t("2026-10-04", true), t("", false)], ["2026-10-05", "2026-10-06"])).toEqual({ open: 1, done: 1 });
  });

  it.each([
    [0, 0, 0, "rose", "THIS WEEK — 0/0 done", "No tasks logged this week yet"],
    [2, 1, 33, "warn", "THIS WEEK — 1/3 done", "1 of 3 tasks completed"],
    [1, 2, 67, "mint", "THIS WEEK — 2/3 done", "2 of 3 tasks completed"],
    [0, 4, 100, "emerald", "THIS WEEK — 4/4 done", "4 of 4 tasks completed"],
  ])("weekProgress(%i open, %i done) is %i%% %s", (open, done, pct, band, title, label) => {
    expect(weekProgress(open, done)).toEqual({ total: open + done, pct, band, title, label });
  });
});

describe("selectUpcomingItems", () => {
  it("collects in-window deadlines, milestones and expiries, sorted, keeping push order on ties", () => {
    const site = entity("Cadence/Projects/Site.md", { name: "Site", due: "2026-10-12" });
    const other = entity("Cadence/Projects/Other.md", { due: "2026-10-18" });
    const reg = entity("Cadence/Registrations/R.md", { expires: "2026-10-12" });
    const cert = entity("Cadence/Certifications/C.md", { name: "AWS", expires: "2026-10-10" });
    const out = selectUpcomingItems({
      projects: [site, other],
      projectNext: [{ entity: site, next: milestone("2026-10-12", "") }, { entity: other, next: milestone("2026-10-09") }],
      registrations: [reg, entity("Cadence/Registrations/Bad.md", { expires: "never" })],
      certifications: [cert],
    }, NOW);
    expect(out.map((i) => [i.title, i.type, i.file])).toEqual([
      ["AWS", "Cert expires", cert.file],
      ["Site", "Project due", site.file],
      ["Site — milestone", "Milestone", site.file],
      ["R", "Registration expires", reg.file],
    ]);
  });

  it("includes seven days out and excludes the eighth", () => {
    const p = (due: string) => entity(`Cadence/Projects/${due}.md`, { due });
    const out = selectUpcomingItems({ projects: [p("2026-10-17"), p("2026-10-18")], projectNext: [], registrations: [], certifications: [] }, NOW);
    expect(out.map((i) => i.title)).toEqual(["2026-10-17"]);
  });
});

describe("selectPartnerRows", () => {
  it("takes five partners with their name and tier · status", () => {
    const ps = ["A", "B", "C", "D", "E", "F"].map((n, i) => entity(`Cadence/Partners/${n}.md`, i === 0 ? { tier: "Gold", status: ["Active"] } : {}));
    const out = selectPartnerRows(ps);
    expect(out.map((r) => [r.name, r.meta])).toEqual([["A", "Gold · Active"], ["B", ""], ["C", ""], ["D", ""], ["E", ""]]);
    expect(out[0].entity).toBe(ps[0]);
  });
});

describe("isHomeActiveProject", () => {
  it.each([
    [undefined, true], ["active", true], [["Active"], true], ["On Hold", true], ["on_hold", true], ["in  progress", true],
    ["done", false], ["backlog", false], [["cancelled"], false],
  ])("status %j → %s", (status, active) => {
    expect(isHomeActiveProject(entity("Cadence/Projects/P.md", status === undefined ? {} : { status }))).toBe(active);
  });
});

describe("selectPipelineCard", () => {
  it("keeps open deals, sums their value and ranks the top four", () => {
    const d = (n: string, fm: Record<string, unknown>) => entity(`Cadence/Pipeline/${n}.md`, fm);
    const deals = [d("A", { value: 1 }), d("B", { value: "5" }), d("W", { stage: "Won", value: 99 }), d("L", { stage: ["Lost"], value: 99 }), d("C", { value: 3 }), d("D", { value: "x" }), d("E", { value: 4 })];
    const out = selectPipelineCard(deals);
    expect(out.open.map((e) => e.basename)).toEqual(["A", "B", "C", "D", "E"]);
    expect(out.value).toBe(13);
    expect(out.top.map((e) => e.basename)).toEqual(["B", "E", "C", "A"]);
  });
});

describe("selectRecentActivities", () => {
  it("sorts by when, newest first, undated last, and keeps five", () => {
    const a = (n: string, when?: string) => entity(`Cadence/Activities/${n}.md`, when ? { when } : {});
    const out = selectRecentActivities([a("u"), a("1", "2026-01-01"), a("3", "2026-03-01"), a("2", "2026-02-01"), a("5", "2026-05-01"), a("4", "2026-04-01")]);
    expect(out.map((e) => e.basename)).toEqual(["5", "4", "3", "2", "1"]);
  });
});
