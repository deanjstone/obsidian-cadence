import { describe, expect, it } from "vitest";
import { TFile, TFolder } from "../mocks/obsidian";
import { ENTITIES } from "../../src/constants/entities";
import {
  COMPANY_LIST_KEYS, DETAIL_LIST_KEYS, applyFieldEdit, chipAdd, chipConfig, chipCreation, chipLinkTarget, chipValues,
  chipWriteValue, coerceFieldEdit, dateInputValue, enumCurrent, filterSuggestions, findNoteByName, folderNoteNames,
  historyValues, isChipField,
} from "../../src/utils/field-edit";
import { detailControl, detailFields, entityDetailTitle } from "../../src/views/entity-detail";
import {
  companyDetailTitle, companyMetaControl, companyMetaFields, metaInputType, metaInputValue, splitSectionColumns,
} from "../../src/views/company-detail";
import type { EntityDef, EntityField, Frontmatter } from "../../src/types/entities";
import type { VaultNode } from "../../src/utils/vault";

/* Direct tests for the plain-data seams behind the entity detail form and
   the company detail page: src/utils/field-edit.ts (shared), plus the
   field, control and layout helpers in entity-detail.ts and
   company-detail.ts. */

const { contact, company, deal, activity, lead, sequence } = ENTITIES;
const field = (key: string, extra: Partial<EntityField> = {}): EntityField => ({ key, label: key, ...extra });

describe("coerceFieldEdit", () => {
  it("splits a tags string on commas, trimming and dropping empties; keeps a tags list", () => {
    expect(coerceFieldEdit(contact, "tags", " a, b ,,c ")).toEqual(["a", "b", "c"]);
    expect(coerceFieldEdit(contact, "tags", ["x"])).toEqual(["x"]);
    expect(coerceFieldEdit(contact, "tags", null)).toEqual([]);
  });

  it("turns number and currency input into a number, or null when not numeric", () => {
    expect(coerceFieldEdit(deal, "value", "12.5")).toBe(12.5);
    expect(coerceFieldEdit(sequence, "steps", "abc")).toBeNull();
    // QUIRK: an empty number becomes 0.
    expect(coerceFieldEdit(deal, "value", "")).toBe(0);
  });

  it("wraps stage in a one-item list, null when empty", () => {
    expect(coerceFieldEdit(deal, "stage", "Won")).toEqual(["Won"]);
    expect(coerceFieldEdit(deal, "stage", "")).toBeNull();
  });

  it("turns an empty string into null for other fields, and keeps everything else", () => {
    expect(coerceFieldEdit(contact, "name", "")).toBeNull();
    expect(coerceFieldEdit(contact, "name", "Ann")).toBe("Ann");
    expect(coerceFieldEdit(contact, "company", ["[[A]]"])).toEqual(["[[A]]"]);
  });

  it("writes a key with no field as-is, even an empty string", () => {
    expect(coerceFieldEdit(contact, "stage", "Won")).toBe("Won");
    expect(coerceFieldEdit(contact, "nope", "")).toBe("");
  });
});

describe("applyFieldEdit", () => {
  it("sets a value, including 0 and false", () => {
    const fm: Frontmatter = {};
    applyFieldEdit(fm, "a", "x");
    applyFieldEdit(fm, "b", 0);
    applyFieldEdit(fm, "c", false);
    applyFieldEdit(fm, "d", ["y"]);
    expect(fm).toEqual({ a: "x", b: 0, c: false, d: ["y"] });
  });

  it("deletes the key for null, undefined and an empty list", () => {
    const fm: Frontmatter = { a: 1, b: 2, c: 3, d: 4 };
    applyFieldEdit(fm, "a", null);
    applyFieldEdit(fm, "b", undefined);
    applyFieldEdit(fm, "c", []);
    expect(fm).toEqual({ d: 4 });
  });

  it("keeps an empty string", () => {
    const fm: Frontmatter = {};
    applyFieldEdit(fm, "a", "");
    expect(fm).toEqual({ a: "" });
  });
});

