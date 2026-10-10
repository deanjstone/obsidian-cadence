import { afterEach, describe, expect, it, vi } from "vitest";
import { ENTITIES } from "../../src/constants/entities";
import { buildChartSectionConfig, chartSectionDefaults } from "../../src/modals/chart-section";
import { buildCrossSectionConfig } from "../../src/modals/cross-section";
import { buildWidgetConfig } from "../../src/modals/widget-create";

/* Direct tests for the pure seams lifted out of the widget, cross-section
   and chart-section modals. The modal-level characterization tests still
   exercise them through onOpen(). */

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("buildWidgetConfig", () => {
  it("returns null for a blank or whitespace title", () => {
    expect(buildWidgetConfig({ title: "", groupBy: "status", style: "donut" })).toBeNull();
    expect(buildWidgetConfig({ title: " \t ", groupBy: "status", style: "donut" })).toBeNull();
  });

  it("trims the title and stamps a widget.<Date.now()> id", () => {
    vi.useFakeTimers({ now: new Date("2026-10-08T10:00:00Z") });
    expect(buildWidgetConfig({ title: " Deals by stage ", groupBy: "stage", style: "bar" })).toEqual({
      id: `widget.${Date.parse("2026-10-08T10:00:00Z")}`,
      title: "Deals by stage",
      groupBy: "stage",
      style: "bar",
    });
  });

  it("passes groupBy and style through unchecked, empty included", () => {
    expect(buildWidgetConfig({ title: "T", groupBy: "", style: "not-a-style" })).toMatchObject({ groupBy: "", style: "not-a-style" });
  });
});

describe("buildCrossSectionConfig", () => {
  const form = { parentEntity: "company", targetEntity: "deal", linkField: "company", viewType: "tile" };

  it("adds an xs_ id from up to 8 base-36 digits of Math.random", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    expect(buildCrossSectionConfig(form)).toEqual({ id: "xs_4fzzzxjy", ...form });
  });

  it("puts id first and copies the form without mutating it", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const config = buildCrossSectionConfig(form);
    expect(Object.keys(config)).toEqual(["id", "parentEntity", "targetEntity", "linkField", "viewType"]);
    expect(config.id).toBe("xs_i");
    expect(form).not.toHaveProperty("id");
  });
});

describe("buildChartSectionConfig", () => {
  it("copies exactly the four form fields into a new object", () => {
    const form = { targetEntity: "deal", linkField: "company", groupField: "stage", style: "kpi", extra: 1 };
    const config = buildChartSectionConfig(form);
    expect(config).toEqual({ targetEntity: "deal", linkField: "company", groupField: "stage", style: "kpi" });
    expect(config).not.toBe(form);
  });
});

describe("chartSectionDefaults", () => {
  it("links on the parent's key and groups on the first stage/status/type/priority field in field order", () => {
    expect(chartSectionDefaults(["stage", "value", "company", "owner"], "company")).toEqual({ linkField: "company", groupField: "stage" });
    expect(chartSectionDefaults(["priority", "status"], "deal")).toEqual({ linkField: undefined, groupField: "priority" });
  });

  it("also links on the parent's lower-cased label, e.g. for a custom entity", () => {
    ENTITIES.acct = { folder: "Cadence/Accounts", label: "Account", plural: "Accounts", fields: [], columns: [] };
    try {
      expect(chartSectionDefaults(["Account", "account", "acct"], "acct")).toEqual({ linkField: "account", groupField: undefined });
    } finally {
      delete ENTITIES.acct;
    }
  });

  it("finds no link field for an unknown parent entity", () => {
    expect(chartSectionDefaults(["zzz", "status"], "zzz")).toEqual({ linkField: undefined, groupField: "status" });
    expect(chartSectionDefaults([], "company")).toEqual({ linkField: undefined, groupField: undefined });
  });
});
