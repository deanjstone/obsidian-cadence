import { TFile } from 'obsidian';
import { CadenceReminderEditModal } from '../modals/reminder-edit';
import { listEntityFiles, projectNameFromPath } from '../utils/entities';
import { parseH2Sections, parseTasksList } from '../utils/parsing';
import { findProjectTaskReminder, reminderBucket, reminderTimeStr } from '../utils/reminders';
import type { Reminder, ReminderBucket } from '../types/reminders';
import type { TaskItem } from '../utils/parsing';
import type { AppViewHost } from './host';

/** Open reminders due at or before `now` (ms). An unparseable time never is. */
export function overdueCount(reminders: Reminder[] | undefined, now: number): number {
  const open = (reminders || []).filter((r) => !r.done);
  return open.filter((r) => r.when && new Date(r.when).getTime() <= now).length;
}

export function inboxOverdueCount(view: AppViewHost): number {
  return overdueCount(view.plugin.settings.reminders, Date.now());
}

const INBOX_SECTION_LABELS: Record<ReminderBucket, string> = { now: 'NOW · OVERDUE OR DUE WITHIN 1 HOUR', today: 'TODAY', week: 'THIS WEEK', later: 'LATER · UNSCHEDULED' };

export interface InboxSection {
  key: ReminderBucket;
  /** `LABEL · count`. */
  label: string;
  items: Reminder[];
}

/** The Inbox's open reminders: sorted by time (unscheduled last), ties and
    unscheduled items newest capture first, then grouped into the non-empty
    buckets in now / today / week / later order. Buckets come from
    reminderBucket, which reads the clock. The settings array is not sorted. */
export function inboxRows(reminders: Reminder[] | undefined): { count: number; subtitle: string; sections: InboxSection[] } {
  const all = (reminders || []).filter((r) => !r.done);

  // Sort: scheduled by when, captures by createdAt
  all.sort((a, b) => {
    const wa = a.when ? new Date(a.when).getTime() : Infinity;
    const wb = b.when ? new Date(b.when).getTime() : Infinity;
    if (wa !== wb) return wa - wb;
    const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return cb - ca;
  });

  // Bucket
  const buckets: Record<ReminderBucket, Reminder[]> = { now: [], today: [], week: [], later: [] };
  all.forEach((r) => buckets[reminderBucket(r.when)].push(r));

  const sections = (['now', 'today', 'week', 'later'] as ReminderBucket[])
    .filter((key) => buckets[key].length)
    .map((key) => ({ key, label: `${INBOX_SECTION_LABELS[key]} · ${buckets[key].length}`, items: buckets[key] }));
  return {
    count: all.length,
    subtitle: `${all.length} ${all.length === 1 ? 'item' : 'items'} · capture once, surface at the right time`,
    sections,
  };
}

/* ── Inbox (Planner reminders + captures) ── */
export async function renderInbox(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-inbox');
  const inbox = inboxRows(view.plugin.settings.reminders);

  view._renderPageHeader(root, 'Inbox', inbox.subtitle, (right) => {
    const captureBtn = right.createEl('button', { cls: 'cad-btn primary', text: '+ Quick capture' });
    captureBtn.addEventListener('click', () => view.plugin.openQuickCapture());
  });

  if (!inbox.count) {
    const empty = root.createDiv({ cls: 'cad-empty-state' });
    empty.createDiv({ cls: 'cad-empty-state-title', text: 'Inbox zero' });
    empty.createDiv({ cls: 'cad-empty-state-desc', text: 'Capture anything with + Quick capture above (or Cmd+Shift+I). Add a time and Cadence will remind you.' });
    return;
  }

  inbox.sections.forEach(({ key, label, items }) => {
    root.createDiv({ cls: 'cad-section-label-lg', text: label });
    const list = root.createDiv({ cls: 'cad-inbox-list' });
    items.forEach((r) => view._renderInboxRow(list, r, key));
  });

  /* ── PROJECT TASKS — every open `- [ ]` from every project's ## Tasks ── */
  await view._renderProjectTasksSection(root);
}

/** A project's open, titled tasks from its `## Tasks` section. */
export function openProjectTasks(content: string): TaskItem[] {
  const sections = parseH2Sections(content);
  return parseTasksList(sections['Tasks'] || '').filter((t) => !t.done && t.title);
}

