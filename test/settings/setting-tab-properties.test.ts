import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Notice, SuggestModal, type DropdownComponent, type FakeElement, type MockFileSpec } from "../mocks/obsidian";
import { buttonByText, optionTexts, optionValues } from "../helpers/dom";
import { component, makeSettingTab, restoreEntities, settingByName, snapshotEntities } from "../helpers/setting-tab";
import { ENTITIES } from "../../src/constants/entities";

/* Characterization tests for the Custom Entity Properties section of
   CadenceSettingTab.display(): the entity picker, the property table (lock
   state, label, key, type, options/source, delete), drag reordering, + Add
   property, the folder-source picker (a SuggestModal, captured by spying on
   SuggestModal.prototype.open), and the save path that copies every
   ENTITIES schema into settings.customEntities. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let entities: Record<string, Any>;
let opened: Any[];
let placeholders: string[];
beforeEach(() => {
  Notice.messages.length = 0;
  entities = snapshotEntities();
  opened = [];
  placeholders = [];
  vi.spyOn(SuggestModal.prototype, "open").mockImplementation(function (this: Any) {
    opened.push(this);
  });
  vi.spyOn(SuggestModal.prototype, "setPlaceholder").mockImplementation((text: string) => {
    placeholders.push(text);
  });
});
afterEach(() => {
  restoreEntities(entities);
  vi.restoreAllMocks();
});

/* A custom entity: nothing locked but its primary and `type` fields. */
function addVendor(fields: Any[] = []) {
  ENTITIES.crm_vendor = {
    folder: "Cadence/Vendors",
    label: "Vendor",
    plural: "Vendors",
    columns: ["name"],
    fields: [
      { key: "name", label: "Name", primary: true, type: "text" },
      { key: "type", label: "Type", type: "text" },
      ...fields,
    ],
  };
  return ENTITIES.crm_vendor;
}

function shown(opts: { settings?: Record<string, unknown>; files?: MockFileSpec[]; entity?: string } = {}) {
  const made = makeSettingTab(opts);
  made.tab.display();
  if (opts.entity) void component<DropdownComponent>(settingByName(made.container, "Select entity")).change(opts.entity);
  made.calls.length = 0;
  return { ...made, editor: () => editorOf(made.container) };
}

function editorOf(container: FakeElement): FakeElement {
  return container.children.find((c) => c.classes.includes("cad-prop-editor-container")) as FakeElement;
}

function propRows(editor: FakeElement): FakeElement[] {
  return editor.findAll("tr").filter((tr) => tr.classes.includes("cad-prop-row"));
}

/* The cells of the row whose key input holds `key`. */
function row(editor: FakeElement, key: string) {
  const tr = propRows(editor).find((r) => r.children[2].findAll("input")[0].value === key);
  if (!tr) throw new Error(`No row for ${key}`);
  const [drag, label, keyCell, type, options, del] = tr.children;
  return {
    tr,
    drag,
    label: label.findAll("input")[0],
    key: keyCell.findAll("input")[0],
    datalist: keyCell.findAll("datalist")[0],
    type: type.findAll("select")[0],
    options,
    del: del.findAll("button")[0],
  };
}

function lockState(editor: FakeElement): string[] {
  return propRows(editor).map((tr) => tr.children[0].children.map((s) => s.text).join(""));
}

const dt = () => ({ dataTransfer: { setData: vi.fn(), effectAllowed: "" } });

describe("Custom Entity Properties: entity picker", () => {
  it("lists every entity as Section/Label, sorted, starting on Project", () => {
    addVendor();
    ENTITIES.loose = { folder: "Cadence/Loose", label: "Loose", plural: "Loose", fields: [], columns: [] };
    ENTITIES.inbox_idea = { folder: "Cadence/Ideas", label: "Idea", plural: "Ideas", fields: [], columns: [] };
    const { container } = shown({
      settings: {
        customPages: [
          { id: "custom.1", label: "Vendors", sectionId: "crm", entityKey: "crm_vendor" },
          { id: "custom.2", label: "Ideas", sectionId: "inbox", entityKey: "inbox_idea" },
        ],
      },
    });
    const row = settingByName(container, "Select entity");
    expect(row.desc).toBe("Choose which entity to customize.");
    const d = component<DropdownComponent>(row);
    expect(d.optionPairs).toEqual([
      ["activity", "CRM/Activity"],
      ["company", "CRM/Company"],
      ["contact", "CRM/Contact"],
      ["deal", "CRM/Deal"],
      ["crm_vendor", "CRM/Vendor"],
      ["inbox_idea", "Inbox/Idea"],
      ["loose", "Loose"],
      ["certification", "PRM/Certification"],
      ["commission", "PRM/Commission"],
      ["lead", "PRM/Lead"],
      ["partner", "PRM/Partner"],
      ["registration", "PRM/Registration"],
      ["project", "Projects/Project"],
      ["sequence", "Workflow/Sequence"],
    ]);
    expect(d.getValue()).toBe("project");
  });

  it("redraws the editor for the chosen entity, and draws nothing for an unknown one", async () => {
    const { container, editor } = shown();
    expect(editor().children[0].text).toBe("Properties for: Project");
    const d = component<DropdownComponent>(settingByName(container, "Select entity"));
    await d.change("deal");
    expect(editor().children[0].text).toBe("Properties for: Deal");
    expect(propRows(editor()).map((tr) => tr.children[2].findAll("input")[0].value)).toEqual(["title", "stage", "value", "company", "contact", "owner", "closeBy"]);
    await d.change("ghost");
    expect(editor().children).toEqual([]);
  });
});

