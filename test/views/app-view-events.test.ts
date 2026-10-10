import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeElement } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";

/* Characterization tests for CadenceAppView.onOpen(): the first render and
   the seven workspace, vault and metadata listeners that re-render the
   view. render() is spied on; each listener is fired through the ref the
   mock recorded from registerEvent(). */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-08T10:00:00Z") });
});
afterEach(() => {
  vi.useRealTimers();
});

const DETAIL = "Cadence/Contacts/Ann.md";
const TODAY = "daily/2026-10-08.md";

async function opened(settings: Record<string, unknown> = {}) {
  const made = makeAppView({ settings });
  const render = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
  const stale = made.root.createDiv({ text: "stale" });
  await made.view.onOpen();
  const fire = (name: string, ...args: unknown[]) => {
    const ref = made.view.registeredEvents.find((e: { name: string }) => e.name === name);
    return ref.callback(...args);
  };
  return { ...made, render, stale, fire };
}

const file = (path: string) => ({ path });

describe("CadenceAppView onOpen", () => {
  it("empties the content element, renders once and registers the listeners in order", async () => {
    const { root, render, view, stale } = await opened();
    expect(root.children).not.toContain(stale as FakeElement);
    expect(render).toHaveBeenCalledTimes(1);
    expect(view.registeredEvents.map((e: { name: string }) => e.name)).toEqual([
      "editor-change", "modify", "create", "delete", "rename", "changed", "active-leaf-change",
    ]);
  });

  it("editor-change: re-renders 300ms after the last edit to the open detail note", async () => {
    const { view, render, fire } = await opened();
    render.mockClear();
    view.detailFile = file(DETAIL);
    fire("editor-change", {}, { file: file(DETAIL) });
    vi.advanceTimersByTime(200);
    fire("editor-change", {}, { file: file(DETAIL) });
    vi.advanceTimersByTime(299);
    expect(render).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("editor-change: also tracks today's note in Today mode, and ignores other notes and file-less edits", async () => {
    const { view, render, fire } = await opened({ defaultTab: "planner.today" });
    render.mockClear();
    view.todayFile = file(TODAY);
    fire("editor-change", {}, { file: null });
    fire("editor-change", {}, { file: file("Cadence/Deals/Big.md") });
    vi.advanceTimersByTime(1000);
    expect(render).not.toHaveBeenCalled();
    fire("editor-change", {}, { file: file(TODAY) });
    vi.advanceTimersByTime(300);
    expect(render).toHaveBeenCalledTimes(1);
    view.mode = "home";
    fire("editor-change", {}, { file: file(TODAY) });
    vi.advanceTimersByTime(300);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("modify: re-renders for the detail note unless the Cadence leaf has focus", async () => {
    const { view, app, leaf, render, fire } = await opened();
    render.mockClear();
    view.detailFile = file(DETAIL);
    app.workspace.activeLeaf = leaf;
    expect(fire("modify", file(DETAIL))).toBeUndefined();
    expect(render).not.toHaveBeenCalled();
    app.workspace.activeLeaf = {};
    await fire("modify", file(DETAIL));
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("modify: re-renders for today's note in Today mode and for this week's notes in Calendar mode", async () => {
    const { view, render, fire } = await opened({ defaultTab: "planner.today" });
    render.mockClear();
    view.todayFile = file(TODAY);
    await fire("modify", file(TODAY));
    expect(render).toHaveBeenCalledTimes(1);
    view.mode = "planner.calendar";
    await fire("modify", file("daily/2026-10-05.md"));
    await fire("modify", file("daily/2026-10-11.md"));
    await fire("modify", file("daily/2026-10-12.md"));
    await fire("modify", file("daily/2026-10-04.md"));
    expect(render).toHaveBeenCalledTimes(3);
  });

  it("modify: re-renders for any note under Cadence/ and ignores the rest", async () => {
    const { render, fire } = await opened();
    render.mockClear();
    await fire("modify", file("Notes/Other.md"));
    expect(render).not.toHaveBeenCalled();
    await fire("modify", file("Cadence/Deals/Big.md"));
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("create: re-renders for a note under Cadence/ unless it is the open detail note", async () => {
    const { view, render, fire } = await opened();
    render.mockClear();
    fire("create", file("Notes/Other.md"));
    fire("create", null);
    expect(render).not.toHaveBeenCalled();
    fire("create", file("Cadence/Deals/Big.md"));
    expect(render).toHaveBeenCalledTimes(1);
    view.detailFile = file(DETAIL);
    fire("create", file(DETAIL));
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("delete: closes the detail form when its note is deleted, otherwise refreshes like create", async () => {
    const { view, render, fire } = await opened();
    render.mockClear();
    view.detailFile = file(DETAIL);
    view.detailEntityKey = "contact";
    fire("delete", file("Cadence/Deals/Big.md"));
    expect(render).toHaveBeenCalledTimes(1);
    expect(view.detailFile).not.toBeNull();
    fire("delete", file(DETAIL));
    await flush();
    expect(view.detailFile).toBeNull();
    expect(view.detailEntityKey).toBeNull();
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("rename: re-renders when the old or new path is under Cadence/, unless it is the detail note", async () => {
    const { view, render, fire } = await opened();
    render.mockClear();
    fire("rename", file("Notes/B.md"), "Notes/A.md");
    expect(render).not.toHaveBeenCalled();
    fire("rename", file("Notes/B.md"), "Cadence/Deals/A.md");
    fire("rename", file("Cadence/Deals/B.md"), "Notes/A.md");
    expect(render).toHaveBeenCalledTimes(2);
    view.detailFile = file(DETAIL);
    fire("rename", file(DETAIL), "Cadence/Contacts/Old.md");
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("metadata changed: behaves like modify for the detail note and for Cadence/ notes", async () => {
    const { view, app, leaf, render, fire } = await opened();
    render.mockClear();
    fire("changed", file("Notes/Other.md"));
    fire("changed", file("Cadence/Deals/Big.md"));
    expect(render).toHaveBeenCalledTimes(1);
    view.detailFile = file(DETAIL);
    app.workspace.activeLeaf = leaf;
    fire("changed", file(DETAIL));
    expect(render).toHaveBeenCalledTimes(1);
    app.workspace.activeLeaf = null;
    await fire("changed", file(DETAIL));
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("active-leaf-change: re-renders only when the Cadence leaf becomes active", async () => {
    const { leaf, render, fire } = await opened();
    render.mockClear();
    fire("active-leaf-change", {});
    fire("active-leaf-change", null);
    expect(render).not.toHaveBeenCalled();
    fire("active-leaf-change", leaf);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("listeners read the view's current state, not the state at onOpen", async () => {
    const { view, render, fire }: Any = await opened({ defaultTab: "home" });
    render.mockClear();
    view.mode = "planner.calendar";
    view.plannerAnchor = new Date(2026, 0, 14);
    await fire("modify", file("daily/2026-01-12.md"));
    await fire("modify", file("daily/2026-10-08.md"));
    expect(render).toHaveBeenCalledTimes(1);
  });
});
