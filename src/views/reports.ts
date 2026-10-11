import { TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import type { Entity, EntityDef } from '../types/entities';
import type { DailyNoteSettings } from '../types/settings';
import { addDays, dailyNotePath, parseYmd, startOfDay, startOfWeek, ymd } from '../utils/dates';
import { crmSummary, dealClosedAt, dealOutcome, dealValue, dealsByStage, stageConfidence, sumValues } from '../utils/deals';
import { entityValue, getDealStages, listEntities } from '../utils/entities';
import { fmtValue } from '../utils/format';
import { parseSections } from '../utils/parsing';
import { countTaskLines } from '../utils/task-lines';
import type { DashCardRow, MiniStat, StatCard } from './components/cards';
import type { AppViewHost } from './host';

/* The five tabular reports (reports.pipeline, reports.sales,
   reports.partners, reports.activity and reports.productivity): stat cards,
   bar charts and dashboard cards over the deals, partners, certifications,
   activities and daily notes. Each report's maths is one pure function,
   `xReport(...)`, and its surface reads the vault and draws the result. */

/* ── Pure seams: plain data in, plain data out ── */

const DAY_MS = 86400000;

export type BarBand = 'empty' | 'low' | 'mid' | 'high';

/* One column of a report bar chart. */
export interface ReportBar {
  label: string;
  /** The bar's hover text. */
  title: string;
  /** The bar's CSS height, scaled to the chart's largest value. */
  height: string;
  band: BarBand;
}

/* A column's height and band for `value` against the chart's `max` (at
   least 1): zero is empty, under 0.34 of the max low, under 0.67 mid,
   else high. */
export function reportBar(value: number, max: number): { height: string; band: BarBand } {
  const ratio = value / max;
  return {
    height: `${(value / max) * 100}%`,
    band: value === 0 ? 'empty' : ratio < 0.34 ? 'low' : ratio < 0.67 ? 'mid' : 'high',
  };
}

/* MiniStat moved to components/cards.ts, which PRM analytics shares; re-exported here. */
export type { MiniStat } from './components/cards';

function entityTitle(entity: Entity, key: string, def: EntityDef): string {
  return (entityValue(entity, key, def) as string) || entity.basename;
}

/* Owner rows: `(unassigned)` is plain text, any other owner links to contacts. */
function ownerRows<T>(byOwner: Map<string, T>, size: (data: T) => number, limit: number, meta: (data: T) => string): DashCardRow[] {
  return [...byOwner.entries()]
    .sort((a, b) => size(b[1]) - size(a[1]))
    .slice(0, limit)
    .map(([owner, data]) => ({
      title: owner,
      titleEntityKey: owner === '(unassigned)' ? null : 'contact',
      meta: meta(data),
    }));
}

export interface PipelineReport {
  /** Every deal not Won or Lost (in any case), as on the CRM dashboard. */
  open: Entity[];
  won: Entity[];
  lost: Entity[];
  /** Open value times each stage's confidence (stageConfidence): the
      built-in open stages in any case, custom configured stages by place,
      off-list stages 0. */
  weighted: number;
  winRate: number;
  stats: StatCard[];
  /** One row per configured stage, then one per stage off the list and
      `(no stage)` (dealsByStage), so every deal is in one row. */
  byStage: Array<{ stage: string; count: number; value: number }>;
  /** The top 8 owners of open deals by value. */
  owners: DashCardRow[];
  /** Open deals by days since the file's last edit (0 when it has no stat):
      up to 7, 30, 90, then older. `value` shows the count and `total` is their value. */
  cohorts: Array<MiniStat & { count: number; total: number }>;
  /** Up to 5 open deals edited more than 30 days before `now`, oldest first. */
  stale: DashCardRow[];
}

export function pipelineReport(deals: Entity[], def: EntityDef, stages: string[], now: number): PipelineReport {
  const { open, won, lost, openValue, wonValue, lostValue, winRate } = crmSummary(deals, def);
  const confidence = stageConfidence(stages);
  const weighted = open.reduce((s, e) => s + dealValue(e, def) * confidence(entityValue(e, 'stage', def)), 0);

  const byOwner = new Map<string, { count: number; value: number }>();
  open.forEach((e) => {
    const owner = String(entityValue(e, 'owner', def) || '(unassigned)');
    if (!byOwner.has(owner)) byOwner.set(owner, { count: 0, value: 0 });
    const o = byOwner.get(owner)!;
    o.count++; o.value += dealValue(e, def);
  });

  const cohorts = [
    { label: '0–7 DAYS', cutoff: 7, count: 0, value: 0, accent: 'emerald' },
    { label: '8–30 DAYS', cutoff: 30, count: 0, value: 0, accent: 'mint' },
    { label: '31–90 DAYS', cutoff: 90, count: 0, value: 0, accent: 'warn' },
    { label: '90+ DAYS', cutoff: Infinity, count: 0, value: 0, accent: 'rose' },
  ];
  open.forEach((e) => {
    const mtime = e.file && e.file.stat ? e.file.stat.mtime : now;
    const days = (now - mtime) / DAY_MS;
    for (const c of cohorts) {
      if (days <= c.cutoff) { c.count++; c.value += dealValue(e, def); break; }
    }
  });

  const staleCutoff = now - 30 * DAY_MS;
  const stale = open
    .filter((e) => e.file && e.file.stat && e.file.stat.mtime < staleCutoff)
    .sort((a, b) => (a.file.stat!.mtime || 0) - (b.file.stat!.mtime || 0))
    .slice(0, 5)
    .map((e) => ({
      title: entityTitle(e, 'title', def),
      meta: `${entityValue(e, 'stage', def) || '—'} · ${Math.round((now - e.file.stat!.mtime) / DAY_MS)}d quiet · ${fmtValue(dealValue(e, def), 'currency')}`,
      file: e.file,
    }));

  return {
    open, won, lost, weighted, winRate,
    stats: [
      { label: 'OPEN', value: open.length, sub: fmtValue(openValue, 'currency'), accent: 'sky' },
      { label: 'WEIGHTED', value: fmtValue(weighted, 'currency'), sub: 'forecast on open', accent: 'mint' },
      { label: 'WON', value: won.length, sub: fmtValue(wonValue, 'currency'), accent: 'emerald' },
      { label: 'LOST', value: lost.length, sub: fmtValue(lostValue, 'currency'), accent: 'rose' },
      { label: 'WIN RATE', value: `${winRate}%`, sub: `${won.length}/${won.length + lost.length} closed`, accent: 'warn' },
    ],
    byStage: dealsByStage(deals, def, stages).map(({ stage, items }) => ({ stage, count: items.length, value: sumValues(items, def) })),
    owners: ownerRows(byOwner, (o) => o.value, 8,
      (o) => `${o.count} deal${o.count === 1 ? '' : 's'} · ${fmtValue(o.value, 'currency')}`),
    cohorts: cohorts.map(({ label, count, value, accent }) => ({
      label, value: String(count), accent, sub: fmtValue(value, 'currency'), count, total: value,
    })),
    stale,
  };
}

export interface SalesReport {
  won: Entity[];
  lost: Entity[];
  /** Won over closed, by value, as a whole percent; 0 with nothing closed. */
  captureRate: number;
  stats: StatCard[];
  /** Revenue per calendar month for the 6 months up to `now`, oldest first,
      dated by each won deal's close date (dealClosedAt: `closed`, else the
      file mtime). A deal with neither is in none. */
  months: Array<{ date: Date; label: string; revenue: number; count: number }>;
  bars: ReportBar[];
  /** The 6 largest wins. */
  topWins: DashCardRow[];
  /** The top 6 owners by won revenue. */
  owners: DashCardRow[];
}

export function salesReport(deals: Entity[], def: EntityDef, now: Date): SalesReport {
  const { won, lost, wonValue, lostValue, avgDeal } = crmSummary(deals, def);
  const total = wonValue + lostValue;
  const captureRate = total === 0 ? 0 : Math.round((wonValue / total) * 100);

  const months: SalesReport['months'] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ date: d, label: d.toLocaleDateString(undefined, { month: 'short' }), revenue: 0, count: 0 });
  }
  won.forEach((e) => {
    const d = dealClosedAt(e, def);
    if (!d) return;
    const idx = months.findIndex((m) => m.date.getFullYear() === d.getFullYear() && m.date.getMonth() === d.getMonth());
    if (idx >= 0) { months[idx].revenue += dealValue(e, def); months[idx].count++; }
  });
  const maxRev = Math.max(1, ...months.map((m) => m.revenue));

  const byOwner = new Map<string, { count: number; revenue: number }>();
  won.forEach((e) => {
    const owner = String(entityValue(e, 'owner', def) || '(unassigned)');
    if (!byOwner.has(owner)) byOwner.set(owner, { count: 0, revenue: 0 });
    const o = byOwner.get(owner)!;
    o.count++; o.revenue += dealValue(e, def);
  });

  return {
    won, lost, captureRate,
    stats: [
      { label: 'REVENUE', value: fmtValue(wonValue, 'currency'), sub: `${won.length} deals`, accent: 'emerald' },
      { label: 'LOST', value: fmtValue(lostValue, 'currency'), sub: `${lost.length} deals`, accent: 'rose' },
      { label: 'CAPTURE', value: `${captureRate}%`, sub: 'of closed value', accent: 'mint' },
      { label: 'AVG DEAL', value: fmtValue(avgDeal, 'currency'), sub: 'won deals', accent: 'sky' },
    ],
    months,
    bars: months.map((m) => ({
      label: m.label,
      title: `${m.label} — ${fmtValue(m.revenue, 'currency')} · ${m.count} deals`,
      ...reportBar(m.revenue, maxRev),
    })),
    topWins: [...won]
      .sort((a, b) => dealValue(b, def) - dealValue(a, def))
      .slice(0, 6)
      .map((e) => ({
        title: entityTitle(e, 'title', def),
        metaParts: [
          { text: (entityValue(e, 'company', def) as string) || '—', entityKey: 'company' },
          { text: ` · ${fmtValue(dealValue(e, def), 'currency')}` },
        ],
        file: e.file,
      })),
    owners: ownerRows(byOwner, (o) => o.revenue, 6, (o) => `${o.count} won · ${fmtValue(o.revenue, 'currency')}`),
  };
}

