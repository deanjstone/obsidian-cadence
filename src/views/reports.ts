import { TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { addDays, dailyNotePath, startOfDay, startOfWeek } from '../utils/dates';
import { entityValue, getDealStages, listEntities } from '../utils/entities';
import { fmtValue } from '../utils/format';
import { parseSections } from '../utils/parsing';
import type { Entity } from '../types/entities';
import type { AppViewHost } from './host';

/* The five tabular reports (reports.pipeline, reports.sales,
   reports.partners, reports.activity and reports.productivity): stat cards,
   bar charts and dashboard cards over the deals, partners, certifications,
   activities and daily notes. */

export async function renderReportPipeline(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-report');
  const def = ENTITIES.deal;
  const deals = listEntities(view.app, 'deal');
  const open = deals.filter((e) => !['Won', 'Lost'].includes(String(entityValue(e, 'stage', def))));
  const won = deals.filter((e) => String(entityValue(e, 'stage', def)) === 'Won');
  const lost = deals.filter((e) => String(entityValue(e, 'stage', def)) === 'Lost');
  const dealValue = (e: Entity) => Number(entityValue(e, 'value', def)) || 0;
  const sumVal = (arr: Entity[]) => arr.reduce((s, e) => s + dealValue(e), 0);
  const winRate = won.length + lost.length === 0 ? 0 : Math.round((won.length / (won.length + lost.length)) * 100);

  // Weighted forecast — confidence per stage applied to open deal value.
  const stageConfidence: Record<string, number> = { 'Lead': 0.10, 'Qualified': 0.25, 'Proposal': 0.50, 'Negotiation': 0.75 };
  const weighted = open.reduce((s, e) => s + dealValue(e) * (stageConfidence[String(entityValue(e, 'stage', def))] || 0), 0);

  view._renderPageHeader(root, 'Pipeline report', 'Coverage, forecast and aging across all deals');

  const grid = root.createDiv({ cls: 'cad-stat-grid' });
  const stat = (label: string, value: string | number, sub: string, accent: string) => {
    const c = grid.createDiv({ cls: 'cad-stat-card' });
    if (accent) c.dataset.accent = accent;
    c.createDiv({ cls: 'cad-stat-label', text: label });
    c.createDiv({ cls: 'cad-stat-value', text: String(value) });
    if (sub) c.createDiv({ cls: 'cad-stat-sub', text: sub });
  };
  stat('OPEN', open.length, fmtValue(sumVal(open), 'currency'), 'sky');
  stat('WEIGHTED', fmtValue(weighted, 'currency'), 'forecast on open', 'mint');
  stat('WON', won.length, fmtValue(sumVal(won), 'currency'), 'emerald');
  stat('LOST', lost.length, fmtValue(sumVal(lost), 'currency'), 'rose');
  stat('WIN RATE', `${winRate}%`, `${won.length}/${won.length + lost.length} closed`, 'warn');

  /* By stage table (existing, kept) */
  root.createDiv({ cls: 'cad-section-label-lg', text: 'BY STAGE' });
  const tableWrap = root.createDiv({ cls: 'cad-table-wrap' });
  const table = tableWrap.createEl('table', { cls: 'cad-table' });
  const trh = table.createEl('thead').createEl('tr');
  ['Stage', 'Count', 'Value'].forEach((h) => trh.createEl('th', { text: h }));
  const tbody = table.createEl('tbody');
  getDealStages().forEach((stage) => {
    const items = deals.filter((e) => String(entityValue(e, 'stage', def)) === stage);
    const tr = tbody.createEl('tr');
    tr.createEl('td', { text: stage });
    tr.createEl('td', { text: String(items.length) });
    tr.createEl('td', { text: fmtValue(sumVal(items), 'currency') });
  });

  /* Two-col body: by owner + aging cohorts */
  const cols = root.createDiv({ cls: 'cad-dash-cols' });
  const left = cols.createDiv({ cls: 'cad-dash-col' });
  const right = cols.createDiv({ cls: 'cad-dash-col' });

  // Pipeline by owner
  const byOwner = new Map<string, { count: number; value: number }>();
  open.forEach((e) => {
    const owner = String(entityValue(e, 'owner', def) || '(unassigned)');
    if (!byOwner.has(owner)) byOwner.set(owner, { count: 0, value: 0 });
    const o = byOwner.get(owner)!;
    o.count++; o.value += dealValue(e);
  });
  const ownerRows = [...byOwner.entries()]
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 8)
    .map(([owner, data]) => ({
      title: owner,
      titleEntityKey: owner === '(unassigned)' ? null : 'contact',
      meta: `${data.count} deal${data.count === 1 ? '' : 's'} · ${fmtValue(data.value, 'currency')}`,
    }));
  view._dashCardSection(left, `OPEN PIPELINE BY OWNER · top ${Math.min(8, byOwner.size)}`, ownerRows, 'No open deals to attribute.');

  // Aging cohorts (file mtime)
  const now = Date.now();
  const cohorts = [
    { label: '0–7 DAYS', cutoff: 7, count: 0, value: 0, accent: 'emerald' },
    { label: '8–30 DAYS', cutoff: 30, count: 0, value: 0, accent: 'mint' },
    { label: '31–90 DAYS', cutoff: 90, count: 0, value: 0, accent: 'warn' },
    { label: '90+ DAYS', cutoff: Infinity, count: 0, value: 0, accent: 'rose' },
  ];
  open.forEach((e) => {
    const mtime = e.file && e.file.stat ? e.file.stat.mtime : now;
    const days = (now - mtime) / 86400000;
    for (const c of cohorts) {
      if (days <= c.cutoff) { c.count++; c.value += dealValue(e); break; }
    }
  });
  const agingCard = right.createDiv({ cls: 'cad-dash-card' });
  agingCard.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: 'AGING · OPEN DEALS BY LAST EDIT' });
  const agingBody = agingCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' });
  cohorts.forEach((c) => {
    const mini = agingBody.createDiv({ cls: 'cad-mini-stat' });
    mini.dataset.accent = c.accent;
    mini.createDiv({ cls: 'cad-mini-stat-value', text: String(c.count) });
    mini.createDiv({ cls: 'cad-mini-stat-label', text: c.label });
    const sub = mini.createDiv({ cls: 'cad-stat-sub' });
    sub.style.marginTop = '4px';
    sub.setText(fmtValue(c.value, 'currency'));
  });

  // Stale top-5 list under aging
  const staleCutoff = now - 30 * 86400000;
  const stale = open
    .filter((e) => e.file && e.file.stat && e.file.stat.mtime < staleCutoff)
    .sort((a, b) => (a.file.stat!.mtime || 0) - (b.file.stat!.mtime || 0))
    .slice(0, 5)
    .map((e) => ({
      title: (entityValue(e, 'title', def) as string) || e.basename,
      meta: `${entityValue(e, 'stage', def) || '—'} · ${Math.round((now - e.file.stat!.mtime) / 86400000)}d quiet · ${fmtValue(dealValue(e), 'currency')}`,
      file: e.file,
    }));
  view._dashCardSection(right, 'STALE · 30+ DAYS NO EDITS', stale, 'No deals over 30 days quiet — nice.');
}

