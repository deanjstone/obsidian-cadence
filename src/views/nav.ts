import { NAV_GROUPS, SURFACE_BY_ID, type NavGroup, type NavSurface } from '../constants/nav';
import type { AppViewSettings, CustomPage } from '../types/settings';
import type { AppViewHost } from './host';

/* ─────────── App view nav ───────────
   Mode ids, surface lookup, the visible nav groups, render()'s route table
   and the nav toggles. The pure functions read settings or plain data only;
   the toggles act on the view. */

/* Mode ids from older versions. */
const LEGACY_MODE_IDS: Record<string, string> = { today: 'planner.today', planner: 'planner.calendar' };

const ownKey = (table: object, id: string): boolean => Object.prototype.hasOwnProperty.call(table, id);

/* The mode a custom page is routed under: its id, unless that id is taken by
   a built surface, an old mode id or an Object.prototype member name, when it
   is `custom.<id>`. Both the page and what owns the id stay reachable. */
export function customPageMode(page: CustomPage): string {
  const id = page.id;
  const taken = !!SURFACE_BY_ID[id] || ownKey(LEGACY_MODE_IDS, id) || id in Object.prototype;
  return taken ? `custom.${id}` : id;
}

function customPageFor(mode: string, customPages: CustomPage[]): CustomPage | undefined {
  return customPages.find(p => customPageMode(p) === mode);
}

export function migrateModeId(id: string, settings: Partial<AppViewSettings>): string {
  if (ownKey(LEGACY_MODE_IDS, id)) return LEGACY_MODE_IDS[id];
  if (SURFACE_BY_ID[id]) return id;
  const customPages = settings.customPages || [];
  if (customPageFor(id, customPages)) return id;
  const byId = customPages.find(p => p.id === id);
  return byId ? customPageMode(byId) : 'home';
}

export function resolveSurface(id: string, settings: Partial<AppViewSettings>): NavSurface {
  const custom = customPageFor(id, settings.customPages || []);
  if (custom) {
    return {
      id: customPageMode(custom),
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
        id: customPageMode(p),
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

/* What render() shows for a mode. */
export type SurfaceRoute =
  | { kind: 'surface'; method: SurfaceMethod }
  | { kind: 'entityList'; entityKey: string }
  | { kind: 'comingSoon' };

const surface = (method: SurfaceMethod): SurfaceRoute => ({ kind: 'surface', method });
const entityList = (entityKey: string): SurfaceRoute => ({ kind: 'entityList', entityKey });

const SURFACE_ROUTES = new Map<string, SurfaceRoute>(Object.entries({
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
}));

/* render()'s route table. A built surface owns its id; a custom page whose
   id is taken routes under `custom.<id>` (customPageMode). Anything else
   falls through to the coming-soon card. */
export function routeFor(mode: string, customPages: CustomPage[]): SurfaceRoute {
  const built = SURFACE_ROUTES.get(mode);
  if (built) return built;
  const custom = customPageFor(mode, customPages);
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
