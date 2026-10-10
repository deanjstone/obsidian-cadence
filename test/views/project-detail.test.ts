import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, Notice, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";
import { ENTITIES } from "../../src/constants/entities";
import { CadenceConfirmModal } from "../../src/modals/confirm";
import type { EntityField } from "../../src/types/entities";

/* Characterization tests for the project detail page, renderProjectDetail:
   the header and its actions, the status and priority pills, the meta row
   (one autosaving cell per remaining field: chips, select or input), the
   milestone progress bar, the two-column note sections and the cross
   sections. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

beforeEach(() => {
  vi.useFakeTimers();
  Notice.messages.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const APOLLO: MockFileSpec = {
  path: "Cadence/Projects/Apollo.md",
  frontmatter: {
    name: "Apollo", status: "on_hold", priority: "high", owner: ["[[Sam Lee]]"], started: "2026-09-01",
    due: "2026-12-01", tags: ["q4"],
  },
  body:
    "## Brief\nGo\n## Milestones\n- [x] 2026-09-15 — Kickoff\n- [ ] 2026-11-01 — Beta\n- [ ] Launch\n" +
    "## Scope\nAll\n## Risks #text\nR\n## Tasks #tasks\n- [ ] Plan\n",
};
const SAM: MockFileSpec = { path: "Cadence/Contacts/Sam Lee.md", frontmatter: { name: "Sam Lee" } };
const ANN: MockFileSpec = { path: "Cadence/Contacts/Ann.md", frontmatter: { name: "Ann" } };

function setup(files: MockFileSpec[], settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files, settings });
  const root = new FakeElement("div");
  const closed = vi.spyOn(made.view, "closeEntityDetail").mockResolvedValue(undefined);
  const opened = vi.spyOn(made.view, "openEntityDetail").mockResolvedValue(undefined);
  const h2 = vi.spyOn(made.view, "_renderDynamicH2Section").mockImplementation(() => {});
  const text = vi.spyOn(made.view, "_renderProjectTextSection").mockImplementation(() => {});
  const cross = vi.spyOn(made.view, "_renderCrossSections").mockImplementation(() => {});
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path) as Any;
  const fm = (path: string) => made.app.metadataCache.getFileCache(file(path))?.frontmatter;
  const render = (path = APOLLO.path) => made.view.renderProjectDetail(root, file(path));
  return { ...made, root, closed, opened, h2, text, cross, file, fm, render };
}

/* Temporarily add fields to the project entity. */
async function withFields(fields: EntityField[], run: () => Promise<void>) {
  ENTITIES.project.fields.push(...fields);
  try {
    await run();
  } finally {
    ENTITIES.project.fields.splice(-fields.length, fields.length);
  }
}

const header = (root: FakeElement) => root.children[0];
const crumbs = (root: FakeElement) => header(root).children[0].children[1].children.map((c) => c.text);
const headActions = (root: FakeElement) => header(root).children[1].children;
const badge = (root: FakeElement) => headActions(root)[0];
const hero = (root: FakeElement) => root.children[1];
const pills = (root: FakeElement) => hero(root).children[0].children;
const pill = (root: FakeElement, idx: number) => pills(root)[idx].children[0];
const metaRow = (root: FakeElement) => hero(root).children[1];
const cell = (root: FakeElement, label: string) => {
  const found = metaRow(root).children.find((c) => c.children[0].text === label);
  if (!found) throw new Error(`No cell ${label}`);
  return found;
};
const control = (root: FakeElement, label: string) => cell(root, label).children[1];
const kind = (el: FakeElement) =>
  el.classes.includes("cad-pd-tag-input-wrap") ? "chips" : el.localName === "select" ? "select" : `input:${el.type}`;
const cellKinds = (root: FakeElement) => metaRow(root).children.map((c) => [c.children[0].text, kind(c.children[1])]);
const chipInput = (root: FakeElement, label: string) => control(root, label).lastChild as FakeElement;
const chips = (root: FakeElement, label: string) =>
  control(root, label).children.filter((c) => c.classes.includes("cad-tag-chip")).map((c) => c.children[0].text);