describe("dateInputValue and enumCurrent", () => {
  it("formats a parseable date as YYYY-MM-DD in UTC, else null", () => {
    expect(dateInputValue("2026-09-30")).toBe("2026-09-30");
    expect(dateInputValue("2026-11-30T23:30:00+10:00")).toBe("2026-11-30");
    expect(dateInputValue(new Date("2026-01-02T00:00:00Z"))).toBe("2026-01-02");
    expect(dateInputValue("soon")).toBeNull();
  });

  it("reads a list's first value, else the scalar, as a string", () => {
    expect(enumCurrent(["Won", "Lost"])).toBe("Won");
    expect(enumCurrent([])).toBe("");
    expect(enumCurrent("Lead")).toBe("Lead");
    expect(enumCurrent(null)).toBe("");
    expect(enumCurrent(0)).toBe("");
  });
});

describe("isChipField and chipConfig", () => {
  it("chips for tags, multitext and any suggestion source", () => {
    expect(isChipField(field("tags", { type: "tags" }))).toBe(true);
    expect(isChipField(field("notes", { type: "multitext", suggestionSource: "none" }))).toBe(true);
    expect(isChipField(field("company"))).toBe(true);
    expect(isChipField(field("size"))).toBe(false);
    expect(isChipField(field("phone"))).toBe(false);
  });

  it("an entity source targets that entity and links its chips", () => {
    expect(chipConfig(field("company"), ENTITIES, DETAIL_LIST_KEYS)).toEqual({
      suggestionSource: "company", isPlainChip: false, isList: false, targetEntityKey: "company", customFolderPath: null,
    });
  });

  it("tags, none and history sources are plain chips with no target", () => {
    expect(chipConfig(field("tags", { type: "tags" }), ENTITIES, COMPANY_LIST_KEYS)).toMatchObject({ isPlainChip: true, isList: true, targetEntityKey: null });
    expect(chipConfig(field("role"), ENTITIES, DETAIL_LIST_KEYS)).toMatchObject({ suggestionSource: "history", isPlainChip: true, isList: true });
    expect(chipConfig(field("x", { type: "multitext", suggestionSource: "none" }), ENTITIES, [])).toMatchObject({ isPlainChip: true, isList: true });
  });

  it("is a list by type, isList or the list keys; the two surfaces' keys differ on tags and assigned", () => {
    expect(chipConfig(field("assigned"), ENTITIES, DETAIL_LIST_KEYS).isList).toBe(true);
    expect(chipConfig(field("assigned"), ENTITIES, COMPANY_LIST_KEYS).isList).toBe(false);
    expect(chipConfig(field("tags", { suggestionSource: "contact" }), ENTITIES, DETAIL_LIST_KEYS).isList).toBe(true);
    expect(chipConfig(field("tags", { suggestionSource: "contact" }), ENTITIES, COMPANY_LIST_KEYS).isList).toBe(false);
    expect(chipConfig(field("contact"), ENTITIES, DETAIL_LIST_KEYS).isList).toBe(false);
    expect(chipConfig(field("company", { isList: true }), ENTITIES, []).isList).toBe(true);
  });

  it("a folder source keeps its path, and targets an entity whose folder it names", () => {
    expect(chipConfig(field("s", { suggestionSource: "folder:Cadence/Suppliers" }), ENTITIES, [])).toMatchObject({
      targetEntityKey: null, customFolderPath: "Cadence/Suppliers", isPlainChip: false,
    });
    expect(chipConfig(field("s", { suggestionSource: "folder:cadence/companies//" }), ENTITIES, [])).toMatchObject({
      targetEntityKey: "company", customFolderPath: "cadence/companies//",
    });
  });

  it("an entity: source is neither an entity nor a folder, so it has no target", () => {
    expect(chipConfig(field("s", { suggestionSource: "entity:company" }), ENTITIES, [])).toMatchObject({
      suggestionSource: "entity:company", isPlainChip: false, targetEntityKey: null, customFolderPath: null,
    });
  });
});

