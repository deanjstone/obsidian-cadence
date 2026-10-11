import { Notice, type TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceConfirmModal } from '../modals/confirm';
import { closedPatch } from '../utils/deals';
import {
  DETAIL_LIST_KEYS, applyFieldEdit, coerceFieldEdit, dateInputValue, enumCurrent, isChipField, withStoredOption,
} from '../utils/field-edit';
import { parseH2Sections } from '../utils/parsing';
import type { EntityDef, EntityField, Frontmatter } from '../types/entities';
import type { AppViewHost } from './host';

/* The saved badge keeps its hide timer on the element. */
type SavedBadge = HTMLElement & { _t?: ReturnType<typeof setTimeout> };

/** The form's title: the primary field, unless it is missing or empty. */
export function entityDetailTitle(fm: Frontmatter, primaryKey: string, basename: string): unknown {
  return (fm[primaryKey] != null && fm[primaryKey] !== '') ? fm[primaryKey] : basename;
}

/** The fields the form renders, in order: all of them, except a `type`
    field that is not an enum (Activities' type is one). */
export function detailFields(def: EntityDef): EntityField[] {
  return def.fields.filter(f => !(f.key === 'type' && f.type !== 'enum'));
}

export type DetailControl = 'enum' | 'date' | 'number' | 'email' | 'chips' | 'text';

/** The control a field edits with: by type first (currency is a number),
    and an email list is chips (#50), then chips for tags, multitext, any
    suggestion source or a text list, else text. */
export function detailControl(f: EntityField): DetailControl {
  const fieldType = f.type || 'text';
  if (fieldType === 'enum') return 'enum';
  if (fieldType === 'date') return 'date';
  if (fieldType === 'number' || fieldType === 'currency') return 'number';
  if (fieldType === 'email') return f.isList === true ? 'chips' : 'email';
  return isChipField(f) ? 'chips' : 'text';
}

