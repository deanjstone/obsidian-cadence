import { MarkdownRenderer, Notice, Platform, TFile, setIcon, type Component } from 'obsidian';
import { ENTITIES } from '../../constants/entities';
import type { Entity, EntityKey, Frontmatter } from '../../types/entities';
import { entityValue, listEntities, readProjectMeta } from '../../utils/entities';
import { fmtValue, pctBand } from '../../utils/format';
import { parseHeaderKey, parseLinkValues, parseMilestones, parseTasksList } from '../../utils/parsing';
import type { AppViewHost } from '../host';
import { sectionChartData } from './charts';

/* The detail-form sections shared by the entity, company and project
   detail forms, the templates and Today: markdown text cards, cross
   sections (settings-driven and #cross- headings), #chart- headings and
   the H2 dispatcher that picks between them. */

/** Called by a detail form after it writes the note. */
export type FlashSaved = () => void;

/** A fixed text section of the project detail form. */
export interface ProjectTextSectionDef {
  key: string;
  label: string;
  /** Passed by the project page's standard sections; the card doesn't read it. */
  rows?: number;
  placeholder?: string;
}

/* True when a frontmatter link value names `name`: a single value or a
   list, compared without wiki-link brackets, surrounding spaces or case.
   A comma-separated string is one value, so it matches only as a whole. */
export function linksTo(val: unknown, name: string): boolean {
  if (val == null) return false;
  const cleanName = name.trim().toLowerCase();
  const arr = Array.isArray(val) ? val : [val];
  return arr.some(v => String(v).replace(/^\[\[|\]\]$/g, '').trim().toLowerCase() === cleanName);
}

/* A cross section's targets: the entities whose linkField names the
   parent, in the given order. */
export function crossSectionRows(
  entities: Entity[], linkField: string, parentName: string, frontmatterOf: (entity: Entity) => Frontmatter,
): Entity[] {
  return entities.filter(e => linksTo(frontmatterOf(e)[linkField], parentName));
}

/* Reads an entity's frontmatter fresh from the metadata cache, as each
   cross-section filter did inline. */
function frontmatterReader(view: AppViewHost): (entity: Entity) => Frontmatter {
  return (e) => {
    const cache = view.app.metadataCache.getFileCache(e.file);
    return (cache && cache.frontmatter || {}) as Frontmatter;
  };
}

/** Which renderer an H2 section gets, from its heading. */
export type DynamicH2Kind =
  | { kind: 'tasks' | 'milestones' | 'text'; cleanLabel: string }
  /** A #cross- or #chart- tag with the wrong number of parts: renders nothing. */
  | { kind: 'malformed'; cleanLabel: string }
  | { kind: 'cross'; cleanLabel: string; targetEntity: string; linkField: string; viewType: string }
  | { kind: 'chart'; cleanLabel: string; targetEntity: string; linkField: string; groupField: string; chartStyle: string };

/* Classify an H2 heading key (`Label #tag`). A #tasks/#milestones tag or
   label wins first. `#cross-{entity}-{linkField}-{view}` needs exactly
   three parts. `#chart-{entity}-{linkField}-{groupField}-{style}` needs at
   least four, and the style keeps any further dashes. Every other heading
   is a text section. */
export function dynamicH2Kind(rawKey: string): DynamicH2Kind {
  const { cleanLabel, tag } = parseHeaderKey(rawKey);
  const cleanLower = cleanLabel.toLowerCase();
  if (tag === '#tasks' || cleanLower === 'tasks') return { kind: 'tasks', cleanLabel };
  if (tag === '#milestones' || cleanLower === 'milestones') return { kind: 'milestones', cleanLabel };
  if (tag.startsWith('#cross-')) {
    const crossParts = tag.slice('#cross-'.length).split('-');
    if (crossParts.length !== 3) return { kind: 'malformed', cleanLabel };
    const [targetEntity, linkField, viewType] = crossParts;
    return { kind: 'cross', cleanLabel, targetEntity, linkField, viewType };
  }
  if (tag.startsWith('#chart-')) {
    const chartParts = tag.slice('#chart-'.length).split('-');
    if (chartParts.length < 4) return { kind: 'malformed', cleanLabel };
    return {
      kind: 'chart', cleanLabel,
      targetEntity: chartParts[0], linkField: chartParts[1], groupField: chartParts[2], chartStyle: chartParts.slice(3).join('-'),
    };
  }
  return { kind: 'text', cleanLabel };
}

