import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeElement, type MockFileSpec } from "../mocks/obsidian";
import { makeAppView } from "../helpers/app-view";

/* Characterization tests for the relationship graph, renderReportGraph: a
   canvas force layout over every note under Cadence/, one node per note
   (typed by folder) and one edge per resolved link between two of them.
   Each animation frame steps the physics and redraws; the pointer drags
   nodes, pans, zooms and opens a node's note. Math.random (the starting
   positions), requestAnimationFrame, ResizeObserver and devicePixelRatio are
   stubbed, and the canvas context records every call. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

class FakeResizeObserver {
  static made: FakeResizeObserver[] = [];
  readonly observed: unknown[] = [];
  disconnected = 0;
  constructor(readonly callback: () => void) {
    FakeResizeObserver.made.push(this);
  }
  observe(el: unknown) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected++;
  }
}

function setup(files: MockFileSpec[] = [], opts: { links?: Any; random?: number[]; dpr?: number; theme?: Record<string, string> } = {}) {
  const made = makeAppView({ files });
  made.view.mode = "reports.graph";
  made.app.metadataCache.resolvedLinks = "links" in opts ? opts.links : {};
  const seq = opts.random ?? [0.5];
  let i = 0;
  vi.spyOn(Math, "random").mockImplementation(() => seq[i++ % seq.length]);
  const frames: Array<() => void> = [];
  const raf = vi.fn((cb: () => void) => frames.push(cb));
  vi.stubGlobal("requestAnimationFrame", raf);
  FakeResizeObserver.made = [];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.stubGlobal("devicePixelRatio", opts.dpr ?? 2);
  /* The theme's custom properties, as getComputedStyle reports them on the
     graph card. None by default, so every colour takes its fallback. */
  const theme: Record<string, string> = { ...opts.theme };
  vi.stubGlobal("getComputedStyle", (el: FakeElement) => ({
    getPropertyValue: (name: string) => (el.localName === "div" && el.classes.includes("cad-home-card") ? theme[name] ?? "" : ""),
  }));
  const root = new FakeElement("div");
  const opened = vi.spyOn(made.view, "openEntityDetail").mockResolvedValue(undefined);
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path);
  return { ...made, root, frames, raf, opened, file, theme };
}

async function rendered(files: MockFileSpec[] = [], opts: Parameters<typeof setup>[1] = {}) {
  const made = setup(files, opts);
  await made.view.renderReportGraph(made.root);
  const card = made.root.children[1];
  const [canvas, tooltip] = card.children;
  const ctx = canvas.getContext("2d");
  /* Run the next queued frame; returns the context calls it made. */
  const frame = () => {
    const from = ctx.ops.length;
    made.frames.shift()!();
    return ctx.ops.slice(from);
  };
  return { ...made, card, canvas, tooltip, ctx, frame };
}

const note = (path: string): MockFileSpec => ({ path });
const ops = (list: unknown[][], name: string) => list.filter((o) => o[0] === name);
const pointer = (x: number, y: number) => ({ clientX: x, clientY: y });