const chip = (root: FakeElement, label: string, text: string) =>
  control(root, label).children.find((c) => c.classes.includes("cad-tag-chip") && c.children[0].text === text) as FakeElement;
const suggestBox = (root: FakeElement, label: string) => cell(root, label).children[2];
const suggestions = (root: FakeElement, label: string) => suggestBox(root, label).children.map((c) => c.text);

function type(input: FakeElement, value: string, event = "input") {
  input.value = value;
  input.trigger(event);
}

async function enter(input: FakeElement, value: string) {
  input.value = value;
  input.trigger("keydown", { key: "Enter" });
  await flush();
}

function choose(select: FakeElement, value: string) {
  select.value = value;
  select.trigger("change");
}

describe("renderProjectDetail: header", () => {
  it("uses the project-detail class, the Projects back button and the PROJECT breadcrumb", async () => {
    const { root, render } = setup([APOLLO]);
    await render();
    expect(root.classes).toEqual(["cadence-project-detail"]);
    expect(header(root).classes).toEqual(["cad-detail-header"]);
    expect(header(root).children[0].children[0].text).toBe("← Projects");
    expect(crumbs(root)).toEqual(["PROJECT", "Apollo", APOLLO.path]);
    expect(headActions(root).map((b) => [b.text, b.classes])).toEqual([
      ["", ["cad-detail-saved"]],
      ["Open as note", ["cad-btn"]],
      ["Delete", ["cad-btn", "cad-btn-danger"]],
    ]);
  });

  it("titles with name, else the basename (a falsy name included)", async () => {
    const { root, render } = setup([{ path: "Cadence/Projects/Zero.md", frontmatter: { name: 0 } }]);
    await render("Cadence/Projects/Zero.md");
    expect(crumbs(root)[1]).toBe("Zero");
    const bare = setup([{ path: "Cadence/Projects/Bare.md" }]);
    await bare.render("Cadence/Projects/Bare.md");
    expect(crumbs(bare.root)[1]).toBe("Bare");
  });

  it("back closes, Open as note opens, Delete confirms then trashes after 50ms and notices", async () => {
    const open = vi.spyOn(CadenceConfirmModal.prototype, "open").mockImplementation(() => {});
    const { root, render, closed, app } = setup([APOLLO]);
    await render();
    header(root).children[0].children[0].trigger("click");
    headActions(root)[1].trigger("click");
    expect(closed).toHaveBeenCalledTimes(1);
    expect(app.workspace.openedLinks).toEqual([[APOLLO.path, "", false]]);
    expect(headActions(root)[2].trigger("click").defaultPrevented).toBe(true);
    const modal = open.mock.contexts[0] as Any;
    expect([modal.title, modal.message, modal.confirmLabel]).toEqual([
      "Delete Project", "Delete this project? This moves the file to trash.", "Delete",
    ]);
    modal.onConfirm();
    expect(headActions(root)[2].blurCount).toBe(1);
    await vi.advanceTimersByTimeAsync(49);
    expect(app.vault.trashed).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(app.vault.trashed).toEqual([APOLLO.path]);
    expect(Notice.messages).toEqual(["Deleted project: Apollo"]);
    expect(closed).toHaveBeenCalledTimes(2);
  });

  it("a failed delete notices the error and keeps the page open", async () => {
    const open = vi.spyOn(CadenceConfirmModal.prototype, "open").mockImplementation(() => {});
    const { root, render, closed, app } = setup([APOLLO]);
    vi.spyOn(app.vault, "trash").mockRejectedValue(new Error("locked"));
    await render();
    headActions(root)[2].trigger("click");
    (open.mock.contexts[0] as Any).onConfirm();
    await vi.advanceTimersByTimeAsync(50);
    expect(Notice.messages).toEqual(["Delete failed: locked"]);
    expect(closed).not.toHaveBeenCalled();
  });
});

