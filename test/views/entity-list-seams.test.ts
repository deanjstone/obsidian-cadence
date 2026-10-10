import { describe, expect, it } from "vitest";
import { ENTITIES } from "../../src/constants/entities";
import {
  cardLinkEntityKey, cardMetaRows, cardStatusField, filterEntities, filterOptions, filterableKeys, listColumns, listLayout,
  listSubtitle, nextSort, pillClass, pillText, primaryField, sortEntities, tableCell,
} from "../../src/views/entity-list";
import {
  distinctGroups, inKanbanGroup, kanbanCardLinks, kanbanColumnMeta, kanbanDropValue, kanbanGroupBy, kanbanGroupByFields,
  kanbanGroups, kanbanOptions, kanbanValueField, unwrapLink,
} from "../../src/views/kanban";
import { fmtValue } from "../../src/utils/format";
import type { Entity, EntityDef, EntityField } from "../../src/types/entities";
import type { TFile } from "obsidian";

/* Direct tests for the plain-data seams lifted out of renderEntityList and
   getEntityKanbanParams. No view, no vault: entities are plain objects. */

const entity = (basename: string, frontmatter: Record<string, unknown>): Entity =>
  ({ file: { path: `${basename}.md`, basename } as TFile, frontmatter, basename });
const keys = (fields: EntityField[]) => fields.map((f) => f.key);
const names = (list: Entity[]) => list.map((e) => e.basename);

const { contact, deal, partner, activity, company, certification, sequence } = ENTITIES;

describe("listLayout", () => {
  it.each([
    ["projects.projects", undefined, "cards"],
    ["crm.pipeline", undefined, "kanban"],
    ["crm.contacts", undefined, "table"],
    ["crm.pipeline", { "crm.pipeline": "table" }, "table"],
    ["custom-1", { "custom-1": "gallery" }, "gallery"],
    ["crm.contacts", { "crm.contacts": "" }, "table"],
  ])("%s with %j → %s", (mode, saved, layout) => {
    expect(listLayout(mode, saved)).toBe(layout);
  });
});

describe("listSubtitle", () => {
  it("counts with the singular label for one, the plural otherwise", () => {
    expect([0, 1, 2].map((n) => listSubtitle(n, deal))).toEqual([
      "0 deals in Cadence/Pipeline", "1 deal in Cadence/Pipeline", "2 deals in Cadence/Pipeline",
    ]);
  });
});

describe("filterableKeys and filterOptions", () => {
  it.each([
    ["contact", ["company", "role"]],
    ["partner", ["tier", "status"]],
    ["activity", ["type", "with", "company", "related"]],
    ["certification", []],
  ])("%s filters on %j", (key, expected) => {
    expect(filterableKeys(ENTITIES[key])).toEqual(expected);
  });

  it("lists distinct values per key, unwrapped and sorted, dropping keys with none (QUIRK: a padded link stays wrapped)", () => {
    const list = [
      entity("a", { company: ["[[Beta]]", "", "[[alpha]]"], role: "" }),
      entity("b", { company: " [[Beta]] " }),
      entity("c", { company: "Alpha" }),
    ];
    expect(filterOptions(list, contact).map((o) => [o.field.key, o.values])).toEqual([["company", ["Alpha", "Beta", "[[Beta]]", "alpha"]]]);
  });

  it("QUIRK: a registered entity with a type field but no type value filters on its own entity key", () => {
    const def: EntityDef = { ...company, fields: [...company.fields, { key: "type", label: "Type" }] };
    ENTITIES.vendor = def;
    try {
      expect(filterOptions([entity("a", {})], def).map((o) => [o.field.key, o.values])).toEqual([["type", ["vendor"]]]);
    } finally {
      delete ENTITIES.vendor;
    }
  });
});