export function renderMarkdownTextCard(view: AppViewHost, parent: HTMLElement, file: TFile, sectionKey: string, label: string, initialValue: string | undefined, placeholder?: string, flashSaved?: FlashSaved): void {
  const card = parent.createDiv({ cls: 'cad-pd-card' });
  const head = card.createDiv({ cls: 'cad-pd-card-head' });
  head.createDiv({ cls: 'cad-pd-card-title', text: label });

  const openBtn = head.createEl('button', { cls: 'cad-btn cad-btn-sm', attr: { style: 'margin-left: auto; padding: 4px 6px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; border: 1px solid var(--border-color); background: transparent; cursor: pointer;' } });
  openBtn.title = 'Open this note natively to edit with full Live Preview & Autocomplete';
  try { setIcon(openBtn, 'file-text'); } catch (_) { }
  openBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    view.app.workspace.openLinkText(file.path, '', 'split');
  });

  const body = card.createDiv({ attr: { style: 'padding: 12px; min-height: 40px; position: relative;' } });

  // Preview container
  const previewDiv = body.createDiv({ cls: 'markdown-preview-view', attr: { style: 'padding: 0; min-height: 30px;' } });

  // Render the initial markdown preview
  const renderPreview = () => {
    previewDiv.empty();
    const rawText = initialValue || '';
    try {
      MarkdownRenderer.renderMarkdown(rawText, previewDiv, file.path, view as unknown as Component);

      // Find all standard Obsidian [[...]] internal links and bind open handlers!
      previewDiv.querySelectorAll('a.internal-link').forEach(a => {
        const href = a.getAttribute('data-href') || a.getAttribute('href');
        if (href) {
          a.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            view.app.workspace.openLinkText(href, file.path, false);
          });
        }
      });
    } catch (e) {
      previewDiv.setText(rawText);
    }
    // Add subtle placeholder if empty
    if (!rawText.trim()) {
      const ph = previewDiv.createDiv({ text: placeholder || 'Empty section.', attr: { style: 'color: var(--text-faint); font-style: italic; font-size: 0.9em; padding: 4px 0;' } });
    }
  };
  renderPreview();
}

export function renderProjectTextSection(view: AppViewHost, parent: HTMLElement, file: TFile, sections: Record<string, string>, def: ProjectTextSectionDef, flashSaved?: FlashSaved): void {
  const initial = (sections[def.key] || '').replace(/^\s+|\s+$/g, '');
  view._renderMarkdownTextCard(parent, file, def.key, def.label, initial, def.placeholder, flashSaved);
}

export function renderGenericTextSection(view: AppViewHost, parent: HTMLElement, file: TFile, sections: Record<string, string>, key: string, flashSaved?: FlashSaved): void {
  const { cleanLabel } = parseHeaderKey(key);
  const initial = (sections[key] || '').replace(/^\s+|\s+$/g, '');
  view._renderMarkdownTextCard(parent, file, key, cleanLabel.toUpperCase(), initial, `Content for ${cleanLabel}...`, flashSaved);
}

