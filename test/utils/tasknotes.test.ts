import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, TFile, type App } from "../mocks/obsidian";
import { projectWebsite, taskNotesTasks } from "../fixtures/vault";
import {
  appendTaskNotesTask,
  listTaskNotesTasks,
  listTaskNotesTasksForFile,
  toggleTaskNotesTask,
} from "../../src/legacy/cadence.js";

/* Characterization tests for the TaskNotes integration helpers. */

let app: App;
beforeEach(() => {
  app = createMockApp([projectWebsite, ...taskNotesTasks]);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("listTaskNotesTasks", () => {
  it("returns [] when the TaskNotes folder is missing", () => {
    expect(listTaskNotesTasks(createMockApp())).toEqual([]);
  });
  it("walks TaskNotes/Tasks recursively, skipping non-markdown files, with defaults", () => {
    const tasks = listTaskNotesTasks(app);
    expect(tasks.map((t: { file: TFile }) => t.file.path)).toEqual([
      "TaskNotes/Tasks/Write copy.md",
      "TaskNotes/Tasks/archive/Old task.md",
      "TaskNotes/Tasks/Unrelated.md",
      "TaskNotes/Tasks/No frontmatter.md",
    ]);
    const { file: _f1, ...first } = tasks[0];
    expect(first).toEqual({
      title: "Write copy",
      status: "open",
      scheduled: "2026-10-09",
      due: "",
      priority: "high",
      projects: ["[[Website relaunch]]"],
      done: false,
    });
    const { file: _f2, ...old } = tasks[1];
    expect(old).toEqual({
      title: "Old task",
      status: "done",
      scheduled: "",
      due: "",
      priority: "normal",
      projects: "[[Website relaunch|site]]",
      done: true,
    });
    const { file: _f3, ...bare } = tasks[3];
    expect(bare).toEqual({ title: "No frontmatter", status: "open", scheduled: "", due: "", priority: "normal", projects: "", done: false });
  });
});

describe("listTaskNotesTasksForFile", () => {
  it("returns tasks whose projects link to the file's basename, aliases included", () => {
    const project = app.vault.getAbstractFileByPath(projectWebsite.path) as TFile;
    expect(listTaskNotesTasksForFile(app, project).map((t: { title: string }) => t.title)).toEqual(["Write copy", "Old task"]);
  });
  it("returns [] when nothing links to the file", () => {
    const other = app.vault.addFile({ path: "Cadence/Projects/Nothing.md" });
    expect(listTaskNotesTasksForFile(app, other)).toEqual([]);
  });
});

describe("toggleTaskNotesTask", () => {
  it("sets status to done or open", async () => {
    const f = app.vault.getAbstractFileByPath("TaskNotes/Tasks/Write copy.md") as TFile;
    await toggleTaskNotesTask(app, f, true);
    expect(app.metadataCache.getFileCache(f)?.frontmatter?.status).toBe("done");
    await toggleTaskNotesTask(app, f, false);
    expect(app.metadataCache.getFileCache(f)?.frontmatter?.status).toBe("open");
  });
});

describe("appendTaskNotesTask", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-08T10:00:00Z") });
  });
  it("creates the folder and a task note scheduled for the given date", async () => {
    const empty = createMockApp();
    await appendTaskNotesTask(empty, "Call Jane", new Date(2026, 9, 12));
    expect(empty.vault.getAbstractFileByPath("TaskNotes")).not.toBeNull();
    const f = empty.vault.getAbstractFileByPath("TaskNotes/Tasks/Call Jane.md") as TFile;
    expect(await empty.vault.read(f)).toBe("---\ntitle: Call Jane\nstatus: open\nscheduled: 2026-10-12\npriority: normal\n---\n");
  });
  it("defaults to today, strips unsafe filename characters but keeps them in the title", async () => {
    await appendTaskNotesTask(app, " Fix a/b: now? ");
    const f = app.vault.getAbstractFileByPath("TaskNotes/Tasks/Fix ab now.md") as TFile;
    expect(await app.vault.read(f)).toBe("---\ntitle:  Fix a/b: now? \nstatus: open\nscheduled: 2026-10-08\npriority: normal\n---\n");
  });
  it("suffixes duplicates with (1), (2), ...", async () => {
    await appendTaskNotesTask(app, "Write copy");
    await appendTaskNotesTask(app, "Write copy");
    expect(app.vault.created).toEqual(["TaskNotes/Tasks/Write copy (1).md", "TaskNotes/Tasks/Write copy (2).md"]);
  });
});