describe("chip values", () => {
  it("unwraps links unless plain, trims, and drops empties", () => {
    expect(chipValues(["[[A]]", " b ", "", "[[ ]]"], false)).toEqual(["A", "b"]);
    expect(chipValues(["[[A]]", " b "], true)).toEqual(["[[A]]", "b"]);
    expect(chipValues("[[Solo]]", false)).toEqual(["Solo"]);
    expect(chipValues("", false)).toEqual([]);
    expect(chipValues(null, true)).toEqual([]);
    expect(chipValues(0, true)).toEqual(["0"]);
  });

  it("writes plain values or links, as a list or the first value", () => {
    expect(chipWriteValue(["a", "b"], true, true)).toEqual(["a", "b"]);
    expect(chipWriteValue(["a", "b"], true, false)).toBe("a");
    expect(chipWriteValue([], true, false)).toBeNull();
    expect(chipWriteValue(["A", "B"], false, true)).toEqual(["[[A]]", "[[B]]"]);
    expect(chipWriteValue(["A"], false, false)).toBe("[[A]]");
    expect(chipWriteValue([], false, false)).toBeNull();
    expect(chipWriteValue([], false, true)).toEqual([]);
  });

  it("adds a trimmed value to a list, replaces a single value, and reports blanks and duplicates", () => {
    expect(chipAdd(["a"], " b ", true)).toEqual({ kind: "added", name: "b", values: ["a", "b"] });
    expect(chipAdd(["a"], "b", false)).toEqual({ kind: "added", name: "b", values: ["b"] });
    expect(chipAdd(["a"], "a", false)).toEqual({ kind: "added", name: "a", values: ["a"] });
    expect(chipAdd(["a"], " a ", true)).toEqual({ kind: "duplicate" });
    expect(chipAdd(["a"], "   ", true)).toEqual({ kind: "blank" });
  });

  it("does not modify the list it is given", () => {
    const values = ["a"];
    chipAdd(values, "b", true);
    expect(values).toEqual(["a"]);
  });
});

describe("chip suggestions", () => {
  it("collects a key's values across frontmatters, unwrapped and deduplicated, skipping empties", () => {
    expect(historyValues([
      { role: ["CTO", "[[Board]]", ""] }, { role: " CTO " }, { role: "" }, { role: null }, {}, { other: "x" }, { role: 0 },
    ], "role")).toEqual(["CTO", "Board", "0"]);
  });

  it("lists a folder's .md notes recursively, and nothing for a missing folder or a file", () => {
    const root = new TFolder("Suppliers");
    const sub = new TFolder("Suppliers/EU");
    sub.children.push(new TFile("Suppliers/EU/Nut.md"));
    root.children.push(new TFile("Suppliers/Bolt.md"), sub, new TFile("Suppliers/logo.png"), new TFile("Suppliers/Zed.md"));
    expect(folderNoteNames(root as unknown as VaultNode)).toEqual(["Bolt", "Nut", "Zed"]);
    expect(folderNoteNames(null)).toEqual([]);
    expect(folderNoteNames(new TFile("x.md") as unknown as VaultNode)).toEqual([]);
  });

  it("filters candidates by the query and drops the chips already chosen", () => {
    expect(filterSuggestions(["Globex", "globo", "Acme"], "glo", ["globo"])).toEqual(["Globex"]);
    expect(filterSuggestions(["A", "B"], "", ["B"])).toEqual(["A"]);
    // The caller lower-cases the query; an upper-case query matches nothing.
    expect(filterSuggestions(["Globex"], "GLO", [])).toEqual([]);
  });
});

describe("chip links and note creation", () => {
  const acme = new TFile("Cadence/Companies/Acme.md") as never;
  const other = new TFile("Elsewhere/ACME.md") as never;

  it("finds the first note with the name, any case", () => {
    expect(findNoteByName([acme, other], "acme")).toBe(acme);
    expect(findNoteByName([other, acme], "Acme")).toBe(other);
    expect(findNoteByName([acme], "Globex")).toBeUndefined();
  });

  it("opens the target entity's form, the note's own form, or the bare link", () => {
    expect(chipLinkTarget("company", acme, "Acme")).toEqual({ kind: "entity", entityKey: "company", file: acme });
    expect(chipLinkTarget(null, acme, "Acme")).toEqual({ kind: "file", file: acme });
    expect(chipLinkTarget("folder:x", acme, "Acme")).toEqual({ kind: "file", file: acme });
    expect(chipLinkTarget("company", undefined, "Acme")).toEqual({ kind: "link", linktext: "Acme" });
  });

  it("creates in the target entity, else the source, labelled by the entity or Note", () => {
    expect(chipCreation("contact", "contact", ENTITIES)).toEqual({ source: "contact", label: "Contact" });
    expect(chipCreation("folder:Cadence/Companies", "company", ENTITIES)).toEqual({ source: "company", label: "Company" });
    expect(chipCreation("folder:X", null, ENTITIES)).toEqual({ source: "folder:X", label: "Note" });
    expect(chipCreation("history", null, ENTITIES)).toEqual({ source: "folder:Cadence/Shared", label: "Note" });
  });
});

