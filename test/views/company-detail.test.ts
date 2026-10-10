import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, Notice, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";
import { ENTITIES } from "../../src/constants/entities";
import { CadenceConfirmModal } from "../../src/modals/confirm";
import type { EntityField } from "../../src/types/entities";

/* Characterization tests for the company detail page, renderCompanyDetail:
   the header and its actions, the meta row (one autosaving cell per
   non-primary field: chips, select or input), the two-column note sections
   and the cross sections. */

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

const ACME: MockFileSpec = {
  path: "Cadence/Companies/Acme Corp.md",
  frontmatter: {
    name: "Acme Corp", domain: ["acme.test", "[[acme.io]]"], industry: "Manufacturing", size: "200-500",
    owner: ["[[Sam Lee]]"], tags: ["key"],
  },
  body: "## Overview\nBig\n## Tasks #tasks\n- [ ] Call\n## Notes\nN\n",
};
const SAM: MockFileSpec = { path: "Cadence/Contacts/Sam Lee.md", frontmatter: { name: "Sam Lee" } };
const ANN: MockFileSpec = { path: "Cadence/Contacts/Ann.md", frontmatter: { name: "Ann" } };

function setup(files: MockFileSpec[], settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files, settings });
  const root = new FakeElement("div");
  const closed = vi.spyOn(made.view, "closeEntityDetail").mockResolvedValue(undefined);
  const opened = vi.spyOn(made.view, "openEntityDetail").mockResolvedValue(undefined);
  const openedFile = vi.spyOn(made.view, "openEntityDetailFromFile").mockResolvedValue(undefined);
  const h2 = vi.spyOn(made.view, "_renderDynamicH2Section").mockImplementation(() => {});
  const cross = vi.spyOn(made.view, "_renderCrossSections").mockImplementation(() => {});
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path) as Any;
  const fm = (path: string) => made.app.metadataCache.getFileCache(file(path))?.frontmatter;
  const render = (path = ACME.path) => made.view.renderCompanyDetail(root, file(path));
  return { ...made, root, closed, opened, openedFile, h2, cross, file, fm, render };
}

/* Temporarily add fields to the company entity. */
async function withFields(fields: EntityField[], run: () => Promise<void>) {
  ENTITIES.company.fields.push(...fields);
  try {
    await run();
  } finally {
    ENTITIES.company.fields.splice(-fields.length, fields.length);
  }
}

const header = (root: FakeElement) => root.children[0];
const crumbs = (root: FakeElement) => header(root).children[0].children[1].children.map((c) => c.text);
const headActions = (root: FakeElement) => header(root).children[1].children;
const badge = (root: FakeElement) => headActions(root)[0];
const metaRow = (root: FakeElement) => root.children[1].children[0];
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