describe("renderProjectDetail: status and priority pills", () => {
  it("renders a status and a priority select as pills, with the stored values chosen", async () => {
    const { root, render } = setup([APOLLO]);
    await render();
    expect(hero(root).classes).toEqual(["cad-pd-hero"]);
    expect(hero(root).children[0].classes).toEqual(["cad-pd-pills"]);
    expect(pills(root).map((w) => w.classes)).toEqual([
      ["cad-pd-select-wrap", "cad-pill", "cad-pill-on_hold"],
      ["cad-pd-select-wrap", "cad-pill", "cad-pill-prio-high"],
    ]);
    expect([pill(root, 0).classes, pill(root, 0).options.map((o) => o.text), pill(root, 0).value]).toEqual([
      ["cad-pd-select"], ["active", "on_hold", "backlog", "done", "cancelled"], "on_hold",
    ]);
    expect([pill(root, 1).options.map((o) => o.value), pill(root, 1).value]).toEqual([["low", "medium", "high"], "high"]);
  });

  it("defaults to active and medium; a status class lower-cases and dashes its spaces", async () => {
    const { root, render } = setup([{ path: "Cadence/Projects/Bare.md" }]);
    await render("Cadence/Projects/Bare.md");
    expect(pills(root).map((w) => w.classes[2])).toEqual(["cad-pill-active", "cad-pill-prio-medium"]);
    expect([pill(root, 0).value, pill(root, 1).value]).toEqual(["active", "medium"]);
    const odd = setup([{ path: "Cadence/Projects/Odd.md", frontmatter: { status: "On  Hold", priority: "Urgent" } }]);
    await odd.render("Cadence/Projects/Odd.md");
    expect(pills(odd.root).map((w) => w.classes[2])).toEqual(["cad-pill-on-hold", "cad-pill-prio-urgent"]);
    // QUIRK: a value outside the options selects nothing, so the select shows its first option.
    expect([pill(odd.root, 0).value, pill(odd.root, 1).value]).toEqual(["active", "low"]);
  });

  it("takes the options from the project's field definitions", async () => {
    const status = ENTITIES.project.fields.find((f) => f.key === "status") as EntityField;
    const saved = status.options;
    status.options = ["open", "closed"];
    try {
      const { root, render } = setup([APOLLO]);
      await render();
      expect(pill(root, 0).options.map((o) => o.value)).toEqual(["open", "closed"]);
      status.options = [];
      const fallback = setup([APOLLO]);
      await fallback.render();
      expect(pill(fallback.root, 0).options.map((o) => o.value)).toEqual(["active", "on_hold", "backlog", "done", "cancelled"]);
    } finally {
      status.options = saved;
    }
  });

  it("changing a pill writes its key and flashes Saved; a failed write notices instead", async () => {
    const { root, render, fm, app } = setup([APOLLO]);
    await render();
    choose(pill(root, 0), "done");
    choose(pill(root, 1), "low");
    await flush();
    expect([fm(APOLLO.path)?.status, fm(APOLLO.path)?.priority]).toEqual(["done", "low"]);
    expect(badge(root).text).toBe("Saved");
    expect(badge(root).classes).toEqual(["cad-detail-saved", "show"]);
    await vi.advanceTimersByTimeAsync(1399);
    expect(badge(root).classes).toContain("show");
    await vi.advanceTimersByTimeAsync(1);
    expect(badge(root).classes).toEqual(["cad-detail-saved"]);
    vi.spyOn(app.fileManager, "processFrontMatter").mockRejectedValue(new Error("busy"));
    choose(pill(root, 0), "active");
    await flush();
    expect(Notice.messages).toEqual(["Save failed: busy"]);
    expect(badge(root).classes).toEqual(["cad-detail-saved"]);
  });
});