export function projectTasksHeading(totalOpen: number, groupCount: number): string {
  return `PROJECT TASKS · ${totalOpen} open across ${groupCount} ${groupCount === 1 ? 'project' : 'projects'}`;
}

export async function renderProjectTasksSection(view: AppViewHost, root: HTMLElement): Promise<void> {
  const projectFiles = listEntityFiles(view.app, 'project');
  if (!projectFiles.length) return;

  /* Read each project's Tasks section + collect open tasks */
  const groups: Array<{ file: TFile; name: string | null; tasks: TaskItem[] }> = [];
  let totalOpen = 0;
  for (const file of projectFiles) {
    let content;
    try { content = await view.app.vault.read(file); }
    catch (_) { continue; }
    const open = openProjectTasks(content);
    if (!open.length) continue;
    totalOpen += open.length;
    groups.push({
      file,
      name: projectNameFromPath(view.app, file.path),
      tasks: open,
    });
  }

  if (!totalOpen) return;

  root.createDiv({ cls: 'cad-section-label-lg', text: projectTasksHeading(totalOpen, groups.length) });
  const wrap = root.createDiv({ cls: 'cad-pt-wrap' });

  groups.forEach((g) => {
    const card = wrap.createDiv({ cls: 'cad-pt-group' });
    const head = card.createDiv({ cls: 'cad-pt-group-head' });
    const link = head.createEl('a', { cls: 'cad-pt-group-link', text: '📁 ' + g.name });
    link.addEventListener('click', (e) => { e.preventDefault(); view.openEntityDetail('project', g.file); });
    head.createSpan({ cls: 'cad-pt-group-meta', text: `${g.tasks.length} open` });

    const list = card.createDiv({ cls: 'cad-pt-list' });
    g.tasks.forEach((t) => {
      const linked = findProjectTaskReminder(view.plugin, g.file.path, t.title);
      const row = list.createDiv({ cls: 'cad-pt-row' });
      row.createSpan({ cls: 'cad-pt-bullet', text: '•' });
      const txt = row.createSpan({ cls: 'cad-pt-text', text: t.title });
      void txt;
      if (linked && linked.when) {
        row.createSpan({ cls: 'cad-pt-when', text: reminderTimeStr(linked.when) });
      }
      const bell = row.createEl('button', {
        cls: 'cad-btn cad-btn-sm cad-pt-bell' + (linked ? ' linked' : ''),
        text: linked ? '🔔' : '🔕',
      });
      bell.title = linked ? 'Edit reminder' : 'Set a reminder';
      bell.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const existing = findProjectTaskReminder(view.plugin, g.file.path, t.title);
        if (existing) {
          new CadenceReminderEditModal(view.app, view.plugin, existing).open();
        } else {
          new CadenceReminderEditModal(view.app, view.plugin, {
            text: t.title,
            when: null,
            repeat: 'none',
            notes: '',
            project: g.file.path,
          }, { isNew: true }).open();
        }
      });
      row.addEventListener('click', () => view.openEntityDetail('project', g.file));
    });
  });
}

/** The repeat badge for a scheduled item; any repeat but none or daily reads weekly. */
export function repeatLabel(repeat: string | null | undefined): string | null {
  if (!repeat || repeat === 'none') return null;
  return repeat === 'daily' ? '↻ daily' : '↻ weekly';
}

/** The first non-blank notes line, cut to 117 characters plus '…' past 120. */
export function notesPreview(notes: string | null | undefined): string {
  if (!notes) return '';
  const previewLine = String(notes).split('\n').find((l) => l.trim()) || '';
  return previewLine.length > 120 ? previewLine.slice(0, 117) + '…' : previewLine;
}

