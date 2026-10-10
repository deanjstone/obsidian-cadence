import { describe, expect, it, vi } from "vitest";
import { FakeElement, type MockFileSpec } from "../../mocks/obsidian";
import { makeAppView } from "../../helpers/app-view";
import { companyAcme, contactJane, dealAcme } from "../../fixtures/vault";
import { ENTITIES } from "../../../src/constants/entities";
import { listEntities, listEntityFiles } from "../../../src/utils/entities";

/* Characterization tests for the entity link and table helpers shared by
   the lists, cross sections, reports and templates: _renderEntityLinks,
   _renderOwnerLinks, _renderEntityTable and _getEntityFiles. */

function setup(files: MockFileSpec[] = [], settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files, settings });
  const parent = new FakeElement("div");
  const opened = vi.spyOn(made.view, "openEntityDetail").mockResolvedValue(undefined);
  return { ...made, parent, opened };
}

const textsOf = (el: FakeElement) => el.children.map((c) => [c.localName, c.text]);

describe("_renderEntityLinks", () => {
  it.each([[undefined], [""], [null], [[]], [" , "]])("renders nothing for %j, prefix included", (val) => {
    const { view, parent } = setup();
    view._renderEntityLinks(parent, val, "contact", "Owner: ");
    expect(parent.children).toEqual([]);
  });

  it("renders the prefix, then one underlined link per value, comma-separated, with aliases as display text", () => {
    const { view, parent } = setup();
    view._renderEntityLinks(parent, "[[Jane Doe|Jane]], [[Bob]]", "contact", "With: ");
    expect(textsOf(parent)).toEqual([["span", "With: "], ["a", "Jane"], ["span", ", "], ["a", "Bob"]]);
    const link = parent.children[1];
    expect(link.classes).toEqual(["cad-contact-link"]);
    expect([link.style.textDecoration, link.style.cursor]).toEqual(["underline", "pointer"]);
  });

  it("opens the matching note (basename, case-insensitive) in the target entity's detail form, without bubbling", () => {
    const { view, parent, opened, app } = setup([contactJane]);
    view._renderEntityLinks(parent, ["[[jane doe]]"], "contact");
    const event = parent.children[0].trigger("click");
    expect(event.propagationStopped).toBe(true);
    expect(opened.mock.calls).toEqual([["contact", app.vault.getAbstractFileByPath(contactJane.path)]]);
    expect(app.workspace.openedLinks).toEqual([]);
  });

  it("opens a missing note by its link text", () => {
    const { view, parent, opened, app } = setup();
    view._renderEntityLinks(parent, "Nobody", "contact");
    parent.children[0].trigger("click");
    expect(opened).not.toHaveBeenCalled();
    expect(app.workspace.openedLinks).toEqual([["Nobody", "", false]]);
  });

  it("resolves a folder: target to the entity whose folder matches, ignoring case and trailing slashes", () => {
    const { view, parent, opened, app } = setup([companyAcme]);
    view._renderEntityLinks(parent, "Acme Corp", "folder:cadence/companies//");
    expect(parent.children[0].classes).toEqual(["cad-company-link"]);
    parent.children[0].trigger("click");
    expect(opened.mock.calls).toEqual([["company", app.vault.getAbstractFileByPath(companyAcme.path)]]);
  });

  it("opens an existing note natively when the target is not an entity (unmatched folder: or unknown key)", () => {
    const { view, parent, opened, app } = setup([{ path: "Venues/Hall.md" }]);
    view._renderEntityLinks(parent, "Hall", "folder:Venues");
    view._renderEntityLinks(parent, "Hall", "note");
    expect(parent.children.map((c) => c.classes[0])).toEqual(["cad-folder:Venues-link", "cad-note-link"]);
    parent.children.forEach((c) => c.trigger("click"));
    expect(opened).not.toHaveBeenCalled();
    expect(app.workspace.openedLinks).toEqual([["Venues/Hall.md", "", false], ["Venues/Hall.md", "", false]]);
  });
});

