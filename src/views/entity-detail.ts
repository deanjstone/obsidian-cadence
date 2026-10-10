import { Notice, type TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceConfirmModal } from '../modals/confirm';
import { createEntity, getFieldSuggestionSource, listEntities } from '../utils/entities';
import { parseH2Sections } from '../utils/parsing';
import type { VaultNode } from '../utils/vault';
import type { EntityKey, Frontmatter } from '../types/entities';
import type { AppViewHost } from './host';

/* MetadataCache.getTags(), as Obsidian ships it (not in the public obsidian.d.ts). */
interface TagSource {
  getTags(): Record<string, number> | null;
}

/* The saved badge keeps its hide timer on the element. */
type SavedBadge = HTMLElement & { _t?: ReturnType<typeof setTimeout> };

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
  const titleVal = (fm[primaryKey] != null && fm[primaryKey] !== '') ? fm[primaryKey] : file.basename;

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
      let value: unknown = raw;
      const fdef = def.fields.find((f) => f.key === key);
      if (fdef) {
        if (fdef.type === 'tags') {
          if (Array.isArray(raw)) {
            value = raw;
          } else {
            value = ((raw as string) || '').split(',').map((t) => t.trim()).filter(Boolean);
          }
        } else if (fdef.type === 'number' || fdef.type === 'currency') {
          const n = Number(raw);
          value = isNaN(n) ? null : n;
        } else if (key === 'stage') {
          value = raw ? [raw] : null;
        } else if (raw === '') {
          value = null;
        }
      }
      await view.app.fileManager.processFrontMatter(file, (frontmatter) => {
        if (value == null || (Array.isArray(value) && value.length === 0)) {
          delete frontmatter[key];
        } else {
          frontmatter[key] = value;
        }
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

  const isCore = ['contact', 'company', 'partner', 'registration', 'commission', 'lead', 'certification', 'activity', 'sequence', 'project', 'deal'].includes(entityKey);

  // Render each field as a labelled row
  def.fields.forEach((f) => {
    if (f.key === 'type' && f.type !== 'enum') {
      return; // Skip rendering the 'type' field if it is not an enum (like in Activities)
    }
    const row = form.createDiv({ cls: 'cad-form-row' });
    row.createDiv({ cls: 'cad-form-label', text: f.label.toUpperCase() });

    const current = fm[f.key];
    const fieldType = f.type || 'text';

    if (fieldType === 'enum') {
      const sel = row.createEl('select', { cls: 'cad-form-input' });
      // Allow empty
      sel.createEl('option', { value: '', text: '—' });
      (f.options || []).forEach((opt) => {
        const o = sel.createEl('option', { value: opt, text: opt });
        const valStr = Array.isArray(current) ? String(current[0] || '') : String(current || '');
        if (valStr === opt) o.selected = true;
      });
      sel.addEventListener('change', () => writeField(f.key, sel.value));
    } else if (fieldType === 'date') {
      const inp = row.createEl('input', { type: 'date', cls: 'cad-form-input' });
      if (current) {
        const d = new Date(current as string);
        if (!isNaN(d.getTime())) inp.value = d.toISOString().slice(0, 10);
      }
      if (!isCore && f.key === 'type') {
        inp.disabled = true;
        inp.style.opacity = '0.6';
        inp.style.cursor = 'not-allowed';
        inp.title = 'This property is read-only unless configured as a Select (Enum) in settings.';
      } else {
        inp.addEventListener('change', () => writeField(f.key, inp.value));
      }
    } else if (fieldType === 'number' || fieldType === 'currency') {
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
    } else if (fieldType === 'email') {
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
      const suggestionSource = getFieldSuggestionSource(f);
      const isChips = fieldType === 'tags' || fieldType === 'multitext' || suggestionSource !== 'none';
      if (isChips) {
        const isEntitySrc = ENTITIES[suggestionSource] != null;
        const isFolderSrc = suggestionSource && suggestionSource.startsWith('folder:');
        const isPlainChip = ['tags', 'none', 'history'].includes(suggestionSource);
        const isList = fieldType === 'tags' || fieldType === 'multitext' || f.isList === true || f.key === 'tags' || ['owner', 'assigned', 'contacts', 'domain', 'industry', 'role', 'with', 'related'].includes(f.key);

        let targetEntityKey = isEntitySrc ? suggestionSource : null;
        const customFolderPath = isFolderSrc ? suggestionSource.slice('folder:'.length) : null;

        if (isFolderSrc && customFolderPath) {
          const normalizedPath = customFolderPath.replace(/\/+$/, '').toLowerCase();
          for (const [ek, def] of Object.entries(ENTITIES)) {
            if (def && def.folder && def.folder.replace(/\/+$/, '').toLowerCase() === normalizedPath) {
              targetEntityKey = ek;
              break;
            }
          }
        }

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

        let valuesList: string[] = [];
        const cur = fm[f.key];
        if (Array.isArray(cur)) {
          valuesList = cur.map(v => isPlainChip ? String(v).trim() : String(v).replace(/^\[\[|\]\]$/g, '').trim()).filter(Boolean);
        } else if (cur != null && cur !== '') {
          valuesList = [isPlainChip ? String(cur).trim() : String(cur).replace(/^\[\[|\]\]$/g, '').trim()].filter(Boolean);
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
            allFiles.forEach(file => {
              const cache = view.app.metadataCache.getFileCache(file);
              const fm = cache && cache.frontmatter || {};
              const val = fm[f.key];
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
              // Custom folder source: list basenames of .md files in that folder
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
          let val;
          if (isPlainChip) {
            val = isList ? valuesList : (valuesList[0] || null);
          } else {
            val = isList ? valuesList.map(o => `[[${o}]]`) : (valuesList[0] ? `[[${valuesList[0]}]]` : null);
          }
          await writeField(f.key, val);
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