export async function renderReportSales(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-report');
  const def = ENTITIES.deal;
  const deals = listEntities(view.app, 'deal');
  const won = deals.filter((e) => String(entityValue(e, 'stage', def)) === 'Won');
  const lost = deals.filter((e) => String(entityValue(e, 'stage', def)) === 'Lost');
  const dealValue = (e: Entity) => Number(entityValue(e, 'value', def)) || 0;
  const sumVal = (arr: Entity[]) => arr.reduce((s, e) => s + dealValue(e), 0);

  view._renderPageHeader(root, 'Sales report', 'Closed-won and lost · performance over time');

  const grid = root.createDiv({ cls: 'cad-stat-grid' });
  const stat = (label: string, value: string | number, sub: string, accent: string) => {
    const c = grid.createDiv({ cls: 'cad-stat-card' });
    if (accent) c.dataset.accent = accent;
    c.createDiv({ cls: 'cad-stat-label', text: label });
    c.createDiv({ cls: 'cad-stat-value', text: String(value) });
    if (sub) c.createDiv({ cls: 'cad-stat-sub', text: sub });
  };
  stat('REVENUE', fmtValue(sumVal(won), 'currency'), `${won.length} deals`, 'emerald');
  stat('LOST', fmtValue(sumVal(lost), 'currency'), `${lost.length} deals`, 'rose');
  const total = sumVal(won) + sumVal(lost);
  const captureRate = total === 0 ? 0 : Math.round((sumVal(won) / total) * 100);
  stat('CAPTURE', `${captureRate}%`, 'of closed value', 'mint');
  const avg = won.length === 0 ? 0 : sumVal(won) / won.length;
  stat('AVG DEAL', fmtValue(avg, 'currency'), 'won deals', 'sky');

  /* Revenue by month (last 6 months, by file mtime as close proxy) */
  const now = new Date();
  const months: Array<{ date: Date; label: string; revenue: number; count: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      date: d,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      revenue: 0,
      count: 0,
    });
  }
  won.forEach((e) => {
    const t = e.file && e.file.stat ? e.file.stat.mtime : null;
    if (!t) return;
    const d = new Date(t);
    const idx = months.findIndex((m) => m.date.getFullYear() === d.getFullYear() && m.date.getMonth() === d.getMonth());
    if (idx >= 0) { months[idx].revenue += dealValue(e); months[idx].count++; }
  });
  const maxRev = Math.max(1, ...months.map((m) => m.revenue));
  root.createDiv({ cls: 'cad-section-label-lg', text: 'REVENUE — LAST 6 MONTHS' });
  const chart = root.createDiv({ cls: 'cad-bar-chart cad-bar-chart-tall' });
  months.forEach((m) => {
    const col = chart.createDiv({ cls: 'cad-bar-col' });
    const bar = col.createDiv({ cls: 'cad-bar' });
    bar.style.height = `${(m.revenue / maxRev) * 100}%`;
    const ratio = m.revenue / maxRev;
    bar.dataset.band = m.revenue === 0 ? 'empty' : ratio < 0.34 ? 'low' : ratio < 0.67 ? 'mid' : 'high';
    bar.title = `${m.label} — ${fmtValue(m.revenue, 'currency')} · ${m.count} deals`;
    col.createDiv({ cls: 'cad-bar-label', text: m.label });
  });

  /* Two-col: top wins + top owners */
  const cols = root.createDiv({ cls: 'cad-dash-cols' });
  const left = cols.createDiv({ cls: 'cad-dash-col' });
  const right = cols.createDiv({ cls: 'cad-dash-col' });

  const topWins = [...won]
    .sort((a, b) => dealValue(b) - dealValue(a))
    .slice(0, 6)
    .map((e) => {
      const companyVal = (entityValue(e, 'company', def) as string) || '—';
      const valStr = fmtValue(dealValue(e), 'currency');
      return {
        title: (entityValue(e, 'title', def) as string) || e.basename,
        metaParts: [
          { text: companyVal, entityKey: 'company' },
          { text: ` · ${valStr}` }
        ],
        file: e.file,
      };
    });
  view._dashCardSection(left, 'TOP WINS · top 6', topWins, 'No wins logged yet — close one and tag it Won.');

  // Top owners by revenue
  const byOwner = new Map<string, { count: number; revenue: number }>();
  won.forEach((e) => {
    const owner = String(entityValue(e, 'owner', def) || '(unassigned)');
    if (!byOwner.has(owner)) byOwner.set(owner, { count: 0, revenue: 0 });
    const o = byOwner.get(owner)!;
    o.count++; o.revenue += dealValue(e);
  });
  const ownerRows = [...byOwner.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 6)
    .map(([owner, data]) => ({
      title: owner,
      titleEntityKey: owner === '(unassigned)' ? null : 'contact',
      meta: `${data.count} won · ${fmtValue(data.revenue, 'currency')}`,
    }));
  view._dashCardSection(right, 'OWNER LEADERBOARD · top 6 by revenue', ownerRows, 'No revenue attributed to owners yet.');
}

