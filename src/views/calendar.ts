import { TFile } from 'obsidian';
import { addDays, dailyNotePath, sameDay, startOfDay, weekDates, ymd } from '../utils/dates';
import { ensureDailyNote } from '../utils/daily-notes';
import { parseSections } from '../utils/parsing';
import { countTaskLines, taskLineRows, taskNotesToday, toggleDailyTask } from '../utils/task-lines';
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

/** "October 5 – October 11, 2026": the first and last day, locale-formatted. */
export function plannerWeekTitle(days: Date[]): string {
  const startStr = days[0].toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const endStr = days[6].toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

/** One rendered day column. */
export interface PlannerColumn {
  isToday: boolean;
  /** Short weekday, upper-case ("MON"). */
  weekday: string;
  dayNum: string;
  /** `N open · M done`, or 'no note'. */
  meta: string;
  /** Text of the empty placeholder ('—' or '' without a note), or null with tasks. */
  empty: string | null;
  rows: Array<{ checked: boolean; text: string }>;
}

/** The week grid's numbers and columns from the loaded days. The totals
    count a line as done if it has an [x] box, else open if it has a [ ] box;
    each column counts the two boxes separately, so a line with both counts
    once in the totals and twice in its column. */
export function plannerWeek(dayData: Array<Pick<PlannerDay, 'date' | 'exists' | 'tasks'>>, today: Date): {
  stats: { open: number; done: number; total: number };
  columns: PlannerColumn[];
} {
  const totals = countTaskLines(dayData.flatMap((d) => d.tasks));
  const columns = dayData.map((d) => {
    const open = d.tasks.filter((l) => / \[ \] /.test(l)).length;
    const done = d.tasks.filter((l) => / \[(x|X)\] /.test(l)).length;
    return {
      isToday: sameDay(d.date, today),
      weekday: d.date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
      dayNum: String(d.date.getDate()),
      meta: d.exists ? `${open} open · ${done} done` : 'no note',
      empty: d.tasks.length ? null : (d.exists ? '—' : ''),
      rows: taskLineRows(d.tasks),
    };
  });
  return { stats: { open: totals.open, done: totals.done, total: totals.open + totals.done }, columns };
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
  titleWrap.createDiv({ cls: 'cad-pl-title', text: plannerWeekTitle(days) });

  const nav = header.createDiv({ cls: 'cad-pl-nav' });
  const mkBtn = (label: string, fn: () => void, cls = '') => {
    const b = nav.createEl('button', { text: label, cls: 'cad-pl-btn ' + cls });
    b.addEventListener('click', fn);
  };
  mkBtn('◀', () => { view.plannerAnchor = addDays(view.plannerAnchor, -7); view.render(); });
  mkBtn('Today', () => { view.plannerAnchor = startOfDay(new Date()); view.render(); }, 'primary');
  mkBtn('▶', () => { view.plannerAnchor = addDays(view.plannerAnchor, 7); view.render(); });

  let dayData: PlannerDay[] = [];

  if (settings.taskManagementSystem === 'tasknotes') {
    const allTasks = listTaskNotesTasks(view.app);
    dayData = days.map((d) => {
      const path = dailyNotePath(settings, d);
      const file = view.app.vault.getAbstractFileByPath(path);
      const forDay = taskNotesToday(allTasks, ymd(d));
      return {
        date: d,
        path,
        exists: !!file,
        file,
        tasks: forDay.lines,
        rawTasks: forDay.tasks
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

  const week = plannerWeek(dayData, today);

  const stats = root.createDiv({ cls: 'cad-pl-stats' });
  const mkStat = (label: string, value: number) => {
    const c = stats.createDiv({ cls: 'cad-pl-stat' });
    c.createDiv({ cls: 'cad-pl-stat-label', text: label });
    c.createDiv({ cls: 'cad-pl-stat-value', text: String(value) });
  };
  mkStat('OPEN', week.stats.open);
  mkStat('DONE', week.stats.done);
  mkStat('TOTAL', week.stats.total);

  const grid = root.createDiv({ cls: 'cad-pl-grid' });
  dayData.forEach((d, dayIdx) => {
    const column = week.columns[dayIdx];
    const col = grid.createDiv({ cls: 'cad-pl-day' + (column.isToday ? ' today' : '') });

    const colHead = col.createDiv({ cls: 'cad-pl-day-head' });
    colHead.createDiv({ cls: 'cad-pl-weekday', text: column.weekday });
    colHead.createDiv({ cls: 'cad-pl-daynum', text: column.dayNum });
    colHead.createDiv({ cls: 'cad-pl-meta', text: column.meta });
    colHead.addEventListener('click', async () => {
      if (!d.exists) {
        await ensureDailyNote(view.app, settings, d.date);
      }
      view.app.workspace.openLinkText(d.path, '', false);
    });

    const list = col.createDiv({ cls: 'cad-pl-tasks' });
    if (column.empty !== null) {
      list.createDiv({ cls: 'cad-empty', text: column.empty });
    } else {
      column.rows.forEach(({ checked, text }, idx) => {
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
    const { content: newContent, taskText } = toggleDailyTask(content, view.plugin.settings, idx, checked);
    await view.app.vault.modify(day.file as TFile, newContent);
    if (taskText) {
      await view._propagateTaskComplete(taskText, checked, { kind: 'daily', file: day.file as TFile, date: day.date });
    }
  }
  view.render();
}
