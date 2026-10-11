import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, type App } from "../mocks/obsidian";
import { buttonByText, contentOf } from "../helpers/dom";
import { CadenceConfirmModal } from "../../src/modals/confirm";

/* Characterization tests for the confirm modal (replaces window.confirm):
   label defaults, which callback fires for each way out, and that each
   fires at most once. Driven through onOpen() against the mock DOM stub. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let app: App;
beforeEach(() => {
  app = createMockApp();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function openConfirm(opts: Record<string, unknown> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const modal: Any = new CadenceConfirmModal(app, { onConfirm, onCancel, ...opts });
  modal.open();
  return { modal, onConfirm, onCancel, content: contentOf(modal) };
}

describe("CadenceConfirmModal", () => {
  it("defaults title, message and button labels, including for falsy options", () => {
    const modal: Any = new CadenceConfirmModal(app, { title: "", message: "", confirmLabel: "", cancelLabel: "" });
    expect([modal.title, modal.message, modal.confirmLabel, modal.cancelLabel]).toEqual([
      "Confirm Action",
      "Are you sure?",
      "Confirm",
      "Cancel",
    ]);
    expect(modal._responded).toBe(false);
  });

  it("renders heading, message and Cancel/Confirm buttons, confirm styled as danger and focused after 50ms", () => {
    const { content } = openConfirm({ title: "Delete deal?", message: "This cannot be undone.", confirmLabel: "Delete", cancelLabel: "Keep" });
    expect(content.classes).toEqual(["cad-prompt-modal", "cad-confirm-modal"]);
    expect(content.findAll("h3").map((h) => h.text)).toEqual(["Delete deal?"]);
    expect(content.findAll("p").map((p) => p.text)).toEqual(["This cannot be undone."]);
    expect(content.findAll("button").map((b) => [b.text, b.classes])).toEqual([
      ["Keep", ["cad-btn"]],
      ["Delete", ["cad-btn", "primary", "danger"]],
    ]);
    const confirm = buttonByText(content, "Delete");
    vi.advanceTimersByTime(49);
    expect(confirm.focusCount).toBe(0);
    vi.advanceTimersByTime(1);
    expect(confirm.focusCount).toBe(1);
  });

  it("calls only onConfirm from the confirm button", () => {
    const { content, onConfirm, onCancel } = openConfirm();
    buttonByText(content, "Confirm").trigger("click");
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel exactly once from the cancel button", () => {
    const { content, onConfirm, onCancel } = openConfirm();
    buttonByText(content, "Cancel").trigger("click");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onCancel when closed without a response", () => {
    const { modal, onConfirm, onCancel } = openConfirm();
    modal.close();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("tolerates missing callbacks", () => {
    const a = openConfirm({ onConfirm: undefined, onCancel: undefined });
    expect(() => buttonByText(a.content, "Confirm").trigger("click")).not.toThrow();
    const b = openConfirm({ onConfirm: undefined, onCancel: undefined });
    expect(() => buttonByText(b.content, "Cancel").trigger("click")).not.toThrow();
    const c = openConfirm({ onConfirm: undefined, onCancel: undefined });
    expect(() => c.modal.close()).not.toThrow();
  });

  it("empties its content on close, like the prompt modal", () => {
    const { modal, content } = openConfirm();
    modal.close();
    expect(content.children).toHaveLength(0);
  });

  it("confirms on Enter, once, and closes", () => {
    const { content, onConfirm, onCancel } = openConfirm();
    const event = content.trigger("keydown", { key: "Enter", target: buttonByText(content, "Confirm") });
    expect(event.defaultPrevented).toBe(true);
    content.trigger("keydown", { key: "Enter" });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(content.children).toHaveLength(0);
  });

  it("cancels on Escape, and on Enter while Cancel has focus", () => {
    const escaped = openConfirm();
    const event = escaped.content.trigger("keydown", { key: "Escape" });
    expect(event.defaultPrevented).toBe(true);
    expect(escaped.onCancel).toHaveBeenCalledTimes(1);
    expect(escaped.onConfirm).not.toHaveBeenCalled();

    const entered = openConfirm();
    entered.content.trigger("keydown", { key: "Enter", target: buttonByText(entered.content, "Cancel") });
    expect(entered.onCancel).toHaveBeenCalledTimes(1);
    expect(entered.onConfirm).not.toHaveBeenCalled();
  });

  it("ignores other keys", () => {
    const { content, onConfirm, onCancel } = openConfirm();
    expect(content.trigger("keydown", { key: "a" }).defaultPrevented).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("styles the confirm button from confirmStyle, danger by default", () => {
    const danger = openConfirm({ confirmStyle: "danger" });
    expect(buttonByText(danger.content, "Confirm").classes).toEqual(["cad-btn", "primary", "danger"]);
    const primary = openConfirm({ confirmStyle: "primary" });
    expect(buttonByText(primary.content, "Confirm").classes).toEqual(["cad-btn", "primary"]);
    const unknown = openConfirm({ confirmStyle: "loud" });
    expect(buttonByText(unknown.content, "Confirm").classes).toEqual(["cad-btn", "primary", "danger"]);
  });

  it("defaults every option when constructed without an options object", () => {
    const modal: Any = new (CadenceConfirmModal as Any)(app);
    expect([modal.title, modal.message, modal.confirmLabel, modal.cancelLabel]).toEqual([
      "Confirm Action", "Are you sure?", "Confirm", "Cancel",
    ]);
    modal.open();
    expect(() => buttonByText(contentOf(modal), "Confirm").trigger("click")).not.toThrow();
  });
});
