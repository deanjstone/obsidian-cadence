/* ============================================================
   Cadence — Obsidian app
   Single unified view with internal tab nav (Today / Planner / ...).
   Source-of-truth = your daily-note markdown files.
   Legacy body of the plugin, being migrated module-by-module into typed
   src/ modules (see issue #1). Bundled by esbuild into the root main.js.
   ============================================================ */
import * as obsidian from 'obsidian';
import {
  addDays, dailyNotePath, dateInfo, fromLocalDatetimeValue, greeting, pad, sameDay, startOfDay, startOfWeek,
  toLocalDatetimeValue, weekDates, ymd,
} from '../utils/dates';
import { autoDetectCsvMapping, csvRowExtras } from '../modals/csv-import-mapping';
import { parseCSV } from '../utils/csv';
import {
  parseH2Sections, parseHeaderKey, parseLinkValues, parseMilestones, parseSections, parseTasksList,
  replaceSection, stringifyMilestones, stringifyTasks,
} from '../utils/parsing';
import { findProjectTaskReminder, nextRepeat, reminderBucket, reminderId, reminderTimeStr } from '../utils/reminders';
import { DEAL_STAGES, ENTITIES } from '../constants/entities';
import { ALL_SURFACES, BUILT_SURFACES, NAV_GROUPS, SURFACE_BY_ID, VIEW_TYPE_CADENCE_APP } from '../constants/nav';
import { ensureDailyNote } from '../utils/daily-notes';
import {
  createEntity, entityKeyFromFile, entityValue, getDealStages, getEnumOptions, getFieldSuggestionSource,
  listEntities, listEntityFiles, migrateFrontmatterKey, migrateFrontmatterType, projectNameFromPath,
  readEntity, readProjectMeta,
} from '../utils/entities';
import { fmtValue, pctBand, setCurrentCurrency } from '../utils/format';
import { appendTaskNotesTask, listTaskNotesTasks, listTaskNotesTasksForFile, toggleTaskNotesTask } from '../utils/tasknotes';
import { ensureDefaultTemplates, entityTemplate, projectTemplate } from '../utils/templates';
import { ensureFolderSync } from '../utils/vault';
import { CadenceChartSectionModal } from '../modals/chart-section';
import { CadenceCaptureModal } from '../modals/capture';
import { CadenceConfirmModal } from '../modals/confirm';
import { CadenceCrossSectionModal } from '../modals/cross-section';
import { CadencePromptModal } from '../modals/prompt';
import { CadenceReminderEditModal } from '../modals/reminder-edit';
import { CadenceWidgetCreateModal } from '../modals/widget-create';
import { CadenceEntityCreateModal } from '../modals/entity-create';
import { CadenceImportModal } from '../modals/import-modal';
import { CadenceSettingTab } from '../settings/setting-tab';
import {
  closeEntityDetail, createEntityFromPrompt, initAppViewState, onOpenAppView, openEntityDetail, openEntityDetailFromFile,
  openPrompt, openSettingsTab, openTemplateDetail, renderAppView, renderComingSoon, renderPageHeader,
} from '../views/app-view';
import {
  migrateModeId, modeUsesEntityFolder, resolveSurface, setMode, toggleCadenceDark, toggleGroup, toggleMobileNav,
  visibleNavGroups,
} from '../views/nav';
import {
  briefingHeadline, homeActivitiesCard, homeCard, homeInboxCard, homePartnersCard, homePipelineCard, homeProjectsCard,
  homeTodayCard, homeUpcomingCard, homeWeekCard, loadBriefing, renderBriefing, renderHome,
} from '../views/home';
import { inboxOverdueCount, renderInbox, renderInboxRow, renderProjectTasksSection } from '../views/inbox';
import { appendTodayTask, quickAddTodayTask, renderTodayPane, saveTodayJournal, toggleTodayTask } from '../views/today';
import { renderPlannerPane, togglePlannerTask } from '../views/calendar';
import { renderEntityList } from '../views/entity-list';
import { getEntityKanbanParams, renderEntityKanban } from '../views/kanban';
import { renderEntityDetail } from '../views/entity-detail';
import { renderCompanyDetail } from '../views/company-detail';
import { renderProjectsDashboard, renderProjectsView } from '../views/projects-dashboard';
import {
  getFilesUsingTemplateSection, propagateTemplateSectionAdd, propagateTemplateSectionDelete, renderTemplateDetail,
  renderTemplateSectionWithDelete, renderTemplatesDashboard,
} from '../views/templates';
import { renderCrmDashboard } from '../views/crm-dashboard';
import {
  renderProductivity, renderReportActivity, renderReportPartners, renderReportPipeline, renderReportSales,
} from '../views/reports';
import { renderReportGraph } from '../views/report-graph';
import { renderPRMAnalytics, renderTeam } from '../views/prm';
import {
  renderMilestoneSection, renderProjectDetail, renderTaskSection, saveMilestones, saveProjectFrontmatter, saveTasks,
} from '../views/project-detail';
import {
  getTaskProjectLink, openTaskProjectPicker, propagateTaskComplete, setTaskProjectLink, taskLinkKey,
  tickDailyNoteTaskByText, tickProjectTaskByText,
} from '../views/task-links';
import { dashCardSection } from '../views/components/cards';
import { drawBarChart, drawChart, drawChartEmpty, drawDonutChart, drawKpiGrid, drawSimpleList } from '../views/components/charts';
import { getEntityFiles, renderEntityLinks, renderEntityTable, renderOwnerLinks } from '../views/components/entity-table';
import {
  renderCrossSections, renderDynamicH2Section, renderGenericTextSection, renderMarkdownTextCard, renderProjectTextSection,
  renderSingleCrossSection,
} from '../views/components/sections';





