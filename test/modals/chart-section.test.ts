import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, Notice, type App, type FakeElement } from "../mocks/obsidian";
import { buttonByText, contentOf, optionTexts, optionValues } from "../helpers/dom";
import { ENTITIES } from "../../src/constants/entities";
import { CadenceChartSectionModal } from "../../src/modals/chart-section";

/* Characterization tests for the analytics chart block modal: target and
   field options, the link/group-by defaults it pre-selects, and the
   onSubmit payload. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let app: App;
beforeEach(() => {
  app = createMockApp();
  Notice.messages.length = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
});

function openChart(parentEntity: unknown) {
  const onSubmit = vi.fn();
  const modal: Any = new CadenceChartSectionModal(app, parentEntity as Any, onSubmit);
  const close = vi.spyOn(modal, "close");
  modal.open();
  const content = contentOf(modal);
  const [target, link, group, style] = content.findAll("select") as FakeElement[];
  const pick = (key: string) => {
    target.value = key;
    target.trigger("change");
  };
  return { modal, onSubmit, close, content, target, link, group, style, pick };
}

describe("CadenceChartSectionModal", () => {
  it("stores the parent entity and callback", () => {
    const onSubmit = vi.fn();
    const modal: Any = new CadenceChartSectionModal(app, "company", onSubmit);
    expect([modal.parentEntity, modal.onSubmit]).toEqual(["company", onSubmit]);
  });

  it("offers every entity except the parent as a target, as cross-section does", () => {
    const { content, target, link, group, style } = openChart("company");
    expect(content.findAll("h3").map((h) => h.text)).toEqual(["Add Analytics Chart Block"]);
    expect(optionValues(target)).toEqual(Object.keys(ENTITIES).filter((k) => k !== "company"));
    expect(optionTexts(target)[1]).toBe("Partners");
    expect(optionValues(link)).toEqual(["email", "phone", "company", "role", "lastContact", "tags"]);
    expect(optionValues(group)).toEqual(optionValues(link));
    expect(optionTexts(group)[0]).toBe("Email (email)");
    expect(optionValues(style)).toEqual(["donut", "bar", "kpi", "list"]);
    expect(content.findAll("button").map((b) => b.text)).toEqual(["Cancel", "Add Chart"]);
  });

  it("styles its labels through attr, as the other section modals do", () => {
    const { content } = openChart("company");
    const labels = content.findAll("label");
    expect(labels.map((l) => l.text)).toEqual([
      "Entity to chart:",
      "Link field (field on target that references this entity):",
      "Group by field (property to chart):",
      "Chart Style:",
    ]);
    for (const label of labels) {
      expect(label.attrs).toEqual({ style: "display: block; font-weight: 500; font-size: 0.85em; margin-bottom: 4px; margin-top: 12px;" });
    }
  });

  it("pre-selects the parent's key as link field and the first stage/status/type/priority field as group", () => {
    const { link, group, pick } = openChart("company");
    expect([link.value, group.value]).toEqual(["company", "email"]);
    pick("deal");
    expect([link.value, group.value]).toEqual(["company", "stage"]);
    pick("activity");
    expect([link.value, group.value]).toEqual(["company", "type"]);
    pick("project");
    expect([link.value, group.value]).toEqual(["status", "status"]);
  });

  it("falls back to the first field when nothing matches the parent", () => {
    const { link, group, pick } = openChart("partner");
    pick("registration");
    expect([link.value, group.value]).toEqual(["partner", "status"]);
    const unknown = openChart("zzz");
    expect([unknown.link.value, unknown.group.value]).toEqual(["email", "email"]);
  });

  it("submits an id, the parent, target, link, group and style, then closes", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    const { content, link, group, style, pick, onSubmit, close } = openChart("company");
    pick("deal");
    group.value = "owner";
    style.value = "bar";
    expect(link.value).toBe("company");
    buttonByText(content, "Add Chart").trigger("click");
    expect(onSubmit.mock.calls).toEqual([[{
      id: "ch_4fzzzxjy", parentEntity: "company", targetEntity: "deal", linkField: "company", groupField: "owner", style: "bar",
    }]]);
    expect(onSubmit.mock.invocationCallOrder[0]).toBeLessThan(close.mock.invocationCallOrder[0]);
  });

  it("won't submit a blank link or group field: it notices and stays open", () => {
    ENTITIES.gadget = { folder: "Cadence/Gadgets", label: "Gadget", plural: "Gadgets", columns: [], fields: [{ key: "name", label: "Name", primary: true }] };
    try {
      const { content, pick, link, onSubmit, close } = openChart("company");
      pick("gadget");
      expect(link.options).toHaveLength(0);
      buttonByText(content, "Add Chart").trigger("click");
      expect(Notice.messages).toEqual(["Gadgets have no field to link by."]);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
    } finally {
      delete ENTITIES.gadget;
    }
  });

  it("closes from Cancel without calling onSubmit", () => {
    const { content, onSubmit, close } = openChart("company");
    buttonByText(content, "Cancel").trigger("click");
    expect(close).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
