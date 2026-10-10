import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeElement, type MockFileSpec } from "../mocks/obsidian";
import { makeAppView } from "../helpers/app-view";
import { ENTITIES } from "../../src/constants/entities";
import { CadenceImportModal } from "../../src/modals/import-modal";
import { fmtValue } from "../../src/utils/format";

/* Characterization tests for renderProjectsView, the older Projects card
   grid. It has no call site: the projects.projects route goes to
   renderEntityList. Characterized and kept, as renderEntityKanban was. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(files: MockFileSpec[] = []) {
  const made = makeAppView({ files });
  made.view.mode = "projects.projects";
  const root = new FakeElement("div");
  const opened = vi.spyOn(made.view, "openEntityDetail").mockResolvedValue(undefined);
  const created = vi.spyOn(made.view, "_createEntityFromPrompt").mockResolvedValue(undefined);
  const owners = vi.spyOn(made.view, "_renderOwnerLinks").mockImplementation(() => {});
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path);
  return { ...made, root, opened, created, owners, file };
}

const project = (name: string, frontmatter: Record<string, unknown>, milestones: string[] = []): MockFileSpec => ({
  path: `Cadence/Projects/${name}.md`,
  frontmatter,
  body: milestones.length ? `\n## Milestones\n${milestones.join("\n")}\n` : "",
});
const ALPHA = project("Alpha", { name: "Alpha", status: "active", priority: "High", owner: "[[Sam]]", due: "2026-12-01" }, [
  "- [x] 2026-01-10 — Kickoff",
  "- [ ] 2026-11-20 — Beta",
  "- [ ] 2026-11-05 — Alpha",
  "- [ ] 2026-12-01",
]);
const BETA = project("Beta", { status: "On Hold" });
const GAMMA = project("Gamma", { name: "Gamma", status: "Archived" }, ["- [x] Done thing"]);
const DELTA = project("Delta", { name: "Delta", status: "done" });
const PROJECTS = [ALPHA, BETA, GAMMA, DELTA];

const headerTexts = (root: FakeElement) => root.children[0].children[0].children.map((c) => c.text);
const actions = (root: FakeElement) => root.children[0].children[1].children;
const body = (root: FakeElement) => root.children.slice(1);
const cards = (root: FakeElement) => root.querySelectorAll("div.cad-proj-card");
const card = (root: FakeElement, title: string) => cards(root).find((c) => c.children[0].children[0].text === title)!;

describe("renderProjectsView", () => {
  it("renders the header with the project count, Import CSV and + New Project", async () => {
    const { view, root, created } = setup(PROJECTS);
    const open = vi.spyOn(CadenceImportModal.prototype, "open").mockImplementation(() => {});
    await view.renderProjectsView(root);
    expect(root.classes).toEqual(["cadence-projects"]);
    expect(headerTexts(root)).toEqual(["CADENCE", "Projects", "4 projects in Cadence/Projects"]);
    const [importBtn, newBtn] = actions(root);
    expect([importBtn.text, importBtn.classes, newBtn.text, newBtn.classes]).toEqual(["Import CSV", ["cad-btn"], "+ New Project", ["cad-btn", "primary"]]);
    importBtn.trigger("click");
    expect((open.mock.contexts[0] as Any).entityKey).toBe("project");
    newBtn.trigger("click");
    expect(created.mock.calls).toEqual([["project"]]);
  });

  it("uses the singular for one project", async () => {
    const { view, root } = setup([DELTA]);
    await view.renderProjectsView(root);
    expect(headerTexts(root)[2]).toBe("1 project in Cadence/Projects");
  });

  it("shows an empty state with no projects", async () => {
    const { view, root } = setup();
    await view.renderProjectsView(root);
    expect(headerTexts(root)[2]).toBe("0 projects in Cadence/Projects");
    expect(body(root).map((c) => [c.classes, c.children.map((x) => x.text)])).toEqual([
      [["cad-empty-state"], [
        "No projects yet",
        'Hit "+ New Project" — you\'ll get a templated note with Brief, Scope, Milestones, Tasks, Risks and Stakeholders sections ready to fill in.',
      ]],
    ]);
  });

  it("groups by status option order, with an upper-cased label and a grid per non-empty group", async () => {
    const { view, root } = setup(PROJECTS);
    await view.renderProjectsView(root);
    expect(body(root).map((c) => (c.hasClass("cad-proj-grid") ? c.children.map((x) => x.children[0].children[0].text) : c.text))).toEqual([
      "ACTIVE",
      ["Alpha", "Gamma"],
      "ON_HOLD",
      ["Beta"],
      "DONE",
      ["Delta"],
    ]);
  });

  it("QUIRK: an unknown status goes in the first group, and status matching folds case and spaces", async () => {
    const { view, root } = setup(PROJECTS);
    await view.renderProjectsView(root);
    // Gamma is 'Archived' (unknown → active); Beta is 'On Hold' (→ on_hold).
    expect(card(root, "Gamma").parent!.children.map((c) => c.children[0].children[0].text)).toEqual(["Alpha", "Gamma"]);
  });

  it("a project with no status goes in the first option's group", async () => {
    const { view, root } = setup([project("Blank", { name: "Blank" })]);
    await view.renderProjectsView(root);
    expect(body(root).map((c) => c.text || c.children.length)).toEqual(["ACTIVE", 1]);
  });

  it("a blank status takes the first option even when an 'active' option exists", async () => {
    const field = ENTITIES.project.fields.find((f) => f.key === "status")!;
    const saved = field.options;
    field.options = ["Parked", "active"];
    try {
      const { view, root } = setup([project("Blank", { name: "Blank" }), project("Live", { name: "Live", status: "active" })]);
      await view.renderProjectsView(root);
      expect(body(root).map((c) => c.text || c.children.map((x) => x.children[0].children[0].text))).toEqual(["PARKED", ["Blank"], "ACTIVE", ["Live"]]);
    } finally {
      field.options = saved;
    }
  });

  it("follows the def's status options for the groups and labels", async () => {
    const field = ENTITIES.project.fields.find((f) => f.key === "status")!;
    const saved = field.options;
    field.options = ["In Flight", "Parked"];
    try {
      const { view, root } = setup([project("A", { status: "parked" }), project("B", { status: "in flight" })]);
      await view.renderProjectsView(root);
      expect(body(root).map((c) => c.text || c.children.length)).toEqual(["IN FLIGHT", 1, "PARKED", 1]);
    } finally {
      field.options = saved;
    }
  });

  it("a card shows title, status and priority pills, owner, due date and milestone progress", async () => {
    const { view, root, owners } = setup(PROJECTS);
    await view.renderProjectsView(root);
    const c = card(root, "Alpha");
    const [head, meta, progress, next] = c.children;
    expect(head.children[0].localName).toBe("a");
    expect(head.children[0].classes).toEqual(["cad-proj-title"]);
    expect(head.children[1].children.map((p) => [p.text, p.classes])).toEqual([
      ["active", ["cad-pill", "cad-pill-active"]],
      ["High", ["cad-pill", "cad-pill-prio-high"]],
    ]);
    expect(owners.mock.calls).toEqual([[meta, "[[Sam]]"]]);
    expect(meta.children.map((s) => s.text)).toEqual([`Due: ${fmtValue("2026-12-01", "date")}`]);
    expect(progress.children[0].children.map((s) => s.text)).toEqual(["1/4 milestones", "25%"]);
    expect(progress.children[1].children[0].style.width).toBe("25%");
    expect(next.children.map((s) => s.text)).toEqual(["NEXT · ", fmtValue(new Date("2026-11-05"), "date"), " — Alpha"]);
  });

  it("QUIRK: the live cards never set data-pct-band (only the dead renderCard closure does)", async () => {
    const { view, root } = setup(PROJECTS);
    await view.renderProjectsView(root);
    expect(cards(root).map((c) => c.children.find((x) => x.hasClass("cad-proj-progress-wrap"))!.dataset)).toEqual([{}, {}, {}, {}]);
  });

  it("a bare card: basename title, status pill with dashes, no owner, due or next row", async () => {
    const { view, root, owners } = setup(PROJECTS);
    await view.renderProjectsView(root);
    const c = card(root, "Beta");
    expect(c.children.map((x) => x.classes[0])).toEqual(["cad-proj-card-head", "cad-proj-meta", "cad-proj-progress-wrap"]);
    expect(c.children[0].children[1].children.map((p) => [p.text, p.classes])).toEqual([["On Hold", ["cad-pill", "cad-pill-on-hold"]]]);
    expect(c.children[1].children).toEqual([]);
    expect(c.children[2].children[0].children.map((s) => s.text)).toEqual(["0/0 milestones", "0%"]);
    expect(owners).not.toHaveBeenCalledWith(c.children[1], expect.anything());
  });

  it("a next milestone without a title shows only the date; undated open milestones are never next", async () => {
    const files = [project("N", { name: "N" }, ["- [ ] 2026-03-01", "- [ ] Undated"]), project("U", { name: "U" }, ["- [ ] Undated"])];
    const { view, root } = setup(files);
    await view.renderProjectsView(root);
    expect(card(root, "N").children[3].children.map((s) => s.text)).toEqual(["NEXT · ", fmtValue(new Date("2026-03-01"), "date")]);
    expect(card(root, "U").children.length).toBe(3);
  });

  it("clicking a title opens the project", async () => {
    const { view, root, opened, file } = setup(PROJECTS);
    await view.renderProjectsView(root);
    const event = card(root, "Delta").children[0].children[0].trigger("click");
    expect(event.defaultPrevented).toBe(true);
    expect(opened.mock.calls).toEqual([["project", file("Cadence/Projects/Delta.md")]]);
  });
});