const TIER_ACCENT: Record<string, string> = { 'Gold': 'warn', 'Silver': 'sky', 'Bronze': 'rose', 'Standard': 'mint' };

export interface PartnersReport {
  /** Deals with any `partner` value. */
  partnerSourced: Entity[];
  partnerWon: Entity[];
  stats: StatCard[];
  /** Partners per tier ('Untiered' for none), most first. */
  tiers: MiniStat[];
  /** The top 10 sources by deal count. `partner` is the raw value, or
      '(direct)' for none, so a one-item list is its own source. */
  sources: Array<{ partner: unknown; count: number; meta: string }>;
  /** Up to 8 certifications expiring from `now` to 90 days out, soonest first. */
  certs: DashCardRow[];
}

export function partnersReport(
  deals: Entity[], partners: Entity[], certs: Entity[], now: number,
  defs: { deal: EntityDef; partner: EntityDef; certification: EntityDef } = { deal: ENTITIES.deal, partner: ENTITIES.partner, certification: ENTITIES.certification },
): PartnersReport {
  const { deal: dealDef, partner: partnerDef, certification: certDef } = defs;
  // TODO: confirm shape — `partner` is read raw, so a list is its own key.
  const byPartner = new Map<unknown, Entity[]>();
  deals.forEach((e) => {
    const p = entityValue(e, 'partner', dealDef) || '(direct)';
    if (!byPartner.has(p)) byPartner.set(p, []);
    byPartner.get(p)!.push(e);
  });
  const partnerSourced = deals.filter((e) => entityValue(e, 'partner', dealDef));
  const partnerWon = partnerSourced.filter((e) => dealOutcome(e, dealDef) === 'won');

  const tierMap = new Map<string, number>();
  partners.forEach((p) => {
    const t = String(entityValue(p, 'tier', partnerDef) || 'Untiered');
    if (!tierMap.has(t)) tierMap.set(t, 0);
    tierMap.set(t, tierMap.get(t)! + 1);
  });

  const horizon = now + 90 * DAY_MS;
  const today = startOfDay(now).getTime();
  const upcoming = certs
    .map((e) => {
      const exp = entityValue(e, 'expires', certDef);
      if (!exp) return null;
      const d = parseYmd(exp) ?? new Date(exp as string);
      if (isNaN(d.getTime())) return null;
      return { entity: e, date: d };
    })
    .filter((x): x is { entity: Entity; date: Date } => (x && x.date.getTime() >= today && x.date.getTime() <= horizon) as boolean)
    .sort((a, b) => (a.date as unknown as number) - (b.date as unknown as number))
    .slice(0, 8);

  return {
    partnerSourced, partnerWon,
    stats: [
      { label: 'PARTNERS', value: partners.length, sub: 'on the books', accent: 'sky' },
      { label: 'PARTNER DEALS', value: partnerSourced.length, sub: fmtValue(sumValues(partnerSourced, dealDef), 'currency'), accent: 'mint' },
      { label: 'PARTNER REV', value: fmtValue(sumValues(partnerWon, dealDef), 'currency'), sub: `${partnerWon.length} won`, accent: 'emerald' },
      { label: 'UNIQUE SOURCES', value: byPartner.size, sub: 'including direct', accent: 'warn' },
    ],
    tiers: [...tierMap.entries()].sort((a, b) => b[1] - a[1])
      .map(([tier, count]) => ({ label: tier.toUpperCase(), value: String(count), accent: TIER_ACCENT[tier] || 'sky' })),
    sources: [...byPartner.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .map(([partner, items]) => ({
        partner,
        count: items.length,
        meta: `${items.length} deal${items.length === 1 ? '' : 's'} · ${fmtValue(sumValues(items, dealDef), 'currency')}`,
      })),
    certs: upcoming.map((x) => ({
      title: entityTitle(x.entity, 'name', certDef),
      metaParts: [
        { text: (entityValue(x.entity, 'partner', certDef) as string) || '—', entityKey: 'partner' },
        { text: ` · expires ${fmtValue(x.date, 'date')}` },
      ],
      file: x.entity.file,
    })),
  };
}

const ACTIVITY_ACCENTS = ['sky', 'mint', 'warn', 'rose'];

export interface ActivityReport {
  /** The total, then one card per type in first-seen order (case-sensitive; 'unspecified' for none). */
  stats: StatCard[];
  /** The 8 weeks up to the current one, oldest first, from `weekStartsOn`. */
  weeks: Array<{ start: Date; end: Date; count: number; label: string }>;
  bars: ReportBar[];
  /** The top 8 `with` values by activity count; blank ones are skipped. */
  topContacts: DashCardRow[];
  /** The 10 latest by `when`, newest first; undated sorts as 1970. */
  recent: DashCardRow[];
}

export function activityReport(activities: Entity[], def: EntityDef, now: Date, weekStartsOn?: number): ActivityReport {
  const counts = new Map<string, number>();
  activities.forEach((e) => {
    const t = String(entityValue(e, 'type', def) || 'unspecified');
    counts.set(t, (counts.get(t) || 0) + 1);
  });
  const stats: StatCard[] = [{ label: 'TOTAL', value: activities.length, sub: 'all activities', accent: 'emerald' }];
  let i = 0;
  counts.forEach((v, k) => stats.push({ label: k.toUpperCase(), value: v, sub: '', accent: ACTIVITY_ACCENTS[i++ % ACTIVITY_ACCENTS.length] }));

  const weekStart = startOfWeek(now, weekStartsOn);
  const weeks: ActivityReport['weeks'] = [];
  for (let w = 7; w >= 0; w--) {
    const ws = addDays(weekStart, -w * 7);
    weeks.push({ start: ws, end: addDays(ws, 7), count: 0, label: ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });
  }
  activities.forEach((e) => {
    const when = entityValue(e, 'when', def);
    if (!when) return;
    const t = new Date(when as string).getTime();
    if (isNaN(t)) return;
    const idx = weeks.findIndex((w) => t >= w.start.getTime() && t < w.end.getTime());
    if (idx >= 0) weeks[idx].count++;
  });
  const maxWeek = Math.max(1, ...weeks.map((w) => w.count));

  const contactCounts = new Map<string, number>();
  activities.forEach((e) => {
    const w = String(entityValue(e, 'with', def) || '').trim();
    if (!w) return;
    contactCounts.set(w, (contactCounts.get(w) || 0) + 1);
  });

  return {
    stats,
    weeks,
    bars: weeks.map((w) => ({ label: w.label, title: `Week of ${w.label} — ${w.count} activities`, ...reportBar(w.count, maxWeek) })),
    topContacts: [...contactCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([who, count]) => ({ title: who, titleEntityKey: 'contact', meta: `${count} activit${count === 1 ? 'y' : 'ies'}` })),
    recent: [...activities]
      .sort((a, b) => {
        const da = new Date((entityValue(a, 'when', def) as string) || 0).getTime();
        const db = new Date((entityValue(b, 'when', def) as string) || 0).getTime();
        return db - da;
      })
      .slice(0, 10)
      .map((e) => ({
        title: entityTitle(e, 'subject', def),
        metaParts: [
          { text: (entityValue(e, 'type', def) as string) || '—' },
          { text: ' · ' },
          { text: (entityValue(e, 'with', def) as string) || '—', entityKey: 'contact' },
          { text: ` · ${fmtValue(entityValue(e, 'when', def), 'date')}` },
        ],
        file: e.file,
      })),
  };
}

const WEEKDAY_ACCENTS = ['emerald', 'mint', 'sky', 'warn', 'rose', 'mint', 'sky'];

export type ProductivitySettings = Pick<DailyNoteSettings, 'tasksHeading' | 'journalHeading'> & { weekStartsOn?: number };

/* Every date the report reads, oldest first: from the start of the
   12-week trend to today. It covers the last 30 days too. */
export function productivityDates(now: Date, weekStartsOn?: number): Date[] {
  const today = startOfDay(now);
  const first = addDays(startOfWeek(today, weekStartsOn), -11 * 7);
  const dates: Date[] = [];
  for (let d = first; d.getTime() <= today.getTime(); d = addDays(d, 1)) dates.push(d);
  return dates;
}

export interface ProductivityReport {
  totalOpen: number;
  totalDone: number;
  journalChars: number;
  /** Days of the last 30 with a note. */
  activeDays: number;
  /** Days back from today, today included, with a note and a done task or journal text. */
  streak: number;
  /** Done over all tasks in the last 30 days, as a whole percent. */
  completion: number;
  stats: StatCard[];
  /** Tasks done per day for the last 14 days, oldest first. */
  days: ReportBar[];
  /** Tasks done per week for the 12 weeks up to today, oldest first. */
  weeks: ReportBar[];
  /** The last 30 days by weekday, from `weekStartsOn`. */
  weekdays: MiniStat[];
}

/* The report over the daily notes, given each existing note's content by
   its `ymd` date. Every count reads a task line's own leading box
   (`countTaskLines`). */
export function productivityReport(notes: Map<string, string>, now: Date, settings: ProductivitySettings): ProductivityReport {
  const today = startOfDay(now);
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, -i));
  let totalOpen = 0, totalDone = 0, totalJournalChars = 0;
  let activeDays = 0;
  let streak = 0, streakBroken = false;
  const perDay: Array<{ date: Date; open: number; done: number; jChars: number; hasNote: boolean }> = [];
  for (const d of days) {
    const c = notes.get(ymd(d));
    let open = 0, done = 0, jChars = 0, hasNote = false;
    if (c !== undefined) {
      hasNote = true;
      const p = parseSections(c, settings);
      ({ open, done } = countTaskLines(p.tasks));
      jChars = (p.journal || '').length;
    }
    perDay.push({ date: d, open, done, jChars, hasNote });
    totalOpen += open; totalDone += done; totalJournalChars += jChars;
    if (hasNote) activeDays++;
    if (!streakBroken) {
      if (hasNote && (done > 0 || jChars > 0)) streak++;
      else streakBroken = true;
    }
  }
  const completion = totalOpen + totalDone === 0 ? 0 : Math.round((totalDone / (totalOpen + totalDone)) * 100);

  const last14 = perDay.slice(0, 14).reverse();
  const max = Math.max(1, ...last14.map((p) => p.done));

  const weekStart = startOfWeek(today, settings.weekStartsOn);
  const weeks: Array<{ done: number; open: number; label: string }> = [];
  for (let w = 11; w >= 0; w--) {
    const ws = addDays(weekStart, -w * 7);
    let wd = 0, wo = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      if (d.getTime() > today.getTime()) break;
      const c = notes.get(ymd(d));
      if (c !== undefined) {
        const counts = countTaskLines(parseSections(c, settings).tasks);
        wd += counts.done;
        wo += counts.open;
      }
    }
    weeks.push({ done: wd, open: wo, label: ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });
  }
  const maxWeek = Math.max(1, ...weeks.map((w) => w.done));

  const wsOn = settings.weekStartsOn!;
  const dayBuckets = Array.from({ length: 7 }, () => ({ done: 0, open: 0 }));
  perDay.forEach((p) => {
    // p.date.getDay() returns 0 (Sun) .. 6 (Sat). Re-index based on weekStartsOn.
    const idx = (p.date.getDay() - wsOn + 7) % 7;
    dayBuckets[idx].done += p.done;
    dayBuckets[idx].open += p.open;
  });
  const dayLabels = wsOn === 1
    ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
    : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return {
    totalOpen, totalDone, journalChars: totalJournalChars, activeDays, streak, completion,
    stats: [
      { label: 'COMPLETION', value: `${completion}%`, sub: `${totalDone}/${totalOpen + totalDone} tasks`, accent: 'emerald' },
      { label: 'STREAK', value: `${streak}d`, sub: 'consecutive active days', accent: 'mint' },
      { label: 'ACTIVE', value: `${activeDays}/30`, sub: 'days with a note', accent: 'sky' },
      { label: 'JOURNAL', value: totalJournalChars.toLocaleString(), sub: 'characters written', accent: 'warn' },
    ],
    days: last14.map((p) => ({
      label: String(p.date.getDate()),
      title: `${p.date.toLocaleDateString()} — ${p.done} done, ${p.open} open`,
      ...reportBar(p.done, max),
    })),
    weeks: weeks.map((w) => ({ label: w.label, title: `Week of ${w.label} — ${w.done} done, ${w.open} open`, ...reportBar(w.done, maxWeek) })),
    weekdays: dayBuckets.map((b, i) => {
      const total = b.done + b.open;
      const pct = total === 0 ? 0 : Math.round((b.done / total) * 100);
      return { label: dayLabels[i], value: total === 0 ? '—' : `${pct}%`, accent: WEEKDAY_ACCENTS[i], sub: total === 0 ? 'no data' : `${b.done}/${total}` };
    }),
  };
}

