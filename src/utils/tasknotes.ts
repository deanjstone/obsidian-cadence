import type { App, TFile } from 'obsidian';
import type { Frontmatter, TaskNotesTask } from '../types/entities';
import { ymd } from './dates';
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