describe("entity detail seams", () => {
  it("titles with the primary value unless it is missing or empty", () => {
    expect(entityDetailTitle({ name: "Ann" }, "name", "file")).toBe("Ann");
    expect(entityDetailTitle({ name: 0 }, "name", "file")).toBe(0);
    expect(entityDetailTitle({ name: "" }, "name", "file")).toBe("file");
    expect(entityDetailTitle({}, "name", "file")).toBe("file");
  });

  it("renders every field except a non-enum type field", () => {
    expect(detailFields(activity).map((f) => f.key)).toEqual(["subject", "type", "when", "with", "company", "related"]);
    const def: EntityDef = { ...contact, fields: [field("name"), field("type"), field("x")] };
    expect(detailFields(def).map((f) => f.key)).toEqual(["name", "x"]);
  });

  it("picks the control by type, then chips, then text", () => {
    expect(contact.fields.map((f) => [f.key, detailControl(f)])).toEqual([
      ["name", "text"], ["email", "email"], ["phone", "text"], ["company", "chips"], ["role", "chips"],
      ["lastContact", "date"], ["tags", "chips"],
    ]);
    expect(deal.fields.map(detailControl)).toEqual(["text", "enum", "number", "chips", "chips", "chips", "date"]);
    expect(detailControl(field("owner", { type: "enum" }))).toBe("enum");
    expect(detailControl(field("n", { type: "number" }))).toBe("number");
    expect(lead.fields.map(detailControl)).toEqual(["text", "chips", "text", "enum", "chips"]);
  });
});

describe("company detail seams", () => {
  it("titles with a truthy name, else the basename", () => {
    expect(companyDetailTitle({ name: "Acme" }, "file")).toBe("Acme");
    expect(companyDetailTitle({ name: 0 }, "file")).toBe("file");
    expect(companyDetailTitle({}, "file")).toBe("file");
  });

  it("shows every non-primary field except a non-enum type field", () => {
    expect(companyMetaFields(company).map((f) => f.key)).toEqual(["domain", "industry", "size", "owner", "tags"]);
    const def: EntityDef = { ...company, fields: [field("name", { primary: true }), field("type"), field("type", { type: "enum" })] };
    expect(companyMetaFields(def).map((f) => f.type)).toEqual(["enum"]);
  });

  it("checks chips before enum", () => {
    expect(company.fields.map(companyMetaControl)).toEqual(["input", "chips", "chips", "input", "chips", "chips"]);
    expect(companyMetaControl(field("owner", { type: "enum" }))).toBe("chips");
    expect(companyMetaControl(field("stage", { type: "enum" }))).toBe("enum");
    expect(companyMetaControl(field("n", { type: "currency" }))).toBe("input");
  });

  it("maps input types", () => {
    expect(["date", "number", "currency", "text", "email", "x"].map(metaInputType)).toEqual([
      "date", "number", "number", "text", "text", "text",
    ]);
  });

  it("writes text or a number, null when empty or not numeric", () => {
    expect(metaInputValue("text", "Big")).toBe("Big");
    expect(metaInputValue("text", "")).toBeNull();
    expect(metaInputValue("date", "2026-01-01")).toBe("2026-01-01");
    expect(metaInputValue("number", "7")).toBe(7);
    expect(metaInputValue("currency", "x")).toBeNull();
    // QUIRK: an empty number writes 0.
    expect(metaInputValue("number", "")).toBe(0);
  });

  it("alternates sections between the columns", () => {
    expect(splitSectionColumns(["a", "b", "c", "d", "e"])).toEqual({ left: ["a", "c", "e"], right: ["b", "d"] });
    expect(splitSectionColumns([])).toEqual({ left: [], right: [] });
  });
});
