import type { ChartStyle } from '../../types/modals';
import type { AppViewHost } from '../host';

/* The chart primitives shared by the CRM, Projects and PRM dashboards and
   the #chart- H2 sections. Each draws plain data: one { label, count } per
   group, already counted and sorted by the caller. */

/** One donut segment, bar, KPI card or list row. */
export interface ChartDatum {
  label: string;
  count: number;
}

export function drawChart(view: AppViewHost, parent: HTMLElement, style: ChartStyle | string, data: ChartDatum[]): void {
  if (style === 'donut') view._drawDonutChart(parent, data);
  else if (style === 'bar') view._drawBarChart(parent, data);
  else if (style === 'kpi') view._drawKpiGrid(parent, data);
  else view._drawSimpleList(parent, data);
}

export function drawChartEmpty(view: AppViewHost, parent: HTMLElement): void {
  const el = parent.createDiv({ cls: 'cad-empty', text: 'No data' });
  el.style.cssText = 'text-align: center; padding: 16px;';
}

export function drawDonutChart(view: AppViewHost, parent: HTMLElement, data: ChartDatum[]): void {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return view._drawChartEmpty(parent);

  const r = 50;
  const circ = 2 * Math.PI * r;
  const colors = ['#38bdf8', '#34d399', '#f43f5e', '#a855f7', '#f97316', '#06b6d4', '#eab308'];

  const container = parent.createDiv({ cls: 'cad-donut-chart-container' });
  container.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 24px; padding: 12px;';

  const svgWrap = container.createDiv({ cls: 'cad-donut-svg-wrap' });
  svgWrap.style.cssText = 'position: relative; width: 140px; height: 140px; flex-shrink: 0;';

  const svg = svgWrap.createSvg('svg', { attr: { width: '140', height: '140', viewBox: '0 0 140 140' } });
  svg.createSvg('circle', { attr: { cx: '70', cy: '70', r: String(r), fill: 'transparent', stroke: 'var(--background-secondary)', 'stroke-width': '12' } });

  let currentOffset = 0;
  data.forEach((item, index) => {
    const pct = item.count / total;
    const color = colors[index % colors.length];
    const strokeLength = pct * circ;
    svg.createSvg('circle', {
      cls: 'cad-donut-segment',
      attr: {
        cx: '70', cy: '70', r: String(r),
        fill: 'transparent',
        stroke: color,
        'stroke-width': '12',
        'stroke-dasharray': `${strokeLength} ${circ}`,
        'stroke-dashoffset': String(-currentOffset),
        transform: 'rotate(-90 70 70)',
      },
    });
    currentOffset += strokeLength;
  });

  const center = svgWrap.createDiv({ cls: 'cad-donut-center' });
  center.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center;';
  const centerTotal = center.createSpan({ cls: 'cad-donut-center-total', text: String(total) });
  centerTotal.style.cssText = 'font-size: 1.25rem; font-weight: 700; color: var(--text-normal);';
  const centerLabel = center.createSpan({ cls: 'cad-donut-center-label', text: 'Total' });
  centerLabel.style.cssText = 'font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;';

  const legend = container.createDiv({ cls: 'cad-donut-legend' });
  legend.style.cssText = 'display: flex; flex-direction: column; gap: 6px; flex: 1;';
  data.forEach((item, index) => {
    const pct = item.count / total;
    const color = colors[index % colors.length];
    const row = legend.createDiv({ cls: 'cad-donut-legend-item' });
    row.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 0.85em;';
    const swatch = row.createSpan({ cls: 'cad-donut-legend-color' });
    swatch.style.cssText = `display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${color}; flex-shrink: 0;`;
    const labelEl = row.createSpan({ cls: 'cad-donut-legend-label', text: String(item.label) });
    labelEl.style.cssText = 'flex: 1; color: var(--text-normal); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;';
    const countEl = row.createSpan({ cls: 'cad-donut-legend-count', text: `${item.count} (${Math.round(pct * 100)}%)` });
    countEl.style.cssText = 'font-weight: 700; color: var(--text-muted);';
  });
}

