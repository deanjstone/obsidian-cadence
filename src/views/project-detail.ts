import { Notice, type TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceConfirmModal } from '../modals/confirm';
import { CadenceReminderEditModal } from '../modals/reminder-edit';
import type { EntityDef, EntityField, Frontmatter, ProjectMeta, TaskNotesTask } from '../types/entities';
import type { Reminder } from '../types/reminders';
import { parseYmd, ymd } from '../utils/dates';
import { getEnumOptions, readProjectMeta } from '../utils/entities';
import {
  COMPANY_LIST_KEYS, dateInputValue, enumCurrent, metaControl, metaInputType, metaInputValue, splitSectionColumns, withStoredOption,
} from '../utils/field-edit';
import { pctBand, type PctBand } from '../utils/format';
import { parseHeaderKey, type Milestone, type TaskItem } from '../utils/parsing';
import { findProjectTaskReminder, reminderTimeStr } from '../utils/reminders';
import {
  appendMilestone, appendProjectTask, editMilestoneByRef, editProjectTaskByRef, milestoneRefAt, removeMilestoneByRef,
  removeProjectTaskByRef, taskRefAt, toggleProjectTaskByRef, type TaskRef,
} from '../utils/task-lines';
import { listTaskNotesTasksForFile, toggleTaskNotesTask } from '../utils/tasknotes';
import { ensureFolderSync } from '../utils/vault';
import type { FlashSaved, ProjectTextSectionDef } from './components/sections';
import type { AppViewHost } from './host';

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

/** The page title: `name` unless it is missing or empty, else the basename,
    as on the company page, so a name of 0 is kept (#79). */
export function projectDetailTitle(fm: Frontmatter, basename: string): unknown {
  return (fm.name != null && fm.name !== '') ? fm.name : basename;
}

/** The status and priority options when the project def has none. */
export const PROJECT_STATUS_FALLBACK = ['active', 'on_hold', 'backlog', 'done', 'cancelled'];
export const PROJECT_PRIORITY_FALLBACK = ['low', 'medium', 'high'];

export interface ProjectPill {
  key: 'status' | 'priority';
  /** Classes for the pill's wrapper, after `cad-pd-select-wrap`. */
  cls: string;
  /** The field's options, then a stored value that is not one of them, so
      the pill shows (and keeps) what the note holds (#50). */
  options: string[];
  /** The option to select. */
  current: string;
}

/* A stored pill value as text, '' when the note has none. */
function storedText(stored: unknown): string {
  return stored == null ? '' : String(stored);
}

/** The hero's two selects. Status defaults to active and priority to
    medium; the status class lower-cases the value and dashes its spaces. */
export function projectPills(fm: Frontmatter, statusOptions: string[], priorityOptions: string[]): ProjectPill[] {
  const status = String(fm.status || 'active');
  const priority = String(fm.priority || '');
  return [
    { key: 'status', cls: 'cad-pill cad-pill-' + status.toLowerCase().replace(/\s+/g, '-'), options: withStoredOption(statusOptions, storedText(fm.status)), current: status },
    { key: 'priority', cls: 'cad-pill cad-pill-prio-' + (priority || 'medium').toLowerCase(), options: withStoredOption(priorityOptions, storedText(fm.priority)), current: priority || 'medium' },
  ];
}

/** The meta row's fields: every field but the primary, status and priority
    (the pills edit those), and a `type` field that is not an enum. */
export function projectMetaFields(def: EntityDef): EntityField[] {
  return def.fields.filter(f => !(f.primary || f.key === 'status' || f.key === 'priority') && !(f.key === 'type' && f.type !== 'enum'));
}

/** Apply a patch inside a processFrontMatter callback: null, undefined, ''
    and an empty list delete the key, as on the company page and the generic
    form (#50); anything else is written. */
