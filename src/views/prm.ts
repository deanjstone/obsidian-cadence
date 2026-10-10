import { ENTITIES } from '../constants/entities';
import { CadenceWidgetCreateModal } from '../modals/widget-create';
import type { Entity, EntityDef } from '../types/entities';
import type { WidgetConfig } from '../types/modals';
import { crmSummary, dealValue, sumValues } from '../utils/deals';
import { entityValue, listEntities } from '../utils/entities';
import { fmtValue, pctBand, type PctBand } from '../utils/format';
import type { DashCardRow, MiniStat, StatCard } from './components/cards';
import { WIDGET_STYLE_OPTIONS, chartData, dashboardWidgets, removeWidget } from './components/charts';
import type { EntityListOptions } from './entity-list';
import type { AppViewHost } from './host';

/* PRM analytics (prm.analytics): partner stats, partners by tier, the top
   partners, the partner funnel and conversion, and the custom chart widgets
   over the partners; and Team, the contact list filtered to team roles. */

/* ── Pure seams: plain data in, plain data out ── */

const TIER_ACCENT: Record<string, string> = { 'Gold': 'warn', 'Silver': 'sky', 'Bronze': 'rose', 'Standard': 'mint', 'Untiered': 'mint' };

export interface PrmConversion {
  won: number;
  sourced: number;
  /** Won over sourced, as a whole percent; 0 with nothing sourced. */
  pct: number;
  band: PctBand;
}

export interface PrmAnalytics {
  stats: StatCard[];
  /** Partners per tier ('Untiered' for none), most first, each with the won
      revenue of deals naming one of its partners ('—' for none). */
  tiers: MiniStat[];
  /** The top 8 partner values by won revenue. A row opens the partner whose
      name (or file name) is the value, else it has `file: null`. */
  topPartners: DashCardRow[];
  /** Sourced, open, won and lost partner deals, with their totals. */
  funnel: MiniStat[];
  conversion: PrmConversion;
}

/* The numbers behind every PRM analytics card. A partner-sourced deal is any
   deal with a `partner` value. Won and Lost match case-sensitively, and a
   deal names a partner only by its exact text, so a wikilink names none. */
export function prmAnalytics(
  partners: Entity[], deals: Entity[],
  defs: { partner: EntityDef; deal: EntityDef } = { partner: ENTITIES.partner, deal: ENTITIES.deal },
): PrmAnalytics {
  const { partner: partnerDef, deal: dealDef } = defs;
  const partnerSourced = deals.filter((e) => entityValue(e, 'partner', dealDef));
  const { open: sourcedOpen, won: partnerWon, lost: sourcedLost, openValue, wonValue, lostValue } = crmSummary(partnerSourced, dealDef);
  const sourcedValue = sumValues(partnerSourced, dealDef);
  const totalDealValue = sumValues(deals, dealDef);
  const sharePct = totalDealValue === 0 ? 0 : Math.round((sourcedValue / totalDealValue) * 100);

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
    tierValueMap.set(tier, (tierValueMap.get(tier) || 0) + dealValue(d, dealDef));
  });

  // Top partners by won revenue
  const partnerRevenue = new Map<string, number>();
  partnerWon.forEach((d) => {
    const p = String(entityValue(d, 'partner', dealDef) || '(direct)');
    partnerRevenue.set(p, (partnerRevenue.get(p) || 0) + dealValue(d, dealDef));
  });

  const conv = partnerSourced.length === 0 ? 0 : Math.round((partnerWon.length / partnerSourced.length) * 100);
  const currency = (value: number) => fmtValue(value, 'currency');
  return {
    stats: [
      { label: 'PARTNERS', value: partners.length, sub: 'on the books', accent: 'sky' },
      { label: 'SOURCED DEALS', value: partnerSourced.length, sub: currency(sourcedValue), accent: 'mint' },
      { label: 'PARTNER REVENUE', value: currency(wonValue), sub: `${partnerWon.length} won`, accent: 'emerald' },
      { label: 'PARTNER SHARE', value: `${sharePct}%`, sub: 'of total pipeline value', accent: 'warn' },
    ],
    tiers: [...tierMap.entries()].sort((a, b) => b[1] - a[1]).map(([tier, count]) => {
      const value = tierValueMap.get(tier) || 0;
      return { label: tier.toUpperCase(), value: String(count), accent: TIER_ACCENT[tier] || 'sky', sub: value > 0 ? currency(value) : '—' };
    }),
    topPartners: [...partnerRevenue.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([p, v]) => {
        const partner = partnerByName.get(p);
        return { title: p, meta: currency(v), file: partner ? partner.file : null };
      }),
    funnel: [
      { label: 'SOURCED', value: String(partnerSourced.length), sub: currency(sourcedValue), accent: 'sky' },
      { label: 'OPEN', value: String(sourcedOpen.length), sub: currency(openValue), accent: 'mint' },
      { label: 'WON', value: String(partnerWon.length), sub: currency(wonValue), accent: 'emerald' },
      { label: 'LOST', value: String(sourcedLost.length), sub: currency(lostValue), accent: 'rose' },
    ],
    conversion: { won: partnerWon.length, sourced: partnerSourced.length, pct: conv, band: pctBand(conv) },
  };
}

/* A Team member: a contact whose role contains "team", "admin" or "member"
   in any case. A substring matches ("Teammate", "Remember"), and a role
   list is matched as its comma-joined text. */
