import { Platform, TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceReminderEditModal } from '../modals/reminder-edit';
import { addDays, dailyNotePath, greeting, startOfDay, startOfWeek, ymd } from '../utils/dates';
import { ensureDailyNote } from '../utils/daily-notes';
import {
  entityValue, listEntities, listEntityFiles, projectNameFromPath, readEntity, readProjectMeta,
} from '../utils/entities';
import { fmtValue, pctBand } from '../utils/format';
import { parseLinkValues, parseSections, replaceSection } from '../utils/parsing';
import { reminderTimeStr } from '../utils/reminders';
import { listTaskNotesTasks, toggleTaskNotesTask } from '../utils/tasknotes';
import type { Entity, ProjectMeta, TaskNotesTask } from '../types/entities';
import type { Reminder } from '../types/reminders';
import type { Milestone } from '../utils/parsing';
import type { AppViewHost } from './host';

/* Home, the command centre: the "Top of the day" briefing and the eight
   cards. Set by #12; see src/views/README.md for the seam. */

/** One briefing row. Items come out in priority order: overdue first, then
    time-bound, opportunities and wins. */
export interface BriefingItem {
  icon: string;
  /** A cad-tone-* suffix; the row falls back to emerald. */
  tone?: string;
  text: string;
  action?: () => void;
}

export async function renderHome(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-home');
  const settings = view.plugin.settings;

  /* Header */
  const today = new Date();
  const dateStr = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  view._renderPageHeader(root, `${greeting()}.`, dateStr, (right) => {
    const mk = (label: string, fn: () => void) => {
      const b = right.createEl('button', { cls: 'cad-btn', text: label });
      b.addEventListener('click', fn);
      return b;
    };
    mk('+ Task', () => view._quickAddTodayTask());
    mk('+ Deal', () => view._createEntityFromPrompt('deal'));
    mk('+ Contact', () => view._createEntityFromPrompt('contact'));
    mk('+ Project', () => view._createEntityFromPrompt('project'));
    const newInbox = mk('+ Inbox', () => view.plugin.openQuickCapture());
    newInbox.classList.add('primary');
  });

  /* Top of the day — assistant-style briefing */
  await view._renderBriefing(root);

  /* Two-column grid */
  const cols = root.createDiv({ cls: 'cad-home-cols' });
  const left = cols.createDiv({ cls: 'cad-home-col' });
  const right = cols.createDiv({ cls: 'cad-home-col' });

  /* ─── LEFT: Inbox + Today + Week + Upcoming + Partners ─── */
  await view._homeInboxCard(left);
  await view._homeTodayCard(left);
  await view._homeWeekCard(left);
  await view._homeUpcomingCard(left);
  await view._homePartnersCard(left);

  /* ─── RIGHT: Projects + Pipeline + Activities ─── */
  await view._homeProjectsCard(right);
  await view._homePipelineCard(right);
  await view._homeActivitiesCard(right);


}

export function homeCard(view: AppViewHost, parent: HTMLElement, title: string, action?: (head: HTMLElement) => void, tone?: string): HTMLElement {
  const card = parent.createDiv({ cls: 'cad-home-card' });
  if (tone) card.dataset.tone = tone;
  const head = card.createDiv({ cls: 'cad-home-card-head' });
  head.createDiv({ cls: 'cad-home-card-title', text: title });
  if (typeof action === 'function') action(head);
  return card.createDiv({ cls: 'cad-home-card-body' });
}

export async function renderBriefing(view: AppViewHost, root: HTMLElement): Promise<void> {
  const items = await view._computeBriefing();
  const card = root.createDiv({ cls: 'cad-briefing' });

  const head = card.createDiv({ cls: 'cad-briefing-head' });
  head.createDiv({ cls: 'cad-briefing-eyebrow', text: 'TOP OF THE DAY' });
  head.createDiv({ cls: 'cad-briefing-headline', text: view._briefingHeadline(items) });

  if (!items.length) {
    card.createDiv({ cls: 'cad-briefing-empty', text: 'Nothing flagged. Make today count.' });
    return;
  }

  const { shown, hiddenCount } = visibleBriefing(items, !!(Platform && Platform.isMobile));

  const list = card.createDiv({ cls: 'cad-briefing-list' });
  shown.forEach((it) => {
    const row = list.createDiv({ cls: `cad-briefing-row cad-tone-${it.tone || 'emerald'}` });
    row.createSpan({ cls: 'cad-briefing-icon', text: it.icon });
    row.createSpan({ cls: 'cad-briefing-text', text: it.text });
    if (it.action) {
      row.classList.add('clickable');
      row.addEventListener('click', it.action);
    }
  });
  if (hiddenCount > 0) {
    const more = card.createDiv({ cls: 'cad-briefing-more' });
    more.setText(`+${hiddenCount} more · scroll down for the full picture`);
  }
}

