import { Notice, Platform, TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceImportModal } from '../modals/import-modal';
import { CadenceWidgetCreateModal } from '../modals/widget-create';
import type { EntityDef, Entity, ProjectMeta } from '../types/entities';
import type { WidgetConfig } from '../types/modals';
import { entityValue, getEnumOptions, listEntities, listEntityFiles, readEntity, readProjectMeta } from '../utils/entities';
import { fmtValue } from '../utils/format';
import { WIDGET_STYLE_OPTIONS, chartData, dashboardWidgets, removeWidget } from './components/charts';
import type { AppViewHost } from './host';

/* The Projects dashboard (projects.dashboard): status cards, the priority
   board with drag and drop, and the custom chart widgets. Also the older
   card grid, renderProjectsView, which has no call site. */

/* A project on the card grid: its entity and its milestone progress. */
export interface ProjectCardData {
  entity: Entity;
  meta: ProjectMeta;
}

/* ── Pure seams: plain data in, plain data out ── */

export const PROJECT_STATUSES = ['active', 'on_hold', 'backlog', 'done', 'cancelled'];
export const PROJECT_PRIORITIES = ['low', 'medium', 'high'];

const STATUS_ACCENTS: Record<string, string> = {
  active: 'emerald',
  done: 'mint',
  cancelled: 'rose',
  backlog: 'purple',
  on_hold: 'warn',
  'on-hold': 'warn'
};
const FALLBACK_ACCENTS = ['sky', 'emerald', 'rose', 'purple', 'warn', 'mint'];
const PRIORITY_ACCENTS: Record<string, string> = {
  low: 'sky',
  medium: 'warn',
  high: 'rose'
};

/** One status or priority card on the dashboard. */
export interface DashboardColumn {
  /** The option, as written to frontmatter on a drop. */
  value: string;
  label: string;
  accent: string;
  items: Entity[];
}

/* A field's options from the def, or the fallback when the field is
   missing or has no options list. Unlike getEnumOptions, an empty list
   is kept, so it gives no cards. */
export function dashboardOptions(def: EntityDef, key: string, fallback: string[]): string[] {
  const field = def.fields.find(f => f.key === key) || { options: fallback };
  return field.options || fallback;
}

/* A status card's accent: its known colour (only the first '-' is read
   as '_'), else the fallback cycle by position. */
export function statusAccent(status: string, index: number): string {
  return STATUS_ACCENTS[status.toLowerCase().replace('-', '_')] || FALLBACK_ACCENTS[index % FALLBACK_ACCENTS.length];
}

export function priorityAccent(priority: string): string {
  return PRIORITY_ACCENTS[priority.toLowerCase()] || 'sky';
}

/* The projects whose field matches the option, ignoring case. A blank or
   off-list value matches no option. */
function projectsWith(projects: Entity[], def: EntityDef, key: string, option: string): Entity[] {
  return projects.filter(p => String(entityValue(p, key, def)).toLowerCase() === option.toLowerCase());
}

/* The dashboard's numbers: the total, one card per status option and one
   per priority option. A project counts in the total even when no card
   matches its status. */
export function projectsSummary(projects: Entity[], def: EntityDef): { total: number; statuses: DashboardColumn[]; priorities: DashboardColumn[] } {
  return {
    total: projects.length,
    statuses: dashboardOptions(def, 'status', PROJECT_STATUSES).map((status, index) => ({
      value: status,
      label: `${status.replace(/_/g, ' ').toUpperCase()} PROJECTS`,
      accent: statusAccent(status, index),
      items: projectsWith(projects, def, 'status', status),
    })),
    priorities: dashboardOptions(def, 'priority', PROJECT_PRIORITIES).map((prio) => ({
      value: prio,
      label: `${prio.toUpperCase()} PRIORITY`,
      accent: priorityAccent(prio),
      items: projectsWith(projects, def, 'priority', prio),
    })),
  };
}

/* A dashboard row's name: the name field (entityValue falls back to the
   basename). */
