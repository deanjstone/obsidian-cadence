import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, Notice, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";
import { CadencePromptModal } from "../../src/modals/prompt";
import { CadenceCrossSectionModal } from "../../src/modals/cross-section";
import { CadenceChartSectionModal } from "../../src/modals/chart-section";

/* Characterization tests for the template builder, renderTemplateDetail:
   the header (back, raw note, delete, the Saved badge), the two-column
   section layout, and the five "add block" buttons, which append a section
   to the template and propagate it to the entity's notes. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"], now: new Date("2026-10-08T10:00:00Z") });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Notice.messages.length = 0;
});

const T = "Cadence/Templates";
const CONTACT_TEMPLATE = "---\ntype: contact\n---\n\n# {{name}}\n\n## Bio #notes\n_bio_\n\n## Tasks #tasks\n- [ ] a\n\n## Links #cross-deal-contact-table\n";

function setup(files: MockFileSpec[] = [{ path: `${T}/contact.md`, body: CONTACT_TEMPLATE }]) {
  const made = makeAppView({ files });
  const root = new FakeElement("div");
  const rendered = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
  const closed = vi.spyOn(made.view, "closeEntityDetail").mockResolvedValue(undefined);
  const sections = vi.spyOn(made.view, "_renderTemplateSectionWithDelete").mockImplementation(() => {});
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path) as Any;
  const read = (path: string) => made.app.vault.read(file(path));
  return { ...made, root, rendered, closed, sections, file, read };
}

/* Capture modals instead of opening them. */
function captureOpen<T>(cls: { prototype: { open(): void } }): T[] {
  const opened: T[] = [];
  vi.spyOn(cls.prototype, "open").mockImplementation(function (this: T) {
    opened.push(this);
  });
  return opened;
}

const header = (root: FakeElement) => root.children[0];
const headLeft = (root: FakeElement) => header(root).children[0];
const headRight = (root: FakeElement) => header(root).children[1];
const cols = (root: FakeElement) => root.children[1];
const toolbar = (root: FakeElement) => root.children[2];
const addButton = (root: FakeElement, text: string) => toolbar(root).children[1].children.find((b) => b.text === text)!;

