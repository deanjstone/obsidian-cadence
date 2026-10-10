import { Notice, type TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceConfirmModal } from '../modals/confirm';
import { CadenceReminderEditModal } from '../modals/reminder-edit';
import type { EntityField, EntityKey, Frontmatter, TaskNotesTask } from '../types/entities';
import { ymd } from '../utils/dates';
import { createEntity, getEnumOptions, getFieldSuggestionSource, listEntities, readProjectMeta } from '../utils/entities';
import { pctBand } from '../utils/format';
import {
  parseHeaderKey, replaceSection, stringifyMilestones, stringifyTasks, type Milestone, type MilestoneInput, type TaskItem,
} from '../utils/parsing';
import { findProjectTaskReminder, reminderTimeStr } from '../utils/reminders';
import { listTaskNotesTasksForFile, toggleTaskNotesTask } from '../utils/tasknotes';
import { ensureFolderSync, type VaultNode } from '../utils/vault';
import type { FlashSaved } from './components/sections';
import type { AppViewHost } from './host';

/* MetadataCache.getTags(), as Obsidian ships it (not in the public obsidian.d.ts). */
interface TagSource {
  getTags(): Record<string, number> | null;
}

/* App.commands is not in the public obsidian.d.ts. */
interface CommandsApp {
  commands?: {
    commands: Record<string, unknown>;
    executeCommandById(id: string): void;
  };
}

/* The saved badge keeps its hide timer on the element. */
type SavedBadge = HTMLElement & { _t?: ReturnType<typeof setTimeout> };