/* ── Entity DETAIL view (in-app form, autosaves to frontmatter) ── */
export async function renderEntityDetail(view: AppViewHost, root: HTMLElement, entityKey: string, file: TFile): Promise<void> {
  // Projects and Companies get a richer custom detail view
  if (entityKey === 'project') return view.renderProjectDetail(root, file);
  if (entityKey === 'company') return view.renderCompanyDetail(root, file);

  root.addClass('cadence-detail');
  const def = ENTITIES[entityKey];
  if (!def || !file) { view.closeEntityDetail(); return; }

  // Read current entity
  const cache = view.app.metadataCache.getFileCache(file) || {};
  const fm: Frontmatter = Object.assign({}, cache.frontmatter || {});
  const primaryKey = def.fields[0].key;
  const titleVal = entityDetailTitle(fm, primaryKey, file.basename);

  // Header: back / breadcrumb / title / actions
  const head = root.createDiv({ cls: 'cad-detail-header' });
  const headLeft = head.createDiv({ cls: 'cad-detail-header-left' });

  const back = headLeft.createEl('button', { cls: 'cad-btn cad-detail-back', text: '← ' + def.plural });
  back.addEventListener('click', () => view.closeEntityDetail());

  const breadcrumb = headLeft.createDiv({ cls: 'cad-detail-breadcrumb' });
  breadcrumb.createSpan({ cls: 'cad-eyebrow', text: def.plural.toUpperCase() });
  breadcrumb.createSpan({ cls: 'cad-detail-title', text: String(titleVal) });
  breadcrumb.createDiv({ cls: 'cad-detail-path', text: file.path });

  const headRight = head.createDiv({ cls: 'cad-detail-header-right' });
  const savedBadge: SavedBadge = headRight.createSpan({ cls: 'cad-detail-saved', text: '' });
  const openNote = headRight.createEl('button', { cls: 'cad-btn', text: 'Open as note' });
  openNote.addEventListener('click', () => view.app.workspace.openLinkText(file.path, '', false));
  const deleteBtn = headRight.createEl('button', { cls: 'cad-btn cad-btn-danger', text: 'Delete' });
  deleteBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    new CadenceConfirmModal(view.app, {
      title: `Delete ${def.label}`,
      message: `Delete this ${def.label.toLowerCase()}? This moves the file to trash.`,
      confirmLabel: 'Delete',
      onConfirm: () => {
        deleteBtn.blur();
        setTimeout(async () => {
          try {
            await view.app.vault.trash(file, true);
            new Notice(`Deleted ${def.label}: ${file.basename}`);
            view.closeEntityDetail();
          } catch (e) {
            new Notice(`Delete failed: ${(e as Error).message}`);
          }
        }, 50);
      }
    }).open();
  });

  // Form
  const form = root.createDiv({ cls: 'cad-detail-form' });
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const flashSaved = () => {
    savedBadge.setText('Saved');
    savedBadge.addClass('show');
    clearTimeout(savedBadge._t);
    savedBadge._t = setTimeout(() => savedBadge.removeClass('show'), 1400);
  };
  const writeField = async (key: string, raw: unknown) => {
    try {
      const value = coerceFieldEdit(def, key, raw);
      await view.app.fileManager.processFrontMatter(file, (frontmatter) => {
        const before = frontmatter[key];
        applyFieldEdit(frontmatter, key, value);
        if (entityKey === 'deal' && key === 'stage') Object.assign(frontmatter, closedPatch(before, frontmatter[key], new Date()));
      });
      flashSaved();
    } catch (e) {
      new Notice(`Save failed: ${(e as Error).message}`);
    }
  };
  const debouncedWrite = (key: string, val: string) => {
    clearTimeout(saveTimer as ReturnType<typeof setTimeout>);
    saveTimer = setTimeout(() => writeField(key, val), 350);
  };

  // Render each field as a labelled row
  detailFields(def).forEach((f) => {
    const row = form.createDiv({ cls: 'cad-form-row' });
    row.createDiv({ cls: 'cad-form-label', text: f.label.toUpperCase() });

    const current = fm[f.key];
    const fieldType = f.type || 'text';
    const control = detailControl(f);

    if (control === 'enum') {
      const sel = row.createEl('select', { cls: 'cad-form-input' });
      // Allow empty
      sel.createEl('option', { value: '', text: '—' });
      const stored = enumCurrent(current);
      withStoredOption(f.options || [], stored).forEach((opt) => {
        const o = sel.createEl('option', { value: opt, text: opt });
        if (stored === opt) o.selected = true;
      });
      sel.addEventListener('change', () => writeField(f.key, sel.value));
    } else if (control === 'date') {
      const inp = row.createEl('input', { type: 'date', cls: 'cad-form-input' });
      if (current) {
        const date = dateInputValue(current);
        if (date !== null) inp.value = date;
      }
      inp.addEventListener('change', () => writeField(f.key, inp.value));
    } else if (control === 'number') {
      const inp = row.createEl('input', { type: 'number', cls: 'cad-form-input' });
      if (current != null) inp.value = String(current);
      if (fieldType === 'currency') inp.placeholder = `${view.plugin.settings.currency || 'USD'} amount`;
      inp.addEventListener('input', () => debouncedWrite(f.key, inp.value));
      inp.addEventListener('blur', () => writeField(f.key, inp.value));
    } else if (control === 'email') {
      const inp = row.createEl('input', { type: 'email', cls: 'cad-form-input' });
      if (current) inp.value = String(current);
      inp.addEventListener('input', () => debouncedWrite(f.key, inp.value));
      inp.addEventListener('blur', () => writeField(f.key, inp.value));
    } else {
      if (control === 'chips') {
        row.style.position = 'relative';
        view._renderChipInput(row, f, fm[f.key], {
          listKeys: DETAIL_LIST_KEYS, layout: 'form', save: (value) => writeField(f.key, value),
        });
      } else {
        const inp = row.createEl('input', { type: 'text', cls: 'cad-form-input' });
        if (current) inp.value = String(current);
        if (f.key === primaryKey) inp.placeholder = `${def.label} name`;
        inp.addEventListener('input', () => debouncedWrite(f.key, inp.value));
        inp.addEventListener('blur', () => writeField(f.key, inp.value));
      }
    }
  });

  // Body section — link out for full editing
  const content = await view.app.vault.read(file);
  const sections = parseH2Sections(content);
  const sectionKeys = Object.keys(sections);
  if (sectionKeys.length > 0) {
    const sectionsHeader = root.createDiv({ cls: 'cad-section-label-lg', text: 'NOTE SECTIONS' });
    sectionsHeader.style.marginTop = '24px';
    sectionsHeader.style.marginBottom = '12px';

    const sectionsGrid = root.createDiv({ cls: 'cad-pd-cols' });
    sectionsGrid.style.display = 'grid';
    sectionsGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(350px, 1fr))';
    sectionsGrid.style.gap = '16px';
    sectionsGrid.style.marginBottom = '24px';

    sectionKeys.forEach((key) => {
      view._renderDynamicH2Section(sectionsGrid, file, sections, key, flashSaved);
    });
  }

  // Render Cross Sections
  view._renderCrossSections(root, entityKey, titleVal as string);

}
