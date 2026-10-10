import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeElement, MarkdownRenderer, Notice, Platform, TFile, type MockFileSpec } from "../../mocks/obsidian";
import { flush, makeAppView } from "../../helpers/app-view";
import { companyAcme, contactJane, dealAcme } from "../../fixtures/vault";
import { ENTITIES } from "../../../src/constants/entities";

/* Characterization tests for the detail-form sections shared by the
   entity, company and project detail forms, the templates and Today:
   _renderMarkdownTextCard, _renderProjectTextSection,
   _renderGenericTextSection, _renderSingleCrossSection,
   _renderCrossSections and _renderDynamicH2Section. */

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const parentSpec: MockFileSpec = { path: "Cadence/Companies/Acme Corp.md", frontmatter: { type: "company", name: "Acme Corp" }, body: "\n## Deals #cross-deal-company-table\n" };
const dealGlobex: MockFileSpec = {
  path: "Cadence/Pipeline/Globex deal.md",
  frontmatter: { type: "deal", title: "Globex deal", stage: ["Won"], value: 500, company: "[[ acme corp ]]", owner: "[[Sam Lee]]" },
};
const dealOther: MockFileSpec = { path: "Cadence/Pipeline/Other.md", frontmatter: { type: "deal", title: "Other", stage: "Lead", company: ["[[Initech]]"] } };

function setup(files: MockFileSpec[] = [], settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files, settings });
  const parent = new FakeElement("div");
  const opened = vi.spyOn(made.view, "openEntityDetail").mockResolvedValue(undefined);
  const rendered = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path) as unknown as TFile;
  return { ...made, parent, opened, rendered, file };
}

const byClass = (root: FakeElement, cls: string) => root.querySelectorAll(`.${cls}`);

describe("_renderMarkdownTextCard", () => {
  it("renders a titled card with an open-natively button that opens the note in a split", () => {
    const { view, parent, app } = setup();
    const file = new TFile("Cadence/Projects/Site.md");
    view._renderMarkdownTextCard(parent, file, "Notes", "NOTES", "hello", "ph", () => {});
    const [card] = parent.children;
    expect(card.classes).toEqual(["cad-pd-card"]);
    const [head] = card.children;
    expect(head.children[0].text).toBe("NOTES");
    const button = head.children[1];
    expect([button.localName, button.icon, button.title]).toEqual([
      "button", "file-text", "Open this note natively to edit with full Live Preview & Autocomplete",
    ]);
    const event = button.trigger("click");
    expect(event.propagationStopped).toBe(true);
    expect(app.workspace.openedLinks).toEqual([["Cadence/Projects/Site.md", "", "split"]]);
  });

  it("renders the value as markdown into a preview, with the view as the component", () => {
    const { view, parent } = setup();
    const md = vi.spyOn(MarkdownRenderer, "renderMarkdown");
    const file = new TFile("a.md");
    view._renderMarkdownTextCard(parent, file, "k", "L", "**hi**", "ph");
    const preview = byClass(parent, "markdown-preview-view")[0];
    expect(md.mock.calls).toEqual([["**hi**", preview, "a.md", view]]);
    expect(preview.children).toEqual([]);
  });

  it.each([[undefined, "ph", "ph"], ["  \n", undefined, "Empty section."]])("shows a placeholder for blank content (%j)", (initial, placeholder, shown) => {
    const { view, parent } = setup();
    view._renderMarkdownTextCard(parent, new TFile("a.md"), "k", "L", initial, placeholder);
    const preview = byClass(parent, "markdown-preview-view")[0];
    expect(preview.children.map((c) => c.text)).toEqual([shown]);
  });

  it("binds rendered internal links to open in place, by data-href then href", () => {
    const { view, parent, app } = setup();
    vi.spyOn(MarkdownRenderer, "renderMarkdown").mockImplementation(async (_md, el) => {
      const target = el as unknown as FakeElement;
      target.createEl("a", { cls: "internal-link", attr: { "data-href": "Jane Doe", href: "x" } });
      target.createEl("a", { cls: "internal-link", attr: { href: "Bob" } });
      target.createEl("a", { cls: "internal-link" });
      target.createEl("a", { cls: "external-link", attr: { href: "https://x" } });
    });
    view._renderMarkdownTextCard(parent, new TFile("n.md"), "k", "L", "text");
    const links = byClass(parent, "markdown-preview-view")[0].children;
    const events = links.map((a) => a.trigger("click"));
    expect(events.map((e) => [e.defaultPrevented, e.propagationStopped])).toEqual([[true, true], [true, true], [false, false], [false, false]]);
    expect(app.workspace.openedLinks).toEqual([["Jane Doe", "n.md", false], ["Bob", "n.md", false]]);
  });

  it("falls back to the raw text when the renderer throws synchronously", () => {
    const { view, parent } = setup();
    vi.spyOn(MarkdownRenderer, "renderMarkdown").mockImplementation(() => {
      throw new Error("boom");
    });
    view._renderMarkdownTextCard(parent, new TFile("n.md"), "k", "L", "raw *md*");
    expect(byClass(parent, "markdown-preview-view")[0].text).toBe("raw *md*");
  });
});

