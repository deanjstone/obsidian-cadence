import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApp, type App, type FakeElement } from "../mocks/obsidian";
import { buttonByText, contentOf, optionValues } from "../helpers/dom";
import { CadenceCaptureModal } from "../../src/legacy/cadence.js";

/* Characterization tests for the quick-capture modal: constructor defaults,
   the default and quick-pick reminder times, the "Remind me" toggle, and the
   { text, when, repeat } payload (or null) handed to onSubmit. Driven through
   onOpen() against the mock DOM stub. TZ is UTC (vitest.config.ts), so local
   datetime-local values and ISO strings line up. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const NOW = new Date("2026-10-08T10:07:30Z");

let app: App;
beforeEach(() => {
  app = createMockApp();
  vi.useFakeTimers({ now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
});

function openCapture(opts: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  const modal: Any = new CadenceCaptureModal(app, { onSubmit, ...opts });
  modal.open();
  const content = contentOf(modal);
  const [textInput, checkbox, dateInput] = content.findAll("input") as FakeElement[];
  const repeatSelect = content.findAll("select")[0] as FakeElement;
  const schedFields = content.findAll("div").find((d) => d.classes.includes("cad-capture-sched")) as FakeElement;
  return { modal, onSubmit, content, textInput, checkbox, dateInput, repeatSelect, schedFields };
}

describe("CadenceCaptureModal", () => {
  it("defaults text, when and repeat, including for falsy options", () => {
    const modal: Any = new CadenceCaptureModal(app, { defaultText: "", defaultWhen: "", defaultRepeat: "" });
    expect(modal.defaultText).toBe("");
    expect(modal.defaultWhen).toBeNull();
    expect(modal.defaultRepeat).toBe("none");
    expect(modal.onSubmit).toBeUndefined();
    expect(modal._submitted).toBe(false);
  });

  it("throws when constructed without an options object (flagged)", () => {
    expect(() => new (CadenceCaptureModal as Any)(app)).toThrow(TypeError);
  });

  it("renders the form: text input, Remind me toggle, hidden schedule fields and actions", () => {
    const { content, textInput, checkbox, dateInput, repeatSelect, schedFields } = openCapture({ defaultText: "Call Jane" });
    expect(content.classes).toEqual(["cad-capture-modal"]);
    expect(content.findAll("h3").map((h) => h.text)).toEqual(["Quick capture"]);
    expect(textInput.type).toBe("text");
    expect(textInput.placeholder).toBe("What needs doing?");
    expect(textInput.value).toBe("Call Jane");
    expect(checkbox.type).toBe("checkbox");
    expect(checkbox.checked).toBe(false);
    expect(content.findAll("label").map((l) => l.text)).toEqual(["Remind me"]);
    expect(schedFields.style.display).toBe("none");
    expect(dateInput.type).toBe("datetime-local");
    expect(optionValues(repeatSelect)).toEqual(["none", "daily", "weekly"]);
    expect(repeatSelect.value).toBe("none");
    expect(content.findAll("button").map((b) => [b.text, b.classes.join(" "), b.type])).toEqual([
      ["+15m", "cad-btn cad-btn-sm", "button"],
      ["+1h", "cad-btn cad-btn-sm", "button"],
      ["+3h", "cad-btn cad-btn-sm", "button"],
      ["Tomorrow 9am", "cad-btn cad-btn-sm", "button"],
      ["Cancel", "cad-btn", "button"],
      ["Capture", "cad-btn primary", "button"],
    ]);
    expect(textInput.focusCount).toBe(0);
    vi.runAllTimers();
    expect(textInput.focusCount).toBe(1);
  });

  it("defaults the time to now + 1h rounded up to the next quarter hour", () => {
    expect(openCapture().dateInput.value).toBe("2026-10-08T11:15");
    vi.setSystemTime(new Date("2026-10-08T10:50:00Z"));
    expect(openCapture().dateInput.value).toBe("2026-10-08T12:00");
  });

  it("rounds down, not up, when now + 1h is on a quarter hour with seconds (flagged)", () => {
    vi.setSystemTime(new Date("2026-10-08T10:00:45Z"));
    expect(openCapture().dateInput.value).toBe("2026-10-08T11:00");
  });

  it("prefills from defaultWhen and repeat, and opens the schedule fields", () => {
    const { checkbox, dateInput, repeatSelect, schedFields } = openCapture({
      defaultWhen: "2026-10-12T08:30:00.000Z",
      defaultRepeat: "weekly",
    });
    expect(checkbox.checked).toBe(true);
    expect(schedFields.style.display).toBe("block");
    expect(dateInput.value).toBe("2026-10-12T08:30");
    expect(repeatSelect.value).toBe("weekly");
  });

  it("leaves the time blank for an unparseable defaultWhen but still opens the fields (flagged)", () => {
    const { checkbox, dateInput, onSubmit, content } = openCapture({ defaultWhen: "soon", defaultText: "x" });
    expect(checkbox.checked).toBe(true);
    expect(dateInput.value).toBe("");
    buttonByText(content, "Capture").trigger("click");
    expect(onSubmit.mock.calls).toEqual([[{ text: "x", when: null, repeat: "none" }]]);
  });

  it("falls back to the first repeat option for an unknown defaultRepeat", () => {
    expect(openCapture({ defaultRepeat: "monthly" }).repeatSelect.value).toBe("none");
  });

  it("toggles the schedule fields from the checkbox and from its label", () => {
    const { checkbox, schedFields, content } = openCapture();
    checkbox.checked = true;
    checkbox.trigger("change");
    expect(schedFields.style.display).toBe("block");
    content.findAll("label")[0].trigger("click");
    expect(checkbox.checked).toBe(false);
    expect(schedFields.style.display).toBe("none");
    content.findAll("label")[0].trigger("click");
    expect(checkbox.checked).toBe(true);
    expect(schedFields.style.display).toBe("block");
  });

  it("quick-picks +15m, +1h and +3h from now, with seconds dropped", () => {
    const { content, dateInput } = openCapture();
    buttonByText(content, "+15m").trigger("click");
    expect(dateInput.value).toBe("2026-10-08T10:22");
    buttonByText(content, "+1h").trigger("click");
    expect(dateInput.value).toBe("2026-10-08T11:07");
    buttonByText(content, "+3h").trigger("click");
    expect(dateInput.value).toBe("2026-10-08T13:07");
  });

  it("quick-picks Tomorrow 9am after first writing NaN-NaN-… (flagged)", () => {
    const { content, dateInput } = openCapture();
    const before = dateInput.valueWrites.length;
    buttonByText(content, "Tomorrow 9am").trigger("click");
    expect(dateInput.valueWrites.slice(before)).toEqual(["NaN-NaN-NaNTNaN:NaN", "2026-10-09T09:00"]);
    expect(dateInput.value).toBe("2026-10-09T09:00");
  });

  it("does not submit a blank text, and refocuses the input", () => {
    const { content, textInput, onSubmit } = openCapture();
    textInput.value = "   ";
    buttonByText(content, "Capture").trigger("click");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(textInput.focusCount).toBe(1);
  });

  it("submits an unscheduled capture, ignoring the repeat select", () => {
    const { content, textInput, repeatSelect, onSubmit } = openCapture();
    textInput.value = "  Buy milk ";
    repeatSelect.value = "daily";
    buttonByText(content, "Capture").trigger("click");
    expect(onSubmit.mock.calls).toEqual([[{ text: "Buy milk", when: null, repeat: "none" }]]);
  });

  it("submits a scheduled capture with its ISO time and repeat", () => {
    const { content, textInput, checkbox, dateInput, repeatSelect, onSubmit } = openCapture();
    textInput.value = "Standup";
    checkbox.checked = true;
    dateInput.value = "2026-10-09T09:30";
    repeatSelect.value = "daily";
    buttonByText(content, "Capture").trigger("click");
    expect(onSubmit.mock.calls).toEqual([[{ text: "Standup", when: "2026-10-09T09:30:00.000Z", repeat: "daily" }]]);
  });

  it("drops the time and repeat when scheduled with a blank or unparseable time (flagged)", () => {
    for (const value of ["", "garbage"]) {
      const { content, textInput, checkbox, dateInput, repeatSelect, onSubmit } = openCapture();
      textInput.value = "Later";
      checkbox.checked = true;
      dateInput.value = value;
      repeatSelect.value = "weekly";
      buttonByText(content, "Capture").trigger("click");
      expect(onSubmit.mock.calls).toEqual([[{ text: "Later", when: null, repeat: "none" }]]);
    }
  });

  it("submits on Enter, closing first, with no trailing null", () => {
    const { modal, textInput, content } = openCapture();
    const order: string[] = [];
    modal.onSubmit = (result: unknown) => order.push(`submit:${JSON.stringify(result)}:${content.children.length}`);
    textInput.value = "Ping";
    const event = textInput.trigger("keydown", { key: "Enter" });
    expect(event.defaultPrevented).toBe(true);
    expect(order).toEqual([`submit:${JSON.stringify({ text: "Ping", when: null, repeat: "none" })}:0`]);
    expect(modal._submitted).toBe(true);
  });

  it("calls onSubmit(null) once when cancelled, escaped or closed", () => {
    const cancelled = openCapture();
    buttonByText(cancelled.content, "Cancel").trigger("click");
    expect(cancelled.onSubmit.mock.calls).toEqual([[null]]);

    const escaped = openCapture();
    const event = escaped.textInput.trigger("keydown", { key: "Escape" });
    expect(event.defaultPrevented).toBe(false);
    expect(escaped.onSubmit.mock.calls).toEqual([[null]]);

    const closed = openCapture();
    closed.modal.close();
    expect(closed.onSubmit.mock.calls).toEqual([[null]]);
    expect(closed.content.children).toHaveLength(0);
  });

  it("closes quietly without onSubmit, but throws on submit after closing (flagged)", () => {
    const quiet: Any = new CadenceCaptureModal(app, {});
    quiet.open();
    expect(() => quiet.close()).not.toThrow();

    const modal: Any = new CadenceCaptureModal(app, { defaultText: "x" });
    modal.open();
    const content = contentOf(modal);
    expect(() => buttonByText(content, "Capture").trigger("click")).toThrow(TypeError);
    expect(content.children).toHaveLength(0);
  });

  it("clears earlier content when reopened", () => {
    const { modal, content } = openCapture();
    modal.onOpen();
    expect(content.findAll("h3")).toHaveLength(1);
    expect(content.findAll("input")).toHaveLength(3);
  });
});
