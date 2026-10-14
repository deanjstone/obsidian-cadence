import { describe, expect, it } from "vitest";
import {
  addProjectLink, appendProjectLink, collectValidLinks, contactProjectsPlan, extractEntitiesFromValue, isContactField,
  isProjectField, noteLinks, dropProjectLink, type SyncNote,
} from "../../src/plugin/contact-project-sync";
import type { EntityDef, Frontmatter } from "../../src/types/entities";

/* Direct tests for the contact↔project sync's plain-data seams, over a
   plain entity registry and plain notes. */

const entities: Record<string, EntityDef> = {
  project: {
    folder: "Cadence/Projects", label: "Project", plural: "Projects", columns: ["name"],
    fields: [
      { key: "lead", label: "Lead", suggestionSource: "folder:Cadence/Contacts" },
      { key: "sponsor", label: "Sponsor", suggestionSource: "contact" },
      { key: "parent", label: "Parent", suggestionSource: "folder:Cadence/Projects" },
      { key: "epic", label: "Epic", suggestionSource: "project" },
      { key: "related", label: "Related" },
      { key: "notes", label: "Notes" },
    ],
  },
};
const contacts = new Set(["jane doe", "sam lee"]);
const projects = new Set(["apollo", "website relaunch"]);
const note = (frontmatter: Frontmatter, entityKey: string | null = null, basename = "Note"): SyncNote => ({ entityKey, basename, frontmatter });

describe("extractEntitiesFromValue", () => {
  it("reads links, dropping aliases and empty links", () => {
    expect(extractEntitiesFromValue("[[Jane Doe]] and [[ Sam Lee | Sam ]] [[]]")).toEqual(["Jane Doe", "Sam Lee"]);
  });

  it("reads comma lists when there are no links", () => {
    expect(extractEntitiesFromValue(" a, b ,, c ")).toEqual(["a", "b", "c"]);
    expect(extractEntitiesFromValue("a, [[b]]")).toEqual(["b"]);
  });

  it("reads plain strings, numbers and arrays item by item", () => {
    expect(extractEntitiesFromValue("  Apollo ")).toEqual(["Apollo"]);
    expect(extractEntitiesFromValue(42)).toEqual(["42"]);
    expect(extractEntitiesFromValue(["[[A]]", "b, c", "", null])).toEqual(["A", "b", "c", "null"]);
  });

  it("gives nothing for null, undefined and blank strings", () => {
    expect(extractEntitiesFromValue(null)).toEqual([]);
    expect(extractEntitiesFromValue(undefined)).toEqual([]);
    expect(extractEntitiesFromValue("   ")).toEqual([]);
  });
});

describe("isContactField and isProjectField", () => {
  it("knows the built-in keys in any case", () => {
    for (const key of ["owner", "Contact", "CONTACTS", "with", "assigned"]) expect(isContactField(key, null, entities), key).toBe(true);
    for (const key of ["project", "Projects", "RELATED"]) expect(isProjectField(key, null, entities), key).toBe(true);
    expect(isContactField("company", null, entities)).toBe(false);
    expect(isProjectField("owner", null, entities)).toBe(false);
  });

  it("reads the entity's field suggestion source", () => {
    expect(isContactField("lead", "project", entities)).toBe(true);
    expect(isContactField("sponsor", "project", entities)).toBe(true);
    expect(isProjectField("parent", "project", entities)).toBe(true);
    expect(isProjectField("epic", "project", entities)).toBe(true);
    expect(isContactField("notes", "project", entities)).toBe(false);
    expect(isContactField("lead", "deal", entities)).toBe(false);
    expect(isContactField("lead", null, entities)).toBe(false);
  });
});

describe("noteLinks", () => {
  it("counts the note itself when it is a contact or a project", () => {
    expect(noteLinks(note({}, "contact", "Jane Doe"), contacts, projects, entities)).toEqual({ contacts: new Set(["jane doe"]), projects: new Set() });
    expect(noteLinks(note({}, "project", "Apollo"), contacts, projects, entities)).toEqual({ contacts: new Set(), projects: new Set(["apollo"]) });
  });

  it("takes any name from a contact or project field, and known names from any field", () => {
    const links = noteLinks(note({ owner: "[[New Person]]", project: "Zeta", met: "Sam Lee", about: "[[Apollo]]", misc: "Nobody" }), contacts, projects, entities);
    expect(links).toEqual({ contacts: new Set(["new person", "sam lee"]), projects: new Set(["zeta", "apollo"]) });
  });

  it("skips `type`", () => {
    expect(noteLinks(note({ type: "[[Jane Doe]]" }), contacts, projects, entities)).toEqual({ contacts: new Set(), projects: new Set() });
  });
});

