import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/constants/settings";
import {
  CORE_ENTITY_KEYS, customEntityNames, fillSettingDefaults, PROPERTY_TYPE_ENTITIES, propertyTypeFor, reconstructEntities,
} from "../../src/plugin/settings";
import type { EntityDef, EntityField } from "../../src/types/entities";
import type { PluginSettings } from "../../src/types/settings";
import { CURRENCY_OPTIONS } from "../../src/settings/setting-tab";
import { CURRENCY_OPTIONS as CONSTANT_CURRENCY_OPTIONS } from "../../src/constants/settings";

/* Direct tests for the settings seams over plain settings and a plain
   entity registry. */

const original = JSON.parse(readFileSync("test/fixtures/registrations.original.json", "utf8")).settings;

const field = (key: string, extra: Partial<EntityField> = {}): EntityField => ({ key, label: key, ...extra });
const TYPE_FIELD = { key: "type", label: "Type", type: "text" };

function merged(loaded: Record<string, unknown> = {}): PluginSettings {
  const defaults = structuredClone(DEFAULT_SETTINGS);
  const settings = Object.assign({}, defaults, loaded) as PluginSettings;
  fillSettingDefaults(settings, defaults);
  return settings;
}

function def(fields: EntityField[], folder = "X"): EntityDef {
  return { folder, label: "X", plural: "Xs", fields, columns: ["name"] };
}

describe("DEFAULT_SETTINGS and CURRENCY_OPTIONS", () => {
  it("DEFAULT_SETTINGS plus the filled defaults and type fields is the v0.15.0 snapshot", () => {
    const settings = merged();
    reconstructEntities(settings, {});
    expect(JSON.parse(JSON.stringify(settings))).toEqual(original);
  });

  it("the setting tab re-exports the constant", () => {
    expect(CURRENCY_OPTIONS).toBe(CONSTANT_CURRENCY_OPTIONS);
    expect(CURRENCY_OPTIONS[0]).toEqual({ code: "USD", label: "USD — US Dollar" });
  });
});

describe("fillSettingDefaults", () => {
  it("copies each default schema that is missing or empty", () => {
    const keep = [field("name")];
    const settings = merged({ customEntities: { deal: [], contact: keep } });
    expect(settings.customEntities.contact).toBe(keep);
    expect(settings.customEntities.deal).toEqual(DEFAULT_SETTINGS.customEntities.deal);
    expect(settings.customEntities.deal).not.toBe(DEFAULT_SETTINGS.customEntities.deal);
    expect(Object.keys(settings.customEntities)).toEqual(["deal", "contact", ...Object.keys(DEFAULT_SETTINGS.customEntities).filter((k) => !["contact", "deal"].includes(k))]);
  });

  it("creates customEntities when it is falsy", () => {
    const settings = merged({ customEntities: null });
    expect(Object.keys(settings.customEntities)).toHaveLength(11);
  });

  it("adds two fresh default widgets per empty dashboard and keeps others", () => {
    const mine = [{ id: "m", title: "Mine", groupBy: "x", style: "bar" }];
    const a = merged({ projectDashboardWidgets: [], prmDashboardWidgets: mine });
    const b = merged({ projectDashboardWidgets: [] });
    expect(a.projectDashboardWidgets.map((w) => w.id)).toEqual(["w1", "w2"]);
    expect(a.crmDashboardWidgets.map((w) => w.id)).toEqual(["c1", "c2"]);
    expect(a.prmDashboardWidgets).toBe(mine);
    expect(a.projectDashboardWidgets).not.toBe(b.projectDashboardWidgets);
  });
});

describe("customEntityNames", () => {
  it("takes the plural from the page label and drops one trailing s or S", () => {
    const page = (label: string) => ({ id: "p", label, sectionId: "crm", entityKey: "k" });
    expect(customEntityNames("k", page("Vendors"))).toEqual({ label: "Vendor", plural: "Vendors" });
    expect(customEntityNames("k", page("KPIS"))).toEqual({ label: "KPI", plural: "KPIS" });
    expect(customEntityNames("k", page("Staff"))).toEqual({ label: "Staff", plural: "Staff" });
    expect(customEntityNames("k", page("s"))).toEqual({ label: "s", plural: "s" });
  });

  it("keeps a singular that ends in s whole (Bus stays Bus)", () => {
    expect(customEntityNames("k", { id: "p", label: "Bus", sectionId: "crm", entityKey: "k" }).label).toBe("Bus");
  });

  it("takes the singular saved on the page over the guess", () => {
    expect(customEntityNames("k", { id: "p", label: "People", sectionId: "crm", entityKey: "k", singular: "person" })).toEqual({ label: "Person", plural: "People" });
  });

  it("derives from the key without a page: capitalised, or kept when all caps", () => {
    expect(customEntityNames("lead", undefined)).toEqual({ label: "Lead", plural: "Leads" });
    expect(customEntityNames("KPI", undefined)).toEqual({ label: "KPI", plural: "KPIs" });
  });
});

