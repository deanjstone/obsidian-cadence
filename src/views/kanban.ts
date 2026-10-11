import { Notice, Platform, TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceImportModal } from '../modals/import-modal';
import { entityValue, getFieldSuggestionSource, listEntities } from '../utils/entities';
import { fmtValue } from '../utils/format';
import { parseLinkValues } from '../utils/parsing';
import type { Entity, EntityDef, EntityField } from '../types/entities';
import type { AppViewHost } from './host';

/** Which field groups a kanban board, and its columns in order. */
export interface KanbanParams {
  groupBy: string;
  groups: string[];
}

/** A `[[Link]]` value with its brackets and outer whitespace removed, even
    when the whitespace is outside the brackets (#57). */
export function unwrapLink(value: unknown): string {
  return String(value).trim().replace(/^\[\[|\]\]$/g, '').trim();
}

/** True for a field whose values link to notes: a relation key (owner,
    company, partner, …) or a link suggestion source. */
function isRelationField(f: EntityField): boolean {
  return !['none', 'tags', 'history'].includes(getFieldSuggestionSource(f));
}

/** The group-by field, always one the selector offers (#57): the saved one,
    else `stage` for deals, else the first enum or text field, else the first
    offered field, else '' (nothing to group by). A saved key the selector
    doesn't offer is ignored, not removed. */
export function kanbanGroupBy(entityKey: string, def: EntityDef, saved: string | undefined): string {
  const offered = kanbanGroupByFields(def);
  if (saved && offered.some(f => f.key === saved)) return saved;
  if (entityKey === 'deal' && offered.some(f => f.key === 'stage')) return 'stage';
  const typed = offered.find(f => f.type === 'enum' || f.type === 'text');
  return (typed || offered[0])?.key ?? '';
}

/** The group-by field's options, or [] when it has none or doesn't exist. */
export function kanbanOptions(def: EntityDef, groupBy: string): string[] {
  const f = def.fields.find(field => field.key === groupBy);
  return f ? (f.options || []) : [];
}

/** Columns for a field without options: its distinct values in first-seen
    order (arrays flattened, strings comma-split, links unwrapped), or none. */
export function distinctGroups(entities: Entity[], groupBy: string, def: EntityDef): string[] {
  const uniqueVals = new Set<string>();
  entities.forEach(e => {
    const val = entityValue(e, groupBy, def);
    if (val) {
      const parts = Array.isArray(val) ? val : String(val).split(',');
      parts.forEach(v => {
        const clean = unwrapLink(v);
        if (clean) uniqueVals.add(clean);
      });
    }
  });
  return Array.from(uniqueVals);
}

export function getEntityKanbanParams(view: AppViewHost, entityKey: string): KanbanParams {
  const def = ENTITIES[entityKey];
  if (!def) return { groupBy: 'status', groups: ['Active', 'Done'] };

  const groupBy = kanbanGroupBy(entityKey, def, view.plugin.settings.pageKanbanGroupBy?.[entityKey]);
  let groups = kanbanOptions(def, groupBy);
  // The vault is only read when there is a field and it has no options.
  if (groupBy && !groups.length) groups = distinctGroups(listEntities(view.app, entityKey), groupBy, def);
  return { groupBy, groups };
}

/** The fields the list's group-by selector offers: non-primary enum, text,
    multitext and tags fields, and relation fields of any type. Other fields
    with no type are left out. */
export function kanbanGroupByFields(def: EntityDef): EntityField[] {
  return def.fields.filter(field => !field.primary && (['enum', 'text', 'multitext', 'tags'].includes(field.type as string) || isRelationField(field)));
}

/** True when an entity's group-by value matches a column: case-insensitive,
    links unwrapped, any item of an array. */
export function inKanbanGroup(val: unknown, stage: string): boolean {
  if (Array.isArray(val)) {
    const cleanVals = val.map(v => unwrapLink(v).toLowerCase());
    return cleanVals.includes(stage.toLowerCase());
  }
  return unwrapLink(val || '').toLowerCase() === stage.toLowerCase();
}

export interface KanbanColumn {
  stage: string;
  items: Entity[];
  /** The `(no <field>)` column: entities with no value. It takes no drop. */
  blank?: boolean;
}

/** An entity's group-by values: each item of an array, or the one value,
    links unwrapped, blanks dropped. */
