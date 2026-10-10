import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";
import { dealAcme, projectWebsite } from "../fixtures/vault";
import { CadenceReminderEditModal } from "../../src/modals/reminder-edit";
import { reminderTimeStr } from "../../src/utils/reminders";

/* Characterization tests for the Home surface: renderHome, _homeCard and
   the eight cards. Time is frozen at Saturday 2026-10-10 09:00 UTC; the
   week starts on Monday 2026-10-05. The briefing has its own file. */

const NOW = new Date("2026-10-10T09:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const SETTINGS = { tasksHeading: "## Today", journalHeading: "## Journal", taskManagementSystem: "native", taskProjectLinks: {} };
const TASKNOTES = { taskManagementSystem: "tasknotes" };

function setup(files: MockFileSpec[] = [], settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files, settings: { ...SETTINGS, ...settings } });
  const capture = vi.fn();
  (made.plugin as unknown as { openQuickCapture: () => void }).openQuickCapture = capture;
  const parent = new FakeElement("div");
  const setMode = vi.spyOn(made.view, "setMode").mockResolvedValue(undefined);
  const openFromFile = vi.spyOn(made.view, "openEntityDetailFromFile").mockResolvedValue(undefined);
  const openDetail = vi.spyOn(made.view, "openEntityDetail").mockResolvedValue(undefined);
  const rendered = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path);
  return { ...made, parent, capture, setMode, openFromFile, openDetail, rendered, file };
}

/* A _homeCard's parts: [card, head, title text, head links, body]. */
function card(parent: FakeElement, index = 0) {
  const el = parent.children[index];
  const [head, body] = el.children;
  return { el, head, title: head.children[0].text, links: head.children.slice(1), body };
}

const rowTexts = (body: FakeElement) =>
  body.children.map((r) => r.querySelectorAll("div").filter((d) => d.classes[0] !== "cad-home-row-main").map((d) => d.text));

const reminder = (text: string, when: string | null, extra: Record<string, unknown> = {}) => ({
  id: text, text, when, repeat: "none", notes: "", project: null, notified: false, done: false, createdAt: "", ...extra,
});