export function writeProjectFrontmatter(frontmatter: Frontmatter, patch: Record<string, unknown>): void {
  Object.entries(patch).forEach(([k, v]) => {
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) delete frontmatter[k];
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

/** The local YYYY-MM-DD a milestone's date input shows, or null for no valid date. */
export function milestoneDateValue(date: unknown): string | null {
  return date instanceof Date && !isNaN(date.getTime()) ? ymd(date) : null;
}

/** A milestone's date from its date input, as local midnight: null when cleared. */
export function milestoneDateFromInput(value: string): Date | null {
  return value ? parseYmd(value) : null;
}

/** A milestone's notes from the notes editor: whitespace only is no notes (#50). */
export function milestoneNotesFromInput(value: string): string {
  return value.trim() ? value : '';
}

/** The list with item `idx` replaced by a copy carrying `patch`. A missing
    item leaves the list as it was, as removeItem does (#50). */
export function updateItem<T>(items: T[], idx: number, patch: Partial<T>): T[] {
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

/** The prompt for a new TaskNotes task. */
export const TASKNOTES_PROMPT = {
  title: 'Add a task (TaskNotes)',
  placeholder: 'What needs doing?',
  cta: 'Add',
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

/** A new task note: open, scheduled today, linked to the project. The
    title is a double-quoted YAML string (JSON's escaping is valid there), so
    a colon, a quote or a leading # stays text (#50). */
export function taskNoteContent(text: string, today: Date, projectBasename: string): string {
  return `---
title: ${JSON.stringify(text)}
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

/* A row's hold on the shared list. It finds its item by identity, not by
   the index it was drawn at, so an edit still pending when an earlier row
   is deleted lands on this row, and one whose row is gone is dropped (#50). */
interface RowHandle<T> {
  /** The row's current index, or -1 once it is deleted. */
  index(): number;
  item(): T | undefined;
  /** Patch the row's item; false (and no change) once it is deleted. */
  patch(patch: Partial<T>): boolean;
  /** Remove the row's item; false when it is already gone. */
  remove(): boolean;
}

function rowHandle<T>(items: T[], item: T): RowHandle<T> {
  let current = item;
  return {
    index: () => items.indexOf(current),
    item: () => (items.includes(current) ? current : undefined),
    patch(patch) {
      const at = items.indexOf(current);
      if (at === -1) return false;
      replaceItems(items, updateItem(items, at, patch));
      current = items[at];
      return true;
    },
    remove() {
      const at = items.indexOf(current);
      if (at === -1) return false;
      replaceItems(items, removeItem(items, at));
      return true;
    },
  };
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
      view._renderChipInput(cell, f, current, {
        listKeys: COMPANY_LIST_KEYS, layout: 'meta', save: (value) => view._writeProjectFrontmatter(file, { [key]: value }, flashSaved),
      });
    } else if (control === 'enum') {
      const sel = cell.createEl('select', { cls: 'cad-pd-meta-input' });
      sel.style.border = 'none';
      sel.style.background = 'transparent';
      sel.style.color = 'var(--text-normal)';
      sel.style.outline = 'none';
      sel.style.width = '100%';
      sel.createEl('option', { value: '', text: '—' });
      const stored = enumCurrent(current);
      withStoredOption(f.options || [], stored).forEach((opt) => {
        const o = sel.createEl('option', { value: opt, text: opt });
        if (stored === opt) o.selected = true;
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
    items.forEach((m) => {
      const mile = rowHandle(items, m);
      const wrapper = list.createDiv({ cls: 'cad-mile-wrapper' });
      const row = wrapper.createDiv({ cls: 'cad-pd-mile-row' + (m.done ? ' done' : '') });
      const cb = row.createEl('input', { type: 'checkbox' });
      cb.checked = !!m.done;
      cb.addEventListener('change', async () => {
        if (!await editMilestoneRow(view, file, items, mile, { done: cb.checked }, flashSaved, rawKey)) return;
        view.render();
      });
      const dateInp = row.createEl('input', { type: 'date', cls: 'cad-pd-mile-date' });
      const dateValue = milestoneDateValue(m.date);
      if (dateValue !== null) dateInp.value = dateValue;
      let dt: ReturnType<typeof setTimeout> | undefined;
      dateInp.addEventListener('input', () => {
        clearTimeout(dt);
        dt = setTimeout(async () => {
          await editMilestoneRow(view, file, items, mile, { date: milestoneDateFromInput(dateInp.value) }, flashSaved, rawKey);
        }, 350);
      });
      const titleInp = row.createEl('input', { type: 'text', cls: 'cad-pd-mile-title' });
      titleInp.value = m.title || '';
      titleInp.placeholder = 'Milestone title';
      let tt: ReturnType<typeof setTimeout> | undefined;
      titleInp.addEventListener('input', () => {
        clearTimeout(tt);
        tt = setTimeout(async () => {
          await editMilestoneRow(view, file, items, mile, { title: titleInp.value }, flashSaved, rawKey);
        }, 400);
      });
      const del = row.createEl('button', { cls: 'cad-btn cad-btn-sm cad-btn-danger', text: '×' });
      del.title = 'Delete milestone';
      del.addEventListener('click', async () => {
        const ref = milestoneRefAt(items, mile.index());
        if (!ref) return;
        if (!await writeRow(view, file, (c) => removeMilestoneByRef(c, rawKey, ref), MILESTONE_CHANGED, flashSaved)) return;
        mile.remove();
        view.render();
      });

      // Notes section — preview ⇄ textarea, indented under the milestone in markdown
      const notesEl = wrapper.createDiv({ cls: 'cad-mile-notes-section' });
      const renderNotesIdle = () => {
        notesEl.empty();
        const notes = mile.item()?.notes || '';
        const hasNotes = notes.trim().length > 0;
        if (hasNotes) {
          const preview = notesEl.createDiv({ cls: 'cad-mile-notes-preview' });
          preview.setText(notes);
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
        ta.value = mile.item()?.notes || '';
        ta.placeholder = 'Notes — context, follow-ups, what happened…';
        const autosize = () => {
          ta.style.height = 'auto';
          ta.style.height = Math.max(60, ta.scrollHeight + 2) + 'px';
        };
        let nt: ReturnType<typeof setTimeout> | undefined;
        const saveNotes = async () => {
          const notes = milestoneNotesFromInput(ta.value);
          if (notes === (mile.item()?.notes || '')) return;
          await editMilestoneRow(view, file, items, mile, { notes }, flashSaved, rawKey);
        };
        ta.addEventListener('input', () => {
          autosize();
          clearTimeout(nt);
          nt = setTimeout(saveNotes, 400);
        });
        ta.addEventListener('blur', async () => {
          clearTimeout(nt);
          await saveNotes();
          renderNotesIdle();
        });
        setTimeout(() => { ta.focus(); autosize(); }, 0);
      };
      renderNotesIdle();
    });
  };

  renderRows(milestones);

  addBtn.addEventListener('click', async () => {
    const next = addMilestone(milestones, new Date());
    if (!await writeRow(view, file, (c) => appendMilestone(c, rawKey, next[next.length - 1]), MILESTONE_CHANGED, flashSaved)) return;
    replaceItems(milestones, next);
    view.render();
  });
}

const TASK_CHANGED = 'That task changed in the note, so nothing was saved.';
const MILESTONE_CHANGED = 'That milestone changed in the note, so nothing was saved.';

/* One row's write: re-reads the note, applies `edit` (which touches only
   that row's lines, #76) and writes the result. When the row is gone from
   the note (`edit` gives null) it writes nothing and says so. */
async function writeRow(
  view: AppViewHost, file: TFile, edit: (content: string) => string | null, changedMessage: string, flashSaved: FlashSaved | undefined,
): Promise<boolean> {
  const content = await view.app.vault.read(file);
  const next = edit(content);
  if (next === null) {
    new Notice(changedMessage);
    return false;
  }
  if (next !== content) await view.app.vault.modify(file, next);
  if (typeof flashSaved === 'function') flashSaved();
  return true;
}

/* A milestone row's edit: rewrites that milestone's lines in the note,
   found by the ref of the row as it was, then patches the shared list. */
async function editMilestoneRow(
  view: AppViewHost, file: TFile, items: Milestone[], mile: RowHandle<Milestone>, patch: Partial<Milestone>,
  flashSaved: FlashSaved | undefined, rawKey: string,
): Promise<boolean> {
  const idx = mile.index();
  const ref = milestoneRefAt(items, idx);
  if (!ref) return false;
  const next = { ...items[idx], ...patch };
  if (!await writeRow(view, file, (c) => editMilestoneByRef(c, rawKey, ref, next), MILESTONE_CHANGED, flashSaved)) return false;
  return mile.patch(patch);
}

/* A task row's retitle: rewrites that task's line only, found by the ref
   of the row as it was, then patches the shared list. */
async function retitleTaskRow(
  view: AppViewHost, file: TFile, items: TaskItem[], task: RowHandle<TaskItem>, title: string, flashSaved: FlashSaved | undefined, rawKey: string,
): Promise<boolean> {
  const ref = taskRowRef(items, task);
  if (!ref) return false;
  if (!await writeRow(view, file, (c) => editProjectTaskByRef(c, rawKey, ref, title), TASK_CHANGED, flashSaved)) return false;
  return task.patch({ title });
}

function taskRowRef(items: TaskItem[], task: RowHandle<TaskItem>): TaskRef | null {
  const idx = task.index();
  return idx === -1 ? null : taskRefAt(items.map((item) => item.title || ''), idx);
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
      const task = rowHandle(items, t);
      const row = list.createDiv({ cls: 'cad-pd-task-row' + (t.done ? ' done' : '') });
      const cb = row.createEl('input', { type: 'checkbox' });
      cb.checked = !!t.done;
      cb.addEventListener('change', async () => {
        if (view.plugin.settings.taskManagementSystem === 'tasknotes') {
          const taskObj = fileTaskNotes[idx];
          await toggleTaskNotesTask(view.app, taskObj.file, cb.checked);
          await view._propagateTaskComplete(taskObj.title, cb.checked, { kind: 'tasknotes', file: taskObj.file });
        } else {
          await tickProjectTaskRow(view, file, items, task, cb.checked, flashSaved, rawKey);
        }
        view.render();
      });

      if (view.plugin.settings.taskManagementSystem === 'tasknotes') {
        const taskObj = fileTaskNotes[idx];
        const taskLink = row.createEl('a', { cls: 'cad-task-text', text: t.title });
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
            await retitleTaskRow(view, file, items, task, titleInp.value, flashSaved, rawKey);
          }, 400);
        });

        /* Bell — set or edit a reminder linked to this task. */
        const bellState = taskBell(findProjectTaskReminder(view.plugin, file.path, t.title || ''));
        const bell = row.createEl('button', { cls: bellState.cls, text: bellState.text });
        bell.title = bellState.title;
        bell.addEventListener('click', async () => {
          // A blank title is checked before anything is written (#50).
          const taskText = titleInp.value.trim();
          if (!taskText) {
            new Notice('Add a task title first.');
            titleInp.focus();
            return;
          }
          if (!await retitleTaskRow(view, file, items, task, titleInp.value, flashSaved, rawKey)) return;

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
          const ref = taskRowRef(items, task);
          if (!ref) return;
          if (!await writeRow(view, file, (c) => removeProjectTaskByRef(c, rawKey, ref), TASK_CHANGED, flashSaved)) return;
          task.remove();
          view.render();
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
    if (!await writeRow(view, file, (c) => appendProjectTask(c, rawKey), TASK_CHANGED, flashSaved)) return;
    replaceItems(tasks, addTask(tasks));
    view.render();
  });
}

/* A native row's tick: re-reads the note, finds the task the row showed
   by its ref, ticks that line only and propagates its text. When the task
   is gone from the section it writes nothing and says so. The caller
   re-renders once. */
async function tickProjectTaskRow(
  view: AppViewHost, file: TFile, items: TaskItem[], task: RowHandle<TaskItem>, checked: boolean, flashSaved: FlashSaved | undefined, rawKey: string,
): Promise<void> {
  const ref = taskRowRef(items, task);
  const content = await view.app.vault.read(file);
  const toggled = ref ? toggleProjectTaskByRef(content, rawKey, ref, checked) : null;
  if (!toggled) {
    new Notice('That task changed in the note, so nothing was ticked.');
    return;
  }
  await view.app.vault.modify(file, toggled.content);
  task.patch({ done: checked });
  if (typeof flashSaved === 'function') flashSaved();
  if (toggled.taskText) await view._propagateTaskComplete(toggled.taskText, checked, { kind: 'project', file });
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