describe("renderProjectDetail: meta row", () => {
  it("renders a cell per field except name, status and priority", async () => {
    const { root, render } = setup([APOLLO]);
    await render();
    expect(metaRow(root).classes).toEqual(["cad-pd-meta"]);
    expect(cellKinds(root)).toEqual([
      ["OWNER", "chips"],
      ["STARTED", "input:date"],
      ["DUE", "input:date"],
      ["TAGS", "chips"],
    ]);
    expect(metaRow(root).children.every((c) => c.classes[0] === "cad-pd-meta-cell" && c.style.position === "relative")).toBe(true);
    expect([control(root, "STARTED").value, control(root, "DUE").value]).toEqual(["2026-09-01", "2026-12-01"]);
  });

  it("skips a non-enum type field, and checks chips before enum", async () => {
    await withFields(
      [
        { key: "type", label: "Type" },
        { key: "tier", label: "Tier", type: "enum", options: ["A"], suggestionSource: "contact" },
        { key: "phase", label: "Phase", type: "enum", options: ["A", "B"] },
        { key: "budget", label: "Budget", type: "currency" },
        { key: "size", label: "Size", type: "number" },
        { key: "code", label: "Code" },
      ],
      async () => {
        const { root, render } = setup([APOLLO], { currency: "EUR" });
        await render();
        expect(cellKinds(root).slice(4)).toEqual([
          ["TIER", "chips"], ["PHASE", "select"], ["BUDGET", "input:number"], ["SIZE", "input:number"], ["CODE", "input:text"],
        ]);
        expect([control(root, "BUDGET").placeholder, control(root, "SIZE").placeholder]).toEqual(["EUR amount", ""]);
      },
    );
  });

  it("chips show the stored values, links unwrapped", async () => {
    const { root, render } = setup([APOLLO]);
    await render();
    expect(chips(root, "OWNER")).toEqual(["Sam Lee"]);
    expect(chips(root, "TAGS")).toEqual(["q4"]);
    expect([chipInput(root, "OWNER").classes, chipInput(root, "OWNER").placeholder]).toEqual([
      ["cad-pd-tag-input-field"], "Add owner...",
    ]);
  });

  it("adding a chip writes the list and flashes Saved; a missing contact is created", async () => {
    const { root, render, fm, app } = setup([APOLLO, SAM]);
    await render();
    await enter(chipInput(root, "OWNER"), "Ann");
    await flush();
    expect(fm(APOLLO.path)?.owner).toEqual(["[[Sam Lee]]", "[[Ann]]"]);
    expect(badge(root).text).toBe("Saved");
    expect(app.vault.created).toEqual(["Cadence/Contacts/Ann.md"]);
    expect(Notice.messages).toEqual(["Created new Contact: Ann"]);
    await enter(chipInput(root, "OWNER"), "Ann");
    expect(chipInput(root, "OWNER").value).toBe("");
    expect(fm(APOLLO.path)?.owner).toEqual(["[[Sam Lee]]", "[[Ann]]"]);
  });

  it("× and Backspace remove chips; removing the last keeps an empty list", async () => {
    const { root, render, fm } = setup([APOLLO]);
    await render();
    chip(root, "TAGS", "q4").children[1].trigger("click");
    await flush();
    // QUIRK: the project write only deletes null and '', so the key stays as []. The company page deletes it.
    expect(fm(APOLLO.path)?.tags).toEqual([]);
    chipInput(root, "OWNER").trigger("keydown", { key: "Backspace" });
    await flush();
    expect(chips(root, "OWNER")).toEqual([]);
    expect(fm(APOLLO.path)?.owner).toEqual([]);
  });

  it("suggests contacts for the owner and vault tags for tags, and adds on mousedown", async () => {
    const { root, render, fm, app } = setup([APOLLO, SAM, ANN]);
    app.metadataCache.tags = { "#q4": 1, "#urgent": 2 };
    await render();
    chipInput(root, "OWNER").trigger("focus");
    expect(suggestions(root, "OWNER")).toEqual(["Ann"]);
    type(chipInput(root, "TAGS"), "UR");
    expect(suggestions(root, "TAGS")).toEqual(["urgent"]);
    suggestBox(root, "TAGS").children[0].trigger("mousedown");
    await flush();
    expect(fm(APOLLO.path)?.tags).toEqual(["q4", "urgent"]);
    expect(suggestBox(root, "TAGS").style.display).toBe("none");
  });

  it("clicking a link chip opens the contact; blur adds the typed value after 180ms", async () => {
    const { root, render, opened, file, fm } = setup([APOLLO, SAM]);
    await render();
    chip(root, "OWNER", "Sam Lee").children[0].trigger("click");
    expect(opened.mock.calls).toEqual([["contact", file(SAM.path)]]);
    type(chipInput(root, "TAGS"), "hot", "blur");
    await vi.advanceTimersByTimeAsync(179);
    expect(fm(APOLLO.path)?.tags).toEqual(["q4"]);
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(fm(APOLLO.path)?.tags).toEqual(["q4", "hot"]);
    control(root, "TAGS").trigger("click");
    expect(chipInput(root, "TAGS").focusCount).toBe(1);
  });

  it("a date cell writes 350ms after typing and on blur; empty deletes; an unparseable date shows empty", async () => {
    const { root, render, fm } = setup([APOLLO]);
    await render();
    const due = control(root, "DUE");
    expect(due.classes).toEqual(["cad-pd-meta-input"]);
    type(due, "2027-01-15");
    await vi.advanceTimersByTimeAsync(349);
    expect(fm(APOLLO.path)?.due).toBe("2026-12-01");
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(fm(APOLLO.path)?.due).toBe("2027-01-15");
    expect(badge(root).text).toBe("Saved");
    type(due, "", "blur");
    await flush();
    expect(fm(APOLLO.path)).not.toHaveProperty("due");
    const odd = setup([{ path: "Cadence/Projects/Odd.md", frontmatter: { due: "someday" } }]);
    await odd.render("Cadence/Projects/Odd.md");
    expect(control(odd.root, "DUE").valueWrites).toEqual([]);
  });

  it("number, currency and select cells, with their coercion", async () => {
    await withFields(
      [
        { key: "budget", label: "Budget", type: "currency" },
        { key: "phase", label: "Phase", type: "enum", options: ["A", "B"] },
      ],
      async () => {
        const { root, render, fm } = setup([{ ...APOLLO, frontmatter: { name: "Apollo", budget: 5, phase: ["B"] } }]);
        await render();
        expect([control(root, "BUDGET").value, control(root, "PHASE").value]).toEqual(["5", "B"]);
        expect(control(root, "PHASE").options.map((o) => o.text)).toEqual(["—", "A", "B"]);
        type(control(root, "BUDGET"), "x", "blur");
        await flush();
        expect(fm(APOLLO.path)).not.toHaveProperty("budget");
        type(control(root, "BUDGET"), "12.5", "blur");
        choose(control(root, "PHASE"), "A");
        await flush();
        expect([fm(APOLLO.path)?.budget, fm(APOLLO.path)?.phase]).toEqual([12.5, "A"]);
        // QUIRK: clearing a number writes 0, because Number('') is 0.
        type(control(root, "BUDGET"), "", "blur");
        choose(control(root, "PHASE"), "");
        await flush();
        expect(fm(APOLLO.path)?.budget).toBe(0);
        expect(fm(APOLLO.path)).not.toHaveProperty("phase");
      },
    );
  });
});

