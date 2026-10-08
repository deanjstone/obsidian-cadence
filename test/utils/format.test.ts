import { describe, expect, it } from "vitest";
import { pctBand } from "../../src/legacy/cadence.js";

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
    expect(pctBand(undefined)).toBe("emerald");
  });
});
