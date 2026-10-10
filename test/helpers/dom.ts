import type { FakeElement } from "../mocks/obsidian";

/* Read-back helpers for modals rendered into the mock DOM stub. */

export function contentOf(modal: { contentEl: unknown }): FakeElement {
  return modal.contentEl as FakeElement;
}

export function buttonByText(root: FakeElement, text: string): FakeElement {
  const button = root.findAll("button").find((b) => b.text === text);
  if (!button) throw new Error(`No button "${text}"`);
  return button;
}

export function optionValues(select: FakeElement): string[] {
  return select.options.map((o) => o.value);
}

export function optionTexts(select: FakeElement): string[] {
  return select.options.map((o) => o.text);
}
