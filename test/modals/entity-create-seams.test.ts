import { describe, expect, it } from "vitest";
import { createMockApp } from "../mocks/obsidian";
import { contactJane, companyAcme } from "../fixtures/vault";
import { ENTITIES } from "../../src/constants/entities";
import {
  buildEntityCreateValues,
  defaultEnumValue,
  entityCreateSuggestions,
  placeholderFor,
} from "../../src/modals/entity-create";

/* Direct tests for the pure seams lifted out of CadenceEntityCreateModal.
   The modal's own behaviour is pinned in entity-create.test.ts and
   entity-create-suggestions.test.ts. */

describe("placeholderFor", () => {
  it("gives the primary field an example per entity, and '' otherwise", () => {
    expect(placeholderFor("deal", true)).toBe("e.g. Acme — FTTH expansion");
    expect(placeholderFor("deal", false)).toBe("");
    expect(placeholderFor("custom", true)).toBe("");
  });
});

describe("defaultEnumValue", () => {
  it("pre-selects Lead, an active-like status, medium priority, or the first tier/type option", () => {
    expect(defaultEnumValue({ key: "stage", label: "", options: ["New", "Lead"] })).toBe("Lead");
    expect(defaultEnumValue({ key: "status", label: "", options: ["Open", "Pending"] })).toBe("Pending");
    expect(defaultEnumValue({ key: "status", label: "", options: ["Open", "Shut"] })).toBe("Open");
    expect(defaultEnumValue({ key: "priority", label: "", options: ["P1", "Medium"] })).toBe("Medium");
    expect(defaultEnumValue({ key: "tier", label: "", options: ["B", "A"] })).toBe("B");
    expect(defaultEnumValue({ key: "type", label: "", options: ["Call"] })).toBe("Call");
  });

  it("leaves other keys, empty options and a stage without Lead unselected", () => {
    expect(defaultEnumValue({ key: "stage", label: "", options: ["Open"] })).toBeUndefined();
    expect(defaultEnumValue({ key: "colour", label: "", options: ["Blue"] })).toBeUndefined();
    expect(defaultEnumValue({ key: "status", label: "", options: [] })).toBeUndefined();
    expect(defaultEnumValue({ key: "status", label: "" })).toBeUndefined();
  });
});

describe("buildEntityCreateValues", () => {
  it("returns null while the first input is blank or there are no inputs", () => {
    expect(buildEntityCreateValues(ENTITIES.contact, [{ key: "name", type: "text", value: "  " }])).toBeNull();
    expect(buildEntityCreateValues(ENTITIES.contact, [])).toBeNull();
  });

  it("trims the name but keeps the primary value as typed", () => {
    expect(buildEntityCreateValues(ENTITIES.contact, [{ key: "name", type: "text", value: " Jane " }])).toEqual({
      name: "Jane",
      values: { name: " Jane " },
    });
  });

  it("coerces links, lists and numbers by key, type and suggestion source", () => {
    const result = buildEntityCreateValues(ENTITIES.deal, [
      { key: "title", type: "text", value: "Big" },
      { key: "value", type: "currency", value: "12.5" },
      { key: "owner", type: "text", value: "[[Sam]], Lee" },
      { key: "contact", type: "text", value: ",," },
      { key: "closeBy", type: "date", value: "" },
      { key: "stage", type: "enum", value: "Won" },
    ]);
    expect(result).toEqual({ name: "Big", values: { title: "Big", value: 12.5, owner: ["[[Sam]]", "[[Lee]]"], stage: "Won" } });
  });

  it("lists by type even for keys the entity does not define, and drops NaN", () => {
    const result = buildEntityCreateValues(ENTITIES.sequence, [
      { key: "name", value: "S" },
      { key: "labels", type: "tags", value: "a, b" },
      { key: "notes", type: "multitext", value: "x" },
      { key: "steps", type: "number", value: "n/a" },
      { key: "assigned", value: "Jo" },
    ]);
    expect(result).toEqual({ name: "S", values: { name: "S", labels: ["a", "b"], notes: ["x"], assigned: ["[[Jo]]"] } });
  });
});

describe("entityCreateSuggestions", () => {
  const app = createMockApp([contactJane, companyAcme]);
  const field = { key: "contact", label: "Contact" };

  it("returns nothing for an empty last segment or a 'none' source", () => {
    expect(entityCreateSuggestions(app as never, field, "contact", "Jane Doe, ")).toEqual([]);
    expect(entityCreateSuggestions(app as never, field, "none", "ja")).toEqual([]);
  });

  it("matches entity note names and skips ones already typed", () => {
    expect(entityCreateSuggestions(app as never, field, "contact", "JA")).toEqual(["Jane Doe"]);
    expect(entityCreateSuggestions(app as never, field, "contact", "[[Jane Doe]], ja")).toEqual([]);
    expect(entityCreateSuggestions(app as never, { key: "company", label: "" }, "company", "acme")).toEqual(["Acme Corp"]);
  });
});
