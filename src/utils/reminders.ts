import type { Reminder, ReminderBucket } from '../types/reminders';
import { startOfDay, type DateInput } from './dates';

export function reminderId(): string { return 'rem_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

export function isRepeating(repeat?: string): boolean { return repeat === 'daily' || repeat === 'weekly'; }

/** A reminder's repeat badge: `↻ daily` or `↻ weekly`, the two repeats the
    engine runs (isRepeating). Any other value never repeats, so it has no
    badge, on Home or in the Inbox (#55). */
export function repeatLabel(repeat: string | null | undefined): string | null {
  if (!repeat || !isRepeating(repeat)) return null;
  return `↻ ${repeat}`;
}

export function nextRepeat(when: DateInput | null | undefined, repeat?: string): Date | null {
  if (!when) return null;
  const d = when instanceof Date ? when : new Date(when);
  if (repeat === 'daily') return new Date(d.getTime() + 86400000);
  if (repeat === 'weekly') return new Date(d.getTime() + 7 * 86400000);
  return null;
}

/** A reminder's time in ms, or null when it has none or Date can't read it.
    An unreadable time never fires (isDue), so the Inbox and Home treat it as
    unscheduled: never overdue, sorted after every readable time (#55). */
export function reminderTime(when: DateInput | null | undefined): number | null {
  if (!when) return null;
  const t = new Date(when).getTime();
  return isNaN(t) ? null : t;
}

/** A reminder's time label: reminderTimeStr, 'unreadable time' when Date
    can't read it, '' with no time. */
export function reminderTimeLabel(when: DateInput | null | undefined): string {
  if (!when) return '';
  return reminderTime(when) === null ? 'unreadable time' : reminderTimeStr(when);
}

export function reminderBucket(when: DateInput | null | undefined): ReminderBucket {
  if (!when) return 'later';
  const now = Date.now();
  const w = new Date(when).getTime();
  if (w <= now + 60 * 60 * 1000) return 'now';            // due now or within next hour
  const today = startOfDay(new Date()).getTime();
  const tomorrow = today + 86400000;
  if (w < tomorrow) return 'today';
  const weekEnd = today + 7 * 86400000;
  if (w < weekEnd) return 'week';
  return 'later';
}

/* Find an existing reminder linked to a specific (project, task-text) pair. */
export function findProjectTaskReminder(
  plugin: { settings: { reminders?: Reminder[] } },
  projectPath: string | null | undefined,
  taskText: string | null | undefined,
): Reminder | null {
  if (!projectPath || !taskText) return null;
  const all = plugin.settings.reminders || [];
  return all.find((r) => !r.done && r.project === projectPath && r.text === taskText) || null;
}

export function reminderTimeStr(when: DateInput | null | undefined): string {
  if (!when) return '';
  const d = new Date(when);
  if (isNaN(d.getTime())) return '';
  const today = startOfDay(new Date()).getTime();
  const dDay = startOfDay(d).getTime();
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (dDay === today) return time;
  if (dDay === today + 86400000) return `Tomorrow ${time}`;
  if (dDay - today < 7 * 86400000 && dDay > today) {
    return d.toLocaleDateString(undefined, { weekday: 'short' }) + ' ' + time;
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + time;
}
