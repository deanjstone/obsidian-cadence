import { describe, expect, it } from "vitest";
import {
  addCustomPage,
  customEntityLabel,
  customPageEntityKey,
  customPageLayoutLabel,
  customPageRows,
  deleteCustomPage,
  ICON_OPTIONS,
  LAYOUT_OPTIONS,
  SECTION_OPTIONS,
  sectionLabel,
} from "../../src/settings/custom-pages";
import type { EntityDef } from "../../src/types/entities";
import type { CustomPage, SettingTabSettings } from "../../src/types/settings";

/* Direct tests for the custom-page seams, over a plain registry and plain
   settings (no ENTITIES, no view). */

const settings = (extra: Partial<SettingTabSettings> = {}) =>
  ({ dailyNoteFolder: "daily", tasksHeading: "", journalHeading: "", cadenceApiUrl: "", cadenceApiToken: "", ...extra }) as SettingTabSettings;

const def = (label: string): EntityDef => ({ folder: `F/${label}`, label, plural: `${label}s`, fields: [], columns: [] });

const page = (id: string, label: string, extra: Partial<CustomPage> = {}): CustomPage => ({ id, label, sectionId: "crm", entityKey: "crm_x", ...extra });

describe("labels and options", () => {
  it("labels the six sections and passes any other id through", () => {
    expect(SECTION_OPTIONS.map((o) => sectionLabel(o.value))).toEqual(["Planner", "Projects", "CRM", "PRM", "Workflow", "Reports"]);
    expect(sectionLabel("inbox")).toBe("inbox");
    expect(sectionLabel("")).toBe("");
  });

  it("labels layouts in title case, defaulting to Table, undefined when unknown", () => {
    expect(["table", "kanban", "cards", undefined, "", "list"].map(customPageLayoutLabel)).toEqual([
      "Table View ☰", "Kanban Board 🗂", "Card Grid ⚃", "Table View ☰", "Table View ☰", undefined,
    ]);
    expect(LAYOUT_OPTIONS.map((o) => o.label)).toEqual(["Table view ☰", "Kanban board 🗂", "Card grid ⚃"]);
  });

  it("offers 17 icons, the document first", () => {
    expect(ICON_OPTIONS).toHaveLength(17);
    expect(ICON_OPTIONS[0]).toEqual({ value: "file-text", label: "📄 Document (Default)" });
  });
});

describe("customPageRows", () => {
  it("sorts a copy by label and labels section, entity and layout", () => {
    const pages = [page("2", "beta", { entityKey: "known", defaultLayout: "kanban" }), page("1", "Alpha", { sectionId: "odd" })];
    const rows = customPageRows(pages, { known: def("Known") });
    expect(rows.map(({ page: p, ...rest }) => [p.id, rest])).toEqual([
      ["1", { label: "Alpha", section: "odd", entity: "crm_x", layout: "Table View ☰" }],
      ["2", { label: "beta", section: "CRM", entity: "Known", layout: "Kanban Board 🗂" }],
    ]);
    expect(pages.map((p) => p.id)).toEqual(["2", "1"]);
  });
});

describe("customPageEntityKey and customEntityLabel", () => {
  it("drops one trailing s or S and joins words with underscores", () => {
    expect(customPageEntityKey("Products", "crm")).toEqual({ singular: "Product", entityKey: "crm_product" });
    expect(customPageEntityKey("VIP Contacts", "prm")).toEqual({ singular: "VIP Contact", entityKey: "prm_vip_contact" });
    expect(customPageEntityKey("CPIS", "x")).toEqual({ singular: "CPI", entityKey: "x_cpi" });
    expect(customPageEntityKey("Glass", "x").singular).toBe("Glas");
    expect(customPageEntityKey("s", "x")).toEqual({ singular: "s", entityKey: "x_s" });
    expect(customPageEntityKey("a\tb  c", "x").entityKey).toBe("x_a_b_c");
  });

  it("capitalises unless the label is already all upper case", () => {
    expect(["product", "CPI", "iPhone", "VIP list", "123"].map(customEntityLabel)).toEqual(["Product", "CPI", "IPhone", "VIP list", "123"]);
  });
});

describe("addCustomPage", () => {
  it("refuses a blank label and changes nothing", () => {
    const s = settings();
    const entities: Record<string, EntityDef> = {};
    expect(addCustomPage(s, entities, { label: "  ", sectionId: "crm", layout: "table", icon: "" }, 1)).toEqual({ notice: "Please enter a page label." });
    expect(s).toEqual(settings());
    expect(entities).toEqual({});
  });

  it("registers the schema, entity, page and layout preference in place", () => {
    const s = settings();
    const entities: Record<string, EntityDef> = {};
    const result = addCustomPage(s, entities, { label: " Tools ", sectionId: "workflow", layout: "cards", icon: "" }, 42);
    const fields = [{ key: "name", label: "Name", primary: true, type: "text" }, { key: "type", label: "Type", type: "text" }];
    const added = { id: "custom.42", label: "Tools", icon: "file-text", entityKey: "workflow_tool", defaultLayout: "cards", sectionId: "workflow" };
    expect(result).toEqual({ notice: 'Page "Tools" added successfully.', page: added });
    expect(s.customPages).toEqual([added]);
    expect(s.customEntities).toEqual({ workflow_tool: fields });
    expect(s.pageLayouts).toEqual({ "custom.42": "cards" });
    expect(entities.workflow_tool).toEqual({ folder: "Cadence/Tools", label: "Tool", plural: "Tools", fields, columns: ["name"] });
    expect(entities.workflow_tool.fields).toBe(s.customEntities!.workflow_tool);
  });

  it("appends to existing pages and reuses an existing schema", () => {
    const schema = [{ key: "name", label: "Name" }];
    const existing = page("custom.1", "Old");
    const s = settings({ customPages: [existing], customEntities: { crm_tool: schema }, pageLayouts: { a: "table" } });
    const entities: Record<string, EntityDef> = { crm_tool: def("Previous") };
    addCustomPage(s, entities, { label: "Tools", sectionId: "crm", layout: "table", icon: "zap" }, 7);
    expect(s.customPages!.map((p) => p.id)).toEqual(["custom.1", "custom.7"]);
    expect(s.customPages![1].icon).toBe("zap");
    expect(entities.crm_tool.fields).toBe(schema);
    expect(entities.crm_tool.label).toBe("Tool");
    expect(s.pageLayouts).toEqual({ a: "table", "custom.7": "table" });
  });
});

describe("deleteCustomPage", () => {
  it("removes the page, its schema and its entity; false when the id is unknown", () => {
    const s = settings({ customPages: [page("a", "A", { entityKey: "k" }), page("b", "B")], customEntities: { k: [], other: [] } });
    const entities: Record<string, EntityDef> = { k: def("K"), other: def("O") };
    expect(deleteCustomPage(s, entities, "zz")).toBe(false);
    expect(s.customPages).toHaveLength(2);
    expect(deleteCustomPage(s, entities, "a")).toBe(true);
    expect(s.customPages!.map((p) => p.id)).toEqual(["b"]);
    expect(Object.keys(s.customEntities!)).toEqual(["other"]);
    expect(Object.keys(entities)).toEqual(["other"]);
  });

  it("tolerates a missing schema map and registry entry", () => {
    const s = settings({ customPages: [page("a", "A")] });
    expect(deleteCustomPage(s, {}, "a")).toBe(true);
    expect(s.customPages).toEqual([]);
    expect(s.customEntities).toBeUndefined();
  });
});
