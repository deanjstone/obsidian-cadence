import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENTITIES } from "../../src/constants/entities";
import { Notice, TFile, type App, type MockFileSpec } from "../mocks/obsidian";
import { restoreEntities, snapshotEntities } from "../helpers/setting-tab";
import { makePlugin } from "../helpers/plugin";

/* Characterization tests for CadencePlugin's contact↔project sync. Each
   test loads the plugin against a fixture vault, then fires the handlers
   onload registered on metadataCache 'changed' and vault 'delete', and
   reads back the frontmatter written. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const jane: MockFileSpec = { path: "Cadence/Contacts/Jane Doe.md", frontmatter: { type: "contact", name: "Jane Doe", project: ["[[Website relaunch]]"] } };
const sam: MockFileSpec = { path: "Cadence/Contacts/Sam Lee.md", frontmatter: { type: "contact", name: "Sam Lee" } };
const website: MockFileSpec = { path: "Cadence/Projects/Website relaunch.md", frontmatter: { type: "project", owner: ["[[Jane Doe]]"] } };
const apollo: MockFileSpec = { path: "Cadence/Projects/Apollo.md", frontmatter: { type: "project", status: ["active"] } };

let entitiesSnapshot: Record<string, Any>;
beforeEach(() => {
  entitiesSnapshot = snapshotEntities();
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  Notice.messages.length = 0;
});
afterEach(() => {
  restoreEntities(entitiesSnapshot);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function loadedVault(files: MockFileSpec[]) {
  const made = makePlugin({ data: { openOnStartup: false }, files: structuredClone(files) });
  await made.plugin.onload();
  return made;
}

const file = (app: App, path: string) => app.vault.getAbstractFileByPath(path) as TFile;
const fm = (app: App, path: string) => app.metadataCache.getFileCache(file(app, path))?.frontmatter;
const changed = (app: App, path: string) => app.metadataCache.trigger("changed", file(app, path));

describe("sync guards", () => {
  it("registers the changed and delete handlers on load", async () => {
    const { plugin } = await loadedVault([]);
    expect(plugin.registered.events).toEqual(["changed", "delete"]);
    expect(plugin._syncInProgress).toBe(false);
  });

  it("ignores a missing file, a non-markdown file and a file no longer in the vault", async () => {
    const { app, plugin } = await loadedVault([jane, sam, website]);
    await app.metadataCache.trigger("changed", null);
    await app.metadataCache.trigger("changed", new TFile("Cadence/Projects/Website relaunch.canvas"));
    await app.metadataCache.trigger("changed", new TFile("Cadence/Projects/Gone.md"));
    expect(await plugin.syncContactProjectRelationships(undefined)).toBeUndefined();
    expect(app.fileManager.processed).toEqual([]);
    expect(app.vault.created).toEqual([]);
  });

  it("skips a changed project that is no longer in the vault, even when a contact lists it", async () => {
    const { app } = await loadedVault([{ path: jane.path, frontmatter: { type: "contact", project: "[[Gone]]" } }]);
    await app.metadataCache.trigger("changed", new TFile("Cadence/Projects/Gone.md"));
    expect(fm(app, jane.path)?.project).toBe("[[Gone]]");
    expect(app.fileManager.processed).toEqual([]);
  });

  it("does nothing while a sync is in progress", async () => {
    const { app, plugin } = await loadedVault([jane, sam, website]);
    plugin._syncInProgress = true;
    await changed(app, website.path);
    expect(app.fileManager.processed).toEqual([]);
    expect(plugin._syncInProgress).toBe(true);
  });

  it("logs an error, and clears the in-progress flag, when the sync throws", async () => {
    const { app, plugin } = await loadedVault([jane, website]);
    const error = new Error("boom");
    app.vault.getMarkdownFiles = () => {
      throw error;
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await changed(app, "Cadence/Pipeline/x.md").catch(() => {});
    app.vault.addFile({ path: "Notes/n.md", frontmatter: { a: 1 } });
    await changed(app, "Notes/n.md");
    expect(log).toHaveBeenCalledWith("Cadence: Error in syncContactProjectRelationships", error);
    expect(plugin._syncInProgress).toBe(false);
  });

  it("matches the .md extension case-insensitively", async () => {
    const { app } = await loadedVault([sam, { path: "Cadence/Projects/Loud.MD", frontmatter: { type: "project", owner: "[[Sam Lee]]" } }]);
    await changed(app, "Cadence/Projects/Loud.MD");
    expect(fm(app, sam.path)?.project).toBe("[[Loud]]");
  });
});

describe("a contact note changes", () => {
  it("creates no note for a listed project that does not exist, and writes no links", async () => {
    const { app } = await loadedVault([
      { path: jane.path, frontmatter: { type: "contact", project: ["[[Website relaunch]]", "[[Zeta launch]]"] } },
      website,
    ]);
    await changed(app, jane.path);
    expect(app.vault.created).toEqual([]);
    expect(app.fileManager.processed).toEqual([]);
    expect(Notice.messages).toEqual([]);
  });

  it("creates no project even when another note has the same basename", async () => {
    const { app } = await loadedVault([
      { path: jane.path, frontmatter: { type: "contact", project: "[[big plan]]" } },
      { path: "Notes/Big Plan.md", body: "x" },
    ]);
    await changed(app, jane.path);
    expect(app.vault.created).toEqual([]);
  });

  it("re-cases no name: the contact's project names stay as typed", async () => {
    const { app } = await loadedVault([{ path: jane.path, frontmatter: { type: "contact", project: "iOS App, Big DATA" } }]);
    await changed(app, jane.path);
    expect(app.vault.created).toEqual([]);
    expect(fm(app, jane.path)?.project).toBe("iOS App, Big DATA");
  });

  it("does nothing when every listed project exists", async () => {
    const { app } = await loadedVault([jane, website]);
    await changed(app, jane.path);
    expect(app.vault.created).toEqual([]);
    expect(Notice.messages).toEqual([]);
  });

  it("never calls vault.create, so a vault that cannot create logs nothing", async () => {
    const { app } = await loadedVault([{ path: jane.path, frontmatter: { type: "contact", project: "[[A]], [[B]]" } }]);
    const create = vi.spyOn(app.vault, "create").mockRejectedValue(new Error("disk full"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await changed(app, jane.path);
    expect(create).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(app.vault.created).toEqual([]);
  });
});

describe("a project note changes", () => {
  it("adds the project to a contact it names, as a single link", async () => {
    const { app } = await loadedVault([sam, { path: apollo.path, frontmatter: { type: "project", owner: "[[Sam Lee]]" } }]);
    await changed(app, apollo.path);
    expect(fm(app, sam.path)?.project).toBe("[[Apollo]]");
    expect(Notice.messages).toEqual(['Lien automatique : Projet "Apollo" associé au contact "Sam Lee".']);
  });

  it("QUIRK: appends to the contact's projects and rewrites them all as links", async () => {
    const { app } = await loadedVault([
      { path: sam.path, frontmatter: { type: "contact", project: "Website relaunch" } },
      website,
      { path: apollo.path, frontmatter: { type: "project", contacts: ["Sam Lee"] } },
    ]);
    await changed(app, apollo.path);
    expect(fm(app, sam.path)?.project).toEqual(["[[Website relaunch]]", "[[Apollo]]"]);
  });

  it("reads every contact field: owner, contact, contacts, with, assigned and contact-sourced fields", async () => {
    const contacts = ["A", "B", "C", "D", "E", "F", "G"].map((n) => ({ path: `Cadence/Contacts/${n}.md`, frontmatter: { type: "contact" } }));
    const { app } = await loadedVault([
      ...contacts,
      {
        path: apollo.path,
        frontmatter: {
          type: "project", Owner: "[[A]]", contact: "[[B]]", contacts: "[[C]]", with: "[[D|Dee]]", assigned: "E", sponsor: "F", notes: "G",
        },
      },
    ]);
    ENTITIES.project.fields.push({ key: "sponsor", label: "Sponsor", type: "multitext", suggestionSource: "folder:Cadence/Contacts" });
    await changed(app, apollo.path);
    expect(contacts.map((c) => fm(app, c.path)?.project ?? null)).toEqual([
      "[[Apollo]]", "[[Apollo]]", "[[Apollo]]", "[[Apollo]]", "[[Apollo]]", "[[Apollo]]", null,
    ]);
  });

  it("ignores the `type` key even when it is a contact field", async () => {
    const { app } = await loadedVault([sam, { path: apollo.path, frontmatter: { type: "[[Sam Lee]]" } }]);
    ENTITIES.project.fields.find((f) => f.key === "type")!.suggestionSource = "contact";
    await changed(app, apollo.path);
    expect(fm(app, sam.path)?.project).toBeUndefined();
    expect(app.vault.created).toEqual([]);
  });

  it("creates no note for a named contact that does not exist", async () => {
    const { app } = await loadedVault([{ path: apollo.path, frontmatter: { type: "project", owner: ["[[New Person]]"] } }]);
    await changed(app, apollo.path);
    expect(app.vault.created).toEqual([]);
    expect(app.fileManager.processed).toEqual([]);
    expect(Notice.messages).toEqual([]);
  });

  it("leaves a contact that already lists the project", async () => {
    const { app } = await loadedVault([jane, website]);
    await changed(app, website.path);
    expect(app.fileManager.processed).toEqual([]);
  });

  it("keeps the project on a contact the project does not name", async () => {
    const { app } = await loadedVault([
      { path: jane.path, frontmatter: { type: "contact", project: ["[[Apollo]]", "[[website relaunch]]"] } },
      apollo,
      { path: website.path, frontmatter: { type: "project", owner: [] } },
    ]);
    await changed(app, website.path);
    expect(fm(app, jane.path)?.project).toEqual(["[[Apollo]]", "[[website relaunch]]"]);
    expect(app.fileManager.processed).toEqual([]);
    expect(Notice.messages).toEqual([]);
  });

  it("keeps the contact's last project", async () => {
    const { app } = await loadedVault([jane, { path: website.path, frontmatter: { type: "project" } }]);
    await changed(app, website.path);
    expect(fm(app, jane.path)?.project).toEqual(["[[Website relaunch]]"]);
  });

  it("keeps the link when another note names both the contact and the project", async () => {
    const { app } = await loadedVault([
      jane,
      { path: website.path, frontmatter: { type: "project" } },
      { path: "Meetings/Kickoff.md", frontmatter: { attendees: "[[Jane Doe]]", topic: "[[Website relaunch]]" } },
    ]);
    await changed(app, website.path);
    expect(fm(app, jane.path)?.project).toEqual(["[[Website relaunch]]"]);
    expect(app.fileManager.processed).toEqual([]);
  });

  it("keeps the link with no other source: not the contact's own note, nor a note naming only one side", async () => {
    const { app } = await loadedVault([
      jane,
      { path: website.path, frontmatter: { type: "project" } },
      { path: "Meetings/Solo.md", frontmatter: { attendees: "[[Jane Doe]]" } },
      { path: "Meetings/Bare.md" },
    ]);
    await changed(app, website.path);
    expect(fm(app, jane.path)?.project).toEqual(["[[Website relaunch]]"]);
    expect(app.fileManager.processed).toEqual([]);
  });
});

describe("any other note changes", () => {
  const deal: MockFileSpec = {
    path: "Cadence/Pipeline/Acme renewal.md",
    frontmatter: { type: "deal", contact: ["[[Jane Doe]]"], owner: ["[[Sam Lee]]"], project: ["[[Apollo]]"], company: ["[[Acme Corp]]"] },
  };

  it("links every contact in the note to every project in it", async () => {
    const { app } = await loadedVault([jane, sam, website, apollo, deal]);
    await changed(app, deal.path);
    expect(fm(app, jane.path)?.project).toEqual(["[[Website relaunch]]", "[[Apollo]]"]);
    expect(fm(app, sam.path)?.project).toBe("[[Apollo]]");
    expect(Notice.messages).toEqual([
      'Lien automatique : Projet "Apollo" associé à "Jane Doe".',
      'Lien automatique : Projet "Apollo" associé à "Sam Lee".',
    ]);
  });

  it("finds known contact and project names in any field of any note", async () => {
    const { app } = await loadedVault([sam, apollo, { path: "Daily/2026-03-10.md", frontmatter: { met: "Sam Lee", about: ["[[apollo]]"] } }]);
    await changed(app, "Daily/2026-03-10.md");
    expect(fm(app, sam.path)?.project).toBe("[[Apollo]]");
  });

  it("writes nothing when the contacts already match", async () => {
    const { app } = await loadedVault([jane, website, { path: "Notes/n.md", frontmatter: { a: "b" } }]);
    await changed(app, "Notes/n.md");
    expect(app.fileManager.processed).toEqual([]);
    expect(Notice.messages).toEqual([]);
  });

  it("keeps a project a contact lists by hand, even when no other note backs it", async () => {
    const { app } = await loadedVault([
      { path: jane.path, frontmatter: { type: "contact", project: ["[[Website relaunch]]", "[[Apollo]]"] } },
      website,
      apollo,
      { path: "Notes/unrelated.md", frontmatter: { mood: "fine" } },
    ]);
    await changed(app, "Notes/unrelated.md");
    expect(fm(app, jane.path)?.project).toEqual(["[[Website relaunch]]", "[[Apollo]]"]);
    expect(app.fileManager.processed).toEqual([]);
    expect(Notice.messages).toEqual([]);
  });

  it("keeps the project key of a contact with no backed project", async () => {
    const { app } = await loadedVault([jane, { path: website.path, frontmatter: { type: "project" } }, { path: "Notes/n.md", frontmatter: { a: 1 } }]);
    await changed(app, "Notes/n.md");
    expect(fm(app, jane.path)?.project).toEqual(["[[Website relaunch]]"]);
  });

  it("creates no note for a name in a contact or project field", async () => {
    const { app } = await loadedVault([
      { path: "Cadence/Pipeline/Globex.md", frontmatter: { type: "deal", owner: "Globex Inc", project: "Big Deal" } },
    ]);
    await changed(app, "Cadence/Pipeline/Globex.md");
    expect(app.vault.created).toEqual([]);
    expect(app.fileManager.processed).toEqual([]);
    expect(Notice.messages).toEqual([]);
  });

  it("links an existing contact to an existing project, but creates neither missing side", async () => {
    const { app } = await loadedVault([
      sam,
      apollo,
      { path: "Cadence/Pipeline/Mixed.md", frontmatter: { type: "deal", owner: ["[[Sam Lee]]", "[[Ghost]]"], project: ["[[Apollo]]", "[[Nowhere]]"] } },
    ]);
    await changed(app, "Cadence/Pipeline/Mixed.md");
    expect(app.vault.created).toEqual([]);
    expect(fm(app, sam.path)?.project).toBe("[[Apollo]]");
  });

  it("does not use contact notes as a source of links", async () => {
    const { app } = await loadedVault([
      { path: jane.path, frontmatter: { type: "contact", owner: "[[Sam Lee]]", project: "[[Apollo]]" } },
      sam,
      apollo,
      { path: "Notes/n.md", frontmatter: { a: 1 } },
    ]);
    await changed(app, "Notes/n.md");
    expect(fm(app, sam.path)?.project).toBeUndefined();
    expect(fm(app, jane.path)?.project).toBe("[[Apollo]]");
  });

  it("splits comma lists and strips link aliases", async () => {
    const { app } = await loadedVault([jane, sam, apollo, website, { path: "Notes/n.md", frontmatter: { who: "Jane Doe, Sam Lee", what: "[[Apollo|the moonshot]]" } }]);
    await changed(app, "Notes/n.md");
    expect(fm(app, sam.path)?.project).toBe("[[Apollo]]");
    expect(fm(app, jane.path)?.project).toEqual(["[[Website relaunch]]", "[[Apollo]]"]);
  });
});

describe("a project note is deleted", () => {
  const ola: MockFileSpec = { path: "Cadence/Contacts/Ola.md", frontmatter: { type: "contact", project: ["[[Apollo]]", "[[Website relaunch]]", "[[Zeta]]"] } };

  it("removes the project from every contact that lists it", async () => {
    const { app } = await loadedVault([jane, sam, ola, { path: "Cadence/Contacts/Lu.md", frontmatter: { type: "contact", project: "website RELAUNCH, Apollo" } }]);
    await app.vault.trigger("delete", new TFile(website.path));
    expect(fm(app, jane.path)).not.toHaveProperty("project");
    expect(fm(app, ola.path)?.project).toEqual(["[[Apollo]]", "[[Zeta]]"]);
    expect(fm(app, "Cadence/Contacts/Lu.md")?.project).toBe("[[Apollo]]");
    expect(app.fileManager.processed).toEqual([jane.path, ola.path, "Cadence/Contacts/Lu.md"]);
    expect(Notice.messages).toEqual([
      'Lien automatique : Projet "Website relaunch" supprimé du contact "Jane Doe".',
      'Lien automatique : Projet "Website relaunch" supprimé du contact "Ola".',
      'Lien automatique : Projet "Website relaunch" supprimé du contact "Lu".',
    ]);
  });

  it("includes notes in sub-folders of the projects folder", async () => {
    const { app } = await loadedVault([{ path: jane.path, frontmatter: { type: "contact", project: "[[Old]]" } }]);
    await app.vault.trigger("delete", new TFile("Cadence/Projects/Archive/Old.md"));
    expect(fm(app, jane.path)).not.toHaveProperty("project");
  });

  it("ignores notes outside the projects folder, non-markdown files and files without a path", async () => {
    const { app, plugin } = await loadedVault([jane]);
    await app.vault.trigger("delete", new TFile("Cadence/Website relaunch.md"));
    await app.vault.trigger("delete", new TFile("Cadence/Projects/Website relaunch.pdf"));
    await app.vault.trigger("delete", new TFile("Cadence/ProjectsX/Website relaunch.md"));
    await app.vault.trigger("delete", { path: "" });
    expect(await plugin.handleProjectDeletion(null)).toBeUndefined();
    expect(app.fileManager.processed).toEqual([]);
  });

  it("does nothing while a sync is in progress", async () => {
    const { app, plugin } = await loadedVault([jane]);
    plugin._syncInProgress = true;
    await app.vault.trigger("delete", new TFile(website.path));
    expect(app.fileManager.processed).toEqual([]);
  });

  it("follows the project entity's folder", async () => {
    const { app } = await loadedVault([jane]);
    ENTITIES.project.folder = "Work/Projects";
    await app.vault.trigger("delete", new TFile(website.path));
    expect(app.fileManager.processed).toEqual([]);
    await app.vault.trigger("delete", new TFile("Work/Projects/Website relaunch.md"));
    expect(fm(app, jane.path)).not.toHaveProperty("project");
  });

  it("falls back to Cadence/Projects without a project entity", async () => {
    const { app } = await loadedVault([jane]);
    const project = ENTITIES.project;
    delete (ENTITIES as Any).project;
    (ENTITIES as Any).contact.folder = "Cadence/Contacts";
    await app.vault.trigger("delete", new TFile("Cadence/Other/Website relaunch.md"));
    expect(app.fileManager.processed).toEqual([]);
    await app.vault.trigger("delete", new TFile(website.path));
    (ENTITIES as Any).project = project;
    expect(fm(app, jane.path)).not.toHaveProperty("project");
  });

  it("logs an error and clears the in-progress flag when it throws", async () => {
    const { app, plugin } = await loadedVault([jane]);
    const error = new Error("locked");
    app.fileManager.processFrontMatter = async () => {
      throw error;
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await app.vault.trigger("delete", new TFile(website.path));
    expect(log).toHaveBeenCalledWith("Cadence: Error in handleProjectDeletion", error);
    expect(plugin._syncInProgress).toBe(false);
  });
});
