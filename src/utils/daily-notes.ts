import { TFile, type App } from 'obsidian';
import type { DailyNoteSettings } from '../types/settings';
import { dailyNotePath, ymd } from './dates';

/* ─────────── Daily-note read/write ─────────── */
/* Returns whatever already sits at the daily-note path. That is a TFile in
   practice; a folder with the same name would be returned as-is (unchanged
   legacy behaviour), hence the cast. */
export async function ensureDailyNote(app: App, settings: DailyNoteSettings, date: Date = new Date()): Promise<TFile> {
  const path = dailyNotePath(settings, date);
  let file = app.vault.getAbstractFileByPath(path) as TFile | null;
  if (file) return file;
  const folder = (settings.dailyNoteFolder || '').replace(/\/$/, '');
  if (folder && !app.vault.getAbstractFileByPath(folder)) {
    try { await app.vault.createFolder(folder); } catch (_) { }
  }

  let template = '';
  const dailyTemplatePath = 'Cadence/Templates/daily.md';
  const dailyTemplateFile = app.vault.getAbstractFileByPath(dailyTemplatePath);
  if (dailyTemplateFile && dailyTemplateFile instanceof TFile) {
    const rawTemplate = await app.vault.read(dailyTemplateFile);
    const now = new Date();
    const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    template = rawTemplate
      .replace(/\{\{name\}\}/gi, ymd(date))
      .replace(/\{\{title\}\}/gi, ymd(date))
      .replace(/\{\{date\}\}/gi, ymd(date))
      .replace(/\{\{time\}\}/gi, timeStr);
  } else {
    template = [
      `# ${ymd(date)}`, '',
      settings.tasksHeading, '- [ ] ', '',
      settings.journalHeading, '', '',
    ].join('\n');
  }

  file = await app.vault.create(path, template);
  return file;
}
