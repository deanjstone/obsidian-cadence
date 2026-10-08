import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, TFile } from "../mocks/obsidian";
import { ENTITIES } from "../../src/constants/entities";
import { ensureDefaultTemplates, entityTemplate, projectTemplate } from "../../src/utils/templates";

/* Characterization tests for note templates. Clock pinned for the dates
   projectTemplate writes. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const entitiesSnapshot = structuredClone(ENTITIES);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-08T10:00:00Z") });
});
afterEach(() => {
  for (const key of Object.keys(ENTITIES)) delete (ENTITIES as Any)[key];
  Object.assign(ENTITIES, structuredClone(entitiesSnapshot));
  vi.useRealTimers();
});

const PROJECT = [
  "---",
  "type: project",
  "name: Apollo",
  "status: [active]",
  "priority: [medium]",
  "owner: []",
  "started: 2026-10-08",
  "due:",
  "tags: []",
  "related_deals: []",
  "related_partners: []",
  "---",
  "",
  "# Apollo",
  "",
  "## Brief",
  "_The outcome we want, why now._",
  "",
  "",
  "## Scope",
  "**In scope:**",
  "- ",
  "",
  "**Out of scope:**",
  "- ",
  "",
  "## Milestones",
  "- [ ] 2026-10-08 — First milestone",
  "",
  "## Tasks",
  "- [ ] ",
  "",
  "## Risks",
  "- ",
  "",
  "## Stakeholders",
  "- ",
  "",
  "## Notes",
  "",
  "",
].join("\n");

describe("projectTemplate", () => {
  it("writes the rich project scaffold dated today", () => {
    expect(projectTemplate("Apollo")).toBe(PROJECT);
  });
});

describe("entityTemplate", () => {
  it("delegates project to projectTemplate", () => {
    expect(entityTemplate("project", "Apollo")).toBe(PROJECT);
  });
  it("writes a deal with a [Lead] stage and zeroed currency", () => {
    expect(entityTemplate("deal", "Big deal")).toBe(
      "---\ntype: deal\ntitle: Big deal\nstage: [Lead]\nvalue: 0\ncompany:\ncontact:\nowner:\ncloseBy:\n---\n\n# Big deal\n\n",
    );
  });
  it("writes [] for list and tag fields", () => {
    expect(entityTemplate("contact", "Jane")).toBe(
      "---\ntype: contact\nname: Jane\nemail: []\nphone: []\ncompany: []\nrole: []\nlastContact:\ntags: []\n---\n\n# Jane\n\n",
    );
  });
  it("writes 0 for number fields", () => {
    expect(entityTemplate("sequence", "Onboard")).toContain("steps: 0\nactive: 0\nstatus:\n");
  });
  it("leaves an activity's own type field blank instead of the entity key", () => {
    expect(entityTemplate("activity", "Call Jane")).toBe(
      "---\nsubject: Call Jane\ntype:\nwhen:\nwith:\ncompany:\nrelated:\n---\n\n# Call Jane\n\n",
    );
  });
  it("writes type in field order once a type field is registered (after loadSettings)", () => {
    ENTITIES.partner.fields.push({ key: "type", label: "Type", type: "text" });
    expect(entityTemplate("partner", "Hooli")).toBe(
      "---\nname: Hooli\ntier:\nstatus:\nowner:\nregion:\ntype: partner\n---\n\n# Hooli\n\n",
    );
  });
  it("uses the first field as the primary name field", () => {
    expect(entityTemplate("commission", "C-001")).toContain("reference: C-001\n");
  });
  it("leaves the deal stage unset when the stage field is gone", () => {
    ENTITIES.deal.fields = ENTITIES.deal.fields.filter((f: { key: string }) => f.key !== "stage");
    expect(entityTemplate("deal", "x")).not.toContain("stage");
  });
  it("throws for an unknown entity key", () => {
    expect(() => entityTemplate("nope", "x")).toThrow(TypeError);
  });
});

describe("ensureDefaultTemplates", () => {
  it("creates one template per entity plus daily, with entity-specific extras", async () => {
    const app = createMockApp();
    await ensureDefaultTemplates(app);
    expect(app.vault.created).toEqual([...Object.keys(ENTITIES).map((k) => `Cadence/Templates/${k}.md`), "Cadence/Templates/daily.md"]);
    const read = (p: string) => app.vault.read(app.vault.getAbstractFileByPath(p) as TFile);
    expect(await read("Cadence/Templates/company.md")).toBe(
      entityTemplate("company", "{{name}}") +
        "\n## Description #notes\n_Company description and profile..._\n\n## Contacts #cross-contact-company-table\n\n## Deals #cross-deal-company-kanban\n",
    );
    expect(await read("Cadence/Templates/contact.md")).toBe(
      entityTemplate("contact", "{{name}}") +
        "\n## Bio #notes\n_Background, interests, and how we met..._\n\n## Tasks #tasks\n- [ ] Follow up in 2 weeks\n",
    );
    expect(await read("Cadence/Templates/deal.md")).toBe(
      entityTemplate("deal", "{{name}}") + "\n## Notes #notes\n_Context and general notes..._\n",
    );
    expect(await read("Cadence/Templates/project.md")).toBe(projectTemplate("{{name}}"));
    expect(await read("Cadence/Templates/daily.md")).toBe("# {{date}}\n\n## Today\n- [ ] \n\n## Journal\n\n");
  });
  it("never overwrites existing templates", async () => {
    const app = createMockApp([
      { path: "Cadence/Templates/deal.md", body: "mine" },
      { path: "Cadence/Templates/daily.md", body: "my daily" },
    ]);
    await ensureDefaultTemplates(app);
    expect(app.vault.created).not.toContain("Cadence/Templates/deal.md");
    expect(app.vault.created).not.toContain("Cadence/Templates/daily.md");
    expect(await app.vault.read(app.vault.getAbstractFileByPath("Cadence/Templates/deal.md") as TFile)).toBe("mine");
  });
});