/** On mobile, trim to the top 3 most urgent. computeBriefing already emits
    items in priority order (overdue → time → opportunity → wins), so a
    simple slice keeps what matters most. */
export function visibleBriefing<T>(items: T[], isMobile: boolean): { shown: T[]; hiddenCount: number } {
  const hiddenCount = isMobile && items.length > 3 ? items.length - 3 : 0;
  return { shown: isMobile && items.length > 3 ? items.slice(0, 3) : items, hiddenCount };
}

export function briefingHeadline(items: BriefingItem[]): string {
  const hasOverdue = items.some((i) => i.tone === 'rose');
  if (hasOverdue) return 'A couple of things need attention this morning.';
  if (items.length >= 4) return "Here's what's worth your attention today.";
  if (items.length === 0) return 'Inbox zero. Clear runway.';
  return "Here's what's on your radar.";
}

/** Where a briefing row leads: a surface, a file's detail form, or a project. */
export type BriefingTarget =
  | { kind: 'mode'; mode: string }
  | { kind: 'file'; file: TFile }
  | { kind: 'project'; file: TFile };

/** A briefing row as plain data; loadBriefing turns the target into a click action. */
export interface BriefingEntry {
  icon: string;
  tone: string;
  text: string;
  target: BriefingTarget;
}

/** A project's next open milestone, as readProjectMeta reports it. */
export interface ProjectNextMilestone {
  file: TFile;
  name: string | null;
  next: Milestone | null;
}

/** What the briefing reads, gathered by loadBriefing. */
export interface BriefingData {
  taskManagementSystem?: string;
  /** Open tasks scheduled today, or null when they could not be read. */
  openTasks: number | null;
  reminders?: Reminder[];
  deals: Entity[];
  contacts: Entity[];
  /** One per project note that could be read. */
  projects: ProjectNextMilestone[];
}

