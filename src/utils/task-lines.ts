import type { DailyNoteSettings } from '../types/settings';
import type { TaskNotesTask } from '../types/entities';
import { parseH2Sections, parseSections, parseTasksList, replaceSection, stringifyTasks } from './parsing';

/* Checklist lines (`- [ ] …`) and the markdown rewrites behind every task
   tick and append on Home, Today, the Calendar and task propagation. Each
   rewrite is `(content, input) → content`; the caller reads and writes the
   file. Built on parseSections, replaceSection and stringifyTasks, so they
   share those helpers' behaviour: replaceSection leaves a blank line before
   the next heading, and only checklist lines survive a rewrite. */

type TaskHeadings = Pick<DailyNoteSettings, 'tasksHeading' | 'journalHeading'>;

/** A checklist line's `- [ ] ` / `- [x] ` prefix, with any indentation. */
export const TASK_PREFIX = /^\s*-\s\[(x|X| )\]\s/;

/** TaskNotes tasks scheduled on `ymd`, and their checklist lines. */
export function taskNotesToday(allTaskNotes: TaskNotesTask[], todayYmd: string): { tasks: TaskNotesTask[]; lines: string[] } {
  const tasks = allTaskNotes.filter(t => t.scheduled === todayYmd);
  return { tasks, lines: tasks.map(t => `- [${t.done ? 'x' : ' '}] ${t.title}`) };
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

/** Open and done counts over checklist lines. A line matching neither
    pattern (e.g. a tab after the box) counts as neither. */
export function countTaskLines(lines: string[]): { open: number; done: number } {
  let open = 0, done = 0;
  lines.forEach((l) => { if (/ \[(x|X)\] /.test(l)) done++; else if (/ \[ \] /.test(l)) open++; });
  return { open, done };
}

/** One row per checklist line: its box state and its text (untrimmed). */
export function taskLineRows(lines: string[]): Array<{ checked: boolean; text: string }> {
  return lines.map((rawLine) => ({
    checked: / \[(x|X)\] /.test(rawLine),
    text: rawLine.replace(TASK_PREFIX, ''),
  }));
}

/** Ticks the daily note's task at row `idx` (counting checklist lines under
    the tasks heading). Returns the new content and the task's trimmed text. */
export function toggleDailyTask(content: string, settings: TaskHeadings, idx: number, checked: boolean): { content: string; taskText: string } {
  const parsed = parseSections(content, settings);
  const { tasks, taskText } = toggleTaskLine(parsed.tasks, idx, checked);
  return { content: replaceSection(content, settings.tasksHeading, tasks.join('\n')), taskText };
}

/** Appends an open task under the tasks heading (added at the end if missing). */
export function appendDailyTask(content: string, settings: TaskHeadings, text: string): string {
  const parsed = parseSections(content, settings);
  const newTasks = [...parsed.tasks, `- [ ] ${text}`];
  return replaceSection(content, settings.tasksHeading, newTasks.join('\n'));
}

/** Replaces the journal section's body; null or undefined writes it empty. */
export function replaceJournal(content: string, settings: Pick<DailyNoteSettings, 'journalHeading'>, body: string | null | undefined): string {
  return replaceSection(content, settings.journalHeading, body || '');
}

/** Sets every task in a project's `## Tasks` whose trimmed title equals
    `text` to `done`. Returns null when no task changes. */
export function tickProjectTasks(content: string, text: string, done: boolean): string | null {
  const sections = parseH2Sections(content);
  const tasks = parseTasksList(sections['Tasks'] || '');
  let changed = false;
  const updated = tasks.map((tk) => {
    if (tk.title.trim() === text && !!tk.done !== !!done) {
      changed = true;
      return Object.assign({}, tk, { done: !!done });
    }
    return tk;
  });
  if (!changed) return null;
  return replaceSection(content, '## Tasks', stringifyTasks(updated));
}

/** Sets every daily-note task whose trimmed text equals `text` to `done`.
    Returns null when no line changes. */
export function tickDailyTasks(content: string, settings: TaskHeadings, text: string, done: boolean): string | null {
  const parsed = parseSections(content, settings);
  let changed = false;
  const updatedTasks = parsed.tasks.map((line) => {
    const lineText = line.replace(TASK_PREFIX, '').trim();
    if (lineText !== text) return line;
    const isDone = / \[(x|X)\] /.test(line);
    if (isDone === !!done) return line;
    changed = true;
    return done
      ? line.replace(/^\s*-\s\[\s\]\s/, '- [x] ')
      : line.replace(/^\s*-\s\[(x|X)\]\s/, '- [ ] ');
  });
  if (!changed) return null;
  return replaceSection(content, settings.tasksHeading, updatedTasks.join('\n'));
}
