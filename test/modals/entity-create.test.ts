import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, type App, type FakeElement } from "../mocks/obsidian";
import { buttonByText, contentOf, optionValues } from "../helpers/dom";
import { ENTITIES } from "../../src/constants/entities";
import { CadenceEntityCreateModal } from "../../src/legacy/cadence.js";

/* Characterization tests for the entity create modal: one input per field,
   the enum smart defaults, caller defaults, and the { name, values } payload
   handed to onSubmit (wiki-link, list and number coercion). Driven through
   onOpen() against the mock DOM stub. The typeahead suggestions are in
   entity-create-suggestions.test.ts. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let app: App;
beforeEach(() => {
  app = createMockApp();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  delete ENTITIES.widget;
});

function openCreate(entityKey: string, opts: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  const modal: Any = new CadenceEntityCreateModal(app, entityKey, { onSubmit, ...opts });
  modal.open();
  const content = contentOf(modal);
  const form = content.findAll("div").find((d) => d.classes.includes("cad-create-form")) as FakeElement;
  const rows = form.children;
  const field = (key: string) => rows.map((r) => r.children[1]).find((el) => el.dataset.fieldKey === key) as FakeElement;
  const fill = (values: Record<string, string>) => {
    for (const [key, value] of Object.entries(values)) field(key).value = value;
  };
  const submit = () => buttonByText(content, `Create ${ENTITIES[entityKey].label}`).trigger("click");
  return { modal, content, rows, field, fill, submit, onSubmit };
}

describe("CadenceEntityCreateModal onOpen", () => {
  it("throws when constructed without an options object", () => {
    expect(() => new CadenceEntityCreateModal(app, "contact")).toThrow(TypeError);
  });

  it("throws on open for an unknown entity key", () => {
    const modal: Any = new CadenceEntityCreateModal(app, "nope", { onSubmit: vi.fn() });
    expect(modal.def).toBeUndefined();
    expect(() => modal.open()).toThrow(TypeError);
  });

  it("renders a labelled row per field, the primary one starred and required", () => {
    const { modal, content, rows } = openCreate("deal");
    expect(content.classes).toEqual(["cad-create-modal"]);
    expect((modal.modalEl as FakeElement).classes).toEqual(["cad-create-modal-shell"]);
    expect(content.findAll("h3")[0].text).toBe("New Deal");
    expect(rows.map((r) => r.children[0].text)).toEqual([
      "TITLE *", "STAGE", "VALUE", "COMPANY", "CONTACT", "OWNER", "CLOSE BY",
    ]);
    const inputs = rows.map((r) => r.children[1]);
    expect(inputs.map((el) => el.required)).toEqual([true, false, false, false, false, false, false]);
    expect(inputs.map((el) => [el.dataset.fieldKey, el.dataset.fieldType])).toEqual([
      ["title", "text"], ["stage", "enum"], ["value", "currency"], ["company", "text"],
      ["contact", "text"], ["owner", "text"], ["closeBy", "date"],
    ]);
    expect(buttonByText(content, "Cancel").type).toBe("button");
    expect(buttonByText(content, "Create Deal").classes).toEqual(["cad-btn", "primary"]);
  });

  it("picks the input element and placeholder from the field type", () => {
    const { field } = openCreate("contact");
    const shape = (key: string) => [field(key).localName, field(key).type, field(key).placeholder];
    expect(shape("name")).toEqual(["input", "text", "e.g. Jane Smith"]);
    expect(shape("email")).toEqual(["input", "email", "name@example.com"]);
    expect(shape("phone")).toEqual(["input", "text", ""]);
    expect(shape("lastContact")).toEqual(["input", "date", ""]);
    expect(shape("tags")).toEqual(["input", "text", "tag1, tag2"]);
    const deal = openCreate("deal");
    expect([deal.field("value").type, deal.field("value").placeholder]).toEqual(["number", "0"]);
    expect(optionValues(deal.field("stage"))).toEqual(["", "Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]);
    expect(deal.field("stage").options[0].text).toBe("— —");
    expect(openCreate("sequence").field("steps").type).toBe("number");
  });

  it("pre-selects a sensible enum default per field", () => {
    const defaults = (key: string) =>
      Object.fromEntries(openCreate(key).rows.map((r) => r.children[1]).filter((el) => el.localName === "select").map((el) => [el.dataset.fieldKey, el.value]));
    expect(defaults("deal")).toEqual({ stage: "Lead" });
    expect(defaults("partner")).toEqual({ tier: "Gold", status: "Active" });
    expect(defaults("project")).toEqual({ status: "active", priority: "medium" });
    expect(defaults("lead")).toEqual({ status: "New" });
    expect(defaults("commission")).toEqual({ status: "Pending" });
    expect(defaults("registration")).toEqual({ status: "Submitted" });
    expect(defaults("sequence")).toEqual({ status: "Draft" });
    expect(defaults("activity")).toEqual({ type: "Call" });
  });

  it("falls back to the first option, or leaves stage blank without a Lead option", () => {
    ENTITIES.widget = {
      folder: "Cadence/Widgets", label: "Widget", plural: "Widgets", columns: [],
      fields: [
        { key: "name", label: "Name", primary: true },
        { key: "stage", label: "Stage", type: "enum", options: ["Open", "Closed"] },
        { key: "status", label: "Status", type: "enum", options: ["Green", "Red"] },
        { key: "priority", label: "Priority", type: "enum", options: ["P1", "P2"] },
        { key: "tier", label: "Tier", type: "enum", options: [] },
        { key: "colour", label: "Colour", type: "enum", options: ["Blue"] },
      ],
    };
    const { field } = openCreate("widget");
    expect(["stage", "status", "priority", "tier", "colour"].map((k) => field(k).value)).toEqual(["", "Green", "P1", "", ""]);
  });

  it("gives only the primary field an example placeholder, per entity", () => {
    const examples = Object.fromEntries(Object.keys(ENTITIES).map((key) => [key, openCreate(key).rows[0].children[1].placeholder]));
    expect(examples).toEqual({
      contact: "e.g. Jane Smith",
      company: "e.g. Acme Corp",
      partner: "e.g. Acme Distribution",
      registration: "e.g. Vodacom 12-site FTTB",
      commission: "e.g. C-2026-Q2-0042",
      lead: "e.g. Sarah from Vodacom",
      certification: "e.g. Cisco CCNP — May 2026",
      activity: "e.g. Discovery call with Jane",
      sequence: "e.g. Outbound — SMB",
      project: "e.g. Q3 Cadence launch",
      deal: "e.g. Acme — FTTH expansion",
    });
    const modal: Any = new CadenceEntityCreateModal(app, "nope", { onSubmit: vi.fn() });
    expect(modal._placeholderFor({ key: "name" }, true)).toBe("");
    expect(modal._placeholderFor({ key: "name" }, false)).toBe("");
  });

  it("pre-fills caller defaults as strings, overriding enum defaults", () => {
    const { field } = openCreate("deal", { defaults: { title: "Renewal", value: 1200, stage: "Won", company: "[[Acme]]", nope: "x" } });
    expect(field("title").value).toBe("Renewal");
    expect(field("value").value).toBe("1200");
    expect(field("stage").value).toBe("Won");
    expect(field("company").value).toBe("[[Acme]]");
  });

  it("blanks an enum whose caller default is not one of its options", () => {
    const { field } = openCreate("deal", { defaults: { stage: "Archived" } });
    expect(field("stage").value).toBe("");
  });

  it("skips a non-enum `type` field; if it is the first field nothing is starred or required (flagged)", () => {
    ENTITIES.widget = {
      folder: "Cadence/Widgets", label: "Widget", plural: "Widgets", columns: [],
      fields: [
        { key: "type", label: "Type" },
        { key: "name", label: "Name" },
      ],
    };
    const { rows, field, fill, submit, onSubmit } = openCreate("widget");
    expect(rows.map((r) => r.children[0].text)).toEqual(["NAME"]);
    expect(field("name").required).toBe(false);
    expect(field("name").placeholder).toBe("");
    fill({ name: "Gizmo" });
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ name: "Gizmo", values: { name: "Gizmo" } });
  });

  it("focuses the first input on the next tick", () => {
    const { rows } = openCreate("contact");
    expect(rows[0].children[1].focusCount).toBe(0);
    vi.runAllTimers();
    expect(rows[0].children[1].focusCount).toBe(1);
  });
});

describe("CadenceEntityCreateModal submit", () => {
  it("does nothing but refocus the first input while the primary value is blank", () => {
    const { content, field, fill, submit, onSubmit } = openCreate("contact");
    fill({ name: "   ", email: "a@x.test" });
    submit();
    expect(field("name").focusCount).toBe(1);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(content.children.length).toBeGreaterThan(0);
  });

  it("closes, then submits the trimmed name and the untrimmed primary value (flagged)", () => {
    const { modal, content, fill, submit, onSubmit } = openCreate("company");
    const order: string[] = [];
    const close = modal.close.bind(modal);
    modal.close = () => { order.push("close"); close(); };
    onSubmit.mockImplementation(() => order.push("submit"));
    fill({ name: "  Acme Corp " });
    submit();
    expect(order).toEqual(["close", "submit"]);
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ name: "Acme Corp", values: { name: "  Acme Corp " } });
    expect(content.children).toHaveLength(0);
    expect(modal._submitted).toBe(true);
  });

  it("wraps entity references as wiki-link lists and parses numbers", () => {
    const { fill, submit, onSubmit } = openCreate("deal");
    fill({
      title: "Big",
      value: "1200.50",
      company: "Acme",
      contact: "[[Jane Doe]], Joe ,",
      owner: " , ",
      closeBy: "2026-11-30",
    });
    submit();
    expect(onSubmit.mock.calls[0][0]).toEqual({
      name: "Big",
      values: {
        title: "Big",
        stage: "Lead",
        value: 1200.5,
        company: ["[[Acme]]"],
        contact: ["[[Jane Doe]]", "[[Joe]]"],
        closeBy: "2026-11-30",
      },
    });
  });

  it("drops a number that does not parse", () => {
    const { fill, submit, onSubmit } = openCreate("sequence");
    fill({ name: "Outbound", steps: "three", active: "2" });
    submit();
    expect(onSubmit.mock.calls[0][0].values).toEqual({ name: "Outbound", active: 2, status: "Draft" });
  });

  it("splits list fields into plain arrays: isList, tags and the history keys", () => {
    const { fill, submit, onSubmit } = openCreate("contact");
    fill({
      name: "Jane",
      email: "jane@x.test, j@y.test",
      phone: "555",
      company: "Acme",
      role: "CTO, Founder",
      lastContact: "2026-10-01",
      tags: "vip,, tech",
    });
    submit();
    expect(onSubmit.mock.calls[0][0].values).toEqual({
      name: "Jane",
      email: ["jane@x.test", "j@y.test"],
      phone: ["555"],
      company: ["[[Acme]]"],
      role: ["CTO", "Founder"],
      lastContact: "2026-10-01",
      tags: ["vip", "tech"],
    });
  });

  it("keeps plain text fields as strings and lists domain/industry", () => {
    const { fill, submit, onSubmit } = openCreate("company");
    fill({ name: "Acme", domain: "acme.test", industry: "Mfg, Retail", size: " 200 ", owner: "Sam" });
    submit();
    expect(onSubmit.mock.calls[0][0].values).toEqual({
      name: "Acme", domain: ["acme.test"], industry: ["Mfg", "Retail"], size: " 200 ", owner: ["[[Sam]]"],
    });
  });

  it("links the activity's with/related fields", () => {
    const { fill, submit, onSubmit } = openCreate("activity");
    fill({ subject: "Call", with: "Jane", related: "Website relaunch", when: "2026-10-02" });
    submit();
    expect(onSubmit.mock.calls[0][0].values).toEqual({
      subject: "Call", type: "Call", when: "2026-10-02", with: ["[[Jane]]"], related: ["[[Website relaunch]]"],
    });
  });

  it("links fields with a folder or entity suggestion source, and lists multitext without linking", () => {
    ENTITIES.widget = {
      folder: "Cadence/Widgets", label: "Widget", plural: "Widgets", columns: [],
      fields: [
        { key: "name", label: "Name", primary: true },
        { key: "doc", label: "Doc", suggestionSource: "folder:Shared" },
        { key: "deal", label: "Deal", suggestionSource: "entity:deal" },
        { key: "aliases", label: "Aliases", type: "multitext" },
        { key: "region", label: "Region", suggestionSource: "none" },
      ],
    };
    const { fill, submit, onSubmit } = openCreate("widget");
    fill({ name: "W", doc: "Spec", deal: "[[Big]]", aliases: "a, b", region: "EU, US" });
    submit();
    expect(onSubmit.mock.calls[0][0].values).toEqual({
      name: "W", doc: ["[[Spec]]"], deal: ["[[Big]]"], aliases: ["a", "b"], region: "EU, US",
    });
  });

  it("submits on Enter in a text input, but not in a select", () => {
    const { field, fill, onSubmit } = openCreate("deal");
    fill({ title: "Big" });
    const fromSelect = field("stage").trigger("keydown", { key: "Enter" });
    expect(fromSelect.defaultPrevented).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
    const fromInput = field("closeBy").trigger("keydown", { key: "Enter" });
    expect(fromInput.defaultPrevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0].name).toBe("Big");
  });

  it("calls onSubmit(null) once on Escape from any field, Cancel, or a plain close", () => {
    const escape = openCreate("deal");
    escape.field("stage").trigger("keydown", { key: "Escape" });
    expect(escape.onSubmit.mock.calls).toEqual([[null]]);
    const cancel = openCreate("deal");
    buttonByText(cancel.content, "Cancel").trigger("click");
    expect(cancel.onSubmit.mock.calls).toEqual([[null]]);
    expect(cancel.content.children).toHaveLength(0);
    const plain = openCreate("deal");
    plain.modal.close();
    expect(plain.onSubmit.mock.calls).toEqual([[null]]);
  });

  it("closes quietly without an onSubmit, but submitting then throws", () => {
    const modal: Any = new CadenceEntityCreateModal(app, "contact", {});
    modal.open();
    const content = contentOf(modal);
    expect(() => modal.close()).not.toThrow();
    modal.open();
    (content.findAll("input")[0] as FakeElement).value = "Jane";
    expect(() => buttonByText(content, "Create Contact").trigger("click")).toThrow(TypeError);
    expect(content.children).toHaveLength(0);
  });
});