describe("_renderOwnerLinks", () => {
  it("renders contact links with an 'Owner: ' prefix by default, and none when showPrefix is false", () => {
    const { view } = setup();
    const a = new FakeElement("div");
    const b = new FakeElement("div");
    view._renderOwnerLinks(a, "[[Sam Lee]]");
    view._renderOwnerLinks(b, "[[Sam Lee]]", false);
    expect(textsOf(a)).toEqual([["span", "Owner: "], ["a", "Sam Lee"]]);
    expect(textsOf(b)).toEqual([["a", "Sam Lee"]]);
    expect(b.children[0].classes).toEqual(["cad-contact-link"]);
  });
});

describe("_renderEntityTable", () => {
  const deals = (app: Parameters<typeof listEntities>[0]) => listEntities(app, "deal");

  it("renders nothing for an unknown entity", () => {
    const { view, parent } = setup();
    view._renderEntityTable(parent, "nope", [], ["name"]);
    expect(parent.children).toEqual([]);
  });

  it("renders a borderless table with a header per known column, skipping unknown column keys", () => {
    const { view, parent, app } = setup([dealAcme]);
    view._renderEntityTable(parent, "deal", deals(app), ["title", "bogus", "stage", "value"]);
    const [wrap] = parent.children;
    expect(wrap.classes).toEqual(["cad-table-wrap"]);
    expect(wrap.style).toMatchObject({ padding: "0", border: "none", overflowX: "auto" });
    expect(wrap.findAll("th").map((th) => th.text)).toEqual(["Title", "Stage", "Value"]);
    expect(wrap.findAll("tr").filter((tr) => tr.classes.includes("cad-row"))).toHaveLength(1);
  });

  it("links the primary column to the detail form, or the first column when the primary is not shown", () => {
    const { view, parent, app, opened } = setup([dealAcme]);
    view._renderEntityTable(parent, "deal", deals(app), ["value", "title"]);
    view._renderEntityTable(parent, "deal", deals(app), ["closeBy", "value"]);
    const [first, second] = parent.children.map((w) => w.findAll("td"));
    expect(first.map((td) => td.children[0]?.localName ?? "text")).toEqual(["text", "a"]);
    expect(first[1].children[0].classes).toEqual(["cad-row-primary"]);
    expect(first[1].children[0].text).toBe("Acme renewal");
    expect(second.map((td) => td.children[0]?.localName ?? "text")).toEqual(["a", "text"]);
    expect(second[0].children[0].text).toBe(new Date("2026-11-30").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }));
    const event = first[1].children[0].trigger("click");
    expect(event.defaultPrevented).toBe(true);
    expect(opened.mock.calls).toEqual([["deal", deals(app)[0].file]]);
  });

  it("falls back to the basename for an empty primary value", () => {
    const { view, parent, app } = setup([{ path: "Cadence/Pipeline/Bare.md", frontmatter: { type: "deal" } }]);
    view._renderEntityTable(parent, "deal", deals(app), ["value"]);
    expect(parent.findAll("a")[0].text).toBe("Bare");
  });

  it("renders relation columns as entity links and owner without a prefix", () => {
    const { view, parent, app } = setup([dealAcme]);
    view._renderEntityTable(parent, "deal", deals(app), ["title", "company", "contact", "owner"]);
    const cells = parent.findAll("td").slice(1);
    expect(cells.map((td) => td.children.map((c) => [c.localName, c.text, c.classes[0]]))).toEqual([
      [["a", "Acme Corp", "cad-company-link"]],
      [["a", "Jane Doe", "cad-contact-link"]],
      [["a", "Sam Lee", "cad-contact-link"]],
    ]);
  });

  it("maps partner, contacts, with and related keys to their entities", () => {
    const { view, parent } = setup();
    const def = ENTITIES.activity;
    const row = { file: { path: "x.md" }, basename: "x", frontmatter: { with: ["[[Jane]]"], related: "[[Site]]" } };
    view._renderEntityTable(parent, "activity", [row], ["with", "related"]);
    expect(def.fields.some((f) => f.key === "with")).toBe(true);
    const cells = parent.findAll("td");
    expect(cells[0].children[0].localName).toBe("a");
    expect(cells[1].children.map((c) => c.classes[0])).toEqual(["cad-project-link"]);
  });

  it("links a multitext field by its suggestion source, and pills the stage", () => {
    const original = ENTITIES.deal.fields;
    ENTITIES.deal.fields = [...original, { key: "vendors", label: "Vendors", type: "multitext", suggestionSource: "company" }];
    try {
      const { view, parent, app } = setup([{ ...dealAcme, frontmatter: { ...dealAcme.frontmatter, stage: ["Closed Won"], vendors: ["Acme Corp"] } }]);
      view._renderEntityTable(parent, "deal", deals(app), ["title", "stage", "vendors"]);
      const cells = parent.findAll("td");
      const pill = cells[1].children[0];
      expect([pill.localName, pill.text, pill.style.fontSize, pill.style.padding]).toEqual(["span", "Closed Won", "10px", "2px 6px"]);
      // QUIRK: a multi-word stage yields a split class list (`cad-pill-closed won`).
      expect(pill.classes).toEqual(["cad-pill", "cad-pill-closed", "won"]);
      expect(cells[2].children.map((c) => c.classes[0])).toEqual(["cad-company-link"]);
    } finally {
      ENTITIES.deal.fields = original;
    }
  });

  it("formats other values, showing an em dash for empty ones (an empty stage included)", () => {
    const { view, parent, app } = setup([{ path: "Cadence/Pipeline/B.md", frontmatter: { type: "deal", title: "B", value: 1200, stage: [] } }]);
    view._renderEntityTable(parent, "deal", deals(app), ["title", "value", "stage", "closeBy"]);
    expect(parent.findAll("td").slice(1).map((td) => td.text)).toEqual([(1200).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }), "—", "—"]);
  });
});

