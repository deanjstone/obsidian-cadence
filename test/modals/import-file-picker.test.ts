import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, FakeElement, Notice, SuggestModal, type App } from "../mocks/obsidian";
import { buttonByText, contentOf } from "../helpers/dom";
import { CadenceImportModal } from "../../src/legacy/cadence.js";

/* Characterization tests for the CSV import modal's vault file picker (the
   inline SuggestModal behind "Pick .csv from vault"): the empty-vault notice,
   the vault-wide .csv filter, and loading the chosen file into the form. The
   picker is captured by spying on SuggestModal.prototype.open. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let app: App;
let opened: Any[];
let placeholders: string[];
beforeEach(() => {
  Notice.messages.length = 0;
  opened = [];
  placeholders = [];
  vi.spyOn(SuggestModal.prototype, "open").mockImplementation(function (this: Any) {
    opened.push(this);
  });
  vi.spyOn(SuggestModal.prototype, "setPlaceholder").mockImplementation((text: string) => {
    placeholders.push(text);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

const people = { path: "Imports/people.csv", body: "Name,Email\nJane,jane@x.test\n" };
const upper = { path: "Imports/2026/Deals.CSV", body: "Title\nBig\n" };
const note = { path: "Notes/people.csv.md", body: "not a csv" };

function openAndPick() {
  const modal: Any = new CadenceImportModal(app, { entityKey: "contact" });
  modal.open();
  const content = contentOf(modal);
  buttonByText(content, "Pick .csv from vault").trigger("click");
  const textarea = content.findAll("textarea")[0] as FakeElement;
  return { modal, content, textarea };
}

describe("CadenceImportModal .csv file picker", () => {
  it("shows a notice and opens nothing when the vault has no .csv files", () => {
    app = createMockApp([note]);
    openAndPick();
    expect(Notice.messages).toEqual(["No .csv files found in vault. Drop one in the vault first."]);
    expect(opened).toHaveLength(0);
  });

  it("opens a picker over every .csv file in the vault, extension matched case-insensitively", () => {
    app = createMockApp([people, note, upper]);
    openAndPick();
    expect(opened).toHaveLength(1);
    expect(placeholders).toEqual(["Search .csv files…"]);
    expect(opened[0].files.map((f: Any) => f.path)).toEqual(["Imports/people.csv", "Imports/2026/Deals.CSV"]);
  });

  it("filters suggestions by case-insensitive substring of the full path", () => {
    app = createMockApp([people, upper]);
    openAndPick();
    const paths = (q: string) => opened[0].getSuggestions(q).map((f: Any) => f.path);
    expect(paths("")).toEqual(["Imports/people.csv", "Imports/2026/Deals.CSV"]);
    expect(paths("DEALS")).toEqual(["Imports/2026/Deals.CSV"]);
    expect(paths("imports/2026")).toEqual(["Imports/2026/Deals.CSV"]);
    expect(paths("xlsx")).toEqual([]);
  });

  it("renders each suggestion as the file path", () => {
    app = createMockApp([people]);
    openAndPick();
    const el = new FakeElement("div");
    opened[0].renderSuggestion(opened[0].files[0], el);
    expect(el.text).toBe("Imports/people.csv");
  });

  it("loads the chosen file into the textarea and renders the preview", async () => {
    app = createMockApp([people]);
    const { modal, textarea, content } = openAndPick();
    opened[0].onChooseSuggestion(opened[0].files[0]);
    await flush();
    expect(textarea.value).toBe(people.body);
    expect(modal.csvText).toBe(people.body);
    expect(modal.headers).toEqual(["Name", "Email"]);
    expect(modal.mapping).toEqual({ Name: "name", Email: "email" });
    expect(buttonByText(content, "Import").disabled).toBe(false);
  });

  it("shows a notice and leaves the form alone when the file cannot be read", async () => {
    app = createMockApp([people]);
    vi.spyOn(app.vault, "read").mockRejectedValueOnce(new Error("locked"));
    const { modal, textarea } = openAndPick();
    opened[0].onChooseSuggestion(opened[0].files[0]);
    await flush();
    expect(Notice.messages).toEqual(["Failed to read Imports/people.csv: locked"]);
    expect(textarea.value).toBe("");
    expect(modal.csvText).toBe("");
  });
});
