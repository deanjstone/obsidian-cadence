import { describe, expect, it } from "vitest";
import { TFile } from "../mocks/obsidian";
import { ENTITIES } from "../../src/constants/entities";
import { metaControl } from "../../src/utils/field-edit";
import { reminderTimeStr } from "../../src/utils/reminders";
import { companyMetaControl } from "../../src/views/company-detail";
import {
  PROJECT_PRIORITY_FALLBACK, PROJECT_STATUS_FALLBACK, PROJECT_TEXT_SECTIONS, TASKNOTES_FOLDER, TASKNOTES_PROMPT, addMilestone,
  addTask, commitMilestones, commitTasks, milestoneCardTitle, milestoneDateFromInput, milestoneDateValue, newTaskReminder,
  projectDetailTitle, projectMetaFields, projectPills, projectProgress, projectTextSection, removeItem, taskBell, taskCardTitle,
  taskNoteContent, taskNotePath, taskNotesItems, updateItem, writeProjectFrontmatter,
} from "../../src/views/project-detail";
import type { EntityDef, Frontmatter, TaskNotesTask } from "../../src/types/entities";
import type { Reminder } from "../../src/types/reminders";
import type { Milestone } from "../../src/utils/parsing";

/* Direct tests for the project detail page's pure seams. */

const DOC = "## Brief\nGo\n## Milestones\n- [ ] Old\n## Tasks\n- [ ] Old\n## Notes\nN\n";

describe("project page seams", () => {
  it("projectDetailTitle: name when truthy, else the basename", () => {
    expect(projectDetailTitle({ name: "Apollo" }, "apollo")).toBe("Apollo");
    expect(projectDetailTitle({ name: 0 }, "zero")).toBe("zero");
    expect(projectDetailTitle({}, "bare")).toBe("bare");
  });

  it("projectPills: status and priority with their classes, current values and defaults", () => {
    expect(projectPills({ status: "on_hold", priority: "High" }, ["a"], ["b"])).toEqual([
      { key: "status", cls: "cad-pill cad-pill-on_hold", options: ["a"], current: "on_hold" },
      { key: "priority", cls: "cad-pill cad-pill-prio-high", options: ["b"], current: "High" },
    ]);
    expect(projectPills({}, PROJECT_STATUS_FALLBACK, PROJECT_PRIORITY_FALLBACK).map((p) => [p.cls, p.current])).toEqual([
      ["cad-pill cad-pill-active", "active"], ["cad-pill cad-pill-prio-medium", "medium"],
    ]);
    expect(projectPills({ status: "In  Review\tNow", priority: 3 }, [], []).map((p) => [p.cls, p.current])).toEqual([
      ["cad-pill cad-pill-in-review-now", "In  Review\tNow"], ["cad-pill cad-pill-prio-3", "3"],
    ]);
    expect([PROJECT_STATUS_FALLBACK, PROJECT_PRIORITY_FALLBACK]).toEqual([
      ["active", "on_hold", "backlog", "done", "cancelled"], ["low", "medium", "high"],
    ]);
  });

  it("projectMetaFields: drops primary, status, priority and a non-enum type", () => {
    expect(projectMetaFields(ENTITIES.project).map((f) => f.key)).toEqual(["owner", "started", "due", "tags"]);
    const def = {
      fields: [
        { key: "title", label: "T", primary: true }, { key: "status", label: "S", type: "text" }, { key: "type", label: "Ty" },
        { key: "type", label: "Ty2", type: "enum" }, { key: "x", label: "X" },
      ],
    } as EntityDef;
    expect(projectMetaFields(def).map((f) => f.label)).toEqual(["Ty2", "X"]);
  });

  it("writeProjectFrontmatter: deletes null, undefined and '', writes the rest (an empty list included)", () => {
    const fm: Frontmatter = { a: 1, b: 2, c: 3, keep: "k" };
    writeProjectFrontmatter(fm, { a: null, b: undefined, c: "", d: [], e: 0, f: false, g: "x" });
    expect(fm).toEqual({ keep: "k", d: [], e: 0, f: false, g: "x" });
  });

  it("projectProgress: null without milestones, else the band, label and percent", () => {
    expect(projectProgress({ total: 0, done: 0, percent: 0 })).toBeNull();
    expect(projectProgress({ total: 3, done: 1, percent: 33 })).toEqual({ band: "warn", label: "1/3 milestones complete", percent: "33%" });
    expect(projectProgress({ total: 4, done: 0, percent: 0 })?.band).toBe("rose");
    expect(projectProgress({ total: 2, done: 2, percent: 100 })).toEqual({ band: "emerald", label: "2/2 milestones complete", percent: "100%" });
  });

  it("projectTextSection: the standard card for a known label (case and tag ignored), else null", () => {
    expect(projectTextSection("Risks #text")).toEqual({ key: "Risks #text", label: "RISKS", rows: 4, placeholder: "What could go wrong." });
    expect(projectTextSection("STAKEHOLDERS")).toEqual({ key: "STAKEHOLDERS", ...PROJECT_TEXT_SECTIONS.stakeholders });
    expect(projectTextSection("Milestones")).toBeNull();
    expect(projectTextSection("Brief notes")).toBeNull();
    expect(Object.keys(PROJECT_TEXT_SECTIONS)).toEqual(["brief", "scope", "risks", "stakeholders", "notes"]);
  });

  it("QUIRK: projectTextSection matches inherited object members, yielding a card with no label", () => {
    expect(projectTextSection("Constructor")).toEqual({ key: "Constructor", label: undefined, rows: undefined, placeholder: undefined });
  });

  it("metaControl is the company page's companyMetaControl, shared with the project page", () => {
    expect(companyMetaControl).toBe(metaControl);
    expect(ENTITIES.project.fields.map(metaControl)).toEqual(["input", "enum", "enum", "chips", "input", "input", "chips"]);
  });
});

