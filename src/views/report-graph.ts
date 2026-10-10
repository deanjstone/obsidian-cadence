import type { TFile } from 'obsidian';
import type { AppViewHost } from './host';

/* The relationship graph (reports.graph): a canvas force layout over every
   note under Cadence/, one node per note and one edge per resolved link
   between two of them. The graph, the layout step, hit testing and zoom are
   pure seams; the canvas drawing and the pointer wiring are manual-QA only. */

export type GraphNodeType = 'contact' | 'company' | 'partner' | 'deal' | 'project' | 'activity' | 'lead' | 'note';

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

/* The pan offset (screen px) and zoom factor. */
export interface GraphTransform extends GraphPoint {
  k: number;
}

const TYPE_BY_FOLDER: Array<[string, GraphNodeType]> = [
  ['Cadence/Contacts/', 'contact'],
  ['Cadence/Companies/', 'company'],
  ['Cadence/Partners/', 'partner'],
  ['Cadence/Pipeline/', 'deal'],
  ['Cadence/Projects/', 'project'],
  ['Cadence/Activities/', 'activity'],
  ['Cadence/Leads/', 'lead'],
];

/* A note's node type, by folder. Every other note (registrations,
   commissions, certifications, sequences, loose notes) is a 'note'. */
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
  note: 'var(--graph-node, #94a3b8)'      // gray
};

export function graphNodeColor(type: GraphNodeType): string {
  return GRAPH_TYPE_COLORS[type] || GRAPH_TYPE_COLORS.note;
}

/* One node per markdown note under Cadence/, in file order, each starting
   at a random point in 150–650 × 100–350 (x drawn before y). One edge per
   resolved link from one graph note to another, in the source's link
   order: a self-link is an edge, and links both ways are two. */
export function buildEntityGraph(
  files: TFile[], resolvedLinks: Record<string, Record<string, number>>, random: () => number = Math.random,
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
      x: random() * 500 + 150,
      y: random() * 250 + 100,
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

  // Gather Nodes & Links
  const { nodes, links } = buildEntityGraph(view.app.vault.getMarkdownFiles(), view.app.metadataCache.resolvedLinks || {});

  let width = canvas.clientWidth || 800;
  let height = canvas.clientHeight || 400;
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

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
    if (!canvas.clientWidth) return;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.resetTransform();
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  });
  resizeObserver.observe(canvas);

  // Coordinate conversions
  const getMousePos = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const getCanvasPos = (e: MouseEvent) => toGraphPoint(getMousePos(e), transform);

  // Interaction Events
  canvas.addEventListener('mousedown', (e) => {
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
  });

  canvas.addEventListener('mousemove', (e) => {
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
  });

  canvas.addEventListener('mouseup', (e) => {
    isPanning = false;
    canvas.style.cursor = hoveredNode ? 'pointer' : 'default';

    if (!hasMovedSinceDown && hoveredNode) {
      view.openEntityDetail(hoveredNode.type, hoveredNode.file);
    }

    draggedNode = null;
  });

  canvas.addEventListener('mouseleave', () => {
    draggedNode = null;
    isPanning = false;
    hoveredNode = null;
    tooltip.style.display = 'none';
    canvas.style.cursor = 'default';
  });

  // Elegant scroll wheel zoom centered at mouse position
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const mouse = getMousePos(e);

    transform = zoomAt(transform, mouse, e.deltaY);
  });

  // Physics Engine
  const step = () => {
    if (!canvas.isConnected) {
      resizeObserver.disconnect();
      return;
    }

    // 1–3. Repulsion, link attraction, gravity, then move
    layoutGraph({ nodes, links }, { width, height }, draggedNode);

    // 4. Render
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // Draw links
    ctx.lineWidth = 0.8 / transform.k;
    ctx.strokeStyle = 'var(--graph-line, var(--border-color, rgba(255, 255, 255, 0.08)))';
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
      ctx.fillStyle = graphNodeColor(n.type);
      ctx.fill();

      // Highlight ring if hovered
      if (n === hoveredNode) {
        ctx.strokeStyle = 'var(--text-normal, #ffffff)';
        ctx.lineWidth = 2 / transform.k;
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'var(--background-secondary)';
        ctx.lineWidth = 1.2 / transform.k;
        ctx.stroke();
      }
    });

    // Draw elegant labels under nodes
    nodes.forEach((n) => {
      ctx.fillStyle = n === hoveredNode ? 'var(--text-normal)' : 'var(--text-muted)';
      ctx.font = n === hoveredNode ? `bold ${9.5 / transform.k}px var(--font-interface, sans-serif)` : `${8.5 / transform.k}px var(--font-interface, sans-serif)`;
      ctx.textAlign = 'center';
      ctx.fillText(n.name, n.x, n.y + n.radius + 12 / transform.k);
    });

    ctx.restore();

    requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}
