import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, Notice, TFile, type App, type FakeElement } from "../mocks/obsidian";
import { buttonByText, contentOf, optionTexts, optionValues } from "../helpers/dom";
import { CadenceImportModal } from "../../src/modals/import-modal";

/* Characterization tests for the CSV import modal's render path: the entity
   selector, the CSV textarea, the mapping preview and the Import/Cancel
   buttons. Driven through onOpen() against the mock DOM stub. Parsing,
   mapping and the per-row frontmatter are in csv-import.test.ts; the .csv
   vault picker is in import-file-picker.test.ts. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let app: App;
beforeEach(() => {
  app = createMockApp();
  Notice.messages.length = 0;
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-08T10:00:00Z") });
});
afterEach(() => {
  vi.useRealTimers();
});

/* Let an async click handler run to completion. */
async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function openImport(opts?: Record<string, unknown>) {
  const modal: Any = new CadenceImportModal(app, opts);
  modal.open();
  const content = contentOf(modal);
  const entitySelect = content.findAll("select")[0] as FakeElement;
  const textarea = content.findAll("textarea")[0] as FakeElement;
  const preview = modal.previewEl as FakeElement;
  const importBtn = buttonByText(content, "Import");
  const type = (csv: string) => {
    textarea.value = csv;
    textarea.trigger("input");
  };
  return { modal, content, entitySelect, textarea, preview, importBtn, type };
}

const summaryOf = (preview: FakeElement) =>
  preview.findAll("div").find((d) => d.classes.includes("cad-import-summary")) as FakeElement;
const mappingSelects = (preview: FakeElement) => preview.findAll("select");
const bodyRows = (preview: FakeElement) => preview.findAll("tbody")[0].findAll("tr");