describe("renderReportGraph: layout", () => {
  it("adds the report class, renders the header and a graph card holding a canvas and a tooltip", async () => {
    const { root, card, canvas, tooltip } = await rendered();
    expect(root.classes).toEqual(["cadence-report"]);
    expect(root.children[0].children[0].children.map((c) => c.text)).toEqual([
      "CADENCE", "Graph View",
      "Relationship graph showing connections between contacts, companies, partners, projects, deals, and activities.",
    ]);
    expect(root.children.map((c) => c.classes)).toEqual([["cad-page-header"], ["cad-home-card"]]);
    expect(card.style).toEqual({
      padding: "16px", height: "600px", position: "relative", overflow: "hidden",
      backgroundColor: "var(--background-secondary)", borderRadius: "8px", border: "1px solid var(--border-color)",
      marginTop: "24px", marginBottom: "24px",
    });
    expect(card.children.map((c) => c.localName)).toEqual(["canvas", "div"]);
    expect(canvas.style).toEqual({ width: "100%", height: "100%", display: "block", cursor: "default" });
    expect(tooltip.style).toEqual({
      position: "absolute", pointerEvents: "none", padding: "6px 10px", backgroundColor: "var(--background-primary)",
      border: "1px solid var(--border-color)", borderRadius: "4px", fontSize: "12px", color: "var(--text-normal)",
      display: "none", zIndex: "100", boxShadow: "var(--shadow-s)",
    });
  });

  it("sizes the bitmap to 800×400 (no layout yet) times devicePixelRatio, and scales the context once", async () => {
    const { canvas, ctx } = await rendered([], { dpr: 2 });
    expect([canvas.width, canvas.height]).toEqual([1600, 800]);
    expect(ctx.ops).toEqual([["scale", 2, 2]]);
  });

  it("observes the canvas; a resize re-sizes the bitmap and resets the scale, and an unlaid-out canvas is ignored", async () => {
    const { canvas, ctx, frame } = await rendered([], { dpr: 3 });
    const [observer] = FakeResizeObserver.made;
    expect(observer.observed).toEqual([canvas]);
    observer.callback();
    expect(ctx.ops).toEqual([["scale", 3, 3]]);
    canvas.clientWidth = 1000;
    canvas.clientHeight = 500;
    observer.callback();
    expect([canvas.width, canvas.height]).toEqual([3000, 1500]);
    expect(ctx.ops.slice(1)).toEqual([["resetTransform"], ["scale", 3, 3]]);
    expect(frame()[0]).toEqual(["clearRect", 0, 0, 1000, 500]);
  });

  it("queues one frame on render; an empty graph is settled after it and queues nothing more", async () => {
    const { raf, frames, frame } = await rendered();
    expect(raf).toHaveBeenCalledTimes(1);
    frame();
    expect(frames).toEqual([]);
    expect(raf).toHaveBeenCalledTimes(1);
  });

  it("keeps animating while the nodes move, then settles near the centre and stops redrawing", async () => {
    const { frames, frame } = await rendered([note("Cadence/Contacts/A.md")], { random: [0, 0] });
    let count = 0;
    let last: unknown[] = [];
    while (frames.length && count < 5000) {
      last = ops(frame(), "arc")[0];
      count++;
    }
    expect(frames).toEqual([]);
    expect(count).toBeGreaterThan(10);
    expect(count).toBeLessThan(5000);
    expect(Math.hypot((last[1] as number) - 400, (last[2] as number) - 200)).toBeLessThan(5);
  });

  it("once settled, a pointer move, press, release, leave, wheel step or resize draws one more frame", async () => {
    const { canvas, frames, frame } = await rendered();
    frame();
    const redraws = (act: () => void) => {
      act();
      act();
      const queued = frames.length;
      for (let i = 0; frames.length && i < 100; i++) frame();
      return frames.length ? Infinity : queued;
    };
    expect(redraws(() => canvas.trigger("mousemove", pointer(5, 5)))).toBe(1);
    expect(redraws(() => canvas.trigger("mousedown", pointer(5, 5)))).toBe(1);
    expect(redraws(() => canvas.trigger("mouseup", pointer(5, 5)))).toBe(1);
    expect(redraws(() => canvas.trigger("mouseleave"))).toBe(1);
    expect(redraws(() => canvas.trigger("wheel", { ...pointer(5, 5), deltaY: 10 }))).toBe(1);
    canvas.clientWidth = 900;
    canvas.clientHeight = 300;
    expect(redraws(() => FakeResizeObserver.made[0].callback())).toBe(1);
  });

  it("a resize after the canvas leaves the document disconnects the observer and draws nothing", async () => {
    const { canvas, frames, frame } = await rendered();
    frame();
    canvas.isConnected = false;
    canvas.clientWidth = 900;
    FakeResizeObserver.made[0].callback();
    expect(FakeResizeObserver.made[0].disconnected).toBe(1);
    expect(frames).toEqual([]);
  });

  it("starts the nodes spread over the canvas's laid-out size", async () => {
    const createEl = FakeElement.prototype.createEl;
    vi.spyOn(FakeElement.prototype, "createEl").mockImplementation(function (this: FakeElement, ...args: Any[]) {
      const el = createEl.apply(this, args as Any);
      if (args[0] === "canvas") Object.assign(el, { clientWidth: 1600, clientHeight: 800 });
      return el;
    });
    const { canvas, frame } = await rendered([note("Cadence/Contacts/A.md")], { random: [1, 1] });
    expect([canvas.width, canvas.height]).toEqual([3200, 1600]);
    const [arc] = ops(frame(), "arc");
    // Starts at (1300, 700), pulled toward (800, 400) at 0.0012.
    expect(arc[1]).toBeCloseTo(1300 - 500 * 0.0012, 10);
    expect(arc[2]).toBeCloseTo(700 - 300 * 0.0012, 10);
  });

  it("a frame after the canvas leaves the document disconnects the observer, draws nothing and queues nothing", async () => {
    const { raf, canvas, frame } = await rendered([note("Cadence/Contacts/Jane.md")]);
    canvas.isConnected = false;
    expect(frame()).toEqual([]);
    expect(FakeResizeObserver.made[0].disconnected).toBe(1);
    expect(raf).toHaveBeenCalledTimes(1);
  });
});