describe("Custom Entity Properties: table and locks", () => {
  it("draws the heading, table and header row", () => {
    const { editor } = shown();
    const [h4, table, add] = editor().children;
    expect([h4.localName, table.localName, table.classes, add.text, add.classes]).toEqual(["h4", "table", ["cad-prop-table"], "+ Add property", ["cad-prop-btn-add"]]);
    const ths = table.findAll("th");
    expect(ths.map((th) => th.text)).toEqual(["", "Label (Display name)", "Technical Key (Frontmatter)", "Type", "Options / Source", ""]);
    expect(ths[0].classes).toEqual(["cad-prop-drag-header"]);
  });

  it("locks primary fields and the project's status/priority for good, and locks other core fields by default", () => {
    const { editor } = shown();
    expect(lockState(editor())).toEqual(["🔒", "🔒", "🔒", "🔐", "🔐", "🔐", "🔐"]);
    const rows = propRows(editor());
    expect(rows.every((tr) => tr.classes.includes("cad-prop-row-locked"))).toBe(true);
    expect(rows[0].children[0].children[0].classes).toEqual(["cad-prop-lock-icon"]);
    const toggle = rows[3].children[0].children[0];
    expect([toggle.title, toggle.style.cursor]).toEqual(["Click to unlock this property", "pointer"]);
  });

  it("locks the deal's stage for good", () => {
    const { editor } = shown({ entity: "deal" });
    expect(lockState(editor())).toEqual(["🔒", "🔒", "🔐", "🔐", "🔐", "🔐", "🔐"]);
  });

  it("QUIRK: drawing the table writes locked: true into every core field it shows (and type: locked on a custom entity)", () => {
    addVendor([{ key: "region", label: "Region" }]);
    shown();
    expect(ENTITIES.project.fields.map((f: Any) => f.locked)).toEqual([undefined, undefined, undefined, true, true, true, true]);
    shown({ entity: "crm_vendor" });
    expect(ENTITIES.crm_vendor.fields.map((f: Any) => f.locked)).toEqual([undefined, true, false]);
  });

  it("leaves a custom entity's fields unlocked except type, with drag handles and lock buttons", () => {
    addVendor([{ key: "region", label: "Region" }, { key: "notes", label: "Notes", locked: true }]);
    const { editor } = shown({ entity: "crm_vendor" });
    expect(lockState(editor())).toEqual(["🔒", "🔐", "⋮⋮🔓", "🔐"]);
    const r = row(editor(), "region");
    expect(r.tr.classes).toEqual(["cad-prop-row", "cad-prop-row-draggable"]);
    expect(r.tr.getAttribute("draggable")).toBe("true");
    const [handle, unlock] = r.drag.children;
    expect([handle.classes, unlock.classes, unlock.title, unlock.style.cursor, unlock.style.marginLeft]).toEqual([
      ["cad-prop-drag-handle"], ["cad-prop-unlock-icon"], "Click to lock this property", "pointer", "6px",
    ]);
  });

  it("unlocking and locking a field saves every schema, re-registers types, refreshes and redraws", async () => {
    addVendor([{ key: "region", label: "Region" }]);
    const { editor, plugin, calls } = shown({ entity: "crm_vendor" });
    const click = row(editor(), "region").drag.children[1].trigger("click");
    expect(click.propagationStopped).toBe(true);
    await vi.waitFor(() => expect(calls).toEqual(["save", "register", "refresh"]));
    expect((ENTITIES.crm_vendor.fields[2] as Any).locked).toBe(true);
    expect(lockState(editor())).toEqual(["🔒", "🔐", "🔐"]);
    expect(Object.keys(plugin.settings.customEntities).sort()).toEqual(Object.keys(ENTITIES).sort());
    expect(plugin.settings.customEntities.crm_vendor).toEqual(ENTITIES.crm_vendor.fields);
    expect(plugin.settings.customEntities.crm_vendor).not.toBe(ENTITIES.crm_vendor.fields);
    expect(plugin.settings.customEntities.crm_vendor[2]).not.toBe(ENTITIES.crm_vendor.fields[2]);

    row(editor(), "region").drag.children[0].trigger("click");
    await vi.waitFor(() => expect(calls).toHaveLength(6));
    expect((ENTITIES.crm_vendor.fields[2] as Any).locked).toBe(false);
    expect(lockState(editor())).toEqual(["🔒", "🔐", "⋮⋮🔓"]);
  });

  it("creates settings.customEntities when it is missing", async () => {
    const { editor, plugin, calls } = shown({ settings: { customEntities: undefined } });
    row(editor(), "owner").drag.children[0].trigger("click");
    await vi.waitFor(() => expect(calls).toEqual(["save", "register", "refresh"]));
    expect(plugin.saved[0].customEntities.project[3]).toEqual({ key: "owner", label: "Owner", locked: false });
  });

  it("disables key, type and delete on locked rows and on any `type` field", () => {
    addVendor([{ key: "region", label: "Region" }]);
    const locked = row(shown({ entity: "crm_vendor" }).editor(), "type");
    expect([locked.key.disabled, locked.type.disabled, locked.del.disabled]).toEqual([true, true, true]);
    (ENTITIES.crm_vendor.fields[1] as Any).locked = false;
    const drawn = shown({ entity: "crm_vendor" });
    const t = row(drawn.editor(), "type");
    expect([t.key.disabled, t.type.disabled, t.del.disabled]).toEqual([true, false, true]);
    const r = row(drawn.editor(), "region");
    expect([r.key.disabled, r.type.disabled, r.del.disabled]).toEqual([false, false, false]);
    const name = row(drawn.editor(), "name");
    expect([name.key.disabled, name.type.disabled, name.del.disabled]).toEqual([true, true, true]);
  });
});

