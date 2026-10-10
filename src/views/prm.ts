import { ENTITIES } from '../constants/entities';
import { CadenceWidgetCreateModal } from '../modals/widget-create';
import type { Entity } from '../types/entities';
import type { WidgetConfig } from '../types/modals';
import { entityValue, listEntities } from '../utils/entities';
import { fmtValue, pctBand } from '../utils/format';
import type { AppViewHost } from './host';

/* PRM analytics (prm.analytics): partner stats, partners by tier, the top
   partners, the partner funnel and conversion, and the custom chart widgets
   over the partners; and Team, the contact list filtered to team roles. */

export async function renderPRMAnalytics(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-report');
  const partnerDef = ENTITIES.partner;
  const dealDef = ENTITIES.deal;
  const partners = listEntities(view.app, 'partner');
  const deals = listEntities(view.app, 'deal');
  const dealValue = (e: Entity) => Number(entityValue(e, 'value', dealDef)) || 0;
  const sumVal = (arr: Entity[]) => arr.reduce((s, e) => s + dealValue(e), 0);
  const partnerSourced = deals.filter((e) => entityValue(e, 'partner', dealDef));
  const partnerWon = partnerSourced.filter((e) => String(entityValue(e, 'stage', dealDef)) === 'Won');

  view._renderPageHeader(root, 'PRM analytics', 'Partner programme health, tier mix and revenue contribution');

  const grid = root.createDiv({ cls: 'cad-stat-grid' });
  const stat = (label: string, value: string | number, sub: string, accent: string) => {
    const c = grid.createDiv({ cls: 'cad-stat-card' });
    if (accent) c.dataset.accent = accent;
    c.createDiv({ cls: 'cad-stat-label', text: label });
    c.createDiv({ cls: 'cad-stat-value', text: String(value) });
    if (sub) c.createDiv({ cls: 'cad-stat-sub', text: sub });
  };
  stat('PARTNERS', partners.length, 'on the books', 'sky');
  stat('SOURCED DEALS', partnerSourced.length, fmtValue(sumVal(partnerSourced), 'currency'), 'mint');
  stat('PARTNER REVENUE', fmtValue(sumVal(partnerWon), 'currency'), `${partnerWon.length} won`, 'emerald');
  const totalSourcedValue = sumVal(partnerSourced);
  const totalDealValue = sumVal(deals);
  const sharePct = totalDealValue === 0 ? 0 : Math.round((totalSourcedValue / totalDealValue) * 100);
  stat('PARTNER SHARE', `${sharePct}%`, 'of total pipeline value', 'warn');

  /* Tier breakdown */
  const tierMap = new Map<string, number>();
  const tierValueMap = new Map<string, number>();
  partners.forEach((p) => {
    const t = String(entityValue(p, 'tier', partnerDef) || 'Untiered');
    tierMap.set(t, (tierMap.get(t) || 0) + 1);
    tierValueMap.set(t, tierValueMap.get(t) || 0);
  });
  // Add tier-attributed revenue: deals where partner matches partner-name and partner.tier is known
  const partnerByName = new Map<string, Entity>();
  partners.forEach((p) => partnerByName.set(String(entityValue(p, 'name', partnerDef) || p.basename), p));
  partnerWon.forEach((d) => {
    const pname = String(entityValue(d, 'partner', dealDef) || '');
    const partner = partnerByName.get(pname);
    if (!partner) return;
    const tier = String(entityValue(partner, 'tier', partnerDef) || 'Untiered');
    tierValueMap.set(tier, (tierValueMap.get(tier) || 0) + dealValue(d));
  });

  if (tierMap.size) {
    root.createDiv({ cls: 'cad-section-label-lg', text: 'PARTNERS BY TIER' });
    const tierCard = root.createDiv({ cls: 'cad-dash-card' });
    tierCard.style.margin = '0 36px 18px 36px';
    const tierBody = tierCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' });
    const tierAccent: Record<string, string> = { 'Gold': 'warn', 'Silver': 'sky', 'Bronze': 'rose', 'Standard': 'mint', 'Untiered': 'mint' };
    [...tierMap.entries()].sort((a, b) => b[1] - a[1]).forEach(([tier, count]) => {
      const value = tierValueMap.get(tier) || 0;
      const mini = tierBody.createDiv({ cls: 'cad-mini-stat' });
      mini.dataset.accent = tierAccent[tier] || 'sky';
      mini.createDiv({ cls: 'cad-mini-stat-value', text: String(count) });
      mini.createDiv({ cls: 'cad-mini-stat-label', text: tier.toUpperCase() });
      const sub = mini.createDiv({ cls: 'cad-stat-sub' });
      sub.style.marginTop = '4px';
      sub.setText(value > 0 ? fmtValue(value, 'currency') : '—');
    });
  }

  /* Two-col: top partners by revenue + funnel */
  const cols = root.createDiv({ cls: 'cad-dash-cols' });
  const left = cols.createDiv({ cls: 'cad-dash-col' });
  const right = cols.createDiv({ cls: 'cad-dash-col' });

  // Top partners by won revenue
  const partnerRevenue = new Map<string, number>();
  partnerWon.forEach((d) => {
    const p = String(entityValue(d, 'partner', dealDef) || '(direct)');
    partnerRevenue.set(p, (partnerRevenue.get(p) || 0) + dealValue(d));
  });
  const topPartnerRows = [...partnerRevenue.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([p, v]) => {
      const partner = partnerByName.get(p);
      const file = partner ? partner.file : null;
      return {
        title: p,
        meta: fmtValue(v, 'currency'),
        file,
      };
    });
  view._dashCardSection(left, 'TOP PARTNERS · by won revenue', topPartnerRows, 'No partner-attributed wins yet.');

  // Funnel: Sourced → Open → Won
  const sourcedOpen = partnerSourced.filter((e) => !['Won', 'Lost'].includes(String(entityValue(e, 'stage', dealDef))));
  const sourcedLost = partnerSourced.filter((e) => String(entityValue(e, 'stage', dealDef)) === 'Lost');
  const conv = partnerSourced.length === 0 ? 0 : Math.round((partnerWon.length / partnerSourced.length) * 100);
  const funnelCard = right.createDiv({ cls: 'cad-dash-card' });
  funnelCard.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: 'PARTNER FUNNEL' });
  const funnelBody = funnelCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' });
  const mkF = (label: string, val: number, sub: string, accent: string) => {
    const m = funnelBody.createDiv({ cls: 'cad-mini-stat' });
    m.dataset.accent = accent;
    m.createDiv({ cls: 'cad-mini-stat-value', text: String(val) });
    m.createDiv({ cls: 'cad-mini-stat-label', text: label });
    const s = m.createDiv({ cls: 'cad-stat-sub' });
    s.style.marginTop = '4px';
    s.setText(sub);
  };
  mkF('SOURCED', partnerSourced.length, fmtValue(sumVal(partnerSourced), 'currency'), 'sky');
  mkF('OPEN', sourcedOpen.length, fmtValue(sumVal(sourcedOpen), 'currency'), 'mint');
  mkF('WON', partnerWon.length, fmtValue(sumVal(partnerWon), 'currency'), 'emerald');
  mkF('LOST', sourcedLost.length, fmtValue(sumVal(sourcedLost), 'currency'), 'rose');

  const convCard = right.createDiv({ cls: 'cad-dash-card' });
  convCard.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: `CONVERSION · sourced → won` });
  const convBody = convCard.createDiv({ cls: 'cad-dash-card-body' });
  convBody.style.padding = '20px 16px';
  const convWrap = convBody.createDiv({ cls: 'cad-proj-progress-wrap' });
  convWrap.dataset.pctBand = pctBand(conv);
  const convLabel = convWrap.createDiv({ cls: 'cad-proj-progress-label' });
  convLabel.createSpan({ text: `${partnerWon.length}/${partnerSourced.length} sourced deals won` });
  convLabel.createSpan({ cls: 'cad-proj-progress-pct', text: `${conv}%` });
  const convBar = convWrap.createDiv({ cls: 'cad-proj-progress-bar' });
  const convFill = convBar.createDiv({ cls: 'cad-proj-progress-fill' });
  convFill.style.width = `${conv}%`;

  // ─── Custom Widgets / Charts Section ────────────────
  const analyticsHeader = root.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 24px 32px 8px 32px; margin-bottom: 16px;' } });
  const labelEl = analyticsHeader.createEl('span', { cls: 'cad-section-label-lg',
    text: 'ANALYTICS & CHARTS', attr: { style: 'padding: 0; margin: 0; display: inline-block;' } });

  const addWidgetBtn = analyticsHeader.createEl('button', { cls: 'cad-btn primary', text: '+ Add Custom Chart' });

  const widgetsGrid = root.createDiv({ cls: 'cad-dash-cols', attr: { style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-bottom: 24px; padding: 0 32px;' } });

  const renderWidgets = () => {
    widgetsGrid.empty();

    const widgets = view.plugin.settings.prmDashboardWidgets || [];
    if (widgets.length === 0) {
      const emptyWrap = widgetsGrid.createDiv({ attr: { style: 'grid-column: 1 / -1; text-align: center; padding: 32px; background: var(--background-secondary); border-radius: 8px; border: 1px dashed var(--border-color);' } });
      emptyWrap.createDiv({ text: 'No custom charts added yet. Click "+ Add Custom Chart" to create one!', attr: { style: 'color: var(--text-muted); font-size: 0.95em;' } });
      return;
    }

    widgets.forEach((w) => {
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
        view.plugin.settings.prmDashboardWidgets = (view.plugin.settings.prmDashboardWidgets || []).filter(item => item.id !== w.id);
        await view.plugin.saveSettings();
        view.render();
      });

      const body = card.createDiv({ cls: 'cad-dash-card-body', attr: { style: 'flex: 1; min-height: 180px; display: flex; flex-direction: column; justify-content: center; padding: 14px;' } });

      // Calculate chart data for this widget
      const counts: Record<string, number> = {};
      partners.forEach(p => {
        let val = entityValue(p, fieldKey, partnerDef);
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
    new CadenceWidgetCreateModal(view.app, 'partner', async (newWidget: WidgetConfig) => {
      if (!view.plugin.settings.prmDashboardWidgets) {
        view.plugin.settings.prmDashboardWidgets = [];
      }
      view.plugin.settings.prmDashboardWidgets.push(newWidget);
      await view.plugin.saveSettings();
      view.render();
    }).open();
  });

  renderWidgets();
}

/* Team: contacts whose role contains "team", "admin" or "member". */
export async function renderTeam(view: AppViewHost, root: HTMLElement): Promise<void> {
  return view.renderEntityList(root, 'contact', {
    title: 'Team',
    filter: (e) => {
      const role = String(entityValue(e, 'role', ENTITIES.contact) || '').toLowerCase();
      return role.includes('team') || role.includes('admin') || role.includes('member');
    },
    columns: ['name', 'role', 'email', 'company'],
  });
}