describe("listColumns", () => {
  it("puts def.columns first, then the other fields", () => {
    expect(keys(listColumns(contact))).toEqual(["name", "company", "email", "phone", "role", "lastContact", "tags"]);
  });

  it("puts the given columns first, drops unknown keys, and still appends the rest", () => {
    expect(keys(listColumns(contact, ["role", "nope", "name"]))).toEqual(["role", "name", "email", "phone", "company", "lastContact", "tags"]);
  });

  it("keeps a repeated column", () => {
    expect(keys(listColumns(deal, ["title", "title"]))).toEqual(["title", "title", "stage", "value", "company", "contact", "owner", "closeBy"]);
  });
});

describe("filterEntities", () => {
  const cols = listColumns(contact);
  const list = [
    entity("jane", { name: "Jane", company: ["[[Acme]]"], role: ["CTO"] }),
    entity("bob", { name: "Bob", company: "[[Globex]]", role: "Sales" }),
    entity("zed", { company: "acme" }),
  ];

  it("keeps everything for an empty query", () => {
    expect(names(filterEntities(list, contact, cols, { search: "", filters: {} }))).toEqual(["jane", "bob", "zed"]);
  });

  it("matches the search in any column value or the basename", () => {
    expect(names(filterEntities(list, contact, cols, { search: "globex", filters: {} }))).toEqual(["bob"]);
    expect(names(filterEntities(list, contact, cols, { search: "ze", filters: {} }))).toEqual(["zed"]);
  });

  it("QUIRK: the search is not lower-cased here; callers pass it lower-cased", () => {
    expect(names(filterEntities(list, contact, cols, { search: "Jane", filters: {} }))).toEqual([]);
  });

  it("matches filters case-insensitively, through arrays and links; '' is no filter", () => {
    expect(names(filterEntities(list, contact, cols, { search: "", filters: { company: "ACME", role: "" } }))).toEqual(["jane", "zed"]);
    expect(names(filterEntities(list, contact, cols, { search: "", filters: { company: "acme", role: "cto" } }))).toEqual(["jane"]);
  });

  it("does not search fields outside the columns", () => {
    const narrow = [contact.fields[0]];
    expect(names(filterEntities(list, contact, narrow, { search: "cto", filters: {} }))).toEqual([]);
  });
});

describe("sortEntities and nextSort", () => {
  it("returns a sorted copy, leaving the input alone", () => {
    const list = [entity("b", { name: "b" }), entity("a", { name: "a" })];
    const sorted = sortEntities(list, contact, { field: "name", asc: true });
    expect([names(sorted), names(list)]).toEqual([["a", "b"], ["b", "a"]]);
  });

  it("keeps the order when no field is set", () => {
    const list = [entity("b", {}), entity("a", {})];
    expect(names(sortEntities(list, contact, { field: "", asc: true }))).toEqual(["b", "a"]);
  });

  it("sorts currency and number numerically, either way", () => {
    const list = [entity("x", { value: "100" }), entity("y", { value: 9 }), entity("z", {})];
    expect(names(sortEntities(list, deal, { field: "value", asc: true }))).toEqual(["z", "y", "x"]);
    expect(names(sortEntities(list, deal, { field: "value", asc: false }))).toEqual(["x", "y", "z"]);
  });

  it("sorts dates by time, an invalid or missing date as 0", () => {
    const list = [entity("x", { closeBy: "2026-02-01" }), entity("y", { closeBy: "soon" }), entity("z", { closeBy: "2026-01-01" })];
    expect(names(sortEntities(list, deal, { field: "closeBy", asc: true }))).toEqual(["y", "z", "x"]);
  });

  it("sorts text numeric-aware and case-insensitively, links unwrapped", () => {
    const list = [entity("x", { company: "[[b 10]]" }), entity("y", { company: "B 9" }), entity("z", { company: "a" })];
    expect(names(sortEntities(list, deal, { field: "company", asc: true }))).toEqual(["z", "y", "x"]);
  });

  it("QUIRK: an array value is not unwrapped, so it sorts by its joined text", () => {
    const list = [entity("y", { company: "b" }), entity("x", { company: ["[[z]]"] })];
    // "[[z]]" sorts before "b" on its brackets.
    expect(names(sortEntities(list, deal, { field: "company", asc: true }))).toEqual(["x", "y"]);
  });

  it("sorts currency by number, not as text", () => {
    const list = [entity("x", { value: "1e3" }), entity("y", { value: 50 })];
    expect(names(sortEntities(list, deal, { field: "value", asc: true }))).toEqual(["y", "x"]);
  });

  it("ties text that differs only in case, keeping the input order", () => {
    const list = [entity("x", { company: "b" }), entity("y", { company: "A" }), entity("z", { company: "a" })];
    expect(names(sortEntities(list, deal, { field: "company", asc: true }))).toEqual(["y", "z", "x"]);
  });

  it("sorts an unknown field as text", () => {
    const list = [entity("x", { extra: "b" }), entity("y", { extra: "a" })];
    expect(names(sortEntities(list, deal, { field: "extra", asc: true }))).toEqual(["y", "x"]);
  });

  it("nextSort flips the sorted column and sorts a new one ascending", () => {
    expect(nextSort({ field: "name", asc: true }, "name")).toEqual({ field: "name", asc: false });
    expect(nextSort({ field: "name", asc: false }, "name")).toEqual({ field: "name", asc: true });
    expect(nextSort({ field: "name", asc: false }, "role")).toEqual({ field: "role", asc: true });
  });
});

