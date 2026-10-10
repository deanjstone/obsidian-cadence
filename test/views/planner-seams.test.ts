import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  inboxRowActions, inboxRows, notesPreview, openProjectTasks, overdueCount, projectTasksHeading, repeatLabel, tomorrowAtNine,
} from "../../src/views/inbox";
import { customSectionKeys, journalRows, taskNotesProjectPath, todaySummary } from "../../src/views/today";
import { plannerWeek, plannerWeekTitle } from "../../src/views/calendar";
import { propagationTargets, taskLinkKey } from "../../src/views/task-links";
import type { Reminder } from "../../src/types/reminders";

/* The Planner's pure seams: Inbox rows and buttons, Today's summary and
   sections, the Calendar week grid, and which notes a task tick touches.
   Time is frozen at Saturday 2026-10-10 09:00 UTC where the clock matters. */

const NOW = new Date("2026-10-10T09:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

const reminder = (id: string, when: string | null, extra: Partial<Reminder> = {}): Reminder => ({
  id, text: id, when, repeat: "none", notes: "", project: null, notified: false, done: false, createdAt: "", ...extra,
});

describe("overdueCount", () => {
  it("counts open reminders due at or before now", () => {
    const rs = [
      reminder("a", "2026-10-10T09:00:00Z"),
      reminder("b", "2026-10-10T09:00:01Z"),
      reminder("c", "2026-09-01T00:00:00Z", { done: true }),
      reminder("d", null),
      reminder("e", "bad"),
    ];
    expect(overdueCount(rs, NOW.getTime())).toBe(1);
    expect(overdueCount(rs, NOW.getTime() + 1000)).toBe(2);
    expect(overdueCount(undefined, NOW.getTime())).toBe(0);
  });
});

describe("inboxRows", () => {
  it("returns the count, subtitle and non-empty sections in bucket order", () => {
    const out = inboxRows([
      reminder("later", null),
      reminder("week", "2026-10-12T09:00:00Z"),
      reminder("now", "2026-10-10T09:30:00Z"),
      reminder("done", "2026-10-10T09:30:00Z", { done: true }),
    ]);
    expect(out.count).toBe(3);
    expect(out.subtitle).toBe("3 items · capture once, surface at the right time");
    expect(out.sections.map((s) => [s.key, s.label, s.items.map((r) => r.id)])).toEqual([
      ["now", "NOW · OVERDUE OR DUE WITHIN 1 HOUR · 1", ["now"]],
      ["week", "THIS WEEK · 1", ["week"]],
      ["later", "LATER · UNSCHEDULED · 1", ["later"]],
    ]);
  });

  it("orders by time, then newest capture, and leaves the input array alone", () => {
    const rs = [
      reminder("u-old", null, { createdAt: "2026-10-01T00:00:00Z" }),
      reminder("u-new", null, { createdAt: "2026-10-09T00:00:00Z" }),
      reminder("t2", "2026-10-10T20:00:00Z"),
      reminder("t1", "2026-10-10T18:00:00Z"),
    ];
    const out = inboxRows(rs);
    expect(out.sections.flatMap((s) => s.items.map((r) => r.id))).toEqual(["t1", "t2", "u-new", "u-old"]);
    expect(rs.map((r) => r.id)).toEqual(["u-old", "u-new", "t2", "t1"]);
  });

  it("says '1 item' and has no sections when empty", () => {
    expect(inboxRows([reminder("a", null)]).subtitle).toBe("1 item · capture once, surface at the right time");
    expect(inboxRows(undefined)).toEqual({ count: 0, subtitle: "0 items · capture once, surface at the right time", sections: [] });
  });

  it("buckets against the frozen clock", () => {
    vi.setSystemTime(new Date("2026-10-10T23:30:00Z"));
    expect(inboxRows([reminder("a", "2026-10-11T00:15:00Z")]).sections[0].key).toBe("now");
  });
});

describe("Inbox row seams", () => {
  it("openProjectTasks keeps open, titled tasks from ## Tasks only", () => {
    expect(openProjectTasks("## Brief\n- [ ] no\n## Tasks\n- [ ] a\n- [x] b\n- [ ] \n  - [ ] c\n## Notes\n- [ ] no\n")).toEqual([
      { done: false, title: "a" },
      { done: false, title: "c" },
    ]);
    expect(openProjectTasks("## Tasks\n   \n")).toEqual([]);
    expect(openProjectTasks("")).toEqual([]);
  });

  it("projectTasksHeading pluralises projects", () => {
    expect(projectTasksHeading(1, 1)).toBe("PROJECT TASKS · 1 open across 1 project");
    expect(projectTasksHeading(5, 2)).toBe("PROJECT TASKS · 5 open across 2 projects");
  });

  it("repeatLabel: none, daily, and everything else weekly", () => {
    expect([null, undefined, "", "none", "daily", "weekly", "monthly"].map((r) => repeatLabel(r))).toEqual([
      null, null, null, null, "↻ daily", "↻ weekly", "↻ weekly",
    ]);
  });

  it("notesPreview takes the first non-blank line and truncates past 120", () => {
    expect(notesPreview("\n \nfirst\nsecond")).toBe("first");
    expect(notesPreview("  indented  ")).toBe("  indented  ");
    expect(notesPreview("a".repeat(120))).toBe("a".repeat(120));
    expect(notesPreview("b".repeat(200))).toBe("b".repeat(117) + "…");
    expect(notesPreview("")).toBe("");
    expect(notesPreview(null)).toBe("");
    expect(notesPreview(" \n ")).toBe("");
  });

  it("tomorrowAtNine is 09:00 local the next day", () => {
    expect(tomorrowAtNine(new Date("2026-10-10T23:59:00Z"))).toBe("2026-10-11T09:00:00.000Z");
    expect(tomorrowAtNine(new Date("2026-12-31T08:00:00Z"))).toBe("2027-01-01T09:00:00.000Z");
  });

  it("inboxRowActions: snoozes for a scheduled item, Schedule otherwise", () => {
    expect(inboxRowActions(true).map((a) => [a.action, a.label, a.title])).toEqual([
      ["snooze15", "+15m", "Snooze 15 minutes"],
      ["snooze60", "+1h", "Snooze 1 hour"],
      ["tomorrow", "Tom.", "Snooze to tomorrow 9am"],
      ["edit", "Edit", "Edit details + notes"],
      ["done", "Done", "Mark done"],
      ["delete", "×", "Delete"],
    ]);
    expect(inboxRowActions(false).map((a) => a.action)).toEqual(["schedule", "edit", "done", "delete"]);
  });
});

describe("Today seams", () => {
  it("todaySummary greets by open count and labels open and done", () => {
    expect(todaySummary([], "Hi")).toEqual({ greeting: "Hi. Nothing on the books — your day is clear.", count: "0 open · 0 done" });
    expect(todaySummary(["- [ ] a", "- [x] b"], "Hi")).toEqual({ greeting: "Hi. You have 1 thing to handle.", count: "1 open · 1 done" });
    expect(todaySummary(["- [ ] a", "- [ ] b"], "Yo").greeting).toBe("Yo. You have 2 things to handle.");
  });

  it("QUIRK: todaySummary counts every non-open line as done", () => {
    expect(todaySummary(["- [ ]\ttabbed", "- [x] b"], "Hi").count).toBe("0 open · 2 done");
  });

  it("taskNotesProjectPath resolves the first projects link by basename", () => {
    const files = [{ basename: "Website relaunch", path: "Cadence/Projects/Website relaunch.md" }, { basename: "Other", path: "x/Other.md" }];
    expect(taskNotesProjectPath(["[[Website relaunch]]", "[[Other]]"], files)).toBe("Cadence/Projects/Website relaunch.md");
    expect(taskNotesProjectPath("[[Other|alias]]", files)).toBe("x/Other.md");
    expect(taskNotesProjectPath("[[Missing]]", files)).toBeNull();
    expect(taskNotesProjectPath("", files)).toBeNull();
    expect(taskNotesProjectPath([], files)).toBeNull();
  });

  it("customSectionKeys drops the tasks and journal headings by clean label, case-insensitively", () => {
    const sections = { Today: "", "today #x": "", Journal: "", "Notes #text": "", Habits: "" };
    expect(customSectionKeys(sections, { tasksHeading: "## Today", journalHeading: "## Journal" })).toEqual(["Notes #text", "Habits"]);
    expect(customSectionKeys(sections, {})).toEqual(["Notes #text", "Habits"]);
    expect(customSectionKeys(sections, { tasksHeading: "## Habits", journalHeading: "## Journal" })).toEqual(["Today", "today #x", "Notes #text"]);
  });

  it("journalRows is the line count plus two, at least eight", () => {
    expect([journalRows(""), journalRows("a\nb\nc\nd\ne\nf"), journalRows("a\n".repeat(9))]).toEqual([8, 8, 12]);
  });
});

describe("Calendar seams", () => {
  const day = (iso: string, exists: boolean, tasks: string[]) => ({ date: new Date(iso), exists, tasks });

  it("plannerWeekTitle spans the first and seventh day", () => {
    const days = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 11, 28 + i)));
    expect(plannerWeekTitle(days)).toBe("December 28 – January 3, 2027");
  });

  it("plannerWeek totals the week and describes each column", () => {
    const week = plannerWeek(
      [
        day("2026-10-09T00:00:00Z", true, ["- [ ] a", "- [x] b"]),
        day("2026-10-10T00:00:00Z", true, []),
        day("2026-10-11T00:00:00Z", false, []),
      ],
      new Date("2026-10-10T00:00:00Z"),
    );
    expect(week.stats).toEqual({ open: 1, done: 1, total: 2 });
    expect(week.columns).toEqual([
      { isToday: false, weekday: "FRI", dayNum: "9", meta: "1 open · 1 done", empty: null, rows: [{ checked: false, text: "a" }, { checked: true, text: "b" }] },
      { isToday: true, weekday: "SAT", dayNum: "10", meta: "0 open · 0 done", empty: "—", rows: [] },
      { isToday: false, weekday: "SUN", dayNum: "11", meta: "no note", empty: "", rows: [] },
    ]);
  });

  it("QUIRK: a line with both boxes is done in the totals but both open and done in its column", () => {
    const week = plannerWeek([day("2026-10-09T00:00:00Z", true, ["- [ ] see [x] here"])], NOW);
    expect(week.stats).toEqual({ open: 0, done: 1, total: 1 });
    expect(week.columns[0].meta).toBe("1 open · 1 done");
  });

  it("shows tasks even for a day without a note (TaskNotes mode)", () => {
    const week = plannerWeek([day("2026-10-09T00:00:00Z", false, ["- [ ] a"])], NOW);
    expect([week.columns[0].meta, week.columns[0].empty, week.columns[0].rows]).toEqual(["no note", null, [{ checked: false, text: "a" }]]);
  });
});

