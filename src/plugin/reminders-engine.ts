import { Notice } from 'obsidian';
import type { Reminder } from '../types/reminders';
import { nextRepeat, reminderId } from '../utils/reminders';
import type { PluginHost } from './host';

/* The reminders engine: CRUD over settings.reminders, the 30-second ticker
   and the notification. CadencePlugin keeps a one-line delegate for each.
   The reminder maths is plain data (newReminder, dueReminders,
   advanceReminder, snoozePatch) with the clock passed in. */

/* What addReminder accepts; any other field is dropped. */
export interface ReminderInput {
  text: string;
  when?: string | null;
  repeat?: string;
  notes?: string;
  project?: string | null;
}

/* The reminder addReminder stores. Empty when, repeat, notes and project
   fall back to their unset values. */
export function newReminder(partial: ReminderInput, now: Date): Reminder {
  return {
    id: reminderId(),
    text: partial.text,
    when: partial.when || null,
    repeat: partial.repeat || 'none',
    notes: partial.notes || '',
    project: partial.project || null,  // file path of linked project, if any
    notified: false,
    done: false,
    createdAt: now.toISOString(),
  };
}

/* Due: open, not yet notified, and scheduled at or before `now` (ms). An
   unscheduled or unparseable reminder is never due. */
export function isDue(r: Reminder, now: number): boolean {
  if (r.done || r.notified) return false;
  if (!r.when) return false;
  const w = new Date(r.when).getTime();
  return !(isNaN(w) || w > now);
}

export function dueReminders(reminders: Reminder[], now: number): Reminder[] {
  return reminders.filter((r) => isDue(r, now));
}

/* The next occurrence of a repeating reminder that just fired, one repeat
   after its own `when` (not after `now`), or null for a one-off. It keeps
   the reminder's notes and project link.
   QUIRK (#22): a series missed for several periods catches up one
   occurrence per tick. */
export function advanceReminder(r: Reminder, now: Date): Reminder | null {
  const next = nextRepeat(new Date(r.when as string), r.repeat);
  if (!next) return null;
  return {
    id: reminderId(),
    text: r.text,
    when: next.toISOString(),
    repeat: r.repeat,
    notes: r.notes || '',
    project: r.project || null,
    notified: false,
    done: false,
    createdAt: now.toISOString(),
  };
}

/* Snooze moves `when` to now + ms and clears `notified`. QUIRK (#22): it
   leaves `done` alone, so a done reminder stays silent. */
export function snoozePatch(ms: number, now: number): Partial<Reminder> {
  const target = new Date(now + ms);
  return {
    when: target.toISOString(),
    notified: false,
  };
}

/* QUIRK (#22): completing a repeating reminder ends the series, because
   only the ticker schedules the next occurrence. */
export const COMPLETE_PATCH: Readonly<Partial<Reminder>> = { done: true, notified: true };

export async function addReminder(plugin: PluginHost, partial: ReminderInput): Promise<Reminder> {
  const r = newReminder(partial, new Date());
  if (!Array.isArray(plugin.settings.reminders)) plugin.settings.reminders = [];
  plugin.settings.reminders.push(r);
  await plugin.saveSettings();
  plugin.refreshOpenViews();
  return r;
}

export async function updateReminder(plugin: PluginHost, id: string, patch: Partial<Reminder>): Promise<Reminder | null> {
  const i = (plugin.settings.reminders || []).findIndex((r) => r.id === id);
  if (i < 0) return null;
  plugin.settings.reminders[i] = Object.assign({}, plugin.settings.reminders[i], patch);
  await plugin.saveSettings();
  plugin.refreshOpenViews();
  return plugin.settings.reminders[i];
}

export async function deleteReminder(plugin: PluginHost, id: string): Promise<void> {
  plugin.settings.reminders = (plugin.settings.reminders || []).filter((r) => r.id !== id);
  await plugin.saveSettings();
  plugin.refreshOpenViews();
}

export async function snoozeReminder(plugin: PluginHost, id: string, ms: number): Promise<Reminder | null> {
  return plugin.updateReminder(id, snoozePatch(ms, Date.now()));
}

export async function completeReminder(plugin: PluginHost, id: string): Promise<Reminder | null> {
  return plugin.updateReminder(id, { ...COMPLETE_PATCH });
}

/* ── Reminder ticker ── */
export function tickReminders(plugin: PluginHost): void {
  if (!Array.isArray(plugin.settings.reminders)) return;
  const due = dueReminders(plugin.settings.reminders, Date.now());
  const additions: Reminder[] = [];
  for (const r of due) {
    plugin._fireReminder(r);
    r.notified = true;
    const next = advanceReminder(r, new Date());
    if (next) additions.push(next);
  }
  if (additions.length) plugin.settings.reminders.push(...additions);
  if (due.length) {
    plugin.saveSettings().then(() => plugin.refreshOpenViews());
  }
}

export function fireReminder(plugin: PluginHost, r: Reminder): void {
  new Notice(`⏰  ${r.text}`, 8000);
  if (plugin.settings.desktopNotifications && typeof Notification !== 'undefined') {
    try {
      if (Notification.permission === 'granted') {
        new Notification('Cadence reminder', { body: r.text });
      }
    } catch (_) { }
  }
}