/** The briefing maths: up to seven entries, in priority order. */
export function computeBriefing(data: BriefingData, now: Date): BriefingEntry[] {
  const items: BriefingEntry[] = [];
  const dealDef = ENTITIES.deal;
  const contactDef = ENTITIES.contact;
  const today = startOfDay(now);
  const todayMs = today.getTime();
  const nowMs = now.getTime();

  /* 1. Open tasks today */
  const openTasks = data.openTasks ?? 0;
  if (openTasks > 0) {
    items.push({
      icon: '🎯',
      tone: 'emerald',
      text: data.taskManagementSystem === 'tasknotes'
        ? `${openTasks} open ${openTasks === 1 ? 'task' : 'tasks'} scheduled for today`
        : `${openTasks} open ${openTasks === 1 ? 'task' : 'tasks'} on today's note`,
      target: { kind: 'mode', mode: 'planner.today' },
    });
  }

  /* 2. Overdue reminders */
  const reminders = (data.reminders || []).filter((r) => !r.done);
  const overdue = reminders.filter((r) => r.when && new Date(r.when).getTime() <= nowMs);
  if (overdue.length) {
    const ex = overdue[0];
    const exTxt = ex.text.length > 50 ? ex.text.slice(0, 47) + '…' : ex.text;
    items.push({
      icon: '⚠',
      tone: 'rose',
      text: overdue.length === 1
        ? `Overdue reminder — "${exTxt}"`
        : `${overdue.length} overdue reminders — "${exTxt}" + ${overdue.length - 1} more`,
      target: { kind: 'mode', mode: 'planner.inbox' },
    });
  }

  /* 3. Reminders due later today */
  const dueToday = reminders.filter((r) => {
    if (!r.when) return false;
    const w = new Date(r.when).getTime();
    return w > nowMs && w < todayMs + 86400000;
  });
  if (dueToday.length) {
    items.push({
      icon: '⏰',
      tone: 'mint',
      text: `${dueToday.length} ${dueToday.length === 1 ? 'reminder' : 'reminders'} due later today`,
      target: { kind: 'mode', mode: 'planner.inbox' },
    });
  }

  /* 4. Deals closing this week */
  const deals = data.deals;
  const weekEnd = todayMs + 7 * 86400000;
  const closingThisWeek = deals.filter((e) => {
    const stage = String(entityValue(e, 'stage', dealDef));
    if (['Won', 'Lost'].includes(stage)) return false;
    const closeBy = entityValue(e, 'closeBy', dealDef);
    if (!closeBy) return false;
    const d = new Date(closeBy as string);
    return !isNaN(d.getTime()) && d.getTime() >= todayMs && d.getTime() <= weekEnd;
  });
  if (closingThisWeek.length) {
    const value = closingThisWeek.reduce((s, e) => s + (Number(entityValue(e, 'value', dealDef)) || 0), 0);
    items.push({
      icon: '💼',
      tone: 'sky',
      text: `${closingThisWeek.length} ${closingThisWeek.length === 1 ? 'deal closes' : 'deals close'} this week · ${fmtValue(value, 'currency')}`,
      target: { kind: 'mode', mode: 'crm.pipeline' },
    });
  }

  /* 5. Stale contacts on open deals (>30 days since lastContact) */
  const contacts = data.contacts;
  const openDeals = deals.filter((e) => !['Won', 'Lost'].includes(String(entityValue(e, 'stage', dealDef))));
  const dealContactNames = new Set(
    openDeals.map((d) => String(entityValue(d, 'contact', dealDef) || '').trim()).filter(Boolean)
  );
  const staleCutoffMs = todayMs - 30 * 86400000;
  let staleSample = null as { contact: Entity; name: string; lcMs: number | null } | null;
  let staleCount = 0;
  contacts.forEach((c) => {
    const name = String(entityValue(c, 'name', contactDef) || '').trim();
    if (!name || !dealContactNames.has(name)) return;
    const lc = entityValue(c, 'lastContact', contactDef);
    const lcMs = lc ? new Date(lc as string).getTime() : null;
    if (lcMs != null && !isNaN(lcMs) && lcMs >= staleCutoffMs) return;
    staleCount++;
    if (!staleSample) staleSample = { contact: c, name, lcMs };
  });
  if (staleSample) {
    const days = staleSample.lcMs ? Math.floor((todayMs - staleSample.lcMs) / 86400000) : null;
    const linkedDeal = openDeals.find((d) => String(entityValue(d, 'contact', dealDef) || '').trim() === staleSample!.name);
    const dealName = linkedDeal ? entityValue(linkedDeal, 'title', dealDef) || '' : '';
    const ago = days === null ? 'never contacted' : `${days} ${days === 1 ? 'day' : 'days'} quiet`;
    const more = staleCount > 1 ? ` (+${staleCount - 1} more)` : '';
    items.push({
      icon: '👤',
      tone: 'warn',
      text: `${staleSample.name} — ${ago}${dealName ? ` · ${dealName}` : ''}${more}`,
      target: { kind: 'file', file: staleSample.contact.file },
    });
  }

  /* 6. Upcoming project milestones (next 14 days) */
  const upcoming: Array<{ file: TFile; milestone: Milestone; name: string | null }> = [];
  for (const p of data.projects) {
    if (p.next && p.next.date) {
      const ms = p.next.date.getTime();
      if (ms >= todayMs && ms <= todayMs + 14 * 86400000) {
        upcoming.push({ file: p.file, milestone: p.next, name: p.name });
      }
    }
  }
  upcoming.sort((a, b) => (a.milestone.date as unknown as number) - (b.milestone.date as unknown as number));
  if (upcoming.length) {
    const m = upcoming[0];
    const days = Math.max(0, Math.ceil((m.milestone.date!.getTime() - todayMs) / 86400000));
    const dayStr = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
    const title = m.milestone.title || 'milestone';
    items.push({
      icon: '📅',
      tone: 'mint',
      text: `${m.name} · "${title}" — due ${dayStr}`,
      target: { kind: 'project', file: m.file },
    });
  }

  /* 7. Recent wins (deals moved to Won in last 7 days) */
  const winCutoff = nowMs - 7 * 86400000;
  const recentWins = deals.filter((e) => {
    if (String(entityValue(e, 'stage', dealDef)) !== 'Won') return false;
    return e.file && e.file.stat && e.file.stat.mtime >= winCutoff;
  });
  if (recentWins.length) {
    const value = recentWins.reduce((s, e) => s + (Number(entityValue(e, 'value', dealDef)) || 0), 0);
    items.push({
      icon: '🎉',
      tone: 'emerald',
      text: `${recentWins.length} ${recentWins.length === 1 ? 'deal won' : 'deals won'} this week · ${fmtValue(value, 'currency')}`,
      target: { kind: 'mode', mode: 'reports.sales' },
    });
  }

  return items;
}

/* Gathers what the briefing reads (in the legacy order: tasks, deals,
   contacts, then each project note), runs computeBriefing and turns each
   entry's target into a click action. */
export async function loadBriefing(view: AppViewHost): Promise<BriefingItem[]> {
  const settings = view.plugin.settings;

  /* 1. Open tasks today */
  let openTasks: number | null = null;
  try {
    if (settings.taskManagementSystem === 'tasknotes') {
      const todayYmd = ymd(new Date());
      const allTaskNotes = listTaskNotesTasks(view.app);
      openTasks = allTaskNotes.filter(t => t.scheduled === todayYmd && !t.done).length;
    } else {
      const file = await ensureDailyNote(view.app, settings);
      const content = await view.app.vault.read(file);
      const parsed = parseSections(content, settings);
      openTasks = parsed.tasks.filter((l) => / \[ \] /.test(l)).length;
    }
  } catch (_) { }

  const deals = listEntities(view.app, 'deal');
  const contacts = listEntities(view.app, 'contact');

  /* 6. Each project's next milestone */
  const projects: ProjectNextMilestone[] = [];
  for (const f of listEntityFiles(view.app, 'project')) {
    try {
      const meta = await readProjectMeta(view.app, f);
      projects.push({ file: f, name: projectNameFromPath(view.app, f.path), next: meta.next });
    } catch (_) { }
  }

  const entries = computeBriefing({
    taskManagementSystem: settings.taskManagementSystem,
    openTasks,
    reminders: settings.reminders,
    deals,
    contacts,
    projects,
  }, new Date());
  return entries.map(({ icon, tone, text, target }) => ({ icon, tone, text, action: briefingAction(view, target) }));
}

