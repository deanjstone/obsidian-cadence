import { describe, expect, it } from "vitest";
import {
  appendDailyTask, countTaskLines, replaceJournal, TASK_PREFIX, taskLineRows, tickDailyTasks, tickProjectTasks, toggleDailyTask,
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

  it("QUIRK: a tab after the box is a task line but neither checked nor counted", () => {
    expect(taskLineRows(["- [x]\tdone"])).toEqual([{ checked: false, text: "done" }]);
    expect(countTaskLines(["- [x]\tdone", "- [ ]\topen"])).toEqual({ open: 0, done: 0 });
  });

  it("countTaskLines counts a line with both boxes as done", () => {
    expect(countTaskLines(["- [ ] see [x] here", "- [ ] a", "- [X] b"])).toEqual({ open: 1, done: 2 });
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

  it("unticks, and counts only checklist lines under the heading", () => {
    const note = "## Today\nIntro\n- [ ] a\n- [X] b\n## Other\n- [ ] c\n";
    expect(toggleDailyTask(note, H, 1, false)).toEqual({ content: "## Today\n- [ ] a\n- [ ] b\n\n## Other\n- [ ] c\n", taskText: "b" });
  });

  it("past the end rewrites the section unchanged and returns empty text", () => {
    expect(toggleDailyTask("## Today\n- [ ] a\n## B\n", H, 5, true)).toEqual({ content: "## Today\n- [ ] a\n\n## B\n", taskText: "" });
  });

  it("adds the heading when missing", () => {
    expect(toggleDailyTask("# x\n", H, 0, true)).toEqual({ content: "# x\n\n## Today\n\n", taskText: "" });
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

  it("does not match a tagged Tasks heading", () => {
    expect(tickProjectTasks("## Tasks #todo\n- [ ] Ship\n", "Ship", true)).toBeNull();
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
