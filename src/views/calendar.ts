import { TFile } from 'obsidian';
import { addDays, dailyNotePath, sameDay, startOfDay, weekDates, ymd } from '../utils/dates';
import { ensureDailyNote } from '../utils/daily-notes';
import { parseSections, replaceSection } from '../utils/parsing';
import { listTaskNotesTasks, toggleTaskNotesTask } from '../utils/tasknotes';
import type { TAbstractFile } from 'obsidian';
import type { TaskNotesTask } from '../types/entities';
import type { AppViewHost } from './host';

/* One column of the week planner, as renderPlannerPane builds it and
   togglePlannerTask receives it. */
export interface PlannerDay {
  date: Date;
  path: string;
  exists: boolean;
  /** A TFile in daily-note mode; in TaskNotes mode whatever sits at the path. */
  file?: TFile | TAbstractFile | null;
  /** Task lines (`- [ ] …`). */
  tasks: string[];
  /** TaskNotes mode only: the task notes behind `tasks`, by index. */
  rawTasks?: TaskNotesTask[];
}

/* ── Planner pane ───────────────────────── */
export async function renderPlannerPane(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-planner');
  const settings = view.plugin.settings;
  const days = weekDates(view.plannerAnchor, settings.weekStartsOn);
  const today = startOfDay(new Date());

  const header = root.createDiv({ cls: 'cad-pl-header' });
  const titleWrap = header.createDiv({ cls: 'cad-pl-title-wrap' });
  titleWrap.createDiv({ cls: 'cad-eyebrow', text: 'WEEK OF' });
  const startStr = days[0].toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const endStr = days[6].toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  titleWrap.createDiv({ cls: 'cad-pl-title', text: `${startStr} – ${endStr}` });

  const nav = header.createDiv({ cls: 'cad-pl-nav' });
  const mkBtn = (label: string, fn: () => void, cls = '') => {
    const b = nav.createEl('button', { text: label, cls: 'cad-pl-btn ' + cls });
    b.addEventListener('click', fn);
  };
  mkBtn('◀', () => { view.plannerAnchor = addDays(view.plannerAnchor, -7); view.render(); });
  mkBtn('Today', () => { view.plannerAnchor = startOfDay(new Date()); view.render(); }, 'primary');
  mkBtn('▶', () => { view.plannerAnchor = addDays(view.plannerAnchor, 7); view.render(); });

  let totalOpen = 0, totalDone = 0;
  let dayData: PlannerDay[] = [];

  if (settings.taskManagementSystem === 'tasknotes') {
    const allTasks = listTaskNotesTasks(view.app);
    dayData = days.map((d) => {
      const ymdStr = ymd(d);
      const path = dailyNotePath(settings, d);
      const file = view.app.vault.getAbstractFileByPath(path);
      const tasksForDay = allTasks.filter(t => t.scheduled === ymdStr);
      return {
        date: d,
        path,
        exists: !!file,
        file,
        tasks: tasksForDay.map(t => `- [${t.done ? 'x' : ' '}] ${t.title}`),
        rawTasks: tasksForDay
      };
    });
  } else {
    dayData = await Promise.all(days.map(async (d) => {
      const path = dailyNotePath(settings, d);
      const file = view.app.vault.getAbstractFileByPath(path);
      if (!file || !(file instanceof TFile)) {
        return { date: d, path, exists: false, tasks: [] };
      }
      const content = await view.app.vault.read(file);
      const parsed = parseSections(content, settings);
      return { date: d, path, exists: true, file, tasks: parsed.tasks };
    }));
  }

  dayData.forEach((d) => {
    d.tasks.forEach((l) => {
      if (/ \[(x|X)\] /.test(l)) totalDone++;
      else if (/ \[ \] /.test(l)) totalOpen++;
    });
  });

  const stats = root.createDiv({ cls: 'cad-pl-stats' });
  const mkStat = (label: string, value: number) => {
    const c = stats.createDiv({ cls: 'cad-pl-stat' });
    c.createDiv({ cls: 'cad-pl-stat-label', text: label });
    c.createDiv({ cls: 'cad-pl-stat-value', text: String(value) });
  };
  mkStat('OPEN', totalOpen);
  mkStat('DONE', totalDone);
  mkStat('TOTAL', totalOpen + totalDone);

  const grid = root.createDiv({ cls: 'cad-pl-grid' });
  dayData.forEach((d) => {
    const isToday = sameDay(d.date, today);
    const col = grid.createDiv({ cls: 'cad-pl-day' + (isToday ? ' today' : '') });

    const colHead = col.createDiv({ cls: 'cad-pl-day-head' });
    colHead.createDiv({
      cls: 'cad-pl-weekday',
      text: d.date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
    });
    colHead.createDiv({ cls: 'cad-pl-daynum', text: String(d.date.getDate()) });
    const open = d.tasks.filter((l) => / \[ \] /.test(l)).length;
    const done = d.tasks.filter((l) => / \[(x|X)\] /.test(l)).length;
    colHead.createDiv({
      cls: 'cad-pl-meta',
      text: d.exists ? `${open} open · ${done} done` : 'no note',
    });
    colHead.addEventListener('click', async () => {
      if (!d.exists) {
        await ensureDailyNote(view.app, settings, d.date);
      }
      view.app.workspace.openLinkText(d.path, '', false);
    });

    const list = col.createDiv({ cls: 'cad-pl-tasks' });
    if (!d.tasks.length) {
      list.createDiv({ cls: 'cad-empty', text: d.exists ? '—' : '' });
    } else {
      d.tasks.forEach((rawLine, idx) => {
        const checked = / \[(x|X)\] /.test(rawLine);
        const text = rawLine.replace(/^\s*-\s\[(x|X| )\]\s/, '');
        const row = list.createDiv({ cls: 'cad-pl-task' + (checked ? ' done' : '') });
        const cb = row.createEl('input', { type: 'checkbox' });
        cb.checked = checked;
        cb.addEventListener('change', () => view.togglePlannerTask(d, idx, cb.checked));

        if (settings.taskManagementSystem === 'tasknotes') {
          const taskObj = d.rawTasks![idx];
          const taskSpan = row.createEl('a', { text });
          taskSpan.style.cursor = 'pointer';
          taskSpan.addEventListener('click', (ev) => {
            ev.preventDefault();
            view.app.workspace.openLinkText(taskObj.file.path, '', false);
          });
        } else {
          row.createSpan({ text });
        }
      });
    }
  });
}

