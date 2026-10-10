import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, Notice, TFile, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";
import { projectWebsite } from "../fixtures/vault";

/* Characterization tests for the Today surface: _quickAddTodayTask,
   renderTodayPane, toggleTodayTask, appendTodayTask and saveTodayJournal, in
   daily-note and TaskNotes modes. Time is frozen at Saturday 2026-10-10
   09:00 UTC. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const NOW = new Date("2026-10-10T09:00:00Z");
const TODAY_PATH = "daily/2026-10-10.md";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  Notice.messages.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const SETTINGS = { tasksHeading: "## Today", journalHeading: "## Journal", taskManagementSystem: "native", taskProjectLinks: {} };
const TASKNOTES = { taskManagementSystem: "tasknotes" };

function setup(files: MockFileSpec[] = [], settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files, settings: { ...SETTINGS, ...settings } });
  const parent = new FakeElement("div");
  const rendered = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
  const openDetail = vi.spyOn(made.view, "openEntityDetail").mockResolvedValue(undefined);
  const propagate = vi.spyOn(made.view, "_propagateTaskComplete").mockResolvedValue(undefined);
  const dynamic = vi.spyOn(made.view, "_renderDynamicH2Section").mockImplementation(() => {});
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path) as TFile;
  const read = (path: string) => made.app.vault.read(file(path));
  return { ...made, parent, rendered, openDetail, propagate, dynamic, file, read };
}

const daily = (body: string): MockFileSpec => ({ path: TODAY_PATH, body });
const NOTE = daily("# 2026-10-10\n\n## Today\n- [ ] Ship\n- [x] Plan\n- [ ] Call Jane\n\n## Journal\nLine one\nLine two\n");

const taskNote = (name: string, fm: Record<string, unknown>): MockFileSpec => ({ path: `TaskNotes/Tasks/${name}.md`, frontmatter: fm });

const rows = (root: FakeElement) => root.querySelectorAll(".cad-task-row");

describe("renderTodayPane", () => {
  it("renders the date hero and greeting, and stores the daily note and its parse on the view", async () => {
    const { view, parent, file } = setup([NOTE]);
    await view.renderTodayPane(parent);
    expect(parent.classes).toEqual(["cadence-today"]);
    expect(view.todayFile).toBe(file(TODAY_PATH));
    expect(view.todayParsed.tasks).toEqual(["- [ ] Ship", "- [x] Plan", "- [ ] Call Jane"]);
    expect(view.todayParsed.journal).toBe("Line one\nLine two");
    const [eyebrow, hero, greet] = parent.children;
    expect([eyebrow.classes, eyebrow.text]).toEqual([["cad-eyebrow"], "SATURDAY"]);
    expect(hero.classes).toEqual(["cad-date-hero"]);
    expect([hero.children[0].classes, hero.children[0].text]).toEqual([["cad-day"], "10"]);
    expect(hero.children[1].children.map((c) => [c.classes[0], c.text])).toEqual([["cad-month", "October"], ["cad-year", "2026"]]);
    expect([greet.classes, greet.text]).toEqual([["cad-greet"], "Good morning. You have 2 things to handle."]);
  });

  it("says 1 thing, or that the day is clear", async () => {
    const one = setup([daily("## Today\n- [ ] Ship\n- [x] Done\n")]);
    await one.view.renderTodayPane(one.parent);
    expect(one.parent.querySelectorAll(".cad-greet")[0].text).toBe("Good morning. You have 1 thing to handle.");
    const none = setup([daily("## Today\n- [x] Done\n")]);
    await none.view.renderTodayPane(none.parent);
    expect(none.parent.querySelectorAll(".cad-greet")[0].text).toBe("Good morning. Nothing on the books — your day is clear.");
  });

  it("creates today's note when it is missing; QUIRK: its blank task line counts as one open task", async () => {
    const { view, parent, app } = setup();
    await view.renderTodayPane(parent);
    expect(app.vault.created).toEqual([TODAY_PATH]);
    expect(parent.querySelectorAll(".cad-greet")[0].text).toBe("Good morning. You have 1 thing to handle.");
    expect(rows(parent).map((r) => r.querySelectorAll(".cad-task-text")[0].text)).toEqual([""]);
  });

  it("shows the task count label and one row per task, done rows marked", async () => {
    const { view, parent } = setup([NOTE]);
    await view.renderTodayPane(parent);
    const label = parent.querySelectorAll(".cad-section-label")[0];
    expect(label.children.map((c) => [c.classes, c.text])).toEqual([[[], "TODAY"], [["cad-count"], "2 open · 1 done"]]);
    expect(rows(parent).map((r) => [r.classes, r.children[0].type, r.children[0].checked, r.children[1].text])).toEqual([
      [["cad-task-row"], "checkbox", false, "Ship"],
      [["cad-task-row", "done"], "checkbox", true, "Plan"],
      [["cad-task-row"], "checkbox", false, "Call Jane"],
    ]);
  });

  it("shows an empty message without tasks", async () => {
    const { view, parent } = setup([daily("## Today\n\n## Journal\n")]);
    await view.renderTodayPane(parent);
    expect(parent.querySelectorAll(".cad-empty").map((e) => e.text)).toEqual(["No tasks in today's note yet."]);
    expect(parent.querySelectorAll(".cad-count")[0].text).toBe("0 open · 0 done");
  });

  it("toggles a task by row index from its checkbox", async () => {
    const { view, parent } = setup([NOTE]);
    const toggle = vi.spyOn(view, "toggleTodayTask").mockResolvedValue(undefined);
    await view.renderTodayPane(parent);
    const cb = rows(parent)[1].children[0];
    cb.checked = false;
    cb.trigger("change");
    expect(toggle.mock.calls).toEqual([[1, false]]);
  });

  it("offers a link button per task, and a chip plus ✎ once linked", async () => {
    const { view, parent, openDetail, file } = setup([NOTE, projectWebsite], {
      taskProjectLinks: { [`${TODAY_PATH}::Ship`]: projectWebsite.path },
    });
    const picker = vi.spyOn(view, "_openTaskProjectPicker").mockImplementation(() => {});
    await view.renderTodayPane(parent);
    const [linked, plain] = rows(parent);
    expect(linked.children.map((c) => [c.localName, c.classes, c.text, c.title])).toEqual([
      ["input", [], "", ""],
      ["span", ["cad-task-text"], "Ship", ""],
      ["a", ["cad-task-proj-chip"], "📁 Website relaunch", "Open linked project"],
      ["button", ["cad-task-link-btn", "linked"], "✎", "Change linked project"],
    ]);
    expect(plain.children.slice(2).map((c) => [c.classes, c.text, c.title])).toEqual([
      [["cad-task-link-btn"], "📁", "Link to a project"],
    ]);
    const chipEv = linked.children[2].trigger("click");
    expect([chipEv.defaultPrevented, chipEv.propagationStopped]).toEqual([true, true]);
    expect(openDetail.mock.calls).toEqual([["project", file(projectWebsite.path)]]);
    expect(linked.children[3].trigger("click").propagationStopped).toBe(true);
    plain.children[2].trigger("click");
    expect(picker.mock.calls).toEqual([
      [TODAY_PATH, "Ship", projectWebsite.path],
      [TODAY_PATH, "Plan", null],
    ]);
  });

  it("names a missing linked project from its path; its chip does nothing", async () => {
    const { view, parent, openDetail } = setup([NOTE], { taskProjectLinks: { [`${TODAY_PATH}::Ship`]: "Cadence/Projects/Gone.md" } });
    await view.renderTodayPane(parent);
    const chip = parent.querySelectorAll(".cad-task-proj-chip")[0];
    expect(chip.text).toBe("📁 Gone");
    chip.trigger("click");
    expect(openDetail).not.toHaveBeenCalled();
  });

  it("quick add appends the trimmed text on Enter and clears the input", async () => {
    const { view, parent } = setup([NOTE]);
    const append = vi.spyOn(view, "appendTodayTask").mockResolvedValue(undefined);
    await view.renderTodayPane(parent);
    const input = parent.querySelectorAll("input").find((i) => i.type === "text")!;
    expect([input.placeholder, input.style.width, input.parent!.style.marginTop]).toEqual([
      "Quick add a task — Enter to save", "100%", "8px",
    ]);
    input.value = "  New  ";
    input.trigger("keydown", { key: "a" });
    input.value = "   ";
    input.trigger("keydown", { key: "Enter" });
    expect(append).not.toHaveBeenCalled();
    input.value = "  New  ";
    input.trigger("keydown", { key: "Enter" });
    expect(append.mock.calls).toEqual([["New"]]);
    expect(input.value).toBe("");
  });

  it("fills the journal textarea from the note, sized to fit", async () => {
    const { view, parent } = setup([NOTE]);
    await view.renderTodayPane(parent);
    const label = parent.querySelectorAll(".cad-section-label")[1];
    expect(label.text).toBe("TODAY’S ENTRY");
    const ta = parent.querySelectorAll("textarea")[0];
    expect([ta.classes, ta.value, ta.placeholder, ta.rows]).toEqual([["cad-journal"], "Line one\nLine two", "Write what’s on your mind…", 8]);
    const long = setup([daily("## Journal\n" + Array.from({ length: 10 }, (_, i) => `l${i}`).join("\n"))]);
    await long.view.renderTodayPane(long.parent);
    expect(long.parent.querySelectorAll("textarea")[0].rows).toBe(12);
  });

  it("autosaves the journal 800ms after the last keystroke", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"], now: NOW });
    const { view, parent } = setup([NOTE]);
    const save = vi.spyOn(view, "saveTodayJournal").mockResolvedValue(undefined);
    await view.renderTodayPane(parent);
    const ta = parent.querySelectorAll("textarea")[0];
    ta.scrollHeight = 120;
    vi.advanceTimersByTime(0);
    expect(ta.style.height).toBe("120px");
    ta.value = "a";
    ta.trigger("input");
    vi.advanceTimersByTime(500);
    ta.value = "ab";
    ta.trigger("input");
    vi.advanceTimersByTime(799);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save.mock.calls).toEqual([["ab"]]);
    expect(ta.style.height).toBe("120px");
    expect(view._journalSaveTimer).not.toBeNull();
  });

  it("renders every other H2 section through _renderDynamicH2Section in a grid", async () => {
    const { view, parent, dynamic, file } = setup([
      daily("## Today\n- [ ] a\n## Notes #text\nN\n## Journal\nJ\n## today\nX\n## Habits\n- [ ] Run\n"),
    ]);
    await view.renderTodayPane(parent);
    const wrap = parent.querySelectorAll(".cad-custom-sections")[0];
    expect(wrap.style).toEqual({ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" });
    expect(dynamic.mock.calls.map(([w, f, sections, key]) => [w === wrap, f === file(TODAY_PATH), Object.keys(sections as object), key])).toEqual([
      [true, true, ["Today", "Notes #text", "Journal", "today", "Habits"], "Notes #text"],
      [true, true, ["Today", "Notes #text", "Journal", "today", "Habits"], "Habits"],
    ]);
    (dynamic.mock.calls[0][4] as () => void)();
    expect(Notice.messages).toEqual(["Section saved"]);
  });

  it("matches the task and journal headings case-insensitively and falls back to the defaults", async () => {
    const { view, parent, dynamic } = setup([daily("## Today\n## Journal\n## Other\n")], { tasksHeading: "", journalHeading: "" });
    await view.renderTodayPane(parent);
    expect(dynamic.mock.calls.map((c) => c[3])).toEqual(["Other"]);
  });

  it("adds no custom-sections grid when there are none", async () => {
    const { view, parent } = setup([NOTE]);
    await view.renderTodayPane(parent);
    expect(parent.querySelectorAll(".cad-custom-sections")).toEqual([]);
  });

  it("ends with a footer link to today's note", async () => {
    const { view, parent, app } = setup([NOTE]);
    const open = vi.spyOn(app.workspace, "openLinkText");
    await view.renderTodayPane(parent);
    const footer = parent.children[parent.children.length - 1];
    expect(footer.style).toEqual({ marginTop: "24px", fontSize: "12px", color: "var(--cad-ink-4)" });
    const link = footer.children[0];
    expect([link.localName, link.text, link.style.color, link.style.cursor]).toEqual([
      "a", "Open today's daily note →", "var(--cad-emerald-deep)", "pointer",
    ]);
    link.trigger("click");
    expect(open.mock.calls).toEqual([[TODAY_PATH, "", false]]);
  });

  describe("TaskNotes mode", () => {
    const TASKS = [
      taskNote("Write copy", { title: "Write copy", status: "open", scheduled: "2026-10-10", projects: ["[[Website relaunch]]"] }),
      taskNote("Review", { status: "done", scheduled: "2026-10-10" }),
      taskNote("Later", { title: "Later", scheduled: "2026-10-11" }),
      taskNote("Orphan", { title: "Orphan", scheduled: "2026-10-10", projects: "[[Nowhere]]" }),
    ];

    it("lists today's scheduled task notes, as links, with no link buttons", async () => {
      const { view, parent, app } = setup([NOTE, projectWebsite, ...TASKS], TASKNOTES);
      const open = vi.spyOn(app.workspace, "openLinkText");
      await view.renderTodayPane(parent);
      expect(view.todayTaskNotes.map((t: Any) => t.title)).toEqual(["Write copy", "Review", "Orphan"]);
      expect(parent.querySelectorAll(".cad-greet")[0].text).toBe("Good morning. You have 2 things to handle.");
      expect(rows(parent).map((r) => r.children.map((c) => [c.localName, c.classes, c.text]))).toEqual([
        [["input", [], ""], ["a", ["cad-task-text"], "Write copy"], ["a", ["cad-task-proj-chip"], "📁 Website relaunch"]],
        [["input", [], ""], ["a", ["cad-task-text"], "Review"]],
        [["input", [], ""], ["a", ["cad-task-text"], "Orphan"]],
      ]);
      const link = rows(parent)[1].children[1];
      expect(link.style.cursor).toBe("pointer");
      expect(link.trigger("click").defaultPrevented).toBe(true);
      expect(open.mock.calls).toEqual([["TaskNotes/Tasks/Review.md", "", false]]);
    });

    it("still creates and reads today's daily note for the journal", async () => {
      const { view, parent, app } = setup(TASKS, TASKNOTES);
      await view.renderTodayPane(parent);
      expect(app.vault.created).toEqual([TODAY_PATH]);
      expect(view.todayParsed.tasks).toEqual(["- [ ] "]);
    });

    it("QUIRK: a project link resolves by basename, not by name", async () => {
      const { view, parent } = setup(
        [NOTE, { path: "Elsewhere/Nowhere.md", body: "" }, ...TASKS],
        TASKNOTES,
      );
      await view.renderTodayPane(parent);
      expect(parent.querySelectorAll(".cad-task-proj-chip").map((c) => c.text)).toEqual(["📁 Nowhere"]);
    });
  });
});

describe("toggleTodayTask", () => {
  it("rewrites the line at the index, propagates its text, and re-renders", async () => {
    const { view, parent, read, propagate, rendered, file } = setup([NOTE]);
    await view.renderTodayPane(parent);
    await view.toggleTodayTask(0, true);
    expect(await read(TODAY_PATH)).toBe("# 2026-10-10\n\n## Today\n- [x] Ship\n- [x] Plan\n- [ ] Call Jane\n\n## Journal\nLine one\nLine two\n");
    expect(propagate.mock.calls).toEqual([["Ship", true, { kind: "daily", file: file(TODAY_PATH), date: NOW }]]);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("unticks a done line", async () => {
    const { view, parent, read } = setup([NOTE]);
    await view.renderTodayPane(parent);
    await view.toggleTodayTask(1, false);
    expect(await read(TODAY_PATH)).toContain("## Today\n- [ ] Ship\n- [ ] Plan\n");
  });

  it("QUIRK: rewrites by index in the re-read note, so an edit since the render ticks a different task", async () => {
    const { view, parent, read, app, file, propagate } = setup([NOTE]);
    await view.renderTodayPane(parent);
    await app.vault.modify(file(TODAY_PATH), "## Today\n- [ ] Inserted\n- [ ] Ship\n");
    await view.toggleTodayTask(0, true);
    expect(await read(TODAY_PATH)).toBe("## Today\n- [x] Inserted\n- [ ] Ship\n");
    expect(propagate.mock.calls[0][0]).toBe("Inserted");
  });

  it("writes but skips propagation for an index past the end or a blank task", async () => {
    const { view, parent, propagate, rendered, app } = setup([daily("## Today\n- [ ] \n")]);
    await view.renderTodayPane(parent);
    await view.toggleTodayTask(0, true);
    await view.toggleTodayTask(5, true);
    expect(app.vault.modified).toEqual([TODAY_PATH, TODAY_PATH]);
    expect(propagate).not.toHaveBeenCalled();
    expect(rendered).toHaveBeenCalledTimes(2);
  });

  it("in TaskNotes mode, sets the task note's status and re-renders without propagating", async () => {
    const { view, parent, app, propagate, rendered } = setup(
      [NOTE, taskNote("A", { title: "A", status: "open", scheduled: "2026-10-10" })],
      TASKNOTES,
    );
    await view.renderTodayPane(parent);
    await view.toggleTodayTask(0, true);
    const fm = app.metadataCache.getFileCache(app.vault.getAbstractFileByPath("TaskNotes/Tasks/A.md") as TFile)!.frontmatter;
    expect(fm!.status).toBe("done");
    await view.toggleTodayTask(7, true);
    expect(propagate).not.toHaveBeenCalled();
    expect(rendered).toHaveBeenCalledTimes(2);
    expect(app.vault.modified).toEqual([]);
  });
});

describe("appendTodayTask", () => {
  it("appends an open task to the tasks section and re-renders", async () => {
    const { view, parent, read, rendered } = setup([NOTE]);
    await view.renderTodayPane(parent);
    await view.appendTodayTask("New one");
    expect(await read(TODAY_PATH)).toBe(
      "# 2026-10-10\n\n## Today\n- [ ] Ship\n- [x] Plan\n- [ ] Call Jane\n- [ ] New one\n\n## Journal\nLine one\nLine two\n",
    );
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("adds the tasks heading at the end when the note has none", async () => {
    const { view, parent, read } = setup([daily("# Note\n\n## Journal\nJ\n")]);
    await view.renderTodayPane(parent);
    await view.appendTodayTask("First");
    expect(await read(TODAY_PATH)).toBe("# Note\n\n## Journal\nJ\n\n## Today\n- [ ] First\n");
  });

  it("in TaskNotes mode, creates a task note scheduled today", async () => {
    const { view, parent, app, read, rendered } = setup([NOTE], TASKNOTES);
    await view.renderTodayPane(parent);
    await view.appendTodayTask("Buy: milk?");
    expect(app.vault.created).toEqual(["TaskNotes/Tasks/Buy milk.md"]);
    expect(await read("TaskNotes/Tasks/Buy milk.md")).toBe("---\ntitle: Buy: milk?\nstatus: open\nscheduled: 2026-10-10\npriority: normal\n---\n");
    expect(rendered).toHaveBeenCalledTimes(1);
  });
});

describe("saveTodayJournal", () => {
  it("replaces the journal section without re-rendering", async () => {
    const { view, parent, read, rendered } = setup([NOTE]);
    await view.renderTodayPane(parent);
    await view.saveTodayJournal("New entry");
    expect(await read(TODAY_PATH)).toBe("# 2026-10-10\n\n## Today\n- [ ] Ship\n- [x] Plan\n- [ ] Call Jane\n\n## Journal\nNew entry\n");
    expect(rendered).not.toHaveBeenCalled();
  });

  it("writes an empty body for null", async () => {
    const { view, parent, read } = setup([NOTE]);
    await view.renderTodayPane(parent);
    await view.saveTodayJournal(null);
    expect(await read(TODAY_PATH)).toBe("# 2026-10-10\n\n## Today\n- [ ] Ship\n- [x] Plan\n- [ ] Call Jane\n\n## Journal\n\n");
  });

  it("uses the configured journal heading", async () => {
    const { view, parent, read } = setup([daily("## Log\nold\n")], { journalHeading: "## Log" });
    await view.renderTodayPane(parent);
    await view.saveTodayJournal("new");
    expect(await read(TODAY_PATH)).toBe("## Log\nnew\n");
  });
});

describe("_quickAddTodayTask", () => {
  it("prompts, then appends the task to today's note with a Notice", async () => {
    const { view, read } = setup([NOTE]);
    const prompt = vi.spyOn(view, "_prompt").mockResolvedValue("Quick one");
    await view._quickAddTodayTask();
    expect(prompt.mock.calls).toEqual([[{ title: "Quick add — today", placeholder: "What needs doing?", cta: "Add task" }]]);
    expect(await read(TODAY_PATH)).toContain("- [ ] Call Jane\n- [ ] Quick one\n\n## Journal");
    expect(Notice.messages).toEqual(["Added to today"]);
  });

  it("creates today's note if needed", async () => {
    const { view, app, read } = setup();
    vi.spyOn(view, "_prompt").mockResolvedValue("Quick one");
    await view._quickAddTodayTask();
    expect(app.vault.created).toEqual([TODAY_PATH]);
    expect(await read(TODAY_PATH)).toBe("# 2026-10-10\n\n## Today\n- [ ] \n- [ ] Quick one\n\n## Journal\n\n");
  });

  it("does nothing when the prompt is cancelled or empty", async () => {
    const { view, app } = setup([NOTE]);
    vi.spyOn(view, "_prompt").mockResolvedValueOnce(null).mockResolvedValueOnce("");
    await view._quickAddTodayTask();
    await view._quickAddTodayTask();
    expect(app.vault.modified).toEqual([]);
    expect(Notice.messages).toEqual([]);
  });

  it("does not re-render", async () => {
    const { view, rendered } = setup([NOTE]);
    vi.spyOn(view, "_prompt").mockResolvedValue("x");
    await view._quickAddTodayTask();
    await flush();
    expect(rendered).not.toHaveBeenCalled();
  });

  it("in TaskNotes mode, runs TaskNotes' create command when it exists", async () => {
    const { view, app } = setup([NOTE], TASKNOTES);
    const executeCommandById = vi.fn();
    (app as Any).commands = { commands: { "tasknotes:create-new-task": {} }, executeCommandById };
    const prompt = vi.spyOn(view, "_prompt");
    await view._quickAddTodayTask();
    expect(executeCommandById.mock.calls).toEqual([["tasknotes:create-new-task"]]);
    expect(prompt).not.toHaveBeenCalled();
  });

  it("QUIRK: in TaskNotes mode without the command, it falls back to the daily note", async () => {
    const { view, app, read } = setup([NOTE], TASKNOTES);
    (app as Any).commands = { commands: {}, executeCommandById: vi.fn() };
    vi.spyOn(view, "_prompt").mockResolvedValue("Fallback");
    await view._quickAddTodayTask();
    expect(await read(TODAY_PATH)).toContain("- [ ] Fallback\n");
    expect(app.vault.created).toEqual([]);
  });
});
