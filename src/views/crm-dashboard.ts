import { ENTITIES } from '../constants/entities';
import { CadenceWidgetCreateModal } from '../modals/widget-create';
import type { Entity, EntityDef } from '../types/entities';
import type { WidgetConfig } from '../types/modals';
import { entityValue, getDealStages, listEntities, listEntityFiles } from '../utils/entities';
import { fmtValue } from '../utils/format';
import type { DashCardRow } from './components/cards';
import { WIDGET_STYLE_OPTIONS, chartData, dashboardWidgets, removeWidget } from './components/charts';
import type { AppViewHost } from './host';

/* The CRM dashboard (crm.dashboard): pipeline stats, the pipeline by stage,
   hot and stale deals, recent activity, the customer base and the custom
   chart widgets. */

/* ── Pure seams: plain data in, plain data out ── */

const DAY_MS = 86400000;

/* A deal's value as a number; blank or non-numeric is 0. */
export function dealValue(entity: Entity, def: EntityDef): number {
  return Number(entityValue(entity, 'value', def)) || 0;
}

function sumValues(deals: Entity[], def: EntityDef): number {
  return deals.reduce((s, e) => s + dealValue(e, def), 0);
}

export interface CrmSummary {
  /** Every deal not exactly 'Won' or 'Lost', blank and custom stages included. */
  open: Entity[];
  won: Entity[];
  lost: Entity[];
  openValue: number;
  wonValue: number;
  lostValue: number;
  /** Won over closed, as a whole percent; 0 with nothing closed. */
  winRate: number;
  /** Mean value of the won deals; 0 with none won. */
  avgDeal: number;
}

/* The pipeline totals. Won and Lost match case-sensitively. */
export function crmSummary(deals: Entity[], def: EntityDef): CrmSummary {
  const open = deals.filter((e) => !['Won', 'Lost'].includes(String(entityValue(e, 'stage', def))));
  const won = deals.filter((e) => String(entityValue(e, 'stage', def)) === 'Won');
  const lost = deals.filter((e) => String(entityValue(e, 'stage', def)) === 'Lost');
  const wonValue = sumValues(won, def);
  return {
    open, won, lost,
    openValue: sumValues(open, def),
    wonValue,
    lostValue: sumValues(lost, def),
    winRate: won.length + lost.length === 0 ? 0 : Math.round((won.length / (won.length + lost.length)) * 100),
    avgDeal: won.length === 0 ? 0 : wonValue / won.length,
  };
}

export interface StatCard {
  label: string;
  value: string | number;
  sub: string;
  accent: string;
}

/* The five stat cards, with currency through fmtValue. */
export function crmStatCards(summary: CrmSummary): StatCard[] {
  const { open, won, lost, winRate, avgDeal } = summary;
  return [
    { label: 'OPEN PIPELINE', value: open.length, sub: fmtValue(summary.openValue, 'currency'), accent: 'sky' },
    { label: 'WON', value: won.length, sub: fmtValue(summary.wonValue, 'currency'), accent: 'emerald' },
    { label: 'LOST', value: lost.length, sub: fmtValue(summary.lostValue, 'currency'), accent: 'rose' },
    { label: 'WIN RATE', value: `${winRate}%`, sub: `${won.length}/${won.length + lost.length} closed`, accent: 'mint' },
    { label: 'AVG DEAL', value: fmtValue(avgDeal, 'currency'), sub: `${won.length} won deals`, accent: 'warn' },
  ];
}

export interface StageBar {
  stage: string;
  count: number;
  value: number;
  /** The bar's CSS width, scaled to the largest stage value (at least 1). */
  width: string;
}

/* One bar per stage, in stage order. A deal whose stage is off the list
   is in no bar. */
