import { describe, expect, it, vi } from "vitest";
import { createMockApp, SuggestModal, TFile } from "../mocks/obsidian";
import {
  applyPropertyEdit,
  copyPropertyShape,
  entityPickerLabel,
  entityPickerOptions,
  fieldKeySuggestions,
  fieldTypeOptions,
  filterFolders,
  filterKeySuggestions,
  folderBadge,
  folderSource,
  FolderSuggestModal,
  isFieldLocked,
  isPermanentlyLocked,
  moveField,
  nextPropertyKey,
  optionsCellKind,
  parseEnumOptions,
  sanitizeFieldKey,
  snapshotCustomEntities,
  sourceState,
  syncSharedProperties,
  vaultFolderPaths,
} from "../../src/settings/entity-properties";
import type { EntityDef, EntityField } from "../../src/types/entities";
import type { SettingTabSettings } from "../../src/types/settings";

/* Direct tests for the property-editor seams over a plain registry: locks,
   syncing, the key/type/label/options/source/lock/remove/add/move edits
   and the migrations they return, the cell helpers, and the named folder
   picker. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const ent = (label: string, fields: EntityField[]): EntityDef => ({ folder: `F/${label}`, label, plural: `${label}s`, fields, columns: [] });

function registry() {
  return {
    vendor: ent("Vendor", [
      { key: "name", label: "Name", primary: true, type: "text" },
      { key: "type", label: "Type", type: "text" },
      { key: "region", label: "Region" },
      { key: "notes", label: "Notes", type: "text", locked: false },
    ]),
    partner: ent("Partner", [
      { key: "name", label: "Name", primary: true },
      { key: "region", label: "Area", type: "multitext", options: ["x"], suggestionSource: "history" },
      { key: "type", label: "Kind", type: "enum", options: ["A"] },
    ]),
    deal: ent("Deal", [
      { key: "title", label: "Title", primary: true },
      { key: "stage", label: "Stage", type: "enum" },
      { key: "region", label: "Region" },
    ]),
  } as Record<string, EntityDef>;
}

const settings = () => ({ dailyNoteFolder: "", tasksHeading: "", journalHeading: "", cadenceApiUrl: "", cadenceApiToken: "" }) as SettingTabSettings;

describe("entity picker", () => {
  it("prefixes core entities with their section, custom ones with their page's section, else the bare label", () => {
    const pages = [{ id: "1", label: "V", sectionId: "prm", entityKey: "vendor" }, { id: "2", label: "Q", sectionId: "inbox", entityKey: "q" }];
    expect(entityPickerLabel("deal", ent("Deal", []), pages)).toBe("CRM/Deal");
    expect(entityPickerLabel("vendor", ent("Vendor", []), pages)).toBe("PRM/Vendor");
    expect(entityPickerLabel("q", ent("Que", []), pages)).toBe("Inbox/Que");
    expect(entityPickerLabel("loose", ent("Loose", []), pages)).toBe("Loose");
  });

  it("sorts the options by label", () => {
    expect(entityPickerOptions(registry(), [])).toEqual([
      { value: "deal", label: "CRM/Deal" },
      { value: "partner", label: "PRM/Partner" },
      { value: "vendor", label: "Vendor" },
    ]);
  });
});

describe("locks", () => {
  it("locks primary fields, project status/priority and deal stage for good", () => {
    expect(isPermanentlyLocked("vendor", { key: "x", label: "", primary: true })).toBe(true);
    expect(["status", "priority", "owner"].map((key) => isPermanentlyLocked("project", { key, label: "" }))).toEqual([true, true, false]);
    expect(["stage", "status"].map((key) => isPermanentlyLocked("deal", { key, label: "" }))).toEqual([true, false]);
    expect(isPermanentlyLocked("vendor", { key: "status", label: "" })).toBe(false);
  });

  it("defaults the locked flag in place: type and core fields locked, custom fields not; an explicit flag wins", () => {
    const fields: EntityField[] = [{ key: "type", label: "" }, { key: "x", label: "" }, { key: "y", label: "", locked: true }];
    expect(fields.map((f) => isFieldLocked("vendor", f))).toEqual([true, false, true]);
    expect(fields.map((f) => f.locked)).toEqual([true, false, true]);
    const core: EntityField = { key: "email", label: "" };
    expect(isFieldLocked("contact", core)).toBe(true);
    expect(core.locked).toBe(true);
    const primary: EntityField = { key: "name", label: "", primary: true };
    expect(isFieldLocked("vendor", primary)).toBe(true);
    expect(primary.locked).toBeUndefined();
  });
});

describe("snapshot and sync", () => {
  it("copies every entity's fields deeply into customEntities", () => {
    const s = settings();
    const r = registry();
    snapshotCustomEntities(s, r);
    expect(Object.keys(s.customEntities!)).toEqual(["vendor", "partner", "deal"]);
    expect(s.customEntities!.partner).toEqual(r.partner.fields);
    expect(s.customEntities!.partner[1]).not.toBe(r.partner.fields[1]);
    expect(s.customEntities!.partner[1].options).not.toBe(r.partner.fields[1].options);
  });

  it("copies label, type, options and source, deleting what the source lacks", () => {
    const target: EntityField = { key: "a", label: "Old", type: "enum", options: ["o"], suggestionSource: "tags", locked: true };
    copyPropertyShape(target, { key: "b", label: "New" });
    expect(target).toEqual({ key: "a", label: "New", type: undefined, locked: true });
    const options = ["p"];
    copyPropertyShape(target, { key: "b", label: "L", type: "enum", options, suggestionSource: "none" });
    expect(target).toMatchObject({ type: "enum", options: ["p"], suggestionSource: "none" });
    expect(target.options).not.toBe(options);
  });

  it("syncs every other same-key field but never a type field", () => {
    const r = registry();
    syncSharedProperties(r, r.vendor.fields[2]);
    expect(r.partner.fields[1]).toEqual({ key: "region", label: "Region", type: undefined });
    expect(r.deal.fields[2]).toEqual({ key: "region", label: "Region", type: undefined });
    syncSharedProperties(r, r.vendor.fields[1]);
    expect(r.partner.fields[2].label).toBe("Kind");
  });
});

describe("key suggestions and cell helpers", () => {
  it("collects field keys, then frontmatter keys except position, deduplicated in first-seen order", () => {
    const keys = fieldKeySuggestions(registry(), [{ zeta: 1, position: {}, region: 2 }, { alpha: 1 }]);
    expect([...keys]).toEqual(["name", "type", "region", "notes", "title", "stage", "zeta", "alpha"]);
  });

  it("filters suggestions by the trimmed typed text, any case, sorted", () => {
    expect(filterKeySuggestions(["Beta", "alpha", "gamma"], "  A ")).toEqual(["Beta", "alpha", "gamma"]);
    expect(filterKeySuggestions(new Set(["Beta", "alpha", "gamma"]), "ph")).toEqual(["alpha"]);
    expect(filterKeySuggestions(["b", "a"], "")).toEqual(["a", "b"]);
  });

  it("sanitizes keys and parses enum lists", () => {
    expect(["  Due Date ", "a-b_c9!", "!!", "ÉTÉ"].map(sanitizeFieldKey)).toEqual(["duedate", "ab_c9", "", "t"]);
    expect(parseEnumOptions(" a ,, b,")).toEqual(["a", "b"]);
    expect(parseEnumOptions("")).toEqual([]);
  });

  it("offers type options with the field's type selected (Text by default; none for an unoffered type)", () => {
    const selected = (field: EntityField) => fieldTypeOptions(field).filter((t) => t.selected).map((t) => t.value);
    expect(fieldTypeOptions({ key: "x", label: "" }).map((t) => t.value)).toEqual(["text", "multitext", "date", "number", "currency", "tags", "enum"]);
    expect(fieldTypeOptions({ key: "type", label: "" }).map((t) => t.value)).toEqual(["text", "enum"]);
    expect(selected({ key: "x", label: "" })).toEqual(["text"]);
    expect(selected({ key: "x", label: "", type: "tags" })).toEqual(["tags"]);
    expect(selected({ key: "x", label: "", type: "email" })).toEqual([]);
    expect(selected({ key: "type", label: "", type: "multitext" })).toEqual([]);
  });

  it("picks the options cell kind", () => {
    const kind = (f: Partial<EntityField>) => optionsCellKind({ key: "x", label: "", ...f });
    expect([kind({ primary: true, type: "enum" }), kind({ type: "date" }), kind({ type: "currency" }), kind({ type: "enum" }), kind({ type: "multitext" }), kind({ type: "tags" }), kind({ type: "number" }), kind({})]).toEqual([
      "none", "none", "none", "enum", "source", "source", "none", "none",
    ]);
  });

  it("derives the source state", () => {
    expect(sourceState({ key: "x", label: "", type: "multitext", suggestionSource: "folder:A/B" })).toEqual({ selected: "folder", isCustomFolder: true, folderPath: "A/B" });
    expect(sourceState({ key: "x", label: "", type: "tags" })).toEqual({ selected: "tags", isCustomFolder: false, folderPath: "" });
    expect(sourceState({ key: "x", label: "", type: "multitext", suggestionSource: "folder" })).toEqual({ selected: "folder", isCustomFolder: false, folderPath: "" });
    expect(sourceState({ key: "owner", label: "", type: "multitext" })).toEqual({ selected: null, isCustomFolder: false, folderPath: "" });
  });

  it("formats folder sources and badges", () => {
    expect([folderSource("A"), folderSource("")]).toEqual(["folder:A", "none"]);
    expect(folderBadge("A")).toEqual({ text: "A", color: "var(--text-normal)" });
    expect(folderBadge("")).toEqual({ text: "Aucun dossier", color: "var(--text-faint)" });
  });

  it("lists folders from getAllFolders, or from note paths only when it lists none", () => {
    const files = vi.fn(() => [new TFile("a/b/c.md"), new TFile("a/d.md"), new TFile("top.md")] as Any);
    expect(vaultFolderPaths(["z", { path: "y" } as Any, { path: "" } as Any], files)).toEqual(["y", "z"]);
    expect(files).not.toHaveBeenCalled();
    expect(vaultFolderPaths([], files)).toEqual(["a", "a/b"]);
    expect(vaultFolderPaths(undefined, files)).toEqual(["a", "a/b"]);
  });

  it("filters folders by case-insensitive substring", () => {
    expect(filterFolders(["Areas", "Cadence/Contacts"], "con")).toEqual(["Cadence/Contacts"]);
    const all = ["a"];
    expect(filterFolders(all, "")).toBe(all);
  });

  it("finds the next free new_property_N and moves fields only when locked ones stay put", () => {
    expect(nextPropertyKey([])).toBe("new_property_1");
    expect(nextPropertyKey([{ key: "new_property_1", label: "" }, { key: "new_property_2", label: "" }])).toBe("new_property_3");
    const fields: EntityField[] = ["a", "b", "c", "d"].map((key) => ({ key, label: "" }));
    const locked = (f: EntityField) => f.key === "a";
    expect(moveField(fields, 3, 1, locked)!.map((f) => f.key)).toEqual(["a", "d", "b", "c"]);
    expect(moveField(fields, 1, 0, locked)).toBeNull();
    expect(fields.map((f) => f.key)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("applyPropertyEdit", () => {
  it("relabels (blank → key) and syncs, without migrations or redraw", () => {
    const r = registry();
    expect(applyPropertyEdit(r, "vendor", { kind: "label", field: r.vendor.fields[2], value: " Zone " })).toEqual({ ok: true, migrations: [], rerender: false });
    expect(r.partner.fields[1].label).toBe("Zone");
    applyPropertyEdit(r, "vendor", { kind: "label", field: r.vendor.fields[2], value: "" });
    expect(r.vendor.fields[2].label).toBe("region");
  });

  it("sets enum options and sources, syncing them", () => {
    const r = registry();
    applyPropertyEdit(r, "vendor", { kind: "options", field: r.vendor.fields[2], value: "a, b" });
    expect(r.deal.fields[2].options).toEqual(["a", "b"]);
    applyPropertyEdit(r, "vendor", { kind: "source", field: r.vendor.fields[2], value: "folder:X" });
    expect(r.partner.fields[1].suggestionSource).toBe("folder:X");
  });

  it("locks and unlocks with a redraw", () => {
    const r = registry();
    expect(applyPropertyEdit(r, "vendor", { kind: "lock", field: r.vendor.fields[3], locked: true })).toEqual({ ok: true, migrations: [], rerender: true });
    expect(r.vendor.fields[3].locked).toBe(true);
  });

  it("refuses an empty or duplicate key without changing anything", () => {
    const r = registry();
    const before = structuredClone(r);
    expect(applyPropertyEdit(r, "vendor", { kind: "key", field: r.vendor.fields[3], index: 3, value: "--" })).toEqual({ ok: false, notice: "Technical key cannot be empty and must be alphanumeric." });
    expect(applyPropertyEdit(r, "vendor", { kind: "key", field: r.vendor.fields[3], index: 3, value: "Region" })).toEqual({ ok: false, notice: "This technical key is already in use." });
    expect(r).toEqual(before);
  });

  it("renames a key here and in every entity sharing it, returning their migrations in order, and links to the shared field", () => {
    const r = registry();
    const field = r.vendor.fields[2];
    const result = applyPropertyEdit(r, "vendor", { kind: "key", field, index: 2, value: "Zone" });
    expect(result).toEqual({
      ok: true,
      migrations: [
        { kind: "key", entityKey: "vendor", oldKey: "region", newKey: "zone" },
        { kind: "key", entityKey: "partner", oldKey: "region", newKey: "zone" },
        { kind: "key", entityKey: "deal", oldKey: "region", newKey: "zone" },
      ],
      notice: 'Linked key to existing property "zone".',
      rerender: true,
    });
    expect([field.key, r.partner.fields[1].key, r.deal.fields[2].key]).toEqual(["zone", "zone", "zone"]);
    expect(field).toEqual({ key: "zone", label: "Area", type: "multitext", options: ["x"], suggestionSource: "history" });
  });

  it("renames a key no other entity has, with one migration and no notice", () => {
    const r = registry();
    const field = r.vendor.fields[3];
    expect(applyPropertyEdit(r, "vendor", { kind: "key", field, index: 3, value: "remarks" })).toEqual({
      ok: true,
      migrations: [{ kind: "key", entityKey: "vendor", oldKey: "notes", newKey: "remarks" }],
      rerender: true,
    });
    expect(field.key).toBe("remarks");
  });

  it("changes a type here and in every entity sharing the key, migrating each from this field's old type", () => {
    const r = registry();
    const field = r.vendor.fields[2];
    expect(applyPropertyEdit(r, "vendor", { kind: "type", field, value: "date" })).toEqual({
      ok: true,
      migrations: [
        { kind: "type", entityKey: "vendor", fieldKey: "region", oldType: "text", newType: "date" },
        { kind: "type", entityKey: "partner", fieldKey: "region", oldType: "text", newType: "date" },
        { kind: "type", entityKey: "deal", fieldKey: "region", oldType: "text", newType: "date" },
      ],
      rerender: true,
    });
    expect([field.type, r.partner.fields[1].type, r.deal.fields[2].type]).toEqual(["date", "date", "date"]);
  });

  it("changes a type field's type alone", () => {
    const r = registry();
    const result = applyPropertyEdit(r, "vendor", { kind: "type", field: r.vendor.fields[1], value: "enum" });
    expect(result).toMatchObject({ migrations: [{ kind: "type", entityKey: "vendor", fieldKey: "type", oldType: "text", newType: "enum" }] });
    expect(r.partner.fields[2]).toEqual({ key: "type", label: "Kind", type: "enum", options: ["A"] });
  });

  it("removes, adds and moves fields", () => {
    const r = registry();
    applyPropertyEdit(r, "vendor", { kind: "remove", index: 2 });
    expect(r.vendor.fields.map((f) => f.key)).toEqual(["name", "type", "notes"]);
    expect(applyPropertyEdit(r, "vendor", { kind: "add" })).toEqual({ ok: true, migrations: [], rerender: true });
    expect(r.vendor.fields[3]).toEqual({ key: "new_property_1", label: "New Property", type: "text" });
    const before = r.vendor.fields;
    applyPropertyEdit(r, "vendor", { kind: "move", from: 3, to: 2 });
    expect(r.vendor.fields.map((f) => f.key)).toEqual(["name", "type", "new_property_1", "notes"]);
    expect(r.vendor.fields).not.toBe(before);
  });

  it("refuses a move that shifts a locked field", () => {
    const r = registry();
    expect(applyPropertyEdit(r, "vendor", { kind: "move", from: 3, to: 1 })).toEqual({
      ok: false,
      notice: "Impossible de réordonner : les propriétés verrouillées (🔒) doivent conserver leur position initiale.",
    });
    expect(r.vendor.fields.map((f) => f.key)).toEqual(["name", "type", "region", "notes"]);
  });
});

describe("FolderSuggestModal", () => {
  it("sets its placeholder, filters its folders, renders a folder and hands the choice back", () => {
    const placeholders: string[] = [];
    const spy = vi.spyOn(SuggestModal.prototype, "setPlaceholder").mockImplementation((text: string) => {
      placeholders.push(text);
    });
    const chosen: string[] = [];
    const modal = new FolderSuggestModal(createMockApp() as Any, ["Areas", "Cadence/Contacts"], (f) => chosen.push(f));
    expect(placeholders).toEqual(["Rechercher un dossier du vault…"]);
    expect(modal.getSuggestions("CAD")).toEqual(["Cadence/Contacts"]);
    expect(modal.getSuggestions("")).toEqual(["Areas", "Cadence/Contacts"]);
    const el = { spans: [] as string[], createEl(_tag: string, o: { text: string }) { this.spans.push(o.text); } };
    modal.renderSuggestion("Areas", el as Any);
    expect(el.spans).toEqual(["📁 ", "Areas"]);
    modal.onChooseSuggestion("Areas");
    expect(chosen).toEqual(["Areas"]);
    expect(modal).toBeInstanceOf(SuggestModal);
    spy.mockRestore();
  });
});
