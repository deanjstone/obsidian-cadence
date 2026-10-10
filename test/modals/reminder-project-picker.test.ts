import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, FakeElement, Notice, SuggestModal, type App } from "../mocks/obsidian";
import { buttonByText, contentOf } from "../helpers/dom";
import { projectTagged, projectWebsite } from "../fixtures/vault";
import { CadenceReminderEditModal } from "../../src/legacy/cadence.js";

/* Characterization tests for the reminder edit modal's project picker
   (_openReminderProjectPicker): the empty-vault notice, the suggestion
   filter, and linking the chosen project back into the open modal. The
   picker is captured by spying on SuggestModal.prototype.open. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let app: App;
let opened: Any[];
let placeholders: string[];
beforeEach(() => {
  Notice.messages.length = 0;
  opened = [];
  placeholders = [];
  vi.spyOn(SuggestModal.prototype, "open").mockImplementation(function (this: Any) {
    opened.push(this);
  });
  vi.spyOn(SuggestModal.prototype, "setPlaceholder").mockImplementation((text: string) => {
    placeholders.push(text);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

const archived = { path: "Cadence/Projects/2025/Archive sweep.md", frontmatter: { type: "project" } };

function openModal(reminder: Record<string, unknown> = { id: "r1", text: "Call", project: null }) {
  const modal: Any = new CadenceReminderEditModal(app, {}, reminder);
  modal.open();
  const content = contentOf(modal);
  const projectField = content.findAll("div").find((d) => d.classes.includes("cad-rem-project-field")) as FakeElement;
  return { modal, reminder, content, projectField };
}

describe("CadenceReminderEditModal project picker", () => {
  it("shows a notice and opens nothing when the vault has no projects", () => {
    app = createMockApp();
    const { projectField } = openModal();
    buttonByText(projectField, "📁 Link to project").trigger("click");
    expect(Notice.messages).toEqual(["No projects yet. Create one in Planner → Projects first."]);
    expect(opened).toHaveLength(0);
  });

  it("opens a picker over every project note, nested folders included, named from frontmatter", () => {
    app = createMockApp([projectWebsite, projectTagged, archived, { path: "Cadence/Projects/brief.pdf" }]);
    const { projectField } = openModal();
    buttonByText(projectField, "📁 Link to project").trigger("click");
    expect(opened).toHaveLength(1);
    expect(placeholders).toEqual(["Search projects to link this reminder to…"]);
    expect(opened[0].projs.map((p: Any) => [p.name, p.file.path])).toEqual([
      ["Website relaunch", projectWebsite.path],
      ["Ops cleanup", projectTagged.path],
      ["Archive sweep", archived.path],
    ]);
  });

  it("filters suggestions by case-insensitive substring of the name; blank or null shows all", () => {
    app = createMockApp([projectWebsite, projectTagged, archived]);
    const { projectField } = openModal();
    buttonByText(projectField, "📁 Link to project").trigger("click");
    const picker = opened[0];
    const names = (query: string | null) => picker.getSuggestions(query).map((p: Any) => p.name);
    expect(names("")).toEqual(["Website relaunch", "Ops cleanup", "Archive sweep"]);
    expect(names(null)).toEqual(["Website relaunch", "Ops cleanup", "Archive sweep"]);
    expect(names("WEB")).toEqual(["Website relaunch"]);
    expect(names("ch")).toEqual(["Website relaunch", "Archive sweep"]);
    expect(names("ops.md")).toEqual([]);
  });

  it("renders each suggestion with a folder emoji and two spaces", () => {
    app = createMockApp([projectWebsite]);
    const { projectField } = openModal();
    buttonByText(projectField, "📁 Link to project").trigger("click");
    const el = new FakeElement("div");
    opened[0].renderSuggestion(opened[0].projs[0], el);
    expect(el.text).toBe("📁  Website relaunch");
  });

  it("links the chosen project on the caller's reminder and re-renders the field as a chip", () => {
    app = createMockApp([projectWebsite, projectTagged]);
    const { projectField, reminder } = openModal();
    buttonByText(projectField, "📁 Link to project").trigger("click");
    opened[0].onChooseSuggestion(opened[0].projs[1]);
    expect(reminder.project).toBe(projectTagged.path);
    expect(projectField.findAll("a").map((a) => a.text)).toEqual(["📁 Ops cleanup"]);
  });

  it("opens the same picker from Change on a linked project", () => {
    app = createMockApp([projectWebsite, projectTagged]);
    const { projectField, reminder } = openModal({ id: "r1", text: "Call", project: projectWebsite.path });
    buttonByText(projectField, "Change").trigger("click");
    expect(opened).toHaveLength(1);
    opened[0].onChooseSuggestion(opened[0].projs[1]);
    expect(reminder.project).toBe(projectTagged.path);
    expect(projectField.findAll("a").map((a) => a.text)).toEqual(["📁 Ops cleanup"]);
  });
});
