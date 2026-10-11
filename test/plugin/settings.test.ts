import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENTITIES } from "../../src/constants/entities";
import { DEFAULT_SETTINGS } from "../../src/constants/settings";
import { fmtValue } from "../../src/utils/format";
import { restoreEntities, snapshotEntities } from "../helpers/setting-tab";
import { makePlugin } from "../helpers/plugin";

/* Characterization tests for CadencePlugin.loadSettings (merge with the
   defaults, custom-entity rebuild into ENTITIES), saveSettings and
   registerCustomPropertyTypes. ENTITIES is shared module state, so it is
   restored after each test. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/* The registration-parity snapshot's settings: what loadSettings() gives
   with no saved data, captured from v0.15.0. */
const originalSettings = JSON.parse(readFileSync("test/fixtures/registrations.original.json", "utf8")).settings;

let entitiesSnapshot: Record<string, Any>;
beforeEach(() => {
  entitiesSnapshot = snapshotEntities();
});
afterEach(() => {
  restoreEntities(entitiesSnapshot);
  vi.restoreAllMocks();
});

async function loaded(data: unknown) {
  const made = makePlugin({ data });
  await made.plugin.loadSettings();
  return made;
}

const field = (key: string, extra: Record<string, unknown> = {}) => ({ key, label: key, ...extra });

describe("loadSettings: merge with the defaults", () => {
  it("gives the v0.15.0 default settings when nothing is saved", async () => {
    const { plugin } = await loaded(null);
    expect(JSON.parse(JSON.stringify(plugin.settings))).toEqual(originalSettings);
  });

  it("returns nothing", async () => {
    const { plugin } = makePlugin({ data: {} });
    expect(await plugin.loadSettings()).toBeUndefined();
  });

  it("lets saved values override the defaults and keeps unknown keys", async () => {
    const { plugin } = await loaded({ defaultTab: "crm.pipeline", weekStartsOn: 0, unknownKey: 7 });
    expect(plugin.settings.defaultTab).toBe("crm.pipeline");
    expect(plugin.settings.weekStartsOn).toBe(0);
    expect(plugin.settings.unknownKey).toBe(7);
    expect(plugin.settings.dailyNoteFolder).toBe("daily");
  });

  it("merges shallowly: a saved modules object replaces the default one whole", async () => {
    const { plugin } = await loaded({ modules: { prm: true } });
    expect(plugin.settings.modules).toEqual({ prm: true });
  });

  it("with no saved data, nested defaults are copied, never shared between loads or with DEFAULT_SETTINGS", async () => {
    const a = await loaded(null);
    const b = await loaded(undefined);
    expect(a.plugin.settings).not.toBe(b.plugin.settings);
    for (const key of ["reminders", "customEntities", "modules", "collapsedGroups", "pageLayouts", "customPages"]) {
      expect(a.plugin.settings[key]).not.toBe(b.plugin.settings[key]);
      expect(a.plugin.settings[key]).not.toBe((DEFAULT_SETTINGS as Any)[key]);
    }
    expect(a.plugin.settings.customEntities.project).not.toBe(b.plugin.settings.customEntities.project);
    a.plugin.settings.modules.prm = true;
    a.plugin.settings.reminders.push({ id: "r" });
    expect(b.plugin.settings.modules.prm).toBe(false);
    expect(b.plugin.settings.reminders).toEqual([]);
    expect(DEFAULT_SETTINGS.modules.prm).toBe(false);
    expect(DEFAULT_SETTINGS.reminders).toEqual([]);
    expect(DEFAULT_SETTINGS.customEntities.project.map((f) => f.key)).not.toContain("type");
  });

  it("keeps the saved customEntities object and its non-empty lists", async () => {
    const contact = [field("name", { primary: true }), field("type")];
    const saved = { contact };
    const { plugin } = await loaded({ customEntities: saved });
    expect(plugin.settings.customEntities).toBe(saved);
    expect(plugin.settings.customEntities.contact).toBe(contact);
  });

  it("fills missing or empty entity schemas with copies of the defaults", async () => {
    const a = await loaded({ customEntities: { deal: [] } });
    const b = await loaded({ customEntities: {} });
    expect(a.plugin.settings.customEntities.deal.map((f: Any) => f.key)).toEqual([
      "title", "stage", "value", "company", "contact", "closeBy", "project", "owner", "type",
    ]);
    expect(a.plugin.settings.customEntities.deal).not.toBe(b.plugin.settings.customEntities.deal);
    expect(a.plugin.settings.customEntities.deal[0]).not.toBe(b.plugin.settings.customEntities.deal[0]);
    expect(Object.keys(b.plugin.settings.customEntities)).toEqual(Object.keys(originalSettings.customEntities));
  });

  it("replaces a null customEntities", async () => {
    const { plugin } = await loaded({ customEntities: null });
    expect(Object.keys(plugin.settings.customEntities)).toHaveLength(11);
  });

  it("adds the two default widgets to each dashboard with none", async () => {
    const { plugin } = await loaded({ projectDashboardWidgets: [], crmDashboardWidgets: null });
    expect(plugin.settings.projectDashboardWidgets).toEqual([
      { id: "w1", title: "Projects by Status", groupBy: "status", style: "donut" },
      { id: "w2", title: "Projects by Priority", groupBy: "priority", style: "bar" },
    ]);
    expect(plugin.settings.crmDashboardWidgets).toEqual([
      { id: "c1", title: "Deals by Stage", groupBy: "stage", style: "donut" },
      { id: "c2", title: "Deals by Owner", groupBy: "owner", style: "bar" },
    ]);
    expect(plugin.settings.prmDashboardWidgets).toEqual([
      { id: "p1", title: "Partners by Tier", groupBy: "tier", style: "donut" },
      { id: "p2", title: "Partners by Status", groupBy: "status", style: "bar" },
    ]);
  });

  it("keeps saved widgets", async () => {
    const widgets = [{ id: "x", title: "Mine", groupBy: "owner", style: "bar" }];
    const { plugin } = await loaded({ crmDashboardWidgets: widgets });
    expect(plugin.settings.crmDashboardWidgets).toBe(widgets);
  });

  it("sets the display currency, falling back to USD", async () => {
    await loaded({ currency: "EUR" });
    expect(fmtValue(1200, "currency")).toBe("€1,200");
    await loaded({ currency: "" });
    expect(fmtValue(1200, "currency")).toBe("$1,200");
  });
});

