import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, Notice, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";
import { ENTITIES } from "../../src/constants/entities";
import { entityTemplate, projectTemplate } from "../../src/utils/templates";

/* Characterization tests for the Templates dashboard, renderTemplatesDashboard:
   the header, the Daily Note tile, one tile per entity (badge, target folder,
   actions), the template path lookup, and the Enable Custom / Reset to
   Default / Visual Editor / Raw Note actions. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const entitiesSnapshot = structuredClone(ENTITIES);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-08T10:00:00Z") });
});
afterEach(() => {
  for (const key of Object.keys(ENTITIES)) delete (ENTITIES as Any)[key];
  Object.assign(ENTITIES, structuredClone(entitiesSnapshot));
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Notice.messages.length = 0;
});

function setup(files: MockFileSpec[] = [], settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files, settings });
  made.view.mode = "templates";
  const root = new FakeElement("div");
  const rendered = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
  const opened = vi.spyOn(made.view, "openTemplateDetail").mockResolvedValue(undefined);
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path);
  const read = (path: string) => made.app.vault.read(file(path) as Any);
  return { ...made, root, rendered, opened, file, read };
}

const T = "Cadence/Templates";
const tpl = (name: string, body = "## Notes #notes\nhello\n"): MockFileSpec => ({ path: `${T}/${name}.md`, body });

const headerTexts = (root: FakeElement) => root.children[0].children[0].children.map((c) => c.text);
const grid = (root: FakeElement) => root.children[1];
const tile = (root: FakeElement, entity: string) => grid(root).children.find((c) => c.dataset.entity === entity)!;
const head = (card: FakeElement) => card.children[0];
const badge = (card: FakeElement) => head(card).children[1];
const iconOf = (card: FakeElement) => head(card).children[0].children[0];
const titles = (card: FakeElement) => head(card).children[0].children[1].children.map((c) => c.text);
const buttons = (card: FakeElement) => card.children[3].children;
const button = (card: FakeElement, text: string) => buttons(card).find((b) => b.text === text)!;

describe("renderTemplatesDashboard: layout", () => {
  it("adds the dashboard and projects classes and renders the page header", async () => {
    const { view, root } = setup();
    await view.renderTemplatesDashboard(root);
    expect(root.classes).toEqual(["cadence-dashboard", "cadence-projects"]);
    expect(headerTexts(root)).toEqual(["CADENCE", "Templates Dashboard", "Manage and visually edit the templates for your entities"]);
    expect(root.children.map((c) => c.classes)).toEqual([["cad-page-header"], ["cad-proj-grid"]]);
  });

  it("creates the Cadence/Templates folder when it is missing", async () => {
    const { view, root, file } = setup();
    expect(file(T)).toBeNull();
    await view.renderTemplatesDashboard(root);
    expect(file(T)).not.toBeNull();
  });

  it("renders the Daily Note tile first, then one tile per entity in ENTITIES order", async () => {
    const { view, root } = setup();
    await view.renderTemplatesDashboard(root);
    expect(grid(root).children.map((c) => c.dataset.entity)).toEqual(["daily", ...Object.keys(ENTITIES)]);
    expect(grid(root).children.every((c) => c.classes.join(" ") === "cad-proj-card cad-template-tile")).toBe(true);
  });

  it("includes a custom entity registered in ENTITIES, with its icon", async () => {
    (ENTITIES as Any).vendor = { folder: "Cadence/Vendors", label: "Vendor", plural: "Vendors", icon: "truck", fields: [{ key: "name" }], columns: [] };
    const { view, root } = setup();
    await view.renderTemplatesDashboard(root);
    const card = tile(root, "vendor");
    expect(titles(card)).toEqual(["VENDOR", "Vendors"]);
    expect(iconOf(card).icon).toBe("truck");
  });
});

describe("renderTemplatesDashboard: the Daily Note tile", () => {
  it("shows the planner eyebrow, sun icon and the daily folder from settings", async () => {
    const { view, root } = setup([], { dailyNoteFolder: "Journal/Days" });
    await view.renderTemplatesDashboard(root);
    const card = tile(root, "daily");
    expect(iconOf(card).icon).toBe("sun");
    expect(iconOf(card).classes).toEqual(["cad-template-tile-icon"]);
    expect(titles(card)).toEqual(["PLANNER", "Daily Note"]);
    expect(card.children[1].text).toBe("Target Folder: Journal/Days/");
    expect(card.children[2].text).toBe("Defines properties and sections layout for each new daily note created in the planner.");
  });

  it("names the vault root when the daily folder setting is blank, where daily notes are written", async () => {
    const { view, root } = setup([], { dailyNoteFolder: "" });
    await view.renderTemplatesDashboard(root);
    expect(tile(root, "daily").children[1].text).toBe("Target Folder: vault root");
  });

  it("without a template: a Default badge and one primary Enable Custom button", async () => {
    const { view, root } = setup();
    await view.renderTemplatesDashboard(root);
    const card = tile(root, "daily");
    expect([badge(card).text, badge(card).classes]).toEqual(["Default", ["cad-pill", "cad-pill-backlog"]]);
    expect([badge(card).style.fontSize, badge(card).style.padding]).toEqual(["0.7em", "3px 8px"]);
    expect(buttons(card).map((b) => [b.text, b.classes])).toEqual([["Enable Custom", ["cad-btn", "primary"]]]);
    expect([buttons(card)[0].style.padding, buttons(card)[0].style.height]).toEqual(["5px 12px", "auto"]);
  });

  it("Enable Custom creates daily.md with the default body, notices and re-renders", async () => {
    const { view, root, app, rendered, read } = setup();
    await view.renderTemplatesDashboard(root);
    const ev = button(tile(root, "daily"), "Enable Custom").trigger("click");
    await flush();
    expect(ev.propagationStopped).toBe(true);
    expect(app.vault.created).toEqual([`${T}/daily.md`]);
    expect(await read(`${T}/daily.md`)).toBe("# {{date}}\n\n## Today\n- [ ] \n\n## Journal\n\n");
    expect(Notice.messages).toEqual(["Daily Note template successfully enabled."]);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("without a template, clicking the tile does nothing", async () => {
    const { view, root, opened } = setup();
    await view.renderTemplatesDashboard(root);
    tile(root, "daily").trigger("click");
    expect(opened).not.toHaveBeenCalled();
  });

  it("with a template: an Active badge, Visual Editor and Raw Note, and the tile opens the editor", async () => {
    const { view, root, opened, app, file } = setup([tpl("daily")]);
    await view.renderTemplatesDashboard(root);
    const card = tile(root, "daily");
    expect([badge(card).text, badge(card).classes]).toEqual(["Active Template", ["cad-pill", "cad-pill-active"]]);
    expect(buttons(card).map((b) => [b.text, b.classes])).toEqual([
      ["Visual Editor", ["cad-btn", "primary"]],
      ["Raw Note 📝", ["cad-btn"]],
    ]);
    const ev = button(card, "Visual Editor").trigger("click");
    expect(ev.propagationStopped).toBe(true);
    expect(opened.mock.calls).toEqual([["daily", file(`${T}/daily.md`)]]);
    const raw = button(card, "Raw Note 📝").trigger("click");
    expect(raw.propagationStopped).toBe(true);
    expect(app.workspace.openedLinks).toEqual([[`${T}/daily.md`, "", false]]);
    card.trigger("click");
    expect(opened.mock.calls).toEqual([["daily", file(`${T}/daily.md`)], ["daily", file(`${T}/daily.md`)]]);
  });
});

describe("renderTemplatesDashboard: entity tiles", () => {
  it("shows the label eyebrow, plural title, file-text icon, entity folder and description", async () => {
    const { view, root } = setup();
    await view.renderTemplatesDashboard(root);
    const card = tile(root, "deal");
    expect(iconOf(card).icon).toBe("file-text");
    expect(titles(card)).toEqual(["DEAL", "Deals"]);
    expect(card.children[1].text).toBe("Target Folder: Cadence/Pipeline/");
    expect(card.children[2].text).toBe("Defines properties and sections layout for each new deal item created.");
  });

  it("without a template: a Default badge and a primary Enable Custom button only", async () => {
    const { view, root } = setup();
    await view.renderTemplatesDashboard(root);
    const card = tile(root, "contact");
    expect([badge(card).text, badge(card).classes]).toEqual(["Default", ["cad-pill", "cad-pill-backlog"]]);
    expect(buttons(card).map((b) => [b.text, b.classes])).toEqual([["Enable Custom", ["cad-btn", "primary"]]]);
  });

  it("with a template: Visual Editor, Raw Note and a non-primary Reset to Default", async () => {
    const { view, root } = setup([tpl("contact")]);
    await view.renderTemplatesDashboard(root);
    const card = tile(root, "contact");
    expect([badge(card).text, badge(card).classes]).toEqual(["Active Template", ["cad-pill", "cad-pill-active"]]);
    expect(buttons(card).map((b) => [b.text, b.classes])).toEqual([
      ["Visual Editor", ["cad-btn", "primary"]],
      ["Raw Note 📝", ["cad-btn"]],
      ["Reset to Default", ["cad-btn"]],
    ]);
  });

  it("finds the template by key, label or plural, trying them in order", async () => {
    const { view, root, opened, file } = setup([tpl("Contacts"), tpl("Contact"), tpl("Companies"), tpl("lead")]);
    await view.renderTemplatesDashboard(root);
    for (const key of ["contact", "company", "lead"]) tile(root, key).trigger("click");
    expect(opened.mock.calls).toEqual([
      ["contact", file(`${T}/Contact.md`)],
      ["company", file(`${T}/Companies.md`)],
      ["lead", file(`${T}/lead.md`)],
    ]);
  });

  it("does not count a folder at a template path as a template", async () => {
    const { view, root, app } = setup();
    await app.vault.createFolder(`${T}/deal.md`);
    await view.renderTemplatesDashboard(root);
    expect(badge(tile(root, "deal")).text).toBe("Default");
  });

  it("Visual Editor and Raw Note re-read the found path when clicked", async () => {
    const { view, root, opened, app, file } = setup([tpl("Partners")]);
    await view.renderTemplatesDashboard(root);
    const card = tile(root, "partner");
    expect(button(card, "Visual Editor").trigger("click").propagationStopped).toBe(true);
    expect(button(card, "Raw Note 📝").trigger("click").propagationStopped).toBe(true);
    expect(opened.mock.calls).toEqual([["partner", file(`${T}/Partners.md`)]]);
    expect(app.workspace.openedLinks).toEqual([[`${T}/Partners.md`, "", false]]);
  });

  it("without a template, clicking the tile does nothing", async () => {
    const { view, root, opened } = setup();
    await view.renderTemplatesDashboard(root);
    tile(root, "deal").trigger("click");
    expect(opened).not.toHaveBeenCalled();
  });
});

describe("renderTemplatesDashboard: Enable Custom and Reset to Default", () => {
  async function enable(key: string) {
    const made = setup();
    await made.view.renderTemplatesDashboard(made.root);
    const ev = button(tile(made.root, key), "Enable Custom").trigger("click");
    await flush();
    return { ...made, ev, content: await made.read(`${T}/${key}.md`) };
  }

  it("Enable Custom creates <key>.md, notices and re-renders, without confirming", async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    const { ev, app, rendered } = await enable("deal");
    expect(ev.propagationStopped).toBe(true);
    expect(app.vault.created).toEqual([`${T}/deal.md`]);
    expect(Notice.messages).toEqual(["Template successfully enabled for Deal."]);
    expect(rendered).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("writes the entity template plus a Notes section for most entities", async () => {
    const { content } = await enable("deal");
    expect(content).toBe(entityTemplate("deal", "{{name}}") + "\n## Notes #notes\n_Context and general notes..._\n");
  });

  it("writes Description, Contacts and Deals sections for a company", async () => {
    const { content } = await enable("company");
    expect(content).toBe(
      entityTemplate("company", "{{name}}") +
        "\n## Description #notes\n_Company description and profile..._\n\n## Contacts #cross-contact-company-table\n\n## Deals #cross-deal-company-kanban\n",
    );
  });

  it("writes Bio and Tasks sections for a contact", async () => {
    const { content } = await enable("contact");
    expect(content).toBe(
      entityTemplate("contact", "{{name}}") + "\n## Bio #notes\n_Background, interests, and how we met..._\n\n## Tasks #tasks\n- [ ] Follow up in 2 weeks\n",
    );
  });

  it("writes the project template, dated today, for a project", async () => {
    const { content } = await enable("project");
    expect(content).toBe(projectTemplate("{{name}}"));
    expect(content).toContain("started: 2026-10-08");
  });

  it("Reset to Default asks first; declining leaves the template alone", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const { view, root, app, rendered, read } = setup([tpl("deal", "custom")]);
    await view.renderTemplatesDashboard(root);
    button(tile(root, "deal"), "Reset to Default").trigger("click");
    await flush();
    expect(confirm.mock.calls).toEqual([["Are you sure you want to reset the template for Deal? Your visual changes will be overwritten."]]);
    expect(app.vault.modified).toEqual([]);
    expect(await read(`${T}/deal.md`)).toBe("custom");
    expect(rendered).not.toHaveBeenCalled();
  });

  it("Reset to Default overwrites the template with the default, notices and re-renders", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const { view, root, app, rendered, read } = setup([tpl("deal", "custom")]);
    await view.renderTemplatesDashboard(root);
    const ev = button(tile(root, "deal"), "Reset to Default").trigger("click");
    await flush();
    expect(ev.propagationStopped).toBe(true);
    expect(app.vault.modified).toEqual([`${T}/deal.md`]);
    expect(await read(`${T}/deal.md`)).toBe(entityTemplate("deal", "{{name}}") + "\n## Notes #notes\n_Context and general notes..._\n");
    expect(Notice.messages).toEqual(["Template reset for Deal."]);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("Reset on a template found at a label/plural path asks first, then overwrites that file and creates nothing", async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    const { view, root, app, read } = setup([tpl("Deals", "custom")]);
    await view.renderTemplatesDashboard(root);
    expect(badge(tile(root, "deal")).text).toBe("Active Template");
    button(tile(root, "deal"), "Reset to Default").trigger("click");
    await flush();
    expect(confirm.mock.calls).toEqual([["Are you sure you want to reset the template for Deal? Your visual changes will be overwritten."]]);
    expect(app.vault.created.filter((p: string) => p.startsWith(`${T}/`) && p.endsWith(".md"))).toEqual([]);
    expect(app.vault.modified).toEqual([`${T}/Deals.md`]);
    expect(await read(`${T}/Deals.md`)).toBe(entityTemplate("deal", "{{name}}") + "\n## Notes #notes\n_Context and general notes..._\n");
    expect(Notice.messages).toEqual(["Template reset for Deal."]);
  });

  it("declining Reset on a label/plural-path template leaves it alone", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const { view, root, app, read } = setup([tpl("Deals", "custom")]);
    await view.renderTemplatesDashboard(root);
    button(tile(root, "deal"), "Reset to Default").trigger("click");
    await flush();
    expect(app.vault.modified).toEqual([]);
    expect(app.vault.created.filter((p: string) => p.endsWith("deal.md"))).toEqual([]);
    expect(await read(`${T}/Deals.md`)).toBe("custom");
  });
});