/* ─────────── Settings ─────────── */
const DEFAULT_SETTINGS = {
  dailyNoteFolder: 'daily',
  dailyNoteFormat: 'YYYY-MM-DD',
  journalHeading: '## Journal',
  tasksHeading: '## Today',
  taskManagementSystem: 'native',
  weekStartsOn: 1,
  defaultTab: 'home',
  openOnStartup: true,
  collapsedGroups: {},
  currency: 'USD',
  cadenceAppDark: false,
  taskProjectLinks: {},
  modules: {
    crm: true,
    prm: false,
    planner: true,
    projects: true
  },
  desktopNotifications: true,
  reminders: [],
  customPages: [],
  pageLayouts: {},
  pageKanbanGroupBy: {},
  crossSections: [],
  cadenceApiUrl: '',
  cadenceApiToken: '',
  projectDashboardWidgets: [],
  crmDashboardWidgets: [],
  prmDashboardWidgets: [],
  customEntities: {
    project: [
      { key: 'name', label: 'Name', primary: true, type: 'text' },
      { key: 'status', label: 'Status', type: 'enum', options: ['active', 'on_hold', 'backlog', 'done', 'cancelled'] },
      { key: 'priority', label: 'Priority', type: 'enum', options: ['low', 'medium', 'high'] },
      { key: 'owner', label: 'Owner', type: 'multitext', suggestionSource: 'folder:Cadence/Contacts' },
      { key: 'started', label: 'Started', type: 'date' },
      { key: 'due', label: 'Due', type: 'date' },
      { key: 'tags', label: 'Tags', type: 'tags' }
    ],
    contact: [
      { key: 'name', label: 'Name', primary: true, type: 'text' },
      { key: 'email', label: 'Email', type: 'multitext', isList: true, suggestionSource: 'none' },
      { key: 'phone', label: 'Phone', isList: true, type: 'multitext', suggestionSource: 'none' },
      { key: 'company', label: 'Company', isList: true, type: 'multitext', suggestionSource: 'folder:Cadence/Companies' },
      { key: 'role', label: 'Role', isList: true, type: 'multitext' },
      { key: 'project', label: 'Project', type: 'multitext', suggestionSource: 'folder:Cadence/Projects' },
      { key: 'lastContact', label: 'Last contact', type: 'date' },
      { key: 'tags', label: 'Tags', type: 'tags' }
    ],
    deal: [
      { key: 'title', label: 'Title', primary: true, type: 'text' },
      { key: 'stage', label: 'Stage', type: 'enum', options: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'] },
      { key: 'value', label: 'Value', type: 'currency' },
      { key: 'company', label: 'Company', type: 'multitext', suggestionSource: 'folder:Cadence/Companies' },
      { key: 'contact', label: 'Contact', type: 'multitext', suggestionSource: 'folder:Cadence/Contacts' },
      { key: 'closeBy', label: 'Close by', type: 'date' },
      { key: 'project', label: 'Project', type: 'multitext', suggestionSource: 'folder:Cadence/Projects' },
      { key: 'owner', label: 'Owner', type: 'multitext', suggestionSource: 'folder:Cadence/Contacts' }
    ],
    company: [
      { key: 'name', label: 'Name', primary: true, type: 'text' },
      { key: 'domain', label: 'Domain', isList: true, type: 'multitext' },
      { key: 'industry', label: 'Industry', isList: true, type: 'multitext' },
      { key: 'size', label: 'Size', type: 'text' },
      { key: 'owner', label: 'Owner', type: 'multitext', suggestionSource: 'folder:Cadence/Contacts' },
      { key: 'tags', label: 'Tags', type: 'tags' }
    ],
    activity: [
      { key: 'subject', label: 'Subject', primary: true, type: 'text' },
      { key: 'type', label: 'Type', type: 'enum', options: ['Call', 'Email', 'Meeting', 'Note', 'Task'] },
      { key: 'when', label: 'When', type: 'date' },
      { key: 'with', label: 'With', type: 'multitext', suggestionSource: 'folder:Cadence/Contacts' },
      { key: 'company', label: 'Company', type: 'multitext', suggestionSource: 'folder:Cadence/Companies' },
      { key: 'project', label: 'Project', type: 'multitext', suggestionSource: 'folder:Cadence/Projects' }
    ],
    partner: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'tier', label: 'Tier', type: 'enum', options: ['Gold', 'Silver', 'Bronze', 'Standard'] },
      { key: 'status', label: 'Status', type: 'enum', options: ['Active', 'Onboarding', 'Inactive', 'Churned'] },
      { key: 'owner', label: 'Owner', type: 'multitext', suggestionSource: 'folder:Cadence/Contacts' },
      { key: 'region', label: 'Region' }
    ],
    registration: [
      { key: 'title', label: 'Title', primary: true },
      { key: 'partner', label: 'Partner' },
      { key: 'status', label: 'Status', type: 'enum', options: ['Submitted', 'Approved', 'Rejected', 'Expired'] },
      { key: 'value', label: 'Value', type: 'currency' },
      { key: 'submitted', label: 'Submitted', type: 'date' },
      { key: 'expires', label: 'Expires', type: 'date' }
    ],
    commission: [
      { key: 'reference', label: 'Ref', primary: true },
      { key: 'partner', label: 'Partner' },
      { key: 'amount', label: 'Amount', type: 'currency' },
      { key: 'status', label: 'Status', type: 'enum', options: ['Pending', 'Earned', 'Paid', 'Disputed'] },
      { key: 'period', label: 'Period' },
      { key: 'paidOn', label: 'Paid on', type: 'date' }
    ],
    lead: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'company', label: 'Company', type: 'multitext', suggestionSource: 'folder:Cadence/Companies' },
      { key: 'source', label: 'Source' },
      { key: 'status', label: 'Status', type: 'enum', options: ['New', 'Contacted', 'Qualified', 'Disqualified', 'Converted'] },
      { key: 'assigned', label: 'Assigned' }
    ],
    certification: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'partner', label: 'Partner' },
      { key: 'level', label: 'Level' },
      { key: 'issued', label: 'Issued', type: 'date' },
      { key: 'expires', label: 'Expires', type: 'date' }
    ],
    sequence: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'audience', label: 'Audience' },
      { key: 'steps', label: 'Steps', type: 'number' },
      { key: 'active', label: 'Active', type: 'number' },
      { key: 'status', label: 'Status', type: 'enum', options: ['Draft', 'Active', 'Paused', 'Archived'] }
    ]
  }
};











