describe("_renderProjectTextSection / _renderGenericTextSection", () => {
  it("passes the trimmed section, the def's label and placeholder to the text card", () => {
    const { view, parent } = setup();
    const card = vi.spyOn(view, "_renderMarkdownTextCard").mockImplementation(() => {});
    const file = new TFile("p.md");
    const flash = () => {};
    view._renderProjectTextSection(parent, file, { Goals: "\n  ship it \n\n" }, { key: "Goals", label: "GOALS", placeholder: "Why?" }, flash);
    view._renderProjectTextSection(parent, file, {}, { key: "Risks", label: "RISKS" }, flash);
    expect(card.mock.calls).toEqual([
      [parent, file, "Goals", "GOALS", "ship it", "Why?", flash],
      [parent, file, "Risks", "RISKS", "", undefined, flash],
    ]);
  });

  it("labels a generic section by its upper-cased clean header, dropping a trailing tag", () => {
    const { view, parent } = setup();
    const card = vi.spyOn(view, "_renderMarkdownTextCard").mockImplementation(() => {});
    const file = new TFile("p.md");
    view._renderGenericTextSection(parent, file, { "Next steps #text": " a \n" }, "Next steps #text", undefined);
    expect(card.mock.calls).toEqual([[parent, file, "Next steps #text", "NEXT STEPS", "a", "Content for Next steps...", undefined]]);
  });
});