export async function renderReportPartners(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-report');
  const dealDef = ENTITIES.deal;
  const partnerDef = ENTITIES.partner;
  const certDef = ENTITIES.certification;
  const deals = listEntities(view.app, 'deal');
  const partners = listEntities(view.app, 'partner');
  const certs = listEntities(view.app, 'certification');
  const dealValue = (e: Entity) => Number(entityValue(e, 'value', dealDef)) || 0;

  view._renderPageHeader(root, 'Partners report', 'Partner-sourced revenue, tier mix, certification health');

  // Group deals by 'partner' frontmatter
  // TODO: confirm shape — `partner` is read raw, so a list is its own key.
  const byPartner = new Map<unknown, Entity[]>();
  deals.forEach((e) => {
    const p = entityValue(e, 'partner', dealDef) || '(direct)';
    if (!byPartner.has(p)) byPartner.set(p, []);
    byPartner.get(p)!.push(e);
  });
  const partnerSourced = deals.filter((e) => entityValue(e, 'partner', dealDef));
  const partnerWon = partnerSourced.filter((e) => String(entityValue(e, 'stage', dealDef)) === 'Won');

  const grid = root.createDiv({ cls: 'cad-stat-grid' });
  const stat = (label: string, value: string | number, sub: string, accent: string) => {
    const c = grid.createDiv({ cls: 'cad-stat-card' });
    if (accent) c.dataset.accent = accent;
    c.createDiv({ cls: 'cad-stat-label', text: label });
    c.createDiv({ cls: 'cad-stat-value', text: String(value) });
    if (sub) c.createDiv({ cls: 'cad-stat-sub', text: sub });
  };
  stat('PARTNERS', partners.length, 'on the books', 'sky');
  stat('PARTNER DEALS', partnerSourced.length, fmtValue(partnerSourced.reduce((s, e) => s + dealValue(e), 0), 'currency'), 'mint');
  stat('PARTNER REV', fmtValue(partnerWon.reduce((s, e) => s + dealValue(e), 0), 'currency'), `${partnerWon.length} won`, 'emerald');
  stat('UNIQUE SOURCES', byPartner.size, 'including direct', 'warn');

  /* Tier breakdown */
  const tierMap = new Map<string, number>();
  partners.forEach((p) => {
    const t = String(entityValue(p, 'tier', partnerDef) || 'Untiered');
    if (!tierMap.has(t)) tierMap.set(t, 0);
    tierMap.set(t, tierMap.get(t)! + 1);
  });
  if (tierMap.size) {
    root.createDiv({ cls: 'cad-section-label-lg', text: 'PARTNERS BY TIER' });
    const tierCard = root.createDiv({ cls: 'cad-dash-card' });
    tierCard.style.margin = '0 36px 18px 36px';
    const tierBody = tierCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' });
    const tierAccent: Record<string, string> = { 'Gold': 'warn', 'Silver': 'sky', 'Bronze': 'rose', 'Standard': 'mint' };
    [...tierMap.entries()].sort((a, b) => b[1] - a[1]).forEach(([tier, count]) => {
      const mini = tierBody.createDiv({ cls: 'cad-mini-stat' });
      mini.dataset.accent = tierAccent[tier] || 'sky';
      mini.createDiv({ cls: 'cad-mini-stat-value', text: String(count) });
      mini.createDiv({ cls: 'cad-mini-stat-label', text: tier.toUpperCase() });
    });
  }

  /* Two-col: deals-by-partner table + cert expiries */
  const cols = root.createDiv({ cls: 'cad-dash-cols' });
  const left = cols.createDiv({ cls: 'cad-dash-col' });
  const right = cols.createDiv({ cls: 'cad-dash-col' });

  // Deals by partner — keep table style
  const dealsByPartnerCard = left.createDiv({ cls: 'cad-dash-card' });
  dealsByPartnerCard.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: 'DEALS BY PARTNER' });
  const dbpBody = dealsByPartnerCard.createDiv({ cls: 'cad-dash-card-body' });
  if (!byPartner.size) {
    dbpBody.createDiv({ cls: 'cad-empty', text: 'No deals attributed to partners yet.' });
  } else {
    [...byPartner.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .forEach(([p, items]) => {
        const v = items.reduce((s, e) => s + dealValue(e), 0);
        const row = dbpBody.createDiv({ cls: 'cad-dash-row' });
        const titleDiv = row.createDiv({ cls: 'cad-dash-row-title' });
        if (p && p !== '(direct)') {
          view._renderEntityLinks(titleDiv, p, 'partner');
        } else {
          titleDiv.setText((p as string) || '');
        }
        row.createDiv({ cls: 'cad-dash-row-meta', text: `${items.length} deal${items.length === 1 ? '' : 's'} · ${fmtValue(v, 'currency')}` });
      });
  }

  // Cert expiries upcoming (next 90 days)
  const now = Date.now();
  const horizon = now + 90 * 86400000;
  const upcomingCerts = certs
    .map((e) => {
      const exp = entityValue(e, 'expires', certDef);
      if (!exp) return null;
      const d = new Date(exp as string);
      if (isNaN(d.getTime())) return null;
      return { entity: e, date: d };
    })
    .filter((x): x is { entity: Entity; date: Date } => (x && x.date.getTime() >= now && x.date.getTime() <= horizon) as boolean)
    .sort((a, b) => (a.date as unknown as number) - (b.date as unknown as number))
    .slice(0, 8)
    .map((x) => {
      const partnerVal = (entityValue(x.entity, 'partner', certDef) as string) || '—';
      const expVal = ` · expires ${fmtValue(x.date, 'date')}`;
      return {
        title: (entityValue(x.entity, 'name', certDef) as string) || x.entity.basename,
        metaParts: [
          { text: partnerVal, entityKey: 'partner' },
          { text: expVal }
        ],
        file: x.entity.file,
      };
    });
  view._dashCardSection(right, 'CERTS EXPIRING · NEXT 90 DAYS', upcomingCerts, 'No certifications expiring in the next 90 days.');
}

