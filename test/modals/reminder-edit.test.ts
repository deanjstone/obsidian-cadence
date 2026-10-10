import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, Notice, type App, type FakeElement } from "../mocks/obsidian";
import { buttonByText, contentOf, optionValues } from "../helpers/dom";
import { projectWebsite } from "../fixtures/vault";
import { CadenceReminderEditModal } from "../../src/modals/reminder-edit";

/* Characterization tests for the reminder edit modal: new vs edit rendering,
   the project field, and the fields handed to plugin.addReminder /
   updateReminder / deleteReminder. Driven through onOpen() against the mock
   DOM stub. The project picker itself is in reminder-project-picker.test.ts. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const NOW = new Date("2026-10-08T10:07:30Z");

let app: App;
beforeEach(() => {
  app = createMockApp([projectWebsite]);
  Notice.messages.length = 0;
  vi.useFakeTimers({ now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function fakePlugin() {
  return {
    addReminder: vi.fn(async (fields: unknown) => fields),
    updateReminder: vi.fn(async (_id: string, patch: unknown) => patch),
    deleteReminder: vi.fn(async (_id: string) => {}),
  };
}

const existing = () => ({
  id: "r1",
  text: "Call Jane",
  when: "2026-10-09T09:30:00.000Z",
  repeat: "weekly",
  notes: "About the renewal",
  project: null as string | null,
  notified: true,
  done: false,
  createdAt: "2026-10-01T00:00:00.000Z",
});

/* Let an async submit/delete handler run to completion. */
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function openEdit(reminder: Record<string, unknown> = existing(), opts?: Record<string, unknown>) {
  const plugin = fakePlugin();
  const modal: Any = new CadenceReminderEditModal(app, plugin, reminder, opts);
  modal.open();
  const content = contentOf(modal);
  const [textInput, dateInput] = content.findAll("input") as FakeElement[];
  const notesArea = content.findAll("textarea")[0] as FakeElement;
  const repeatSelect = content.findAll("select")[0] as FakeElement;
  const projectField = content.findAll("div").find((d) => d.classes.includes("cad-rem-project-field")) as FakeElement;
  return { modal, plugin, reminder, content, textInput, dateInput, notesArea, repeatSelect, projectField };
}