describe("milestone seams", () => {
  const ms = (): Milestone[] => [
    { done: true, date: new Date("2026-09-15"), title: "Kickoff", notes: "" },
    { done: false, date: null, title: "Beta", notes: "n" },
  ];

  it("milestoneCardTitle: clean label, then done/total", () => {
    expect(milestoneCardTitle("Milestones", ms())).toBe("MILESTONES · 1/2");
    expect(milestoneCardTitle("Road map #milestones", [])).toBe("ROAD MAP · 0/0");
  });

  it("milestoneDateValue and milestoneDateFromInput", () => {
    expect(milestoneDateValue(new Date("2026-09-15T23:00:00Z"))).toBe("2026-09-15");
    expect([milestoneDateValue(null), milestoneDateValue(new Date("x")), milestoneDateValue("2026-09-15")]).toEqual([null, null, null]);
    expect(milestoneDateFromInput("2027-02-01")?.toISOString()).toBe("2027-02-01T00:00:00.000Z");
    expect(milestoneDateFromInput("")).toBeNull();
  });

  it("commitMilestones: rewrites the section, or appends it under the raw key", () => {
    expect(commitMilestones(DOC, ms())).toBe(
      "## Brief\nGo\n## Milestones\n- [x] 2026-09-15 — Kickoff\n- [ ] Beta\n    n\n\n## Tasks\n- [ ] Old\n## Notes\nN\n",
    );
    expect(commitMilestones(DOC, [])).toBe("## Brief\nGo\n## Milestones\n\n## Tasks\n- [ ] Old\n## Notes\nN\n");
    expect(commitMilestones("Intro\n\n", [{ title: "A" }], "Plan #milestones")).toBe("Intro\n\n## Plan #milestones\n- [ ] A\n");
  });

  it("updateItem and removeItem return new lists and leave the input alone", () => {
    const items = ms();
    const ticked = updateItem(items, 1, { done: true });
    expect(ticked.map((m) => m.done)).toEqual([true, true]);
    expect([items[1].done, ticked[0] === items[0], ticked[1] === items[1]]).toEqual([false, true, false]);
    expect(updateItem(items, 0, { notes: "x", title: "K" })[0]).toEqual({ ...items[0], notes: "x", title: "K" });
    expect(removeItem(items, 0).map((m) => m.title)).toEqual(["Beta"]);
    expect(removeItem(items, 5)).toEqual(items);
    expect(items).toHaveLength(2);
  });

  it("updateItem throws for a missing item, as assigning to it did", () => {
    expect(() => updateItem(ms(), 2, { title: "x" })).toThrow(TypeError);
  });

  it("addMilestone appends an untitled open milestone dated today, without notes", () => {
    const today = new Date("2026-10-10T09:00:00Z");
    const items = ms();
    const next = addMilestone(items, today);
    expect(next[2]).toEqual({ done: false, date: today, title: "" });
    expect([next.length, items.length]).toEqual([3, 2]);
  });
});

