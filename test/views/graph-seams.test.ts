import { afterEach, describe, expect, it, vi } from "vitest";
import type { TFile } from "obsidian";
import {
  GRAPH_TYPE_COLORS, buildEntityGraph, graphNodeColor, graphNodeRadius, graphNodeType, graphTooltip, layoutGraph, nodeAt,
  toGraphPoint, zoomAt, type GraphNode,
} from "../../src/views/report-graph";

/* Direct tests for the relationship graph seams: the graph from files and
   resolved links, one layout step, hit testing and zoom, with no canvas. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

afterEach(() => {
  vi.restoreAllMocks();
});

const file = (path: string) => ({ path, basename: path.split("/").pop()!.replace(/\.md$/, "") }) as TFile;
const node = (id: string, x: number, y: number, extra: Partial<GraphNode> = {}): GraphNode =>
  ({ id, name: id, type: "note", file: file(id), x, y, vx: 0, vy: 0, radius: 5, ...extra });
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};
const SIZE = { width: 800, height: 400 };

describe("graphNodeType, graphNodeRadius, graphNodeColor, graphTooltip", () => {
  it("types a note by its entity's folder, every entity included, else 'note'", () => {
    const paths = [
      "Cadence/Contacts/a.md", "Cadence/Companies/a.md", "Cadence/Partners/a.md", "Cadence/Pipeline/a.md",
      "Cadence/Projects/sub/a.md", "Cadence/Activities/a.md", "Cadence/Leads/a.md", "Cadence/Registrations/a.md",
      "Cadence/Commissions/a.md", "Cadence/Certifications/a.md", "Cadence/Sequences/a.md",
      "Cadence/ContactsOld/a.md", "Cadence/a.md", "Other/Contacts/a.md",
    ];
    expect(paths.map(graphNodeType)).toEqual([
      "contact", "company", "partner", "deal", "project", "activity", "lead", "registration", "commission",
      "certification", "sequence", "note", "note", "note",
    ]);
  });

  it("sizes companies 7, projects 6.5 and everything else 5", () => {
    expect((["company", "project", "contact", "note", "lead"] as const).map(graphNodeRadius)).toEqual([7, 6.5, 5, 5, 5]);
  });

  it("colours each type, and an unknown type as a note", () => {
    expect(graphNodeColor("deal")).toBe("#10b981");
    expect(graphNodeColor("contact")).toBe("var(--graph-node-resolved, #f59e0b)");
    expect(graphNodeColor("bogus" as Any)).toBe(GRAPH_TYPE_COLORS.note);
    expect(Object.keys(GRAPH_TYPE_COLORS)).toEqual([
      "contact", "company", "partner", "deal", "project", "activity", "lead",
      "registration", "commission", "certification", "sequence", "note",
    ]);
    expect(new Set(Object.values(GRAPH_TYPE_COLORS)).size).toBe(12);
  });

  it("labels the tooltip TYPE: name", () => {
    expect(graphTooltip({ type: "deal", name: "Big one" })).toBe("DEAL: Big one");
  });
});

describe("buildEntityGraph", () => {
  it("makes one node per file under Cadence/, in order, placed by random() x then y", () => {
    const files = [file("Cadence/Contacts/Jane.md"), file("Notes/x.md"), file("Cadence/Companies/Acme.md")];
    const { nodes, links } = buildEntityGraph(files, {}, seq(0, 1, 0.5, 0.2));
    expect(nodes).toEqual([
      { id: "Cadence/Contacts/Jane.md", name: "Jane", type: "contact", file: files[0], x: 150, y: 350, vx: 0, vy: 0, radius: 5 },
      { id: "Cadence/Companies/Acme.md", name: "Acme", type: "company", file: files[2], x: 400, y: 150, vx: 0, vy: 0, radius: 7 },
    ]);
    expect(links).toEqual([]);
  });

  it("draws from Math.random by default", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(buildEntityGraph([file("Cadence/a.md")], {}).nodes.map((n) => [n.x, n.y])).toEqual([[400, 225]]);
  });

  it("links resolved targets that are graph nodes, in link order, both ways and to itself; others are dropped", () => {
    const files = [file("Cadence/A.md"), file("Cadence/B.md"), file("Other/C.md")];
    const { nodes, links } = buildEntityGraph(files, {
      "Cadence/A.md": { "Other/C.md": 1, "Cadence/B.md": 3, "Cadence/Gone.md": 1 },
      "Cadence/B.md": { "Cadence/B.md": 1, "Cadence/A.md": 1 },
      "Other/C.md": { "Cadence/A.md": 1 },
    }, () => 0);
    const [a, b] = nodes;
    expect(links.map((l) => [l.source, l.target])).toEqual([[a, b], [b, b], [b, a]]);
    expect(links[0].source).toBe(a);
  });
});

describe("layoutGraph", () => {
  it("gravity pulls toward the centre at 0.0003, or 0.0012 beyond 250px, then velocity moves and damps", () => {
    const near = node("near", 400, 300);
    const far = node("far", 400, -100);
    layoutGraph({ nodes: [near], links: [] }, SIZE);
    layoutGraph({ nodes: [far], links: [] }, SIZE);
    expect([near.y, near.vy]).toEqual([300 - 100 * 0.0003, -100 * 0.0003 * 0.92]);
    expect([far.y, far.vy]).toEqual([-100 + 300 * 0.0012, 300 * 0.0012 * 0.92]);
    expect(far.x).toBe(400);
  });

  it("carries damped velocity into the next step", () => {
    const n = node("n", 400, 300);
    layoutGraph({ nodes: [n], links: [] }, SIZE);
    const y1 = n.y;
    layoutGraph({ nodes: [n], links: [] }, SIZE);
    expect(n.y).toBeCloseTo(y1 + (-100 * 0.0003 * 0.92 + (200 - y1) * 0.0003), 12);
  });

  it("repels nodes under 160px apart by (160 - d) × 0.04 along the line between them; none at 160 or for coincident nodes", () => {
    const a = node("a", 400, 200);
    const b = node("b", 430, 240);
    layoutGraph({ nodes: [a, b], links: [] }, SIZE);
    // d = 50: force 4.4, split 0.6/0.8 along (30, 40).
    expect(a.x).toBeCloseTo(400 - 2.64, 12);
    expect(a.y).toBeCloseTo(200 - 3.52, 12);
    const c = node("c", 320, 200);
    const d = node("d", 480, 200);
    layoutGraph({ nodes: [c, d], links: [] }, SIZE);
    expect([c.x, d.x]).toEqual([320 + 80 * 0.0003, 480 - 80 * 0.0003]);
    const g = node("g", 400, 200);
    const h = node("h", 555, 200);
    layoutGraph({ nodes: [g, h], links: [] }, SIZE);
    expect(g.x).toBeCloseTo(400 - 0.2, 12);
    const e = node("e", 400, 200);
    const f = node("f", 400, 200);
    layoutGraph({ nodes: [e, f], links: [] }, SIZE);
    expect([e.x, e.y, f.x, f.y]).toEqual([400, 200, 400, 200]);
  });

  it("pulls linked nodes toward 65px apart, and pushes them apart when closer", () => {
    const a = node("a", 200, 200);
    const b = node("b", 600, 200);
    layoutGraph({ nodes: [a, b], links: [{ source: a, target: b }] }, SIZE);
    expect(a.x).toBeCloseTo(200 + (400 - 65) * 0.009 + 200 * 0.0003, 12);
    const c = node("c", 400, 200);
    const d = node("d", 400, 210);
    layoutGraph({ nodes: [c, d], links: [{ source: c, target: d }] }, SIZE);
    // d = 10: repulsion 6, link (10 - 65) × 0.009 = -0.495, both pushing c up.
    expect(c.y).toBeCloseTo(200 - 6 - 0.495, 12);
  });

  it("leaves the pinned node in place and unpushed, while others still react to it", () => {
    const a = node("a", 400, 200, { vx: 5, vy: 5 });
    const b = node("b", 450, 200);
    layoutGraph({ nodes: [a, b], links: [{ source: a, target: b }] }, SIZE, a);
    expect([a.x, a.y, a.vx, a.vy]).toEqual([400, 200, 5, 5]);
    expect(b.x).toBeGreaterThan(450);
  });

  it("follows the size's centre", () => {
    const n = node("n", 400, 200);
    layoutGraph({ nodes: [n], links: [] }, { width: 1000, height: 400 });
    expect(n.x).toBe(400 + 100 * 0.0003);
  });
});

describe("toGraphPoint, nodeAt and zoomAt", () => {
  it("maps a screen point through the pan and zoom", () => {
    expect(toGraphPoint({ x: 130, y: 70 }, { x: 30, y: 20, k: 2 })).toEqual({ x: 50, y: 25 });
  });

  it("finds a node within radius + 8 (exclusive), the last one winning", () => {
    const a = node("a", 100, 100);
    const b = node("b", 105, 100, { radius: 7 });
    expect(nodeAt([a], { x: 112.9, y: 100 })).toBe(a);
    expect(nodeAt([a], { x: 113, y: 100 })).toBeNull();
    expect(nodeAt([a, b], { x: 102, y: 100 })).toBe(b);
    expect(nodeAt([b, a], { x: 102, y: 100 })).toBe(a);
    expect(nodeAt([], { x: 0, y: 0 })).toBeNull();
  });

  it("zooms by exp(-deltaY × 0.00075) about the pointer, clamped to 0.15–4", () => {
    const t = { x: 10, y: 20, k: 1 };
    const mouse = { x: 200, y: 100 };
    const zoomed = zoomAt(t, mouse, -400);
    const k = Math.exp(0.3);
    expect(zoomed.k).toBeCloseTo(k, 12);
    // The graph point under the pointer stays under it.
    const before = toGraphPoint(mouse, t);
    const after = toGraphPoint(mouse, zoomed);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
    expect(t).toEqual({ x: 10, y: 20, k: 1 });
    expect(zoomAt({ x: 0, y: 0, k: 3.9 }, mouse, -1000).k).toBe(4);
    expect(zoomAt({ x: 0, y: 0, k: 0.2 }, mouse, 1000).k).toBe(0.15);
    expect(zoomAt(t, mouse, 0)).toEqual(t);
    const zoomedIn = { x: -50, y: 30, k: 2 };
    const again = zoomAt(zoomedIn, mouse, -400);
    expect(again.k).toBeCloseTo(2 * k, 12);
    expect(toGraphPoint(mouse, again).x).toBeCloseTo(toGraphPoint(mouse, zoomedIn).x, 10);
  });
});
