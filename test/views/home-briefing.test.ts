import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, Platform, type MockFileSpec } from "../mocks/obsidian";
import { makeAppView } from "../helpers/app-view";

/* Characterization tests for Home's "Top of the day" briefing:
   _computeBriefing, _briefingHeadline and _renderBriefing. Time is frozen
   at Saturday 2026-10-10 09:00 UTC (TZ=UTC in vitest.config). */

const NOW = new Date("2026-10-10T09:00:00Z");
const DAY = 86400000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Platform.isMobile = false;
});

const SETTINGS = { tasksHeading: "## Today", journalHeading: "## Journal", taskManagementSystem: "native" };

/* An empty TaskNotes folder: the tasks step finds nothing and creates no note. */
const quietTasks = { taskManagementSystem: "tasknotes" };

function setup(files: MockFileSpec[] = [], settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files, settings: { ...SETTINGS, ...settings } });
  const setMode = vi.spyOn(made.view, "setMode").mockResolvedValue(undefined);
  const openFromFile = vi.spyOn(made.view, "openEntityDetailFromFile").mockResolvedValue(undefined);
  const openDetail = vi.spyOn(made.view, "openEntityDetail").mockResolvedValue(undefined);
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path);
  return { ...made, setMode, openFromFile, openDetail, file };
}

type Item = { icon: string; tone: string; text: string; action?: () => void };
const shape = (items: Item[]) => items.map(({ icon, tone, text }) => [icon, tone, text]);

const daily = (body: string): MockFileSpec => ({ path: "daily/2026-10-10.md", body });
const reminder = (text: string, when: string | null, extra: Record<string, unknown> = {}) => ({
  id: text, text, when, repeat: "none", notes: "", project: null, notified: false, done: false, createdAt: "", ...extra,
});
const deal = (name: string, fm: Record<string, unknown>, mtime?: number): MockFileSpec => ({
  path: `Cadence/Pipeline/${name}.md`, frontmatter: { type: "deal", ...fm }, mtime,
});
const contact = (name: string, fm: Record<string, unknown> = {}): MockFileSpec => ({
  path: `Cadence/Contacts/${name}.md`, frontmatter: { type: "contact", name, ...fm },
});
const project = (name: string, milestones: string[], fm: Record<string, unknown> = {}): MockFileSpec => ({
  path: `Cadence/Projects/${name}.md`,
  frontmatter: { type: "project", name, ...fm },
  body: ["", `# ${name}`, "", "## Milestones", ...milestones, ""].join("\n"),
});

describe("_computeBriefing: open tasks today", () => {
  it("counts open tasks on today's note, pointing at Today", async () => {
    const { view, setMode } = setup([daily("## Today\n- [ ] a\n- [x] b\n- [ ] c\n- [X] d\n")]);
    const items: Item[] = await view._computeBriefing();
    expect(shape(items)).toEqual([["🎯", "emerald", "2 open tasks on today's note"]]);
    items[0].action!();
    expect(setMode.mock.calls).toEqual([["planner.today"]]);
  });

  it("uses the singular for one task, and adds nothing for none", async () => {
    expect(shape(await setup([daily("## Today\n- [ ] a\n")]).view._computeBriefing())).toEqual([
      ["🎯", "emerald", "1 open task on today's note"],
    ]);
    expect(await setup([daily("## Today\n- [x] a\n")]).view._computeBriefing()).toEqual([]);
  });

  it("QUIRK: creates today's note when missing, and its blank `- [ ] ` line counts as one open task", async () => {
    const { view, app } = setup();
    expect(shape(await view._computeBriefing())).toEqual([["🎯", "emerald", "1 open task on today's note"]]);
    expect(app.vault.created).toEqual(["daily/2026-10-10.md"]);
  });

  it("counts TaskNotes tasks scheduled today that are not done", async () => {
    const tn = (name: string, fm: Record<string, unknown>): MockFileSpec => ({ path: `TaskNotes/Tasks/${name}.md`, frontmatter: fm });
    const { view, app } = setup([
      tn("a", { scheduled: "2026-10-10" }),
      tn("b", { scheduled: "2026-10-10", status: "done" }),
      tn("c", { scheduled: "2026-10-11" }),
      tn("d", { scheduled: "2026-10-10", status: "in-progress" }),
    ], quietTasks);
    expect(shape(await view._computeBriefing())).toEqual([["🎯", "emerald", "2 open tasks scheduled for today"]]);
    expect(app.vault.created).toEqual([]);
  });

  it("swallows a failing daily-note read and carries on", async () => {
    const { view, app } = setup([daily("## Today\n- [ ] a\n")], { reminders: [reminder("Call", "2026-10-10T08:00:00Z")] });
    vi.spyOn(app.vault, "read").mockRejectedValue(new Error("disk"));
    expect(shape(await view._computeBriefing())).toEqual([["⚠", "rose", 'Overdue reminder — "Call"']]);
  });
});

