import { describe, expect, it } from "vitest";
import {
  appendDailyTask, appendMilestone, appendProjectTask, countTaskLines, editMilestoneByRef, editProjectTaskByRef, milestoneRefAt,
  removeMilestoneByRef, removeProjectTaskByRef, findTaskLine, replaceJournal, TASK_PREFIX, taskLineRef, taskLineRows, tickDailyTasks, tickProjectTasks,
  toggleDailyTask, toggleDailyTaskByRef,
} from "../../src/utils/task-lines";
import { toggleTaskLine as homeToggleTaskLine } from "../../src/views/home";
import { toggleTaskLine } from "../../src/utils/task-lines";

/* The (content, input) → content task rewrites shared by Home, Today, the
   Calendar and task propagation. */

const H = { tasksHeading: "## Today", journalHeading: "## Journal" };
const NOTE = "# 2026-10-10\n\n## Today\n- [ ] Ship\n- [x] Plan\n\n## Journal\nDear diary\n";

describe("TASK_PREFIX and taskLineRows", () => {
  it("strips the box and indentation, keeping the rest of the text as-is", () => {
    expect("  - [X]  spaced ".replace(TASK_PREFIX, "")).toBe(" spaced ");
    expect(taskLineRows(["- [ ] a", "  - [X] b", "- [x] "])).toEqual([
      { checked: false, text: "a" },
      { checked: true, text: "b" },
      { checked: true, text: "" },
    ]);
  });

  it("a tab after the box is a task line, checked and counted by its box", () => {
    expect(taskLineRows(["- [x]\tdone"])).toEqual([{ checked: true, text: "done" }]);
    expect(countTaskLines(["- [x]\tdone", "- [ ]\topen"])).toEqual({ open: 1, done: 1 });
  });

  it("countTaskLines counts a line with both boxes by its leading box", () => {
    expect(countTaskLines(["- [ ] see [x] here", "- [ ] a", "- [X] b"])).toEqual({ open: 2, done: 1 });
  });

  it("Home re-exports the one toggleTaskLine", () => {
    expect(homeToggleTaskLine).toBe(toggleTaskLine);
  });
});

describe("toggleDailyTask", () => {
  it("ticks the indexed task under the tasks heading and returns its trimmed text", () => {
    expect(toggleDailyTask(NOTE, H, 0, true)).toEqual({
      content: "# 2026-10-10\n\n## Today\n- [x] Ship\n- [x] Plan\n\n## Journal\nDear diary\n",
      taskText: "Ship",
    });
  });

  it("unticks, counts only checklist lines under the heading, and edits only that line", () => {
    const note = "## Today\nIntro\n- [ ] a\n  - [X] b\n## Other\n- [ ] c\n";
    expect(toggleDailyTask(note, H, 1, false)).toEqual({ content: "## Today\nIntro\n- [ ] a\n  - [ ] b\n## Other\n- [ ] c\n", taskText: "b" });
  });

  it("returns null past the end", () => {
    expect(toggleDailyTask("## Today\n- [ ] a\n## B\n", H, 5, true)).toBeNull();
  });

  it("returns null when the heading is missing, rather than adding it", () => {
    expect(toggleDailyTask("# x\n", H, 0, true)).toBeNull();
  });
});

describe("taskLineRef, findTaskLine and toggleDailyTaskByRef", () => {
  it("names a row by its text and which occurrence of that text it is", () => {
    const lines = ["- [ ] a", "  - [x] b", "- [ ] a", "- [ ] a "];
    expect([0, 1, 2, 3, 4].map((i) => taskLineRef(lines, i))).toEqual([
      { text: "a", occurrence: 0 }, { text: "b", occurrence: 0 }, { text: "a", occurrence: 1 }, { text: "a ", occurrence: 0 }, null,
    ]);
    expect(findTaskLine(["- [x] new", "- [ ] a", "- [x] a"], { text: "a", occurrence: 1 })).toBe(2);
    expect(findTaskLine(["- [ ] a"], { text: "a", occurrence: 1 })).toBe(-1);
  });

  it("ticks the same task after a line is added above it, and returns null once it is gone", () => {
    const ref = taskLineRef(["- [ ] a", "- [ ] b"], 1)!;
    expect(toggleDailyTaskByRef("## Today\n- [ ] new\n- [ ] a\n- [ ] b\n", H, ref, true)).toEqual({
      content: "## Today\n- [ ] new\n- [ ] a\n- [x] b\n", taskText: "b",
    });
    expect(toggleDailyTaskByRef("## Today\n- [ ] a\n## Other\n- [ ] b\n", H, ref, true)).toBeNull();
  });
});

