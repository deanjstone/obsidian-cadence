import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Notice, TFile } from "../mocks/obsidian";
import { ENTITIES } from "../../src/constants/entities";
import { CadenceEntityCreateModal } from "../../src/modals/entity-create";
import { CadencePromptModal } from "../../src/modals/prompt";
import { flush, makeAppView } from "../helpers/app-view";

/* Characterization tests for CadenceAppView._prompt() and
   _createEntityFromPrompt(): the options each passes to its modal, and what
   the entity-create submit does with the result (create the note, link and
   auto-create referenced notes, patch frontmatter, notify, open the detail
   form). The modals' open() is spied on, so their own UI is not driven
   here; it is covered in test/modals/. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let opened: Any[] = [];
beforeEach(() => {
  opened = [];
  Notice.messages.length = 0;
  vi.spyOn(CadencePromptModal.prototype, "open").mockImplementation(function (this: Any) {
    opened.push(this);
  });
  vi.spyOn(CadenceEntityCreateModal.prototype, "open").mockImplementation(function (this: Any) {
    opened.push(this);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("CadenceAppView _prompt", () => {
  it("opens a prompt modal with the defaults filled in and resolves with what it submits", async () => {
    const { view, app } = makeAppView();
    const answer = view._prompt({});
    expect(opened).toHaveLength(1);
    const modal = opened[0];
    expect(modal).toBeInstanceOf(CadencePromptModal);
    expect(modal.app).toBe(app);
    expect([modal.title, modal.placeholder, modal.defaultValue, modal.cta]).toEqual(["Enter a name", "", "", "Create"]);
    modal.onSubmit("Acme");
    await expect(answer).resolves.toBe("Acme");
  });

  it("passes title, placeholder, default value and CTA through, and resolves null on cancel", async () => {
    const { view } = makeAppView();
    const answer = view._prompt({ title: "Rename", placeholder: "New name", defaultValue: "Old", cta: "Save" });
    const modal = opened[0];
    expect([modal.title, modal.placeholder, modal.defaultValue, modal.cta]).toEqual(["Rename", "New name", "Old", "Save"]);
    modal.onSubmit(null);
    await expect(answer).resolves.toBeNull();
  });
});

describe("CadenceAppView _createEntityFromPrompt", () => {
  async function submit(entityKey: string, result: unknown, opts: { defaults?: Record<string, unknown>; files?: Any[] } = {}) {
    const made = makeAppView({ files: opts.files });
    const render = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
    const returned = made.view._createEntityFromPrompt(entityKey, opts.defaults);
    const modal = opened[0];
    await modal.onSubmit(result);
    await flush();
    const fm = (path: string) => {
      const file = made.app.vault.getAbstractFileByPath(path);
      return file ? made.app.metadataCache.getFileCache(file as TFile)?.frontmatter : undefined;
    };
    return { ...made, render, returned, modal, fm };
  }

  it("opens the entity-create modal for the key with the defaults, without waiting for it", async () => {
    const { view, app } = makeAppView();
    const returned = view._createEntityFromPrompt("deal", { stage: "Won" });
    await expect(returned).resolves.toBeUndefined();
    const modal = opened[0];
    expect(modal).toBeInstanceOf(CadenceEntityCreateModal);
    expect(modal.app).toBe(app);
    expect(modal.entityKey).toBe("deal");
    expect(modal.defaults).toEqual({ stage: "Won" });
    view._createEntityFromPrompt("contact");
    expect(opened[1].defaults).toEqual({});
  });

  it("does nothing when the modal is cancelled", async () => {
    const { app, render } = await submit("deal", null);
    expect(app.vault.created).toEqual([]);
    expect(Notice.messages).toEqual([]);
    expect(render).not.toHaveBeenCalled();
  });

  it("creates the note, links and auto-creates referenced notes, patches frontmatter, notifies and opens it", async () => {
    const { app, view, render, fm } = await submit(
      "deal",
      { name: "Big deal", values: { title: " Big deal ", stage: "Won", value: 5000, company: ["[[Acme]]"], contact: "Ann,[[Bob]], ann", owner: [], closeBy: "" } },
      { defaults: { stage: "Lead", owner: "Ann" }, files: [{ path: "Elsewhere/bob.md" }] },
    );
    expect(app.vault.created).toEqual([
      "Cadence/Pipeline/Big deal.md",
      "Cadence/Companies/Acme.md",
      "Cadence/Contacts/Ann.md",
    ]);
    expect(Notice.messages).toEqual([
      "Created new Company: Acme",
      "Created new Contact: Ann",
      "Created Deal: Big deal\nSaved to Cadence/Pipeline/Big deal.md",
    ]);
    expect(fm("Cadence/Pipeline/Big deal.md")).toMatchObject({
      title: "Big deal", stage: "Won", value: 5000,
      company: ["[[Acme]]"], contact: ["[[Ann]]", "[[Bob]]", "[[ann]]"],
    });
    // An empty list or string is skipped, so the template's own value stays.
    expect(fm("Cadence/Pipeline/Big deal.md")!.owner).not.toEqual([]);
    expect(fm("Cadence/Pipeline/Big deal.md")!.closeBy).not.toBe("");
    expect(view.detailEntityKey).toBe("deal");
    expect(view.detailFile.path).toBe("Cadence/Pipeline/Big deal.md");
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("QUIRK: a comma-separated link with a space before [[ keeps its brackets and auto-creates [[Name", async () => {
    const { app, fm } = await submit("deal", { name: "D", values: { contact: "Ann, [[Bob]]" } }, { files: [{ path: "Cadence/Contacts/Bob.md" }] });
    // Brackets are stripped before the space is trimmed, so " [[Bob]]" becomes "[[Bob".
    expect(app.vault.created).toEqual(["Cadence/Pipeline/D.md", "Cadence/Contacts/Ann.md", "Cadence/Contacts/[[Bob.md"]);
    expect(Notice.messages.slice(0, 2)).toEqual(["Created new Contact: Ann", "Created new Contact: [[Bob"]);
    expect(fm("Cadence/Pipeline/D.md")!.contact).toEqual(["[[Ann]]", "[[[[Bob]]"]);
  });

  it("uses a default for a field the modal left out, and links only fields with an entity or folder source", async () => {
    const { fm, app } = await submit(
      "contact",
      { name: "Ann", values: { email: "ann@x.io", role: "CEO, Founder", tags: "vip" } },
      { defaults: { company: "Acme" } },
    );
    expect(app.vault.created).toEqual(["Cadence/Contacts/Ann.md", "Cadence/Companies/Acme.md"]);
    expect(fm("Cadence/Contacts/Ann.md")).toMatchObject({
      name: "Ann", email: "ann@x.io", role: "CEO, Founder", tags: "vip", company: ["[[Acme]]"],
    });
  });

  it("auto-creates into a folder: source, using the matching entity's label when the folder is an entity folder", async () => {
    const extra = [
      { key: "vendor", label: "Vendor", suggestionSource: "folder:Cadence/Companies/" },
      { key: "venue", label: "Venue", suggestionSource: "folder:Venues" },
    ];
    ENTITIES.deal.fields.push(...(extra as Any));
    try {
      const { app } = await submit("deal", { name: "D", values: { vendor: "Globex", venue: "Hall" } });
      expect(app.vault.created).toEqual(["Cadence/Pipeline/D.md", "Cadence/Companies/Globex.md", "Venues/Hall.md"]);
      expect(Notice.messages.slice(0, 2)).toEqual(["Created new Company: Globex", "Created new Note: Hall"]);
    } finally {
      ENTITIES.deal.fields.splice(-2, 2);
    }
  });

  it("QUIRK: an entity:<key> source auto-creates the note in a folder literally named entity:<key>", async () => {
    ENTITIES.deal.fields.push({ key: "sponsor", label: "Sponsor", suggestionSource: "entity:company" } as Any);
    try {
      const { app } = await submit("deal", { name: "D", values: { sponsor: "Initech" } });
      expect(app.vault.created).toEqual(["Cadence/Pipeline/D.md", "entity:company/Initech.md"]);
      expect(Notice.messages[0]).toBe("Created new Note: Initech");
    } finally {
      ENTITIES.deal.fields.pop();
    }
  });

  it("warns and carries on when a referenced note cannot be auto-created", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const made = makeAppView();
    vi.spyOn(made.view, "render").mockResolvedValue(undefined);
    const create = made.app.vault.create.bind(made.app.vault);
    vi.spyOn(made.app.vault, "create").mockImplementation(async (path: string, content: string) => {
      if (path.startsWith("Cadence/Companies/")) throw new Error("disk full");
      return create(path, content);
    });
    made.view._createEntityFromPrompt("deal");
    await opened[0].onSubmit({ name: "D", values: { company: "Acme" } });
    expect(warn).toHaveBeenCalledWith("Failed to auto-create company", expect.any(Error));
    expect(Notice.messages).toEqual(["Created Deal: D\nSaved to Cadence/Pipeline/D.md"]);
    expect(made.view.detailFile.path).toBe("Cadence/Pipeline/D.md");
  });

  it("reports a failure to create the note in a notice and opens nothing", async () => {
    const made = makeAppView();
    const render = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
    vi.spyOn(made.app.fileManager, "processFrontMatter").mockRejectedValue(new Error("locked"));
    made.view._createEntityFromPrompt("deal");
    await opened[0].onSubmit({ name: "D", values: { stage: "Won" } });
    expect(made.app.vault.created).toEqual(["Cadence/Pipeline/D.md"]);
    expect(Notice.messages).toEqual(["Cadence: failed to create Deal — locked"]);
    expect(made.view.detailFile).toBeNull();
    expect(render).not.toHaveBeenCalled();
  });

  it("skips the frontmatter patch when only the primary value was given", async () => {
    const made = makeAppView();
    vi.spyOn(made.view, "render").mockResolvedValue(undefined);
    const patch = vi.spyOn(made.app.fileManager, "processFrontMatter");
    made.view._createEntityFromPrompt("company");
    await opened[0].onSubmit({ name: "Acme", values: { name: "Acme" } });
    expect(patch).not.toHaveBeenCalled();
    expect(Notice.messages).toEqual(["Created Company: Acme\nSaved to Cadence/Companies/Acme.md"]);
  });
});