/* ── DOM: shared by the five surfaces ── */

function drawStats(root: HTMLElement, cards: StatCard[]): void {
  const grid = root.createDiv({ cls: 'cad-stat-grid' });
  const stat = (label: string, value: string | number, sub: string, accent: string) => {
    const c = grid.createDiv({ cls: 'cad-stat-card' });
    if (accent) c.dataset.accent = accent;
    c.createDiv({ cls: 'cad-stat-label', text: label });
    c.createDiv({ cls: 'cad-stat-value', text: String(value) });
    if (sub) c.createDiv({ cls: 'cad-stat-sub', text: sub });
  };
  cards.forEach((card) => stat(card.label, card.value, card.sub, card.accent));
}

function drawBars(chart: HTMLElement, bars: ReportBar[]): void {
  bars.forEach((b) => {
    const col = chart.createDiv({ cls: 'cad-bar-col' });
    const bar = col.createDiv({ cls: 'cad-bar' });
    bar.style.height = b.height;
    bar.dataset.band = b.band;
    bar.title = b.title;
    col.createDiv({ cls: 'cad-bar-label', text: b.label });
  });
}

function drawMiniStats(body: HTMLElement, minis: MiniStat[]): void {
  minis.forEach((m) => {
    const mini = body.createDiv({ cls: 'cad-mini-stat' });
    mini.dataset.accent = m.accent;
    mini.createDiv({ cls: 'cad-mini-stat-value', text: m.value });
    mini.createDiv({ cls: 'cad-mini-stat-label', text: m.label });
    if (m.sub !== undefined) {
      const sub = mini.createDiv({ cls: 'cad-stat-sub' });
      sub.style.marginTop = '4px';
      sub.setText(m.sub);
    }
  });
}

