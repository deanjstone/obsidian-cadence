import { TFile } from 'obsidian';
import { CadenceReminderEditModal } from '../modals/reminder-edit';
import { listEntityFiles, projectNameFromPath } from '../utils/entities';
import { parseH2Sections, parseTasksList } from '../utils/parsing';
import { findProjectTaskReminder, reminderBucket, reminderTimeStr } from '../utils/reminders';
import type { Reminder, ReminderBucket } from '../types/reminders';
import type { TaskItem } from '../utils/parsing';
import type { AppViewHost } from './host';

export function inboxOverdueCount(view: AppViewHost): number {
  const reminders = (view.plugin.settings.reminders || []).filter((r) => !r.done);
  const now = Date.now();
  return reminders.filter((r) => r.when && new Date(r.when).getTime() <= now).length;
}

/* ── Inbox (Planner reminders + captures) ── */
export async function renderInbox(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-inbox');
  const all = (view.plugin.settings.reminders || []).filter((r) => !r.done);

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

  view._renderPageHeader(root, 'Inbox', `${all.length} ${all.length === 1 ? 'item' : 'items'} · capture once, surface at the right time`, (right) => {
    const captureBtn = right.createEl('button', { cls: 'cad-btn primary', text: '+ Quick capture' });
    captureBtn.addEventListener('click', () => view.plugin.openQuickCapture());
  });

  if (!all.length) {
    const empty = root.createDiv({ cls: 'cad-empty-state' });
    empty.createDiv({ cls: 'cad-empty-state-title', text: 'Inbox zero' });
    empty.createDiv({ cls: 'cad-empty-state-desc', text: 'Capture anything with + Quick capture above (or Cmd+Shift+I). Add a time and Cadence will remind you.' });
    return;
  }

  const sectionLabels: Record<ReminderBucket, string> = { now: 'NOW · OVERDUE OR DUE WITHIN 1 HOUR', today: 'TODAY', week: 'THIS WEEK', later: 'LATER · UNSCHEDULED' };
  (['now', 'today', 'week', 'later'] as ReminderBucket[]).forEach((key) => {
    const items = buckets[key];
    if (!items.length) return;
    root.createDiv({ cls: 'cad-section-label-lg', text: `${sectionLabels[key]} · ${items.length}` });
    const list = root.createDiv({ cls: 'cad-inbox-list' });
    items.forEach((r) => view._renderInboxRow(list, r, key));
  });

  /* ── PROJECT TASKS — every open `- [ ]` from every project's ## Tasks ── */
  await view._renderProjectTasksSection(root);
}

export async function renderProjectTasksSection(view: AppViewHost, root: HTMLElement): Promise<void> {
  const projectFiles = listEntityFiles(view.app, 'project');
  if (!projectFiles.length) return;

  /* Read each project's Tasks section + collect open tasks */
  const groups = [];
  let totalOpen = 0;
  for (const file of projectFiles) {
    let content;
    try { content = await view.app.vault.read(file); }
    catch (_) { continue; }
    const sections = parseH2Sections(content);
    const tasksText = sections['Tasks'] || '';
    if (!tasksText.trim()) continue;
    const tasks = parseTasksList(tasksText);
    const open = tasks.filter((t) => !t.done && t.title);
    if (!open.length) continue;
    totalOpen += open.length;
    groups.push({
      file,
      name: projectNameFromPath(view.app, file.path),
      tasks: open,
    });
  }

  if (!totalOpen) return;

  root.createDiv({ cls: 'cad-section-label-lg', text: `PROJECT TASKS · ${totalOpen} open across ${groups.length} ${groups.length === 1 ? 'project' : 'projects'}` });
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

export function renderInboxRow(view: AppViewHost, parent: HTMLElement, r: Reminder, bucket: ReminderBucket): void {
  const row = parent.createDiv({ cls: 'cad-inbox-row' + (bucket === 'now' ? ' overdue' : '') });

  const left = row.createDiv({ cls: 'cad-inbox-row-left' });
  const tWrap = left.createDiv({ cls: 'cad-inbox-time' });
  if (r.when) {
    tWrap.createSpan({ cls: 'cad-inbox-time-text', text: reminderTimeStr(r.when) });
    if (r.repeat && r.repeat !== 'none') {
      tWrap.createSpan({ cls: 'cad-inbox-repeat', text: r.repeat === 'daily' ? '↻ daily' : '↻ weekly' });
    }
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

  if (r.notes) {
    const previewLine = String(r.notes).split('\n').find((l) => l.trim()) || '';
    if (previewLine) {
      const note = main.createDiv({ cls: 'cad-inbox-row-notes' });
      note.createSpan({ cls: 'cad-inbox-row-notes-icon', text: '📝 ' });
      note.appendText(previewLine.length > 120 ? previewLine.slice(0, 117) + '…' : previewLine);
    }
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
  if (r.when) {
    mk('+15m', 'Snooze 15 minutes', () => view.plugin.snoozeReminder(r.id, 15 * 60 * 1000));
    mk('+1h', 'Snooze 1 hour', () => view.plugin.snoozeReminder(r.id, 60 * 60 * 1000));
    mk('Tom.', 'Snooze to tomorrow 9am', () => {
      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
      view.plugin.updateReminder(r.id, { when: d.toISOString(), notified: false });
    });
  } else {
    mk('Schedule', 'Add a time', () => openEdit());
  }
  mk('Edit', 'Edit details + notes', () => openEdit());
  const doneBtn = mk('Done', 'Mark done', async () => {
    await view.plugin.completeReminder(r.id);
    if (r.text) await view._propagateTaskComplete(r.text, true, { kind: 'reminder', id: r.id });
  });
  doneBtn.classList.add('primary');
  const delBtn = mk('×', 'Delete', () => {
    if (confirm('Delete this reminder?')) view.plugin.deleteReminder(r.id);
  });
  delBtn.classList.add('cad-btn-danger');
}