describe("loadSettings: custom entities into ENTITIES", () => {
  it("points each ENTITIES schema at the settings' field list", async () => {
    const { plugin } = await loaded({});
    for (const key of Object.keys(plugin.settings.customEntities)) {
      expect(ENTITIES[key].fields).toBe(plugin.settings.customEntities[key]);
    }
  });

  it("drops a custom schema with no custom page, from settings and ENTITIES", async () => {
    (ENTITIES as Any).vendor = { folder: "Cadence/Vendors", label: "Vendor", plural: "Vendors", fields: [], columns: ["name"] };
    const { plugin } = await loaded({ customEntities: { vendor: [field("name")] }, customPages: [] });
    expect(plugin.settings.customEntities).not.toHaveProperty("vendor");
    expect(ENTITIES).not.toHaveProperty("vendor");
  });

  it("rebuilds a custom entity from its page label", async () => {
    const fields = [field("title", { primary: true })];
    const { plugin } = await loaded({
      customEntities: { vendor: fields },
      customPages: [{ id: "custom.1", label: "Vendors", sectionId: "crm", entityKey: "vendor" }],
    });
    expect(ENTITIES.vendor).toEqual({
      folder: "Cadence/Vendors",
      label: "Vendor",
      plural: "Vendors",
      fields: [field("title", { primary: true }), { key: "type", label: "Type", type: "text" }],
      columns: ["title"],
    });
    expect(ENTITIES.vendor.fields).toBe(plugin.settings.customEntities.vendor);
    expect(fields).toHaveLength(2);
  });

  it("singularises an upper-case trailing S and keeps a one-letter label", async () => {
    await loaded({
      customEntities: { kpi: [field("name")], s: [field("name")] },
      customPages: [
        { id: "a", label: "KPIS", sectionId: "crm", entityKey: "kpi" },
        { id: "b", label: "S", sectionId: "crm", entityKey: "s" },
      ],
    });
    expect([ENTITIES.kpi.label, ENTITIES.kpi.plural]).toEqual(["KPI", "KPIS"]);
    expect([ENTITIES.s.label, ENTITIES.s.plural, ENTITIES.s.folder]).toEqual(["S", "S", "Cadence/S"]);
  });

  it("QUIRK: any trailing s is a plural (Bus → Bu)", async () => {
    await loaded({
      customEntities: { bus: [field("name")] },
      customPages: [{ id: "a", label: "Bus", sectionId: "crm", entityKey: "bus" }],
    });
    expect(ENTITIES.bus.label).toBe("Bu");
  });

  it("uses name as the column of a custom entity with no fields", async () => {
    await loaded({
      customEntities: { empty: [] },
      customPages: [{ id: "a", label: "Empties", sectionId: "crm", entityKey: "empty" }],
    });
    expect(ENTITIES.empty.columns).toEqual(["name"]);
    expect(ENTITIES.empty.fields).toEqual([{ key: "type", label: "Type", type: "text" }]);
  });

  it("rebuilds a core entity missing from ENTITIES from its key", async () => {
    delete (ENTITIES as Any).lead;
    await loaded({});
    expect(ENTITIES.lead).toMatchObject({ folder: "Cadence/Leads", label: "Lead", plural: "Leads", columns: ["name"] });
  });

  it("adds a text `type` field to every entity but activity, once", async () => {
    const { plugin } = await loaded({});
    for (const [key, def] of Object.entries(ENTITIES)) {
      const typeFields = def.fields.filter((f) => f.key === "type");
      expect(typeFields, key).toHaveLength(1);
      if (key !== "activity") expect(typeFields[0]).toEqual({ key: "type", label: "Type", type: "text" });
    }
    expect(ENTITIES.activity.fields.find((f) => f.key === "type")).toMatchObject({ type: "enum" });
    await plugin.loadSettings();
    expect(plugin.settings.customEntities.deal.filter((f: Any) => f.key === "type")).toHaveLength(1);
  });

  it("keeps an existing `type` field as it is", async () => {
    const deal = [field("title", { primary: true }), field("type", { type: "enum", options: ["a"] })];
    await loaded({ customEntities: { deal } });
    expect(ENTITIES.deal.fields).toEqual(deal);
  });

  it("skips activity, even when its schema has no `type`", async () => {
    const activity = [field("subject", { primary: true })];
    await loaded({ customEntities: { activity } });
    expect(ENTITIES.activity.fields).toEqual([field("subject", { primary: true })]);
  });

  it("adds `type` to an ENTITIES schema the settings do not list", async () => {
    (ENTITIES as Any).orphan = { folder: "X", label: "O", plural: "Os", fields: [field("name")], columns: ["name"] };
    await loaded({});
    expect(ENTITIES.orphan.fields.map((f: Any) => f.key)).toEqual(["name", "type"]);
  });
});