export async function renderReportActivity(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-report');
  const def = ENTITIES.activity;
  const acts = listEntities(view.app, 'activity');

  view._renderPageHeader(root, 'Activity report', 'Calls, meetings, emails and notes — mix and momentum');

  const counts = new Map<string, number>();
  acts.forEach((e) => {
    const t = String(entityValue(e, 'type', def) || 'unspecified');
    counts.set(t, (counts.get(t) || 0) + 1);
  });

  const grid = root.createDiv({ cls: 'cad-stat-grid' });
  const stat = (label: string, value: string | number, sub: string, accent: string) => {
    const c = grid.createDiv({ cls: 'cad-stat-card' });
    if (accent) c.dataset.accent = accent;
    c.createDiv({ cls: 'cad-stat-label', text: label });
    c.createDiv({ cls: 'cad-stat-value', text: String(value) });
    if (sub) c.createDiv({ cls: 'cad-stat-sub', text: sub });
  };
  stat('TOTAL', acts.length, 'all activities', 'emerald');
  const accents = ['sky', 'mint', 'warn', 'rose'];
  let i = 0;
  counts.forEach((v, k) => stat(k.toUpperCase(), v, '', accents[i++ % accents.length]));

  /* Activity by week (last 8 weeks) */
  const now = new Date();
  const weekStart = startOfWeek(now, view.plugin.settings.weekStartsOn);
  const weeks: Array<{ start: Date; end: Date; count: number; label: string }> = [];
  for (let w = 7; w >= 0; w--) {
    const ws = addDays(weekStart, -w * 7);
    const we = addDays(ws, 7);
    weeks.push({ start: ws, end: we, count: 0, label: ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });
  }
  acts.forEach((e) => {
    const when = entityValue(e, 'when', def);
    if (!when) return;
    const t = new Date(when as string).getTime();
    if (isNaN(t)) return;
    const idx = weeks.findIndex((w) => t >= w.start.getTime() && t < w.end.getTime());
    if (idx >= 0) weeks[idx].count++;
  });
  const maxWeek = Math.max(1, ...weeks.map((w) => w.count));
  root.createDiv({ cls: 'cad-section-label-lg', text: 'ACTIVITY — LAST 8 WEEKS' });
  const chart = root.createDiv({ cls: 'cad-bar-chart cad-bar-chart-tall' });
  weeks.forEach((w) => {
    const col = chart.createDiv({ cls: 'cad-bar-col' });
    const bar = col.createDiv({ cls: 'cad-bar' });
    bar.style.height = `${(w.count / maxWeek) * 100}%`;
    const ratio = w.count / maxWeek;
    bar.dataset.band = w.count === 0 ? 'empty' : ratio < 0.34 ? 'low' : ratio < 0.67 ? 'mid' : 'high';
    bar.title = `Week of ${w.label} — ${w.count} activities`;
    col.createDiv({ cls: 'cad-bar-label', text: w.label });
  });

  /* Two-col: top contacts + recent activity */
  const cols = root.createDiv({ cls: 'cad-dash-cols' });
  const left = cols.createDiv({ cls: 'cad-dash-col' });
  const right = cols.createDiv({ cls: 'cad-dash-col' });

  // Top contacts by activity count
  const contactCounts = new Map<string, number>();
  acts.forEach((e) => {
    const w = String(entityValue(e, 'with', def) || '').trim();
    if (!w) return;
    contactCounts.set(w, (contactCounts.get(w) || 0) + 1);
  });
  const topContactRows = [...contactCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([who, count]) => ({
      title: who,
      titleEntityKey: 'contact',
      meta: `${count} activit${count === 1 ? 'y' : 'ies'}`,
    }));
  view._dashCardSection(left, 'TOP CONTACTS · by activity count', topContactRows, 'No activities tagged with a contact yet.');

  // Recent activity (last 10)
  const recent = [...acts]
    .sort((a, b) => {
      const da = new Date((entityValue(a, 'when', def) as string) || 0).getTime();
      const db = new Date((entityValue(b, 'when', def) as string) || 0).getTime();
      return db - da;
    })
    .slice(0, 10)
    .map((e) => {
      const typeVal = (entityValue(e, 'type', def) as string) || '—';
      const withVal = (entityValue(e, 'with', def) as string) || '—';
      const dateVal = fmtValue(entityValue(e, 'when', def), 'date');
      return {
        title: (entityValue(e, 'subject', def) as string) || e.basename,
        metaParts: [
          { text: typeVal },
          { text: ' · ' },
          { text: withVal, entityKey: 'contact' },
          { text: ` · ${dateVal}` }
        ],
        file: e.file,
      };
    });
  view._dashCardSection(right, 'RECENT ACTIVITY · last 10', recent, 'No activities yet — log one under CRM > Activities.');
}