describe("Custom Entity Properties: label", () => {
  it("renames the label, falling back to the key when blank, and saves without redrawing", async () => {
    const { editor, calls } = shown();
    const r = row(editor(), "started");
    expect([r.label.value, r.label.classes, r.label.type]).toEqual(["Started", ["cad-prop-input"], "text"]);
    r.label.value = "  Kick-off ";
    r.label.trigger("change");
    await vi.waitFor(() => expect(calls).toEqual(["save", "register", "refresh"]));
    expect(ENTITIES.project.fields[4].label).toBe("Kick-off");
    r.label.value = "   ";
    r.label.trigger("change");
    await vi.waitFor(() => expect(calls).toHaveLength(6));
    expect(ENTITIES.project.fields[4].label).toBe("started");
  });

  it("relabels only this field, leaving every other entity's field with the same key alone", async () => {
    addVendor([{ key: "region", label: "Region", type: "multitext", suggestionSource: "history" }]);
    ENTITIES.partner.fields.find((f: Any) => f.key === "region")!.options = ["x"];
    const { editor, calls } = shown({ entity: "crm_vendor" });
    const r = row(editor(), "region");
    r.label.value = "Area";
    r.label.trigger("change");
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(ENTITIES.crm_vendor.fields[2]).toMatchObject({ key: "region", label: "Area", type: "multitext", suggestionSource: "history" });
    expect(ENTITIES.partner.fields.find((f: Any) => f.key === "region")).toEqual({ key: "region", label: "Region", options: ["x"] });
  });

  it("relabelling the project's status leaves every other status field's label and options alone", async () => {
    const others = ["partner", "registration", "commission", "lead", "sequence"];
    const before = others.map((k) => structuredClone(ENTITIES[k].fields.find((f: Any) => f.key === "status")));
    const { editor, calls } = shown();
    const r = row(editor(), "status");
    r.label.value = "State";
    r.label.trigger("change");
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(ENTITIES.project.fields[1]).toEqual({ key: "status", label: "State", type: "enum", options: ["active", "on_hold", "backlog", "done", "cancelled"] });
    expect(others.map((k) => ENTITIES[k].fields.find((f: Any) => f.key === "status"))).toEqual(before);
    expect(ENTITIES.partner.fields.find((f: Any) => f.key === "status")).toEqual({ key: "status", label: "Status", type: "enum", options: ["Active", "Onboarding", "Inactive", "Churned"] });
  });

  it("never syncs a `type` field to other entities", async () => {
    addVendor();
    const { editor, calls } = shown({ entity: "crm_vendor" });
    const r = row(editor(), "type");
    r.label.value = "Kind";
    r.label.trigger("change");
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(ENTITIES.activity.fields[1]).toEqual({ key: "type", label: "Type", type: "enum", options: ["Call", "Email", "Meeting", "Note", "Task"] });
  });
});

