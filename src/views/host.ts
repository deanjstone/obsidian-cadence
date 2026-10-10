import type { App, EventRef, TFile, WorkspaceLeaf } from 'obsidian';
import type { NavGroup, NavSurface } from '../constants/nav';
import type { ReminderStore } from '../modals/reminder-edit';
import type { Entity, EntityKey, TaskNotesTask } from '../types/entities';
import type { ChartStyle } from '../types/modals';
import type { Reminder, ReminderBucket } from '../types/reminders';
import type { AppViewSettings } from '../types/settings';
import type { DailySections, Milestone, MilestoneInput, TaskItem } from '../utils/parsing';
import type { DashCardRow } from './components/cards';
import type { PlannerDay } from './calendar';
import type { ChartDatum } from './components/charts';
import type { FlashSaved, ProjectTextSectionDef } from './components/sections';
import type { EntityListOptions } from './entity-list';
import type { BriefingItem } from './home';
import type { KanbanParams } from './kanban';

/* The plugin as the app view sees it. */
export interface AppViewPlugin extends ReminderStore {
  settings: AppViewSettings;
  manifest: { id: string };
  saveSettings(): Promise<void>;
  openQuickCapture(): void;
  /** Any subset of a reminder's fields, e.g. `{ done }` or `{ when, notified }`. */
  updateReminder(id: string, patch: Partial<Reminder>): Promise<unknown>;
  snoozeReminder(id: string, ms: number): Promise<void>;
  completeReminder(id: string): Promise<void>;
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
  /** The daily note's parseSections() result, from the last Today render. */
  todayParsed: DailySections | null;
  /** TaskNotes mode: today's task notes, by Today row index. Unset until Today renders. */
  todayTaskNotes?: TaskNotesTask[];
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

  /* ── Home (src/views/home.ts) ── */
  renderHome(root: HTMLElement): Promise<void>;
  _homeCard(parent: HTMLElement, title: string, action?: (head: HTMLElement) => void, tone?: string): HTMLElement;
  _renderBriefing(root: HTMLElement): Promise<void>;
  _briefingHeadline(items: BriefingItem[]): string;
  _computeBriefing(): Promise<BriefingItem[]>;
  _homeInboxCard(parent: HTMLElement): Promise<void>;
  _homeTodayCard(parent: HTMLElement): Promise<void>;
  _homeWeekCard(parent: HTMLElement): Promise<void>;
  _homeUpcomingCard(parent: HTMLElement): Promise<void>;
  _homePartnersCard(parent: HTMLElement): Promise<void>;
  _homeProjectsCard(parent: HTMLElement): Promise<void>;
  _homePipelineCard(parent: HTMLElement): Promise<void>;
  _homeActivitiesCard(parent: HTMLElement): Promise<void>;

  /* ── Planner: Inbox, Today, Calendar and task links (src/views/inbox.ts,
     today.ts, calendar.ts, task-links.ts) ── */
  _inboxOverdueCount(): number;
  renderInbox(root: HTMLElement): Promise<void>;
  _renderProjectTasksSection(root: HTMLElement): Promise<void>;
  _renderInboxRow(parent: HTMLElement, r: Reminder, bucket: ReminderBucket): void;
  _quickAddTodayTask(): Promise<void>;
  renderTodayPane(root: HTMLElement): Promise<void>;
  toggleTodayTask(idx: number, checked: boolean): Promise<void>;
  appendTodayTask(text: string): Promise<void>;
  saveTodayJournal(body: string | null | undefined): Promise<void>;
  renderPlannerPane(root: HTMLElement): Promise<void>;
  togglePlannerTask(day: PlannerDay, idx: number, checked: boolean): Promise<void>;
  _taskLinkKey(dailyPath: string, text: string | null | undefined): string;
  /** The project path linked to a daily-note task, or null. */
  _getTaskProjectLink(dailyPath: string, text: string): string | null;
  _setTaskProjectLink(dailyPath: string, text: string, projectPath: string | null): Promise<void>;
  _openTaskProjectPicker(dailyPath: string, text: string, currentLink: string | null): void;
  /** Mirror a ticked task to matching reminders, their projects and daily notes. */
  _propagateTaskComplete(text: string, done: boolean, source?: TaskCompleteSource): Promise<void>;
  _tickProjectTaskByText(file: TFile, text: string, done: boolean): Promise<void>;
  _tickDailyNoteTaskByText(file: TFile, text: string, done: boolean): Promise<void>;

