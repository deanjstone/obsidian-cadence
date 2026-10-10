import { Notice, type TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceConfirmModal } from '../modals/confirm';
import { CadenceReminderEditModal } from '../modals/reminder-edit';
import type { EntityDef, EntityField, EntityKey, Frontmatter, ProjectMeta, TaskNotesTask } from '../types/entities';
import type { Reminder } from '../types/reminders';
import { ymd } from '../utils/dates';
import { createEntity, getEnumOptions, listEntities, readProjectMeta } from '../utils/entities';
import {
  COMPANY_LIST_KEYS, chipAdd, chipConfig, chipCreation, chipLinkTarget, chipValues, chipWriteValue, dateInputValue,
  enumCurrent, filterSuggestions, findNoteByName, folderNoteNames, historyValues, metaControl, metaInputType,
  metaInputValue, splitSectionColumns,
} from '../utils/field-edit';
import { pctBand, type PctBand } from '../utils/format';
import {
  parseHeaderKey, replaceSection, stringifyMilestones, stringifyTasks, type Milestone, type MilestoneInput, type TaskItem,
} from '../utils/parsing';
import { findProjectTaskReminder, reminderTimeStr } from '../utils/reminders';
import { listTaskNotesTasksForFile, toggleTaskNotesTask } from '../utils/tasknotes';
import { ensureFolderSync, type VaultNode } from '../utils/vault';
import type { FlashSaved, ProjectTextSectionDef } from './components/sections';
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

/* ── Pure seams: plain data in, plain data out ── */

/** The page title: `name` when truthy, else the basename. */
export function projectDetailTitle(fm: Frontmatter, basename: string): unknown {
  return fm.name || basename;
}

/** The status and priority options when the project def has none. */
export const PROJECT_STATUS_FALLBACK = ['active', 'on_hold', 'backlog', 'done', 'cancelled'];
export const PROJECT_PRIORITY_FALLBACK = ['low', 'medium', 'high'];

export interface ProjectPill {
  key: 'status' | 'priority';
  /** Classes for the pill's wrapper, after `cad-pd-select-wrap`. */
  cls: string;
  options: string[];
  /** The option to select. Flagged: a value outside `options` selects nothing,
      so the select shows its first option. */
  current: string;
}

/** The hero's two selects. Status defaults to active and priority to
    medium; the status class lower-cases the value and dashes its spaces. */
export function projectPills(fm: Frontmatter, statusOptions: string[], priorityOptions: string[]): ProjectPill[] {
  const status = String(fm.status || 'active');
  const priority = String(fm.priority || '');
  return [
    { key: 'status', cls: 'cad-pill cad-pill-' + status.toLowerCase().replace(/\s+/g, '-'), options: statusOptions, current: status },
    { key: 'priority', cls: 'cad-pill cad-pill-prio-' + (priority || 'medium').toLowerCase(), options: priorityOptions, current: priority || 'medium' },
  ];
}

/** The meta row's fields: every field but the primary, status and priority
    (the pills edit those), and a `type` field that is not an enum. */
export function projectMetaFields(def: EntityDef): EntityField[] {
  return def.fields.filter(f => !(f.primary || f.key === 'status' || f.key === 'priority') && !(f.key === 'type' && f.type !== 'enum'));
}

/** Apply a patch inside a processFrontMatter callback: null, undefined and
    '' delete the key, anything else is written.
    Flagged quirk (kept as-is): an empty list is written as [], where the
    company page and the generic form delete the key. */
export function writeProjectFrontmatter(frontmatter: Frontmatter, patch: Record<string, unknown>): void {
  Object.entries(patch).forEach(([k, v]) => {
    if (v == null || v === '') delete frontmatter[k];
    else frontmatter[k] = v;
  });
}

export interface ProjectProgress {
  band: PctBand;
  label: string;
  percent: string;
}

/** The hero's milestone progress bar, or null when there are no milestones. */
export function projectProgress(meta: Pick<ProjectMeta, 'total' | 'done' | 'percent'>): ProjectProgress | null {
  if (!(meta.total > 0)) return null;
  return { band: pctBand(meta.percent), label: `${meta.done}/${meta.total} milestones complete`, percent: `${meta.percent}%` };
}

/** The right column's standard sections, by lower-cased clean label. */
export const PROJECT_TEXT_SECTIONS: Record<string, { label: string; rows: number; placeholder: string }> = {
  brief: { label: 'BRIEF', rows: 4, placeholder: 'The outcome we want, why now.' },
  scope: { label: 'SCOPE', rows: 5, placeholder: 'In scope / out of scope.' },
  risks: { label: 'RISKS', rows: 4, placeholder: 'What could go wrong.' },
  stakeholders: { label: 'STAKEHOLDERS', rows: 3, placeholder: 'Who cares about this project.' },
  notes: { label: 'NOTES', rows: 5, placeholder: 'Anything else.' }
};