describe("appendDailyTask", () => {
  it("appends an open task after the existing ones", () => {
    expect(appendDailyTask(NOTE, H, "New")).toBe("# 2026-10-10\n\n## Today\n- [ ] Ship\n- [x] Plan\n- [ ] New\n\n## Journal\nDear diary\n");
  });

  it("creates the tasks heading at the end of the note", () => {
    expect(appendDailyTask("# x\n\n## Journal\nJ\n", H, "First")).toBe("# x\n\n## Journal\nJ\n\n## Today\n- [ ] First\n");
  });

  it("keeps the text verbatim", () => {
    expect(appendDailyTask("## Today\n", H, " [[Link]] #tag ")).toBe("## Today\n- [ ]  [[Link]] #tag \n");
  });

  it("inserts one line after the last task and its indented lines, keeping notes, nesting and spacing (#76)", () => {
    const note = "## Today\nA note\n- [ ] Ship\n  - [x] Sub\n  a sub-bullet line\nAfter\n## Journal\nJ\n";
    expect(appendDailyTask(note, H, "New")).toBe("## Today\nA note\n- [ ] Ship\n  - [x] Sub\n  a sub-bullet line\n- [ ] New\nAfter\n## Journal\nJ\n");
  });

  it("with no task yet, inserts right under the heading (#76)", () => {
    expect(appendDailyTask("## Today\nJust notes\n## Journal\n", H, "New")).toBe("## Today\n- [ ] New\nJust notes\n## Journal\n");
  });
});

describe("project task row edits by ref (#76)", () => {
  const P = "# P\n\n## Tasks\nWhy these matter\n- [ ] Ship\n  - [x] Sub\n- [ ] Ship\n- note\n## Notes\nN\n";
  const ref = (text: string, occurrence = 0) => ({ text, occurrence });

  it("editProjectTaskByRef retitles only the line the ref names, keeping its box and indentation", () => {
    expect(editProjectTaskByRef(P, "Tasks", ref("Ship", 1), "Ship v2")).toBe(P.replace("- [ ] Ship\n- note", "- [ ] Ship v2\n- note"));
    expect(editProjectTaskByRef(P, "Tasks", ref("Sub"), "Child")).toBe(P.replace("  - [x] Sub", "  - [x] Child"));
    expect(editProjectTaskByRef(P, "Tasks", ref("Gone"), "x")).toBeNull();
    expect(editProjectTaskByRef(P, "Todo", ref("Ship"), "x")).toBeNull();
  });

  it("removeProjectTaskByRef removes only that line", () => {
    expect(removeProjectTaskByRef(P, "Tasks", ref("Ship"))).toBe("# P\n\n## Tasks\nWhy these matter\n  - [x] Sub\n- [ ] Ship\n- note\n## Notes\nN\n");
    expect(removeProjectTaskByRef(P, "Tasks", ref("Ship", 2))).toBeNull();
  });

  it("appendProjectTask inserts after the last task, under the heading, or appends the section", () => {
    expect(appendProjectTask(P, "Tasks")).toBe(P.replace("- [ ] Ship\n- note", "- [ ] Ship\n- [ ] \n- note"));
    expect(appendProjectTask("## Tasks\nIntro\n## Notes\n", "Tasks")).toBe("## Tasks\n- [ ] \nIntro\n## Notes\n");
    expect(appendProjectTask("Intro", "Todo #tasks", "A")).toBe("Intro\n\n## Todo #tasks\n- [ ] A\n");
  });
});

