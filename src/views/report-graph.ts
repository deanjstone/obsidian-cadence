import type { TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import type { CoreEntityKey } from '../types/entities';
import type { AppViewHost } from './host';

/* The relationship graph (reports.graph): a canvas force layout over every
   note under Cadence/, one node per note and one edge per resolved link
   between two of them. The graph, the layout step, hit testing and zoom are
   pure seams; the canvas drawing and the pointer wiring are manual-QA only. */

export type GraphNodeType = CoreEntityKey | 'note';

/* A note on the graph. The layout moves x and y in place. */
export interface GraphNode {
  /** The note's path. */
  id: string;
  name: string;
  type: GraphNodeType;
  file: TFile;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

/* A resolved link from one graph note to another. */
export interface GraphLink {
  source: GraphNode;
  target: GraphNode;
}

/* ── Pure seams: plain data in, plain data out ── */

export interface EntityGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GraphPoint {
  x: number;
  y: number;
}

/* A pointer's viewport position: a MouseEvent or a Touch. */
export interface ClientPoint {
  clientX: number;
  clientY: number;
}

/* The pan offset (screen px) and zoom factor. */
export interface GraphTransform extends GraphPoint {
  k: number;
}

const TYPE_BY_FOLDER = Object.entries(ENTITIES).map(([key, def]) => [`${def.folder}/`, key as CoreEntityKey] as const);

/* A note's node type: the entity whose folder holds it, else (a loose
   note under Cadence/) a 'note'. */
export function graphNodeType(path: string): GraphNodeType {
  for (const [folder, type] of TYPE_BY_FOLDER) if (path.startsWith(folder)) return type;
  return 'note';
}

export function graphNodeRadius(type: GraphNodeType): number {
  return type === 'company' ? 7 : (type === 'project' ? 6.5 : 5);
}

// Colors mapping to native Obsidian style & pastel highlights
export const GRAPH_TYPE_COLORS: Record<GraphNodeType, string> = {
  contact: 'var(--graph-node-resolved, #f59e0b)',  // warm orange
  company: '#0ea5e9',  // sky blue
  partner: '#ec4899',  // rose pink
  deal: '#10b981',     // emerald green
  project: '#8b5cf6',  // violet purple
  activity: '#64748b', // slate gray
  lead: '#a855f7',     // purple
  registration: '#14b8a6', // teal
  commission: '#eab308',   // amber
  certification: '#6366f1', // indigo
  sequence: '#84cc16',     // lime
  note: 'var(--graph-node, #94a3b8)'      // gray
};

export function graphNodeColor(type: GraphNodeType): string {
  return GRAPH_TYPE_COLORS[type] || GRAPH_TYPE_COLORS.note;
}

/* The theme references the canvas draws with. A 2D canvas ignores a
   `var(--…)` colour or font, so each is resolved (resolveCssVar) before
   it is drawn. */
const GRAPH_THEME = {
  line: 'var(--graph-line, var(--border-color, rgba(255, 255, 255, 0.08)))',
  ring: 'var(--background-secondary, #202020)',
  hover: 'var(--text-normal, #ffffff)',
  label: 'var(--text-muted, #999999)',
  font: 'var(--font-interface, sans-serif)',
};

/* `value` with every `var(--name[, fallback])` resolved: the property's
   value from `lookup` (its computed value, '' when unset), else the
   fallback, resolved the same way. A concrete value passes through
   trimmed; '' when nothing resolves. */
export function resolveCssVar(value: string, lookup: (name: string) => string, depth = 0): string {
  const trimmed = value.trim();
  const match = /^var\(\s*(--[\w-]+)\s*(?:,([\s\S]*))?\)$/.exec(trimmed);
  if (!match) return trimmed;
  if (depth > 8) return '';
  const own = lookup(match[1]).trim();
  const resolved = own ? resolveCssVar(own, lookup, depth + 1) : '';
  if (resolved) return resolved;
  return match[2] === undefined ? '' : resolveCssVar(match[2], lookup, depth + 1);
}

/* One node per markdown note under Cadence/, in file order, each starting
   at a random point spread over the canvas: 3/16–13/16 of its width and
   1/4–7/8 of its height (150–650 × 100–350 at the default 800×400; x
   drawn before y). One edge per
   resolved link from one graph note to another, in the source's link
   order: a self-link is an edge, and links both ways are two. */
export function buildEntityGraph(
  files: TFile[], resolvedLinks: Record<string, Record<string, number>>, random: () => number = Math.random,
  size: { width: number; height: number } = { width: 800, height: 400 },
): EntityGraph {
  const nodes: GraphNode[] = [];
  const nodeMap = new Map<string, GraphNode>();
  files.filter(f => f.path.startsWith('Cadence/')).forEach((file) => {
    const type = graphNodeType(file.path);
    const node: GraphNode = {
      id: file.path,
      name: file.basename,
      type,
      file,
      x: random() * size.width * 0.625 + size.width * 0.1875,
      y: random() * size.height * 0.625 + size.height * 0.25,
      vx: 0,
      vy: 0,
      radius: graphNodeRadius(type),
    };
    nodes.push(node);
    nodeMap.set(file.path, node);
  });

  const links: GraphLink[] = [];
  nodes.forEach((sourceNode) => {
    const targets = resolvedLinks[sourceNode.id] || {};
    for (const targetPath of Object.keys(targets)) {
      const targetNode = nodeMap.get(targetPath);
      if (targetNode) {
        links.push({ source: sourceNode, target: targetNode });
      }
    }
  });
  return { nodes, links };
}

/* One step of the force layout, moving the nodes in place: nodes closer
   than 160px repel, each link pulls toward 65px, gravity pulls toward the
   centre (harder past 250px), then each node moves by its velocity and the
   velocity damps by 0.92. The pinned (dragged) node is neither pushed nor
   moved. Deterministic: the only randomness is buildEntityGraph's start. */
export function layoutGraph(graph: EntityGraph, size: { width: number; height: number }, pinned: GraphNode | null = null): void {
  const { nodes, links } = graph;

  // 1. Repulsion force between nodes
  for (let i = 0; i < nodes.length; i++) {
    const n1 = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const n2 = nodes[j];
      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const distSq = dx * dx + dy * dy || 1;
      const dist = Math.sqrt(distSq);
      if (dist < 160) {
        const force = (160 - dist) * 0.04;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (n1 !== pinned) { n1.vx -= fx; n1.vy -= fy; }
        if (n2 !== pinned) { n2.vx += fx; n2.vy += fy; }
      }
    }
  }

  // 2. Attraction force along links
  links.forEach((l) => {
    const dx = l.target.x - l.source.x;
    const dy = l.target.y - l.source.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const desiredDist = 65;
    const force = (dist - desiredDist) * 0.009;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    if (l.source !== pinned) { l.source.vx += fx; l.source.vy += fy; }
    if (l.target !== pinned) { l.target.vx -= fx; l.target.vy -= fy; }
  });

  // 3. Gravity pulling to center & Update position
  const cx = size.width / 2;
  const cy = size.height / 2;
  nodes.forEach((n) => {
    if (n === pinned) return;

    const dx = cx - n.x;
    const dy = cy - n.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    let gravity = 0.0003;
    if (dist > 250) {
      gravity = 0.0012; // soft pull back bounds
    }

    n.vx += dx * gravity;
    n.vy += dy * gravity;

    // Apply velocities and damp (glide damping = 0.92 for buttery smooth!)
    n.x += n.vx;
    n.y += n.vy;
    n.vx *= 0.92;
    n.vy *= 0.92;
  });
}

/* Below this speed (px a frame) a node is at rest. */
const SETTLE_SPEED = 0.01;

/* Whether the layout has come to rest: every node moves under
   SETTLE_SPEED px a frame. Never while a node is pinned (dragged), which
   the pointer is still moving. */
export function graphSettled(nodes: GraphNode[], pinned: GraphNode | null = null): boolean {
  if (pinned) return false;
  return nodes.every((n) => Math.hypot(n.vx, n.vy) < SETTLE_SPEED);
}

/* A screen point (relative to the canvas) in graph space. */
export function toGraphPoint(screen: GraphPoint, transform: GraphTransform): GraphPoint {
  return {
    x: (screen.x - transform.x) / transform.k,
    y: (screen.y - transform.y) / transform.k,
  };
}

/* The node under a graph-space point: within its radius + 8 (exclusive),
   the last-drawn node winning, else null. */
export function nodeAt(nodes: GraphNode[], point: GraphPoint): GraphNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    const dx = point.x - n.x;
    const dy = point.y - n.y;
    if (dx * dx + dy * dy < (n.radius + 8) * (n.radius + 8)) {
      return n;
    }
  }
  return null;
}

