import { Notice, TFile } from 'obsidian';
import { dateInfo, greeting, ymd } from '../utils/dates';
import { ensureDailyNote } from '../utils/daily-notes';
import { projectNameFromPath } from '../utils/entities';
import { parseH2Sections, parseHeaderKey, parseLinkValues, parseSections, replaceSection } from '../utils/parsing';
import { appendTaskNotesTask, listTaskNotesTasks, toggleTaskNotesTask } from '../utils/tasknotes';
import type { AppViewHost } from './host';

/* App.commands is not in the public obsidian.d.ts. */
interface CommandsApp {
  commands: {
    commands: Record<string, unknown>;
    executeCommandById(id: string): boolean;
  };
}

export async function quickAddTodayTask(view: AppViewHost): Promise<void> {
  if (view.plugin.settings.taskManagementSystem === 'tasknotes') {
    const commandId = "tasknotes:create-new-task";
    const hasCommand = (view.app as unknown as CommandsApp).commands && (view.app as unknown as CommandsApp).commands.commands && (view.app as unknown as CommandsApp).commands.commands[commandId];
    if (hasCommand) {
      (view.app as unknown as CommandsApp).commands.executeCommandById(commandId);
      return;
    }
  }
  const text = await view._prompt({
    title: 'Quick add — today',
    placeholder: 'What needs doing?',
    cta: 'Add task',
  });
  if (!text) return;
  const file = await ensureDailyNote(view.app, view.plugin.settings);
  const content = await view.app.vault.read(file);
  const parsed = parseSections(content, view.plugin.settings);
  const newTasks = [...parsed.tasks, `- [ ] ${text}`];
  const next = replaceSection(content, view.plugin.settings.tasksHeading, newTasks.join('\n'));
  await view.app.vault.modify(file, next);
  new Notice('Added to today');
}