describe("task seams", () => {
  it("taskCardTitle: clean label, open and done counts", () => {
    expect(taskCardTitle("Tasks", [{ done: false }, { done: true }, { done: false }])).toBe("TASKS · 2 open · 1 done");
    expect(taskCardTitle("Todo #tasks", [])).toBe("TODO · 0 open · 0 done");
  });

  it("taskNotesItems keeps each task note's done and title", () => {
    const tasks = [
      { file: new TFile("TaskNotes/Tasks/a.md"), title: "A", done: true, status: "done" },
      { file: new TFile("TaskNotes/Tasks/b.md"), title: "B", done: false, status: "open" },
    ] as unknown as TaskNotesTask[];
    expect(taskNotesItems(tasks)).toEqual([{ done: true, title: "A" }, { done: false, title: "B" }]);
  });

  it("commitTasks: rewrites the section, or appends it under the raw key", () => {
    expect(commitTasks(DOC, [{ done: true, title: "New" }, {}])).toBe(
      "## Brief\nGo\n## Milestones\n- [ ] Old\n## Tasks\n- [x] New\n- [ ] \n\n## Notes\nN\n",
    );
    expect(commitTasks("", [{ title: "A" }], "Todo #tasks")).toBe("\n\n## Todo #tasks\n- [ ] A\n");
  });

  it("addTask appends an empty open task", () => {
    const items = [{ done: true, title: "A" }];
    expect(addTask(items)).toEqual([{ done: true, title: "A" }, { done: false, title: "" }]);
    expect(items).toHaveLength(1);
  });

  it("taskBell: muted when unlinked, rung and timed when linked", () => {
    expect(taskBell(null)).toEqual({ cls: "cad-btn cad-btn-sm cad-pd-task-bell", text: "🔕", title: "Set a reminder for this task" });
    const linked = { id: "r", text: "T", when: "2026-10-12T09:30:00" } as Reminder;
    expect(taskBell(linked)).toEqual({
      cls: "cad-btn cad-btn-sm cad-pd-task-bell linked", text: "🔔", title: `Edit reminder · ${reminderTimeStr(linked.when)}`,
    });
    expect(taskBell({ ...linked, when: null }).title).toBe("Edit reminder");
  });

  it("newTaskReminder: an unscheduled, non-repeating reminder on the project", () => {
    expect(newTaskReminder("Call", "Cadence/Projects/A.md")).toEqual({
      text: "Call", when: null, repeat: "none", notes: "", project: "Cadence/Projects/A.md",
    });
  });

  it("taskNotePath strips unsafe characters and numbers a taken path", () => {
    const taken = new Set(["F/Ship.md", "F/Ship (1).md"]);
    expect(taskNotePath("F", ' Ship ', (p) => taken.has(p))).toBe("F/Ship (2).md");
    expect(taskNotePath("F", 'a\\b/c:d*e?f"g<h>i|j', () => false)).toBe("F/abcdefghij.md");
    expect(taskNotePath(TASKNOTES_FOLDER, "New", () => false)).toBe("TaskNotes/Tasks/New.md");
  });

  it("taskNoteContent: open, scheduled today, linked to the project, title unquoted", () => {
    expect(taskNoteContent("Fix: it", new Date("2026-10-10T09:00:00Z"), "Apollo")).toBe(
      '---\ntitle: Fix: it\nstatus: open\nscheduled: 2026-10-10\nprojects: "[[Apollo]]"\npriority: normal\n---\n',
    );
    expect(TASKNOTES_PROMPT).toEqual({ title: "Ajouter une tâche (TaskNotes)", placeholder: "Que faut-il faire ?", cta: "Ajouter" });
  });
});