/* ─────────── The unified Cadence app view ─────────── */
class CadenceAppView extends obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    initAppViewState(this, plugin);
  }

  _toggleMobileNav(force) { return toggleMobileNav(this, force); }

  openEntityDetail(entityKey, file) { return openEntityDetail(this, entityKey, file); }

  openTemplateDetail(entityKey, file) { return openTemplateDetail(this, entityKey, file); }

  openEntityDetailFromFile(file) { return openEntityDetailFromFile(this, file); }

  closeEntityDetail() { return closeEntityDetail(this); }

  _migrateModeId(id) { return migrateModeId(id, this.plugin.settings); }

  _resolveSurface(id) { return resolveSurface(id, this.plugin.settings); }

  getEntityKanbanParams(entityKey) { return getEntityKanbanParams(this, entityKey); }

  /* Toggle Cadence-app dark mode. Scoped to `.cadence-app` only —
     does not affect Obsidian's overall light/dark mode. Persisted in settings. */
  _toggleCadenceDark() { return toggleCadenceDark(this); }

  _visibleNavGroups() { return visibleNavGroups(this.plugin.settings); }

  /* Link a daily-note task to a project. Keyed by (dailyPath, taskText). */
  _taskLinkKey(dailyPath, text) { return taskLinkKey(dailyPath, text); }

  _getTaskProjectLink(dailyPath, text) { return getTaskProjectLink(this, dailyPath, text); }

  _setTaskProjectLink(dailyPath, text, projectPath) { return setTaskProjectLink(this, dailyPath, text, projectPath); }

  _openTaskProjectPicker(dailyPath, text, currentLink) { return openTaskProjectPicker(this, dailyPath, text, currentLink); }

  _inboxOverdueCount() { return inboxOverdueCount(this); }

  getViewType() { return VIEW_TYPE_CADENCE_APP; }
  getDisplayText() { return 'Cadence'; }
  getIcon() { return 'sparkles'; }

  setMode(m) { return setMode(this, m); }

  toggleGroup(groupId) { return toggleGroup(this, groupId); }

  onOpen() { return onOpenAppView(this); }

  _modeUsesEntityFolder(path) { return modeUsesEntityFolder(path); }

  render() { return renderAppView(this); }

  renderComingSoon(root, surface) { return renderComingSoon(this, root, surface); }

  /* ── Generic page header ────────────────── */
  _renderPageHeader(root, title, subtitle, actions) { return renderPageHeader(this, root, title, subtitle, actions); }

  /* ── Generic entity LIST view ───────────── */
  renderEntityList(root, entityKey, opts) { return renderEntityList(this, root, entityKey, opts); }

  /* ── Entity DETAIL view (in-app form, autosaves to frontmatter) ── */
  renderEntityDetail(root, entityKey, file) { return renderEntityDetail(this, root, entityKey, file); }

  _renderEntityTable(parent, entityKey, filteredList, columns) { return renderEntityTable(this, parent, entityKey, filteredList, columns); }

  renderCompanyDetail(root, file) { return renderCompanyDetail(this, root, file); }

  /* ── Project DETAIL view (real PM surface) ─────── */
  renderProjectDetail(root, file) { return renderProjectDetail(this, root, file); }

  _renderMilestoneSection(parent, file, milestones, flashSaved, rawKey) { return renderMilestoneSection(this, parent, file, milestones, flashSaved, rawKey); }

  _commitMilestones(file, items, flashSaved, skipRender, rawKey) { return saveMilestones(this, file, items, flashSaved, skipRender, rawKey); }

  _renderTaskSection(parent, file, tasks, flashSaved, rawKey) { return renderTaskSection(this, parent, file, tasks, flashSaved, rawKey); }

  _commitTasks(file, items, flashSaved, skipRender, rawKey) { return saveTasks(this, file, items, flashSaved, skipRender, rawKey); }

  _writeProjectFrontmatter(file, patch, flashSaved) { return saveProjectFrontmatter(this, file, patch, flashSaved); }

  _renderMarkdownTextCard(parent, file, sectionKey, label, initialValue, placeholder, flashSaved) { return renderMarkdownTextCard(this, parent, file, sectionKey, label, initialValue, placeholder, flashSaved); }

  _renderProjectTextSection(parent, file, sections, def, flashSaved) { return renderProjectTextSection(this, parent, file, sections, def, flashSaved); }

  _renderGenericTextSection(parent, file, sections, key, flashSaved) { return renderGenericTextSection(this, parent, file, sections, key, flashSaved); }

  _renderSingleCrossSection(parent, targetEntity, linkField, viewType, parentName, preFilteredList) { return renderSingleCrossSection(this, parent, targetEntity, linkField, viewType, parentName, preFilteredList); }

  _renderDynamicH2Section(parent, file, sections, rawKey, flashSaved) { return renderDynamicH2Section(this, parent, file, sections, rawKey, flashSaved); }

  _renderCrossSections(parent, parentEntity, parentName) { return renderCrossSections(this, parent, parentEntity, parentName); }

  _renderEntityLinks(parent, val, targetEntityKey, prefix) { return renderEntityLinks(this, parent, val, targetEntityKey, prefix); }


  _renderOwnerLinks(parent, ownerVal, showPrefix) { return renderOwnerLinks(this, parent, ownerVal, showPrefix); }

  /* ── Projects: rich card grid with milestone progress ─ */
  renderProjectsView(root) { return renderProjectsView(this, root); }

  /* ── Home / Command Centre ───────────────── */
  renderHome(root) { return renderHome(this, root); }

  _homeCard(parent, title, action, tone) { return homeCard(this, parent, title, action, tone); }

  /* ── Top of the day — assistant-style daily briefing ── */
  _renderBriefing(root) { return renderBriefing(this, root); }

  _briefingHeadline(items) { return briefingHeadline(items); }

  _computeBriefing() { return loadBriefing(this); }

  _homeInboxCard(parent) { return homeInboxCard(this, parent); }

  _homeTodayCard(parent) { return homeTodayCard(this, parent); }

  _homeWeekCard(parent) { return homeWeekCard(this, parent); }

  _homeUpcomingCard(parent) { return homeUpcomingCard(this, parent); }

  _homePartnersCard(parent) { return homePartnersCard(this, parent); }

  _homeProjectsCard(parent) { return homeProjectsCard(this, parent); }

  _homePipelineCard(parent) { return homePipelineCard(this, parent); }

  _homeActivitiesCard(parent) { return homeActivitiesCard(this, parent); }

  renderTemplatesDashboard(root) { return renderTemplatesDashboard(this, root); }

  renderTemplateDetail(root, entityKey, file) { return renderTemplateDetail(this, root, entityKey, file); }

  _renderTemplateSectionWithDelete(parent, file, sections, rawKey, flashSaved, allRawKeys) { return renderTemplateSectionWithDelete(this, parent, file, sections, rawKey, flashSaved, allRawKeys); }

  _getEntityFiles(entityKey) { return getEntityFiles(this, entityKey); }

  _getFilesUsingTemplateSection(entityKey, rawKey) { return getFilesUsingTemplateSection(this, entityKey, rawKey); }

  _propagateTemplateSectionAdd(entityKey, cleanTitle, tag, defaultBody) { return propagateTemplateSectionAdd(this, entityKey, cleanTitle, tag, defaultBody); }

  _propagateTemplateSectionDelete(entityKey, rawKey) { return propagateTemplateSectionDelete(this, entityKey, rawKey); }

  /* ── Inbox (Planner reminders + captures) ── */
  renderInbox(root) { return renderInbox(this, root); }

  _renderProjectTasksSection(root) { return renderProjectTasksSection(this, root); }

  _renderInboxRow(parent, r, bucket) { return renderInboxRow(this, parent, r, bucket); }

  _quickAddTodayTask() { return quickAddTodayTask(this); }

  /* ── Pipeline kanban (deals grouped by stage) ───── */
  renderEntityKanban(root, entityKey, groupBy, groups) { return renderEntityKanban(this, root, entityKey, groupBy, groups); }

  /* Central chart dispatcher — replaces 4 duplicated if-elseif blocks at call sites. */
  _drawChart(parent, style, data) { return drawChart(this, parent, style, data); }

  _drawChartEmpty(parent) { return drawChartEmpty(this, parent); }

  _drawDonutChart(parent, data) { return drawDonutChart(this, parent, data); }

  _drawBarChart(parent, data) { return drawBarChart(this, parent, data); }

  _drawKpiGrid(parent, data) { return drawKpiGrid(this, parent, data); }

  _drawSimpleList(parent, data) { return drawSimpleList(this, parent, data); }

  /* ── Projects Dashboard ─────────────────── */
  renderProjectsDashboard(root) { return renderProjectsDashboard(this, root); }

  /* ── CRM Dashboard ──────────────────────── */
  renderDashboard(root) { return renderCrmDashboard(this, root); }

  /* Reusable list card on the dashboard. */
  _dashCardSection(parent, title, rows, emptyMsg) { return dashCardSection(this, parent, title, rows, emptyMsg); }


  /* ── Reports: Productivity (over daily notes) ── */
  renderProductivity(root) { return renderProductivity(this, root); }

  /* ── Reports: Pipeline (deals breakdown) ──────── */
  renderReportPipeline(root) { return renderReportPipeline(this, root); }

  /* ── Reports: Sales (closed deals) ─────────────── */
  renderReportSales(root) { return renderReportSales(this, root); }

  /* ── Reports: Partners (deals attributed to partners) ─ */
  renderReportPartners(root) { return renderReportPartners(this, root); }

  /* ── Reports: Activity (mix of activity types) ─ */
  renderReportActivity(root) { return renderReportActivity(this, root); }

  /* ── Reports: Relationship Graph ────────── */
  renderReportGraph(root) { return renderReportGraph(this, root); }

  /* ── PRM Analytics ──────────────────────── */
  renderPRMAnalytics(root) { return renderPRMAnalytics(this, root); }

  /* ── Team (contacts where role contains "team") ─ */
  renderTeam(root) { return renderTeam(this, root); }

  /* ── Settings (opens Obsidian settings → Cadence) ─ */
  openSettingsTab(root) { return openSettingsTab(this, root); }

  /* ── Task completion propagation ──
     When a task is ticked or unticked anywhere, mirror the state to:
       - matching reminders by text (and via reminder.project to the linked project)
       - matching task lines in today's daily note + the linked reminder's date note
     Match is by exact (trimmed) task text. Renaming a task breaks the link. */
  _propagateTaskComplete(text, done, source) { return propagateTaskComplete(this, text, done, source); }

  _tickProjectTaskByText(file, text, done) { return tickProjectTaskByText(this, file, text, done); }

  _tickDailyNoteTaskByText(file, text, done) { return tickDailyNoteTaskByText(this, file, text, done); }

  /* ── Cadence-styled prompt modal ─ */
  _prompt(opts) { return openPrompt(this, opts); }

  _createEntityFromPrompt(entityKey, defaults) { return createEntityFromPrompt(this, entityKey, defaults); }

  /* ── Today pane ─────────────────────────── */
  renderTodayPane(root) { return renderTodayPane(this, root); }

  toggleTodayTask(idx, checked) { return toggleTodayTask(this, idx, checked); }

  appendTodayTask(text) { return appendTodayTask(this, text); }

  saveTodayJournal(body) { return saveTodayJournal(this, body); }

  /* ── Planner pane ───────────────────────── */
  renderPlannerPane(root) { return renderPlannerPane(this, root); }

  togglePlannerTask(day, idx, checked) { return togglePlannerTask(this, day, idx, checked); }

  async onClose() { /* nothing */ }
}