function briefingAction(view: AppViewHost, target: BriefingTarget): () => void {
  if (target.kind === 'file') return () => view.openEntityDetailFromFile(target.file);
  if (target.kind === 'project') return () => view.openEntityDetail('project', target.file);
  return () => view.setMode(target.mode);
}

/* ── Inbox card ── */

/** Open reminders, the overdue count, the card's title and tone, and the
    first five rows by time (unscheduled last). */
export function selectInboxCard(allReminders: Reminder[] | undefined, now: Date) {
  const nowMs = now.getTime();
  const reminders = (allReminders || []).filter((r) => !r.done);
  const isOverdue = (r: Reminder) => !!r.when && new Date(r.when).getTime() <= nowMs;
  const overdueCount = reminders.filter(isOverdue).length;
  const tone = overdueCount > 0 ? 'rose' : 'sky';
  const title = `INBOX — ${reminders.length} item${reminders.length === 1 ? '' : 's'}${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`;

  // Sort: scheduled by when ascending, unscheduled fall to the end
  const sorted = [...reminders].sort((a, b) => {
    const wa = a.when ? new Date(a.when).getTime() : Infinity;
    const wb = b.when ? new Date(b.when).getTime() : Infinity;
    return wa - wb;
  });
  const rows = sorted.slice(0, 5).map((reminder) => ({ reminder, overdue: isOverdue(reminder) }));
  return { reminders, overdueCount, tone, title, rows };
}

/** An inbox row's meta bits: project, repeat and the first note line. */
export function inboxRowMeta(r: Reminder, projectName: (path: string) => string | null): string[] {
  const metaBits: string[] = [];
  if (r.project) metaBits.push(`📁 ${projectName(r.project) || 'project'}`);
  if (r.repeat && r.repeat !== 'none') metaBits.push(r.repeat === 'daily' ? '↻ daily' : '↻ weekly');
  if (r.notes) {
    const firstLine = String(r.notes).split('\n').find((l) => l.trim()) || '';
    if (firstLine) metaBits.push(`📝 ${firstLine.length > 60 ? firstLine.slice(0, 57) + '…' : firstLine}`);
  }
  return metaBits;
}

export async function homeInboxCard(view: AppViewHost, parent: HTMLElement): Promise<void> {
  const { reminders, tone, title: headTitle, rows } = selectInboxCard(view.plugin.settings.reminders, new Date());

  const body = view._homeCard(parent, headTitle, (head) => {
    const cap = head.createEl('a', { cls: 'cad-home-card-link', text: '+ Capture' });
    cap.style.marginRight = '12px';
    cap.addEventListener('click', (e) => { e.preventDefault(); view.plugin.openQuickCapture(); });
    const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Inbox →' });
    link.addEventListener('click', (e) => { e.preventDefault(); view.setMode('planner.inbox'); });
  }, tone);

  if (!reminders.length) {
    body.createDiv({ cls: 'cad-empty', text: 'Inbox zero — capture anything with + Inbox above (or Cmd+Shift+I).' });
    return;
  }

  rows.forEach(({ reminder: r, overdue }) => {
    const row = body.createDiv({ cls: 'cad-home-row' });
    if (overdue) row.classList.add('overdue');
    row.createDiv({ cls: 'cad-home-row-date', text: r.when ? reminderTimeStr(r.when) : 'unscheduled' });
    const main = row.createDiv({ cls: 'cad-home-row-main' });
    main.createDiv({ cls: 'cad-home-row-title', text: r.text });
    const metaBits = inboxRowMeta(r, (path) => projectNameFromPath(view.app, path));
    if (metaBits.length) main.createDiv({ cls: 'cad-home-row-meta', text: metaBits.join('  ·  ') });
    row.addEventListener('click', () => new CadenceReminderEditModal(view.app, view.plugin, r).open());
  });
}

/* ── Today card ── */

const TASK_PREFIX = /^\s*-\s\[(x|X| )\]\s/;

/** TaskNotes tasks scheduled on `todayYmd`, and their checklist lines. */
export function taskNotesToday(allTaskNotes: TaskNotesTask[], todayYmd: string): { tasks: TaskNotesTask[]; lines: string[] } {
  const tasks = allTaskNotes.filter(t => t.scheduled === todayYmd);
  return { tasks, lines: tasks.map(t => `- [${t.done ? 'x' : ' '}] ${t.title}`) };
}