describe("saveSettings", () => {
  it("saves the settings object itself and updates the display currency", async () => {
    const { plugin } = await loaded({ currency: "USD" });
    const saveData = vi.spyOn(plugin, "saveData");
    plugin.settings.currency = "GBP";
    expect(await plugin.saveSettings()).toBeUndefined();
    expect(saveData).toHaveBeenCalledWith(plugin.settings);
    expect(saveData.mock.calls[0][0]).toBe(plugin.settings);
    expect(fmtValue(5, "currency")).toBe("£5");
  });

  it("falls back to USD", async () => {
    const { plugin } = await loaded({ currency: "EUR" });
    plugin.settings.currency = undefined;
    await plugin.saveSettings();
    expect(fmtValue(5, "currency")).toBe("$5");
  });

  it("round-trips through loadSettings", async () => {
    const { plugin } = await loaded({ defaultTab: "crm.pipeline" });
    await plugin.saveSettings();
    const saved = await plugin.loadData();
    const again = await loaded(JSON.parse(JSON.stringify(saved)));
    expect(again.plugin.settings).toEqual(JSON.parse(JSON.stringify(plugin.settings)));
  });
});

describe("registerCustomPropertyTypes", () => {
  it("maps the five core entities' fields to Obsidian property types", async () => {
    const { plugin, app } = await loaded({});
    plugin.registerCustomPropertyTypes();
    expect(app.metadataTypeManager.types).toEqual(JSON.parse(readFileSync("test/fixtures/registrations.original.json", "utf8")).propertyTypes);
  });

  it("registers `type` only from the entities' type fields, as text, never as multitext first", async () => {
    const { plugin, app } = await loaded({});
    const calls: string[][] = [];
    const setType = app.metadataTypeManager.setType.bind(app.metadataTypeManager);
    app.metadataTypeManager.setType = (key: string, type: string) => {
      calls.push([key, type]);
      setType(key, type);
    };
    plugin.registerCustomPropertyTypes();
    expect(calls[0]).toEqual(["name", "text"]);
    expect(calls.filter(([k]) => k === "type").map(([, t]) => t)).toEqual(["text", "text", "text", "text", "text"]);
    expect(app.metadataTypeManager.types.type).toBe("text");
  });

  it("maps each field type, primary first, then isList", async () => {
    const { plugin, app } = await loaded({});
    ENTITIES.project.fields = [
      field("p", { primary: true, type: "date" }),
      field("d", { type: "date" }),
      field("n", { type: "number" }),
      field("c", { type: "currency" }),
      field("t", { type: "tags" }),
      field("m", { type: "multitext" }),
      field("l", { type: "text", isList: true }),
      field("e", { type: "enum", isList: true }),
      field("u"),
      field("x", { type: "email" }),
    ];
    ENTITIES.deal.fields = [];
    ENTITIES.contact.fields = [];
    ENTITIES.company.fields = [];
    ENTITIES.activity.fields = [];
    plugin.registerCustomPropertyTypes();
    expect(app.metadataTypeManager.types).toEqual({
      p: "text", d: "date", n: "number", c: "number", t: "tags", m: "multitext",
      l: "multitext", e: "multitext", u: "text", x: "text",
    });
  });

  it("ignores the other entities, and a core entity that is missing", async () => {
    const { plugin, app } = await loaded({});
    delete (ENTITIES as Any).company;
    ENTITIES.partner.fields = [field("partnerOnly", { type: "date" })];
    plugin.registerCustomPropertyTypes();
    expect(app.metadataTypeManager.types).not.toHaveProperty("partnerOnly");
    expect(app.metadataTypeManager.types).not.toHaveProperty("size");
  });

  it("does nothing without a usable metadataTypeManager", async () => {
    const { plugin, app } = await loaded({});
    (app as Any).metadataTypeManager = undefined;
    expect(() => plugin.registerCustomPropertyTypes()).not.toThrow();
    (app as Any).metadataTypeManager = { setType: "nope" };
    expect(plugin.registerCustomPropertyTypes()).toBeUndefined();
  });

  it("warns instead of throwing when setType fails", async () => {
    const { plugin, app } = await loaded({});
    const error = new Error("locked");
    app.metadataTypeManager.setType = () => {
      throw error;
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    plugin.registerCustomPropertyTypes();
    expect(warn).toHaveBeenCalledWith("Cadence: Failed to register property types", error);
  });
});