  /* ── Entity list and kanban (src/views/entity-list.ts, src/views/kanban.ts) ── */
  renderEntityList(root: HTMLElement, entityKey: string, opts?: EntityListOptions): Promise<void>;
  getEntityKanbanParams(entityKey: string): KanbanParams;
  /** Flagged: no call site; characterized and kept. */
  renderEntityKanban(root: HTMLElement, entityKey: string, groupBy: string, groups: string[]): Promise<void>;

  /* ── Entity and company detail (src/views/entity-detail.ts, src/views/company-detail.ts) ── */
  renderEntityDetail(root: HTMLElement, entityKey: string, file: TFile): Promise<void>;
  renderCompanyDetail(root: HTMLElement, file: TFile): Promise<void>;

  /* ── Project detail and its checklist sections (src/views/project-detail.ts) ── */
  renderProjectDetail(root: HTMLElement, file: TFile): Promise<void>;
  /** Called by _renderDynamicH2Section for a milestones section. */
  _renderMilestoneSection(
    parent: HTMLElement, file: TFile, milestones: Milestone[], flashSaved?: FlashSaved, rawKey?: string,
  ): void;
  /** Rewrite a milestones section; re-renders the view unless skipRender. */
  _commitMilestones(file: TFile, items: MilestoneInput[], flashSaved?: FlashSaved, skipRender?: boolean, rawKey?: string): Promise<void>;
  /** Called by _renderDynamicH2Section for a tasks section. */
  _renderTaskSection(parent: HTMLElement, file: TFile, tasks: TaskItem[], flashSaved?: FlashSaved, rawKey?: string): void;
  /** Rewrite a tasks section; re-renders the view unless skipRender. */
  _commitTasks(
    file: TFile, items: Array<Partial<TaskItem>>, flashSaved?: FlashSaved, skipRender?: boolean, rawKey?: string,
  ): Promise<void>;
  /** Write a frontmatter patch to a project note, then flash Saved; a failure notices. */
  _writeProjectFrontmatter(file: TFile, patch: Record<string, unknown>, flashSaved?: FlashSaved): Promise<void>;

  /* ── Projects and CRM dashboards (src/views/projects-dashboard.ts, src/views/crm-dashboard.ts) ── */
  renderProjectsDashboard(root: HTMLElement): Promise<void>;
  /** Flagged: no call site (projects.projects routes to renderEntityList); characterized and kept. */
  renderProjectsView(root: HTMLElement): Promise<void>;
  /** The CRM dashboard; the moved function is renderCrmDashboard. */
  renderDashboard(root: HTMLElement): Promise<void>;

  /* ── Called by the shell, owned by later view tickets ── */
  renderTemplateDetail(root: HTMLElement, entityKey: string, file: TFile): Promise<void>;
  renderPRMAnalytics(root: HTMLElement): Promise<void>;
  renderReportPipeline(root: HTMLElement): Promise<void>;
  renderReportSales(root: HTMLElement): Promise<void>;
  renderReportPartners(root: HTMLElement): Promise<void>;
  renderReportActivity(root: HTMLElement): Promise<void>;
  renderReportGraph(root: HTMLElement): Promise<void>;
  renderProductivity(root: HTMLElement): Promise<void>;
  renderTeam(root: HTMLElement): Promise<void>;
  renderTemplatesDashboard(root: HTMLElement): Promise<void>;
}

/* Where a ticked task came from, for _propagateTaskComplete. A daily note
   passes its file and date, a project its file, a reminder its id. */
export interface TaskCompleteSource {
  kind: 'daily' | 'project' | 'reminder' | (string & {});
  file?: TFile;
  date?: Date;
  /** kind 'reminder': the reminder's id, skipped when syncing reminders. */
  id?: string;
}

/* What _prompt() accepts; every field falls back to a default. */
export interface PromptOptions {
  title?: string;
  placeholder?: string;
  defaultValue?: string;
  cta?: string;
}
