import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, Notice, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";
import { ENTITIES } from "../../src/constants/entities";
import { CadenceConfirmModal } from "../../src/modals/confirm";
import type { EntityDef } from "../../src/types/entities";

/* Characterization tests for the generic entity detail form,
   renderEntityDetail: the project/company routing, the header and its
   actions, one autosaving control per field (select, date, number, email,
   text and the chip input with its suggestions), the note sections and the
   cross sections. */

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

const JANE: MockFileSpec = {
  path: "Cadence/Contacts/Jane Doe.md",
  frontmatter: {
    name: "Jane Doe", email: ["jane@acme.test"], phone: ["555-1", "555-2"], company: ["[[Acme Corp]]"],
    role: ["CTO", "[[Board]]"], lastContact: "2026-09-30", tags: ["vip"],
  },
  body: "## Notes\nHello\n## Tasks #tasks\n- [ ] Call\n",
};
const ACME: MockFileSpec = { path: "Cadence/Companies/Acme Corp.md", frontmatter: { name: "Acme Corp" } };
const GLOBEX: MockFileSpec = { path: "Cadence/Companies/Globex.md", frontmatter: { name: "Globex" } };
const BOB: MockFileSpec = { path: "Cadence/Contacts/Bob.md", frontmatter: { name: "Bob", role: ["[[Sales]]", "CTO"] } };
const DEAL: MockFileSpec = {
  path: "Cadence/Pipeline/Acme renewal.md",
  frontmatter: { title: "Acme renewal", stage: ["Proposal"], value: 1200, contact: "[[Jane Doe]]", closeBy: "2026-11-30T23:30:00+10:00" },
};

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
  const render = (entityKey: string, path: string) => made.view.renderEntityDetail(root, entityKey, file(path));
  return { ...made, root, closed, opened, openedFile, h2, cross, file, fm, render };
}

const header = (root: FakeElement) => root.children[0];
const crumbs = (root: FakeElement) => header(root).children[0].children[1].children.map((c) => c.text);
const headActions = (root: FakeElement) => header(root).children[1].children;
const form = (root: FakeElement) => root.children[1];
const row = (root: FakeElement, label: string) => {
  const found = form(root).children.find((r) => r.children[0].text === label);
  if (!found) throw new Error(`No row ${label}`);
  return found;
};
const control = (root: FakeElement, label: string) => row(root, label).children[1];
const kind = (el: FakeElement) =>
  el.classes.includes("cad-pd-tag-input-wrap") ? "chips" : el.localName === "select" ? "select" : `input:${el.type}`;
const rowKinds = (root: FakeElement) => form(root).children.map((r) => [r.children[0].text, kind(r.children[1])]);
const chipWrap = (root: FakeElement, label: string) => control(root, label);
const chipInput = (root: FakeElement, label: string) => chipWrap(root, label).lastChild as FakeElement;
const chips = (root: FakeElement, label: string) =>
  chipWrap(root, label).children.filter((c) => c.classes.includes("cad-tag-chip")).map((c) => c.children[0].text);
const chip = (root: FakeElement, label: string, text: string) =>
  chipWrap(root, label).children.find((c) => c.classes.includes("cad-tag-chip") && c.children[0].text === text) as FakeElement;
const suggestBox = (root: FakeElement, label: string) => row(root, label).children[2];
const suggestions = (root: FakeElement, label: string) => suggestBox(root, label).children.map((c) => c.text);
const badge = (root: FakeElement) => headActions(root)[0];

function type(input: FakeElement, value: string, event = "input") {
  input.value = value;
  input.trigger(event);
}

function choose(select: FakeElement, value: string) {
  select.value = value;
  select.trigger("change");
}

async function enter(input: FakeElement, value: string) {
  input.value = value;
  input.trigger("keydown", { key: "Enter" });
  await flush();
}

