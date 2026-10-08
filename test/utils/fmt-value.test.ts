import { afterEach, describe, expect, it } from "vitest";
import { setCurrentCurrency, fmtValue } from "../../src/utils/format";

/* Characterization tests for fmtValue (en-US, TZ=UTC). */

afterEach(() => {
  setCurrentCurrency("USD");
});

describe("fmtValue", () => {
  it("renders null, undefined and '' as empty", () => {
    expect(fmtValue(null, "text")).toBe("");
    expect(fmtValue(undefined)).toBe("");
    expect(fmtValue("", "currency")).toBe("");
  });
  it("prefixes tags with # only when they are an array", () => {
    expect(fmtValue(["vip", "tech"], "tags")).toBe("#vip #tech");
    expect(fmtValue("vip", "tags")).toBe("vip");
  });
  it("formats parseable dates as medium dates and echoes the rest", () => {
    expect(fmtValue("2026-10-08", "date")).toBe("Oct 8, 2026");
    expect(fmtValue("someday", "date")).toBe("someday");
    expect(fmtValue(["2026-10-08"], "date")).toBe("Oct 8, 2026");
  });
  it("formats currency with no decimals in the current currency", () => {
    expect(fmtValue(12000, "currency")).toBe("$12,000");
    expect(fmtValue("4500.6", "currency")).toBe("$4,501");
    expect(fmtValue(0, "currency")).toBe("$0");
    setCurrentCurrency("EUR");
    expect(fmtValue(12000, "currency")).toBe("€12,000");
  });
  it("falls back to USD for an invalid currency code", () => {
    setCurrentCurrency("NOT-A-CODE");
    expect(fmtValue(5, "currency")).toBe("$5");
  });
  it("echoes non-numeric currency values", () => {
    expect(fmtValue("tbd", "currency")).toBe("tbd");
  });
  it("treats a whitespace-only currency string as 0", () => {
    expect(fmtValue(" ", "currency")).toBe("$0");
  });
  it("stringifies numbers, joins arrays and stringifies everything else", () => {
    expect(fmtValue(3.5, "number")).toBe("3.5");
    expect(fmtValue(["a", "b"], "number")).toBe("a,b");
    expect(fmtValue(["a", "b"], "multitext")).toBe("a, b");
    expect(fmtValue(0)).toBe("0");
    expect(fmtValue(false)).toBe("false");
    expect(fmtValue({ a: 1 })).toBe("[object Object]");
  });
});