export function drawBarChart(view: AppViewHost, parent: HTMLElement, data: ChartDatum[]): void {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return view._drawChartEmpty(parent);

  const maxCount = Math.max(1, ...data.map((item) => item.count));
  const colors = ['#38bdf8', '#34d399', '#f43f5e', '#a855f7', '#f97316', '#06b6d4', '#eab308'];

  const bars = parent.createDiv({ cls: 'cad-stage-bars' });
  bars.style.cssText = 'padding: 12px 0; display: flex; flex-direction: column; gap: 8px;';

  data.forEach((item, index) => {
    const color = colors[index % colors.length];
    const pct = (item.count / maxCount) * 100;
    const row = bars.createDiv({ cls: 'cad-stage-bar-row' });
    row.style.cssText = 'display: flex; align-items: center; margin-bottom: 0; padding: 4px 8px; border-radius: 6px;';

    const name = row.createDiv({ cls: 'cad-stage-bar-name', text: String(item.label) });
    name.style.cssText = 'width: 120px; font-weight: 500; font-size: 0.85em; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

    const count = row.createDiv({ cls: 'cad-stage-bar-count', text: String(item.count) });
    count.style.cssText = 'margin-right: 12px; font-weight: 700; color: var(--text-muted); font-size: 0.85em;';

    const bar = row.createDiv({ cls: 'cad-stage-bar' });
    bar.style.cssText = 'flex: 1; background: var(--background-secondary); border-radius: 4px; height: 10px; overflow: hidden; position: relative;';
    const fill = bar.createDiv({ cls: 'cad-stage-bar-fill' });
    fill.style.cssText = `width: ${pct}%; background-color: ${color}; height: 100%; border-radius: 4px; transition: width 0.3s ease;`;

    const value = row.createDiv({ cls: 'cad-stage-bar-value', text: `${Math.round((item.count / total) * 100)}%` });
    value.style.cssText = 'margin-left: 12px; font-size: 0.8em; color: var(--text-faint); font-weight: 600; min-width: 36px; text-align: right;';
  });
}

export function drawKpiGrid(view: AppViewHost, parent: HTMLElement, data: ChartDatum[]): void {
  if (data.length === 0) return view._drawChartEmpty(parent);
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const colors = ['sky', 'emerald', 'rose', 'purple', 'warn', 'mint'];

  const grid = parent.createDiv({ cls: 'cad-stat-grid' });
  grid.style.cssText = 'grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; padding: 12px 0; margin: 0;';

  data.forEach((item, index) => {
    const accent = colors[index % colors.length];
    const pct = total === 0 ? 0 : Math.round((item.count / total) * 100);
    const card = grid.createDiv({ cls: 'cad-stat-card', attr: { 'data-accent': accent } });
    card.style.cssText = 'padding: 10px 12px; display: flex; flex-direction: column; justify-content: center; min-height: 70px;';

    const label = card.createDiv({ cls: 'cad-stat-label', text: String(item.label).toUpperCase() });
    label.style.cssText = 'font-size: 0.65rem; letter-spacing: 0.08em; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;';

    const value = card.createDiv({ cls: 'cad-stat-value', text: String(item.count) });
    value.style.cssText = 'font-size: 1.25rem; font-weight: 800; margin: 2px 0; line-height: 1;';

    const sub = card.createDiv({ cls: 'cad-stat-sub', text: `${pct}% of total` });
    sub.style.cssText = 'font-size: 9px; margin-top: 0;';
  });
}

export function drawSimpleList(view: AppViewHost, parent: HTMLElement, data: ChartDatum[]): void {
  if (data.length === 0) return view._drawChartEmpty(parent);

  const list = parent.createDiv({ cls: 'cad-simple-list' });
  list.style.cssText = 'display: flex; flex-direction: column; gap: 6px; padding: 8px 0;';

  data.forEach((item) => {
    const row = list.createDiv({ cls: 'cad-list-item' });
    row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: var(--background-secondary); border-radius: 6px; font-size: 0.9em;';

    const label = row.createSpan({ text: String(item.label) });
    label.style.cssText = 'font-weight: 500; color: var(--text-normal); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;';

    const count = row.createSpan({ text: String(item.count) });
    count.style.cssText = 'font-weight: 700; background: var(--background-primary); padding: 1px 8px; border-radius: 4px; border: 1px solid var(--border-color); color: var(--text-muted);';
  });
}
