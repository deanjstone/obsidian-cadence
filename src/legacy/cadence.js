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
import { findProjectTaskReminder, reminderBucket, reminderTimeStr } from '../utils/reminders';
import { DEAL_STAGES } from '../constants/entities';
import { ALL_SURFACES, BUILT_SURFACES, NAV_GROUPS, SURFACE_BY_ID, VIEW_TYPE_CADENCE_APP } from '../constants/nav';
import { ensureDailyNote } from '../utils/daily-notes';
import {
  entityValue, getDealStages, getEnumOptions,
  listEntities, migrateFrontmatterKey, migrateFrontmatterType, projectNameFromPath,
  readEntity, readProjectMeta,
} from '../utils/entities';
import { fmtValue, pctBand } from '../utils/format';
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
import { addReminder, completeReminder, deleteReminder, fireReminder, snoozeReminder, tickReminders, updateReminder } from '../plugin/reminders-engine';
import { loadSettings, registerCustomPropertyTypes, saveSettings } from '../plugin/settings';
import { handleProjectDeletion, syncContactProjectRelationships } from '../plugin/contact-project-sync';
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
  addReminder(partial) { return addReminder(this, partial); }
  updateReminder(id, patch) { return updateReminder(this, id, patch); }
  deleteReminder(id) { return deleteReminder(this, id); }
  snoozeReminder(id, ms) { return snoozeReminder(this, id, ms); }
  completeReminder(id) { return completeReminder(this, id); }

  refreshOpenViews() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_CADENCE_APP).forEach((leaf) => {
      if (leaf.view && typeof leaf.view.render === 'function') leaf.view.render();
    });
  }

  /* ── Reminder ticker ── */
  tickReminders() { return tickReminders(this); }
  _fireReminder(r) { return fireReminder(this, r); }

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

  registerCustomPropertyTypes() { return registerCustomPropertyTypes(this); }
  loadSettings() { return loadSettings(this); }
  syncContactProjectRelationships(changedFile) { return syncContactProjectRelationships(this, changedFile); }
  handleProjectDeletion(file) { return handleProjectDeletion(this, file); }
  saveSettings() { return saveSettings(this); }

}

export { CadencePlugin, CadenceAppView, CadenceSettingTab };