describe("collectValidLinks", () => {
  it("pairs every contact with every project in each note", () => {
    const links = collectValidLinks([note({ contact: "[[Jane Doe]], [[Sam Lee]]", project: "[[Apollo]]" })], contacts, projects, entities);
    expect([...links]).toEqual(["jane doe|apollo", "sam lee|apollo"]);
  });

  it("counts a project note as its own project", () => {
    expect([...collectValidLinks([note({ owner: "[[Jane Doe]]" }, "project", "Apollo")], contacts, projects, entities)]).toEqual(["jane doe|apollo"]);
  });

  it("ignores contact notes and notes naming only one side", () => {
    const notes = [note({ project: "[[Apollo]]" }, "contact", "Jane Doe"), note({ owner: "[[Sam Lee]]" }), note({ project: "[[Apollo]]" })];
    expect(collectValidLinks(notes, contacts, projects, entities).size).toBe(0);
  });

  it("merges duplicates across notes", () => {
    const n = note({ with: "Jane Doe", project: "apollo" });
    expect([...collectValidLinks([n, n], contacts, projects, entities)]).toEqual(["jane doe|apollo"]);
  });
});

describe("project link values", () => {
  it("appendProjectLink appends a link to the raw value, keeping each item as typed", () => {
    expect(appendProjectLink(undefined, "Apollo")).toBe("[[Apollo]]");
    expect(appendProjectLink("", "Apollo")).toBe("[[Apollo]]");
    expect(appendProjectLink("Zeta", "Apollo")).toEqual(["Zeta", "[[Apollo]]"]);
    expect(appendProjectLink("Zeta, [[Old|the old one]]", "Apollo")).toEqual(["Zeta", "[[Old|the old one]]", "[[Apollo]]"]);
    expect(appendProjectLink(["[[Zeta]]", "plain"], "Apollo")).toEqual(["[[Zeta]]", "plain", "[[Apollo]]"]);
    expect(appendProjectLink(["apollo"], "Apollo")).toBeNull();
  });

  it("addProjectLink appends a missing project only", () => {
    const current = ["Apollo"];
    expect(addProjectLink(current, "Zeta")).toEqual(["Apollo", "Zeta"]);
    expect(addProjectLink(current, "APOLLO")).toBe(current);
    expect(current).toEqual(["Apollo"]);
  });

  it("dropProjectLink drops every case-insensitive match from the raw value, keeping the rest as typed (#67)", () => {
    expect(dropProjectLink(["Apollo", "apollo", "Zeta"], "APOLLO")).toEqual(["Zeta"]);
    expect(dropProjectLink("website RELAUNCH, Apollo", "Website relaunch")).toBe("Apollo");
    expect(dropProjectLink("Zeta, [[Old|the old one]], plain", "old")).toBe("Zeta, plain");
    expect(dropProjectLink(["[[Apollo]]", "[[Website relaunch]]"], "Website relaunch")).toEqual(["[[Apollo]]"]);
    expect(dropProjectLink(["[[Website relaunch]]"], "Website relaunch")).toBeNull();
    expect(dropProjectLink("[[Website relaunch]]", "Website relaunch")).toBeNull();
  });
});

describe("contactProjectsPlan", () => {
  it("is null when every backed project is already listed, case-insensitively", () => {
    expect(contactProjectsPlan(["Apollo", "zeta"], ["Zeta", "apollo"])).toBeNull();
    expect(contactProjectsPlan([], [])).toBeNull();
  });

  it("only adds: a backed project missing from the contact is added, and none is removed", () => {
    expect(contactProjectsPlan(["Apollo", "Old"], ["apollo", "New"])).toEqual({ added: ["New"] });
    expect(contactProjectsPlan(["Apollo"], [])).toBeNull();
    expect(contactProjectsPlan(["Apollo", "Old"], ["apollo"])).toBeNull();
  });
});
