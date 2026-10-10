import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, type App } from "../mocks/obsidian";
import { buttonByText, contentOf } from "../helpers/dom";
import { CadenceConfirmModal } from "../../src/legacy/cadence.js";

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

  it("leaves its content in place on close, unlike the prompt modal (flagged)", () => {
    const { modal, content } = openConfirm();
    modal.close();
    expect(content.findAll("button")).toHaveLength(2);
  });

  it("has no keyboard handling of its own", () => {
    const { content, onConfirm, onCancel } = openConfirm();
    content.trigger("keydown", { key: "Enter" });
    for (const b of content.findAll("button")) b.trigger("keydown", { key: "Enter" });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