describe("_renderSingleCrossSection", () => {
  const files = [companyAcme, dealAcme, dealGlobex, dealOther];

  it("renders nothing for an unknown target entity", () => {
    const { view, parent } = setup(files);
    view._renderSingleCrossSection(parent, "nope", "company", "table", "Acme Corp");
    expect(parent.children).toEqual([]);
  });

  it("lists targets whose link field names the parent (brackets, case and spaces ignored) into the table", () => {
    const { view, parent } = setup(files);
    const table = vi.spyOn(view, "_renderEntityTable").mockImplementation(() => {});
    view._renderSingleCrossSection(parent, "deal", "company", "table", "Acme Corp ");
    expect(table).toHaveBeenCalledTimes(1);
    const [wrap, entity, list, columns] = table.mock.calls[0];
    expect([wrap, entity, columns]).toEqual([parent.children[0], "deal", ENTITIES.deal.columns]);
    expect((list as Array<{ basename: string }>).map((e) => e.basename).sort()).toEqual(["Acme renewal", "Globex deal"]);
  });

  it("uses a pre-filtered list as given, and shows an empty state when nothing links", () => {
    const { view, parent } = setup(files);
    const table = vi.spyOn(view, "_renderEntityTable").mockImplementation(() => {});
    view._renderSingleCrossSection(parent, "deal", "company", "table", "Nobody");
    const pre = [{ basename: "x" }];
    view._renderSingleCrossSection(parent, "deal", "company", "table", "Nobody", pre);
    expect(parent.children[0].children.map((c) => [c.classes[0], c.text])).toEqual([["cad-empty", "No linked items found."]]);
    expect(table.mock.calls).toEqual([[parent.children[1], "deal", pre, ENTITIES.deal.columns]]);
  });

  it("QUIRK: a comma-separated link string does not match; only a single link or a list does", () => {
    const deal: MockFileSpec = { path: "Cadence/Pipeline/Two.md", frontmatter: { type: "deal", company: "[[Initech]], [[Acme Corp]]" } };
    const { view, parent } = setup([deal]);
    view._renderSingleCrossSection(parent, "deal", "company", "table", "Acme Corp");
    expect(parent.children[0].children.map((c) => c.text)).toEqual(["No linked items found."]);
  });

  it("QUIRK: an unknown view type renders only the empty wrapper", () => {
    const { view, parent } = setup(files);
    view._renderSingleCrossSection(parent, "deal", "company", "list", "Acme Corp");
    expect(parent.children.map((c) => c.children.length)).toEqual([0]);
  });

  it("tiles projects with status/priority pills, owner, due and milestone progress loaded asynchronously", async () => {
    const project: MockFileSpec = {
      path: "Cadence/Projects/Site.md",
      frontmatter: { type: "project", name: "Site", status: "In Progress", priority: "High", owner: "[[Sam Lee]]", due: "2026-12-01", company: "[[Acme Corp]]" },
      body: "\n## Milestones\n- [x] 2026-10-01 — Kickoff\n- [ ] 2026-11-15 — Launch\n",
    };
    const bare: MockFileSpec = { path: "Cadence/Projects/Bare.md", frontmatter: { type: "project", company: "Acme Corp" } };
    const { view, parent, opened, file } = setup([project, bare]);
    view._renderSingleCrossSection(parent, "project", "company", "tile", "Acme Corp");
    const cards = byClass(parent, "cad-proj-card");
    expect(cards.map((c) => byClass(c, "cad-proj-title")[0].text)).toEqual(["Site", "Bare"]);
    expect(cards.map((c) => byClass(c, "cad-proj-pills")[0].children.map((p) => p.classes.join(" ")))).toEqual([
      ["cad-pill cad-pill-in-progress", "cad-pill cad-pill-prio-high"], ["cad-pill cad-pill-active"],
    ]);
    const meta = byClass(cards[0], "cad-proj-meta")[0];
    expect(meta.children.map((c) => c.text)).toEqual(["Owner: ", "Sam Lee", `Due: ${new Date("2026-12-01").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`]);
    expect(byClass(cards[0], "cad-proj-progress-label")[0].children.map((c) => c.text)).toEqual(["Loading milestones...", ""]);
    await flush();
    const wrap = byClass(cards[0], "cad-proj-progress-wrap")[0];
    expect(wrap.dataset.pctBand).toBe("mint");
    expect(byClass(cards[0], "cad-proj-progress-label")[0].children.map((c) => c.text)).toEqual(["1/2 milestones", "50%"]);
    expect(byClass(cards[0], "cad-proj-progress-fill")[0].style.width).toBe("50%");
    expect(byClass(cards[0], "cad-proj-next")[0].children.map((c) => c.text)).toEqual([
      "NEXT · ", new Date("2026-11-15").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }), " — Launch",
    ]);
    expect(byClass(cards[1], "cad-proj-progress-label")[0].children.map((c) => c.text)).toEqual(["0/0 milestones", "0%"]);
    const event = byClass(cards[0], "cad-proj-title")[0].trigger("click");
    expect(event.defaultPrevented).toBe(true);
    expect(opened.mock.calls).toEqual([["project", file(project.path)]]);
  });

  it("tiles other entities with up to four other fields, links clickable; QUIRK: an empty list counts as filled", () => {
    const { view, parent, opened, file } = setup([companyAcme, contactJane]);
    view._renderSingleCrossSection(parent, "contact", "company", "tile", "Acme Corp");
    const [card] = byClass(parent, "cad-proj-card");
    expect(byClass(card, "cad-proj-title")[0].text).toBe("Jane Doe");
    expect(byClass(card, "cad-proj-pills")[0].children).toEqual([]);
    const fields = byClass(card, "cad-proj-meta")[0].children;
    expect(fields.map((f) => f.children.map((c) => [c.localName, c.text]))).toEqual([
      [["span", "Email: "], ["span", "jane@acme.test"]],
      [["span", "Phone: "], ["span", ""]],
      [["span", "Company: "], ["a", "Acme Corp"]],
      [["span", "Role: "], ["span", "CTO"]],
    ]);
    const companyLink = fields[2].children[1];
    const event = companyLink.trigger("click");
    expect([event.defaultPrevented, event.propagationStopped]).toEqual([true, true]);
    expect(opened.mock.calls).toEqual([["company", file(companyAcme.path)]]);
  });

  it("opens a tile's missing link target by its text, and resolves folder: fields to their entity", () => {
    const original = ENTITIES.contact.fields;
    ENTITIES.contact.fields = [original[0], { key: "employer", label: "Employer", suggestionSource: "folder:Cadence/Companies" }, { key: "company", label: "Company" }];
    try {
      const contact: MockFileSpec = { path: "Cadence/Contacts/Bo.md", frontmatter: { type: "contact", name: "Bo", employer: "[[Acme Corp]]", company: ["[[Initech]]", "[[Acme Corp]]"] } };
      const { view, parent, opened, file, app } = setup([companyAcme, contact]);
      view._renderSingleCrossSection(parent, "contact", "company", "tile", "Acme Corp");
      const links = byClass(parent, "cad-proj-meta")[0].findAll("a");
      expect(links.map((a) => a.text)).toEqual(["Acme Corp", "Initech", "Acme Corp"]);
      links.forEach((a) => a.trigger("click"));
      expect(opened.mock.calls).toEqual([["company", file(companyAcme.path)], ["company", file(companyAcme.path)]]);
      expect(app.workspace.openedLinks).toEqual([["Initech", "", false]]);
    } finally {
      ENTITIES.contact.fields = original;
    }
  });

  it("pills the first value of a status/type/tier field", () => {
    const partner: MockFileSpec = { path: "Cadence/Partners/P.md", frontmatter: { type: "partner", name: "P", tier: ["Gold Plus"], company: "Acme Corp" } };
    const { view, parent } = setup([partner]);
    view._renderSingleCrossSection(parent, "partner", "company", "tile", "Acme Corp");
    expect(byClass(parent, "cad-proj-pills")[0].children.map((p) => [p.classes.join(" "), p.text])).toEqual([["cad-pill cad-pill-gold-plus", "Gold Plus"]]);
  });

  it("boards targets into enum columns (case-insensitive), with counts and value sums", () => {
    const { view, parent } = setup(files);
    view._renderSingleCrossSection(parent, "deal", "company", "kanban", "Acme Corp");
    const cols = byClass(parent, "cad-kanban-col");
    expect(cols.map((c) => c.dataset.stage)).toEqual(ENTITIES.deal.fields[1].options);
    const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    expect(cols.map((c) => byClass(c, "cad-kanban-col-meta")[0].text)).toEqual([
      `0 · ${money(0)}`, `0 · ${money(0)}`, `1 · ${money(12000)}`, `0 · ${money(0)}`, `1 · ${money(500)}`, `0 · ${money(0)}`,
    ]);
    expect(byClass(cols[0], "cad-empty").map((e) => e.text)).toEqual(["—"]);
    const [card] = byClass(cols[2], "cad-kanban-card");
    expect(card.dataset.path).toBe(dealAcme.path);
    expect(card.draggable).toBe(true);
    expect(byClass(card, "cad-kanban-card-title")[0].text).toBe("Acme renewal");
    expect(byClass(card, "cad-kanban-card-meta")[0].children.map((c) => c.text)).toEqual([money(12000), " · ", "Acme Corp", " · ", "Jane Doe", " · ", "Sam Lee"]);
  });

  it("opens a card's detail form on click and its relation links by target", () => {
    const { view, parent, opened, file } = setup([...files, contactJane]);
    view._renderSingleCrossSection(parent, "deal", "company", "kanban", "Acme Corp");
    const [card] = byClass(byClass(parent, "cad-kanban-col")[2], "cad-kanban-card");
    const links = card.findAll("a");
    links[1].trigger("click");
    links[2].trigger("click");
    card.trigger("click");
    expect(opened.mock.calls).toEqual([["contact", file(contactJane.path)], ["deal", file(dealAcme.path)]]);
  });

  it("drags a card to another column by writing the group field, then re-renders", async () => {
    const { view, parent, rendered, app } = setup(files);
    view._renderSingleCrossSection(parent, "deal", "company", "kanban", "Acme Corp");
    const cols = byClass(parent, "cad-kanban-col");
    const [card] = byClass(cols[2], "cad-kanban-card");
    const data: Record<string, string> = {};
    const dataTransfer = { effectAllowed: "", dropEffect: "", setData: (k: string, v: string) => (data[k] = v), getData: (k: string) => data[k] ?? "" };
    card.trigger("dragstart", { dataTransfer });
    expect(card.classes).toContain("dragging");
    expect(data).toEqual({ "text/cadence-entity": dealAcme.path, "text/cadence-stage": "Proposal", "text/plain": "[[Acme renewal]]" });
    const list = byClass(cols[4], "cad-kanban-col-list")[0];
    list.trigger("dragover", { dataTransfer });
    expect(cols[4].classes).toContain("drag-over");
    expect(dataTransfer.dropEffect).toBe("move");
    list.trigger("drop", { dataTransfer });
    await flush();
    expect(cols[4].classes).not.toContain("drag-over");
    expect(app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(dealAcme.path) as TFile)?.frontmatter?.stage).toBe("Won");
    expect(Notice.messages.at(-1)).toBe("Moved to Won");
    expect(rendered).toHaveBeenCalledTimes(1);
    card.trigger("dragend");
    expect(card.classes).not.toContain("dragging");
  });

  it("ignores a drop onto the card's own column", async () => {
    const { view, parent, rendered } = setup(files);
    view._renderSingleCrossSection(parent, "deal", "company", "kanban", "Acme Corp");
    const cols = byClass(parent, "cad-kanban-col");
    const data = { "text/cadence-entity": dealAcme.path, "text/cadence-stage": "Proposal" } as Record<string, string>;
    byClass(cols[2], "cad-kanban-col-list")[0].trigger("drop", { dataTransfer: { getData: (k: string) => data[k] } });
    await flush();
    expect(rendered).not.toHaveBeenCalled();
  });

  it("marks cards touch-only and not draggable on mobile", () => {
    const { view, parent } = setup(files);
    Platform.isMobile = true;
    try {
      view._renderSingleCrossSection(parent, "deal", "company", "kanban", "Acme Corp");
    } finally {
      Platform.isMobile = false;
    }
    const [card] = byClass(parent, "cad-kanban-card");
    expect(card.draggable).toBe(false);
    expect(card.classes).toContain("cad-kanban-card-touch");
  });
});