export function projectRowName(entity: Entity, def: EntityDef): string {
  return (entityValue(entity, 'name', def) || entity.basename) as string;
}

/* A dashboard row's pill (priority on a status card, status on a priority
   card), or null when the value is blank. */
export function dashRowPill(value: unknown): { cls: string; text: string } | null {
  if (!value) return null;
  return {
    cls: `cad-pill cad-pill-${String(value).toLowerCase().replace(/\s+/g, '_')}`,
    text: String(value).replace(/_/g, ' ')
  };
}

/* Whether a card takes a drop: a path is needed, and a row dropped back
   on its own card is ignored. */
export function acceptsDrop(path: string, fromStage: string, stage: string): boolean {
  return !(!path || fromStage === stage);
}

/* The status key a card grid groups by: lower case, spaces as '_'. */
function statusKey(status: string): string {
  return status.toLowerCase().replace(/\s+/g, '_');
}

/* The card grid's groups, in status option order, empty groups dropped.
   A blank status takes the first option, and an unknown one goes in the
   first group. */
export function projectsViewGroups(
  projects: ProjectCardData[], statusOptions: string[], def: EntityDef,
): Array<{ label: string; items: ProjectCardData[] }> {
  const groups: Record<string, ProjectCardData[]> = {};
  statusOptions.forEach(opt => {
    groups[statusKey(opt)] = [];
  });
  projects.forEach((p) => {
    const status = statusKey(String(entityValue(p.entity, 'status', def) || (statusOptions[0] || 'active')));
    const key = groups[status] ? status : Object.keys(groups)[0];
    if (key) groups[key].push(p);
  });
  const order = statusOptions.map(statusKey);
  return order
    .filter((key) => groups[key] && groups[key].length)
    .map((key) => ({
      label: (statusOptions.find(opt => statusKey(opt) === key) || key).toUpperCase(),
      items: groups[key],
    }));
}

/* A grid card's pills: the status (default 'active', spaces as '-') and
   the priority when set. */
export function projectCardPills(entity: Entity, def: EntityDef): Array<{ cls: string; text: string }> {
  const status = String(entityValue(entity, 'status', def) || 'active');
  const priority = String(entityValue(entity, 'priority', def) || '');
  const pills = [{ cls: `cad-pill cad-pill-${status.toLowerCase().replace(/\s+/g, '-')}`, text: status }];
  if (priority) pills.push({ cls: `cad-pill cad-pill-prio-${priority.toLowerCase()}`, text: priority });
  return pills;
}