export async function renderProductivity(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-report');
  const settings = view.plugin.settings;

  // Walk last 30 days
  const today = startOfDay(new Date());
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, -i));
  let totalOpen = 0, totalDone = 0, totalJournalChars = 0;
  let activeDays = 0;
  let streak = 0, streakBroken = false;
  const perDay: Array<{ date: Date; open: number; done: number; jChars: number; hasNote: boolean }> = [];
  for (const d of days) {
    const f = view.app.vault.getAbstractFileByPath(dailyNotePath(settings, d));
    let open = 0, done = 0, jChars = 0, hasNote = false;
    if (f && f instanceof TFile) {
      hasNote = true;
      const c = await view.app.vault.read(f);
      const p = parseSections(c, settings);
      open = p.tasks.filter((l) => / \[ \] /.test(l)).length;
      done = p.tasks.filter((l) => / \[(x|X)\] /.test(l)).length;
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

  view._renderPageHeader(root, 'Productivity', 'Last 30 days · across your daily notes');

  const grid = root.createDiv({ cls: 'cad-stat-grid' });
  const stat = (label: string, value: string | number, sub: string, accent: string) => {
    const c = grid.createDiv({ cls: 'cad-stat-card' });
    if (accent) c.dataset.accent = accent;
    c.createDiv({ cls: 'cad-stat-label', text: label });
    c.createDiv({ cls: 'cad-stat-value', text: String(value) });
    if (sub) c.createDiv({ cls: 'cad-stat-sub', text: sub });
  };
  stat('COMPLETION', `${completion}%`, `${totalDone}/${totalOpen + totalDone} tasks`, 'emerald');
  stat('STREAK', `${streak}d`, 'consecutive active days', 'mint');
  stat('ACTIVE', `${activeDays}/30`, 'days with a note', 'sky');
  stat('JOURNAL', totalJournalChars.toLocaleString(), 'characters written', 'warn');

  // Bar chart of completed tasks per day (last 14 days, oldest left)
  root.createDiv({ cls: 'cad-section-label-lg', text: 'TASKS DONE — LAST 14 DAYS' });
  const last14 = perDay.slice(0, 14).reverse();
  const max = Math.max(1, ...last14.map((p) => p.done));
  const chart = root.createDiv({ cls: 'cad-bar-chart' });
  last14.forEach((p) => {
    const col = chart.createDiv({ cls: 'cad-bar-col' });
    const bar = col.createDiv({ cls: 'cad-bar' });
    bar.style.height = `${(p.done / max) * 100}%`;
    const ratio = p.done / max;
    bar.dataset.band = p.done === 0 ? 'empty' : ratio < 0.34 ? 'low' : ratio < 0.67 ? 'mid' : 'high';
    const lbl = col.createDiv({ cls: 'cad-bar-label', text: String(p.date.getDate()) });
    bar.title = `${p.date.toLocaleDateString()} — ${p.done} done, ${p.open} open`;
    void lbl;
  });

  /* 12-week completion trend */
  const weekStart = startOfWeek(today, view.plugin.settings.weekStartsOn);
  const weeks: Array<{ start: Date; done: number; open: number; any: boolean; label: string }> = [];
  for (let w = 11; w >= 0; w--) {
    const ws = addDays(weekStart, -w * 7);
    const we = addDays(ws, 7);
    let wd = 0, wo = 0, anyNote = false;
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      if (d.getTime() > today.getTime()) break;
      const f = view.app.vault.getAbstractFileByPath(dailyNotePath(settings, d));
      if (f && f instanceof TFile) {
        anyNote = true;
        const c = await view.app.vault.read(f);
        const p = parseSections(c, settings);
        p.tasks.forEach((l) => { if (/ \[(x|X)\] /.test(l)) wd++; else if (/ \[ \] /.test(l)) wo++; });
      }
    }
    weeks.push({ start: ws, done: wd, open: wo, any: anyNote, label: ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });
  }
  const maxWeek = Math.max(1, ...weeks.map((w) => w.done));
  root.createDiv({ cls: 'cad-section-label-lg', text: 'COMPLETION TREND — LAST 12 WEEKS' });
  const wkChart = root.createDiv({ cls: 'cad-bar-chart cad-bar-chart-tall' });
  weeks.forEach((w) => {
    const col = wkChart.createDiv({ cls: 'cad-bar-col' });
    const bar = col.createDiv({ cls: 'cad-bar' });
    bar.style.height = `${(w.done / maxWeek) * 100}%`;
    const ratio = w.done / maxWeek;
    bar.dataset.band = w.done === 0 ? 'empty' : ratio < 0.34 ? 'low' : ratio < 0.67 ? 'mid' : 'high';
    bar.title = `Week of ${w.label} — ${w.done} done, ${w.open} open`;
    col.createDiv({ cls: 'cad-bar-label', text: w.label });
  });

  /* Completion by weekday (Mon-Sun aggregated over the 30 days) */
  const wsOn = settings.weekStartsOn;
  const dayBuckets = Array.from({ length: 7 }, () => ({ done: 0, open: 0 }));
  perDay.forEach((p) => {
    // p.date.getDay() returns 0 (Sun) .. 6 (Sat). Re-index based on weekStartsOn.
    const idx = (p.date.getDay() - wsOn! + 7) % 7;
    dayBuckets[idx].done += p.done;
    dayBuckets[idx].open += p.open;
  });
  const dayLabels = wsOn === 1
    ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
    : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  root.createDiv({ cls: 'cad-section-label-lg', text: 'COMPLETION BY WEEKDAY · LAST 30 DAYS' });
  const dayCard = root.createDiv({ cls: 'cad-dash-card' });
  dayCard.style.margin = '0 36px 24px 36px';
  const dayBody = dayCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' });
  const dayAccents = ['emerald', 'mint', 'sky', 'warn', 'rose', 'mint', 'sky'];
  dayBuckets.forEach((b, i) => {
    const total = b.done + b.open;
    const pct = total === 0 ? 0 : Math.round((b.done / total) * 100);
    const mini = dayBody.createDiv({ cls: 'cad-mini-stat' });
    mini.dataset.accent = dayAccents[i];
    mini.createDiv({ cls: 'cad-mini-stat-value', text: total === 0 ? '—' : `${pct}%` });
    mini.createDiv({ cls: 'cad-mini-stat-label', text: dayLabels[i] });
    const sub = mini.createDiv({ cls: 'cad-stat-sub' });
    sub.style.marginTop = '4px';
    sub.setText(total === 0 ? 'no data' : `${b.done}/${total}`);
  });
}
