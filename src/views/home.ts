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
  let items = await view._computeBriefing();
  const card = root.createDiv({ cls: 'cad-briefing' });

  const head = card.createDiv({ cls: 'cad-briefing-head' });
  head.createDiv({ cls: 'cad-briefing-eyebrow', text: 'TOP OF THE DAY' });
  head.createDiv({ cls: 'cad-briefing-headline', text: view._briefingHeadline(items) });

  if (!items.length) {
    card.createDiv({ cls: 'cad-briefing-empty', text: 'Nothing flagged. Make today count.' });
    return;
  }

  // On mobile, trim to the top 3 most urgent. _computeBriefing already
  // emits items in priority order (overdue → time → opportunity → wins),
  // so a simple slice keeps what matters most.
  const isMobile = !!(Platform && Platform.isMobile);
  const hiddenCount = isMobile && items.length > 3 ? items.length - 3 : 0;
  if (isMobile && items.length > 3) items = items.slice(0, 3);

  const list = card.createDiv({ cls: 'cad-briefing-list' });
  items.forEach((it) => {
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

export function briefingHeadline(items: BriefingItem[]): string {
  const hasOverdue = items.some((i) => i.tone === 'rose');
  if (hasOverdue) return 'A couple of things need attention this morning.';
  if (items.length >= 4) return "Here's what's worth your attention today.";
  if (items.length === 0) return 'Inbox zero. Clear runway.';
  return "Here's what's on your radar.";
}

export async function loadBriefing(view: AppViewHost): Promise<BriefingItem[]> {
  const items = [];
  const settings = view.plugin.settings;
  const dealDef = ENTITIES.deal;
  const contactDef = ENTITIES.contact;
  const today = startOfDay(new Date());
  const todayMs = today.getTime();
  const nowMs = Date.now();

  /* 1. Open tasks today */
  try {
    let openTasks = 0;
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
    if (openTasks > 0) {
      items.push({
        icon: '🎯',
        tone: 'emerald',
        text: settings.taskManagementSystem === 'tasknotes'
          ? `${openTasks} open ${openTasks === 1 ? 'task' : 'tasks'} scheduled for today`
          : `${openTasks} open ${openTasks === 1 ? 'task' : 'tasks'} on today's note`,
        action: () => view.setMode('planner.today'),
      });
    }
  } catch (_) { }

  /* 2. Overdue reminders */
  const reminders = (settings.reminders || []).filter((r) => !r.done);
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
      action: () => view.setMode('planner.inbox'),
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
      action: () => view.setMode('planner.inbox'),
    });
  }

  /* 4. Deals closing this week */
  const deals = listEntities(view.app, 'deal');
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
      action: () => view.setMode('crm.pipeline'),
    });
  }

  /* 5. Stale contacts on open deals (>30 days since lastContact) */
  const contacts = listEntities(view.app, 'contact');
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
      action: () => view.openEntityDetailFromFile(staleSample!.contact.file),
    });
  }

  /* 6. Upcoming project milestones (next 14 days) */
  const projectFiles = listEntityFiles(view.app, 'project');
  const upcoming = [];
  for (const f of projectFiles) {
    try {
      const meta = await readProjectMeta(view.app, f);
      if (meta.next && meta.next.date) {
        const ms = meta.next.date.getTime();
        if (ms >= todayMs && ms <= todayMs + 14 * 86400000) {
          upcoming.push({ file: f, milestone: meta.next, name: projectNameFromPath(view.app, f.path) });
        }
      }
    } catch (_) { }
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
      action: () => view.openEntityDetail('project', m.file),
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
      action: () => view.setMode('reports.sales'),
    });
  }

  return items;
}

export async function homeInboxCard(view: AppViewHost, parent: HTMLElement): Promise<void> {
  const reminders = (view.plugin.settings.reminders || []).filter((r) => !r.done);
  const overdueCount = reminders.filter((r) => r.when && new Date(r.when).getTime() <= Date.now()).length;
  const tone = overdueCount > 0 ? 'rose' : 'sky';

  const headTitle = `INBOX — ${reminders.length} item${reminders.length === 1 ? '' : 's'}${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`;
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

  // Sort: scheduled by when ascending, unscheduled fall to the end
  const sorted = [...reminders].sort((a, b) => {
    const wa = a.when ? new Date(a.when).getTime() : Infinity;
    const wb = b.when ? new Date(b.when).getTime() : Infinity;
    return wa - wb;
  });

  sorted.slice(0, 5).forEach((r) => {
    const row = body.createDiv({ cls: 'cad-home-row' });
    const isOverdue = r.when && new Date(r.when).getTime() <= Date.now();
    if (isOverdue) row.classList.add('overdue');
    row.createDiv({ cls: 'cad-home-row-date', text: r.when ? reminderTimeStr(r.when) : 'unscheduled' });
    const main = row.createDiv({ cls: 'cad-home-row-main' });
    main.createDiv({ cls: 'cad-home-row-title', text: r.text });
    const metaBits = [];
    if (r.project) metaBits.push(`📁 ${projectNameFromPath(view.app, r.project) || 'project'}`);
    if (r.repeat && r.repeat !== 'none') metaBits.push(r.repeat === 'daily' ? '↻ daily' : '↻ weekly');
    if (r.notes) {
      const firstLine = String(r.notes).split('\n').find((l) => l.trim()) || '';
      if (firstLine) metaBits.push(`📝 ${firstLine.length > 60 ? firstLine.slice(0, 57) + '…' : firstLine}`);
    }
    if (metaBits.length) main.createDiv({ cls: 'cad-home-row-meta', text: metaBits.join('  ·  ') });
    row.addEventListener('click', () => new CadenceReminderEditModal(view.app, view.plugin, r).open());
  });
}