describe("renderCompanyDetail: header", () => {
  it("uses the project-detail class, the Companies back button and the COMPANY breadcrumb", async () => {
    const { root, render } = setup([ACME]);
    await render();
    expect(root.classes).toEqual(["cadence-project-detail"]);
    expect(header(root).children[0].children[0].text).toBe("← Companies");
    expect(crumbs(root)).toEqual(["COMPANY", "Acme Corp", ACME.path]);
    expect(headActions(root).map((b) => [b.text, b.classes])).toEqual([
      ["", ["cad-detail-saved"]],
      ["Open as note", ["cad-btn"]],
      ["Delete", ["cad-btn", "cad-btn-danger"]],
    ]);
  });

  it("titles with name, else the basename (a falsy name included)", async () => {
    const { root, render } = setup([{ path: "Cadence/Companies/Zero.md", frontmatter: { name: 0 } }]);
    await render("Cadence/Companies/Zero.md");
    expect(crumbs(root)[1]).toBe("Zero");
    const bare = setup([{ path: "Cadence/Companies/Bare.md" }]);
    await bare.render("Cadence/Companies/Bare.md");
    expect(crumbs(bare.root)[1]).toBe("Bare");
  });

  it("back closes, Open as note opens, Delete confirms then trashes and notices", async () => {
    const open = vi.spyOn(CadenceConfirmModal.prototype, "open").mockImplementation(() => {});
    const { root, render, closed, app } = setup([ACME]);
    await render();
    header(root).children[0].children[0].trigger("click");
    headActions(root)[1].trigger("click");
    expect(closed).toHaveBeenCalledTimes(1);
    expect(app.workspace.openedLinks).toEqual([[ACME.path, "", false]]);
    expect(headActions(root)[2].trigger("click").defaultPrevented).toBe(true);
    const modal = open.mock.contexts[0] as Any;
    expect([modal.title, modal.message, modal.confirmLabel]).toEqual([
      "Delete Company", "Delete this company? This moves the file to trash.", "Delete",
    ]);
    modal.onConfirm();
    expect(headActions(root)[2].blurCount).toBe(1);
    await vi.advanceTimersByTimeAsync(50);
    expect(app.vault.trashed).toEqual([ACME.path]);
    expect(Notice.messages).toEqual(["Deleted company: Acme Corp"]);
    expect(closed).toHaveBeenCalledTimes(2);
  });

  it("a failed delete notices the error and keeps the page open", async () => {
    const open = vi.spyOn(CadenceConfirmModal.prototype, "open").mockImplementation(() => {});
    const { root, render, closed, app } = setup([ACME]);
    vi.spyOn(app.vault, "trash").mockRejectedValue(new Error("locked"));
    await render();
    headActions(root)[2].trigger("click");
    (open.mock.contexts[0] as Any).onConfirm();
    await vi.advanceTimersByTimeAsync(50);
    expect(Notice.messages).toEqual(["Delete failed: locked"]);
    expect(closed).not.toHaveBeenCalled();
  });
});

