import { ItemView, Notice, setIcon, type TAbstractFile, type TFile, type WorkspaceLeaf } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { BUILT_SURFACES, SURFACE_BY_ID, VIEW_TYPE_CADENCE_APP, type NavSurface } from '../constants/nav';
import type { Entity, EntityDef, EntityKey, TaskNotesTask } from '../types/entities';
import type { ChartStyle } from '../types/modals';
import type { Reminder, ReminderBucket } from '../types/reminders';
import { CadenceEntityCreateModal } from '../modals/entity-create';
import { CadencePromptModal } from '../modals/prompt';
import { dailyNotePath, startOfDay, weekDates } from '../utils/dates';
import { createEntity, entityKeyFromFile, getFieldSuggestionSource } from '../utils/entities';
import { autoCreatesNote } from '../utils/field-edit';
import type { DailySections, Milestone, MilestoneInput, TaskItem } from '../utils/parsing';
import { renderPlannerPane, togglePlannerTask, type PlannerDay } from './calendar';
import { renderCompanyDetail } from './company-detail';
import { dashCardSection, type DashCardRow } from './components/cards';
import {
  drawBarChart, drawChart, drawChartEmpty, drawDonutChart, drawKpiGrid, drawSimpleList, type ChartDatum,
} from './components/charts';
import { getEntityFiles, renderEntityLinks, renderEntityTable, renderOwnerLinks } from './components/entity-table';
import {
  renderCrossSections, renderDynamicH2Section, renderGenericTextSection, renderMarkdownTextCard, renderProjectTextSection,
  renderSingleCrossSection, type FlashSaved, type ProjectTextSectionDef,
} from './components/sections';
import { renderCrmDashboard } from './crm-dashboard';
import { renderEntityDetail } from './entity-detail';
import { renderEntityList, type EntityListOptions } from './entity-list';
import {
  briefingHeadline, homeActivitiesCard, homeCard, homeInboxCard, homePartnersCard, homePipelineCard, homeProjectsCard,
  homeTodayCard, homeUpcomingCard, homeWeekCard, loadBriefing, renderBriefing, renderHome, type BriefingItem,
} from './home';
import type { AppViewHost, AppViewPlugin, PromptOptions, TaskCompleteSource } from './host';
import { inboxOverdueCount, renderInbox, renderInboxRow, renderProjectTasksSection } from './inbox';
import { getEntityKanbanParams, renderEntityKanban } from './kanban';
import {
  migrateModeId, modeUsesEntityFolder, resolveSurface, routeFor, setMode, toggleCadenceDark, toggleGroup, toggleMobileNav,
  visibleNavGroups,
} from './nav';
import { renderPRMAnalytics, renderTeam } from './prm';
import {
  renderMilestoneSection, renderProjectDetail, renderTaskSection, saveMilestones, saveProjectFrontmatter, saveTasks,
} from './project-detail';
import { renderProjectsDashboard, renderProjectsView } from './projects-dashboard';
import { renderReportGraph } from './report-graph';
import {
  renderProductivity, renderReportActivity, renderReportPartners, renderReportPipeline, renderReportSales,
} from './reports';
import {
  getTaskProjectLink, openTaskProjectPicker, propagateTaskComplete, setTaskProjectLink, taskLinkKey,
  tickDailyNoteTaskByText, tickProjectTaskByText,
} from './task-links';
import {
  getFilesUsingTemplateSection, propagateTemplateSectionAdd, propagateTemplateSectionDelete, renderTemplateDetail,
  renderTemplateSectionWithDelete, renderTemplatesDashboard,
} from './templates';
import { appendTodayTask, quickAddTodayTask, renderTodayPane, saveTodayJournal, toggleTodayTask } from './today';

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
   cross-surface helpers. CadenceAppView, at the end of this file, keeps a
   one-line delegate for each function (see src/views/README.md). */