describe("Custom Entity Properties: technical key", () => {
  it("offers every known field key plus up to 200 notes' frontmatter keys (not position) in a datalist", () => {
    const files: MockFileSpec[] = [{ path: "a.md", frontmatter: { budget: 1, position: 2, name: "x" } }, { path: "b.md" }];
    for (let i = 0; i < 205; i++) files.push({ path: `bulk/${i}.md`, frontmatter: { [`k${i}`]: 1 } });
    const { editor } = shown({ files });
    const r = row(editor(), "owner");
    expect([r.datalist.id, r.key.getAttribute("list"), r.key.getAttribute("autocomplete")]).toEqual(["cad-key-dl-project-3", "cad-key-dl-project-3", "off"]);
    const values = optionValues(r.datalist);
    const fieldKeys = [...new Set(Object.values(ENTITIES).flatMap((e: Any) => e.fields.map((f: Any) => f.key)))];
    expect(values.slice(0, fieldKeys.length)).toEqual(fieldKeys);
    expect(values.slice(fieldKeys.length)).toEqual(["budget", ...Array.from({ length: 198 }, (_, i) => `k${i}`)]);
  });

  it("filters and sorts the suggestions as the user types", () => {
    addVendor([{ key: "region", label: "Region" }]);
    const { editor } = shown({ entity: "crm_vendor" });
    const r = row(editor(), "region");
    r.key.value = " CO ";
    r.key.trigger("input");
    expect(optionValues(r.datalist)).toEqual(["company", "contact", "lastContact"]);
    r.key.value = "";
    r.key.trigger("input");
    expect(optionValues(r.datalist)[0]).toBe("active");
  });

  it("refuses an empty or duplicate key with a notice and restores the input", async () => {
    addVendor([{ key: "region", label: "Region" }, { key: "notes", label: "Notes" }]);
    const { editor, calls } = shown({ entity: "crm_vendor" });
    const r = row(editor(), "region");
    r.key.value = "!!";
    r.key.trigger("change");
    await Promise.resolve();
    expect(r.key.value).toBe("region");
    r.key.value = "Notes";
    r.key.trigger("change");
    await Promise.resolve();
    expect(r.key.value).toBe("region");
    expect(Notice.messages).toEqual(["Technical key cannot be empty and must be alphanumeric.", "This technical key is already in use."]);
    expect(calls).toEqual([]);
  });

  it("renames the key (lower-cased, stripped to a-z0-9_), migrates the entity's notes, saves and redraws", async () => {
    addVendor([{ key: "notes", label: "Notes", type: "text" }]);
    const files = [
      { path: "Cadence/Vendors/Acme.md", frontmatter: { notes: "hi" } },
      { path: "Cadence/Vendors/Beta.md", frontmatter: { other: 1 } },
    ];
    const made = shown({ files, entity: "crm_vendor" });
    const r = row(made.editor(), "notes");
    r.key.value = "Remarks-2!";
    r.key.trigger("change");
    await vi.waitFor(() => expect(made.calls).toEqual(["save", "register", "refresh"]));
    expect(ENTITIES.crm_vendor.fields[2]).toEqual({ key: "remarks2", label: "Notes", type: "text", locked: false });
    const fm = (path: string) => made.app.metadataCache.getFileCache(made.app.vault.getAbstractFileByPath(path) as Any)?.frontmatter;
    expect(fm("Cadence/Vendors/Acme.md")).toEqual({ remarks2: "hi" });
    expect(fm("Cadence/Vendors/Beta.md")).toEqual({ other: 1 });
    expect(Notice.messages).toEqual(['Renamed frontmatter key "notes" to "remarks2" in 1 files.']);
    expect(row(made.editor(), "remarks2").label.value).toBe("Notes");
  });

  it("renaming to a key another entity uses keeps this field's own label, type, options and source, with no link notice", async () => {
    addVendor([{ key: "grade", label: "Grade", type: "text", options: ["x"], suggestionSource: "none" }]);
    const partnerTier = structuredClone(ENTITIES.partner.fields[1]);
    const { editor, calls } = shown({ entity: "crm_vendor" });
    const r = row(editor(), "grade");
    r.key.value = "tier";
    r.key.trigger("change");
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(ENTITIES.crm_vendor.fields[2]).toEqual({ key: "tier", label: "Grade", type: "text", options: ["x"], suggestionSource: "none", locked: false });
    expect(ENTITIES.partner.fields[1]).toEqual(partnerTier);
    expect(Notice.messages).toEqual([]);
  });

  it("renames the key in this entity only: other entities keep theirs, and their notes are not migrated", async () => {
    addVendor([{ key: "region", label: "Region" }]);
    const files = [
      { path: "Cadence/Vendors/V.md", frontmatter: { region: "EU" } },
      { path: "Cadence/Partners/P.md", frontmatter: { region: "US" } },
    ];
    const made = shown({ files, entity: "crm_vendor" });
    const r = row(made.editor(), "region");
    r.key.value = "zone";
    r.key.trigger("change");
    await vi.waitFor(() => expect(made.calls).toHaveLength(3));
    expect(ENTITIES.crm_vendor.fields.map((f: Any) => f.key)).toEqual(["name", "type", "zone"]);
    expect(ENTITIES.partner.fields.map((f: Any) => f.key)).toEqual(["name", "tier", "status", "owner", "region"]);
    const fm = (path: string) => made.app.metadataCache.getFileCache(made.app.vault.getAbstractFileByPath(path) as Any)?.frontmatter;
    expect([fm("Cadence/Vendors/V.md"), fm("Cadence/Partners/P.md")]).toEqual([{ zone: "EU" }, { region: "US" }]);
    expect(Notice.messages).toEqual(['Renamed frontmatter key "region" to "zone" in 1 files.']);
  });

  it("re-entering the field's own key in another case keeps the field as it is", async () => {
    addVendor([{ key: "region", label: "Territory", type: "multitext" }]);
    const { editor, calls } = shown({ entity: "crm_vendor" });
    const r = row(editor(), "region");
    r.key.value = "REGION";
    r.key.trigger("change");
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(ENTITIES.crm_vendor.fields[2]).toEqual({ key: "region", label: "Territory", type: "multitext", locked: false });
    expect(Notice.messages).toEqual([]);
  });
});

