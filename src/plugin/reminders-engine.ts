import { Notice } from 'obsidian';
import type { Reminder } from '../types/reminders';
import { nextRepeat, reminderId } from '../utils/reminders';
import type { PluginHost } from './host';

/* The reminders engine: CRUD over settings.reminders, the 30-second ticker
   and the notification. CadencePlugin keeps a one-line delegate for each. */

/* What addReminder accepts; any other field is dropped. */
export interface ReminderInput {
  text: string;
  when?: string | null;
  repeat?: string;
  notes?: string;
  project?: string | null;
}

export async function addReminder(plugin: PluginHost, partial: ReminderInput): Promise<Reminder> {
  const r: Reminder = {
    id: reminderId(),
    text: partial.text,
    when: partial.when || null,
    repeat: partial.repeat || 'none',
    notes: partial.notes || '',
    project: partial.project || null,  // file path of linked project, if any
    notified: false,
    done: false,
    createdAt: new Date().toISOString(),
  };
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
  const target = new Date(Date.now() + ms);
  return plugin.updateReminder(id, {
    when: target.toISOString(),
    notified: false,
  });
}

export async function completeReminder(plugin: PluginHost, id: string): Promise<Reminder | null> {
  return plugin.updateReminder(id, { done: true, notified: true });
}

/* ── Reminder ticker ── */
export function tickReminders(plugin: PluginHost): void {
  if (!Array.isArray(plugin.settings.reminders)) return;
  const now = Date.now();
  let dirty = false;
  const additions: Reminder[] = [];
  for (const r of plugin.settings.reminders) {
    if (r.done || r.notified) continue;
    if (!r.when) continue;
    const w = new Date(r.when).getTime();
    if (isNaN(w) || w > now) continue;
    plugin._fireReminder(r);
    r.notified = true;
    dirty = true;
    const next = nextRepeat(new Date(r.when), r.repeat);
    if (next) {
      // QUIRK (#22): the next occurrence drops notes and project.
      additions.push({
        id: reminderId(),
        text: r.text,
        when: next.toISOString(),
        repeat: r.repeat,
        notified: false,
        done: false,
        createdAt: new Date().toISOString(),
      } as Reminder);
    }
  }
  if (additions.length) plugin.settings.reminders.push(...additions);
  if (dirty) {
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