export function isTeamMember(entity: Entity, def: EntityDef = ENTITIES.contact): boolean {
  const role = String(entityValue(entity, 'role', def) || '').toLowerCase();
  return role.includes('team') || role.includes('admin') || role.includes('member');
}

/* What Team passes to the contact list: a fresh object per call. */
export function teamListOptions(): EntityListOptions {
  return {
    title: 'Team',
    filter: (e) => isTeamMember(e),
    columns: ['name', 'role', 'email', 'company'],
  };
}

/* ── Surfaces ── */

/* A row of mini stats, each with its sub line. */
function drawMiniStats(body: HTMLElement, minis: MiniStat[]): void {
  minis.forEach((m) => {
    const mini = body.createDiv({ cls: 'cad-mini-stat' });
    mini.dataset.accent = m.accent;
    mini.createDiv({ cls: 'cad-mini-stat-value', text: m.value });
    mini.createDiv({ cls: 'cad-mini-stat-label', text: m.label });
    const sub = mini.createDiv({ cls: 'cad-stat-sub' });
    sub.style.marginTop = '4px';
    sub.setText(m.sub ?? '');
  });
}

export async function renderPRMAnalytics(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-report');
  const partnerDef = ENTITIES.partner;
  const partners = listEntities(view.app, 'partner');
  const report = prmAnalytics(partners, listEntities(view.app, 'deal'));

  view._renderPageHeader(root, 'PRM analytics', 'Partner programme health, tier mix and revenue contribution');

  const grid = root.createDiv({ cls: 'cad-stat-grid' });
  report.stats.forEach(({ label, value, sub, accent }) => {
    const c = grid.createDiv({ cls: 'cad-stat-card' });
    if (accent) c.dataset.accent = accent;
    c.createDiv({ cls: 'cad-stat-label', text: label });
    c.createDiv({ cls: 'cad-stat-value', text: String(value) });
    if (sub) c.createDiv({ cls: 'cad-stat-sub', text: sub });
  });

  /* Tier breakdown */
  if (report.tiers.length) {
    root.createDiv({ cls: 'cad-section-label-lg', text: 'PARTNERS BY TIER' });
    const tierCard = root.createDiv({ cls: 'cad-dash-card' });
    tierCard.style.margin = '0 36px 18px 36px';
    drawMiniStats(tierCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' }), report.tiers);
  }

  /* Two-col: top partners by revenue + funnel */
  const cols = root.createDiv({ cls: 'cad-dash-cols' });
  const left = cols.createDiv({ cls: 'cad-dash-col' });
  const right = cols.createDiv({ cls: 'cad-dash-col' });

  view._dashCardSection(left, 'TOP PARTNERS · by won revenue', report.topPartners, 'No partner-attributed wins yet.');

  // Funnel: Sourced → Open → Won
  const funnelCard = right.createDiv({ cls: 'cad-dash-card' });
  funnelCard.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: 'PARTNER FUNNEL' });
  drawMiniStats(funnelCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' }), report.funnel);

  const { won, sourced, pct: conv, band } = report.conversion;
  const convCard = right.createDiv({ cls: 'cad-dash-card' });
  convCard.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: `CONVERSION · sourced → won` });
  const convBody = convCard.createDiv({ cls: 'cad-dash-card-body' });
  convBody.style.padding = '20px 16px';
  const convWrap = convBody.createDiv({ cls: 'cad-proj-progress-wrap' });
  convWrap.dataset.pctBand = band;
  const convLabel = convWrap.createDiv({ cls: 'cad-proj-progress-label' });
  convLabel.createSpan({ text: `${won}/${sourced} sourced deals won` });
  convLabel.createSpan({ cls: 'cad-proj-progress-pct', text: `${conv}%` });
  const convBar = convWrap.createDiv({ cls: 'cad-proj-progress-bar' });
  const convFill = convBar.createDiv({ cls: 'cad-proj-progress-fill' });
  convFill.style.width = `${conv}%`;

  // ─── Custom Widgets / Charts Section ────────────────
  const analyticsHeader = root.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 24px 32px 8px 32px; margin-bottom: 16px;' } });
  analyticsHeader.createEl('span', { cls: 'cad-section-label-lg',
    text: 'ANALYTICS & CHARTS', attr: { style: 'padding: 0; margin: 0; display: inline-block;' } });

  const addWidgetBtn = analyticsHeader.createEl('button', { cls: 'cad-btn primary', text: '+ Add Custom Chart' });

  const widgetsGrid = root.createDiv({ cls: 'cad-dash-cols', attr: { style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-bottom: 24px; padding: 0 32px;' } });

  const renderWidgets = () => {
    widgetsGrid.empty();

    const widgets = dashboardWidgets(view.plugin.settings, 'prmDashboardWidgets');
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
        view.plugin.settings.prmDashboardWidgets = removeWidget(view.plugin.settings.prmDashboardWidgets, w.id);
        await view.plugin.saveSettings();
        view.render();
      });

      const body = card.createDiv({ cls: 'cad-dash-card-body', attr: { style: 'flex: 1; min-height: 180px; display: flex; flex-direction: column; justify-content: center; padding: 14px;' } });

      // Draw chart directly into a fresh div — no innerHTML.
      view._drawChart(body.createDiv(), w.style, chartData(partners, w, partnerDef));
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

/* Team: the contact list, filtered to team roles (isTeamMember). */
export async function renderTeam(view: AppViewHost, root: HTMLElement): Promise<void> {
  return view.renderEntityList(root, 'contact', teamListOptions());
}
