import { Notice, Platform, TFile, setIcon } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceImportModal } from '../modals/import-modal';
import { entityValue, getFieldSuggestionSource, listEntities, readProjectMeta } from '../utils/entities';
import { fmtValue, pctBand } from '../utils/format';
import { parseLinkValues } from '../utils/parsing';
import type { Entity, EntityField } from '../types/entities';
import type { AppViewHost } from './host';

/** What a caller of renderEntityList can override (renderTeam passes all three). */
export interface EntityListOptions {
  title?: string;
  filter?: (entity: Entity) => boolean;
  /** Columns shown first; every other field is still appended. */
  columns?: string[];
}

export async function renderEntityList(
  view: AppViewHost, root: HTMLElement, entityKey: string, opts: EntityListOptions = {},
): Promise<void> {
  root.addClass('cadence-list');
  const def = ENTITIES[entityKey];
  if (!def) { view.renderComingSoon(root, view._resolveSurface(view.mode)); return; }

  const entities = listEntities(view.app, entityKey);
  const filtered = opts.filter ? entities.filter(opts.filter) : entities;

  const mode = view.mode;
  const layout = view.plugin.settings.pageLayouts?.[mode] || (mode === 'projects.projects' ? 'cards' : (mode === 'crm.pipeline' ? 'kanban' : 'table'));

  view._renderPageHeader(root, opts.title || def.plural, `${filtered.length} ${filtered.length === 1 ? def.label.toLowerCase() : def.plural.toLowerCase()} in ${def.folder}`, (right) => {
    // Layout switcher
    const switcher = right.createDiv({ cls: 'cad-layout-switcher' });
    switcher.style.display = 'inline-flex';
    switcher.style.gap = '4px';
    switcher.style.marginRight = '12px';
    switcher.style.border = '1px solid var(--border-color)';
    switcher.style.borderRadius = '6px';
    switcher.style.overflow = 'hidden';
    switcher.style.padding = '2px';
    switcher.style.background = 'var(--background-secondary)';

    const layouts = [
      { key: 'table', icon: 'layout-list', title: 'Table view' },
      { key: 'kanban', icon: 'kanban', title: 'Kanban board' },
      { key: 'cards', icon: 'layout-grid', title: 'Card grid' }
    ];

    layouts.forEach(l => {
      const btn = switcher.createEl('button', { cls: 'cad-topbar-icon-btn' });
      btn.style.padding = '4px 8px';
      btn.style.height = 'auto';
      btn.style.border = 'none';
      btn.style.background = layout === l.key ? 'var(--background-modifier-border)' : 'transparent';
      btn.style.borderRadius = '4px';
      btn.style.cursor = 'pointer';
      try { setIcon(btn, l.icon); } catch (_) { }
      btn.title = l.title;

      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!view.plugin.settings.pageLayouts) view.plugin.settings.pageLayouts = {};
        view.plugin.settings.pageLayouts[mode] = l.key;
        await view.plugin.saveSettings();
        view.render();
      });
    });

    const importBtn = right.createEl('button', { cls: 'cad-btn', text: 'Import CSV' });
    importBtn.addEventListener('click', () => new CadenceImportModal(view.app, { entityKey }).open());
    const btn = right.createEl('button', { cls: 'cad-btn primary', text: `+ New ${def.label}` });
    btn.addEventListener('click', () => view._createEntityFromPrompt(entityKey));
  });

  if (!filtered.length) {
    const empty = root.createDiv({ cls: 'cad-empty-state' });
    empty.createDiv({ cls: 'cad-empty-state-title', text: `No ${def.plural.toLowerCase()} yet` });
    empty.createDiv({ cls: 'cad-empty-state-desc', text: `Drop a markdown note in ${def.folder}/ with frontmatter, or hit "+ New" above.` });
    return;
  }

  // Interactive Controls Bar (Search + Dynamic Filters)
  const controls = root.createDiv({ cls: 'cad-list-controls' });
  controls.style.display = 'flex';
  controls.style.gap = '12px';
  controls.style.alignItems = 'center';
  controls.style.marginBottom = '16px';
  controls.style.flexWrap = 'wrap';

  // Search bar
  const searchWrap = controls.createDiv({ cls: 'cad-search-wrap' });
  searchWrap.style.display = 'flex';
  searchWrap.style.alignItems = 'center';
  searchWrap.style.gap = '6px';
  searchWrap.style.flex = '1';
  searchWrap.style.minWidth = '200px';

  const searchInput = searchWrap.createEl('input', {
    type: 'text',
    cls: 'cad-pd-meta-input',
    placeholder: `Search ${def.plural.toLowerCase()}...`
  });
  searchInput.style.width = '100%';
  searchInput.style.margin = '0';

  // Render Kanban GroupBy Selector in the Controls bar
  if (layout === 'kanban') {
    const kanbanFields = def.fields.filter(field => !field.primary && ['enum', 'text', 'multitext', 'tags'].includes(field.type as string));
    if (kanbanFields.length > 0) {
      const groupSelectWrap = controls.createDiv({ attr: { style: 'display: inline-flex; align-items: center; gap: 6px; margin-left: auto;' } });
      groupSelectWrap.createSpan({ text: 'Group columns by:', attr: { style: 'font-size: 0.85em; color: var(--text-muted); font-weight: 600;' } });
      const groupSelect = groupSelectWrap.createEl('select', { cls: 'cad-prop-input' });
      groupSelect.style.padding = '6px 10px';
      groupSelect.style.height = 'auto';
      groupSelect.style.width = 'auto';
      groupSelect.style.background = 'var(--background-secondary)';
      groupSelect.style.color = 'var(--text-normal)';
      groupSelect.style.border = '1px solid var(--border-color)';
      groupSelect.style.borderRadius = '6px';

      kanbanFields.forEach(f => {
        const optEl = groupSelect.createEl('option', { value: f.key, text: f.label });
        const currentParams = view.getEntityKanbanParams(entityKey);
        if (currentParams.groupBy === f.key) optEl.selected = true;
      });

      groupSelect.addEventListener('change', async () => {
        if (!view.plugin.settings.pageKanbanGroupBy) view.plugin.settings.pageKanbanGroupBy = {};
        view.plugin.settings.pageKanbanGroupBy[entityKey] = groupSelect.value;
        await view.plugin.saveSettings();
        view.render();
      });
    }
  }

  // Dynamic Filters based on fields
  const filterableKeys = def.fields
    .map(f => f.key)
    .filter(k => {
      const fdef = def.fields.find(f => f.key === k);
      return fdef && (fdef.type === 'enum' || ['company', 'role', 'with', 'related', 'status', 'tier', 'type'].includes(k));
    });

  const activeFilters: Record<string, string> = {};
  let searchVal = '';
  let currentSortField = def.columns[0] || '';
  let currentSortAsc = true;

  filterableKeys.forEach(k => {
    const fdef = def.fields.find(f => f.key === k);
    if (!fdef) return;

    const uniqueVals = new Set<string>();
    filtered.forEach(e => {
      const val = entityValue(e, k, def);
      if (Array.isArray(val)) {
        val.forEach(v => {
          if (v) {
            const clean = String(v).replace(/^\[\[|\]\]$/g, '').trim();
            if (clean) uniqueVals.add(clean);
          }
        });
      } else if (val != null && val !== '') {
        const clean = String(val).replace(/^\[\[|\]\]$/g, '').trim();
        if (clean) uniqueVals.add(clean);
      }
    });

    if (uniqueVals.size === 0) return;

    const filterWrap = controls.createDiv({ cls: 'cad-filter-select-wrap' });
    filterWrap.style.display = 'flex';
    filterWrap.style.alignItems = 'center';
    filterWrap.style.gap = '6px';

    const sel = filterWrap.createEl('select', { cls: 'cad-pd-meta-input' });
    sel.style.margin = '0';
    sel.style.padding = '4px 8px';
    sel.style.minHeight = '30px';
    sel.style.border = '1px solid var(--border-color)';
    sel.style.borderRadius = '4px';

    sel.createEl('option', { value: '', text: `All ${fdef.label}s` });
    Array.from(uniqueVals).sort().forEach(v => {
      sel.createEl('option', { value: v, text: v });
    });

    sel.addEventListener('change', () => {
      activeFilters[k] = sel.value;
      renderContent();
    });
  });

  const baseCols = opts.columns || def.columns;
  const cols = baseCols.map((k) => def.fields.find((f) => f.key === k)).filter(Boolean) as EntityField[];
  // Dynamically append any custom/extra fields not present in baseCols
  def.fields.forEach((f) => {
    if (!baseCols.includes(f.key) && !cols.some(c => c.key === f.key)) {
      cols.push(f);
    }
  });

  // Create container elements for each layout type
  const tableWrap = root.createDiv({ cls: 'cad-table-wrap' });
  const kanbanWrap = root.createDiv({ cls: 'cad-kanban-board-wrap' });
  const cardsWrap = root.createDiv({ cls: 'cad-proj-grid-wrap' });

  const renderContent = async () => {
    // 1. Hide and clear all containers
    tableWrap.style.display = 'none';
    tableWrap.empty();
    kanbanWrap.style.display = 'none';
    kanbanWrap.empty();
    cardsWrap.style.display = 'none';
    cardsWrap.empty();

    // 2. Filter
    let displayed = filtered.filter(e => {
      if (searchVal) {
        const match = cols.some(f => {
          const val = entityValue(e, f.key, def);
          if (val == null) return false;
          return String(val).toLowerCase().includes(searchVal);
        }) || e.basename.toLowerCase().includes(searchVal);
        if (!match) return false;
      }

      for (const [k, filterVal] of Object.entries(activeFilters)) {
        if (!filterVal) continue;
        const val = entityValue(e, k, def);
        if (Array.isArray(val)) {
          const cleanVals = val.map(v => String(v).replace(/^\[\[|\]\]$/g, '').trim().toLowerCase());
          if (!cleanVals.includes(filterVal.toLowerCase())) return false;
        } else {
          const cleanVal = String(val || '').replace(/^\[\[|\]\]$/g, '').trim().toLowerCase();
          if (cleanVal !== filterVal.toLowerCase()) return false;
        }
      }

      return true;
    });

    // 3. Sort
    if (currentSortField) {
      const fdef = def.fields.find(f => f.key === currentSortField);
      const ftype = fdef ? fdef.type : 'text';

      displayed.sort((a, b) => {
        let valA = entityValue(a, currentSortField, def);
        let valB = entityValue(b, currentSortField, def);

        if (valA && typeof valA === 'string') valA = valA.replace(/^\[\[|\]\]$/g, '').trim();
        if (valB && typeof valB === 'string') valB = valB.replace(/^\[\[|\]\]$/g, '').trim();

        if (valA == null) valA = '';
        if (valB == null) valB = '';

        let diff = 0;
        if (ftype === 'number' || ftype === 'currency') {
          diff = Number(valA) - Number(valB);
        } else if (ftype === 'date') {
          const dateA = new Date(valA as string).getTime() || 0;
          const dateB = new Date(valB as string).getTime() || 0;
          diff = dateA - dateB;
        } else {
          diff = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
        }

        return currentSortAsc ? diff : -diff;
      });
    }

    // 4. Render Layout
    if (layout === 'table') {
      tableWrap.style.display = 'block';
      const table = tableWrap.createEl('table', { cls: 'cad-table' });
      const thead = table.createEl('thead');
      const trh = thead.createEl('tr');

      const headers = [];
      cols.forEach((f) => {
        const th = trh.createEl('th');
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        const thSpan = th.createSpan({ text: f.label + ' ' });
        const indicator = th.createSpan({ text: f.key === currentSortField ? '▲' : '↕' });
        indicator.style.opacity = f.key === currentSortField ? '1' : '0.4';
        indicator.style.marginLeft = '4px';

        headers.push({ key: f.key, th, indicator });

        th.addEventListener('click', () => {
          if (currentSortField === f.key) {
            currentSortAsc = !currentSortAsc;
          } else {
            currentSortField = f.key;
            currentSortAsc = true;
          }
          renderContent();
        });
      });

      const tbody = table.createEl('tbody');
      if (displayed.length === 0) {
        const tr = tbody.createEl('tr');
        const td = tr.createEl('td', { text: 'No matching entries found.' });
        td.colSpan = cols.length;
        td.style.textAlign = 'center';
        td.style.color = 'var(--text-muted)';
        td.style.padding = '20px';
      } else {
        displayed.forEach((e) => {
          const tr = tbody.createEl('tr', { cls: 'cad-row' });
          cols.forEach((f, i) => {
            const td = tr.createEl('td');
            const val = entityValue(e, f.key, def);
            const formatted = fmtValue(val, f.type);
            const primaryField = def.fields.find(fd => fd.primary) || def.fields[0];
            const hasPrimaryCol = cols.some(c => c.key === primaryField.key);
            const isPrimaryCol = hasPrimaryCol ? (f.key === primaryField.key) : (i === 0);

            if (isPrimaryCol) {
              const a = td.createEl('a', { cls: 'cad-row-primary', text: formatted || e.basename });
              a.addEventListener('click', (ev) => {
                ev.preventDefault();
                view.openEntityDetail(entityKey, e.file);
              });
            } else if (f.key === 'owner' || f.key === 'assigned') {
              view._renderOwnerLinks(td, val, false);
            } else {
              const sugSrc = f.suggestionSource || getFieldSuggestionSource(f);
              if (f.type === 'multitext' && sugSrc && sugSrc !== 'none' && sugSrc !== 'tags' && sugSrc !== 'history') {
                const targetSrc = sugSrc === 'history' ? 'folder:Cadence/Shared' : sugSrc;
                view._renderEntityLinks(td, val, targetSrc);
              } else if (f.key === 'company') {
                view._renderEntityLinks(td, val, 'company');
              } else if (f.key === 'partner') {
                view._renderEntityLinks(td, val, 'partner');
              } else if (f.key === 'contact' || f.key === 'contacts' || f.key === 'with') {
                view._renderEntityLinks(td, val, 'contact');
              } else if (f.key === 'related') {
                view._renderEntityLinks(td, val, 'project');
              } else {
                td.setText(formatted);
              }
            }
          });
        });
      }
    } else if (layout === 'kanban') {
      kanbanWrap.style.display = 'block';
      const kanbanParams = view.getEntityKanbanParams(entityKey);
      const { groupBy, groups } = kanbanParams;
      const board = kanbanWrap.createDiv({ cls: 'cad-kanban-board' });

      groups.forEach((stage) => {
        const items = displayed.filter((e) => {
          const val = entityValue(e, groupBy, def);
          if (Array.isArray(val)) {
            const cleanVals = val.map(v => String(v).replace(/^\[\[|\]\]$/g, '').trim().toLowerCase());
            return cleanVals.includes(stage.toLowerCase());
          }
          return String(val || '').replace(/^\[\[|\]\]$/g, '').trim().toLowerCase() === stage.toLowerCase();
        });

        const col = board.createDiv({ cls: 'cad-kanban-col' });
        col.dataset.stage = stage;
        const head = col.createDiv({ cls: 'cad-kanban-col-head' });
        head.createDiv({ cls: 'cad-kanban-col-title', text: stage });

        const valueField = def.fields.find(f => f.type === 'currency' || f.type === 'number');
        if (valueField) {
          const sum = items.reduce((s, e) => s + (Number(entityValue(e, valueField.key, def)) || 0), 0);
          head.createDiv({ cls: 'cad-kanban-col-meta', text: `${items.length} · ${fmtValue(sum, valueField.type)}` });
        } else {
          head.createDiv({ cls: 'cad-kanban-col-meta', text: `${items.length}` });
        }

        const list = col.createDiv({ cls: 'cad-kanban-col-list' });

        list.addEventListener('dragover', (ev) => {
          ev.preventDefault();
          try { ev.dataTransfer!.dropEffect = 'move'; } catch (_) { }
          col.addClass('drag-over');
        });
        list.addEventListener('dragleave', (ev) => {
          if (!col.contains(ev.relatedTarget as Node | null)) col.removeClass('drag-over');
        });
        list.addEventListener('drop', async (ev) => {
          ev.preventDefault();
          col.removeClass('drag-over');
          const path = ev.dataTransfer!.getData('text/cadence-entity');
          const fromStage = ev.dataTransfer!.getData('text/cadence-stage');
          if (!path || fromStage === stage) return;
          const file = view.app.vault.getAbstractFileByPath(path);
          if (!file || !(file instanceof TFile)) return;
          try {
            await view.app.fileManager.processFrontMatter(file, (fm) => {
              const fDef = def.fields.find(fd => fd.key === groupBy);
              const isList = fDef && (fDef.type === 'multitext' || fDef.type === 'tags' || fDef.isList === true);
              const isLink = fDef && fDef.suggestionSource && fDef.suggestionSource !== 'none' && fDef.suggestionSource !== 'tags' && fDef.suggestionSource !== 'history';
              if (isList) {
                fm[groupBy] = isLink ? [`[[${stage}]]`] : [stage];
              } else {
                fm[groupBy] = isLink ? `[[${stage}]]` : stage;
              }
            });
            new Notice(`Moved to ${stage}`);
          } catch (e) {
            new Notice(`Failed to move: ${(e as Error).message}`);
          }
        });

        if (!items.length) {
          list.createDiv({ cls: 'cad-empty', text: '—' });
        } else {
          const isMobile = !!(Platform && Platform.isMobile);
          items.forEach((e) => {
            const card = list.createDiv({ cls: 'cad-kanban-card' });
            card.dataset.path = e.file.path;

            const primaryField = def.fields.find(f => f.primary) || def.fields[0];
            card.createDiv({ cls: 'cad-kanban-card-title', text: (entityValue(e, primaryField.key, def) || e.basename) as string });

            const meta = card.createDiv({ cls: 'cad-kanban-card-meta' });
            if (valueField) {
              const val = entityValue(e, valueField.key, def);
              if (val) meta.createSpan({ text: fmtValue(val, valueField.type) });
            }

            const relFields = ['company', 'contact', 'owner', 'assigned'];
            relFields.forEach(rf => {
              const rfDef = def.fields.find(f => f.key === rf);
              if (rfDef) {
                const vals = parseLinkValues(entityValue(e, rf, def));
                vals.forEach(v => {
                  meta.createSpan({ text: ' · ' });
                  const link = meta.createEl('a', { text: v.display });
                  link.style.textDecoration = 'underline';
                  link.style.cursor = 'pointer';
                  link.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const targetFile = view.app.vault.getMarkdownFiles().find(f => f.basename.toLowerCase() === v.target.toLowerCase());
                    if (targetFile) view.openEntityDetail(rf === 'owner' || rf === 'assigned' ? 'contact' : rf, targetFile);
                    else view.app.workspace.openLinkText(v.target, '', false);
                  });
                });
              }
            });

            if (!isMobile) {
              card.draggable = true;
              card.addEventListener('dragstart', (ev) => {
                card.addClass('dragging');
                try {
                  ev.dataTransfer!.effectAllowed = 'move';
                  ev.dataTransfer!.setData('text/cadence-entity', e.file.path);
                  ev.dataTransfer!.setData('text/cadence-stage', stage);
                  ev.dataTransfer!.setData('text/plain', `[[${e.file.basename}]]`);
                } catch (_) { }
              });
              card.addEventListener('dragend', () => card.removeClass('dragging'));
            } else {
              card.addClass('cad-kanban-card-touch');
            }
            card.addEventListener('click', () => view.openEntityDetail(entityKey, e.file));
          });
        }
      });
    } else if (layout === 'cards') {
      cardsWrap.style.display = 'block';
      const grid = cardsWrap.createDiv({ cls: 'cad-proj-grid' });

      if (entityKey === 'project') {
        const projects = await Promise.all(displayed.map(async (e) => {
          const meta = await readProjectMeta(view.app, e.file);
          return { entity: e, meta };
        }));

        projects.forEach((p) => {
          const card = grid.createDiv({ cls: 'cad-proj-card' });
          const head = card.createDiv({ cls: 'cad-proj-card-head' });
          const title = head.createEl('a', { cls: 'cad-proj-title', text: (entityValue(p.entity, 'name', def) || p.entity.basename) as string });
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
          progWrap.dataset.pctBand = pctBand(p.meta.percent);
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
      } else {
        displayed.forEach((e) => {
          const card = grid.createDiv({ cls: 'cad-proj-card' });
          const head = card.createDiv({ cls: 'cad-proj-card-head' });

          const primaryField = def.fields.find(f => f.primary) || def.fields[0];
          const titleText = (entityValue(e, primaryField.key, def) || e.basename) as string;
          const title = head.createEl('a', { cls: 'cad-proj-title', text: titleText });
          title.addEventListener('click', (ev) => { ev.preventDefault(); view.openEntityDetail(entityKey, e.file); });

          const pillRow = head.createDiv({ cls: 'cad-proj-pills' });
          const statusField = def.fields.find(f => f.key === 'status' || f.key === 'type' || f.key === 'tier') || def.fields.find(f => f.type === 'enum');
          if (statusField) {
            const val = entityValue(e, statusField.key, def);
            if (val) {
              const clean = Array.isArray(val) ? val[0] : val;
              pillRow.createSpan({ cls: `cad-pill cad-pill-${String(clean).toLowerCase().replace(/\s+/g, '-')}`, text: String(clean) });
            }
          }

          const metaRow = card.createDiv({ cls: 'cad-proj-meta' });
          let count = 0;
          def.fields.forEach(f => {
            if (f.key !== primaryField.key && (!statusField || f.key !== statusField.key) && count < 4) {
              const val = entityValue(e, f.key, def);
              if (val != null && val !== '') {
                const formatted = fmtValue(val, f.type);
                const fieldDiv = metaRow.createDiv();
                fieldDiv.style.marginBottom = '2px';
                fieldDiv.createSpan({ text: `${f.label}: `, attr: { style: 'font-weight: 500; color: var(--text-muted);' }});

                const isLinkProperty = f.key === 'company' || f.key === 'contact' || f.key === 'partner' || f.key === 'owner' || f.key === 'project' || (f.suggestionSource && f.suggestionSource.startsWith('folder:'));
                if (isLinkProperty) {
                  const links = parseLinkValues(val);
                  links.forEach((link, lidx) => {
                    if (lidx > 0) fieldDiv.createSpan({ text: ', ' });
                    const aLink = fieldDiv.createEl('a', { text: link.display });
                    aLink.style.textDecoration = 'underline';
                    aLink.style.cursor = 'pointer';
                    aLink.addEventListener('click', (ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      const targetFile = view.app.vault.getMarkdownFiles().find(f => f.basename.toLowerCase() === link.target.toLowerCase());

                      let relatedKey = f.key === 'owner' ? 'contact' : f.key;
                      if (f.suggestionSource && f.suggestionSource.startsWith('folder:')) {
                        const folder = f.suggestionSource.replace('folder:', '').split('/').pop()!.toLowerCase();
                        const found = Object.keys(ENTITIES).find(k => ENTITIES[k].folder.toLowerCase().endsWith(folder) || ENTITIES[k].plural.toLowerCase() === folder);
                        if (found) relatedKey = found;
                      }

                      if (targetFile) view.openEntityDetail(relatedKey, targetFile);
                      else view.app.workspace.openLinkText(link.target, '', false);
                    });
                  });
                } else {
                  fieldDiv.createSpan({ text: formatted });
                }
                count++;
              }
            }
          });
        });
      }
    }
  };

  searchInput.addEventListener('input', () => {
    searchVal = searchInput.value.trim().toLowerCase();
    renderContent();
  });

  renderContent();
}
