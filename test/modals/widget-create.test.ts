import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, Notice, type App, type FakeElement } from "../mocks/obsidian";
import { buttonByText, contentOf, optionTexts, optionValues } from "../helpers/dom";
import { CadenceWidgetCreateModal } from "../../src/modals/widget-create";

/* Characterization tests for the dashboard chart-widget modal: the
   two-argument constructor form, the group-by options per entity, the
   blank-title guard and the onSubmit payload. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const NOW = new Date("2026-10-08T10:00:00Z");

let app: App;
beforeEach(() => {
  app = createMockApp();
  Notice.messages.length = 0;
  vi.useFakeTimers({ now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
});

function openWidget(entityKey?: unknown) {
  const onSubmit = vi.fn();
  const modal: Any = entityKey === undefined
    ? new CadenceWidgetCreateModal(app, onSubmit)
    : new CadenceWidgetCreateModal(app, entityKey as Any, onSubmit);
  const close = vi.spyOn(modal, "close");
  modal.open();
  const content = contentOf(modal);
  const [title] = content.findAll("input") as FakeElement[];
  const [groupBy, style] = content.findAll("select") as FakeElement[];
  return { modal, onSubmit, close, content, title, groupBy, style };
}

describe("CadenceWidgetCreateModal", () => {
  it("accepts (app, onSubmit) and defaults the entity to project", () => {
    const onSubmit = vi.fn();
    const two: Any = new CadenceWidgetCreateModal(app, onSubmit);
    expect([two.entityKey, two.onSubmit]).toEqual(["project", onSubmit]);
    const three: Any = new CadenceWidgetCreateModal(app, "deal", onSubmit);
    expect([three.entityKey, three.onSubmit]).toEqual(["deal", onSubmit]);
    const falsy: Any = new CadenceWidgetCreateModal(app, "", onSubmit);
    expect(falsy.entityKey).toBe("project");
  });

  it("renders title input, non-primary group-by fields and the four chart styles", () => {
    const { content, title, groupBy, style } = openWidget("deal");
    expect(content.classes).toEqual(["cad-prompt-modal"]);
    expect(content.findAll("h3").map((h) => h.text)).toEqual(["Add Custom Chart Widget"]);
    expect(content.findAll("label").map((l) => l.text)).toEqual([
      "Chart Title:",
      "Group DEALS by Property:",
      "Chart Style:",
    ]);
    expect(title.placeholder).toBe("e.g. DEAL by Group");
    expect(optionValues(groupBy)).toEqual(["stage", "value", "company", "contact", "owner", "closeBy"]);
    expect(optionTexts(groupBy)[0]).toBe("Stage (stage)");
    expect(optionValues(style)).toEqual(["donut", "bar", "kpi", "list"]);
    expect(optionTexts(style)).toEqual(["Donut Chart 🍩", "Horizontal Bar Chart 📊", "KPI Cards Grid 🗃️", "Simple List 📋"]);
    expect(content.findAll("button").map((b) => b.text)).toEqual(["Cancel", "Create Widget"]);
    vi.runAllTimers();
    expect(title.focusCount).toBe(1);
  });

  it("uses the raw key and offers no fields for an unknown entity", () => {
    const { content, title, groupBy } = openWidget("zzz");
    expect(content.findAll("label")[1].text).toBe("Group ZZZ by Property:");
    expect(title.placeholder).toBe("e.g. ZZZ by Group");
    expect(groupBy.options).toHaveLength(0);
  });

  it("warns and refocuses on a blank title without submitting or closing", () => {
    const { content, title, onSubmit, close } = openWidget();
    title.value = "   ";
    buttonByText(content, "Create Widget").trigger("click");
    expect(Notice.messages).toEqual(["Please enter a chart title."]);
    expect(title.focusCount).toBe(1);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("submits a timestamped widget config with the trimmed title, then closes", () => {
    const { content, title, groupBy, style, onSubmit, close } = openWidget();
    title.value = "  Projects by status ";
    expect(groupBy.value).toBe("status");
    style.value = "kpi";
    buttonByText(content, "Create Widget").trigger("click");
    expect(onSubmit.mock.calls).toEqual([[{
      id: `widget.${NOW.getTime()}`,
      title: "Projects by status",
      groupBy: "status",
      style: "kpi",
    }]]);
    expect(close).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.invocationCallOrder[0]).toBeLessThan(close.mock.invocationCallOrder[0]);
  });

  it("submits an empty groupBy when the entity has no fields", () => {
    const { content, title, onSubmit } = openWidget("zzz");
    title.value = "T";
    buttonByText(content, "Create Widget").trigger("click");
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ groupBy: "", style: "donut" });
  });

  it("closes from Cancel without calling onSubmit (no onClose callback)", () => {
    const { content, onSubmit, close } = openWidget();
    buttonByText(content, "Cancel").trigger("click");
    expect(close).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
