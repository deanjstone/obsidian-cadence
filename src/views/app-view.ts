import { Notice, setIcon, type TAbstractFile, type TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { BUILT_SURFACES, SURFACE_BY_ID, type NavSurface } from '../constants/nav';
import { CadenceEntityCreateModal } from '../modals/entity-create';
import { CadencePromptModal } from '../modals/prompt';
import { dailyNotePath, startOfDay, weekDates } from '../utils/dates';
import { createEntity, entityKeyFromFile, getFieldSuggestionSource } from '../utils/entities';
import type { AppViewHost, AppViewPlugin, PromptOptions } from './host';

/* Workspace.getActiveLeaf() and App.setting are not in the public
   obsidian.d.ts this repo builds against. */
interface ActiveLeafSource {
  getActiveLeaf(): unknown;
}
interface SettingWindow {
  setting: { open(): void; openTabById(id: string): void };
}

/* ─────────── The unified Cadence app view: shell ───────────
   CadenceAppView's constructor state, lifecycle, render() and the
   cross-surface helpers, moved out of src/legacy/cadence.js. The class keeps
   a one-line delegate for each function (see src/views/README.md). */

export function initAppViewState(view: AppViewHost, plugin: AppViewPlugin): void {
  view.plugin = plugin;
  // Migrate legacy mode IDs from older versions
  const raw = plugin.settings.defaultTab || 'planner.today';
  view.mode = view._migrateModeId(raw);
  // Today state
  view.todayFile = null;
  view.todayParsed = null;
  view._journalSaveTimer = null;
  // Planner state
  view.plannerAnchor = startOfDay(new Date());
  // Detail-view state — when set, renders the entity form instead of the surface
  view.detailFile = null;
  view.detailEntityKey = null;
  // Mobile nav drawer state (ephemeral, not persisted)
  view.mobileNavOpen = false;
}

export async function openEntityDetail(view: AppViewHost, entityKey: string, file: TFile): Promise<void> {
  if (!file || !entityKey) return;
  view.detailEntityKey = entityKey;
  view.detailFile = file;
  await view.render();
}

export async function openTemplateDetail(view: AppViewHost, entityKey: string, file: TFile): Promise<void> {
  if (!file || !entityKey) return;
  view.detailEntityKey = 'template:' + entityKey;
  view.detailFile = file;
  await view.render();
}

export async function openEntityDetailFromFile(view: AppViewHost, file: TFile): Promise<void> {
  const key = entityKeyFromFile(view.app, file);
  if (!key) {
    // Not a Cadence entity — fall back to opening the markdown
    view.app.workspace.openLinkText(file.path, '', false);
    return;
  }
  return view.openEntityDetail(key, file);
}

export async function closeEntityDetail(view: AppViewHost): Promise<void> {
  view.detailFile = null;
  view.detailEntityKey = null;
  await view.render();
}

export async function onOpenAppView(view: AppViewHost): Promise<void> {
  view.containerEl.children[1].empty();
  await view.render();

  // Listen to live editor changes to dynamically update Cadence views as you type
  view.registerEvent(view.app.workspace.on('editor-change', (editor, info) => {
    const file = info.file;
    if (!file) return;

    let shouldRender = false;
    if (view.detailFile && file.path === view.detailFile.path) {
      shouldRender = true;
    } else if (view.mode === 'planner.today' && view.todayFile && file.path === view.todayFile.path) {
      shouldRender = true;
    }

    if (shouldRender) {
      if (view._liveRenderTimer) clearTimeout(view._liveRenderTimer);
      view._liveRenderTimer = setTimeout(() => {
        view.render();
      }, 300);
    }
  }));

  view.registerEvent(view.app.vault.on('modify', (file) => {
    if (view.detailFile && file && file.path === view.detailFile.path) {
      // Skip refresh only if active focus is inside our view leaf to prevent stealing input focus
      if ((view.app.workspace as unknown as ActiveLeafSource).getActiveLeaf() === view.leaf) return;
      return view.render();
    }
    if (view.mode === 'planner.today' && view.todayFile && file.path === view.todayFile.path) {
      return view.render();
    }
    if (view.mode === 'planner.calendar') {
      const days = weekDates(view.plannerAnchor, view.plugin.settings.weekStartsOn);
      const paths = days.map((d) => dailyNotePath(view.plugin.settings, d));
      if (paths.includes(file.path)) return view.render();
    }
    if (view._modeUsesEntityFolder(file.path)) return view.render();
  }));

  const entityRefresh = (file: TAbstractFile | null) => {
    if (view.detailFile && file && file.path === view.detailFile.path) return;
    if (view._modeUsesEntityFolder(file && file.path)) view.render();
  };
  view.registerEvent(view.app.vault.on('create', entityRefresh));
  view.registerEvent(view.app.vault.on('delete', (file) => {
    if (view.detailFile && file && file.path === view.detailFile.path) {
      view.closeEntityDetail();
      return;
    }
    entityRefresh(file);
  }));
  view.registerEvent(view.app.vault.on('rename', (file, oldPath) => {
    if (view.detailFile && file && file.path === view.detailFile.path) return;
    if (view._modeUsesEntityFolder(file && file.path) || view._modeUsesEntityFolder(oldPath)) view.render();
  }));
  view.registerEvent(view.app.metadataCache.on('changed', (file) => {
    if (view.detailFile && file && file.path === view.detailFile.path) {
      if ((view.app.workspace as unknown as ActiveLeafSource).getActiveLeaf() === view.leaf) return;
      return view.render();
    }
    if (view._modeUsesEntityFolder(file && file.path)) view.render();
  }));

  // Auto-refresh when user clicks back onto the Cadence pane
  view.registerEvent(view.app.workspace.on('active-leaf-change', (leaf) => {
    if (leaf === view.leaf) {
      view.render();
    }
  }));
}

export async function renderAppView(view: AppViewHost): Promise<void> {
  if (view._isRendering) {
    view._needsRenderAgain = true;
    return;
  }
  view._isRendering = true;
  view._needsRenderAgain = false;
  try {
    const root = view.containerEl.children[1];
    root.empty();
    root.addClass('cadence-app');
    root.toggleClass('cad-dark', !!view.plugin.settings.cadenceAppDark);

    const active = view._resolveSurface(view.mode) || SURFACE_BY_ID['planner.today'];

    /* ── Top brand bar ──────────────────────── */
    const topbar = root.createDiv({ cls: 'cad-app-topbar' });

    /* Hamburger — visible only on mobile via CSS, toggles the nav drawer */
    const burger = topbar.createEl('button', { cls: 'cad-mobile-burger' });
    try { setIcon(burger, 'menu'); } catch (_) { }
    burger.title = 'Show nav';
    burger.addEventListener('click', () => view._toggleMobileNav());

    const brand = topbar.createDiv({ cls: 'cad-app-brand' });
    brand.createSpan({ cls: 'cad-app-brand-mark', text: '◐' });
    brand.createSpan({ cls: 'cad-app-brand-text', text: 'Cadence' });

    const topRight = topbar.createDiv({ cls: 'cad-app-topbar-right' });

    /* Cadence-app dark mode toggle (scoped — does NOT touch Obsidian's mode) */
    const dark = !!view.plugin.settings.cadenceAppDark;
    const themeBtn = topRight.createEl('button', { cls: 'cad-topbar-icon-btn' });
    try { setIcon(themeBtn, dark ? 'sun' : 'moon'); } catch (_) { }
    themeBtn.title = dark ? 'Cadence: switch to light' : 'Cadence: switch to dark';
    themeBtn.addEventListener('click', () => view._toggleCadenceDark());

    const eyebrow = topRight.createDiv({ cls: 'cad-app-topbar-meta' });
    eyebrow.setText(active.label.toUpperCase());

    /* ── Body: left grouped nav + main content ──────── */
    const body = root.createDiv({ cls: 'cad-app-body' });

    /* Backdrop — only visible on mobile when drawer is open; tapping dismisses. */
    const backdrop = body.createDiv({ cls: 'cad-mobile-backdrop' });
    backdrop.addEventListener('click', () => view._toggleMobileNav(false));

    const nav = body.createDiv({ cls: 'cad-app-nav' });
    const collapsed = view.plugin.settings.collapsedGroups || {};

    const visibleGroups = view._visibleNavGroups();
    visibleGroups.forEach((group) => {
      const groupEl = nav.createDiv({ cls: 'cad-nav-group' });
      const isCollapsed = !!collapsed[group.id];

      if (group.label) {
        const head = groupEl.createDiv({ cls: 'cad-nav-group-head' });
        const chev = head.createSpan({ cls: 'cad-nav-group-chev' });
        try { setIcon(chev, isCollapsed ? 'chevron-right' : 'chevron-down'); } catch (_) { }
        head.createSpan({ cls: 'cad-nav-group-label', text: group.label.toUpperCase() });
        head.addEventListener('click', () => view.toggleGroup(group.id));
      }

      if (!isCollapsed || !group.label) {
        const list = groupEl.createDiv({ cls: 'cad-nav-group-items' });
        group.items.forEach((s) => {
          const item = list.createDiv({
            cls: 'cad-app-nav-item' + (view.mode === s.id ? ' active' : ''),
          });
          const ic = item.createSpan({ cls: 'cad-app-nav-icon' });
          try { setIcon(ic, s.icon); } catch (_) { }
          item.createSpan({ cls: 'cad-app-nav-label', text: s.label });
          if (!BUILT_SURFACES.has(s.id) && !s.id.startsWith('custom.')) {
            item.createSpan({ cls: 'cad-app-nav-badge', text: 'soon' });
          }
          // Inbox: badge with overdue count
          if (s.id === 'planner.inbox') {
            const overdue = view._inboxOverdueCount();
            if (overdue > 0) item.createSpan({ cls: 'cad-app-nav-badge cad-nav-badge-alert', text: String(overdue) });
          }
          item.addEventListener('click', () => {
            view.setMode(s.id);
            // On mobile, picking a nav item closes the drawer.
            if (view.mobileNavOpen) view._toggleMobileNav(false);
          });
        });
      }
    });

    const content = body.createDiv({ cls: 'cad-app-content' });

    // Detail view trumps the normal surface routing
    if (view.detailFile && view.detailEntityKey) {
      // Check if file still exists in vault to prevent crashing on deleted files
      const exists = view.app.vault.getAbstractFileByPath(view.detailFile.path);
      if (!exists) {
        view.detailFile = null;
        view.detailEntityKey = null;
      } else {
        try {
          if (view.detailEntityKey.startsWith('template:')) {
            const entityKey = view.detailEntityKey.slice('template:'.length);
            await view.renderTemplateDetail(content, entityKey, view.detailFile);
          } else {
            await view.renderEntityDetail(content, view.detailEntityKey, view.detailFile);
          }
          return;
        } catch (e) {
          console.error("Cadence: Failed to render detail view", e);
          view.detailFile = null;
          view.detailEntityKey = null;
        }
      }
    }

    const route: Record<string, () => Promise<void>> = {
      'home': () => view.renderHome(content),
      'planner.inbox': () => view.renderInbox(content),
      'planner.today': () => view.renderTodayPane(content),
      'planner.calendar': () => view.renderPlannerPane(content),
      'projects.dashboard': () => view.renderProjectsDashboard(content),
      'projects.projects': () => view.renderEntityList(content, 'project'),
      'crm.dashboard': () => view.renderDashboard(content),
      'crm.pipeline': () => view.renderEntityList(content, 'deal'),
      'crm.contacts': () => view.renderEntityList(content, 'contact'),
      'crm.companies': () => view.renderEntityList(content, 'company'),
      'crm.activities': () => view.renderEntityList(content, 'activity'),
      'prm.partners': () => view.renderEntityList(content, 'partner'),
      'prm.registrations': () => view.renderEntityList(content, 'registration'),
      'prm.commissions': () => view.renderEntityList(content, 'commission'),
      'prm.leads': () => view.renderEntityList(content, 'lead'),
      'prm.certifications': () => view.renderEntityList(content, 'certification'),
      'prm.analytics': () => view.renderPRMAnalytics(content),
      'workflow.sequences': () => view.renderEntityList(content, 'sequence'),
      'reports.pipeline': () => view.renderReportPipeline(content),
      'reports.sales': () => view.renderReportSales(content),
      'reports.partners': () => view.renderReportPartners(content),
      'reports.activity': () => view.renderReportActivity(content),
      'reports.graph': () => view.renderReportGraph(content),
      'reports.productivity': () => view.renderProductivity(content),
      'team': () => view.renderTeam(content),
      'templates': () => view.renderTemplatesDashboard(content),
      'settings': () => view.openSettingsTab(content),
    };
    if (route[view.mode]) {
      await route[view.mode]();
    } else {
      const customPages = view.plugin.settings.customPages || [];
      const custom = customPages.find(p => p.id === view.mode);
      if (custom) {
        await view.renderEntityList(content, custom.entityKey);
      } else {
        view.renderComingSoon(content, active);
      }
    }
  } finally {
    view._isRendering = false;
    if (view._needsRenderAgain) {
      view._needsRenderAgain = false;
      view.render();
    }
  }
}

export function renderComingSoon(view: AppViewHost, root: HTMLElement, surface: NavSurface): void {
  root.addClass('cadence-soon');
  const wrap = root.createDiv({ cls: 'cad-soon-wrap' });
  wrap.createDiv({ cls: 'cad-eyebrow', text: 'COMING SOON' });
  wrap.createDiv({ cls: 'cad-soon-title', text: surface.label });
  wrap.createDiv({ cls: 'cad-soon-desc', text: surface.desc });

  const ic = wrap.createDiv({ cls: 'cad-soon-icon' });
  try { setIcon(ic, surface.icon); } catch (_) { }

  const meta = wrap.createDiv({ cls: 'cad-soon-meta' });
  meta.setText('This surface is scaffolded but not yet built. Tell the team to flesh it out next.');
}

export function renderPageHeader(
  view: AppViewHost, root: HTMLElement, title: string, subtitle?: string, actions?: (right: HTMLElement) => void,
): HTMLElement {
  const head = root.createDiv({ cls: 'cad-page-header' });
  const left = head.createDiv({ cls: 'cad-page-header-left' });
  left.createDiv({ cls: 'cad-eyebrow', text: 'CADENCE' });
  left.createDiv({ cls: 'cad-page-title', text: title });
  if (subtitle) left.createDiv({ cls: 'cad-page-subtitle', text: subtitle });
  const right = head.createDiv({ cls: 'cad-page-header-right' });
  if (typeof actions === 'function') actions(right);
  return head;
}

export async function openSettingsTab(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-soon');
  const wrap = root.createDiv({ cls: 'cad-soon-wrap' });
  const ic = wrap.createDiv({ cls: 'cad-soon-icon' });
  try { setIcon(ic, 'settings-2'); } catch (_) { }
  wrap.createDiv({ cls: 'cad-eyebrow', text: 'CADENCE' });
  wrap.createDiv({ cls: 'cad-soon-title', text: 'Settings' });
  wrap.createDiv({ cls: 'cad-soon-desc', text: 'Configure folders, headings, week start, default tab, and the (future) Cadence API connection.' });
  const btn = wrap.createEl('button', { cls: 'cad-btn primary', text: 'Open Cadence settings' });
  btn.style.marginTop = '12px';
  btn.addEventListener('click', () => {
    (view.app as unknown as SettingWindow).setting.open();
    (view.app as unknown as SettingWindow).setting.openTabById(view.plugin.manifest.id);
  });
}

export function openPrompt(view: AppViewHost, opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    new CadencePromptModal(view.app, {
      title: opts.title || 'Enter a name',
      placeholder: opts.placeholder || '',
      defaultValue: opts.defaultValue || '',
      cta: opts.cta || 'Create',
      onSubmit: resolve,
    }).open();
  });
}