describe("renderProjectDetail: progress", () => {
  it("shows milestone progress under the meta row, banded by percent", async () => {
    const { root, render } = setup([APOLLO]);
    await render();
    const prog = hero(root).children[2];
    expect(prog.classes).toEqual(["cad-proj-progress-wrap", "cad-pd-progress"]);
    expect(prog.dataset.pctBand).toBe("warn");
    expect(prog.children[0].children.map((s) => s.text)).toEqual(["1/3 milestones complete", "33%"]);
    expect(prog.children[0].children[1].classes).toEqual(["cad-proj-progress-pct"]);
    expect(prog.children[1].children[0].style.width).toBe("33%");
  });

  it("finds a #milestones-tagged section, and shows no bar without milestones", async () => {
    const tagged = setup([{ path: "Cadence/Projects/T.md", body: "## Plan #milestones\n- [x] A\n- [x] B\n" }]);
    await tagged.render("Cadence/Projects/T.md");
    const prog = hero(tagged.root).children[2];
    expect([prog.dataset.pctBand, prog.children[0].children[0].text]).toEqual(["emerald", "2/2 milestones complete"]);
    const none = setup([{ path: "Cadence/Projects/N.md", body: "## Milestones\n\n## Brief\nx\n" }]);
    await none.render("Cadence/Projects/N.md");
    expect(hero(none.root).children.length).toBe(2);
  });
});

