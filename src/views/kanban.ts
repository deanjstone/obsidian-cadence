import { Notice, Platform, TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceImportModal } from '../modals/import-modal';
import { entityValue, listEntities } from '../utils/entities';
import { fmtValue } from '../utils/format';
import { parseLinkValues } from '../utils/parsing';
import type { AppViewHost } from './host';

/** Which field groups a kanban board, and its columns in order. */
export interface KanbanParams {
  groupBy: string;
  groups: string[];
}

export function getEntityKanbanParams(view: AppViewHost, entityKey: string): KanbanParams {
  const def = ENTITIES[entityKey];
  if (!def) return { groupBy: 'status', groups: ['Active', 'Done'] };

  let groupBy = view.plugin.settings.pageKanbanGroupBy?.[entityKey];

  if (!groupBy) {
    const fallbackField = def.fields.find(field => !field.primary && ['enum', 'text'].includes(field.type as string));
    groupBy = fallbackField ? fallbackField.key : 'status';
    if (entityKey === 'deal') groupBy = 'stage';
    else if (entityKey === 'activity') groupBy = 'type';
  }

  let f = def.fields.find(field => field.key === groupBy);
  let groups = f ? (f.options || []) : [];

  if (!groups.length) {
    const allFiles = listEntities(view.app, entityKey);
    const uniqueVals = new Set<string>();
    allFiles.forEach(e => {
      const val = entityValue(e, groupBy, def);
      if (val) {
        const parts = Array.isArray(val) ? val : String(val).split(',');
        parts.forEach(v => {
          const clean = String(v).replace(/^\[\[|\]\]$/g, '').trim();
          if (clean) uniqueVals.add(clean);
        });
      }
    });
    groups = Array.from(uniqueVals);
    if (!groups.length) {
      groups = ['To Do', 'In Progress', 'Done'];
    }
  }
  return { groupBy, groups };
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