describe("renderCompanyDetail: meta row", () => {
  it("renders a cell per non-primary field in the hero's meta row", async () => {
    const { root, render } = setup([ACME]);
    await render();
    expect(root.children[1].classes).toEqual(["cad-pd-hero"]);
    expect(metaRow(root).classes).toEqual(["cad-pd-meta"]);
    expect(cellKinds(root)).toEqual([
      ["DOMAIN", "chips"],
      ["INDUSTRY", "chips"],
      ["SIZE", "input:text"],
      ["OWNER", "chips"],
      ["TAGS", "chips"],
    ]);
    expect(metaRow(root).children.every((c) => c.classes[0] === "cad-pd-meta-cell" && c.style.position === "relative")).toBe(true);
  });

  it("skips a non-enum type field, and checks chips before enum", async () => {
    await withFields(
      [
        { key: "type", label: "Type" },
        { key: "tier", label: "Tier", type: "enum", options: ["A"], suggestionSource: "contact" },
        { key: "stage", label: "Stage", type: "enum", options: ["A", "B"] },
      ],
      async () => {
        const { root, render } = setup([ACME]);
        await render();
        // QUIRK: an enum with a suggestion source is a chip input here, but a select on the generic detail form.
        expect(cellKinds(root).slice(5)).toEqual([["TIER", "chips"], ["STAGE", "select"]]);
      },
    );
  });

  it("chips show the values, links unwrapped for relation sources only", async () => {
    const { root, render } = setup([ACME]);
    await render();
    expect(chips(root, "DOMAIN")).toEqual(["acme.test", "[[acme.io]]"]);
    expect(chips(root, "INDUSTRY")).toEqual(["Manufacturing"]);
    expect(chips(root, "OWNER")).toEqual(["Sam Lee"]);
    expect(chips(root, "TAGS")).toEqual(["key"]);
    expect([chipInput(root, "OWNER").classes, chipInput(root, "OWNER").placeholder]).toEqual([
      ["cad-pd-tag-input-field"], "Add owner...",
    ]);
    expect([suggestBox(root, "OWNER").style.width, suggestBox(root, "OWNER").style.left]).toEqual(["100%", "0"]);
  });

  it("adding a chip writes straight to frontmatter and flashes Saved", async () => {
    const { root, render, fm } = setup([ACME, SAM, ANN]);
    await render();
    await enter(chipInput(root, "OWNER"), "Ann");
    await enter(chipInput(root, "DOMAIN"), "acme.dev");
    // QUIRK: industry was a scalar; a list field writes it back as a list.
    await enter(chipInput(root, "INDUSTRY"), "Retail");
    expect(fm(ACME.path)?.owner).toEqual(["[[Sam Lee]]", "[[Ann]]"]);
    expect(fm(ACME.path)?.domain).toEqual(["acme.test", "[[acme.io]]", "acme.dev"]);
    expect(fm(ACME.path)?.industry).toEqual(["Manufacturing", "Retail"]);
    expect(badge(root).text).toBe("Saved");
    await vi.advanceTimersByTimeAsync(1400);
    expect(badge(root).classes).toEqual(["cad-detail-saved"]);
  });

  it("adding a link to a missing note creates it; a duplicate only clears the input", async () => {
    const { root, render, app, fm } = setup([ACME, SAM]);
    await render();
    await enter(chipInput(root, "OWNER"), "Ann");
    await flush();
    expect(app.vault.created).toEqual(["Cadence/Contacts/Ann.md"]);
    expect(Notice.messages).toEqual(["Created new Contact: Ann"]);
    await enter(chipInput(root, "OWNER"), "Ann");
    expect(chipInput(root, "OWNER").value).toBe("");
    expect(fm(ACME.path)?.owner).toEqual(["[[Sam Lee]]", "[[Ann]]"]);
  });

  it("× and Backspace remove chips; removing the last deletes the key", async () => {
    const { root, render, fm } = setup([ACME]);
    await render();
    chip(root, "TAGS", "key").children[1].trigger("click");
    await flush();
    expect(fm(ACME.path)).not.toHaveProperty("tags");
    chipInput(root, "DOMAIN").trigger("keydown", { key: "Backspace" });
    await flush();
    expect(chips(root, "DOMAIN")).toEqual(["acme.test"]);
    expect(fm(ACME.path)?.domain).toEqual(["acme.test"]);
  });

  it("suggests contacts for the owner, history values for domain, and adds on mousedown", async () => {
    const { root, render, fm } = setup([ACME, SAM, ANN, { path: "Cadence/Companies/B.md", frontmatter: { domain: "b.test" } }]);
    await render();
    chipInput(root, "OWNER").trigger("focus");
    expect(suggestions(root, "OWNER")).toEqual(["Ann"]);
    type(chipInput(root, "DOMAIN"), "test");
    expect(suggestions(root, "DOMAIN")).toEqual(["b.test"]);
    suggestBox(root, "OWNER").children[0].trigger("mousedown");
    await flush();
    expect(fm(ACME.path)?.owner).toEqual(["[[Sam Lee]]", "[[Ann]]"]);
    expect(suggestBox(root, "OWNER").style.display).toBe("none");
  });

  it("clicking a link chip opens the contact; blur adds the typed value; the chip area focuses the input", async () => {
    const { root, render, opened, file, fm } = setup([ACME, SAM]);
    await render();
    chip(root, "OWNER", "Sam Lee").children[0].trigger("click");
    expect(opened.mock.calls).toEqual([["contact", file(SAM.path)]]);
    type(chipInput(root, "TAGS"), "hot", "blur");
    await vi.advanceTimersByTimeAsync(180);
    await flush();
    expect(fm(ACME.path)?.tags).toEqual(["key", "hot"]);
    control(root, "TAGS").trigger("click");
    expect(chipInput(root, "TAGS").focusCount).toBe(1);
  });

  it("a text cell writes 350ms after typing and on blur; empty deletes", async () => {
    const { root, render, fm } = setup([ACME]);
    await render();
    const size = control(root, "SIZE");
    expect([size.value, size.classes]).toEqual(["200-500", ["cad-pd-meta-input"]]);
    type(size, "50");
    await vi.advanceTimersByTimeAsync(349);
    expect(fm(ACME.path)?.size).toBe("200-500");
    await vi.advanceTimersByTimeAsync(1);
    expect(fm(ACME.path)?.size).toBe("50");
    type(size, "", "blur");
    await flush();
    expect(fm(ACME.path)).not.toHaveProperty("size");
    expect(badge(root).text).toBe("Saved");
  });

  it("number, currency and date cells, with their coercion", async () => {
    await withFields(
      [
        { key: "employees", label: "Employees", type: "number" },
        { key: "revenue", label: "Revenue", type: "currency" },
        { key: "founded", label: "Founded", type: "date" },
      ],
      async () => {
        const { root, render, fm } = setup([
          { ...ACME, frontmatter: { name: "Acme Corp", employees: 0, founded: "1999-05-01T12:00:00Z" } },
        ], { currency: "GBP" });
        await render();
        expect(cellKinds(root).slice(5)).toEqual([
          ["EMPLOYEES", "input:number"], ["REVENUE", "input:number"], ["FOUNDED", "input:date"],
        ]);
        expect([control(root, "EMPLOYEES").value, control(root, "REVENUE").placeholder, control(root, "FOUNDED").value]).toEqual([
          "0", "GBP amount", "1999-05-01",
        ]);
        expect(control(root, "REVENUE").valueWrites).toEqual([]);
        type(control(root, "EMPLOYEES"), "12", "blur");
        type(control(root, "REVENUE"), "x", "blur");
        type(control(root, "FOUNDED"), "2000-01-01", "blur");
        await flush();
        expect(fm(ACME.path)).toEqual({ name: "Acme Corp", employees: 12, founded: "2000-01-01" });
        // QUIRK: clearing a number writes 0, as on the generic form.
        type(control(root, "EMPLOYEES"), "", "blur");
        await flush();
        expect(fm(ACME.path)?.employees).toBe(0);
      },
    );
  });

  it("an unparseable date leaves the date cell empty", async () => {
    await withFields([{ key: "founded", label: "Founded", type: "date" }], async () => {
      const { root, render } = setup([{ ...ACME, frontmatter: { founded: "long ago" } }]);
      await render();
      expect(control(root, "FOUNDED").valueWrites).toEqual([]);
    });
  });

  it("a select cell writes the scalar value on change, and empty deletes", async () => {
    await withFields([{ key: "stage", label: "Stage", type: "enum", options: ["A", "B"] }], async () => {
      const { root, render, fm } = setup([{ ...ACME, frontmatter: { stage: ["B"] } }]);
      await render();
      const sel = control(root, "STAGE");
      expect([sel.classes, sel.options.map((o) => o.text), sel.value]).toEqual([["cad-pd-meta-input"], ["—", "A", "B"], "B"]);
      sel.value = "A";
      sel.trigger("change");
      await flush();
      // QUIRK: stage is a one-item list on the generic form, a scalar here.
      expect(fm(ACME.path)?.stage).toBe("A");
      expect(badge(root).text).toBe("Saved");
      sel.value = "";
      sel.trigger("change");
      await flush();
      expect(fm(ACME.path)).not.toHaveProperty("stage");
    });
  });
});

