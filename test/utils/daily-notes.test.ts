import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, TFile } from "../mocks/obsidian";
import { ensureDailyNote, ensureFolderSync } from "../../src/legacy/cadence.js";

/* Characterization tests for folder creation and daily-note bootstrap. */

const SETTINGS = { dailyNoteFolder: "Journal/daily", tasksHeading: "## Today", journalHeading: "## Journal" };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-08T14:05:00Z") });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("ensureFolderSync", () => {
  it("creates each missing segment in order, ignoring empty segments", async () => {
    const app = createMockApp([{ path: "A/existing.md" }]);
    const spy = vi.spyOn(app.vault, "createFolder");
    await ensureFolderSync(app, "/A//B/C/");
    expect(spy.mock.calls.map((c) => c[0])).toEqual(["A/B", "A/B/C"]);
  });
  it("swallows createFolder failures", async () => {
    const app = createMockApp();
    vi.spyOn(app.vault, "createFolder").mockRejectedValue(new Error("race"));
    await expect(ensureFolderSync(app, "X/Y")).resolves.toBeUndefined();
  });
});

describe("ensureDailyNote", () => {
  it("returns the existing note untouched", async () => {
    const app = createMockApp([{ path: "Journal/daily/2026-10-08.md", body: "mine" }]);
    const f = await ensureDailyNote(app, SETTINGS);
    expect(f.path).toBe("Journal/daily/2026-10-08.md");
    expect(app.vault.created).toEqual([]);
  });
  it("creates the folder and a note from the heading settings", async () => {
    const app = createMockApp();
    const f = await ensureDailyNote(app, SETTINGS, new Date(2026, 9, 9));
    expect(f.path).toBe("Journal/daily/2026-10-09.md");
    expect(app.vault.getAbstractFileByPath("Journal/daily")).not.toBeNull();
    expect(await app.vault.read(f)).toBe("# 2026-10-09\n\n## Today\n- [ ] \n\n## Journal\n\n");
  });
  it("swallows folder-creation errors (e.g. missing parent)", async () => {
    const app = createMockApp();
    vi.spyOn(app.vault, "createFolder").mockRejectedValue(new Error("no parent"));
    await expect(ensureDailyNote(app, SETTINGS)).resolves.toBeInstanceOf(TFile);
  });
  it("uses the vault-root path when no folder is set", async () => {
    const app = createMockApp();
    expect((await ensureDailyNote(app, { ...SETTINGS, dailyNoteFolder: "" })).path).toBe("2026-10-08.md");
  });
  it("fills the custom daily template placeholders, all with the note date except time", async () => {
    const app = createMockApp([{ path: "Cadence/Templates/daily.md", body: "{{Name}}|{{title}}|{{DATE}}|{{time}}" }]);
    const f = await ensureDailyNote(app, SETTINGS, new Date(2026, 0, 2));
    expect(await app.vault.read(f)).toBe("2026-01-02|2026-01-02|2026-01-02|02:05 PM");
  });
});
