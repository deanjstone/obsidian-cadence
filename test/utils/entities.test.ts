import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, Notice, TFile, type App } from "../mocks/obsidian";
import {
  activityCall,
  companyAcme,
  contactJane,
  dealAcme,
  dealUntyped,
  entityVault,
  nonEntityNote,
  partnerInitech,
  projectTagged,
  projectWebsite,
} from "../fixtures/vault";
import {
  DEAL_STAGES,
  ENTITIES,
  createEntity,
  entityKeyFromFile,
  entityValue,
  getDealStages,
  getEnumOptions,
  getFieldSuggestionSource,
  listEntities,
  listEntityFiles,
  migrateFrontmatterKey,
  migrateFrontmatterType,
  projectNameFromPath,
  readEntity,
  readProjectMeta,
} from "../../src/legacy/cadence.js";

/* Characterization tests for entity logic against a mocked vault. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let app: App;
const entitiesSnapshot = structuredClone(ENTITIES);

const file = (path: string) => app.vault.getAbstractFileByPath(path) as TFile;
const fm = (path: string) => app.metadataCache.getFileCache(file(path))?.frontmatter as Record<string, unknown>;

beforeEach(() => {
  app = createMockApp(entityVault);
  Notice.messages.length = 0;
});

afterEach(() => {
  for (const key of Object.keys(ENTITIES)) delete (ENTITIES as Any)[key];
  Object.assign(ENTITIES, structuredClone(entitiesSnapshot));
  vi.useRealTimers();
});

describe("entityKeyFromFile", () => {
  it("returns null for a missing file", () => {
    expect(entityKeyFromFile(app, null)).toBeNull();
  });
  it("prefers a frontmatter type that names a registered entity", () => {
    expect(entityKeyFromFile(app, file(dealAcme.path))).toBe("deal");
    expect(entityKeyFromFile(app, file(contactJane.path))).toBe("contact");
  });
  it("falls back to folder prefix, including sub-folders", () => {
    expect(entityKeyFromFile(app, file(dealUntyped.path))).toBe("deal");
  });
  it("falls back to folder when type is not an entity key (activities use type for the kind)", () => {
    expect(entityKeyFromFile(app, file(activityCall.path))).toBe("activity");
  });
  it("returns null outside entity folders with an unknown type", () => {
    expect(entityKeyFromFile(app, file(nonEntityNote.path))).toBeNull();
  });
  it("returns a single-item type array itself (it indexes ENTITIES via its string form) — flagged quirk", () => {
    const f = app.vault.addFile({ path: "Elsewhere/x.md", frontmatter: { type: ["company"] } });
    expect(entityKeyFromFile(app, f)).toEqual(["company"]);
    const g = app.vault.addFile({ path: "Elsewhere/y.md", frontmatter: { type: ["company", "deal"] } });
    expect(entityKeyFromFile(app, g)).toBeNull();
  });
  it("does not match a folder name that is only a prefix", () => {
    const f = app.vault.addFile({ path: "Cadence/PipelineArchive/z.md" });
    expect(entityKeyFromFile(app, f)).toBeNull();
  });
});

describe("getEnumOptions / getDealStages", () => {
  it("returns the field's options", () => {
    expect(getEnumOptions("partner", "tier", ["x"])).toEqual(["Gold", "Silver", "Bronze", "Standard"]);
  });
  it("falls back for unknown entities, unknown fields, and empty or missing options", () => {
    expect(getEnumOptions("nope", "tier", ["fb"])).toEqual(["fb"]);
    expect(getEnumOptions("partner", "nope", ["fb"])).toEqual(["fb"]);
    expect(getEnumOptions("partner", "owner", ["fb"])).toEqual(["fb"]);
    ENTITIES.partner.fields[1].options = [];
    expect(getEnumOptions("partner", "tier", ["fb"])).toEqual(["fb"]);
  });
  it("reads deal stages from the registry, defaulting to DEAL_STAGES", () => {
    expect(DEAL_STAGES).toEqual(["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]);
    expect(getDealStages()).toEqual(DEAL_STAGES);
    ENTITIES.deal.fields[1].options = ["New", "Closed"];
    expect(getDealStages()).toEqual(["New", "Closed"]);
    ENTITIES.deal.fields[1].options = [];
    expect(getDealStages()).toBe(DEAL_STAGES);
  });
});

describe("getFieldSuggestionSource", () => {
  it("returns none for a missing field", () => {
    expect(getFieldSuggestionSource(null)).toBe("none");
  });
  it("returns an explicit suggestionSource verbatim", () => {
    expect(getFieldSuggestionSource({ key: "owner", suggestionSource: "folder:Cadence/Contacts" })).toBe("folder:Cadence/Contacts");
    expect(getFieldSuggestionSource({ key: "x", suggestionSource: "entity:deal" })).toBe("entity:deal");
  });
  it("infers from type and key", () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ key: "labels", type: "tags" }, "tags"],
      [{ key: "tags" }, "tags"],
      [{ key: "owner" }, "contact"],
      [{ key: "assigned" }, "contact"],
      [{ key: "contact" }, "contact"],
      [{ key: "contacts" }, "contact"],
      [{ key: "with" }, "contact"],
      [{ key: "company" }, "company"],
      [{ key: "partner" }, "partner"],
      [{ key: "related" }, "project"],
      [{ key: "domain" }, "history"],
      [{ key: "industry" }, "history"],
      [{ key: "role" }, "history"],
      [{ key: "anything", type: "multitext" }, "history"],
      [{ key: "region" }, "none"],
    ];
    for (const [field, expected] of cases) expect(getFieldSuggestionSource(field)).toBe(expected);
  });
  it("lets an empty suggestionSource fall through to inference", () => {
    expect(getFieldSuggestionSource({ key: "company", suggestionSource: "" })).toBe("company");
  });
});

describe("listEntityFiles / readEntity / listEntities", () => {
  it("returns [] for unknown entities or missing folders", () => {
    expect(listEntityFiles(app, "nope")).toEqual([]);
    expect(listEntityFiles(app, "lead")).toEqual([]);
  });
  it("walks the entity folder recursively and keeps only .md files", () => {
    expect(listEntityFiles(app, "deal").map((f: TFile) => f.path).sort()).toEqual([dealAcme.path, dealUntyped.path].sort());
    expect(listEntityFiles(app, "contact").map((f: TFile) => f.path)).toEqual([contactJane.path]);
  });
  it("matches the .md extension case-insensitively", () => {
    app.vault.addFile({ path: "Cadence/Partners/Upper.MD" });
    expect(listEntityFiles(app, "partner").map((f: TFile) => f.path)).toContain("Cadence/Partners/Upper.MD");
  });
  it("reads frontmatter and basename, with {} when there is no cache", () => {
    const f = app.vault.addFile({ path: "Cadence/Leads/Bare.md" });
    expect(readEntity(app, f)).toEqual({ file: f, frontmatter: {}, basename: "Bare" });
    const jane = readEntity(app, file(contactJane.path));
    expect(jane.basename).toBe("Jane Doe");
    expect(jane.frontmatter).toBe(fm(contactJane.path));
  });
  it("lists entities as readEntity records", () => {
    const companies = listEntities(app, "company");
    expect(companies).toHaveLength(1);
    expect(companies[0].frontmatter.name).toBe("Acme Corp");
  });
});

describe("entityValue", () => {
  const entity = (frontmatter: Record<string, unknown>, basename = "Base") => ({ frontmatter, basename });
  it("returns the raw frontmatter value", () => {
    expect(entityValue(entity({ company: ["[[Acme]]"] }), "company")).toEqual(["[[Acme]]"]);
    expect(entityValue(entity({ value: 0 }), "value")).toBe(0);
    expect(entityValue(entity({ flag: false }), "flag")).toBe(false);
  });
  it("unwraps the first stage from an array, or '' for an empty array", () => {
    expect(entityValue(entity({ stage: ["Won", "Lost"] }), "stage")).toBe("Won");
    expect(entityValue(entity({ stage: [] }), "stage")).toBe("");
    expect(entityValue(entity({ status: ["active"] }), "status")).toEqual(["active"]);
  });
  it("falls back to the entity key for type when def is a registered entity (except activities)", () => {
    expect(entityValue(entity({}), "type", ENTITIES.deal)).toBe("deal");
    expect(entityValue(entity({ type: "" }), "type", ENTITIES.contact)).toBe("contact");
    expect(entityValue(entity({}), "type", ENTITIES.activity)).toBe("");
  });
  it("matches def by identity, not by shape", () => {
    expect(entityValue(entity({}), "type", structuredClone(ENTITIES.deal))).toBe("");
  });
  it("falls back to the basename for the primary field only", () => {
    expect(entityValue(entity({}, "Jane"), "name", ENTITIES.contact)).toBe("Jane");
    expect(entityValue(entity({}, "Deal"), "title", ENTITIES.deal)).toBe("Deal");
    expect(entityValue(entity({}, "Jane"), "email", ENTITIES.contact)).toBe("");
    expect(entityValue(entity({}, "Jane"), "name")).toBe("");
  });
  it("tolerates a missing frontmatter object", () => {
    expect(entityValue({ basename: "X" }, "name", ENTITIES.contact)).toBe("X");
  });
});

describe("projectNameFromPath", () => {
  it("returns null for an empty path", () => {
    expect(projectNameFromPath(app, "")).toBeNull();
    expect(projectNameFromPath(app, null)).toBeNull();
  });
  it("prefers the frontmatter name, then the basename", () => {
    expect(projectNameFromPath(app, projectTagged.path)).toBe("Ops cleanup");
    app.vault.addFile({ path: "Cadence/Projects/Unnamed.md" });
    expect(projectNameFromPath(app, "Cadence/Projects/Unnamed.md")).toBe("Unnamed");
  });
  it("derives a name from the path when the file is missing", () => {
    expect(projectNameFromPath(app, "Gone/Old project.md")).toBe("Old project");
    expect(projectNameFromPath(app, "noext")).toBe("noext");
  });
});

describe("readProjectMeta", () => {
  it("summarises milestones from the Milestones section", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-08T10:00:00Z") });
    const meta = await readProjectMeta(app, file(projectWebsite.path));
    expect(meta.total).toBe(4);
    expect(meta.done).toBe(1);
    expect(meta.percent).toBe(25);
    expect(meta.next.title).toBe("Content freeze");
    expect(meta.today).toEqual(new Date("2026-10-08T00:00:00Z"));
    expect(Object.keys(meta.sections)).toEqual(["Brief", "Milestones", "Tasks"]);
    expect(meta.content).toContain("# Website relaunch");
    expect(meta.milestones[1].notes).toBe("invite 20 users");
  });
  it("finds the milestone section by #milestones tag", async () => {
    const meta = await readProjectMeta(app, file(projectTagged.path));
    expect(meta).toMatchObject({ total: 2, done: 2, percent: 100, next: null });
  });
  it("reports zero progress without milestones", async () => {
    const meta = await readProjectMeta(app, file(dealAcme.path));
    expect(meta).toMatchObject({ milestones: [], total: 0, done: 0, percent: 0, next: null });
  });
  it("rounds the percentage", async () => {
    const f = app.vault.addFile({ path: "P/third.md", body: "## Milestones\n- [x] a\n- [ ] b\n- [ ] c\n" });
    expect((await readProjectMeta(app, f)).percent).toBe(33);
  });
});

describe("migrateFrontmatterType", () => {
  it("does nothing when the type is unchanged or there are no files", async () => {
    await migrateFrontmatterType(app, "deal", "company", "multitext", "multitext");
    await migrateFrontmatterType(app, "lead", "company", "text", "multitext");
    expect(Notice.messages).toEqual([]);
  });
  it("splits a comma string into wiki links for relation keys", async () => {
    fm(dealAcme.path).company = "Acme, [[Globex]], Initech";
    await migrateFrontmatterType(app, "deal", "company", "text", "multitext");
    expect(fm(dealAcme.path).company).toEqual(["[[Acme]]", "[[Globex]]", "[[Initech]]"]);
    expect(Notice.messages).toEqual(['Migrated 1 files for field "company" to type "multitext".']);
  });
  it("leaves half-bracketed parts alone and does not link non-relation keys", async () => {
    fm(partnerInitech.path).region = "EMEA, [[APAC";
    await migrateFrontmatterType(app, "partner", "region", "text", "multitext");
    expect(fm(partnerInitech.path).region).toEqual(["EMEA", "[[APAC"]);
    fm(partnerInitech.path).owner = "[[Sam, Lee]]";
    await migrateFrontmatterType(app, "partner", "owner", "text", "multitext");
    expect(fm(partnerInitech.path).owner).toEqual(["[[Sam", "Lee]]"]);
  });
  it("strips # and brackets when converting a string to tags", async () => {
    fm(companyAcme.path).size = "#big, [[enterprise]]";
    await migrateFrontmatterType(app, "company", "size", "text", "tags");
    expect(fm(companyAcme.path).size).toEqual(["big", "enterprise"]);
  });
  it("wraps non-string scalars in a one-item string array", async () => {
    fm(dealAcme.path).value = 12000;
    await migrateFrontmatterType(app, "deal", "value", "currency", "multitext");
    expect(fm(dealAcme.path).value).toEqual(["12000"]);
  });
  it("joins arrays (unbracketed) when converting a list to a scalar type", async () => {
    await migrateFrontmatterType(app, "contact", "company", "multitext", "text");
    expect(fm(contactJane.path).company).toBe("Acme Corp");
    fm(contactJane.path).role = ["[[A]]", "", "B"];
    await migrateFrontmatterType(app, "contact", "role", "multitext", "text");
    expect(fm(contactJane.path).role).toBe("A, B");
  });
  it("treats any array value as an old list even when oldType says otherwise", async () => {
    await migrateFrontmatterType(app, "contact", "email", "text", "date");
    expect(fm(contactJane.path).email).toBe("jane@acme.test");
  });
  it("flattens an array to a joined string when converting list to list (multitext → tags)", async () => {
    await migrateFrontmatterType(app, "contact", "company", "multitext", "tags");
    expect(fm(contactJane.path).company).toBe("Acme Corp");
  });
  it("parses numbers, mapping unparseable text to 0 and NaN to null", async () => {
    fm(dealAcme.path).value = "$12,500.50";
    fm(dealUntyped.path).value = "n/a";
    await migrateFrontmatterType(app, "deal", "value", "text", "currency");
    expect(fm(dealAcme.path).value).toBe(12500.5);
    expect(fm(dealUntyped.path).value).toBe(0);
    fm(dealAcme.path).value = "1-2";
    await migrateFrontmatterType(app, "deal", "value", "text", "number");
    expect(fm(dealAcme.path).value).toBeNull();
  });
  it("extracts the first YYYY-MM-DD for dates, else null", async () => {
    fm(dealAcme.path).closeBy = "[[2026-11-30]]";
    fm(dealUntyped.path).closeBy = "soon";
    await migrateFrontmatterType(app, "deal", "closeBy", "text", "date");
    expect(fm(dealAcme.path).closeBy).toBe("2026-11-30");
    expect(fm(dealUntyped.path).closeBy).toBeNull();
  });
  it("stringifies scalars for text-to-text conversions", async () => {
    fm(dealAcme.path).value = 5;
    await migrateFrontmatterType(app, "deal", "value", "number", "enum");
    expect(fm(dealAcme.path).value).toBe("5");
  });
  it("skips files where the field is undefined but counts null values", async () => {
    fm(dealUntyped.path).closeBy = null;
    await migrateFrontmatterType(app, "deal", "closeBy", "text", "multitext");
    expect(fm(dealUntyped.path).closeBy).toBeNull();
    expect(Notice.messages).toEqual(['Migrated 2 files for field "closeBy" to type "multitext".']);
  });
});

describe("migrateFrontmatterKey", () => {
  it("renames the key in every file that has it", async () => {
    await migrateFrontmatterKey(app, "deal", "closeBy", "closeDate");
    expect(fm(dealAcme.path)).not.toHaveProperty("closeBy");
    expect(fm(dealAcme.path).closeDate).toBe("2026-11-30");
    expect(fm(dealUntyped.path)).not.toHaveProperty("closeDate");
    expect(Notice.messages).toEqual(['Renamed frontmatter key "closeBy" to "closeDate" in 1 files.']);
  });
  it("overwrites an existing value under the new key", async () => {
    fm(dealAcme.path).owner = "old";
    await migrateFrontmatterKey(app, "deal", "contact", "owner");
    expect(fm(dealAcme.path).owner).toEqual(["[[Jane Doe]]"]);
  });
  it("does nothing for identical keys or empty entities", async () => {
    await migrateFrontmatterKey(app, "deal", "stage", "stage");
    await migrateFrontmatterKey(app, "lead", "a", "b");
    expect(Notice.messages).toEqual([]);
  });
});

describe("createEntity", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-08T14:05:00Z") });
  });
  const read = async (f: TFile) => app.vault.read(f);

  it("creates an entity note from the built-in template, creating folders", async () => {
    const empty = createMockApp();
    const created = await createEntity(empty, "lead", "Wayne Corp");
    expect(created.path).toBe("Cadence/Leads/Wayne Corp.md");
    expect(empty.vault.getAbstractFileByPath("Cadence/Templates")).not.toBeNull();
    expect(await empty.vault.read(created)).toBe(
      "---\ntype: lead\nname: Wayne Corp\ncompany:\nsource:\nstatus:\nassigned:\n---\n\n# Wayne Corp\n\n",
    );
  });
  it("de-duplicates names with a numeric suffix starting at 2", async () => {
    const a = await createEntity(app, "deal", "Acme renewal");
    const b = await createEntity(app, "deal", "Acme renewal");
    expect([a.path, b.path]).toEqual(["Cadence/Pipeline/Acme renewal 2.md", "Cadence/Pipeline/Acme renewal 3.md"]);
  });
  it("replaces unsafe filename characters and defaults the name", async () => {
    expect((await createEntity(app, "contact", 'a/b:c*?"<>|')).path).toBe("Cadence/Contacts/a-b-c------.md");
    expect((await createEntity(app, "contact", "")).path).toBe("Cadence/Contacts/Untitled Contact.md");
    expect((await createEntity(app, "contact", "   ")).path).toBe("Cadence/Contacts/Untitled.md");
  });
  it("uses a custom template, trying key, label and plural names", async () => {
    app.vault.addFile({ path: "Cadence/Templates/Deals.md", body: "# {{NAME}} / {{title}} on {{date}} at {{time}}" });
    const f = await createEntity(app, "deal", "Big one");
    expect(await read(f)).toBe("# Big one / Big one on 2026-10-08 at 02:05 PM");
  });
  it("prefers the key-named template over label and plural", async () => {
    app.vault.addFile({ path: "Cadence/Templates/Deal.md", body: "label" });
    app.vault.addFile({ path: "Cadence/Templates/deal.md", body: "key" });
    expect(await read(await createEntity(app, "deal", "x"))).toBe("key");
  });
  it("treats folder: prefixes as plain notes", async () => {
    const f = await createEntity(app, "folder:Inbox/Ideas", "Thought");
    expect(f.path).toBe("Inbox/Ideas/Thought.md");
    expect(await read(f)).toBe("---\nname: Thought\n---\n\n# Thought\n\n");
  });
  it("defaults the name of a plain note to 'Untitled Note'", async () => {
    expect((await createEntity(app, "folder:Inbox", "")).path).toBe("Inbox/Untitled Note.md");
  });
  it("recognises a raw folder path that matches an entity folder, case- and slash-insensitively", async () => {
    const f = await createEntity(app, "cadence/partners//", "Hooli");
    expect(f.path).toBe("Cadence/Partners/Hooli.md");
    expect(await read(f)).toContain("type: partner\nname: Hooli\n");
  });
  it("routes projects through projectTemplate", async () => {
    const f = await createEntity(app, "project", "Moonshot");
    expect(await read(f)).toContain("type: project\nname: Moonshot\nstatus: [active]");
  });
});
