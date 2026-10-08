import { describe, expect, it } from "vitest";
import { ENTITIES } from "../../src/constants/entities";
import { autoDetectCsvMapping, csvRowExtras } from "../../src/modals/csv-import-mapping";

/* Direct tests for the state logic lifted out of CadenceImportModal. The
   modal-level characterization tests in csv-import.test.ts still exercise it
   through the modal. */

describe("autoDetectCsvMapping", () => {
  it("returns {} without a def or headers", () => {
    expect(autoDetectCsvMapping(undefined, ["Name"])).toEqual({});
    expect(autoDetectCsvMapping(ENTITIES.contact, [])).toEqual({});
  });
  it("maps exact, synonym, fuzzy and unmapped headers", () => {
    expect(autoDetectCsvMapping(ENTITIES.deal, ["Title", "Price", "Company name", "Owner email", ""])).toEqual({
      Title: "title",
      Price: "value",
      "Company name": "company",
      "Owner email": "owner",
      "": null,
    });
  });
  it("returns a fresh object each call", () => {
    const a = autoDetectCsvMapping(ENTITIES.contact, ["Name"]);
    expect(autoDetectCsvMapping(ENTITIES.contact, ["Name"])).not.toBe(a);
  });
});

describe("csvRowExtras", () => {
  const headers = ["Title", "Value", "Close", "Notes"];
  const mapping = { Title: "title", Value: "value", Close: "closeBy", Notes: null };
  it("skips the primary field, unmapped columns and empty cells", () => {
    expect(csvRowExtras(ENTITIES.deal, mapping, headers, ["Deal", "", "", "n"], "title")).toEqual({});
  });
  it("coerces by field type", () => {
    expect(csvRowExtras(ENTITIES.deal, mapping, headers, ["Deal", "€1.200", "2026-01-31T23:00:00Z", ""], "title")).toEqual({
      value: 1.2,
      closeBy: "2026-01-31",
    });
  });
  it("drops a number that is still NaN after cleaning", () => {
    expect(csvRowExtras(ENTITIES.deal, mapping, headers, ["Deal", "1-2", "", ""], "title")).toEqual({});
  });
  it("drops a tags cell with only separators", () => {
    expect(csvRowExtras(ENTITIES.contact, { Tags: "tags" }, ["Tags"], [" ;, "], "name")).toEqual({});
  });
  it("treats a missing cell as empty", () => {
    expect(csvRowExtras(ENTITIES.deal, mapping, headers, ["Deal"], "title")).toEqual({});
  });
});
