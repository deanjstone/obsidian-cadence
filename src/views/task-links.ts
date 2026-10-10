import { Notice, SuggestModal, TFile, type App } from 'obsidian';
import { ymd } from '../utils/dates';
import { listEntityFiles, projectNameFromPath } from '../utils/entities';
import { parseH2Sections, parseSections, parseTasksList, replaceSection, stringifyTasks } from '../utils/parsing';
import type { AppViewHost, TaskCompleteSource } from './host';

/* A row in the task→project picker: a project, or the "remove link" row
   (`unlink: true`, no file). */
interface TaskProjectPickerItem {
  file?: TFile;
  name: string | null;
  unlink?: boolean;
}

/* Link a daily-note task to a project. Keyed by (dailyPath, taskText). */
export function taskLinkKey(dailyPath: string, text: string | null | undefined): string {
  return `${dailyPath}::${(text || '').trim()}`;
}

export function getTaskProjectLink(view: AppViewHost, dailyPath: string, text: string): string | null {
  const map = (view.plugin.settings && view.plugin.settings.taskProjectLinks) || {};
  return map[view._taskLinkKey(dailyPath, text)] || null;
}

export async function setTaskProjectLink(view: AppViewHost, dailyPath: string, text: string, projectPath: string | null): Promise<void> {
  if (!view.plugin.settings.taskProjectLinks) view.plugin.settings.taskProjectLinks = {};
  const key = view._taskLinkKey(dailyPath, text);
  if (projectPath) {
    view.plugin.settings.taskProjectLinks[key] = projectPath;
  } else {
    delete view.plugin.settings.taskProjectLinks[key];
  }
  await view.plugin.saveSettings();
  view.render();
}

/* The legacy method opened with `const view = this;` for the inline class to
   close over. Here `view` is already the parameter, so that line is gone; the
   class body keeps its own `this`. */
export function openTaskProjectPicker(view: AppViewHost, dailyPath: string, text: string, currentLink: string | null): void {
  const projectFiles = listEntityFiles(view.app, 'project');
  if (!projectFiles.length) {
    new Notice('No projects yet. Create one in Planner → Projects first.');
    return;
  }
  const projects = projectFiles.map((f) => ({
    file: f,
    name: projectNameFromPath(view.app, f.path),
  }));

  const picker = new (class extends SuggestModal<TaskProjectPickerItem> {
    declare projs: TaskProjectPickerItem[];
    declare hasLink: boolean;
    constructor(app: App, projs: TaskProjectPickerItem[], hasLink: boolean) {
      super(app);
      this.projs = projs;
      this.hasLink = hasLink;
      this.setPlaceholder(hasLink ? 'Pick a project (or type "unlink" to remove)' : 'Pick a project to link this task to');
    }
    getSuggestions(query: string): TaskProjectPickerItem[] {
      const q = (query || '').toLowerCase();
      const matches = this.projs.filter((p) => p.name!.toLowerCase().includes(q));
      if (this.hasLink && (q === '' || 'unlink'.includes(q))) {
        return [{ unlink: true, name: '— Remove link —' }, ...matches];
      }
      return matches;
    }
    renderSuggestion(item: TaskProjectPickerItem, el: HTMLElement): void {
      if (item.unlink) {
        el.setText(item.name!);
        el.style.color = 'var(--text-error, #c0392b)';
      } else {
        el.setText('📁  ' + item.name);
      }
    }
    onChooseSuggestion(item: TaskProjectPickerItem): void {
      if (item.unlink) view._setTaskProjectLink(dailyPath, text, null);
      else view._setTaskProjectLink(dailyPath, text, item.file!.path);
    }
  })(view.app, projects, !!currentLink);
  picker.open();
}

/* ── Task completion propagation ──
   When a task is ticked or unticked anywhere, mirror the state to:
     - matching reminders by text (and via reminder.project to the linked project)
     - matching task lines in today's daily note + the linked reminder's date note
   Match is by exact (trimmed) task text. Renaming a task breaks the link. */
export async function propagateTaskComplete(view: AppViewHost, text: string, done: boolean, source?: TaskCompleteSource): Promise<void> {
  const t = String(text || '').trim();
  if (!t) return;
  source = source || ({} as TaskCompleteSource);

  const reminders = (view.plugin.settings.reminders || []).slice();
  const matches = reminders.filter((r) => r.text && r.text.trim() === t);

  /* 1. Sync matching reminders (skip the source reminder) */
  for (const r of matches) {
    if (source.kind === 'reminder' && r.id === source.id) continue;
    if (!!r.done === !!done) continue;
    await view.plugin.updateReminder(r.id, { done: !!done });
  }

  /* 2. For any matching reminder linked to a project, tick that project's task line */
  const projectsTouched = new Set<string>();
  for (const r of matches) {
    if (!r.project) continue;
    if (source.kind === 'project' && source.file && source.file.path === r.project) continue;
    if (projectsTouched.has(r.project)) continue;
    projectsTouched.add(r.project);
    const file = view.app.vault.getAbstractFileByPath(r.project);
    if (!file || !(file instanceof TFile)) continue;
    await view._tickProjectTaskByText(file, t, !!done);
  }

  /* 3. Tick matching task line in relevant daily notes (today + each match's date note + source date) */
  const datesToCheck = new Set([ymd(new Date())]);
  matches.forEach((r) => {
    if (r.when) {
      const d = new Date(r.when);
      if (!isNaN(d.getTime())) datesToCheck.add(ymd(d));
    }
    if (r.createdAt) {
      const d = new Date(r.createdAt);
      if (!isNaN(d.getTime())) datesToCheck.add(ymd(d));
    }
  });
  if (source.kind === 'daily' && source.date) datesToCheck.add(ymd(source.date));
  const settings = view.plugin.settings;
  for (const dateStr of datesToCheck) {
    const path = settings.dailyNoteFolder
      ? `${settings.dailyNoteFolder.replace(/\/$/, '')}/${dateStr}.md`
      : `${dateStr}.md`;
    const file = view.app.vault.getAbstractFileByPath(path);
    if (!file || !(file instanceof TFile)) continue;
    if (source.kind === 'daily' && source.file && source.file.path === file.path) continue;
    await view._tickDailyNoteTaskByText(file, t, !!done);
  }
}

export async function tickProjectTaskByText(view: AppViewHost, file: TFile, text: string, done: boolean): Promise<void> {
  let content;
  try { content = await view.app.vault.read(file); } catch (_) { return; }
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
  if (!changed) return;
  const newSection = stringifyTasks(updated);
  const next = replaceSection(content, '## Tasks', newSection);
  await view.app.vault.modify(file, next);
}

export async function tickDailyNoteTaskByText(view: AppViewHost, file: TFile, text: string, done: boolean): Promise<void> {
  let content;
  try { content = await view.app.vault.read(file); } catch (_) { return; }
  const parsed = parseSections(content, view.plugin.settings);
  let changed = false;
  const updatedTasks = parsed.tasks.map((line) => {
    const lineText = line.replace(/^\s*-\s\[(x|X| )\]\s/, '').trim();
    if (lineText !== text) return line;
    const isDone = / \[(x|X)\] /.test(line);
    if (isDone === !!done) return line;
    changed = true;
    return done
      ? line.replace(/^\s*-\s\[\s\]\s/, '- [x] ')
      : line.replace(/^\s*-\s\[(x|X)\]\s/, '- [ ] ');
  });
  if (!changed) return;
  const newSection = updatedTasks.join('\n');
  const next = replaceSection(content, view.plugin.settings.tasksHeading, newSection);
  await view.app.vault.modify(file, next);
}