describe("_computeBriefing: reminders", () => {
  it("flags a single overdue reminder (due at or before now), pointing at the Inbox", async () => {
    const { view, setMode } = setup([], {
      ...quietTasks,
      reminders: [reminder("Call Jane", "2026-10-10T09:00:00Z"), reminder("Done one", "2026-10-01T09:00:00Z", { done: true })],
    });
    const items: Item[] = await view._computeBriefing();
    expect(shape(items)).toEqual([["⚠", "rose", 'Overdue reminder — "Call Jane"']]);
    items[0].action!();
    expect(setMode.mock.calls).toEqual([["planner.inbox"]]);
  });

  it("QUIRK: names the first overdue reminder in settings order, not the most overdue, and truncates past 50 chars", async () => {
    const long = "x".repeat(51);
    const { view } = setup([], {
      ...quietTasks,
      reminders: [reminder(long, "2026-10-09T09:00:00Z"), reminder("Oldest", "2026-01-01T00:00:00Z"), reminder("Third", "2026-10-10T08:59:59Z")],
    });
    expect(shape(await view._computeBriefing())).toEqual([
      ["⚠", "rose", `3 overdue reminders — "${"x".repeat(47)}…" + 2 more`],
    ]);
  });

  it("keeps a 50-char reminder text whole", async () => {
    const text = "y".repeat(50);
    const { view } = setup([], { ...quietTasks, reminders: [reminder(text, "2026-10-09T09:00:00Z")] });
    expect(shape(await view._computeBriefing())).toEqual([["⚠", "rose", `Overdue reminder — "${text}"`]]);
  });

  it("counts reminders due later today, up to but excluding midnight", async () => {
    const { view, setMode } = setup([], {
      ...quietTasks,
      reminders: [
        reminder("Soon", "2026-10-10T09:00:01Z"),
        reminder("Late", "2026-10-10T23:59:59Z"),
        reminder("Tomorrow", "2026-10-11T00:00:00Z"),
        reminder("Unscheduled", null),
      ],
    });
    const items: Item[] = await view._computeBriefing();
    expect(shape(items)).toEqual([["⏰", "mint", "2 reminders due later today"]]);
    items[0].action!();
    expect(setMode.mock.calls).toEqual([["planner.inbox"]]);
  });

  it("uses the singular for one reminder due later today", async () => {
    const { view } = setup([], { ...quietTasks, reminders: [reminder("Soon", "2026-10-10T18:00:00Z")] });
    expect(shape(await view._computeBriefing())).toEqual([["⏰", "mint", "1 reminder due later today"]]);
  });
});

describe("_computeBriefing: deals closing this week", () => {
  it("counts open deals closing from today to seven days out, inclusive, with their total value", async () => {
    const { view, setMode } = setup([
      deal("A", { title: "A", stage: ["Proposal"], value: 12000, closeBy: "2026-10-10" }),
      deal("B", { title: "B", stage: "Lead", value: "4500", closeBy: "2026-10-17" }),
      deal("C", { title: "C", stage: "Lead", value: 1, closeBy: "2026-10-18" }),
      deal("D", { title: "D", stage: "Lead", value: 1, closeBy: "2026-10-09" }),
      deal("E", { title: "E", stage: "Won", value: 1, closeBy: "2026-10-12" }),
      deal("F", { title: "F", stage: ["Lost"], value: 1, closeBy: "2026-10-12" }),
      deal("G", { title: "G", stage: "Lead", value: 1, closeBy: "soon" }),
      deal("H", { title: "H", stage: "Lead", value: 1 }),
    ], quietTasks);
    const items: Item[] = await view._computeBriefing();
    expect(shape(items)).toEqual([["💼", "sky", "2 deals close this week · $16,500"]]);
    items[0].action!();
    expect(setMode.mock.calls).toEqual([["crm.pipeline"]]);
  });

  it("uses the singular for one deal, counting a non-numeric value as 0", async () => {
    const { view } = setup([deal("A", { title: "A", stage: "Lead", value: "TBD", closeBy: "2026-10-12" })], quietTasks);
    expect(shape(await view._computeBriefing())).toEqual([["💼", "sky", "1 deal closes this week · $0"]]);
  });
});