const VENDOR: EntityDef = {
  folder: "Cadence/Vendors",
  label: "Vendor", plural: "Vendors",
  fields: [
    { key: "name", label: "Name", primary: true },
    { key: "type", label: "Type" },
    { key: "supplier", label: "Supplier", suggestionSource: "folder:Cadence/Suppliers" },
    { key: "account", label: "Account", suggestionSource: "folder:Cadence/Companies/" },
    { key: "labels", label: "Labels", type: "multitext", suggestionSource: "none" },
    { key: "kind", label: "Kind", type: "enum", options: ["A", "B"] },
  ],
  columns: ["name"],
};

function withVendor() {
  ENTITIES.vendor = VENDOR;
  return () => {
    delete ENTITIES.vendor;
  };
}

describe("renderEntityDetail: routing", () => {
  it("hands projects and companies to their own detail views, without the detail class", async () => {
    const { view, root, file } = setup([ACME, { path: "Cadence/Projects/Web.md", frontmatter: { name: "Web" } }]);
    const project = vi.spyOn(view, "renderProjectDetail").mockResolvedValue("p");
    const company = vi.spyOn(view, "renderCompanyDetail").mockResolvedValue("c");
    expect(await view.renderEntityDetail(root, "project", file("Cadence/Projects/Web.md"))).toBe("p");
    expect(await view.renderEntityDetail(root, "company", file(ACME.path))).toBe("c");
    expect(project.mock.calls).toEqual([[root, file("Cadence/Projects/Web.md")]]);
    expect(company.mock.calls).toEqual([[root, file(ACME.path)]]);
    expect(root.classes).toEqual([]);
  });

  it("closes the detail form for an unknown entity key or a missing file, after adding the class", async () => {
    const { view, root, closed, file } = setup([JANE]);
    await view.renderEntityDetail(root, "nope", file(JANE.path));
    await view.renderEntityDetail(root, "contact", null);
    expect(closed).toHaveBeenCalledTimes(2);
    expect(root.classes).toEqual(["cadence-detail"]);
    expect(root.children).toEqual([]);
  });
});