export async function togglePlannerTask(view: AppViewHost, day: PlannerDay, idx: number, checked: boolean): Promise<void> {
  if (view.plugin.settings.taskManagementSystem === 'tasknotes') {
    if (day.rawTasks && day.rawTasks[idx]) {
      const taskObj = day.rawTasks[idx];
      await toggleTaskNotesTask(view.app, taskObj.file, checked);
    }
  } else {
    if (!day.file) return;
    const content = await view.app.vault.read(day.file as TFile);
    const parsed = parseSections(content, view.plugin.settings);
    const taskLine = parsed.tasks[idx] || '';
    const taskText = taskLine.replace(/^\s*-\s\[(x|X| )\]\s/, '').trim();
    const newTasks = parsed.tasks.map((line, i) => {
      if (i !== idx) return line;
      return checked
        ? line.replace(/^\s*-\s\[\s\]\s/, '- [x] ')
        : line.replace(/^\s*-\s\[(x|X)\]\s/, '- [ ] ');
    });
    const newContent = replaceSection(content, view.plugin.settings.tasksHeading, newTasks.join('\n'));
    await view.app.vault.modify(day.file as TFile, newContent);
    if (taskText) {
      await view._propagateTaskComplete(taskText, checked, { kind: 'daily', file: day.file as TFile, date: day.date });
    }
  }
  view.render();
}