describe("Custom Entity Properties: type", () => {
  it("offers seven types, or only Text and Select for a `type` field, selecting the field's type (default Text)", () => {
    addVendor([{ key: "region", label: "Region" }, { key: "fee", label: "Fee", type: "currency" }]);
    const { editor } = shown({ entity: "crm_vendor" });
    const r = row(editor(), "region");
    expect(r.type.classes).toEqual(["cad-prop-input"]);
    expect(optionValues(r.type)).toEqual(["text", "multitext", "date", "number", "currency", "tags", "enum"]);
    expect(optionTexts(r.type)).toEqual(["Text", "List / Multiple Links", "Date", "Number", "Currency", "Tags", "Select (Enum)"]);
    expect(r.type.value).toBe("text");
    expect(row(editor(), "fee").type.value).toBe("currency");
    const t = row(editor(), "type");
    expect(optionValues(t.type)).toEqual(["text", "enum"]);
    expect(optionTexts(t.type)).toEqual(["Text", "Select (Enum)"]);
  });

  it("changes the type, migrating only this entity's notes, then redraws", async () => {
    addVendor([{ key: "region", label: "Region" }]);
    const files = [
      { path: "Cadence/Vendors/V.md", frontmatter: { region: "EU, APAC" } },
      { path: "Cadence/Partners/P.md", frontmatter: { region: "US" } },
    ];
    const made = shown({ files, entity: "crm_vendor" });
    const r = row(made.editor(), "region");
    r.type.value = "multitext";
    r.type.trigger("change");
    await vi.waitFor(() => expect(made.calls).toEqual(["save", "register", "refresh"]));
    expect(ENTITIES.crm_vendor.fields[2].type).toBe("multitext");
    expect(ENTITIES.partner.fields[4]).toEqual({ key: "region", label: "Region" });
    const fm = (path: string) => made.app.metadataCache.getFileCache(made.app.vault.getAbstractFileByPath(path) as Any)?.frontmatter;
    expect([fm("Cadence/Vendors/V.md"), fm("Cadence/Partners/P.md")]).toEqual([{ region: ["EU", "APAC"] }, { region: "US" }]);
    expect(Notice.messages).toEqual(['Migrated 1 files for field "region" to type "multitext".']);
    expect(row(made.editor(), "region").type.value).toBe("multitext");
  });

  it("other entities' same-key fields keep their type, and their notes are not migrated", async () => {
    addVendor([{ key: "steps", label: "Steps", type: "text" }]);
    const files = [{ path: "Cadence/Sequences/S.md", frontmatter: { steps: "3 steps" } }];
    const made = shown({ files, entity: "crm_vendor" });
    const r = row(made.editor(), "steps");
    r.type.value = "date";
    r.type.trigger("change");
    await vi.waitFor(() => expect(made.calls).toHaveLength(3));
    expect(ENTITIES.crm_vendor.fields[2].type).toBe("date");
    expect(ENTITIES.sequence.fields[2]).toEqual({ key: "steps", label: "Steps", type: "number" });
    const fm = made.app.metadataCache.getFileCache(made.app.vault.getAbstractFileByPath("Cadence/Sequences/S.md") as Any)?.frontmatter;
    expect(fm).toEqual({ steps: "3 steps" });
    expect(Notice.messages).toEqual([]);
  });

  it("changes an unlocked `type` field without touching other entities' type fields", async () => {
    const vendor = addVendor();
    (vendor.fields[1] as Any).locked = false;
    const { editor, calls } = shown({ entity: "crm_vendor" });
    const r = row(editor(), "type");
    r.type.value = "enum";
    r.type.trigger("change");
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(ENTITIES.crm_vendor.fields[1].type).toBe("enum");
    expect(ENTITIES.activity.fields[1].type).toBe("enum");
    expect(ENTITIES.activity.fields[1].options).toEqual(["Call", "Email", "Meeting", "Note", "Task"]);
  });
});

