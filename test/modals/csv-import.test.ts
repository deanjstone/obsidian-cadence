import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, Notice, TFile, type App } from "../mocks/obsidian";
import { CadenceImportModal } from "../../src/legacy/cadence.js";

/* Characterization tests for the CSV import modal's state logic: parsing,
   column auto-mapping and the per-row frontmatter it writes. Rendering is
   not exercised (no DOM) — see the manual QA checklist in the PR. */

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

function modalWith(entityKey: string | undefined, csvText: string): Any {
  const modal: Any = new CadenceImportModal(app, entityKey ? { entityKey } : undefined);
  modal.csvText = csvText;
  modal._parse();
  return modal;
}

describe("CadenceImportModal state", () => {
  it("defaults to contacts and a no-op onSubmit", () => {
    const modal: Any = new CadenceImportModal(app);
    expect(modal.entityKey).toBe("contact");
    expect(modal.onSubmit()).toBeUndefined();
    expect(modal.mapping).toEqual({});
  });

  it("clears headers and rows for blank input", () => {
    const modal = modalWith("contact", "  \n ");
    expect(modal.headers).toEqual([]);
    expect(modal.rows).toEqual([]);
  });

  it("trims headers and keeps data rows verbatim", () => {
    const modal = modalWith("contact", " Name , Email \nJane , j@x.test\n");
    expect(modal.headers).toEqual(["Name", "Email"]);
    expect(modal.rows).toEqual([["Jane ", " j@x.test"]]);
  });

  it("maps headers by normalised key or label", () => {
    const modal = modalWith("contact", "NAME,e-mail,Last contact,lastContact,Tags\n");
    expect(modal.mapping).toEqual({
      NAME: "name",
      "e-mail": "email",
      "Last contact": "lastContact",
      lastContact: "lastContact",
      Tags: "tags",
    });
  });

  it("maps synonyms only when the target field exists", () => {
    expect(modalWith("contact", "Full Name,Organisation,Email Address,Last contacted\n").mapping).toEqual({
      "Full Name": "name",
      Organisation: "company",
      "Email Address": "email",
      "Last contacted": "lastContact",
    });
    expect(modalWith("deal", "Amount,MRR,Close date,Expected close,Company Name\n").mapping).toEqual({
      Amount: "value",
      MRR: "value",
      "Close date": "closeBy",
      "Expected close": "closeBy",
      "Company Name": "company",
    });
  });

  it("maps a Phone column to name for entities without a phone field (flagged synonym)", () => {
    expect(modalWith("partner", "Phone\n").mapping).toEqual({ Phone: "name" });
    expect(modalWith("contact", "Phone\n").mapping).toEqual({ Phone: "phone" });
  });

  it("falls back to fuzzy containment either way, else null", () => {
    expect(modalWith("deal", "Deal title,val,Notes,!!!\n").mapping).toEqual({
      "Deal title": "title",
      val: "value",
      Notes: null,
      "!!!": null,
    });
  });

  it("re-maps when the entity changes", () => {
    const modal = modalWith("contact", "Title,Stage\n");
    expect(modal.mapping).toEqual({ Title: null, Stage: null });
    modal.entityKey = "deal";
    modal._autoDetectMapping();
    expect(modal.mapping).toEqual({ Title: "title", Stage: "stage" });
  });

  it("produces an empty mapping for an unknown entity", () => {
    expect(modalWith("nope", "Name\n").mapping).toEqual({});
  });
});

describe("CadenceImportModal._submitImport", () => {
  async function runImport(entityKey: string, csv: string, mappingOverride?: Record<string, string | null>) {
    const onSubmit = vi.fn();
    const modal: Any = new CadenceImportModal(app, { entityKey, onSubmit });
    modal.csvText = csv;
    modal._parse();
    if (mappingOverride) modal.mapping = mappingOverride;
    const setText = vi.fn();
    modal.importBtn = { disabled: false, setText };
    const close = vi.spyOn(modal, "close");
    await modal._submitImport();
    return { modal, onSubmit, setText, close };
  }
  const fm = (path: string) => app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(path) as TFile)?.frontmatter;

  it("creates one note per row with coerced extras", async () => {
    const { onSubmit, setText, close } = await runImport(
      "deal",
      'Title,Amount,Stage,Close date,Company\nBig deal,"$12,500.50",Proposal,2026-11-30,Acme\nSmall,abc,,Dec 1 2026,\n',
    );
    expect(app.vault.created.filter((p) => p.startsWith("Cadence/Pipeline/"))).toEqual([
      "Cadence/Pipeline/Big deal.md",
      "Cadence/Pipeline/Small.md",
    ]);
    expect(fm("Cadence/Pipeline/Big deal.md")).toMatchObject({
      title: "Big deal",
      value: 12500.5,
      stage: "Proposal",
      closeBy: "2026-11-30",
      company: "Acme",
    });
    // "abc" cleans to "" and Number("") is 0, so the value is written as 0.
    expect(fm("Cadence/Pipeline/Small.md")).toMatchObject({ value: 0, stage: ["Lead"], closeBy: "2026-12-01" });
    expect(setText).toHaveBeenCalledWith("Importing…");
    expect(Notice.messages).toEqual(["Imported 2 deals in 0.0s"]);
    expect(close).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith({ created: 2, failed: 0, entityKey: "deal" });
  });

  it("skips rows with an empty primary value and reports them", async () => {
    const { onSubmit } = await runImport("contact", "Name,Email\n,nobody@x.test\n  ,\nJane,jane@x.test\n");
    expect(onSubmit).toHaveBeenCalledWith({ created: 1, failed: 2, entityKey: "contact" });
    expect(Notice.messages).toEqual(["Imported 1 contacts in 0.0s · 2 skipped"]);
    expect(fm("Cadence/Contacts/Jane.md")).toMatchObject({ name: "Jane", email: "jane@x.test" });
  });

  it("splits tags on commas and semicolons and leaves unparseable dates as text", async () => {
    await runImport("contact", 'Name,Tags,Last contact\nJane,"vip; tech, ,",someday\n');
    expect(fm("Cadence/Contacts/Jane.md")).toMatchObject({ tags: ["vip", "tech"], lastContact: "someday" });
  });

  it("does nothing without a column mapped to the primary field", async () => {
    const { onSubmit, close } = await runImport("contact", "Email\nj@x.test\n");
    expect(app.vault.created).toEqual([]);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("counts a row as failed when note creation throws", async () => {
    app.vault.addFile({ path: "Cadence/Contacts/Jane.md" });
    vi.spyOn(app.vault, "create").mockRejectedValueOnce(new Error("disk full"));
    const { onSubmit } = await runImport("contact", "Name\nJane\nJoe\n");
    expect(onSubmit).toHaveBeenCalledWith({ created: 1, failed: 1, entityKey: "contact" });
  });

  it("writes unmapped-type columns as trimmed strings and ignores unknown field keys' types", async () => {
    await runImport("contact", "Name,Role,Extra\nJane,  CTO  ,x\n", { Name: "name", Role: "role", Extra: "custom" });
    expect(fm("Cadence/Contacts/Jane.md")).toMatchObject({ role: "CTO", custom: "x" });
  });
});
