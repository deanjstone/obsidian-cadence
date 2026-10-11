import { describe, expect, it } from "vitest";
import { countLabel, guessSingular, pctBand, pluralize } from "../../src/utils/format";

describe("pctBand", () => {
  it("maps percentage ranges to colour bands", () => {
    expect(pctBand(-10)).toBe("rose");
    expect(pctBand(0)).toBe("rose");
    expect(pctBand(24.99)).toBe("rose");
    expect(pctBand(25)).toBe("warn");
    expect(pctBand(49)).toBe("warn");
    expect(pctBand(50)).toBe("mint");
    expect(pctBand(74.9)).toBe("mint");
    expect(pctBand(75)).toBe("emerald");
    expect(pctBand(100)).toBe("emerald");
    expect(pctBand(250)).toBe("emerald");
  });
  it("falls through to emerald for NaN and undefined", () => {
    expect(pctBand(Number.NaN)).toBe("emerald");
    expect(pctBand(undefined as unknown as number)).toBe("emerald");
  });
});

describe("guessSingular", () => {
  it.each([
    ["Products", "Product"], ["VIP Contacts", "VIP Contact"], ["deals", "deal"], ["Team  Members", "Team  Member"],
    ["Categories", "Category"], ["Classes", "Class"], ["Boxes", "Box"], ["Branches", "Branch"],
    ["Status", "Status"], ["Class", "Class"], ["Bus", "Bus"], ["Glass", "Glass"], ["Analysis", "Analysis"],
    ["Staff", "Staff"], ["Inventory", "Inventory"], ["KPIS", "KPI"], ["CPIS", "CPI"], ["s", "s"], ["S", "S"], ["", ""],
  ])("%s → %s", (plural, singular) => {
    expect(guessSingular(plural)).toBe(singular);
  });
});

describe("pluralize and countLabel", () => {
  it.each([
    ["Company", "Companies"], ["Role", "Roles"], ["Status", "Statuses"], ["Box", "Boxes"], ["Branch", "Branches"],
    ["Day", "Days"], ["deal", "deals"], ["activity", "activities"], ["CPI", "CPIs"],
  ])("%s → %s", (singular, plural) => {
    expect(pluralize(singular)).toBe(plural);
  });

  it("uses the singular for exactly one, else the plural", () => {
    expect([0, 1, 2].map((n) => countLabel(n, "deal"))).toEqual(["0 deals", "1 deal", "2 deals"]);
    expect([1, 3].map((n) => countLabel(n, "activity"))).toEqual(["1 activity", "3 activities"]);
    expect(countLabel(1, "person", "people")).toBe("1 person");
    expect(countLabel(4, "person", "people")).toBe("4 people");
  });
});
