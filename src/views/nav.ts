import { NAV_GROUPS, SURFACE_BY_ID, type NavGroup, type NavSurface } from '../constants/nav';
import type { AppViewSettings, CustomPage } from '../types/settings';
import type { AppViewHost } from './host';

/* ─────────── App view nav ───────────
   Mode ids, surface lookup, the visible nav groups, render()'s route table
   and the nav toggles. The pure functions read settings or plain data only;
   the toggles act on the view. */

export function migrateModeId(id: string, settings: Partial<AppViewSettings>): string {
  if (id === 'today') return 'planner.today';
  if (id === 'planner') return 'planner.calendar';
  const customPages = settings.customPages || [];
  if (customPages.some(p => p.id === id)) return id;
  return SURFACE_BY_ID[id] ? id : 'home';
}

export function resolveSurface(id: string, settings: Partial<AppViewSettings>): NavSurface {
  const customPages = settings.customPages || [];
  const custom = customPages.find(p => p.id === id);
  if (custom) {
    return {
      id: custom.id,
      label: custom.label,
      icon: custom.icon || 'file-text',
      desc: `Custom page displaying ${custom.entityKey} entity.`
    };
  }
  return SURFACE_BY_ID[id] || SURFACE_BY_ID['home'];
}

export function visibleNavGroups(settings: Partial<AppViewSettings>): NavGroup[] {
  const mods = settings.modules || { crm: true, prm: true, planner: true, projects: true };
  const groups: NavGroup[] = JSON.parse(JSON.stringify(NAV_GROUPS));

  // Inject custom pages
  const customPages = settings.customPages || [];
  customPages.forEach((p) => {
    const g = groups.find((group) => group.id === p.sectionId);
    if (g) {
      g.items.push({
        id: p.id,
        label: p.label,
        icon: p.icon || 'file-text',
        module: p.module || p.sectionId,
        desc: `Custom page displaying ${p.entityKey} entity.`
      });
    }
  });

  return groups
    .map((g) => {
      if (g.module && mods[g.module] === false) return null;
      const items = g.items.filter((it) => !it.module || mods[it.module] !== false);
      if (!items.length) return null;
      return Object.assign({}, g, { items });
    })
    .filter(Boolean) as NavGroup[];
}

export function modeUsesEntityFolder(path: string | null | undefined): boolean {
  if (!path) return false;
  // Most surfaces read entity folders; refresh whenever a touched file
  // sits under any Cadence/* folder. Cheap enough.
  return path.startsWith('Cadence/');
}

/* An AppViewHost method that renders a whole surface into the content element. */
export type SurfaceMethod =
  | 'renderHome' | 'renderInbox' | 'renderTodayPane' | 'renderPlannerPane' | 'renderProjectsDashboard'
  | 'renderDashboard' | 'renderPRMAnalytics' | 'renderReportPipeline' | 'renderReportSales'
  | 'renderReportPartners' | 'renderReportActivity' | 'renderReportGraph' | 'renderProductivity'
  | 'renderTeam' | 'renderTemplatesDashboard' | 'openSettingsTab';

/* What render() shows for a mode. `inherited` keeps a legacy quirk: the
   route table was a plain object, so a mode named after an Object.prototype
   member (only reachable through a hand-edited custom page id) "routed" to
   that member. */
export type SurfaceRoute =
  | { kind: 'surface'; method: SurfaceMethod }
  | { kind: 'entityList'; entityKey: string }
  | { kind: 'comingSoon' }
  | { kind: 'inherited'; name: string };

const surface = (method: SurfaceMethod): SurfaceRoute => ({ kind: 'surface', method });
const entityList = (entityKey: string): SurfaceRoute => ({ kind: 'entityList', entityKey });

const SURFACE_ROUTES: Record<string, SurfaceRoute> = {
  'home': surface('renderHome'),
  'planner.inbox': surface('renderInbox'),
  'planner.today': surface('renderTodayPane'),
  'planner.calendar': surface('renderPlannerPane'),
  'projects.dashboard': surface('renderProjectsDashboard'),
  'projects.projects': entityList('project'),
  'crm.dashboard': surface('renderDashboard'),
  'crm.pipeline': entityList('deal'),
  'crm.contacts': entityList('contact'),
  'crm.companies': entityList('company'),
  'crm.activities': entityList('activity'),
  'prm.partners': entityList('partner'),
  'prm.registrations': entityList('registration'),
  'prm.commissions': entityList('commission'),
  'prm.leads': entityList('lead'),
  'prm.certifications': entityList('certification'),
  'prm.analytics': surface('renderPRMAnalytics'),
  'workflow.sequences': entityList('sequence'),
  'reports.pipeline': surface('renderReportPipeline'),
  'reports.sales': surface('renderReportSales'),
  'reports.partners': surface('renderReportPartners'),
  'reports.activity': surface('renderReportActivity'),
  'reports.graph': surface('renderReportGraph'),
  'reports.productivity': surface('renderProductivity'),
  'team': surface('renderTeam'),
  'templates': surface('renderTemplatesDashboard'),
  'settings': surface('openSettingsTab'),
};

/* render()'s route table. A built surface wins over a custom page with the
   same id; anything else falls through to the coming-soon card. */
export function routeFor(mode: string, customPages: CustomPage[]): SurfaceRoute {
  if (SURFACE_ROUTES[mode]) {
    return Object.prototype.hasOwnProperty.call(SURFACE_ROUTES, mode)
      ? SURFACE_ROUTES[mode]
      : { kind: 'inherited', name: mode };
  }
  const custom = customPages.find(p => p.id === mode);
  if (custom) return entityList(custom.entityKey);
  return { kind: 'comingSoon' };
}

export function toggleMobileNav(view: AppViewHost, force?: boolean): void {
  const root = view.containerEl.children[1];
  view.mobileNavOpen = (typeof force === 'boolean') ? force : !view.mobileNavOpen;
  if (root) root.toggleClass('cad-mobile-nav-open', view.mobileNavOpen);
}

/* Toggle Cadence-app dark mode. Scoped to `.cadence-app` only —
   does not affect Obsidian's overall light/dark mode. Persisted in settings. */
export async function toggleCadenceDark(view: AppViewHost): Promise<void> {
  view.plugin.settings.cadenceAppDark = !view.plugin.settings.cadenceAppDark;
  await view.plugin.saveSettings();
  view.render();
}

export async function setMode(view: AppViewHost, m: string): Promise<void> {
  view.mode = view._migrateModeId(m);
  // Switching surfaces clears any open detail form
  view.detailFile = null;
  view.detailEntityKey = null;
  await view.render();
}

export async function toggleGroup(view: AppViewHost, groupId: string): Promise<void> {
  const collapsed = view.plugin.settings.collapsedGroups || {};
  collapsed[groupId] = !collapsed[groupId];
  view.plugin.settings.collapsedGroups = collapsed;
  await view.plugin.saveSettings();
  await view.render();
}