/* ── Project DETAIL view (real PM surface) ─────── */
export async function renderProjectDetail(view: AppViewHost, root: HTMLElement, file: TFile): Promise<void> {
  root.addClass('cadence-project-detail');
  const def = ENTITIES.project;
  const cache = view.app.metadataCache.getFileCache(file) || {};
  const fm: Frontmatter = Object.assign({}, cache.frontmatter || {});
  const meta = await readProjectMeta(view.app, file);
  const titleVal = fm.name || file.basename;

  const status = String(fm.status || 'active');
  const priority = String(fm.priority || '');
  const owner = fm.owner || '';
  const due = fm.due || '';
  const started = fm.started || '';

  /* Header */
  const head = root.createDiv({ cls: 'cad-detail-header' });
  const headLeft = head.createDiv({ cls: 'cad-detail-header-left' });
  const back = headLeft.createEl('button', { cls: 'cad-btn cad-detail-back', text: '← Projects' });
  back.addEventListener('click', () => view.closeEntityDetail());
  const breadcrumb = headLeft.createDiv({ cls: 'cad-detail-breadcrumb' });
  breadcrumb.createSpan({ cls: 'cad-eyebrow', text: 'PROJECT' });
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
      title: 'Delete Project',
      message: 'Delete this project? This moves the file to trash.',
      confirmLabel: 'Delete',
      onConfirm: () => {
        deleteBtn.blur();
        setTimeout(async () => {
          try {
            await view.app.vault.trash(file, true);
            new Notice(`Deleted project: ${file.basename}`);
            view.closeEntityDetail();
          } catch (e) {
            new Notice(`Delete failed: ${(e as Error).message}`);
          }
        }, 50);
      }
    }).open();
  });

  /* Hero — name (already in breadcrumb), pills, meta, progress */
  const hero = root.createDiv({ cls: 'cad-pd-hero' });
  const pillRow = hero.createDiv({ cls: 'cad-pd-pills' });
  const mkSelect = (cls: string, options: string[], current: string, onChange: (value: string) => void) => {
    const wrap = pillRow.createDiv({ cls: `cad-pd-select-wrap ${cls}` });
    const sel = wrap.createEl('select', { cls: 'cad-pd-select' });
    options.forEach((opt) => {
      const o = sel.createEl('option', { value: opt, text: opt });
      if (String(current) === opt) o.selected = true;
    });
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  };
  const statusOptions = getEnumOptions('project', 'status', ['active', 'on_hold', 'backlog', 'done', 'cancelled']);
  const prioOptions = getEnumOptions('project', 'priority', ['low', 'medium', 'high']);
  mkSelect('cad-pill cad-pill-' + status.toLowerCase().replace(/\s+/g, '-'),
    statusOptions, status,
    (v) => view._writeProjectFrontmatter(file, { status: v }, flashSaved));
  mkSelect('cad-pill cad-pill-prio-' + (priority || 'medium').toLowerCase(),
    prioOptions, priority || 'medium',
    (v) => view._writeProjectFrontmatter(file, { priority: v }, flashSaved));

  const metaRow = hero.createDiv({ cls: 'cad-pd-meta' });
  const entityKey = 'project';
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
      const isEntitySrc = ENTITIES[suggestionSource as EntityKey] != null;
      const isFolderSrc = suggestionSource && suggestionSource.startsWith('folder:');
      const isPlainChip = ['tags', 'none', 'history'].includes(suggestionSource);
      const isList = fieldType === 'tags' || fieldType === 'multitext' || f.isList === true || ['owner', 'contacts', 'domain', 'industry', 'role', 'with', 'related'].includes(key);
      let targetEntityKey: string | null = isEntitySrc ? suggestionSource : null;
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
        await view._writeProjectFrontmatter(file, { [key]: val }, flashSaved);
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
        await view._writeProjectFrontmatter(file, { [key]: val }, flashSaved);
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
        view._writeProjectFrontmatter(file, { [key]: val }, flashSaved);
      };
      inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(commit, 350); });
      inp.addEventListener('blur', commit);
    }
  };

  def.fields.forEach(f => {
    if (f.primary || f.key === 'status' || f.key === 'priority') return;
    if (f.key === 'type' && f.type !== 'enum') return;
    mkMeta(f);
  });

  if (meta.total > 0) {
    const progWrap = hero.createDiv({ cls: 'cad-proj-progress-wrap cad-pd-progress' });
    progWrap.dataset.pctBand = pctBand(meta.percent);
    const progLabel = progWrap.createDiv({ cls: 'cad-proj-progress-label' });
    progLabel.createSpan({ text: `${meta.done}/${meta.total} milestones complete` });
    progLabel.createSpan({ cls: 'cad-proj-progress-pct', text: `${meta.percent}%` });
    const bar = progWrap.createDiv({ cls: 'cad-proj-progress-bar' });
    const fill = bar.createDiv({ cls: 'cad-proj-progress-fill' });
    fill.style.width = `${meta.percent}%`;
  }

  /* Two-column body */
  const cols = root.createDiv({ cls: 'cad-pd-cols' });
  const left = cols.createDiv({ cls: 'cad-pd-col' });
  const right = cols.createDiv({ cls: 'cad-pd-col' });

  const leftKeys: string[] = [];
  const rightKeys: string[] = [];

  Object.keys(meta.sections).forEach((key, idx) => {
    if (idx % 2 === 0) {
      leftKeys.push(key);
    } else {
      rightKeys.push(key);
    }
  });

  leftKeys.forEach((key) => {
    view._renderDynamicH2Section(left, file, meta.sections, key, flashSaved);
  });

  const standardMetadata: Record<string, { label: string; rows: number; placeholder: string }> = {
    brief: { label: 'BRIEF', rows: 4, placeholder: 'The outcome we want, why now.' },
    scope: { label: 'SCOPE', rows: 5, placeholder: 'In scope / out of scope.' },
    risks: { label: 'RISKS', rows: 4, placeholder: 'What could go wrong.' },
    stakeholders: { label: 'STAKEHOLDERS', rows: 3, placeholder: 'Who cares about this project.' },
    notes: { label: 'NOTES', rows: 5, placeholder: 'Anything else.' }
  };

  rightKeys.forEach((key) => {
    const { cleanLabel } = parseHeaderKey(key);
    const metaInfo = standardMetadata[cleanLabel.toLowerCase()];
    if (metaInfo) {
      view._renderProjectTextSection(right, file, meta.sections, { key, label: metaInfo.label, rows: metaInfo.rows, placeholder: metaInfo.placeholder }, flashSaved);
    } else {
      view._renderDynamicH2Section(right, file, meta.sections, key, flashSaved);
    }
  });

  // Render Cross Sections
  const crossSectionContainer = root.createDiv({ attr: { style: 'padding: 0 32px; width: 100%; clear: both;' } });
  view._renderCrossSections(crossSectionContainer, 'project', titleVal as string);
}