describe("CadenceImportModal onOpen", () => {
  it("renders the form with every entity's plural, the requested entity selected and Import disabled", () => {
    const { content, entitySelect, textarea, preview, importBtn } = openImport({ entityKey: "deal" });
    expect(content.classes).toEqual(["cad-import-modal"]);
    expect(content.findAll("h3")[0].text).toBe("Import from CSV");
    expect(optionValues(entitySelect)).toEqual([
      "contact", "company", "partner", "registration", "commission", "lead",
      "certification", "activity", "sequence", "project", "deal",
    ]);
    expect(optionTexts(entitySelect)[0]).toBe("Contacts");
    expect(entitySelect.value).toBe("deal");
    expect(textarea.rows).toBe(8);
    expect(textarea.placeholder).toBe("Paste CSV here, including a header row…");
    expect(preview.classes).toEqual(["cad-import-preview"]);
    expect(preview.children.map((c) => c.text)).toEqual(["Paste or pick a CSV to preview…"]);
    expect(importBtn.disabled).toBe(true);
    expect(importBtn.classes).toEqual(["cad-btn", "primary"]);
    expect(buttonByText(content, "Paste").type).toBe("button");
    expect(buttonByText(content, "Pick .csv from vault").type).toBe("button");
  });

  it("falls back to contacts for an unknown entity key, so what it shows is what it imports", () => {
    const { modal, entitySelect, preview, type } = openImport({ entityKey: "nope" });
    expect(entitySelect.value).toBe("contact");
    expect(modal.entityKey).toBe("contact");
    type("Name\nJane\n");
    expect(summaryOf(preview).text).toBe("Will create 1 contact in Cadence/Contacts/  ·  1 column mapped");
  });

  it("focuses the textarea from the Paste button", () => {
    const { content, textarea } = openImport();
    buttonByText(content, "Paste").trigger("click");
    expect(textarea.focusCount).toBe(1);
  });

  it("renders a mapping row per header with the detected field selected and up to two samples", () => {
    const { modal, preview, importBtn, type } = openImport({ entityKey: "contact" });
    type("Name,Email,Notes\nJane,jane@x.test,\n Joe ,,hello\nAmy,amy@x.test,later\n");
    expect(modal.csvText).toContain("Jane");
    expect(preview.findAll("th").map((th) => th.text)).toEqual(["CSV column", "Maps to", "Sample"]);
    const rows = bodyRows(preview);
    expect(rows.map((r) => r.findAll("td")[0].text)).toEqual(["Name", "Email", "Notes"]);
    const [nameSel, emailSel, notesSel] = mappingSelects(preview);
    expect(optionValues(nameSel)).toEqual(["", "name", "email", "phone", "company", "role", "project", "lastContact", "tags"]);
    expect(optionTexts(nameSel)[0]).toBe("— skip —");
    expect(nameSel.value).toBe("name");
    expect(emailSel.value).toBe("email");
    expect(notesSel.value).toBe("");
    const samples = rows.map((r) => r.findAll("td")[2]);
    expect(samples.map((s) => s.text)).toEqual(["Jane · Joe", "jane@x.test", "hello"]);
    expect(samples[0].title).toBe("Jane\nJoe");
    expect(summaryOf(preview).text).toBe("Will create 3 contacts in Cadence/Contacts/  ·  2 columns mapped");
    expect(summaryOf(preview).classes).toEqual(["cad-import-summary"]);
    expect(importBtn.disabled).toBe(false);
  });

  it("truncates the sample text to 60 characters but keeps the full title", () => {
    const { preview, type } = openImport();
    const long = "x".repeat(50);
    type(`Name\n${long}\n${long}\n`);
    const sample = bodyRows(preview)[0].findAll("td")[2];
    expect(sample.text).toBe(`${long} · ${long}`.slice(0, 60));
    expect(sample.title).toBe(`${long}\n${long}`);
  });

  it("uses the singular label for one row and one mapped column", () => {
    const { preview, type } = openImport({ entityKey: "company" });
    type("Name\nAcme\n");
    expect(summaryOf(preview).text).toBe("Will create 1 company in Cadence/Companies/  ·  1 column mapped");
  });

  it("warns and disables Import when no column maps to the primary field", () => {
    const { preview, importBtn, type } = openImport({ entityKey: "deal" });
    type("Amount,Stage\n100,Lead\n");
    const summary = summaryOf(preview);
    expect(summary.classes).toEqual(["cad-import-summary", "cad-import-summary-warn"]);
    expect(summary.text).toBe('No CSV column maps to "Title" — required to name the file. Pick a column above.');
    expect(importBtn.disabled).toBe(true);
  });

  it("disables Import for a header-only CSV and says there are no rows", async () => {
    const onSubmit = vi.fn();
    const { modal, preview, importBtn, type } = openImport({ onSubmit });
    type("Name,Email\n");
    expect(bodyRows(preview)[0].findAll("td")[2].text).toBe("");
    const summary = summaryOf(preview);
    expect(summary.classes).toEqual(["cad-import-summary", "cad-import-summary-warn"]);
    expect(summary.text).toBe("The CSV has a header row but no data rows, so there is nothing to import.");
    expect(importBtn.disabled).toBe(true);
    await modal._submitImport();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(Notice.messages).toEqual([]);
    expect(importBtn.text).toBe("Import");
  });

  it("goes back to the empty preview, Import disabled, when the textarea is cleared", () => {
    const { preview, importBtn, type } = openImport();
    type("Name\nJane\n");
    type("   ");
    expect(preview.children.map((c) => c.text)).toEqual(["Paste or pick a CSV to preview…"]);
    expect(importBtn.disabled).toBe(true);
  });

  it("re-maps a column from its select, and skip stores null", () => {
    const { modal, preview, importBtn, type } = openImport({ entityKey: "deal" });
    type("Deal,Amount\nBig,100\n");
    expect(modal.mapping).toEqual({ Deal: null, Amount: "value" });
    expect(importBtn.disabled).toBe(true);
    const dealSel = mappingSelects(preview)[0];
    dealSel.value = "title";
    dealSel.trigger("change");
    expect(modal.mapping).toEqual({ Deal: "title", Amount: "value" });
    expect(mappingSelects(preview)[0].value).toBe("title");
    expect(importBtn.disabled).toBe(false);
    const amountSel = mappingSelects(preview)[1];
    amountSel.value = "";
    amountSel.trigger("change");
    expect(modal.mapping).toEqual({ Deal: "title", Amount: null });
    expect(summaryOf(preview).text).toBe("Will create 1 deal in Cadence/Pipeline/  ·  1 column mapped");
  });

  it("re-detects the mapping and re-renders when the entity changes", () => {
    const { modal, entitySelect, preview, type } = openImport({ entityKey: "contact" });
    type("Title,Stage\nBig,Lead\n");
    expect(modal.mapping).toEqual({ Title: null, Stage: null });
    entitySelect.value = "deal";
    entitySelect.trigger("change");
    expect(modal.entityKey).toBe("deal");
    expect(modal.mapping).toEqual({ Title: "title", Stage: "stage" });
    expect(optionValues(mappingSelects(preview)[0])).toEqual(["", "title", "stage", "value", "company", "contact", "owner", "closeBy"]);
    expect(summaryOf(preview).text).toBe("Will create 1 deal in Cadence/Pipeline/  ·  2 columns mapped");
  });

  it("gives each duplicate header name its own column and mapping entry", () => {
    const { modal, preview, type } = openImport();
    type("Name,Name\nJane,Doe\n");
    expect(bodyRows(preview).map((r) => r.findAll("td")[0].text)).toEqual(["Name", "Name (2)"]);
    expect(modal.mapping).toEqual({ Name: "name", "Name (2)": "name" });
    expect(mappingSelects(preview).map((s) => s.value)).toEqual(["name", "name"]);
    const second = mappingSelects(preview)[1];
    second.value = "";
    second.trigger("change");
    expect(mappingSelects(preview).map((s) => s.value)).toEqual(["name", ""]);
    expect(bodyRows(preview).map((r) => r.findAll("td")[2].text)).toEqual(["Jane", "Doe"]);
  });

  it("imports from the Import button, then closes and reports the counts", async () => {
    const onSubmit = vi.fn();
    const { modal, content, importBtn, type } = openImport({ entityKey: "contact", onSubmit });
    type("Name,Email\nJane,jane@x.test\n,skip@x.test\n");
    importBtn.trigger("click");
    expect(importBtn.disabled).toBe(true);
    expect(importBtn.text).toBe("Importing…");
    await flush();
    const file = app.vault.getAbstractFileByPath("Cadence/Contacts/Jane.md") as TFile;
    expect(app.metadataCache.getFileCache(file)?.frontmatter).toMatchObject({ email: "jane@x.test" });
    expect(Notice.messages).toEqual(["Imported 1 contacts in 0.0s · 1 skipped"]);
    expect(content.children).toHaveLength(0);
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ created: 1, failed: 1, entityKey: "contact" });
    expect(modal.entityKey).toBe("contact");
  });

  it("closes from Cancel without calling onSubmit", () => {
    const onSubmit = vi.fn();
    const { content, type } = openImport({ onSubmit });
    type("Name\nJane\n");
    buttonByText(content, "Cancel").trigger("click");
    expect(content.children).toHaveLength(0);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(app.vault.created).toEqual([]);
  });

  it("starts empty when closed and reopened, matching its empty textarea", () => {
    const { modal, content, type } = openImport();
    type("Name\nJane\n");
    modal.close();
    modal.open();
    expect((content.findAll("textarea")[0] as FakeElement).value).toBe("");
    expect(modal.csvText).toBe("");
    expect([modal.headers, modal.rows, modal.mapping]).toEqual([[], [], {}]);
    expect((modal.previewEl as FakeElement).children.map((c) => c.text)).toEqual(["Paste or pick a CSV to preview…"]);
    expect(buttonByText(content, "Import").disabled).toBe(true);
  });
});