/** "Tom." snooze: 9am local tomorrow, as an ISO string. */
export function tomorrowAtNine(now: Date): string {
  const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export type InboxRowAction = 'snooze15' | 'snooze60' | 'tomorrow' | 'schedule' | 'edit' | 'done' | 'delete';

/** An Inbox row's action buttons, in order. */
export function inboxRowActions(scheduled: boolean): Array<{ action: InboxRowAction; label: string; title: string }> {
  const timed: Array<{ action: InboxRowAction; label: string; title: string }> = scheduled
    ? [
      { action: 'snooze15', label: '+15m', title: 'Snooze 15 minutes' },
      { action: 'snooze60', label: '+1h', title: 'Snooze 1 hour' },
      { action: 'tomorrow', label: 'Tom.', title: 'Snooze to tomorrow 9am' },
    ]
    : [{ action: 'schedule', label: 'Schedule', title: 'Add a time' }];
  return [
    ...timed,
    { action: 'edit', label: 'Edit', title: 'Edit details + notes' },
    { action: 'done', label: 'Done', title: 'Mark done' },
    { action: 'delete', label: '×', title: 'Delete' },
  ];
}

export function renderInboxRow(view: AppViewHost, parent: HTMLElement, r: Reminder, bucket: ReminderBucket): void {
  const row = parent.createDiv({ cls: 'cad-inbox-row' + (bucket === 'now' ? ' overdue' : '') });

  const left = row.createDiv({ cls: 'cad-inbox-row-left' });
  const tWrap = left.createDiv({ cls: 'cad-inbox-time' });
  if (r.when) {
    tWrap.createSpan({ cls: 'cad-inbox-time-text', text: reminderTimeStr(r.when) });
    const repeat = repeatLabel(r.repeat);
    if (repeat) tWrap.createSpan({ cls: 'cad-inbox-repeat', text: repeat });
  } else {
    tWrap.createSpan({ cls: 'cad-inbox-time-text muted', text: 'unscheduled' });
  }

  const main = row.createDiv({ cls: 'cad-inbox-row-main' });
  main.createDiv({ cls: 'cad-inbox-row-text', text: r.text });

  if (r.project) {
    const chipRow = main.createDiv({ cls: 'cad-inbox-row-meta-row' });
    const chip = chipRow.createEl('a', { cls: 'cad-rem-project-chip', text: '📁 ' + (projectNameFromPath(view.app, r.project) || 'Project') });
    chip.title = 'Open project';
    chip.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const file = view.app.vault.getAbstractFileByPath(r.project!);
      if (file && file instanceof TFile) view.openEntityDetail('project', file);
    });
  }

  const preview = notesPreview(r.notes);
  if (preview) {
    const note = main.createDiv({ cls: 'cad-inbox-row-notes' });
    note.createSpan({ cls: 'cad-inbox-row-notes-icon', text: '📝 ' });
    note.appendText(preview);
  }

  // Row body click → open edit modal
  const openEdit = () => new CadenceReminderEditModal(view.app, view.plugin, r).open();
  left.addEventListener('click', openEdit);
  main.addEventListener('click', openEdit);
  left.style.cursor = 'pointer';
  main.style.cursor = 'pointer';

  const actions = row.createDiv({ cls: 'cad-inbox-actions' });
  const mk = (label: string, title: string, fn: () => unknown) => {
    const b = actions.createEl('button', { cls: 'cad-btn cad-btn-sm', text: label });
    b.title = title;
    b.addEventListener('click', (ev) => { ev.stopPropagation(); fn(); });
    return b;
  };
  const handlers: Record<InboxRowAction, () => unknown> = {
    snooze15: () => view.plugin.snoozeReminder(r.id, 15 * 60 * 1000),
    snooze60: () => view.plugin.snoozeReminder(r.id, 60 * 60 * 1000),
    tomorrow: () => view.plugin.updateReminder(r.id, { when: tomorrowAtNine(new Date()), notified: false }),
    schedule: () => openEdit(),
    edit: () => openEdit(),
    done: async () => {
      await view.plugin.completeReminder(r.id);
      if (r.text) await view._propagateTaskComplete(r.text, true, { kind: 'reminder', id: r.id });
    },
    delete: () => {
      if (confirm('Delete this reminder?')) view.plugin.deleteReminder(r.id);
    },
  };
  inboxRowActions(!!r.when).forEach(({ action, label, title }) => {
    const b = mk(label, title, handlers[action]);
    if (action === 'done') b.classList.add('primary');
    if (action === 'delete') b.classList.add('cad-btn-danger');
  });
}
