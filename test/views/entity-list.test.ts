import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";
import { projectTagged, projectWebsite } from "../fixtures/vault";
import { ENTITIES } from "../../src/constants/entities";
import { CadenceImportModal } from "../../src/modals/import-modal";
import { fmtValue } from "../../src/utils/format";
import type { EntityDef } from "../../src/types/entities";

/* Characterization tests for the generic entity list, renderEntityList: the
   page header and layout switcher, search, the field filters, the table
   (columns, sorting, cell kinds) and the card grid, plus every surface that
   routes through it. The kanban layout is in kanban.test.ts. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(files: MockFileSpec[] = [], mode = "crm.contacts", settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files, settings });
  made.view.mode = mode;
  const root = new FakeElement("div");
  const rendered = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
  const opened = vi.spyOn(made.view, "openEntityDetail").mockResolvedValue(undefined);
  const created = vi.spyOn(made.view, "_createEntityFromPrompt").mockResolvedValue(undefined);
  const links = vi.spyOn(made.view, "_renderEntityLinks").mockImplementation(() => {});
  const owners = vi.spyOn(made.view, "_renderOwnerLinks").mockImplementation(() => {});
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path);
  return { ...made, root, rendered, opened, created, links, owners, file };
}

const contact = (name: string, fm: Record<string, unknown>): MockFileSpec => ({ path: `Cadence/Contacts/${name}.md`, frontmatter: fm });
const JANE = contact("Jane Doe", { name: "Jane Doe", company: ["[[Acme Corp]]"], email: ["jane@acme.test"], role: ["CTO"], lastContact: "2026-09-30", tags: ["vip"] });
const BOB = contact("Bob Smith", { name: "Bob Smith", company: "[[Globex]]", role: "Sales", lastContact: "2026-08-01" });
const CAROL = contact("carol", { company: "Acme Corp", role: ["Team lead"] });
const CONTACTS = [JANE, BOB, CAROL];

const header = (root: FakeElement) => root.children[0];
const headerTexts = (root: FakeElement) => header(root).children[0].children.map((c) => c.text);
const actions = (root: FakeElement) => header(root).children[1].children;
const controls = (root: FakeElement) => root.children[1];
const search = (root: FakeElement) => controls(root).children[0].children[0];
const filters = (root: FakeElement) => controls(root).querySelectorAll("div.cad-filter-select-wrap").map((w) => w.children[0]);
const table = (root: FakeElement) => root.children[2].querySelectorAll("table")[0];
const heads = (root: FakeElement) => table(root).querySelectorAll("th").map((th) => th.children.map((c) => c.text));
const rows = (root: FakeElement) => table(root).querySelectorAll("tr.cad-row");
const names = (root: FakeElement) => rows(root).map((r) => r.children[0].children[0].text);
const wraps = (root: FakeElement) => root.children.slice(2).map((w) => [w.classes[0], w.style.display]);

function type(input: FakeElement, value: string) {
  input.value = value;
  input.trigger("input");
}

function choose(select: FakeElement, value: string) {
  select.value = value;
  select.trigger("change");
}

describe("renderEntityList: header and actions", () => {
  it("shows Coming soon for an unknown entity key, keeping the list class", async () => {
    const { view, root } = setup([], "crm.contacts");
    const soon = vi.spyOn(view, "renderComingSoon");
    await view.renderEntityList(root, "nope");
    expect(root.classes).toEqual(["cadence-list", "cadence-soon"]);
    expect(soon.mock.calls).toEqual([[root, view._resolveSurface("crm.contacts")]]);
  });

  it("titles the page with the plural and counts the entities in the folder", async () => {
    const { view, root } = setup(CONTACTS);
    await view.renderEntityList(root, "contact");
    expect(root.classes).toEqual(["cadence-list"]);
    expect(headerTexts(root)).toEqual(["CADENCE", "Contacts", "3 contacts in Cadence/Contacts"]);
  });

  it("uses the singular label for one entity, and opts.title over the plural", async () => {
    const { view, root } = setup([JANE]);
    await view.renderEntityList(root, "contact", { title: "Team" });
    expect(headerTexts(root)).toEqual(["CADENCE", "Team", "1 contact in Cadence/Contacts"]);
  });

  it("renders the layout switcher, Import CSV and + New buttons", async () => {
    const { view, root } = setup(CONTACTS);
    await view.renderEntityList(root, "contact");
    const [switcher, importBtn, newBtn] = actions(root);
    expect(switcher.classes).toEqual(["cad-layout-switcher"]);
    expect(switcher.children.map((b) => [b.icon, b.title, b.style.background])).toEqual([
      ["layout-list", "Table view", "var(--background-modifier-border)"],
      ["kanban", "Kanban board", "transparent"],
      ["layout-grid", "Card grid", "transparent"],
    ]);
    expect([importBtn.text, importBtn.classes]).toEqual(["Import CSV", ["cad-btn"]]);
    expect([newBtn.text, newBtn.classes]).toEqual(["+ New Contact", ["cad-btn", "primary"]]);
  });

  it("saves the clicked layout under the current mode, creating pageLayouts, then re-renders", async () => {
    const { view, root, plugin, rendered } = setup(CONTACTS);
    delete plugin.settings.pageLayouts;
    await view.renderEntityList(root, "contact");
    const event = actions(root)[0].children[2].trigger("click");
    await flush();
    expect(event.defaultPrevented).toBe(true);
    expect(plugin.settings.pageLayouts).toEqual({ "crm.contacts": "cards" });
    expect(plugin.saves).toBe(1);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("Import CSV opens the import modal for this entity; + New prompts for one", async () => {
    const { view, root, created } = setup(CONTACTS);
    const open = vi.spyOn(CadenceImportModal.prototype, "open").mockImplementation(() => {});
    await view.renderEntityList(root, "contact");
    actions(root)[1].trigger("click");
    expect(open).toHaveBeenCalledTimes(1);
    expect((open.mock.contexts[0] as Any).entityKey).toBe("contact");
    actions(root)[2].trigger("click");
    expect(created.mock.calls).toEqual([["contact"]]);
  });

  it("shows the empty state, and no controls, when the folder has no entities", async () => {
    const { view, root } = setup([]);
    await view.renderEntityList(root, "contact");
    expect(headerTexts(root)[2]).toBe("0 contacts in Cadence/Contacts");
    expect(root.children.length).toBe(2);
    expect(root.children[1].classes).toEqual(["cad-empty-state"]);
    expect(root.children[1].children.map((c) => c.text)).toEqual([
      "No contacts yet",
      'Drop a markdown note in Cadence/Contacts/ with frontmatter, or hit "+ New" above.',
    ]);
  });

  it("applies opts.filter before counting, and shows the empty state when it rejects everything", async () => {
    const { view, root } = setup(CONTACTS);
    await view.renderEntityList(root, "contact", { filter: (e: Any) => e.basename === "carol" });
    expect(headerTexts(root)[2]).toBe("1 contact in Cadence/Contacts");
    expect(names(root)).toEqual(["carol"]);
    const empty = new FakeElement("div");
    await view.renderEntityList(empty, "contact", { filter: () => false });
    expect(empty.children[1].classes).toEqual(["cad-empty-state"]);
  });
});

describe("renderEntityList: layout", () => {
  it.each([
    ["projects.projects", "project", "cad-proj-grid-wrap"],
    ["crm.pipeline", "deal", "cad-kanban-board-wrap"],
    ["crm.contacts", "contact", "cad-table-wrap"],
    ["custom-vendors", "contact", "cad-table-wrap"],
  ])("defaults %s to its layout", async (mode, entityKey, shown) => {
    const files = { project: [projectWebsite], deal: [{ path: "Cadence/Pipeline/A.md", frontmatter: { stage: "Lead" } }], contact: CONTACTS }[entityKey]!;
    const { view, root } = setup(files, mode);
    await view.renderEntityList(root, entityKey);
    await flush();
    const visible = wraps(root).filter(([, display]) => display === "block").map(([cls]) => cls);
    expect(visible).toEqual([shown]);
  });

  it("creates the three layout containers and shows only the saved one", async () => {
    const { view, root } = setup(CONTACTS, "crm.contacts", { pageLayouts: { "crm.contacts": "cards" } });
    await view.renderEntityList(root, "contact");
    expect(wraps(root)).toEqual([
      ["cad-table-wrap", "none"],
      ["cad-kanban-board-wrap", "none"],
      ["cad-proj-grid-wrap", "block"],
    ]);
    expect(actions(root)[0].children.map((b) => b.style.background)).toEqual([
      "transparent", "transparent", "var(--background-modifier-border)",
    ]);
  });

  it("QUIRK: an unknown saved layout shows no container at all", async () => {
    const { view, root } = setup(CONTACTS, "crm.contacts", { pageLayouts: { "crm.contacts": "gallery" } });
    await view.renderEntityList(root, "contact");
    expect(wraps(root).map(([, d]) => d)).toEqual(["none", "none", "none"]);
  });
});

describe("renderEntityList: search and filters", () => {
  it("renders a search box named after the plural", async () => {
    const { view, root } = setup(CONTACTS);
    await view.renderEntityList(root, "contact");
    expect(search(root).localName).toBe("input");
    expect(search(root).placeholder).toBe("Search contacts...");
  });

  it("offers one select per enum field or known relation key that has values, options sorted with links unwrapped", async () => {
    const { view, root } = setup(CONTACTS);
    await view.renderEntityList(root, "contact");
    expect(filters(root).map((s) => s.options.map((o) => [o.value, o.text]))).toEqual([
      [["", "All Companys"], ["Acme Corp", "Acme Corp"], ["Globex", "Globex"]],
      [["", "All Roles"], ["CTO", "CTO"], ["Sales", "Sales"], ["Team lead", "Team lead"]],
    ]);
  });

  it("skips a filterable field with no values", async () => {
    const { view, root } = setup([contact("X", { name: "X" })]);
    await view.renderEntityList(root, "contact");
    expect(filters(root)).toEqual([]);
  });

  it("filters rows by the selected value, case-insensitively, through array values", async () => {
    const { view, root } = setup(CONTACTS);
    await view.renderEntityList(root, "contact");
    const [company, role] = filters(root);
    choose(company, "Acme Corp");
    expect(names(root)).toEqual(["carol", "Jane Doe"]);
    choose(role, "CTO");
    expect(names(root)).toEqual(["Jane Doe"]);
    choose(company, "");
    choose(role, "");
    expect(names(root)).toEqual(["Bob Smith", "carol", "Jane Doe"]);
  });

  it("searches every column and the basename, lower-cased and trimmed", async () => {
    const { view, root } = setup(CONTACTS);
    await view.renderEntityList(root, "contact");
    type(search(root), "  GLOBEX ");
    expect(names(root)).toEqual(["Bob Smith"]);
    type(search(root), "car");
    expect(names(root)).toEqual(["carol"]);
    type(search(root), "vip");
    expect(names(root)).toEqual(["Jane Doe"]);
  });

  it("shows a full-width 'No matching entries' row when nothing matches", async () => {
    const { view, root } = setup(CONTACTS);
    await view.renderEntityList(root, "contact");
    type(search(root), "zzz");
    const tds = table(root).querySelectorAll("td");
    expect(tds.map((td) => [td.text, (td as Any).colSpan, td.style.textAlign])).toEqual([["No matching entries found.", 7, "center"]]);
  });

  it("QUIRK: options are case-sensitive but matching is not, so 'Active' and 'active' both list and both match", async () => {
    const files = [contact("A", { name: "A", company: "Active" }), contact("B", { name: "B", company: "active" })];
    const { view, root } = setup(files);
    await view.renderEntityList(root, "contact");
    expect(filters(root)[0].options.map((o) => o.value)).toEqual(["", "Active", "active"]);
    choose(filters(root)[0], "active");
    expect(names(root)).toEqual(["A", "B"]);
  });

  it("combines search and filters", async () => {
    const { view, root } = setup(CONTACTS);
    await view.renderEntityList(root, "contact");
    choose(filters(root)[0], "Acme Corp");
    type(search(root), "team");
    expect(names(root)).toEqual(["carol"]);
  });
});

describe("renderEntityList: table", () => {
  it("shows def.columns first, then every other field", async () => {
    const { view, root } = setup(CONTACTS);
    await view.renderEntityList(root, "contact");
    expect(heads(root).map((h) => h[0])).toEqual(["Name ", "Company ", "Email ", "Phone ", "Role ", "Last contact ", "Tags "]);
  });

  it("QUIRK: opts.columns only reorders; the remaining fields are still appended", async () => {
    const { view, root } = setup(CONTACTS);
    await view.renderEntityList(root, "contact", { columns: ["name", "role", "email", "company"] });
    expect(heads(root).map((h) => h[0])).toEqual(["Name ", "Role ", "Email ", "Company ", "Phone ", "Last contact ", "Tags "]);
  });

  it("sorts by the first column ascending, marking it ▲ and the rest ↕", async () => {
    const { view, root } = setup(CONTACTS);
    await view.renderEntityList(root, "contact");
    expect(names(root)).toEqual(["Bob Smith", "carol", "Jane Doe"]);
    const ths = table(root).querySelectorAll("th");
    expect(ths.map((th) => [th.children[1].text, th.children[1].style.opacity])).toEqual([
      ["▲", "1"], ["↕", "0.4"], ["↕", "0.4"], ["↕", "0.4"], ["↕", "0.4"], ["↕", "0.4"], ["↕", "0.4"],
    ]);
    expect([ths[0].style.cursor, ths[0].style.userSelect]).toEqual(["pointer", "none"]);
  });

  it("QUIRK: clicking the sorted header reverses it but still shows ▲", async () => {
    const { view, root } = setup(CONTACTS);
    await view.renderEntityList(root, "contact");
    table(root).querySelectorAll("th")[0].trigger("click");
    expect(names(root)).toEqual(["Jane Doe", "carol", "Bob Smith"]);
    expect(table(root).querySelectorAll("th")[0].children[1].text).toBe("▲");
  });

  it("clicking another header sorts by it ascending; dates sort by time", async () => {
    const { view, root } = setup(CONTACTS);
    await view.renderEntityList(root, "contact");
    table(root).querySelectorAll("th")[0].trigger("click");
    table(root).querySelectorAll("th")[5].trigger("click");
    // carol has no lastContact → time 0, first.
    expect(names(root)).toEqual(["carol", "Bob Smith", "Jane Doe"]);
    expect(table(root).querySelectorAll("th").map((th) => th.children[1].text)).toEqual(["↕", "↕", "↕", "↕", "↕", "▲", "↕"]);
  });

  it("sorts strings with [[ ]] stripped, numerically and case-insensitively", async () => {
    const files = [
      contact("a", { name: "Item 10", company: "[[beta]]" }),
      contact("b", { name: "item 9", company: "[[Alpha]]" }),
      contact("c", { name: "Item 1", company: "gamma" }),
    ];
    const { view, root } = setup(files);
    await view.renderEntityList(root, "contact");
    expect(names(root)).toEqual(["Item 1", "item 9", "Item 10"]);
    table(root).querySelectorAll("th")[1].trigger("click");
    expect(names(root)).toEqual(["item 9", "Item 10", "Item 1"]);
  });

  it("formats each cell by field type, and links the primary column to the detail form", async () => {
    const { view, root, opened, links, file } = setup([JANE]);
    await view.renderEntityList(root, "contact");
    const cells = rows(root)[0].children;
    const name = cells[0].children[0];
    expect([name.localName, name.classes, name.text]).toEqual(["a", ["cad-row-primary"], "Jane Doe"]);
    const event = name.trigger("click");
    expect(event.defaultPrevented).toBe(true);
    expect(opened.mock.calls).toEqual([["contact", file(JANE.path)]]);
    expect(links.mock.calls).toEqual([[cells[1], ["[[Acme Corp]]"], "company"]]);
    expect(cells.slice(2).map((c) => c.text)).toEqual(["jane@acme.test", "", "CTO", fmtValue("2026-09-30", "date"), "#vip"]);
  });

  it("falls back to the basename when the primary value formats empty", async () => {
    const { view, root } = setup([CAROL]);
    await view.renderEntityList(root, "contact");
    expect(names(root)).toEqual(["carol"]);
  });

  it("renders owner and assigned as contact links without the prefix", async () => {
    const lead: MockFileSpec = { path: "Cadence/Leads/L.md", frontmatter: { name: "L", assigned: "[[Sam]]" } };
    const { view, root, owners } = setup([lead], "prm.leads");
    await view.renderEntityList(root, "lead");
    const cells = rows(root)[0].children;
    expect(owners.mock.calls).toEqual([[cells[4], "[[Sam]]", false]]);
  });
});

describe("renderEntityList: a custom entity (custom pages)", () => {
  const VENDOR: EntityDef = {
    folder: "Cadence/Vendors",
    label: "Vendor",
    plural: "Vendors",
    fields: [
      { key: "name", label: "Name", primary: true, type: "text" },
      { key: "status", label: "Status", type: "enum", options: ["Active", "Paused"] },
      { key: "spend", label: "Spend", type: "number" },
      { key: "owner", label: "Owner", type: "multitext", suggestionSource: "folder:Cadence/Contacts" },
      { key: "project", label: "Project", type: "multitext", suggestionSource: "folder:Cadence/Projects" },
      { key: "notes", label: "Notes", type: "multitext" },
      { key: "partner", label: "Partner" },
      { key: "contacts", label: "Contacts" },
      { key: "related", label: "Related" },
      { key: "region", label: "Region", type: "text" },
    ],
    columns: ["name", "status", "spend"],
  };
  const ACME: MockFileSpec = {
    path: "Cadence/Vendors/Acme.md",
    frontmatter: {
      name: "Acme", status: "Active", spend: 30, owner: ["[[Sam]]"], project: ["[[Site]]"], notes: ["a", "b"],
      partner: "[[Initech]]", contacts: "[[Jane]]", related: "[[Site]]", region: "EMEA",
    },
  };
  const ZED: MockFileSpec = { path: "Cadence/Vendors/Zed.md", frontmatter: { name: "Zed", status: ["Paused"], spend: 4 } };

  beforeEach(() => {
    ENTITIES.vendor = VENDOR;
  });
  afterEach(() => {
    delete ENTITIES.vendor;
  });

  it("routes each cell kind: owner, folder-sourced multitext, partner, contacts, related and plain text", async () => {
    const { view, root, owners, links } = setup([ACME], "custom-vendors");
    await view.renderEntityList(root, "vendor");
    const cells = rows(root)[0].children;
    expect(owners.mock.calls).toEqual([[cells[3], ["[[Sam]]"], false]]);
    expect(links.mock.calls).toEqual([
      [cells[4], ["[[Site]]"], "folder:Cadence/Projects"],
      [cells[6], "[[Initech]]", "partner"],
      [cells[7], "[[Jane]]", "contact"],
      [cells[8], "[[Site]]", "project"],
    ]);
    expect([cells[1].text, cells[2].text, cells[5].text, cells[9].text]).toEqual(["Active", "30", "a, b", "EMEA"]);
  });

  it("filters on its enum field, and sorts a number column numerically", async () => {
    const { view, root } = setup([ACME, ZED], "custom-vendors");
    await view.renderEntityList(root, "vendor");
    expect(filters(root).map((s) => s.options.map((o) => o.value))).toEqual([["", "Active", "Paused"], ["", "Site"]]);
    table(root).querySelectorAll("th")[2].trigger("click");
    expect(names(root)).toEqual(["Zed", "Acme"]);
    choose(filters(root)[0], "Paused");
    expect(names(root)).toEqual(["Zed"]);
  });

  it("card grid: title, status pill, and the first four other fields that have values", async () => {
    const { view, root, opened, file } = setup([ACME], "custom-vendors", { pageLayouts: { "custom-vendors": "cards" } });
    await view.renderEntityList(root, "vendor");
    const card = root.children[4].querySelectorAll("div.cad-proj-card")[0];
    const [head, meta] = card.children;
    expect([head.children[0].text, head.children[0].classes]).toEqual(["Acme", ["cad-proj-title"]]);
    head.children[0].trigger("click");
    expect(opened.mock.calls).toEqual([["vendor", file(ACME.path)]]);
    expect(head.children[1].children.map((p) => [p.classes, p.text])).toEqual([[["cad-pill", "cad-pill-active"], "Active"]]);
    expect(meta.children.map((d) => d.children.map((c) => c.text))).toEqual([
      ["Spend: ", "30"],
      ["Owner: ", "Sam"],
      ["Project: ", "Site"],
      ["Notes: ", "a, b"],
    ]);
  });

  it("card links resolve a folder: source to its entity, owner to contact, and open missing notes by name", async () => {
    const sam: MockFileSpec = { path: "Cadence/Contacts/Sam.md", frontmatter: { name: "Sam" } };
    const { view, root, opened, file, app } = setup([ACME, sam], "custom-vendors", { pageLayouts: { "custom-vendors": "cards" } });
    await view.renderEntityList(root, "vendor");
    const meta = root.children[4].querySelectorAll("div.cad-proj-meta")[0];
    const ownerLink = meta.children[1].children[1];
    expect([ownerLink.style.textDecoration, ownerLink.style.cursor]).toEqual(["underline", "pointer"]);
    const event = ownerLink.trigger("click");
    expect([event.defaultPrevented, event.propagationStopped]).toEqual([true, true]);
    expect(opened.mock.calls).toEqual([["contact", file(sam.path)]]);
    meta.children[2].children[1].trigger("click");
    expect(app.workspace.openedLinks).toEqual([["Site", "", false]]);
  });

  it("card pill uses the first value of an array status", async () => {
    const { view, root } = setup([ZED], "custom-vendors", { pageLayouts: { "custom-vendors": "cards" } });
    await view.renderEntityList(root, "vendor");
    const pills = root.children[4].querySelectorAll("span.cad-pill");
    expect(pills.map((p) => [p.classes[1], p.text])).toEqual([["cad-pill-paused", "Paused"]]);
  });
});

describe("renderEntityList: card grid", () => {
  it("non-project cards take the pill from the first status/type/tier field, and comma-separate links", async () => {
    const partner: MockFileSpec = {
      path: "Cadence/Partners/Initech.md",
      frontmatter: { name: "Initech", tier: "Gold", status: "Active", owner: "[[Sam]], [[Kim]]", region: "EMEA" },
    };
    const { view, root } = setup([partner], "prm.partners", { pageLayouts: { "prm.partners": "cards" } });
    await view.renderEntityList(root, "partner");
    const card = root.children[4].querySelectorAll("div.cad-proj-card")[0];
    // fields.find matches in field order, so tier wins over status.
    expect(card.children[0].children[1].children.map((p) => p.text)).toEqual(["Gold"]);
    expect(card.children[1].children.map((d) => d.children.map((c) => c.text))).toEqual([
      ["Status: ", "Active"],
      ["Owner: ", "Sam", ", ", "Kim"],
      ["Region: ", "EMEA"],
    ]);
  });

  it("a contact card has no pill (no status, type, tier or enum field) and lists four fields", async () => {
    const { view, root } = setup([JANE], "crm.contacts", { pageLayouts: { "crm.contacts": "cards" } });
    await view.renderEntityList(root, "contact");
    expect(root.children[4].querySelectorAll("span.cad-pill")).toEqual([]);
    const meta = root.children[4].querySelectorAll("div.cad-proj-meta")[0];
    expect(meta.children.map((d) => d.children[0].text)).toEqual(["Email: ", "Company: ", "Role: ", "Last contact: "]);
  });

  it("project cards show status and priority pills, owner, due, milestone progress and the next milestone", async () => {
    const { view, root, opened, owners, file } = setup([projectWebsite, projectTagged], "projects.projects");
    await view.renderEntityList(root, "project");
    await flush();
    const cards = root.children[4].querySelectorAll("div.cad-proj-card");
    expect(cards.length).toBe(2);
    const [head, metaRow, prog, next] = cards[1].children;
    expect(head.children[0].text).toBe("Website relaunch");
    head.children[0].trigger("click");
    expect(opened.mock.calls).toEqual([["project", file(projectWebsite.path)]]);
    expect(head.children[1].children.map((p) => [p.classes, p.text])).toEqual([
      [["cad-pill", "cad-pill-active"], "active"],
      [["cad-pill", "cad-pill-prio-high"], "high"],
    ]);
    expect(owners.mock.calls).toEqual([[metaRow, ["[[Sam Lee]]"]]]);
    expect(metaRow.children.map((c) => c.text)).toEqual([`Due: ${fmtValue("2026-12-15", "date")}`]);
    expect(prog.dataset.pctBand).toBe("warn");
    expect(prog.children[0].children.map((c) => c.text)).toEqual(["1/4 milestones", "25%"]);
    expect(prog.children[1].children[0].style.width).toBe("25%");
    expect(next.children.map((c) => c.text)).toEqual(["NEXT · ", fmtValue("2026-10-20", "date"), " — Content freeze"]);
  });

  it("project cards default the status to active and skip priority, owner, due and next when absent", async () => {
    const { view, root, owners } = setup([projectTagged], "projects.projects");
    await view.renderEntityList(root, "project");
    await flush();
    const card = root.children[4].querySelectorAll("div.cad-proj-card")[0];
    expect(card.children.length).toBe(3);
    expect(card.children[0].children[1].children.map((p) => p.text)).toEqual(["active"]);
    expect(owners).not.toHaveBeenCalled();
    expect(card.children[2].children[0].children.map((c) => c.text)).toEqual(["2/2 milestones", "100%"]);
  });
});

describe("renderEntityList: every routed surface", () => {
  it.each([
    ["crm.pipeline", "deal", { title: "A", stage: "Lead" }, "Deals", "cad-kanban-board-wrap"],
    ["crm.contacts", "contact", { name: "A" }, "Contacts", "cad-table-wrap"],
    ["crm.companies", "company", { name: "A" }, "Companies", "cad-table-wrap"],
    ["crm.activities", "activity", { subject: "A", type: "Call" }, "Activities", "cad-table-wrap"],
    ["projects.projects", "project", { name: "A" }, "Projects", "cad-proj-grid-wrap"],
    ["prm.partners", "partner", { name: "A" }, "Partners", "cad-table-wrap"],
    ["prm.registrations", "registration", { title: "A" }, "Registrations", "cad-table-wrap"],
    ["prm.commissions", "commission", { reference: "A" }, "Commissions", "cad-table-wrap"],
    ["prm.leads", "lead", { name: "A" }, "Leads", "cad-table-wrap"],
    ["prm.certifications", "certification", { name: "A" }, "Certifications", "cad-table-wrap"],
    ["workflow.sequences", "sequence", { name: "A" }, "Sequences", "cad-table-wrap"],
  ])("%s renders %s from its folder", async (mode, entityKey, fm, plural, shown) => {
    const def = ENTITIES[entityKey];
    const { view, root } = setup([{ path: `${def.folder}/A.md`, frontmatter: fm }], mode);
    await view.renderEntityList(root, entityKey);
    await flush();
    expect(headerTexts(root).slice(1)).toEqual([plural, `1 ${def.label.toLowerCase()} in ${def.folder}`]);
    expect(wraps(root).filter(([, d]) => d === "block").map(([c]) => c)).toEqual([shown]);
    expect(root.children[4].querySelectorAll("a").concat(root.children[2].querySelectorAll("a"), root.children[3].querySelectorAll("div.cad-kanban-card-title")).map((a) => a.text)).toEqual(["A"]);
  });
});