describe("Custom Entity Properties: options and source", () => {
  function cell(editor: FakeElement, key: string) {
    const r = row(editor, key);
    return r.options;
  }

  it("greys out options for primary, date and currency fields, and for text and number", () => {
    addVendor([{ key: "when", label: "When", type: "date" }, { key: "fee", label: "Fee", type: "currency" }, { key: "n", label: "N", type: "number" }, { key: "t", label: "T" }]);
    const { editor } = shown({ entity: "crm_vendor" });
    for (const key of ["name", "when", "fee", "n", "t", "type"]) {
      const input = cell(editor(), key).children[0];
      expect([key, input.localName, input.disabled, input.placeholder, input.classes]).toEqual([key, "input", true, "—", ["cad-prop-input"]]);
    }
  });

  it("edits enum options as a comma list, saving without a redraw", async () => {
    addVendor([{ key: "grade", label: "Grade", type: "enum", options: ["A", "B"] }, { key: "level", label: "Level", type: "enum" }]);
    const { editor, calls } = shown({ entity: "crm_vendor" });
    expect(cell(editor(), "level").children[0].value).toBe("");
    const input = cell(editor(), "grade").children[0];
    expect([input.value, input.placeholder]).toEqual(["A, B", "Option A, Option B..."]);
    input.value = " Gold ,, Silver,";
    input.trigger("change");
    await vi.waitFor(() => expect(calls).toEqual(["save", "register", "refresh"]));
    expect(ENTITIES.crm_vendor.fields[2].options).toEqual(["Gold", "Silver"]);
  });

  it("lets a permanently locked enum's options be edited", async () => {
    const { editor, calls } = shown();
    const input = cell(editor(), "status").children[0];
    expect(input.disabled).toBe(false);
    input.value = "open, closed";
    input.trigger("change");
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(ENTITIES.project.fields[1].options).toEqual(["open", "closed"]);
  });

  it("offers suggestion sources for list and tag fields, selecting the field's source", () => {
    addVendor([
      { key: "labels", label: "Labels", type: "tags" },
      { key: "refs", label: "Refs", type: "multitext", suggestionSource: "none" },
      { key: "hist", label: "Hist", type: "multitext" },
    ]);
    const { editor } = shown({ entity: "crm_vendor" });
    const select = (key: string) => cell(editor(), key).findAll("select")[0];
    expect(cell(editor(), "labels").children[0].classes).toEqual(["cad-source-wrap"]);
    expect(optionValues(select("labels"))).toEqual(["history", "tags", "none", "folder"]);
    expect(optionTexts(select("labels"))).toEqual(["History / Shared", "Obsidian Tags", "None", "Folder…"]);
    expect([select("labels").value, select("refs").value, select("hist").value]).toEqual(["tags", "none", "history"]);
    const wrap = cell(editor(), "labels").findAll("div")[1];
    expect([wrap.classes, wrap.style.display]).toEqual([["cad-folder-picker-wrap"], "none"]);
  });

  it("QUIRK: a derived source that is not an option (owner → contact) leaves the select on its first option", () => {
    addVendor([{ key: "owner", label: "Owner", type: "multitext" }]);
    const { editor } = shown({ entity: "crm_vendor" });
    expect(cell(editor(), "owner").findAll("select")[0].value).toBe("history");
  });

  it("shows the folder picker with the folder path for a folder: source", () => {
    addVendor([{ key: "refs", label: "Refs", type: "multitext", suggestionSource: "folder:Cadence/Contacts" }, { key: "x", label: "X", type: "tags" }]);
    const { editor } = shown({ entity: "crm_vendor" });
    const c = cell(editor(), "refs");
    expect(c.findAll("select")[0].value).toBe("folder");
    const wrap = c.findAll("div")[1];
    expect(wrap.style).toMatchObject({ display: "flex", marginTop: "4px", alignItems: "center", gap: "6px" });
    const [badge, button] = wrap.children;
    expect([badge.classes, badge.text, badge.style.color, badge.style.fontFamily]).toEqual([["cad-folder-badge"], "Cadence/Contacts", "var(--text-normal)", "var(--font-monospace)"]);
    expect([button.text, button.classes, button.type]).toEqual(["📂 Choisir", ["cad-btn", "cad-btn-sm", "cad-folder-pick-btn"], "button"]);
    const empty = cell(editor(), "x").findAll("span")[0];
    expect([empty.text, empty.style.color]).toEqual(["Aucun dossier", "var(--text-faint)"]);
  });

  it("shows the picker, with no folder, for a bare `folder` source", () => {
    addVendor([{ key: "refs", label: "Refs", type: "multitext", suggestionSource: "folder" }]);
    const { editor } = shown({ entity: "crm_vendor" });
    const c = cell(editor(), "refs");
    expect(c.findAll("select")[0].value).toBe("folder");
    const wrap = c.findAll("div")[1];
    expect([wrap.style.display, wrap.children[0].text]).toEqual(["flex", "Aucun dossier"]);
  });

  it("switching to a fixed source hides the picker and saves it; switching to Folder… only shows it", async () => {
    addVendor([{ key: "refs", label: "Refs", type: "multitext", suggestionSource: "folder:Cadence/Contacts" }]);
    const { editor, calls } = shown({ entity: "crm_vendor" });
    const c = cell(editor(), "refs");
    const select = c.findAll("select")[0];
    const wrap = c.findAll("div")[1];
    select.value = "tags";
    select.trigger("change");
    await vi.waitFor(() => expect(calls).toEqual(["save", "register", "refresh"]));
    expect(wrap.style.display).toBe("none");
    expect(wrap.children[0].text).toBe("Aucun dossier");
    expect(ENTITIES.crm_vendor.fields[2].suggestionSource).toBe("tags");
    select.value = "folder";
    select.trigger("change");
    await Promise.resolve();
    expect(wrap.style.display).toBe("flex");
    expect(calls).toHaveLength(3);
  });

  it("opens a folder picker over the notes' folders and saves the chosen folder", async () => {
    addVendor([{ key: "refs", label: "Refs", type: "multitext" }]);
    const files = [{ path: "Cadence/Contacts/A.md" }, { path: "Areas/Home/B.md" }, { path: "root.md" }, { path: "Cadence/x.pdf" }];
    const { editor, calls } = shown({ files, entity: "crm_vendor" });
    const c = cell(editor(), "refs");
    buttonByText(c, "📂 Choisir").trigger("click");
    expect(opened).toHaveLength(1);
    expect(placeholders).toEqual(["Rechercher un dossier du vault…"]);
    const picker = opened[0];
    expect(picker.getSuggestions("")).toEqual(["Areas", "Areas/Home", "Cadence", "Cadence/Contacts"]);
    expect(picker.getSuggestions("CON")).toEqual(["Cadence/Contacts"]);
    const el = c.createDiv();
    picker.renderSuggestion("Areas/Home", el);
    expect(el.children.map((s: FakeElement) => [s.localName, s.text])).toEqual([["span", "📁 "], ["span", "Areas/Home"]]);
    picker.onChooseSuggestion("Areas/Home");
    await vi.waitFor(() => expect(calls).toEqual(["save", "register", "refresh"]));
    expect(ENTITIES.crm_vendor.fields[2].suggestionSource).toBe("folder:Areas/Home");
    const badge = c.findAll("span")[0];
    expect([badge.text, badge.style.color]).toEqual(["Areas/Home", "var(--text-normal)"]);
  });

  it("uses vault.getAllFolders when it lists folders, as paths or folder objects", () => {
    addVendor([{ key: "refs", label: "Refs", type: "tags" }]);
    const made = makeSettingTab({ files: [{ path: "Ignored/A.md" }] });
    (made.app.vault as Any).getAllFolders = () => ["Zed", { path: "Alpha" }, { path: "" }, { name: "nopath" }];
    made.tab.display();
    void component<DropdownComponent>(settingByName(made.container, "Select entity")).change("crm_vendor");
    buttonByText(editorOf(made.container), "📂 Choisir").trigger("click");
    expect(opened[0].getSuggestions("")).toEqual(["Alpha", "Zed"]);
  });

  it("saves a chosen source on this field only, leaving other entities' fields with the same key alone", async () => {
    addVendor([{ key: "owner", label: "Owner", type: "multitext" }]);
    const dealOwner = structuredClone(ENTITIES.deal.fields.find((f: Any) => f.key === "owner"));
    const { editor, calls } = shown({ entity: "crm_vendor" });
    const select = cell(editor(), "owner").findAll("select")[0];
    select.value = "none";
    select.trigger("change");
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(ENTITIES.crm_vendor.fields[2].suggestionSource).toBe("none");
    expect(ENTITIES.deal.fields.find((f: Any) => f.key === "owner")).toEqual(dealOwner);
  });

  it("editing the partner's status options leaves the project's status options alone", async () => {
    const projectStatus = structuredClone(ENTITIES.project.fields[1]);
    const { editor, calls } = shown({ entity: "partner" });
    const input = cell(editor(), "status").children[0];
    input.value = "Prospect, Signed";
    input.trigger("change");
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(ENTITIES.partner.fields.find((f: Any) => f.key === "status")!.options).toEqual(["Prospect", "Signed"]);
    expect(ENTITIES.project.fields[1]).toEqual(projectStatus);
  });
});