/* ─────────── The plugin ─────────── */
class CadencePlugin extends obsidian.Plugin {
  async onload() {
    await this.loadSettings();

    // Ensure property types are strictly recognized in Obsidian
    this.app.workspace.onLayoutReady(async () => {
      this.registerCustomPropertyTypes();
      await ensureDefaultTemplates(this.app);
    });

    this.registerView(
      VIEW_TYPE_CADENCE_APP,
      (leaf) => new CadenceAppView(leaf, this)
    );

    // Single ribbon icon → opens the Cadence app
    this.addRibbonIcon('sparkles', 'Open Cadence', () => this.openApp());

    this.addCommand({
      id: 'open-cadence',
      name: 'Open Cadence',
      callback: () => this.openApp(),
    });
    this.addCommand({
      id: 'open-cadence-home',
      name: 'Open Cadence — Home (command centre)',
      callback: () => this.openApp('home'),
    });
    this.addCommand({
      id: 'open-cadence-today',
      name: 'Open Cadence — Today',
      callback: () => this.openApp('planner.today'),
    });
    this.addCommand({
      id: 'open-cadence-calendar',
      name: 'Open Cadence — Calendar (week)',
      callback: () => this.openApp('planner.calendar'),
    });
    this.addCommand({
      id: 'open-cadence-pipeline',
      name: 'Open Cadence — Pipeline',
      callback: () => this.openApp('crm.pipeline'),
    });
    this.addCommand({
      id: 'new-daily-entry',
      name: 'New today entry (creates if missing)',
      callback: async () => {
        const file = await ensureDailyNote(this.app, this.settings);
        this.app.workspace.openLinkText(file.path, '', false);
      },
    });

    this.addSettingTab(new CadenceSettingTab(this.app, this));

    // ─── Quick capture (with optional reminder) ───
    this.addRibbonIcon('plus-circle', 'Cadence quick capture', () => this.openQuickCapture());
    this.addCommand({
      id: 'quick-capture',
      name: 'Quick capture (with optional reminder)',
      hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'i' }],
      callback: () => this.openQuickCapture(),
    });
    this.addCommand({
      id: 'open-cadence-inbox',
      name: 'Open Cadence — Inbox',
      callback: () => this.openApp('planner.inbox'),
    });

    this.addCommand({
      id: 'cadence-import-csv',
      name: 'Import from CSV',
      callback: () => {
        // Default to whichever entity list the user is on, fallback to contact
        let entityKey = 'contact';
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CADENCE_APP)[0];
        if (leaf && leaf.view) {
          const m = String(leaf.view.mode || '');
          if (m === 'crm.contacts') entityKey = 'contact';
          else if (m === 'crm.companies') entityKey = 'company';
          else if (m === 'crm.activities') entityKey = 'activity';
          else if (m === 'crm.pipeline') entityKey = 'deal';
          else if (m === 'prm.partners') entityKey = 'partner';
          else if (m === 'prm.registrations') entityKey = 'registration';
          else if (m === 'prm.commissions') entityKey = 'commission';
          else if (m === 'prm.leads') entityKey = 'lead';
          else if (m === 'prm.certifications') entityKey = 'certification';
          else if (m === 'workflow.sequences') entityKey = 'sequence';
          else if (m === 'projects.projects') entityKey = 'project';
        }
        new CadenceImportModal(this.app, { entityKey }).open();
      },
    });

    // ─── Reminders engine ───
    // Tick once on load (catches anything that fired while Obsidian was closed),
    // then every 30s.
    this.app.workspace.onLayoutReady(() => this.tickReminders());
    this.registerInterval(window.setInterval(() => this.tickReminders(), 30 * 1000));

    // Optional: open Cadence Home on Obsidian startup.
    if (this.settings.openOnStartup) {
      this.app.workspace.onLayoutReady(() => this.openApp('home'));
    }

    // ─── Contact-Project Sync ───
    this._syncInProgress = false;
    this.registerEvent(
      this.app.metadataCache.on('changed', async (file) => {
        await this.syncContactProjectRelationships(file);
      })
    );
    this.registerEvent(
      this.app.vault.on('delete', async (file) => {
        await this.handleProjectDeletion(file);
      })
    );
  }

  /* ── Quick capture API ── */
  openQuickCapture(prefill) {
    new CadenceCaptureModal(this.app, {
      defaultText: prefill && prefill.text ? prefill.text : '',
      defaultWhen: prefill && prefill.when ? prefill.when : null,
      defaultRepeat: prefill && prefill.repeat ? prefill.repeat : 'none',
      onSubmit: async (result) => {
        if (!result) return;
        await this.addReminder({
          text: result.text,
          when: result.when,
          repeat: result.repeat || 'none',
        });

        // Also append to the relevant daily note's tasks section.
        // - Scheduled today / unscheduled → today's note
        // - Scheduled future date → that day's note
        const targetDate = result.when ? new Date(result.when) : new Date();
        let noteDate = new Date();
        if (!isNaN(targetDate.getTime())) noteDate = targetDate;
        let dailyNoteAppended = false;
        try {
          const file = await ensureDailyNote(this.app, this.settings, noteDate);
          const content = await this.app.vault.read(file);
          const parsed = parseSections(content, this.settings);
          const newTasks = [...parsed.tasks, `- [ ] ${result.text}`];
          const next = replaceSection(content, this.settings.tasksHeading, newTasks.join('\n'));
          await this.app.vault.modify(file, next);
          dailyNoteAppended = true;
        } catch (_) { /* non-fatal — reminder is still saved */ }

        const noteLabel = sameDay(noteDate, new Date()) ? "today's note" : `${ymd(noteDate)} note`;
        if (result.when) {
          new obsidian.Notice(`Reminder set · ${reminderTimeStr(result.when)}${dailyNoteAppended ? ` · added to ${noteLabel}` : ''}`);
        } else {
          new obsidian.Notice(`Captured to Inbox${dailyNoteAppended ? ` · added to ${noteLabel}` : ''}`);
        }
      },
    }).open();
  }

  /* ── Reminders CRUD ── */
  async addReminder(partial) {
    const r = {
      id: reminderId(),
      text: partial.text,
      when: partial.when || null,
      repeat: partial.repeat || 'none',
      notes: partial.notes || '',
      project: partial.project || null,  // file path of linked project, if any
      notified: false,
      done: false,
      createdAt: new Date().toISOString(),
    };
    if (!Array.isArray(this.settings.reminders)) this.settings.reminders = [];
    this.settings.reminders.push(r);
    await this.saveSettings();
    this.refreshOpenViews();
    return r;
  }

  async updateReminder(id, patch) {
    const i = (this.settings.reminders || []).findIndex((r) => r.id === id);
    if (i < 0) return null;
    this.settings.reminders[i] = Object.assign({}, this.settings.reminders[i], patch);
    await this.saveSettings();
    this.refreshOpenViews();
    return this.settings.reminders[i];
  }

  async deleteReminder(id) {
    this.settings.reminders = (this.settings.reminders || []).filter((r) => r.id !== id);
    await this.saveSettings();
    this.refreshOpenViews();
  }

  async snoozeReminder(id, ms) {
    const target = new Date(Date.now() + ms);
    return this.updateReminder(id, {
      when: target.toISOString(),
      notified: false,
    });
  }

  async completeReminder(id) {
    return this.updateReminder(id, { done: true, notified: true });
  }

  refreshOpenViews() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_CADENCE_APP).forEach((leaf) => {
      if (leaf.view && typeof leaf.view.render === 'function') leaf.view.render();
    });
  }

  /* ── Reminder ticker ── */
  tickReminders() {
    if (!Array.isArray(this.settings.reminders)) return;
    const now = Date.now();
    let dirty = false;
    const additions = [];
    for (const r of this.settings.reminders) {
      if (r.done || r.notified) continue;
      if (!r.when) continue;
      const w = new Date(r.when).getTime();
      if (isNaN(w) || w > now) continue;
      this._fireReminder(r);
      r.notified = true;
      dirty = true;
      const next = nextRepeat(new Date(r.when), r.repeat);
      if (next) {
        additions.push({
          id: reminderId(),
          text: r.text,
          when: next.toISOString(),
          repeat: r.repeat,
          notified: false,
          done: false,
          createdAt: new Date().toISOString(),
        });
      }
    }
    if (additions.length) this.settings.reminders.push(...additions);
    if (dirty) {
      this.saveSettings().then(() => this.refreshOpenViews());
    }
  }

  _fireReminder(r) {
    new obsidian.Notice(`⏰  ${r.text}`, 8000);
    if (this.settings.desktopNotifications && typeof Notification !== 'undefined') {
      try {
        if (Notification.permission === 'granted') {
          new Notification('Cadence reminder', { body: r.text });
        }
      } catch (_) { }
    }
  }

  async openApp(mode = null) {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CADENCE_APP)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE_CADENCE_APP, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    if (leaf.view && typeof leaf.view.setMode === 'function') {
      const target = mode || leaf.view.mode || 'home';
      // Reset week-view anchor to current week when (re)opening that surface
      if (target === 'planner.calendar') leaf.view.plannerAnchor = startOfDay(new Date());
      await leaf.view.setMode(target);
    }
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CADENCE_APP);
  }

  registerCustomPropertyTypes() {
    try {
      if (this.app.metadataTypeManager && typeof this.app.metadataTypeManager.setType === 'function') {
        this.app.metadataTypeManager.setType('type', 'multitext');
        const customKeys = ['project', 'deal', 'contact', 'company', 'activity'];
        for (const key of customKeys) {
          const def = ENTITIES[key];
          if (!def || !def.fields) continue;
          for (const f of def.fields) {
            if (f.primary) {
              this.app.metadataTypeManager.setType(f.key, 'text');
              continue;
            }
            const ftype = f.type || 'text';
            let obsType = 'text';
            if (ftype === 'date') obsType = 'date';
            else if (ftype === 'number' || ftype === 'currency') obsType = 'number';
            else if (ftype === 'tags') obsType = 'tags';
            else if (ftype === 'multitext') obsType = 'multitext';
            else if (f.isList) obsType = 'multitext';

            this.app.metadataTypeManager.setType(f.key, obsType);
          }
        }
      }
    } catch (e) {
      console.warn('Cadence: Failed to register property types', e);
    }
  }

  async loadSettings() {
    const loadedData = await this.loadData() || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

    // Deep default customEntities if missing or empty
    if (!this.settings.customEntities) {
      this.settings.customEntities = {};
    }
    for (const [entityKey, defaultFields] of Object.entries(DEFAULT_SETTINGS.customEntities)) {
      if (!this.settings.customEntities[entityKey] || this.settings.customEntities[entityKey].length === 0) {
        this.settings.customEntities[entityKey] = JSON.parse(JSON.stringify(defaultFields));
      }
    }

    setCurrentCurrency(this.settings.currency || 'USD');

    // Initialize default project dashboard widgets if empty/missing
    if (!this.settings.projectDashboardWidgets || this.settings.projectDashboardWidgets.length === 0) {
      this.settings.projectDashboardWidgets = [
        { id: 'w1', title: 'Projects by Status', groupBy: 'status', style: 'donut' },
        { id: 'w2', title: 'Projects by Priority', groupBy: 'priority', style: 'bar' }
      ];
    }
    if (!this.settings.crmDashboardWidgets || this.settings.crmDashboardWidgets.length === 0) {
      this.settings.crmDashboardWidgets = [
        { id: 'c1', title: 'Deals by Stage', groupBy: 'stage', style: 'donut' },
        { id: 'c2', title: 'Deals by Owner', groupBy: 'owner', style: 'bar' }
      ];
    }
    if (!this.settings.prmDashboardWidgets || this.settings.prmDashboardWidgets.length === 0) {
      this.settings.prmDashboardWidgets = [
        { id: 'p1', title: 'Partners by Tier', groupBy: 'tier', style: 'donut' },
        { id: 'p2', title: 'Partners by Status', groupBy: 'status', style: 'bar' }
      ];
    }

    // Clean up any orphan custom entities that have no matching custom page
    const coreEntityKeys = ['contact', 'company', 'partner', 'registration', 'commission', 'lead', 'certification', 'activity', 'sequence', 'project', 'deal'];
    const activeCustomEntityKeys = (this.settings.customPages || []).map(p => p.entityKey);
    for (const entityKey of Object.keys(this.settings.customEntities)) {
      if (!coreEntityKeys.includes(entityKey) && !activeCustomEntityKeys.includes(entityKey)) {
        delete this.settings.customEntities[entityKey];
        if (ENTITIES[entityKey]) {
          delete ENTITIES[entityKey];
        }
      }
    }

    // Reconstruct custom entities from settings
    if (this.settings.customEntities) {
      for (const [entityKey, customFields] of Object.entries(this.settings.customEntities)) {
        if (ENTITIES[entityKey]) {
          ENTITIES[entityKey].fields = customFields;
        } else {
          // Reconstruct dynamic custom entity type
          const customPages = this.settings.customPages || [];
          const customPage = customPages.find(p => p.entityKey === entityKey);

          let label, plural;
          if (customPage) {
            plural = customPage.label;
            if (plural.endsWith('s') && plural.length > 1) {
              label = plural.substring(0, plural.length - 1);
            } else if (plural.endsWith('S') && plural.length > 1) {
              label = plural.substring(0, plural.length - 1);
            } else {
              label = plural;
            }
          } else {
            label = (entityKey === entityKey.toUpperCase()) ? entityKey : (entityKey.charAt(0).toUpperCase() + entityKey.slice(1));
            plural = label + 's';
          }

          ENTITIES[entityKey] = {
            folder: `Cadence/${plural}`,
            label: label,
            plural: plural,
            fields: customFields,
            columns: [customFields[0]?.key || 'name']
          };
        }
      }
    }

    // Ensure 'type' field is in customEntities and ENTITIES fields (except activity)
    for (const [entityKey, def] of Object.entries(ENTITIES)) {
      if (entityKey === 'activity') continue;

      const hasType = def.fields.some(f => f.key === 'type');
      if (!hasType) {
        def.fields.push({
          key: 'type',
          label: 'Type',
          type: 'text'
        });
      }

      // Also ensure it is in the settings' customEntities fields
      if (this.settings.customEntities[entityKey]) {
        const hasSetType = this.settings.customEntities[entityKey].some(f => f.key === 'type');
        if (!hasSetType) {
          this.settings.customEntities[entityKey].push({
            key: 'type',
            label: 'Type',
            type: 'text'
          });
        }
      }
    }
  }

  async syncContactProjectRelationships(changedFile) {
    if (this._syncInProgress) return;
    if (!changedFile || !changedFile.path.toLowerCase().endsWith('.md')) return;

    // Check if file still exists in vault before continuing!
    if (!this.app.vault.getAbstractFileByPath(changedFile.path)) return;

    try {
      this._syncInProgress = true;

      // 1. Get all contact files and project files
      const contactFiles = listEntityFiles(this.app, 'contact');
      const projectFiles = listEntityFiles(this.app, 'project');

      const contactMap = new Map();
      for (const f of contactFiles) {
        contactMap.set(f.basename.toLowerCase(), f);
      }

      const projectMap = new Map();
      for (const f of projectFiles) {
        projectMap.set(f.basename.toLowerCase(), f);
      }

      // Helper to extract names from frontmatter values
      const extractEntitiesFromValue = (value) => {
        if (value == null) return [];
        const results = [];
        const processStr = (str) => {
          str = String(str).trim();
          if (!str) return;
          if (str.includes('[[')) {
            const regex = /\[\[(.*?)\]\]/g;
            let match;
            while ((match = regex.exec(str)) !== null) {
              let target = match[1].trim();
              if (target.includes('|')) {
                target = target.split('|')[0].trim();
              }
              if (target) results.push(target);
            }
          } else if (str.includes(',')) {
            str.split(',').forEach(s => {
              const item = s.trim();
              if (item) results.push(item);
            });
          } else {
            results.push(str);
          }
        };
        if (Array.isArray(value)) {
          value.forEach(val => processStr(val));
        } else {
          processStr(value);
        }
        return results;
      };

      const isContactField = (key, ek) => {
        if (['owner', 'contact', 'contacts', 'with', 'assigned'].includes(key.toLowerCase())) return true;
        if (ek && ENTITIES[ek]) {
          const fdef = ENTITIES[ek].fields.find(field => field.key === key);
          if (fdef) {
            const sug = fdef.suggestionSource || getFieldSuggestionSource(fdef);
            if (sug === 'contact' || sug === 'folder:Cadence/Contacts') return true;
          }
        }
        return false;
      };

      const isProjectField = (key, ek) => {
        if (['project', 'projects', 'related'].includes(key.toLowerCase())) return true;
        if (ek && ENTITIES[ek]) {
          const fdef = ENTITIES[ek].fields.find(field => field.key === key);
          if (fdef) {
            const sug = fdef.suggestionSource || getFieldSuggestionSource(fdef);
            if (sug === 'project' || sug === 'folder:Cadence/Projects') return true;
          }
        }
        return false;
      };

      const changedEntityKey = entityKeyFromFile(this.app, changedFile);

      if (changedEntityKey === 'contact') {
        const contactLower = changedFile.basename.toLowerCase();
        const contactCache = this.app.metadataCache.getFileCache(changedFile) || {};
        const contactFm = contactCache.frontmatter || {};
        const existingProjectsVal = contactFm.project;
        const currentProjectsOfContact = new Set(
          extractEntitiesFromValue(existingProjectsVal).map(p => p.toLowerCase())
        );

        // Auto-create any projects in contact sheet that do not exist yet
        for (const p of currentProjectsOfContact) {
          if (!projectMap.has(p)) {
            try {
              const allFiles = this.app.vault.getMarkdownFiles();
              const originalName = allFiles.find(f => f.basename.toLowerCase() === p)?.basename || (p.charAt(0).toUpperCase() + p.slice(1));
              const projectFile = await createEntity(this.app, 'project', originalName);
              projectMap.set(p, projectFile);
              new obsidian.Notice(`Fiche projet créée automatiquement pour "${originalName}".`);
            } catch (e) {
              console.error(`Cadence: Failed to auto-create project ${p}`, e);
            }
          }
        }

        // We only sync projects to contacts (one-way relationship).
        // Editing a contact sheet does not push the contact name back to project owner fields.
      }
      else if (changedEntityKey === 'project') {
        const projectLower = changedFile.basename.toLowerCase();
        const projectCache = this.app.metadataCache.getFileCache(changedFile) || {};
        const projectFm = projectCache.frontmatter || {};

        const projectContacts = [];
        for (const [key, val] of Object.entries(projectFm)) {
          if (key === 'type') continue;
          if (isContactField(key, 'project')) {
            projectContacts.push(...extractEntitiesFromValue(val));
          }
        }
        const currentContactsOfProject = new Set(projectContacts.map(c => c.toLowerCase()));

        // Auto-create any contacts in project sheet that do not exist yet
        for (const c of currentContactsOfProject) {
          if (!contactMap.has(c)) {
            try {
              const allFiles = this.app.vault.getMarkdownFiles();
              const originalName = allFiles.find(f => f.basename.toLowerCase() === c)?.basename || (c.charAt(0).toUpperCase() + c.slice(1));
              const contactFile = await createEntity(this.app, 'contact', originalName);
              contactMap.set(c, contactFile);
              new obsidian.Notice(`Fiche contact créée automatiquement pour "${originalName}".`);
            } catch (e) {
              console.error(`Cadence: Failed to auto-create contact ${c}`, e);
            }
          }
        }

        // For each contact in the vault, check if they should be linked
        for (const [contactLower, contactFile] of contactMap.entries()) {
          const contactCache = this.app.metadataCache.getFileCache(contactFile) || {};
          const contactFm = contactCache.frontmatter || {};
          const existingProjectsVal = contactFm.project;
          const contactProjects = extractEntitiesFromValue(existingProjectsVal);
          const listsProject = contactProjects.some(p => p.toLowerCase() === projectLower);
          const projectListsContact = currentContactsOfProject.has(contactLower);

          if (projectListsContact && !listsProject) {
            // User manually added contact to project sheet!
            await this.app.fileManager.processFrontMatter(contactFile, (cfm) => {
              const currentProjects = extractEntitiesFromValue(cfm.project);
              if (!currentProjects.some(p => p.toLowerCase() === projectLower)) {
                currentProjects.push(changedFile.basename);
                if (currentProjects.length === 1) {
                  cfm.project = `[[${currentProjects[0]}]]`;
                } else {
                  cfm.project = currentProjects.map(p => `[[${p}]]`);
                }
              }
            });
            new obsidian.Notice(`Lien automatique : Projet "${changedFile.basename}" associé au contact "${contactFile.basename}".`);
          } else if (!projectListsContact && listsProject) {
            // User removed contact from project sheet! Check if there is any other note listing both.
            let hasOtherSource = false;
            const allFiles = this.app.vault.getMarkdownFiles();
            for (const f of allFiles) {
              if (f.path === changedFile.path || f.path === contactFile.path) continue;
              const cache = this.app.metadataCache.getFileCache(f);
              if (!cache || !cache.frontmatter) continue;
              const fm = cache.frontmatter;

              const fEntityKey = entityKeyFromFile(this.app, f);
              const foundContacts = new Set();
              const foundProjects = new Set();

              if (fEntityKey === 'contact') {
                foundContacts.add(f.basename.toLowerCase());
              } else if (fEntityKey === 'project') {
                foundProjects.add(f.basename.toLowerCase());
              }

              for (const [key, val] of Object.entries(fm)) {
                if (key === 'type') continue;
                const extracted = extractEntitiesFromValue(val);
                for (const name of extracted) {
                  if (!name) continue;
                  const nameLower = name.toLowerCase();
                  if (isContactField(key, fEntityKey) || contactMap.has(nameLower)) {
                    foundContacts.add(nameLower);
                  }
                  if (isProjectField(key, fEntityKey) || projectMap.has(nameLower)) {
                    foundProjects.add(nameLower);
                  }
                }
              }

              if (foundContacts.has(contactLower) && foundProjects.has(projectLower)) {
                hasOtherSource = true;
                break;
              }
            }

            if (!hasOtherSource) {
              await this.app.fileManager.processFrontMatter(contactFile, (cfm) => {
                const currentProjects = extractEntitiesFromValue(cfm.project);
                const newProjects = currentProjects.filter(p => p.toLowerCase() !== projectLower);
                if (newProjects.length === 0) {
                  delete cfm.project;
                } else if (newProjects.length === 1) {
                  cfm.project = `[[${newProjects[0]}]]`;
                } else {
                  cfm.project = newProjects.map(p => `[[${p}]]`);
                }
              });
              new obsidian.Notice(`Lien automatique : Projet "${changedFile.basename}" dissocié du contact "${contactFile.basename}".`);
            }
          }
        }
      }
      else {
        // Vault-wide scan to build the set of valid contact-project links.
        // We exclude Contact sheets as relationship sources to prevent self-reinforcing loops.
        const validLinks = new Set(); // "contact_lowercase|project_lowercase"

        const allFiles = this.app.vault.getMarkdownFiles();
        for (const f of allFiles) {
          const fEntityKey = entityKeyFromFile(this.app, f);
          if (fEntityKey === 'contact') continue;

          const cache = this.app.metadataCache.getFileCache(f);
          if (!cache || !cache.frontmatter) continue;
          const fm = cache.frontmatter;

          const foundContacts = new Set();
          const foundProjects = new Set();

          if (fEntityKey === 'project') {
            foundProjects.add(f.basename.toLowerCase());
          }

          for (const [key, val] of Object.entries(fm)) {
            if (key === 'type') continue;
            const extracted = extractEntitiesFromValue(val);
            for (const name of extracted) {
              if (!name) continue;
              const nameLower = name.toLowerCase();
              if (isContactField(key, fEntityKey) || contactMap.has(nameLower)) {
                foundContacts.add(nameLower);
              }
              if (isProjectField(key, fEntityKey) || projectMap.has(nameLower)) {
                foundProjects.add(nameLower);
              }
            }
          }

          if (foundContacts.size > 0 && foundProjects.size > 0) {
            for (const c of foundContacts) {
              for (const p of foundProjects) {
                validLinks.add(`${c}|${p}`);
              }
            }
          }
        }

        // Auto-create any referenced Contacts or Projects that do not exist yet
        for (const link of validLinks) {
          const [c, p] = link.split('|');

          let contactFile = contactMap.get(c);
          if (!contactFile) {
            try {
              const originalName = allFiles.find(f => f.basename.toLowerCase() === c)?.basename || (c.charAt(0).toUpperCase() + c.slice(1));
              contactFile = await createEntity(this.app, 'contact', originalName);
              contactMap.set(c, contactFile);
              new obsidian.Notice(`Fiche contact créée automatiquement pour "${originalName}".`);
            } catch (e) {
              console.error(`Cadence: Failed to auto-create contact ${c}`, e);
            }
          }

          let projectFile = projectMap.get(p);
          if (!projectFile) {
            try {
              const originalName = allFiles.find(f => f.basename.toLowerCase() === p)?.basename || (p.charAt(0).toUpperCase() + p.slice(1));
              projectFile = await createEntity(this.app, 'project', originalName);
              projectMap.set(p, projectFile);
              new obsidian.Notice(`Fiche projet créée automatiquement pour "${originalName}".`);
            } catch (e) {
              console.error(`Cadence: Failed to auto-create project ${p}`, e);
            }
          }
        }

        // Sync all Contacts according to validLinks
        for (const [contactLower, contactFile] of contactMap.entries()) {
          const contactCache = this.app.metadataCache.getFileCache(contactFile) || {};
          const contactFm = contactCache.frontmatter || {};
          const existingProjectsVal = contactFm.project;
          const existingProjects = extractEntitiesFromValue(existingProjectsVal);

          const projectNamesToLink = new Set();
          for (const link of validLinks) {
            const [c, p] = link.split('|');
            if (c === contactLower) {
              const pFile = projectMap.get(p);
              if (pFile) {
                projectNamesToLink.add(pFile.basename);
              }
            }
          }

          const existingLower = existingProjects.map(p => p.toLowerCase());
          const targetLower = Array.from(projectNamesToLink).map(p => p.toLowerCase());

          let needsUpdate = false;
          for (const p of existingLower) {
            if (!targetLower.includes(p)) {
              needsUpdate = true;
              break;
            }
          }
          for (const p of targetLower) {
            if (!existingLower.includes(p)) {
              needsUpdate = true;
              break;
            }
          }

          if (needsUpdate) {
            const sortedProjects = Array.from(projectNamesToLink);
            const formattedVal = sortedProjects.length === 0
              ? null
              : (sortedProjects.length === 1
                ? `[[${sortedProjects[0]}]]`
                : sortedProjects.map(p => `[[${p}]]`)
              );

            await this.app.fileManager.processFrontMatter(contactFile, (cfm) => {
              if (formattedVal === null) {
                delete cfm.project;
              } else {
                cfm.project = formattedVal;
              }
            });

            const added = sortedProjects.filter(p => !existingProjects.some(ep => ep.toLowerCase() === p.toLowerCase()));
            const removed = existingProjects.filter(ep => !sortedProjects.some(p => p.toLowerCase() === ep.toLowerCase()));

            if (added.length > 0) {
              new obsidian.Notice(`Lien automatique : Projet "${added.join(', ')}" associé à "${contactFile.basename}".`);
            }
            if (removed.length > 0) {
              new obsidian.Notice(`Lien automatique : Projet "${removed.join(', ')}" dissocié de "${contactFile.basename}".`);
            }
          }
        }

        // We only sync projects to contacts (one-way relationship).
        // The project's owner field is not automatically updated by same-file or contact references.
      }
    } catch (e) {
      console.error('Cadence: Error in syncContactProjectRelationships', e);
    } finally {
      this._syncInProgress = false;
    }
  }

  async handleProjectDeletion(file) {
    if (this._syncInProgress) return;
    if (!file || !file.path || !file.path.toLowerCase().endsWith('.md')) return;

    // Check if the deleted file was inside the Projects folder
    const projectFolder = ENTITIES.project ? ENTITIES.project.folder : 'Cadence/Projects';
    if (!file.path.startsWith(projectFolder + '/')) return;

    const projectName = file.basename;
    if (!projectName) return;

    try {
      this._syncInProgress = true;

      // Load all contact files
      const contactFiles = listEntityFiles(this.app, 'contact');

      // Helper to extract names
      const extractEntitiesFromValue = (value) => {
        if (value == null) return [];
        const results = [];
        const processStr = (str) => {
          str = String(str).trim();
          if (!str) return;
          if (str.includes('[[')) {
            const regex = /\[\[(.*?)\]\]/g;
            let match;
            while ((match = regex.exec(str)) !== null) {
              let target = match[1].trim();
              if (target.includes('|')) {
                target = target.split('|')[0].trim();
              }
              if (target) results.push(target);
            }
          } else if (str.includes(',')) {
            str.split(',').forEach(s => {
              const item = s.trim();
              if (item) results.push(item);
            });
          } else {
            results.push(str);
          }
        };
        if (Array.isArray(value)) {
          value.forEach(val => processStr(val));
        } else {
          processStr(value);
        }
        return results;
      };

      for (const contactFile of contactFiles) {
        const contactCache = this.app.metadataCache.getFileCache(contactFile) || {};
        const contactFm = contactCache.frontmatter || {};
        const existingProjectsVal = contactFm.project;
        if (!existingProjectsVal) continue;

        const existingProjectNames = extractEntitiesFromValue(existingProjectsVal);
        const hasProject = existingProjectNames.some(p => p.toLowerCase() === projectName.toLowerCase());

        if (hasProject) {
          const remainingProjects = existingProjectNames.filter(p => p.toLowerCase() !== projectName.toLowerCase());

          await this.app.fileManager.processFrontMatter(contactFile, (cfm) => {
            if (remainingProjects.length === 0) {
              delete cfm.project;
            } else if (remainingProjects.length === 1) {
              cfm.project = `[[${remainingProjects[0]}]]`;
            } else {
              cfm.project = remainingProjects.map(p => `[[${p}]]`);
            }
          });

          new obsidian.Notice(`Lien automatique : Projet "${projectName}" supprimé du contact "${contactFile.basename}".`);
        }
      }
    } catch (e) {
      console.error('Cadence: Error in handleProjectDeletion', e);
    } finally {
      this._syncInProgress = false;
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    setCurrentCurrency(this.settings.currency || 'USD');
  }
}

export { CadencePlugin, CadenceAppView, CadenceSettingTab };
