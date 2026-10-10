import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, type App, type FakeElement } from "../mocks/obsidian";
import { buttonByText, contentOf } from "../helpers/dom";
import { CadencePromptModal } from "../../src/modals/prompt";

/* Characterization tests for the prompt modal (replaces window.prompt):
   option defaults, Enter/Escape handling, and onSubmit(null) when closed
   without submitting. Driven through onOpen() against the mock DOM stub. */

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

function openPrompt(opts: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  const modal: Any = new CadencePromptModal(app, { onSubmit, ...opts });
  modal.open();
  const content = contentOf(modal);
  const input = content.findAll("input")[0] as FakeElement;
  return { modal, onSubmit, content, input };
}

describe("CadencePromptModal", () => {
  it("defaults title, placeholder, value and CTA, including for falsy options", () => {
    const modal: Any = new CadencePromptModal(app, { title: "", placeholder: "", defaultValue: "", cta: "" });
    expect(modal.title).toBe("Enter a name");
    expect(modal.placeholder).toBe("");
    expect(modal.defaultValue).toBe("");
    expect(modal.cta).toBe("Create");
    expect(modal._submitted).toBe(false);
  });

  it("throws when constructed without an options object (flagged)", () => {
    expect(() => new (CadencePromptModal as Any)(app)).toThrow(TypeError);
  });

  it("renders a heading, a prefilled input and Cancel/CTA buttons, then focuses and selects the input", () => {
    const { content, input } = openPrompt({ title: "Rename", placeholder: "Name…", defaultValue: "Old", cta: "Save" });
    expect(content.classes).toEqual(["cad-prompt-modal"]);
    expect(content.findAll("h3").map((h) => h.text)).toEqual(["Rename"]);
    expect(input.type).toBe("text");
    expect(input.placeholder).toBe("Name…");
    expect(input.value).toBe("Old");
    expect(content.findAll("button").map((b) => [b.text, b.classes])).toEqual([
      ["Cancel", []],
      ["Save", ["mod-cta"]],
    ]);
    expect(input.focusCount).toBe(0);
    vi.runAllTimers();
    expect(input.focusCount).toBe(1);
    expect(input.selectCount).toBe(1);
  });

  it("clears earlier content when reopened", () => {
    const { modal, content } = openPrompt();
    modal.onOpen();
    expect(content.findAll("h3")).toHaveLength(1);
    expect(content.findAll("input")).toHaveLength(1);
  });

  it("submits the trimmed value on Enter, once, without a trailing null", () => {
    const { onSubmit, input, content } = openPrompt();
    input.value = "  Acme  ";
    const event = input.trigger("keydown", { key: "Enter" });
    expect(event.defaultPrevented).toBe(true);
    expect(onSubmit.mock.calls).toEqual([["Acme"]]);
    // onClose ran before onSubmit (close() comes first) and emptied the content.
    expect(content.children).toHaveLength(0);
  });

  it("closes before calling onSubmit", () => {
    const { modal, input } = openPrompt();
    const order: string[] = [];
    modal.onSubmit = (v: unknown) => order.push(`submit:${v}`);
    const close = modal.close.bind(modal);
    modal.close = () => {
      order.push("close");
      close();
    };
    input.value = "x";
    input.trigger("keydown", { key: "Enter" });
    expect(order).toEqual(["close", "submit:x"]);
  });

  it("refocuses instead of submitting a blank value", () => {
    const { onSubmit, input, content } = openPrompt({ defaultValue: "   " });
    input.trigger("keydown", { key: "Enter" });
    buttonByText(content, "Create").trigger("click");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input.focusCount).toBe(2);
    expect(content.children.length).toBeGreaterThan(0);
  });

  it("closes with onSubmit(null) on Escape, and ignores other keys", () => {
    const { onSubmit, input } = openPrompt({ defaultValue: "kept" });
    expect(input.trigger("keydown", { key: "a" }).defaultPrevented).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
    const event = input.trigger("keydown", { key: "Escape" });
    expect(event.defaultPrevented).toBe(true);
    expect(onSubmit.mock.calls).toEqual([[null]]);
  });

  it("submits from the CTA button and calls onSubmit(null) from Cancel", () => {
    const first = openPrompt({ defaultValue: "Deal A" });
    buttonByText(first.content, "Create").trigger("click");
    expect(first.onSubmit.mock.calls).toEqual([["Deal A"]]);

    const second = openPrompt({ defaultValue: "Deal B" });
    buttonByText(second.content, "Cancel").trigger("click");
    expect(second.onSubmit.mock.calls).toEqual([[null]]);
  });

  it("calls onSubmit(null) whenever it is closed without submitting", () => {
    const { modal, onSubmit } = openPrompt();
    modal.close();
    expect(onSubmit.mock.calls).toEqual([[null]]);
  });

  it("closes quietly without onSubmit, but throws on submit without it (flagged)", () => {
    const quiet: Any = new CadencePromptModal(app, {});
    quiet.open();
    expect(() => quiet.close()).not.toThrow();

    const modal: Any = new CadencePromptModal(app, { defaultValue: "x" });
    modal.open();
    expect(() => buttonByText(contentOf(modal), "Create").trigger("click")).toThrow(TypeError);
    expect(modal._submitted).toBe(true);
  });
});
