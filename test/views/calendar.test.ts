import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, TFile, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";

/* Characterization tests for the Calendar (week planner) surface:
   renderPlannerPane and togglePlannerTask, in daily-note and TaskNotes modes.
   Time is frozen at Saturday 2026-10-10 09:00 UTC; with weekStartsOn 1 the
   week runs Monday 2026-10-05 to Sunday 2026-10-11. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const NOW = new Date("2026-10-10T09:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const SETTINGS = { tasksHeading: "## Today", journalHeading: "## Journal", taskManagementSystem: "native" };
const TASKNOTES = { taskManagementSystem: "tasknotes" };

function setup(files: MockFileSpec[] = [], settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files, settings: { ...SETTINGS, ...settings } });
  const parent = new FakeElement("div");
  const rendered = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
  const propagate = vi.spyOn(made.view, "_propagateTaskComplete").mockResolvedValue(undefined);
  const open = vi.spyOn(made.app.workspace, "openLinkText");
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path) as TFile;
  const read = (path: string) => made.app.vault.read(file(path));
  return { ...made, parent, rendered, propagate, open, file, read };
}

const daily = (date: string, tasks: string): MockFileSpec => ({ path: `daily/${date}.md`, body: `## Today\n${tasks}\n## Journal\n` });
const taskNote = (name: string, fm: Record<string, unknown>): MockFileSpec => ({ path: `TaskNotes/Tasks/${name}.md`, frontmatter: fm });

const WEEK = [
  daily("2026-10-05", "- [ ] Mon one\n- [x] Mon two"),
  daily("2026-10-10", "- [ ] Sat one"),
  daily("2026-10-11", ""),
];

const days = (root: FakeElement) => root.querySelectorAll(".cad-pl-day");
const dayHead = (day: FakeElement) => day.children[0].children.map((c) => c.text);
const dayTasks = (day: FakeElement) => day.children[1].children.map((r) => [r.classes, r.children.map((c) => c.text)]);

describe("renderPlannerPane", () => {
  it("titles the week and wires ◀ / Today / ▶ to move the anchor and re-render", async () => {
    const { view, parent, rendered } = setup();
    await view.renderPlannerPane(parent);
    expect(parent.classes).toEqual(["cadence-planner"]);
    const header = parent.children[0];
    expect(header.classes).toEqual(["cad-pl-header"]);
    const title = header.children[0];
    expect(title.children.map((c) => [c.classes[0], c.text])).toEqual([
      ["cad-eyebrow", "WEEK OF"],
      ["cad-pl-title", "October 5 – October 11, 2026"],
    ]);
    const nav = header.children[1];
    expect(nav.children.map((b) => [b.text, b.classes])).toEqual([
      ["◀", ["cad-pl-btn"]],
      ["Today", ["cad-pl-btn", "primary"]],
      ["▶", ["cad-pl-btn"]],
    ]);
    nav.children[0].trigger("click");
    expect(view.plannerAnchor).toEqual(new Date("2026-10-03T00:00:00Z"));
    nav.children[0].trigger("click");
    expect(view.plannerAnchor).toEqual(new Date("2026-09-26T00:00:00Z"));
    nav.children[1].trigger("click");
    expect(view.plannerAnchor).toEqual(new Date("2026-10-10T00:00:00Z"));
    nav.children[2].trigger("click");
    expect(view.plannerAnchor).toEqual(new Date("2026-10-17T00:00:00Z"));
    expect(rendered).toHaveBeenCalledTimes(4);
  });

  it("renders the anchor's week, starting on settings.weekStartsOn", async () => {
    const { view, parent } = setup([], { weekStartsOn: 0 });
    view.plannerAnchor = new Date("2026-10-20T00:00:00Z");
    await view.renderPlannerPane(parent);
    expect(parent.querySelectorAll(".cad-pl-title")[0].text).toBe("October 18 – October 24, 2026");
    expect(days(parent).map((d) => dayHead(d).slice(0, 2))).toEqual([
      ["SUN", "18"], ["MON", "19"], ["TUE", "20"], ["WED", "21"], ["THU", "22"], ["FRI", "23"], ["SAT", "24"],
    ]);
    expect(days(parent).filter((d) => d.classes.includes("today"))).toEqual([]);
  });

  it("shows OPEN / DONE / TOTAL across the week", async () => {
    const { view, parent } = setup(WEEK);
    await view.renderPlannerPane(parent);
    const stats = parent.querySelectorAll(".cad-pl-stat");
    expect(stats.map((s) => s.children.map((c) => [c.classes[0], c.text]))).toEqual([
      [["cad-pl-stat-label", "OPEN"], ["cad-pl-stat-value", "2"]],
      [["cad-pl-stat-label", "DONE"], ["cad-pl-stat-value", "1"]],
      [["cad-pl-stat-label", "TOTAL"], ["cad-pl-stat-value", "3"]],
    ]);
  });

  it("renders seven day columns: today marked, counts or 'no note', and each day's tasks", async () => {
    const { view, parent } = setup(WEEK);
    await view.renderPlannerPane(parent);
    expect(parent.querySelectorAll(".cad-pl-grid")).toHaveLength(1);
    expect(days(parent).map((d) => [d.classes, dayHead(d)])).toEqual([
      [["cad-pl-day"], ["MON", "5", "1 open · 1 done"]],
      [["cad-pl-day"], ["TUE", "6", "no note"]],
      [["cad-pl-day"], ["WED", "7", "no note"]],
      [["cad-pl-day"], ["THU", "8", "no note"]],
      [["cad-pl-day"], ["FRI", "9", "no note"]],
      [["cad-pl-day", "today"], ["SAT", "10", "1 open · 0 done"]],
      [["cad-pl-day"], ["SUN", "11", "0 open · 0 done"]],
    ]);
    const [mon, tue, , , , sat, sun] = days(parent);
    expect(dayTasks(mon)).toEqual([[["cad-pl-task"], ["", "Mon one"]], [["cad-pl-task", "done"], ["", "Mon two"]]]);
    expect(mon.children[1].children.map((r) => r.children[0].checked)).toEqual([false, true]);
    expect(dayTasks(sat)).toEqual([[["cad-pl-task"], ["", "Sat one"]]]);
    expect(dayTasks(sun)).toEqual([[["cad-empty"], []]]);
    expect(sun.children[1].children[0].text).toBe("—");
    expect(tue.children[1].children.map((c) => [c.classes, c.text])).toEqual([[["cad-empty"], ""]]);
  });

  it("uses the class names for the head, meta and task list", async () => {
    const { view, parent } = setup(WEEK);
    await view.renderPlannerPane(parent);
    const mon = days(parent)[0];
    expect(mon.children.map((c) => c.classes)).toEqual([["cad-pl-day-head"], ["cad-pl-tasks"]]);
    expect(mon.children[0].children.map((c) => c.classes)).toEqual([["cad-pl-weekday"], ["cad-pl-daynum"], ["cad-pl-meta"]]);
  });

  it("a day head opens its note, creating it first if missing", async () => {
    const { view, parent, open, app } = setup(WEEK);
    await view.renderPlannerPane(parent);
    const [mon, tue] = days(parent);
    mon.children[0].trigger("click");
    tue.children[0].trigger("click");
    await flush();
    expect(app.vault.created).toEqual(["daily/2026-10-06.md"]);
    expect(open.mock.calls).toEqual([["daily/2026-10-05.md", "", false], ["daily/2026-10-06.md", "", false]]);
  });

  it("a checkbox toggles that day's task by index", async () => {
    const { view, parent } = setup(WEEK);
    const toggle = vi.spyOn(view, "togglePlannerTask").mockResolvedValue(undefined);
    await view.renderPlannerPane(parent);
    const cb = days(parent)[0].children[1].children[1].children[0];
    cb.checked = false;
    cb.trigger("change");
    const [[day, idx, checked]] = toggle.mock.calls as Any;
    expect([day.path, day.exists, day.date, day.tasks, idx, checked]).toEqual([
      "daily/2026-10-05.md", true, new Date("2026-10-05T00:00:00Z"), ["- [ ] Mon one", "- [x] Mon two"], 1, false,
    ]);
  });

  it("treats a folder at the daily path as no note", async () => {
    const { view, parent } = setup([{ path: "daily/2026-10-05.md/x.md", body: "" }]);
    await view.renderPlannerPane(parent);
    expect(dayHead(days(parent)[0])[2]).toBe("no note");
  });

  it("reads tasks only under the tasks heading", async () => {
    const { view, parent } = setup([{ path: "daily/2026-10-05.md", body: "- [ ] stray\n## Today\n- [ ] in\n## Other\n- [ ] out\n" }]);
    await view.renderPlannerPane(parent);
    expect(dayTasks(days(parent)[0])).toEqual([[["cad-pl-task"], ["", "in"]]]);
  });

  describe("TaskNotes mode", () => {
    const TASKS = [
      taskNote("A", { title: "A", status: "open", scheduled: "2026-10-05" }),
      taskNote("B", { title: "B", status: "done", scheduled: "2026-10-05" }),
      taskNote("C", { title: "C", scheduled: "2026-10-09" }),
      taskNote("D", { title: "D", scheduled: "2026-10-20" }),
    ];

    it("lists each day's scheduled task notes as links", async () => {
      const { view, parent, open } = setup([daily("2026-10-05", "- [ ] ignored"), ...TASKS], TASKNOTES);
      await view.renderPlannerPane(parent);
      expect(parent.querySelectorAll(".cad-pl-stat-value").map((v) => v.text)).toEqual(["2", "1", "3"]);
      const [mon, , , , fri] = days(parent);
      expect(dayHead(mon)).toEqual(["MON", "5", "1 open · 1 done"]);
      expect(mon.children[1].children.map((r) => r.children.map((c) => [c.localName, c.text]))).toEqual([
        [["input", ""], ["a", "A"]],
        [["input", ""], ["a", "B"]],
      ]);
      const link = mon.children[1].children[1].children[1];
      expect(link.style.cursor).toBe("pointer");
      expect(link.trigger("click").defaultPrevented).toBe(true);
      expect(open.mock.calls).toEqual([["TaskNotes/Tasks/B.md", "", false]]);
      expect(dayTasks(fri)).toEqual([[["cad-pl-task"], ["", "C"]]]);
    });

    it("QUIRK: a day with scheduled tasks but no daily note reads 'no note'", async () => {
      const { view, parent } = setup(TASKS, TASKNOTES);
      await view.renderPlannerPane(parent);
      const fri = days(parent)[4];
      expect(dayHead(fri)).toEqual(["FRI", "9", "no note"]);
      expect(dayTasks(fri)).toEqual([[["cad-pl-task"], ["", "C"]]]);
    });

    it("QUIRK: a folder at the daily path counts as a note", async () => {
      const { view, parent } = setup([{ path: "daily/2026-10-06.md/x.md", body: "" }], TASKNOTES);
      await view.renderPlannerPane(parent);
      expect(dayHead(days(parent)[1])).toEqual(["TUE", "6", "0 open · 0 done"]);
      expect(days(parent)[1].children[1].children[0].text).toBe("—");
    });
  });
});

describe("togglePlannerTask", () => {
  async function dayData(view: Any, parent: FakeElement, index: number): Promise<Any> {
    const toggle = vi.spyOn(view, "togglePlannerTask").mockResolvedValue(undefined);
    await view.renderPlannerPane(parent);
    const day = days(parent)[index];
    const cb = day.children[1].children[0]?.children[0];
    if (cb) cb.trigger("change");
    const captured = toggle.mock.calls[0]?.[0];
    toggle.mockRestore();
    return captured;
  }

  it("rewrites the line at the index, propagates with the day's date, and re-renders", async () => {
    const { view, parent, read, propagate, rendered, file } = setup(WEEK);
    const mon = await dayData(view, parent, 0);
    await view.togglePlannerTask(mon, 0, true);
    expect(await read("daily/2026-10-05.md")).toBe("## Today\n- [x] Mon one\n- [x] Mon two\n\n## Journal\n");
    expect(propagate.mock.calls).toEqual([[
      "Mon one", true, { kind: "daily", file: file("daily/2026-10-05.md"), date: new Date("2026-10-05T00:00:00Z") },
    ]]);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("unticks a done line", async () => {
    const { view, parent, read } = setup(WEEK);
    const mon = await dayData(view, parent, 0);
    await view.togglePlannerTask(mon, 1, false);
    expect(await read("daily/2026-10-05.md")).toBe("## Today\n- [ ] Mon one\n- [ ] Mon two\n\n## Journal\n");
  });

  it("QUIRK: a day without a note returns early, with no re-render", async () => {
    const { view, rendered, propagate, app } = setup();
    await view.togglePlannerTask({ date: new Date(), path: "daily/x.md", exists: false, tasks: [] }, 0, true);
    expect(rendered).not.toHaveBeenCalled();
    expect(propagate).not.toHaveBeenCalled();
    expect(app.vault.modified).toEqual([]);
  });

  it("writes but skips propagation for a blank task", async () => {
    const { view, parent, propagate, app } = setup([daily("2026-10-05", "- [ ] ")]);
    const mon = await dayData(view, parent, 0);
    await view.togglePlannerTask(mon, 0, true);
    expect(app.vault.modified).toEqual(["daily/2026-10-05.md"]);
    expect(propagate).not.toHaveBeenCalled();
  });

  it("in TaskNotes mode, sets the task note's status and re-renders without propagating", async () => {
    const { view, parent, app, rendered, propagate } = setup(
      [taskNote("A", { title: "A", status: "done", scheduled: "2026-10-05" })],
      TASKNOTES,
    );
    const mon = await dayData(view, parent, 0);
    await view.togglePlannerTask(mon, 0, false);
    const fm = app.metadataCache.getFileCache(app.vault.getAbstractFileByPath("TaskNotes/Tasks/A.md") as TFile)!.frontmatter;
    expect(fm!.status).toBe("open");
    await view.togglePlannerTask(mon, 3, true);
    await view.togglePlannerTask({ ...mon, rawTasks: undefined }, 0, true);
    expect(rendered).toHaveBeenCalledTimes(3);
    expect(propagate).not.toHaveBeenCalled();
  });
});
