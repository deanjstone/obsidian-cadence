import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, type App, type FakeElement } from "../mocks/obsidian";
import { companyAcme, contactJane, partnerInitech, projectWebsite } from "../fixtures/vault";
import { contentOf } from "../helpers/dom";
import { ENTITIES } from "../../src/constants/entities";
import { CadenceEntityCreateModal } from "../../src/legacy/cadence.js";

/* Characterization tests for the entity create modal's typeahead: which
   fields get a suggestion box, where each suggestion source reads from,
   and how picking a suggestion edits the comma-separated value. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const joe = { path: "Cadence/Contacts/Team/Joe Bloggs.md", frontmatter: { type: "contact", role: "Founder" } };
const jo = { path: "Cadence/Contacts/Jo March.md", frontmatter: { role: ["[[CTO]]", "", "Advisor"] } };
const sharedSpec = { path: "Shared/Specs/Spec one.md" };
const sharedTop = { path: "Shared/Spec two.md" };
const sharedPdf = { path: "Shared/Spec three.pdf" };

let app: App;
beforeEach(() => {
  app = createMockApp([contactJane, joe, jo, companyAcme, partnerInitech, projectWebsite, sharedSpec, sharedTop, sharedPdf]);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  delete ENTITIES.widget;
});

function openCreate(entityKey: string) {
  const modal: Any = new CadenceEntityCreateModal(app, entityKey, { onSubmit: vi.fn() });
  modal.open();
  const content = contentOf(modal);
  const form = content.findAll("div").find((d) => d.classes.includes("cad-create-form")) as FakeElement;
  const row = (key: string) => form.children.find((r) => r.children[1].dataset.fieldKey === key) as FakeElement;
  const typeInto = (key: string, value: string) => {
    const input = row(key).children[1];
    input.value = value;
    input.trigger("input");
    return row(key).children[2];
  };
  return { modal, row, typeInto };
}

const shown = (box: FakeElement) => (box.style.display === "block" ? box.children.map((c) => c.text) : []);

describe("CadenceEntityCreateModal suggestions", () => {
  it("adds a hidden suggestion box only to fields with a suggestion source", () => {
    const { row } = openCreate("deal");
    const withBox = ["title", "stage", "value", "company", "contact", "owner", "closeBy"].filter((k) => row(k).children.length === 3);
    expect(withBox).toEqual(["company", "contact", "owner"]);
    const box = row("company").children[2];
    expect(box.classes).toEqual(["cad-pd-tag-suggestions"]);
    expect(box.style).toMatchObject({ position: "absolute", display: "none", zIndex: "10000", top: "100%", width: "calc(100% - 130px)" });
    expect(row("company").style.position).toBe("relative");
  });

  it("suggests contact note names containing the text after the last comma", () => {
    const { typeInto } = openCreate("deal");
    expect(shown(typeInto("contact", "JO"))).toEqual(["Joe Bloggs", "Jo March"]);
    expect(shown(typeInto("contact", "jane doe, jo"))).toEqual(["Joe Bloggs", "Jo March"]);
    expect(shown(typeInto("contact", "[[Jo March]], jo"))).toEqual(["Joe Bloggs"]);
  });

  it("hides the box for an empty query or no matches", () => {
    const { typeInto } = openCreate("deal");
    typeInto("contact", "jo");
    const box = typeInto("contact", "jane, ");
    expect(box.style.display).toBe("none");
    expect(box.children).toHaveLength(0);
    expect(typeInto("contact", "zzz").style.display).toBe("none");
  });

  it("reads company, partner and project names for those keys", () => {
    expect(shown(openCreate("deal").typeInto("company", "ac"))).toEqual(["Acme Corp"]);
    expect(shown(openCreate("registration").typeInto("partner", "ini"))).toEqual(["Initech"]);
    expect(shown(openCreate("activity").typeInto("related", "web"))).toEqual(["Website relaunch"]);
  });

  it("suggests vault tags without their #", () => {
    app.metadataCache.tags = { "#vip": 2, "#tech": 1, "#travel": 1 };
    const { typeInto } = openCreate("contact");
    expect(shown(typeInto("tags", "t"))).toEqual(["tech", "travel"]);
    expect(shown(typeInto("tags", "tech, t"))).toEqual(["travel"]);
  });

  it("suggests every value of the same key across markdown notes for history fields", () => {
    const { typeInto } = openCreate("contact");
    expect(shown(typeInto("role", "o"))).toEqual(["CTO", "Founder", "Advisor"]);
    expect(shown(typeInto("role", "cto, o"))).toEqual(["Founder", "Advisor"]);
  });

  it("walks a folder source for markdown note names, nested folders included", () => {
    ENTITIES.widget = {
      folder: "Cadence/Widgets", label: "Widget", plural: "Widgets", columns: [],
      fields: [
        { key: "name", label: "Name", primary: true },
        { key: "doc", label: "Doc", suggestionSource: "folder:Shared" },
        { key: "missing", label: "Missing", suggestionSource: "folder:Nowhere" },
      ],
    };
    const { typeInto } = openCreate("widget");
    expect(shown(typeInto("doc", "spec"))).toEqual(["Spec one", "Spec two"]);
    expect(typeInto("missing", "spec").style.display).toBe("none");
  });

  it("suggests contacts for an entity:<key> source, ignoring the key (flagged)", () => {
    ENTITIES.widget = {
      folder: "Cadence/Widgets", label: "Widget", plural: "Widgets", columns: [],
      fields: [
        { key: "name", label: "Name", primary: true },
        { key: "client", label: "Client", suggestionSource: "entity:company" },
      ],
    };
    const { typeInto } = openCreate("widget");
    expect(shown(typeInto("client", "a"))).toEqual(["Jane Doe", "Jo March"]);
    expect(shown(typeInto("client", "acme"))).toEqual([]);
  });

  it("replaces the last segment with the picked name on mousedown", () => {
    const { row, typeInto } = openCreate("deal");
    const box = typeInto("contact", "Jane Doe,jo");
    const input = row("contact").children[1];
    const event = box.children[1].trigger("mousedown");
    expect(event.defaultPrevented).toBe(true);
    expect(input.value).toBe("Jane Doe, Jo March, ");
    expect(box.style.display).toBe("none");
    expect(input.focusCount).toBe(1);
    const first = typeInto("company", "acm");
    first.children[0].trigger("mousedown");
    expect(row("company").children[1].value).toBe("Acme Corp, ");
  });

  it("shows on focus and hides 180ms after blur", () => {
    const { row } = openCreate("deal");
    const input = row("contact").children[1];
    const box = row("contact").children[2];
    input.value = "jo";
    input.trigger("focus");
    expect(box.style.display).toBe("block");
    input.trigger("blur");
    vi.advanceTimersByTime(179);
    expect(box.style.display).toBe("block");
    vi.advanceTimersByTime(1);
    expect(box.style.display).toBe("none");
  });

  it("highlights a suggestion on hover", () => {
    const item = openCreate("deal").typeInto("contact", "jo").children[0];
    expect(item.classes).toEqual(["cad-suggestion-item"]);
    item.trigger("mouseenter");
    expect(item.style.backgroundColor).toBe("var(--background-modifier-hover)");
    item.trigger("mouseleave");
    expect(item.style.backgroundColor).toBe("transparent");
  });
});
