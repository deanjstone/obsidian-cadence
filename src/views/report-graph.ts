import type { TFile } from 'obsidian';
import type { AppViewHost } from './host';

/* The relationship graph (reports.graph): a canvas force layout over every
   note under Cadence/, one node per note and one edge per resolved link
   between two of them. Drawing and the pointer are manual-QA only. */

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
  const rawFiles = view.app.vault.getMarkdownFiles().filter(f => f.path.startsWith('Cadence/'));
  const resolvedLinks = view.app.metadataCache.resolvedLinks || {};

  const nodes: GraphNode[] = [];
  const nodeMap = new Map<string, GraphNode>();

  rawFiles.forEach((file) => {
    let type: GraphNodeType = 'note';
    if (file.path.startsWith('Cadence/Contacts/')) type = 'contact';
    else if (file.path.startsWith('Cadence/Companies/')) type = 'company';
    else if (file.path.startsWith('Cadence/Partners/')) type = 'partner';
    else if (file.path.startsWith('Cadence/Pipeline/')) type = 'deal';
    else if (file.path.startsWith('Cadence/Projects/')) type = 'project';
    else if (file.path.startsWith('Cadence/Activities/')) type = 'activity';
    else if (file.path.startsWith('Cadence/Leads/')) type = 'lead';

    const node: GraphNode = {
      id: file.path,
      name: file.basename,
      type,
      file,
      x: Math.random() * 500 + 150,
      y: Math.random() * 250 + 100,
      vx: 0,
      vy: 0,
      radius: type === 'company' ? 7 : (type === 'project' ? 6.5 : 5)
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

  // Colors mapping to native Obsidian style & pastel highlights
  const typeColors: Record<GraphNodeType, string> = {
    contact: 'var(--graph-node-resolved, #f59e0b)',  // warm orange
    company: '#0ea5e9',  // sky blue
    partner: '#ec4899',  // rose pink
    deal: '#10b981',     // emerald green
    project: '#8b5cf6',  // violet purple
    activity: '#64748b', // slate gray
    lead: '#a855f7',     // purple
    note: 'var(--graph-node, #94a3b8)'      // gray
  };

  let width = canvas.clientWidth || 800;
  let height = canvas.clientHeight || 400;
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  // Zoom & Pan state
  let transform = { x: 0, y: 0, k: 1 };
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

  const getCanvasPos = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return {
      x: (screenX - transform.x) / transform.k,
      y: (screenY - transform.y) / transform.k
    };
  };

  // Interaction Events
  canvas.addEventListener('mousedown', (e) => {
    dragStartPos = { x: e.clientX, y: e.clientY };
    hasMovedSinceDown = false;

    const canvasPos = getCanvasPos(e);
    let found: GraphNode | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = canvasPos.x - n.x;
      const dy = canvasPos.y - n.y;
      if (dx * dx + dy * dy < (n.radius + 8) * (n.radius + 8)) {
        found = n;
        break;
      }
    }

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
    let found: GraphNode | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = canvasPos.x - n.x;
      const dy = canvasPos.y - n.y;
      if (dx * dx + dy * dy < (n.radius + 8) * (n.radius + 8)) {
        found = n;
        break;
      }
    }

    hoveredNode = found;
    if (hoveredNode) {
      canvas.style.cursor = 'pointer';
      tooltip.style.display = 'block';
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      tooltip.style.left = `${screenX + 12}px`;
      tooltip.style.top = `${screenY + 12}px`;
      tooltip.setText(`${hoveredNode.type.toUpperCase()}: ${hoveredNode.name}`);
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

    const zoomIntensity = 0.05;
    const factor = Math.exp(-e.deltaY * zoomIntensity * 0.015);
    const newK = Math.max(0.15, Math.min(4, transform.k * factor));

    transform.x = mouse.x - (mouse.x - transform.x) * (newK / transform.k);
    transform.y = mouse.y - (mouse.y - transform.y) * (newK / transform.k);
    transform.k = newK;
  });

  // Physics Engine
  const step = () => {
    if (!canvas.isConnected) {
      resizeObserver.disconnect();
      return;
    }

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
          if (n1 !== draggedNode) { n1.vx -= fx; n1.vy -= fy; }
          if (n2 !== draggedNode) { n2.vx += fx; n2.vy += fy; }
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
      if (l.source !== draggedNode) { l.source.vx += fx; l.source.vy += fy; }
      if (l.target !== draggedNode) { l.target.vx -= fx; l.target.vy -= fy; }
    });

    // 3. Gravity pulling to center & Update position
    const cx = width / 2;
    const cy = height / 2;
    nodes.forEach((n) => {
      if (n === draggedNode) return;

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
      ctx.fillStyle = typeColors[n.type] || typeColors.note;
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
