import type { DailyNoteSettings } from '../types/settings';
import type { TaskNotesTask } from '../types/entities';
import { parseHeaderKey, parseSections, replaceSection } from './parsing';

/* Checklist lines (`- [ ] …`) and the markdown rewrites behind every task
   tick and append on Home, Today, the Calendar and task propagation. Each
   rewrite is `(content, input) → content`; the caller reads and writes the
   file. Built on parseSections, replaceSection and stringifyTasks, so they
   share those helpers' behaviour: replaceSection leaves a blank line before
   the next heading, and only checklist lines survive a rewrite. */

type TaskHeadings = Pick<DailyNoteSettings, 'tasksHeading' | 'journalHeading'>;

/** A checklist line's `- [ ] ` / `- [x] ` prefix, with any indentation. */
export const TASK_PREFIX = /^\s*-\s\[(x|X| )\]\s/;

/** A checklist line's state, read from its own leading box: 'done' for
    `[x]`/`[X]`, 'open' for `[ ]`, null for any other line. A box later in
    the text (`- [ ] see [x] here`) never counts, and any whitespace may
    follow the box. */
export function taskLineState(line: string): 'open' | 'done' | null {
  const match = TASK_PREFIX.exec(line);
  if (!match) return null;
  return match[1] === ' ' ? 'open' : 'done';
}

/** Sets a checklist line's leading box to `done`, keeping its indentation,
    spacing and text. A line already in that state, or not a checklist
    line, comes back unchanged. */
export function setTaskLineState(line: string, done: boolean): string {
  return line.replace(/^(\s*-\s\[)(x|X| )(\]\s)/, (whole, open: string, box: string, close: string) => {
    if ((box !== ' ') === done) return whole;
    return `${open}${done ? 'x' : ' '}${close}`;
  });
}

/** Whether a project H2 heading key (`Label #tag`) is a tasks section: a
    #tasks tag or the label Tasks, in any case. */
export function isTasksSectionKey(rawKey: string): boolean {
  const { cleanLabel, tag } = parseHeaderKey(rawKey);
  return tag === '#tasks' || cleanLabel.toLowerCase() === 'tasks';
}

/* The line indexes of the checklist lines in every H2 section whose
   trimmed heading line `inSection` accepts. */
function sectionTaskLineIndexes(lines: string[], inSection: (heading: string) => boolean): number[] {
  const indexes: number[] = [];
  let active = false;
  lines.forEach((line, i) => {
    if (/^##\s/.test(line)) {
      active = inSection(line.trim());
      return;
    }
    if (active && TASK_PREFIX.test(line)) indexes.push(i);
  });
  return indexes;
}

/* Sets every listed line whose trimmed text equals `text` to `done`, in
   place. Returns the new content, or null when no line changes. */
function tickLinesByText(lines: string[], indexes: number[], text: string, done: boolean): string | null {
  let changed = false;
  for (const i of indexes) {
    if (lines[i].replace(TASK_PREFIX, '').trim() !== text) continue;
    const next = setTaskLineState(lines[i], done);
    if (next === lines[i]) continue;
    lines[i] = next;
    changed = true;
  }
  return changed ? lines.join('\n') : null;
}

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

/** Open and done counts over checklist lines, each by its own leading
    box. A line that is not a checklist line counts as neither. */
export function countTaskLines(lines: string[]): { open: number; done: number } {
  let open = 0, done = 0;
  lines.forEach((l) => {
    const state = taskLineState(l);
    if (state === 'done') done++;
    else if (state === 'open') open++;
  });
  return { open, done };
}

/** One row per checklist line: its box state and its text (untrimmed). */
export function taskLineRows(lines: string[]): Array<{ checked: boolean; text: string }> {
  return lines.map((rawLine) => ({
    checked: taskLineState(rawLine) === 'done',
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

/** Sets every task in a project's tasks sections (`isTasksSectionKey`, so
    `## Tasks #todo` and `## Todo #tasks` too) whose trimmed title equals
    `text` to `done`, editing only those lines. Returns null when no task
    changes. */
export function tickProjectTasks(content: string, text: string, done: boolean): string | null {
  const lines = content.split('\n');
  const indexes = sectionTaskLineIndexes(lines, (heading) => isTasksSectionKey(heading.replace(/^##\s+/, '')));
  return tickLinesByText(lines, indexes, text, !!done);
}

/** Sets every daily-note task whose trimmed text equals `text` to `done`,
    editing only those lines. Returns null when no line changes. */
export function tickDailyTasks(content: string, settings: TaskHeadings, text: string, done: boolean): string | null {
  const lines = content.split('\n');
  const indexes = sectionTaskLineIndexes(lines, (heading) => heading === settings.tasksHeading);
  return tickLinesByText(lines, indexes, text, !!done);
}