describe("primaryField and tableCell", () => {
  it("finds the primary field, else the first", () => {
    expect(primaryField(deal).key).toBe("title");
    expect(primaryField({ ...deal, fields: [{ key: "a", label: "A" }, { key: "b", label: "B" }] }).key).toBe("a");
  });

  it.each<[EntityField, unknown]>([
    [{ key: "owner", label: "" }, { kind: "owner" }],
    [{ key: "assigned", label: "", type: "multitext", suggestionSource: "folder:X" }, { kind: "owner" }],
    [{ key: "x", label: "", type: "multitext", suggestionSource: "folder:Cadence/Projects" }, { kind: "links", target: "folder:Cadence/Projects" }],
    [{ key: "x", label: "", type: "multitext", suggestionSource: "entity:deal" }, { kind: "links", target: "entity:deal" }],
    [{ key: "x", label: "", type: "multitext" }, { kind: "text" }],
    [{ key: "x", label: "", type: "multitext", suggestionSource: "tags" }, { kind: "text" }],
    [{ key: "x", label: "", type: "multitext", suggestionSource: "none" }, { kind: "text" }],
    [{ key: "with", label: "", type: "multitext" }, { kind: "links", target: "contact" }],
    [{ key: "company", label: "" }, { kind: "links", target: "company" }],
    [{ key: "company", label: "", type: "multitext", suggestionSource: "history" }, { kind: "links", target: "company" }],
    [{ key: "partner", label: "" }, { kind: "links", target: "partner" }],
    [{ key: "contact", label: "" }, { kind: "links", target: "contact" }],
    [{ key: "contacts", label: "" }, { kind: "links", target: "contact" }],
    [{ key: "related", label: "" }, { kind: "links", target: "project" }],
    [{ key: "region", label: "" }, { kind: "text" }],
  ])("%j → %j", (field, cell) => {
    expect(tableCell(field)).toEqual(cell);
  });
});