/* The transform after a wheel step at `mouse`: the zoom scales by
   exp(-deltaY × 0.00075), clamped to 0.15–4, keeping the point under the
   pointer fixed. */
export function zoomAt(transform: GraphTransform, mouse: GraphPoint, deltaY: number): GraphTransform {
  const zoomIntensity = 0.05;
  const factor = Math.exp(-deltaY * zoomIntensity * 0.015);
  const newK = Math.max(0.15, Math.min(4, transform.k * factor));
  return {
    x: mouse.x - (mouse.x - transform.x) * (newK / transform.k),
    y: mouse.y - (mouse.y - transform.y) * (newK / transform.k),
    k: newK,
  };
}

export function graphTooltip(node: Pick<GraphNode, 'type' | 'name'>): string {
  return `${node.type.toUpperCase()}: ${node.name}`;
}

/* ── Surface ── */

export async function renderReportGraph(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-report');
  view._renderPageHeader(root, 'Graph View', 'Relationship graph showing connections between contacts, companies, partners, projects, deals, and activities.');

  const graphCard = root.createDiv({ cls: 'cad-home-card' });
  graphCard.style.padding = '16px';
  graphCard.style.height = '600px';
  graphCard.style.position = 'relative';
  graphCard.style.overflow = 'hidden';
  graphCard.style.backgroundColor = 'var(--background-secondary)';
  graphCard.style.borderRadius = '8px';
  graphCard.style.border = '1px solid var(--border-color)';
  graphCard.style.marginTop = '24px';
  graphCard.style.marginBottom = '24px';

  const canvas = graphCard.createEl('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.cursor = 'default';

  // Tooltip
  const tooltip = graphCard.createDiv();
  tooltip.style.position = 'absolute';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.padding = '6px 10px';
  tooltip.style.backgroundColor = 'var(--background-primary)';
  tooltip.style.border = '1px solid var(--border-color)';
  tooltip.style.borderRadius = '4px';
  tooltip.style.fontSize = '12px';
  tooltip.style.color = 'var(--text-normal)';
  tooltip.style.display = 'none';
  tooltip.style.zIndex = '100';
  tooltip.style.boxShadow = 'var(--shadow-s)';

  let width = canvas.clientWidth || 800;
  let height = canvas.clientHeight || 400;
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  // Gather Nodes & Links, spread over the canvas
  const { nodes, links } = buildEntityGraph(
    view.app.vault.getMarkdownFiles(), view.app.metadataCache.resolvedLinks || {}, Math.random, { width, height },
  );

  // Zoom & Pan state
  let transform: GraphTransform = { x: 0, y: 0, k: 1 };
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let draggedNode: GraphNode | null = null;
  let hoveredNode: GraphNode | null = null;
  let dragStartPos = { x: 0, y: 0 };
  let hasMovedSinceDown = false;

  // Resize handling
  const resizeObserver = new ResizeObserver(() => {
    if (!canvas.isConnected) {
      stop();
      return;
    }
    if (!canvas.clientWidth) return;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.resetTransform();
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    requestDraw();
  });
  resizeObserver.observe(canvas);

  /* Frames run only while something changes: the layout moving, or the
     pointer, the zoom or the size. Once the layout settles, the loop stops
     until the next change asks for a frame. */
  let frameQueued = false;
  const requestDraw = () => {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(step);
  };
  const stop = () => {
    resizeObserver.disconnect();
    view.app.workspace.offref(cssChange);
  };

  /* The theme's colours and font, resolved against the graph card on the
     first frame and again after every theme change. */
  let palette: ReturnType<typeof resolvePalette> | null = null;
  const resolvePalette = () => {
    const style = getComputedStyle(graphCard);
    const themed = (value: string) => resolveCssVar(value, (name) => style.getPropertyValue(name));
    const nodeColors = new Map<GraphNodeType, string>();
    return {
      line: themed(GRAPH_THEME.line),
      ring: themed(GRAPH_THEME.ring),
      hover: themed(GRAPH_THEME.hover),
      label: themed(GRAPH_THEME.label),
      font: themed(GRAPH_THEME.font),
      node: (type: GraphNodeType): string => {
        if (!nodeColors.has(type)) nodeColors.set(type, themed(graphNodeColor(type)));
        return nodeColors.get(type)!;
      },
    };
  };
  const cssChange = view.app.workspace.on('css-change', () => {
    palette = null;
    requestDraw();
  });
  view.registerEvent(cssChange);

  // Coordinate conversions
  const getMousePos = (e: ClientPoint) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const getCanvasPos = (e: ClientPoint) => toGraphPoint(getMousePos(e), transform);

  // An entity opens its detail; a loose note opens as markdown.
  const openNode = (node: GraphNode) => {
    if (node.type === 'note') view.openEntityDetailFromFile(node.file);
    else view.openEntityDetail(node.type, node.file);
  };

  /* A press, move and release, shared by the mouse and a single touch. The
     pressed node is held from the press, so a click needs no mousemove
     first: a release within 4px of the press opens it. */
  const press = (e: ClientPoint) => {
    requestDraw();
    dragStartPos = { x: e.clientX, y: e.clientY };
    hasMovedSinceDown = false;

    const canvasPos = getCanvasPos(e);
    const found = nodeAt(nodes, canvasPos);

    if (found) {
      draggedNode = found;
    } else {
      isPanning = true;
      panStart = { x: e.clientX - transform.x, y: e.clientY - transform.y };
      canvas.style.cursor = 'grabbing';
    }
  };

  const move = (e: ClientPoint) => {
    requestDraw();
    const dist = Math.hypot(e.clientX - dragStartPos.x, e.clientY - dragStartPos.y);
    if (dist > 4) {
      hasMovedSinceDown = true;
    }

    const canvasPos = getCanvasPos(e);

    if (draggedNode) {
      draggedNode.x = canvasPos.x;
      draggedNode.y = canvasPos.y;
      draggedNode.vx = 0;
      draggedNode.vy = 0;
    } else if (isPanning) {
      transform.x = e.clientX - panStart.x;
      transform.y = e.clientY - panStart.y;
    }

    // Hover check using canvasPos
    const found = nodeAt(nodes, canvasPos);

    hoveredNode = found;
    if (hoveredNode) {
      canvas.style.cursor = 'pointer';
      tooltip.style.display = 'block';
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      tooltip.style.left = `${screenX + 12}px`;
      tooltip.style.top = `${screenY + 12}px`;
      tooltip.setText(graphTooltip(hoveredNode));
    } else {
      canvas.style.cursor = isPanning ? 'grabbing' : 'default';
      tooltip.style.display = 'none';
    }
  };

  const release = () => {
    requestDraw();
    const pressed = draggedNode;
    isPanning = false;
    draggedNode = null;
    canvas.style.cursor = hoveredNode ? 'pointer' : 'default';

    if (!hasMovedSinceDown && pressed) openNode(pressed);
  };

  const leave = () => {
    requestDraw();
    draggedNode = null;
    isPanning = false;
    hoveredNode = null;
    tooltip.style.display = 'none';
    canvas.style.cursor = 'default';
  };

  // Interaction Events
  canvas.addEventListener('mousedown', (e) => press(e));
  canvas.addEventListener('mousemove', (e) => move(e));
  canvas.addEventListener('mouseup', () => release());
  canvas.addEventListener('mouseleave', () => leave());

  /* One finger drags, pans and taps like the mouse, and claims the touch
     (no scroll, no emulated mouse events). A second finger is left to the
     browser and drops the drag. */
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) {
      leave();
      return;
    }
    e.preventDefault();
    press(e.touches[0]);
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1 || (!draggedNode && !isPanning)) return;
    e.preventDefault();
    move(e.touches[0]);
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    if (!draggedNode && !isPanning) return;
    e.preventDefault();
    release();
    leave();
  }, { passive: false });
  canvas.addEventListener('touchcancel', () => leave());

  // Elegant scroll wheel zoom centered at mouse position
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const mouse = getMousePos(e);

    transform = zoomAt(transform, mouse, e.deltaY);
    requestDraw();
  });

  // Physics Engine
  const step = () => {
    frameQueued = false;
    if (!canvas.isConnected) {
      stop();
      return;
    }

    // 1–3. Repulsion, link attraction, gravity, then move
    layoutGraph({ nodes, links }, { width, height }, draggedNode);

    const colors = palette ??= resolvePalette();

    // 4. Render
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // Draw links
    ctx.lineWidth = 0.8 / transform.k;
    ctx.strokeStyle = colors.line;
    links.forEach((l) => {
      ctx.beginPath();
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);
      ctx.stroke();
    });

    // Draw nodes
    nodes.forEach((n) => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = colors.node(n.type);
      ctx.fill();

      // Highlight ring if hovered
      if (n === hoveredNode) {
        ctx.strokeStyle = colors.hover;
        ctx.lineWidth = 2 / transform.k;
        ctx.stroke();
      } else {
        ctx.strokeStyle = colors.ring;
        ctx.lineWidth = 1.2 / transform.k;
        ctx.stroke();
      }
    });

    // Draw elegant labels under nodes
    nodes.forEach((n) => {
      ctx.fillStyle = n === hoveredNode ? colors.hover : colors.label;
      ctx.font = n === hoveredNode ? `bold ${9.5 / transform.k}px ${colors.font}` : `${8.5 / transform.k}px ${colors.font}`;
      ctx.textAlign = 'center';
      ctx.fillText(n.name, n.x, n.y + n.radius + 12 / transform.k);
    });

    ctx.restore();

    if (!graphSettled(nodes, draggedNode)) requestDraw();
  };

  requestDraw();
}