/** The Today card's counts, title and one row per checklist line. */
export function selectTodayCard(tasksList: string[]) {
  const open = tasksList.filter((l) => / \[ \] /.test(l));
  const done = tasksList.filter((l) => / \[(x|X)\] /.test(l));
  const rows = tasksList.map((rawLine) => ({
    checked: / \[(x|X)\] /.test(rawLine),
    text: rawLine.replace(TASK_PREFIX, ''),
  }));
  return { open: open.length, done: done.length, title: `TODAY — ${open.length} open · ${done.length} done`, rows };
}

/** Ticks (or unticks) the line at `idx`, and returns the new lines with the
    task's trimmed text. */
export function toggleTaskLine(tasks: string[], idx: number, checked: boolean): { tasks: string[]; taskText: string } {
  const taskLine = tasks[idx] || '';
  const taskText = taskLine.replace(TASK_PREFIX, '').trim();
  const newTasks = tasks.map((line, i) => {
    if (i !== idx) return line;
    return checked
      ? line.replace(/^\s*-\s\[\s\]\s/, '- [x] ')
      : line.replace(/^\s*-\s\[(x|X)\]\s/, '- [ ] ');
  });
  return { tasks: newTasks, taskText };
}

export async function homeTodayCard(view: AppViewHost, parent: HTMLElement): Promise<void> {
  const settings = view.plugin.settings;
  let tasksList: string[] = [];
  let todayTaskNotes: TaskNotesTask[] = [];
  let file: TFile | null = null;

  if (settings.taskManagementSystem === 'tasknotes') {
    const todayYmd = ymd(new Date());
    const today = taskNotesToday(listTaskNotesTasks(view.app), todayYmd);
    todayTaskNotes = today.tasks;
    tasksList = today.lines;
  } else {
    file = await ensureDailyNote(view.app, settings);
    const content = await view.app.vault.read(file);
    const parsed = parseSections(content, settings);
    tasksList = parsed.tasks;
  }

  const { title, rows } = selectTodayCard(tasksList);

  const body = view._homeCard(parent, title, (head) => {
    const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Today →' });
    link.addEventListener('click', (e) => { e.preventDefault(); view.setMode('planner.today'); });
  }, 'emerald');

  if (!tasksList.length) {
    body.createDiv({ cls: 'cad-empty', text: 'No tasks yet — add one with + Task above.' });
    return;
  }

  rows.forEach(({ checked, text }, idx) => {
    const row = body.createDiv({ cls: 'cad-home-task' + (checked ? ' done' : '') });
    const cb = row.createEl('input', { type: 'checkbox' });
    cb.checked = checked;
    cb.addEventListener('change', async () => {
      if (settings.taskManagementSystem === 'tasknotes') {
        const taskObj = todayTaskNotes[idx];
        await toggleTaskNotesTask(view.app, taskObj.file, cb.checked);
      } else {
        const cur = await view.app.vault.read(file!);
        const cp = parseSections(cur, settings);
        const { tasks: newTasks, taskText } = toggleTaskLine(cp.tasks, idx, cb.checked);
        const next = replaceSection(cur, settings.tasksHeading, newTasks.join('\n'));
        await view.app.vault.modify(file!, next);
        if (taskText) {
          await view._propagateTaskComplete(taskText, cb.checked, { kind: 'daily', file: file!, date: new Date() });
        }
      }
      view.render();
    });

    if (settings.taskManagementSystem === 'tasknotes') {
      const taskObj = todayTaskNotes[idx];
      const taskLink = row.createEl('a', { cls: 'cad-task-text', text });
      taskLink.style.cursor = 'pointer';
      taskLink.addEventListener('click', (e) => {
        e.preventDefault();
        view.app.workspace.openLinkText(taskObj.file.path, '', false);
      });
    } else {
      row.createSpan({ cls: 'cad-task-text', text });
    }

    /* Project link button + chip */
    let linkedProject = null;
    if (settings.taskManagementSystem === 'tasknotes') {
      const taskObj = todayTaskNotes[idx];
      if (taskObj.projects) {
        const parsed = parseLinkValues(taskObj.projects);
        if (parsed.length > 0) {
          const projFile = view.app.vault.getMarkdownFiles().find(f => f.basename === parsed[0].target);
          if (projFile) {
            linkedProject = projFile.path;
          }
        }
      }
    } else {
      linkedProject = view._getTaskProjectLink(file!.path, text);
    }

    if (linkedProject) {
      const chip = row.createEl('a', { cls: 'cad-task-proj-chip', text: '📁 ' + (projectNameFromPath(view.app, linkedProject) || 'Project') });
      chip.title = 'Open linked project';
      chip.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const f = view.app.vault.getAbstractFileByPath(linkedProject);
        if (f && f instanceof TFile) view.openEntityDetail('project', f);
      });
    }

    if (settings.taskManagementSystem !== 'tasknotes') {
      const linkBtn = row.createEl('button', { cls: 'cad-task-link-btn' + (linkedProject ? ' linked' : ''), text: linkedProject ? '✎' : '📁' });
      linkBtn.title = linkedProject ? 'Change linked project' : 'Link to a project';
      linkBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        view._openTaskProjectPicker(file!.path, text, linkedProject);
      });
    }
  });
}

