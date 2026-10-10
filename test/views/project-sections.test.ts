import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, Notice, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";
import { CadenceReminderEditModal } from "../../src/modals/reminder-edit";
import { parseMilestones, parseTasksList } from "../../src/utils/parsing";
import { reminderTimeStr } from "../../src/utils/reminders";

/* Characterization tests for the project page's checklist sections:
   _renderMilestoneSection and _commitMilestones, _renderTaskSection and
   _commitTasks (native and TaskNotes), and the frontmatter write behind
   every project field, _writeProjectFrontmatter. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T09:00:00Z"));
  Notice.messages.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const MILESTONES = "- [x] 2026-09-15 — Kickoff\n    Went well\n- [ ] 2026-11-01 — Beta\n- [ ] Launch";
const APOLLO: MockFileSpec = {
  path: "Cadence/Projects/Apollo.md",
  frontmatter: { name: "Apollo" },
  body: `## Brief\nGo\n## Milestones\n${MILESTONES}\n## Tasks\n- [ ] Plan\n- [x] Hire\n## Notes\nN\n`,
};

function setup(files: MockFileSpec[] = [APOLLO], settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files, settings });
  const parent = new FakeElement("div");
  const rendered = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
  const propagated = vi.spyOn(made.view, "_propagateTaskComplete").mockResolvedValue(undefined);
  const flashSaved = vi.fn();
  const file = (path = APOLLO.path) => made.app.vault.getAbstractFileByPath(path) as Any;
  const read = (path = APOLLO.path) => made.app.vault.read(file(path));
  const section = async (heading: string, path = APOLLO.path) => {
    const content = await read(path);
    const start = content.indexOf(`${heading}\n`);
    const rest = content.slice(start + heading.length + 1);
    const end = rest.indexOf("\n## ");
    return end === -1 ? rest : rest.slice(0, end);
  };
  const milestones = (list = parseMilestones(MILESTONES), rawKey?: string) => {
    made.view._renderMilestoneSection(parent, file(), list, flashSaved, rawKey);
    return list;
  };
  const tasks = (list = parseTasksList("- [ ] Plan\n- [x] Hire"), rawKey?: string) => {
    made.view._renderTaskSection(parent, file(), list, flashSaved, rawKey);
    return list;
  };
  return { ...made, parent, rendered, propagated, flashSaved, file, read, section, milestones, tasks };
}

const card = (parent: FakeElement) => parent.children[0];
const title = (parent: FakeElement) => card(parent).children[0].children[0].text;
const addButton = (parent: FakeElement) => card(parent).children[0].children[1];
const list = (parent: FakeElement) => card(parent).children[1];
const mileRow = (parent: FakeElement, idx: number) => list(parent).children[idx].children[0];
const notesEl = (parent: FakeElement, idx: number) => list(parent).children[idx].children[1];
const taskRow = (parent: FakeElement, idx: number) => list(parent).children[idx];

function type(input: FakeElement, value: string, event = "input") {
  input.value = value;
  input.trigger(event);
}

function tick(cb: FakeElement, checked: boolean) {
  cb.checked = checked;
  cb.trigger("change");
}

describe("_renderMilestoneSection", () => {
  it("renders a card titled with the done count, and one row per milestone", () => {
    const { parent, milestones } = setup();
    milestones();
    expect(card(parent).classes).toEqual(["cad-pd-card"]);
    expect(card(parent).children[0].classes).toEqual(["cad-pd-card-head"]);
    expect(title(parent)).toBe("MILESTONES · 1/3");
    expect([addButton(parent).text, addButton(parent).classes]).toEqual(["+ Add", ["cad-btn", "cad-btn-sm"]]);
    expect(list(parent).classes).toEqual(["cad-pd-checklist"]);
    expect(list(parent).children.map((w) => [w.classes, w.children[0].classes])).toEqual([
      [["cad-mile-wrapper"], ["cad-pd-mile-row", "done"]],
      [["cad-mile-wrapper"], ["cad-pd-mile-row"]],
      [["cad-mile-wrapper"], ["cad-pd-mile-row"]],
    ]);
    const [cb, date, name, del] = mileRow(parent, 0).children;
    expect([cb.type, cb.checked, date.type, date.classes, date.value]).toEqual([
      "checkbox", true, "date", ["cad-pd-mile-date"], "2026-09-15",
    ]);
    expect([name.classes, name.value, name.placeholder]).toEqual([["cad-pd-mile-title"], "Kickoff", "Milestone title"]);
    expect([del.text, del.title, del.classes]).toEqual(["×", "Delete milestone", ["cad-btn", "cad-btn-sm", "cad-btn-danger"]]);
    expect(mileRow(parent, 2).children[1].valueWrites).toEqual([]);
  });

  it("titles a tagged section by its clean label, and shows the empty state", () => {
    const { parent, milestones } = setup();
    milestones([], "Plan #milestones");
    expect(title(parent)).toBe("PLAN · 0/0");
    expect(list(parent).children.map((c) => [c.classes, c.text])).toEqual([
      [["cad-empty"], "No milestones yet — add the first one."],
    ]);
  });

  it("ticking rewrites the section, flashes and re-renders", async () => {
    const { parent, milestones, section, flashSaved, rendered } = setup();
    milestones();
    tick(mileRow(parent, 1).children[0], true);
    await flush();
    expect(await section("## Milestones")).toBe(
      "- [x] 2026-09-15 — Kickoff\n    Went well\n- [x] 2026-11-01 — Beta\n- [ ] Launch\n",
    );
    expect(flashSaved).toHaveBeenCalledTimes(1);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("a date edit writes 350ms later without re-rendering; clearing it drops the date", async () => {
    const { parent, milestones, section, rendered } = setup();
    milestones();
    const date = mileRow(parent, 2).children[1];
    type(date, "2027-02-01");
    await vi.advanceTimersByTimeAsync(349);
    expect(await section("## Milestones")).toBe(MILESTONES);
    await vi.advanceTimersByTimeAsync(1);
    expect(await section("## Milestones")).toContain("- [ ] 2027-02-01 — Launch\n");
    type(date, "");
    await vi.advanceTimersByTimeAsync(350);
    expect(await section("## Milestones")).toContain("- [ ] Launch\n");
    expect(rendered).not.toHaveBeenCalled();
  });

  it("a title edit writes 400ms after the last keystroke, without re-rendering", async () => {
    const { parent, milestones, section, rendered, flashSaved } = setup();
    milestones();
    const name = mileRow(parent, 1).children[2];
    type(name, "Bet");
    await vi.advanceTimersByTimeAsync(300);
    type(name, "Beta 2");
    await vi.advanceTimersByTimeAsync(399);
    expect(flashSaved).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await section("## Milestones")).toContain("- [ ] 2026-11-01 — Beta 2\n");
    expect(flashSaved).toHaveBeenCalledTimes(1);
    expect(rendered).not.toHaveBeenCalled();
  });

  it("× deletes the milestone and re-renders", async () => {
    const { parent, milestones, section, rendered } = setup();
    milestones();
    mileRow(parent, 0).children[3].trigger("click");
    await flush();
    expect(await section("## Milestones")).toBe("- [ ] 2026-11-01 — Beta\n- [ ] Launch\n");
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("+ Add appends an untitled milestone dated today", async () => {
    const { parent, milestones, section, rendered } = setup();
    const items = milestones();
    addButton(parent).trigger("click");
    await flush();
    expect(items).toHaveLength(4);
    expect(await section("## Milestones")).toContain("- [ ] Launch\n- [ ] 2026-10-10\n");
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("edits share one list: a pending title edit is kept by a later add, tick or delete", async () => {
    const { parent, milestones, section } = setup();
    milestones();
    type(mileRow(parent, 2).children[2], "Go live");
    await vi.advanceTimersByTimeAsync(400);
    addButton(parent).trigger("click");
    await flush();
    expect(await section("## Milestones")).toContain("- [ ] Go live\n- [ ] 2026-10-10\n");
    tick(mileRow(parent, 2).children[0], true);
    await flush();
    expect(await section("## Milestones")).toContain("- [x] Go live\n- [ ] 2026-10-10\n");
    mileRow(parent, 0).children[3].trigger("click");
    await flush();
    expect(await section("## Milestones")).toBe("- [ ] 2026-11-01 — Beta\n- [x] Go live\n- [ ] 2026-10-10\n");
  });

  it("shows notes as a preview, or a + Add notes link", () => {
    const { parent, milestones } = setup();
    milestones();
    const preview = notesEl(parent, 0).children[0];
    expect([notesEl(parent, 0).classes, preview.classes, preview.text, preview.title]).toEqual([
      ["cad-mile-notes-section"], ["cad-mile-notes-preview"], "Went well", "Click to edit notes",
    ]);
    const add = notesEl(parent, 1).children[0];
    expect([add.localName, add.classes, add.text]).toEqual(["a", ["cad-mile-notes-add"], "+ Add notes"]);
  });

  it("opens a notes editor that autosizes, writes 400ms after typing and returns to the preview on blur", async () => {
    const { parent, milestones, section, rendered } = setup();
    milestones();
    expect(notesEl(parent, 1).children[0].trigger("click").defaultPrevented).toBe(true);
    const ta = notesEl(parent, 1).children[0];
    expect([ta.localName, ta.classes, ta.value, ta.placeholder]).toEqual([
      "textarea", ["cad-mile-notes-textarea"], "", "Notes — context, follow-ups, what happened…",
    ]);
    expect(ta.focusCount).toBe(0);
    await vi.advanceTimersByTimeAsync(0);
    expect([ta.focusCount, ta.style.height]).toEqual([1, "60px"]);
    type(ta, "Line 1\nLine 2");
    await vi.advanceTimersByTimeAsync(399);
    expect(await section("## Milestones")).not.toContain("Line 1");
    await vi.advanceTimersByTimeAsync(1);
    expect(await section("## Milestones")).toContain("- [ ] 2026-11-01 — Beta\n    Line 1\n    Line 2\n");
    type(ta, "Done", "blur");
    await flush();
    expect(await section("## Milestones")).toContain("- [ ] 2026-11-01 — Beta\n    Done\n");
    expect(notesEl(parent, 1).children.map((c) => [c.classes, c.text])).toEqual([[["cad-mile-notes-preview"], "Done"]]);
    expect(rendered).not.toHaveBeenCalled();
  });

  it("clicking a preview opens the editor with the notes; blurring it empty shows + Add notes", async () => {
    const { parent, milestones, section } = setup();
    milestones();
    notesEl(parent, 0).children[0].trigger("click");
    const ta = notesEl(parent, 0).children[0];
    expect(ta.value).toBe("Went well");
    type(ta, "  ", "blur");
    await flush();
    expect(await section("## Milestones")).toContain("- [x] 2026-09-15 — Kickoff\n- [ ] 2026-11-01");
    expect(notesEl(parent, 0).children[0].text).toBe("+ Add notes");
  });
});

describe("_commitMilestones", () => {
  it("replaces the named section, flashes, and re-renders unless skipRender", async () => {
    const { view, file, read, section, flashSaved, rendered, app } = setup();
    await view._commitMilestones(file(), [{ done: true, date: null, title: "Only" }], flashSaved);
    expect(await section("## Milestones")).toBe("- [x] Only\n");
    expect([flashSaved.mock.calls.length, rendered.mock.calls.length, app.vault.modified]).toEqual([1, 1, [APOLLO.path]]);
    await view._commitMilestones(file(), [], undefined, true);
    expect(await section("## Milestones")).toBe("");
    expect(rendered).toHaveBeenCalledTimes(1);
    expect(await read()).toContain("## Tasks\n- [ ] Plan");
  });

  it("appends a missing section under its raw key", async () => {
    const { view, file, read } = setup([{ path: "Cadence/Projects/New.md", body: "## Brief\nx\n\n" }]);
    await view._commitMilestones(file("Cadence/Projects/New.md"), [{ done: false, title: "A" }], null, true, "Plan #milestones");
    expect(await read("Cadence/Projects/New.md")).toBe("## Brief\nx\n\n## Plan #milestones\n- [ ] A\n");
  });
});

describe("_renderTaskSection (native)", () => {
  it("renders a card with the open and done counts, and one row per task", () => {
    const { parent, tasks } = setup();
    tasks();
    expect(title(parent)).toBe("TASKS · 1 open · 1 done");
    expect(addButton(parent).text).toBe("+ Add");
    expect(list(parent).children.map((r) => r.classes)).toEqual([["cad-pd-task-row"], ["cad-pd-task-row", "done"]]);
    const [cb, name, bell, del] = taskRow(parent, 0).children;
    expect([cb.type, cb.checked, name.classes, name.value, name.placeholder]).toEqual([
      "checkbox", false, ["cad-pd-task-title"], "Plan", "Task description",
    ]);
    expect([bell.text, bell.title, bell.classes]).toEqual([
      "🔕", "Set a reminder for this task", ["cad-btn", "cad-btn-sm", "cad-pd-task-bell"],
    ]);
    expect([del.text, del.classes]).toEqual(["×", ["cad-btn", "cad-btn-sm", "cad-btn-danger"]]);
  });

  it("titles a tagged section by its clean label, and shows the empty state", () => {
    const { parent, tasks } = setup();
    tasks([], "Todo #tasks");
    expect(title(parent)).toBe("TODO · 0 open · 0 done");
    expect(list(parent).children.map((c) => [c.classes, c.text])).toEqual([[["cad-empty"], "No tasks yet."]]);
  });

  it("ticking rewrites the section, propagates the task and re-renders twice", async () => {
    const { parent, tasks, section, propagated, rendered, flashSaved, file } = setup();
    tasks();
    tick(taskRow(parent, 0).children[0], true);
    await flush();
    expect(await section("## Tasks")).toBe("- [x] Plan\n- [x] Hire\n");
    expect(propagated.mock.calls).toEqual([["Plan", true, { kind: "project", file: file() }]]);
    expect([flashSaved.mock.calls.length, rendered.mock.calls.length]).toEqual([1, 2]);
  });

  it("a blank task is not propagated", async () => {
    const { parent, tasks, propagated, section } = setup();
    tasks(parseTasksList("- [ ]  \n- [ ] B"));
    tick(taskRow(parent, 0).children[0], true);
    await flush();
    expect(propagated).not.toHaveBeenCalled();
    expect(await section("## Tasks")).toBe("- [x]  \n- [ ] B\n");
  });

  it("a title edit writes 400ms later without re-rendering; × deletes and re-renders", async () => {
    const { parent, tasks, section, rendered } = setup();
    tasks();
    type(taskRow(parent, 1).children[1], "Hire two");
    await vi.advanceTimersByTimeAsync(399);
    expect(await section("## Tasks")).toBe("- [ ] Plan\n- [x] Hire");
    await vi.advanceTimersByTimeAsync(1);
    expect(await section("## Tasks")).toBe("- [ ] Plan\n- [x] Hire two\n");
    expect(rendered).not.toHaveBeenCalled();
    taskRow(parent, 0).children[3].trigger("click");
    await flush();
    expect(await section("## Tasks")).toBe("- [x] Hire two\n");
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("+ Add appends an empty task to the shared list, keeping a pending edit", async () => {
    const { parent, tasks, section } = setup();
    const items = tasks();
    type(taskRow(parent, 0).children[1], "Plan it");
    await vi.advanceTimersByTimeAsync(400);
    addButton(parent).trigger("click");
    await flush();
    expect(items).toHaveLength(3);
    expect(await section("## Tasks")).toBe("- [ ] Plan it\n- [x] Hire\n- [ ] \n");
  });

  it("the bell shows a linked reminder; clicking saves the title and edits that reminder", async () => {
    const reminder = { id: "r1", text: "Plan", when: "2026-10-12T09:30:00", project: APOLLO.path, repeat: "none" };
    const done = { id: "r0", text: "Hire", project: APOLLO.path, done: true };
    const modals: Any[] = [];
    vi.spyOn(CadenceReminderEditModal.prototype, "open").mockImplementation(function (this: Any) {
      modals.push(this);
    });
    const { parent, tasks, section, rendered } = setup([APOLLO], { reminders: [reminder, done] });
    tasks();
    const bell = taskRow(parent, 0).children[2];
    expect([bell.text, bell.classes, bell.title]).toEqual([
      "🔔", ["cad-btn", "cad-btn-sm", "cad-pd-task-bell", "linked"], `Edit reminder · ${reminderTimeStr(reminder.when)}`,
    ]);
    // A done reminder is not linked.
    expect(taskRow(parent, 1).children[2].text).toBe("🔕");
    bell.trigger("click");
    await flush();
    expect(await section("## Tasks")).toBe("- [ ] Plan\n- [x] Hire\n");
    expect(rendered).not.toHaveBeenCalled();
    expect(modals.map((m) => [m.reminder, m.isNew])).toEqual([[reminder, false]]);
  });

  it("a linked reminder without a time shows a plain Edit reminder title", () => {
    const { parent, tasks } = setup([APOLLO], { reminders: [{ id: "r1", text: "Plan", when: null, project: APOLLO.path }] });
    tasks();
    expect(taskRow(parent, 0).children[2].title).toBe("Edit reminder");
  });

  it("clicking an unlinked bell opens a new reminder for the edited title; a blank title notices", async () => {
    const modals: Any[] = [];
    vi.spyOn(CadenceReminderEditModal.prototype, "open").mockImplementation(function (this: Any) {
      modals.push(this);
    });
    const { parent, tasks, section } = setup();
    tasks();
    const name = taskRow(parent, 1).children[1];
    name.value = " Hire again ";
    taskRow(parent, 1).children[2].trigger("click");
    await flush();
    expect(await section("## Tasks")).toBe("- [ ] Plan\n- [x]  Hire again \n");
    expect(modals.map((m) => [m.reminder, m.isNew])).toEqual([
      [{ text: "Hire again", when: null, repeat: "none", notes: "", project: APOLLO.path }, true],
    ]);
    name.value = " ";
    taskRow(parent, 1).children[2].trigger("click");
    await flush();
    expect(Notice.messages).toEqual(["Add a task title first."]);
    expect(name.focusCount).toBe(1);
    expect(modals).toHaveLength(1);
  });
});

describe("_renderTaskSection (TaskNotes)", () => {
  const TASKS: MockFileSpec[] = [
    { path: "TaskNotes/Tasks/Write spec.md", frontmatter: { title: "Write spec", status: "done", projects: "[[Apollo]]" } },
    { path: "TaskNotes/Tasks/sub/Ship.md", frontmatter: { status: "open", projects: ["[[Apollo]]", "[[Other]]"] } },
    { path: "TaskNotes/Tasks/Elsewhere.md", frontmatter: { title: "Elsewhere", projects: "[[Other]]" } },
  ];
  const tn = (files: MockFileSpec[] = [APOLLO, ...TASKS]) => setup(files, { taskManagementSystem: "tasknotes" });

  it("lists the task notes linking the project instead of the section's tasks, as links without bell or ×", () => {
    const { parent, tasks } = tn();
    tasks();
    expect(title(parent)).toBe("TASKS · 1 open · 1 done");
    expect(list(parent).children.map((r) => [r.classes, r.children.length])).toEqual([
      [["cad-pd-task-row", "done"], 2], [["cad-pd-task-row"], 2],
    ]);
    const link = taskRow(parent, 1).children[1];
    expect([link.localName, link.classes, link.text, link.style.flex, link.style.marginRight, link.style.cursor]).toEqual([
      "a", ["cad-task-text"], "Ship", "1", "8px", "pointer",
    ]);
  });

  it("a task note title falls back to its basename (so Untitled Task never shows); clicking a link opens its note", () => {
    const { parent, tasks, app } = tn([APOLLO, { path: "TaskNotes/Tasks/x.md", frontmatter: { title: "", projects: "[[Apollo]]" } }]);
    tasks();
    // listTaskNotesTasks falls back to the basename, so the title is never empty.
    expect(taskRow(parent, 0).children[1].text).toBe("x");
    expect(taskRow(parent, 0).children[1].trigger("click").defaultPrevented).toBe(true);
    expect(app.workspace.openedLinks).toEqual([["TaskNotes/Tasks/x.md", "", false]]);
  });

  it("ticking sets the task note's status, without touching the section or propagating", async () => {
    const { parent, tasks, app, propagated, rendered, read } = tn();
    const before = await read();
    tasks();
    tick(taskRow(parent, 1).children[0], true);
    tick(taskRow(parent, 0).children[0], false);
    await flush();
    const status = (path: string) => app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(path) as Any)?.frontmatter?.status;
    expect([status(TASKS[0].path), status(TASKS[1].path)]).toEqual(["open", "done"]);
    expect(await read()).toBe(before);
    expect(propagated).not.toHaveBeenCalled();
    expect(rendered).toHaveBeenCalledTimes(2);
  });

  it("+ Add runs TaskNotes' own command when it is installed", async () => {
    const { parent, tasks, app, view } = tn();
    const executeCommandById = vi.fn();
    (app as Any).commands = { commands: { "tasknotes:create-new-task": {} }, executeCommandById };
    const prompt = vi.spyOn(view, "_prompt");
    tasks();
    addButton(parent).trigger("click");
    await flush();
    expect(executeCommandById.mock.calls).toEqual([["tasknotes:create-new-task"]]);
    expect(prompt).not.toHaveBeenCalled();
  });

  it("otherwise + Add prompts (in French) and creates a task note linked to the project", async () => {
    const { parent, tasks, app, view, rendered } = tn();
    (app as Any).commands = { commands: {}, executeCommandById: vi.fn() };
    const prompt = vi.spyOn(view, "_prompt").mockResolvedValue('Fix: "a/b"?');
    tasks();
    addButton(parent).trigger("click");
    await flush();
    expect(prompt.mock.calls).toEqual([[{ title: "Ajouter une tâche (TaskNotes)", placeholder: "Que faut-il faire ?", cta: "Ajouter" }]]);
    expect(app.vault.created).toEqual(["TaskNotes/Tasks/Fix ab.md"]);
    expect(await app.vault.read(app.vault.getAbstractFileByPath("TaskNotes/Tasks/Fix ab.md") as Any)).toBe(
      '---\ntitle: Fix: "a/b"?\nstatus: open\nscheduled: 2026-10-10\nprojects: "[[Apollo]]"\npriority: normal\n---\n',
    );
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("numbers a taken file name, creates the folder when missing, and does nothing when cancelled", async () => {
    const { parent, tasks, app, view, rendered } = tn([APOLLO, { path: "TaskNotes/Tasks/Ship.md" }, { path: "TaskNotes/Tasks/Ship (1).md" }]);
    const prompt = vi.spyOn(view, "_prompt").mockResolvedValueOnce(null).mockResolvedValueOnce("").mockResolvedValue("Ship");
    tasks();
    addButton(parent).trigger("click");
    await flush();
    addButton(parent).trigger("click");
    await flush();
    expect([app.vault.created, rendered.mock.calls.length]).toEqual([[], 0]);
    addButton(parent).trigger("click");
    await flush();
    expect(prompt).toHaveBeenCalledTimes(3);
    expect(app.vault.created).toEqual(["TaskNotes/Tasks/Ship (2).md"]);
    const fresh = tn([APOLLO]);
    vi.spyOn(fresh.view, "_prompt").mockResolvedValue("First");
    fresh.tasks();
    addButton(fresh.parent).trigger("click");
    await flush();
    expect(fresh.app.vault.getAbstractFileByPath("TaskNotes/Tasks")).not.toBeNull();
    expect(fresh.app.vault.created).toEqual(["TaskNotes/Tasks/First.md"]);
  });
});

describe("_commitTasks", () => {
  it("replaces the named section, flashes, and re-renders unless skipRender", async () => {
    const { view, file, section, flashSaved, rendered } = setup();
    await view._commitTasks(file(), [{ done: true, title: "Only" }, {}], flashSaved);
    expect(await section("## Tasks")).toBe("- [x] Only\n- [ ] \n");
    expect([flashSaved.mock.calls.length, rendered.mock.calls.length]).toEqual([1, 1]);
    await view._commitTasks(file(), [], "not a function", true);
    expect(await section("## Tasks")).toBe("");
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("appends a missing section under its raw key", async () => {
    const { view, file, read } = setup([{ path: "Cadence/Projects/New.md", body: "Intro" }]);
    await view._commitTasks(file("Cadence/Projects/New.md"), [{ title: "A" }], null, true, "Todo #tasks");
    expect(await read("Cadence/Projects/New.md")).toBe("Intro\n\n## Todo #tasks\n- [ ] A\n");
  });
});

describe("_writeProjectFrontmatter", () => {
  it("sets each patched key, deletes null, undefined and '', keeps [] and 0, then flashes", async () => {
    const { view, file, app, flashSaved } = setup([
      { path: "Cadence/Projects/P.md", frontmatter: { a: 1, b: 2, c: 3, d: 4 } },
    ]);
    await view._writeProjectFrontmatter(file("Cadence/Projects/P.md"), { a: null, b: undefined, c: "", d: [], e: 0, f: "x" }, flashSaved);
    expect(app.metadataCache.getFileCache(file("Cadence/Projects/P.md"))?.frontmatter).toEqual({ d: [], e: 0, f: "x" });
    expect(flashSaved).toHaveBeenCalledTimes(1);
    await view._writeProjectFrontmatter(file("Cadence/Projects/P.md"), { g: 1 });
  });

  it("a failed write notices and does not flash", async () => {
    const { view, file, app, flashSaved } = setup();
    vi.spyOn(app.fileManager, "processFrontMatter").mockRejectedValue(new Error("locked"));
    await view._writeProjectFrontmatter(file(), { status: "done" }, flashSaved);
    expect(Notice.messages).toEqual(["Save failed: locked"]);
    expect(flashSaved).not.toHaveBeenCalled();
  });
});
