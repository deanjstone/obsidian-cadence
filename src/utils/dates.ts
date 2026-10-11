import type { DailyNoteSettings } from '../types/settings';

export type DateInput = Date | string | number;

export function pad(n: number | string): string { return String(n).padStart(2, '0'); }

export function ymd(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* A bare `YYYY-MM-DD` as local midnight, the date ymd() writes back (#46).
   `new Date('YYYY-MM-DD')` reads it as UTC midnight, a day early west of UTC.
   The same strings are valid as before, and an overflowing day rolls over the
   same way. Any other string is null. */
export function parseYmd(s: unknown): Date | null {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const utc = new Date(s);
  if (isNaN(utc.getTime())) return null;
  const d = new Date(0);
  d.setFullYear(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dailyNotePath(settings: Pick<DailyNoteSettings, 'dailyNoteFolder'>, date: Date = new Date()): string {
  const folder = (settings.dailyNoteFolder || '').replace(/\/$/, '');
  const name = ymd(date);
  return folder ? `${folder}/${name}.md` : `${name}.md`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export interface DateInfo {
  weekday: string;
  day: number;
  month: string;
  year: number;
}

export function dateInfo(d: Date = new Date()): DateInfo {
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: 'long' }),
    day: d.getDate(),
    month: d.toLocaleDateString(undefined, { month: 'long' }),
    year: d.getFullYear(),
  };
}

export function startOfDay(d: DateInput): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

export function addDays(d: DateInput, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

export function startOfWeek(d: DateInput, weekStartsOn: number = 1): Date {
  const x = startOfDay(d);
  const diff = (x.getDay() - weekStartsOn + 7) % 7;
  return addDays(x, -diff);
}

export function weekDates(anchor: DateInput, weekStartsOn: number = 1): Date[] {
  const start = startOfWeek(anchor, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/* Helpers for <input type="datetime-local"> ↔ Date in local TZ */
export function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalDatetimeValue(s: string | null | undefined): Date | null {
  if (!s) return null;
  // datetime-local has no timezone — interpret as local time
  return new Date(s);
}