describe("renderProjectDetail: sections", () => {
  it("alternates the sections between two columns; the right column's standard keys are text cards", async () => {
    const { root, render, h2, text, file } = setup([APOLLO]);
    await render();
    const cols = root.children[2];
    const [left, right] = cols.children;
    expect([cols.classes, left.classes, right.classes]).toEqual([["cad-pd-cols"], ["cad-pd-col"], ["cad-pd-col"]]);
    // QUIRK: a standard key in the left column (Brief, Scope here) is a generic section, not a text card.
    expect(h2.mock.calls.map((c) => [c[0] === left ? "left" : "right", c[1] === file(APOLLO.path), c[3]])).toEqual([
      ["left", true, "Brief"], ["left", true, "Scope"], ["left", true, "Tasks #tasks"], ["right", true, "Milestones"],
    ]);
    expect(text.mock.calls.map((c) => [c[0] === right, c[1] === file(APOLLO.path), c[3]])).toEqual([
      [true, true, { key: "Risks #text", label: "RISKS", rows: 4, placeholder: "What could go wrong." }],
    ]);
    expect(Object.keys(h2.mock.calls[0][2] as object)).toEqual(["Brief", "Milestones", "Scope", "Risks #text", "Tasks #tasks"]);
    (text.mock.calls[0][4] as () => void)();
    expect(badge(root).text).toBe("Saved");
  });

  it("maps each standard right-column label to its card, case-insensitively", async () => {
    const body = ["X", "brief", "X2", "SCOPE", "X3", "Stakeholders", "X4", "Notes #notes", "X5", "Other"]
      .map((k) => `## ${k}\nv\n`).join("");
    const { render, text, h2 } = setup([{ path: "Cadence/Projects/S.md", body }]);
    await render("Cadence/Projects/S.md");
    expect(text.mock.calls.map((c) => c[3])).toEqual([
      { key: "brief", label: "BRIEF", rows: 4, placeholder: "The outcome we want, why now." },
      { key: "SCOPE", label: "SCOPE", rows: 5, placeholder: "In scope / out of scope." },
      { key: "Stakeholders", label: "STAKEHOLDERS", rows: 3, placeholder: "Who cares about this project." },
      { key: "Notes #notes", label: "NOTES", rows: 5, placeholder: "Anything else." },
    ]);
    expect(h2.mock.calls.map((c) => c[3])).toEqual(["X", "X2", "X3", "X4", "X5", "Other"]);
  });

  it("renders the cross sections last, in a full-width container, by title", async () => {
    const { root, render, cross } = setup([{ ...APOLLO, path: "Cadence/Projects/apollo-1.md" }]);
    await render("Cadence/Projects/apollo-1.md");
    const container = root.children[3];
    expect(root.children.length).toBe(4);
    expect(container.attrs).toEqual({ style: "padding: 0 32px; width: 100%; clear: both;" });
    expect(cross.mock.calls).toEqual([[container, "project", "Apollo"]]);
  });
});