function twoColumns(root: HTMLElement): { left: HTMLElement; right: HTMLElement } {
  const cols = root.createDiv({ cls: 'cad-dash-cols' });
  return { left: cols.createDiv({ cls: 'cad-dash-col' }), right: cols.createDiv({ cls: 'cad-dash-col' }) };
}

/* ── Surfaces ── */

export async function renderReportPipeline(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-report');
  const def = ENTITIES.deal;
  const report = pipelineReport(listEntities(view.app, 'deal'), def, getDealStages(), Date.now());

  view._renderPageHeader(root, 'Pipeline report', 'Coverage, forecast and aging across all deals');
  drawStats(root, report.stats);

  /* By stage table (existing, kept) */
  root.createDiv({ cls: 'cad-section-label-lg', text: 'BY STAGE' });
  const tableWrap = root.createDiv({ cls: 'cad-table-wrap' });
  const table = tableWrap.createEl('table', { cls: 'cad-table' });
  const trh = table.createEl('thead').createEl('tr');
  ['Stage', 'Count', 'Value'].forEach((h) => trh.createEl('th', { text: h }));
  const tbody = table.createEl('tbody');
  report.byStage.forEach(({ stage, count, value }) => {
    const tr = tbody.createEl('tr');
    tr.createEl('td', { text: stage });
    tr.createEl('td', { text: String(count) });
    tr.createEl('td', { text: fmtValue(value, 'currency') });
  });

  /* Two-col body: by owner + aging cohorts */
  const { left, right } = twoColumns(root);
  view._dashCardSection(left, `OPEN PIPELINE BY OWNER · top ${report.owners.length}`, report.owners, 'No open deals to attribute.');

  const agingCard = right.createDiv({ cls: 'cad-dash-card' });
  agingCard.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: 'AGING · OPEN DEALS BY LAST EDIT' });
  drawMiniStats(agingCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' }), report.cohorts);

  view._dashCardSection(right, 'STALE · 30+ DAYS NO EDITS', report.stale, 'No deals over 30 days quiet — nice.');
}