/* ── Today pane ─────────────────────────── */
export async function renderTodayPane(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-today');
  view.todayFile = await ensureDailyNote(view.app, view.plugin.settings);
  const fileContent = await view.app.vault.read(view.todayFile);
  view.todayParsed = parseSections(fileContent, view.plugin.settings);

  let tasksList = [];
  if (view.plugin.settings.taskManagementSystem === 'tasknotes') {
    const todayYmd = ymd(new Date());
    const allTaskNotes = listTaskNotesTasks(view.app);
    view.todayTaskNotes = allTaskNotes.filter(t => t.scheduled === todayYmd);
    tasksList = view.todayTaskNotes.map(t => `- [${t.done ? 'x' : ' '}] ${t.title}`);
  } else {
    tasksList = view.todayParsed.tasks;
  }

  const info = dateInfo();
  root.createDiv({ cls: 'cad-eyebrow', text: info.weekday.toUpperCase() });
  const hero = root.createDiv({ cls: 'cad-date-hero' });
  hero.createSpan({ cls: 'cad-day', text: String(info.day) });
  const monthCol = hero.createDiv();
  monthCol.createDiv({ cls: 'cad-month', text: info.month });
  monthCol.createDiv({ cls: 'cad-year', text: String(info.year) });

  const taskCount = tasksList.filter((l) => / \[ \] /.test(l)).length;
  root.createDiv({
    cls: 'cad-greet',
    text: taskCount === 0
      ? `${greeting()}. Nothing on the books — your day is clear.`
      : `${greeting()}. You have ${taskCount} ${taskCount === 1 ? 'thing' : 'things'} to handle.`,
  });

  /* Tasks */
  const taskSection = root.createDiv({ cls: 'cad-section' });
  const taskLabel = taskSection.createDiv({ cls: 'cad-section-label' });
  taskLabel.createSpan({ text: 'TODAY' });
  const total = tasksList.length;
  const open = tasksList.filter((l) => / \[ \] /.test(l)).length;
  taskLabel.createSpan({ cls: 'cad-count', text: `${open} open · ${total - open} done` });

  if (!tasksList.length) {
    taskSection.createDiv({ cls: 'cad-empty', text: 'No tasks in today\'s note yet.' });
  } else {
    const dailyPath = view.todayFile.path;
    tasksList.forEach((rawLine, idx) => {
      const checked = / \[(x|X)\] /.test(rawLine);
      const text = rawLine.replace(/^\s*-\s\[(x|X| )\]\s/, '');
      const row = taskSection.createDiv({ cls: 'cad-task-row' + (checked ? ' done' : '') });
      const cb = row.createEl('input', { type: 'checkbox' });
      cb.checked = checked;
      cb.addEventListener('change', () => view.toggleTodayTask(idx, cb.checked));

      if (view.plugin.settings.taskManagementSystem === 'tasknotes') {
        const taskObj = view.todayTaskNotes![idx];
        const taskSpan = row.createEl('a', { cls: 'cad-task-text', text });
        taskSpan.style.cursor = 'pointer';
        taskSpan.addEventListener('click', (ev) => {
          ev.preventDefault();
          view.app.workspace.openLinkText(taskObj.file.path, '', false);
        });
      } else {
        row.createSpan({ cls: 'cad-task-text', text });
      }

      /* Project link — chip if linked, then a button */
      let linkedProject = null;
      if (view.plugin.settings.taskManagementSystem === 'tasknotes') {
        const taskObj = view.todayTaskNotes![idx];
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
        linkedProject = view._getTaskProjectLink(dailyPath, text);
      }

      if (linkedProject) {
        const chip = row.createEl('a', { cls: 'cad-task-proj-chip', text: '📁 ' + (projectNameFromPath(view.app, linkedProject) || 'Project') });
        chip.title = 'Open linked project';
        chip.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const file = view.app.vault.getAbstractFileByPath(linkedProject);
          if (file && file instanceof TFile) view.openEntityDetail('project', file);
        });
      }

      if (view.plugin.settings.taskManagementSystem !== 'tasknotes') {
        const linkBtn = row.createEl('button', { cls: 'cad-task-link-btn' + (linkedProject ? ' linked' : ''), text: linkedProject ? '✎' : '📁' });
        linkBtn.title = linkedProject ? 'Change linked project' : 'Link to a project';
        linkBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          view._openTaskProjectPicker(dailyPath, text, linkedProject);
        });
      }
    });
  }

  const quickWrap = taskSection.createDiv();
  quickWrap.style.marginTop = '8px';
  const quick = quickWrap.createEl('input', {
    type: 'text',
    placeholder: 'Quick add a task — Enter to save',
  });
  quick.style.width = '100%';
  quick.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && quick.value.trim()) {
      const v = quick.value.trim();
      quick.value = '';
      view.appendTodayTask(v);
    }
  });

  /* Journal */
  const journalSection = root.createDiv({ cls: 'cad-section' });
  journalSection.createDiv({ cls: 'cad-section-label' }).setText('TODAY’S ENTRY');
  const ta = journalSection.createEl('textarea', { cls: 'cad-journal' });
  ta.value = view.todayParsed.journal;
  ta.placeholder = 'Write what’s on your mind…';
  ta.rows = Math.max(8, ta.value.split('\n').length + 2);
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    if (view._journalSaveTimer) clearTimeout(view._journalSaveTimer);
    view._journalSaveTimer = setTimeout(() => view.saveTodayJournal(ta.value), 800);
  });
  setTimeout(() => { ta.style.height = ta.scrollHeight + 'px'; }, 0);

  /* Custom sections from daily note */
  const allSections = parseH2Sections(fileContent);
  const cleanTasksHeading = (view.plugin.settings.tasksHeading || '## Today').replace(/^##\s+/, '').trim().toLowerCase();
  const cleanJournalHeading = (view.plugin.settings.journalHeading || '## Journal').replace(/^##\s+/, '').trim().toLowerCase();

  const otherKeys = Object.keys(allSections).filter((k) => {
    const cleanK = parseHeaderKey(k).cleanLabel.toLowerCase();
    return cleanK !== cleanTasksHeading && cleanK !== cleanJournalHeading;
  });

  if (otherKeys.length > 0) {
    const customWrap = root.createDiv({ cls: 'cad-custom-sections' });
    customWrap.style.marginTop = '24px';
    customWrap.style.display = 'grid';
    customWrap.style.gridTemplateColumns = 'repeat(auto-fit, minmax(320px, 1fr))';
    customWrap.style.gap = '16px';

    const flashSaved = () => {
      new Notice('Section saved');
    };

    otherKeys.forEach((rawKey) => {
      view._renderDynamicH2Section(customWrap, view.todayFile!, allSections, rawKey, flashSaved);
    });
  }

  /* Footer */
  const footer = root.createDiv();
  footer.style.marginTop = '24px';
  footer.style.fontSize = '12px';
  footer.style.color = 'var(--cad-ink-4)';
  const link = footer.createEl('a', { text: 'Open today\'s daily note →' });
  link.style.color = 'var(--cad-emerald-deep)';
  link.style.cursor = 'pointer';
  link.addEventListener('click', () => {
    view.app.workspace.openLinkText(view.todayFile!.path, '', false);
  });
}

export async function toggleTodayTask(view: AppViewHost, idx: number, checked: boolean): Promise<void> {
  if (view.plugin.settings.taskManagementSystem === 'tasknotes') {
    if (view.todayTaskNotes && view.todayTaskNotes[idx]) {
      const taskObj = view.todayTaskNotes[idx];
      await toggleTaskNotesTask(view.app, taskObj.file, checked);
    }
  } else {
    const content = await view.app.vault.read(view.todayFile!);
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
    await view.app.vault.modify(view.todayFile!, newContent);
    if (taskText) {
      await view._propagateTaskComplete(taskText, checked, { kind: 'daily', file: view.todayFile!, date: new Date() });
    }
  }
  view.render();
}

export async function appendTodayTask(view: AppViewHost, text: string): Promise<void> {
  if (view.plugin.settings.taskManagementSystem === 'tasknotes') {
    await appendTaskNotesTask(view.app, text, new Date());
  } else {
    const content = await view.app.vault.read(view.todayFile!);
    const parsed = parseSections(content, view.plugin.settings);
    const newTasks = [...parsed.tasks, `- [ ] ${text}`];
    const newContent = replaceSection(content, view.plugin.settings.tasksHeading, newTasks.join('\n'));
    await view.app.vault.modify(view.todayFile!, newContent);
  }
  view.render();
}

export async function saveTodayJournal(view: AppViewHost, body: string | null | undefined): Promise<void> {
  const content = await view.app.vault.read(view.todayFile!);
  const newContent = replaceSection(content, view.plugin.settings.journalHeading, body || '');
  await view.app.vault.modify(view.todayFile!, newContent);
}
