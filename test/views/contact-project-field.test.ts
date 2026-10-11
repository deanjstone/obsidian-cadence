import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, FakeElement, Notice, TFile, type App, type MockFileSpec } from "../mocks/obsidian";
import { contentOf } from "../helpers/dom";
import { flush, makeAppView } from "../helpers/app-view";
import { makePlugin } from "../helpers/plugin";
import { restoreEntities, snapshotEntities } from "../helpers/setting-tab";
import { ENTITIES } from "../../src/constants/entities";
import { DEFAULT_SETTINGS } from "../../src/constants/settings";
import { CadenceEntityCreateModal } from "../../src/modals/entity-create";
import { getFieldSuggestionSource } from "../../src/utils/entities";
import { suggestionTarget } from "../../src/utils/field-edit";

/* The contact's `project` field (#68, owner decision 2026-10-11): a project
   relation edited as chips, like company. A form or create-modal edit links
   the project and auto-creates a missing one; background sync still creates
   nothing, and existing `project` values display and stay as stored. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let entitiesSnapshot: Record<string, Any>;
beforeEach(() => {
  entitiesSnapshot = snapshotEntities();
  Notice.messages.length = 0;
});
afterEach(() => {
  restoreEntities(entitiesSnapshot);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const JANE_PATH = "Cadence/Contacts/Jane Doe.md";
const APOLLO: MockFileSpec = { path: "Cadence/Projects/Apollo.md", frontmatter: { type: "project", name: "Apollo" } };
const jane = (frontmatter: Record<string, unknown> = {}): MockFileSpec => ({
  path: JANE_PATH,
  frontmatter: { name: "Jane Doe", type: "contact", ...frontmatter },
});

describe("contact schema", () => {
  it("the contact entity has a Project field whose suggestions come from projects", () => {
    const field = ENTITIES.contact.fields.find((f) => f.key === "project");
    expect(field).toBeDefined();
    expect(field!.label).toBe("Project");
    expect(getFieldSuggestionSource(field)).toBe("project");
    expect(suggestionTarget(getFieldSuggestionSource(field), ENTITIES).targetEntityKey).toBe("project");
  });

  it("sits after Role and before Last contact, as in the default contact schema, and is not a list column", () => {
    const keys = ENTITIES.contact.fields.map((f) => f.key);
    expect(keys).toEqual(DEFAULT_SETTINGS.customEntities.contact.map((f) => f.key));
    expect(ENTITIES.contact.columns).not.toContain("project");
  });

  it("the default contact schema's project field targets the project entity too", () => {
    const field = DEFAULT_SETTINGS.customEntities.contact.find((f) => f.key === "project")!;
    expect(suggestionTarget(getFieldSuggestionSource(field), ENTITIES).targetEntityKey).toBe("project");
  });

  it("a saved, customised contact schema loads unchanged: no field is added or lost", async () => {
    const custom = [
      { key: "name", label: "Name", primary: true, type: "text" },
      { key: "nickname", label: "Nickname", type: "text" },
      { key: "company", label: "Employer", isList: true, type: "multitext", suggestionSource: "folder:Cadence/Companies" },
    ];
    const { plugin } = makePlugin({ data: { customEntities: { contact: structuredClone(custom) } } });
    await plugin.loadSettings();
    expect(plugin.settings.customEntities.contact.map((f: Any) => f.key)).toEqual(["name", "nickname", "company", "type"]);
    expect(plugin.settings.customEntities.contact.slice(0, 3)).toEqual(custom);
  });
});

/* ─────────── The contact detail form ─────────── */

function setupForm(files: MockFileSpec[]) {
  vi.useFakeTimers();
  const made = makeAppView({ files });
  const root = new FakeElement("div");
  vi.spyOn(made.view, "closeEntityDetail").mockResolvedValue(undefined);
  vi.spyOn(made.view, "openEntityDetail").mockResolvedValue(undefined);
  vi.spyOn(made.view, "openEntityDetailFromFile").mockResolvedValue(undefined);
  vi.spyOn(made.view, "_renderDynamicH2Section").mockImplementation(() => {});
  vi.spyOn(made.view, "_renderCrossSections").mockImplementation(() => {});
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path) as Any;
  const fm = (path: string) => made.app.metadataCache.getFileCache(file(path))?.frontmatter;
  const render = () => made.view.renderEntityDetail(root, "contact", file(JANE_PATH));
  return { ...made, root, fm, render };
}

const form = (root: FakeElement) => root.children[1];
const row = (root: FakeElement, label: string) => {
  const found = form(root).children.find((r) => r.children[0].text === label);
  if (!found) throw new Error(`No row ${label}`);
  return found;
};
const chipWrap = (root: FakeElement, label: string) => row(root, label).children[1];
const chipInput = (root: FakeElement, label: string) => chipWrap(root, label).lastChild as FakeElement;
const chips = (root: FakeElement, label: string) =>
  chipWrap(root, label).children.filter((c) => c.classes.includes("cad-tag-chip")).map((c) => c.children[0].text);

async function enter(input: FakeElement, value: string) {
  input.value = value;
  input.trigger("keydown", { key: "Enter" });
  await flush();
}

