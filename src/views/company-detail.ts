import { Notice, type TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceConfirmModal } from '../modals/confirm';
import { createEntity, listEntities } from '../utils/entities';
import {
  COMPANY_LIST_KEYS, applyFieldEdit, chipAdd, chipConfig, chipCreation, chipLinkTarget, chipValues, chipWriteValue,
  dateInputValue, enumCurrent, filterSuggestions, findNoteByName, folderNoteNames, historyValues, metaControl, metaInputType,
  metaInputValue, splitSectionColumns,
} from '../utils/field-edit';
import { parseH2Sections } from '../utils/parsing';
import type { VaultNode } from '../utils/vault';
import type { EntityDef, EntityField, EntityKey, Frontmatter } from '../types/entities';
import type { AppViewHost } from './host';

/* The meta-cell and column helpers are shared with the project page, so they
   live in src/utils/field-edit.ts; re-exported under their #15 names. */
export { metaControl as companyMetaControl, metaInputType, metaInputValue, splitSectionColumns };
export type { MetaControl } from '../utils/field-edit';

/* MetadataCache.getTags(), as Obsidian ships it (not in the public obsidian.d.ts). */
interface TagSource {
  getTags(): Record<string, number> | null;
}

/* The saved badge keeps its hide timer on the element. */
type SavedBadge = HTMLElement & { _t?: ReturnType<typeof setTimeout> };

/** The page title: `name` when truthy, else the basename. Flagged: unlike
    the generic form, a falsy name such as 0 falls back too. */
