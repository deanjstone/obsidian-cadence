import { NAV_GROUPS, SURFACE_BY_ID, type NavGroup, type NavSurface } from '../constants/nav';
import type { AppViewSettings } from '../types/settings';
import type { AppViewHost } from './host';

/* ─────────── App view nav ───────────
   Mode ids, surface lookup, the visible nav groups, and the nav toggles.
   The first four read settings only; the rest act on the view. */

export function migrateModeId(id: string, settings: AppViewSettings): string {
  if (id === 'today') return 'planner.today';
  if (id === 'planner') return 'planner.calendar';
  const customPages = settings.customPages || [];
  if (customPages.some(p => p.id === id)) return id;
  return SURFACE_BY_ID[id] ? id : 'home';
}

export function resolveSurface(id: string, settings: AppViewSettings): NavSurface {
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

export function visibleNavGroups(settings: AppViewSettings): NavGroup[] {
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