describe("renderReportGraph: nodes and edges", () => {
  const FILES = [
    note("Cadence/Contacts/Jane.md"), note("Cadence/Companies/Acme.md"), note("Cadence/Partners/Beta.md"),
    note("Cadence/Pipeline/Deal.md"), note("Cadence/Projects/Proj.md"), note("Cadence/Activities/Call.md"),
    note("Cadence/Leads/Lead.md"), note("Cadence/Registrations/Reg.md"), note("Cadence/Loose.md"),
    note("Elsewhere/Outside.md"), { path: "Cadence/Contacts/photo.png" },
  ];

  it("draws one node per markdown note under Cadence/, in vault order, with its type's radius and colour", async () => {
    const { frame } = await rendered(FILES);
    const drawn = frame();
    const fills = drawn.filter((o, i) => o[0] === "fillStyle=" && drawn[i + 1]?.[0] === "fill").map((o) => o[1]);
    expect(ops(drawn, "arc").map((o) => o[3])).toEqual([5, 7, 5, 5, 6.5, 5, 5, 5, 5]);
    expect(fills).toEqual([
      "#f59e0b", "#0ea5e9", "#ec4899", "#10b981", "#8b5cf6", "#64748b", "#a855f7",
      "#14b8a6", "#94a3b8",
    ]);
    expect(ops(drawn, "fillText").map((o) => o[1])).toEqual(["Jane", "Acme", "Beta", "Deal", "Proj", "Call", "Lead", "Reg", "Loose"]);
  });

  it("starts each node at a random point in 150–650 × 100–350 (x from the first draw, y from the second)", async () => {
    const { frame } = await rendered([note("Cadence/Contacts/A.md")], { random: [0.5, 0.5] });
    const [arc] = ops(frame(), "arc");
    // One node at (400, 225), the centre's x, pulled 25px up by gravity 0.0003: vy = -0.0075.
    expect(arc[1]).toBe(400);
    expect(arc[2]).toBeCloseTo(224.9925, 10);
    expect(arc.slice(3)).toEqual([5, 0, Math.PI * 2]);
  });

  it("draws one edge per resolved link between two graph notes, both ways, before the nodes", async () => {
    const links = {
      "Cadence/Contacts/A.md": { "Cadence/Companies/B.md": 1, "Elsewhere/Outside.md": 2, "Cadence/Missing.md": 1 },
      "Cadence/Companies/B.md": { "Cadence/Contacts/A.md": 1, "Cadence/Companies/B.md": 1 },
      "Elsewhere/Outside.md": { "Cadence/Contacts/A.md": 1 },
    };
    const { frame } = await rendered([note("Cadence/Contacts/A.md"), note("Cadence/Companies/B.md"), note("Elsewhere/Outside.md")], {
      links, random: [0, 0, 1, 1],
    });
    const drawn = frame();
    const arcs = ops(drawn, "arc").map((o) => [o[1], o[2]]);
    const edges = drawn.filter((o) => o[0] === "moveTo" || o[0] === "lineTo").map((o) => [o[1], o[2]]);
    // A→B, B→A and the self-link B→B.
    expect(edges).toEqual([arcs[0], arcs[1], arcs[1], arcs[0], arcs[1], arcs[1]]);
    expect(drawn.findIndex((o) => o[0] === "arc")).toBeGreaterThan(drawn.map((o) => o[0]).lastIndexOf("lineTo"));
  });

  it("reads no links when resolvedLinks is missing", async () => {
    const { frame } = await rendered([note("Cadence/Contacts/A.md"), note("Cadence/Contacts/B.md")], { links: undefined });
    const drawn = frame();
    expect(ops(drawn, "moveTo")).toEqual([]);
    expect(ops(drawn, "arc")).toHaveLength(2);
  });

  it("draws a frame as: clear, transform, edges, nodes with rings, labels under the nodes, restore", async () => {
    const links = { "Cadence/Contacts/A.md": { "Cadence/Companies/B.md": 1 } };
    const { frame } = await rendered([note("Cadence/Contacts/A.md"), note("Cadence/Companies/B.md")], { links });
    const drawn = frame();
    const [a, b] = ops(drawn, "arc");
    expect(drawn).toEqual([
      ["clearRect", 0, 0, 800, 400],
      ["save"], ["translate", 0, 0], ["scale", 1, 1],
      ["lineWidth=", 0.8], ["strokeStyle=", "rgba(255, 255, 255, 0.08)"],
      ["beginPath"], ["moveTo", a[1], a[2]], ["lineTo", b[1], b[2]], ["stroke"],
      ["beginPath"], a, ["fillStyle=", "#f59e0b"], ["fill"],
      ["strokeStyle=", "#202020"], ["lineWidth=", 1.2], ["stroke"],
      ["beginPath"], b, ["fillStyle=", "#0ea5e9"], ["fill"],
      ["strokeStyle=", "#202020"], ["lineWidth=", 1.2], ["stroke"],
      ["fillStyle=", "#999999"], ["font=", "8.5px sans-serif"], ["textAlign=", "center"],
      ["fillText", "A", a[1], (a[2] as number) + 5 + 12],
      ["fillStyle=", "#999999"], ["font=", "8.5px sans-serif"], ["textAlign=", "center"],
      ["fillText", "B", b[1], (b[2] as number) + 7 + 12],
      ["restore"],
    ]);
  });
});

