import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, Notice, SuggestModal, TFile, type MockFileSpec } from "../mocks/obsidian";
import { makeAppView } from "../helpers/app-view";
import { projectWebsite } from "../fixtures/vault";

/* Characterization tests for task↔project linking and task-completion
   propagation: _taskLinkKey, _getTaskProjectLink, _setTaskProjectLink,
   _openTaskProjectPicker, _propagateTaskComplete, _tickProjectTaskByText and
   _tickDailyNoteTaskByText. Time is frozen at Saturday 2026-10-10 09:00 UTC. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const NOW = new Date("2026-10-10T09:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  Notice.messages.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const SETTINGS = { tasksHeading: "## Today", journalHeading: "## Journal", taskManagementSystem: "native" };

function setup(files: MockFileSpec[] = [], settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files, settings: { ...SETTINGS, ...settings } });
  const updates: Array<[string, Record<string, unknown>]> = [];
  (made.plugin as Any).updateReminder = vi.fn(async (id: string, patch: Record<string, unknown>) => {
    updates.push([id, patch]);
  });
  const rendered = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path) as TFile;
  const read = (path: string) => made.app.vault.read(file(path));
  return { ...made, updates, rendered, file, read };
}

const reminder = (id: string, text: string, extra: Record<string, unknown> = {}) => ({
  id, text, when: null, repeat: "none", notes: "", project: null, notified: false, done: false, createdAt: "", ...extra,
});

describe("_taskLinkKey", () => {
  it("joins the daily path and the trimmed text with ::", () => {
    const { view } = setup();
    expect(view._taskLinkKey("daily/2026-10-10.md", "  Buy milk  ")).toBe("daily/2026-10-10.md::Buy milk");
  });

  it("treats missing text as empty", () => {
    const { view } = setup();
    expect(view._taskLinkKey("daily/a.md", null)).toBe("daily/a.md::");
    expect(view._taskLinkKey("daily/a.md", undefined)).toBe("daily/a.md::");
  });
});

describe("_getTaskProjectLink", () => {
  it("looks up the link by (dailyPath, trimmed text)", () => {
    const { view } = setup([], { taskProjectLinks: { "daily/a.md::Ship": "Cadence/Projects/P.md" } });
    expect(view._getTaskProjectLink("daily/a.md", " Ship ")).toBe("Cadence/Projects/P.md");
    expect(view._getTaskProjectLink("daily/b.md", "Ship")).toBeNull();
  });

  it("returns null without a taskProjectLinks map", () => {
    const { view } = setup();
    expect(view._getTaskProjectLink("daily/a.md", "Ship")).toBeNull();
  });

  it("QUIRK: an empty-string link reads as no link", () => {
    const { view } = setup([], { taskProjectLinks: { "daily/a.md::Ship": "" } });
    expect(view._getTaskProjectLink("daily/a.md", "Ship")).toBeNull();
  });
});

describe("_setTaskProjectLink", () => {
  it("creates the map, stores the link, saves and re-renders", async () => {
    const { view, plugin, rendered } = setup();
    delete plugin.settings.taskProjectLinks;
    await view._setTaskProjectLink("daily/a.md", " Ship ", "Cadence/Projects/P.md");
    expect(plugin.settings.taskProjectLinks).toEqual({ "daily/a.md::Ship": "Cadence/Projects/P.md" });
    expect(plugin.saves).toBe(1);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("replaces an existing link", async () => {
    const { view, plugin } = setup([], { taskProjectLinks: { "daily/a.md::Ship": "old.md", "other::x": "y.md" } });
    await view._setTaskProjectLink("daily/a.md", "Ship", "new.md");
    expect(plugin.settings.taskProjectLinks).toEqual({ "daily/a.md::Ship": "new.md", "other::x": "y.md" });
  });

  it("deletes the link for a null (or empty) project, and still saves and re-renders", async () => {
    const { view, plugin, rendered } = setup([], { taskProjectLinks: { "daily/a.md::Ship": "old.md", "daily/a.md::B": "b.md" } });
    await view._setTaskProjectLink("daily/a.md", "Ship", null);
    await view._setTaskProjectLink("daily/a.md", "B", "");
    expect(plugin.settings.taskProjectLinks).toEqual({});
    expect(plugin.saves).toBe(2);
    expect(rendered).toHaveBeenCalledTimes(2);
  });

  it("awaits the save before re-rendering", async () => {
    const { view, plugin, rendered } = setup();
    const order: string[] = [];
    plugin.saveSettings = async () => {
      await Promise.resolve();
      order.push("save");
    };
    rendered.mockImplementation(async () => {
      order.push("render");
    });
    await view._setTaskProjectLink("daily/a.md", "Ship", "p.md");
    expect(order).toEqual(["save", "render"]);
  });
});

describe("_openTaskProjectPicker", () => {
  const PROJECT_B: MockFileSpec = { path: "Cadence/Projects/sub/Backend.md", frontmatter: { type: "project" } };

  function capturePicker() {
    const opened: Any[] = [];
    const placeholders: string[] = [];
    vi.spyOn(SuggestModal.prototype, "open").mockImplementation(function (this: Any) {
      opened.push(this);
    });
    vi.spyOn(SuggestModal.prototype, "setPlaceholder").mockImplementation((text: string) => {
      placeholders.push(text);
    });
    return { opened, placeholders };
  }

  it("shows a Notice and opens nothing when there are no projects", () => {
    const { view } = setup();
    const { opened } = capturePicker();
    view._openTaskProjectPicker("daily/a.md", "Ship", null);
    expect(Notice.messages).toEqual(["No projects yet. Create one in Planner → Projects first."]);
    expect(opened).toHaveLength(0);
  });

  it("opens a picker over every project file, named by frontmatter name or basename", () => {
    const { view } = setup([projectWebsite, PROJECT_B]);
    const { opened, placeholders } = capturePicker();
    view._openTaskProjectPicker("daily/a.md", "Ship", null);
    expect(opened).toHaveLength(1);
    expect(placeholders).toEqual(["Pick a project to link this task to"]);
    expect(opened[0].projs.map((p: Any) => [p.name, p.file.path])).toEqual([
      ["Website relaunch", "Cadence/Projects/Website relaunch.md"],
      ["Backend", "Cadence/Projects/sub/Backend.md"],
    ]);
    expect(opened[0].hasLink).toBe(false);
  });

  it("filters by case-insensitive substring, without an unlink row when unlinked", () => {
    const { view } = setup([projectWebsite, PROJECT_B]);
    const { opened } = capturePicker();
    view._openTaskProjectPicker("daily/a.md", "Ship", null);
    const names = (q: string | null) => opened[0].getSuggestions(q).map((p: Any) => p.name);
    expect(names("")).toEqual(["Website relaunch", "Backend"]);
    expect(names("WEB")).toEqual(["Website relaunch"]);
    expect(names(null)).toEqual(["Website relaunch", "Backend"]);
    expect(names("zzz")).toEqual([]);
  });

  it("with a link, offers '— Remove link —' first for an empty query or any prefix of 'unlink'", () => {
    const { view } = setup([projectWebsite, PROJECT_B]);
    const { opened, placeholders } = capturePicker();
    view._openTaskProjectPicker("daily/a.md", "Ship", "Cadence/Projects/Website relaunch.md");
    expect(placeholders).toEqual(['Pick a project (or type "unlink" to remove)']);
    const names = (q: string) => opened[0].getSuggestions(q).map((p: Any) => p.name);
    expect(names("")).toEqual(["— Remove link —", "Website relaunch", "Backend"]);
    expect(names("unl")).toEqual(["— Remove link —"]);
    expect(names("n")).toEqual(["— Remove link —", "Website relaunch", "Backend"]);
    expect(names("back")).toEqual(["Backend"]);
  });

  it("renders the unlink row in the error colour and projects with a folder icon", () => {
    const { view } = setup([projectWebsite]);
    const { opened } = capturePicker();
    view._openTaskProjectPicker("daily/a.md", "Ship", "x.md");
    const unlinkEl = new FakeElement("div");
    const projEl = new FakeElement("div");
    const [unlink, proj] = opened[0].getSuggestions("");
    opened[0].renderSuggestion(unlink, unlinkEl);
    opened[0].renderSuggestion(proj, projEl);
    expect([unlinkEl.text, unlinkEl.style.color]).toEqual(["— Remove link —", "var(--text-error, #c0392b)"]);
    expect([projEl.text, projEl.style.color]).toEqual(["📁  Website relaunch", undefined]);
  });

  it("choosing a project links it; choosing unlink removes the link", () => {
    const { view } = setup([projectWebsite]);
    const { opened } = capturePicker();
    const set = vi.spyOn(view, "_setTaskProjectLink").mockResolvedValue(undefined);
    view._openTaskProjectPicker("daily/a.md", "Ship", "x.md");
    const [unlink, proj] = opened[0].getSuggestions("");
    opened[0].onChooseSuggestion(proj);
    opened[0].onChooseSuggestion(unlink);
    expect(set.mock.calls).toEqual([
      ["daily/a.md", "Ship", "Cadence/Projects/Website relaunch.md"],
      ["daily/a.md", "Ship", null],
    ]);
  });
});

describe("_tickProjectTaskByText", () => {
  const project = (tasks: string): MockFileSpec => ({
    path: "Cadence/Projects/P.md",
    body: `# P\n\n## Brief\nText\n\n## Tasks\n${tasks}\n## Notes\nN\n`,
  });

  it("ticks every open task whose trimmed title matches and rewrites ## Tasks", async () => {
    const { view, file, read, app } = setup([project("- [ ] Ship\n- [ ] Other\n- [ ] Ship \n")]);
    await view._tickProjectTaskByText(file("Cadence/Projects/P.md"), "Ship", true);
    expect(await read("Cadence/Projects/P.md")).toBe(
      "# P\n\n## Brief\nText\n\n## Tasks\n- [x] Ship\n- [ ] Other\n- [x] Ship \n\n## Notes\nN\n",
    );
    expect(app.vault.modified).toEqual(["Cadence/Projects/P.md"]);
  });

  it("unticks a done task (either case of x)", async () => {
    const { view, file, read } = setup([project("- [X] Ship\n")]);
    await view._tickProjectTaskByText(file("Cadence/Projects/P.md"), "Ship", false);
    expect(await read("Cadence/Projects/P.md")).toContain("## Tasks\n- [ ] Ship\n\n## Notes");
  });

  it("writes nothing when no task changes state", async () => {
    const { view, file, app } = setup([project("- [x] Ship\n- [ ] Other\n")]);
    await view._tickProjectTaskByText(file("Cadence/Projects/P.md"), "Ship", true);
    await view._tickProjectTaskByText(file("Cadence/Projects/P.md"), "Missing", true);
    expect(app.vault.modified).toEqual([]);
  });

  it("does not trim the search text", async () => {
    const { view, file, app } = setup([project("- [ ] Ship\n")]);
    await view._tickProjectTaskByText(file("Cadence/Projects/P.md"), " Ship", true);
    expect(app.vault.modified).toEqual([]);
  });

  it("QUIRK: the rewrite drops non-task lines from ## Tasks and indentation from task lines", async () => {
    const { view, file, read } = setup([project("Intro line\n- [ ] Ship\n  - [ ] Sub\n    detail\n")]);
    await view._tickProjectTaskByText(file("Cadence/Projects/P.md"), "Ship", true);
    expect(await read("Cadence/Projects/P.md")).toContain("## Tasks\n- [x] Ship\n- [ ] Sub\n\n## Notes");
  });

  it("does nothing without a ## Tasks section", async () => {
    const { view, file, app } = setup([{ path: "Cadence/Projects/P.md", body: "# P\n- [ ] Ship\n" }]);
    await view._tickProjectTaskByText(file("Cadence/Projects/P.md"), "Ship", true);
    expect(app.vault.modified).toEqual([]);
  });

  it("swallows a read error", async () => {
    const { view, file, app } = setup([project("- [ ] Ship\n")]);
    vi.spyOn(app.vault, "read").mockRejectedValue(new Error("gone"));
    await expect(view._tickProjectTaskByText(file("Cadence/Projects/P.md"), "Ship", true)).resolves.toBeUndefined();
    expect(app.vault.modified).toEqual([]);
  });
});

describe("_tickDailyNoteTaskByText", () => {
  const daily = (tasks: string): MockFileSpec => ({
    path: "daily/2026-10-10.md",
    body: `# 2026-10-10\n\n## Today\n${tasks}\n## Journal\nDear diary\n`,
  });

  it("ticks every matching open line under the tasks heading", async () => {
    const { view, file, read } = setup([daily("- [ ] Ship\n- [ ] Other\n- [ ]  Ship  \n")]);
    await view._tickDailyNoteTaskByText(file("daily/2026-10-10.md"), "Ship", true);
    expect(await read("daily/2026-10-10.md")).toBe(
      "# 2026-10-10\n\n## Today\n- [x] Ship\n- [ ] Other\n- [x]  Ship  \n\n## Journal\nDear diary\n",
    );
  });

  it("unticks a done line (x or X)", async () => {
    const { view, file, read } = setup([daily("- [X] Ship\n- [x] Ship\n")]);
    await view._tickDailyNoteTaskByText(file("daily/2026-10-10.md"), "Ship", false);
    expect(await read("daily/2026-10-10.md")).toContain("## Today\n- [ ] Ship\n- [ ] Ship\n\n## Journal");
  });

  it("writes nothing when nothing changes", async () => {
    const { view, file, app } = setup([daily("- [x] Ship\n")]);
    await view._tickDailyNoteTaskByText(file("daily/2026-10-10.md"), "Ship", true);
    await view._tickDailyNoteTaskByText(file("daily/2026-10-10.md"), "Nope", false);
    expect(app.vault.modified).toEqual([]);
  });

  it("uses the configured tasks heading", async () => {
    const { view, file, read } = setup(
      [{ path: "daily/2026-10-10.md", body: "## Todo\n- [ ] Ship\n## Today\n- [ ] Ship\n" }],
      { tasksHeading: "## Todo" },
    );
    await view._tickDailyNoteTaskByText(file("daily/2026-10-10.md"), "Ship", true);
    expect(await read("daily/2026-10-10.md")).toBe("## Todo\n- [x] Ship\n\n## Today\n- [ ] Ship\n");
  });

  it("QUIRK: the rewrite drops non-task lines from the tasks section and de-indents the ticked line", async () => {
    const { view, file, read } = setup([daily("Plan:\n  - [ ] Ship\n  - [ ] Keep\n")]);
    await view._tickDailyNoteTaskByText(file("daily/2026-10-10.md"), "Ship", true);
    expect(await read("daily/2026-10-10.md")).toContain("## Today\n- [x] Ship\n  - [ ] Keep\n\n## Journal");
  });

  it("swallows a read error", async () => {
    const { view, file, app } = setup([daily("- [ ] Ship\n")]);
    vi.spyOn(app.vault, "read").mockRejectedValue(new Error("gone"));
    await view._tickDailyNoteTaskByText(file("daily/2026-10-10.md"), "Ship", true);
    expect(app.vault.modified).toEqual([]);
  });
});

describe("_propagateTaskComplete", () => {
  function spyTicks(view: Any) {
    const project = vi.spyOn(view, "_tickProjectTaskByText").mockResolvedValue(undefined);
    const daily = vi.spyOn(view, "_tickDailyNoteTaskByText").mockResolvedValue(undefined);
    const paths = (spy: typeof project) => spy.mock.calls.map(([f, t, d]) => [(f as TFile).path, t, d]);
    return { project, daily, projectCalls: () => paths(project), dailyCalls: () => paths(daily) };
  }

  const TODAY = { path: "daily/2026-10-10.md", body: "## Today\n" };

  it("does nothing for blank text", async () => {
    const { view, updates } = setup([TODAY], { reminders: [reminder("r1", "")] });
    const ticks = spyTicks(view);
    await view._propagateTaskComplete("   ", true);
    await view._propagateTaskComplete(null, true);
    expect(updates).toEqual([]);
    expect(ticks.daily).not.toHaveBeenCalled();
  });

  it("syncs matching reminders by trimmed text, skipping the source reminder and those already in state", async () => {
    const { view, updates } = setup([], {
      reminders: [
        reminder("r1", " Ship "),
        reminder("r2", "Ship", { done: true }),
        reminder("r3", "Ship"),
        reminder("r4", "Shipping"),
        reminder("r5", ""),
      ],
    });
    spyTicks(view);
    await view._propagateTaskComplete(" Ship ", true, { kind: "reminder", id: "r3" });
    expect(updates).toEqual([["r1", { done: true }]]);
  });

  it("coerces done to a boolean when syncing reminders", async () => {
    const { view, updates } = setup([], { reminders: [reminder("r1", "Ship", { done: true })] });
    spyTicks(view);
    await view._propagateTaskComplete("Ship", 0);
    expect(updates).toEqual([["r1", { done: false }]]);
  });

  it("ticks each linked project once, including the source reminder's project", async () => {
    const files = [
      { path: "Cadence/Projects/A.md", body: "" },
      { path: "Cadence/Projects/B.md", body: "" },
    ];
    const { view } = setup(files, {
      reminders: [
        reminder("r1", "Ship", { project: "Cadence/Projects/A.md" }),
        reminder("r2", "Ship", { project: "Cadence/Projects/A.md", done: true }),
        reminder("r3", "Ship", { project: "Cadence/Projects/B.md" }),
        reminder("r4", "Ship", { project: "Cadence/Projects/Missing.md" }),
        reminder("r5", "Other", { project: "Cadence/Projects/B.md" }),
      ],
    });
    const ticks = spyTicks(view);
    await view._propagateTaskComplete("Ship", true, { kind: "reminder", id: "r1" });
    expect(ticks.projectCalls()).toEqual([
      ["Cadence/Projects/A.md", "Ship", true],
      ["Cadence/Projects/B.md", "Ship", true],
    ]);
  });

  it("skips the source project", async () => {
    const files = [{ path: "Cadence/Projects/A.md", body: "" }, { path: "Cadence/Projects/B.md", body: "" }];
    const { view, file } = setup(files, {
      reminders: [
        reminder("r1", "Ship", { project: "Cadence/Projects/A.md" }),
        reminder("r2", "Ship", { project: "Cadence/Projects/B.md" }),
      ],
    });
    const ticks = spyTicks(view);
    await view._propagateTaskComplete("Ship", false, { kind: "project", file: file("Cadence/Projects/A.md") });
    expect(ticks.projectCalls()).toEqual([["Cadence/Projects/B.md", "Ship", false]]);
  });

  it("skips a project path that is a folder", async () => {
    const { view } = setup([{ path: "Cadence/Projects/A/x.md", body: "" }], {
      reminders: [reminder("r1", "Ship", { project: "Cadence/Projects/A" })],
    });
    const ticks = spyTicks(view);
    await view._propagateTaskComplete("Ship", true);
    expect(ticks.project).not.toHaveBeenCalled();
  });

  it("ticks today's note plus each match's when and createdAt notes, once each and only if they exist", async () => {
    const files = [
      TODAY,
      { path: "daily/2026-10-12.md", body: "" },
      { path: "daily/2026-10-01.md", body: "" },
      { path: "daily/2026-09-30.md", body: "" },
    ];
    const { view } = setup(files, {
      reminders: [
        reminder("r1", "Ship", { when: "2026-10-12T15:00:00Z", createdAt: "2026-10-01T08:00:00Z" }),
        reminder("r2", "Ship", { when: "2026-10-10T20:00:00Z", createdAt: "not a date" }),
        reminder("r3", "Ship", { when: "2026-10-20T08:00:00Z" }),
        reminder("r4", "Other", { when: "2026-09-30T08:00:00Z" }),
      ],
    });
    const ticks = spyTicks(view);
    await view._propagateTaskComplete("Ship", true);
    expect(ticks.dailyCalls()).toEqual([
      ["daily/2026-10-10.md", "Ship", true],
      ["daily/2026-10-12.md", "Ship", true],
      ["daily/2026-10-01.md", "Ship", true],
    ]);
  });

  it("adds a daily source's date but skips the source note itself", async () => {
    const files = [TODAY, { path: "daily/2026-10-08.md", body: "" }];
    const { view, file } = setup(files);
    const ticks = spyTicks(view);
    await view._propagateTaskComplete("Ship", true, {
      kind: "daily", file: file("daily/2026-10-08.md"), date: new Date("2026-10-08T12:00:00Z"),
    });
    expect(ticks.dailyCalls()).toEqual([["daily/2026-10-10.md", "Ship", true]]);

    ticks.daily.mockClear();
    await view._propagateTaskComplete("Ship", true, { kind: "daily", file: file("daily/2026-10-10.md"), date: new Date() });
    expect(ticks.dailyCalls()).toEqual([]);
  });

  it("builds daily paths from dailyNoteFolder (trailing slash stripped) or the vault root", async () => {
    const a = setup([{ path: "notes/2026-10-10.md", body: "" }], { dailyNoteFolder: "notes/" });
    const ticksA = spyTicks(a.view);
    await a.view._propagateTaskComplete("Ship", true);
    expect(ticksA.dailyCalls()).toEqual([["notes/2026-10-10.md", "Ship", true]]);

    const b = setup([{ path: "2026-10-10.md", body: "" }], { dailyNoteFolder: "" });
    const ticksB = spyTicks(b.view);
    await b.view._propagateTaskComplete("Ship", true);
    expect(ticksB.dailyCalls()).toEqual([["2026-10-10.md", "Ship", true]]);
  });

  it("runs reminders, then projects, then daily notes, in order", async () => {
    const { view, plugin } = setup([TODAY, { path: "Cadence/Projects/A.md", body: "" }], {
      reminders: [reminder("r1", "Ship", { project: "Cadence/Projects/A.md" })],
    });
    const order: string[] = [];
    (plugin as Any).updateReminder = vi.fn(async () => {
      order.push("reminder");
    });
    vi.spyOn(view, "_tickProjectTaskByText").mockImplementation(async () => {
      order.push("project");
    });
    vi.spyOn(view, "_tickDailyNoteTaskByText").mockImplementation(async () => {
      order.push("daily");
    });
    await view._propagateTaskComplete("Ship", true);
    expect(order).toEqual(["reminder", "project", "daily"]);
  });

  it("QUIRK: a Today task's project link (taskProjectLinks) is never consulted", async () => {
    const { view } = setup([TODAY, { path: "Cadence/Projects/A.md", body: "## Tasks\n- [ ] Ship\n" }], {
      taskProjectLinks: { "daily/2026-10-10.md::Ship": "Cadence/Projects/A.md" },
    });
    const ticks = spyTicks(view);
    await view._propagateTaskComplete("Ship", true);
    expect(ticks.project).not.toHaveBeenCalled();
  });

  it("writes through to the real notes end to end", async () => {
    const { view, read, plugin } = setup(
      [
        { path: "daily/2026-10-10.md", body: "## Today\n- [ ] Ship\n" },
        { path: "Cadence/Projects/A.md", body: "## Tasks\n- [ ] Ship\n" },
      ],
      { reminders: [reminder("r1", "Ship", { project: "Cadence/Projects/A.md" })] },
    );
    await view._propagateTaskComplete("Ship", true);
    expect((plugin as Any).updateReminder).toHaveBeenCalledWith("r1", { done: true });
    expect(await read("Cadence/Projects/A.md")).toBe("## Tasks\n- [x] Ship\n");
    expect(await read("daily/2026-10-10.md")).toBe("## Today\n- [x] Ship\n");
  });
});