describe("_computeBriefing: stale contacts on open deals", () => {
  const openDeal = deal("Acme renewal", { title: "Acme renewal", stage: "Proposal", contact: "Jane Doe" });

  it("names a contact on an open deal quiet for over 30 days, with the deal, opening the contact", async () => {
    const { view, openFromFile, file } = setup([openDeal, contact("Jane Doe", { lastContact: "2026-09-01" })], quietTasks);
    const items: Item[] = await view._computeBriefing();
    expect(shape(items)).toEqual([["👤", "warn", "Jane Doe — 39 days quiet · Acme renewal"]]);
    items[0].action!();
    expect(openFromFile.mock.calls).toEqual([[file("Cadence/Contacts/Jane Doe.md")]]);
  });

  it("treats exactly 30 days as fresh and 31 as stale", async () => {
    expect(await setup([openDeal, contact("Jane Doe", { lastContact: "2026-09-10" })], quietTasks).view._computeBriefing()).toEqual([]);
    expect(shape(await setup([openDeal, contact("Jane Doe", { lastContact: "2026-09-09" })], quietTasks).view._computeBriefing())).toEqual([
      ["👤", "warn", "Jane Doe — 31 days quiet · Acme renewal"],
    ]);
  });

  it("says 'never contacted' with no lastContact, and counts the rest as more", async () => {
    const { view } = setup([
      openDeal,
      deal("Globex", { stage: "Lead", contact: " Bob Roe " }),
      contact("Jane Doe"),
      contact("Bob Roe", { lastContact: "2026-01-01" }),
      contact("Fresh", { lastContact: "2026-10-09" }),
    ], quietTasks);
    expect(shape(await view._computeBriefing())).toEqual([["👤", "warn", "Jane Doe — never contacted · Acme renewal (+1 more)"]]);
  });

  it("QUIRK: an unparseable lastContact counts as stale and reads 'never contacted'", async () => {
    const { view } = setup([openDeal, contact("Jane Doe", { lastContact: "last spring" })], quietTasks);
    expect(shape(await view._computeBriefing())).toEqual([["👤", "warn", "Jane Doe — never contacted · Acme renewal"]]);
  });

  it("QUIRK: a wiki-link deal contact, as the forms write it, never matches the contact's name", async () => {
    const { view } = setup([
      deal("Acme renewal", { title: "Acme renewal", stage: "Proposal", contact: ["[[Jane Doe]]"] }),
      contact("Jane Doe", { lastContact: "2026-01-01" }),
    ], quietTasks);
    expect(await view._computeBriefing()).toEqual([]);
  });

  it("ignores contacts whose only deals are Won or Lost, and leaves out a blank deal title", async () => {
    expect(await setup([
      deal("Won", { stage: "Won", contact: "Jane Doe" }),
      contact("Jane Doe", { lastContact: "2026-01-01" }),
    ], quietTasks).view._computeBriefing()).toEqual([]);
    const titled = await setup([
      { path: "Cadence/Pipeline/Untitled.md", frontmatter: { type: "deal", stage: "Lead", contact: "Jane Doe" } },
      contact("Jane Doe", { lastContact: "2026-10-08T00:00:00Z" }),
      contact("Jane Doe 2", { name: "Jane Doe", lastContact: "2026-01-01" }),
    ], quietTasks).view._computeBriefing();
    expect(shape(titled)).toEqual([["👤", "warn", "Jane Doe — 282 days quiet · Untitled"]]);
  });
});

