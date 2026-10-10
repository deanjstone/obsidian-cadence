import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, type App, type FakeElement } from "../mocks/obsidian";
import { buttonByText, contentOf, optionTexts, optionValues } from "../helpers/dom";
import { ENTITIES } from "../../src/constants/entities";
import { CadenceCrossSectionModal } from "../../src/legacy/cadence.js";

/* Characterization tests for the cross-linked section modal: which target
   entities and link fields it offers, how the field list follows the
   target, and the onSubmit payload with its random id. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let app: App;
beforeEach(() => {
  app = createMockApp();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function openCrossSection(parentEntity: unknown) {
  const onSubmit = vi.fn();
  const modal: Any = new CadenceCrossSectionModal(app, parentEntity, onSubmit);
  const close = vi.spyOn(modal, "close");
  modal.open();
  const content = contentOf(modal);
  const [target, field, view] = content.findAll("select") as FakeElement[];
  return { modal, onSubmit, close, content, target, field, view };
}

describe("CadenceCrossSectionModal", () => {
  it("stores the parent entity and callback", () => {
    const onSubmit = vi.fn();
    const modal: Any = new CadenceCrossSectionModal(app, "company", onSubmit);
    expect([modal.parentEntity, modal.onSubmit]).toEqual(["company", onSubmit]);
  });

  it("offers every entity except the parent, then the first target's non-primary fields", () => {
    const { content, target, field, view } = openCrossSection("company");
    expect(content.findAll("h3").map((h) => h.text)).toEqual(["Add Cross-Linked Section"]);
    expect(optionValues(target)).toEqual(Object.keys(ENTITIES).filter((k) => k !== "company"));
    expect(optionTexts(target).slice(0, 2)).toEqual(["Contacts", "Partners"]);
    expect(optionValues(field)).toEqual(["email", "phone", "company", "role", "lastContact", "tags"]);
    expect(optionTexts(field)[2]).toBe("Company (company)");
    expect(optionValues(view)).toEqual(["table", "tile", "kanban"]);
    expect(optionTexts(view)).toEqual(["Table 📋", "Tiles / Cards 🎴", "Kanban Board 🗂️"]);
    expect(content.findAll("button").map((b) => b.text)).toEqual(["Cancel", "Add Section"]);
  });

  it("offers every entity when the parent is not an entity key", () => {
    const { target } = openCrossSection(undefined);
    expect(optionValues(target)).toEqual(Object.keys(ENTITIES));
  });

  it("repopulates the link fields when the target changes", () => {
    const { target, field } = openCrossSection("company");
    target.value = "deal";
    target.trigger("change");
    expect(optionValues(field)).toEqual(["stage", "value", "company", "contact", "owner", "closeBy"]);
    expect(field.value).toBe("stage");
  });

  it("submits the selections with an xs_ id from Math.random, then closes", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    const { content, target, field, view, onSubmit, close } = openCrossSection("company");
    target.value = "deal";
    target.trigger("change");
    field.value = "company";
    view.value = "kanban";
    buttonByText(content, "Add Section").trigger("click");
    expect(onSubmit.mock.calls).toEqual([[{
      id: "xs_4fzzzxjy",
      parentEntity: "company",
      targetEntity: "deal",
      linkField: "company",
      viewType: "kanban",
    }]]);
    expect(onSubmit.mock.invocationCallOrder[0]).toBeLessThan(close.mock.invocationCallOrder[0]);
  });

  it("can produce a short id when Math.random has few base-36 digits (flagged)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { content, onSubmit } = openCrossSection("company");
    buttonByText(content, "Add Section").trigger("click");
    expect(onSubmit.mock.calls[0][0]).toEqual({
      id: "xs_i",
      parentEntity: "company",
      targetEntity: "contact",
      linkField: "email",
      viewType: "table",
    });
  });

  it("closes from Cancel without calling onSubmit", () => {
    const { content, onSubmit, close } = openCrossSection("company");
    buttonByText(content, "Cancel").trigger("click");
    expect(close).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
