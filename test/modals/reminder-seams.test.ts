import { describe, expect, it, vi } from "vitest";
import { App, TFile } from "../mocks/obsidian";
import { buildReminderPatch, filterReminderProjects, ReminderProjectSuggestModal } from "../../src/modals/reminder-edit";

/* Direct tests for the reminder edit modal's pure seams and its named
   project picker. TZ is UTC. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const reminder = { id: "r1", text: "Old", when: "2026-10-09T09:30:00.000Z", project: "Cadence/Projects/Ops.md" };
const form = (over: Partial<Parameters<typeof buildReminderPatch>[0]> = {}) => ({
  text: " Call Jane ",
  notes: " notes ",
  repeat: "daily",
  datetimeValue: "2026-10-09T09:30",
  ...over,
});

describe("buildReminderPatch", () => {
  it("returns null for a blank text", () => {
    expect(buildReminderPatch(form({ text: "  " }), reminder)).toBeNull();
  });

  it("trims the text only, carries the project, and leaves notified alone for an unchanged time", () => {
    expect(buildReminderPatch(form(), reminder)).toEqual({
      text: "Call Jane",
      notes: " notes ",
      repeat: "daily",
      project: "Cadence/Projects/Ops.md",
      when: "2026-10-09T09:30:00.000Z",
    });
  });

  it("resets notified for a changed time", () => {
    expect(buildReminderPatch(form({ datetimeValue: "2026-10-10T08:00" }), reminder)).toMatchObject({
      when: "2026-10-10T08:00:00.000Z",
      notified: false,
    });
  });

  it("unschedules a blank time, and defaults repeat and project", () => {
    expect(buildReminderPatch(form({ datetimeValue: "", repeat: "" }), {})).toEqual({
      text: "Call Jane",
      notes: " notes ",
      repeat: "none",
      project: null,
      when: null,
      notified: false,
    });
  });

  it("omits when and notified for an unparseable time (flagged)", () => {
    const patch = buildReminderPatch(form({ datetimeValue: "garbage" }), reminder)!;
    expect(Object.keys(patch)).toEqual(["text", "notes", "repeat", "project"]);
  });
});

describe("filterReminderProjects", () => {
  const projects = ["Website relaunch", "Ops cleanup", "Archive sweep"].map((name) => ({
    name,
    file: new TFile(`Cadence/Projects/${name}.md`),
  })) as Any[];
  const names = (query: string | null | undefined) => filterReminderProjects(projects, query).map((p) => p.name);

  it("matches a case-insensitive substring, keeping order", () => {
    expect(names("CH")).toEqual(["Website relaunch", "Archive sweep"]);
    expect(names("cleanup")).toEqual(["Ops cleanup"]);
    expect(names("zzz")).toEqual([]);
  });

  it("returns everything for a blank, null or undefined query", () => {
    expect(names("")).toHaveLength(3);
    expect(names(null)).toHaveLength(3);
    expect(names(undefined)).toHaveLength(3);
  });
});

describe("ReminderProjectSuggestModal", () => {
  it("filters through filterReminderProjects and hands the choice to onChoose", () => {
    const choice = { name: "Ops cleanup", file: new TFile("Cadence/Projects/Ops.md") } as Any;
    const onChoose = vi.fn();
    const picker = new ReminderProjectSuggestModal(new App() as Any, [choice], onChoose);
    expect(picker.getSuggestions("OPS")).toEqual([choice]);
    picker.onChooseSuggestion(choice);
    expect(onChoose).toHaveBeenCalledWith(choice);
  });
});