describe("_computeBriefing: upcoming milestones", () => {
  it("names the soonest next milestone within 14 days, opening its project", async () => {
    const { view, openDetail, file } = setup([
      project("Website relaunch", ["- [x] 2026-10-01 — Kickoff", "- [ ] 2026-10-14 — Beta"]),
      project("Intranet", ["- [ ] 2026-10-12 — Launch"], { name: "Intranet v2" }),
      project("Far", ["- [ ] 2026-10-25 — Later"]),
    ], quietTasks);
    const items: Item[] = await view._computeBriefing();
    expect(shape(items)).toEqual([["📅", "mint", 'Intranet v2 · "Launch" — due in 2 days']]);
    items[0].action!();
    expect(openDetail.mock.calls).toEqual([["project", file("Cadence/Projects/Intranet.md")]]);
  });

  it.each([
    ["2026-10-10", "today"],
    ["2026-10-11", "tomorrow"],
    ["2026-10-24", "in 14 days"],
  ])("words a milestone on %s as due %s", async (date, word) => {
    const { view } = setup([project("P", [`- [ ] ${date} — M`])], quietTasks);
    expect(shape(await view._computeBriefing())).toEqual([["📅", "mint", `P · "M" — due ${word}`]]);
  });

  it("falls back to 'milestone' for an untitled one, and skips milestones past 14 days", async () => {
    expect(shape(await setup([project("P", ["- [ ] 2026-10-11"])], quietTasks).view._computeBriefing())).toEqual([
      ["📅", "mint", 'P · "milestone" — due tomorrow'],
    ]);
    expect(await setup([project("P", ["- [ ] 2026-10-25 — M"])], quietTasks).view._computeBriefing()).toEqual([]);
  });

  it("QUIRK: an overdue open milestone hides the project's upcoming one", async () => {
    const { view } = setup([project("P", ["- [ ] 2026-10-01 — Late", "- [ ] 2026-10-12 — Next"])], quietTasks);
    expect(await view._computeBriefing()).toEqual([]);
  });

  it("skips a project whose note can't be read", async () => {
    const { view, app } = setup([project("P", ["- [ ] 2026-10-12 — M"])], quietTasks);
    vi.spyOn(app.vault, "read").mockRejectedValue(new Error("disk"));
    expect(await view._computeBriefing()).toEqual([]);
  });
});

describe("_computeBriefing: recent wins", () => {
  it("counts Won deals modified in the last 7 days, with their value, pointing at the sales report", async () => {
    const { view, setMode } = setup([
      deal("A", { stage: ["Won"], value: 500 }, NOW.getTime() - 7 * DAY),
      deal("B", { stage: "Won", value: 250 }, NOW.getTime()),
      deal("C", { stage: "Won", value: 1 }, NOW.getTime() - 7 * DAY - 1),
      deal("D", { stage: "Won", value: 1 }),
      deal("E", { stage: "Lead", value: 1 }, NOW.getTime()),
    ], quietTasks);
    const items: Item[] = await view._computeBriefing();
    expect(shape(items)).toEqual([["🎉", "emerald", "2 deals won this week · $750"]]);
    items[0].action!();
    expect(setMode.mock.calls).toEqual([["reports.sales"]]);
  });

  it("uses the singular for one win", async () => {
    const { view } = setup([deal("A", { stage: "Won", value: 500 }, NOW.getTime())], quietTasks);
    expect(shape(await view._computeBriefing())).toEqual([["🎉", "emerald", "1 deal won this week · $500"]]);
  });
});

describe("_computeBriefing: ordering", () => {
  it("emits tasks, overdue, later today, closing deals, stale contact, milestone, then wins", async () => {
    const { view } = setup([
      daily("## Today\n- [ ] a\n"),
      deal("Acme", { title: "Acme", stage: "Lead", value: 100, closeBy: "2026-10-12", contact: "Jane" }, NOW.getTime()),
      deal("Won", { stage: "Won", value: 5 }, NOW.getTime()),
      contact("Jane"),
      project("P", ["- [ ] 2026-10-12 — M"]),
    ], { reminders: [reminder("Late", "2026-10-09T00:00:00Z"), reminder("Soon", "2026-10-10T20:00:00Z")] });
    expect((await view._computeBriefing()).map((i: Item) => i.icon)).toEqual(["🎯", "⚠", "⏰", "💼", "👤", "📅", "🎉"]);
  });
});