export function kanbanValues(val: unknown): string[] {
  if (val == null || val === '') return [];
  return (Array.isArray(val) ? val : [val]).map(unwrapLink).filter(Boolean);
}

/** One column per group, in order, then a column per value off the groups
    (first-seen spelling, matched in any case), then `(no <field>)` when an
    entity has no value. Each entity sits in exactly one column: that of its
    first value on a group, else its first value (#57). */
export function kanbanGroups(list: Entity[], groupBy: string, groups: string[], def: EntityDef): KanbanColumn[] {
  const columns: KanbanColumn[] = groups.map((stage) => ({ stage, items: [] }));
  const byValue = new Map<string, KanbanColumn>();
  columns.forEach((c) => { if (!byValue.has(c.stage.toLowerCase())) byValue.set(c.stage.toLowerCase(), c); });
  const field = def.fields.find((f) => f.key === groupBy);
  const blank: KanbanColumn = { stage: `(no ${(field ? field.label : groupBy || 'group').toLowerCase()})`, items: [], blank: true };

  list.forEach((e) => {
    const values = groupBy ? kanbanValues(entityValue(e, groupBy, def)) : [];
    if (!values.length) { blank.items.push(e); return; }
    const value = values.find((v) => byValue.has(v.toLowerCase())) ?? values[0];
    let col = byValue.get(value.toLowerCase());
    if (!col) {
      col = { stage: value, items: [] };
      columns.push(col);
      byValue.set(value.toLowerCase(), col);
    }
    col.items.push(e);
  });
  return blank.items.length ? [...columns, blank] : columns;
}

/** The first currency or number field: summed in column heads, shown on cards. */
export function kanbanValueField(def: EntityDef): EntityField | undefined {
  return def.fields.find(f => f.type === 'currency' || f.type === 'number');
}

/** A column head's meta line: `count · total` with a value field, else the count. */
export function kanbanColumnMeta(items: Entity[], def: EntityDef): string {
  const valueField = kanbanValueField(def);
  if (valueField) {
    const sum = items.reduce((s, e) => s + (Number(entityValue(e, valueField.key, def)) || 0), 0);
    return `${items.length} · ${fmtValue(sum, valueField.type)}`;
  }
  return `${items.length}`;
}

/** What a drop writes to the group-by field: a list for multitext, tags and
    isList fields and for `stage` (a one-item list, as the detail form and the
    template write it, #50), a `[[link]]` for a relation field (a link
    suggestion source or a relation key such as owner or company). */
export function kanbanDropValue(fDef: EntityField | undefined, stage: string): string | string[] {
  const isList = fDef && (fDef.type === 'multitext' || fDef.type === 'tags' || fDef.isList === true || fDef.key === 'stage');
  const isLink = fDef && isRelationField(fDef);
  if (isList) {
    return isLink ? [`[[${stage}]]`] : [stage];
  }
  return isLink ? `[[${stage}]]` : stage;
}

export interface KanbanCardLink {
  display: string;
  target: string;
  /** The detail form a matching note opens in: owner and assigned are contacts. */
  entityKey: string;
}

/** A card's relation links, from its company, contact, owner and assigned
    fields, in that order. Fields the entity doesn't define are skipped. */
export function kanbanCardLinks(e: Entity, def: EntityDef): KanbanCardLink[] {
  const relFields = ['company', 'contact', 'owner', 'assigned'];
  return relFields.flatMap(rf => {
    const rfDef = def.fields.find(f => f.key === rf);
    if (!rfDef) return [];
    return parseLinkValues(entityValue(e, rf, def)).map(v => ({
      display: v.display, target: v.target, entityKey: rf === 'owner' || rf === 'assigned' ? 'contact' : rf,
    }));
  });
}

/* The older pipeline board. Flagged: nothing calls it (the list's kanban
   layout replaced it); it is characterized and kept, not deleted. */