/* ── This-week card ── */

/** Open and done counts over checklist lines. */
export function countTaskLines(lines: string[]): { open: number; done: number } {
  let open = 0, done = 0;
  lines.forEach((l) => { if (/ \[(x|X)\] /.test(l)) done++; else if (/ \[ \] /.test(l)) open++; });
  return { open, done };
}

/** Open and done counts over TaskNotes tasks scheduled on one of `weekYmds`. */
export function countWeekTaskNotes(allTasks: TaskNotesTask[], weekYmds: string[]): { open: number; done: number } {
  let open = 0, done = 0;
  allTasks.forEach((t) => {
    if (weekYmds.includes(t.scheduled)) {
      if (t.done) done++;
      else open++;
    }
  });
  return { open, done };
}

/** The week card's title, percentage, band and label. */
export function weekProgress(open: number, done: number) {
  const total = open + done;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return {
    total,
    pct,
    band: pctBand(pct),
    title: `THIS WEEK — ${done}/${total} done`,
    label: total ? `${done} of ${total} tasks completed` : 'No tasks logged this week yet',
  };
}

export async function homeWeekCard(view: AppViewHost, parent: HTMLElement): Promise<void> {
  const settings = view.plugin.settings;
  const weekStart = startOfWeek(new Date(), settings.weekStartsOn);
  let open = 0, done = 0;

  if (settings.taskManagementSystem === 'tasknotes') {
    const allTasks = listTaskNotesTasks(view.app);
    const weekDatesList = Array.from({ length: 7 }, (_, i) => ymd(addDays(weekStart, i)));
    ({ open, done } = countWeekTaskNotes(allTasks, weekDatesList));
  } else {
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const f = view.app.vault.getAbstractFileByPath(dailyNotePath(settings, d));
      if (f && f instanceof TFile) {
        const c = await view.app.vault.read(f);
        const p = parseSections(c, settings);
        const counts = countTaskLines(p.tasks);
        open += counts.open;
        done += counts.done;
      }
    }
  }
  const { pct, band, title, label } = weekProgress(open, done);

  const body = view._homeCard(parent, title, (head) => {
    const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Calendar →' });
    link.addEventListener('click', (e) => { e.preventDefault(); view.setMode('planner.calendar'); });
  }, 'mint');

  const wrap = body.createDiv({ cls: 'cad-proj-progress-wrap' });
  wrap.dataset.pctBand = band;
  const lbl = wrap.createDiv({ cls: 'cad-proj-progress-label' });
  lbl.createSpan({ text: label });
  lbl.createSpan({ cls: 'cad-proj-progress-pct', text: `${pct}%` });
  const bar = wrap.createDiv({ cls: 'cad-proj-progress-bar' });
  const fill = bar.createDiv({ cls: 'cad-proj-progress-fill' });
  fill.style.width = `${pct}%`;
}

/* ── Upcoming card ── */

export interface UpcomingItem {
  date: Date;
  title: string;
  type: string;
  file: TFile;
}

/** What the upcoming card reads. `projectNext` holds each project whose
    note could be read, with its next milestone. */
export interface UpcomingData {
  projects: Entity[];
  projectNext: Array<{ entity: Entity; next: Milestone | null }>;
  registrations: Entity[];
  certifications: Entity[];
}

/** Project deadlines, next milestones, and registration and cert expiries
    from today to seven days out, sorted by date (ties keep that order). */
export function selectUpcomingItems(data: UpcomingData, now: Date): UpcomingItem[] {
  const today = startOfDay(now);
  const horizon = addDays(today, 7);
  const items: UpcomingItem[] = [];

  // Project deadlines
  data.projects.forEach((e) => {
    const due = entityValue(e, 'due', ENTITIES.project);
    if (!due) return;
    const d = new Date(due as string);
    if (isNaN(d.getTime())) return;
    if (d >= today && d <= horizon) {
      items.push({ date: d, title: (entityValue(e, 'name', ENTITIES.project) as string) || e.basename, type: 'Project due', file: e.file });
    }
  });
  // Project milestones (next upcoming per project)
  for (const { entity: e, next } of data.projectNext) {
    if (next && next.date && next.date >= today && next.date <= horizon) {
      items.push({ date: next.date, title: `${entityValue(e, 'name', ENTITIES.project) || e.basename} — ${next.title || 'milestone'}`, type: 'Milestone', file: e.file });
    }
  }
  // Registration expiries
  data.registrations.forEach((e) => {
    const exp = entityValue(e, 'expires', ENTITIES.registration);
    if (!exp) return;
    const d = new Date(exp as string);
    if (isNaN(d.getTime())) return;
    if (d >= today && d <= horizon) {
      items.push({ date: d, title: (entityValue(e, 'title', ENTITIES.registration) as string) || e.basename, type: 'Registration expires', file: e.file });
    }
  });
  // Cert expiries
  data.certifications.forEach((e) => {
    const exp = entityValue(e, 'expires', ENTITIES.certification);
    if (!exp) return;
    const d = new Date(exp as string);
    if (isNaN(d.getTime())) return;
    if (d >= today && d <= horizon) {
      items.push({ date: d, title: (entityValue(e, 'name', ENTITIES.certification) as string) || e.basename, type: 'Cert expires', file: e.file });
    }
  });

  items.sort((a, b) => (a.date as unknown as number) - (b.date as unknown as number));
  return items;
}