export function initAppViewState(view: AppViewHost, plugin: AppViewPlugin): void {
  view.plugin = plugin;
  // Migrate mode IDs saved by older versions
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

    const route = routeFor(view.mode, view.plugin.settings.customPages || []);
    if (route.kind === 'surface') {
      await view[route.method](content);
    } else if (route.kind === 'entityList') {
      await view.renderEntityList(content, route.entityKey);
    } else if (route.kind === 'inherited') {
      // QUIRK (kept): the original called the inherited member of its route-table object.
      await ({} as Record<string, () => unknown>)[route.name]();
    } else {
      view.renderComingSoon(content, active);
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
        const { extras, links } = planEntityLinks(def, defaults, result.values);
        for (const link of links) {
          const targetFile = view.app.vault.getMarkdownFiles().find(tf => tf.basename.toLowerCase() === link.name.toLowerCase());
          if (!targetFile) {
            try {
              await createEntity(view.app, link.creationSource, link.name);
              new Notice(`Created new ${link.label}: ${link.name}`);
            } catch (e) {
              console.warn(`Failed to auto-create ${link.creationSource}`, e);
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

/* A note a new entity links to, auto-created if no note has that name. */
export interface EntityLink {
  name: string;
  /** Entity key or `folder:<path>`, as createEntity() takes it. */
  creationSource: string;
  /** Entity label for the notice, or 'Note'. */
  label: string;
}

/* The frontmatter patch for a note created from the entity-create modal,
   and the notes it links to, in field order. Defaults are overlaid by the
   modal's values and the primary key is dropped (the template sets it).
   Every field with an entity or folder suggestion source becomes a list of
   wiki-links; only a contact, company or project target lists its notes
   to auto-create (#45). */
export function planEntityLinks(
  def: EntityDef, defaults: Record<string, unknown>, values: Record<string, unknown>,
): { extras: Record<string, unknown>; links: EntityLink[] } {
  // Patch frontmatter with whatever else the user filled in (skip primary key — already set by template).
  const primaryKey = def.fields[0].key;
  const extras: Record<string, unknown> = Object.assign({}, defaults, values);
  delete extras[primaryKey];
  const links: EntityLink[] = [];

  for (const f of def.fields) {
    const suggestionSource = getFieldSuggestionSource(f);
    if (suggestionSource !== 'none' && suggestionSource !== 'tags' && suggestionSource !== 'history') {
      const key = f.key;
      if (extras[key]) {
        const rawVal = extras[key];
        const parts = Array.isArray(rawVal) ? rawVal.map(String) : String(rawVal).split(',');
        // Trim before stripping the brackets, so " [[Bob]]" is "Bob" (#45).
        const names = parts.map(n => n.trim().replace(/^\[\[|\]\]$/g, '').trim()).filter(Boolean);
        extras[key] = names.map(n => `[[${n}]]`);

        // An entity:<key> source names the entity <key>, not a folder called entity:<key> (#45).
        const source = suggestionSource.startsWith('entity:') ? suggestionSource.slice('entity:'.length) : suggestionSource;
        // QUIRK (kept): 'history' is excluded above, so this always picks source.
        const creationSource = source === 'history' ? 'folder:Cadence/Shared' : source;
        let targetEntityKey = ENTITIES[source] ? source : null;
        if (source.startsWith('folder:')) {
          const customFolderPath = source.slice('folder:'.length);
          const normalizedPath = customFolderPath.replace(/\/+$/, '').toLowerCase();
          for (const [ek, edef] of Object.entries(ENTITIES)) {
            if (edef && edef.folder && edef.folder.replace(/\/+$/, '').toLowerCase() === normalizedPath) {
              targetEntityKey = ek;
              break;
            }
          }
        }
        // Only a relation field (contact, company, project) auto-creates its notes (#45).
        if (!autoCreatesNote(targetEntityKey)) continue;
        const label = targetEntityKey ? ENTITIES[targetEntityKey].label : 'Note';
        for (const name of names) links.push({ name, creationSource, label });
      }
    }
  }
  return { extras, links };
}

/* ─────────── The unified Cadence app view ───────────
   The class Obsidian instantiates for VIEW_TYPE_CADENCE_APP. Every method
   beyond the View contract is a one-line delegate to a surface function, so
   `this.x()` and `view.x()` call sites land on the same function, and a test
   can spy on any surface through the instance. It is the one module that
   imports every surface (src/views/README.md). */
export class CadenceAppView extends ItemView implements AppViewHost {
  declare plugin: AppViewPlugin;
  declare mode: string;
  declare todayFile: TFile | null;
  declare todayParsed: DailySections | null;
  declare todayTaskNotes?: TaskNotesTask[];
  declare _journalSaveTimer: ReturnType<typeof setTimeout> | null;
  declare _liveRenderTimer?: ReturnType<typeof setTimeout>;
  declare plannerAnchor: Date;
  declare detailFile: TFile | null;
  declare detailEntityKey: string | null;
  declare mobileNavOpen: boolean;
  declare _isRendering?: boolean;
  declare _needsRenderAgain?: boolean;

  constructor(leaf: WorkspaceLeaf, plugin: AppViewPlugin) {
    super(leaf);
    initAppViewState(this, plugin);
  }

  _toggleMobileNav(force?: boolean) { return toggleMobileNav(this, force); }

  openEntityDetail(entityKey: string, file: TFile) { return openEntityDetail(this, entityKey, file); }

  openTemplateDetail(entityKey: string, file: TFile) { return openTemplateDetail(this, entityKey, file); }

  openEntityDetailFromFile(file: TFile) { return openEntityDetailFromFile(this, file); }

  closeEntityDetail() { return closeEntityDetail(this); }

  _migrateModeId(id: string) { return migrateModeId(id, this.plugin.settings); }

  _resolveSurface(id: string) { return resolveSurface(id, this.plugin.settings); }

  getEntityKanbanParams(entityKey: string) { return getEntityKanbanParams(this, entityKey); }

  /* Toggle Cadence-app dark mode. Scoped to `.cadence-app` only —
     does not affect Obsidian's overall light/dark mode. Persisted in settings. */
  _toggleCadenceDark() { return toggleCadenceDark(this); }

  _visibleNavGroups() { return visibleNavGroups(this.plugin.settings); }

  /* Link a daily-note task to a project. Keyed by (dailyPath, taskText). */
  _taskLinkKey(dailyPath: string, text: string | null | undefined) { return taskLinkKey(dailyPath, text); }

  _getTaskProjectLink(dailyPath: string, text: string) { return getTaskProjectLink(this, dailyPath, text); }

  _setTaskProjectLink(dailyPath: string, text: string, projectPath: string | null) { return setTaskProjectLink(this, dailyPath, text, projectPath); }

  _openTaskProjectPicker(dailyPath: string, text: string, currentLink: string | null) { return openTaskProjectPicker(this, dailyPath, text, currentLink); }

  _inboxOverdueCount() { return inboxOverdueCount(this); }

  getViewType() { return VIEW_TYPE_CADENCE_APP; }
  getDisplayText() { return 'Cadence'; }
  getIcon() { return 'sparkles'; }

  setMode(m: string) { return setMode(this, m); }

  toggleGroup(groupId: string) { return toggleGroup(this, groupId); }

  onOpen() { return onOpenAppView(this); }

  _modeUsesEntityFolder(path: string | null | undefined) { return modeUsesEntityFolder(path); }

  render() { return renderAppView(this); }

  renderComingSoon(root: HTMLElement, surface: NavSurface) { return renderComingSoon(this, root, surface); }

  /* ── Generic page header ────────────────── */
  _renderPageHeader(root: HTMLElement, title: string, subtitle?: string, actions?: (right: HTMLElement) => void) { return renderPageHeader(this, root, title, subtitle, actions); }

  /* ── Generic entity LIST view ───────────── */
  renderEntityList(root: HTMLElement, entityKey: string, opts?: EntityListOptions) { return renderEntityList(this, root, entityKey, opts); }

  /* ── Entity DETAIL view (in-app form, autosaves to frontmatter) ── */
  renderEntityDetail(root: HTMLElement, entityKey: string, file: TFile) { return renderEntityDetail(this, root, entityKey, file); }

  _renderEntityTable(parent: HTMLElement, entityKey: EntityKey, filteredList: Entity[], columns: string[]) { return renderEntityTable(this, parent, entityKey, filteredList, columns); }

  renderCompanyDetail(root: HTMLElement, file: TFile) { return renderCompanyDetail(this, root, file); }

  /* ── Project DETAIL view (real PM surface) ─────── */
  renderProjectDetail(root: HTMLElement, file: TFile) { return renderProjectDetail(this, root, file); }

  _renderMilestoneSection(parent: HTMLElement, file: TFile, milestones: Milestone[], flashSaved?: FlashSaved, rawKey?: string) { return renderMilestoneSection(this, parent, file, milestones, flashSaved, rawKey); }

  _commitMilestones(file: TFile, items: MilestoneInput[], flashSaved?: FlashSaved, skipRender?: boolean, rawKey?: string) { return saveMilestones(this, file, items, flashSaved, skipRender, rawKey); }

  _renderTaskSection(parent: HTMLElement, file: TFile, tasks: TaskItem[], flashSaved?: FlashSaved, rawKey?: string) { return renderTaskSection(this, parent, file, tasks, flashSaved, rawKey); }

  _commitTasks(file: TFile, items: Array<Partial<TaskItem>>, flashSaved?: FlashSaved, skipRender?: boolean, rawKey?: string) { return saveTasks(this, file, items, flashSaved, skipRender, rawKey); }

  _writeProjectFrontmatter(file: TFile, patch: Record<string, unknown>, flashSaved?: FlashSaved) { return saveProjectFrontmatter(this, file, patch, flashSaved); }

  _renderMarkdownTextCard(parent: HTMLElement, file: TFile, sectionKey: string, label: string, initialValue: string | undefined, placeholder?: string, flashSaved?: FlashSaved) { return renderMarkdownTextCard(this, parent, file, sectionKey, label, initialValue, placeholder, flashSaved); }

  _renderProjectTextSection(parent: HTMLElement, file: TFile, sections: Record<string, string>, def: ProjectTextSectionDef, flashSaved?: FlashSaved) { return renderProjectTextSection(this, parent, file, sections, def, flashSaved); }

  _renderGenericTextSection(parent: HTMLElement, file: TFile, sections: Record<string, string>, key: string, flashSaved?: FlashSaved) { return renderGenericTextSection(this, parent, file, sections, key, flashSaved); }

  _renderSingleCrossSection(parent: HTMLElement, targetEntity: EntityKey, linkField: string, viewType: string, parentName: string, preFilteredList?: Entity[] | null) { return renderSingleCrossSection(this, parent, targetEntity, linkField, viewType, parentName, preFilteredList); }

  _renderDynamicH2Section(parent: HTMLElement, file: TFile, sections: Record<string, string>, rawKey: string, flashSaved?: FlashSaved) { return renderDynamicH2Section(this, parent, file, sections, rawKey, flashSaved); }

  _renderCrossSections(parent: HTMLElement, parentEntity: EntityKey, parentName: string) { return renderCrossSections(this, parent, parentEntity, parentName); }

  _renderEntityLinks(parent: HTMLElement, val: unknown, targetEntityKey: string, prefix?: string) { return renderEntityLinks(this, parent, val, targetEntityKey, prefix); }

  _renderOwnerLinks(parent: HTMLElement, ownerVal: unknown, showPrefix?: boolean) { return renderOwnerLinks(this, parent, ownerVal, showPrefix); }

  /* ── Projects: rich card grid with milestone progress ─ */
  renderProjectsView(root: HTMLElement) { return renderProjectsView(this, root); }

  /* ── Home / Command Centre ───────────────── */
  renderHome(root: HTMLElement) { return renderHome(this, root); }

  _homeCard(parent: HTMLElement, title: string, action?: (head: HTMLElement) => void, tone?: string) { return homeCard(this, parent, title, action, tone); }

  /* ── Top of the day — assistant-style daily briefing ── */
  _renderBriefing(root: HTMLElement) { return renderBriefing(this, root); }

  _briefingHeadline(items: BriefingItem[]) { return briefingHeadline(items); }

  _computeBriefing() { return loadBriefing(this); }

  _homeInboxCard(parent: HTMLElement) { return homeInboxCard(this, parent); }

  _homeTodayCard(parent: HTMLElement) { return homeTodayCard(this, parent); }

  _homeWeekCard(parent: HTMLElement) { return homeWeekCard(this, parent); }

  _homeUpcomingCard(parent: HTMLElement) { return homeUpcomingCard(this, parent); }

  _homePartnersCard(parent: HTMLElement) { return homePartnersCard(this, parent); }

  _homeProjectsCard(parent: HTMLElement) { return homeProjectsCard(this, parent); }

  _homePipelineCard(parent: HTMLElement) { return homePipelineCard(this, parent); }

  _homeActivitiesCard(parent: HTMLElement) { return homeActivitiesCard(this, parent); }

  renderTemplatesDashboard(root: HTMLElement) { return renderTemplatesDashboard(this, root); }

  renderTemplateDetail(root: HTMLElement, entityKey: string, file: TFile | null) { return renderTemplateDetail(this, root, entityKey, file); }

  _renderTemplateSectionWithDelete(parent: HTMLElement, file: TFile, sections: Record<string, string>, rawKey: string, flashSaved?: FlashSaved, allRawKeys?: string[]) { return renderTemplateSectionWithDelete(this, parent, file, sections, rawKey, flashSaved, allRawKeys); }

  _getEntityFiles(entityKey: EntityKey | 'daily') { return getEntityFiles(this, entityKey); }

  _getFilesUsingTemplateSection(entityKey: EntityKey | 'daily', rawKey: string) { return getFilesUsingTemplateSection(this, entityKey, rawKey); }

  _propagateTemplateSectionAdd(entityKey: EntityKey | 'daily', cleanTitle: string, tag: string, defaultBody?: string) { return propagateTemplateSectionAdd(this, entityKey, cleanTitle, tag, defaultBody); }

  _propagateTemplateSectionDelete(entityKey: EntityKey | 'daily', rawKey: string) { return propagateTemplateSectionDelete(this, entityKey, rawKey); }

  /* ── Inbox (Planner reminders + captures) ── */
  renderInbox(root: HTMLElement) { return renderInbox(this, root); }

  _renderProjectTasksSection(root: HTMLElement) { return renderProjectTasksSection(this, root); }

  _renderInboxRow(parent: HTMLElement, r: Reminder, bucket: ReminderBucket) { return renderInboxRow(this, parent, r, bucket); }

  _quickAddTodayTask() { return quickAddTodayTask(this); }

  /* ── Pipeline kanban (deals grouped by stage) ───── */
  renderEntityKanban(root: HTMLElement, entityKey: string, groupBy: string, groups: string[]) { return renderEntityKanban(this, root, entityKey, groupBy, groups); }

  /* Central chart dispatcher — replaces 4 duplicated if-elseif blocks at call sites. */
  _drawChart(parent: HTMLElement, style: ChartStyle | string, data: ChartDatum[]) { return drawChart(this, parent, style, data); }

  _drawChartEmpty(parent: HTMLElement) { return drawChartEmpty(this, parent); }

  _drawDonutChart(parent: HTMLElement, data: ChartDatum[]) { return drawDonutChart(this, parent, data); }

  _drawBarChart(parent: HTMLElement, data: ChartDatum[]) { return drawBarChart(this, parent, data); }

  _drawKpiGrid(parent: HTMLElement, data: ChartDatum[]) { return drawKpiGrid(this, parent, data); }

  _drawSimpleList(parent: HTMLElement, data: ChartDatum[]) { return drawSimpleList(this, parent, data); }

  /* ── Projects Dashboard ─────────────────── */
  renderProjectsDashboard(root: HTMLElement) { return renderProjectsDashboard(this, root); }

  /* ── CRM Dashboard ──────────────────────── */
  renderDashboard(root: HTMLElement) { return renderCrmDashboard(this, root); }

  /* Reusable list card on the dashboard. */
  _dashCardSection(parent: HTMLElement, title: string, rows: DashCardRow[] | null | undefined, emptyMsg?: string) { return dashCardSection(this, parent, title, rows, emptyMsg); }

  /* ── Reports: Productivity (over daily notes) ── */
  renderProductivity(root: HTMLElement) { return renderProductivity(this, root); }

  /* ── Reports: Pipeline (deals breakdown) ──────── */
  renderReportPipeline(root: HTMLElement) { return renderReportPipeline(this, root); }

  /* ── Reports: Sales (closed deals) ─────────────── */
  renderReportSales(root: HTMLElement) { return renderReportSales(this, root); }

  /* ── Reports: Partners (deals attributed to partners) ─ */
  renderReportPartners(root: HTMLElement) { return renderReportPartners(this, root); }

  /* ── Reports: Activity (mix of activity types) ─ */
  renderReportActivity(root: HTMLElement) { return renderReportActivity(this, root); }

  /* ── Reports: Relationship Graph ────────── */
  renderReportGraph(root: HTMLElement) { return renderReportGraph(this, root); }

  /* ── PRM Analytics ──────────────────────── */
  renderPRMAnalytics(root: HTMLElement) { return renderPRMAnalytics(this, root); }

  /* ── Team (contacts where role contains "team") ─ */
  renderTeam(root: HTMLElement) { return renderTeam(this, root); }

  /* ── Settings (opens Obsidian settings → Cadence) ─ */
  openSettingsTab(root: HTMLElement) { return openSettingsTab(this, root); }

  /* ── Task completion propagation ──
     When a task is ticked or unticked anywhere, mirror the state to:
       - matching reminders by text (and via reminder.project to the linked project)
       - matching task lines in today's daily note + the linked reminder's date note
     Match is by exact (trimmed) task text. Renaming a task breaks the link. */
  _propagateTaskComplete(text: string, done: boolean, source?: TaskCompleteSource) { return propagateTaskComplete(this, text, done, source); }

  _tickProjectTaskByText(file: TFile, text: string, done: boolean) { return tickProjectTaskByText(this, file, text, done); }

  _tickDailyNoteTaskByText(file: TFile, text: string, done: boolean) { return tickDailyNoteTaskByText(this, file, text, done); }

  /* ── Cadence-styled prompt modal ─ */
  _prompt(opts: PromptOptions) { return openPrompt(this, opts); }

  _createEntityFromPrompt(entityKey: string, defaults?: Record<string, unknown>) { return createEntityFromPrompt(this, entityKey, defaults); }

  /* ── Today pane ─────────────────────────── */
  renderTodayPane(root: HTMLElement) { return renderTodayPane(this, root); }

  toggleTodayTask(idx: number, checked: boolean) { return toggleTodayTask(this, idx, checked); }

  appendTodayTask(text: string) { return appendTodayTask(this, text); }

  saveTodayJournal(body: string | null | undefined) { return saveTodayJournal(this, body); }

  /* ── Planner pane ───────────────────────── */
  renderPlannerPane(root: HTMLElement) { return renderPlannerPane(this, root); }

  togglePlannerTask(day: PlannerDay, idx: number, checked: boolean) { return togglePlannerTask(this, day, idx, checked); }

  async onClose() { /* nothing */ }
}
