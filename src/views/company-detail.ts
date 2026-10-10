import { Notice, type TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceConfirmModal } from '../modals/confirm';
import { createEntity, getFieldSuggestionSource, listEntities } from '../utils/entities';
import { parseH2Sections } from '../utils/parsing';
import type { VaultNode } from '../utils/vault';
import type { EntityField, EntityKey, Frontmatter } from '../types/entities';
import type { AppViewHost } from './host';

/* MetadataCache.getTags(), as Obsidian ships it (not in the public obsidian.d.ts). */
interface TagSource {
  getTags(): Record<string, number> | null;
}

/* The saved badge keeps its hide timer on the element. */
type SavedBadge = HTMLElement & { _t?: ReturnType<typeof setTimeout> };

/* ── Company DETAIL view: a meta row of autosaving cells over the note's sections ── */
export async function renderCompanyDetail(view: AppViewHost, root: HTMLElement, file: TFile): Promise<void> {
  root.addClass('cadence-project-detail');
  const def = ENTITIES.company;
  const cache = view.app.metadataCache.getFileCache(file) || {};
  const fm: Frontmatter = Object.assign({}, cache.frontmatter || {});
  const titleVal = fm.name || file.basename;

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
    const suggestionSource = getFieldSuggestionSource(f);

    // Check if it should be rendered as chips (multitext, tags, or has a suggestion source)
    const isChips = fieldType === 'tags' || fieldType === 'multitext' || suggestionSource !== 'none';

    if (isChips) {
      const isEntitySrc2 = ENTITIES[suggestionSource] != null;
      const isFolderSrc2 = suggestionSource && suggestionSource.startsWith('folder:');
      const isPlainChip = ['tags', 'none', 'history'].includes(suggestionSource);
      const isList = fieldType === 'tags' || fieldType === 'multitext' || f.isList === true || ['owner', 'contacts', 'domain', 'industry', 'role', 'with', 'related'].includes(key);
      let targetEntityKey = isEntitySrc2 ? suggestionSource : null;
      const customFolderPath = isFolderSrc2 ? suggestionSource.slice('folder:'.length) : null;

      if (isFolderSrc2 && customFolderPath) {
        const normalizedPath = customFolderPath.replace(/\/+$/, '').toLowerCase();
        for (const [ek, def] of Object.entries(ENTITIES)) {
          if (def && def.folder && def.folder.replace(/\/+$/, '').toLowerCase() === normalizedPath) {
            targetEntityKey = ek;
            break;
          }
        }
      }

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

      let valuesList: string[] = [];
      if (Array.isArray(current)) {
        valuesList = current.map(v => isPlainChip ? String(v).trim() : String(v).replace(/^\[\[|\]\]$/g, '').trim()).filter(Boolean);
      } else if (current != null && current !== '') {
        valuesList = [isPlainChip ? String(current).trim() : String(current).replace(/^\[\[|\]\]$/g, '').trim()].filter(Boolean);
      }

      const updateSuggestions = () => {
        const query = inp.value.trim().toLowerCase();
        suggestionsBox.empty();

        let filtered: string[] = [];
        if (suggestionSource === 'tags') {
          const suggestions = Object.keys((view.app.metadataCache as unknown as TagSource).getTags() || {}).map(t => t.replace(/^#/, ''));
          filtered = suggestions.filter((v) =>
            (!query || v.toLowerCase().includes(query)) &&
            !valuesList.includes(v)
          );
        } else if (suggestionSource === 'history') {
          const allFiles = view.app.vault.getMarkdownFiles();
          const allValues = new Set<string>();
          allFiles.forEach(fl => {
            const cache = view.app.metadataCache.getFileCache(fl);
            const fm = cache && cache.frontmatter || {};
            const val = fm[key];
            if (Array.isArray(val)) {
              val.forEach(v => { if (v) allValues.add(String(v).replace(/^\[\[|\]\]$/g, '').trim()); });
            } else if (val != null && val !== '') {
              allValues.add(String(val).replace(/^\[\[|\]\]$/g, '').trim());
            }
          });
          filtered = Array.from(allValues).filter((v) =>
            (!query || v.toLowerCase().includes(query)) &&
            !valuesList.includes(v)
          );
        } else if (suggestionSource !== 'none') {
          if (customFolderPath) {
            const folderNode = view.app.vault.getAbstractFileByPath(customFolderPath) as VaultNode | null;
            const names: string[] = [];
            if (folderNode && folderNode.children) {
              const walk = (node: VaultNode) => {
                for (const child of node.children!) {
                  if (child.children) walk(child);
                  else if (child.path && child.path.endsWith('.md')) names.push((child as TFile).basename);
                }
              };
              walk(folderNode);
            }
            filtered = names.filter(n =>
              (!query || n.toLowerCase().includes(query)) && !valuesList.includes(n)
            );
          } else {
            const targetEntities = listEntities(view.app, targetEntityKey as EntityKey);
            filtered = targetEntities.filter((c) =>
              (!query || c.basename.toLowerCase().includes(query)) &&
              !valuesList.includes(c.basename)
            ).map(c => c.basename);
          }
        }

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
              const targetFile = view.app.vault.getMarkdownFiles().find(cFile => cFile.basename.toLowerCase() === valName.toLowerCase());
              if (targetFile) {
                if (targetEntityKey && !targetEntityKey.startsWith('folder:')) {
                  view.openEntityDetail(targetEntityKey, targetFile);
                } else {
                  view.openEntityDetailFromFile(targetFile);
                }
              } else {
                view.app.workspace.openLinkText(valName, '', false);
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
        let val;
        if (isPlainChip) {
          val = isList ? valuesList : (valuesList[0] || null);
        } else {
          val = isList ? valuesList.map(o => `[[${o}]]`) : (valuesList[0] ? `[[${valuesList[0]}]]` : null);
        }
        await view.app.fileManager.processFrontMatter(file, (frontmatter) => {
          if (val == null || (Array.isArray(val) && val.length === 0)) {
            delete frontmatter[key];
          } else {
            frontmatter[key] = val;
          }
        });
        flashSaved();
      };

      const addVal = async (name: string) => {
        name = name.trim();
        if (!name) return;
        if (isList) {
          if (valuesList.includes(name)) {
            inp.value = '';
            return;
          }
          valuesList.push(name);
        } else {
          valuesList = [name];
        }
        inp.value = '';
        renderChips();
        await save();

        if (!isPlainChip) {
          const targetFile = view.app.vault.getMarkdownFiles().find(cFile => cFile.basename.toLowerCase() === name.toLowerCase());
          if (!targetFile) {
            try {
              const creationSource = suggestionSource === 'history' ? 'folder:Cadence/Shared' : (targetEntityKey || suggestionSource);
              await createEntity(view.app, creationSource, name);
              const label = ENTITIES[targetEntityKey as EntityKey] ? ENTITIES[targetEntityKey as EntityKey].label : 'Note';
              new Notice(`Created new ${label}: ${name}`);
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
    } else if (fieldType === 'enum') {
      const sel = cell.createEl('select', { cls: 'cad-pd-meta-input' });
      sel.style.border = 'none';
      sel.style.background = 'transparent';
      sel.style.color = 'var(--text-normal)';
      sel.style.outline = 'none';
      sel.style.width = '100%';
      sel.createEl('option', { value: '', text: '—' });
      (f.options || []).forEach((opt) => {
        const o = sel.createEl('option', { value: opt, text: opt });
        const valStr = Array.isArray(current) ? String(current[0] || '') : String(current || '');
        if (valStr === opt) o.selected = true;
      });
      const commit = async () => {
        const val = sel.value || null;
        await view.app.fileManager.processFrontMatter(file, (frontmatter) => {
          if (val === null) delete frontmatter[key];
          else frontmatter[key] = val;
        });
        flashSaved();
      };
      sel.addEventListener('change', commit);
    } else {
      const inp = cell.createEl('input', { type: fieldType === 'date' ? 'date' : (fieldType === 'number' || fieldType === 'currency' ? 'number' : 'text'), cls: 'cad-pd-meta-input' });
      if (fieldType === 'currency') inp.placeholder = `${view.plugin.settings.currency || 'USD'} amount`;

      if (fieldType === 'date' && current) {
        const d = new Date(current as string);
        if (!isNaN(d.getTime())) inp.value = d.toISOString().slice(0, 10);
      } else if (current != null) {
        inp.value = String(current);
      }

      let t: ReturnType<typeof setTimeout> | undefined;
      const commit = () => {
        let val: string | number | null = inp.value || null;
        if (fieldType === 'number' || fieldType === 'currency') {
          const n = Number(inp.value);
          val = isNaN(n) ? null : n;
        }
        view.app.fileManager.processFrontMatter(file, (frontmatter) => {
          if (val === null || val === '') delete frontmatter[key];
          else frontmatter[key] = val;
        });
        flashSaved();
      };
      inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(commit, 350); });
      inp.addEventListener('blur', commit);
    }
  };

  def.fields.forEach(f => {
    if (f.primary) return;
    if (f.key === 'type' && f.type !== 'enum') return;
    mkMeta(f);
  });

  /* Two-column body */
  const cols = root.createDiv({ cls: 'cad-pd-cols' });
  const left = cols.createDiv({ cls: 'cad-pd-col' });
  const right = cols.createDiv({ cls: 'cad-pd-col' });

  const content = await view.app.vault.read(file);
  const sections = parseH2Sections(content);

  const leftKeys: string[] = [];
  const rightKeys: string[] = [];

  Object.keys(sections).forEach((key, idx) => {
    if (idx % 2 === 0) {
      leftKeys.push(key);
    } else {
      rightKeys.push(key);
    }
  });

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