export async function homeUpcomingCard(view: AppViewHost, parent: HTMLElement): Promise<void> {
  const projects = listEntities(view.app, 'project');
  const projectNext: UpcomingData['projectNext'] = [];
  for (const e of projects) {
    try {
      const meta = await readProjectMeta(view.app, e.file);
      projectNext.push({ entity: e, next: meta.next });
    } catch (_) { }
  }
  const items = selectUpcomingItems({
    projects,
    projectNext,
    registrations: listEntities(view.app, 'registration'),
    certifications: listEntities(view.app, 'certification'),
  }, new Date());

  const body = view._homeCard(parent, `UPCOMING · NEXT 7 DAYS — ${items.length}`, undefined, 'warn');
  if (!items.length) {
    body.createDiv({ cls: 'cad-empty', text: 'Nothing on the radar.' });
    return;
  }
  items.slice(0, 6).forEach((it) => {
    const row = body.createDiv({ cls: 'cad-home-row' });
    row.createDiv({ cls: 'cad-home-row-date', text: fmtValue(it.date, 'date') });
    const main = row.createDiv({ cls: 'cad-home-row-main' });
    main.createDiv({ cls: 'cad-home-row-title', text: it.title });
    main.createDiv({ cls: 'cad-home-row-meta', text: it.type });
    row.addEventListener('click', () => view.openEntityDetailFromFile(it.file));
  });
}

/* ── Partners card ── */

/** The first five partners, with name and "tier · status". */
export function selectPartnerRows(partners: Entity[]): Array<{ entity: Entity; name: string; meta: string }> {
  return partners.slice(0, 5).map((e) => {
    const tier = entityValue(e, 'tier', ENTITIES.partner) || '';
    const status = entityValue(e, 'status', ENTITIES.partner) || '';
    return {
      entity: e,
      name: (entityValue(e, 'name', ENTITIES.partner) as string) || e.basename,
      meta: [tier, status].filter(Boolean).join(' · '),
    };
  });
}

export async function homePartnersCard(view: AppViewHost, parent: HTMLElement): Promise<void> {
  const partners = listEntities(view.app, 'partner');
  const body = view._homeCard(parent, `PARTNERS — ${partners.length}`, (head) => {
    const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Partners →' });
    link.addEventListener('click', (e) => { e.preventDefault(); view.setMode('prm.partners'); });
  }, 'sky');
  if (!partners.length) {
    body.createDiv({ cls: 'cad-empty', text: 'No partners on the books yet.' });
    return;
  }
  selectPartnerRows(partners).forEach(({ entity: e, name, meta }) => {
    const row = body.createDiv({ cls: 'cad-home-row' });
    const main = row.createDiv({ cls: 'cad-home-row-main' });
    main.createDiv({ cls: 'cad-home-row-title', text: name });
    main.createDiv({ cls: 'cad-home-row-meta', text: meta });
    row.addEventListener('click', () => view.openEntityDetailFromFile(e.file));
  });
}

/* ── Projects card ── */

/** Whether a project counts as active on Home: status active, on hold or in
    progress (case- and space-insensitive), defaulting to active. */
export function isHomeActiveProject(e: Entity): boolean {
  const status = String(entityValue(e, 'status', ENTITIES.project) || 'active').toLowerCase();
  return ['active', 'on_hold', 'in_progress'].includes(status.replace(/\s+/g, '_'));
}