export function renderSingleCrossSection(view: AppViewHost, parent: HTMLElement, targetEntity: EntityKey, linkField: string, viewType: string, parentName: string, preFilteredList: Entity[] | null = null): void {
  const def = ENTITIES[targetEntity];
  if (!def) return;

  const filteredList = preFilteredList || crossSectionRows(listEntities(view.app, targetEntity), linkField, parentName, frontmatterReader(view));

  const secWrap = parent.createDiv({ attr: { style: 'margin-top: 12px; margin-bottom: 12px;' } });

  if (filteredList.length === 0) {
    secWrap.createDiv({ cls: 'cad-empty', text: 'No linked items found.' });
    return;
  }

  if (viewType === 'table') {
    const columns = def.columns || [def.fields[0].key];
    view._renderEntityTable(secWrap, targetEntity, filteredList, columns);
  } else if (viewType === 'tile') {
    const grid = secWrap.createDiv({ cls: 'cad-proj-grid' });
    filteredList.forEach(e => {
      if (targetEntity === 'project') {
        // If it's a project, read its milestones progress and render the beautiful project progress card!
        const card = grid.createDiv({ cls: 'cad-proj-card' });
        const head = card.createDiv({ cls: 'cad-proj-card-head' });
        const title = head.createEl('a', { cls: 'cad-proj-title', text: (entityValue(e, 'name', def) || e.basename) as string });
        title.addEventListener('click', (ev) => { ev.preventDefault(); view.openEntityDetail('project', e.file); });

        const status = String(entityValue(e, 'status', def) || 'active');
        const priority = String(entityValue(e, 'priority', def) || '');
        const pillRow = head.createDiv({ cls: 'cad-proj-pills' });
        pillRow.createSpan({ cls: `cad-pill cad-pill-${status.toLowerCase().replace(/\s+/g, '-')}`, text: status });
        if (priority) pillRow.createSpan({ cls: `cad-pill cad-pill-prio-${priority.toLowerCase()}`, text: priority });

        const metaRow = card.createDiv({ cls: 'cad-proj-meta' });
        const owner = entityValue(e, 'owner', def);
        const due = entityValue(e, 'due', def);
        if (owner) view._renderOwnerLinks(metaRow, owner);
        if (due) metaRow.createSpan({ text: `Due: ${fmtValue(due, 'date')}` });

        const progWrap = card.createDiv({ cls: 'cad-proj-progress-wrap' });
        const progLabel = progWrap.createDiv({ cls: 'cad-proj-progress-label' });
        const progTextSpan = progLabel.createSpan({ text: 'Loading milestones...' });
        const progPctSpan = progLabel.createSpan({ cls: 'cad-proj-progress-pct', text: '' });

        const bar = progWrap.createDiv({ cls: 'cad-proj-progress-bar' });
        const fill = bar.createDiv({ cls: 'cad-proj-progress-fill' });
        fill.style.width = '0%';

        const nextRow = card.createDiv({ cls: 'cad-proj-next' });

        // Load metadata asynchronously to keep render synchronous
        readProjectMeta(view.app, e.file).then(pm => {
          progWrap.dataset.pctBand = pctBand(pm.percent);
          progTextSpan.setText(`${pm.done}/${pm.total} milestones`);
          progPctSpan.setText(`${pm.percent}%`);
          fill.style.width = `${pm.percent}%`;

          if (pm.next) {
            nextRow.createSpan({ cls: 'cad-proj-next-label', text: 'NEXT · ' });
            nextRow.createSpan({ cls: 'cad-proj-next-date', text: fmtValue(pm.next.date, 'date') });
            if (pm.next.title) nextRow.createSpan({ text: ` — ${pm.next.title}` });
          }
        });
      } else {
        // Beautiful general cards for contacts, companies, partners, deals, etc.
        const card = grid.createDiv({ cls: 'cad-proj-card' });
        const head = card.createDiv({ cls: 'cad-proj-card-head' });

        const primaryField = def.fields.find(f => f.primary) || def.fields[0];
        const titleText = (entityValue(e, primaryField.key, def) || e.basename) as string;
        const title = head.createEl('a', { cls: 'cad-proj-title', text: titleText });
        title.addEventListener('click', (ev) => { ev.preventDefault(); view.openEntityDetail(targetEntity, e.file); });

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
              count++;
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
                fieldDiv.createSpan({ text: fmtValue(val, f.type) });
              }
            }
          }
        });
      }
    });
  } else if (viewType === 'kanban') {
    const board = secWrap.createDiv({ cls: 'cad-kanban-board' });
    const groupField = def.fields.find(f => f.key === 'stage' || f.key === 'status' || f.key === 'type' || f.type === 'enum') || def.fields[1];
    const columns = groupField.options || ['To Do', 'In Progress', 'Done'];

    const isMobile = !!(Platform && Platform.isMobile);

    columns.forEach(colName => {
      const items = filteredList.filter(e => {
        const val = entityValue(e, groupField.key, def);
        const cleanVal = Array.isArray(val) ? val[0] : val;
        return String(cleanVal || '').toLowerCase() === colName.toLowerCase();
      });

      // Sum values if any (e.g. deals/projects value)
      const hasValField = def.fields.find(f => f.key === 'value' || f.key === 'amount');
      const colValueSum = hasValField ? items.reduce((s, e) => s + (Number(entityValue(e, hasValField.key, def)) || 0), 0) : 0;

      const col = board.createDiv({ cls: 'cad-kanban-col' });
      col.dataset.stage = colName;

      const colHead = col.createDiv({ cls: 'cad-kanban-col-head' });
      colHead.createDiv({ cls: 'cad-kanban-col-title', text: colName.toUpperCase() });
      colHead.createDiv({
        cls: 'cad-kanban-col-meta',
        text: hasValField ? `${items.length} · ${fmtValue(colValueSum, 'currency')}` : `${items.length}`
      });

      const list = col.createDiv({ cls: 'cad-kanban-col-list' });

      // Drag-and-drop event listeners
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
        if (!path || fromStage === colName) return;
        const file = view.app.vault.getAbstractFileByPath(path);
        if (!file || !(file instanceof TFile)) return;
        try {
          await view.app.fileManager.processFrontMatter(file, (fm) => {
            const isList = groupField.type === 'multitext' || groupField.type === 'tags' || groupField.isList === true;
            const isLink = groupField.suggestionSource && groupField.suggestionSource !== 'none' && groupField.suggestionSource !== 'tags' && groupField.suggestionSource !== 'history';
            if (isList) {
              fm[groupField.key] = isLink ? [`[[${colName}]]`] : [colName];
            } else {
              fm[groupField.key] = isLink ? `[[${colName}]]` : colName;
            }
          });
          new Notice(`Moved to ${colName}`);
          view.render();
        } catch (e) {
          new Notice(`Failed to move: ${(e as Error).message}`);
        }
      });

      if (!items.length) {
        list.createDiv({ cls: 'cad-empty', text: '—' });
      } else {
        items.forEach(e => {
          const card = list.createDiv({ cls: 'cad-kanban-card' });
          card.dataset.path = e.file.path;

          const primaryField = def.fields.find(f => f.primary) || def.fields[0];
          card.createDiv({ cls: 'cad-kanban-card-title', text: (entityValue(e, primaryField.key, def) || e.basename) as string });

          const meta = card.createDiv({ cls: 'cad-kanban-card-meta' });
          if (hasValField) {
            const v = entityValue(e, hasValField.key, def);
            if (v) meta.createSpan({ cls: 'cad-kanban-card-value', text: fmtValue(v, 'currency') });
          }

          // Relationship links inside kanban card
          const relFields = ['company', 'contact', 'owner', 'assigned'];
          relFields.forEach(rf => {
            if (rf === groupField.key) return; // avoid redundancy
            const rfDef = def.fields.find(f => f.key === rf);
            if (rfDef) {
              const vals = parseLinkValues(entityValue(e, rf, def));
              vals.forEach(v => {
                if (meta.children.length > 0) meta.createSpan({ text: ' · ' });
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
                ev.dataTransfer!.setData('text/cadence-stage', colName);
                ev.dataTransfer!.setData('text/plain', `[[${e.file.basename}]]`);
              } catch (_) { }
            });
            card.addEventListener('dragend', () => card.removeClass('dragging'));
          } else {
            card.addClass('cad-kanban-card-touch');
          }
          card.addEventListener('click', () => view.openEntityDetail(targetEntity, e.file));
        });
      }
    });
  }
}

