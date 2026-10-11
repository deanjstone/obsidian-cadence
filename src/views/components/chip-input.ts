import { Notice } from 'obsidian';
import { ENTITIES } from '../../constants/entities';
import { createEntity } from '../../utils/entities';
import {
  autoCreatesNote, chipAdd, chipConfig, chipCreation, chipLabel, chipLinkTarget, chipScopeNotes, chipValues, chipWriteValue,
  filterSuggestions, findNoteByName, historyValues,
} from '../../utils/field-edit';
import type { EntityField } from '../../types/entities';
import type { AppViewHost } from '../host';

/* The chip input shared by the generic detail form, the company page and
   the project page (#62). Its logic is the chip seams in
   src/utils/field-edit.ts; this is the one copy of its DOM. */

/* MetadataCache.getTags(), as Obsidian ships it (not in the public obsidian.d.ts). */
interface TagSource {
  getTags(): Record<string, number> | null;
}

export interface ChipInputOptions {
  /** Keys edited as a list whatever their type (DETAIL_LIST_KEYS or COMPANY_LIST_KEYS). */
  listKeys: string[];
  /** `form` is a generic form row (its suggestions clear the label column);
      `meta` is a company or project meta cell. */
  layout: 'form' | 'meta';
  /** Write the field's new value (chipWriteValue's result). */
  save: (value: unknown) => Promise<void>;
}

/** Draw a chip input for `f` into `parent`: the chips, a text input, and a
    suggestions box under it. Adding, removing and Backspace save through
    `opts.save`; adding a missing relation note creates it. */
export function renderChipInput(view: AppViewHost, parent: HTMLElement, f: EntityField, current: unknown, opts: ChipInputOptions): void {
  const { suggestionSource, isPlainChip, isList, targetEntityKey, customFolderPath } = chipConfig(f, ENTITIES, opts.listKeys);
  const chipText = (value: string) => chipLabel(value, suggestionSource);
  const isForm = opts.layout === 'form';

  const wrap = parent.createDiv({ cls: 'cad-pd-tag-input-wrap' });
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

  let inp: HTMLInputElement;
  if (isForm) {
    inp = wrap.createEl('input', { type: 'text' });
    inp.style.border = 'none';
    inp.style.outline = 'none';
    inp.style.background = 'transparent';
    inp.style.flex = '1';
    inp.style.minWidth = '80px';
    inp.style.color = 'var(--text-normal)';
    inp.style.padding = '0';
    inp.style.margin = '0';
    inp.style.height = '24px';
  } else {
    inp = wrap.createEl('input', { type: 'text', cls: 'cad-pd-tag-input-field' });
    inp.style.border = 'none';
    inp.style.outline = 'none';
    inp.style.background = 'transparent';
    inp.style.color = 'var(--text-normal)';
    inp.style.flex = '1';
    inp.style.minWidth = '80px';
    inp.style.padding = '0';
    inp.style.height = '24px';
    inp.style.lineHeight = '24px';
  }
  inp.placeholder = `Add ${f.label.toLowerCase()}...`;

  const suggestionsBox = parent.createDiv({ cls: 'cad-pd-tag-suggestions' });
  suggestionsBox.style.position = 'absolute';
  suggestionsBox.style.zIndex = '10000';
  suggestionsBox.style.backgroundColor = 'var(--background-secondary)';
  suggestionsBox.style.border = '1px solid var(--border-color)';
  suggestionsBox.style.borderRadius = '4px';
  suggestionsBox.style.boxShadow = 'var(--shadow-s)';
  suggestionsBox.style.maxHeight = '150px';
  suggestionsBox.style.overflowY = 'auto';
  suggestionsBox.style.display = 'none';
  suggestionsBox.style.width = isForm ? 'calc(100% - 150px)' : '100%'; // A form row accounts for its label
  suggestionsBox.style.boxSizing = 'border-box';
  suggestionsBox.style.top = '100%';
  if (isForm) suggestionsBox.style.right = '0';
  else suggestionsBox.style.left = '0';
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
      }), f.key);
    } else if (suggestionSource !== 'none') {
      candidates = chipScopeNotes(view.app, targetEntityKey, customFolderPath).map(note => note.basename);
    }
    const filtered = filterSuggestions(candidates, query, valuesList.map(chipText));

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

      const labelSpan = chip.createSpan({ text: chipText(valName) });
      if (!isPlainChip) {
        labelSpan.style.textDecoration = 'underline';
        labelSpan.style.cursor = 'pointer';
        labelSpan.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const target = chipLinkTarget(targetEntityKey, findNoteByName(chipScopeNotes(view.app, targetEntityKey, customFolderPath), valName), valName);
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
    await opts.save(chipWriteValue(valuesList, isPlainChip, isList));
  };

  const addVal = async (raw: string) => {
    const added = chipAdd(valuesList, raw, isList, chipText);
    if (added.kind === 'blank') return;
    inp.value = '';
    if (added.kind === 'duplicate') return;
    const { name } = added;
    valuesList = added.values;
    renderChips();
    await save();

    if (!isPlainChip && autoCreatesNote(targetEntityKey)) {
      const targetFile = findNoteByName(chipScopeNotes(view.app, targetEntityKey, customFolderPath), name);
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
}