export function pipelineByStage(deals: Entity[], def: EntityDef, stages: string[]): StageBar[] {
  const stageData = stages.map((stage) => {
    const items = deals.filter((e) => String(entityValue(e, 'stage', def)) === stage);
    return { stage, count: items.length, value: sumValues(items, def) };
  });
  const maxStageVal = Math.max(1, ...stageData.map((s) => s.value));
  return stageData.map((s) => ({ ...s, width: `${(s.value / maxStageVal) * 100}%` }));
}

function dealTitle(entity: Entity, def: EntityDef): string {
  return (entityValue(entity, 'title', def) as string) || entity.basename;
}

/* The top 5 open deals by value. */
export function hotDeals(open: Entity[], def: EntityDef): DashCardRow[] {
  return [...open]
    .sort((a, b) => dealValue(b, def) - dealValue(a, def))
    .slice(0, 5)
    .map((e) => ({
      title: dealTitle(e, def),
      meta: `${entityValue(e, 'stage', def) || '—'} · ${fmtValue(dealValue(e, def), 'currency')}`,
      file: e.file,
    }));
}

/* Up to 5 open deals whose file was last modified more than 14 days
   before `now`, oldest first. A deal with no file stat is never stale. */
export function staleDeals(open: Entity[], def: EntityDef, now: number): DashCardRow[] {
  const staleCutoff = now - 14 * DAY_MS;
  return open
    .filter((e) => e.file && e.file.stat && e.file.stat.mtime < staleCutoff)
    .sort((a, b) => (a.file.stat!.mtime || 0) - (b.file.stat!.mtime || 0))
    .slice(0, 5)
    .map((e) => {
      const days = Math.round((now - e.file.stat!.mtime) / DAY_MS);
      return {
        title: dealTitle(e, def),
        meta: `${entityValue(e, 'stage', def) || '—'} · ${days}d quiet · ${fmtValue(dealValue(e, def), 'currency')}`,
        file: e.file,
      };
    });
}

/* The 6 latest activities by `when`, newest first; an undated one sorts
   as 1970. The `with` part links to contacts. */
export function recentActivities(activities: Entity[], def: EntityDef): DashCardRow[] {
  return [...activities]
    .sort((a, b) => {
      const da = new Date((entityValue(a, 'when', def) as string) || 0).getTime();
      const db = new Date((entityValue(b, 'when', def) as string) || 0).getTime();
      return db - da;
    })
    .slice(0, 6)
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
}

/* The customer base card: its title and one mini stat per record type,
   each opening its list. */
export function customerBase(counts: { contacts: number; companies: number; partners: number }): {
  title: string; stats: Array<{ label: string; value: number; accent: string; mode: string }>;
} {
  return {
    title: `CUSTOMER BASE · ${counts.contacts + counts.companies + counts.partners} records`,
    stats: [
      { label: 'CONTACTS', value: counts.contacts, accent: 'warn', mode: 'crm.contacts' },
      { label: 'COMPANIES', value: counts.companies, accent: 'sky', mode: 'crm.companies' },
      { label: 'PARTNERS', value: counts.partners, accent: 'rose', mode: 'prm.partners' },
    ],
  };
}