export async function renderProjectsDashboard(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-dashboard');
  root.addClass('cadence-list'); // Reuses list styles

  // Retrieve projects
  const def = ENTITIES.project;
  if (!def) {
    view.renderComingSoon(root, view._resolveSurface(view.mode));
    return;
  }
  const allProjects = listEntities(view.app, 'project');

  // ─── Header ────────────────────────────────────────
  view._renderPageHeader(root, 'Projects Dashboard', 'Status · priority · custom analytics', (right) => {
    const newProj = right.createEl('button', { cls: 'cad-btn primary', text: '+ New Project' });
    newProj.addEventListener('click', () => view._createEntityFromPrompt('project'));
  });

  // ─── Stats strip ───────────────────────────────────
  const summary = projectsSummary(allProjects, def);

  const grid = root.createDiv({ cls: 'cad-stat-grid', attr: { style: 'padding-bottom: 24px;' } });

  // 1. Total projects card
  const totalCard = grid.createDiv({ cls: 'cad-stat-card', attr: { style: 'padding: 20px; display: flex; flex-direction: column; justify-content: center; min-height: 280px; margin: 0; position: relative;' } });
  totalCard.dataset.accent = 'sky';
  totalCard.createDiv({ cls: 'cad-stat-label', text: 'TOTAL PROJECTS', attr: { style: 'font-weight: 700; letter-spacing: 0.12em;' } });
  totalCard.createDiv({ cls: 'cad-stat-value', text: String(summary.total), attr: { style: 'font-size: 3rem; font-weight: 800; margin-top: 12px; line-height: 1;' } });
  totalCard.createDiv({ cls: 'cad-stat-sub', text: 'Across all active and custom statuses', attr: { style: 'margin-top: 12px; font-size: 0.85em; color: var(--text-muted);' } });

  // 2. Dynamic status cards
  summary.statuses.forEach(({ value: status, label, accent, items }) => {
    const colCard = grid.createDiv({ cls: 'cad-stat-card', attr: { style: 'padding: 20px; display: flex; flex-direction: column; min-height: 280px; margin: 0; position: relative;' } });
    colCard.dataset.accent = accent;
    colCard.dataset.stage = status; // For drag & drop target

    // Header info
    colCard.createDiv({
      cls: 'cad-stat-label',
      text: label,
      attr: { style: 'font-weight: 700; letter-spacing: 0.12em;' }
    });
    colCard.createDiv({ cls: 'cad-stat-value',
      text: String(items.length), attr: { style: 'font-size: 2.25rem; font-weight: 800; margin-top: 4px;' } });

    // List area inside card
    const list = colCard.createDiv({ attr: { style: 'margin-top: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; padding-right: 4px; min-height: 120px;' } });

    // Drag and drop listeners on the status card itself
    colCard.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      try { ev.dataTransfer!.dropEffect = 'move'; } catch (_) { }
      colCard.style.boxShadow = '0 0 0 2px var(--interactive-accent)';
    });
    colCard.addEventListener('dragleave', (ev) => {
      if (!colCard.contains(ev.relatedTarget as Node | null)) {
        colCard.style.boxShadow = '';
      }
    });
    colCard.addEventListener('drop', async (ev) => {
      ev.preventDefault();
      colCard.style.boxShadow = '';
      const path = ev.dataTransfer!.getData('text/cadence-entity');
      const fromStage = ev.dataTransfer!.getData('text/cadence-stage-status');
      if (!acceptsDrop(path, fromStage, status)) return;
      const file = view.app.vault.getAbstractFileByPath(path);
      if (!file || !(file instanceof TFile)) return;
      try {
        await view.app.fileManager.processFrontMatter(file, (fm) => {
          fm['status'] = status;
        });
        new Notice(`Project status set to ${status}`);
        view.render();
      } catch (e) {
        new Notice(`Failed to change status: ${(e as Error).message}`);
      }
    });

    if (!items.length) {
      list.createDiv({ cls: 'cad-empty', text: 'No projects', attr: { style: 'text-align: center; color: var(--text-faint); margin-top: 32px;' } });
    } else {
      const isMobile = !!(Platform && Platform.isMobile);
      items.forEach((e) => {
        // Project Row inside card list
        const row = list.createDiv({ cls: 'cad-dash-row', attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: var(--background-secondary); border-radius: 6px; cursor: pointer; border: 1px solid var(--border-color);' } });

        // Left content: Project Name
        const nameEl = row.createDiv({ attr: { style: 'font-weight: 500; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;' } });
        nameEl.setText(projectRowName(e, def));

        // Right content: Priority Pill
        const pillData = dashRowPill(entityValue(e, 'priority', def));
        if (pillData) {
          const pill = row.createDiv(pillData);
          pill.style.fontSize = '0.7em';
          pill.style.padding = '1px 6px';
        }

        row.addEventListener('click', (ev) => {
          ev.stopPropagation();
          view.openEntityDetail('project', e.file);
        });

        if (!isMobile) {
          row.draggable = true;
          row.addEventListener('dragstart', (ev) => {
            row.style.opacity = '0.4';
            try {
              ev.dataTransfer!.effectAllowed = 'move';
              ev.dataTransfer!.setData('text/cadence-entity', e.file.path);
              ev.dataTransfer!.setData('text/cadence-stage-status', status);
              ev.dataTransfer!.setData('text/plain', `[[${e.file.basename}]]`);
            } catch (_) { }
          });
          row.addEventListener('dragend', () => {
            row.style.opacity = '';
          });
        }
      });
    }
  });

  // ─── Priority Board Section ────────────────────────
  root.createDiv({ cls: 'cad-section-label-lg', text: 'PROJECTS BY PRIORITY' });

  const boardWrap = root.createDiv({ cls: 'cad-stat-grid', attr: { style: 'padding-top: 0; padding-bottom: 24px;' } });

  const renderBoard = () => {
    boardWrap.empty();

    summary.priorities.forEach(({ value: prio, label, accent, items }) => {
      // Large Priority Stat Card Stack
      const colCard = boardWrap.createDiv({ cls: 'cad-stat-card', attr: { style: 'padding: 20px; display: flex; flex-direction: column; min-height: 280px; margin: 0; position: relative;' } });
      colCard.dataset.accent = accent;
      colCard.dataset.stage = prio; // For drag & drop target

      // Header info
      colCard.createDiv({
        cls: 'cad-stat-label',
        text: label,
        attr: { style: 'font-weight: 700; letter-spacing: 0.12em;' }
      });
      colCard.createDiv({ cls: 'cad-stat-value',
        text: String(items.length), attr: { style: 'font-size: 2.25rem; font-weight: 800; margin-top: 4px;' } });

      // List area inside card
      const list = colCard.createDiv({ attr: { style: 'margin-top: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; padding-right: 4px; min-height: 120px;' } });

      // Drag and drop listeners on the priority card itself
      colCard.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        try { ev.dataTransfer!.dropEffect = 'move'; } catch (_) { }
        colCard.style.boxShadow = '0 0 0 2px var(--interactive-accent)';
      });
      colCard.addEventListener('dragleave', (ev) => {
        if (!colCard.contains(ev.relatedTarget as Node | null)) {
          colCard.style.boxShadow = '';
        }
      });
      colCard.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        colCard.style.boxShadow = '';
        const path = ev.dataTransfer!.getData('text/cadence-entity');
        const fromStage = ev.dataTransfer!.getData('text/cadence-stage');
        if (!acceptsDrop(path, fromStage, prio)) return;
        const file = view.app.vault.getAbstractFileByPath(path);
        if (!file || !(file instanceof TFile)) return;
        try {
          await view.app.fileManager.processFrontMatter(file, (fm) => {
            fm['priority'] = prio;
          });
          new Notice(`Project priority set to ${prio}`);
          view.render();
        } catch (e) {
          new Notice(`Failed to change priority: ${(e as Error).message}`);
        }
      });

      if (!items.length) {
        list.createDiv({ cls: 'cad-empty', text: 'No projects', attr: { style: 'text-align: center; color: var(--text-faint); margin-top: 32px;' } });
      } else {
        const isMobile = !!(Platform && Platform.isMobile);
        items.forEach((e) => {
          // Project Row inside card list
          const row = list.createDiv({ cls: 'cad-dash-row', attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: var(--background-secondary); border-radius: 6px; cursor: pointer; border: 1px solid var(--border-color);' } });

          // Left content: Project Name
          const nameEl = row.createDiv({ attr: { style: 'font-weight: 500; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;' } });
          nameEl.setText(projectRowName(e, def));

          // Right content: Status Pill
          const pillData = dashRowPill(entityValue(e, 'status', def));
          if (pillData) {
            const pill = row.createDiv(pillData);
            pill.style.fontSize = '0.7em';
            pill.style.padding = '1px 6px';
          }

          row.addEventListener('click', (ev) => {
            ev.stopPropagation();
            view.openEntityDetail('project', e.file);
          });

          if (!isMobile) {
            row.draggable = true;
            row.addEventListener('dragstart', (ev) => {
              row.style.opacity = '0.4';
              try {
                ev.dataTransfer!.effectAllowed = 'move';
                ev.dataTransfer!.setData('text/cadence-entity', e.file.path);
                ev.dataTransfer!.setData('text/cadence-stage', prio);
                ev.dataTransfer!.setData('text/plain', `[[${e.file.basename}]]`);
              } catch (_) { }
            });
            row.addEventListener('dragend', () => {
              row.style.opacity = '';
            });
          }
        });
      }
    });
  };
  renderBoard();

  // ─── Custom Widgets / Charts Section ────────────────
  const analyticsHeader = root.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 24px 32px 8px 32px; margin-bottom: 16px;' } });
  analyticsHeader.createEl('span', { cls: 'cad-section-label-lg',
    text: 'ANALYTICS & CHARTS', attr: { style: 'padding: 0; margin: 0; display: inline-block;' } });

  const addWidgetBtn = analyticsHeader.createEl('button', { cls: 'cad-btn primary', text: '+ Add Custom Chart' });

  const widgetsGrid = root.createDiv({ cls: 'cad-dash-cols', attr: { style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-bottom: 24px; padding: 0 32px;' } });

  const renderWidgets = () => {
    widgetsGrid.empty();

    const widgets = dashboardWidgets(view.plugin.settings, 'projectDashboardWidgets');
    if (widgets.length === 0) {
      const emptyWrap = widgetsGrid.createDiv({ attr: { style: 'grid-column: 1 / -1; text-align: center; padding: 32px; background: var(--background-secondary); border-radius: 8px; border: 1px dashed var(--border-color);' } });
      emptyWrap.createDiv({ text: 'No custom charts added yet. Click "+ Add Custom Chart" to create one!', attr: { style: 'color: var(--text-muted); font-size: 0.95em;' } });
      return;
    }

    widgets.forEach((w) => {
      const card = widgetsGrid.createDiv({ cls: 'cad-dash-card', attr: { style: 'margin: 0; display: flex; flex-direction: column;' } });

      // Card Head
      const head = card.createDiv({ cls: 'cad-dash-card-head', attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;' } });

      head.createDiv({ cls: 'cad-dash-card-title', text: w.title.toUpperCase(), attr: { style: 'font-weight: 700; font-size: 0.75rem; letter-spacing: 0.12em;' } });

      const actionsWrap = head.createDiv({ attr: { style: 'display: flex; gap: 8px; align-items: center;' } });

      // Chart Style Select
      const styleSelect = actionsWrap.createEl('select', { cls: 'cad-prop-input' });
      styleSelect.style.padding = '2px 4px';
      styleSelect.style.fontSize = '0.8em';
      styleSelect.style.height = 'auto';
      styleSelect.style.width = 'auto';
      styleSelect.style.background = 'var(--background-primary)';
      styleSelect.style.color = 'var(--text-normal)';
      styleSelect.style.border = '1px solid var(--border-color)';
      styleSelect.style.borderRadius = '4px';

      WIDGET_STYLE_OPTIONS.forEach(opt => {
        const o = styleSelect.createEl('option', { value: opt.value, text: opt.label });
        if (w.style === opt.value) o.selected = true;
      });

      styleSelect.addEventListener('change', async () => {
        w.style = styleSelect.value;
        await view.plugin.saveSettings();
        view.render();
      });

      // Delete button
      const delBtn = actionsWrap.createEl('button', { cls: 'cad-btn',
        text: '×', attr: { style: 'color: var(--text-error); padding: 2px 8px; font-weight: bold; border-color: var(--text-error); font-size: 1.1em; height: auto; border-radius: 4px; background: transparent;' } });
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Delete chart "${w.title}"?`)) return;
        view.plugin.settings.projectDashboardWidgets = removeWidget(view.plugin.settings.projectDashboardWidgets, w.id);
        await view.plugin.saveSettings();
        view.render();
      });

      const body = card.createDiv({ cls: 'cad-dash-card-body', attr: { style: 'flex: 1; min-height: 180px; display: flex; flex-direction: column; justify-content: center; padding: 14px;' } });

      // Draw chart directly into a fresh div — no innerHTML.
      view._drawChart(body.createDiv(), w.style, chartData(allProjects, w, def));
    });
  };

  // Add custom widget builder listener
  addWidgetBtn.addEventListener('click', () => {
    new CadenceWidgetCreateModal(view.app, async (newWidget: WidgetConfig) => {
      if (!view.plugin.settings.projectDashboardWidgets) {
        view.plugin.settings.projectDashboardWidgets = [];
      }
      view.plugin.settings.projectDashboardWidgets.push(newWidget);
      await view.plugin.saveSettings();
      view.render();
    }).open();
  });

  renderWidgets();
}

/* Flagged: no call site. The projects.projects route goes to
   renderEntityList. Characterized and kept, as renderEntityKanban was. */
export async function renderProjectsView(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-projects');
  const def = ENTITIES.project;
  const files = listEntityFiles(view.app, 'project');

  view._renderPageHeader(root, 'Projects', `${files.length} ${files.length === 1 ? 'project' : 'projects'} in ${def.folder}`, (right) => {
    const importBtn = right.createEl('button', { cls: 'cad-btn', text: 'Import CSV' });
    importBtn.addEventListener('click', () => new CadenceImportModal(view.app, { entityKey: 'project' }).open());
    const btn = right.createEl('button', { cls: 'cad-btn primary', text: '+ New Project' });
    btn.addEventListener('click', () => view._createEntityFromPrompt('project'));
  });

  if (!files.length) {
    const empty = root.createDiv({ cls: 'cad-empty-state' });
    empty.createDiv({ cls: 'cad-empty-state-title', text: 'No projects yet' });
    empty.createDiv({ cls: 'cad-empty-state-desc', text: 'Hit "+ New Project" — you\'ll get a templated note with Brief, Scope, Milestones, Tasks, Risks and Stakeholders sections ready to fill in.' });
    return;
  }

  const projects = await Promise.all(files.map(async (f) => {
    const e = readEntity(view.app, f);
    const meta = await readProjectMeta(view.app, f);
    return { entity: e, meta };
  }));

  // Group by status
  const statusOptions = getEnumOptions('project', 'status', PROJECT_STATUSES);
  projectsViewGroups(projects, statusOptions, def).forEach(({ label, items }) => {
    root.createDiv({ cls: 'cad-section-label-lg', text: label });
    const section = root.createDiv({ cls: 'cad-proj-grid' });
    items.forEach((p) => {
      const card = section.createDiv({ cls: 'cad-proj-card' });
      const head = card.createDiv({ cls: 'cad-proj-card-head' });
      const title = head.createEl('a', { cls: 'cad-proj-title', text: projectRowName(p.entity, def) });
      title.addEventListener('click', (ev) => { ev.preventDefault(); view.openEntityDetail('project', p.entity.file); });
      const pillRow = head.createDiv({ cls: 'cad-proj-pills' });
      projectCardPills(p.entity, def).forEach((pill) => pillRow.createSpan(pill));

      const metaRow = card.createDiv({ cls: 'cad-proj-meta' });
      const owner = entityValue(p.entity, 'owner', def);
      const due = entityValue(p.entity, 'due', def);
      if (owner) view._renderOwnerLinks(metaRow, owner);
      if (due) metaRow.createSpan({ text: `Due: ${fmtValue(due, 'date')}` });

      const progWrap = card.createDiv({ cls: 'cad-proj-progress-wrap' });
      const progLabel = progWrap.createDiv({ cls: 'cad-proj-progress-label' });
      progLabel.createSpan({ text: `${p.meta.done}/${p.meta.total} milestones` });
      progLabel.createSpan({ cls: 'cad-proj-progress-pct', text: `${p.meta.percent}%` });
      const bar = progWrap.createDiv({ cls: 'cad-proj-progress-bar' });
      const fill = bar.createDiv({ cls: 'cad-proj-progress-fill' });
      fill.style.width = `${p.meta.percent}%`;

      if (p.meta.next) {
        const nextRow = card.createDiv({ cls: 'cad-proj-next' });
        nextRow.createSpan({ cls: 'cad-proj-next-label', text: 'NEXT · ' });
        nextRow.createSpan({ cls: 'cad-proj-next-date', text: fmtValue(p.meta.next.date, 'date') });
        if (p.meta.next.title) nextRow.createSpan({ text: ` — ${p.meta.next.title}` });
      }
    });
  });
}