describe("contact detail form: Project", () => {
  it("renders Project as a chip input after Role", async () => {
    const { root, render } = setupForm([jane()]);
    await render();
    const labels = form(root).children.map((r) => r.children[0].text);
    expect(labels.indexOf("PROJECT")).toBe(labels.indexOf("ROLE") + 1);
    expect(chipWrap(root, "PROJECT").classes).toContain("cad-pd-tag-input-wrap");
    expect(chipInput(root, "PROJECT").placeholder).toBe("Add project...");
  });

  it("shows an existing string, list or link value as chips and rewrites nothing on load", async () => {
    for (const project of ["[[Apollo]]", "Apollo", ["[[Apollo]]", "Zephyr"]]) {
      const { root, render, app, fm } = setupForm([jane({ project: structuredClone(project) }), APOLLO]);
      await render();
      await flush();
      expect(chips(root, "PROJECT")).toEqual(Array.isArray(project) ? ["Apollo", "Zephyr"] : ["Apollo"]);
      expect(app.fileManager.processed).toEqual([]);
      expect(app.vault.created).toEqual([]);
      expect(fm(JANE_PATH)?.project).toEqual(project);
    }
  });

  it("an edit naming an existing project links it and creates nothing", async () => {
    const { root, render, app, fm } = setupForm([jane(), APOLLO]);
    await render();
    await enter(chipInput(root, "PROJECT"), "apollo");
    await flush();
    expect(chips(root, "PROJECT")).toEqual(["apollo"]);
    expect(fm(JANE_PATH)?.project).toEqual(["[[apollo]]"]);
    expect(app.vault.created).toEqual([]);
    expect(Notice.messages).toEqual([]);
  });

  it("an edit naming a missing project links it and auto-creates it in the projects folder, keeping its case", async () => {
    const { root, render, app, fm } = setupForm([jane({ project: "[[Apollo]]" }), APOLLO]);
    await render();
    await enter(chipInput(root, "PROJECT"), "Zephyr X");
    await flush();
    expect(fm(JANE_PATH)?.project).toEqual(["[[Apollo]]", "[[Zephyr X]]"]);
    expect(app.vault.created).toEqual(["Cadence/Projects/Zephyr X.md"]);
    expect(Notice.messages).toEqual(["Created new Project: Zephyr X"]);
  });
});

/* ─────────── The create modal ─────────── */

describe("contact create modal: Project", () => {
  let opened: Any[] = [];
  beforeEach(() => {
    opened = [];
    vi.spyOn(CadenceEntityCreateModal.prototype, "open").mockImplementation(function (this: Any) {
      opened.push(this);
    });
  });

  async function submit(values: Record<string, unknown>, files: MockFileSpec[] = []) {
    const made = makeAppView({ files });
    vi.spyOn(made.view, "render").mockResolvedValue(undefined);
    made.view._createEntityFromPrompt("contact");
    await opened[0].onSubmit({ name: "Ann", values: { name: "Ann", ...values } });
    await flush();
    const fm = (path: string) => made.app.metadataCache.getFileCache(made.app.vault.getAbstractFileByPath(path) as TFile)?.frontmatter;
    return { ...made, fm };
  }

  it("links an existing project and creates only the contact", async () => {
    const { app, fm } = await submit({ project: "Apollo" }, [APOLLO]);
    expect(app.vault.created).toEqual(["Cadence/Contacts/Ann.md"]);
    expect(fm("Cadence/Contacts/Ann.md")?.project).toEqual(["[[Apollo]]"]);
  });

  it("auto-creates a missing project in the projects folder and links it", async () => {
    const { app, fm } = await submit({ project: ["Apollo", "Zephyr X"] }, [APOLLO]);
    expect(app.vault.created).toEqual(["Cadence/Contacts/Ann.md", "Cadence/Projects/Zephyr X.md"]);
    expect(Notice.messages).toContain("Created new Project: Zephyr X");
    expect(fm("Cadence/Contacts/Ann.md")?.project).toEqual(["[[Apollo]]", "[[Zephyr X]]"]);
  });

  it("the modal has a Project input that suggests project notes", () => {
    vi.useFakeTimers();
    const app = createMockApp([APOLLO, { path: "Cadence/Companies/Apex.md" }]);
    const modal: Any = new (CadenceEntityCreateModal as Any)(app, "contact", { onSubmit: vi.fn() });
    modal.onOpen();
    const formEl = contentOf(modal).findAll("div").find((d) => d.classes.includes("cad-create-form")) as FakeElement;
    const projectRow = formEl.children.find((r) => r.children[1].dataset.fieldKey === "project") as FakeElement;
    expect(projectRow).toBeDefined();
    const input = projectRow.children[1];
    input.value = "Ap";
    input.trigger("input");
    const box = projectRow.children[2];
    expect(box.style.display).toBe("block");
    expect(box.children.map((c) => c.text)).toEqual(["Apollo"]);
  });
});

/* ─────────── Background sync ─────────── */

describe("background sync with the contact Project field", () => {
  const file = (app: App, path: string) => app.vault.getAbstractFileByPath(path) as TFile;

  it("creates no project for a contact, project or other note naming one that does not exist", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const { app, plugin } = makePlugin({
      data: { openOnStartup: false },
      files: [
        jane({ project: ["[[Apollo]]", "[[Zephyr]]"] }),
        APOLLO,
        { path: "Cadence/Activities/Call.md", frontmatter: { subject: "Call", with: "[[Jane Doe]]", project: "[[Nova]]" } },
      ],
    });
    await plugin.onload();
    expect(ENTITIES.contact.fields.some((f) => f.key === "project")).toBe(true);
    for (const path of [JANE_PATH, APOLLO.path, "Cadence/Activities/Call.md"]) {
      await app.metadataCache.trigger("changed", file(app, path));
    }
    expect(app.vault.created).toEqual([]);
  });
});
