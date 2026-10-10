import { ENTITIES } from '../constants/entities';
import { CadenceWidgetCreateModal } from '../modals/widget-create';
import { entityValue, getDealStages, listEntities, listEntityFiles } from '../utils/entities';
import { fmtValue } from '../utils/format';
import type { Entity } from '../types/entities';
import type { WidgetConfig } from '../types/modals';
import type { AppViewHost } from './host';

/* The CRM dashboard (crm.dashboard): pipeline stats, the pipeline by stage,
   hot and stale deals, recent activity, the customer base and the custom
   chart widgets. */

export async function renderCrmDashboard(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-dashboard');

  // ─── Read all the relevant data ────────────────────
  const dealDef = ENTITIES.deal;
  const allDeals = listEntities(view.app, 'deal');
  const open = allDeals.filter((e) => !['Won', 'Lost'].includes(String(entityValue(e, 'stage', dealDef))));
  const won = allDeals.filter((e) => String(entityValue(e, 'stage', dealDef)) === 'Won');
  const lost = allDeals.filter((e) => String(entityValue(e, 'stage', dealDef)) === 'Lost');
  const dealValue = (e: Entity) => Number(entityValue(e, 'value', dealDef)) || 0;
  const sumVal = (arr: Entity[]) => arr.reduce((s, e) => s + dealValue(e), 0);
  const winRate = won.length + lost.length === 0 ? 0 : Math.round((won.length / (won.length + lost.length)) * 100);
  const avgDeal = won.length === 0 ? 0 : sumVal(won) / won.length;

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
  stat('OPEN PIPELINE', open.length, fmtValue(sumVal(open), 'currency'), 'sky');
  stat('WON', won.length, fmtValue(sumVal(won), 'currency'), 'emerald');
  stat('LOST', lost.length, fmtValue(sumVal(lost), 'currency'), 'rose');
  stat('WIN RATE', `${winRate}%`, `${won.length}/${won.length + lost.length} closed`, 'mint');
  stat('AVG DEAL', fmtValue(avgDeal, 'currency'), `${won.length} won deals`, 'warn');

  // ─── Pipeline by stage ─────────────────────────────
  root.createDiv({ cls: 'cad-section-label-lg', text: 'PIPELINE BY STAGE' });
  const stageData = getDealStages().map((stage) => {
    const items = allDeals.filter((e) => String(entityValue(e, 'stage', dealDef)) === stage);
    return { stage, items, value: sumVal(items) };
  });
  const maxStageVal = Math.max(1, ...stageData.map((s) => s.value));
  const stageWrap = root.createDiv({ cls: 'cad-stage-bars' });
  stageData.forEach(({ stage, items, value }) => {
    const row = stageWrap.createDiv({ cls: 'cad-stage-bar-row' });
    row.dataset.stage = stage;
    row.createDiv({ cls: 'cad-stage-bar-name', text: stage });
    row.createDiv({ cls: 'cad-stage-bar-count', text: `${items.length}` });
    const barWrap = row.createDiv({ cls: 'cad-stage-bar' });
    const fill = barWrap.createDiv({ cls: 'cad-stage-bar-fill' });
    fill.style.width = `${(value / maxStageVal) * 100}%`;
    row.createDiv({ cls: 'cad-stage-bar-value', text: fmtValue(value, 'currency') });
    row.addEventListener('click', () => view.setMode('crm.pipeline'));
  });

  // ─── Two-column body ───────────────────────────────
  const cols = root.createDiv({ cls: 'cad-dash-cols' });
  const left = cols.createDiv({ cls: 'cad-dash-col' });
  const right = cols.createDiv({ cls: 'cad-dash-col' });

  // Hot deals — top by value, open only
  const topHot = [...open]
    .sort((a, b) => dealValue(b) - dealValue(a))
    .slice(0, 5)
    .map((e) => ({
      title: (entityValue(e, 'title', dealDef) as string) || e.basename,
      meta: `${entityValue(e, 'stage', dealDef) || '—'} · ${fmtValue(dealValue(e), 'currency')}`,
      file: e.file,
    }));
  view._dashCardSection(left, 'HOT DEALS · top 5 by value', topHot, 'No open deals yet — hit + New Deal above.');

  // Stale deals — open, not touched in 14+ days (file mtime)
  const staleCutoff = Date.now() - 14 * 86400000;
  const stale = open
    .filter((e) => e.file && e.file.stat && e.file.stat.mtime < staleCutoff)
    .sort((a, b) => (a.file.stat!.mtime || 0) - (b.file.stat!.mtime || 0))
    .slice(0, 5)
    .map((e) => {
      const days = Math.round((Date.now() - e.file.stat!.mtime) / 86400000);
      return {
        title: (entityValue(e, 'title', dealDef) as string) || e.basename,
        meta: `${entityValue(e, 'stage', dealDef) || '—'} · ${days}d quiet · ${fmtValue(dealValue(e), 'currency')}`,
        file: e.file,
      };
    });
  view._dashCardSection(left, 'STALE DEALS · 14+ days no edits', stale, 'No stale deals — momentum is good.');

  // Recent activity
  const recentAct = [...activities]
    .sort((a, b) => {
      const da = new Date((entityValue(a, 'when', ENTITIES.activity) as string) || 0).getTime();
      const db = new Date((entityValue(b, 'when', ENTITIES.activity) as string) || 0).getTime();
      return db - da;
    })
    .slice(0, 6)
    .map((e) => {
      const typeVal = (entityValue(e, 'type', ENTITIES.activity) as string) || '—';
      const withVal = (entityValue(e, 'with', ENTITIES.activity) as string) || '—';
      const dateVal = fmtValue(entityValue(e, 'when', ENTITIES.activity), 'date');
      return {
        title: (entityValue(e, 'subject', ENTITIES.activity) as string) || e.basename,
        metaParts: [
          { text: typeVal },
          { text: ' · ' },
          { text: withVal, entityKey: 'contact' },
          { text: ` · ${dateVal}` }
        ],
        file: e.file,
      };
    });
  view._dashCardSection(right, `RECENT ACTIVITY · ${activities.length} total`, recentAct, 'No activity logged yet. Capture a call or meeting under CRM > Activities.');

  // Customer base — mini stat row inside a card
  const baseCard = right.createDiv({ cls: 'cad-dash-card' });
  baseCard.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: `CUSTOMER BASE · ${contacts.length + companies.length + partners.length} records` });
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
  mkMini('CONTACTS', contacts.length, 'warn', 'crm.contacts');
  mkMini('COMPANIES', companies.length, 'sky', 'crm.companies');
  mkMini('PARTNERS', partners.length, 'rose', 'prm.partners');

  // ─── Custom Widgets / Charts Section ────────────────
  const analyticsHeader = root.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 24px 32px 8px 32px; margin-bottom: 16px;' } });
  const labelEl = analyticsHeader.createEl('span', { cls: 'cad-section-label-lg',
    text: 'ANALYTICS & CHARTS', attr: { style: 'padding: 0; margin: 0; display: inline-block;' } });

  const addWidgetBtn = analyticsHeader.createEl('button', { cls: 'cad-btn primary', text: '+ Add Custom Chart' });

  const widgetsGrid = root.createDiv({ cls: 'cad-dash-cols', attr: { style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-bottom: 24px; padding: 0 32px;' } });

  const renderWidgets = () => {
    widgetsGrid.empty();

    const widgets = view.plugin.settings.crmDashboardWidgets || [];
    if (widgets.length === 0) {
      const emptyWrap = widgetsGrid.createDiv({ attr: { style: 'grid-column: 1 / -1; text-align: center; padding: 32px; background: var(--background-secondary); border-radius: 8px; border: 1px dashed var(--border-color);' } });
      emptyWrap.createDiv({ text: 'No custom charts added yet. Click "+ Add Custom Chart" to create one!', attr: { style: 'color: var(--text-muted); font-size: 0.95em;' } });
      return;
    }

    widgets.forEach((w: WidgetConfig) => {
      const card = widgetsGrid.createDiv({ cls: 'cad-dash-card', attr: { style: 'margin: 0; display: flex; flex-direction: column;' } });

      // Card Head
      const head = card.createDiv({ cls: 'cad-dash-card-head', attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;' } });
      const fieldKey = w.groupBy;

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

      [
        { value: 'donut', label: '🍩 Donut' },
        { value: 'bar', label: '📊 Bar' },
        { value: 'kpi', label: '🗃️ KPI Cards' },
        { value: 'list', label: '📋 List' }
      ].forEach(opt => {
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
        view.plugin.settings.crmDashboardWidgets = (view.plugin.settings.crmDashboardWidgets || []).filter((item: WidgetConfig) => item.id !== w.id);
        await view.plugin.saveSettings();
        view.render();
      });

      const body = card.createDiv({ cls: 'cad-dash-card-body', attr: { style: 'flex: 1; min-height: 180px; display: flex; flex-direction: column; justify-content: center; padding: 14px;' } });

      // Calculate chart data for this widget
      const counts: Record<string, number> = {};
      allDeals.forEach(p => {
        let val = entityValue(p, fieldKey, dealDef);
        if (Array.isArray(val)) {
          val.forEach(v => {
            const clean = String(v).replace(/^\[\[|\]\]$/g, '').trim();
            if (clean) counts[clean] = (counts[clean] || 0) + 1;
          });
        } else {
          const clean = String(val || '').replace(/^\[\[|\]\]$/g, '').trim();
          const label = clean || 'Unspecified';
          counts[label] = (counts[label] || 0) + 1;
        }
      });

      const chartData = Object.entries(counts)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);

      // Draw chart directly into a fresh div — no innerHTML.
      view._drawChart(body.createDiv(), w.style, chartData);
    });
  };

  addWidgetBtn.addEventListener('click', () => {
    new CadenceWidgetCreateModal(view.app, 'deal', async (newWidget) => {
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
