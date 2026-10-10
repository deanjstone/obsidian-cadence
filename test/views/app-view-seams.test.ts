import { describe, expect, it } from "vitest";
import { ENTITIES } from "../../src/constants/entities";
import { planEntityLinks } from "../../src/views/app-view";
import type { EntityDef } from "../../src/types/entities";

/* Direct tests for planEntityLinks, the pure part of
   _createEntityFromPrompt. app-view-create.test.ts drives the same logic
   through the modal submit. */

describe("planEntityLinks", () => {
  it("overlays values on defaults, drops the primary key and keeps unlinked fields as given", () => {
    const { extras, links } = planEntityLinks(ENTITIES.deal, { stage: "Lead", title: "x" }, { title: "T", stage: "Won", value: 5 });
    expect(extras).toEqual({ stage: "Won", value: 5 });
    expect(links).toEqual([]);
  });

  it("wiki-links reference fields and lists the notes to auto-create in field order", () => {
    const { extras, links } = planEntityLinks(ENTITIES.deal, {}, {
      owner: "[[Ann]]", contact: ["Bob", "[[Cy]]"], company: "Acme,  , Globex",
    });
    expect(extras).toEqual({ owner: ["[[Ann]]"], contact: ["[[Bob]]", "[[Cy]]"], company: ["[[Acme]]", "[[Globex]]"] });
    expect(links).toEqual([
      { name: "Acme", creationSource: "company", label: "Company" },
      { name: "Globex", creationSource: "company", label: "Company" },
      { name: "Bob", creationSource: "contact", label: "Contact" },
      { name: "Cy", creationSource: "contact", label: "Contact" },
      { name: "Ann", creationSource: "contact", label: "Contact" },
    ]);
  });

  it("labels a folder: source by the entity whose folder matches, else Note; skips falsy values", () => {
    const def: EntityDef = {
      ...ENTITIES.deal,
      fields: [
        { key: "title", label: "Title", primary: true },
        { key: "vendor", label: "Vendor", suggestionSource: "folder:cadence/companies//" },
        { key: "venue", label: "Venue", suggestionSource: "folder:Venues" },
        { key: "sponsor", label: "Sponsor", suggestionSource: "folder:Venues" },
      ],
    };
    const { extras, links } = planEntityLinks(def, {}, { vendor: "Initech", venue: "Hall", sponsor: 0 });
    expect(extras).toEqual({ vendor: ["[[Initech]]"], venue: ["[[Hall]]"], sponsor: 0 });
    expect(links).toEqual([
      { name: "Initech", creationSource: "folder:cadence/companies//", label: "Company" },
      { name: "Hall", creationSource: "folder:Venues", label: "Note" },
    ]);
  });

  it("QUIRK: strips brackets before trimming, so ' [[Bob]]' stays '[[Bob'", () => {
    const { extras, links } = planEntityLinks(ENTITIES.deal, {}, { contact: "Ann, [[Bob]]" });
    expect(extras.contact).toEqual(["[[Ann]]", "[[[[Bob]]"]);
    expect(links.map((l) => l.name)).toEqual(["Ann", "[[Bob"]);
  });
});