describe("milestone row edits by ref (#76)", () => {
  const M = "## Milestones\nPlan notes\n- [ ] 2026-10-01 — Kickoff\n    agenda\n\tbring slides\n- [x] Launch\nnot a note\n## Tasks\n- [ ] T\n";
  const kickoff = { done: false, date: new Date(2026, 9, 1), title: "Kickoff", notes: "agenda\nbring slides" };
  const launch = { done: true, date: null, title: "Launch", notes: "" };

  it("milestoneRefAt names an item by its box, date and title, and which occurrence of those it is", () => {
    expect(milestoneRefAt([kickoff, launch, { ...launch }], 2)).toEqual({ key: "x||Launch", occurrence: 1 });
    expect(milestoneRefAt([kickoff], 1)).toBeNull();
  });

  it("editMilestoneByRef rewrites the head line, and the note lines only when the notes change", () => {
    const ref = milestoneRefAt([kickoff, launch], 0)!;
    expect(editMilestoneByRef(M, "Milestones", ref, { ...kickoff, done: true, title: "Kick-off" })).toBe(
      M.replace("- [ ] 2026-10-01 — Kickoff", "- [x] 2026-10-01 — Kick-off"),
    );
    expect(editMilestoneByRef(M, "Milestones", ref, { ...kickoff, notes: "agenda only" })).toBe(
      M.replace("    agenda\n\tbring slides\n", "    agenda only\n"),
    );
    expect(editMilestoneByRef(M, "Milestones", milestoneRefAt([launch], 0)!, { ...launch, notes: "went well" })).toBe(
      M.replace("- [x] Launch\n", "- [x] Launch\n    went well\n"),
    );
    expect(editMilestoneByRef(M, "Milestones", { key: " |2026-10-01|Kickoff", occurrence: 1 }, kickoff)).toBeNull();
  });

  it("removeMilestoneByRef removes the head line and its note lines only", () => {
    expect(removeMilestoneByRef(M, "Milestones", milestoneRefAt([kickoff], 0)!)).toBe("## Milestones\nPlan notes\n- [x] Launch\nnot a note\n## Tasks\n- [ ] T\n");
  });

  it("appendMilestone inserts after the last milestone and its notes, under the heading, or appends the section", () => {
    const fresh = { done: false, date: new Date(2026, 9, 15), title: "" };
    const withNotes = "## Milestones\n- [ ] A\n    note\nTrailing\n";
    expect(appendMilestone(withNotes, "Milestones", fresh)).toBe("## Milestones\n- [ ] A\n    note\n- [ ] 2026-10-15\nTrailing\n");
    expect(appendMilestone("## Milestones\nIntro\n", "Milestones", fresh)).toBe("## Milestones\n- [ ] 2026-10-15\nIntro\n");
    expect(appendMilestone("## Brief\nx\n\n", "Plan #milestones", { done: false, title: "A" })).toBe("## Brief\nx\n\n## Plan #milestones\n- [ ] A\n");
  });
});

describe("replaceJournal", () => {
  it("replaces the journal body", () => {
    expect(replaceJournal(NOTE, H, "Line 1\nLine 2")).toBe("# 2026-10-10\n\n## Today\n- [ ] Ship\n- [x] Plan\n\n## Journal\nLine 1\nLine 2\n");
  });

  it("writes an empty body for null or undefined", () => {
    expect(replaceJournal("## Journal\nold\n", H, null)).toBe("## Journal\n\n");
    expect(replaceJournal("## Journal\nold\n", H, undefined)).toBe("## Journal\n\n");
  });

  it("appends the heading when missing", () => {
    expect(replaceJournal("# x", H, "hi")).toBe("# x\n\n## Journal\nhi\n");
  });
});

describe("tickProjectTasks", () => {
  const P = "# P\n\n## Tasks\n- [ ] Ship\n- [ ] Other\n\n## Notes\nN\n";

  it("ticks matching tasks by trimmed title and rewrites ## Tasks", () => {
    expect(tickProjectTasks(P, "Ship", true)).toBe("# P\n\n## Tasks\n- [x] Ship\n- [ ] Other\n\n## Notes\nN\n");
  });

  it("returns null when nothing changes or there is no Tasks section", () => {
    expect(tickProjectTasks(P, "Ship", false)).toBeNull();
    expect(tickProjectTasks(P, "Nope", true)).toBeNull();
    expect(tickProjectTasks("## Brief\n- [ ] Ship\n", "Ship", true)).toBeNull();
  });

  it("matches every tasks section: a tagged Tasks heading, or any label with a #tasks tag", () => {
    expect(tickProjectTasks("## Tasks #todo\n- [ ] Ship\n", "Ship", true)).toBe("## Tasks #todo\n- [x] Ship\n");
    expect(tickProjectTasks("## Todo #tasks\n- [ ] Ship\n## Notes\n- [ ] Ship\n", "Ship", true)).toBe("## Todo #tasks\n- [x] Ship\n## Notes\n- [ ] Ship\n");
  });
});

describe("tickDailyTasks", () => {
  it("ticks and unticks matching lines under the tasks heading", () => {
    expect(tickDailyTasks(NOTE, H, "Ship", true)).toBe("# 2026-10-10\n\n## Today\n- [x] Ship\n- [x] Plan\n\n## Journal\nDear diary\n");
    expect(tickDailyTasks(NOTE, H, "Plan", false)).toBe("# 2026-10-10\n\n## Today\n- [ ] Ship\n- [ ] Plan\n\n## Journal\nDear diary\n");
  });

  it("returns null when no line changes", () => {
    expect(tickDailyTasks(NOTE, H, "Plan", true)).toBeNull();
    expect(tickDailyTasks(NOTE, H, "Nope", true)).toBeNull();
  });

  it("ignores tasks outside the tasks heading", () => {
    expect(tickDailyTasks("## Other\n- [ ] Ship\n", H, "Ship", true)).toBeNull();
  });
});