describe("renderReportGraph: physics", () => {
  it("gravity pulls toward the centre at 0.0003 within 250px and 0.0012 beyond, and velocity damps by 0.92", async () => {
    // (150, 100): 250px left and 100px up from (400, 200), so 269px out.
    const { frame } = await rendered([note("Cadence/Contacts/A.md")], { random: [0, 0] });
    const [first] = ops(frame(), "arc");
    expect(first[1]).toBeCloseTo(150 + 250 * 0.0012, 10);
    expect(first[2]).toBeCloseTo(100 + 100 * 0.0012, 10);
    const [second] = ops(frame(), "arc");
    const vx = 250 * 0.0012 * 0.92 + (400 - (first[1] as number)) * 0.0012;
    expect(second[1]).toBeCloseTo((first[1] as number) + vx, 10);
  });

  it("nodes closer than 160px repel along the line between them; coincident nodes do not move apart", async () => {
    const { frame } = await rendered([note("Cadence/Contacts/A.md"), note("Cadence/Contacts/B.md")], { random: [0.5, 0.5, 0.6, 0.5] });
    // A (400, 225) and B (450, 225): 50px apart, force (160 - 50) × 0.04 = 4.4 along x.
    const [a, b] = ops(frame(), "arc");
    expect(a[1]).toBeCloseTo(400 - 4.4, 10);
    expect(b[1]).toBeCloseTo(450 + 4.4 + (400 - 450) * 0.0003, 10);
    const same = await rendered([note("Cadence/Contacts/C.md"), note("Cadence/Contacts/D.md")]);
    const [c, d] = ops(same.frame(), "arc");
    expect([c[1], c[2]]).toEqual([d[1], d[2]]);
  });

  it("nodes 155px apart still repel, by (160 - 155) × 0.04", async () => {
    const { frame } = await rendered([note("Cadence/Contacts/A.md"), note("Cadence/Contacts/B.md")], { random: [0.5, 0.5, 0.81, 0.5] });
    // A (400, 225) and B (555, 225).
    const [a] = ops(frame(), "arc");
    expect(a[1]).toBeCloseTo(400 - 0.2, 10);
  });

  it("a link pulls its ends toward 65px apart at 0.009 per px", async () => {
    const links = { "Cadence/Contacts/A.md": { "Cadence/Contacts/B.md": 1 } };
    // A (150, 225) and B (650, 225): 500px apart, so no repulsion; pull (500 - 65) × 0.009 = 3.915.
    // Each is 251px from (400, 200), so gravity is 0.0012.
    const { frame } = await rendered([note("Cadence/Contacts/A.md"), note("Cadence/Contacts/B.md")], { links, random: [0, 0.5, 1, 0.5] });
    const [a, b] = ops(frame(), "arc");
    expect(a[1]).toBeCloseTo(150 + 3.915 + 250 * 0.0012, 10);
    expect(b[1]).toBeCloseTo(650 - 3.915 - 250 * 0.0012, 10);
  });

  it("the centre follows a resize", async () => {
    const { canvas, frame } = await rendered([note("Cadence/Contacts/A.md")], { random: [0.5, 0.5] });
    canvas.clientWidth = 1000;
    canvas.clientHeight = 450;
    FakeResizeObserver.made[0].callback();
    const [arc] = ops(frame(), "arc");
    // (400, 225) toward (500, 225).
    expect([arc[1], arc[2]]).toEqual([400 + 100 * 0.0003, 225]);
  });
});