export async function renderEntityKanban(
  view: AppViewHost, root: HTMLElement, entityKey: string, groupBy: string, groups: string[],
): Promise<void> {
  root.addClass('cadence-kanban');
  const def = ENTITIES[entityKey];
  const entities = listEntities(view.app, entityKey);
  const totalValue = entities.reduce((sum, e) => sum + (Number(entityValue(e, 'value', def)) || 0), 0);

  view._renderPageHeader(root, def.plural, `${entities.length} ${entities.length === 1 ? def.label.toLowerCase() : def.plural.toLowerCase()} · ${fmtValue(totalValue, 'currency')} total`, (right) => {
    const importBtn = right.createEl('button', { cls: 'cad-btn', text: 'Import CSV' });
    importBtn.addEventListener('click', () => new CadenceImportModal(view.app, { entityKey }).open());
    const btn = right.createEl('button', { cls: 'cad-btn primary', text: `+ New ${def.label}` });
    btn.addEventListener('click', () => view._createEntityFromPrompt(entityKey));
  });

  const board = root.createDiv({ cls: 'cad-kanban-board' });
  groups.forEach((stage) => {
    const items = entities.filter((e) => String(entityValue(e, groupBy, def) || '') === stage);
    const stageValue = items.reduce((s, e) => s + (Number(entityValue(e, 'value', def)) || 0), 0);

    const col = board.createDiv({ cls: 'cad-kanban-col' });
    col.dataset.stage = stage;
    const head = col.createDiv({ cls: 'cad-kanban-col-head' });
    head.createDiv({ cls: 'cad-kanban-col-title', text: stage });
    head.createDiv({ cls: 'cad-kanban-col-meta', text: `${items.length} · ${fmtValue(stageValue, 'currency')}` });

    const list = col.createDiv({ cls: 'cad-kanban-col-list' });

    // Drop target: drop a card here to update its `groupBy` field to this stage.
    list.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      try { ev.dataTransfer!.dropEffect = 'move'; } catch (_) { }
      col.addClass('drag-over');
    });
    list.addEventListener('dragleave', (ev) => {
      // Only clear when leaving the column entirely
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
        await view.app.fileManager.processFrontMatter(file, (fm) => { fm[groupBy] = (groupBy === 'stage') ? [stage] : stage; });
        new Notice(`Moved to ${stage}`);
        // The metadataCache.changed listener re-renders for us.
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
        card.createDiv({ cls: 'cad-kanban-card-title', text: (entityValue(e, 'title', def) || e.basename) as string });
        const meta = card.createDiv({ cls: 'cad-kanban-card-meta' });
        const v = entityValue(e, 'value', def);
        if (v) meta.createSpan({ cls: 'cad-kanban-card-value', text: fmtValue(v, 'currency') });

        const coValues = parseLinkValues(entityValue(e, 'company', def));
        if (coValues.length > 0) {
          meta.createSpan({ text: ' · ' });
          coValues.forEach((item, idx) => {
            if (idx > 0) {
              meta.createSpan({ text: ', ' });
            }
            const coLink = meta.createEl('a', { cls: 'cad-company-link', text: item.display });
            coLink.style.textDecoration = 'underline';
            coLink.style.cursor = 'pointer';
            coLink.addEventListener('click', (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const targetFile = view.app.vault.getMarkdownFiles().find(f => f.basename.toLowerCase() === item.target.toLowerCase());
              if (targetFile) view.openEntityDetail('company', targetFile);
              else view.app.workspace.openLinkText(item.target, '', false);
            });
          });
        }

        const contactValues = parseLinkValues(entityValue(e, 'contact', def));
        if (contactValues.length > 0) {
          meta.createSpan({ text: ' · ' });
          contactValues.forEach((item, idx) => {
            if (idx > 0) {
              meta.createSpan({ text: ', ' });
            }
            const ctLink = meta.createEl('a', { cls: 'cad-contact-link', text: item.display });
            ctLink.style.textDecoration = 'underline';
            ctLink.style.cursor = 'pointer';
            ctLink.addEventListener('click', (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const targetFile = view.app.vault.getMarkdownFiles().find(f => f.basename.toLowerCase() === item.target.toLowerCase());
              if (targetFile) view.openEntityDetail('contact', targetFile);
              else view.app.workspace.openLinkText(item.target, '', false);
            });
          });
        }

        /* Drag-to-move is a desktop-only affordance. On mobile, HTML5 drag
           doesn't reliably fire from touch and the `draggable` attribute
           can interfere with native scrolling. Mobile users instead tap
           the card to open detail, then change the stage from there. */
        if (!isMobile) {
          card.draggable = true;
          card.addEventListener('dragstart', (ev) => {
            card.addClass('dragging');
            try {
              ev.dataTransfer!.effectAllowed = 'move';
              ev.dataTransfer!.setData('text/cadence-entity', e.file.path);
              ev.dataTransfer!.setData('text/cadence-stage', stage);
              // Plain text payload too, so dropping into editors yields a link
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
}