describe("Custom Entity Properties: delete, add and reorder", () => {
  it("deletes an unlocked field, saves and redraws", async () => {
    addVendor([{ key: "a", label: "A" }, { key: "b", label: "B" }]);
    const { editor, calls } = shown({ entity: "crm_vendor" });
    const del = row(editor(), "a").del;
    expect([del.text, del.classes]).toEqual(["×", ["cad-prop-btn-delete"]]);
    del.trigger("click");
    await vi.waitFor(() => expect(calls).toEqual(["save", "register", "refresh"]));
    expect(ENTITIES.crm_vendor.fields.map((f: Any) => f.key)).toEqual(["name", "type", "b"]);
    expect(propRows(editor())).toHaveLength(3);
  });

  it("adds new_property_N with the first free N, saves and redraws", async () => {
    addVendor([{ key: "new_property_1", label: "X" }, { key: "new_property_3", label: "Y" }]);
    const { editor, calls, plugin } = shown({ entity: "crm_vendor" });
    buttonByText(editor(), "+ Add property").trigger("click");
    await vi.waitFor(() => expect(calls).toEqual(["save", "register", "refresh"]));
    expect(plugin.saved[0].customEntities.crm_vendor[4]).toEqual({ key: "new_property_2", label: "New Property", type: "text" });
    buttonByText(editor(), "+ Add property").trigger("click");
    await vi.waitFor(() => expect(calls).toHaveLength(6));
    // The redraw after each add marks the new field unlocked.
    expect(ENTITIES.crm_vendor.fields.slice(4)).toEqual([
      { key: "new_property_2", label: "New Property", type: "text", locked: false },
      { key: "new_property_4", label: "New Property", type: "text", locked: false },
    ]);
    expect(propRows(editor())).toHaveLength(6);
  });

  it("drags an unlocked row onto another: highlights, reorders into a new array, saves and redraws", async () => {
    addVendor([{ key: "a", label: "A" }, { key: "b", label: "B" }, { key: "c", label: "C" }]);
    const { editor, calls } = shown({ entity: "crm_vendor" });
    const before = ENTITIES.crm_vendor.fields;
    const [c, a] = [row(editor(), "c").tr, row(editor(), "a").tr];
    const start = dt();
    c.trigger("dragstart", start);
    expect(c.classes).toContain("cad-drag-active");
    expect(start.dataTransfer.setData).toHaveBeenCalledWith("text/plain", "4");
    expect(start.dataTransfer.effectAllowed).toBe("move");
    expect(c.trigger("dragover").defaultPrevented).toBe(false);
    const over = a.trigger("dragover");
    expect(over.defaultPrevented).toBe(true);
    expect(a.classes).toContain("cad-drag-hover");
    a.trigger("dragleave");
    expect(a.classes).not.toContain("cad-drag-hover");
    a.trigger("dragover");
    const drop = a.trigger("drop");
    expect(drop.defaultPrevented).toBe(true);
    expect(a.classes).not.toContain("cad-drag-hover");
    await vi.waitFor(() => expect(calls).toEqual(["save", "register", "refresh"]));
    expect(ENTITIES.crm_vendor.fields.map((f: Any) => f.key)).toEqual(["name", "type", "c", "a", "b"]);
    expect(ENTITIES.crm_vendor.fields).not.toBe(before);
  });

  it("refuses a drop that would move a locked row, with a notice", async () => {
    addVendor([{ key: "a", label: "A" }, { key: "b", label: "B" }]);
    const { editor, calls } = shown({ entity: "crm_vendor" });
    row(editor(), "b").tr.trigger("dragstart", dt());
    row(editor(), "type").tr.trigger("drop");
    await Promise.resolve();
    expect(Notice.messages).toEqual(["Impossible de réordonner : les propriétés verrouillées (🔒) doivent conserver leur position initiale."]);
    expect(calls).toEqual([]);
    expect(ENTITIES.crm_vendor.fields.map((f: Any) => f.key)).toEqual(["name", "type", "a", "b"]);
  });

  it("ignores a drop with no drag in progress, or onto the dragged row, and dragend clears the highlight", async () => {
    addVendor([{ key: "a", label: "A" }, { key: "b", label: "B" }]);
    const { editor, calls } = shown({ entity: "crm_vendor" });
    const [a, b] = [row(editor(), "a").tr, row(editor(), "b").tr];
    expect(b.trigger("drop").defaultPrevented).toBe(false);
    a.trigger("dragstart", dt());
    b.trigger("dragover");
    expect(a.trigger("drop").defaultPrevented).toBe(false);
    a.trigger("dragend");
    expect([a.classes.includes("cad-drag-active"), b.classes.includes("cad-drag-hover")]).toEqual([false, false]);
    expect(b.trigger("drop").defaultPrevented).toBe(false);
    await Promise.resolve();
    expect(calls).toEqual([]);
  });

  it("lets locked rows be drop targets but not drag sources", () => {
    const { editor } = shown();
    const owner = row(editor(), "owner").tr;
    expect(owner.getAttribute("draggable")).toBeNull();
    expect(owner.trigger("dragover").defaultPrevented).toBe(false);
  });
});