export function renderMilestoneSection(
  view: AppViewHost, parent: HTMLElement, file: TFile, milestones: Milestone[], flashSaved?: FlashSaved, rawKey = 'Milestones',
): void {
  const card = parent.createDiv({ cls: 'cad-pd-card' });
  const head = card.createDiv({ cls: 'cad-pd-card-head' });
  const { cleanLabel } = parseHeaderKey(rawKey);
  head.createDiv({ cls: 'cad-pd-card-title', text: `${cleanLabel.toUpperCase()} · ${milestones.filter((m) => m.done).length}/${milestones.length}` });
  const addBtn = head.createEl('button', { cls: 'cad-btn cad-btn-sm', text: '+ Add' });

  const list = card.createDiv({ cls: 'cad-pd-checklist' });
  const renderRows = (items: Milestone[]) => {
    list.empty();
    if (!items.length) {
      list.createDiv({ cls: 'cad-empty', text: 'No milestones yet — add the first one.' });
      return;
    }
    items.forEach((m, idx) => {
      const wrapper = list.createDiv({ cls: 'cad-mile-wrapper' });
      const row = wrapper.createDiv({ cls: 'cad-pd-mile-row' + (m.done ? ' done' : '') });
      const cb = row.createEl('input', { type: 'checkbox' });
      cb.checked = !!m.done;
      cb.addEventListener('change', async () => {
        items[idx].done = cb.checked;
        await view._commitMilestones(file, items, flashSaved, false, rawKey);
      });
      const dateInp = row.createEl('input', { type: 'date', cls: 'cad-pd-mile-date' });
      if (m.date instanceof Date && !isNaN(m.date.getTime())) {
        dateInp.value = m.date.toISOString().slice(0, 10);
      }
      let dt: ReturnType<typeof setTimeout> | undefined;
      dateInp.addEventListener('input', () => {
        clearTimeout(dt);
        dt = setTimeout(async () => {
          items[idx].date = dateInp.value ? new Date(dateInp.value) : null;
          await view._commitMilestones(file, items, flashSaved, true, rawKey);
        }, 350);
      });
      const titleInp = row.createEl('input', { type: 'text', cls: 'cad-pd-mile-title' });
      titleInp.value = m.title || '';
      titleInp.placeholder = 'Milestone title';
      let tt: ReturnType<typeof setTimeout> | undefined;
      titleInp.addEventListener('input', () => {
        clearTimeout(tt);
        tt = setTimeout(async () => {
          items[idx].title = titleInp.value;
          await view._commitMilestones(file, items, flashSaved, true, rawKey);
        }, 400);
      });
      const del = row.createEl('button', { cls: 'cad-btn cad-btn-sm cad-btn-danger', text: '×' });
      del.title = 'Delete milestone';
      del.addEventListener('click', async () => {
        items.splice(idx, 1);
        await view._commitMilestones(file, items, flashSaved, false, rawKey);
      });

      // Notes section — preview ⇄ textarea, indented under the milestone in markdown
      const notesEl = wrapper.createDiv({ cls: 'cad-mile-notes-section' });
      const renderNotesIdle = () => {
        notesEl.empty();
        const hasNotes = (items[idx].notes || '').trim().length > 0;
        if (hasNotes) {
          const preview = notesEl.createDiv({ cls: 'cad-mile-notes-preview' });
          preview.setText(items[idx].notes);
          preview.title = 'Click to edit notes';
          preview.addEventListener('click', openNotesEditor);
        } else {
          const addBtn = notesEl.createEl('a', { cls: 'cad-mile-notes-add', text: '+ Add notes' });
          addBtn.addEventListener('click', (e) => { e.preventDefault(); openNotesEditor(); });
        }
      };
      const openNotesEditor = () => {
        notesEl.empty();
        const ta = notesEl.createEl('textarea', { cls: 'cad-mile-notes-textarea' });
        ta.value = items[idx].notes || '';
        ta.placeholder = 'Notes — context, follow-ups, what happened…';
        const autosize = () => {
          ta.style.height = 'auto';
          ta.style.height = Math.max(60, ta.scrollHeight + 2) + 'px';
        };
        let nt: ReturnType<typeof setTimeout> | undefined;
        ta.addEventListener('input', () => {
          autosize();
          clearTimeout(nt);
          nt = setTimeout(async () => {
            items[idx].notes = ta.value;
            await view._commitMilestones(file, items, flashSaved, true, rawKey);
          }, 400);
        });
        ta.addEventListener('blur', async () => {
          items[idx].notes = ta.value;
          await view._commitMilestones(file, items, flashSaved, true, rawKey);
          renderNotesIdle();
        });
        setTimeout(() => { ta.focus(); autosize(); }, 0);
      };
      renderNotesIdle();
    });
  };

  renderRows(milestones);

  addBtn.addEventListener('click', async () => {
    const today = new Date();
    milestones.push({ done: false, date: today, title: '' } as Milestone);
    await view._commitMilestones(file, milestones, flashSaved, false, rawKey);
  });
}

