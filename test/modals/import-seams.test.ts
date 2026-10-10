import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockApp, FakeElement, SuggestModal, TFile } from "../mocks/obsidian";
import { ENTITIES } from "../../src/constants/entities";
import {
  csvColumnSamples,
  csvImportSummary,
  CsvFileSuggestModal,
  filterCsvFiles,
} from "../../src/modals/import-modal";

/* Direct tests for the pure seams lifted out of CadenceImportModal and its
   now-named .csv picker. The modal's own behaviour is pinned in
   import-modal.test.ts and import-file-picker.test.ts. */

afterEach(() => {
  vi.restoreAllMocks();
});

describe("csvColumnSamples", () => {
  it("takes the column's trimmed, non-empty cells from the first two rows", () => {
    const rows = [["a", " b "], ["c"], ["d", "e"]];
    expect(csvColumnSamples(rows, 1)).toEqual(["b"]);
    expect(csvColumnSamples(rows, 0)).toEqual(["a", "c"]);
    expect(csvColumnSamples([], 0)).toEqual([]);
  });
});

describe("csvImportSummary", () => {
  it("is not ready without a column mapped to the primary field", () => {
    expect(csvImportSummary(ENTITIES.deal, { Amount: "value", Notes: null }, 3)).toEqual({
      ready: false,
      text: 'No CSV column maps to "Title" — required to name the file. Pick a column above.',
    });
  });

  it("counts rows and mapped columns, singular or plural", () => {
    expect(csvImportSummary(ENTITIES.company, { Name: "name" }, 1).text).toBe(
      "Will create 1 company in Cadence/Companies/  ·  1 column mapped",
    );
    expect(csvImportSummary(ENTITIES.deal, { T: "title", V: "value", X: null }, 2)).toEqual({
      ready: true,
      text: "Will create 2 deals in Cadence/Pipeline/  ·  2 columns mapped",
    });
  });

  it("is ready with zero rows (flagged)", () => {
    expect(csvImportSummary(ENTITIES.contact, { Name: "name" }, 0)).toEqual({
      ready: true,
      text: "Will create 0 contacts in Cadence/Contacts/  ·  1 column mapped",
    });
  });
});

describe("CsvFileSuggestModal", () => {
  const files = [new TFile("Imports/people.csv"), new TFile("Imports/2026/Deals.CSV")];

  it("filters files by case-insensitive substring of the path", () => {
    expect(filterCsvFiles(files as never, "deals").map((f) => f.path)).toEqual(["Imports/2026/Deals.CSV"]);
    expect(filterCsvFiles(files as never, "")).toHaveLength(2);
  });

  it("sets its placeholder, renders the path and hands the choice to onPick", () => {
    const placeholder = vi.spyOn(SuggestModal.prototype, "setPlaceholder");
    const onPick = vi.fn();
    const picker = new CsvFileSuggestModal(createMockApp() as never, files as never, onPick);
    expect(placeholder).toHaveBeenCalledWith("Search .csv files…");
    expect(picker.getSuggestions("PEOPLE")).toEqual([files[0]]);
    const el = new FakeElement("div");
    picker.renderSuggestion(files[1] as never, el as never);
    expect(el.text).toBe("Imports/2026/Deals.CSV");
    picker.onChooseSuggestion(files[0] as never);
    expect(onPick).toHaveBeenCalledWith(files[0]);
  });
});