export async function createEntityFromPrompt(
  view: AppViewHost, entityKey: string, defaults: Record<string, unknown> = {},
): Promise<void> {
  const def = ENTITIES[entityKey];
  new CadenceEntityCreateModal(view.app, entityKey, {
    defaults,
    onSubmit: async (result) => {
      if (!result) return;
      try {
        const file = await createEntity(view.app, entityKey, result.name);
        // Patch frontmatter with whatever else the user filled in (skip primary key — already set by template).
        const primaryKey = def.fields[0].key;
        const extras = Object.assign({}, defaults, result.values);
        delete extras[primaryKey];

        for (const f of def.fields) {
          const suggestionSource = getFieldSuggestionSource(f);
          if (suggestionSource !== 'none' && suggestionSource !== 'tags' && suggestionSource !== 'history') {
            const key = f.key;
            if (extras[key]) {
              const rawVal = extras[key];
              const parts = Array.isArray(rawVal) ? rawVal.map(String) : String(rawVal).split(',');
              const names = parts.map(n => n.replace(/^\[\[|\]\]$/g, '').trim()).filter(Boolean);
              extras[key] = names.map(n => `[[${n}]]`);

              const creationSource = suggestionSource === 'history' ? 'folder:Cadence/Shared' : suggestionSource;
              let targetEntityKey = ENTITIES[suggestionSource] ? suggestionSource : null;
              if (suggestionSource.startsWith('folder:')) {
                const customFolderPath = suggestionSource.slice('folder:'.length);
                const normalizedPath = customFolderPath.replace(/\/+$/, '').toLowerCase();
                for (const [ek, edef] of Object.entries(ENTITIES)) {
                  if (edef && edef.folder && edef.folder.replace(/\/+$/, '').toLowerCase() === normalizedPath) {
                    targetEntityKey = ek;
                    break;
                  }
                }
              }

              for (const name of names) {
                const targetFile = view.app.vault.getMarkdownFiles().find(tf => tf.basename.toLowerCase() === name.toLowerCase());
                if (!targetFile) {
                  try {
                    await createEntity(view.app, creationSource, name);
                    const label = targetEntityKey ? ENTITIES[targetEntityKey].label : 'Note';
                    new Notice(`Created new ${label}: ${name}`);
                  } catch (e) {
                    console.warn(`Failed to auto-create ${creationSource}`, e);
                  }
                }
              }
            }
          }
        }

        if (Object.keys(extras).length) {
          await view.app.fileManager.processFrontMatter(file, (fm) => {
            Object.entries(extras).forEach(([k, v]) => {
              if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) return;
              fm[k] = v;
            });
          });
        }
        new Notice(`Created ${def.label}: ${file.basename}\nSaved to ${file.path}`, 4000);
        await view.openEntityDetail(entityKey, file);
      } catch (e) {
        new Notice(`Cadence: failed to create ${def.label} — ${(e as Error).message}`);
      }
    },
  }).open();
}
