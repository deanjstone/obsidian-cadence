import type { DailyNoteSettings } from '../types/settings';
import type { TaskNotesTask } from '../types/entities';
import { parseHeaderKey, parseSections, replaceSection } from './parsing';

/* Checklist lines (`- [ ] …`) and the markdown rewrites behind every task
   tick and append on Home, Today, the Calendar and task propagation. Each
   rewrite is `(content, input) → content`; the caller reads and writes the
   file. A tick edits only the box of the lines it changes, so every other
   line, indentation and blank line in the note stays as it was. Appending a
   task and replacing the journal go through replaceSection, which leaves a
   blank line before the next heading, and only checklist lines survive an
   append. */

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

/** Ticks (or unticks) the line at `idx` in place, and returns the new
    lines with the task's trimmed text. Null when there is no line at `idx`. */
export function toggleTaskLine(tasks: string[], idx: number, checked: boolean): { tasks: string[]; taskText: string } | null {
  const taskLine = tasks[idx];
  if (taskLine === undefined) return null;
  return {
    tasks: tasks.map((line, i) => (i === idx ? setTaskLineState(line, checked) : line)),
    taskText: taskLine.replace(TASK_PREFIX, '').trim(),
  };
}

/** Which task a rendered row shows: its text (box and indentation
    stripped, untrimmed) and which occurrence of that text it is in the
    list. A tick finds the task by this, not by row index, so it still hits
    the same task after lines are added or removed above it. */
export interface TaskRef {
  text: string;
  occurrence: number;
}

/** The ref of the task at `idx` in a list of task texts, or null past the end. */
export function taskRefAt(texts: string[], idx: number): TaskRef | null {
  const text = texts[idx];
  if (text === undefined) return null;
  return { text, occurrence: texts.slice(0, idx).filter((t) => t === text).length };
}

/** The ref of the checklist line at `idx`, or null past the end. */
export function taskLineRef(lines: string[], idx: number): TaskRef | null {
  return taskRefAt(lines.map((line) => line.replace(TASK_PREFIX, '')), idx);
}

/** The index of the line `ref` names, or -1 when it is gone. */
export function findTaskLine(lines: string[], ref: TaskRef): number {
  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].replace(TASK_PREFIX, '') !== ref.text) continue;
    if (seen === ref.occurrence) return i;
    seen++;
  }
  return -1;
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

/** The lines minus each bare checklist line (`- [ ] ` with no text, the
    daily template's placeholder), which is not a task (#55). Home, Today
    and the Calendar count and list only these. A tick still finds its task
    by TaskRef in the full note, where a bare line never matches a task's
    text. */
export function withoutBlankTasks(lines: string[]): string[] {
  return lines.filter((line) => taskLineState(line) === null || line.replace(TASK_PREFIX, '').trim() !== '');
}

/** One row per checklist line: its box state and its text (untrimmed). */
export function taskLineRows(lines: string[]): Array<{ checked: boolean; text: string }> {
  return lines.map((rawLine) => ({
    checked: taskLineState(rawLine) === 'done',
    text: rawLine.replace(TASK_PREFIX, ''),
  }));
}

/** Ticks the daily note's task at row `idx` (counting checklist lines under
    the tasks heading), editing only that line. Returns the new content and
    the task's trimmed text, or null when there is no such row. */
export function toggleDailyTask(content: string, settings: TaskHeadings, idx: number, checked: boolean): { content: string; taskText: string } | null {
  const lines = content.split('\n');
  const lineIdx = sectionTaskLineIndexes(lines, (heading) => heading === settings.tasksHeading)[idx];
  if (lineIdx === undefined) return null;
  const toggled = toggleTaskLine(lines, lineIdx, checked)!;
  return { content: toggled.tasks.join('\n'), taskText: toggled.taskText };
}

/** Ticks the daily-note task `ref` names, wherever it now sits under the
    tasks heading. Null when the task is gone from the note. */
export function toggleDailyTaskByRef(content: string, settings: TaskHeadings, ref: TaskRef, checked: boolean): { content: string; taskText: string } | null {
  const idx = findTaskLine(parseSections(content, settings).tasks, ref);
  return idx === -1 ? null : toggleDailyTask(content, settings, idx, checked);
}

/** Ticks the task `ref` names in a project's `## <rawKey>` section (the
    last one with that key, as parseH2Sections reads it), editing only that
    line. Null when the task is gone from the section. */
export function toggleProjectTaskByRef(content: string, rawKey: string, ref: TaskRef, checked: boolean): { content: string; taskText: string } | null {
  const lines = content.split('\n');
  const isHeading = (line: string) => /^##\s/.test(line);
  const start = lines.map((line) => isHeading(line) && line.replace(/^##\s+/, '').trim() === rawKey).lastIndexOf(true);
  if (start === -1) return null;
  const indexes: number[] = [];
  for (let i = start + 1; i < lines.length && !isHeading(lines[i]); i++) {
    if (TASK_PREFIX.test(lines[i])) indexes.push(i);
  }
  const at = findTaskLine(indexes.map((i) => lines[i]), ref);
  if (at === -1) return null;
  const toggled = toggleTaskLine(lines, indexes[at], checked)!;
  return { content: toggled.tasks.join('\n'), taskText: toggled.taskText };
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
