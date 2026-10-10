import type { App, EventRef, TFile, WorkspaceLeaf } from 'obsidian';
import type { NavGroup, NavSurface } from '../constants/nav';
import type { Entity, EntityKey } from '../types/entities';
import type { ChartStyle } from '../types/modals';
import type { AppViewSettings } from '../types/settings';
import type { Milestone, TaskItem } from '../utils/parsing';
import type { DashCardRow } from './components/cards';
import type { ChartDatum } from './components/charts';
import type { FlashSaved, ProjectTextSectionDef } from './components/sections';

/* The plugin as the app view sees it. */
export interface AppViewPlugin {
  settings: AppViewSettings;
  manifest: { id: string };
  saveSettings(): Promise<void>;
}

/* The CadenceAppView instance a surface function receives as `view`.

   Surfaces move out of src/legacy/cadence.js as `fn(view: AppViewHost, …)`,
   and CadenceAppView keeps a one-line delegate for each. A surface reaches
   another surface only through `view.x()`, which lands on that delegate, so
   no surface imports another. Members are added here only when a moved
   surface reads or calls them. The plugin-entry ticket makes the class
   `implements AppViewHost`, so tsc then checks this contract. See
   src/views/README.md. */
export interface AppViewHost {
  /* ── View state ── */
  app: App;
  leaf: WorkspaceLeaf;
  containerEl: HTMLElement;
  plugin: AppViewPlugin;
  /** Active surface id: a NAV_GROUPS item id or a custom page id. */
  mode: string;
  todayFile: TFile | null;
  // TODO: confirm shape — the parseSections() result, owned by the Today ticket.
  todayParsed: unknown;
  _journalSaveTimer: ReturnType<typeof setTimeout> | null;
  _liveRenderTimer?: ReturnType<typeof setTimeout>;
  plannerAnchor: Date;
  /** When set (with detailEntityKey), render() shows the detail form. */
  detailFile: TFile | null;
  /** An entity key, or `template:<entityKey>` for a template's detail form. */
  detailEntityKey: string | null;
  mobileNavOpen: boolean;
  _isRendering?: boolean;
  _needsRenderAgain?: boolean;

  /* ── Obsidian View ── */
  registerEvent(eventRef: EventRef): void;

  /* ── Shell and nav (src/views/app-view.ts, src/views/nav.ts) ── */
  render(): Promise<void>;
  setMode(mode: string): Promise<void>;
  toggleGroup(groupId: string): Promise<void>;
  _toggleMobileNav(force?: boolean): void;
  _toggleCadenceDark(): Promise<void>;
  _migrateModeId(id: string): string;
  _resolveSurface(id: string): NavSurface;
  _visibleNavGroups(): NavGroup[];
  _modeUsesEntityFolder(path: string | null | undefined): boolean;
  openEntityDetail(entityKey: string, file: TFile): Promise<void>;
  openTemplateDetail(entityKey: string, file: TFile): Promise<void>;
  openEntityDetailFromFile(file: TFile): Promise<void>;
  closeEntityDetail(): Promise<void>;
  renderComingSoon(root: HTMLElement, surface: NavSurface): void;
  _renderPageHeader(
    root: HTMLElement, title: string, subtitle?: string, actions?: (right: HTMLElement) => void,
  ): HTMLElement;
  openSettingsTab(root: HTMLElement): Promise<void>;
  _prompt(opts: PromptOptions): Promise<string | null>;
  _createEntityFromPrompt(entityKey: string, defaults?: Record<string, unknown>): Promise<void>;

  /* ── Shared view components (src/views/components/) ── */
  _drawChart(parent: HTMLElement, style: ChartStyle | string, data: ChartDatum[]): void;
  _drawChartEmpty(parent: HTMLElement): void;
  _drawDonutChart(parent: HTMLElement, data: ChartDatum[]): void;
  _drawBarChart(parent: HTMLElement, data: ChartDatum[]): void;
  _drawKpiGrid(parent: HTMLElement, data: ChartDatum[]): void;
  _drawSimpleList(parent: HTMLElement, data: ChartDatum[]): void;
  _dashCardSection(parent: HTMLElement, title: string, rows: DashCardRow[] | null | undefined, emptyMsg?: string): void;
  _renderEntityLinks(parent: HTMLElement, val: unknown, targetEntityKey: string, prefix?: string): void;
  _renderOwnerLinks(parent: HTMLElement, ownerVal: unknown, showPrefix?: boolean): void;
  _renderEntityTable(parent: HTMLElement, entityKey: EntityKey, filteredList: Entity[], columns: string[]): void;
  _getEntityFiles(entityKey: EntityKey | 'daily'): TFile[];
  _renderMarkdownTextCard(
    parent: HTMLElement, file: TFile, sectionKey: string, label: string, initialValue: string | undefined,
    placeholder?: string, flashSaved?: FlashSaved,
  ): void;
  _renderProjectTextSection(
    parent: HTMLElement, file: TFile, sections: Record<string, string>, def: ProjectTextSectionDef, flashSaved?: FlashSaved,
  ): void;
  _renderGenericTextSection(
    parent: HTMLElement, file: TFile, sections: Record<string, string>, key: string, flashSaved?: FlashSaved,
  ): void;
  _renderSingleCrossSection(
    parent: HTMLElement, targetEntity: EntityKey, linkField: string, viewType: string, parentName: string,
    preFilteredList?: Entity[] | null,
  ): void;
  _renderCrossSections(parent: HTMLElement, parentEntity: EntityKey, parentName: string): void;
  _renderDynamicH2Section(
    parent: HTMLElement, file: TFile, sections: Record<string, string>, rawKey: string, flashSaved?: FlashSaved,
  ): void;

  /* ── Called by the shell, owned by later view tickets ── */
  _inboxOverdueCount(): number;
  renderHome(root: HTMLElement): Promise<void>;
  renderInbox(root: HTMLElement): Promise<void>;
  renderTodayPane(root: HTMLElement): Promise<void>;
  renderPlannerPane(root: HTMLElement): Promise<void>;
  renderProjectsDashboard(root: HTMLElement): Promise<void>;
  renderEntityList(root: HTMLElement, entityKey: string, opts?: Record<string, unknown>): Promise<void>;
  renderEntityDetail(root: HTMLElement, entityKey: string, file: TFile): Promise<void>;
  renderTemplateDetail(root: HTMLElement, entityKey: string, file: TFile): Promise<void>;
  renderDashboard(root: HTMLElement): Promise<void>;
  renderPRMAnalytics(root: HTMLElement): Promise<void>;
  renderReportPipeline(root: HTMLElement): Promise<void>;
  renderReportSales(root: HTMLElement): Promise<void>;
  renderReportPartners(root: HTMLElement): Promise<void>;
  renderReportActivity(root: HTMLElement): Promise<void>;
  renderReportGraph(root: HTMLElement): Promise<void>;
  renderProductivity(root: HTMLElement): Promise<void>;
  renderTeam(root: HTMLElement): Promise<void>;
  renderTemplatesDashboard(root: HTMLElement): Promise<void>;

  /* ── Called by the shared components, owned by later view tickets ── */
  _renderTaskSection(parent: HTMLElement, file: TFile, tasks: TaskItem[], flashSaved?: FlashSaved, rawKey?: string): void;
  _renderMilestoneSection(
    parent: HTMLElement, file: TFile, milestones: Milestone[], flashSaved?: FlashSaved, rawKey?: string,
  ): void;
}

/* What _prompt() accepts; every field falls back to a default. */
export interface PromptOptions {
  title?: string;
  placeholder?: string;
  defaultValue?: string;
  cta?: string;
}