describe("propagationTargets", () => {
  const file = (path: string) => ({ path }) as never;

  it("is null for blank text", () => {
    expect(propagationTargets("  ", true, undefined, [reminder("a", null)], "daily", NOW)).toBeNull();
    expect(propagationTargets(null, true, undefined, [], "daily", NOW)).toBeNull();
  });

  it("with no matches, touches only today's daily note", () => {
    expect(propagationTargets(" Ship ", true, undefined, [], "daily/", NOW)).toEqual({
      text: "Ship", reminderIds: [], projectPaths: [], dailyPaths: ["daily/2026-10-10.md"],
    });
    expect(propagationTargets("Ship", true, undefined, [], "", NOW)!.dailyPaths).toEqual(["2026-10-10.md"]);
  });

  it("collects reminders to flip, their projects once each, and their date notes", () => {
    const rs = [
      reminder("r1", "2026-10-12T15:00:00Z", { text: " Ship", project: "P/A.md", createdAt: "2026-10-01T00:00:00Z" }),
      reminder("r2", null, { text: "Ship", project: "P/A.md", done: true }),
      reminder("r3", "garbage", { text: "Ship", project: "P/B.md", createdAt: "nope" }),
      reminder("r4", "2026-10-20T00:00:00Z", { text: "Other", project: "P/C.md" }),
    ];
    expect(propagationTargets("Ship", true, undefined, rs, "daily", NOW)).toEqual({
      text: "Ship",
      reminderIds: ["r1", "r3"],
      projectPaths: ["P/A.md", "P/B.md"],
      dailyPaths: ["daily/2026-10-10.md", "daily/2026-10-12.md", "daily/2026-10-01.md"],
    });
  });

  it("a reminder source is skipped as a reminder but still ticks its project", () => {
    const rs = [reminder("r1", null, { text: "Ship", project: "P/A.md" }), reminder("r2", null, { text: "Ship" })];
    const out = propagationTargets("Ship", true, { kind: "reminder", id: "r1" }, rs, "daily", NOW)!;
    expect([out.reminderIds, out.projectPaths]).toEqual([["r2"], ["P/A.md"]]);
  });

  it("a project source skips its own project", () => {
    const rs = [reminder("r1", null, { text: "Ship", project: "P/A.md" }), reminder("r2", null, { text: "Ship", project: "P/B.md" })];
    expect(propagationTargets("Ship", false, { kind: "project", file: file("P/A.md") }, rs, "daily", NOW)!.projectPaths).toEqual(["P/B.md"]);
  });

  it("a daily source adds its date and skips its own note", () => {
    const source = { kind: "daily", file: file("daily/2026-10-08.md"), date: new Date("2026-10-08T12:00:00Z") };
    expect(propagationTargets("Ship", true, source, [], "daily", NOW)!.dailyPaths).toEqual(["daily/2026-10-10.md"]);
    const other = { kind: "daily", file: file("daily/2026-10-10.md"), date: new Date("2026-10-08T12:00:00Z") };
    expect(propagationTargets("Ship", true, other, [], "daily", NOW)!.dailyPaths).toEqual(["daily/2026-10-08.md"]);
  });

  it("uses the passed clock for today's note", () => {
    expect(propagationTargets("Ship", true, undefined, [], "d", new Date("2027-01-02T10:00:00Z"))!.dailyPaths).toEqual(["d/2027-01-02.md"]);
  });
});

describe("taskLinkKey", () => {
  it("is pure: path, '::' and trimmed text", () => {
    expect(taskLinkKey("a.md", "  x ")).toBe("a.md::x");
    expect(taskLinkKey("a.md", null)).toBe("a.md::");
  });
});
