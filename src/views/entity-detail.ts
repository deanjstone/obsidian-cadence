import { Notice, type TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceConfirmModal } from '../modals/confirm';
import { createEntity, listEntities } from '../utils/entities';
import {
  DETAIL_LIST_KEYS, applyFieldEdit, chipAdd, chipConfig, chipCreation, chipLinkTarget, chipValues, chipWriteValue,
  coerceFieldEdit, dateInputValue, enumCurrent, filterSuggestions, findNoteByName, folderNoteNames, historyValues,
  isChipField,
} from '../utils/field-edit';
import { parseH2Sections } from '../utils/parsing';
import type { VaultNode } from '../utils/vault';
import type { EntityDef, EntityField, EntityKey, Frontmatter } from '../types/entities';
import type { AppViewHost } from './host';

/* MetadataCache.getTags(), as Obsidian ships it (not in the public obsidian.d.ts). */
interface TagSource {
  getTags(): Record<string, number> | null;
}

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
    then chips for tags, multitext or any suggestion source, else text. */
export function detailControl(f: EntityField): DetailControl {
  const fieldType = f.type || 'text';
  if (fieldType === 'enum') return 'enum';
  if (fieldType === 'date') return 'date';
  if (fieldType === 'number' || fieldType === 'currency') return 'number';
  if (fieldType === 'email') return 'email';
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
      await view.app.fileManager.processFrontMatter(file, (frontmatter) => applyFieldEdit(frontmatter, key, value));
      flashSaved();
    } catch (e) {
      new Notice(`Save failed: ${(e as Error).message}`);
    }
  };
  const debouncedWrite = (key: string, val: string) => {
    clearTimeout(saveTimer as ReturnType<typeof setTimeout>);
    saveTimer = setTimeout(() => writeField(key, val), 350);
  };

  const isCore = ['contact', 'company', 'partner', 'registration', 'commission', 'lead', 'certification', 'activity', 'sequence', 'project', 'deal'].includes(entityKey);

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
      (f.options || []).forEach((opt) => {
        const o = sel.createEl('option', { value: opt, text: opt });
        if (enumCurrent(current) === opt) o.selected = true;
      });
      sel.addEventListener('change', () => writeField(f.key, sel.value));
    } else if (control === 'date') {
      const inp = row.createEl('input', { type: 'date', cls: 'cad-form-input' });
      if (current) {
        const date = dateInputValue(current);
        if (date !== null) inp.value = date;
      }
      if (!isCore && f.key === 'type') {
        inp.disabled = true;
        inp.style.opacity = '0.6';
        inp.style.cursor = 'not-allowed';
        inp.title = 'This property is read-only unless configured as a Select (Enum) in settings.';
      } else {
        inp.addEventListener('change', () => writeField(f.key, inp.value));
      }
    } else if (control === 'number') {
      const inp = row.createEl('input', { type: 'number', cls: 'cad-form-input' });
      if (current != null) inp.value = String(current);
      if (fieldType === 'currency') inp.placeholder = `${view.plugin.settings.currency || 'USD'} amount`;
      if (!isCore && f.key === 'type') {
        inp.disabled = true;
        inp.style.opacity = '0.6';
        inp.style.cursor = 'not-allowed';
        inp.title = 'This property is read-only unless configured as a Select (Enum) in settings.';
      } else {
        inp.addEventListener('input', () => debouncedWrite(f.key, inp.value));
        inp.addEventListener('blur', () => writeField(f.key, inp.value));
      }
    } else if (control === 'email') {
      const inp = row.createEl('input', { type: 'email', cls: 'cad-form-input' });
      if (current) inp.value = String(current);
      if (!isCore && f.key === 'type') {
        inp.disabled = true;
        inp.style.opacity = '0.6';
        inp.style.cursor = 'not-allowed';
        inp.title = 'This property is read-only unless configured as a Select (Enum) in settings.';
      } else {
        inp.addEventListener('input', () => debouncedWrite(f.key, inp.value));
        inp.addEventListener('blur', () => writeField(f.key, inp.value));
      }
    } else {
      if (control === 'chips') {
        const { suggestionSource, isPlainChip, isList, targetEntityKey, customFolderPath } = chipConfig(f, ENTITIES, DETAIL_LIST_KEYS);

        row.style.position = 'relative';
        const wrap = row.createDiv({ cls: 'cad-pd-tag-input-wrap' });
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

        const inp = wrap.createEl('input', { type: 'text' });
        inp.style.border = 'none';
        inp.style.outline = 'none';
        inp.style.background = 'transparent';
        inp.style.flex = '1';
        inp.style.minWidth = '80px';
        inp.style.color = 'var(--text-normal)';
        inp.style.padding = '0';
        inp.style.margin = '0';
        inp.style.height = '24px';
        inp.placeholder = 'Add ' + f.label.toLowerCase() + '...';

        if (!isCore && f.key === 'type') {
          inp.disabled = true;
          inp.style.display = 'none';
        }

        const suggestionsBox = row.createDiv({ cls: 'cad-pd-tag-suggestions' });
        suggestionsBox.style.position = 'absolute';
        suggestionsBox.style.zIndex = '10000';
        suggestionsBox.style.backgroundColor = 'var(--background-secondary)';
        suggestionsBox.style.border = '1px solid var(--border-color)';
        suggestionsBox.style.borderRadius = '4px';
        suggestionsBox.style.boxShadow = 'var(--shadow-s)';
        suggestionsBox.style.maxHeight = '150px';
        suggestionsBox.style.overflowY = 'auto';
        suggestionsBox.style.display = 'none';
        suggestionsBox.style.width = 'calc(100% - 150px)'; // Account for form label
        suggestionsBox.style.boxSizing = 'border-box';
        suggestionsBox.style.top = '100%';
        suggestionsBox.style.right = '0';
        suggestionsBox.style.marginTop = '4px';

        let valuesList = chipValues(fm[f.key], isPlainChip);

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
            }), f.key);
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
            if (!isCore && f.key === 'type') {
              close.style.display = 'none';
            } else {
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
            }

            wrap.insertBefore(chip, inp);
          });
        };

        const save = async () => {
          await writeField(f.key, chipWriteValue(valuesList, isPlainChip, isList));
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

        if (isCore || f.key !== 'type') {
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
        }

        wrap.addEventListener('click', () => {
          inp.focus();
        });

        renderChips();
      } else {
        const inp = row.createEl('input', { type: 'text', cls: 'cad-form-input' });
        if (current) inp.value = String(current);
        if (f.key === primaryKey) inp.placeholder = `${def.label} name`;
        if (!isCore && f.key === 'type') {
          inp.disabled = true;
          inp.style.opacity = '0.6';
          inp.style.cursor = 'not-allowed';
          inp.title = 'This property is read-only unless configured as a Select (Enum) in settings.';
        } else {
          inp.addEventListener('input', () => debouncedWrite(f.key, inp.value));
          inp.addEventListener('blur', () => writeField(f.key, inp.value));
        }
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