describe("_renderCrossSections", () => {
  const files = [companyAcme, dealAcme, dealGlobex, dealOther];
  const config = (viewType: string, extra: Record<string, unknown> = {}) => ({ id: `x-${viewType}`, parentEntity: "company", targetEntity: "deal", linkField: "company", viewType, ...extra });

  it("renders nothing when no cross section targets the parent entity", () => {
    const { view, parent } = setup(files, { crossSections: [config("table", { parentEntity: "contact" })] });
    view._renderCrossSections(parent, "company", "Acme Corp");
    view._renderCrossSections(parent, "company", "Acme Corp");
    expect(parent.children).toEqual([]);
    const bare = setup(files, { crossSections: undefined });
    bare.view._renderCrossSections(bare.parent, "company", "Acme Corp");
    expect(bare.parent.children).toEqual([]);
  });

  it("heads each section with the plural, link field and view, and tables the linked targets", () => {
    const { view, parent } = setup(files, { crossSections: [config("table"), config("table", { targetEntity: "nope" })] });
    const table = vi.spyOn(view, "_renderEntityTable").mockImplementation(() => {});
    view._renderCrossSections(parent, "company", "acme corp");
    expect(parent.children).toHaveLength(1);
    expect(parent.findAll("h3").map((h) => h.text)).toEqual(["DEALS (COMPANY) — TABLE"]);
    const [, entity, list, columns] = table.mock.calls[0];
    expect([entity, columns]).toEqual(["deal", ENTITIES.deal.columns]);
    expect((list as unknown[]).length).toBe(2);
  });

  it("QUIRK: shows its delete prompt and empty state in French", async () => {
    const { view, parent, plugin, rendered } = setup(files, { crossSections: [config("table"), config("tile", { id: "keep" })] });
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    view._renderCrossSections(parent, "company", "Nobody");
    expect(parent.querySelectorAll(".cad-empty").map((e) => e.text)).toEqual(["Aucun élément lié trouvé.", "Aucun élément lié trouvé."]);
    const del = parent.findAll("button")[0];
    expect([del.text, del.title]).toEqual(["×", "Supprimer cette section croisée"]);
    del.trigger("click");
    await flush();
    expect(confirm.mock.calls).toEqual([["Supprimer cette section croisée ?"]]);
    expect(plugin.saves).toBe(0);
    confirm.mockReturnValue(true);
    del.trigger("click");
    await flush();
    expect(plugin.settings.crossSections.map((c: { id: string }) => c.id)).toEqual(["keep"]);
    expect(plugin.saves).toBe(1);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("tiles the linked targets with their first field and the next three non-empty fields", () => {
    const { view, parent, opened, file } = setup(files, { crossSections: [config("tile")] });
    view._renderCrossSections(parent, "company", "Acme Corp");
    const cards = byClass(parent, "cad-proj-card");
    expect(cards.map((c) => [c.children[0].text, c.children[1].children.map((m) => m.text)])).toEqual([
      ["Acme renewal", ["Stage: Proposal", `Value: ${(12000).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`, "Company: [[Acme Corp]]"]],
      ["Globex deal", ["Stage: Won", `Value: ${(500).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`, "Company: [[ acme corp ]]"]],
    ]);
    cards[1].trigger("click");
    expect(opened.mock.calls).toEqual([["deal", file(dealGlobex.path)]]);
  });

  it("boards the linked targets into enum columns, with a French empty column", () => {
    const { view, parent, opened, file } = setup(files, { crossSections: [config("kanban")] });
    view._renderCrossSections(parent, "company", "Acme Corp");
    const cols = byClass(parent, "cad-stat-card");
    expect(cols.map((c) => c.children[0].text)).toEqual(["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]);
    expect(cols[0].children[1].text).toBe("Aucun élément");
    const rows = byClass(cols[2], "cad-dash-row");
    expect(rows.map((r) => r.text)).toEqual(["Acme renewal"]);
    rows[0].trigger("click");
    expect(opened.mock.calls).toEqual([["deal", file(dealAcme.path)]]);
  });
});

describe("_renderDynamicH2Section", () => {
  const files = [companyAcme, dealAcme, dealGlobex, dealOther];

  it.each([
    ["Tasks", "_renderTaskSection"], ["Todo #tasks", "_renderTaskSection"],
    ["milestones", "_renderMilestoneSection"], ["Plan #milestones", "_renderMilestoneSection"],
  ])("routes %s to %s with the parsed section", (rawKey, method) => {
    const { view, parent } = setup();
    const tasks = vi.spyOn(view, "_renderTaskSection").mockImplementation(() => {});
    const milestones = vi.spyOn(view, "_renderMilestoneSection").mockImplementation(() => {});
    const file = new TFile("p.md");
    const flash = () => {};
    const body = method === "_renderTaskSection" ? "- [ ] one\n- [x] two" : "- [ ] Launch — 2026-11-15";
    view._renderDynamicH2Section(parent, file, { [rawKey]: body }, rawKey, flash);
    const spy = method === "_renderTaskSection" ? tasks : milestones;
    const other = method === "_renderTaskSection" ? milestones : tasks;
    expect(other).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);
    const [p, f, list, fl, key] = spy.mock.calls[0];
    expect([p, f, fl, key]).toEqual([parent, file, flash, rawKey]);
    expect((list as unknown[]).length).toBe(method === "_renderTaskSection" ? 2 : 1);
  });

  it.each([["Notes"], ["Notes #text"], ["Deals #crossdeal"]])("renders %s as a generic text section", (rawKey) => {
    const { view, parent } = setup();
    const generic = vi.spyOn(view, "_renderGenericTextSection").mockImplementation(() => {});
    const file = new TFile("p.md");
    const sections = { [rawKey]: "x" };
    view._renderDynamicH2Section(parent, file, sections, rawKey, undefined);
    expect(generic.mock.calls).toEqual([[parent, file, sections, rawKey, undefined]]);
  });

  it.each([["Deals #cross-deal-company"], ["Deals #cross-deal-company-table-x"], ["Deals #cross-nope-company-table"], ["C #chart-deal-company-stage"], ["C #chart-nope-company-stage-donut"]])(
    "QUIRK: a malformed or unknown-entity %s renders nothing at all",
    (rawKey) => {
      const { view, parent, file } = setup(files);
      const generic = vi.spyOn(view, "_renderGenericTextSection");
      view._renderDynamicH2Section(parent, file(companyAcme.path), {}, rawKey);
      expect(parent.children).toEqual([]);
      expect(generic).not.toHaveBeenCalled();
    },
  );

  it("renders a #cross- section as a full-width card counting the linked targets", () => {
    const { view, parent, file } = setup(files);
    const single = vi.spyOn(view, "_renderSingleCrossSection").mockImplementation(() => {});
    view._renderDynamicH2Section(parent, file(companyAcme.path), {}, "Deals #cross-deal-company-kanban");
    const [card] = parent.children;
    expect([card.classes[0], card.style.gridColumn]).toEqual(["cad-pd-card", "1 / -1"]);
    const head = card.children[0];
    expect(head.children[0].text).toBe("DEALS · 2");
    expect(head.children[1].text).toBe("+ Add Deal");
    const [body, target, link, viewType, parentName, list] = single.mock.calls[0];
    expect([body, target, link, viewType, parentName]).toEqual([card.children[1], "deal", "company", "kanban", "Acme Corp"]);
    expect((list as Array<{ basename: string }>).map((e) => e.basename).sort()).toEqual(["Acme renewal", "Globex deal"]);
  });

  it("adds a linked target from the cross card's button", () => {
    const { view, parent, file } = setup(files);
    const create = vi.spyOn(view, "_createEntityFromPrompt").mockResolvedValue(undefined);
    view._renderDynamicH2Section(parent, file(companyAcme.path), {}, "Deals #cross-deal-company-table");
    parent.findAll("button")[0].trigger("click");
    expect(create.mock.calls).toEqual([["deal", { company: "[[Acme Corp]]" }]]);
  });

  it("switches the cross view by rewriting the heading's tag in the note, then re-renders", async () => {
    const { view, parent, file, app, rendered } = setup(files);
    const acme = file(companyAcme.path);
    await app.vault.modify(acme, "# Acme\n## Deals (all) #cross-deal-company-table\nbody\n");
    view._renderDynamicH2Section(parent, acme, {}, "Deals (all) #cross-deal-company-table");
    const buttons = parent.findAll("button").slice(1);
    expect(buttons.map((b) => [b.icon, b.title])).toEqual([
      ["layout-list", "Table View"], ["kanban", "Kanban Board"], ["layout-grid", "Tile Grid"],
    ]);
    expect(buttons[0].attrs.style).toContain("background: var(--interactive-accent)");
    buttons[0].trigger("click");
    await flush();
    expect(rendered).not.toHaveBeenCalled();
    buttons[2].trigger("click");
    await flush();
    expect(await app.vault.read(acme)).toBe("# Acme\n## Deals (all) #cross-deal-company-tile\nbody\n");
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("renders a #chart- section counting the linked targets' raw group field, most frequent first", () => {
    const extra: MockFileSpec = { path: "Cadence/Pipeline/Z.md", frontmatter: { type: "deal", company: "Acme Corp", stage: ["[[Won]]", ""], owner: null } };
    const { view, parent, file } = setup([...files, extra]);
    const chart = vi.spyOn(view, "_drawChart").mockImplementation(() => {});
    view._renderDynamicH2Section(parent, file(companyAcme.path), {}, "By stage #chart-deal-company-stage-donut");
    view._renderDynamicH2Section(parent, file(companyAcme.path), {}, "By owner #chart-deal-company-owner-bar");
    expect(parent.children[0].children[0].children[0].text).toBe("BY STAGE · 3 Deals");
    expect(chart.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      ["donut", [{ label: "Won", count: 2 }, { label: "Proposal", count: 1 }, { label: "Unspecified", count: 1 }]],
      ["bar", [{ label: "Sam Lee", count: 2 }, { label: "Unspecified", count: 1 }]],
    ]);
    expect(chart.mock.calls[0][0]).toBe(parent.children[0].children[1].children[0]);
  });

  it("QUIRK: keeps the dashes of a multi-part chart style", () => {
    const { view, parent, file } = setup(files);
    const chart = vi.spyOn(view, "_drawChart").mockImplementation(() => {});
    view._renderDynamicH2Section(parent, file(companyAcme.path), {}, "S #chart-deal-company-stage-big-donut");
    expect(chart.mock.calls[0][1]).toBe("big-donut");
  });

  it("switches the chart style by rewriting the heading's tag, then re-renders", async () => {
    const { view, parent, file, app, rendered } = setup(files);
    const acme = file(companyAcme.path);
    await app.vault.modify(acme, "## By stage #chart-deal-company-stage-donut\n");
    view._renderDynamicH2Section(parent, acme, {}, "By stage #chart-deal-company-stage-donut");
    const buttons = parent.findAll("button");
    expect(buttons.map((b) => [b.text, b.title])).toEqual([["🍩", "donut"], ["📊", "bar"], ["🗃️", "kpi"], ["📋", "list"]]);
    expect(buttons[0].attrs.style).toContain("opacity: 1;");
    expect(buttons[1].attrs.style).toContain("opacity: 0.55;");
    buttons[2].trigger("click");
    await flush();
    expect(await app.vault.read(acme)).toBe("## By stage #chart-deal-company-stage-kpi\n");
    expect(rendered).toHaveBeenCalledTimes(1);
  });
});