export async function renderCrmDashboard(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-dashboard');

  // ─── Read all the relevant data ────────────────────
  const dealDef = ENTITIES.deal;
  const allDeals = listEntities(view.app, 'deal');
  const summary = crmSummary(allDeals, dealDef);

  const contacts = listEntityFiles(view.app, 'contact');
  const companies = listEntityFiles(view.app, 'company');
  const partners = listEntityFiles(view.app, 'partner');
  const activities = listEntities(view.app, 'activity');

  // ─── Header ────────────────────────────────────────
  view._renderPageHeader(root, 'CRM Dashboard', 'Pipeline · momentum · recent activity', (right) => {
    const newDeal = right.createEl('button', { cls: 'cad-btn primary', text: '+ New Deal' });
    newDeal.addEventListener('click', () => view._createEntityFromPrompt('deal'));
  });

  // ─── Top stats (5 cards) ───────────────────────────
  const grid = root.createDiv({ cls: 'cad-stat-grid' });
  const stat = (label: string, value: string | number, sub: string, accent: string) => {
    const c = grid.createDiv({ cls: 'cad-stat-card' });
    if (accent) c.dataset.accent = accent;
    c.createDiv({ cls: 'cad-stat-label', text: label });
    c.createDiv({ cls: 'cad-stat-value', text: String(value) });
    if (sub) c.createDiv({ cls: 'cad-stat-sub', text: sub });
  };
  crmStatCards(summary).forEach((card) => stat(card.label, card.value, card.sub, card.accent));

  // ─── Pipeline by stage ─────────────────────────────
  root.createDiv({ cls: 'cad-section-label-lg', text: 'PIPELINE BY STAGE' });
  const stageWrap = root.createDiv({ cls: 'cad-stage-bars' });
  pipelineByStage(allDeals, dealDef, getDealStages()).forEach(({ stage, count, value, width }) => {
    const row = stageWrap.createDiv({ cls: 'cad-stage-bar-row' });
    row.dataset.stage = stage;
    row.createDiv({ cls: 'cad-stage-bar-name', text: stage });
    row.createDiv({ cls: 'cad-stage-bar-count', text: `${count}` });
    const barWrap = row.createDiv({ cls: 'cad-stage-bar' });
    const fill = barWrap.createDiv({ cls: 'cad-stage-bar-fill' });
    fill.style.width = width;
    row.createDiv({ cls: 'cad-stage-bar-value', text: fmtValue(value, 'currency') });
    row.addEventListener('click', () => view.setMode('crm.pipeline'));
  });

  // ─── Two-column body ───────────────────────────────
  const cols = root.createDiv({ cls: 'cad-dash-cols' });
  const left = cols.createDiv({ cls: 'cad-dash-col' });
  const right = cols.createDiv({ cls: 'cad-dash-col' });

  // Hot deals — top by value, open only
  view._dashCardSection(left, 'HOT DEALS · top 5 by value', hotDeals(summary.open, dealDef), 'No open deals yet — hit + New Deal above.');

  // Stale deals — open, not touched in 14+ days (file mtime)
  view._dashCardSection(left, 'STALE DEALS · 14+ days no edits', staleDeals(summary.open, dealDef, Date.now()), 'No stale deals — momentum is good.');

  // Recent activity
  const recentAct = recentActivities(activities, ENTITIES.activity);
  view._dashCardSection(right, `RECENT ACTIVITY · ${activities.length} total`, recentAct, 'No activity logged yet. Capture a call or meeting under CRM > Activities.');

  // Customer base — mini stat row inside a card
  const baseCard = right.createDiv({ cls: 'cad-dash-card' });
  const base = customerBase({ contacts: contacts.length, companies: companies.length, partners: partners.length });
  baseCard.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: base.title });
  const baseBody = baseCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' });
  const mkMini = (label: string, val: number, accent: string, mode: string) => {
    const c = baseBody.createDiv({ cls: 'cad-mini-stat' });
    if (accent) c.dataset.accent = accent;
    c.createDiv({ cls: 'cad-mini-stat-value', text: String(val) });
    c.createDiv({ cls: 'cad-mini-stat-label', text: label });
    if (mode) {
      c.style.cursor = 'pointer';
      c.addEventListener('click', () => view.setMode(mode));
    }
  };
  base.stats.forEach((mini) => mkMini(mini.label, mini.value, mini.accent, mini.mode));

  // ─── Custom Widgets / Charts Section ────────────────
  const analyticsHeader = root.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 24px 32px 8px 32px; margin-bottom: 16px;' } });
  analyticsHeader.createEl('span', { cls: 'cad-section-label-lg',
    text: 'ANALYTICS & CHARTS', attr: { style: 'padding: 0; margin: 0; display: inline-block;' } });

  const addWidgetBtn = analyticsHeader.createEl('button', { cls: 'cad-btn primary', text: '+ Add Custom Chart' });

  const widgetsGrid = root.createDiv({ cls: 'cad-dash-cols', attr: { style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-bottom: 24px; padding: 0 32px;' } });

  const renderWidgets = () => {
    widgetsGrid.empty();

    const widgets = dashboardWidgets(view.plugin.settings, 'crmDashboardWidgets');
    if (widgets.length === 0) {
      const emptyWrap = widgetsGrid.createDiv({ attr: { style: 'grid-column: 1 / -1; text-align: center; padding: 32px; background: var(--background-secondary); border-radius: 8px; border: 1px dashed var(--border-color);' } });
      emptyWrap.createDiv({ text: 'No custom charts added yet. Click "+ Add Custom Chart" to create one!', attr: { style: 'color: var(--text-muted); font-size: 0.95em;' } });
      return;
    }

    widgets.forEach((w) => {
      const card = widgetsGrid.createDiv({ cls: 'cad-dash-card', attr: { style: 'margin: 0; display: flex; flex-direction: column;' } });

      // Card Head
      const head = card.createDiv({ cls: 'cad-dash-card-head', attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;' } });

      head.createDiv({ cls: 'cad-dash-card-title', text: w.title.toUpperCase(), attr: { style: 'font-weight: 700; font-size: 0.75rem; letter-spacing: 0.12em;' } });

      const actionsWrap = head.createDiv({ attr: { style: 'display: flex; gap: 8px; align-items: center;' } });

      // Chart Style Select
      const styleSelect = actionsWrap.createEl('select', { cls: 'cad-prop-input' });
      styleSelect.style.padding = '2px 4px';
      styleSelect.style.fontSize = '0.8em';
      styleSelect.style.height = 'auto';
      styleSelect.style.width = 'auto';
      styleSelect.style.background = 'var(--background-primary)';
      styleSelect.style.color = 'var(--text-normal)';
      styleSelect.style.border = '1px solid var(--border-color)';
      styleSelect.style.borderRadius = '4px';

      WIDGET_STYLE_OPTIONS.forEach(opt => {
        const o = styleSelect.createEl('option', { value: opt.value, text: opt.label });
        if (w.style === opt.value) o.selected = true;
      });

      styleSelect.addEventListener('change', async () => {
        w.style = styleSelect.value;
        await view.plugin.saveSettings();
        view.render();
      });

      // Delete button
      const delBtn = actionsWrap.createEl('button', { cls: 'cad-btn',
        text: '×', attr: { style: 'color: var(--text-error); padding: 2px 8px; font-weight: bold; border-color: var(--text-error); font-size: 1.1em; height: auto; border-radius: 4px; background: transparent;' } });
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Delete chart "${w.title}"?`)) return;
        view.plugin.settings.crmDashboardWidgets = removeWidget(view.plugin.settings.crmDashboardWidgets, w.id);
        await view.plugin.saveSettings();
        view.render();
      });

      const body = card.createDiv({ cls: 'cad-dash-card-body', attr: { style: 'flex: 1; min-height: 180px; display: flex; flex-direction: column; justify-content: center; padding: 14px;' } });

      // Draw chart directly into a fresh div — no innerHTML.
      view._drawChart(body.createDiv(), w.style, chartData(allDeals, w, dealDef));
    });
  };

  addWidgetBtn.addEventListener('click', () => {
    new CadenceWidgetCreateModal(view.app, 'deal', async (newWidget: WidgetConfig) => {
      if (!view.plugin.settings.crmDashboardWidgets) {
        view.plugin.settings.crmDashboardWidgets = [];
      }
      view.plugin.settings.crmDashboardWidgets.push(newWidget);
      await view.plugin.saveSettings();
      view.render();
    }).open();
  });

  renderWidgets();
}
