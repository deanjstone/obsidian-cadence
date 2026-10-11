import { Notice, type TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceConfirmModal } from '../modals/confirm';
import {
  COMPANY_LIST_KEYS, applyFieldEdit, coerceFieldEdit, dateInputValue, enumCurrent, metaControl, metaInputType,
  metaInputValue, splitSectionColumns,
} from '../utils/field-edit';
import { parseH2Sections } from '../utils/parsing';
import type { EntityDef, EntityField, Frontmatter } from '../types/entities';
import type { AppViewHost } from './host';

/* The meta-cell and column helpers are shared with the project page, so they
   live in src/utils/field-edit.ts; re-exported under their #15 names. */
export { metaControl as companyMetaControl, metaInputType, metaInputValue, splitSectionColumns };
export type { MetaControl } from '../utils/field-edit';

/* The saved badge keeps its hide timer on the element. */
type SavedBadge = HTMLElement & { _t?: ReturnType<typeof setTimeout> };

/** The page title: `name` unless it is missing or empty, else the basename,
    as on the generic form, so a name of 0 is kept (#50). */
export function companyDetailTitle(fm: Frontmatter, basename: string): unknown {
  return (fm.name != null && fm.name !== '') ? fm.name : basename;
}

/** The meta row's fields: every non-primary field, except a `type` field
    that is not an enum. */
export function companyMetaFields(def: EntityDef): EntityField[] {
  return def.fields.filter(f => !f.primary && !(f.key === 'type' && f.type !== 'enum'));
}

/* ── Company DETAIL view: a meta row of autosaving cells over the note's sections ── */
export async function renderCompanyDetail(view: AppViewHost, root: HTMLElement, file: TFile): Promise<void> {
  root.addClass('cadence-project-detail');
  const def = ENTITIES.company;
  const cache = view.app.metadataCache.getFileCache(file) || {};
  const fm: Frontmatter = Object.assign({}, cache.frontmatter || {});
  const titleVal = companyDetailTitle(fm, file.basename);

  /* Header */
  const head = root.createDiv({ cls: 'cad-detail-header' });
  const headLeft = head.createDiv({ cls: 'cad-detail-header-left' });
  const back = headLeft.createEl('button', { cls: 'cad-btn cad-detail-back', text: '← Companies' });
  back.addEventListener('click', () => view.closeEntityDetail());
  const breadcrumb = headLeft.createDiv({ cls: 'cad-detail-breadcrumb' });
  breadcrumb.createSpan({ cls: 'cad-eyebrow', text: 'COMPANY' });
  breadcrumb.createSpan({ cls: 'cad-detail-title', text: String(titleVal) });
  breadcrumb.createDiv({ cls: 'cad-detail-path', text: file.path });

  const headRight = head.createDiv({ cls: 'cad-detail-header-right' });
  const savedBadge: SavedBadge = headRight.createSpan({ cls: 'cad-detail-saved', text: '' });
  const flashSaved = () => {
    savedBadge.setText('Saved');
    savedBadge.addClass('show');
    clearTimeout(savedBadge._t);
    savedBadge._t = setTimeout(() => savedBadge.removeClass('show'), 1400);
  };
  /* Every meta-cell write: flashes Saved once it has landed, and notices a
     failure rather than leaving an unhandled rejection (#50). */
  const writeField = async (key: string, value: unknown) => {
    try {
      await view.app.fileManager.processFrontMatter(file, (frontmatter) => applyFieldEdit(frontmatter, key, value));
      flashSaved();
    } catch (e) {
      new Notice(`Save failed: ${(e as Error).message}`);
    }
  };
  const openNote = headRight.createEl('button', { cls: 'cad-btn', text: 'Open as note' });
  openNote.addEventListener('click', () => view.app.workspace.openLinkText(file.path, '', false));
  const deleteBtn = headRight.createEl('button', { cls: 'cad-btn cad-btn-danger', text: 'Delete' });
  deleteBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    new CadenceConfirmModal(view.app, {
      title: 'Delete Company',
      message: 'Delete this company? This moves the file to trash.',
      confirmLabel: 'Delete',
      onConfirm: () => {
        deleteBtn.blur();
        setTimeout(async () => {
          try {
            await view.app.vault.trash(file, true);
            new Notice(`Deleted company: ${file.basename}`);
            view.closeEntityDetail();
          } catch (e) {
            new Notice(`Delete failed: ${(e as Error).message}`);
          }
        }, 50);
      }
    }).open();
  });

  const hero = root.createDiv({ cls: 'cad-pd-hero' });
  const metaRow = hero.createDiv({ cls: 'cad-pd-meta' });

  const mkMeta = (f: EntityField) => {
    const label = f.label;
    const key = f.key;
    const fieldType = f.type || 'text';

    const cell = metaRow.createDiv({ cls: 'cad-pd-meta-cell' });
    cell.style.position = 'relative';
    cell.createDiv({ cls: 'cad-pd-meta-label', text: label.toUpperCase() });

    const current = fm[key];
    // Chips (multitext, tags, or has a suggestion source), else a select or an input
    const control = metaControl(f);

    if (control === 'chips') {
      view._renderChipInput(cell, f, current, {
        listKeys: COMPANY_LIST_KEYS, layout: 'meta', save: (value) => writeField(key, value),
      });
    } else if (control === 'enum') {
      const sel = cell.createEl('select', { cls: 'cad-pd-meta-input' });
      sel.style.border = 'none';
      sel.style.background = 'transparent';
      sel.style.color = 'var(--text-normal)';
      sel.style.outline = 'none';
      sel.style.width = '100%';
      sel.createEl('option', { value: '', text: '—' });
      (f.options || []).forEach((opt) => {
        const o = sel.createEl('option', { value: opt, text: opt });
        if (enumCurrent(current) === opt) o.selected = true;
      });
      const commit = async () => {
        await writeField(key, coerceFieldEdit(def, key, sel.value));
      };
      sel.addEventListener('change', commit);
    } else {
      const inp = cell.createEl('input', { type: metaInputType(fieldType), cls: 'cad-pd-meta-input' });
      if (fieldType === 'currency') inp.placeholder = `${view.plugin.settings.currency || 'USD'} amount`;

      if (fieldType === 'date' && current) {
        const date = dateInputValue(current);
        if (date !== null) inp.value = date;
      } else if (current != null) {
        inp.value = String(current);
      }

      let t: ReturnType<typeof setTimeout> | undefined;
      const commit = () => writeField(key, metaInputValue(fieldType, inp.value));
      inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(commit, 350); });
      inp.addEventListener('blur', commit);
    }
  };

  companyMetaFields(def).forEach(f => mkMeta(f));

  /* Two-column body */
  const cols = root.createDiv({ cls: 'cad-pd-cols' });
  const left = cols.createDiv({ cls: 'cad-pd-col' });
  const right = cols.createDiv({ cls: 'cad-pd-col' });

  const content = await view.app.vault.read(file);
  const sections = parseH2Sections(content);

  const { left: leftKeys, right: rightKeys } = splitSectionColumns(Object.keys(sections));

  leftKeys.forEach((key) => {
    view._renderDynamicH2Section(left, file, sections, key, flashSaved);
  });

  rightKeys.forEach((key) => {
    view._renderDynamicH2Section(right, file, sections, key, flashSaved);
  });

  // Render Cross Sections
  const crossSectionContainer = root.createDiv({ attr: { style: 'padding: 0 32px;' } });
  view._renderCrossSections(crossSectionContainer, 'company', titleVal as string);
}