describe("card seams", () => {
  it.each([
    ["partner", "tier"],
    ["activity", "type"],
    ["deal", "stage"],
    ["sequence", "status"],
    ["contact", undefined],
  ])("%s pills on %s", (key, field) => {
    expect(cardStatusField(ENTITIES[key])?.key).toBe(field);
  });

  it("pill text is the first array item; the class lower-cases and dashes whitespace", () => {
    expect([pillText(["On hold", "x"]), pillText("Won"), pillText(3)]).toEqual(["On hold", "Won", "3"]);
    expect(pillClass("On  Hold")).toBe("cad-pill-on-hold");
  });

  it("meta rows: up to four non-empty fields in field order, skipping the primary and pill fields", () => {
    const e = entity("d", { title: "T", stage: "Won", value: 0, company: "[[Acme]]", contact: "", owner: ["[[Sam]]"], closeBy: "2026-01-01", extra: "x" });
    const rows = cardMetaRows(e, deal, primaryField(deal), cardStatusField(deal));
    expect(rows.map((r) => [r.field.key, r.value, r.isLink])).toEqual([
      ["value", 0, false], ["company", "[[Acme]]", true], ["owner", ["[[Sam]]"], true], ["closeBy", "2026-01-01", false],
    ]);
  });

  it("meta rows treat folder: sources as links and include everything without a pill field", () => {
    const def: EntityDef = {
      folder: "V", label: "V", plural: "Vs", columns: [],
      fields: [{ key: "name", label: "N", primary: true }, { key: "lead", label: "L", suggestionSource: "folder:Cadence/Contacts" }, { key: "x", label: "X" }],
    };
    const rows = cardMetaRows(entity("v", { lead: "Kim", x: "y" }), def, primaryField(def), cardStatusField(def));
    expect(rows.map((r) => [r.field.key, r.isLink])).toEqual([["lead", true], ["x", false]]);
  });

  it.each<[EntityField, string]>([
    [{ key: "owner", label: "" }, "contact"],
    [{ key: "company", label: "" }, "company"],
    [{ key: "lead", label: "", suggestionSource: "folder:Cadence/Contacts" }, "contact"],
    [{ key: "owner", label: "", suggestionSource: "folder:Cadence/Projects" }, "project"],
    [{ key: "x", label: "", suggestionSource: "folder:Pipeline" }, "deal"],
    [{ key: "x", label: "", suggestionSource: "folder:Elsewhere/Deals" }, "deal"],
    [{ key: "x", label: "", suggestionSource: "folder:Nowhere" }, "x"],
  ])("a card link on %j opens a %s", (field, key) => {
    expect(cardLinkEntityKey(field, ENTITIES)).toBe(key);
  });
});

