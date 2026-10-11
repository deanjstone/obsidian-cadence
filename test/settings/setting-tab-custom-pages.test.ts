import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Notice, type FakeElement } from "../mocks/obsidian";
import { buttonByText, optionTexts, optionValues } from "../helpers/dom";
import { makeSettingTab, restoreEntities, snapshotEntities } from "../helpers/setting-tab";
import { ENTITIES } from "../../src/constants/entities";

/* Characterization tests for the Custom Navigation Pages section of
   CadenceSettingTab.display(): the page table, deleting a page (which also
   drops its custom entity schema from the settings and from ENTITIES, unless
   another page still shows it or it is a core entity), and the
   add-page form (which derives an entity key from the label and registers
   a two-field schema). */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let entities: Record<string, Any>;
beforeEach(() => {
  Notice.messages.length = 0;
  entities = snapshotEntities();
});
afterEach(() => {
  restoreEntities(entities);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function shown(settings: Record<string, unknown> = {}) {
  const made = makeSettingTab({ settings });
  made.tab.display();
  made.calls.length = 0;
  return { ...made, section: pagesDiv(made.container) };
}

function pagesDiv(container: FakeElement): FakeElement {
  return container.children.find((c) => c.classes.includes("cad-custom-pages-container")) as FakeElement;
}

function rows(section: FakeElement): string[][] {
  const table = section.findAll("table")[0];
  if (!table) return [];
  return table.findAll("tbody")[0].findAll("tr").map((tr) => tr.children.map((td) => (td.children[0]?.text ?? td.text)));
}

function form(section: FakeElement) {
  const el = section.children.find((c) => c.classes.includes("cad-custom-page-add-form")) as FakeElement;
  const [label] = el.findAll("input");
  const [sectionSelect, layout, icon] = el.findAll("select");
  return { el, label, section: sectionSelect, layout, icon, add: buttonByText(el, "Add Page") };
}

const pages = [
  { id: "custom.2", label: "Vendors", sectionId: "crm", entityKey: "crm_vendor", defaultLayout: "kanban", icon: "users" },
  { id: "custom.1", label: "Areas", sectionId: "planner", entityKey: "planner_area", defaultLayout: "cards" },
  { id: "custom.3", label: "Ideas", sectionId: "inbox", entityKey: "contact" },
  { id: "custom.4", label: "Odd", sectionId: "reports", entityKey: "nope", defaultLayout: "list" },
];

describe("Custom Navigation Pages: list", () => {
  it("says so when there are no pages, then shows the add form", () => {
    const { section } = shown({ customPages: [] });
    expect(section.children.map((c) => [c.localName, c.text, c.classes])).toEqual([
      ["p", "No custom pages added yet.", ["setting-item-description"]],
      ["div", "", ["cad-custom-page-add-form"]],
    ]);
  });

  it("treats missing customPages as none", () => {
    const { section } = shown({ customPages: undefined });
    expect(section.children[0].text).toBe("No custom pages added yet.");
  });

  it("tabulates pages sorted by label, with section, entity and layout labels", () => {
    const { section } = shown({ customPages: pages });
    const table = section.findAll("table")[0];
    expect(table.classes).toEqual(["cad-prop-table"]);
    expect([table.style.width, table.style.marginBottom]).toEqual(["100%", "16px"]);
    expect(table.findAll("th").map((th) => th.text)).toEqual(["Label", "Section", "Entity Type", "Default Layout", "Actions"]);
    expect(rows(section)).toEqual([
      ["Areas", "Planner", "planner_area", "Card Grid ⚃", "Delete"],
      ["Ideas", "inbox", "Contact", "Table View ☰", "Delete"],
      ["Odd", "Reports", "nope", "list", "Delete"],
      ["Vendors", "CRM", "crm_vendor", "Kanban Board 🗂", "Delete"],
    ]);
    expect(section.children.map((c) => c.localName)).toEqual(["table", "div"]);
  });

  it("shows an unknown default layout by its stored value, not an empty cell", () => {
    const { section } = shown({ customPages: [pages[3]] });
    const layoutCell = section.findAll("tbody")[0].findAll("tr")[0].children[3];
    expect(layoutCell.text).toBe("list");
  });

  it("does not reorder the stored pages when sorting the table", () => {
    const { plugin } = shown({ customPages: pages });
    expect(plugin.settings.customPages.map((p: Any) => p.id)).toEqual(["custom.2", "custom.1", "custom.3", "custom.4"]);
  });

  it("styles each Delete button as an error-coloured compact button", () => {
    const { section } = shown({ customPages: pages.slice(0, 1) });
    const del = buttonByText(section, "Delete");
    expect(del.classes).toEqual(["cad-btn"]);
    expect([del.style.color, del.style.padding, del.style.height]).toEqual(["var(--text-error)", "2px 8px", "auto"]);
  });
});

describe("Custom Navigation Pages: delete", () => {
  it("removes the page, its custom entity schema and its ENTITIES entry, then saves, refreshes and redraws", async () => {
    ENTITIES.crm_vendor = { folder: "Cadence/Vendors", label: "Vendor", plural: "Vendors", fields: [], columns: ["name"] };
    const { section, plugin, calls, container } = shown({
      customPages: pages.slice(0, 2),
      customEntities: { crm_vendor: [{ key: "name", label: "Name" }], planner_area: [] },
    });
    const vendorsRow = section.findAll("tr").find((tr) => tr.children[0]?.text === "Vendors") as FakeElement;
    vendorsRow.findAll("button")[0].trigger("click");
    await vi.waitFor(() => expect(calls).toEqual(["save", "refresh", "display"]));
    expect(plugin.settings.customPages.map((p: Any) => p.id)).toEqual(["custom.1"]);
    expect(Object.keys(plugin.settings.customEntities)).toEqual(["planner_area"]);
    expect(ENTITIES.crm_vendor).toBeUndefined();
    expect(rows(pagesDiv(container))).toEqual([["Areas", "Planner", "planner_area", "Card Grid ⚃", "Delete"]]);
  });

  it("tolerates a page with no schema and no registry entry", async () => {
    const { section, plugin, calls } = shown({ customPages: [pages[1]], customEntities: undefined });
    buttonByText(section, "Delete").trigger("click");
    await vi.waitFor(() => expect(calls).toEqual(["save", "refresh", "display"]));
    expect(plugin.settings.customPages).toEqual([]);
    expect(plugin.settings.customEntities).toBeUndefined();
  });

  it("does nothing when the row's page is already gone", async () => {
    const { section, plugin, calls } = shown({ customPages: [pages[1]] });
    plugin.settings.customPages = [];
    buttonByText(section, "Delete").trigger("click");
    await Promise.resolve();
    expect(calls).toEqual([]);
  });

  it("deleting one of two pages that share an entity keeps the schema the other still shows", async () => {
    const vendor = { folder: "Cadence/Vendors", label: "Vendor", plural: "Vendors", fields: [], columns: ["name"] };
    ENTITIES.crm_vendor = vendor;
    const schema: Any[] = [];
    const twin = { ...pages[0], id: "custom.9", label: "Vendors again" };
    const { section, plugin, calls } = shown({ customPages: [pages[0], twin], customEntities: { crm_vendor: schema } });
    buttonByText(section, "Delete").trigger("click");
    await vi.waitFor(() => expect(calls).toEqual(["save", "refresh", "display"]));
    expect(plugin.settings.customPages.map((p: Any) => p.id)).toEqual(["custom.9"]);
    expect(plugin.settings.customEntities.crm_vendor).toBe(schema);
    expect(ENTITIES.crm_vendor).toBe(vendor);
  });

  it("a page pointed at a core entity never deletes that core entity from ENTITIES or the settings", async () => {
    const contact = ENTITIES.contact;
    const schema: Any[] = [];
    const { section, plugin, calls } = shown({ customPages: [pages[2]], customEntities: { contact: schema } });
    buttonByText(section, "Delete").trigger("click");
    await vi.waitFor(() => expect(calls).toEqual(["save", "refresh", "display"]));
    expect(plugin.settings.customPages).toEqual([]);
    expect(ENTITIES.contact).toBe(contact);
    expect(plugin.settings.customEntities.contact).toBe(schema);
  });
});

describe("Custom Navigation Pages: add form", () => {
  it("draws the form with its label input and three selects", () => {
    const { section } = shown();
    const f = form(section);
    expect(f.el.style).toMatchObject({ border: "1px dashed var(--border-color)", borderRadius: "8px", padding: "12px", marginTop: "16px", background: "var(--background-primary-alt)" });
    expect(f.el.children[0].localName).toBe("h4");
    expect(f.el.children[0].text).toBe("+ Add Custom Navigation Page");
    expect(f.el.findAll("label").map((l) => l.text)).toEqual(["Label:", "Sidebar Section:", "Default Layout:", "Icon:"]);
    expect([f.label.type, f.label.placeholder]).toEqual(["text", "e.g. VIP Contacts"]);
    expect(optionValues(f.section)).toEqual(["planner", "projects", "crm", "prm", "workflow", "reports"]);
    expect(optionTexts(f.section)).toEqual(["Planner", "Projects", "CRM", "PRM", "Workflow", "Reports"]);
    expect(optionValues(f.layout)).toEqual(["table", "kanban", "cards"]);
    expect(optionTexts(f.layout)).toEqual(["Table view ☰", "Kanban board 🗂", "Card grid ⚃"]);
    expect(optionValues(f.icon)).toEqual([
      "file-text", "folder-kanban", "users", "building-2", "trending-up", "handshake", "target", "zap", "wallet",
      "clipboard-check", "award", "calendar", "star", "tag", "compass", "database", "check-square",
    ]);
    expect(optionTexts(f.icon)[0]).toBe("📄 Document (Default)");
    expect(optionTexts(f.icon)[16]).toBe("☑️ Checkbox / Tasks");
    expect(f.add.classes).toEqual(["cad-btn", "primary"]);
  });

  it("refuses a blank label with a notice", async () => {
    const { section, plugin, calls } = shown();
    const f = form(section);
    f.label.value = "   ";
    f.add.trigger("click");
    await Promise.resolve();
    expect(Notice.messages).toEqual(["Please enter a page label."]);
    expect(calls).toEqual([]);
    expect(plugin.settings.customPages).toEqual([]);
  });

  it("adds a page: singular entity key, registered schema, layout preference, notice, then redraw", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: 1_700_000_000_000 });
    const { section, plugin, calls } = shown();
    const f = form(section);
    f.label.value = "  Products ";
    f.section.value = "crm";
    f.layout.value = "kanban";
    f.icon.value = "wallet";
    f.add.trigger("click");
    await vi.waitFor(() => expect(calls).toEqual(["save", "refresh", "display"]));
    const fields = [
      { key: "name", label: "Name", primary: true, type: "text" },
      { key: "type", label: "Type", type: "text" },
    ];
    expect(plugin.settings.customPages).toEqual([
      { id: "custom.1700000000000", label: "Products", icon: "wallet", entityKey: "crm_product", defaultLayout: "kanban", sectionId: "crm" },
    ]);
    expect(plugin.settings.customEntities.crm_product).toEqual(fields);
    expect(ENTITIES.crm_product).toEqual({ folder: "Cadence/Products", label: "Product", plural: "Products", fields, columns: ["name"] });
    expect(ENTITIES.crm_product.fields).toBe(plugin.settings.customEntities.crm_product);
    expect(plugin.settings.pageLayouts).toEqual({ "custom.1700000000000": "kanban" });
    expect(Notice.messages).toEqual(['Page "Products" added successfully.']);
  });

  it("uses the first option of each select by default", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: 5 });
    const { section, plugin, calls } = shown({ customPages: undefined, pageLayouts: undefined, customEntities: undefined });
    const f = form(section);
    f.label.value = "VIP Contacts";
    f.add.trigger("click");
    await vi.waitFor(() => expect(calls).toEqual(["save", "refresh", "display"]));
    expect(plugin.settings.customPages).toEqual([
      { id: "custom.5", label: "VIP Contacts", icon: "file-text", entityKey: "planner_vip_contact", defaultLayout: "table", sectionId: "planner" },
    ]);
    expect(plugin.settings.pageLayouts).toEqual({ "custom.5": "table" });
    expect(ENTITIES.planner_vip_contact.label).toBe("VIP Contact");
    expect(ENTITIES.planner_vip_contact.folder).toBe("Cadence/VIP Contacts");
  });

  it("derives the key and label: trailing s or S dropped, spaces to underscores, all-caps kept", async () => {
    const cases: Array<[string, string, string]> = [
      ["CPIS", "planner_cpi", "CPI"],
      ["deals", "planner_deal", "Deal"],
      ["Team  Members", "planner_team_member", "Team  Member"],
      ["Inventory", "planner_inventory", "Inventory"],
      ["s", "planner_s", "S"],
    ];
    for (const [label, key, entityLabel] of cases) {
      const { section, calls } = shown();
      const f = form(section);
      f.label.value = label;
      f.add.trigger("click");
      await vi.waitFor(() => expect(calls).toContain("display"));
      expect([label, ENTITIES[key]?.label, ENTITIES[key]?.plural]).toEqual([label, entityLabel, label]);
    }
  });

  it("QUIRK: any trailing s is treated as a plural ('Status' → statu, 'Class' → Clas)", async () => {
    for (const [label, key, entityLabel] of [["Status", "crm_statu", "Statu"], ["Class", "crm_clas", "Clas"]]) {
      const { section, calls } = shown();
      const f = form(section);
      f.label.value = label;
      f.section.value = "crm";
      f.add.trigger("click");
      await vi.waitFor(() => expect(calls).toContain("display"));
      expect(ENTITIES[key].label).toBe(entityLabel);
    }
  });

  it("reuses an existing schema for the derived key instead of replacing it", async () => {
    const existing = [{ key: "name", label: "Name", primary: true, type: "text" }, { key: "sku", label: "SKU", type: "text" }];
    const { section, plugin, calls } = shown({ customEntities: { prm_product: existing } });
    const f = form(section);
    f.label.value = "Products";
    f.section.value = "prm";
    f.add.trigger("click");
    await vi.waitFor(() => expect(calls).toContain("display"));
    expect(plugin.settings.customEntities.prm_product).toBe(existing);
    expect(ENTITIES.prm_product.fields).toBe(existing);
  });

  it("refuses the same label twice, with a notice, rather than a second page on the same entity", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: 10 });
    const first = shown();
    form(first.section).label.value = "Products";
    form(first.section).add.trigger("click");
    await vi.waitFor(() => expect(first.calls).toContain("display"));
    first.calls.length = 0;
    Notice.messages.length = 0;
    vi.setSystemTime(11);
    const again = form(pagesDiv(first.container));
    again.label.value = "Products";
    again.add.trigger("click");
    await vi.waitFor(() => expect(Notice.messages).toHaveLength(1));
    expect(Notice.messages).toEqual(['A page for this entity already exists: "Products".']);
    expect(first.calls).toEqual([]);
    expect(first.plugin.settings.customPages.map((p: Any) => [p.id, p.entityKey])).toEqual([
      ["custom.10", "planner_product"],
    ]);
  });
});