export async function saveMilestones(
  view: AppViewHost, file: TFile, items: MilestoneInput[], flashSaved?: FlashSaved, skipRender = false, rawKey = 'Milestones',
): Promise<void> {
  const body = stringifyMilestones(items);
  const content = await view.app.vault.read(file);
  const next = replaceSection(content, `## ${rawKey}`, body || '');
  await view.app.vault.modify(file, next);
  if (typeof flashSaved === 'function') flashSaved();
  if (!skipRender) view.render();
}

export function renderTaskSection(
  view: AppViewHost, parent: HTMLElement, file: TFile, tasks: TaskItem[], flashSaved?: FlashSaved, rawKey = 'Tasks',
): void {
  const card = parent.createDiv({ cls: 'cad-pd-card' });
  const head = card.createDiv({ cls: 'cad-pd-card-head' });

  let tasksList: TaskItem[] = tasks;
  let fileTaskNotes: TaskNotesTask[] = [];
  if (view.plugin.settings.taskManagementSystem === 'tasknotes') {
    fileTaskNotes = listTaskNotesTasksForFile(view.app, file);
    tasksList = fileTaskNotes.map(t => ({ done: t.done, title: t.title }));
  }

  const open = tasksList.filter((t) => !t.done).length;
  const { cleanLabel } = parseHeaderKey(rawKey);
  head.createDiv({ cls: 'cad-pd-card-title', text: `${cleanLabel.toUpperCase()} · ${open} open · ${tasksList.length - open} done` });
  const addBtn = head.createEl('button', { cls: 'cad-btn cad-btn-sm', text: '+ Add' });

  const list = card.createDiv({ cls: 'cad-pd-checklist' });
  const renderRows = (items: TaskItem[]) => {
    list.empty();
    if (!items.length) {
      list.createDiv({ cls: 'cad-empty', text: 'No tasks yet.' });
      return;
    }
    items.forEach((t, idx) => {
      const row = list.createDiv({ cls: 'cad-pd-task-row' + (t.done ? ' done' : '') });
      const cb = row.createEl('input', { type: 'checkbox' });
      cb.checked = !!t.done;
      cb.addEventListener('change', async () => {
        if (view.plugin.settings.taskManagementSystem === 'tasknotes') {
          const taskObj = fileTaskNotes[idx];
          await toggleTaskNotesTask(view.app, taskObj.file, cb.checked);
        } else {
          items[idx].done = cb.checked;
          await view._commitTasks(file, items, flashSaved, false, rawKey);
          const txt = (items[idx].title || '').trim();
          if (txt) await view._propagateTaskComplete(txt, cb.checked, { kind: 'project', file });
        }
        view.render();
      });

      if (view.plugin.settings.taskManagementSystem === 'tasknotes') {
        const taskObj = fileTaskNotes[idx];
        const taskLink = row.createEl('a', { cls: 'cad-task-text', text: t.title || 'Untitled Task' });
        taskLink.style.cursor = 'pointer';
        taskLink.style.flex = '1';
        taskLink.style.marginRight = '8px';
        taskLink.addEventListener('click', (ev) => {
          ev.preventDefault();
          view.app.workspace.openLinkText(taskObj.file.path, '', false);
        });
      } else {
        const titleInp = row.createEl('input', { type: 'text', cls: 'cad-pd-task-title' });
        titleInp.value = t.title || '';
        titleInp.placeholder = 'Task description';
        let tt: ReturnType<typeof setTimeout> | undefined;
        titleInp.addEventListener('input', () => {
          clearTimeout(tt);
          tt = setTimeout(async () => {
            items[idx].title = titleInp.value;
            await view._commitTasks(file, items, flashSaved, true, rawKey);
          }, 400);
        });

        /* Bell — set or edit a reminder linked to this task. */
        const linked = findProjectTaskReminder(view.plugin, file.path, t.title || '');
        const bell = row.createEl('button', {
          cls: 'cad-btn cad-btn-sm cad-pd-task-bell' + (linked ? ' linked' : ''),
          text: linked ? '🔔' : '🔕',
        });
        bell.title = linked
          ? `Edit reminder${linked.when ? ' · ' + reminderTimeStr(linked.when) : ''}`
          : 'Set a reminder for this task';
        bell.addEventListener('click', async () => {
          items[idx].title = titleInp.value;
          await view._commitTasks(file, items, flashSaved, true, rawKey);

          const taskText = titleInp.value.trim();
          if (!taskText) {
            new Notice('Add a task title first.');
            titleInp.focus();
            return;
          }
          const existing = findProjectTaskReminder(view.plugin, file.path, taskText);
          if (existing) {
            new CadenceReminderEditModal(view.app, view.plugin, existing).open();
          } else {
            new CadenceReminderEditModal(view.app, view.plugin, {
              text: taskText,
              when: null,
              repeat: 'none',
              notes: '',
              project: file.path,
            }, { isNew: true }).open();
          }
        });
      }

      if (view.plugin.settings.taskManagementSystem !== 'tasknotes') {
        const del = row.createEl('button', { cls: 'cad-btn cad-btn-sm cad-btn-danger', text: '×' });
        del.addEventListener('click', async () => {
          items.splice(idx, 1);
          await view._commitTasks(file, items, flashSaved, false, rawKey);
        });
      }
    });
  };

  renderRows(tasksList);

  addBtn.addEventListener('click', async () => {
    if (view.plugin.settings.taskManagementSystem === 'tasknotes') {
      const commandId = "tasknotes:create-new-task";
      const hasCommand = (view.app as unknown as CommandsApp).commands && (view.app as unknown as CommandsApp).commands!.commands && (view.app as unknown as CommandsApp).commands!.commands[commandId];
      if (hasCommand) {
        (view.app as unknown as CommandsApp).commands!.executeCommandById(commandId);
        return;
      }

      const text = await view._prompt({
        title: 'Ajouter une tâche (TaskNotes)',
        placeholder: 'Que faut-il faire ?',
        cta: 'Ajouter',
      });
      if (!text) return;

      const folderPath = "TaskNotes/Tasks";
      await ensureFolderSync(view.app, folderPath);
      const cleanTitle = text.replace(/[\\/:*?"<>|]/g, '').trim();
      let filename = `${folderPath}/${cleanTitle}.md`;
      let existingFile = view.app.vault.getAbstractFileByPath(filename);
      let counter = 1;
      while (existingFile) {
        filename = `${folderPath}/${cleanTitle} (${counter}).md`;
        existingFile = view.app.vault.getAbstractFileByPath(filename);
        counter++;
      }

      const content = `---
title: ${text}
status: open
scheduled: ${ymd(new Date())}
projects: "[[${file.basename}]]"
priority: normal
---
`;
      await view.app.vault.create(filename, content);
      view.render();
      return;
    }
    tasks.push({ done: false, title: '' });
    await view._commitTasks(file, tasks, flashSaved, false, rawKey);
  });
}

export async function saveTasks(
  view: AppViewHost, file: TFile, items: Array<Partial<TaskItem>>, flashSaved?: FlashSaved, skipRender = false, rawKey = 'Tasks',
): Promise<void> {
  const body = stringifyTasks(items);
  const content = await view.app.vault.read(file);
  const next = replaceSection(content, `## ${rawKey}`, body || '');
  await view.app.vault.modify(file, next);
  if (typeof flashSaved === 'function') flashSaved();
  if (!skipRender) view.render();
}

export async function saveProjectFrontmatter(
  view: AppViewHost, file: TFile, patch: Record<string, unknown>, flashSaved?: FlashSaved,
): Promise<void> {
  try {
    await view.app.fileManager.processFrontMatter(file, (fm) => {
      Object.entries(patch).forEach(([k, v]) => {
        if (v == null || v === '') delete fm[k];
        else fm[k] = v;
      });
    });
    if (typeof flashSaved === 'function') flashSaved();
  } catch (e) {
    new Notice(`Save failed: ${(e as Error).message}`);
  }
}
