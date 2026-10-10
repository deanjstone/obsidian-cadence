import { Notice, SuggestModal, TFile, type App } from 'obsidian';
import { ymd } from '../utils/dates';
import { listEntityFiles, projectNameFromPath } from '../utils/entities';
import { tickDailyTasks, tickProjectTasks } from '../utils/task-lines';
import type { Reminder } from '../types/reminders';
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

/** What one tick touches, before any file is checked for existence. */
export interface PropagationTargets {
  /** The trimmed task text every target is matched on. */
  text: string;
  /** Reminders whose done state changes (the source reminder excluded). */
  reminderIds: string[];
  /** Linked project paths, once each, the source project excluded. */
  projectPaths: string[];
  /** Daily-note paths: today, each match's `when` and `createdAt` dates, and a
      daily source's date, once each, the source note excluded. */
  dailyPaths: string[];
}

/** The pure part of _propagateTaskComplete. Null for blank text. Its five
    callers are Today and the Calendar (kind 'daily'), Home's Today card
    (kind 'daily'), the Inbox Done button (kind 'reminder') and the project
    task section (kind 'project'). */
export function propagationTargets(
  text: string | null | undefined, done: boolean, source: TaskCompleteSource | undefined,
  reminders: Reminder[], dailyNoteFolder: string | undefined, now: Date,
): PropagationTargets | null {
  const t = String(text || '').trim();
  if (!t) return null;
  source = source || ({} as TaskCompleteSource);
  const matches = reminders.filter((r) => r.text && r.text.trim() === t);

  const reminderIds: string[] = [];
  for (const r of matches) {
    if (source.kind === 'reminder' && r.id === source.id) continue;
    if (!!r.done === !!done) continue;
    reminderIds.push(r.id);
  }

  const projectPaths: string[] = [];
  for (const r of matches) {
    if (!r.project) continue;
    if (source.kind === 'project' && source.file && source.file.path === r.project) continue;
    if (projectPaths.includes(r.project)) continue;
    projectPaths.push(r.project);
  }

  const datesToCheck = new Set([ymd(now)]);
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
  const dailyPaths: string[] = [];
  for (const dateStr of datesToCheck) {
    const path = dailyNoteFolder
      ? `${dailyNoteFolder.replace(/\/$/, '')}/${dateStr}.md`
      : `${dateStr}.md`;
    if (source.kind === 'daily' && source.file && source.file.path === path) continue;
    dailyPaths.push(path);
  }
  return { text: t, reminderIds, projectPaths, dailyPaths };
}

export async function propagateTaskComplete(view: AppViewHost, text: string, done: boolean, source?: TaskCompleteSource): Promise<void> {
  const settings = view.plugin.settings;
  const targets = propagationTargets(text, done, source, (settings.reminders || []).slice(), settings.dailyNoteFolder, new Date());
  if (!targets) return;

  /* 1. Sync matching reminders (skip the source reminder) */
  for (const id of targets.reminderIds) {
    await view.plugin.updateReminder(id, { done: !!done });
  }

  /* 2. For any matching reminder linked to a project, tick that project's task line */
  for (const path of targets.projectPaths) {
    const file = view.app.vault.getAbstractFileByPath(path);
    if (!file || !(file instanceof TFile)) continue;
    await view._tickProjectTaskByText(file, targets.text, !!done);
  }

  /* 3. Tick matching task line in relevant daily notes (today + each match's date note + source date) */
  for (const path of targets.dailyPaths) {
    const file = view.app.vault.getAbstractFileByPath(path);
    if (!file || !(file instanceof TFile)) continue;
    await view._tickDailyNoteTaskByText(file, targets.text, !!done);
  }
}

export async function tickProjectTaskByText(view: AppViewHost, file: TFile, text: string, done: boolean): Promise<void> {
  let content;
  try { content = await view.app.vault.read(file); } catch (_) { return; }
  const next = tickProjectTasks(content, text, done);
  if (next === null) return;
  await view.app.vault.modify(file, next);
}

export async function tickDailyNoteTaskByText(view: AppViewHost, file: TFile, text: string, done: boolean): Promise<void> {
  let content;
  try { content = await view.app.vault.read(file); } catch (_) { return; }
  const next = tickDailyTasks(content, view.plugin.settings, text, done);
  if (next === null) return;
  await view.app.vault.modify(file, next);
}