export async function homeProjectsCard(view: AppViewHost, parent: HTMLElement): Promise<void> {
  const def = ENTITIES.project;
  const files = listEntityFiles(view.app, 'project');
  const body = view._homeCard(parent, `ACTIVE PROJECTS — ${files.length}`, (head) => {
    const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Projects →' });
    link.addEventListener('click', (e) => { e.preventDefault(); view.setMode('projects.projects'); });
  }, 'emerald');
  if (!files.length) {
    body.createDiv({ cls: 'cad-empty', text: 'No projects yet — hit + Project above.' });
    return;
  }
  const projects = await Promise.all(files.map(async (f) => {
    const e = readEntity(view.app, f);
    if (!isHomeActiveProject(e)) return null;
    const meta = await readProjectMeta(view.app, f);
    return { entity: e, meta };
  }));
  const active = projects.filter(Boolean).slice(0, 3) as Array<{ entity: Entity; meta: ProjectMeta }>;
  if (!active.length) {
    body.createDiv({ cls: 'cad-empty', text: 'No active projects right now.' });
    return;
  }
  active.forEach((p) => {
    const row = body.createDiv({ cls: 'cad-home-proj' });
    row.dataset.pctBand = pctBand(p.meta.percent);
    const head = row.createDiv({ cls: 'cad-home-proj-head' });
    head.createSpan({ cls: 'cad-home-proj-title', text: (entityValue(p.entity, 'name', def) as string) || p.entity.basename });
    head.createSpan({ cls: 'cad-home-proj-pct', text: `${p.meta.percent}%` });
    const bar = row.createDiv({ cls: 'cad-proj-progress-bar' });
    const fill = bar.createDiv({ cls: 'cad-proj-progress-fill' });
    fill.style.width = `${p.meta.percent}%`;
    if (p.meta.next) {
      row.createDiv({ cls: 'cad-home-row-meta', text: `NEXT · ${fmtValue(p.meta.next.date, 'date')}${p.meta.next.title ? ' — ' + p.meta.next.title : ''}` });
    }
    row.addEventListener('click', () => view.openEntityDetail('project', p.entity.file));
  });
}

/* ── Pipeline card ── */

/** Open deals (not Won or Lost), their total value, and the top four by value. */
export function selectPipelineCard(deals: Entity[]): { open: Entity[]; value: number; top: Entity[] } {
  const def = ENTITIES.deal;
  const open = deals.filter((e) => !['Won', 'Lost'].includes(String(entityValue(e, 'stage', def))));
  const value = open.reduce((s, e) => s + (Number(entityValue(e, 'value', def)) || 0), 0);
  const top = [...open].sort((a, b) => (Number(entityValue(b, 'value', def)) || 0) - (Number(entityValue(a, 'value', def)) || 0)).slice(0, 4);
  return { open, value, top };
}

export async function homePipelineCard(view: AppViewHost, parent: HTMLElement): Promise<void> {
  const def = ENTITIES.deal;
  const { open, value, top } = selectPipelineCard(listEntities(view.app, 'deal'));

  const body = view._homeCard(parent, `PIPELINE — ${open.length} open · ${fmtValue(value, 'currency')}`, (head) => {
    const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Pipeline →' });
    link.addEventListener('click', (e) => { e.preventDefault(); view.setMode('crm.pipeline'); });
  }, 'sky');
  if (!open.length) {
    body.createDiv({ cls: 'cad-empty', text: 'No open deals — hit + Deal above.' });
    return;
  }
  top.forEach((e) => {
    const row = body.createDiv({ cls: 'cad-home-row' });
    const main = row.createDiv({ cls: 'cad-home-row-main' });
    main.createDiv({ cls: 'cad-home-row-title', text: (entityValue(e, 'title', def) as string) || e.basename });
    const stage = entityValue(e, 'stage', def);
    main.createDiv({ cls: 'cad-home-row-meta', text: `${stage || '—'} · ${fmtValue(entityValue(e, 'value', def), 'currency')}` });
    row.addEventListener('click', () => view.openEntityDetailFromFile(e.file));
  });
}

/* ── Activities card ── */

/** The five most recent activities by `when`; undated ones sort as 1970. */
export function selectRecentActivities(acts: Entity[]): Entity[] {
  const def = ENTITIES.activity;
  return [...acts].sort((a, b) => {
    const da = new Date((entityValue(a, 'when', def) as string) || 0).getTime();
    const db = new Date((entityValue(b, 'when', def) as string) || 0).getTime();
    return db - da;
  }).slice(0, 5);
}

export async function homeActivitiesCard(view: AppViewHost, parent: HTMLElement): Promise<void> {
  const def = ENTITIES.activity;
  const acts = listEntities(view.app, 'activity');
  const body = view._homeCard(parent, `RECENT ACTIVITY — ${acts.length}`, (head) => {
    const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Activities →' });
    link.addEventListener('click', (e) => { e.preventDefault(); view.setMode('crm.activities'); });
  }, 'rose');
  if (!acts.length) {
    body.createDiv({ cls: 'cad-empty', text: 'No activities logged yet.' });
    return;
  }
  selectRecentActivities(acts).forEach((e) => {
    const row = body.createDiv({ cls: 'cad-home-row' });
    const main = row.createDiv({ cls: 'cad-home-row-main' });
    main.createDiv({ cls: 'cad-home-row-title', text: (entityValue(e, 'subject', def) as string) || e.basename });
    main.createDiv({ cls: 'cad-home-row-meta', text: `${entityValue(e, 'type', def) || '—'} · ${fmtValue(entityValue(e, 'when', def), 'date')}` });
    row.addEventListener('click', () => view.openEntityDetailFromFile(e.file));
  });
}