describe("renderCompanyDetail: sections", () => {
  it("alternates the H2 sections between two columns, then renders the cross sections in a padded container", async () => {
    const { root, render, h2, cross, file } = setup([ACME]);
    await render();
    const cols = root.children[2];
    const [left, right] = cols.children;
    expect([cols.classes, left.classes, right.classes]).toEqual([["cad-pd-cols"], ["cad-pd-col"], ["cad-pd-col"]]);
    expect(h2.mock.calls.map((c) => [c[0] === left ? "left" : "right", c[1] === file(ACME.path), c[3]])).toEqual([
      ["left", true, "Overview"], ["left", true, "Notes"], ["right", true, "Tasks #tasks"],
    ]);
    expect(Object.keys(h2.mock.calls[0][2] as object)).toEqual(["Overview", "Tasks #tasks", "Notes"]);
    (h2.mock.calls[0][4] as () => void)();
    expect(badge(root).text).toBe("Saved");
    const container = root.children[3];
    expect(container.attrs).toEqual({ style: "padding: 0 32px;" });
    expect(cross.mock.calls).toEqual([[container, "company", "Acme Corp"]]);
  });

  it("keeps the empty columns for a note without sections", async () => {
    const { root, render, h2 } = setup([{ path: "Cadence/Companies/Bare.md", frontmatter: { name: "Bare" } }]);
    await render("Cadence/Companies/Bare.md");
    expect(root.children[2].children.map((c) => c.children.length)).toEqual([0, 0]);
    expect(h2).not.toHaveBeenCalled();
  });
});