export function companyDetailTitle(fm: Frontmatter, basename: string): unknown {
  return fm.name || basename;
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
      const { suggestionSource, isPlainChip, isList, targetEntityKey, customFolderPath } = chipConfig(f, ENTITIES, COMPANY_LIST_KEYS);

      const wrap = cell.createDiv({ cls: 'cad-pd-tag-input-wrap' });
      wrap.style.display = 'flex';
      wrap.style.flexWrap = 'wrap';
      wrap.style.gap = '6px';
      wrap.style.alignItems = 'center';
      wrap.style.border = 'none';
      wrap.style.borderRadius = '0';
      wrap.style.padding = '4px 0';
      wrap.style.minHeight = '36px';
      wrap.style.backgroundColor = 'transparent';
      wrap.style.cursor = 'text';

      const inp = wrap.createEl('input', { type: 'text', cls: 'cad-pd-tag-input-field' });
      inp.style.border = 'none';
      inp.style.outline = 'none';
      inp.style.background = 'transparent';
      inp.style.color = 'var(--text-normal)';
      inp.style.flex = '1';
      inp.style.minWidth = '80px';
      inp.style.padding = '0';
      inp.style.height = '24px';
      inp.style.lineHeight = '24px';
      inp.placeholder = `Add ${label.toLowerCase()}...`;

      const suggestionsBox = cell.createDiv({ cls: 'cad-pd-tag-suggestions' });
      suggestionsBox.style.position = 'absolute';
      suggestionsBox.style.zIndex = '10000';
      suggestionsBox.style.backgroundColor = 'var(--background-secondary)';
      suggestionsBox.style.border = '1px solid var(--border-color)';
      suggestionsBox.style.borderRadius = '4px';
      suggestionsBox.style.boxShadow = 'var(--shadow-s)';
      suggestionsBox.style.maxHeight = '150px';
      suggestionsBox.style.overflowY = 'auto';
      suggestionsBox.style.display = 'none';
      suggestionsBox.style.width = '100%';
      suggestionsBox.style.boxSizing = 'border-box';
      suggestionsBox.style.top = '100%';
      suggestionsBox.style.left = '0';
      suggestionsBox.style.marginTop = '4px';

      let valuesList = chipValues(current, isPlainChip);

      const updateSuggestions = () => {
        const query = inp.value.trim().toLowerCase();
        suggestionsBox.empty();

        let candidates: string[] = [];
        if (suggestionSource === 'tags') {
          candidates = Object.keys((view.app.metadataCache as unknown as TagSource).getTags() || {}).map(t => t.replace(/^#/, ''));
        } else if (suggestionSource === 'history') {
          candidates = historyValues(view.app.vault.getMarkdownFiles().map(fl => {
            const cache = view.app.metadataCache.getFileCache(fl);
            return cache && cache.frontmatter || {};
          }), key);
        } else if (suggestionSource !== 'none') {
          if (customFolderPath) {
            // Custom folder source: list basenames of .md files in that folder
            candidates = folderNoteNames(view.app.vault.getAbstractFileByPath(customFolderPath) as VaultNode | null);
          } else {
            candidates = listEntities(view.app, targetEntityKey as EntityKey).map(c => c.basename);
          }
        }
        const filtered = filterSuggestions(candidates, query, valuesList);

        if (filtered.length === 0) {
          suggestionsBox.style.display = 'none';
          return;
        }

        filtered.forEach((valStr) => {
          const item = suggestionsBox.createDiv({ cls: 'cad-suggestion-item' });
          item.style.padding = '6px 10px';
          item.style.cursor = 'pointer';
          item.style.fontSize = '13px';
          item.style.color = 'var(--text-normal)';
          item.setText(valStr);

          item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = 'var(--background-modifier-hover)';
          });
          item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = 'transparent';
          });
          item.addEventListener('mousedown', async (ev) => {
            ev.preventDefault();
            await addVal(valStr);
            suggestionsBox.style.display = 'none';
          });
        });

        suggestionsBox.style.display = 'block';
      };

      const renderChips = () => {
        const existing = wrap.querySelectorAll('.cad-tag-chip');
        existing.forEach(c => c.remove());

        valuesList.forEach((valName) => {
          const chip = wrap.createDiv({ cls: 'cad-tag-chip' });
          chip.style.display = 'inline-flex';
          chip.style.alignItems = 'center';
          chip.style.gap = '6px';
          chip.style.backgroundColor = 'var(--background-secondary, #eee)';
          chip.style.padding = '2px 8px';
          chip.style.borderRadius = '12px';
          chip.style.fontSize = '12px';
          chip.style.height = '24px';
          chip.style.boxSizing = 'border-box';
          chip.style.color = 'var(--text-normal)';

          const labelSpan = chip.createSpan({ text: valName });
          if (!isPlainChip) {
            labelSpan.style.textDecoration = 'underline';
            labelSpan.style.cursor = 'pointer';
            labelSpan.addEventListener('click', (ev) => {
              ev.stopPropagation();
              const target = chipLinkTarget(targetEntityKey, findNoteByName(view.app.vault.getMarkdownFiles(), valName), valName);
              if (target.kind === 'entity') {
                view.openEntityDetail(target.entityKey, target.file);
              } else if (target.kind === 'file') {
                view.openEntityDetailFromFile(target.file);
              } else {
                view.app.workspace.openLinkText(target.linktext, '', false);
              }
            });
          }

          const close = chip.createSpan({ text: '×' });
          close.style.cursor = 'pointer';
          close.style.fontWeight = 'bold';
          close.style.fontSize = '14px';
          close.style.lineHeight = '1';
          close.style.color = 'var(--text-muted)';
          close.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            valuesList = valuesList.filter(v => v !== valName);
            await save();
            renderChips();
          });

          wrap.insertBefore(chip, inp);
        });
      };

      const save = async () => {
        const val = chipWriteValue(valuesList, isPlainChip, isList);
        await view.app.fileManager.processFrontMatter(file, (frontmatter) => applyFieldEdit(frontmatter, key, val));
        flashSaved();
      };

      const addVal = async (raw: string) => {
        const added = chipAdd(valuesList, raw, isList);
        if (added.kind === 'blank') return;
        inp.value = '';
        if (added.kind === 'duplicate') return;
        const { name } = added;
        valuesList = added.values;
        renderChips();
        await save();

        if (!isPlainChip) {
          const targetFile = findNoteByName(view.app.vault.getMarkdownFiles(), name);
          if (!targetFile) {
            try {
              const creation = chipCreation(suggestionSource, targetEntityKey, ENTITIES);
              await createEntity(view.app, creation.source, name);
              new Notice(`Created new ${creation.label}: ${name}`);
            } catch (e) {
              console.warn(`Failed to auto-create ${targetEntityKey || suggestionSource}`, e);
            }
          }
        }
      };

      inp.addEventListener('input', updateSuggestions);
      inp.addEventListener('focus', updateSuggestions);
      inp.addEventListener('keydown', async (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          await addVal(inp.value);
          suggestionsBox.style.display = 'none';
        } else if (ev.key === 'Backspace' && !inp.value && valuesList.length > 0) {
          valuesList.pop();
          await save();
          renderChips();
        }
      });
      inp.addEventListener('blur', async () => {
        setTimeout(async () => {
          suggestionsBox.style.display = 'none';
          if (inp.value.trim()) {
            await addVal(inp.value);
          }
        }, 180);
      });
      wrap.addEventListener('click', () => inp.focus());
      renderChips();
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
        const val = sel.value || null;
        await view.app.fileManager.processFrontMatter(file, (frontmatter) => applyFieldEdit(frontmatter, key, val));
        flashSaved();
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
      const commit = () => {
        const val = metaInputValue(fieldType, inp.value);
        view.app.fileManager.processFrontMatter(file, (frontmatter) => applyFieldEdit(frontmatter, key, val));
        flashSaved();
      };
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
