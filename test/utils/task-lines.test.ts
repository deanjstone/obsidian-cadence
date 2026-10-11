import { describe, expect, it } from "vitest";
import {
  appendDailyTask, countTaskLines, findTaskLine, replaceJournal, TASK_PREFIX, taskLineRef, taskLineRows, tickDailyTasks, tickProjectTasks,
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