export function renderCrossSections(view: AppViewHost, parent: HTMLElement, parentEntity: EntityKey, parentName: string): void {
  const crossSections = view.plugin.settings.crossSections || [];
  const configs = crossSections.filter(c => c.parentEntity === parentEntity);
  if (configs.length === 0) return;

  configs.forEach(config => {
    const def = ENTITIES[config.targetEntity];
    if (!def) return;

    const filteredList = crossSectionRows(listEntities(view.app, config.targetEntity), config.linkField, parentName, frontmatterReader(view));

    const secWrap = parent.createDiv({ attr: { style: 'margin-top: 24px; margin-bottom: 24px;' } });

    const head = secWrap.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;' } });
    head.createEl('h3', {
      text: `${def.plural.toUpperCase()} (${config.linkField.toUpperCase()}) — ${config.viewType.toUpperCase()}`,
      attr: { style: 'margin: 0; font-size: 1.1em; font-weight: 700; letter-spacing: 0.05em;' }
});

    const delBtn = head.createEl('button', { text: '×', attr: { style: 'color: var(--text-error); border: 1px solid var(--text-error); padding: 2px 8px; font-weight: bold; border-radius: 4px; background: transparent; cursor: pointer;' } });
    delBtn.title = 'Supprimer cette section croisée';
    delBtn.addEventListener('click', async () => {
      if (!confirm('Supprimer cette section croisée ?')) return;
      view.plugin.settings.crossSections = (view.plugin.settings.crossSections || []).filter(c => c.id !== config.id);
      await view.plugin.saveSettings();
      view.render();
    });

    if (filteredList.length === 0) {
      secWrap.createDiv({ cls: 'cad-empty', text: 'Aucun élément lié trouvé.' });
      return;
    }

    if (config.viewType === 'table') {
      const columns = def.columns || [def.fields[0].key];
      view._renderEntityTable(secWrap, config.targetEntity, filteredList, columns);
    } else if (config.viewType === 'tile') {
      const grid = secWrap.createDiv({ attr: { style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 12px;' } });
      filteredList.forEach(e => {
        const card = grid.createDiv({ cls: 'cad-proj-card', attr: { style: 'cursor: pointer; padding: 16px; background: var(--background-secondary); border: 1px solid var(--border-color); border-radius: 6px;' } });
        const title = card.createEl('h4', { text: (entityValue(e, def.fields[0].key, def) || e.basename) as string, attr: { style: 'margin: 0 0 8px 0; font-weight: 600;' } });
        card.addEventListener('click', () => view.openEntityDetail(config.targetEntity, e.file));

        const meta = card.createDiv({ attr: { style: 'font-size: 0.85em; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px;' } });
        def.fields.slice(1, 4).forEach(f => {
          const val = entityValue(e, f.key, def);
          if (val != null && val !== '') {
            meta.createDiv({ text: `${f.label}: ${fmtValue(val, f.type)}` });
          }
        });
      });
    } else if (config.viewType === 'kanban') {
      const kanbanWrap = secWrap.createDiv({ attr: { style: 'display: flex; gap: 16px; overflow-x: auto; padding-bottom: 8px; margin-top: 12px;' } });
      const groupField = def.fields.find(f => f.key === 'stage' || f.key === 'status' || f.key === 'type' || f.type === 'enum') || def.fields[1];
      const columns = groupField.options || ['To Do', 'In Progress', 'Done'];

      columns.forEach(colName => {
        const col = kanbanWrap.createDiv({ cls: 'cad-stat-card', attr: { style: 'flex: 0 0 280px; padding: 12px; display: flex; flex-direction: column; min-height: 250px; background: var(--background-secondary); border: 1px solid var(--border-color); border-radius: 6px;' } });
        col.createDiv({ text: colName.toUpperCase(), attr: { style: 'font-weight: 700; font-size: 0.8em; letter-spacing: 0.08em; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;' } });

        const colItems = filteredList.filter(e => {
          const val = entityValue(e, groupField.key, def);
          const cleanVal = Array.isArray(val) ? val[0] : val;
          return String(cleanVal || '').toLowerCase() === colName.toLowerCase();
        });

        if (colItems.length === 0) {
          col.createDiv({ text: 'Aucun élément', attr: { style: 'color: var(--text-faint); text-align: center; margin-top: 24px; font-size: 0.85em;' } });
        } else {
          const itemsList = col.createDiv({ attr: { style: 'display: flex; flex-direction: column; gap: 8px;' } });
          colItems.forEach(e => {
            const itemCard = itemsList.createDiv({ cls: 'cad-dash-row', attr: { style: 'padding: 8px 10px; cursor: pointer; border-radius: 4px; background: var(--background-primary); border: 1px solid var(--border-color); font-weight: 500;' } });
            itemCard.setText((entityValue(e, def.fields[0].key, def) || e.basename) as string);
            itemCard.addEventListener('click', () => view.openEntityDetail(config.targetEntity, e.file));
          });
        }
      });
    }
  });
}

export function renderDynamicH2Section(view: AppViewHost, parent: HTMLElement, file: TFile, sections: Record<string, string>, rawKey: string, flashSaved?: FlashSaved): void {
  const h2 = dynamicH2Kind(rawKey);
  const { cleanLabel } = h2;

  if (h2.kind === 'tasks') {
    const taskList = parseTasksList(sections[rawKey] || '');
    view._renderTaskSection(parent, file, taskList, flashSaved, rawKey);
  } else if (h2.kind === 'milestones') {
    const milestoneList = parseMilestones(sections[rawKey] || '');
    view._renderMilestoneSection(parent, file, milestoneList, flashSaved, rawKey);
  } else if (h2.kind === 'cross') {
    const { targetEntity, linkField, viewType } = h2;
    const def = ENTITIES[targetEntity];
    if (def) {
      const parentName = file.basename;
      const filteredList = crossSectionRows(listEntities(view.app, targetEntity), linkField, parentName, frontmatterReader(view));

      const card = parent.createDiv({ cls: 'cad-pd-card' });
      card.style.gridColumn = '1 / -1';
      const head = card.createDiv({ cls: 'cad-pd-card-head' });
      head.createDiv({ cls: 'cad-pd-card-title', text: `${cleanLabel.toUpperCase()} · ${filteredList.length}` });

      const addBtn = head.createEl('button', { cls: 'cad-btn cad-btn-sm', text: `+ Add ${def.label}` });
      addBtn.addEventListener('click', () => {
        view._createEntityFromPrompt(targetEntity, { [linkField]: `[[${parentName}]]` });
      });

      // View switcher: table / kanban / tile — saved back to the entity note
      const viewSwitch = head.createDiv({ attr: { style: 'display: flex; gap: 3px; margin-left: 8px;' } });
      const viewOptions = [
        { v: 'table', icon: 'layout-list', title: 'Table View' },
        { v: 'kanban', icon: 'kanban', title: 'Kanban Board' },
        { v: 'tile', icon: 'layout-grid', title: 'Tile Grid' }
      ];
      viewOptions.forEach(({ v, icon, title }) => {
        const vBtn = viewSwitch.createEl('button', {attr: { style: `padding: 4px 6px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; cursor: pointer; border: 1px solid var(--border-color); background: ${v === viewType ? 'var(--interactive-accent)' : 'transparent'}; color: ${v === viewType ? 'var(--text-on-accent)' : 'var(--text-muted)'};` }});
        vBtn.title = title;
        try { setIcon(vBtn, icon); } catch (_) { }

        if (v !== viewType) {
          vBtn.addEventListener('click', async () => {
            const newTag = `#cross-${targetEntity}-${linkField}-${v}`;
            const curContent = await view.app.vault.read(file);
            const escaped = rawKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const newContent = curContent.replace(
              new RegExp(`^(## ${escaped})$`, 'm'),
              `## ${cleanLabel} ${newTag}`
            );
            await view.app.vault.modify(file, newContent);
            view.render();
          });
        }
      });

      const body = card.createDiv({ attr: { style: 'padding: 12px;' } });
      view._renderSingleCrossSection(body, targetEntity, linkField, viewType, parentName, filteredList);
    }
  } else if (h2.kind === 'chart') {
    const { targetEntity, linkField, groupField, chartStyle } = h2;
    const def = ENTITIES[targetEntity];
    if (def) {
      const parentName = file.basename;
      const filteredList = crossSectionRows(listEntities(view.app, targetEntity), linkField, parentName, frontmatterReader(view));

      const chartData = sectionChartData(filteredList, groupField, frontmatterReader(view));

      const card = parent.createDiv({ cls: 'cad-pd-card' });
      card.style.gridColumn = '1 / -1';
      const head = card.createDiv({ cls: 'cad-pd-card-head' });
      head.createDiv({ cls: 'cad-pd-card-title', text: `${cleanLabel.toUpperCase()} · ${filteredList.length} ${def.plural}` });

      // Chart style switcher — saved back to the entity note
      const styleSwitch = head.createDiv({ attr: { style: 'display: flex; gap: 3px; margin-left: 8px;' } });
      [{ v: 'donut', icon: '🍩' }, { v: 'bar', icon: '📊' }, { v: 'kpi', icon: '🗃️' }, { v: 'list', icon: '📋' }].forEach(({ v, icon }) => {
        const sBtn = styleSwitch.createEl('button', {
          text: icon,
          attr: { style: `padding: 1px 5px; font-size: 0.85em; border-radius: 3px; cursor: pointer; border: 1px solid var(--border-color); background: ${v === chartStyle ? 'var(--interactive-accent)' : 'transparent'}; opacity: ${v === chartStyle ? '1' : '0.55'};` }
});
        sBtn.title = v;
        if (v !== chartStyle) {
          sBtn.addEventListener('click', async () => {
            const newTag = `#chart-${targetEntity}-${linkField}-${groupField}-${v}`;
            const curContent = await view.app.vault.read(file);
            const escaped = rawKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const newContent = curContent.replace(
              new RegExp(`^(## ${escaped})$`, 'm'),
              `## ${cleanLabel} ${newTag}`
            );
            await view.app.vault.modify(file, newContent);
            view.render();
          });
        }
      });

      const body = card.createDiv({ cls: 'cad-dash-card-body', attr: { style: 'flex: 1; min-height: 180px; display: flex; flex-direction: column; justify-content: center; padding: 14px;' } });
      view._drawChart(body.createDiv(), chartStyle, chartData);
    }
  } else if (h2.kind === 'text') {
    view._renderGenericTextSection(parent, file, sections, rawKey, flashSaved);
  }
}