/** The text card a right-column section renders as, or null for a generic
    section. Only the right column checks this, so (flagged) a standard
    section in the left column is a generic one. Also flagged: the lookup is
    on a plain object, so a label such as `constructor` matches an inherited
    member and yields a card with no label. */
export function projectTextSection(key: string): ProjectTextSectionDef | null {
  const { cleanLabel } = parseHeaderKey(key);
  const metaInfo = PROJECT_TEXT_SECTIONS[cleanLabel.toLowerCase()];
  return metaInfo ? { key, label: metaInfo.label, rows: metaInfo.rows, placeholder: metaInfo.placeholder } : null;
}

/** A milestones card's title: its clean label, then done/total. */
export function milestoneCardTitle(rawKey: string, milestones: Array<Pick<Milestone, 'done'>>): string {
  const { cleanLabel } = parseHeaderKey(rawKey);
  return `${cleanLabel.toUpperCase()} · ${milestones.filter((m) => m.done).length}/${milestones.length}`;
}

/** The YYYY-MM-DD a milestone's date input shows (UTC), or null for no valid date. */
export function milestoneDateValue(date: unknown): string | null {
  return date instanceof Date && !isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

/** A milestone's date from its date input: null when cleared. */
export function milestoneDateFromInput(value: string): Date | null {
  return value ? new Date(value) : null;
}

/** Rewrite (or append) the `## <rawKey>` section with the milestones. */
export function commitMilestones(content: string, items: MilestoneInput[], rawKey = 'Milestones'): string {
  const body = stringifyMilestones(items);
  return replaceSection(content, `## ${rawKey}`, body || '');
}

/** The list with item `idx` replaced by a copy carrying `patch`. A missing
    item throws, as assigning to it did before. */
export function updateItem<T>(items: T[], idx: number, patch: Partial<T>): T[] {
  if (!(idx in items)) throw new TypeError(`No item at index ${idx}`);
  return items.map((item, i) => (i === idx ? { ...item, ...patch } : item));
}

/** The list without item `idx`. */
export function removeItem<T>(items: T[], idx: number): T[] {
  return items.filter((_, i) => i !== idx);
}

/** The list with an untitled, open milestone dated `today` appended (no notes). */
export function addMilestone(items: Milestone[], today: Date): Milestone[] {
  return [...items, { done: false, date: today, title: '' } as Milestone];
}

/** A tasks card's title: its clean label, then the open and done counts. */
export function taskCardTitle(rawKey: string, tasks: Array<Pick<TaskItem, 'done'>>): string {
  const open = tasks.filter((t) => !t.done).length;
  const { cleanLabel } = parseHeaderKey(rawKey);
  return `${cleanLabel.toUpperCase()} · ${open} open · ${tasks.length - open} done`;
}

/** TaskNotes mode: the rows for the task notes linked to the project. */
export function taskNotesItems(tasks: TaskNotesTask[]): TaskItem[] {
  return tasks.map(t => ({ done: t.done, title: t.title }));
}

/** Rewrite (or append) the `## <rawKey>` section with the tasks. */
export function commitTasks(content: string, items: Array<Partial<TaskItem>>, rawKey = 'Tasks'): string {
  const body = stringifyTasks(items);
  return replaceSection(content, `## ${rawKey}`, body || '');
}

/** The list with an empty open task appended. */
export function addTask(items: TaskItem[]): TaskItem[] {
  return [...items, { done: false, title: '' }];
}

export interface TaskBell {
  cls: string;
  text: string;
  title: string;
}

/** A task's reminder bell: rung and titled with the time when a reminder is linked. */
export function taskBell(linked: Reminder | null): TaskBell {
  return {
    cls: 'cad-btn cad-btn-sm cad-pd-task-bell' + (linked ? ' linked' : ''),
    text: linked ? '🔔' : '🔕',
    title: linked
      ? `Edit reminder${linked.when ? ' · ' + reminderTimeStr(linked.when) : ''}`
      : 'Set a reminder for this task',
  };
}

/** The new reminder a bell opens for an unlinked task. */
export function newTaskReminder(text: string, projectPath: string): Partial<Reminder> {
  return {
    text,
    when: null,
    repeat: 'none',
    notes: '',
    project: projectPath,
  };
}

/** Where a TaskNotes task note is created when TaskNotes' command is missing. */
export const TASKNOTES_FOLDER = 'TaskNotes/Tasks';

/** The prompt for a new TaskNotes task. Flagged: it is in French, unlike the rest of the UI. */
export const TASKNOTES_PROMPT = {
  title: 'Ajouter une tâche (TaskNotes)',
  placeholder: 'Que faut-il faire ?',
  cta: 'Ajouter',
};

/** The path for a new task note: the title without \ / : * ? " < > |, numbered
    ` (1)`, ` (2)`, … while `exists` reports the path taken. */
export function taskNotePath(folderPath: string, text: string, exists: (path: string) => boolean): string {
  const cleanTitle = text.replace(/[\\/:*?"<>|]/g, '').trim();
  let filename = `${folderPath}/${cleanTitle}.md`;
  let counter = 1;
  while (exists(filename)) {
    filename = `${folderPath}/${cleanTitle} (${counter}).md`;
    counter++;
  }
  return filename;
}

/** A new task note: open, scheduled today, linked to the project.
    Flagged: the title is written unquoted, so YAML-significant text (a
    colon, a leading quote) is not escaped. */
export function taskNoteContent(text: string, today: Date, projectBasename: string): string {
  return `---
title: ${text}
status: open
scheduled: ${ymd(today)}
projects: "[[${projectBasename}]]"
priority: normal
---
`;
}

/* The section's handlers share one list with the caller, so a list
   operation's result replaces its contents rather than the reference. */
function replaceItems<T>(items: T[], next: T[]): void {
  items.splice(0, items.length, ...next);
}

/* ── Project DETAIL view (real PM surface) ─────── */
export async function renderProjectDetail(view: AppViewHost, root: HTMLElement, file: TFile): Promise<void> {
  root.addClass('cadence-project-detail');
  const def = ENTITIES.project;
  const cache = view.app.metadataCache.getFileCache(file) || {};
  const fm: Frontmatter = Object.assign({}, cache.frontmatter || {});
  const meta = await readProjectMeta(view.app, file);
  const titleVal = projectDetailTitle(fm, file.basename);

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
  const statusOptions = getEnumOptions('project', 'status', PROJECT_STATUS_FALLBACK);
  const prioOptions = getEnumOptions('project', 'priority', PROJECT_PRIORITY_FALLBACK);
  projectPills(fm, statusOptions, prioOptions).forEach((pill) => {
    const wrap = pillRow.createDiv({ cls: `cad-pd-select-wrap ${pill.cls}` });
    const sel = wrap.createEl('select', { cls: 'cad-pd-select' });
    pill.options.forEach((opt) => {
      const o = sel.createEl('option', { value: opt, text: opt });
      if (pill.current === opt) o.selected = true;
    });
    sel.addEventListener('change', () => view._writeProjectFrontmatter(file, { [pill.key]: sel.value }, flashSaved));
  });

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
        await view._writeProjectFrontmatter(file, { [key]: val }, flashSaved);
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
        await view._writeProjectFrontmatter(file, { [key]: val }, flashSaved);
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
        view._writeProjectFrontmatter(file, { [key]: metaInputValue(fieldType, inp.value) }, flashSaved);
      };
      inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(commit, 350); });
      inp.addEventListener('blur', commit);
    }
  };

  projectMetaFields(def).forEach(f => mkMeta(f));

  const progress = projectProgress(meta);
  if (progress) {
    const progWrap = hero.createDiv({ cls: 'cad-proj-progress-wrap cad-pd-progress' });
    progWrap.dataset.pctBand = progress.band;
    const progLabel = progWrap.createDiv({ cls: 'cad-proj-progress-label' });
    progLabel.createSpan({ text: progress.label });
    progLabel.createSpan({ cls: 'cad-proj-progress-pct', text: progress.percent });
    const bar = progWrap.createDiv({ cls: 'cad-proj-progress-bar' });
    const fill = bar.createDiv({ cls: 'cad-proj-progress-fill' });
    fill.style.width = progress.percent;
  }

  /* Two-column body */
  const cols = root.createDiv({ cls: 'cad-pd-cols' });
  const left = cols.createDiv({ cls: 'cad-pd-col' });
  const right = cols.createDiv({ cls: 'cad-pd-col' });

  const { left: leftKeys, right: rightKeys } = splitSectionColumns(Object.keys(meta.sections));

  leftKeys.forEach((key) => {
    view._renderDynamicH2Section(left, file, meta.sections, key, flashSaved);
  });

  rightKeys.forEach((key) => {
    const textSection = projectTextSection(key);
    if (textSection) {
      view._renderProjectTextSection(right, file, meta.sections, textSection, flashSaved);
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
  head.createDiv({ cls: 'cad-pd-card-title', text: milestoneCardTitle(rawKey, milestones) });
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
        replaceItems(items, updateItem(items, idx, { done: cb.checked }));
        await view._commitMilestones(file, items, flashSaved, false, rawKey);
      });
      const dateInp = row.createEl('input', { type: 'date', cls: 'cad-pd-mile-date' });
      const dateValue = milestoneDateValue(m.date);
      if (dateValue !== null) dateInp.value = dateValue;
      let dt: ReturnType<typeof setTimeout> | undefined;
      dateInp.addEventListener('input', () => {
        clearTimeout(dt);
        dt = setTimeout(async () => {
          replaceItems(items, updateItem(items, idx, { date: milestoneDateFromInput(dateInp.value) }));
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
          replaceItems(items, updateItem(items, idx, { title: titleInp.value }));
          await view._commitMilestones(file, items, flashSaved, true, rawKey);
        }, 400);
      });
      const del = row.createEl('button', { cls: 'cad-btn cad-btn-sm cad-btn-danger', text: '×' });
      del.title = 'Delete milestone';
      del.addEventListener('click', async () => {
        replaceItems(items, removeItem(items, idx));
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
            replaceItems(items, updateItem(items, idx, { notes: ta.value }));
            await view._commitMilestones(file, items, flashSaved, true, rawKey);
          }, 400);
        });
        ta.addEventListener('blur', async () => {
          replaceItems(items, updateItem(items, idx, { notes: ta.value }));
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
    replaceItems(milestones, addMilestone(milestones, new Date()));
    await view._commitMilestones(file, milestones, flashSaved, false, rawKey);
  });
}