describe("kanban seams", () => {
  it("unwrapLink strips one [[ and one ]] at the ends, then trims", () => {
    expect([unwrapLink("[[A]]"), unwrapLink(" [[A]] "), unwrapLink("[[A|b]]"), unwrapLink(3), unwrapLink("[[[[A]]]]")]).toEqual([
      "A", "[[A]]", "A|b", "3", "[[A]]",
    ]);
  });

  it.each([
    ["deal", deal, undefined, "stage"],
    ["activity", activity, undefined, "type"],
    ["partner", partner, undefined, "tier"],
    ["contact", contact, undefined, "status"],
    ["certification", certification, undefined, "status"],
    ["deal", deal, "owner", "owner"],
    ["deal", deal, "", "stage"],
  ])("kanbanGroupBy(%s, saved %j) → %s", (key, def, saved, groupBy) => {
    expect(kanbanGroupBy(key as string, def as EntityDef, saved as string | undefined)).toBe(groupBy);
  });

  it("QUIRK: activities group by type even when another enum or text field comes first", () => {
    const def: EntityDef = { ...activity, fields: [activity.fields[0], { key: "mood", label: "Mood", type: "text" }, ...activity.fields.slice(1)] };
    expect([kanbanGroupBy("activity", def, undefined), kanbanGroupBy("other", def, undefined)]).toEqual(["type", "mood"]);
  });

  it("kanbanOptions returns the field's options, or [] for none or a missing field", () => {
    expect(kanbanOptions(sequence, "status")).toEqual(["Draft", "Active", "Paused", "Archived"]);
    expect(kanbanOptions(deal, "owner")).toEqual([]);
    expect(kanbanOptions(deal, "nope")).toEqual([]);
  });

  it("distinctGroups flattens, comma-splits, unwraps and de-duplicates in first-seen order", () => {
    const list = [entity("a", { owner: ["[[Sam]]", " Kim "] }), entity("b", { owner: "[[Kim]], Lee, " }), entity("c", {})];
    expect(distinctGroups(list, "owner", deal)).toEqual(["Sam", "Kim", "Lee"]);
    expect(distinctGroups([], "owner", deal)).toEqual(["To Do", "In Progress", "Done"]);
  });

  it("QUIRK: a link containing a comma is split", () => {
    expect(distinctGroups([entity("a", { owner: "[[Smith, J]]" })], "owner", deal)).toEqual(["Smith", "J"]);
  });

  it("kanbanGroupByFields keeps typed non-primary enum/text/multitext/tags fields", () => {
    expect(keys(kanbanGroupByFields(deal))).toEqual(["stage"]);
    expect(keys(kanbanGroupByFields(contact))).toEqual(["tags"]);
    expect(keys(kanbanGroupByFields(certification))).toEqual([]);
  });

  it("inKanbanGroup matches case-insensitively, unwrapped, any array item", () => {
    expect([
      inKanbanGroup("won", "Won"), inKanbanGroup("[[Won]]", "won"), inKanbanGroup(["Lost", "[[WON]]"], "Won"),
      inKanbanGroup("", "Won"), inKanbanGroup(undefined, ""), inKanbanGroup(["Won"], "Lost"),
    ]).toEqual([true, true, true, false, true, false]);
  });

  it("kanbanGroups puts each entity in every column it matches, and unmatched ones in none", () => {
    const list = [entity("a", { stage: "Won" }), entity("b", { owner: ["Sam", "Kim"] }), entity("c", { stage: "Gone" })];
    expect(kanbanGroups(list, "stage", ["Won", "Lost"], deal).map((c) => [c.stage, names(c.items)])).toEqual([
      ["Won", ["a"]], ["Lost", []],
    ]);
    expect(kanbanGroups(list, "owner", ["Sam", "Kim"], deal).map((c) => [c.stage, names(c.items)])).toEqual([
      ["Sam", ["b"]], ["Kim", ["b"]],
    ]);
  });

  it("kanbanValueField finds the first currency or number field", () => {
    expect([kanbanValueField(deal)?.key, kanbanValueField(sequence)?.key, kanbanValueField(contact)]).toEqual(["value", "steps", undefined]);
  });

  it("kanbanColumnMeta sums the value field, treating non-numbers as 0", () => {
    const items = [entity("a", { value: "10" }), entity("b", { value: "x" }), entity("c", { value: 5 })];
    expect(kanbanColumnMeta(items, deal)).toBe(`3 · ${fmtValue(15, "currency")}`);
    expect(kanbanColumnMeta(items, sequence)).toBe("3 · 0");
    expect(kanbanColumnMeta(items, contact)).toBe("3");
  });

  it.each<[EntityField | undefined, unknown]>([
    [undefined, "Won"],
    [{ key: "s", label: "", type: "enum" }, "Won"],
    [{ key: "s", label: "", type: "tags" }, ["Won"]],
    [{ key: "s", label: "", isList: true }, ["Won"]],
    [{ key: "s", label: "", type: "multitext", suggestionSource: "contact" }, ["[[Won]]"]],
    [{ key: "s", label: "", type: "multitext", suggestionSource: "history" }, ["Won"]],
    [{ key: "s", label: "", suggestionSource: "folder:X" }, "[[Won]]"],
    [{ key: "s", label: "", suggestionSource: "tags" }, "Won"],
  ])("kanbanDropValue(%j) → %j", (field, value) => {
    expect(kanbanDropValue(field, "Won")).toEqual(value);
  });

  it("kanbanCardLinks lists company, contact, owner and assigned links, owner and assigned as contacts", () => {
    const e = entity("d", { owner: "[[Sam|S]]", contact: ["[[Jane]]"], company: "Acme, Beta", assigned: "Kim" });
    expect(kanbanCardLinks(e, deal)).toEqual([
      { display: "Acme", target: "Acme", entityKey: "company" },
      { display: "Beta", target: "Beta", entityKey: "company" },
      { display: "Jane", target: "Jane", entityKey: "contact" },
      { display: "S", target: "Sam", entityKey: "contact" },
    ]);
    expect(kanbanCardLinks(entity("l", { assigned: "Kim", company: "Acme" }), ENTITIES.lead)).toEqual([
      { display: "Acme", target: "Acme", entityKey: "company" },
      { display: "Kim", target: "Kim", entityKey: "contact" },
    ]);
  });
});