describe("renderTemplateDetail: header", () => {
  it("adds the project-detail class and, with no file, closes the detail and draws nothing", async () => {
    const { view, root, closed } = setup();
    await view.renderTemplateDetail(root, "contact", null);
    expect(root.classes).toEqual(["cadence-project-detail"]);
    expect(root.children).toEqual([]);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("renders the back button, the TEMPLATE BUILDER breadcrumb with the entity label, and the path", async () => {
    const { view, root, closed, file } = setup();
    await view.renderTemplateDetail(root, "contact", file(`${T}/contact.md`));
    expect(header(root).classes).toEqual(["cad-detail-header"]);
    const [back, crumb] = headLeft(root).children;
    expect([back.text, back.classes]).toEqual(["← Templates", ["cad-btn", "cad-detail-back"]]);
    expect(crumb.children.map((c) => [c.classes, c.text])).toEqual([
      [["cad-eyebrow"], "TEMPLATE BUILDER"],
      [["cad-detail-title"], "Contact"],
      [["cad-detail-path"], `${T}/contact.md`],
    ]);
    back.trigger("click");
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("labels a template with no entity def 'Daily Note'", async () => {
    const { view, root, file } = setup([{ path: `${T}/daily.md`, body: "## Today\n- [ ] \n" }]);
    await view.renderTemplateDetail(root, "daily", file(`${T}/daily.md`));
    expect(headLeft(root).children[1].children[1].text).toBe("Daily Note");
  });

  it("View Raw Note opens the template file", async () => {
    const { view, root, app, file } = setup();
    await view.renderTemplateDetail(root, "contact", file(`${T}/contact.md`));
    const [badge, raw, del] = headRight(root).children;
    expect([badge.classes, badge.text]).toEqual([["cad-detail-saved"], ""]);
    expect([raw.text, raw.classes]).toEqual(["View Raw Note 📝", ["cad-btn"]]);
    expect([del.text, del.classes]).toEqual(["Delete", ["cad-btn", "cad-btn-danger"]]);
    raw.trigger("click");
    expect(app.workspace.openedLinks).toEqual([[`${T}/contact.md`, "", false]]);
  });

  it("Delete asks first; declining keeps the template", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const { view, root, app, closed, file } = setup();
    await view.renderTemplateDetail(root, "contact", file(`${T}/contact.md`));
    headRight(root).children[2].trigger("click");
    await flush();
    expect(confirm.mock.calls).toEqual([["Delete this custom template? Cadence will fall back to using the default structure."]]);
    expect(app.vault.trashed).toEqual([]);
    expect(closed).not.toHaveBeenCalled();
  });

  it("Delete trashes the template, notices and closes the detail", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const { view, root, app, closed, file } = setup();
    await view.renderTemplateDetail(root, "contact", file(`${T}/contact.md`));
    headRight(root).children[2].trigger("click");
    await flush();
    expect(app.vault.trashed).toEqual([`${T}/contact.md`]);
    expect(Notice.messages).toEqual(["Custom template deleted."]);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("a failed delete notices the error and stays open", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const { view, root, app, closed, file } = setup();
    vi.spyOn(app.vault, "trash").mockRejectedValue(new Error("locked"));
    await view.renderTemplateDetail(root, "contact", file(`${T}/contact.md`));
    headRight(root).children[2].trigger("click");
    await flush();
    expect(Notice.messages).toEqual(["Error: locked"]);
    expect(closed).not.toHaveBeenCalled();
  });

  it("flashSaved shows Saved, then hides it after 1.4s; a second flash restarts the timer", async () => {
    const { view, root, sections, file } = setup();
    await view.renderTemplateDetail(root, "contact", file(`${T}/contact.md`));
    const flashSaved = sections.mock.calls[0][4] as () => void;
    const badge = headRight(root).children[0];
    flashSaved();
    expect([badge.text, badge.classes]).toEqual(["Saved", ["cad-detail-saved", "show"]]);
    vi.advanceTimersByTime(1000);
    flashSaved();
    vi.advanceTimersByTime(1000);
    expect(badge.hasClass("show")).toBe(true);
    vi.advanceTimersByTime(400);
    expect(badge.hasClass("show")).toBe(false);
  });
});

describe("renderTemplateDetail: sections", () => {
  it("renders the H2 sections alternately into the left and right columns", async () => {
    const { view, root, sections, file } = setup();
    const tFile = file(`${T}/contact.md`);
    await view.renderTemplateDetail(root, "contact", tFile);
    expect(cols(root).classes).toEqual(["cad-pd-cols"]);
    const [left, right] = cols(root).children;
    expect([left.classes, right.classes]).toEqual([["cad-pd-col"], ["cad-pd-col"]]);
    const parsed = { "Bio #notes": "_bio_\n", "Tasks #tasks": "- [ ] a\n", "Links #cross-deal-contact-table": "" };
    expect(sections.mock.calls.map((c) => [c[0] === left ? "left" : c[0] === right ? "right" : "?", c[1], c[2], c[3], c.length])).toEqual([
      ["left", tFile, parsed, "Bio #notes", 5],
      ["left", tFile, parsed, "Links #cross-deal-contact-table", 5],
      ["right", tFile, parsed, "Tasks #tasks", 5],
    ]);
  });

  it("renders the add-block toolbar with its five buttons", async () => {
    const { view, root, file } = setup();
    await view.renderTemplateDetail(root, "contact", file(`${T}/contact.md`));
    expect(toolbar(root).children[0].text).toBe("➕ ADD BLOCK TO TEMPLATE");
    expect(toolbar(root).children[1].children.map((b) => [b.text, b.classes])).toEqual([
      ["📝 Text Area", ["cad-btn"]],
      ["📋 Task List", ["cad-btn"]],
      ["📅 Milestones / Timeline", ["cad-btn"]],
      ["🔗 Cross-Linked Data", ["cad-btn"]],
      ["📊 Analytics Chart", ["cad-btn"]],
    ]);
  });
});

describe("renderTemplateDetail: adding blocks", () => {
  async function addBlock(text: string, files?: MockFileSpec[]) {
    const made = setup(files);
    const prompts = captureOpen<Any>(CadencePromptModal);
    const propagate = vi.spyOn(made.view, "_propagateTemplateSectionAdd").mockResolvedValue(undefined);
    await made.view.renderTemplateDetail(made.root, "contact", made.file(`${T}/contact.md`));
    addButton(made.root, text).trigger("click");
    return { ...made, prompts, propagate };
  }

  it("Text Area prompts for a title, then appends a #notes section, propagates it and re-renders", async () => {
    const { prompts, propagate, rendered, read } = await addBlock("📝 Text Area");
    expect(prompts.map((p) => [p.title, p.placeholder, p.defaultValue, p.cta])).toEqual([
      ["New Text Section", "Enter text section title:", "Notes", "Add Block"],
    ]);
    prompts[0].onSubmit("Ideas");
    await flush();
    expect(await read(`${T}/contact.md`)).toBe(CONTACT_TEMPLATE.replace(/\s*$/, "") + "\n\n## Ideas #notes\n_Enter your notes here..._\n");
    expect(Notice.messages).toEqual(['Section "Ideas" added to template.']);
    expect(propagate.mock.calls).toEqual([["contact", "Ideas", "#notes", "_Enter your notes here..._"]]);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("Task List appends a #tasks section with a first task", async () => {
    const { prompts, propagate, read } = await addBlock("📋 Task List");
    expect(prompts.map((p) => [p.title, p.placeholder, p.defaultValue, p.cta])).toEqual([
      ["New Task List Block", "Enter task list section title:", "Tasks", "Add Block"],
    ]);
    prompts[0].onSubmit("Todo");
    await flush();
    expect((await read(`${T}/contact.md`)).endsWith("\n\n## Todo #tasks\n- [ ] First task in template\n")).toBe(true);
    expect(propagate.mock.calls).toEqual([["contact", "Todo", "#tasks", "- [ ] First task in template"]]);
  });

  it("Milestones appends a #milestones section with a first milestone dated today", async () => {
    const { prompts, propagate } = await addBlock("📅 Milestones / Timeline");
    expect(prompts.map((p) => [p.title, p.placeholder, p.defaultValue, p.cta])).toEqual([
      ["New Milestones Block", "Enter milestones section title:", "Milestones", "Add Block"],
    ]);
    prompts[0].onSubmit("Plan");
    await flush();
    expect(propagate.mock.calls).toEqual([["contact", "Plan", "#milestones", "- [ ] 2026-10-08 — First milestone in template"]]);
  });

  it("does not check the template for an existing section of the same name", async () => {
    const { prompts, read } = await addBlock("📝 Text Area");
    prompts[0].onSubmit("Bio");
    await flush();
    const content = await read(`${T}/contact.md`);
    expect(content.match(/^## Bio #notes$/gm)).toHaveLength(2);
  });

  it("trims the template's trailing whitespace before appending", async () => {
    const { prompts, read } = await addBlock("📝 Text Area", [{ path: `${T}/contact.md`, body: "# x\n\n\n   \n" }]);
    prompts[0].onSubmit("Ideas");
    await flush();
    expect(await read(`${T}/contact.md`)).toBe("# x\n\n## Ideas #notes\n_Enter your notes here..._\n");
  });

  it("Cross-Linked Data opens the cross-section picker, then prompts with a Related <plural> title", async () => {
    const made = setup();
    const crosses = captureOpen<Any>(CadenceCrossSectionModal);
    const prompts = captureOpen<Any>(CadencePromptModal);
    const propagate = vi.spyOn(made.view, "_propagateTemplateSectionAdd").mockResolvedValue(undefined);
    await made.view.renderTemplateDetail(made.root, "contact", made.file(`${T}/contact.md`));
    addButton(made.root, "🔗 Cross-Linked Data").trigger("click");
    expect(crosses.map((c) => c.parentEntity)).toEqual(["contact"]);
    await crosses[0].onSubmit({ targetEntity: "deal", linkField: "contact", viewType: "kanban" });
    await crosses[0].onSubmit({ targetEntity: "ghost", linkField: "owner", viewType: "table" });
    expect(prompts.map((p) => [p.title, p.placeholder, p.defaultValue, p.cta])).toEqual([
      ["New Cross-Linked Section", "Enter section title:", "Related Deals", "Add Block"],
      ["New Cross-Linked Section", "Enter section title:", "Related Links", "Add Block"],
    ]);
    prompts[0].onSubmit("Deals");
    await flush();
    expect((await made.read(`${T}/contact.md`)).endsWith("\n\n## Deals #cross-deal-contact-kanban\n\n")).toBe(true);
    expect(propagate.mock.calls).toEqual([["contact", "Deals", "#cross-deal-contact-kanban", ""]]);
  });

  it("Analytics Chart opens the chart picker, then prompts with a '<plural> by <field>' title", async () => {
    const made = setup();
    const charts = captureOpen<Any>(CadenceChartSectionModal);
    const prompts = captureOpen<Any>(CadencePromptModal);
    const propagate = vi.spyOn(made.view, "_propagateTemplateSectionAdd").mockResolvedValue(undefined);
    await made.view.renderTemplateDetail(made.root, "contact", made.file(`${T}/contact.md`));
    addButton(made.root, "📊 Analytics Chart").trigger("click");
    expect(charts.map((c) => c.parentEntity)).toEqual(["contact"]);
    charts[0].onSubmit({ targetEntity: "deal", linkField: "contact", groupField: "stage", style: "donut" });
    charts[0].onSubmit({ targetEntity: "ghost", linkField: "owner", groupField: "kind", style: "bar" });
    expect(prompts.map((p) => [p.title, p.placeholder, p.defaultValue, p.cta])).toEqual([
      ["New Analytics Chart", "Enter chart section title:", "Deals by stage", "Add Chart"],
      ["New Analytics Chart", "Enter chart section title:", "ghost by kind", "Add Chart"],
    ]);
    prompts[0].onSubmit("Stages");
    await flush();
    expect(propagate.mock.calls).toEqual([["contact", "Stages", "#chart-deal-contact-stage-donut", ""]]);
  });

  it("cancelling the title prompt (onSubmit(null)) writes nothing, notices nothing and propagates nothing", async () => {
    const { prompts, propagate, read, app, rendered } = await addBlock("📝 Text Area");
    prompts[0].onClose();
    await flush();
    expect(await read(`${T}/contact.md`)).toBe(CONTACT_TEMPLATE);
    expect(app.vault.modified).toEqual([]);
    expect(Notice.messages).toEqual([]);
    expect(propagate).not.toHaveBeenCalled();
    expect(rendered).not.toHaveBeenCalled();
  });

  it("a cancelled prompt on any of the five add-block buttons writes nothing (regression)", async () => {
    const made = setup();
    const crosses = captureOpen<Any>(CadenceCrossSectionModal);
    const charts = captureOpen<Any>(CadenceChartSectionModal);
    const prompts = captureOpen<Any>(CadencePromptModal);
    await made.view.renderTemplateDetail(made.root, "contact", made.file(`${T}/contact.md`));
    for (const text of ["📝 Text Area", "📋 Task List", "📅 Milestones / Timeline"]) addButton(made.root, text).trigger("click");
    addButton(made.root, "🔗 Cross-Linked Data").trigger("click");
    await crosses[0].onSubmit({ targetEntity: "deal", linkField: "contact", viewType: "kanban" });
    addButton(made.root, "📊 Analytics Chart").trigger("click");
    charts[0].onSubmit({ targetEntity: "deal", linkField: "contact", groupField: "stage", style: "donut" });
    expect(prompts).toHaveLength(5);
    for (const p of prompts) p.onClose();
    await flush();
    expect(made.app.vault.modified).toEqual([]);
    expect(Notice.messages).toEqual([]);
  });
});
