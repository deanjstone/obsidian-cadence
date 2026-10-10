import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, Notice, Platform, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";
import { ENTITIES } from "../../src/constants/entities";
import { CadenceImportModal } from "../../src/modals/import-modal";
import { fmtValue } from "../../src/utils/format";
import type { EntityDef } from "../../src/types/entities";

/* Characterization tests for the kanban: getEntityKanbanParams (which field
   groups the columns, and which columns), the kanban layout of
   renderEntityList (group-by selector, columns, cards, drag and drop), and
   renderEntityKanban, the older pipeline board that has no call site. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

afterEach(() => {
  vi.restoreAllMocks();
  Platform.isMobile = false;
  Notice.messages.length = 0;
});

function setup(files: MockFileSpec[] = [], mode = "crm.pipeline", settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files, settings: { pageLayouts: { [mode]: "kanban" }, ...settings } });
  made.view.mode = mode;
  const root = new FakeElement("div");
  const rendered = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
  const opened = vi.spyOn(made.view, "openEntityDetail").mockResolvedValue(undefined);
  const created = vi.spyOn(made.view, "_createEntityFromPrompt").mockResolvedValue(undefined);
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path);
  const fm = (path: string) => made.app.metadataCache.getFileCache(file(path) as Any)?.frontmatter;
  return { ...made, root, rendered, opened, created, file, fm };
}

const deal = (name: string, fm: Record<string, unknown>): MockFileSpec => ({ path: `Cadence/Pipeline/${name}.md`, frontmatter: fm });
const ACME = deal("Acme", { title: "Acme renewal", stage: ["Proposal"], value: 12000, company: ["[[Acme Corp]]"], contact: "[[Jane]]", owner: ["[[Sam]]"] });
const GLOBEX = deal("Globex", { stage: "proposal", value: "4500" });
const INITECH = deal("Initech", { title: "Initech", stage: "Won", value: 1000 });
const STRAY = deal("Stray", { title: "Stray", stage: "Archived" });
const DEALS = [ACME, GLOBEX, INITECH, STRAY];

const board = (root: FakeElement) => root.children[3].children[0];
const columns = (root: FakeElement) => board(root).children;
const column = (root: FakeElement, stage: string) => columns(root).find((c) => c.dataset.stage === stage)!;
const colHead = (col: FakeElement) => col.children[0].children.map((c) => c.text);
const cards = (col: FakeElement) => col.children[1].querySelectorAll("div.cad-kanban-card");
const cardTitles = (col: FakeElement) => cards(col).map((c) => c.children[0].text);
const groupSelect = (root: FakeElement) => root.children[1].querySelectorAll("select.cad-prop-input")[0];

function dataTransfer(data: Record<string, string> = {}) {
  const store: Record<string, string> = { ...data };
  return {
    store,
    dropEffect: "",
    effectAllowed: "",
    getData: (k: string) => store[k] ?? "",
    setData: (k: string, v: string) => {
      store[k] = v;
    },
  };
}

describe("getEntityKanbanParams", () => {
  it("returns status / Active, Done for an unknown entity", () => {
    const { view } = setup();
    expect(view.getEntityKanbanParams("nope")).toEqual({ groupBy: "status", groups: ["Active", "Done"] });
  });

  it.each([
    ["deal", "stage", ["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]],
    ["activity", "type", ["Call", "Email", "Meeting", "Note", "Task"]],
    ["partner", "tier", ["Gold", "Silver", "Bronze", "Standard"]],
    ["project", "status", ["active", "on_hold", "backlog", "done", "cancelled"]],
  ])("defaults %s to %s and its enum options", (entityKey, groupBy, groups) => {
    const { view } = setup();
    expect(view.getEntityKanbanParams(entityKey)).toEqual({ groupBy, groups });
  });

  it("QUIRK: with no enum/text field it groups by a missing 'status', so the columns are To Do / In Progress / Done", () => {
    const { view } = setup([{ path: "Cadence/Contacts/A.md", frontmatter: { name: "A", status: "x" } }]);
    // contact has no status field; the values come from frontmatter anyway.
    expect(view.getEntityKanbanParams("contact")).toEqual({ groupBy: "status", groups: ["x"] });
    const empty = setup();
    expect(empty.view.getEntityKanbanParams("contact")).toEqual({ groupBy: "status", groups: ["To Do", "In Progress", "Done"] });
  });

  it("uses the saved group-by for the entity, and its options", () => {
    const { view } = setup([], "crm.pipeline", { pageKanbanGroupBy: { partner: "status" } });
    expect(view.getEntityKanbanParams("partner")).toEqual({ groupBy: "status", groups: ["Active", "Onboarding", "Inactive", "Churned"] });
  });

  it("collects the distinct values, links unwrapped and comma-split, when the field has no options", () => {
    const files = [
      deal("A", { company: ["[[Acme Corp]]", "Globex"] }),
      deal("B", { company: "[[Initech]], Acme Corp" }),
      deal("C", { company: "" }),
    ];
    const { view } = setup(files, "crm.pipeline", { pageKanbanGroupBy: { deal: "company" } });
    expect(view.getEntityKanbanParams("deal")).toEqual({ groupBy: "company", groups: ["Acme Corp", "Globex", "Initech"] });
  });

  it("QUIRK: a saved group-by overrides even the deal and activity defaults", () => {
    const { view } = setup([], "crm.pipeline", { pageKanbanGroupBy: { deal: "owner" } });
    expect(view.getEntityKanbanParams("deal")).toEqual({ groupBy: "owner", groups: ["To Do", "In Progress", "Done"] });
  });
});

describe("renderEntityList: kanban layout", () => {
  it("offers a group-by selector of non-primary enum/text/multitext/tags fields, with the current one selected", async () => {
    const { view, root } = setup(DEALS);
    await view.renderEntityList(root, "deal");
    const select = groupSelect(root);
    expect(select.parent!.children[0].text).toBe("Group columns by:");
    expect(select.options.map((o) => [o.value, o.text, o.selected])).toEqual([["stage", "Stage", true]]);
  });

  it("saves a new group-by for the entity, creating pageKanbanGroupBy, and re-renders", async () => {
    const { view, root, plugin, rendered } = setup([{ path: "Cadence/Partners/P.md", frontmatter: { name: "P", tier: "Gold" } }], "prm.partners");
    delete plugin.settings.pageKanbanGroupBy;
    await view.renderEntityList(root, "partner");
    const select = groupSelect(root);
    expect(select.options.map((o) => [o.value, o.selected])).toEqual([["tier", true], ["status", false]]);
    select.value = "status";
    select.trigger("change");
    await flush();
    expect(plugin.settings.pageKanbanGroupBy).toEqual({ partner: "status" });
    expect(plugin.saves).toBe(1);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("has no selector when no field qualifies (untyped fields don't count)", async () => {
    const { view, root } = setup([{ path: "Cadence/Certifications/C.md", frontmatter: { name: "C" } }], "prm.certifications");
    await view.renderEntityList(root, "certification");
    expect(root.children[1].querySelectorAll("select.cad-prop-input")).toEqual([]);
  });

  it("QUIRK: the selector recomputes the params once per option", async () => {
    const { view, root } = setup([{ path: "Cadence/Partners/P.md", frontmatter: { name: "P" } }], "prm.partners");
    const params = vi.spyOn(view, "getEntityKanbanParams");
    await view.renderEntityList(root, "partner");
    // two options in the selector, then one more for the board.
    expect(params.mock.calls).toEqual([["partner"], ["partner"], ["partner"]]);
  });

  it("renders a column per group, matching case-insensitively through arrays and links", async () => {
    const { view, root } = setup(DEALS);
    await view.renderEntityList(root, "deal");
    expect(board(root).classes).toEqual(["cad-kanban-board"]);
    expect(columns(root).map((c) => c.dataset.stage)).toEqual(["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]);
    expect(cardTitles(column(root, "Proposal"))).toEqual(["Acme renewal", "Globex"]);
    expect(cardTitles(column(root, "Won"))).toEqual(["Initech"]);
  });

  it("QUIRK: an entity whose value matches no group is on no column", async () => {
    const { view, root } = setup(DEALS);
    await view.renderEntityList(root, "deal");
    expect(columns(root).flatMap((c) => cardTitles(c))).toEqual(["Acme renewal", "Globex", "Initech"]);
  });

  it("heads each column with its count and the value field's total, or the count alone", async () => {
    const { view, root } = setup(DEALS);
    await view.renderEntityList(root, "deal");
    expect(colHead(column(root, "Proposal"))).toEqual(["Proposal", `2 · ${fmtValue(16500, "currency")}`]);
    expect(colHead(column(root, "Lead"))).toEqual(["Lead", `0 · ${fmtValue(0, "currency")}`]);
    expect(column(root, "Lead").children[1].children.map((c) => [c.classes, c.text])).toEqual([[["cad-empty"], "—"]]);
    const partners = setup([{ path: "Cadence/Partners/P.md", frontmatter: { name: "P", tier: "Gold" } }], "prm.partners");
    await partners.view.renderEntityList(partners.root, "partner");
    expect(colHead(column(partners.root, "Gold"))).toEqual(["Gold", "1"]);
  });

  it("applies search and filters to the board", async () => {
    const { view, root } = setup(DEALS);
    await view.renderEntityList(root, "deal");
    const input = root.children[1].children[0].children[0];
    input.value = "globex";
    input.trigger("input");
    expect(columns(root).flatMap((c) => cardTitles(c))).toEqual(["Globex"]);
  });

  it("cards show the title (or basename), the formatted value and relation links", async () => {
    const { view, root } = setup(DEALS);
    await view.renderEntityList(root, "deal");
    const [acme, globex] = cards(column(root, "Proposal"));
    expect(acme.dataset.path).toBe(ACME.path);
    expect(acme.children[1].children.map((c) => c.text)).toEqual([
      fmtValue(12000, "currency"), " · ", "Acme Corp", " · ", "Jane", " · ", "Sam",
    ]);
    expect(globex.children[1].children.map((c) => c.text)).toEqual([fmtValue("4500", "currency")]);
  });

  it("card links open the note's detail (owner as contact) or the link text, without opening the card", async () => {
    const sam: MockFileSpec = { path: "Cadence/Contacts/Sam.md", frontmatter: { name: "Sam" } };
    const { view, root, opened, file, app } = setup([ACME, sam]);
    await view.renderEntityList(root, "deal");
    const meta = cards(column(root, "Proposal"))[0].children[1];
    const owner = meta.children[6];
    expect([owner.localName, owner.style.textDecoration, owner.style.cursor]).toEqual(["a", "underline", "pointer"]);
    const event = owner.trigger("click");
    expect(event.propagationStopped).toBe(true);
    expect(opened.mock.calls).toEqual([["contact", file(sam.path)]]);
    meta.children[2].trigger("click");
    expect(app.workspace.openedLinks).toEqual([["Acme Corp", "", false]]);
  });

  it("clicking a card opens its detail form", async () => {
    const { view, root, opened, file } = setup(DEALS);
    await view.renderEntityList(root, "deal");
    cards(column(root, "Won"))[0].trigger("click");
    expect(opened.mock.calls).toEqual([["deal", file(INITECH.path)]]);
  });

  it("desktop cards are draggable and carry the path, stage and a wiki link", async () => {
    const { view, root } = setup(DEALS);
    await view.renderEntityList(root, "deal");
    const card = cards(column(root, "Won"))[0];
    expect(card.draggable).toBe(true);
    const dt = dataTransfer();
    card.trigger("dragstart", { dataTransfer: dt });
    expect(card.classes).toContain("dragging");
    expect([dt.effectAllowed, dt.store]).toEqual(["move", {
      "text/cadence-entity": INITECH.path, "text/cadence-stage": "Won", "text/plain": "[[Initech]]",
    }]);
    card.trigger("dragend");
    expect(card.classes).not.toContain("dragging");
  });

  it("mobile cards are not draggable and get the touch class", async () => {
    Platform.isMobile = true;
    const { view, root } = setup(DEALS);
    await view.renderEntityList(root, "deal");
    const card = cards(column(root, "Won"))[0];
    expect([card.draggable, card.classes]).toEqual([false, ["cad-kanban-card", "cad-kanban-card-touch"]]);
  });

  it("dragover highlights the column; dragleave clears it only when leaving the column", async () => {
    const { view, root } = setup(DEALS);
    await view.renderEntityList(root, "deal");
    const col = column(root, "Won");
    const dt = dataTransfer();
    const over = col.children[1].trigger("dragover", { dataTransfer: dt });
    expect([over.defaultPrevented, dt.dropEffect, col.classes]).toEqual([true, "move", ["cad-kanban-col", "drag-over"]]);
    col.children[1].trigger("dragleave", { relatedTarget: col.children[0] });
    expect(col.classes).toContain("drag-over");
    col.children[1].trigger("dragleave", { relatedTarget: null });
    expect(col.classes).toEqual(["cad-kanban-col"]);
  });

  it("QUIRK: dropping on the deal board writes a scalar stage, though deal notes store stage as a list", async () => {
    const { view, root, fm } = setup(DEALS);
    await view.renderEntityList(root, "deal");
    const col = column(root, "Won");
    col.addClass("drag-over");
    col.children[1].trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-entity": ACME.path, "text/cadence-stage": "Proposal" }) });
    await flush();
    expect(fm(ACME.path)!.stage).toBe("Won");
    expect(col.classes).toEqual(["cad-kanban-col"]);
    expect(Notice.messages).toEqual(["Moved to Won"]);
  });

  it("ignores a drop from the same stage, without a path, or for a missing file", async () => {
    const { view, root, fm } = setup(DEALS);
    await view.renderEntityList(root, "deal");
    const list = column(root, "Won").children[1];
    list.trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-entity": INITECH.path, "text/cadence-stage": "Won" }) });
    list.trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-stage": "Lead" }) });
    list.trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-entity": "Cadence/Pipeline/Gone.md" }) });
    await flush();
    expect(fm(ACME.path)!.stage).toEqual(["Proposal"]);
    expect(Notice.messages).toEqual([]);
  });

  it("reports a failed write", async () => {
    const { view, root, app } = setup(DEALS);
    vi.spyOn(app.fileManager, "processFrontMatter").mockRejectedValue(new Error("locked"));
    await view.renderEntityList(root, "deal");
    column(root, "Won").children[1].trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-entity": ACME.path }) });
    await flush();
    expect(Notice.messages).toEqual(["Failed to move: locked"]);
  });

  describe("drop writes by field kind", () => {
    const VENDOR: EntityDef = {
      folder: "Cadence/Vendors",
      label: "Vendor",
      plural: "Vendors",
      fields: [
        { key: "name", label: "Name", primary: true },
        { key: "region", label: "Region", type: "text" },
        { key: "labels", label: "Labels", type: "tags" },
        { key: "lists", label: "Lists", isList: true, type: "text" },
        { key: "owner", label: "Owner", type: "multitext", suggestionSource: "folder:Cadence/Contacts" },
        { key: "manager", label: "Manager", type: "text", suggestionSource: "contact" },
        { key: "notes", label: "Notes", type: "multitext", suggestionSource: "history" },
      ],
      columns: ["name"],
    };
    const V: MockFileSpec = {
      path: "Cadence/Vendors/V.md",
      frontmatter: { name: "V", region: "EU", labels: ["a"], lists: "x", owner: ["[[Sam]]"], manager: "[[Kim]]", notes: ["n"] },
    };
    beforeEach(() => {
      ENTITIES.vendor = VENDOR;
    });
    afterEach(() => {
      delete ENTITIES.vendor;
    });

    it.each([
      ["region", "US", "US"],
      ["labels", "b", ["b"]],
      ["lists", "y", ["y"]],
      ["owner", "Kim", ["[[Kim]]"]],
      ["manager", "Sam", "[[Sam]]"],
      ["notes", "m", ["m"]],
    ])("grouped by %s, dropping on %s writes %j", async (groupBy, stage, written) => {
      const files = [V, { path: "Cadence/Vendors/W.md", frontmatter: { name: "W", [groupBy]: stage } }];
      const { view, root, fm } = setup(files, "custom-v", { pageKanbanGroupBy: { vendor: groupBy } });
      await view.renderEntityList(root, "vendor");
      column(root, stage).children[1].trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-entity": V.path }) });
      await flush();
      expect(fm(V.path)![groupBy]).toEqual(written);
    });
  });
});

describe("renderEntityKanban (no call site)", () => {
  it("has no caller anywhere in src (no `.renderEntityKanban(` call)", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const files = readdirSync("src", { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile() && /\.(ts|js)$/.test(d.name))
      .map((d) => `${d.parentPath}/${d.name}`);
    const callers = files.filter((f) => /\.renderEntityKanban\(/.test(readFileSync(f, "utf8")));
    expect(callers).toEqual([]);
  });

  it("heads the board with the count and the total value, plus Import CSV and + New", async () => {
    const { view, root, created } = setup(DEALS);
    const open = vi.spyOn(CadenceImportModal.prototype, "open").mockImplementation(() => {});
    await view.renderEntityKanban(root, "deal", "stage", ["Proposal", "Won"]);
    expect(root.classes).toEqual(["cadence-kanban"]);
    const head = root.children[0];
    expect(head.children[0].children.map((c) => c.text)).toEqual(["CADENCE", "Deals", `4 deals · ${fmtValue(17500, "currency")} total`]);
    const [importBtn, newBtn] = head.children[1].children;
    importBtn.trigger("click");
    expect((open.mock.contexts[0] as Any).entityKey).toBe("deal");
    newBtn.trigger("click");
    expect(created.mock.calls).toEqual([["deal"]]);
  });

  it("QUIRK: matches stages by exact string, so 'proposal' and multi-value arrays miss", async () => {
    const files = [...DEALS, deal("Two", { title: "Two", stage: ["Won", "Lost"] })];
    const { view, root } = setup(files);
    await view.renderEntityKanban(root, "deal", "stage", ["Proposal", "Won", "Lost"]);
    const cols = root.children[1].children;
    expect(cols.map((c) => [c.dataset.stage, cardTitles(c)])).toEqual([
      ["Proposal", ["Acme renewal"]],
      ["Won", ["Initech", "Two"]],
      ["Lost", []],
    ]);
    expect(cols.map((c) => c.children[0].children[1].text)).toEqual([
      `1 · ${fmtValue(12000, "currency")}`, `2 · ${fmtValue(1000, "currency")}`, `0 · ${fmtValue(0, "currency")}`,
    ]);
  });

  it("cards show the value and comma-separated company and contact links", async () => {
    const sam: MockFileSpec = { path: "Cadence/Companies/Acme Corp.md", frontmatter: { name: "Acme Corp" } };
    const { view, root, opened, file, app } = setup([deal("M", { title: "M", stage: "Won", value: 5, company: "[[Acme Corp]], [[Beta]]", contact: ["[[Jane]]"] }), sam]);
    await view.renderEntityKanban(root, "deal", "stage", ["Won"]);
    const meta = cards(root.children[1].children[0])[0].children[1];
    expect(meta.children.map((c) => [c.classes[0], c.text])).toEqual([
      ["cad-kanban-card-value", fmtValue(5, "currency")], [undefined, " · "], ["cad-company-link", "Acme Corp"], [undefined, ", "],
      ["cad-company-link", "Beta"], [undefined, " · "], ["cad-contact-link", "Jane"],
    ]);
    meta.children[2].trigger("click");
    meta.children[6].trigger("click");
    expect(opened.mock.calls).toEqual([["company", file(sam.path)]]);
    expect(app.workspace.openedLinks).toEqual([["Jane", "", false]]);
  });

  it("drop writes [stage] when grouped by stage and a scalar otherwise", async () => {
    const { view, root, fm } = setup(DEALS);
    await view.renderEntityKanban(root, "deal", "stage", ["Won"]);
    root.children[1].children[0].children[1].trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-entity": GLOBEX.path }) });
    await flush();
    expect(fm(GLOBEX.path)!.stage).toEqual(["Won"]);
    const other = setup(DEALS);
    await other.view.renderEntityKanban(other.root, "deal", "owner", ["Kim"]);
    other.root.children[1].children[0].children[1].trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-entity": GLOBEX.path }) });
    await flush();
    expect(other.fm(GLOBEX.path)!.owner).toBe("Kim");
    expect(Notice.messages).toEqual(["Moved to Won", "Moved to Kim"]);
  });

  it("drag, drop guards, card click and mobile match the list's kanban", async () => {
    const { view, root, opened, file } = setup(DEALS);
    await view.renderEntityKanban(root, "deal", "stage", ["Won"]);
    const col = root.children[1].children[0];
    const card = cards(col)[0];
    const dt = dataTransfer();
    card.trigger("dragstart", { dataTransfer: dt });
    expect(dt.store).toEqual({ "text/cadence-entity": INITECH.path, "text/cadence-stage": "Won", "text/plain": "[[Initech]]" });
    col.children[1].trigger("dragover", { dataTransfer: dt });
    expect(col.classes).toContain("drag-over");
    col.children[1].trigger("drop", { dataTransfer: dt });
    await flush();
    expect(Notice.messages).toEqual([]);
    card.trigger("click");
    expect(opened.mock.calls).toEqual([["deal", file(INITECH.path)]]);
    Platform.isMobile = true;
    const mobile = setup(DEALS);
    await mobile.view.renderEntityKanban(mobile.root, "deal", "stage", ["Won", "Lead"]);
    expect(cards(mobile.root.children[1].children[0])[0].classes).toEqual(["cad-kanban-card", "cad-kanban-card-touch"]);
    expect(mobile.root.children[1].children[1].children[1].children[0].text).toBe("—");
  });
});
