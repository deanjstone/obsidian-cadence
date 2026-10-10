import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";
import { projectWebsite } from "../fixtures/vault";
import { CadenceReminderEditModal } from "../../src/modals/reminder-edit";
import { reminderTimeStr } from "../../src/utils/reminders";

/* Characterization tests for the Inbox surface: renderInbox,
   _renderProjectTasksSection, _renderInboxRow and _inboxOverdueCount. Time
   is frozen at Saturday 2026-10-10 09:00 UTC. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const NOW = new Date("2026-10-10T09:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(files: MockFileSpec[] = [], settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files, settings });
  const plugin = made.plugin as Any;
  const calls: Array<[string, ...unknown[]]> = [];
  for (const name of ["openQuickCapture", "snoozeReminder", "updateReminder", "completeReminder", "deleteReminder"]) {
    plugin[name] = vi.fn(async (...args: unknown[]) => {
      calls.push([name, ...args]);
    });
  }
  const parent = new FakeElement("div");
  const openDetail = vi.spyOn(made.view, "openEntityDetail").mockResolvedValue(undefined);
  const propagate = vi.spyOn(made.view, "_propagateTaskComplete").mockResolvedValue(undefined);
  const opened: CadenceReminderEditModal[] = [];
  vi.spyOn(CadenceReminderEditModal.prototype, "open").mockImplementation(function (this: CadenceReminderEditModal) {
    opened.push(this);
  });
  return { ...made, parent, calls, openDetail, propagate, opened };
}

const reminder = (id: string, when: string | null, extra: Record<string, unknown> = {}) => ({
  id, text: `Task ${id}`, when, repeat: "none", notes: "", project: null, notified: false, done: false, createdAt: "", ...extra,
});

const sectionLabels = (root: FakeElement) => root.querySelectorAll(".cad-section-label-lg").map((l) => l.text);
const rowTexts = (root: FakeElement) => root.querySelectorAll(".cad-inbox-row-text").map((t) => t.text);
const buttons = (row: FakeElement) => row.querySelectorAll(".cad-inbox-actions")[0].children;

describe("_inboxOverdueCount", () => {
  it("counts open reminders whose time is now or past", () => {
    const { view } = setup([], {
      reminders: [
        reminder("a", "2026-10-10T09:00:00Z"),
        reminder("b", "2026-10-01T09:00:00Z"),
        reminder("c", "2026-10-10T09:00:01Z"),
        reminder("d", null),
        reminder("e", "2026-10-01T09:00:00Z", { done: true }),
      ],
    });
    expect(view._inboxOverdueCount()).toBe(2);
  });

  it("is 0 without reminders", () => {
    const { view, plugin } = setup();
    delete plugin.settings.reminders;
    expect(view._inboxOverdueCount()).toBe(0);
  });

  it("QUIRK: an unparseable time is never overdue", () => {
    const { view } = setup([], { reminders: [reminder("a", "garbage")] });
    expect(view._inboxOverdueCount()).toBe(0);
  });
});

describe("renderInbox", () => {
  it("shows the empty state, with no project-tasks section, for inbox zero", async () => {
    const { view, parent } = setup([projectWebsite], { reminders: [reminder("a", null, { done: true })] });
    const section = vi.spyOn(view, "_renderProjectTasksSection");
    await view.renderInbox(parent);
    expect(parent.classes).toEqual(["cadence-inbox"]);
    expect(parent.querySelectorAll(".cad-page-title")[0].text).toBe("Inbox");
    expect(parent.querySelectorAll(".cad-page-subtitle")[0].text).toBe("0 items · capture once, surface at the right time");
    const empty = parent.querySelectorAll(".cad-empty-state")[0];
    expect(empty.children.map((c) => [c.classes[0], c.text])).toEqual([
      ["cad-empty-state-title", "Inbox zero"],
      ["cad-empty-state-desc", "Capture anything with + Quick capture above (or Cmd+Shift+I). Add a time and Cadence will remind you."],
    ]);
    expect(section).not.toHaveBeenCalled();
  });

  it("wires + Quick capture to the plugin", async () => {
    const { view, parent, calls } = setup();
    await view.renderInbox(parent);
    const btn = parent.querySelectorAll(".cad-page-header-right")[0].children[0];
    expect([btn.text, btn.classes]).toEqual(["+ Quick capture", ["cad-btn", "primary"]]);
    btn.trigger("click");
    expect(calls).toEqual([["openQuickCapture"]]);
  });

  it("buckets open reminders into NOW, TODAY, THIS WEEK and LATER, with counts", async () => {
    const { view, parent } = setup([], {
      reminders: [
        reminder("later1", null),
        reminder("week1", "2026-10-16T23:59:00Z"),
        reminder("now1", "2026-10-10T10:00:00Z"),
        reminder("today1", "2026-10-10T10:00:01Z"),
        reminder("later2", "2026-10-17T00:00:00Z"),
        reminder("now0", "2026-10-01T09:00:00Z"),
        reminder("done", "2026-10-01T09:00:00Z", { done: true }),
      ],
    });
    await view.renderInbox(parent);
    expect(parent.querySelectorAll(".cad-page-subtitle")[0].text).toBe("6 items · capture once, surface at the right time");
    expect(sectionLabels(parent)).toEqual([
      "NOW · OVERDUE OR DUE WITHIN 1 HOUR · 2",
      "TODAY · 1",
      "THIS WEEK · 1",
      "LATER · UNSCHEDULED · 2",
    ]);
    expect(rowTexts(parent)).toEqual(["Task now0", "Task now1", "Task today1", "Task week1", "Task later2", "Task later1"]);
    expect(parent.querySelectorAll(".cad-inbox-row").map((r) => r.classes)).toEqual([
      ["cad-inbox-row", "overdue"], ["cad-inbox-row", "overdue"],
      ["cad-inbox-row"], ["cad-inbox-row"], ["cad-inbox-row"], ["cad-inbox-row"],
    ]);
  });

  it("says '1 item' and skips empty buckets", async () => {
    const { view, parent } = setup([], { reminders: [reminder("a", "2026-10-12T09:00:00Z")] });
    await view.renderInbox(parent);
    expect(parent.querySelectorAll(".cad-page-subtitle")[0].text).toBe("1 item · capture once, surface at the right time");
    expect(sectionLabels(parent)).toEqual(["THIS WEEK · 1"]);
  });

  it("sorts by time, then newest capture first for ties and unscheduled", async () => {
    const { view, parent } = setup([], {
      reminders: [
        reminder("old", null, { createdAt: "2026-10-01T00:00:00Z" }),
        reminder("none", null),
        reminder("new", null, { createdAt: "2026-10-09T00:00:00Z" }),
        reminder("t1", "2026-10-12T09:00:00Z", { createdAt: "2026-10-01T00:00:00Z" }),
        reminder("t2", "2026-10-12T09:00:00Z", { createdAt: "2026-10-05T00:00:00Z" }),
      ],
    });
    await view.renderInbox(parent);
    expect(rowTexts(parent)).toEqual(["Task t2", "Task t1", "Task new", "Task old", "Task none"]);
  });

  it("leaves the settings array in its stored order", async () => {
    const reminders = [reminder("b", "2026-10-12T09:00:00Z"), reminder("a", "2026-10-11T09:00:00Z")];
    const { view, parent, plugin } = setup([], { reminders });
    await view.renderInbox(parent);
    expect(plugin.settings.reminders.map((r: Any) => r.id)).toEqual(["b", "a"]);
  });

  it("renders the rows through _renderInboxRow, then the project-tasks section", async () => {
    const { view, parent, plugin } = setup([], { reminders: [reminder("a", null)] });
    const order: unknown[] = [];
    vi.spyOn(view, "_renderInboxRow").mockImplementation((list: unknown, r: unknown, bucket: unknown) => {
      order.push(["row", (list as FakeElement).classes, (r as Any).id, bucket]);
    });
    vi.spyOn(view, "_renderProjectTasksSection").mockImplementation(async (root: unknown) => {
      order.push(["projects", root === parent]);
    });
    await view.renderInbox(parent);
    expect(order).toEqual([["row", ["cad-inbox-list"], "a", "later"], ["projects", true]]);
    expect(plugin.settings.reminders).toHaveLength(1);
  });

  it("QUIRK: an unparseable time lands in LATER but sorts as NaN", async () => {
    const { view, parent } = setup([], { reminders: [reminder("bad", "garbage"), reminder("ok", "2026-10-20T09:00:00Z")] });
    await view.renderInbox(parent);
    expect(sectionLabels(parent)).toEqual(["LATER · UNSCHEDULED · 2"]);
    expect(rowTexts(parent)).toEqual(["Task bad", "Task ok"]);
  });
});

describe("_renderInboxRow", () => {
  function row(view: Any, r: Any, bucket = "today") {
    const list = new FakeElement("div");
    view._renderInboxRow(list, r, bucket);
    const el = list.children[0];
    const [left, main, actions] = el.children;
    return { el, left, main, actions };
  }

  it("shows the time, the text and the scheduled actions", () => {
    const { view } = setup();
    const r = reminder("a", "2026-10-10T15:30:00Z");
    const { el, left, main, actions } = row(view, r);
    expect(el.classes).toEqual(["cad-inbox-row"]);
    expect(left.classes).toEqual(["cad-inbox-row-left"]);
    const time = left.children[0];
    expect(time.children.map((c) => [c.classes, c.text])).toEqual([[["cad-inbox-time-text"], reminderTimeStr(r.when)]]);
    expect(main.children.map((c) => [c.classes[0], c.text])).toEqual([["cad-inbox-row-text", "Task a"]]);
    expect([left.style.cursor, main.style.cursor]).toEqual(["pointer", "pointer"]);
    expect(actions.children.map((b) => [b.text, b.title, b.classes])).toEqual([
      ["+15m", "Snooze 15 minutes", ["cad-btn", "cad-btn-sm"]],
      ["+1h", "Snooze 1 hour", ["cad-btn", "cad-btn-sm"]],
      ["Tom.", "Snooze to tomorrow 9am", ["cad-btn", "cad-btn-sm"]],
      ["Edit", "Edit details + notes", ["cad-btn", "cad-btn-sm"]],
      ["Done", "Mark done", ["cad-btn", "cad-btn-sm", "primary"]],
      ["×", "Delete", ["cad-btn", "cad-btn-sm", "cad-btn-danger"]],
    ]);
  });

  it("marks the now bucket as overdue", () => {
    const { view } = setup();
    expect(row(view, reminder("a", null), "now").el.classes).toEqual(["cad-inbox-row", "overdue"]);
  });

  it("shows 'unscheduled' and a Schedule button for an unscheduled item", () => {
    const { view, opened } = setup();
    const r = reminder("a", null);
    const { left, actions } = row(view, r, "later");
    expect(left.children[0].children.map((c) => [c.classes, c.text])).toEqual([[["cad-inbox-time-text", "muted"], "unscheduled"]]);
    expect(actions.children.map((b) => b.text)).toEqual(["Schedule", "Edit", "Done", "×"]);
    actions.children[0].trigger("click");
    expect(opened.map((m) => m.reminder)).toEqual([r]);
  });

  it("labels the repeat; QUIRK: any repeat but none or daily reads weekly", () => {
    const { view } = setup();
    const repeat = (value: string) =>
      row(view, reminder("a", "2026-10-10T15:00:00Z", { repeat: value })).left.querySelectorAll(".cad-inbox-repeat").map((s) => s.text);
    expect(repeat("none")).toEqual([]);
    expect(repeat("daily")).toEqual(["↻ daily"]);
    expect(repeat("weekly")).toEqual(["↻ weekly"]);
    expect(repeat("monthly")).toEqual(["↻ weekly"]);
    expect(repeat("")).toEqual([]);
  });

  it("shows a project chip that opens the project", () => {
    const { view, openDetail, app } = setup([projectWebsite]);
    const { main } = row(view, reminder("a", null, { project: projectWebsite.path }));
    const chip = main.querySelectorAll(".cad-rem-project-chip")[0];
    expect([chip.localName, chip.text, chip.title, chip.parent!.classes]).toEqual([
      "a", "📁 Website relaunch", "Open project", ["cad-inbox-row-meta-row"],
    ]);
    const ev = chip.trigger("click");
    expect([ev.defaultPrevented, ev.propagationStopped]).toEqual([true, true]);
    expect(openDetail.mock.calls).toEqual([["project", app.vault.getAbstractFileByPath(projectWebsite.path)]]);
  });

  it("names a missing project from its path, and its chip does nothing", () => {
    const { view, openDetail } = setup();
    const { main } = row(view, reminder("a", null, { project: "Cadence/Projects/Gone.md" }));
    const chip = main.querySelectorAll(".cad-rem-project-chip")[0];
    expect(chip.text).toBe("📁 Gone");
    chip.trigger("click");
    expect(openDetail).not.toHaveBeenCalled();
  });

  it("previews the first non-blank notes line, truncated past 120 characters", () => {
    const { view } = setup();
    const notes = (value: string) => row(view, reminder("a", null, { notes: value })).main.querySelectorAll(".cad-inbox-row-notes");
    const [note] = notes("\n  \nFirst line\nSecond");
    expect(note.children.map((c) => [c.classes[0], c.text])).toEqual([["cad-inbox-row-notes-icon", "📝 "]]);
    expect(note.text).toBe("First line");
    expect(notes("x".repeat(120))[0].text).toBe("x".repeat(120));
    expect(notes("y".repeat(121))[0].text).toBe("y".repeat(117) + "…");
    expect(notes("   \n ")).toEqual([]);
    expect(notes("")).toEqual([]);
  });

  it("opens the reminder editor from the time column, the text and Edit", () => {
    const { view, opened, plugin } = setup();
    const r = reminder("a", "2026-10-10T15:00:00Z");
    const { left, main, actions } = row(view, r);
    left.trigger("click");
    main.trigger("click");
    const edit = actions.children[3];
    const ev = edit.trigger("click");
    expect(ev.propagationStopped).toBe(true);
    expect(opened).toHaveLength(3);
    expect(opened.every((m) => m.reminder === r && m.plugin === (plugin as Any) && m.isNew === false)).toBe(true);
  });

  it("snoozes by 15 minutes, 1 hour, or to tomorrow at 9am", () => {
    const { view, calls } = setup();
    const { actions } = row(view, reminder("a", "2026-10-10T15:00:00Z"));
    for (const b of actions.children.slice(0, 3)) b.trigger("click");
    expect(calls).toEqual([
      ["snoozeReminder", "a", 15 * 60 * 1000],
      ["snoozeReminder", "a", 60 * 60 * 1000],
      ["updateReminder", "a", { when: "2026-10-11T09:00:00.000Z", notified: false }],
    ]);
  });

  it("Done completes the reminder, then propagates its text", async () => {
    const { view, calls, propagate } = setup();
    const { actions } = row(view, reminder("a", null));
    actions.children[2].trigger("click");
    await flush();
    expect(calls).toEqual([["completeReminder", "a"]]);
    expect(propagate.mock.calls).toEqual([["Task a", true, { kind: "reminder", id: "a" }]]);
  });

  it("Done skips propagation for an item with no text", async () => {
    const { view, calls, propagate } = setup();
    const { actions } = row(view, reminder("a", null, { text: "" }));
    actions.children[2].trigger("click");
    await flush();
    expect(calls).toEqual([["completeReminder", "a"]]);
    expect(propagate).not.toHaveBeenCalled();
  });

  it("× deletes only after confirm()", () => {
    const { view, calls } = setup();
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal("confirm", confirm);
    const { actions } = row(view, reminder("a", null));
    const del = actions.children[3];
    del.trigger("click");
    del.trigger("click");
    expect(confirm.mock.calls).toEqual([["Delete this reminder?"], ["Delete this reminder?"]]);
    expect(calls).toEqual([["deleteReminder", "a"]]);
  });
});

describe("_renderProjectTasksSection", () => {
  const P2: MockFileSpec = {
    path: "Cadence/Projects/Backend.md",
    frontmatter: { type: "project" },
    body: "## Tasks\n- [ ] API\n- [x] Schema\n- [ ] \n- [ ] Deploy\n",
  };
  const DONE: MockFileSpec = { path: "Cadence/Projects/Done.md", body: "## Tasks\n- [x] All done\n" };
  const EMPTY: MockFileSpec = { path: "Cadence/Projects/Empty.md", body: "## Brief\nNo tasks\n" };

  it("renders nothing without projects or without open tasks", async () => {
    const a = setup();
    await a.view._renderProjectTasksSection(a.parent);
    expect(a.parent.children).toEqual([]);
    const b = setup([DONE, EMPTY]);
    await b.view._renderProjectTasksSection(b.parent);
    expect(b.parent.children).toEqual([]);
  });

  it("groups every open, titled task by project, with a total", async () => {
    const { view, parent } = setup([projectWebsite, P2, DONE, EMPTY]);
    await view._renderProjectTasksSection(parent);
    expect(sectionLabels(parent)).toEqual(["PROJECT TASKS · 3 open across 2 projects"]);
    const groups = parent.querySelectorAll(".cad-pt-group");
    expect(groups.map((g) => [
      g.querySelectorAll(".cad-pt-group-link")[0].text,
      g.querySelectorAll(".cad-pt-group-meta")[0].text,
      g.querySelectorAll(".cad-pt-text").map((t) => t.text),
    ])).toEqual([
      ["📁 Website relaunch", "1 open", ["Write copy"]],
      ["📁 Backend", "2 open", ["API", "Deploy"]],
    ]);
  });

  it("says '1 project' for a single project", async () => {
    const { view, parent } = setup([projectWebsite]);
    await view._renderProjectTasksSection(parent);
    expect(sectionLabels(parent)).toEqual(["PROJECT TASKS · 1 open across 1 project"]);
  });

  it("skips a project it cannot read", async () => {
    const { view, parent, app } = setup([projectWebsite, P2]);
    const read = app.vault.read.bind(app.vault);
    vi.spyOn(app.vault, "read").mockImplementation(async (f: Any) => {
      if (f.path === P2.path) throw new Error("locked");
      return read(f);
    });
    await view._renderProjectTasksSection(parent);
    expect(sectionLabels(parent)).toEqual(["PROJECT TASKS · 1 open across 1 project"]);
  });

  it("shows a muted bell for an unlinked task, which opens a new reminder for it", async () => {
    const { view, parent, opened, plugin } = setup([projectWebsite]);
    await view._renderProjectTasksSection(parent);
    const row = parent.querySelectorAll(".cad-pt-row")[0];
    expect(row.children.map((c) => [c.localName, c.classes, c.text])).toEqual([
      ["span", ["cad-pt-bullet"], "•"],
      ["span", ["cad-pt-text"], "Write copy"],
      ["button", ["cad-btn", "cad-btn-sm", "cad-pt-bell"], "🔕"],
    ]);
    const bell = row.children[2];
    expect(bell.title).toBe("Set a reminder");
    const ev = bell.trigger("click");
    expect(ev.propagationStopped).toBe(true);
    expect(opened).toHaveLength(1);
    expect(opened[0].plugin).toBe(plugin);
    expect(opened[0].isNew).toBe(true);
    expect(opened[0].reminder).toEqual({ text: "Write copy", when: null, repeat: "none", notes: "", project: projectWebsite.path });
  });

  it("shows a linked bell and its time for a task with an open reminder, which edits it", async () => {
    const linked = reminder("r1", "2026-10-11T08:00:00Z", { text: "Write copy", project: projectWebsite.path });
    const { view, parent, opened } = setup([projectWebsite], { reminders: [linked] });
    await view._renderProjectTasksSection(parent);
    const row = parent.querySelectorAll(".cad-pt-row")[0];
    expect(row.children.map((c) => [c.classes, c.text])).toEqual([
      [["cad-pt-bullet"], "•"],
      [["cad-pt-text"], "Write copy"],
      [["cad-pt-when"], reminderTimeStr(linked.when)],
      [["cad-btn", "cad-btn-sm", "cad-pt-bell", "linked"], "🔔"],
    ]);
    expect(row.children[3].title).toBe("Edit reminder");
    row.children[3].trigger("click");
    expect(opened.map((m) => [m.reminder, m.isNew])).toEqual([[linked, false]]);
  });

  it("omits the time for a linked but unscheduled reminder, and ignores done reminders", async () => {
    const { view, parent } = setup([projectWebsite], {
      reminders: [reminder("r1", null, { text: "Write copy", project: projectWebsite.path })],
    });
    await view._renderProjectTasksSection(parent);
    expect(parent.querySelectorAll(".cad-pt-when")).toEqual([]);
    expect(parent.querySelectorAll(".cad-pt-bell")[0].text).toBe("🔔");

    const done = setup([projectWebsite], {
      reminders: [reminder("r1", "2026-10-11T08:00:00Z", { text: "Write copy", project: projectWebsite.path, done: true })],
    });
    await done.view._renderProjectTasksSection(done.parent);
    expect(done.parent.querySelectorAll(".cad-pt-bell")[0].text).toBe("🔕");
  });

  it("looks the reminder up again on click", async () => {
    const { view, parent, opened, plugin } = setup([projectWebsite]);
    await view._renderProjectTasksSection(parent);
    const added = reminder("r9", null, { text: "Write copy", project: projectWebsite.path });
    plugin.settings.reminders.push(added);
    parent.querySelectorAll(".cad-pt-bell")[0].trigger("click");
    expect(opened.map((m) => m.reminder)).toEqual([added]);
  });

  it("opens the project from its group link and from a row", async () => {
    const { view, parent, openDetail, app } = setup([projectWebsite]);
    await view._renderProjectTasksSection(parent);
    const ev = parent.querySelectorAll(".cad-pt-group-link")[0].trigger("click");
    expect(ev.defaultPrevented).toBe(true);
    parent.querySelectorAll(".cad-pt-row")[0].trigger("click");
    const file = app.vault.getAbstractFileByPath(projectWebsite.path);
    expect(openDetail.mock.calls).toEqual([["project", file], ["project", file]]);
  });

  it("is rendered below the reminders by renderInbox", async () => {
    const { view, parent } = setup([projectWebsite], { reminders: [reminder("a", null)] });
    await view.renderInbox(parent);
    expect(sectionLabels(parent)).toEqual(["LATER · UNSCHEDULED · 1", "PROJECT TASKS · 1 open across 1 project"]);
  });
});