describe("renderReportGraph: pointer", () => {
  const JANE = note("Cadence/Contacts/Jane.md");
  const ACME = note("Cadence/Companies/Acme.md");
  const LOOSE = note("Cadence/Loose.md");

  it("hovering within radius + 8 of a node shows the tooltip, a pointer cursor and a ring; leaving it hides them", async () => {
    const { canvas, tooltip, frame } = await rendered([JANE], { random: [0.5, 0.5] });
    canvas.trigger("mousemove", pointer(400 + 12.9, 225));
    expect([tooltip.style.display, tooltip.style.left, tooltip.style.top, tooltip.text]).toEqual(["block", "424.9px", "237px", "CONTACT: Jane"]);
    expect(canvas.style.cursor).toBe("pointer");
    const drawn = frame();
    expect(drawn.slice(drawn.findIndex((o) => o[0] === "fill") + 1, drawn.findIndex((o) => o[0] === "stroke", drawn.findIndex((o) => o[0] === "fill")) + 1)).toEqual([
      ["strokeStyle=", "#ffffff"], ["lineWidth=", 2], ["stroke"],
    ]);
    expect(drawn.filter((o) => o[0] === "fillStyle=" || o[0] === "font=").slice(-2)).toEqual([
      ["fillStyle=", "#ffffff"], ["font=", "bold 9.5px sans-serif"],
    ]);
    canvas.trigger("mousemove", pointer(400 + 13.1, 225));
    expect([tooltip.style.display, canvas.style.cursor]).toEqual(["none", "default"]);
  });

  it("the last-drawn node wins where two overlap, and the tooltip sits 12px past the pointer relative to the canvas", async () => {
    const { canvas, tooltip } = await rendered([JANE, ACME]);
    canvas.rect = { left: 100, top: 50 };
    canvas.trigger("mousemove", pointer(500, 275));
    expect([tooltip.text, tooltip.style.left, tooltip.style.top]).toEqual(["COMPANY: Acme", "412px", "237px"]);
  });

  it("a click (down and up within 4px) on a hovered node opens it as its type; a loose note opens as a markdown note", async () => {
    const { canvas, opened, file, app } = await rendered([JANE, LOOSE], { random: [0, 0, 1, 1] });
    canvas.trigger("mousemove", pointer(150, 100));
    canvas.trigger("mousedown", pointer(150, 100));
    canvas.trigger("mousemove", pointer(153, 100));
    canvas.trigger("mouseup", pointer(153, 100));
    canvas.trigger("mousemove", pointer(650, 350));
    canvas.trigger("mousedown", pointer(650, 350));
    canvas.trigger("mouseup", pointer(650, 350));
    expect(opened.mock.calls).toEqual([["contact", file("Cadence/Contacts/Jane.md")]]);
    expect(app.workspace.openedLinks).toEqual([["Cadence/Loose.md", "", false]]);
  });

  it("a registration, commission, certification or sequence opens as its own entity", async () => {
    const files = ["Registrations/R", "Commissions/C", "Certifications/Z", "Sequences/S"].map((p) => note(`Cadence/${p}.md`));
    const { canvas, opened, file } = await rendered(files, { random: [0, 0, 1, 1, 0, 1, 1, 0] });
    for (const [x, y] of [[150, 100], [650, 350], [150, 350], [650, 100]]) {
      canvas.trigger("mousemove", pointer(x, y));
      canvas.trigger("mousedown", pointer(x, y));
      canvas.trigger("mouseup", pointer(x, y));
    }
    expect(opened.mock.calls).toEqual([
      ["registration", file("Cadence/Registrations/R.md")], ["commission", file("Cadence/Commissions/C.md")],
      ["certification", file("Cadence/Certifications/Z.md")], ["sequence", file("Cadence/Sequences/S.md")],
    ]);
  });

  it("a pointer that moves more than 4px between press and release opens nothing", async () => {
    const { canvas, opened } = await rendered([JANE], { random: [0.5, 0.5] });
    canvas.trigger("mousemove", pointer(400, 225));
    canvas.trigger("mousedown", pointer(400, 225));
    canvas.trigger("mousemove", pointer(404, 228));
    canvas.trigger("mouseup", pointer(404, 228));
    expect(opened).not.toHaveBeenCalled();
  });

  it("a press and release with no mousemove opens the pressed node", async () => {
    const { canvas, opened, file } = await rendered([JANE], { random: [0.5, 0.5] });
    canvas.trigger("mousedown", pointer(400, 225));
    canvas.trigger("mouseup", pointer(400, 225));
    expect(opened.mock.calls).toEqual([["contact", file("Cadence/Contacts/Jane.md")]]);
  });

  it("a release with no press on the canvas opens nothing, even over a hovered node", async () => {
    const { canvas, opened } = await rendered([JANE], { random: [0.5, 0.5] });
    canvas.trigger("mousemove", pointer(400, 225));
    canvas.trigger("mouseup", pointer(400, 225));
    expect(opened).not.toHaveBeenCalled();
  });

  it("a tap opens the tapped node, and claims the touch so no mouse events follow", async () => {
    const { canvas, opened, file } = await rendered([JANE], { random: [0.5, 0.5] });
    const start = canvas.trigger("touchstart", { touches: [pointer(400, 225)] });
    const end = canvas.trigger("touchend", { touches: [], changedTouches: [pointer(401, 226)] });
    expect([start.defaultPrevented, end.defaultPrevented]).toEqual([true, true]);
    expect(opened.mock.calls).toEqual([["contact", file("Cadence/Contacts/Jane.md")]]);
  });

  it("a touch that moves more than 4px drags the node and opens nothing; a touch on empty space pans", async () => {
    const { canvas, opened, frame } = await rendered([JANE], { random: [0.5, 0.5] });
    canvas.trigger("touchstart", { touches: [pointer(400, 225)] });
    const move = canvas.trigger("touchmove", { touches: [pointer(300, 150)] });
    expect(move.defaultPrevented).toBe(true);
    const [held] = ops(frame(), "arc");
    expect([held[1], held[2]]).toEqual([300, 150]);
    canvas.trigger("touchend", { touches: [], changedTouches: [pointer(300, 150)] });
    expect(opened).not.toHaveBeenCalled();
    canvas.trigger("touchstart", { touches: [pointer(10, 10)] });
    canvas.trigger("touchmove", { touches: [pointer(40, 30)] });
    expect(frame().slice(1, 4)).toEqual([["save"], ["translate", 30, 20], ["scale", 1, 1]]);
    canvas.trigger("touchend", { touches: [], changedTouches: [pointer(40, 30)] });
    expect(opened).not.toHaveBeenCalled();
  });

  it("a second finger is left to the browser and ends the drag", async () => {
    const { canvas, opened } = await rendered([JANE], { random: [0.5, 0.5] });
    canvas.trigger("touchstart", { touches: [pointer(400, 225)] });
    const second = canvas.trigger("touchstart", { touches: [pointer(400, 225), pointer(500, 300)] });
    expect(second.defaultPrevented).toBe(false);
    canvas.trigger("touchend", { touches: [pointer(500, 300)], changedTouches: [pointer(400, 225)] });
    expect(opened).not.toHaveBeenCalled();
  });

  it("dragging a node pins it under the pointer, zeroes its velocity, and opens nothing on release", async () => {
    const { canvas, opened, frame } = await rendered([JANE], { random: [0.5, 0.5] });
    canvas.trigger("mousemove", pointer(400, 225));
    canvas.trigger("mousedown", pointer(400, 225));
    canvas.trigger("mousemove", pointer(300, 150));
    const [held] = ops(frame(), "arc");
    expect([held[1], held[2]]).toEqual([300, 150]);
    canvas.trigger("mouseup", pointer(300, 150));
    expect(opened).not.toHaveBeenCalled();
    const [freed] = ops(frame(), "arc");
    expect([freed[1], freed[2]]).toEqual([300 + 100 * 0.0003, 150 + 50 * 0.0003]);
  });

  it("pressing empty space pans: the cursor grabs, the transform follows the pointer, and release stops it", async () => {
    const { canvas, frame } = await rendered([JANE], { random: [0.5, 0.5] });
    canvas.trigger("mousedown", pointer(10, 10));
    expect(canvas.style.cursor).toBe("grabbing");
    canvas.trigger("mousemove", pointer(40, 30));
    expect(canvas.style.cursor).toBe("grabbing");
    expect(frame().slice(1, 4)).toEqual([["save"], ["translate", 30, 20], ["scale", 1, 1]]);
    canvas.trigger("mouseup", pointer(40, 30));
    expect(canvas.style.cursor).toBe("default");
    canvas.trigger("mousemove", pointer(90, 90));
    expect(frame().slice(2, 3)).toEqual([["translate", 30, 20]]);
    // Hit testing is in graph space: the node now sits 30px right and 20px down on screen.
    canvas.trigger("mousemove", pointer(430, 245));
    expect(canvas.style.cursor).toBe("pointer");
  });

  it("leaving the canvas drops the drag, pan and hover", async () => {
    const { canvas, tooltip, frame } = await rendered([JANE], { random: [0.5, 0.5] });
    canvas.trigger("mousemove", pointer(400, 225));
    canvas.trigger("mousedown", pointer(400, 225));
    canvas.trigger("mouseleave");
    expect([tooltip.style.display, canvas.style.cursor]).toEqual(["none", "default"]);
    canvas.trigger("mousemove", pointer(100, 100));
    const [arc] = ops(frame(), "arc");
    expect(arc[1]).toBe(400);
  });

  it("the wheel zooms about the pointer by exp(-deltaY × 0.00075), clamped to 0.15–4, and prevents scrolling", async () => {
    const { canvas, frame } = await rendered([], {});
    const event = canvas.trigger("wheel", { ...pointer(200, 100), deltaY: -400 });
    expect(event.defaultPrevented).toBe(true);
    const k = Math.exp(400 * 0.00075);
    const zoomed = frame();
    expect(zoomed[3][0]).toBe("scale");
    expect(zoomed[2][1]).toBeCloseTo(200 - 200 * k, 10);
    expect(zoomed[2][2]).toBeCloseTo(100 - 100 * k, 10);
    expect(zoomed[3][1]).toBeCloseTo(k, 10);
    expect(zoomed[4]).toEqual(["lineWidth=", 0.8 / (zoomed[3][1] as number)]);
    for (let i = 0; i < 20; i++) canvas.trigger("wheel", { ...pointer(0, 0), deltaY: -1000 });
    expect(frame()[3]).toEqual(["scale", 4, 4]);
    for (let i = 0; i < 40; i++) canvas.trigger("wheel", { ...pointer(0, 0), deltaY: 1000 });
    expect(frame()[3]).toEqual(["scale", 0.15, 0.15]);
  });

  it("a second wheel step zooms about the pointer from the current zoom and pan", async () => {
    const { canvas, frame } = await rendered([], {});
    canvas.trigger("wheel", { ...pointer(0, 0), deltaY: -400 });
    canvas.trigger("wheel", { ...pointer(200, 100), deltaY: -400 });
    const k = Math.exp(0.3);
    const [, , translate, scale] = frame();
    expect(scale[1]).toBeCloseTo(k * k, 10);
    expect(translate[1]).toBeCloseTo(200 - 200 * k, 10);
    expect(translate[2]).toBeCloseTo(100 - 100 * k, 10);
  });

  it("labels and rings scale against the zoom so they keep their screen size", async () => {
    const { canvas, frame } = await rendered([JANE], { random: [0.5, 0.5] });
    for (let i = 0; i < 20; i++) canvas.trigger("wheel", { ...pointer(0, 0), deltaY: -1000 });
    const drawn = frame();
    expect(drawn.filter((o) => o[0] === "lineWidth=").map((o) => o[1])).toEqual([0.2, 0.3]);
    const [arc] = ops(drawn, "arc");
    expect(ops(drawn, "fillText")[0][3]).toBe((arc[2] as number) + 5 + 3);
    expect(drawn.find((o) => o[0] === "font=")).toEqual(["font=", "2.125px sans-serif"]);
  });
});

