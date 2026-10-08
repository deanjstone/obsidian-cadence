import type { DailyNoteSettings } from '../types/settings';

export type DateInput = Date | string | number;

export function pad(n: number | string): string { return String(n).padStart(2, '0'); }

export function ymd(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