describe("reconstructEntities", () => {
  it("keeps core keys, keeps custom keys with a page and prunes the rest", () => {
    expect(CORE_ENTITY_KEYS).toHaveLength(11);
    const settings = merged({
      customEntities: { vendor: [field("name")], orphan: [field("name")] },
      customPages: [{ id: "p", label: "Vendors", sectionId: "crm", entityKey: "vendor" }],
    });
    const entities: Record<string, EntityDef> = { orphan: def([]) };
    reconstructEntities(settings, entities);
    expect(settings.customEntities).not.toHaveProperty("orphan");
    expect(entities).not.toHaveProperty("orphan");
    expect(entities.vendor).toEqual({
      folder: "Cadence/Vendors", label: "Vendor", plural: "Vendors", fields: [field("name"), TYPE_FIELD], columns: ["name"],
    });
    expect(Object.keys(entities)).toEqual(["vendor", ...Object.keys(DEFAULT_SETTINGS.customEntities)]);
  });

  it("points an existing entity at the settings list", () => {
    const settings = merged();
    const entities: Record<string, EntityDef> = { deal: def([field("old")], "Cadence/Pipeline") };
    reconstructEntities(settings, entities);
    expect(entities.deal.fields).toBe(settings.customEntities.deal);
    expect(entities.deal.folder).toBe("Cadence/Pipeline");
  });

  it("uses the first field as the column, or name", () => {
    const settings = merged({
      customEntities: { a: [field("title")], b: [] },
      customPages: [
        { id: "1", label: "As", sectionId: "crm", entityKey: "a" },
        { id: "2", label: "Bs", sectionId: "crm", entityKey: "b" },
      ],
    });
    const entities: Record<string, EntityDef> = {};
    reconstructEntities(settings, entities);
    expect(entities.a.columns).toEqual(["title"]);
    expect(entities.b.columns).toEqual(["name"]);
  });

  it("adds `type` once to every entity but activity, in the registry and the settings", () => {
    const settings = merged();
    const entities: Record<string, EntityDef> = { extra: def([field("name")]) };
    reconstructEntities(settings, entities);
    reconstructEntities(settings, entities);
    expect(entities.extra.fields).toEqual([field("name"), TYPE_FIELD]);
    expect(settings.customEntities.deal.filter((f) => f.key === "type")).toEqual([TYPE_FIELD]);
    expect(settings.customEntities.activity.filter((f) => f.key === "type")).toEqual([
      { key: "type", label: "Type", type: "enum", options: ["Call", "Email", "Meeting", "Note", "Task"] },
    ]);
  });

  it("leaves an activity schema without `type` alone", () => {
    const settings = merged({ customEntities: { activity: [field("subject")] } });
    const entities: Record<string, EntityDef> = {};
    reconstructEntities(settings, entities);
    expect(entities.activity.fields).toEqual([field("subject")]);
  });
});

describe("propertyTypeFor", () => {
  it("maps primary, date, number, currency, tags, multitext and lists", () => {
    expect(propertyTypeFor(field("a", { primary: true, type: "tags" }))).toBe("text");
    expect(propertyTypeFor(field("a", { type: "date" }))).toBe("date");
    expect(propertyTypeFor(field("a", { type: "number" }))).toBe("number");
    expect(propertyTypeFor(field("a", { type: "currency" }))).toBe("number");
    expect(propertyTypeFor(field("a", { type: "tags" }))).toBe("tags");
    expect(propertyTypeFor(field("a", { type: "multitext" }))).toBe("multitext");
    expect(propertyTypeFor(field("a", { type: "enum", isList: true }))).toBe("multitext");
  });

  it("gives text for everything else", () => {
    expect(propertyTypeFor(field("a"))).toBe("text");
    expect(propertyTypeFor(field("a", { type: "enum" }))).toBe("text");
    expect(propertyTypeFor(field("a", { type: "email" }))).toBe("text");
    expect(propertyTypeFor(field("a", { type: "date", isList: true }))).toBe("date");
  });

  it("registers the five core entities, in order", () => {
    expect(PROPERTY_TYPE_ENTITIES).toEqual(["project", "deal", "contact", "company", "activity"]);
  });
});
