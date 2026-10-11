import type { App, TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import type { Frontmatter, TaskNotesTask } from '../types/entities';
import { ymd } from './dates';
import { entityValue, listEntities } from './entities';
import { parseLinkValues } from './parsing';
import { ensureFolderSync, type VaultNode } from './vault';

/* ─────────── TaskNotes Integration Helpers ─────────── */
export function listTaskNotesTasks(app: App): TaskNotesTask[] {
  const folderPath = "TaskNotes/Tasks";
  const folder = app.vault.getAbstractFileByPath(folderPath) as VaultNode | null;
  if (!folder || !folder.children) return [];
  const tasks: TaskNotesTask[] = [];
  const walk = (node: VaultNode) => {
    for (const child of node.children!) {
      if (child.children) walk(child);
      else if (typeof child.path === 'string' && child.path.toLowerCase().endsWith('.md')) {
        const cache = app.metadataCache.getFileCache(child as TFile);
        const fm: Frontmatter = (cache && cache.frontmatter) || {};
        tasks.push({
          file: child as TFile,
          title: (fm.title as string) || (child as TFile).basename,
          status: (fm.status as string) || 'open',
          scheduled: (fm.scheduled as string) || '',
          due: (fm.due as string) || '',
          priority: (fm.priority as string) || 'normal',
          projects: fm.projects || '',
          done: fm.status === 'done'
        });
      }
    }
  };
  walk(folder);
  return tasks;
}

export function listTaskNotesTasksForFile(app: App, file: TFile): TaskNotesTask[] {
  const allTasks = listTaskNotesTasks(app);
  const name = file.basename;
  return allTasks.filter(t => {
    if (!t.projects) return false;
    const links = parseLinkValues(t.projects);
    return links.some(l => l.target === name);
  });
}

export async function toggleTaskNotesTask(app: App, taskFile: TFile, checked: boolean): Promise<void> {
  await app.fileManager.processFrontMatter(taskFile, (fm) => {
    fm.status = checked ? 'done' : 'open';
  });
}

export async function appendTaskNotesTask(app: App, text: string, date: Date = new Date()): Promise<void> {
  const ymdStr = ymd(date);
  const folderPath = "TaskNotes/Tasks";
  await ensureFolderSync(app, folderPath);

  const cleanTitle = text.replace(/[\\/:*?"<>|]/g, '').trim();
  let filename = `${folderPath}/${cleanTitle}.md`;
  let file = app.vault.getAbstractFileByPath(filename);
  let counter = 1;
  while (file) {
    filename = `${folderPath}/${cleanTitle} (${counter}).md`;
    file = app.vault.getAbstractFileByPath(filename);
    counter++;
  }

  const content = `---
title: ${text}
status: open
scheduled: ${ymdStr}
priority: normal
---
`;
  await app.vault.create(filename, content);
}

/** A note a TaskNotes `projects` link may name: a project's file, with its `name`. */
export interface ProjectLinkTarget {
  basename: string;
  path: string;
  name?: string;
}

/** The project notes, as TaskNotes project links resolve against them. */
export function projectLinkTargets(app: App): ProjectLinkTarget[] {
  return listEntities(app, 'project').map((e) => ({
    basename: e.basename,
    path: e.file.path,
    name: String(entityValue(e, 'name', ENTITIES.project) || ''),
  }));
}

/** A TaskNotes task's linked project: the first `projects` link, matched to
    a project's name, else its file name, else its path without `.md`, in any
    case. Only the listed projects match, so a link to another note with the
    same basename names no project (#55). */
export function taskNotesProjectPath(projects: unknown, targets: ProjectLinkTarget[]): string | null {
  if (!projects) return null;
  const parsed = parseLinkValues(projects);
  if (!parsed.length) return null;
  const target = parsed[0].target.toLowerCase();
  const match = targets.find((t) => (t.name || '').trim().toLowerCase() === target)
    || targets.find((t) => t.basename.toLowerCase() === target)
    || targets.find((t) => t.path.replace(/\.md$/i, '').toLowerCase() === target);
  return match ? match.path : null;
}