describe("CadenceReminderEditModal", () => {
  it("defaults isNew to false, and reads it from opts", () => {
    const plugin = fakePlugin();
    const edit: Any = new CadenceReminderEditModal(app, plugin, existing());
    expect(edit.isNew).toBe(false);
    expect(edit.plugin).toBe(plugin);
    expect(edit._submitted).toBe(false);
    expect((new CadenceReminderEditModal(app, plugin, {}, { isNew: true }) as Any).isNew).toBe(true);
    expect((new CadenceReminderEditModal(app, plugin, {}, {}) as Any).isNew).toBe(false);
  });

  it("renders an existing reminder: prefilled fields, Delete/Cancel/Save, then focuses the text", () => {
    const { content, textInput, dateInput, notesArea, repeatSelect } = openEdit();
    expect(content.classes).toEqual(["cad-create-modal", "cad-reminder-edit-modal"]);
    expect(content.findAll("h3").map((h) => [h.text, h.classes])).toEqual([["Edit reminder", ["cad-create-title"]]]);
    expect(textInput.value).toBe("Call Jane");
    expect(textInput.placeholder).toBe("What needs doing?");
    expect(dateInput.type).toBe("datetime-local");
    expect(dateInput.value).toBe("2026-10-09T09:30");
    expect(optionValues(repeatSelect)).toEqual(["none", "daily", "weekly"]);
    expect(repeatSelect.value).toBe("weekly");
    expect(notesArea.value).toBe("About the renewal");
    expect(notesArea.rows).toBe(6);
    expect(notesArea.placeholder).toBe("Context, follow-ups, what happened, related links…");
    expect(content.findAll("button").map((b) => [b.text, b.classes.join(" ")])).toEqual([
      ["Clear", "cad-btn cad-btn-sm"],
      ["📁 Link to project", "cad-btn cad-btn-sm"],
      ["Delete", "cad-btn cad-btn-danger"],
      ["Cancel", "cad-btn"],
      ["Save", "cad-btn primary"],
    ]);
    expect(buttonByText(content, "Clear").title).toBe("Move to unscheduled");
    expect(textInput.focusCount).toBe(0);
    vi.runAllTimers();
    expect(textInput.focusCount).toBe(1);
  });

  it("renders a new, empty reminder with no Delete and a Create button", () => {
    const { content, textInput, dateInput, notesArea, repeatSelect } = openEdit({}, { isNew: true });
    expect(content.findAll("h3")[0].text).toBe("New reminder");
    expect(textInput.value).toBe("");
    expect(dateInput.value).toBe("");
    expect(repeatSelect.value).toBe("none");
    expect(notesArea.value).toBe("");
    expect(content.findAll("button").map((b) => b.text)).toEqual(["Clear", "📁 Link to project", "Cancel", "Create reminder"]);
  });

  it("leaves the time blank for an unparseable when", () => {
    expect(openEdit({ ...existing(), when: "soon" }).dateInput.value).toBe("");
  });

  it("clears the time from the Clear button", () => {
    const { content, dateInput } = openEdit();
    buttonByText(content, "Clear").trigger("click");
    expect(dateInput.value).toBe("");
  });

  it("shows a linked project as a chip named from its frontmatter, with Change and Remove", () => {
    const { projectField } = openEdit({ ...existing(), project: projectWebsite.path });
    const chip = projectField.findAll("a")[0];
    expect([chip.text, chip.classes, chip.title]).toEqual([
      "📁 Website relaunch",
      ["cad-rem-project-chip"],
      "Open project (closes this modal)",
    ]);
    expect(projectField.findAll("button").map((b) => [b.text, b.classes.join(" ")])).toEqual([
      ["Change", "cad-btn cad-btn-sm"],
      ["Remove", "cad-btn cad-btn-sm cad-btn-danger"],
    ]);
  });

  it("names a project missing from the vault after its path", () => {
    const { projectField } = openEdit({ ...existing(), project: "Cadence/Projects/Gone.md" });
    expect(projectField.findAll("a")[0].text).toBe("📁 Gone");
  });

  it("removes the project on the caller's reminder object, even if then cancelled (flagged)", () => {
    const reminder = { ...existing(), project: projectWebsite.path };
    const { content, projectField, plugin } = openEdit(reminder);
    buttonByText(projectField, "Remove").trigger("click");
    expect(reminder.project).toBeNull();
    expect(projectField.findAll("a")).toHaveLength(0);
    expect(projectField.findAll("button").map((b) => b.text)).toEqual(["📁 Link to project"]);
    buttonByText(content, "Cancel").trigger("click");
    expect(reminder.project).toBeNull();
    expect(plugin.updateReminder).not.toHaveBeenCalled();
  });

  it("opens the project in the Cadence view from the chip, closing the modal", () => {
    const openEntityDetail = vi.fn();
    app.workspace.getLeavesOfType = vi.fn(() => [{ view: { openEntityDetail } }]);
    const { modal, content, projectField, plugin } = openEdit({ ...existing(), project: projectWebsite.path });
    const event = projectField.findAll("a")[0].trigger("click");
    expect(event.defaultPrevented).toBe(true);
    expect(modal._submitted).toBe(true);
    expect(content.children).toHaveLength(0);
    expect(app.workspace.getLeavesOfType).toHaveBeenCalledWith("cadence-app");
    expect(openEntityDetail).toHaveBeenCalledWith("project", app.vault.getAbstractFileByPath(projectWebsite.path));
    expect(plugin.updateReminder).not.toHaveBeenCalled();
  });

  it("closes from the chip with no Cadence view open, and does nothing for a missing file", () => {
    const linked = openEdit({ ...existing(), project: projectWebsite.path });
    linked.projectField.findAll("a")[0].trigger("click");
    expect(linked.content.children).toHaveLength(0);

    const missing = openEdit({ ...existing(), project: "Cadence/Projects/Gone.md" });
    missing.projectField.findAll("a")[0].trigger("click");
    expect(missing.modal._submitted).toBe(false);
    expect(missing.content.children.length).toBeGreaterThan(0);
  });

  it("does not save a blank text, and refocuses the input", async () => {
    const { content, textInput, plugin } = openEdit();
    textInput.value = "  ";
    buttonByText(content, "Save").trigger("click");
    await flush();
    expect(plugin.updateReminder).not.toHaveBeenCalled();
    expect(textInput.focusCount).toBe(1);
  });

  it("saves an edit with a changed time, resetting notified, and shows no notice", async () => {
    const { content, textInput, dateInput, notesArea, repeatSelect, plugin, modal } = openEdit();
    textInput.value = " Call Jane back ";
    dateInput.value = "2026-10-10T14:00";
    repeatSelect.value = "daily";
    notesArea.value = "  keep spaces  ";
    buttonByText(content, "Save").trigger("click");
    await flush();
    expect(plugin.updateReminder.mock.calls).toEqual([
      ["r1", { text: "Call Jane back", notes: "  keep spaces  ", repeat: "daily", project: null, when: "2026-10-10T14:00:00.000Z", notified: false }],
    ]);
    expect(plugin.addReminder).not.toHaveBeenCalled();
    expect(Notice.messages).toEqual([]);
    expect(modal._submitted).toBe(true);
    expect(content.children).toHaveLength(0);
  });

  it("keeps notified untouched when the time is unchanged", async () => {
    const { content, plugin } = openEdit({ ...existing(), project: projectWebsite.path });
    buttonByText(content, "Save").trigger("click");
    await flush();
    expect(plugin.updateReminder.mock.calls[0][1]).toEqual({
      text: "Call Jane",
      notes: "About the renewal",
      repeat: "weekly",
      project: projectWebsite.path,
      when: "2026-10-09T09:30:00.000Z",
    });
  });

  it("unschedules a cleared time, resetting notified even if it was already unscheduled", async () => {
    const cleared = openEdit();
    cleared.dateInput.value = "";
    buttonByText(cleared.content, "Save").trigger("click");
    await flush();
    expect(cleared.plugin.updateReminder.mock.calls[0][1]).toMatchObject({ when: null, notified: false });

    const inbox = openEdit({ ...existing(), when: null });
    buttonByText(inbox.content, "Save").trigger("click");
    await flush();
    expect(inbox.plugin.updateReminder.mock.calls[0][1]).toMatchObject({ when: null, notified: false });
  });

  it("omits when and notified for an unparseable time, keeping the old one (flagged)", async () => {
    const { content, dateInput, plugin } = openEdit();
    dateInput.value = "garbage";
    buttonByText(content, "Save").trigger("click");
    await flush();
    const patch = plugin.updateReminder.mock.calls[0][1] as Record<string, unknown>;
    expect("when" in patch).toBe(false);
    expect("notified" in patch).toBe(false);
  });

  it("creates a new reminder with a 'Reminder set' notice, or 'Captured to Inbox' when unscheduled", async () => {
    const scheduled = openEdit({}, { isNew: true });
    scheduled.textInput.value = "Dentist";
    scheduled.dateInput.value = "2026-10-08T15:00";
    buttonByText(scheduled.content, "Create reminder").trigger("click");
    await flush();
    expect(scheduled.plugin.addReminder.mock.calls).toEqual([
      [{ text: "Dentist", notes: "", repeat: "none", project: null, when: "2026-10-08T15:00:00.000Z", notified: false }],
    ]);
    expect(scheduled.plugin.updateReminder).not.toHaveBeenCalled();

    const inbox = openEdit({}, { isNew: true });
    inbox.textInput.value = "Someday";
    buttonByText(inbox.content, "Create reminder").trigger("click");
    await flush();
    expect(inbox.plugin.addReminder.mock.calls[0][0]).toMatchObject({ when: null, notified: false });

    expect(Notice.messages).toHaveLength(2);
    expect(Notice.messages[0]).toMatch(/^Reminder set · \S/);
    expect(Notice.messages[1]).toBe("Captured to Inbox");
  });

  it("submits on Enter in the text and Cmd/Ctrl+Enter in the notes, not plain Enter in the notes", async () => {
    const { textInput, notesArea, plugin } = openEdit();
    const plain = notesArea.trigger("keydown", { key: "Enter" });
    await flush();
    expect(plain.defaultPrevented).toBe(false);
    expect(plugin.updateReminder).not.toHaveBeenCalled();

    expect(notesArea.trigger("keydown", { key: "Enter", metaKey: true }).defaultPrevented).toBe(true);
    expect(notesArea.trigger("keydown", { key: "Enter", ctrlKey: true }).defaultPrevented).toBe(true);
    expect(textInput.trigger("keydown", { key: "Enter" }).defaultPrevented).toBe(true);
    await flush();
    // Each keypress submits independently; closing does not stop later ones.
    expect(plugin.updateReminder).toHaveBeenCalledTimes(3);
  });

  it("closes without saving on Escape, Cancel or close()", () => {
    for (const close of [
      (o: ReturnType<typeof openEdit>) => o.textInput.trigger("keydown", { key: "Escape" }),
      (o: ReturnType<typeof openEdit>) => o.notesArea.trigger("keydown", { key: "Escape" }),
      (o: ReturnType<typeof openEdit>) => buttonByText(o.content, "Cancel").trigger("click"),
      (o: ReturnType<typeof openEdit>) => o.modal.close(),
    ]) {
      const opened = openEdit();
      close(opened);
      expect(opened.content.children).toHaveLength(0);
      expect(opened.modal._submitted).toBe(false);
      expect(opened.plugin.updateReminder).not.toHaveBeenCalled();
      expect(opened.plugin.deleteReminder).not.toHaveBeenCalled();
    }
  });

  it("deletes through window.confirm (flagged), and only when confirmed", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const declined = openEdit();
    buttonByText(declined.content, "Delete").trigger("click");
    await flush();
    expect(confirm).toHaveBeenCalledWith("Delete this reminder?");
    expect(declined.plugin.deleteReminder).not.toHaveBeenCalled();
    expect(declined.content.children.length).toBeGreaterThan(0);

    confirm.mockReturnValue(true);
    const accepted = openEdit();
    buttonByText(accepted.content, "Delete").trigger("click");
    await flush();
    expect(accepted.plugin.deleteReminder.mock.calls).toEqual([["r1"]]);
    expect(accepted.modal._submitted).toBe(true);
    expect(accepted.content.children).toHaveLength(0);
  });
});
