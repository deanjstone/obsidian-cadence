import { Notice, Platform, TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceImportModal } from '../modals/import-modal';
import { CadenceWidgetCreateModal } from '../modals/widget-create';
import { entityValue, getEnumOptions, listEntities, listEntityFiles, readEntity, readProjectMeta } from '../utils/entities';
import { fmtValue, pctBand } from '../utils/format';
import type { Entity, ProjectMeta } from '../types/entities';
import type { WidgetConfig } from '../types/modals';
import type { AppViewHost } from './host';

/* A project on the card grid: its entity and its milestone progress. */
interface ProjectCardData {
  entity: Entity;
  meta: ProjectMeta;
}

/* The Projects dashboard (projects.dashboard): status cards, the priority
   board with drag and drop, and the custom chart widgets. Also the older
   card grid, renderProjectsView, which has no call site. */

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
  const statusField = def.fields.find(f => f.key === 'status') || { options: ['active', 'on_hold', 'backlog', 'done', 'cancelled'] };
  const statuses = statusField.options || ['active', 'on_hold', 'backlog', 'done', 'cancelled'];

  const grid = root.createDiv({ cls: 'cad-stat-grid', attr: { style: 'padding-bottom: 24px;' } });

  // 1. Total projects card
  const totalCard = grid.createDiv({ cls: 'cad-stat-card', attr: { style: 'padding: 20px; display: flex; flex-direction: column; justify-content: center; min-height: 280px; margin: 0; position: relative;' } });
  totalCard.dataset.accent = 'sky';
  totalCard.createDiv({ cls: 'cad-stat-label', text: 'TOTAL PROJECTS', attr: { style: 'font-weight: 700; letter-spacing: 0.12em;' } });
  totalCard.createDiv({ cls: 'cad-stat-value', text: String(allProjects.length), attr: { style: 'font-size: 3rem; font-weight: 800; margin-top: 12px; line-height: 1;' } });
  totalCard.createDiv({ cls: 'cad-stat-sub', text: 'Across all active and custom statuses', attr: { style: 'margin-top: 12px; font-size: 0.85em; color: var(--text-muted);' } });

  // 2. Dynamic status cards
  const statusAccents: Record<string, string> = {
    active: 'emerald',
    done: 'mint',
    cancelled: 'rose',
    backlog: 'purple',
    on_hold: 'warn',
    'on-hold': 'warn'
  };
  const fallbackAccents = ['sky', 'emerald', 'rose', 'purple', 'warn', 'mint'];

  statuses.forEach((status, index) => {
    const items = allProjects.filter(p => String(entityValue(p, 'status', def)).toLowerCase() === status.toLowerCase());
    const accent = statusAccents[status.toLowerCase().replace('-', '_')] || fallbackAccents[index % fallbackAccents.length];

    const colCard = grid.createDiv({ cls: 'cad-stat-card', attr: { style: 'padding: 20px; display: flex; flex-direction: column; min-height: 280px; margin: 0; position: relative;' } });
    colCard.dataset.accent = accent;
    colCard.dataset.stage = status; // For drag & drop target

    // Header info
    colCard.createDiv({
      cls: 'cad-stat-label',
      text: `${status.replace(/_/g, ' ').toUpperCase()} PROJECTS`,
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
      if (!path || fromStage === status) return;
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
        nameEl.setText((entityValue(e, 'name', def) || e.basename) as string);

        // Right content: Priority Pill
        const priorityVal = entityValue(e, 'priority', def);
        if (priorityVal) {
          const pill = row.createDiv({
            cls: `cad-pill cad-pill-${String(priorityVal).toLowerCase().replace(/\s+/g, '_')}`,
            text: String(priorityVal).replace(/_/g, ' ')
          });
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

    const priorityField = def.fields.find(field => field.key === 'priority') || { options: ['low', 'medium', 'high'] };
    const priorities = priorityField.options || ['low', 'medium', 'high'];

    const priorityAccents: Record<string, string> = {
      low: 'sky',
      medium: 'warn',
      high: 'rose'
    };

    priorities.forEach((prio) => {
      const items = allProjects.filter(p => String(entityValue(p, 'priority', def)).toLowerCase() === prio.toLowerCase());
      const accent = priorityAccents[prio.toLowerCase()] || 'sky';

      // Large Priority Stat Card Stack
      const colCard = boardWrap.createDiv({ cls: 'cad-stat-card', attr: { style: 'padding: 20px; display: flex; flex-direction: column; min-height: 280px; margin: 0; position: relative;' } });
      colCard.dataset.accent = accent;
      colCard.dataset.stage = prio; // For drag & drop target

      // Header info
      colCard.createDiv({
        cls: 'cad-stat-label',
        text: `${prio.toUpperCase()} PRIORITY`,
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
        if (!path || fromStage === prio) return;
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
          nameEl.setText((entityValue(e, 'name', def) || e.basename) as string);

          // Right content: Status Pill
          const statusVal = entityValue(e, 'status', def);
          if (statusVal) {
            const pill = row.createDiv({
              cls: `cad-pill cad-pill-${String(statusVal).toLowerCase().replace(/\s+/g, '_')}`,
              text: String(statusVal).replace(/_/g, ' ')
            });
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
  const labelEl = analyticsHeader.createEl('span', { cls: 'cad-section-label-lg',
    text: 'ANALYTICS & CHARTS', attr: { style: 'padding: 0; margin: 0; display: inline-block;' } });

  const addWidgetBtn = analyticsHeader.createEl('button', { cls: 'cad-btn primary', text: '+ Add Custom Chart' });

  const widgetsGrid = root.createDiv({ cls: 'cad-dash-cols', attr: { style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-bottom: 24px; padding: 0 32px;' } });

  const renderWidgets = () => {
    widgetsGrid.empty();

    const widgets = view.plugin.settings.projectDashboardWidgets || [];
    if (widgets.length === 0) {
      const emptyWrap = widgetsGrid.createDiv({ attr: { style: 'grid-column: 1 / -1; text-align: center; padding: 32px; background: var(--background-secondary); border-radius: 8px; border: 1px dashed var(--border-color);' } });
      emptyWrap.createDiv({ text: 'No custom charts added yet. Click "+ Add Custom Chart" to create one!', attr: { style: 'color: var(--text-muted); font-size: 0.95em;' } });
      return;
    }

    widgets.forEach((w: WidgetConfig) => {
      const card = widgetsGrid.createDiv({ cls: 'cad-dash-card', attr: { style: 'margin: 0; display: flex; flex-direction: column;' } });

      // Card Head
      const head = card.createDiv({ cls: 'cad-dash-card-head', attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;' } });
      const fieldKey = w.groupBy;

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

      [
        { value: 'donut', label: '🍩 Donut' },
        { value: 'bar', label: '📊 Bar' },
        { value: 'kpi', label: '🗃️ KPI Cards' },
        { value: 'list', label: '📋 List' }
      ].forEach(opt => {
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
        view.plugin.settings.projectDashboardWidgets = (view.plugin.settings.projectDashboardWidgets || []).filter((item: WidgetConfig) => item.id !== w.id);
        await view.plugin.saveSettings();
        view.render();
      });

      const body = card.createDiv({ cls: 'cad-dash-card-body', attr: { style: 'flex: 1; min-height: 180px; display: flex; flex-direction: column; justify-content: center; padding: 14px;' } });

      // Calculate chart data for this widget
      const counts: Record<string, number> = {};
      allProjects.forEach(p => {
        let val = entityValue(p, fieldKey, def);
        if (Array.isArray(val)) {
          val.forEach(v => {
            const clean = String(v).replace(/^\[\[|\]\]$/g, '').trim();
            if (clean) counts[clean] = (counts[clean] || 0) + 1;
          });
        } else {
          const clean = String(val || '').replace(/^\[\[|\]\]$/g, '').trim();
          const label = clean || 'Unspecified';
          counts[label] = (counts[label] || 0) + 1;
        }
      });

      const chartData = Object.entries(counts)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);

      // Draw chart directly into a fresh div — no innerHTML.
      view._drawChart(body.createDiv(), w.style, chartData);
    });
  };

  // Add custom widget builder listener
  addWidgetBtn.addEventListener('click', () => {
    new CadenceWidgetCreateModal(view.app, async (newWidget) => {
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
  const statusOptions = getEnumOptions('project', 'status', ['active', 'on_hold', 'backlog', 'done', 'cancelled']);
  const groups: Record<string, ProjectCardData[]> = {};
  statusOptions.forEach(opt => {
    groups[opt.toLowerCase().replace(/\s+/g, '_')] = [];
  });
  projects.forEach((p) => {
    const status = String(entityValue(p.entity, 'status', def) || (statusOptions[0] || 'active')).toLowerCase().replace(/\s+/g, '_');
    const key = groups[status] ? status : Object.keys(groups)[0];
    if (key) groups[key].push(p);
  });

  const grid = root.createDiv({ cls: 'cad-proj-grid' });
  const renderCard = (p: ProjectCardData) => {
    const card = grid.createDiv({ cls: 'cad-proj-card' });
    const head = card.createDiv({ cls: 'cad-proj-card-head' });
    const title = head.createEl('a', { cls: 'cad-proj-title', text: (entityValue(p.entity, 'name', def) as string) || p.entity.basename });
    title.addEventListener('click', (ev) => { ev.preventDefault(); view.openEntityDetail('project', p.entity.file); });
    const status = String(entityValue(p.entity, 'status', def) || 'active');
    const priority = String(entityValue(p.entity, 'priority', def) || '');
    const pillRow = head.createDiv({ cls: 'cad-proj-pills' });
    pillRow.createSpan({ cls: `cad-pill cad-pill-${status.toLowerCase().replace(/\s+/g, '-')}`, text: status });
    if (priority) pillRow.createSpan({ cls: `cad-pill cad-pill-prio-${priority.toLowerCase()}`, text: priority });

    const metaRow = card.createDiv({ cls: 'cad-proj-meta' });
    const owner = entityValue(p.entity, 'owner', def);
    const due = entityValue(p.entity, 'due', def);
    if (owner) view._renderOwnerLinks(metaRow, owner);
    if (due) metaRow.createSpan({ text: `Due: ${fmtValue(due, 'date')}` });

    // Progress
    const progWrap = card.createDiv({ cls: 'cad-proj-progress-wrap' });
    progWrap.dataset.pctBand = pctBand(p.meta.percent);
    const progLabel = progWrap.createDiv({ cls: 'cad-proj-progress-label' });
    progLabel.createSpan({ text: `${p.meta.done}/${p.meta.total} milestones` });
    progLabel.createSpan({ cls: 'cad-proj-progress-pct', text: `${p.meta.percent}%` });
    const bar = progWrap.createDiv({ cls: 'cad-proj-progress-bar' });
    const fill = bar.createDiv({ cls: 'cad-proj-progress-fill' });
    fill.style.width = `${p.meta.percent}%`;

    // Next milestone
    if (p.meta.next) {
      const nextRow = card.createDiv({ cls: 'cad-proj-next' });
      nextRow.createSpan({ cls: 'cad-proj-next-label', text: 'NEXT · ' });
      nextRow.createSpan({ cls: 'cad-proj-next-date', text: fmtValue(p.meta.next.date, 'date') });
      if (p.meta.next.title) nextRow.createSpan({ text: ` — ${p.meta.next.title}` });
    }
  };

  const renderSection = (label: string, list: ProjectCardData[]) => {
    if (!list.length) return;
    root.createDiv({ cls: 'cad-section-label-lg', text: label });
    list.forEach(renderCard);
  };

  // We render section labels by intercepting renderCard placement
  // Reset grid: render in groups
  grid.remove();
  const order = statusOptions.map(opt => opt.toLowerCase().replace(/\s+/g, '_'));
  order.forEach((key) => {
    const list = groups[key];
    if (!list || !list.length) return;
    const origOpt = statusOptions.find(opt => opt.toLowerCase().replace(/\s+/g, '_') === key) || key;
    root.createDiv({ cls: 'cad-section-label-lg', text: origOpt.toUpperCase() });
    const section = root.createDiv({ cls: 'cad-proj-grid' });
    list.forEach((p: ProjectCardData) => {
      const card = section.createDiv({ cls: 'cad-proj-card' });
      const head = card.createDiv({ cls: 'cad-proj-card-head' });
      const title = head.createEl('a', { cls: 'cad-proj-title', text: (entityValue(p.entity, 'name', def) as string) || p.entity.basename });
      title.addEventListener('click', (ev) => { ev.preventDefault(); view.openEntityDetail('project', p.entity.file); });
      const status = String(entityValue(p.entity, 'status', def) || 'active');
      const priority = String(entityValue(p.entity, 'priority', def) || '');
      const pillRow = head.createDiv({ cls: 'cad-proj-pills' });
      pillRow.createSpan({ cls: `cad-pill cad-pill-${status.toLowerCase().replace(/\s+/g, '-')}`, text: status });
      if (priority) pillRow.createSpan({ cls: `cad-pill cad-pill-prio-${priority.toLowerCase()}`, text: priority });

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