describe("renderHome", () => {
  const CARDS = [
    "_homeInboxCard", "_homeTodayCard", "_homeWeekCard", "_homeUpcomingCard", "_homePartnersCard",
    "_homeProjectsCard", "_homePipelineCard", "_homeActivitiesCard",
  ];

  function stubParts(view: Record<string, unknown>) {
    const order: Array<[string, unknown]> = [];
    for (const name of ["_renderBriefing", ...CARDS]) {
      vi.spyOn(view as never, name as never).mockImplementation((async (el: unknown) => {
        order.push([name, el]);
      }) as never);
    }
    return order;
  }

  it("renders the greeting header, the briefing, then the cards in two columns", async () => {
    const { view, parent } = setup();
    const order = stubParts(view);
    await view.renderHome(parent);
    expect(parent.classes).toEqual(["cadence-home"]);
    const [header, cols] = parent.children;
    expect(header.querySelectorAll(".cad-page-title")[0].text).toBe("Good morning.");
    expect(header.querySelectorAll(".cad-page-subtitle")[0].text).toBe("Saturday, October 10, 2026");
    expect(cols.classes).toEqual(["cad-home-cols"]);
    const [left, right] = cols.children;
    expect(cols.children.map((c) => c.classes)).toEqual([["cad-home-col"], ["cad-home-col"]]);
    expect(order).toEqual([
      ["_renderBriefing", parent],
      ["_homeInboxCard", left], ["_homeTodayCard", left], ["_homeWeekCard", left], ["_homeUpcomingCard", left],
      ["_homePartnersCard", left], ["_homeProjectsCard", right], ["_homePipelineCard", right], ["_homeActivitiesCard", right],
    ]);
  });

  it("wires the five header buttons, with + Inbox as the primary", async () => {
    const { view, parent, capture } = setup();
    stubParts(view);
    const quickAdd = vi.spyOn(view, "_quickAddTodayTask").mockResolvedValue(undefined);
    const create = vi.spyOn(view, "_createEntityFromPrompt").mockResolvedValue(undefined);
    await view.renderHome(parent);
    const right = parent.querySelectorAll(".cad-page-header-right")[0];
    expect(right.children.map((b) => [b.localName, b.text, b.classes])).toEqual([
      ["button", "+ Task", ["cad-btn"]],
      ["button", "+ Deal", ["cad-btn"]],
      ["button", "+ Contact", ["cad-btn"]],
      ["button", "+ Project", ["cad-btn"]],
      ["button", "+ Inbox", ["cad-btn", "primary"]],
    ]);
    for (const b of right.children) b.trigger("click");
    expect(quickAdd).toHaveBeenCalledTimes(1);
    expect(create.mock.calls).toEqual([["deal"], ["contact"], ["project"]]);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("renders a whole Home against a populated vault without throwing", async () => {
    const { view, parent } = setup([dealAcme, projectWebsite, { path: "daily/2026-10-10.md", body: "## Today\n- [ ] a\n" }]);
    await view.renderHome(parent);
    const titles = parent.querySelectorAll(".cad-home-card-title").map((t) => t.text);
    expect(titles).toEqual([
      "INBOX — 0 items",
      "TODAY — 1 open · 0 done",
      "THIS WEEK — 0/1 done",
      "UPCOMING · NEXT 7 DAYS — 0",
      "PARTNERS — 0",
      "ACTIVE PROJECTS — 1",
      "PIPELINE — 1 open · $12,000",
      "RECENT ACTIVITY — 0",
    ]);
    expect(parent.querySelectorAll(".cad-briefing")).toHaveLength(1);
  });
});

describe("_homeCard", () => {
  it("builds a toned card with a titled head, runs the action on the head, and returns the body", () => {
    const { view, parent } = setup();
    const action = vi.fn();
    const body = view._homeCard(parent, "TITLE", action, "rose");
    const c = card(parent);
    expect(c.el.classes).toEqual(["cad-home-card"]);
    expect(c.el.dataset).toEqual({ tone: "rose" });
    expect(c.head.classes).toEqual(["cad-home-card-head"]);
    expect([c.head.children[0].classes[0], c.title]).toEqual(["cad-home-card-title", "TITLE"]);
    expect(action.mock.calls).toEqual([[c.head]]);
    expect(body).toBe(c.body);
    expect(body.classes).toEqual(["cad-home-card-body"]);
  });

  it("sets no tone and ignores a non-function action", () => {
    const { view, parent } = setup();
    view._homeCard(parent, "T", "nope");
    const c = card(parent);
    expect(c.el.dataset).toEqual({});
    expect(c.head.children).toHaveLength(1);
  });
});

describe("_homeInboxCard", () => {
  it("shows the empty state, sky-toned, with Capture and Open Inbox links", async () => {
    const { view, parent, capture, setMode } = setup();
    await view._homeInboxCard(parent);
    const c = card(parent);
    expect(c.title).toBe("INBOX — 0 items");
    expect(c.el.dataset.tone).toBe("sky");
    expect(c.links.map((l) => [l.localName, l.classes[0], l.text])).toEqual([
      ["a", "cad-home-card-link", "+ Capture"],
      ["a", "cad-home-card-link", "Open Inbox →"],
    ]);
    expect(c.links[0].style.marginRight).toBe("12px");
    expect(c.links[0].trigger("click").defaultPrevented).toBe(true);
    expect(c.links[1].trigger("click").defaultPrevented).toBe(true);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(setMode.mock.calls).toEqual([["planner.inbox"]]);
    expect(c.body.children.map((e) => [e.classes[0], e.text])).toEqual([
      ["cad-empty", "Inbox zero — capture anything with + Inbox above (or Cmd+Shift+I)."],
    ]);
  });

  it("counts open items, turns rose with an overdue count, and lists five by time with unscheduled last", async () => {
    const reminders = [
      reminder("Later", "2026-10-12T10:00:00Z"),
      reminder("Unscheduled", null),
      reminder("Overdue", "2026-10-09T10:00:00Z"),
      reminder("Done", "2026-10-01T10:00:00Z", { done: true }),
      reminder("Now", "2026-10-10T09:00:00Z"),
      reminder("Soon", "2026-10-10T15:00:00Z"),
      reminder("Week", "2026-10-15T10:00:00Z"),
    ];
    const { view, parent } = setup([], { reminders });
    await view._homeInboxCard(parent);
    const c = card(parent);
    expect(c.title).toBe("INBOX — 6 items · 2 overdue");
    expect(c.el.dataset.tone).toBe("rose");
    const rows = c.body.children;
    expect(rows.map((r) => r.children[1].children[0].text)).toEqual(["Overdue", "Now", "Soon", "Later", "Week"]);
    expect(rows.map((r) => r.classes)).toEqual([
      ["cad-home-row", "overdue"], ["cad-home-row", "overdue"], ["cad-home-row"], ["cad-home-row"], ["cad-home-row"],
    ]);
    expect(rows.map((r) => r.children[0].text)).toEqual(
      ["2026-10-09T10:00:00Z", "2026-10-10T09:00:00Z", "2026-10-10T15:00:00Z", "2026-10-12T10:00:00Z", "2026-10-15T10:00:00Z"].map(reminderTimeStr),
    );
  });

  it("uses the singular for one item and labels an unscheduled one", async () => {
    const { view, parent } = setup([], { reminders: [reminder("Idea", null)] });
    await view._homeInboxCard(parent);
    const c = card(parent);
    expect([c.title, c.el.dataset.tone]).toEqual(["INBOX — 1 item", "sky"]);
    expect(rowTexts(c.body)).toEqual([["unscheduled", "Idea"]]);
  });

  it("builds the meta line from project, repeat and the first non-blank note line, truncating past 60", async () => {
    const note = "n".repeat(61);
    const { view, parent } = setup([projectWebsite], {
      reminders: [
        reminder("A", null, { project: "Cadence/Projects/Website relaunch.md", repeat: "daily", notes: `\n  \n${note}\nsecond` }),
        reminder("B", null, { project: "Gone/Old plan.md", repeat: "weekly", notes: "short" }),
        reminder("C", null, { repeat: "monthly", notes: "   " }),
        reminder("D", null, { notes: "n".repeat(60) }),
      ],
    });
    await view._homeInboxCard(parent);
    expect(rowTexts(card(parent).body)).toEqual([
      ["unscheduled", "A", `📁 Website relaunch  ·  ↻ daily  ·  📝 ${"n".repeat(57)}…`],
      ["unscheduled", "B", "📁 Old plan  ·  ↻ weekly  ·  📝 short"],
      ["unscheduled", "C", "↻ weekly"],
      ["unscheduled", "D", `📝 ${"n".repeat(60)}`],
    ]);
  });

  it("QUIRK: any repeat other than none or daily reads as weekly", async () => {
    const { view, parent } = setup([], { reminders: [reminder("C", null, { repeat: "monthly" })] });
    await view._homeInboxCard(parent);
    expect(rowTexts(card(parent).body)).toEqual([["unscheduled", "C", "↻ weekly"]]);
  });

  it("opens the reminder editor on the reminder object itself when a row is clicked", async () => {
    const r = reminder("Edit me", null);
    const { view, parent, plugin } = setup([], { reminders: [r] });
    const opened: CadenceReminderEditModal[] = [];
    vi.spyOn(CadenceReminderEditModal.prototype, "open").mockImplementation(function (this: CadenceReminderEditModal) {
      opened.push(this);
    });
    await view._homeInboxCard(parent);
    card(parent).body.children[0].trigger("click");
    expect(opened).toHaveLength(1);
    expect(opened[0].reminder).toBe(plugin.settings.reminders[0]);
    expect(opened[0].plugin).toBe(plugin);
  });
});

describe("_homeTodayCard (daily notes)", () => {
  const today = (body: string): MockFileSpec => ({ path: "daily/2026-10-10.md", body });

  it("counts open and done tasks, emerald, with an Open Today link", async () => {
    const { view, parent, setMode } = setup([today("## Today\n- [ ] a\n- [x] b\n- [X] c\n\n## Journal\n- [ ] not a task\n")]);
    await view._homeTodayCard(parent);
    const c = card(parent);
    expect([c.title, c.el.dataset.tone]).toEqual(["TODAY — 1 open · 2 done", "emerald"]);
    expect(c.links.map((l) => l.text)).toEqual(["Open Today →"]);
    expect(c.links[0].trigger("click").defaultPrevented).toBe(true);
    expect(setMode.mock.calls).toEqual([["planner.today"]]);
    const rows = c.body.children;
    expect(rows.map((r) => r.classes)).toEqual([["cad-home-task"], ["cad-home-task", "done"], ["cad-home-task", "done"]]);
    expect(rows.map((r) => [r.children[0].type, r.children[0].checked, r.children[1].localName, r.children[1].text])).toEqual([
      ["checkbox", false, "span", "a"],
      ["checkbox", true, "span", "b"],
      ["checkbox", true, "span", "c"],
    ]);
  });

  it("shows the empty state when today's note has no tasks", async () => {
    const { view, parent } = setup([today("## Today\n\n## Journal\n")]);
    await view._homeTodayCard(parent);
    const c = card(parent);
    expect(c.title).toBe("TODAY — 0 open · 0 done");
    expect(c.body.children.map((e) => [e.classes[0], e.text])).toEqual([["cad-empty", "No tasks yet — add one with + Task above."]]);
  });

  it("QUIRK: creates today's note when missing and lists its blank task", async () => {
    const { view, parent, app } = setup();
    await view._homeTodayCard(parent);
    expect(app.vault.created).toEqual(["daily/2026-10-10.md"]);
    expect(card(parent).title).toBe("TODAY — 1 open · 0 done");
    expect(card(parent).body.children[0].children[1].text).toBe("");
  });

  it("ticks a task in the note, propagates the completion, and re-renders (QUIRK: the rewrite adds a blank line before the next heading)", async () => {
    const { view, parent, app, rendered, file } = setup([today("# x\n## Today\n- [ ] a\n- [ ] b\n## Journal\nhi\n")]);
    const propagate = vi.spyOn(view, "_propagateTaskComplete").mockResolvedValue(undefined);
    await view._homeTodayCard(parent);
    const cb = card(parent).body.children[1].children[0];
    cb.checked = true;
    cb.trigger("change");
    await flush();
    expect(await app.vault.read(file("daily/2026-10-10.md") as never)).toBe("# x\n## Today\n- [ ] a\n- [x] b\n\n## Journal\nhi\n");
    expect(propagate.mock.calls).toEqual([["b", true, { kind: "daily", file: file("daily/2026-10-10.md"), date: NOW }]]);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("unticks a done task back to open", async () => {
    const { view, parent, app, file } = setup([today("## Today\n- [X] a\n")]);
    const propagate = vi.spyOn(view, "_propagateTaskComplete").mockResolvedValue(undefined);
    await view._homeTodayCard(parent);
    const cb = card(parent).body.children[0].children[0];
    cb.checked = false;
    cb.trigger("change");
    await flush();
    expect(await app.vault.read(file("daily/2026-10-10.md") as never)).toBe("## Today\n- [ ] a\n");
    expect(propagate.mock.calls).toEqual([["a", false, expect.objectContaining({ kind: "daily" })]]);
  });

  it("QUIRK: ticks the task at the row's index in the re-read note, and skips propagation for a blank task", async () => {
    const { view, parent, app, file } = setup([today("## Today\n- [ ] a\n- [ ] b\n")]);
    const propagate = vi.spyOn(view, "_propagateTaskComplete").mockResolvedValue(undefined);
    await view._homeTodayCard(parent);
    await app.vault.modify(file("daily/2026-10-10.md") as never, "## Today\n- [ ] \n- [ ] a\n- [ ] b\n");
    const cb = card(parent).body.children[0].children[0];
    cb.checked = true;
    cb.trigger("change");
    await flush();
    expect(await app.vault.read(file("daily/2026-10-10.md") as never)).toBe("## Today\n- [x] \n- [ ] a\n- [ ] b\n");
    expect(propagate).not.toHaveBeenCalled();
  });

  it("shows a linked project chip that opens the project, and a change-link button", async () => {
    const path = "daily/2026-10-10.md";
    const { view, parent, openDetail, file } = setup([projectWebsite, today("## Today\n- [ ] Ship\n")], {
      taskProjectLinks: { [`${path}::Ship`]: "Cadence/Projects/Website relaunch.md" },
    });
    const picker = vi.spyOn(view, "_openTaskProjectPicker").mockReturnValue(undefined);
    await view._homeTodayCard(parent);
    const row = card(parent).body.children[0];
    const [, , chip, btn] = row.children;
    expect([chip.localName, chip.classes, chip.text, chip.title]).toEqual(["a", ["cad-task-proj-chip"], "📁 Website relaunch", "Open linked project"]);
    const ev = chip.trigger("click");
    expect([ev.defaultPrevented, ev.propagationStopped]).toEqual([true, true]);
    expect(openDetail.mock.calls).toEqual([["project", file("Cadence/Projects/Website relaunch.md")]]);
    expect([btn.localName, btn.classes, btn.text, btn.title]).toEqual(["button", ["cad-task-link-btn", "linked"], "✎", "Change linked project"]);
    expect(btn.trigger("click").propagationStopped).toBe(true);
    expect(picker.mock.calls).toEqual([[path, "Ship", "Cadence/Projects/Website relaunch.md"]]);
  });

  it("offers a link button for an unlinked task, and a chip to a missing project does nothing", async () => {
    const path = "daily/2026-10-10.md";
    const { view, parent, openDetail } = setup([today("## Today\n- [ ] Free\n- [ ] Lost\n")], {
      taskProjectLinks: { [`${path}::Lost`]: "Cadence/Projects/Gone.md" },
    });
    const picker = vi.spyOn(view, "_openTaskProjectPicker").mockReturnValue(undefined);
    await view._homeTodayCard(parent);
    const [free, lost] = card(parent).body.children;
    expect(free.children.map((c) => [c.localName, c.text])).toEqual([["input", ""], ["span", "Free"], ["button", "📁"]]);
    expect([free.children[2].classes, free.children[2].title]).toEqual([["cad-task-link-btn"], "Link to a project"]);
    free.children[2].trigger("click");
    expect(picker.mock.calls).toEqual([[path, "Free", null]]);
    expect(lost.children[2].text).toBe("📁 Gone");
    lost.children[2].trigger("click");
    expect(openDetail).not.toHaveBeenCalled();
  });
});

describe("_homeTodayCard (TaskNotes)", () => {
  const tn = (name: string, fm: Record<string, unknown>): MockFileSpec => ({ path: `TaskNotes/Tasks/${name}.md`, frontmatter: fm });

  it("lists tasks scheduled today as links, with no link button, and a project chip from `projects`", async () => {
    const { view, parent, app, openDetail, file } = setup([
      projectWebsite,
      tn("a", { title: "Write copy", scheduled: "2026-10-10", projects: ["[[Website relaunch]]"] }),
      tn("b", { scheduled: "2026-10-10", status: "done", projects: ["[[Nowhere]]"] }),
      tn("c", { scheduled: "2026-10-11" }),
    ], TASKNOTES);
    await view._homeTodayCard(parent);
    const c = card(parent);
    expect(c.title).toBe("TODAY — 1 open · 1 done");
    const [a, b] = c.body.children;
    expect(c.body.children).toHaveLength(2);
    expect(a.children.map((e) => [e.localName, e.classes[0], e.text])).toEqual([
      ["input", undefined, ""], ["a", "cad-task-text", "Write copy"], ["a", "cad-task-proj-chip", "📁 Website relaunch"],
    ]);
    expect(a.children[1].style.cursor).toBe("pointer");
    expect(b.children.map((e) => e.text)).toEqual(["", "b"]);
    expect(b.classes).toEqual(["cad-home-task", "done"]);
    expect(a.children[1].trigger("click").defaultPrevented).toBe(true);
    expect(app.workspace.openedLinks).toEqual([["TaskNotes/Tasks/a.md", "", false]]);
    a.children[2].trigger("click");
    expect(openDetail.mock.calls).toEqual([["project", file("Cadence/Projects/Website relaunch.md")]]);
  });

  it("toggles a TaskNotes task's status and re-renders, without touching a daily note", async () => {
    const { view, parent, app, rendered, file } = setup([tn("a", { scheduled: "2026-10-10" })], TASKNOTES);
    const propagate = vi.spyOn(view, "_propagateTaskComplete").mockResolvedValue(undefined);
    await view._homeTodayCard(parent);
    const cb = card(parent).body.children[0].children[0];
    cb.checked = true;
    cb.trigger("change");
    await flush();
    expect(app.metadataCache.getFileCache(file("TaskNotes/Tasks/a.md") as never)?.frontmatter?.status).toBe("done");
    expect(propagate).not.toHaveBeenCalled();
    expect(rendered).toHaveBeenCalledTimes(1);
    expect(app.vault.created).toEqual([]);
  });

  it("shows the empty state with no tasks today", async () => {
    const { view, parent } = setup([], TASKNOTES);
    await view._homeTodayCard(parent);
    expect(card(parent).body.children[0].text).toBe("No tasks yet — add one with + Task above.");
  });
});

describe("_homeWeekCard", () => {
  it("counts this week's daily-note tasks into a progress bar, mint, with an Open Calendar link", async () => {
    const { view, parent, setMode } = setup([
      { path: "daily/2026-10-04.md", body: "## Today\n- [x] last week\n" },
      { path: "daily/2026-10-05.md", body: "## Today\n- [x] a\n- [ ] b\n" },
      { path: "daily/2026-10-11.md", body: "## Today\n- [X] c\n" },
      { path: "daily/2026-10-12.md", body: "## Today\n- [x] next week\n" },
    ]);
    await view._homeWeekCard(parent);
    const c = card(parent);
    expect([c.title, c.el.dataset.tone]).toEqual(["THIS WEEK — 2/3 done", "mint"]);
    expect(c.links.map((l) => l.text)).toEqual(["Open Calendar →"]);
    expect(c.links[0].trigger("click").defaultPrevented).toBe(true);
    expect(setMode.mock.calls).toEqual([["planner.calendar"]]);
    const [wrap] = c.body.children;
    expect([wrap.classes[0], wrap.dataset.pctBand]).toEqual(["cad-proj-progress-wrap", "mint"]);
    expect(wrap.children[0].children.map((s) => [s.classes[0], s.text])).toEqual([
      [undefined, "2 of 3 tasks completed"], ["cad-proj-progress-pct", "67%"],
    ]);
    expect(wrap.children[1].children[0].style.width).toBe("67%");
  });

  it("shows 0% in the rose band with nothing logged", async () => {
    const { view, parent, app } = setup();
    await view._homeWeekCard(parent);
    const c = card(parent);
    expect(c.title).toBe("THIS WEEK — 0/0 done");
    const [wrap] = c.body.children;
    expect(wrap.dataset.pctBand).toBe("rose");
    expect(wrap.children[0].children.map((s) => s.text)).toEqual(["No tasks logged this week yet", "0%"]);
    expect(app.vault.created).toEqual([]);
  });

  it("follows weekStartsOn", async () => {
    const { view, parent } = setup([
      { path: "daily/2026-10-04.md", body: "## Today\n- [x] sunday\n" },
      { path: "daily/2026-10-10.md", body: "## Today\n- [ ] saturday\n" },
      { path: "daily/2026-10-11.md", body: "## Today\n- [x] next sunday\n" },
    ], { weekStartsOn: 0 });
    await view._homeWeekCard(parent);
    expect(card(parent).title).toBe("THIS WEEK — 1/2 done");
  });

  it("counts TaskNotes tasks scheduled this week", async () => {
    const tn = (name: string, fm: Record<string, unknown>): MockFileSpec => ({ path: `TaskNotes/Tasks/${name}.md`, frontmatter: fm });
    const { view, parent } = setup([
      tn("a", { scheduled: "2026-10-05", status: "done" }),
      tn("b", { scheduled: "2026-10-11" }),
      tn("c", { scheduled: "2026-10-11", status: "done" }),
      tn("d", { scheduled: "2026-10-04", status: "done" }),
      tn("e", {}),
    ], TASKNOTES);
    await view._homeWeekCard(parent);
    expect(card(parent).title).toBe("THIS WEEK — 2/3 done");
  });
});

describe("_homeUpcomingCard", () => {
  const reg = (name: string, expires: string, fm: Record<string, unknown> = {}): MockFileSpec => ({
    path: `Cadence/Registrations/${name}.md`, frontmatter: { title: name, expires, ...fm },
  });
  const cert = (name: string, expires: string): MockFileSpec => ({ path: `Cadence/Certifications/${name}.md`, frontmatter: { name, expires } });
  const proj = (name: string, fm: Record<string, unknown>, milestones = ""): MockFileSpec => ({
    path: `Cadence/Projects/${name}.md`, frontmatter: { type: "project", ...fm }, body: milestones ? `\n## Milestones\n${milestones}\n` : "",
  });

  it("merges project deadlines, next milestones and expiries in the next 7 days, sorted, warn-toned with no link", async () => {
    const { view, parent, openFromFile, file } = setup([
      proj("Site", { name: "Site", due: "2026-10-17" }, "- [ ] 2026-10-12 — Beta"),
      proj("Old", { due: "2026-10-09" }),
      proj("Late", { due: "2026-10-18" }),
      proj("Bad", { due: "soon" }),
      reg("Reg A", "2026-10-10"),
      reg("Reg B", "2026-10-30"),
      cert("AWS", "2026-10-11"),
    ]);
    await view._homeUpcomingCard(parent);
    const c = card(parent);
    expect([c.title, c.el.dataset.tone, c.links]).toEqual(["UPCOMING · NEXT 7 DAYS — 4", "warn", []]);
    expect(rowTexts(c.body)).toEqual([
      ["Oct 10, 2026", "Reg A", "Registration expires"],
      ["Oct 11, 2026", "AWS", "Cert expires"],
      ["Oct 12, 2026", "Site — Beta", "Milestone"],
      ["Oct 17, 2026", "Site", "Project due"],
    ]);
    c.body.children[2].trigger("click");
    expect(openFromFile.mock.calls).toEqual([[file("Cadence/Projects/Site.md")]]);
  });

  it("falls back to basenames and 'milestone', keeps push order on a tie, and shows at most six rows", async () => {
    const files: MockFileSpec[] = [proj("Untitled", {}, "- [ ] 2026-10-13")];
    for (let i = 0; i < 6; i++) files.push(cert(`C${i}`, `2026-10-1${i}`));
    files.push({ path: "Cadence/Certifications/NoName.md", frontmatter: { expires: "2026-10-16" } });
    const { view, parent } = setup(files);
    await view._homeUpcomingCard(parent);
    const c = card(parent);
    expect(c.title).toBe("UPCOMING · NEXT 7 DAYS — 8");
    expect(rowTexts(c.body).map((r) => r[1])).toEqual(["C0", "C1", "C2", "Untitled — milestone", "C3", "C4"]);
  });

  it("shows the empty state", async () => {
    const { view, parent } = setup();
    await view._homeUpcomingCard(parent);
    expect(card(parent).body.children.map((e) => [e.classes[0], e.text])).toEqual([["cad-empty", "Nothing on the radar."]]);
  });
});

describe("_homePartnersCard", () => {
  const partner = (name: string, fm: Record<string, unknown> = {}): MockFileSpec => ({ path: `Cadence/Partners/${name}.md`, frontmatter: { name, ...fm } });

  it("lists the first five partners with tier · status, sky-toned with an Open Partners link", async () => {
    const files = [
      partner("Alpha", { tier: ["Gold"], status: "Active" }),
      partner("Beta", { status: "Onboarding" }),
      { path: "Cadence/Partners/Gamma.md", frontmatter: { tier: "Silver" } },
      partner("D"), partner("E"), partner("F"),
    ];
    const { view, parent, setMode, openFromFile, file } = setup(files);
    await view._homePartnersCard(parent);
    const c = card(parent);
    expect([c.title, c.el.dataset.tone]).toEqual(["PARTNERS — 6", "sky"]);
    expect(c.links.map((l) => l.text)).toEqual(["Open Partners →"]);
    expect(c.links[0].trigger("click").defaultPrevented).toBe(true);
    expect(setMode.mock.calls).toEqual([["prm.partners"]]);
    expect(rowTexts(c.body)).toEqual([["Alpha", "Gold · Active"], ["Beta", "Onboarding"], ["Gamma", "Silver"], ["D", ""], ["E", ""]]);
    c.body.children[2].trigger("click");
    expect(openFromFile.mock.calls).toEqual([[file("Cadence/Partners/Gamma.md")]]);
  });

  it("shows the empty state", async () => {
    const { view, parent } = setup();
    await view._homePartnersCard(parent);
    expect(card(parent).body.children[0].text).toBe("No partners on the books yet.");
  });
});

describe("_homeProjectsCard", () => {
  const proj = (name: string, status: unknown, milestones: string[] = []): MockFileSpec => ({
    path: `Cadence/Projects/${name}.md`,
    frontmatter: { type: "project", name, ...(status === undefined ? {} : { status }) },
    body: `\n## Milestones\n${milestones.join("\n")}\n`,
  });

  it("shows up to three active, on-hold or in-progress projects with progress, emerald with an Open Projects link", async () => {
    const { view, parent, setMode, openDetail, file } = setup([
      proj("Done", ["done"]),
      proj("Site", ["active"], ["- [x] 2026-10-01 — A", "- [ ] 2026-10-20 — Launch"]),
      proj("Paused", "On Hold", ["- [ ] 2026-11-01"]),
      proj("Default", undefined),
      proj("Busy", "In Progress"),
      proj("Fourth", "active"),
    ]);
    await view._homeProjectsCard(parent);
    const c = card(parent);
    expect([c.title, c.el.dataset.tone]).toEqual(["ACTIVE PROJECTS — 6", "emerald"]);
    expect(c.links.map((l) => l.text)).toEqual(["Open Projects →"]);
    expect(c.links[0].trigger("click").defaultPrevented).toBe(true);
    expect(setMode.mock.calls).toEqual([["projects.projects"]]);
    const rows = c.body.children;
    expect(rows.map((r) => [r.classes[0], r.dataset.pctBand])).toEqual([
      ["cad-home-proj", "mint"], ["cad-home-proj", "rose"], ["cad-home-proj", "rose"],
    ]);
    expect(rows.map((r) => r.children[0].children.map((s) => [s.classes[0], s.text]))).toEqual([
      [["cad-home-proj-title", "Site"], ["cad-home-proj-pct", "50%"]],
      [["cad-home-proj-title", "Paused"], ["cad-home-proj-pct", "0%"]],
      [["cad-home-proj-title", "Default"], ["cad-home-proj-pct", "0%"]],
    ]);
    expect(rows.map((r) => r.children[1].children[0].style.width)).toEqual(["50%", "0%", "0%"]);
    expect(rows.map((r) => r.children[2]?.text)).toEqual(["NEXT · Oct 20, 2026 — Launch", "NEXT · Nov 1, 2026", undefined]);
    rows[1].trigger("click");
    expect(openDetail.mock.calls).toEqual([["project", file("Cadence/Projects/Paused.md")]]);
  });

  it("QUIRK: the header counts every project file, active or not", async () => {
    const { view, parent } = setup([proj("A", "done"), proj("B", "cancelled")]);
    await view._homeProjectsCard(parent);
    const c = card(parent);
    expect(c.title).toBe("ACTIVE PROJECTS — 2");
    expect(c.body.children.map((e) => [e.classes[0], e.text])).toEqual([["cad-empty", "No active projects right now."]]);
  });

  it("shows the no-projects state", async () => {
    const { view, parent } = setup();
    await view._homeProjectsCard(parent);
    expect(card(parent).body.children[0].text).toBe("No projects yet — hit + Project above.");
  });
});

describe("_homePipelineCard", () => {
  const deal = (name: string, fm: Record<string, unknown>): MockFileSpec => ({ path: `Cadence/Pipeline/${name}.md`, frontmatter: { type: "deal", ...fm } });

  it("totals open deals and lists the top four by value, sky with an Open Pipeline link", async () => {
    const { view, parent, setMode, openFromFile, file } = setup([
      deal("A", { title: "A", stage: ["Proposal"], value: 100 }),
      deal("B", { title: "B", stage: "Lead", value: "900" }),
      deal("Won", { stage: "Won", value: 5000 }),
      deal("Lost", { stage: ["Lost"], value: 5000 }),
      deal("C", { value: 300 }),
      deal("D", { title: "D", stage: "Lead", value: "n/a" }),
      deal("E", { title: "E", stage: "Lead", value: 200 }),
    ]);
    await view._homePipelineCard(parent);
    const c = card(parent);
    expect([c.title, c.el.dataset.tone]).toEqual(["PIPELINE — 5 open · $1,500", "sky"]);
    expect(c.links.map((l) => l.text)).toEqual(["Open Pipeline →"]);
    expect(c.links[0].trigger("click").defaultPrevented).toBe(true);
    expect(setMode.mock.calls).toEqual([["crm.pipeline"]]);
    expect(rowTexts(c.body)).toEqual([["B", "Lead · $900"], ["C", "— · $300"], ["E", "Lead · $200"], ["A", "Proposal · $100"]]);
    c.body.children[1].trigger("click");
    expect(openFromFile.mock.calls).toEqual([[file("Cadence/Pipeline/C.md")]]);
  });

  it("shows the empty state when every deal is closed", async () => {
    const { view, parent } = setup([deal("Won", { stage: "Won", value: 5 })]);
    await view._homePipelineCard(parent);
    const c = card(parent);
    expect(c.title).toBe("PIPELINE — 0 open · $0");
    expect(c.body.children[0].text).toBe("No open deals — hit + Deal above.");
  });
});

describe("_homeActivitiesCard", () => {
  const act = (name: string, fm: Record<string, unknown>): MockFileSpec => ({ path: `Cadence/Activities/${name}.md`, frontmatter: fm });

  it("lists the five most recent activities, rose with an Open Activities link", async () => {
    const { view, parent, setMode, openFromFile, file } = setup([
      act("Old", { subject: "Old", type: "Call", when: "2026-09-01" }),
      act("Undated", { subject: "Undated", type: "Note" }),
      act("New", { subject: "New", type: "Email", when: "2026-10-09" }),
      act("Mid", { type: "Meeting", when: "2026-10-01" }),
      act("X", { subject: "X", when: "2026-09-15" }),
      act("Y", { subject: "Y", type: "Task", when: "2026-08-01" }),
    ]);
    await view._homeActivitiesCard(parent);
    const c = card(parent);
    expect([c.title, c.el.dataset.tone]).toEqual(["RECENT ACTIVITY — 6", "rose"]);
    expect(c.links.map((l) => l.text)).toEqual(["Open Activities →"]);
    expect(c.links[0].trigger("click").defaultPrevented).toBe(true);
    expect(setMode.mock.calls).toEqual([["crm.activities"]]);
    expect(rowTexts(c.body)).toEqual([
      ["New", "Email · Oct 9, 2026"],
      ["Mid", "Meeting · Oct 1, 2026"],
      ["X", "— · Sep 15, 2026"],
      ["Old", "Call · Sep 1, 2026"],
      ["Y", "Task · Aug 1, 2026"],
    ]);
    c.body.children[1].trigger("click");
    expect(openFromFile.mock.calls).toEqual([[file("Cadence/Activities/Mid.md")]]);
  });

  it("shows the empty state", async () => {
    const { view, parent } = setup();
    await view._homeActivitiesCard(parent);
    expect(card(parent).body.children[0].text).toBe("No activities logged yet.");
  });
});