export async function renderReportSales(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-report');
  const report = salesReport(listEntities(view.app, 'deal'), ENTITIES.deal, new Date());

  view._renderPageHeader(root, 'Sales report', 'Closed-won and lost · performance over time');
  drawStats(root, report.stats);

  /* Revenue by month (last 6 months, by close date) */
  root.createDiv({ cls: 'cad-section-label-lg', text: 'REVENUE — LAST 6 MONTHS' });
  drawBars(root.createDiv({ cls: 'cad-bar-chart cad-bar-chart-tall' }), report.bars);

  /* Two-col: top wins + top owners */
  const { left, right } = twoColumns(root);
  view._dashCardSection(left, 'TOP WINS · top 6', report.topWins, 'No wins logged yet — close one and tag it Won.');
  view._dashCardSection(right, 'OWNER LEADERBOARD · top 6 by revenue', report.owners, 'No revenue attributed to owners yet.');
}

export async function renderReportPartners(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-report');
  const report = partnersReport(
    listEntities(view.app, 'deal'), listEntities(view.app, 'partner'), listEntities(view.app, 'certification'), Date.now(),
  );

  view._renderPageHeader(root, 'Partners report', 'Partner-sourced revenue, tier mix, certification health');
  drawStats(root, report.stats);

  /* Tier breakdown */
  if (report.tiers.length) {
    root.createDiv({ cls: 'cad-section-label-lg', text: 'PARTNERS BY TIER' });
    const tierCard = root.createDiv({ cls: 'cad-dash-card' });
    tierCard.style.margin = '0 36px 18px 36px';
    drawMiniStats(tierCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' }), report.tiers);
  }

  /* Two-col: deals-by-partner table + cert expiries */
  const { left, right } = twoColumns(root);

  // Deals by partner — keep table style
  const dealsByPartnerCard = left.createDiv({ cls: 'cad-dash-card' });
  dealsByPartnerCard.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: 'DEALS BY PARTNER' });
  const dbpBody = dealsByPartnerCard.createDiv({ cls: 'cad-dash-card-body' });
  if (!report.sources.length) {
    dbpBody.createDiv({ cls: 'cad-empty', text: 'No deals attributed to partners yet.' });
  } else {
    report.sources.forEach(({ partner: p, meta }) => {
      const row = dbpBody.createDiv({ cls: 'cad-dash-row' });
      const titleDiv = row.createDiv({ cls: 'cad-dash-row-title' });
      if (p && p !== '(direct)') {
        view._renderEntityLinks(titleDiv, p, 'partner');
      } else {
        titleDiv.setText((p as string) || '');
      }
      row.createDiv({ cls: 'cad-dash-row-meta', text: meta });
    });
  }

  view._dashCardSection(right, 'CERTS EXPIRING · NEXT 90 DAYS', report.certs, 'No certifications expiring in the next 90 days.');
}