describe("renderReportGraph: theme colours", () => {
  const THEME = {
    "--graph-node-resolved": "rgb(200, 100, 0)", "--graph-node": " #00aa00 ", "--graph-line": "rgb(9, 9, 9)",
    "--background-secondary": "#111111", "--text-normal": "#eeeeee", "--text-muted": "#777777", "--font-interface": "Inter, sans-serif",
  };
  const JANE = note("Cadence/Contacts/Jane.md");
  const LOOSE = note("Cadence/Loose.md");
  const links = { "Cadence/Contacts/Jane.md": { "Cadence/Loose.md": 1 } };
  const styles = (drawn: unknown[][]) => drawn.filter((o) => ["fillStyle=", "strokeStyle=", "font="].includes(o[0] as string));

  it("draws in the theme's colours and font, resolved through getComputedStyle, never a var() string", async () => {
    const { canvas, frame } = await rendered([JANE, LOOSE], { links, theme: THEME, random: [0, 0, 1, 1] });
    canvas.trigger("mousemove", pointer(150, 100));
    const drawn = frame();
    expect(styles(drawn).filter((o) => String(o[1]).includes("var("))).toEqual([]);
    expect(styles(drawn)).toEqual([
      ["strokeStyle=", "rgb(9, 9, 9)"],
      ["fillStyle=", "rgb(200, 100, 0)"], ["strokeStyle=", "#eeeeee"],
      ["fillStyle=", "#00aa00"], ["strokeStyle=", "#111111"],
      ["fillStyle=", "#eeeeee"], ["font=", "bold 9.5px Inter, sans-serif"],
      ["fillStyle=", "#777777"], ["font=", "8.5px Inter, sans-serif"],
    ]);
  });

  it("re-resolves the colours when the theme changes, and draws a frame with them", async () => {
    const { view, theme, frames, frame } = await rendered([LOOSE], { theme: THEME });
    for (let i = 0; frames.length && i < 1000; i++) frame();
    const cssChange = (view as Any).registeredEvents.find((r: Any) => r.name === "css-change");
    theme["--graph-node"] = "#123456";
    cssChange.callback();
    expect(frames).toHaveLength(1);
    expect(styles(frame()).find((o) => o[0] === "fillStyle=")).toEqual(["fillStyle=", "#123456"]);
  });

  it("stops listening for theme changes once the canvas leaves the document", async () => {
    const { view, app, canvas, frame } = await rendered([LOOSE]);
    const cssChange = (view as Any).registeredEvents.find((r: Any) => r.name === "css-change");
    canvas.isConnected = false;
    frame();
    expect(app.workspace.offrefs).toEqual([cssChange]);
  });
});
