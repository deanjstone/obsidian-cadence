import { describe, expect, it } from "vitest";
import { fromLocalDatetimeValue, parseCSV, toLocalDatetimeValue } from "../../src/legacy/cadence.js";

/* Characterization tests for the CSV parser and the datetime-local helpers
   used by the capture/reminder modals (TZ=UTC). */

describe("parseCSV", () => {
  it("returns [] for empty input", () => {
    expect(parseCSV("")).toEqual([]);
    expect(parseCSV(null)).toEqual([]);
  });
  it("splits rows on LF, CRLF and lone CR", () => {
    expect(parseCSV("a,b\n1,2\r\n3,4\r5,6")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]);
  });
  it("handles quoted fields with commas, newlines and escaped quotes", () => {
    expect(parseCSV('name,notes\n"Doe, Jane","said ""hi""\nthen left"')).toEqual([
      ["name", "notes"],
      ["Doe, Jane", 'said "hi"\nthen left'],
    ]);
  });
  it("strips a leading BOM", () => {
    expect(parseCSV("﻿a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("keeps empty fields and drops rows that are a single empty field", () => {
    expect(parseCSV("a,,c\n\n,\n")).toEqual([["a", "", "c"], ["", ""]]);
  });
  it("does not trim whitespace", () => {
    expect(parseCSV(" a , b ")).toEqual([[" a ", " b "]]);
  });
  it("treats a quote in the middle of a field as opening a quoted run", () => {
    expect(parseCSV('ab"c,d"e\n1')).toEqual([["abc,de"], ["1"]]);
  });
  it("closes an unterminated quote at end of input", () => {
    expect(parseCSV('"open,still')).toEqual([["open,still"]]);
  });
  it("emits a trailing empty field after a final comma", () => {
    expect(parseCSV("a,")).toEqual([["a", ""]]);
  });
});

describe("toLocalDatetimeValue / fromLocalDatetimeValue", () => {
  it("formats a Date as a datetime-local value in local time", () => {
    expect(toLocalDatetimeValue(new Date(2026, 0, 5, 9, 7, 59))).toBe("2026-01-05T09:07");
  });
  it("parses a datetime-local value as local time", () => {
    expect(fromLocalDatetimeValue("2026-01-05T09:07")).toEqual(new Date(2026, 0, 5, 9, 7));
  });
  it("returns null for an empty value", () => {
    expect(fromLocalDatetimeValue("")).toBeNull();
    expect(fromLocalDatetimeValue(undefined)).toBeNull();
  });
  it("returns an Invalid Date for garbage", () => {
    expect(Number.isNaN(fromLocalDatetimeValue("nope").getTime())).toBe(true);
  });
  it("round-trips at minute precision", () => {
    const d = new Date(2026, 9, 8, 23, 45);
    expect(fromLocalDatetimeValue(toLocalDatetimeValue(d))).toEqual(d);
  });
});