export async function renderReportActivity(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-report');
  const report = activityReport(listEntities(view.app, 'activity'), ENTITIES.activity, new Date(), view.plugin.settings.weekStartsOn);

  view._renderPageHeader(root, 'Activity report', 'Calls, meetings, emails and notes — mix and momentum');
  drawStats(root, report.stats);

  /* Activity by week (last 8 weeks) */
  root.createDiv({ cls: 'cad-section-label-lg', text: 'ACTIVITY — LAST 8 WEEKS' });
  drawBars(root.createDiv({ cls: 'cad-bar-chart cad-bar-chart-tall' }), report.bars);

  /* Two-col: top contacts + recent activity */
  const { left, right } = twoColumns(root);
  view._dashCardSection(left, 'TOP CONTACTS · by activity count', report.topContacts, 'No activities tagged with a contact yet.');
  view._dashCardSection(right, 'RECENT ACTIVITY · last 10', report.recent, 'No activities yet — log one under CRM > Activities.');
}

export async function renderProductivity(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-report');
  const settings = view.plugin.settings;
  const now = new Date();

  // Read every daily note the report covers, once
  const notes = new Map<string, string>();
  for (const d of productivityDates(now, settings.weekStartsOn)) {
    const f = view.app.vault.getAbstractFileByPath(dailyNotePath(settings, d));
    if (f && f instanceof TFile) notes.set(ymd(d), await view.app.vault.read(f));
  }
  const report = productivityReport(notes, now, settings);

  view._renderPageHeader(root, 'Productivity', 'Last 30 days · across your daily notes');
  drawStats(root, report.stats);

  // Bar chart of completed tasks per day (last 14 days, oldest left)
  root.createDiv({ cls: 'cad-section-label-lg', text: 'TASKS DONE — LAST 14 DAYS' });
  drawBars(root.createDiv({ cls: 'cad-bar-chart' }), report.days);

  /* 12-week completion trend */
  root.createDiv({ cls: 'cad-section-label-lg', text: 'COMPLETION TREND — LAST 12 WEEKS' });
  drawBars(root.createDiv({ cls: 'cad-bar-chart cad-bar-chart-tall' }), report.weeks);

  /* Completion by weekday (Mon-Sun aggregated over the 30 days) */
  root.createDiv({ cls: 'cad-section-label-lg', text: 'COMPLETION BY WEEKDAY · LAST 30 DAYS' });
  const dayCard = root.createDiv({ cls: 'cad-dash-card' });
  dayCard.style.margin = '0 36px 24px 36px';
  drawMiniStats(dayCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' }), report.weekdays);
}