describe("_briefingHeadline", () => {
  const it_ = (tone: string) => ({ icon: "", tone, text: "" });

  it.each([
    [[], "Inbox zero. Clear runway."],
    [[it_("mint")], "Here's what's on your radar."],
    [[it_("mint"), it_("sky"), it_("warn")], "Here's what's on your radar."],
    [[it_("mint"), it_("sky"), it_("warn"), it_("emerald")], "Here's what's worth your attention today."],
    [[it_("rose")], "A couple of things need attention this morning."],
    [[it_("mint"), it_("sky"), it_("warn"), it_("emerald"), it_("rose")], "A couple of things need attention this morning."],
  ])("for %j says %s", (items, headline) => {
    const { view } = setup();
    expect(view._briefingHeadline(items)).toBe(headline);
  });
});

describe("_renderBriefing", () => {
  const five: Item[] = ["a", "b", "c", "d", "e"].map((t, i) => ({ icon: `i${i}`, tone: i === 1 ? "" : "sky", text: t }));

  it("renders the eyebrow, the headline and an empty line when nothing is flagged", async () => {
    const { view } = setup([], quietTasks);
    const root = new FakeElement("div");
    await view._renderBriefing(root);
    const [card] = root.children;
    expect(card.classes).toEqual(["cad-briefing"]);
    expect(card.children.map((c) => c.classes[0])).toEqual(["cad-briefing-head", "cad-briefing-empty"]);
    expect(card.children[0].children.map((c) => [c.classes[0], c.text])).toEqual([
      ["cad-briefing-eyebrow", "TOP OF THE DAY"],
      ["cad-briefing-headline", "Inbox zero. Clear runway."],
    ]);
    expect(card.children[1].text).toBe("Nothing flagged. Make today count.");
  });

  it("renders one toned row per item, defaulting the tone to emerald, clickable when it has an action", async () => {
    const { view } = setup();
    const action = vi.fn();
    vi.spyOn(view, "_computeBriefing").mockResolvedValue([{ icon: "⚠", tone: "rose", text: "Late", action }, { icon: "x", text: "Plain" }]);
    const root = new FakeElement("div");
    await view._renderBriefing(root);
    const [card] = root.children;
    expect(card.children[0].children[1].text).toBe("A couple of things need attention this morning.");
    const rows = card.children[1].children;
    expect(card.children[1].classes).toEqual(["cad-briefing-list"]);
    expect(rows.map((r) => r.classes)).toEqual([
      ["cad-briefing-row", "cad-tone-rose", "clickable"],
      ["cad-briefing-row", "cad-tone-emerald"],
    ]);
    expect(rows[0].children.map((c) => [c.localName, c.classes[0], c.text])).toEqual([
      ["span", "cad-briefing-icon", "⚠"], ["span", "cad-briefing-text", "Late"],
    ]);
    rows[0].trigger("click");
    rows[1].trigger("click");
    expect(action).toHaveBeenCalledTimes(1);
    expect(card.children).toHaveLength(2);
  });

  it("shows every item on desktop", async () => {
    const { view } = setup();
    vi.spyOn(view, "_computeBriefing").mockResolvedValue(five);
    const root = new FakeElement("div");
    await view._renderBriefing(root);
    expect(root.children[0].children[1].children.map((r) => r.children[1].text)).toEqual(["a", "b", "c", "d", "e"]);
    expect(root.querySelectorAll(".cad-briefing-more")).toEqual([]);
  });

  it("trims to the first three on mobile, with a +N more line", async () => {
    Platform.isMobile = true;
    const { view } = setup();
    vi.spyOn(view, "_computeBriefing").mockResolvedValue(five);
    const root = new FakeElement("div");
    await view._renderBriefing(root);
    const [card] = root.children;
    expect(card.children[1].children.map((r) => r.children[1].text)).toEqual(["a", "b", "c"]);
    expect(card.children[0].children[1].text).toBe("Here's what's worth your attention today.");
    expect(card.children[2].classes).toEqual(["cad-briefing-more"]);
    expect(card.children[2].text).toBe("+2 more · scroll down for the full picture");
  });

  it("keeps all three on mobile with no more line", async () => {
    Platform.isMobile = true;
    const { view } = setup();
    vi.spyOn(view, "_computeBriefing").mockResolvedValue(five.slice(0, 3));
    const root = new FakeElement("div");
    await view._renderBriefing(root);
    expect(root.children[0].children[1].children).toHaveLength(3);
    expect(root.children[0].children).toHaveLength(2);
  });
});
