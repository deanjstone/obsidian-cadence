import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp } from "../mocks/obsidian";
import { ENTITIES } from "../../src/constants/entities";
import { appendSection, replaceSection } from "../../src/utils/parsing";
import { DAILY_TEMPLATE_CONTENT, defaultTemplateContent, ensureDefaultTemplates } from "../../src/utils/templates";
import {
  appendTemplateSection, chartSectionBlock, crossSectionBlock, deleteSectionMessage, filesUsingTemplateSection,
  moveTemplateSection, propagateSectionAdd, propagateSectionDelete, removeTemplateSection, sectionInUse,
  templateBadge, templateDetailDef, templateEntityKey, templateHeader, templatePathCandidates, type TemplateNote,
} from "../../src/views/templates";

/* Direct tests for the Templates surface's plain-data seams: the dashboard's
   lookup and badges, the builder's block configs, and the section add,
   delete, move and in-use transforms, including propagation over a fake
   vault of several notes. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-08T10:00:00Z") });
});
afterEach(() => {
  vi.useRealTimers();
});

const T = "Cadence/Templates";
const NOTE = "# Ann\n\n## Bio #notes\nLikes tea\n\n## Tasks #tasks\n- [ ] call\n\n## Links #cross-deal-contact-table\n";

describe("dashboard and builder seams", () => {
  it("templatePathCandidates: key, label, plural, then each lower-cased", () => {
    expect(templatePathCandidates(T, "deal", ENTITIES.deal)).toEqual([
      `${T}/deal.md`, `${T}/Deal.md`, `${T}/Deals.md`, `${T}/deal.md`, `${T}/deal.md`, `${T}/deals.md`,
    ]);
    expect(templatePathCandidates("X", "myThing", { label: "My Thing", plural: "My Things" })).toEqual([
      "X/myThing.md", "X/My Thing.md", "X/My Things.md", "X/mything.md", "X/my thing.md", "X/my things.md",
    ]);
  });

  it("templateEntityKey: the entity a template file's basename names (key, label or plural, any case), daily, or the basename", () => {
    expect(["contact", "Contact", "Contacts", "CONTACTS"].map(templateEntityKey)).toEqual(["contact", "contact", "contact", "contact"]);
    expect(["deal", "Deals", "daily", "Daily", "Ghost"].map(templateEntityKey)).toEqual(["deal", "deal", "daily", "daily", "Ghost"]);
  });

  it("templateBadge: active or default", () => {
    expect(templateBadge(true)).toEqual({ cls: "cad-pill cad-pill-active", text: "Active Template" });
    expect(templateBadge(false)).toEqual({ cls: "cad-pill cad-pill-backlog", text: "Default" });
  });

  it("templateDetailDef: the entity's def, or a Daily Note stand-in", () => {
    expect(templateDetailDef("company")).toBe(ENTITIES.company);
    expect(templateDetailDef("daily")).toEqual({ label: "Daily Note", plural: "Daily Notes", fields: [] });
  });

  it("crossSectionBlock: the cross tag and a Related <plural> title, or Related Links", () => {
    expect(crossSectionBlock({ targetEntity: "deal", linkField: "contact", viewType: "kanban" } as Any)).toEqual({
      tag: "#cross-deal-contact-kanban", title: "Related Deals",
    });
    expect(crossSectionBlock({ targetEntity: "ghost", linkField: "owner", viewType: "table" } as Any).title).toBe("Related Links");
  });

  it("chartSectionBlock: the chart tag and a '<plural> by <field>' title, or the raw key", () => {
    expect(chartSectionBlock({ targetEntity: "deal", linkField: "contact", groupField: "stage", style: "donut" } as Any)).toEqual({
      tag: "#chart-deal-contact-stage-donut", title: "Deals by stage",
    });
    expect(chartSectionBlock({ targetEntity: "ghost", linkField: "o", groupField: "kind", style: "bar" } as Any).title).toBe("ghost by kind");
  });

  it("deleteSectionMessage: names the notes with content, or asks plainly", () => {
    expect(deleteSectionMessage("Bio", ["Ann", "Bob"])).toBe(
      'Warning: The section "Bio" has active content in the following files:\nAnn, Bob\n\nAre you sure you want to delete it from the template?',
    );
    expect(deleteSectionMessage("Bio", [])).toBe('Remove the section "Bio" from this template?');
  });
});

describe("default template content (src/utils/templates.ts)", () => {
  it("is what ensureDefaultTemplates writes for all 12 templates", async () => {
    const app = createMockApp();
    await ensureDefaultTemplates(app as Any);
    for (const key of Object.keys(ENTITIES)) {
      expect(await app.vault.read(app.vault.getAbstractFileByPath(`${T}/${key}.md`) as Any)).toBe(defaultTemplateContent(key));
    }
    expect(await app.vault.read(app.vault.getAbstractFileByPath(`${T}/daily.md`) as Any)).toBe(DAILY_TEMPLATE_CONTENT);
    expect(DAILY_TEMPLATE_CONTENT).toBe("# {{date}}\n\n## Today\n- [ ] \n\n## Journal\n\n");
  });

  it("gives each entity its starter sections", () => {
    const tails = Object.fromEntries(Object.keys(ENTITIES).map((k) => [k, defaultTemplateContent(k).match(/^## .*$/gm)]));
    expect(tails).toEqual({
      contact: ["## Bio #notes", "## Tasks #tasks"],
      company: ["## Description #notes", "## Contacts #cross-contact-company-table", "## Deals #cross-deal-company-kanban"],
      partner: ["## Notes #notes"], registration: ["## Notes #notes"], commission: ["## Notes #notes"], lead: ["## Notes #notes"],
      certification: ["## Notes #notes"], activity: ["## Notes #notes"], sequence: ["## Notes #notes"], deal: ["## Notes #notes"],
      project: ["## Brief", "## Scope", "## Milestones", "## Tasks", "## Risks", "## Stakeholders", "## Notes"],
    });
  });
});

describe("appending a section", () => {
  it("templateHeader: '## title tag', with no trailing space for a blank tag", () => {
    expect(templateHeader("Ideas", "#notes")).toBe("## Ideas #notes");
    expect(templateHeader("Ideas", "")).toBe("## Ideas");
  });

  it("appendSection: trims trailing whitespace, then a blank line, heading, body and newline", () => {
    expect(appendSection("# x\n\n  \n", "## A", "body")).toBe("# x\n\n## A\nbody\n");
    expect(appendSection("", "## A", "")).toBe("\n\n## A\n\n");
  });

  it("replaceSection appends with appendSection when the heading is missing", () => {
    expect(replaceSection("# x\n", "## A", "b")).toBe(appendSection("# x\n", "## A", "b"));
  });

  it("appendTemplateSection: appends a new section", () => {
    expect(appendTemplateSection(NOTE, "Ideas", "#notes", "_x_")).toBe(NOTE.trimEnd() + "\n\n## Ideas #notes\n_x_\n");
    expect(appendTemplateSection("# x", "Deals", "#cross-deal-contact-table")).toBe("# x\n\n## Deals #cross-deal-contact-table\n\n");
  });

  it("appendTemplateSection: null when the template already has a section of that name, whatever its tag or case", () => {
    expect(appendTemplateSection(NOTE, "Bio", "#notes", "_x_")).toBeNull();
    expect(appendTemplateSection(NOTE, "bio", "#tasks")).toBeNull();
    expect(appendTemplateSection(NOTE, "LINKS", "")).toBeNull();
  });
});

describe("propagateSectionAdd", () => {
  it("appends the section to a note without it", () => {
    expect(propagateSectionAdd("# Cy\n", { cleanTitle: "Ideas", tag: "#notes", defaultBody: "_x_" })).toBe("# Cy\n\n## Ideas #notes\n_x_\n");
  });

  it("defaults the body to empty", () => {
    expect(propagateSectionAdd("# Cy", { cleanTitle: "Deals", tag: "#cross-deal-contact-table" })).toBe("# Cy\n\n## Deals #cross-deal-contact-table\n\n");
  });

  it("returns null when the note has the section: same name and tag, any case", () => {
    for (const heading of ["## Ideas #notes", "## ideas #notes", "## IDEAS #NOTES", "##   Ideas   #notes"]) {
      expect(propagateSectionAdd(`# Cy\n${heading}\nx\n`, { cleanTitle: "Ideas", tag: "#notes" })).toBeNull();
    }
  });

  it("appends beside a same-named section with another tag or none, which is the user's own", () => {
    for (const heading of ["## ideas", "## IDEAS #tasks"]) {
      expect(propagateSectionAdd(`# Cy\n${heading}\nx\n`, { cleanTitle: "Ideas", tag: "#notes" })).toBe(`# Cy\n${heading}\nx\n\n## Ideas #notes\n\n`);
    }
  });

  it("an indented or ###-level heading is not a section", () => {
    expect(propagateSectionAdd("  ## Ideas\n### Ideas\n", { cleanTitle: "Ideas", tag: "" })).toBe("  ## Ideas\n### Ideas\n\n## Ideas\n\n");
  });

  it("a null or blank title (a cancelled prompt) changes no note and never throws", () => {
    for (const cleanTitle of [null, undefined, "", "   "]) {
      const section = { cleanTitle: cleanTitle as unknown as string, tag: "#notes" };
      expect(propagateSectionAdd("## Bio\nx\n", section)).toBeNull();
      expect(propagateSectionAdd("# Cy\n\n## Bio #notes\nx\n\n## Tasks #tasks\n- [ ] y\n", section)).toBeNull();
      expect(propagateSectionAdd("# Cy\n", section)).toBeNull();
    }
  });
});

describe("propagateSectionDelete", () => {
  it("removes the same-named section up to the next H2", () => {
    expect(propagateSectionDelete(NOTE, "Tasks #tasks")).toBe("# Ann\n\n## Bio #notes\nLikes tea\n\n## Links #cross-deal-contact-table\n");
  });

  it("matches by name and tag, case-insensitively", () => {
    expect(propagateSectionDelete(NOTE, "BIO #NOTES")).toBe("# Ann\n\n## Tasks #tasks\n- [ ] call\n\n## Links #cross-deal-contact-table\n");
    expect(propagateSectionDelete(NOTE, "Bio #milestones")).toBeNull();
    expect(propagateSectionDelete(NOTE, "Bio")).toBeNull();
    expect(propagateSectionDelete("## Notes\nmine\n", "Notes #notes")).toBeNull();
  });

  it("removes a last section to the end of the note", () => {
    expect(propagateSectionDelete(NOTE, "Links #cross-deal-contact-table")).toBe("# Ann\n\n## Bio #notes\nLikes tea\n\n## Tasks #tasks\n- [ ] call\n");
  });

  it("leaves a same-named section with another tag or none, and removes every section that matches", () => {
    expect(propagateSectionDelete("## Bio\none\n## Bio #notes\ntwo\n", "Bio #notes")).toBe("## Bio\none\n");
    expect(propagateSectionDelete("## Bio #notes\none\n## Bio #tasks\n- [ ] t\n## Bio #notes\ntwo\n", "Bio #notes")).toBe("## Bio #tasks\n- [ ] t\n");
  });

  it("returns null when no H2 matches (indented headings and plain lines don't)", () => {
    expect(propagateSectionDelete("  ## Bio\nBio\n### Bio\n", "Bio")).toBeNull();
    expect(propagateSectionDelete("", "Bio")).toBeNull();
  });
});

describe("removeTemplateSection", () => {
  it("removes the section with this exact raw key", () => {
    expect(removeTemplateSection(NOTE, "Bio #notes")).toBe("# Ann\n\n## Tasks #tasks\n- [ ] call\n\n## Links #cross-deal-contact-table\n");
  });

  it("returns null when the tag or case differs", () => {
    expect(removeTemplateSection(NOTE, "Bio #tasks")).toBeNull();
    expect(removeTemplateSection(NOTE, "bio #notes")).toBeNull();
  });

  it("matches only an H2 heading line, never a plain line with the same text", () => {
    expect(removeTemplateSection("Bio #notes\nkeep?\n\n## Bio #notes\nx\n", "Bio #notes")).toBe("Bio #notes\nkeep?\n");
    expect(removeTemplateSection("Bio #notes\n  ## Bio #notes\n### Bio #notes\n", "Bio #notes")).toBeNull();
  });
});

describe("moveTemplateSection", () => {
  it("moves a section up, before the target", () => {
    expect(moveTemplateSection(NOTE, "Tasks #tasks", "Bio #notes")).toBe(
      "# Ann\n\n## Tasks #tasks\n- [ ] call\n\n## Bio #notes\nLikes tea\n\n## Links #cross-deal-contact-table\n",
    );
  });

  it("moves a section down, directly before the target", () => {
    expect(moveTemplateSection(NOTE, "Bio #notes", "Links #cross-deal-contact-table")).toBe(
      "# Ann\n\n## Tasks #tasks\n- [ ] call\n\n## Bio #notes\nLikes tea\n\n## Links #cross-deal-contact-table\n",
    );
  });

  it("a moved section without a trailing blank line gets one, so it never runs into the next heading", () => {
    expect(moveTemplateSection("## A\na\n\n## B\nb", "B", "A")).toBe("## B\nb\n\n## A\na\n");
    expect(moveTemplateSection("## A\na\n## B\nb\n## C\nc\n", "B", "A")).toBe("## B\nb\n\n## A\na\n## C\nc\n");
  });

  it("returns null for the same key, or a key that is not an H2", () => {
    expect(moveTemplateSection(NOTE, "Bio #notes", "Bio #notes")).toBeNull();
    expect(moveTemplateSection(NOTE, "Ghost", "Bio #notes")).toBeNull();
    expect(moveTemplateSection(NOTE, "Bio #notes", "Ghost")).toBeNull();
    expect(moveTemplateSection("Bio\n## Tasks\nx\n", "Bio", "Tasks")).toBeNull();
  });
});

describe("sectionInUse and filesUsingTemplateSection", () => {
  it("sectionInUse: the same section (name and tag, any case) with non-placeholder content", () => {
    expect(sectionInUse("## Bio #notes\nLikes tea\n", "Bio #notes")).toBe(true);
    expect(sectionInUse("## BIO #TASKS\nx\n", "bio #tasks")).toBe(true);
    expect(sectionInUse("## BIO #tasks\nx\n", "bio")).toBe(false);
    expect(sectionInUse("## Bio\nx\n", "Bio #notes")).toBe(false);
    expect(sectionInUse("## Bio\n\n  \n", "Bio")).toBe(false);
    expect(sectionInUse("## Biography\nx\n", "Bio")).toBe(false);
    expect(sectionInUse("no sections", "Bio")).toBe(false);
  });

  it("sectionInUse: placeholder bodies don't count, even with more lines after them", () => {
    for (const body of [
      "_Enter your notes here..._", "_Company description and profile..._", "_Background, interests, and how we met..._",
      "_The outcome we want, why now._", "- [ ] First task in template", "- [ ] First milestone",
    ]) {
      expect(sectionInUse(`## Notes\n${body}\nmore\n`, "Notes")).toBe(false);
    }
  });

  it("the default Notes body, a dated first milestone and an empty task are placeholders, not content", () => {
    expect(sectionInUse("## Notes #notes\n_Context and general notes..._\n", "Notes #notes")).toBe(false);
    expect(sectionInUse("## Plan\n- [ ] 2026-10-08 — First milestone in template\n", "Plan")).toBe(false);
    expect(sectionInUse("## Plan\n- [ ] 2026-10-08 — First milestone\n", "Plan")).toBe(false);
    expect(sectionInUse("## Tasks\n- [ ] \n", "Tasks")).toBe(false);
    expect(sectionInUse("## Tasks\n- [ ]\n", "Tasks")).toBe(false);
  });

  it("a real task or a renamed milestone is still content", () => {
    expect(sectionInUse("## Tasks\n- [ ] call Ann\n", "Tasks")).toBe(true);
    expect(sectionInUse("## Tasks\n- [x] \n", "Tasks")).toBe(true);
    expect(sectionInUse("## Plan\n- [ ] 2026-10-08 — Launch\n", "Plan")).toBe(true);
    expect(sectionInUse("## Plan\n- [x] 2026-10-08 — First milestone\n", "Plan")).toBe(true);
  });

  it("filesUsingTemplateSection: keeps the given order and returns the files", () => {
    const notes: Array<TemplateNote<string>> = [
      { file: "a", content: "## Bio\nx\n" },
      { file: "b", content: "## Bio\n" },
      { file: "c", content: "## bio #notes\ny\n" },
    ];
    expect(filesUsingTemplateSection(notes, "Bio #notes")).toEqual(["c"]);
    expect(filesUsingTemplateSection(notes, "Bio")).toEqual(["a"]);
    expect(filesUsingTemplateSection([], "Bio")).toEqual([]);
  });

  it("over a vault of notes made from the 12 default templates, reports which sections count as used", () => {
    const notes: Array<TemplateNote<string>> = [
      ...Object.keys(ENTITIES).map((key) => ({ file: key, content: defaultTemplateContent(key).replaceAll("{{name}}", key) })),
      { file: "daily", content: DAILY_TEMPLATE_CONTENT },
    ];
    const keys = ["Notes #notes", "Bio #notes", "Description #notes", "Tasks #tasks", "Brief", "Milestones", "Scope", "Today", "Journal"];
    expect(Object.fromEntries(keys.map((k) => [k, filesUsingTemplateSection(notes, k)]))).toEqual({
      "Notes #notes": [],
      "Bio #notes": [],
      "Description #notes": [],
      "Tasks #tasks": ["contact"],
      Brief: [],
      Milestones: [],
      Scope: ["project"],
      Today: [],
      Journal: [],
    });
  });
});

describe("propagation over a fake vault of several notes", () => {
  const vault = (): Array<TemplateNote<string>> => [
    { file: "Ann", content: "# Ann\n\n## Bio #notes\nhi\n\n\n" },
    { file: "Bob", content: "# Bob\n\n## ideas #tasks\n- [ ] x\n" },
    { file: "Cy", content: "# Cy\n" },
    { file: "Di", content: "## Ideas\none\n## Ideas #notes\ntwo\n" },
  ];
  const writes = (notes: Array<TemplateNote<string>>, edit: (content: string) => string | null) =>
    notes.flatMap((n) => {
      const next = edit(n.content);
      return next === null ? [] : [{ file: n.file, content: next }];
    });

  it("an added section goes to every note without the same section (name and tag)", () => {
    expect(writes(vault(), (c) => propagateSectionAdd(c, { cleanTitle: "Ideas", tag: "#notes", defaultBody: "_x_" }))).toEqual([
      { file: "Ann", content: "# Ann\n\n## Bio #notes\nhi\n\n## Ideas #notes\n_x_\n" },
      { file: "Bob", content: "# Bob\n\n## ideas #tasks\n- [ ] x\n\n## Ideas #notes\n_x_\n" },
      { file: "Cy", content: "# Cy\n\n## Ideas #notes\n_x_\n" },
    ]);
  });

  it("a deleted section comes out of every note that has it; differently tagged or untagged sections stay", () => {
    expect(writes(vault(), (c) => propagateSectionDelete(c, "Ideas #notes"))).toEqual([
      { file: "Di", content: "## Ideas\none\n" },
    ]);
  });

  it("add then delete of a new section restores the notes up to trailing whitespace", () => {
    const added = vault().map((n) => ({ ...n, content: propagateSectionAdd(n.content, { cleanTitle: "Fresh", tag: "#notes" }) ?? n.content }));
    const removed = added.map((n) => ({ ...n, content: propagateSectionDelete(n.content, "Fresh #notes") ?? n.content }));
    expect(removed.map((n) => n.content.trimEnd())).toEqual(vault().map((n) => n.content.trimEnd()));
  });
});