export async function saveMilestones(
  view: AppViewHost, file: TFile, items: MilestoneInput[], flashSaved?: FlashSaved, skipRender = false, rawKey = 'Milestones',
): Promise<void> {
  // Snapshot before the read: the list is stringified as it was when the commit began.
  const snapshot = [...items];
  const content = await view.app.vault.read(file);
  await view.app.vault.modify(file, commitMilestones(content, snapshot, rawKey));
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
    tasksList = taskNotesItems(fileTaskNotes);
  }

  head.createDiv({ cls: 'cad-pd-card-title', text: taskCardTitle(rawKey, tasksList) });
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
          replaceItems(items, updateItem(items, idx, { done: cb.checked }));
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
            replaceItems(items, updateItem(items, idx, { title: titleInp.value }));
            await view._commitTasks(file, items, flashSaved, true, rawKey);
          }, 400);
        });

        /* Bell — set or edit a reminder linked to this task. */
        const bellState = taskBell(findProjectTaskReminder(view.plugin, file.path, t.title || ''));
        const bell = row.createEl('button', { cls: bellState.cls, text: bellState.text });
        bell.title = bellState.title;
        bell.addEventListener('click', async () => {
          replaceItems(items, updateItem(items, idx, { title: titleInp.value }));
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
            new CadenceReminderEditModal(view.app, view.plugin, newTaskReminder(taskText, file.path), { isNew: true }).open();
          }
        });
      }

      if (view.plugin.settings.taskManagementSystem !== 'tasknotes') {
        const del = row.createEl('button', { cls: 'cad-btn cad-btn-sm cad-btn-danger', text: '×' });
        del.addEventListener('click', async () => {
          replaceItems(items, removeItem(items, idx));
          await view._commitTasks(file, items, flashSaved, false, rawKey);
        });
      }
    });
  };

  renderRows(tasksList);

  addBtn.addEventListener('click', async () => {
    if (view.plugin.settings.taskManagementSystem === 'tasknotes') {
      const commandId = "tasknotes:create-new-task";
      const commands = (view.app as unknown as CommandsApp).commands;
      const hasCommand = commands && commands.commands && commands.commands[commandId];
      if (hasCommand) {
        commands.executeCommandById(commandId);
        return;
      }

      const text = await view._prompt(TASKNOTES_PROMPT);
      if (!text) return;

      await ensureFolderSync(view.app, TASKNOTES_FOLDER);
      const filename = taskNotePath(TASKNOTES_FOLDER, text, (path) => !!view.app.vault.getAbstractFileByPath(path));
      await view.app.vault.create(filename, taskNoteContent(text, new Date(), file.basename));
      view.render();
      return;
    }
    replaceItems(tasks, addTask(tasks));
    await view._commitTasks(file, tasks, flashSaved, false, rawKey);
  });
}

export async function saveTasks(
  view: AppViewHost, file: TFile, items: Array<Partial<TaskItem>>, flashSaved?: FlashSaved, skipRender = false, rawKey = 'Tasks',
): Promise<void> {
  // Snapshot before the read: the list is stringified as it was when the commit began.
  const snapshot = [...items];
  const content = await view.app.vault.read(file);
  await view.app.vault.modify(file, commitTasks(content, snapshot, rawKey));
  if (typeof flashSaved === 'function') flashSaved();
  if (!skipRender) view.render();
}

export async function saveProjectFrontmatter(
  view: AppViewHost, file: TFile, patch: Record<string, unknown>, flashSaved?: FlashSaved,
): Promise<void> {
  try {
    await view.app.fileManager.processFrontMatter(file, (fm) => writeProjectFrontmatter(fm, patch));
    if (typeof flashSaved === 'function') flashSaved();
  } catch (e) {
    new Notice(`Save failed: ${(e as Error).message}`);
  }
}