describe("_getEntityFiles", () => {
  const daily: MockFileSpec[] = [
    { path: "daily/2026-10-01.md" },
    { path: "daily/2026/2026-10-02.MD" },
    { path: "daily/image.png" },
    { path: "journal/2026-10-03.md" },
  ];

  it("walks the daily-note folder recursively for markdown files (any case)", () => {
    const { view } = setup(daily);
    expect(view._getEntityFiles("daily").map((f: { path: string }) => f.path)).toEqual(["daily/2026-10-01.md", "daily/2026/2026-10-02.MD"]);
  });

  it("uses the configured daily-note folder", () => {
    const { view } = setup(daily, { dailyNoteFolder: "journal" });
    expect(view._getEntityFiles("daily").map((f: { path: string }) => f.path)).toEqual(["journal/2026-10-03.md"]);
  });

  it("returns [] when the daily folder is missing or is a file", () => {
    expect(setup([], { dailyNoteFolder: "none" }).view._getEntityFiles("daily")).toEqual([]);
    expect(setup(daily, { dailyNoteFolder: "daily/2026-10-01.md" }).view._getEntityFiles("daily")).toEqual([]);
  });

  it("QUIRK: an empty dailyNoteFolder falls back to 'daily'", () => {
    const { view } = setup(daily, { dailyNoteFolder: "" });
    expect(view._getEntityFiles("daily")).toHaveLength(2);
  });

  it("lists an entity's folder for every other key", () => {
    const { view, app } = setup([dealAcme, contactJane, companyAcme]);
    expect(view._getEntityFiles("contact")).toEqual(listEntityFiles(app as never, "contact"));
    expect(view._getEntityFiles("contact").map((f: { path: string }) => f.path)).toEqual([contactJane.path]);
    expect(view._getEntityFiles("nope")).toEqual([]);
  });
});