export async function homeTodayCard(view: AppViewHost, parent: HTMLElement): Promise<void> {
  const settings = view.plugin.settings;
  let tasksList: string[] = [];
  let todayTaskNotes: TaskNotesTask[] = [];
  let file: TFile | null = null;

  if (settings.taskManagementSystem === 'tasknotes') {
    const todayYmd = ymd(new Date());
    const allTaskNotes = listTaskNotesTasks(view.app);
    todayTaskNotes = allTaskNotes.filter(t => t.scheduled === todayYmd);
    tasksList = todayTaskNotes.map(t => `- [${t.done ? 'x' : ' '}] ${t.title}`);
  } else {
    file = await ensureDailyNote(view.app, settings);
    const content = await view.app.vault.read(file);
    const parsed = parseSections(content, settings);
    tasksList = parsed.tasks;
  }

  const open = tasksList.filter((l) => / \[ \] /.test(l));
  const done = tasksList.filter((l) => / \[(x|X)\] /.test(l));

  const body = view._homeCard(parent, `TODAY — ${open.length} open · ${done.length} done`, (head) => {
    const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Today →' });
    link.addEventListener('click', (e) => { e.preventDefault(); view.setMode('planner.today'); });
  }, 'emerald');

  if (!tasksList.length) {
    body.createDiv({ cls: 'cad-empty', text: 'No tasks yet — add one with + Task above.' });
    return;
  }

  tasksList.forEach((rawLine, idx) => {
    const checked = / \[(x|X)\] /.test(rawLine);
    const text = rawLine.replace(/^\s*-\s\[(x|X| )\]\s/, '');
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
        const taskLine = cp.tasks[idx] || '';
        const taskText = taskLine.replace(/^\s*-\s\[(x|X| )\]\s/, '').trim();
        const newTasks = cp.tasks.map((line, i) => {
          if (i !== idx) return line;
          return cb.checked
            ? line.replace(/^\s*-\s\[\s\]\s/, '- [x] ')
            : line.replace(/^\s*-\s\[(x|X)\]\s/, '- [ ] ');
        });
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

export async function homeWeekCard(view: AppViewHost, parent: HTMLElement): Promise<void> {
  const settings = view.plugin.settings;
  const weekStart = startOfWeek(new Date(), settings.weekStartsOn);
  let open = 0, done = 0;

  if (settings.taskManagementSystem === 'tasknotes') {
    const allTasks = listTaskNotesTasks(view.app);
    const weekDatesList = Array.from({ length: 7 }, (_, i) => ymd(addDays(weekStart, i)));
    allTasks.forEach((t) => {
      if (weekDatesList.includes(t.scheduled)) {
        if (t.done) done++;
        else open++;
      }
    });
  } else {
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const f = view.app.vault.getAbstractFileByPath(dailyNotePath(settings, d));
      if (f && f instanceof TFile) {
        const c = await view.app.vault.read(f);
        const p = parseSections(c, settings);
        p.tasks.forEach((l) => { if (/ \[(x|X)\] /.test(l)) done++; else if (/ \[ \] /.test(l)) open++; });
      }
    }
  }
  const total = open + done;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const body = view._homeCard(parent, `THIS WEEK — ${done}/${total} done`, (head) => {
    const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Calendar →' });
    link.addEventListener('click', (e) => { e.preventDefault(); view.setMode('planner.calendar'); });
  }, 'mint');

  const wrap = body.createDiv({ cls: 'cad-proj-progress-wrap' });
  wrap.dataset.pctBand = pctBand(pct);
  const lbl = wrap.createDiv({ cls: 'cad-proj-progress-label' });
  lbl.createSpan({ text: total ? `${done} of ${total} tasks completed` : 'No tasks logged this week yet' });
  lbl.createSpan({ cls: 'cad-proj-progress-pct', text: `${pct}%` });
  const bar = wrap.createDiv({ cls: 'cad-proj-progress-bar' });
  const fill = bar.createDiv({ cls: 'cad-proj-progress-fill' });
  fill.style.width = `${pct}%`;
}

export async function homeUpcomingCard(view: AppViewHost, parent: HTMLElement): Promise<void> {
  const today = startOfDay(new Date());
  const horizon = addDays(today, 7);
  const items = [];

  // Project deadlines
  const projects = listEntities(view.app, 'project');
  projects.forEach((e) => {
    const due = entityValue(e, 'due', ENTITIES.project);
    if (!due) return;
    const d = new Date(due as string);
    if (isNaN(d.getTime())) return;
    if (d >= today && d <= horizon) {
      items.push({ date: d, title: entityValue(e, 'name', ENTITIES.project) || e.basename, type: 'Project due', file: e.file });
    }
  });
  // Project milestones (next upcoming per project)
  for (const e of projects) {
    try {
      const meta = await readProjectMeta(view.app, e.file);
      if (meta.next && meta.next.date && meta.next.date >= today && meta.next.date <= horizon) {
        items.push({ date: meta.next.date, title: `${entityValue(e, 'name', ENTITIES.project) || e.basename} — ${meta.next.title || 'milestone'}`, type: 'Milestone', file: e.file });
      }
    } catch (_) { }
  }
  // Registration expiries
  listEntities(view.app, 'registration').forEach((e) => {
    const exp = entityValue(e, 'expires', ENTITIES.registration);
    if (!exp) return;
    const d = new Date(exp as string);
    if (isNaN(d.getTime())) return;
    if (d >= today && d <= horizon) {
      items.push({ date: d, title: entityValue(e, 'title', ENTITIES.registration) || e.basename, type: 'Registration expires', file: e.file });
    }
  });
  // Cert expiries
  listEntities(view.app, 'certification').forEach((e) => {
    const exp = entityValue(e, 'expires', ENTITIES.certification);
    if (!exp) return;
    const d = new Date(exp as string);
    if (isNaN(d.getTime())) return;
    if (d >= today && d <= horizon) {
      items.push({ date: d, title: entityValue(e, 'name', ENTITIES.certification) || e.basename, type: 'Cert expires', file: e.file });
    }
  });

  items.sort((a, b) => (a.date as unknown as number) - (b.date as unknown as number));
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
  partners.slice(0, 5).forEach((e) => {
    const row = body.createDiv({ cls: 'cad-home-row' });
    const main = row.createDiv({ cls: 'cad-home-row-main' });
    main.createDiv({ cls: 'cad-home-row-title', text: (entityValue(e, 'name', ENTITIES.partner) as string) || e.basename });
    const tier = entityValue(e, 'tier', ENTITIES.partner) || '';
    const status = entityValue(e, 'status', ENTITIES.partner) || '';
    main.createDiv({ cls: 'cad-home-row-meta', text: [tier, status].filter(Boolean).join(' · ') });
    row.addEventListener('click', () => view.openEntityDetailFromFile(e.file));
  });
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
    const status = String(entityValue(e, 'status', def) || 'active').toLowerCase();
    if (!['active', 'on_hold', 'in_progress'].includes(status.replace(/\s+/g, '_'))) return null;
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

export async function homePipelineCard(view: AppViewHost, parent: HTMLElement): Promise<void> {
  const def = ENTITIES.deal;
  const deals = listEntities(view.app, 'deal');
  const open = deals.filter((e) => !['Won', 'Lost'].includes(String(entityValue(e, 'stage', def))));
  const value = open.reduce((s, e) => s + (Number(entityValue(e, 'value', def)) || 0), 0);

  const body = view._homeCard(parent, `PIPELINE — ${open.length} open · ${fmtValue(value, 'currency')}`, (head) => {
    const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Pipeline →' });
    link.addEventListener('click', (e) => { e.preventDefault(); view.setMode('crm.pipeline'); });
  }, 'sky');
  if (!open.length) {
    body.createDiv({ cls: 'cad-empty', text: 'No open deals — hit + Deal above.' });
    return;
  }
  const top = [...open].sort((a, b) => (Number(entityValue(b, 'value', def)) || 0) - (Number(entityValue(a, 'value', def)) || 0)).slice(0, 4);
  top.forEach((e) => {
    const row = body.createDiv({ cls: 'cad-home-row' });
    const main = row.createDiv({ cls: 'cad-home-row-main' });
    main.createDiv({ cls: 'cad-home-row-title', text: (entityValue(e, 'title', def) as string) || e.basename });
    const stage = entityValue(e, 'stage', def);
    main.createDiv({ cls: 'cad-home-row-meta', text: `${stage || '—'} · ${fmtValue(entityValue(e, 'value', def), 'currency')}` });
    row.addEventListener('click', () => view.openEntityDetailFromFile(e.file));
  });
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
  const sorted = [...acts].sort((a, b) => {
    const da = new Date((entityValue(a, 'when', def) as string) || 0).getTime();
    const db = new Date((entityValue(b, 'when', def) as string) || 0).getTime();
    return db - da;
  }).slice(0, 5);
  sorted.forEach((e) => {
    const row = body.createDiv({ cls: 'cad-home-row' });
    const main = row.createDiv({ cls: 'cad-home-row-main' });
    main.createDiv({ cls: 'cad-home-row-title', text: (entityValue(e, 'subject', def) as string) || e.basename });
    main.createDiv({ cls: 'cad-home-row-meta', text: `${entityValue(e, 'type', def) || '—'} · ${fmtValue(entityValue(e, 'when', def), 'date')}` });
    row.addEventListener('click', () => view.openEntityDetailFromFile(e.file));
  });
}