describe("renderEntityDetail: header", () => {
  it("shows the back button, the breadcrumb and the actions", async () => {
    const { root, render } = setup([JANE]);
    await render("contact", JANE.path);
    expect(root.classes).toEqual(["cadence-detail"]);
    const back = header(root).children[0].children[0];
    expect([back.text, back.classes]).toEqual(["← Contacts", ["cad-btn", "cad-detail-back"]]);
    expect(crumbs(root)).toEqual(["CONTACTS", "Jane Doe", JANE.path]);
    expect(headActions(root).map((b) => [b.text, b.classes])).toEqual([
      ["", ["cad-detail-saved"]],
      ["Open as note", ["cad-btn"]],
      ["Delete", ["cad-btn", "cad-btn-danger"]],
    ]);
  });

  it("titles with the primary field, falling back to the basename only for a missing or empty value", async () => {
    const { root, render, view, file } = setup([
      { path: "Cadence/Contacts/empty.md", frontmatter: { name: "" } },
      { path: "Cadence/Contacts/zero.md", frontmatter: { name: 0 } },
      { path: "Cadence/Contacts/bare.md" },
    ]);
    await render("contact", "Cadence/Contacts/empty.md");
    const zero = new FakeElement("div");
    await view.renderEntityDetail(zero, "contact", file("Cadence/Contacts/zero.md"));
    const bare = new FakeElement("div");
    await view.renderEntityDetail(bare, "contact", file("Cadence/Contacts/bare.md"));
    expect([crumbs(root)[1], crumbs(zero)[1], crumbs(bare)[1]]).toEqual(["empty", "0", "bare"]);
  });

  it("back closes the form, and Open as note opens the file", async () => {
    const { root, render, closed, app } = setup([JANE]);
    await render("contact", JANE.path);
    header(root).children[0].children[0].trigger("click");
    headActions(root)[1].trigger("click");
    expect(closed).toHaveBeenCalledTimes(1);
    expect(app.workspace.openedLinks).toEqual([[JANE.path, "", false]]);
  });

  it("Delete confirms, then trashes the file 50ms later, notices and closes", async () => {
    const open = vi.spyOn(CadenceConfirmModal.prototype, "open").mockImplementation(() => {});
    const { root, render, closed, app } = setup([JANE]);
    await render("contact", JANE.path);
    const del = headActions(root)[2];
    const event = del.trigger("click");
    expect(event.defaultPrevented).toBe(true);
    const modal = open.mock.contexts[0] as Any;
    expect([modal.title, modal.message, modal.confirmLabel]).toEqual([
      "Delete Contact", "Delete this contact? This moves the file to trash.", "Delete",
    ]);
    modal.onConfirm();
    expect(del.blurCount).toBe(1);
    expect(app.vault.trashed).toEqual([]);
    await vi.advanceTimersByTimeAsync(50);
    expect(app.vault.trashed).toEqual([JANE.path]);
    expect(Notice.messages).toEqual(["Deleted Contact: Jane Doe"]);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("a failed delete notices the error and keeps the form open", async () => {
    const open = vi.spyOn(CadenceConfirmModal.prototype, "open").mockImplementation(() => {});
    const { root, render, closed, app } = setup([JANE]);
    vi.spyOn(app.vault, "trash").mockRejectedValue(new Error("locked"));
    await render("contact", JANE.path);
    headActions(root)[2].trigger("click");
    (open.mock.contexts[0] as Any).onConfirm();
    await vi.advanceTimersByTimeAsync(50);
    expect(Notice.messages).toEqual(["Delete failed: locked"]);
    expect(closed).not.toHaveBeenCalled();
  });
});

describe("renderEntityDetail: fields", () => {
  it("renders one labelled row per field, with a control per field type", async () => {
    const { root, render } = setup([JANE]);
    await render("contact", JANE.path);
    expect(rowKinds(root)).toEqual([
      ["NAME", "input:text"],
      ["EMAIL", "input:email"],
      ["PHONE", "input:text"],
      ["COMPANY", "chips"],
      ["ROLE", "chips"],
      ["LAST CONTACT", "input:date"],
      ["TAGS", "chips"],
    ]);
    expect(form(root).children.every((r) => r.classes[0] === "cad-form-row")).toBe(true);
  });

  it("fills text and email inputs with the stringified value, and the primary placeholder", async () => {
    const { root, render } = setup([JANE]);
    await render("contact", JANE.path);
    expect([control(root, "NAME").value, control(root, "NAME").placeholder]).toEqual(["Jane Doe", "Contact name"]);
    expect(control(root, "EMAIL").value).toBe("jane@acme.test");
    // QUIRK: a list field without a chip source is a text input showing the joined array.
    expect(control(root, "PHONE").value).toBe("555-1,555-2");
    expect(control(root, "PHONE").placeholder).toBe("");
  });

  it("skips a non-enum `type` field and renders an enum `type` field as a select", async () => {
    const restore = withVendor();
    try {
      const { root, render } = setup([{ path: "Cadence/Vendors/V.md", frontmatter: { name: "V", type: "x" } }]);
      await render("vendor", "Cadence/Vendors/V.md");
      expect(rowKinds(root).map((r) => r[0])).toEqual(["NAME", "SUPPLIER", "ACCOUNT", "LABELS", "KIND"]);
      const act = setup([{ path: "Cadence/Activities/Call.md", frontmatter: { subject: "Call", type: "Call" } }]);
      await act.render("activity", "Cadence/Activities/Call.md");
      expect(rowKinds(act.root)[1]).toEqual(["TYPE", "select"]);
    } finally {
      restore();
    }
  });

  it("a select offers an empty option then the field's options, selecting a scalar or a list's first value", async () => {
    const { root, render } = setup([DEAL]);
    await render("deal", DEAL.path);
    const stage = control(root, "STAGE");
    expect(stage.options.map((o) => [o.value, o.text])).toEqual([
      ["", "—"], ["Lead", "Lead"], ["Qualified", "Qualified"], ["Proposal", "Proposal"],
      ["Negotiation", "Negotiation"], ["Won", "Won"], ["Lost", "Lost"],
    ]);
    expect(stage.value).toBe("Proposal");
    const scalar = setup([{ path: "Cadence/Partners/P.md", frontmatter: { name: "P", tier: "Gold" } }]);
    await scalar.render("partner", "Cadence/Partners/P.md");
    expect([control(scalar.root, "TIER").value, control(scalar.root, "STATUS").value]).toEqual(["Gold", ""]);
  });

  it("a select writes on change: stage as a one-item list, others as a scalar, empty deletes", async () => {
    const { root, render, fm } = setup([DEAL]);
    await render("deal", DEAL.path);
    choose(control(root, "STAGE"), "Won");
    await flush();
    expect(fm(DEAL.path)?.stage).toEqual(["Won"]);
    choose(control(root, "STAGE"), "");
    await flush();
    expect(fm(DEAL.path)).not.toHaveProperty("stage");
    const p = setup([{ path: "Cadence/Partners/P.md", frontmatter: { name: "P", tier: "Gold" } }]);
    await p.render("partner", "Cadence/Partners/P.md");
    choose(control(p.root, "STATUS"), "Active");
    choose(control(p.root, "TIER"), "");
    await flush();
    expect(p.fm("Cadence/Partners/P.md")).toEqual({ name: "P", status: "Active" });
  });

  it("a date input shows the ISO date of a parseable value, empty otherwise, and writes on change", async () => {
    const { root, render, fm } = setup([DEAL, { path: "Cadence/Contacts/x.md", frontmatter: { lastContact: "soon" } }]);
    await render("deal", DEAL.path);
    const close = control(root, "CLOSE BY");
    expect(close.value).toBe("2026-11-30");
    type(close, "2026-12-01", "change");
    await flush();
    expect(fm(DEAL.path)?.closeBy).toBe("2026-12-01");
    type(close, "", "change");
    await flush();
    expect(fm(DEAL.path)).not.toHaveProperty("closeBy");
    const other = setup([{ path: "Cadence/Contacts/x.md", frontmatter: { lastContact: "soon" } }]);
    await other.render("contact", "Cadence/Contacts/x.md");
    expect(control(other.root, "LAST CONTACT").valueWrites).toEqual([]);
  });

  it("a currency input shows the value and the currency placeholder, defaulting to USD", async () => {
    const { root, render } = setup([DEAL], { currency: "EUR" });
    await render("deal", DEAL.path);
    expect([control(root, "VALUE").type, control(root, "VALUE").value, control(root, "VALUE").placeholder]).toEqual([
      "number", "1200", "EUR amount",
    ]);
    const usd = setup([DEAL]);
    await usd.render("deal", DEAL.path);
    expect(control(usd.root, "VALUE").placeholder).toBe("USD amount");
    const seq = setup([{ path: "Cadence/Sequences/S.md", frontmatter: { name: "S", steps: 0 } }]);
    await seq.render("sequence", "Cadence/Sequences/S.md");
    expect([control(seq.root, "STEPS").value, control(seq.root, "STEPS").placeholder]).toEqual(["0", ""]);
    expect(control(seq.root, "ACTIVE").valueWrites).toEqual([]);
  });

  it("a number input writes a number 350ms after typing, or at once on blur", async () => {
    const { root, render, fm } = setup([DEAL]);
    await render("deal", DEAL.path);
    const value = control(root, "VALUE");
    type(value, "15");
    type(value, "150");
    await vi.advanceTimersByTimeAsync(349);
    expect(fm(DEAL.path)?.value).toBe(1200);
    await vi.advanceTimersByTimeAsync(1);
    expect(fm(DEAL.path)?.value).toBe(150);
    type(value, "abc", "blur");
    await flush();
    expect(fm(DEAL.path)).not.toHaveProperty("value");
    // QUIRK: clearing a number writes 0, because Number('') is 0.
    type(value, "", "blur");
    await flush();
    expect(fm(DEAL.path)?.value).toBe(0);
  });

  it("text and email inputs write on debounce and blur; an empty value deletes the key", async () => {
    const { root, render, fm } = setup([JANE]);
    await render("contact", JANE.path);
    type(control(root, "NAME"), "Jane D");
    await vi.advanceTimersByTimeAsync(350);
    expect(fm(JANE.path)?.name).toBe("Jane D");
    // QUIRK: the email input writes a scalar over the list it read.
    type(control(root, "EMAIL"), "j@x.test", "blur");
    await flush();
    expect(fm(JANE.path)?.email).toBe("j@x.test");
    type(control(root, "PHONE"), "", "blur");
    await flush();
    expect(fm(JANE.path)).not.toHaveProperty("phone");
  });

  it("a write flashes Saved for 1400ms", async () => {
    const { root, render } = setup([JANE]);
    await render("contact", JANE.path);
    type(control(root, "NAME"), "J", "blur");
    await flush();
    expect([badge(root).text, badge(root).classes]).toEqual(["Saved", ["cad-detail-saved", "show"]]);
    await vi.advanceTimersByTimeAsync(1399);
    expect(badge(root).classes).toContain("show");
    await vi.advanceTimersByTimeAsync(1);
    expect(badge(root).classes).toEqual(["cad-detail-saved"]);
  });

  it("a failed write notices the error and does not flash", async () => {
    const { root, render, app } = setup([JANE]);
    vi.spyOn(app.fileManager, "processFrontMatter").mockRejectedValue(new Error("read-only"));
    await render("contact", JANE.path);
    type(control(root, "NAME"), "J", "blur");
    await flush();
    expect(Notice.messages).toEqual(["Save failed: read-only"]);
    expect(badge(root).text).toBe("");
  });
});

describe("renderEntityDetail: chip fields", () => {
  it("shows a chip per value before the input, unwrapping links for relation sources only", async () => {
    const { root, render } = setup([JANE]);
    await render("contact", JANE.path);
    expect(chips(root, "COMPANY")).toEqual(["Acme Corp"]);
    // QUIRK: a history source is a plain chip, so a linked value keeps its brackets.
    expect(chips(root, "ROLE")).toEqual(["CTO", "[[Board]]"]);
    expect(chips(root, "TAGS")).toEqual(["vip"]);
    expect(chipInput(root, "COMPANY").placeholder).toBe("Add company...");
    expect(row(root, "COMPANY").style.position).toBe("relative");
    expect(chip(root, "COMPANY", "Acme Corp").children[0].style.textDecoration).toBe("underline");
    expect(chip(root, "TAGS", "vip").children[0].style.textDecoration).toBeUndefined();
    expect(suggestBox(root, "COMPANY").style.display).toBe("none");
  });

  it("a scalar value becomes one chip; an empty one none", async () => {
    const { root, render } = setup([DEAL]);
    await render("deal", DEAL.path);
    expect(chips(root, "CONTACT")).toEqual(["Jane Doe"]);
    expect(chips(root, "COMPANY")).toEqual([]);
  });

  it("Enter adds a link chip to a list field and writes the links", async () => {
    const { root, render, fm } = setup([JANE, ACME, GLOBEX]);
    await render("contact", JANE.path);
    await enter(chipInput(root, "COMPANY"), "  Globex ");
    expect(chips(root, "COMPANY")).toEqual(["Acme Corp", "Globex"]);
    expect(chipInput(root, "COMPANY").value).toBe("");
    expect(fm(JANE.path)?.company).toEqual(["[[Acme Corp]]", "[[Globex]]"]);
  });

  it("adding a value already listed only clears the input; a blank value does nothing", async () => {
    const { root, render, app } = setup([JANE, ACME]);
    const write = vi.spyOn(app.fileManager, "processFrontMatter");
    await render("contact", JANE.path);
    await enter(chipInput(root, "COMPANY"), "Acme Corp");
    await enter(chipInput(root, "COMPANY"), "   ");
    expect(chips(root, "COMPANY")).toEqual(["Acme Corp"]);
    expect(chipInput(root, "COMPANY").value).toBe("   ");
    expect(write).not.toHaveBeenCalled();
  });

  it("a single-value chip field replaces its value and writes one link", async () => {
    const { root, render, fm } = setup([DEAL, { path: "Cadence/Contacts/Bob.md" }]);
    await render("deal", DEAL.path);
    await enter(chipInput(root, "CONTACT"), "Bob");
    expect(chips(root, "CONTACT")).toEqual(["Bob"]);
    expect(fm(DEAL.path)?.contact).toBe("[[Bob]]");
  });

  it("plain chips write the values as-is", async () => {
    const { root, render, fm } = setup([JANE]);
    await render("contact", JANE.path);
    await enter(chipInput(root, "TAGS"), "new");
    await enter(chipInput(root, "ROLE"), "Founder");
    expect(fm(JANE.path)?.tags).toEqual(["vip", "new"]);
    expect(fm(JANE.path)?.role).toEqual(["CTO", "[[Board]]", "Founder"]);
  });

  it("adding a link to a missing note creates it in the target entity's folder", async () => {
    const { root, render, app } = setup([JANE, ACME]);
    await render("contact", JANE.path);
    await enter(chipInput(root, "COMPANY"), "Initech");
    await flush();
    expect(app.vault.created).toEqual(["Cadence/Companies/Initech.md"]);
    expect(Notice.messages).toEqual(["Created new Company: Initech"]);
    await enter(chipInput(root, "COMPANY"), "globex");
    expect(app.vault.created).toHaveLength(2);
  });

  it("the note lookup is case-insensitive across the vault, so an existing note is not recreated", async () => {
    const { root, render, app } = setup([JANE, ACME, { path: "Elsewhere/INITECH.md" }]);
    await render("contact", JANE.path);
    await enter(chipInput(root, "COMPANY"), "Initech");
    await flush();
    expect(app.vault.created).toEqual([]);
  });

  it("a failed auto-create only warns", async () => {
    const { root, render, app, fm } = setup([JANE]);
    vi.spyOn(app.vault, "create").mockRejectedValue(new Error("disk"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await render("contact", JANE.path);
    await enter(chipInput(root, "COMPANY"), "Initech");
    await flush();
    expect(warn.mock.calls[0][0]).toBe("Failed to auto-create company");
    expect(fm(JANE.path)?.company).toEqual(["[[Acme Corp]]", "[[Initech]]"]);
  });

  it("× removes a chip and writes; removing the last value deletes the key", async () => {
    const { root, render, fm } = setup([JANE]);
    await render("contact", JANE.path);
    const event = chip(root, "TAGS", "vip").children[1].trigger("click");
    await flush();
    expect(event.propagationStopped).toBe(true);
    expect(chips(root, "TAGS")).toEqual([]);
    expect(fm(JANE.path)).not.toHaveProperty("tags");
    chip(root, "ROLE", "CTO").children[1].trigger("click");
    await flush();
    expect(fm(JANE.path)?.role).toEqual(["[[Board]]"]);
  });

  it("Backspace in an empty input removes the last chip", async () => {
    const { root, render, fm } = setup([JANE]);
    await render("contact", JANE.path);
    const input = chipInput(root, "ROLE");
    input.trigger("keydown", { key: "Backspace" });
    await flush();
    expect(chips(root, "ROLE")).toEqual(["CTO"]);
    expect(fm(JANE.path)?.role).toEqual(["CTO"]);
    input.value = "x";
    input.trigger("keydown", { key: "Backspace" });
    await flush();
    expect(chips(root, "ROLE")).toEqual(["CTO"]);
  });

  it("blur hides the suggestions after 180ms and adds what was typed", async () => {
    const { root, render, fm } = setup([JANE]);
    await render("contact", JANE.path);
    const input = chipInput(root, "TAGS");
    suggestBox(root, "TAGS").style.display = "block";
    type(input, " later ", "blur");
    await vi.advanceTimersByTimeAsync(179);
    expect(suggestBox(root, "TAGS").style.display).toBe("block");
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(suggestBox(root, "TAGS").style.display).toBe("none");
    expect(fm(JANE.path)?.tags).toEqual(["vip", "later"]);
  });

  it("clicking the chip area focuses the input", async () => {
    const { root, render } = setup([JANE]);
    await render("contact", JANE.path);
    chipWrap(root, "TAGS").trigger("click");
    expect(chipInput(root, "TAGS").focusCount).toBe(1);
  });

  it("clicking a link chip opens its note's detail form, or the link when there is no note", async () => {
    const { root, render, opened, app, file } = setup([JANE, ACME, DEAL]);
    await render("contact", JANE.path);
    const event = chip(root, "COMPANY", "Acme Corp").children[0].trigger("click");
    expect(event.propagationStopped).toBe(true);
    expect(opened.mock.calls).toEqual([["company", file(ACME.path)]]);
    const deal = new FakeElement("div");
    const made = setup([DEAL]);
    await made.view.renderEntityDetail(deal, "deal", made.file(DEAL.path));
    chip(deal, "CONTACT", "Jane Doe").children[0].trigger("click");
    expect(made.app.workspace.openedLinks).toEqual([["Jane Doe", "", false]]);
    expect(app.workspace.openedLinks).toEqual([]);
  });
});

describe("renderEntityDetail: chip suggestions", () => {
  it("a relation source suggests the target entity's notes not yet chosen, filtered by the query", async () => {
    const { root, render } = setup([JANE, ACME, GLOBEX, { path: "Cadence/Companies/Globo.md" }]);
    await render("contact", JANE.path);
    const input = chipInput(root, "COMPANY");
    input.trigger("focus");
    expect(suggestions(root, "COMPANY")).toEqual(["Globex", "Globo"]);
    expect(suggestBox(root, "COMPANY").style.display).toBe("block");
    type(input, " GLOBE ");
    expect(suggestions(root, "COMPANY")).toEqual(["Globex"]);
    type(input, "zzz");
    expect(suggestions(root, "COMPANY")).toEqual([]);
    expect(suggestBox(root, "COMPANY").style.display).toBe("none");
  });

  it("a tags source suggests the vault's tags without the #", async () => {
    const { root, render, app } = setup([JANE]);
    app.metadataCache.tags = { "#vip": 2, "#lead": 1, "#cold": 1 };
    await render("contact", JANE.path);
    type(chipInput(root, "TAGS"), "l");
    expect(suggestions(root, "TAGS")).toEqual(["lead", "cold"]);
  });

  it("a history source suggests every value of that key across the vault, unwrapped", async () => {
    const { root, render } = setup([JANE, BOB, { path: "x.md", frontmatter: { role: " Owner " } }]);
    await render("contact", JANE.path);
    chipInput(root, "ROLE").trigger("focus");
    // QUIRK: history values are unwrapped, but the chips are not, so [[Board]] is offered again as Board.
    expect(suggestions(root, "ROLE")).toEqual(["Board", "Sales", "Owner"]);
  });

  it("mousedown on a suggestion adds it and hides the box", async () => {
    const { root, render, fm } = setup([JANE, ACME, GLOBEX]);
    await render("contact", JANE.path);
    chipInput(root, "COMPANY").trigger("focus");
    const item = suggestBox(root, "COMPANY").children[0];
    expect([item.classes, item.style.cursor]).toEqual([["cad-suggestion-item"], "pointer"]);
    item.trigger("mouseenter");
    expect(item.style.backgroundColor).toBe("var(--background-modifier-hover)");
    item.trigger("mouseleave");
    expect(item.style.backgroundColor).toBe("transparent");
    const event = item.trigger("mousedown");
    await flush();
    expect(event.defaultPrevented).toBe(true);
    expect(fm(JANE.path)?.company).toEqual(["[[Acme Corp]]", "[[Globex]]"]);
    expect(suggestBox(root, "COMPANY").style.display).toBe("none");
  });

  it("a folder source lists the folder's notes, recursively; a folder matching an entity targets that entity", async () => {
    const restore = withVendor();
    try {
      const { root, render, opened, openedFile, file, app } = setup([
        { path: "Cadence/Vendors/V.md", frontmatter: { name: "V", supplier: "[[Bolt Co]]", account: "[[Acme Corp]]" } },
        { path: "Cadence/Suppliers/Bolt Co.md" }, { path: "Cadence/Suppliers/EU/Nut Ltd.md" },
        { path: "Cadence/Suppliers/logo.png" }, ACME, GLOBEX,
      ]);
      await render("vendor", "Cadence/Vendors/V.md");
      chipInput(root, "SUPPLIER").trigger("focus");
      expect(suggestions(root, "SUPPLIER")).toEqual(["Nut Ltd"]);
      // QUIRK: the trailing slash matches the Companies entity, but the folder lookup finds nothing to suggest.
      chipInput(root, "ACCOUNT").trigger("focus");
      expect(suggestions(root, "ACCOUNT")).toEqual([]);
      chip(root, "SUPPLIER", "Bolt Co").children[0].trigger("click");
      chip(root, "ACCOUNT", "Acme Corp").children[0].trigger("click");
      expect(openedFile.mock.calls).toEqual([[file("Cadence/Suppliers/Bolt Co.md")]]);
      expect(opened.mock.calls).toEqual([["company", file(ACME.path)]]);
      await enter(chipInput(root, "SUPPLIER"), "Rivet Inc");
      await enter(chipInput(root, "ACCOUNT"), "Hooli");
      await flush();
      expect(app.vault.created).toEqual(["Cadence/Suppliers/Rivet Inc.md", "Cadence/Companies/Hooli.md"]);
      expect(Notice.messages).toEqual(["Created new Note: Rivet Inc", "Created new Company: Hooli"]);
    } finally {
      restore();
    }
  });

  it("a multitext field with no source is a plain chip list with no suggestions", async () => {
    const restore = withVendor();
    try {
      const { root, render, fm } = setup([{ path: "Cadence/Vendors/V.md", frontmatter: { name: "V", labels: "[[a]]" } }]);
      await render("vendor", "Cadence/Vendors/V.md");
      expect(chips(root, "LABELS")).toEqual(["[[a]]"]);
      chipInput(root, "LABELS").trigger("focus");
      expect(suggestions(root, "LABELS")).toEqual([]);
      await enter(chipInput(root, "LABELS"), "b");
      expect(fm("Cadence/Vendors/V.md")?.labels).toEqual(["[[a]]", "b"]);
    } finally {
      restore();
    }
  });
});

describe("renderEntityDetail: sections", () => {
  it("renders the note's H2 sections in a grid under NOTE SECTIONS, then the cross sections", async () => {
    const { root, render, h2, cross, file } = setup([JANE]);
    await render("contact", JANE.path);
    const [label, grid] = root.children.slice(2);
    expect([label.text, label.classes, label.style.marginTop]).toEqual(["NOTE SECTIONS", ["cad-section-label-lg"], "24px"]);
    expect([grid.classes, grid.style.display, grid.style.gridTemplateColumns]).toEqual([
      ["cad-pd-cols"], "grid", "repeat(auto-fit, minmax(350px, 1fr))",
    ]);
    const sections = { Notes: "Hello", "Tasks #tasks": "- [ ] Call\n" };
    expect(h2.mock.calls.map((c) => c.slice(0, 4))).toEqual([
      [grid, file(JANE.path), sections, "Notes"],
      [grid, file(JANE.path), sections, "Tasks #tasks"],
    ]);
    const flashSaved = h2.mock.calls[0][4] as () => void;
    flashSaved();
    expect(badge(root).text).toBe("Saved");
    expect(cross.mock.calls).toEqual([[root, "contact", "Jane Doe"]]);
  });

  it("renders no section grid for a note without H2 sections", async () => {
    const { root, render, h2, cross } = setup([DEAL]);
    await render("deal", DEAL.path);
    expect(root.children).toHaveLength(2);
    expect(h2).not.toHaveBeenCalled();
    expect(cross.mock.calls).toEqual([[root, "deal", "Acme renewal"]]);
  });
});
