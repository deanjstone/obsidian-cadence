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


const CURRENCY_OPTIONS = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'ZAR', label: 'ZAR — South African Rand' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'CHF', label: 'CHF — Swiss Franc' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'BRL', label: 'BRL — Brazilian Real' },
  { code: 'AED', label: 'AED — UAE Dirham' },
];









































/* ─────────── The unified Cadence app view ─────────── */
class CadenceAppView extends obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    // Migrate legacy mode IDs from older versions
    const raw = plugin.settings.defaultTab || 'planner.today';
    this.mode = this._migrateModeId(raw);
    // Today state
    this.todayFile = null;
    this.todayParsed = null;
    this._journalSaveTimer = null;
    // Planner state
    this.plannerAnchor = startOfDay(new Date());
    // Detail-view state — when set, renders the entity form instead of the surface
    this.detailFile = null;
    this.detailEntityKey = null;
    // Mobile nav drawer state (ephemeral, not persisted)
    this.mobileNavOpen = false;
  }

  _toggleMobileNav(force) {
    const root = this.containerEl.children[1];
    this.mobileNavOpen = (typeof force === 'boolean') ? force : !this.mobileNavOpen;
    if (root) root.toggleClass('cad-mobile-nav-open', this.mobileNavOpen);
  }

  async openEntityDetail(entityKey, file) {
    if (!file || !entityKey) return;
    this.detailEntityKey = entityKey;
    this.detailFile = file;
    await this.render();
  }

  async openTemplateDetail(entityKey, file) {
    if (!file || !entityKey) return;
    this.detailEntityKey = 'template:' + entityKey;
    this.detailFile = file;
    await this.render();
  }

  async openEntityDetailFromFile(file) {
    const key = entityKeyFromFile(this.app, file);
    if (!key) {
      // Not a Cadence entity — fall back to opening the markdown
      this.app.workspace.openLinkText(file.path, '', false);
      return;
    }
    return this.openEntityDetail(key, file);
  }

  async closeEntityDetail() {
    this.detailFile = null;
    this.detailEntityKey = null;
    await this.render();
  }

  _migrateModeId(id) {
    if (id === 'today') return 'planner.today';
    if (id === 'planner') return 'planner.calendar';
    const customPages = this.plugin.settings.customPages || [];
    if (customPages.some(p => p.id === id)) return id;
    return SURFACE_BY_ID[id] ? id : 'home';
  }

  _resolveSurface(id) {
    const customPages = this.plugin.settings.customPages || [];
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

  getEntityKanbanParams(entityKey) {
    const def = ENTITIES[entityKey];
    if (!def) return { groupBy: 'status', groups: ['Active', 'Done'] };

    let groupBy = this.plugin.settings.pageKanbanGroupBy?.[entityKey];

    if (!groupBy) {
      const fallbackField = def.fields.find(field => !field.primary && ['enum', 'text'].includes(field.type));
      groupBy = fallbackField ? fallbackField.key : 'status';
      if (entityKey === 'deal') groupBy = 'stage';
      else if (entityKey === 'activity') groupBy = 'type';
    }

    let f = def.fields.find(field => field.key === groupBy);
    let groups = f ? (f.options || []) : [];

    if (!groups.length) {
      const allFiles = listEntities(this.app, entityKey);
      const uniqueVals = new Set();
      allFiles.forEach(e => {
        const val = entityValue(e, groupBy, def);
        if (val) {
          const parts = Array.isArray(val) ? val : String(val).split(',');
          parts.forEach(v => {
            const clean = String(v).replace(/^\[\[|\]\]$/g, '').trim();
            if (clean) uniqueVals.add(clean);
          });
        }
      });
      groups = Array.from(uniqueVals);
      if (!groups.length) {
        groups = ['To Do', 'In Progress', 'Done'];
      }
    }
    return { groupBy, groups };
  }

  /* Toggle Cadence-app dark mode. Scoped to `.cadence-app` only —
     does not affect Obsidian's overall light/dark mode. Persisted in settings. */
  async _toggleCadenceDark() {
    this.plugin.settings.cadenceAppDark = !this.plugin.settings.cadenceAppDark;
    await this.plugin.saveSettings();
    this.render();
  }

  _visibleNavGroups() {
    const mods = this.plugin.settings.modules || { crm: true, prm: true, planner: true, projects: true };
    const groups = JSON.parse(JSON.stringify(NAV_GROUPS));

    // Inject custom pages
    const customPages = this.plugin.settings.customPages || [];
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
      .filter(Boolean);
  }

  /* Link a daily-note task to a project. Keyed by (dailyPath, taskText). */
  _taskLinkKey(dailyPath, text) { return `${dailyPath}::${(text || '').trim()}`; }

  _getTaskProjectLink(dailyPath, text) {
    const map = (this.plugin.settings && this.plugin.settings.taskProjectLinks) || {};
    return map[this._taskLinkKey(dailyPath, text)] || null;
  }

  async _setTaskProjectLink(dailyPath, text, projectPath) {
    if (!this.plugin.settings.taskProjectLinks) this.plugin.settings.taskProjectLinks = {};
    const key = this._taskLinkKey(dailyPath, text);
    if (projectPath) {
      this.plugin.settings.taskProjectLinks[key] = projectPath;
    } else {
      delete this.plugin.settings.taskProjectLinks[key];
    }
    await this.plugin.saveSettings();
    this.render();
  }

  _openTaskProjectPicker(dailyPath, text, currentLink) {
    const projectFiles = listEntityFiles(this.app, 'project');
    if (!projectFiles.length) {
      new obsidian.Notice('No projects yet. Create one in Planner → Projects first.');
      return;
    }
    const view = this;
    const projects = projectFiles.map((f) => ({
      file: f,
      name: projectNameFromPath(this.app, f.path),
    }));

    const picker = new (class extends obsidian.SuggestModal {
      constructor(app, projs, hasLink) {
        super(app);
        this.projs = projs;
        this.hasLink = hasLink;
        this.setPlaceholder(hasLink ? 'Pick a project (or type "unlink" to remove)' : 'Pick a project to link this task to');
      }
      getSuggestions(query) {
        const q = (query || '').toLowerCase();
        const matches = this.projs.filter((p) => p.name.toLowerCase().includes(q));
        if (this.hasLink && (q === '' || 'unlink'.includes(q))) {
          return [{ unlink: true, name: '— Remove link —' }, ...matches];
        }
        return matches;
      }
      renderSuggestion(item, el) {
        if (item.unlink) {
          el.setText(item.name);
          el.style.color = 'var(--text-error, #c0392b)';
        } else {
          el.setText('📁  ' + item.name);
        }
      }
      onChooseSuggestion(item) {
        if (item.unlink) view._setTaskProjectLink(dailyPath, text, null);
        else view._setTaskProjectLink(dailyPath, text, item.file.path);
      }
    })(this.app, projects, !!currentLink);
    picker.open();
  }

  _inboxOverdueCount() {
    const reminders = (this.plugin.settings.reminders || []).filter((r) => !r.done);
    const now = Date.now();
    return reminders.filter((r) => r.when && new Date(r.when).getTime() <= now).length;
  }

  getViewType() { return VIEW_TYPE_CADENCE_APP; }
  getDisplayText() { return 'Cadence'; }
  getIcon() { return 'sparkles'; }

  async setMode(m) {
    this.mode = this._migrateModeId(m);
    // Switching surfaces clears any open detail form
    this.detailFile = null;
    this.detailEntityKey = null;
    await this.render();
  }

  async toggleGroup(groupId) {
    const collapsed = this.plugin.settings.collapsedGroups || {};
    collapsed[groupId] = !collapsed[groupId];
    this.plugin.settings.collapsedGroups = collapsed;
    await this.plugin.saveSettings();
    await this.render();
  }

  async onOpen() {
    this.containerEl.children[1].empty();
    await this.render();

    // Listen to live editor changes to dynamically update Cadence views as you type
    this.registerEvent(this.app.workspace.on('editor-change', (editor, info) => {
      const file = info.file;
      if (!file) return;

      let shouldRender = false;
      if (this.detailFile && file.path === this.detailFile.path) {
        shouldRender = true;
      } else if (this.mode === 'planner.today' && this.todayFile && file.path === this.todayFile.path) {
        shouldRender = true;
      }

      if (shouldRender) {
        if (this._liveRenderTimer) clearTimeout(this._liveRenderTimer);
        this._liveRenderTimer = setTimeout(() => {
          this.render();
        }, 300);
      }
    }));

    this.registerEvent(this.app.vault.on('modify', (file) => {
      if (this.detailFile && file && file.path === this.detailFile.path) {
        // Skip refresh only if active focus is inside our view leaf to prevent stealing input focus
        if (this.app.workspace.getActiveLeaf() === this.leaf) return;
        return this.render();
      }
      if (this.mode === 'planner.today' && this.todayFile && file.path === this.todayFile.path) {
        return this.render();
      }
      if (this.mode === 'planner.calendar') {
        const days = weekDates(this.plannerAnchor, this.plugin.settings.weekStartsOn);
        const paths = days.map((d) => dailyNotePath(this.plugin.settings, d));
        if (paths.includes(file.path)) return this.render();
      }
      if (this._modeUsesEntityFolder(file.path)) return this.render();
    }));

    const entityRefresh = (file) => {
      if (this.detailFile && file && file.path === this.detailFile.path) return;
      if (this._modeUsesEntityFolder(file && file.path)) this.render();
    };
    this.registerEvent(this.app.vault.on('create', entityRefresh));
    this.registerEvent(this.app.vault.on('delete', (file) => {
      if (this.detailFile && file && file.path === this.detailFile.path) {
        this.closeEntityDetail();
        return;
      }
      entityRefresh(file);
    }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      if (this.detailFile && file && file.path === this.detailFile.path) return;
      if (this._modeUsesEntityFolder(file && file.path) || this._modeUsesEntityFolder(oldPath)) this.render();
    }));
    this.registerEvent(this.app.metadataCache.on('changed', (file) => {
      if (this.detailFile && file && file.path === this.detailFile.path) {
        if (this.app.workspace.getActiveLeaf() === this.leaf) return;
        return this.render();
      }
      if (this._modeUsesEntityFolder(file && file.path)) this.render();
    }));

    // Auto-refresh when user clicks back onto the Cadence pane
    this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
      if (leaf === this.leaf) {
        this.render();
      }
    }));
  }

  _modeUsesEntityFolder(path) {
    if (!path) return false;
    // Most surfaces read entity folders; refresh whenever a touched file
    // sits under any Cadence/* folder. Cheap enough.
    return path.startsWith('Cadence/');
  }

  async render() {
    if (this._isRendering) {
      this._needsRenderAgain = true;
      return;
    }
    this._isRendering = true;
    this._needsRenderAgain = false;
    try {
      const root = this.containerEl.children[1];
      root.empty();
      root.addClass('cadence-app');
      root.toggleClass('cad-dark', !!this.plugin.settings.cadenceAppDark);

    const active = this._resolveSurface(this.mode) || SURFACE_BY_ID['planner.today'];

    /* ── Top brand bar ──────────────────────── */
    const topbar = root.createDiv({ cls: 'cad-app-topbar' });

    /* Hamburger — visible only on mobile via CSS, toggles the nav drawer */
    const burger = topbar.createEl('button', { cls: 'cad-mobile-burger' });
    try { obsidian.setIcon(burger, 'menu'); } catch (_) { }
    burger.title = 'Show nav';
    burger.addEventListener('click', () => this._toggleMobileNav());

    const brand = topbar.createDiv({ cls: 'cad-app-brand' });
    brand.createSpan({ cls: 'cad-app-brand-mark', text: '◐' });
    brand.createSpan({ cls: 'cad-app-brand-text', text: 'Cadence' });

    const topRight = topbar.createDiv({ cls: 'cad-app-topbar-right' });

    /* Cadence-app dark mode toggle (scoped — does NOT touch Obsidian's mode) */
    const dark = !!this.plugin.settings.cadenceAppDark;
    const themeBtn = topRight.createEl('button', { cls: 'cad-topbar-icon-btn' });
    try { obsidian.setIcon(themeBtn, dark ? 'sun' : 'moon'); } catch (_) { }
    themeBtn.title = dark ? 'Cadence: switch to light' : 'Cadence: switch to dark';
    themeBtn.addEventListener('click', () => this._toggleCadenceDark());

    const eyebrow = topRight.createDiv({ cls: 'cad-app-topbar-meta' });
    eyebrow.setText(active.label.toUpperCase());

    /* ── Body: left grouped nav + main content ──────── */
    const body = root.createDiv({ cls: 'cad-app-body' });

    /* Backdrop — only visible on mobile when drawer is open; tapping dismisses. */
    const backdrop = body.createDiv({ cls: 'cad-mobile-backdrop' });
    backdrop.addEventListener('click', () => this._toggleMobileNav(false));

    const nav = body.createDiv({ cls: 'cad-app-nav' });
    const collapsed = this.plugin.settings.collapsedGroups || {};

    const visibleGroups = this._visibleNavGroups();
    visibleGroups.forEach((group) => {
      const groupEl = nav.createDiv({ cls: 'cad-nav-group' });
      const isCollapsed = !!collapsed[group.id];

      if (group.label) {
        const head = groupEl.createDiv({ cls: 'cad-nav-group-head' });
        const chev = head.createSpan({ cls: 'cad-nav-group-chev' });
        try { obsidian.setIcon(chev, isCollapsed ? 'chevron-right' : 'chevron-down'); } catch (_) { }
        head.createSpan({ cls: 'cad-nav-group-label', text: group.label.toUpperCase() });
        head.addEventListener('click', () => this.toggleGroup(group.id));
      }

      if (!isCollapsed || !group.label) {
        const list = groupEl.createDiv({ cls: 'cad-nav-group-items' });
        group.items.forEach((s) => {
          const item = list.createDiv({
            cls: 'cad-app-nav-item' + (this.mode === s.id ? ' active' : ''),
          });
          const ic = item.createSpan({ cls: 'cad-app-nav-icon' });
          try { obsidian.setIcon(ic, s.icon); } catch (_) { }
          item.createSpan({ cls: 'cad-app-nav-label', text: s.label });
          if (!BUILT_SURFACES.has(s.id) && !s.id.startsWith('custom.')) {
            item.createSpan({ cls: 'cad-app-nav-badge', text: 'soon' });
          }
          // Inbox: badge with overdue count
          if (s.id === 'planner.inbox') {
            const overdue = this._inboxOverdueCount();
            if (overdue > 0) item.createSpan({ cls: 'cad-app-nav-badge cad-nav-badge-alert', text: String(overdue) });
          }
          item.addEventListener('click', () => {
            this.setMode(s.id);
            // On mobile, picking a nav item closes the drawer.
            if (this.mobileNavOpen) this._toggleMobileNav(false);
          });
        });
      }
    });

    const content = body.createDiv({ cls: 'cad-app-content' });

    // Detail view trumps the normal surface routing
    if (this.detailFile && this.detailEntityKey) {
      // Check if file still exists in vault to prevent crashing on deleted files
      const exists = this.app.vault.getAbstractFileByPath(this.detailFile.path);
      if (!exists) {
        this.detailFile = null;
        this.detailEntityKey = null;
      } else {
        try {
          if (this.detailEntityKey.startsWith('template:')) {
            const entityKey = this.detailEntityKey.slice('template:'.length);
            await this.renderTemplateDetail(content, entityKey, this.detailFile);
          } else {
            await this.renderEntityDetail(content, this.detailEntityKey, this.detailFile);
          }
          return;
        } catch (e) {
          console.error("Cadence: Failed to render detail view", e);
          this.detailFile = null;
          this.detailEntityKey = null;
        }
      }
    }

    const route = {
      'home': () => this.renderHome(content),
      'planner.inbox': () => this.renderInbox(content),
      'planner.today': () => this.renderTodayPane(content),
      'planner.calendar': () => this.renderPlannerPane(content),
      'projects.dashboard': () => this.renderProjectsDashboard(content),
      'projects.projects': () => this.renderEntityList(content, 'project'),
      'crm.dashboard': () => this.renderDashboard(content),
      'crm.pipeline': () => this.renderEntityList(content, 'deal'),
      'crm.contacts': () => this.renderEntityList(content, 'contact'),
      'crm.companies': () => this.renderEntityList(content, 'company'),
      'crm.activities': () => this.renderEntityList(content, 'activity'),
      'prm.partners': () => this.renderEntityList(content, 'partner'),
      'prm.registrations': () => this.renderEntityList(content, 'registration'),
      'prm.commissions': () => this.renderEntityList(content, 'commission'),
      'prm.leads': () => this.renderEntityList(content, 'lead'),
      'prm.certifications': () => this.renderEntityList(content, 'certification'),
      'prm.analytics': () => this.renderPRMAnalytics(content),
      'workflow.sequences': () => this.renderEntityList(content, 'sequence'),
      'reports.pipeline': () => this.renderReportPipeline(content),
      'reports.sales': () => this.renderReportSales(content),
      'reports.partners': () => this.renderReportPartners(content),
      'reports.activity': () => this.renderReportActivity(content),
      'reports.graph': () => this.renderReportGraph(content),
      'reports.productivity': () => this.renderProductivity(content),
      'team': () => this.renderTeam(content),
      'templates': () => this.renderTemplatesDashboard(content),
      'settings': () => this.openSettingsTab(content),
    };
    if (route[this.mode]) {
      await route[this.mode]();
    } else {
      const customPages = this.plugin.settings.customPages || [];
      const custom = customPages.find(p => p.id === this.mode);
      if (custom) {
        await this.renderEntityList(content, custom.entityKey);
      } else {
        this.renderComingSoon(content, active);
      }
    }
  } finally {
    this._isRendering = false;
    if (this._needsRenderAgain) {
      this._needsRenderAgain = false;
      this.render();
    }
  }
}

  renderComingSoon(root, surface) {
    root.addClass('cadence-soon');
    const wrap = root.createDiv({ cls: 'cad-soon-wrap' });
    wrap.createDiv({ cls: 'cad-eyebrow', text: 'COMING SOON' });
    wrap.createDiv({ cls: 'cad-soon-title', text: surface.label });
    wrap.createDiv({ cls: 'cad-soon-desc', text: surface.desc });

    const ic = wrap.createDiv({ cls: 'cad-soon-icon' });
    try { obsidian.setIcon(ic, surface.icon); } catch (_) { }

    const meta = wrap.createDiv({ cls: 'cad-soon-meta' });
    meta.setText('This surface is scaffolded but not yet built. Tell the team to flesh it out next.');
  }

  /* ── Generic page header ────────────────── */
  _renderPageHeader(root, title, subtitle, actions) {
    const head = root.createDiv({ cls: 'cad-page-header' });
    const left = head.createDiv({ cls: 'cad-page-header-left' });
    left.createDiv({ cls: 'cad-eyebrow', text: 'CADENCE' });
    left.createDiv({ cls: 'cad-page-title', text: title });
    if (subtitle) left.createDiv({ cls: 'cad-page-subtitle', text: subtitle });
    const right = head.createDiv({ cls: 'cad-page-header-right' });
    if (typeof actions === 'function') actions(right);
    return head;
  }

  /* ── Generic entity LIST view ───────────── */
  async renderEntityList(root, entityKey, opts = {}) {
    root.addClass('cadence-list');
    const def = ENTITIES[entityKey];
    if (!def) { this.renderComingSoon(root, this._resolveSurface(this.mode)); return; }

    const entities = listEntities(this.app, entityKey);
    const filtered = opts.filter ? entities.filter(opts.filter) : entities;

    const mode = this.mode;
    const layout = this.plugin.settings.pageLayouts?.[mode] || (mode === 'projects.projects' ? 'cards' : (mode === 'crm.pipeline' ? 'kanban' : 'table'));

    this._renderPageHeader(root, opts.title || def.plural, `${filtered.length} ${filtered.length === 1 ? def.label.toLowerCase() : def.plural.toLowerCase()} in ${def.folder}`, (right) => {
      // Layout switcher
      const switcher = right.createDiv({ cls: 'cad-layout-switcher' });
      switcher.style.display = 'inline-flex';
      switcher.style.gap = '4px';
      switcher.style.marginRight = '12px';
      switcher.style.border = '1px solid var(--border-color)';
      switcher.style.borderRadius = '6px';
      switcher.style.overflow = 'hidden';
      switcher.style.padding = '2px';
      switcher.style.background = 'var(--background-secondary)';

      const layouts = [
        { key: 'table', icon: 'layout-list', title: 'Table view' },
        { key: 'kanban', icon: 'kanban', title: 'Kanban board' },
        { key: 'cards', icon: 'layout-grid', title: 'Card grid' }
      ];

      layouts.forEach(l => {
        const btn = switcher.createEl('button', { cls: 'cad-topbar-icon-btn' });
        btn.style.padding = '4px 8px';
        btn.style.height = 'auto';
        btn.style.border = 'none';
        btn.style.background = layout === l.key ? 'var(--background-modifier-border)' : 'transparent';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        try { obsidian.setIcon(btn, l.icon); } catch (_) { }
        btn.title = l.title;

        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          if (!this.plugin.settings.pageLayouts) this.plugin.settings.pageLayouts = {};
          this.plugin.settings.pageLayouts[mode] = l.key;
          await this.plugin.saveSettings();
          this.render();
        });
      });

      const importBtn = right.createEl('button', { cls: 'cad-btn', text: 'Import CSV' });
      importBtn.addEventListener('click', () => new CadenceImportModal(this.app, { entityKey }).open());
      const btn = right.createEl('button', { cls: 'cad-btn primary', text: `+ New ${def.label}` });
      btn.addEventListener('click', () => this._createEntityFromPrompt(entityKey));
    });

    if (!filtered.length) {
      const empty = root.createDiv({ cls: 'cad-empty-state' });
      empty.createDiv({ cls: 'cad-empty-state-title', text: `No ${def.plural.toLowerCase()} yet` });
      empty.createDiv({ cls: 'cad-empty-state-desc', text: `Drop a markdown note in ${def.folder}/ with frontmatter, or hit "+ New" above.` });
      return;
    }

    // Interactive Controls Bar (Search + Dynamic Filters)
    const controls = root.createDiv({ cls: 'cad-list-controls' });
    controls.style.display = 'flex';
    controls.style.gap = '12px';
    controls.style.alignItems = 'center';
    controls.style.marginBottom = '16px';
    controls.style.flexWrap = 'wrap';

    // Search bar
    const searchWrap = controls.createDiv({ cls: 'cad-search-wrap' });
    searchWrap.style.display = 'flex';
    searchWrap.style.alignItems = 'center';
    searchWrap.style.gap = '6px';
    searchWrap.style.flex = '1';
    searchWrap.style.minWidth = '200px';

    const searchInput = searchWrap.createEl('input', {
      type: 'text',
      cls: 'cad-pd-meta-input',
      placeholder: `Search ${def.plural.toLowerCase()}...`
    });
    searchInput.style.width = '100%';
    searchInput.style.margin = '0';

    // Render Kanban GroupBy Selector in the Controls bar
    if (layout === 'kanban') {
      const kanbanFields = def.fields.filter(field => !field.primary && ['enum', 'text', 'multitext', 'tags'].includes(field.type));
      if (kanbanFields.length > 0) {
        const groupSelectWrap = controls.createDiv({ attr: { style: 'display: inline-flex; align-items: center; gap: 6px; margin-left: auto;' } });
        groupSelectWrap.createSpan({ text: 'Group columns by:', attr: { style: 'font-size: 0.85em; color: var(--text-muted); font-weight: 600;' } });
        const groupSelect = groupSelectWrap.createEl('select', { cls: 'cad-prop-input' });
        groupSelect.style.padding = '6px 10px';
        groupSelect.style.height = 'auto';
        groupSelect.style.width = 'auto';
        groupSelect.style.background = 'var(--background-secondary)';
        groupSelect.style.color = 'var(--text-normal)';
        groupSelect.style.border = '1px solid var(--border-color)';
        groupSelect.style.borderRadius = '6px';

        kanbanFields.forEach(f => {
          const optEl = groupSelect.createEl('option', { value: f.key, text: f.label });
          const currentParams = this.getEntityKanbanParams(entityKey);
          if (currentParams.groupBy === f.key) optEl.selected = true;
        });

        groupSelect.addEventListener('change', async () => {
          if (!this.plugin.settings.pageKanbanGroupBy) this.plugin.settings.pageKanbanGroupBy = {};
          this.plugin.settings.pageKanbanGroupBy[entityKey] = groupSelect.value;
          await this.plugin.saveSettings();
          this.render();
        });
      }
    }

    // Dynamic Filters based on fields
    const filterableKeys = def.fields
      .map(f => f.key)
      .filter(k => {
        const fdef = def.fields.find(f => f.key === k);
        return fdef && (fdef.type === 'enum' || ['company', 'role', 'with', 'related', 'status', 'tier', 'type'].includes(k));
      });

    const activeFilters = {};
    let searchVal = '';
    let currentSortField = def.columns[0] || '';
    let currentSortAsc = true;

    filterableKeys.forEach(k => {
      const fdef = def.fields.find(f => f.key === k);
      if (!fdef) return;

      const uniqueVals = new Set();
      filtered.forEach(e => {
        const val = entityValue(e, k, def);
        if (Array.isArray(val)) {
          val.forEach(v => {
            if (v) {
              const clean = String(v).replace(/^\[\[|\]\]$/g, '').trim();
              if (clean) uniqueVals.add(clean);
            }
          });
        } else if (val != null && val !== '') {
          const clean = String(val).replace(/^\[\[|\]\]$/g, '').trim();
          if (clean) uniqueVals.add(clean);
        }
      });

      if (uniqueVals.size === 0) return;

      const filterWrap = controls.createDiv({ cls: 'cad-filter-select-wrap' });
      filterWrap.style.display = 'flex';
      filterWrap.style.alignItems = 'center';
      filterWrap.style.gap = '6px';

      const sel = filterWrap.createEl('select', { cls: 'cad-pd-meta-input' });
      sel.style.margin = '0';
      sel.style.padding = '4px 8px';
      sel.style.minHeight = '30px';
      sel.style.border = '1px solid var(--border-color)';
      sel.style.borderRadius = '4px';

      sel.createEl('option', { value: '', text: `All ${fdef.label}s` });
      Array.from(uniqueVals).sort().forEach(v => {
        sel.createEl('option', { value: v, text: v });
      });

      sel.addEventListener('change', () => {
        activeFilters[k] = sel.value;
        renderContent();
      });
    });

    const baseCols = opts.columns || def.columns;
    const cols = baseCols.map((k) => def.fields.find((f) => f.key === k)).filter(Boolean);
    // Dynamically append any custom/extra fields not present in baseCols
    def.fields.forEach((f) => {
      if (!baseCols.includes(f.key) && !cols.some(c => c.key === f.key)) {
        cols.push(f);
      }
    });

    // Create container elements for each layout type
    const tableWrap = root.createDiv({ cls: 'cad-table-wrap' });
    const kanbanWrap = root.createDiv({ cls: 'cad-kanban-board-wrap' });
    const cardsWrap = root.createDiv({ cls: 'cad-proj-grid-wrap' });

    const renderContent = async () => {
      // 1. Hide and clear all containers
      tableWrap.style.display = 'none';
      tableWrap.empty();
      kanbanWrap.style.display = 'none';
      kanbanWrap.empty();
      cardsWrap.style.display = 'none';
      cardsWrap.empty();

      // 2. Filter
      let displayed = filtered.filter(e => {
        if (searchVal) {
          const match = cols.some(f => {
            const val = entityValue(e, f.key, def);
            if (val == null) return false;
            return String(val).toLowerCase().includes(searchVal);
          }) || e.basename.toLowerCase().includes(searchVal);
          if (!match) return false;
        }

        for (const [k, filterVal] of Object.entries(activeFilters)) {
          if (!filterVal) continue;
          const val = entityValue(e, k, def);
          if (Array.isArray(val)) {
            const cleanVals = val.map(v => String(v).replace(/^\[\[|\]\]$/g, '').trim().toLowerCase());
            if (!cleanVals.includes(filterVal.toLowerCase())) return false;
          } else {
            const cleanVal = String(val || '').replace(/^\[\[|\]\]$/g, '').trim().toLowerCase();
            if (cleanVal !== filterVal.toLowerCase()) return false;
          }
        }

        return true;
      });

      // 3. Sort
      if (currentSortField) {
        const fdef = def.fields.find(f => f.key === currentSortField);
        const ftype = fdef ? fdef.type : 'text';

        displayed.sort((a, b) => {
          let valA = entityValue(a, currentSortField, def);
          let valB = entityValue(b, currentSortField, def);

          if (valA && typeof valA === 'string') valA = valA.replace(/^\[\[|\]\]$/g, '').trim();
          if (valB && typeof valB === 'string') valB = valB.replace(/^\[\[|\]\]$/g, '').trim();

          if (valA == null) valA = '';
          if (valB == null) valB = '';

          let diff = 0;
          if (ftype === 'number' || ftype === 'currency') {
            diff = Number(valA) - Number(valB);
          } else if (ftype === 'date') {
            const dateA = new Date(valA).getTime() || 0;
            const dateB = new Date(valB).getTime() || 0;
            diff = dateA - dateB;
          } else {
            diff = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
          }

          return currentSortAsc ? diff : -diff;
        });
      }

      // 4. Render Layout
      if (layout === 'table') {
        tableWrap.style.display = 'block';
        const table = tableWrap.createEl('table', { cls: 'cad-table' });
        const thead = table.createEl('thead');
        const trh = thead.createEl('tr');

        const headers = [];
        cols.forEach((f) => {
          const th = trh.createEl('th');
          th.style.cursor = 'pointer';
          th.style.userSelect = 'none';
          const thSpan = th.createSpan({ text: f.label + ' ' });
          const indicator = th.createSpan({ text: f.key === currentSortField ? '▲' : '↕' });
          indicator.style.opacity = f.key === currentSortField ? '1' : '0.4';
          indicator.style.marginLeft = '4px';

          headers.push({ key: f.key, th, indicator });

          th.addEventListener('click', () => {
            if (currentSortField === f.key) {
              currentSortAsc = !currentSortAsc;
            } else {
              currentSortField = f.key;
              currentSortAsc = true;
            }
            renderContent();
          });
        });

        const tbody = table.createEl('tbody');
        if (displayed.length === 0) {
          const tr = tbody.createEl('tr');
          const td = tr.createEl('td', { text: 'No matching entries found.' });
          td.colSpan = cols.length;
          td.style.textAlign = 'center';
          td.style.color = 'var(--text-muted)';
          td.style.padding = '20px';
        } else {
          displayed.forEach((e) => {
            const tr = tbody.createEl('tr', { cls: 'cad-row' });
            cols.forEach((f, i) => {
              const td = tr.createEl('td');
              const val = entityValue(e, f.key, def);
              const formatted = fmtValue(val, f.type);
              const primaryField = def.fields.find(fd => fd.primary) || def.fields[0];
              const hasPrimaryCol = cols.some(c => c.key === primaryField.key);
              const isPrimaryCol = hasPrimaryCol ? (f.key === primaryField.key) : (i === 0);

              if (isPrimaryCol) {
                const a = td.createEl('a', { cls: 'cad-row-primary', text: formatted || e.basename });
                a.addEventListener('click', (ev) => {
                  ev.preventDefault();
                  this.openEntityDetail(entityKey, e.file);
                });
              } else if (f.key === 'owner' || f.key === 'assigned') {
                this._renderOwnerLinks(td, val, false);
              } else {
                const sugSrc = f.suggestionSource || getFieldSuggestionSource(f);
                if (f.type === 'multitext' && sugSrc && sugSrc !== 'none' && sugSrc !== 'tags' && sugSrc !== 'history') {
                  const targetSrc = sugSrc === 'history' ? 'folder:Cadence/Shared' : sugSrc;
                  this._renderEntityLinks(td, val, targetSrc);
                } else if (f.key === 'company') {
                  this._renderEntityLinks(td, val, 'company');
                } else if (f.key === 'partner') {
                  this._renderEntityLinks(td, val, 'partner');
                } else if (f.key === 'contact' || f.key === 'contacts' || f.key === 'with') {
                  this._renderEntityLinks(td, val, 'contact');
                } else if (f.key === 'related') {
                  this._renderEntityLinks(td, val, 'project');
                } else {
                  td.setText(formatted);
                }
              }
            });
          });
        }
      } else if (layout === 'kanban') {
        kanbanWrap.style.display = 'block';
        const kanbanParams = this.getEntityKanbanParams(entityKey);
        const { groupBy, groups } = kanbanParams;
        const board = kanbanWrap.createDiv({ cls: 'cad-kanban-board' });

        groups.forEach((stage) => {
          const items = displayed.filter((e) => {
            const val = entityValue(e, groupBy, def);
            if (Array.isArray(val)) {
              const cleanVals = val.map(v => String(v).replace(/^\[\[|\]\]$/g, '').trim().toLowerCase());
              return cleanVals.includes(stage.toLowerCase());
            }
            return String(val || '').replace(/^\[\[|\]\]$/g, '').trim().toLowerCase() === stage.toLowerCase();
          });

          const col = board.createDiv({ cls: 'cad-kanban-col' });
          col.dataset.stage = stage;
          const head = col.createDiv({ cls: 'cad-kanban-col-head' });
          head.createDiv({ cls: 'cad-kanban-col-title', text: stage });

          const valueField = def.fields.find(f => f.type === 'currency' || f.type === 'number');
          if (valueField) {
            const sum = items.reduce((s, e) => s + (Number(entityValue(e, valueField.key, def)) || 0), 0);
            head.createDiv({ cls: 'cad-kanban-col-meta', text: `${items.length} · ${fmtValue(sum, valueField.type)}` });
          } else {
            head.createDiv({ cls: 'cad-kanban-col-meta', text: `${items.length}` });
          }

          const list = col.createDiv({ cls: 'cad-kanban-col-list' });

          list.addEventListener('dragover', (ev) => {
            ev.preventDefault();
            try { ev.dataTransfer.dropEffect = 'move'; } catch (_) { }
            col.addClass('drag-over');
          });
          list.addEventListener('dragleave', (ev) => {
            if (!col.contains(ev.relatedTarget)) col.removeClass('drag-over');
          });
          list.addEventListener('drop', async (ev) => {
            ev.preventDefault();
            col.removeClass('drag-over');
            const path = ev.dataTransfer.getData('text/cadence-entity');
            const fromStage = ev.dataTransfer.getData('text/cadence-stage');
            if (!path || fromStage === stage) return;
            const file = this.app.vault.getAbstractFileByPath(path);
            if (!file || !(file instanceof obsidian.TFile)) return;
            try {
              await this.app.fileManager.processFrontMatter(file, (fm) => {
                const fDef = def.fields.find(fd => fd.key === groupBy);
                const isList = fDef && (fDef.type === 'multitext' || fDef.type === 'tags' || fDef.isList === true);
                const isLink = fDef && fDef.suggestionSource && fDef.suggestionSource !== 'none' && fDef.suggestionSource !== 'tags' && fDef.suggestionSource !== 'history';
                if (isList) {
                  fm[groupBy] = isLink ? [`[[${stage}]]`] : [stage];
                } else {
                  fm[groupBy] = isLink ? `[[${stage}]]` : stage;
                }
              });
              new obsidian.Notice(`Moved to ${stage}`);
            } catch (e) {
              new obsidian.Notice(`Failed to move: ${e.message}`);
            }
          });

          if (!items.length) {
            list.createDiv({ cls: 'cad-empty', text: '—' });
          } else {
            const isMobile = !!(obsidian.Platform && obsidian.Platform.isMobile);
            items.forEach((e) => {
              const card = list.createDiv({ cls: 'cad-kanban-card' });
              card.dataset.path = e.file.path;

              const primaryField = def.fields.find(f => f.primary) || def.fields[0];
              card.createDiv({ cls: 'cad-kanban-card-title', text: entityValue(e, primaryField.key, def) || e.basename });

              const meta = card.createDiv({ cls: 'cad-kanban-card-meta' });
              if (valueField) {
                const val = entityValue(e, valueField.key, def);
                if (val) meta.createSpan({ text: fmtValue(val, valueField.type) });
              }

              const relFields = ['company', 'contact', 'owner', 'assigned'];
              relFields.forEach(rf => {
                const rfDef = def.fields.find(f => f.key === rf);
                if (rfDef) {
                  const vals = parseLinkValues(entityValue(e, rf, def));
                  vals.forEach(v => {
                    meta.createSpan({ text: ' · ' });
                    const link = meta.createEl('a', { text: v.display });
                    link.style.textDecoration = 'underline';
                    link.style.cursor = 'pointer';
                    link.addEventListener('click', (ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      const targetFile = this.app.vault.getMarkdownFiles().find(f => f.basename.toLowerCase() === v.target.toLowerCase());
                      if (targetFile) this.openEntityDetail(rf === 'owner' || rf === 'assigned' ? 'contact' : rf, targetFile);
                      else this.app.workspace.openLinkText(v.target, '', false);
                    });
                  });
                }
              });

              if (!isMobile) {
                card.draggable = true;
                card.addEventListener('dragstart', (ev) => {
                  card.addClass('dragging');
                  try {
                    ev.dataTransfer.effectAllowed = 'move';
                    ev.dataTransfer.setData('text/cadence-entity', e.file.path);
                    ev.dataTransfer.setData('text/cadence-stage', stage);
                    ev.dataTransfer.setData('text/plain', `[[${e.file.basename}]]`);
                  } catch (_) { }
                });
                card.addEventListener('dragend', () => card.removeClass('dragging'));
              } else {
                card.addClass('cad-kanban-card-touch');
              }
              card.addEventListener('click', () => this.openEntityDetail(entityKey, e.file));
            });
          }
        });
      } else if (layout === 'cards') {
        cardsWrap.style.display = 'block';
        const grid = cardsWrap.createDiv({ cls: 'cad-proj-grid' });

        if (entityKey === 'project') {
          const projects = await Promise.all(displayed.map(async (e) => {
            const meta = await readProjectMeta(this.app, e.file);
            return { entity: e, meta };
          }));

          projects.forEach((p) => {
            const card = grid.createDiv({ cls: 'cad-proj-card' });
            const head = card.createDiv({ cls: 'cad-proj-card-head' });
            const title = head.createEl('a', { cls: 'cad-proj-title', text: entityValue(p.entity, 'name', def) || p.entity.basename });
            title.addEventListener('click', (ev) => { ev.preventDefault(); this.openEntityDetail('project', p.entity.file); });
            const status = String(entityValue(p.entity, 'status', def) || 'active');
            const priority = String(entityValue(p.entity, 'priority', def) || '');
            const pillRow = head.createDiv({ cls: 'cad-proj-pills' });
            pillRow.createSpan({ cls: `cad-pill cad-pill-${status.toLowerCase().replace(/\s+/g, '-')}`, text: status });
            if (priority) pillRow.createSpan({ cls: `cad-pill cad-pill-prio-${priority.toLowerCase()}`, text: priority });

            const metaRow = card.createDiv({ cls: 'cad-proj-meta' });
            const owner = entityValue(p.entity, 'owner', def);
            const due = entityValue(p.entity, 'due', def);
            if (owner) this._renderOwnerLinks(metaRow, owner);
            if (due) metaRow.createSpan({ text: `Due: ${fmtValue(due, 'date')}` });

            const progWrap = card.createDiv({ cls: 'cad-proj-progress-wrap' });
            progWrap.dataset.pctBand = pctBand(p.meta.percent);
            const progLabel = progWrap.createDiv({ cls: 'cad-proj-progress-label' });
            progLabel.createSpan({ text: `${p.meta.done}/${p.meta.total} milestones` });
            progLabel.createSpan({ cls: 'cad-proj-progress-pct', text: `${p.meta.percent}%` });
            const bar = progWrap.createDiv({ cls: 'cad-proj-progress-bar' });
            const fill = bar.createDiv({ cls: 'cad-proj-progress-fill' });
            fill.style.width = `${p.meta.percent}%`;

            if (p.meta.next) {
              const nextRow = card.createDiv({ cls: 'cad-proj-next' });
              nextRow.createSpan({ cls: 'cad-proj-next-label', text: 'NEXT · ' });
              nextRow.createSpan({ cls: 'cad-proj-next-date', text: fmtValue(p.meta.next.date, 'date') });
              if (p.meta.next.title) nextRow.createSpan({ text: ` — ${p.meta.next.title}` });
            }
          });
        } else {
          displayed.forEach((e) => {
            const card = grid.createDiv({ cls: 'cad-proj-card' });
            const head = card.createDiv({ cls: 'cad-proj-card-head' });

            const primaryField = def.fields.find(f => f.primary) || def.fields[0];
            const titleText = entityValue(e, primaryField.key, def) || e.basename;
            const title = head.createEl('a', { cls: 'cad-proj-title', text: titleText });
            title.addEventListener('click', (ev) => { ev.preventDefault(); this.openEntityDetail(entityKey, e.file); });

            const pillRow = head.createDiv({ cls: 'cad-proj-pills' });
            const statusField = def.fields.find(f => f.key === 'status' || f.key === 'type' || f.key === 'tier') || def.fields.find(f => f.type === 'enum');
            if (statusField) {
              const val = entityValue(e, statusField.key, def);
              if (val) {
                const clean = Array.isArray(val) ? val[0] : val;
                pillRow.createSpan({ cls: `cad-pill cad-pill-${String(clean).toLowerCase().replace(/\s+/g, '-')}`, text: String(clean) });
              }
            }

            const metaRow = card.createDiv({ cls: 'cad-proj-meta' });
            let count = 0;
            def.fields.forEach(f => {
              if (f.key !== primaryField.key && (!statusField || f.key !== statusField.key) && count < 4) {
                const val = entityValue(e, f.key, def);
                if (val != null && val !== '') {
                  const formatted = fmtValue(val, f.type);
                  const fieldDiv = metaRow.createDiv();
                  fieldDiv.style.marginBottom = '2px';
                  fieldDiv.createSpan({ text: `${f.label}: `, attr: { style: 'font-weight: 500; color: var(--text-muted);' }});

                  const isLinkProperty = f.key === 'company' || f.key === 'contact' || f.key === 'partner' || f.key === 'owner' || f.key === 'project' || (f.suggestionSource && f.suggestionSource.startsWith('folder:'));
                  if (isLinkProperty) {
                    const links = parseLinkValues(val);
                    links.forEach((link, lidx) => {
                      if (lidx > 0) fieldDiv.createSpan({ text: ', ' });
                      const aLink = fieldDiv.createEl('a', { text: link.display });
                      aLink.style.textDecoration = 'underline';
                      aLink.style.cursor = 'pointer';
                      aLink.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        const targetFile = this.app.vault.getMarkdownFiles().find(f => f.basename.toLowerCase() === link.target.toLowerCase());

                        let relatedKey = f.key === 'owner' ? 'contact' : f.key;
                        if (f.suggestionSource && f.suggestionSource.startsWith('folder:')) {
                          const folder = f.suggestionSource.replace('folder:', '').split('/').pop().toLowerCase();
                          const found = Object.keys(ENTITIES).find(k => ENTITIES[k].folder.toLowerCase().endsWith(folder) || ENTITIES[k].plural.toLowerCase() === folder);
                          if (found) relatedKey = found;
                        }

                        if (targetFile) this.openEntityDetail(relatedKey, targetFile);
                        else this.app.workspace.openLinkText(link.target, '', false);
                      });
                    });
                  } else {
                    fieldDiv.createSpan({ text: formatted });
                  }
                  count++;
                }
              }
            });
          });
        }
      }
    };

    searchInput.addEventListener('input', () => {
      searchVal = searchInput.value.trim().toLowerCase();
      renderContent();
    });

    renderContent();
  }

  /* ── Entity DETAIL view (in-app form, autosaves to frontmatter) ── */
  async renderEntityDetail(root, entityKey, file) {
    // Projects and Companies get a richer custom detail view
    if (entityKey === 'project') return this.renderProjectDetail(root, file);
    if (entityKey === 'company') return this.renderCompanyDetail(root, file);

    root.addClass('cadence-detail');
    const def = ENTITIES[entityKey];
    if (!def || !file) { this.closeEntityDetail(); return; }

    // Read current entity
    const cache = this.app.metadataCache.getFileCache(file) || {};
    const fm = Object.assign({}, cache.frontmatter || {});
    const primaryKey = def.fields[0].key;
    const titleVal = (fm[primaryKey] != null && fm[primaryKey] !== '') ? fm[primaryKey] : file.basename;

    // Header: back / breadcrumb / title / actions
    const head = root.createDiv({ cls: 'cad-detail-header' });
    const headLeft = head.createDiv({ cls: 'cad-detail-header-left' });

    const back = headLeft.createEl('button', { cls: 'cad-btn cad-detail-back', text: '← ' + def.plural });
    back.addEventListener('click', () => this.closeEntityDetail());

    const breadcrumb = headLeft.createDiv({ cls: 'cad-detail-breadcrumb' });
    breadcrumb.createSpan({ cls: 'cad-eyebrow', text: def.plural.toUpperCase() });
    breadcrumb.createSpan({ cls: 'cad-detail-title', text: String(titleVal) });
    breadcrumb.createDiv({ cls: 'cad-detail-path', text: file.path });

    const headRight = head.createDiv({ cls: 'cad-detail-header-right' });
    const savedBadge = headRight.createSpan({ cls: 'cad-detail-saved', text: '' });
    const openNote = headRight.createEl('button', { cls: 'cad-btn', text: 'Open as note' });
    openNote.addEventListener('click', () => this.app.workspace.openLinkText(file.path, '', false));
    const deleteBtn = headRight.createEl('button', { cls: 'cad-btn cad-btn-danger', text: 'Delete' });
    deleteBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      new CadenceConfirmModal(this.app, {
        title: `Delete ${def.label}`,
        message: `Delete this ${def.label.toLowerCase()}? This moves the file to trash.`,
        confirmLabel: 'Delete',
        onConfirm: () => {
          deleteBtn.blur();
          setTimeout(async () => {
            try {
              await this.app.vault.trash(file, true);
              new obsidian.Notice(`Deleted ${def.label}: ${file.basename}`);
              this.closeEntityDetail();
            } catch (e) {
              new obsidian.Notice(`Delete failed: ${e.message}`);
            }
          }, 50);
        }
      }).open();
    });

    // Form
    const form = root.createDiv({ cls: 'cad-detail-form' });
    let saveTimer = null;
    const flashSaved = () => {
      savedBadge.setText('Saved');
      savedBadge.addClass('show');
      clearTimeout(savedBadge._t);
      savedBadge._t = setTimeout(() => savedBadge.removeClass('show'), 1400);
    };
    const writeField = async (key, raw) => {
      try {
        let value = raw;
        const fdef = def.fields.find((f) => f.key === key);
        if (fdef) {
          if (fdef.type === 'tags') {
            if (Array.isArray(raw)) {
              value = raw;
            } else {
              value = (raw || '').split(',').map((t) => t.trim()).filter(Boolean);
            }
          } else if (fdef.type === 'number' || fdef.type === 'currency') {
            const n = Number(raw);
            value = isNaN(n) ? null : n;
          } else if (key === 'stage') {
            value = raw ? [raw] : null;
          } else if (raw === '') {
            value = null;
          }
        }
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
          if (value == null || (Array.isArray(value) && value.length === 0)) {
            delete frontmatter[key];
          } else {
            frontmatter[key] = value;
          }
        });
        flashSaved();
      } catch (e) {
        new obsidian.Notice(`Save failed: ${e.message}`);
      }
    };
    const debouncedWrite = (key, val) => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => writeField(key, val), 350);
    };

    const isCore = ['contact', 'company', 'partner', 'registration', 'commission', 'lead', 'certification', 'activity', 'sequence', 'project', 'deal'].includes(entityKey);

    // Render each field as a labelled row
    def.fields.forEach((f) => {
      if (f.key === 'type' && f.type !== 'enum') {
        return; // Skip rendering the 'type' field if it is not an enum (like in Activities)
      }
      const row = form.createDiv({ cls: 'cad-form-row' });
      row.createDiv({ cls: 'cad-form-label', text: f.label.toUpperCase() });

      const current = fm[f.key];
      const fieldType = f.type || 'text';

      if (fieldType === 'enum') {
        const sel = row.createEl('select', { cls: 'cad-form-input' });
        // Allow empty
        sel.createEl('option', { value: '', text: '—' });
        (f.options || []).forEach((opt) => {
          const o = sel.createEl('option', { value: opt, text: opt });
          const valStr = Array.isArray(current) ? String(current[0] || '') : String(current || '');
          if (valStr === opt) o.selected = true;
        });
        sel.addEventListener('change', () => writeField(f.key, sel.value));
      } else if (fieldType === 'date') {
        const inp = row.createEl('input', { type: 'date', cls: 'cad-form-input' });
        if (current) {
          const d = new Date(current);
          if (!isNaN(d.getTime())) inp.value = d.toISOString().slice(0, 10);
        }
        if (!isCore && f.key === 'type') {
          inp.disabled = true;
          inp.style.opacity = '0.6';
          inp.style.cursor = 'not-allowed';
          inp.title = 'This property is read-only unless configured as a Select (Enum) in settings.';
        } else {
          inp.addEventListener('change', () => writeField(f.key, inp.value));
        }
      } else if (fieldType === 'number' || fieldType === 'currency') {
        const inp = row.createEl('input', { type: 'number', cls: 'cad-form-input' });
        if (current != null) inp.value = String(current);
        if (fieldType === 'currency') inp.placeholder = `${this.plugin.settings.currency || 'USD'} amount`;
        if (!isCore && f.key === 'type') {
          inp.disabled = true;
          inp.style.opacity = '0.6';
          inp.style.cursor = 'not-allowed';
          inp.title = 'This property is read-only unless configured as a Select (Enum) in settings.';
        } else {
          inp.addEventListener('input', () => debouncedWrite(f.key, inp.value));
          inp.addEventListener('blur', () => writeField(f.key, inp.value));
        }
      } else if (fieldType === 'email') {
        const inp = row.createEl('input', { type: 'email', cls: 'cad-form-input' });
        if (current) inp.value = String(current);
        if (!isCore && f.key === 'type') {
          inp.disabled = true;
          inp.style.opacity = '0.6';
          inp.style.cursor = 'not-allowed';
          inp.title = 'This property is read-only unless configured as a Select (Enum) in settings.';
        } else {
          inp.addEventListener('input', () => debouncedWrite(f.key, inp.value));
          inp.addEventListener('blur', () => writeField(f.key, inp.value));
        }
      } else {
        const suggestionSource = getFieldSuggestionSource(f);
        const isChips = fieldType === 'tags' || fieldType === 'multitext' || suggestionSource !== 'none';
        if (isChips) {
          const isEntitySrc = ENTITIES[suggestionSource] != null;
          const isFolderSrc = suggestionSource && suggestionSource.startsWith('folder:');
          const isPlainChip = ['tags', 'none', 'history'].includes(suggestionSource);
          const isList = fieldType === 'tags' || fieldType === 'multitext' || f.isList === true || f.key === 'tags' || ['owner', 'assigned', 'contacts', 'domain', 'industry', 'role', 'with', 'related'].includes(f.key);

          let targetEntityKey = isEntitySrc ? suggestionSource : null;
          const customFolderPath = isFolderSrc ? suggestionSource.slice('folder:'.length) : null;

          if (isFolderSrc && customFolderPath) {
            const normalizedPath = customFolderPath.replace(/\/+$/, '').toLowerCase();
            for (const [ek, def] of Object.entries(ENTITIES)) {
              if (def && def.folder && def.folder.replace(/\/+$/, '').toLowerCase() === normalizedPath) {
                targetEntityKey = ek;
                break;
              }
            }
          }

          row.style.position = 'relative';
          const wrap = row.createDiv({ cls: 'cad-pd-tag-input-wrap' });
          wrap.style.display = 'flex';
          wrap.style.flexWrap = 'wrap';
          wrap.style.gap = '6px';
          wrap.style.alignItems = 'center';
          wrap.style.border = 'none';
          wrap.style.borderRadius = '0';
          wrap.style.padding = '4px 0';
          wrap.style.minHeight = '36px';
          wrap.style.backgroundColor = 'transparent';
          wrap.style.cursor = 'text';

          const inp = wrap.createEl('input', { type: 'text' });
          inp.style.border = 'none';
          inp.style.outline = 'none';
          inp.style.background = 'transparent';
          inp.style.flex = '1';
          inp.style.minWidth = '80px';
          inp.style.color = 'var(--text-normal)';
          inp.style.padding = '0';
          inp.style.margin = '0';
          inp.style.height = '24px';
          inp.placeholder = 'Add ' + f.label.toLowerCase() + '...';

          if (!isCore && f.key === 'type') {
            inp.disabled = true;
            inp.style.display = 'none';
          }

          const suggestionsBox = row.createDiv({ cls: 'cad-pd-tag-suggestions' });
          suggestionsBox.style.position = 'absolute';
          suggestionsBox.style.zIndex = '10000';
          suggestionsBox.style.backgroundColor = 'var(--background-secondary)';
          suggestionsBox.style.border = '1px solid var(--border-color)';
          suggestionsBox.style.borderRadius = '4px';
          suggestionsBox.style.boxShadow = 'var(--shadow-s)';
          suggestionsBox.style.maxHeight = '150px';
          suggestionsBox.style.overflowY = 'auto';
          suggestionsBox.style.display = 'none';
          suggestionsBox.style.width = 'calc(100% - 150px)'; // Account for form label
          suggestionsBox.style.boxSizing = 'border-box';
          suggestionsBox.style.top = '100%';
          suggestionsBox.style.right = '0';
          suggestionsBox.style.marginTop = '4px';

          let valuesList = [];
          const cur = fm[f.key];
          if (Array.isArray(cur)) {
            valuesList = cur.map(v => isPlainChip ? String(v).trim() : String(v).replace(/^\[\[|\]\]$/g, '').trim()).filter(Boolean);
          } else if (cur != null && cur !== '') {
            valuesList = [isPlainChip ? String(cur).trim() : String(cur).replace(/^\[\[|\]\]$/g, '').trim()].filter(Boolean);
          }

          const updateSuggestions = () => {
            const query = inp.value.trim().toLowerCase();
            suggestionsBox.empty();

            let filtered = [];
            if (suggestionSource === 'tags') {
              const suggestions = Object.keys(this.app.metadataCache.getTags() || {}).map(t => t.replace(/^#/, ''));
              filtered = suggestions.filter((v) =>
                (!query || v.toLowerCase().includes(query)) &&
                !valuesList.includes(v)
              );
            } else if (suggestionSource === 'history') {
              const allFiles = this.app.vault.getMarkdownFiles();
              const allValues = new Set();
              allFiles.forEach(file => {
                const cache = this.app.metadataCache.getFileCache(file);
                const fm = cache && cache.frontmatter || {};
                const val = fm[f.key];
                if (Array.isArray(val)) {
                  val.forEach(v => { if (v) allValues.add(String(v).replace(/^\[\[|\]\]$/g, '').trim()); });
                } else if (val != null && val !== '') {
                  allValues.add(String(val).replace(/^\[\[|\]\]$/g, '').trim());
                }
              });
              filtered = Array.from(allValues).filter((v) =>
                (!query || v.toLowerCase().includes(query)) &&
                !valuesList.includes(v)
              );
            } else if (suggestionSource !== 'none') {
              if (customFolderPath) {
                // Custom folder source: list basenames of .md files in that folder
                const folderNode = this.app.vault.getAbstractFileByPath(customFolderPath);
                const names = [];
                if (folderNode && folderNode.children) {
                  const walk = (node) => {
                    for (const child of node.children) {
                      if (child.children) walk(child);
                      else if (child.path && child.path.endsWith('.md')) names.push(child.basename);
                    }
                  };
                  walk(folderNode);
                }
                filtered = names.filter(n =>
                  (!query || n.toLowerCase().includes(query)) && !valuesList.includes(n)
                );
              } else {
                const targetEntities = listEntities(this.app, targetEntityKey);
                filtered = targetEntities.filter((c) =>
                  (!query || c.basename.toLowerCase().includes(query)) &&
                  !valuesList.includes(c.basename)
                ).map(c => c.basename);
              }
            }

            if (filtered.length === 0) {
              suggestionsBox.style.display = 'none';
              return;
            }

            filtered.forEach((valStr) => {
              const item = suggestionsBox.createDiv({ cls: 'cad-suggestion-item' });
              item.style.padding = '6px 10px';
              item.style.cursor = 'pointer';
              item.style.fontSize = '13px';
              item.style.color = 'var(--text-normal)';
              item.setText(valStr);

              item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = 'var(--background-modifier-hover)';
              });
              item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = 'transparent';
              });
              item.addEventListener('mousedown', async (ev) => {
                ev.preventDefault();
                await addVal(valStr);
                suggestionsBox.style.display = 'none';
              });
            });

            suggestionsBox.style.display = 'block';
          };

          const renderChips = () => {
            const existing = wrap.querySelectorAll('.cad-tag-chip');
            existing.forEach(c => c.remove());

            valuesList.forEach((valName) => {
              const chip = wrap.createDiv({ cls: 'cad-tag-chip' });
              chip.style.display = 'inline-flex';
              chip.style.alignItems = 'center';
              chip.style.gap = '6px';
              chip.style.backgroundColor = 'var(--background-secondary, #eee)';
              chip.style.padding = '2px 8px';
              chip.style.borderRadius = '12px';
              chip.style.fontSize = '12px';
              chip.style.height = '24px';
              chip.style.boxSizing = 'border-box';
              chip.style.color = 'var(--text-normal)';

              const labelSpan = chip.createSpan({ text: valName });
              if (!isPlainChip) {
                labelSpan.style.textDecoration = 'underline';
                labelSpan.style.cursor = 'pointer';
                labelSpan.addEventListener('click', (ev) => {
                  ev.stopPropagation();
                  const targetFile = this.app.vault.getMarkdownFiles().find(cFile => cFile.basename.toLowerCase() === valName.toLowerCase());
                  if (targetFile) {
                    if (targetEntityKey && !targetEntityKey.startsWith('folder:')) {
                      this.openEntityDetail(targetEntityKey, targetFile);
                    } else {
                      this.openEntityDetailFromFile(targetFile);
                    }
                  } else {
                    this.app.workspace.openLinkText(valName, '', false);
                  }
                });
              }

              const close = chip.createSpan({ text: '×' });
              if (!isCore && f.key === 'type') {
                close.style.display = 'none';
              } else {
                close.style.cursor = 'pointer';
                close.style.fontWeight = 'bold';
                close.style.fontSize = '14px';
                close.style.lineHeight = '1';
                close.style.color = 'var(--text-muted)';
                close.addEventListener('click', async (ev) => {
                  ev.stopPropagation();
                  valuesList = valuesList.filter(v => v !== valName);
                  await save();
                  renderChips();
                });
              }

              wrap.insertBefore(chip, inp);
            });
          };

          const save = async () => {
            let val;
            if (isPlainChip) {
              val = isList ? valuesList : (valuesList[0] || null);
            } else {
              val = isList ? valuesList.map(o => `[[${o}]]`) : (valuesList[0] ? `[[${valuesList[0]}]]` : null);
            }
            await writeField(f.key, val);
          };

          const addVal = async (name) => {
            name = name.trim();
            if (!name) return;
            if (isList) {
              if (valuesList.includes(name)) {
                inp.value = '';
                return;
              }
              valuesList.push(name);
            } else {
              valuesList = [name];
            }
            inp.value = '';
            renderChips();
            await save();

            if (!isPlainChip) {
              const targetFile = this.app.vault.getMarkdownFiles().find(cFile => cFile.basename.toLowerCase() === name.toLowerCase());
              if (!targetFile) {
                try {
                  const creationSource = suggestionSource === 'history' ? 'folder:Cadence/Shared' : (targetEntityKey || suggestionSource);
                  await createEntity(this.app, creationSource, name);
                  const label = ENTITIES[targetEntityKey] ? ENTITIES[targetEntityKey].label : 'Note';
                  new obsidian.Notice(`Created new ${label}: ${name}`);
                } catch (e) {
                  console.warn(`Failed to auto-create ${targetEntityKey || suggestionSource}`, e);
                }
              }
            }
          };

          if (isCore || f.key !== 'type') {
            inp.addEventListener('input', updateSuggestions);
            inp.addEventListener('focus', updateSuggestions);

            inp.addEventListener('keydown', async (ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault();
                await addVal(inp.value);
                suggestionsBox.style.display = 'none';
              } else if (ev.key === 'Backspace' && !inp.value && valuesList.length > 0) {
                valuesList.pop();
                await save();
                renderChips();
              }
            });

            inp.addEventListener('blur', async () => {
              setTimeout(async () => {
                suggestionsBox.style.display = 'none';
                if (inp.value.trim()) {
                  await addVal(inp.value);
                }
              }, 180);
            });
          }

          wrap.addEventListener('click', () => {
            inp.focus();
          });

          renderChips();
        } else {
          const inp = row.createEl('input', { type: 'text', cls: 'cad-form-input' });
          if (current) inp.value = String(current);
          if (f.key === primaryKey) inp.placeholder = `${def.label} name`;
          if (!isCore && f.key === 'type') {
            inp.disabled = true;
            inp.style.opacity = '0.6';
            inp.style.cursor = 'not-allowed';
            inp.title = 'This property is read-only unless configured as a Select (Enum) in settings.';
          } else {
            inp.addEventListener('input', () => debouncedWrite(f.key, inp.value));
            inp.addEventListener('blur', () => writeField(f.key, inp.value));
          }
        }
      }
    });

    // Body section — link out for full editing
    const content = await this.app.vault.read(file);
    const sections = parseH2Sections(content);
    const sectionKeys = Object.keys(sections);
    if (sectionKeys.length > 0) {
      const sectionsHeader = root.createDiv({ cls: 'cad-section-label-lg', text: 'NOTE SECTIONS' });
      sectionsHeader.style.marginTop = '24px';
      sectionsHeader.style.marginBottom = '12px';

      const sectionsGrid = root.createDiv({ cls: 'cad-pd-cols' });
      sectionsGrid.style.display = 'grid';
      sectionsGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(350px, 1fr))';
      sectionsGrid.style.gap = '16px';
      sectionsGrid.style.marginBottom = '24px';

      sectionKeys.forEach((key) => {
        this._renderDynamicH2Section(sectionsGrid, file, sections, key, flashSaved);
      });
    }

    // Render Cross Sections
    this._renderCrossSections(root, entityKey, titleVal);

  }

  _renderEntityTable(parent, entityKey, filteredList, columns) {
    const def = ENTITIES[entityKey];
    if (!def) return;

    const tableWrap = parent.createDiv({ cls: 'cad-table-wrap' });
    tableWrap.style.padding = '0';
    tableWrap.style.border = 'none';
    tableWrap.style.boxShadow = 'none';
    tableWrap.style.borderRadius = '0';
    tableWrap.style.marginTop = '0';
    tableWrap.style.overflowX = 'auto';

    const table = tableWrap.createEl('table', { cls: 'cad-table' });
    const cols = columns.map((k) => def.fields.find((f) => f.key === k)).filter(Boolean);

    const thead = table.createEl('thead');
    const trh = thead.createEl('tr');
    cols.forEach((f) => trh.createEl('th', { text: f.label }));

    const tbody = table.createEl('tbody');
    filteredList.forEach((e) => {
      const tr = tbody.createEl('tr', { cls: 'cad-row' });
      cols.forEach((f, i) => {
        const td = tr.createEl('td');
        const val = entityValue(e, f.key, def);
        const formatted = fmtValue(val, f.type);
        const primaryField = def.fields.find(fd => fd.primary) || def.fields[0];
        const hasPrimaryCol = cols.some(c => c.key === primaryField.key);
        const isPrimaryCol = hasPrimaryCol ? (f.key === primaryField.key) : (i === 0);
        if (isPrimaryCol) {
          const a = td.createEl('a', { cls: 'cad-row-primary', text: formatted || e.basename });
          a.style.fontWeight = 'bold';
          a.style.textDecoration = 'underline';
          a.style.cursor = 'pointer';
          a.addEventListener('click', (ev) => {
            ev.preventDefault();
            this.openEntityDetail(entityKey, e.file);
          });
        } else if (f.key === 'owner' || f.key === 'assigned') {
          this._renderOwnerLinks(td, val, false);
        } else {
          const sugSrc = f.suggestionSource || getFieldSuggestionSource(f);
          if (f.type === 'multitext' && sugSrc && sugSrc !== 'none' && sugSrc !== 'tags' && sugSrc !== 'history') {
            const targetSrc = sugSrc === 'history' ? 'folder:Cadence/Shared' : sugSrc;
            this._renderEntityLinks(td, val, targetSrc);
          } else if (f.key === 'company') {
            this._renderEntityLinks(td, val, 'company');
          } else if (f.key === 'partner') {
            this._renderEntityLinks(td, val, 'partner');
          } else if (f.key === 'contact' || f.key === 'contacts' || f.key === 'with') {
            this._renderEntityLinks(td, val, 'contact');
          } else if (f.key === 'related') {
            this._renderEntityLinks(td, val, 'project');
          } else if (f.key === 'stage' && val) {
            const span = td.createSpan({ cls: `cad-pill cad-pill-${val.toLowerCase()}`, text: formatted });
            span.style.fontSize = '10px';
            span.style.padding = '2px 6px';
          } else {
            td.setText(formatted || '—');
          }
        }
      });
    });
  }

  async renderCompanyDetail(root, file) {
    root.addClass('cadence-project-detail');
    const def = ENTITIES.company;
    const cache = this.app.metadataCache.getFileCache(file) || {};
    const fm = Object.assign({}, cache.frontmatter || {});
    const titleVal = fm.name || file.basename;

    /* Header */
    const head = root.createDiv({ cls: 'cad-detail-header' });
    const headLeft = head.createDiv({ cls: 'cad-detail-header-left' });
    const back = headLeft.createEl('button', { cls: 'cad-btn cad-detail-back', text: '← Companies' });
    back.addEventListener('click', () => this.closeEntityDetail());
    const breadcrumb = headLeft.createDiv({ cls: 'cad-detail-breadcrumb' });
    breadcrumb.createSpan({ cls: 'cad-eyebrow', text: 'COMPANY' });
    breadcrumb.createSpan({ cls: 'cad-detail-title', text: String(titleVal) });
    breadcrumb.createDiv({ cls: 'cad-detail-path', text: file.path });

    const headRight = head.createDiv({ cls: 'cad-detail-header-right' });
    const savedBadge = headRight.createSpan({ cls: 'cad-detail-saved', text: '' });
    const flashSaved = () => {
      savedBadge.setText('Saved');
      savedBadge.addClass('show');
      clearTimeout(savedBadge._t);
      savedBadge._t = setTimeout(() => savedBadge.removeClass('show'), 1400);
    };
    const openNote = headRight.createEl('button', { cls: 'cad-btn', text: 'Open as note' });
    openNote.addEventListener('click', () => this.app.workspace.openLinkText(file.path, '', false));
    const deleteBtn = headRight.createEl('button', { cls: 'cad-btn cad-btn-danger', text: 'Delete' });
    deleteBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      new CadenceConfirmModal(this.app, {
        title: 'Delete Company',
        message: 'Delete this company? This moves the file to trash.',
        confirmLabel: 'Delete',
        onConfirm: () => {
          deleteBtn.blur();
          setTimeout(async () => {
            try {
              await this.app.vault.trash(file, true);
              new obsidian.Notice(`Deleted company: ${file.basename}`);
              this.closeEntityDetail();
            } catch (e) {
              new obsidian.Notice(`Delete failed: ${e.message}`);
            }
          }, 50);
        }
      }).open();
    });

    const hero = root.createDiv({ cls: 'cad-pd-hero' });
    const metaRow = hero.createDiv({ cls: 'cad-pd-meta' });

    const mkMeta = (f) => {
      const label = f.label;
      const key = f.key;
      const fieldType = f.type || 'text';

      const cell = metaRow.createDiv({ cls: 'cad-pd-meta-cell' });
      cell.style.position = 'relative';
      cell.createDiv({ cls: 'cad-pd-meta-label', text: label.toUpperCase() });

      const current = fm[key];
      const suggestionSource = getFieldSuggestionSource(f);

      // Check if it should be rendered as chips (multitext, tags, or has a suggestion source)
      const isChips = fieldType === 'tags' || fieldType === 'multitext' || suggestionSource !== 'none';

      if (isChips) {
        const isEntitySrc2 = ENTITIES[suggestionSource] != null;
        const isFolderSrc2 = suggestionSource && suggestionSource.startsWith('folder:');
        const isPlainChip = ['tags', 'none', 'history'].includes(suggestionSource);
        const isList = fieldType === 'tags' || fieldType === 'multitext' || f.isList === true || ['owner', 'contacts', 'domain', 'industry', 'role', 'with', 'related'].includes(key);
        let targetEntityKey = isEntitySrc2 ? suggestionSource : null;
        const customFolderPath = isFolderSrc2 ? suggestionSource.slice('folder:'.length) : null;

        if (isFolderSrc2 && customFolderPath) {
          const normalizedPath = customFolderPath.replace(/\/+$/, '').toLowerCase();
          for (const [ek, def] of Object.entries(ENTITIES)) {
            if (def && def.folder && def.folder.replace(/\/+$/, '').toLowerCase() === normalizedPath) {
              targetEntityKey = ek;
              break;
            }
          }
        }

        const wrap = cell.createDiv({ cls: 'cad-pd-tag-input-wrap' });
        wrap.style.display = 'flex';
        wrap.style.flexWrap = 'wrap';
        wrap.style.gap = '6px';
        wrap.style.alignItems = 'center';
        wrap.style.border = 'none';
        wrap.style.borderRadius = '0';
        wrap.style.padding = '4px 0';
        wrap.style.minHeight = '36px';
        wrap.style.backgroundColor = 'transparent';
        wrap.style.cursor = 'text';

        const inp = wrap.createEl('input', { type: 'text', cls: 'cad-pd-tag-input-field' });
        inp.style.border = 'none';
        inp.style.outline = 'none';
        inp.style.background = 'transparent';
        inp.style.color = 'var(--text-normal)';
        inp.style.flex = '1';
        inp.style.minWidth = '80px';
        inp.style.padding = '0';
        inp.style.height = '24px';
        inp.style.lineHeight = '24px';
        inp.placeholder = `Add ${label.toLowerCase()}...`;

        const suggestionsBox = cell.createDiv({ cls: 'cad-pd-tag-suggestions' });
        suggestionsBox.style.position = 'absolute';
        suggestionsBox.style.zIndex = '10000';
        suggestionsBox.style.backgroundColor = 'var(--background-secondary)';
        suggestionsBox.style.border = '1px solid var(--border-color)';
        suggestionsBox.style.borderRadius = '4px';
        suggestionsBox.style.boxShadow = 'var(--shadow-s)';
        suggestionsBox.style.maxHeight = '150px';
        suggestionsBox.style.overflowY = 'auto';
        suggestionsBox.style.display = 'none';
        suggestionsBox.style.width = '100%';
        suggestionsBox.style.boxSizing = 'border-box';
        suggestionsBox.style.top = '100%';
        suggestionsBox.style.left = '0';
        suggestionsBox.style.marginTop = '4px';

        let valuesList = [];
        if (Array.isArray(current)) {
          valuesList = current.map(v => isPlainChip ? String(v).trim() : String(v).replace(/^\[\[|\]\]$/g, '').trim()).filter(Boolean);
        } else if (current != null && current !== '') {
          valuesList = [isPlainChip ? String(current).trim() : String(current).replace(/^\[\[|\]\]$/g, '').trim()].filter(Boolean);
        }

        const updateSuggestions = () => {
          const query = inp.value.trim().toLowerCase();
          suggestionsBox.empty();

          let filtered = [];
          if (suggestionSource === 'tags') {
            const suggestions = Object.keys(this.app.metadataCache.getTags() || {}).map(t => t.replace(/^#/, ''));
            filtered = suggestions.filter((v) =>
              (!query || v.toLowerCase().includes(query)) &&
              !valuesList.includes(v)
            );
          } else if (suggestionSource === 'history') {
            const allFiles = this.app.vault.getMarkdownFiles();
            const allValues = new Set();
            allFiles.forEach(fl => {
              const cache = this.app.metadataCache.getFileCache(fl);
              const fm = cache && cache.frontmatter || {};
              const val = fm[key];
              if (Array.isArray(val)) {
                val.forEach(v => { if (v) allValues.add(String(v).replace(/^\[\[|\]\]$/g, '').trim()); });
              } else if (val != null && val !== '') {
                allValues.add(String(val).replace(/^\[\[|\]\]$/g, '').trim());
              }
            });
            filtered = Array.from(allValues).filter((v) =>
              (!query || v.toLowerCase().includes(query)) &&
              !valuesList.includes(v)
            );
          } else if (suggestionSource !== 'none') {
            if (customFolderPath) {
              const folderNode = this.app.vault.getAbstractFileByPath(customFolderPath);
              const names = [];
              if (folderNode && folderNode.children) {
                const walk = (node) => {
                  for (const child of node.children) {
                    if (child.children) walk(child);
                    else if (child.path && child.path.endsWith('.md')) names.push(child.basename);
                  }
                };
                walk(folderNode);
              }
              filtered = names.filter(n =>
                (!query || n.toLowerCase().includes(query)) && !valuesList.includes(n)
              );
            } else {
              const targetEntities = listEntities(this.app, targetEntityKey);
              filtered = targetEntities.filter((c) =>
                (!query || c.basename.toLowerCase().includes(query)) &&
                !valuesList.includes(c.basename)
              ).map(c => c.basename);
            }
          }

          if (filtered.length === 0) {
            suggestionsBox.style.display = 'none';
            return;
          }

          filtered.forEach((valStr) => {
            const item = suggestionsBox.createDiv({ cls: 'cad-suggestion-item' });
            item.style.padding = '6px 10px';
            item.style.cursor = 'pointer';
            item.style.fontSize = '13px';
            item.style.color = 'var(--text-normal)';
            item.setText(valStr);

            item.addEventListener('mouseenter', () => {
              item.style.backgroundColor = 'var(--background-modifier-hover)';
            });
            item.addEventListener('mouseleave', () => {
              item.style.backgroundColor = 'transparent';
            });
            item.addEventListener('mousedown', async (ev) => {
              ev.preventDefault();
              await addVal(valStr);
              suggestionsBox.style.display = 'none';
            });
          });

          suggestionsBox.style.display = 'block';
        };

        const renderChips = () => {
          const existing = wrap.querySelectorAll('.cad-tag-chip');
          existing.forEach(c => c.remove());

          valuesList.forEach((valName) => {
            const chip = wrap.createDiv({ cls: 'cad-tag-chip' });
            chip.style.display = 'inline-flex';
            chip.style.alignItems = 'center';
            chip.style.gap = '6px';
            chip.style.backgroundColor = 'var(--background-secondary, #eee)';
            chip.style.padding = '2px 8px';
            chip.style.borderRadius = '12px';
            chip.style.fontSize = '12px';
            chip.style.height = '24px';
            chip.style.boxSizing = 'border-box';
            chip.style.color = 'var(--text-normal)';

            const labelSpan = chip.createSpan({ text: valName });
            if (!isPlainChip) {
              labelSpan.style.textDecoration = 'underline';
              labelSpan.style.cursor = 'pointer';
              labelSpan.addEventListener('click', (ev) => {
                ev.stopPropagation();
                const targetFile = this.app.vault.getMarkdownFiles().find(cFile => cFile.basename.toLowerCase() === valName.toLowerCase());
                if (targetFile) {
                  if (targetEntityKey && !targetEntityKey.startsWith('folder:')) {
                    this.openEntityDetail(targetEntityKey, targetFile);
                  } else {
                    this.openEntityDetailFromFile(targetFile);
                  }
                } else {
                  this.app.workspace.openLinkText(valName, '', false);
                }
              });
            }

            const close = chip.createSpan({ text: '×' });
            close.style.cursor = 'pointer';
            close.style.fontWeight = 'bold';
            close.style.fontSize = '14px';
            close.style.lineHeight = '1';
            close.style.color = 'var(--text-muted)';
            close.addEventListener('click', async (ev) => {
              ev.stopPropagation();
              valuesList = valuesList.filter(v => v !== valName);
              await save();
              renderChips();
            });

            wrap.insertBefore(chip, inp);
          });
        };

        const save = async () => {
          let val;
          if (isPlainChip) {
            val = isList ? valuesList : (valuesList[0] || null);
          } else {
            val = isList ? valuesList.map(o => `[[${o}]]`) : (valuesList[0] ? `[[${valuesList[0]}]]` : null);
          }
          await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
            if (val == null || (Array.isArray(val) && val.length === 0)) {
              delete frontmatter[key];
            } else {
              frontmatter[key] = val;
            }
          });
          flashSaved();
        };

        const addVal = async (name) => {
          name = name.trim();
          if (!name) return;
          if (isList) {
            if (valuesList.includes(name)) {
              inp.value = '';
              return;
            }
            valuesList.push(name);
          } else {
            valuesList = [name];
          }
          inp.value = '';
          renderChips();
          await save();

          if (!isPlainChip) {
            const targetFile = this.app.vault.getMarkdownFiles().find(cFile => cFile.basename.toLowerCase() === name.toLowerCase());
            if (!targetFile) {
              try {
                const creationSource = suggestionSource === 'history' ? 'folder:Cadence/Shared' : (targetEntityKey || suggestionSource);
                await createEntity(this.app, creationSource, name);
                const label = ENTITIES[targetEntityKey] ? ENTITIES[targetEntityKey].label : 'Note';
                new obsidian.Notice(`Created new ${label}: ${name}`);
              } catch (e) {
                console.warn(`Failed to auto-create ${targetEntityKey || suggestionSource}`, e);
              }
            }
          }
        };

        inp.addEventListener('input', updateSuggestions);
        inp.addEventListener('focus', updateSuggestions);
        inp.addEventListener('keydown', async (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            await addVal(inp.value);
            suggestionsBox.style.display = 'none';
          } else if (ev.key === 'Backspace' && !inp.value && valuesList.length > 0) {
            valuesList.pop();
            await save();
            renderChips();
          }
        });
        inp.addEventListener('blur', async () => {
          setTimeout(async () => {
            suggestionsBox.style.display = 'none';
            if (inp.value.trim()) {
              await addVal(inp.value);
            }
          }, 180);
        });
        wrap.addEventListener('click', () => inp.focus());
        renderChips();
      } else if (fieldType === 'enum') {
        const sel = cell.createEl('select', { cls: 'cad-pd-meta-input' });
        sel.style.border = 'none';
        sel.style.background = 'transparent';
        sel.style.color = 'var(--text-normal)';
        sel.style.outline = 'none';
        sel.style.width = '100%';
        sel.createEl('option', { value: '', text: '—' });
        (f.options || []).forEach((opt) => {
          const o = sel.createEl('option', { value: opt, text: opt });
          const valStr = Array.isArray(current) ? String(current[0] || '') : String(current || '');
          if (valStr === opt) o.selected = true;
        });
        const commit = async () => {
          const val = sel.value || null;
          await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
            if (val === null) delete frontmatter[key];
            else frontmatter[key] = val;
          });
          flashSaved();
        };
        sel.addEventListener('change', commit);
      } else {
        const inp = cell.createEl('input', { type: fieldType === 'date' ? 'date' : (fieldType === 'number' || fieldType === 'currency' ? 'number' : 'text'), cls: 'cad-pd-meta-input' });
        if (fieldType === 'currency') inp.placeholder = `${this.plugin.settings.currency || 'USD'} amount`;

        if (fieldType === 'date' && current) {
          const d = new Date(current);
          if (!isNaN(d.getTime())) inp.value = d.toISOString().slice(0, 10);
        } else if (current != null) {
          inp.value = String(current);
        }

        let t;
        const commit = () => {
          let val = inp.value || null;
          if (fieldType === 'number' || fieldType === 'currency') {
            const n = Number(inp.value);
            val = isNaN(n) ? null : n;
          }
          this.app.fileManager.processFrontMatter(file, (frontmatter) => {
            if (val === null || val === '') delete frontmatter[key];
            else frontmatter[key] = val;
          });
          flashSaved();
        };
        inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(commit, 350); });
        inp.addEventListener('blur', commit);
      }
    };

    def.fields.forEach(f => {
      if (f.primary) return;
      if (f.key === 'type' && f.type !== 'enum') return;
      mkMeta(f);
    });

    /* Two-column body */
    const cols = root.createDiv({ cls: 'cad-pd-cols' });
    const left = cols.createDiv({ cls: 'cad-pd-col' });
    const right = cols.createDiv({ cls: 'cad-pd-col' });

    const content = await this.app.vault.read(file);
    const sections = parseH2Sections(content);

    const leftKeys = [];
    const rightKeys = [];

    Object.keys(sections).forEach((key, idx) => {
      if (idx % 2 === 0) {
        leftKeys.push(key);
      } else {
        rightKeys.push(key);
      }
    });

    leftKeys.forEach((key) => {
      this._renderDynamicH2Section(left, file, sections, key, flashSaved);
    });

    rightKeys.forEach((key) => {
      this._renderDynamicH2Section(right, file, sections, key, flashSaved);
    });

    // Render Cross Sections
    const crossSectionContainer = root.createDiv({ attr: { style: 'padding: 0 32px;' } });
    this._renderCrossSections(crossSectionContainer, 'company', titleVal);
  }

  /* ── Project DETAIL view (real PM surface) ─────── */
  async renderProjectDetail(root, file) {
    root.addClass('cadence-project-detail');
    const def = ENTITIES.project;
    const cache = this.app.metadataCache.getFileCache(file) || {};
    const fm = Object.assign({}, cache.frontmatter || {});
    const meta = await readProjectMeta(this.app, file);
    const titleVal = fm.name || file.basename;

    const status = String(fm.status || 'active');
    const priority = String(fm.priority || '');
    const owner = fm.owner || '';
    const due = fm.due || '';
    const started = fm.started || '';

    /* Header */
    const head = root.createDiv({ cls: 'cad-detail-header' });
    const headLeft = head.createDiv({ cls: 'cad-detail-header-left' });
    const back = headLeft.createEl('button', { cls: 'cad-btn cad-detail-back', text: '← Projects' });
    back.addEventListener('click', () => this.closeEntityDetail());
    const breadcrumb = headLeft.createDiv({ cls: 'cad-detail-breadcrumb' });
    breadcrumb.createSpan({ cls: 'cad-eyebrow', text: 'PROJECT' });
    breadcrumb.createSpan({ cls: 'cad-detail-title', text: String(titleVal) });
    breadcrumb.createDiv({ cls: 'cad-detail-path', text: file.path });

    const headRight = head.createDiv({ cls: 'cad-detail-header-right' });
    const savedBadge = headRight.createSpan({ cls: 'cad-detail-saved', text: '' });
    const flashSaved = () => {
      savedBadge.setText('Saved');
      savedBadge.addClass('show');
      clearTimeout(savedBadge._t);
      savedBadge._t = setTimeout(() => savedBadge.removeClass('show'), 1400);
    };
    const openNote = headRight.createEl('button', { cls: 'cad-btn', text: 'Open as note' });
    openNote.addEventListener('click', () => this.app.workspace.openLinkText(file.path, '', false));
    const deleteBtn = headRight.createEl('button', { cls: 'cad-btn cad-btn-danger', text: 'Delete' });
    deleteBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      new CadenceConfirmModal(this.app, {
        title: 'Delete Project',
        message: 'Delete this project? This moves the file to trash.',
        confirmLabel: 'Delete',
        onConfirm: () => {
          deleteBtn.blur();
          setTimeout(async () => {
            try {
              await this.app.vault.trash(file, true);
              new obsidian.Notice(`Deleted project: ${file.basename}`);
              this.closeEntityDetail();
            } catch (e) {
              new obsidian.Notice(`Delete failed: ${e.message}`);
            }
          }, 50);
        }
      }).open();
    });

    /* Hero — name (already in breadcrumb), pills, meta, progress */
    const hero = root.createDiv({ cls: 'cad-pd-hero' });
    const pillRow = hero.createDiv({ cls: 'cad-pd-pills' });
    const mkSelect = (cls, options, current, onChange) => {
      const wrap = pillRow.createDiv({ cls: `cad-pd-select-wrap ${cls}` });
      const sel = wrap.createEl('select', { cls: 'cad-pd-select' });
      options.forEach((opt) => {
        const o = sel.createEl('option', { value: opt, text: opt });
        if (String(current) === opt) o.selected = true;
      });
      sel.addEventListener('change', () => onChange(sel.value));
      return sel;
    };
    const statusOptions = getEnumOptions('project', 'status', ['active', 'on_hold', 'backlog', 'done', 'cancelled']);
    const prioOptions = getEnumOptions('project', 'priority', ['low', 'medium', 'high']);
    mkSelect('cad-pill cad-pill-' + status.toLowerCase().replace(/\s+/g, '-'),
      statusOptions, status,
      (v) => this._writeProjectFrontmatter(file, { status: v }, flashSaved));
    mkSelect('cad-pill cad-pill-prio-' + (priority || 'medium').toLowerCase(),
      prioOptions, priority || 'medium',
      (v) => this._writeProjectFrontmatter(file, { priority: v }, flashSaved));

    const metaRow = hero.createDiv({ cls: 'cad-pd-meta' });
    const entityKey = 'project';
    const mkMeta = (f) => {
      const label = f.label;
      const key = f.key;
      const fieldType = f.type || 'text';

      const cell = metaRow.createDiv({ cls: 'cad-pd-meta-cell' });
      cell.style.position = 'relative';
      cell.createDiv({ cls: 'cad-pd-meta-label', text: label.toUpperCase() });

      const current = fm[key];
      const suggestionSource = getFieldSuggestionSource(f);

      // Check if it should be rendered as chips (multitext, tags, or has a suggestion source)
      const isChips = fieldType === 'tags' || fieldType === 'multitext' || suggestionSource !== 'none';

      if (isChips) {
        const isEntitySrc = ENTITIES[suggestionSource] != null;
        const isFolderSrc = suggestionSource && suggestionSource.startsWith('folder:');
        const isPlainChip = ['tags', 'none', 'history'].includes(suggestionSource);
        const isList = fieldType === 'tags' || fieldType === 'multitext' || f.isList === true || ['owner', 'contacts', 'domain', 'industry', 'role', 'with', 'related'].includes(key);
        let targetEntityKey = isEntitySrc ? suggestionSource : null;
        const customFolderPath = isFolderSrc ? suggestionSource.slice('folder:'.length) : null;

        if (isFolderSrc && customFolderPath) {
          const normalizedPath = customFolderPath.replace(/\/+$/, '').toLowerCase();
          for (const [ek, def] of Object.entries(ENTITIES)) {
            if (def && def.folder && def.folder.replace(/\/+$/, '').toLowerCase() === normalizedPath) {
              targetEntityKey = ek;
              break;
            }
          }
        }

        const wrap = cell.createDiv({ cls: 'cad-pd-tag-input-wrap' });
        wrap.style.display = 'flex';
        wrap.style.flexWrap = 'wrap';
        wrap.style.gap = '6px';
        wrap.style.alignItems = 'center';
        wrap.style.border = 'none';
        wrap.style.borderRadius = '0';
        wrap.style.padding = '4px 0';
        wrap.style.minHeight = '36px';
        wrap.style.backgroundColor = 'transparent';
        wrap.style.cursor = 'text';

        const inp = wrap.createEl('input', { type: 'text', cls: 'cad-pd-tag-input-field' });
        inp.style.border = 'none';
        inp.style.outline = 'none';
        inp.style.background = 'transparent';
        inp.style.color = 'var(--text-normal)';
        inp.style.flex = '1';
        inp.style.minWidth = '80px';
        inp.style.padding = '0';
        inp.style.height = '24px';
        inp.style.lineHeight = '24px';
        inp.placeholder = `Add ${label.toLowerCase()}...`;

        const suggestionsBox = cell.createDiv({ cls: 'cad-pd-tag-suggestions' });
        suggestionsBox.style.position = 'absolute';
        suggestionsBox.style.zIndex = '10000';
        suggestionsBox.style.backgroundColor = 'var(--background-secondary)';
        suggestionsBox.style.border = '1px solid var(--border-color)';
        suggestionsBox.style.borderRadius = '4px';
        suggestionsBox.style.boxShadow = 'var(--shadow-s)';
        suggestionsBox.style.maxHeight = '150px';
        suggestionsBox.style.overflowY = 'auto';
        suggestionsBox.style.display = 'none';
        suggestionsBox.style.width = '100%';
        suggestionsBox.style.boxSizing = 'border-box';
        suggestionsBox.style.top = '100%';
        suggestionsBox.style.left = '0';
        suggestionsBox.style.marginTop = '4px';

        let valuesList = [];
        if (Array.isArray(current)) {
          valuesList = current.map(v => isPlainChip ? String(v).trim() : String(v).replace(/^\[\[|\]\]$/g, '').trim()).filter(Boolean);
        } else if (current != null && current !== '') {
          valuesList = [isPlainChip ? String(current).trim() : String(current).replace(/^\[\[|\]\]$/g, '').trim()].filter(Boolean);
        }

        const updateSuggestions = () => {
          const query = inp.value.trim().toLowerCase();
          suggestionsBox.empty();

          let filtered = [];
          if (suggestionSource === 'tags') {
            const suggestions = Object.keys(this.app.metadataCache.getTags() || {}).map(t => t.replace(/^#/, ''));
            filtered = suggestions.filter((v) =>
              (!query || v.toLowerCase().includes(query)) &&
              !valuesList.includes(v)
            );
          } else if (suggestionSource === 'history') {
            const allFiles = this.app.vault.getMarkdownFiles();
            const allValues = new Set();
            allFiles.forEach(fl => {
              const cache = this.app.metadataCache.getFileCache(fl);
              const fm = cache && cache.frontmatter || {};
              const val = fm[key];
              if (Array.isArray(val)) {
                val.forEach(v => { if (v) allValues.add(String(v).replace(/^\[\[|\]\]$/g, '').trim()); });
              } else if (val != null && val !== '') {
                allValues.add(String(val).replace(/^\[\[|\]\]$/g, '').trim());
              }
            });
            filtered = Array.from(allValues).filter((v) =>
              (!query || v.toLowerCase().includes(query)) &&
              !valuesList.includes(v)
            );
          } else if (suggestionSource !== 'none') {
            if (customFolderPath) {
              const folderNode = this.app.vault.getAbstractFileByPath(customFolderPath);
              const names = [];
              if (folderNode && folderNode.children) {
                const walk = (node) => {
                  for (const child of node.children) {
                    if (child.children) walk(child);
                    else if (child.path && child.path.endsWith('.md')) names.push(child.basename);
                  }
                };
                walk(folderNode);
              }
              filtered = names.filter(n =>
                (!query || n.toLowerCase().includes(query)) && !valuesList.includes(n)
              );
            } else {
              const targetEntities = listEntities(this.app, targetEntityKey);
              filtered = targetEntities.filter((c) =>
                (!query || c.basename.toLowerCase().includes(query)) &&
                !valuesList.includes(c.basename)
              ).map(c => c.basename);
            }
          }

          if (filtered.length === 0) {
            suggestionsBox.style.display = 'none';
            return;
          }

          filtered.forEach((valStr) => {
            const item = suggestionsBox.createDiv({ cls: 'cad-suggestion-item' });
            item.style.padding = '6px 10px';
            item.style.cursor = 'pointer';
            item.style.fontSize = '13px';
            item.style.color = 'var(--text-normal)';
            item.setText(valStr);

            item.addEventListener('mouseenter', () => {
              item.style.backgroundColor = 'var(--background-modifier-hover)';
            });
            item.addEventListener('mouseleave', () => {
              item.style.backgroundColor = 'transparent';
            });
            item.addEventListener('mousedown', async (ev) => {
              ev.preventDefault();
              await addVal(valStr);
              suggestionsBox.style.display = 'none';
            });
          });

          suggestionsBox.style.display = 'block';
        };

        const renderChips = () => {
          const existing = wrap.querySelectorAll('.cad-tag-chip');
          existing.forEach(c => c.remove());

          valuesList.forEach((valName) => {
            const chip = wrap.createDiv({ cls: 'cad-tag-chip' });
            chip.style.display = 'inline-flex';
            chip.style.alignItems = 'center';
            chip.style.gap = '6px';
            chip.style.backgroundColor = 'var(--background-secondary, #eee)';
            chip.style.padding = '2px 8px';
            chip.style.borderRadius = '12px';
            chip.style.fontSize = '12px';
            chip.style.height = '24px';
            chip.style.boxSizing = 'border-box';
            chip.style.color = 'var(--text-normal)';

            const labelSpan = chip.createSpan({ text: valName });
            if (!isPlainChip) {
              labelSpan.style.textDecoration = 'underline';
              labelSpan.style.cursor = 'pointer';
              labelSpan.addEventListener('click', (ev) => {
                ev.stopPropagation();
                const targetFile = this.app.vault.getMarkdownFiles().find(cFile => cFile.basename.toLowerCase() === valName.toLowerCase());
                if (targetFile) {
                  if (targetEntityKey && !targetEntityKey.startsWith('folder:')) {
                    this.openEntityDetail(targetEntityKey, targetFile);
                  } else {
                    this.openEntityDetailFromFile(targetFile);
                  }
                } else {
                  this.app.workspace.openLinkText(valName, '', false);
                }
              });
            }

            const close = chip.createSpan({ text: '×' });
            close.style.cursor = 'pointer';
            close.style.fontWeight = 'bold';
            close.style.fontSize = '14px';
            close.style.lineHeight = '1';
            close.style.color = 'var(--text-muted)';
            close.addEventListener('click', async (ev) => {
              ev.stopPropagation();
              valuesList = valuesList.filter(v => v !== valName);
              await save();
              renderChips();
            });

            wrap.insertBefore(chip, inp);
          });
        };

        const save = async () => {
          let val;
          if (isPlainChip) {
            val = isList ? valuesList : (valuesList[0] || null);
          } else {
            val = isList ? valuesList.map(o => `[[${o}]]`) : (valuesList[0] ? `[[${valuesList[0]}]]` : null);
          }
          await this._writeProjectFrontmatter(file, { [key]: val }, flashSaved);
        };

        const addVal = async (name) => {
          name = name.trim();
          if (!name) return;
          if (isList) {
            if (valuesList.includes(name)) {
              inp.value = '';
              return;
            }
            valuesList.push(name);
          } else {
            valuesList = [name];
          }
          inp.value = '';
          renderChips();
          await save();

          if (!isPlainChip) {
            const targetFile = this.app.vault.getMarkdownFiles().find(cFile => cFile.basename.toLowerCase() === name.toLowerCase());
            if (!targetFile) {
              try {
                const creationSource = suggestionSource === 'history' ? 'folder:Cadence/Shared' : (targetEntityKey || suggestionSource);
                await createEntity(this.app, creationSource, name);
                const label = ENTITIES[targetEntityKey] ? ENTITIES[targetEntityKey].label : 'Note';
                new obsidian.Notice(`Created new ${label}: ${name}`);
              } catch (e) {
                console.warn(`Failed to auto-create ${targetEntityKey || suggestionSource}`, e);
              }
            }
          }
        };

        inp.addEventListener('input', updateSuggestions);
        inp.addEventListener('focus', updateSuggestions);
        inp.addEventListener('keydown', async (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            await addVal(inp.value);
            suggestionsBox.style.display = 'none';
          } else if (ev.key === 'Backspace' && !inp.value && valuesList.length > 0) {
            valuesList.pop();
            await save();
            renderChips();
          }
        });
        inp.addEventListener('blur', async () => {
          setTimeout(async () => {
            suggestionsBox.style.display = 'none';
            if (inp.value.trim()) {
              await addVal(inp.value);
            }
          }, 180);
        });
        wrap.addEventListener('click', () => inp.focus());
        renderChips();
      } else if (fieldType === 'enum') {
        const sel = cell.createEl('select', { cls: 'cad-pd-meta-input' });
        sel.style.border = 'none';
        sel.style.background = 'transparent';
        sel.style.color = 'var(--text-normal)';
        sel.style.outline = 'none';
        sel.style.width = '100%';
        sel.createEl('option', { value: '', text: '—' });
        (f.options || []).forEach((opt) => {
          const o = sel.createEl('option', { value: opt, text: opt });
          const valStr = Array.isArray(current) ? String(current[0] || '') : String(current || '');
          if (valStr === opt) o.selected = true;
        });
        const commit = async () => {
          const val = sel.value || null;
          await this._writeProjectFrontmatter(file, { [key]: val }, flashSaved);
        };
        sel.addEventListener('change', commit);
      } else {
        const inp = cell.createEl('input', { type: fieldType === 'date' ? 'date' : (fieldType === 'number' || fieldType === 'currency' ? 'number' : 'text'), cls: 'cad-pd-meta-input' });
        if (fieldType === 'currency') inp.placeholder = `${this.plugin.settings.currency || 'USD'} amount`;

        if (fieldType === 'date' && current) {
          const d = new Date(current);
          if (!isNaN(d.getTime())) inp.value = d.toISOString().slice(0, 10);
        } else if (current != null) {
          inp.value = String(current);
        }

        let t;
        const commit = () => {
          let val = inp.value || null;
          if (fieldType === 'number' || fieldType === 'currency') {
            const n = Number(inp.value);
            val = isNaN(n) ? null : n;
          }
          this._writeProjectFrontmatter(file, { [key]: val }, flashSaved);
        };
        inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(commit, 350); });
        inp.addEventListener('blur', commit);
      }
    };

    def.fields.forEach(f => {
      if (f.primary || f.key === 'status' || f.key === 'priority') return;
      if (f.key === 'type' && f.type !== 'enum') return;
      mkMeta(f);
    });

    if (meta.total > 0) {
      const progWrap = hero.createDiv({ cls: 'cad-proj-progress-wrap cad-pd-progress' });
      progWrap.dataset.pctBand = pctBand(meta.percent);
      const progLabel = progWrap.createDiv({ cls: 'cad-proj-progress-label' });
      progLabel.createSpan({ text: `${meta.done}/${meta.total} milestones complete` });
      progLabel.createSpan({ cls: 'cad-proj-progress-pct', text: `${meta.percent}%` });
      const bar = progWrap.createDiv({ cls: 'cad-proj-progress-bar' });
      const fill = bar.createDiv({ cls: 'cad-proj-progress-fill' });
      fill.style.width = `${meta.percent}%`;
    }

    /* Two-column body */
    const cols = root.createDiv({ cls: 'cad-pd-cols' });
    const left = cols.createDiv({ cls: 'cad-pd-col' });
    const right = cols.createDiv({ cls: 'cad-pd-col' });

    const leftKeys = [];
    const rightKeys = [];

    Object.keys(meta.sections).forEach((key, idx) => {
      if (idx % 2 === 0) {
        leftKeys.push(key);
      } else {
        rightKeys.push(key);
      }
    });

    leftKeys.forEach((key) => {
      this._renderDynamicH2Section(left, file, meta.sections, key, flashSaved);
    });

    const standardMetadata = {
      brief: { label: 'BRIEF', rows: 4, placeholder: 'The outcome we want, why now.' },
      scope: { label: 'SCOPE', rows: 5, placeholder: 'In scope / out of scope.' },
      risks: { label: 'RISKS', rows: 4, placeholder: 'What could go wrong.' },
      stakeholders: { label: 'STAKEHOLDERS', rows: 3, placeholder: 'Who cares about this project.' },
      notes: { label: 'NOTES', rows: 5, placeholder: 'Anything else.' }
    };

    rightKeys.forEach((key) => {
      const { cleanLabel } = parseHeaderKey(key);
      const metaInfo = standardMetadata[cleanLabel.toLowerCase()];
      if (metaInfo) {
        this._renderProjectTextSection(right, file, meta.sections, { key, label: metaInfo.label, rows: metaInfo.rows, placeholder: metaInfo.placeholder }, flashSaved);
      } else {
        this._renderDynamicH2Section(right, file, meta.sections, key, flashSaved);
      }
    });

    // Render Cross Sections
    const crossSectionContainer = root.createDiv({ attr: { style: 'padding: 0 32px; width: 100%; clear: both;' } });
    this._renderCrossSections(crossSectionContainer, 'project', titleVal);
  }

  _renderMilestoneSection(parent, file, milestones, flashSaved, rawKey = 'Milestones') {
    const card = parent.createDiv({ cls: 'cad-pd-card' });
    const head = card.createDiv({ cls: 'cad-pd-card-head' });
    const { cleanLabel } = parseHeaderKey(rawKey);
    head.createDiv({ cls: 'cad-pd-card-title', text: `${cleanLabel.toUpperCase()} · ${milestones.filter((m) => m.done).length}/${milestones.length}` });
    const addBtn = head.createEl('button', { cls: 'cad-btn cad-btn-sm', text: '+ Add' });

    const list = card.createDiv({ cls: 'cad-pd-checklist' });
    const renderRows = (items) => {
      list.empty();
      if (!items.length) {
        list.createDiv({ cls: 'cad-empty', text: 'No milestones yet — add the first one.' });
        return;
      }
      items.forEach((m, idx) => {
        const wrapper = list.createDiv({ cls: 'cad-mile-wrapper' });
        const row = wrapper.createDiv({ cls: 'cad-pd-mile-row' + (m.done ? ' done' : '') });
        const cb = row.createEl('input', { type: 'checkbox' });
        cb.checked = !!m.done;
        cb.addEventListener('change', async () => {
          items[idx].done = cb.checked;
          await this._commitMilestones(file, items, flashSaved, false, rawKey);
        });
        const dateInp = row.createEl('input', { type: 'date', cls: 'cad-pd-mile-date' });
        if (m.date instanceof Date && !isNaN(m.date.getTime())) {
          dateInp.value = m.date.toISOString().slice(0, 10);
        }
        let dt;
        dateInp.addEventListener('input', () => {
          clearTimeout(dt);
          dt = setTimeout(async () => {
            items[idx].date = dateInp.value ? new Date(dateInp.value) : null;
            await this._commitMilestones(file, items, flashSaved, true, rawKey);
          }, 350);
        });
        const titleInp = row.createEl('input', { type: 'text', cls: 'cad-pd-mile-title' });
        titleInp.value = m.title || '';
        titleInp.placeholder = 'Milestone title';
        let tt;
        titleInp.addEventListener('input', () => {
          clearTimeout(tt);
          tt = setTimeout(async () => {
            items[idx].title = titleInp.value;
            await this._commitMilestones(file, items, flashSaved, true, rawKey);
          }, 400);
        });
        const del = row.createEl('button', { cls: 'cad-btn cad-btn-sm cad-btn-danger', text: '×' });
        del.title = 'Delete milestone';
        del.addEventListener('click', async () => {
          items.splice(idx, 1);
          await this._commitMilestones(file, items, flashSaved, false, rawKey);
        });

        // Notes section — preview ⇄ textarea, indented under the milestone in markdown
        const notesEl = wrapper.createDiv({ cls: 'cad-mile-notes-section' });
        const renderNotesIdle = () => {
          notesEl.empty();
          const hasNotes = (items[idx].notes || '').trim().length > 0;
          if (hasNotes) {
            const preview = notesEl.createDiv({ cls: 'cad-mile-notes-preview' });
            preview.setText(items[idx].notes);
            preview.title = 'Click to edit notes';
            preview.addEventListener('click', openNotesEditor);
          } else {
            const addBtn = notesEl.createEl('a', { cls: 'cad-mile-notes-add', text: '+ Add notes' });
            addBtn.addEventListener('click', (e) => { e.preventDefault(); openNotesEditor(); });
          }
        };
        const openNotesEditor = () => {
          notesEl.empty();
          const ta = notesEl.createEl('textarea', { cls: 'cad-mile-notes-textarea' });
          ta.value = items[idx].notes || '';
          ta.placeholder = 'Notes — context, follow-ups, what happened…';
          const autosize = () => {
            ta.style.height = 'auto';
            ta.style.height = Math.max(60, ta.scrollHeight + 2) + 'px';
          };
          let nt;
          ta.addEventListener('input', () => {
            autosize();
            clearTimeout(nt);
            nt = setTimeout(async () => {
              items[idx].notes = ta.value;
              await this._commitMilestones(file, items, flashSaved, true, rawKey);
            }, 400);
          });
          ta.addEventListener('blur', async () => {
            items[idx].notes = ta.value;
            await this._commitMilestones(file, items, flashSaved, true, rawKey);
            renderNotesIdle();
          });
          setTimeout(() => { ta.focus(); autosize(); }, 0);
        };
        renderNotesIdle();
      });
    };

    renderRows(milestones);

    addBtn.addEventListener('click', async () => {
      const today = new Date();
      milestones.push({ done: false, date: today, title: '' });
      await this._commitMilestones(file, milestones, flashSaved, false, rawKey);
    });
  }

  async _commitMilestones(file, items, flashSaved, skipRender = false, rawKey = 'Milestones') {
    const body = stringifyMilestones(items);
    const content = await this.app.vault.read(file);
    const next = replaceSection(content, `## ${rawKey}`, body || '');
    await this.app.vault.modify(file, next);
    if (typeof flashSaved === 'function') flashSaved();
    if (!skipRender) this.render();
  }

  _renderTaskSection(parent, file, tasks, flashSaved, rawKey = 'Tasks') {
    const card = parent.createDiv({ cls: 'cad-pd-card' });
    const head = card.createDiv({ cls: 'cad-pd-card-head' });

    let tasksList = tasks;
    let fileTaskNotes = [];
    if (this.plugin.settings.taskManagementSystem === 'tasknotes') {
      fileTaskNotes = listTaskNotesTasksForFile(this.app, file);
      tasksList = fileTaskNotes.map(t => ({ done: t.done, title: t.title }));
    }

    const open = tasksList.filter((t) => !t.done).length;
    const { cleanLabel } = parseHeaderKey(rawKey);
    head.createDiv({ cls: 'cad-pd-card-title', text: `${cleanLabel.toUpperCase()} · ${open} open · ${tasksList.length - open} done` });
    const addBtn = head.createEl('button', { cls: 'cad-btn cad-btn-sm', text: '+ Add' });

    const list = card.createDiv({ cls: 'cad-pd-checklist' });
    const renderRows = (items) => {
      list.empty();
      if (!items.length) {
        list.createDiv({ cls: 'cad-empty', text: 'No tasks yet.' });
        return;
      }
      items.forEach((t, idx) => {
        const row = list.createDiv({ cls: 'cad-pd-task-row' + (t.done ? ' done' : '') });
        const cb = row.createEl('input', { type: 'checkbox' });
        cb.checked = !!t.done;
        cb.addEventListener('change', async () => {
          if (this.plugin.settings.taskManagementSystem === 'tasknotes') {
            const taskObj = fileTaskNotes[idx];
            await toggleTaskNotesTask(this.app, taskObj.file, cb.checked);
          } else {
            items[idx].done = cb.checked;
            await this._commitTasks(file, items, flashSaved, false, rawKey);
            const txt = (items[idx].title || '').trim();
            if (txt) await this._propagateTaskComplete(txt, cb.checked, { kind: 'project', file });
          }
          this.render();
        });

        if (this.plugin.settings.taskManagementSystem === 'tasknotes') {
          const taskObj = fileTaskNotes[idx];
          const taskLink = row.createEl('a', { cls: 'cad-task-text', text: t.title || 'Untitled Task' });
          taskLink.style.cursor = 'pointer';
          taskLink.style.flex = '1';
          taskLink.style.marginRight = '8px';
          taskLink.addEventListener('click', (ev) => {
            ev.preventDefault();
            this.app.workspace.openLinkText(taskObj.file.path, '', false);
          });
        } else {
          const titleInp = row.createEl('input', { type: 'text', cls: 'cad-pd-task-title' });
          titleInp.value = t.title || '';
          titleInp.placeholder = 'Task description';
          let tt;
          titleInp.addEventListener('input', () => {
            clearTimeout(tt);
            tt = setTimeout(async () => {
              items[idx].title = titleInp.value;
              await this._commitTasks(file, items, flashSaved, true, rawKey);
            }, 400);
          });

          /* Bell — set or edit a reminder linked to this task. */
          const linked = findProjectTaskReminder(this.plugin, file.path, t.title || '');
          const bell = row.createEl('button', {
            cls: 'cad-btn cad-btn-sm cad-pd-task-bell' + (linked ? ' linked' : ''),
            text: linked ? '🔔' : '🔕',
          });
          bell.title = linked
            ? `Edit reminder${linked.when ? ' · ' + reminderTimeStr(linked.when) : ''}`
            : 'Set a reminder for this task';
          bell.addEventListener('click', async () => {
            items[idx].title = titleInp.value;
            await this._commitTasks(file, items, flashSaved, true, rawKey);

            const taskText = titleInp.value.trim();
            if (!taskText) {
              new obsidian.Notice('Add a task title first.');
              titleInp.focus();
              return;
            }
            const existing = findProjectTaskReminder(this.plugin, file.path, taskText);
            if (existing) {
              new CadenceReminderEditModal(this.app, this.plugin, existing).open();
            } else {
              new CadenceReminderEditModal(this.app, this.plugin, {
                text: taskText,
                when: null,
                repeat: 'none',
                notes: '',
                project: file.path,
              }, { isNew: true }).open();
            }
          });
        }

        if (this.plugin.settings.taskManagementSystem !== 'tasknotes') {
          const del = row.createEl('button', { cls: 'cad-btn cad-btn-sm cad-btn-danger', text: '×' });
          del.addEventListener('click', async () => {
            items.splice(idx, 1);
            await this._commitTasks(file, items, flashSaved, false, rawKey);
          });
        }
      });
    };

    renderRows(tasksList);

    addBtn.addEventListener('click', async () => {
      if (this.plugin.settings.taskManagementSystem === 'tasknotes') {
        const commandId = "tasknotes:create-new-task";
        const hasCommand = this.app.commands && this.app.commands.commands && this.app.commands.commands[commandId];
        if (hasCommand) {
          this.app.commands.executeCommandById(commandId);
          return;
        }

        const text = await this._prompt({
          title: 'Ajouter une tâche (TaskNotes)',
          placeholder: 'Que faut-il faire ?',
          cta: 'Ajouter',
        });
        if (!text) return;

        const folderPath = "TaskNotes/Tasks";
        await ensureFolderSync(this.app, folderPath);
        const cleanTitle = text.replace(/[\\/:*?"<>|]/g, '').trim();
        let filename = `${folderPath}/${cleanTitle}.md`;
        let existingFile = this.app.vault.getAbstractFileByPath(filename);
        let counter = 1;
        while (existingFile) {
          filename = `${folderPath}/${cleanTitle} (${counter}).md`;
          existingFile = this.app.vault.getAbstractFileByPath(filename);
          counter++;
        }

        const content = `---
title: ${text}
status: open
scheduled: ${ymd(new Date())}
projects: "[[${file.basename}]]"
priority: normal
---
`;
        await this.app.vault.create(filename, content);
        this.render();
        return;
      }
      tasks.push({ done: false, title: '' });
      await this._commitTasks(file, tasks, flashSaved, false, rawKey);
    });
  }

  async _commitTasks(file, items, flashSaved, skipRender = false, rawKey = 'Tasks') {
    const body = stringifyTasks(items);
    const content = await this.app.vault.read(file);
    const next = replaceSection(content, `## ${rawKey}`, body || '');
    await this.app.vault.modify(file, next);
    if (typeof flashSaved === 'function') flashSaved();
    if (!skipRender) this.render();
  }

  _renderMarkdownTextCard(parent, file, sectionKey, label, initialValue, placeholder, flashSaved) {
    const card = parent.createDiv({ cls: 'cad-pd-card' });
    const head = card.createDiv({ cls: 'cad-pd-card-head' });
    head.createDiv({ cls: 'cad-pd-card-title', text: label });

    const openBtn = head.createEl('button', { cls: 'cad-btn cad-btn-sm', attr: { style: 'margin-left: auto; padding: 4px 6px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; border: 1px solid var(--border-color); background: transparent; cursor: pointer;' } });
    openBtn.title = 'Open this note natively to edit with full Live Preview & Autocomplete';
    try { obsidian.setIcon(openBtn, 'file-text'); } catch (_) { }
    openBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.app.workspace.openLinkText(file.path, '', 'split');
    });

    const body = card.createDiv({ attr: { style: 'padding: 12px; min-height: 40px; position: relative;' } });

    // Preview container
    const previewDiv = body.createDiv({ cls: 'markdown-preview-view', attr: { style: 'padding: 0; min-height: 30px;' } });

    // Render the initial markdown preview
    const renderPreview = () => {
      previewDiv.empty();
      const rawText = initialValue || '';
      try {
        obsidian.MarkdownRenderer.renderMarkdown(rawText, previewDiv, file.path, this);

        // Find all standard Obsidian [[...]] internal links and bind open handlers!
        previewDiv.querySelectorAll('a.internal-link').forEach(a => {
          const href = a.getAttribute('data-href') || a.getAttribute('href');
          if (href) {
            a.addEventListener('click', (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              this.app.workspace.openLinkText(href, file.path, false);
            });
          }
        });
      } catch (e) {
        previewDiv.setText(rawText);
      }
      // Add subtle placeholder if empty
      if (!rawText.trim()) {
        const ph = previewDiv.createDiv({ text: placeholder || 'Empty section.', attr: { style: 'color: var(--text-faint); font-style: italic; font-size: 0.9em; padding: 4px 0;' } });
      }
    };
    renderPreview();
  }

  _renderProjectTextSection(parent, file, sections, def, flashSaved) {
    const initial = (sections[def.key] || '').replace(/^\s+|\s+$/g, '');
    this._renderMarkdownTextCard(parent, file, def.key, def.label, initial, def.placeholder, flashSaved);
  }

  _renderGenericTextSection(parent, file, sections, key, flashSaved) {
    const { cleanLabel } = parseHeaderKey(key);
    const initial = (sections[key] || '').replace(/^\s+|\s+$/g, '');
    this._renderMarkdownTextCard(parent, file, key, cleanLabel.toUpperCase(), initial, `Content for ${cleanLabel}...`, flashSaved);
  }

  _renderSingleCrossSection(parent, targetEntity, linkField, viewType, parentName, preFilteredList = null) {
    const def = ENTITIES[targetEntity];
    if (!def) return;

    const filteredList = preFilteredList || listEntities(this.app, targetEntity).filter(e => {
      const cache = this.app.metadataCache.getFileCache(e.file);
      const fm = cache && cache.frontmatter || {};
      const matchesLink = (val, name) => {
        if (val == null) return false;
        const cleanName = name.trim().toLowerCase();
        const arr = Array.isArray(val) ? val : [val];
        return arr.some(v => {
          const cleanV = String(v).replace(/^\[\[|\]\]$/g, '').trim().toLowerCase();
          return cleanV === cleanName;
        });
      };
      return matchesLink(fm[linkField], parentName);
    });

    const secWrap = parent.createDiv({ attr: { style: 'margin-top: 12px; margin-bottom: 12px;' } });

    if (filteredList.length === 0) {
      secWrap.createDiv({ cls: 'cad-empty', text: 'No linked items found.' });
      return;
    }

    if (viewType === 'table') {
      const columns = def.columns || [def.fields[0].key];
      this._renderEntityTable(secWrap, targetEntity, filteredList, columns);
    } else if (viewType === 'tile') {
      const grid = secWrap.createDiv({ cls: 'cad-proj-grid' });
      filteredList.forEach(e => {
        if (targetEntity === 'project') {
          // If it's a project, read its milestones progress and render the beautiful project progress card!
          const card = grid.createDiv({ cls: 'cad-proj-card' });
          const head = card.createDiv({ cls: 'cad-proj-card-head' });
          const title = head.createEl('a', { cls: 'cad-proj-title', text: entityValue(e, 'name', def) || e.basename });
          title.addEventListener('click', (ev) => { ev.preventDefault(); this.openEntityDetail('project', e.file); });

          const status = String(entityValue(e, 'status', def) || 'active');
          const priority = String(entityValue(e, 'priority', def) || '');
          const pillRow = head.createDiv({ cls: 'cad-proj-pills' });
          pillRow.createSpan({ cls: `cad-pill cad-pill-${status.toLowerCase().replace(/\s+/g, '-')}`, text: status });
          if (priority) pillRow.createSpan({ cls: `cad-pill cad-pill-prio-${priority.toLowerCase()}`, text: priority });

          const metaRow = card.createDiv({ cls: 'cad-proj-meta' });
          const owner = entityValue(e, 'owner', def);
          const due = entityValue(e, 'due', def);
          if (owner) this._renderOwnerLinks(metaRow, owner);
          if (due) metaRow.createSpan({ text: `Due: ${fmtValue(due, 'date')}` });

          const progWrap = card.createDiv({ cls: 'cad-proj-progress-wrap' });
          const progLabel = progWrap.createDiv({ cls: 'cad-proj-progress-label' });
          const progTextSpan = progLabel.createSpan({ text: 'Loading milestones...' });
          const progPctSpan = progLabel.createSpan({ cls: 'cad-proj-progress-pct', text: '' });

          const bar = progWrap.createDiv({ cls: 'cad-proj-progress-bar' });
          const fill = bar.createDiv({ cls: 'cad-proj-progress-fill' });
          fill.style.width = '0%';

          const nextRow = card.createDiv({ cls: 'cad-proj-next' });

          // Load metadata asynchronously to keep render synchronous
          readProjectMeta(this.app, e.file).then(pm => {
            progWrap.dataset.pctBand = pctBand(pm.percent);
            progTextSpan.setText(`${pm.done}/${pm.total} milestones`);
            progPctSpan.setText(`${pm.percent}%`);
            fill.style.width = `${pm.percent}%`;

            if (pm.next) {
              nextRow.createSpan({ cls: 'cad-proj-next-label', text: 'NEXT · ' });
              nextRow.createSpan({ cls: 'cad-proj-next-date', text: fmtValue(pm.next.date, 'date') });
              if (pm.next.title) nextRow.createSpan({ text: ` — ${pm.next.title}` });
            }
          });
        } else {
          // Beautiful general cards for contacts, companies, partners, deals, etc.
          const card = grid.createDiv({ cls: 'cad-proj-card' });
          const head = card.createDiv({ cls: 'cad-proj-card-head' });

          const primaryField = def.fields.find(f => f.primary) || def.fields[0];
          const titleText = entityValue(e, primaryField.key, def) || e.basename;
          const title = head.createEl('a', { cls: 'cad-proj-title', text: titleText });
          title.addEventListener('click', (ev) => { ev.preventDefault(); this.openEntityDetail(targetEntity, e.file); });

          const pillRow = head.createDiv({ cls: 'cad-proj-pills' });
          const statusField = def.fields.find(f => f.key === 'status' || f.key === 'type' || f.key === 'tier') || def.fields.find(f => f.type === 'enum');
          if (statusField) {
            const val = entityValue(e, statusField.key, def);
            if (val) {
              const clean = Array.isArray(val) ? val[0] : val;
              pillRow.createSpan({ cls: `cad-pill cad-pill-${String(clean).toLowerCase().replace(/\s+/g, '-')}`, text: String(clean) });
            }
          }

          const metaRow = card.createDiv({ cls: 'cad-proj-meta' });
          let count = 0;
          def.fields.forEach(f => {
            if (f.key !== primaryField.key && (!statusField || f.key !== statusField.key) && count < 4) {
              const val = entityValue(e, f.key, def);
              if (val != null && val !== '') {
                count++;
                const fieldDiv = metaRow.createDiv();
                fieldDiv.style.marginBottom = '2px';
                fieldDiv.createSpan({ text: `${f.label}: `, attr: { style: 'font-weight: 500; color: var(--text-muted);' }});

                const isLinkProperty = f.key === 'company' || f.key === 'contact' || f.key === 'partner' || f.key === 'owner' || f.key === 'project' || (f.suggestionSource && f.suggestionSource.startsWith('folder:'));
                if (isLinkProperty) {
                  const links = parseLinkValues(val);
                  links.forEach((link, lidx) => {
                    if (lidx > 0) fieldDiv.createSpan({ text: ', ' });
                    const aLink = fieldDiv.createEl('a', { text: link.display });
                    aLink.style.textDecoration = 'underline';
                    aLink.style.cursor = 'pointer';
                    aLink.addEventListener('click', (ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      const targetFile = this.app.vault.getMarkdownFiles().find(f => f.basename.toLowerCase() === link.target.toLowerCase());

                      let relatedKey = f.key === 'owner' ? 'contact' : f.key;
                      if (f.suggestionSource && f.suggestionSource.startsWith('folder:')) {
                        const folder = f.suggestionSource.replace('folder:', '').split('/').pop().toLowerCase();
                        const found = Object.keys(ENTITIES).find(k => ENTITIES[k].folder.toLowerCase().endsWith(folder) || ENTITIES[k].plural.toLowerCase() === folder);
                        if (found) relatedKey = found;
                      }
                      if (targetFile) this.openEntityDetail(relatedKey, targetFile);
                      else this.app.workspace.openLinkText(link.target, '', false);
                    });
                  });
                } else {
                  fieldDiv.createSpan({ text: fmtValue(val, f.type) });
                }
              }
            }
          });
        }
      });
    } else if (viewType === 'kanban') {
      const board = secWrap.createDiv({ cls: 'cad-kanban-board' });
      const groupField = def.fields.find(f => f.key === 'stage' || f.key === 'status' || f.key === 'type' || f.type === 'enum') || def.fields[1];
      const columns = groupField.options || ['To Do', 'In Progress', 'Done'];

      const isMobile = !!(obsidian.Platform && obsidian.Platform.isMobile);

      columns.forEach(colName => {
        const items = filteredList.filter(e => {
          const val = entityValue(e, groupField.key, def);
          const cleanVal = Array.isArray(val) ? val[0] : val;
          return String(cleanVal || '').toLowerCase() === colName.toLowerCase();
        });

        // Sum values if any (e.g. deals/projects value)
        const hasValField = def.fields.find(f => f.key === 'value' || f.key === 'amount');
        const colValueSum = hasValField ? items.reduce((s, e) => s + (Number(entityValue(e, hasValField.key, def)) || 0), 0) : 0;

        const col = board.createDiv({ cls: 'cad-kanban-col' });
        col.dataset.stage = colName;

        const colHead = col.createDiv({ cls: 'cad-kanban-col-head' });
        colHead.createDiv({ cls: 'cad-kanban-col-title', text: colName.toUpperCase() });
        colHead.createDiv({
          cls: 'cad-kanban-col-meta',
          text: hasValField ? `${items.length} · ${fmtValue(colValueSum, 'currency')}` : `${items.length}`
        });

        const list = col.createDiv({ cls: 'cad-kanban-col-list' });

        // Drag-and-drop event listeners
        list.addEventListener('dragover', (ev) => {
          ev.preventDefault();
          try { ev.dataTransfer.dropEffect = 'move'; } catch (_) { }
          col.addClass('drag-over');
        });
        list.addEventListener('dragleave', (ev) => {
          if (!col.contains(ev.relatedTarget)) col.removeClass('drag-over');
        });
        list.addEventListener('drop', async (ev) => {
          ev.preventDefault();
          col.removeClass('drag-over');
          const path = ev.dataTransfer.getData('text/cadence-entity');
          const fromStage = ev.dataTransfer.getData('text/cadence-stage');
          if (!path || fromStage === colName) return;
          const file = this.app.vault.getAbstractFileByPath(path);
          if (!file || !(file instanceof obsidian.TFile)) return;
          try {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
              const isList = groupField.type === 'multitext' || groupField.type === 'tags' || groupField.isList === true;
              const isLink = groupField.suggestionSource && groupField.suggestionSource !== 'none' && groupField.suggestionSource !== 'tags' && groupField.suggestionSource !== 'history';
              if (isList) {
                fm[groupField.key] = isLink ? [`[[${colName}]]`] : [colName];
              } else {
                fm[groupField.key] = isLink ? `[[${colName}]]` : colName;
              }
            });
            new obsidian.Notice(`Moved to ${colName}`);
            this.render();
          } catch (e) {
            new obsidian.Notice(`Failed to move: ${e.message}`);
          }
        });

        if (!items.length) {
          list.createDiv({ cls: 'cad-empty', text: '—' });
        } else {
          items.forEach(e => {
            const card = list.createDiv({ cls: 'cad-kanban-card' });
            card.dataset.path = e.file.path;

            const primaryField = def.fields.find(f => f.primary) || def.fields[0];
            card.createDiv({ cls: 'cad-kanban-card-title', text: entityValue(e, primaryField.key, def) || e.basename });

            const meta = card.createDiv({ cls: 'cad-kanban-card-meta' });
            if (hasValField) {
              const v = entityValue(e, hasValField.key, def);
              if (v) meta.createSpan({ cls: 'cad-kanban-card-value', text: fmtValue(v, 'currency') });
            }

            // Relationship links inside kanban card
            const relFields = ['company', 'contact', 'owner', 'assigned'];
            relFields.forEach(rf => {
              if (rf === groupField.key) return; // avoid redundancy
              const rfDef = def.fields.find(f => f.key === rf);
              if (rfDef) {
                const vals = parseLinkValues(entityValue(e, rf, def));
                vals.forEach(v => {
                  if (meta.children.length > 0) meta.createSpan({ text: ' · ' });
                  const link = meta.createEl('a', { text: v.display });
                  link.style.textDecoration = 'underline';
                  link.style.cursor = 'pointer';
                  link.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const targetFile = this.app.vault.getMarkdownFiles().find(f => f.basename.toLowerCase() === v.target.toLowerCase());
                    if (targetFile) this.openEntityDetail(rf === 'owner' || rf === 'assigned' ? 'contact' : rf, targetFile);
                    else this.app.workspace.openLinkText(v.target, '', false);
                  });
                });
              }
            });

            if (!isMobile) {
              card.draggable = true;
              card.addEventListener('dragstart', (ev) => {
                card.addClass('dragging');
                try {
                  ev.dataTransfer.effectAllowed = 'move';
                  ev.dataTransfer.setData('text/cadence-entity', e.file.path);
                  ev.dataTransfer.setData('text/cadence-stage', colName);
                  ev.dataTransfer.setData('text/plain', `[[${e.file.basename}]]`);
                } catch (_) { }
              });
              card.addEventListener('dragend', () => card.removeClass('dragging'));
            } else {
              card.addClass('cad-kanban-card-touch');
            }
            card.addEventListener('click', () => this.openEntityDetail(targetEntity, e.file));
          });
        }
      });
    }
  }

  _renderDynamicH2Section(parent, file, sections, rawKey, flashSaved) {
    const { cleanLabel, tag } = parseHeaderKey(rawKey);
    const cleanLower = cleanLabel.toLowerCase();

    if (tag === '#tasks' || cleanLower === 'tasks') {
      const taskList = parseTasksList(sections[rawKey] || '');
      this._renderTaskSection(parent, file, taskList, flashSaved, rawKey);
    } else if (tag === '#milestones' || cleanLower === 'milestones') {
      const milestoneList = parseMilestones(sections[rawKey] || '');
      this._renderMilestoneSection(parent, file, milestoneList, flashSaved, rawKey);
    } else if (tag.startsWith('#cross-')) {
      const crossParts = tag.slice('#cross-'.length).split('-');
      if (crossParts.length === 3) {
        const [targetEntity, linkField, viewType] = crossParts;
        const def = ENTITIES[targetEntity];
        if (def) {
          const parentName = file.basename;
          const filteredList = listEntities(this.app, targetEntity).filter(e => {
            const cache = this.app.metadataCache.getFileCache(e.file);
            const fm = cache && cache.frontmatter || {};
            const matchesLink = (val, name) => {
              if (val == null) return false;
              const cleanName = name.trim().toLowerCase();
              const arr = Array.isArray(val) ? val : [val];
              return arr.some(v => String(v).replace(/^\[\[|\]\]$/g, '').trim().toLowerCase() === cleanName);
            };
            return matchesLink(fm[linkField], parentName);
          });

          const card = parent.createDiv({ cls: 'cad-pd-card' });
          card.style.gridColumn = '1 / -1';
          const head = card.createDiv({ cls: 'cad-pd-card-head' });
          head.createDiv({ cls: 'cad-pd-card-title', text: `${cleanLabel.toUpperCase()} · ${filteredList.length}` });

          const addBtn = head.createEl('button', { cls: 'cad-btn cad-btn-sm', text: `+ Add ${def.label}` });
          addBtn.addEventListener('click', () => {
            this._createEntityFromPrompt(targetEntity, { [linkField]: `[[${parentName}]]` });
          });

          // View switcher: table / kanban / tile — saved back to the entity note
          const viewSwitch = head.createDiv({ attr: { style: 'display: flex; gap: 3px; margin-left: 8px;' } });
          const viewOptions = [
            { v: 'table', icon: 'layout-list', title: 'Table View' },
            { v: 'kanban', icon: 'kanban', title: 'Kanban Board' },
            { v: 'tile', icon: 'layout-grid', title: 'Tile Grid' }
          ];
          viewOptions.forEach(({ v, icon, title }) => {
            const vBtn = viewSwitch.createEl('button', {attr: { style: `padding: 4px 6px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; cursor: pointer; border: 1px solid var(--border-color); background: ${v === viewType ? 'var(--interactive-accent)' : 'transparent'}; color: ${v === viewType ? 'var(--text-on-accent)' : 'var(--text-muted)'};` }});
            vBtn.title = title;
            try { obsidian.setIcon(vBtn, icon); } catch (_) { }

            if (v !== viewType) {
              vBtn.addEventListener('click', async () => {
                const newTag = `#cross-${targetEntity}-${linkField}-${v}`;
                const curContent = await this.app.vault.read(file);
                const escaped = rawKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const newContent = curContent.replace(
                  new RegExp(`^(## ${escaped})$`, 'm'),
                  `## ${cleanLabel} ${newTag}`
                );
                await this.app.vault.modify(file, newContent);
                this.render();
              });
            }
          });

          const body = card.createDiv({ attr: { style: 'padding: 12px;' } });
          this._renderSingleCrossSection(body, targetEntity, linkField, viewType, parentName, filteredList);
        }
      }
    } else if (tag.startsWith('#chart-')) {
      // Format: #chart-{targetEntity}-{linkField}-{groupField}-{style}
      const chartParts = tag.slice('#chart-'.length).split('-');
      if (chartParts.length >= 4) {
        const targetEntity = chartParts[0];
        const linkField = chartParts[1];
        const groupField = chartParts[2];
        const chartStyle = chartParts.slice(3).join('-'); // in case style has no dash
        const def = ENTITIES[targetEntity];
        if (def) {
          const parentName = file.basename;
          const filteredList = listEntities(this.app, targetEntity).filter(e => {
            const cache = this.app.metadataCache.getFileCache(e.file);
            const fm = cache && cache.frontmatter || {};
            const matchesLink = (val, name) => {
              if (val == null) return false;
              const cleanName = name.trim().toLowerCase();
              const arr = Array.isArray(val) ? val : [val];
              return arr.some(v => String(v).replace(/^\[\[|\]\]$/g, '').trim().toLowerCase() === cleanName);
            };
            return matchesLink(fm[linkField], parentName);
          });

          // Build counts grouped by groupField
          const counts = {};
          filteredList.forEach(e => {
            const cache = this.app.metadataCache.getFileCache(e.file);
            const fm = cache && cache.frontmatter || {};
            let val = fm[groupField];
            const vals = Array.isArray(val) ? val : [val == null ? '' : val];
            vals.forEach(v => {
              const label = String(v).replace(/^\[\[|\]\]$/g, '').trim() || 'Unspecified';
              counts[label] = (counts[label] || 0) + 1;
            });
          });
          const chartData = Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

          const card = parent.createDiv({ cls: 'cad-pd-card' });
          card.style.gridColumn = '1 / -1';
          const head = card.createDiv({ cls: 'cad-pd-card-head' });
          head.createDiv({ cls: 'cad-pd-card-title', text: `${cleanLabel.toUpperCase()} · ${filteredList.length} ${def.plural}` });

          // Chart style switcher — saved back to the entity note
          const styleSwitch = head.createDiv({ attr: { style: 'display: flex; gap: 3px; margin-left: 8px;' } });
          [{ v: 'donut', icon: '🍩' }, { v: 'bar', icon: '📊' }, { v: 'kpi', icon: '🗃️' }, { v: 'list', icon: '📋' }].forEach(({ v, icon }) => {
            const sBtn = styleSwitch.createEl('button', {
              text: icon,
              attr: { style: `padding: 1px 5px; font-size: 0.85em; border-radius: 3px; cursor: pointer; border: 1px solid var(--border-color); background: ${v === chartStyle ? 'var(--interactive-accent)' : 'transparent'}; opacity: ${v === chartStyle ? '1' : '0.55'};` }
});
            sBtn.title = v;
            if (v !== chartStyle) {
              sBtn.addEventListener('click', async () => {
                const newTag = '#chart-' + chartParts.slice(0, 3).join('-') + '-' + v;
                const curContent = await this.app.vault.read(file);
                const escaped = rawKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const newContent = curContent.replace(
                  new RegExp(`^(## ${escaped})$`, 'm'),
                  `## ${cleanLabel} ${newTag}`
                );
                await this.app.vault.modify(file, newContent);
                this.render();
              });
            }
          });

          const body = card.createDiv({ cls: 'cad-dash-card-body', attr: { style: 'flex: 1; min-height: 180px; display: flex; flex-direction: column; justify-content: center; padding: 14px;' } });
          this._drawChart(body.createDiv(), chartStyle, chartData);
        }
      }
    } else {
      this._renderGenericTextSection(parent, file, sections, rawKey, flashSaved);
    }
  }

  _renderCrossSections(parent, parentEntity, parentName) {
    const crossSections = this.plugin.settings.crossSections || [];
    const configs = crossSections.filter(c => c.parentEntity === parentEntity);
    if (configs.length === 0) return;

    const matchesLink = (val, name) => {
      if (val == null) return false;
      const cleanName = name.trim().toLowerCase();
      const arr = Array.isArray(val) ? val : [val];
      return arr.some(v => {
        const cleanV = String(v).replace(/^\[\[|\]\]$/g, '').trim().toLowerCase();
        return cleanV === cleanName;
      });
    };

    configs.forEach(config => {
      const def = ENTITIES[config.targetEntity];
      if (!def) return;

      const filteredList = listEntities(this.app, config.targetEntity).filter(e => {
        const cache = this.app.metadataCache.getFileCache(e.file);
        const fm = cache && cache.frontmatter || {};
        return matchesLink(fm[config.linkField], parentName);
      });

      const secWrap = parent.createDiv({ attr: { style: 'margin-top: 24px; margin-bottom: 24px;' } });

      const head = secWrap.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;' } });
      head.createEl('h3', {
        text: `${def.plural.toUpperCase()} (${config.linkField.toUpperCase()}) — ${config.viewType.toUpperCase()}`,
        attr: { style: 'margin: 0; font-size: 1.1em; font-weight: 700; letter-spacing: 0.05em;' }
});

      const delBtn = head.createEl('button', { text: '×', attr: { style: 'color: var(--text-error); border: 1px solid var(--text-error); padding: 2px 8px; font-weight: bold; border-radius: 4px; background: transparent; cursor: pointer;' } });
      delBtn.title = 'Supprimer cette section croisée';
      delBtn.addEventListener('click', async () => {
        if (!confirm('Supprimer cette section croisée ?')) return;
        this.plugin.settings.crossSections = (this.plugin.settings.crossSections || []).filter(c => c.id !== config.id);
        await this.plugin.saveSettings();
        this.render();
      });

      if (filteredList.length === 0) {
        secWrap.createDiv({ cls: 'cad-empty', text: 'Aucun élément lié trouvé.' });
        return;
      }

      if (config.viewType === 'table') {
        const columns = def.columns || [def.fields[0].key];
        this._renderEntityTable(secWrap, config.targetEntity, filteredList, columns);
      } else if (config.viewType === 'tile') {
        const grid = secWrap.createDiv({ attr: { style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 12px;' } });
        filteredList.forEach(e => {
          const card = grid.createDiv({ cls: 'cad-proj-card', attr: { style: 'cursor: pointer; padding: 16px; background: var(--background-secondary); border: 1px solid var(--border-color); border-radius: 6px;' } });
          const title = card.createEl('h4', { text: entityValue(e, def.fields[0].key, def) || e.basename, attr: { style: 'margin: 0 0 8px 0; font-weight: 600;' } });
          card.addEventListener('click', () => this.openEntityDetail(config.targetEntity, e.file));

          const meta = card.createDiv({ attr: { style: 'font-size: 0.85em; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px;' } });
          def.fields.slice(1, 4).forEach(f => {
            const val = entityValue(e, f.key, def);
            if (val != null && val !== '') {
              meta.createDiv({ text: `${f.label}: ${fmtValue(val, f.type)}` });
            }
          });
        });
      } else if (config.viewType === 'kanban') {
        const kanbanWrap = secWrap.createDiv({ attr: { style: 'display: flex; gap: 16px; overflow-x: auto; padding-bottom: 8px; margin-top: 12px;' } });
        const groupField = def.fields.find(f => f.key === 'stage' || f.key === 'status' || f.key === 'type' || f.type === 'enum') || def.fields[1];
        const columns = groupField.options || ['To Do', 'In Progress', 'Done'];

        columns.forEach(colName => {
          const col = kanbanWrap.createDiv({ cls: 'cad-stat-card', attr: { style: 'flex: 0 0 280px; padding: 12px; display: flex; flex-direction: column; min-height: 250px; background: var(--background-secondary); border: 1px solid var(--border-color); border-radius: 6px;' } });
          col.createDiv({ text: colName.toUpperCase(), attr: { style: 'font-weight: 700; font-size: 0.8em; letter-spacing: 0.08em; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;' } });

          const colItems = filteredList.filter(e => {
            const val = entityValue(e, groupField.key, def);
            const cleanVal = Array.isArray(val) ? val[0] : val;
            return String(cleanVal || '').toLowerCase() === colName.toLowerCase();
          });

          if (colItems.length === 0) {
            col.createDiv({ text: 'Aucun élément', attr: { style: 'color: var(--text-faint); text-align: center; margin-top: 24px; font-size: 0.85em;' } });
          } else {
            const itemsList = col.createDiv({ attr: { style: 'display: flex; flex-direction: column; gap: 8px;' } });
            colItems.forEach(e => {
              const itemCard = itemsList.createDiv({ cls: 'cad-dash-row', attr: { style: 'padding: 8px 10px; cursor: pointer; border-radius: 4px; background: var(--background-primary); border: 1px solid var(--border-color); font-weight: 500;' } });
              itemCard.setText(entityValue(e, def.fields[0].key, def) || e.basename);
              itemCard.addEventListener('click', () => this.openEntityDetail(config.targetEntity, e.file));
            });
          }
        });
      }
    });
  }

  _renderEntityLinks(parent, val, targetEntityKey, prefix = '') {
    if (!val) return;
    const items = parseLinkValues(val);
    if (items.length === 0) return;
    if (prefix) parent.createSpan({ text: prefix });
    items.forEach((item, idx) => {
      if (idx > 0) parent.createSpan({ text: ', ' });

      let resolvedKey = targetEntityKey;
      if (targetEntityKey && targetEntityKey.startsWith('folder:')) {
        const folderPath = targetEntityKey.slice('folder:'.length).replace(/\/+$/, '').toLowerCase();
        const matchedKey = Object.keys(ENTITIES).find(k => ENTITIES[k].folder.replace(/\/+$/, '').toLowerCase() === folderPath);
        if (matchedKey) {
          resolvedKey = matchedKey;
        }
      }

      const link = parent.createEl('a', { text: item.display, cls: `cad-${resolvedKey}-link` });
      link.style.textDecoration = 'underline';
      link.style.cursor = 'pointer';
      link.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const targetFile = this.app.vault.getMarkdownFiles().find(f => f.basename.toLowerCase() === item.target.toLowerCase());
        if (targetFile) {
          if (ENTITIES[resolvedKey]) {
            this.openEntityDetail(resolvedKey, targetFile);
          } else {
            this.app.workspace.openLinkText(targetFile.path, '', false);
          }
        } else {
          this.app.workspace.openLinkText(item.target, '', false);
        }
      });
    });
  }


  _renderOwnerLinks(parent, ownerVal, showPrefix = true) {
    this._renderEntityLinks(parent, ownerVal, 'contact', showPrefix ? 'Owner: ' : '');
  }

  async _writeProjectFrontmatter(file, patch, flashSaved) {
    try {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        Object.entries(patch).forEach(([k, v]) => {
          if (v == null || v === '') delete fm[k];
          else fm[k] = v;
        });
      });
      if (typeof flashSaved === 'function') flashSaved();
    } catch (e) {
      new obsidian.Notice(`Save failed: ${e.message}`);
    }
  }

  /* ── Projects: rich card grid with milestone progress ─ */
  async renderProjectsView(root) {
    root.addClass('cadence-projects');
    const def = ENTITIES.project;
    const files = listEntityFiles(this.app, 'project');

    this._renderPageHeader(root, 'Projects', `${files.length} ${files.length === 1 ? 'project' : 'projects'} in ${def.folder}`, (right) => {
      const importBtn = right.createEl('button', { cls: 'cad-btn', text: 'Import CSV' });
      importBtn.addEventListener('click', () => new CadenceImportModal(this.app, { entityKey: 'project' }).open());
      const btn = right.createEl('button', { cls: 'cad-btn primary', text: '+ New Project' });
      btn.addEventListener('click', () => this._createEntityFromPrompt('project'));
    });

    if (!files.length) {
      const empty = root.createDiv({ cls: 'cad-empty-state' });
      empty.createDiv({ cls: 'cad-empty-state-title', text: 'No projects yet' });
      empty.createDiv({ cls: 'cad-empty-state-desc', text: 'Hit "+ New Project" — you\'ll get a templated note with Brief, Scope, Milestones, Tasks, Risks and Stakeholders sections ready to fill in.' });
      return;
    }

    const projects = await Promise.all(files.map(async (f) => {
      const e = readEntity(this.app, f);
      const meta = await readProjectMeta(this.app, f);
      return { entity: e, meta };
    }));

    // Group by status
    const statusOptions = getEnumOptions('project', 'status', ['active', 'on_hold', 'backlog', 'done', 'cancelled']);
    const groups = {};
    statusOptions.forEach(opt => {
      groups[opt.toLowerCase().replace(/\s+/g, '_')] = [];
    });
    projects.forEach((p) => {
      const status = String(entityValue(p.entity, 'status', def) || (statusOptions[0] || 'active')).toLowerCase().replace(/\s+/g, '_');
      const key = groups[status] ? status : Object.keys(groups)[0];
      if (key) groups[key].push(p);
    });

    const grid = root.createDiv({ cls: 'cad-proj-grid' });
    const renderCard = (p) => {
      const card = grid.createDiv({ cls: 'cad-proj-card' });
      const head = card.createDiv({ cls: 'cad-proj-card-head' });
      const title = head.createEl('a', { cls: 'cad-proj-title', text: entityValue(p.entity, 'name', def) || p.entity.basename });
      title.addEventListener('click', (ev) => { ev.preventDefault(); this.openEntityDetail('project', p.entity.file); });
      const status = String(entityValue(p.entity, 'status', def) || 'active');
      const priority = String(entityValue(p.entity, 'priority', def) || '');
      const pillRow = head.createDiv({ cls: 'cad-proj-pills' });
      pillRow.createSpan({ cls: `cad-pill cad-pill-${status.toLowerCase().replace(/\s+/g, '-')}`, text: status });
      if (priority) pillRow.createSpan({ cls: `cad-pill cad-pill-prio-${priority.toLowerCase()}`, text: priority });

      const metaRow = card.createDiv({ cls: 'cad-proj-meta' });
      const owner = entityValue(p.entity, 'owner', def);
      const due = entityValue(p.entity, 'due', def);
      if (owner) this._renderOwnerLinks(metaRow, owner);
      if (due) metaRow.createSpan({ text: `Due: ${fmtValue(due, 'date')}` });

      // Progress
      const progWrap = card.createDiv({ cls: 'cad-proj-progress-wrap' });
      progWrap.dataset.pctBand = pctBand(p.meta.percent);
      const progLabel = progWrap.createDiv({ cls: 'cad-proj-progress-label' });
      progLabel.createSpan({ text: `${p.meta.done}/${p.meta.total} milestones` });
      progLabel.createSpan({ cls: 'cad-proj-progress-pct', text: `${p.meta.percent}%` });
      const bar = progWrap.createDiv({ cls: 'cad-proj-progress-bar' });
      const fill = bar.createDiv({ cls: 'cad-proj-progress-fill' });
      fill.style.width = `${p.meta.percent}%`;

      // Next milestone
      if (p.meta.next) {
        const nextRow = card.createDiv({ cls: 'cad-proj-next' });
        nextRow.createSpan({ cls: 'cad-proj-next-label', text: 'NEXT · ' });
        nextRow.createSpan({ cls: 'cad-proj-next-date', text: fmtValue(p.meta.next.date, 'date') });
        if (p.meta.next.title) nextRow.createSpan({ text: ` — ${p.meta.next.title}` });
      }
    };

    const renderSection = (label, list) => {
      if (!list.length) return;
      root.createDiv({ cls: 'cad-section-label-lg', text: label });
      list.forEach(renderCard);
    };

    // We render section labels by intercepting renderCard placement
    // Reset grid: render in groups
    grid.remove();
    const order = statusOptions.map(opt => opt.toLowerCase().replace(/\s+/g, '_'));
    order.forEach((key) => {
      const list = groups[key];
      if (!list || !list.length) return;
      const origOpt = statusOptions.find(opt => opt.toLowerCase().replace(/\s+/g, '_') === key) || key;
      root.createDiv({ cls: 'cad-section-label-lg', text: origOpt.toUpperCase() });
      const section = root.createDiv({ cls: 'cad-proj-grid' });
      list.forEach((p) => {
        const card = section.createDiv({ cls: 'cad-proj-card' });
        const head = card.createDiv({ cls: 'cad-proj-card-head' });
        const title = head.createEl('a', { cls: 'cad-proj-title', text: entityValue(p.entity, 'name', def) || p.entity.basename });
        title.addEventListener('click', (ev) => { ev.preventDefault(); this.openEntityDetail('project', p.entity.file); });
        const status = String(entityValue(p.entity, 'status', def) || 'active');
        const priority = String(entityValue(p.entity, 'priority', def) || '');
        const pillRow = head.createDiv({ cls: 'cad-proj-pills' });
        pillRow.createSpan({ cls: `cad-pill cad-pill-${status.toLowerCase().replace(/\s+/g, '-')}`, text: status });
        if (priority) pillRow.createSpan({ cls: `cad-pill cad-pill-prio-${priority.toLowerCase()}`, text: priority });

        const metaRow = card.createDiv({ cls: 'cad-proj-meta' });
        const owner = entityValue(p.entity, 'owner', def);
        const due = entityValue(p.entity, 'due', def);
        if (owner) this._renderOwnerLinks(metaRow, owner);
        if (due) metaRow.createSpan({ text: `Due: ${fmtValue(due, 'date')}` });

        const progWrap = card.createDiv({ cls: 'cad-proj-progress-wrap' });
        const progLabel = progWrap.createDiv({ cls: 'cad-proj-progress-label' });
        progLabel.createSpan({ text: `${p.meta.done}/${p.meta.total} milestones` });
        progLabel.createSpan({ cls: 'cad-proj-progress-pct', text: `${p.meta.percent}%` });
        const bar = progWrap.createDiv({ cls: 'cad-proj-progress-bar' });
        const fill = bar.createDiv({ cls: 'cad-proj-progress-fill' });
        fill.style.width = `${p.meta.percent}%`;

        if (p.meta.next) {
          const nextRow = card.createDiv({ cls: 'cad-proj-next' });
          nextRow.createSpan({ cls: 'cad-proj-next-label', text: 'NEXT · ' });
          nextRow.createSpan({ cls: 'cad-proj-next-date', text: fmtValue(p.meta.next.date, 'date') });
          if (p.meta.next.title) nextRow.createSpan({ text: ` — ${p.meta.next.title}` });
        }
      });
    });
  }

  /* ── Home / Command Centre ───────────────── */
  async renderHome(root) {
    root.addClass('cadence-home');
    const settings = this.plugin.settings;

    /* Header */
    const today = new Date();
    const dateStr = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    this._renderPageHeader(root, `${greeting()}.`, dateStr, (right) => {
      const mk = (label, fn) => {
        const b = right.createEl('button', { cls: 'cad-btn', text: label });
        b.addEventListener('click', fn);
        return b;
      };
      mk('+ Task', () => this._quickAddTodayTask());
      mk('+ Deal', () => this._createEntityFromPrompt('deal'));
      mk('+ Contact', () => this._createEntityFromPrompt('contact'));
      mk('+ Project', () => this._createEntityFromPrompt('project'));
      const newInbox = mk('+ Inbox', () => this.plugin.openQuickCapture());
      newInbox.classList.add('primary');
    });

    /* Top of the day — assistant-style briefing */
    await this._renderBriefing(root);

    /* Two-column grid */
    const cols = root.createDiv({ cls: 'cad-home-cols' });
    const left = cols.createDiv({ cls: 'cad-home-col' });
    const right = cols.createDiv({ cls: 'cad-home-col' });

    /* ─── LEFT: Inbox + Today + Week + Upcoming + Partners ─── */
    await this._homeInboxCard(left);
    await this._homeTodayCard(left);
    await this._homeWeekCard(left);
    await this._homeUpcomingCard(left);
    await this._homePartnersCard(left);

    /* ─── RIGHT: Projects + Pipeline + Activities ─── */
    await this._homeProjectsCard(right);
    await this._homePipelineCard(right);
    await this._homeActivitiesCard(right);


  }

  _homeCard(parent, title, action, tone) {
    const card = parent.createDiv({ cls: 'cad-home-card' });
    if (tone) card.dataset.tone = tone;
    const head = card.createDiv({ cls: 'cad-home-card-head' });
    head.createDiv({ cls: 'cad-home-card-title', text: title });
    if (typeof action === 'function') action(head);
    return card.createDiv({ cls: 'cad-home-card-body' });
  }

  /* ── Top of the day — assistant-style daily briefing ── */
  async _renderBriefing(root) {
    let items = await this._computeBriefing();
    const card = root.createDiv({ cls: 'cad-briefing' });

    const head = card.createDiv({ cls: 'cad-briefing-head' });
    head.createDiv({ cls: 'cad-briefing-eyebrow', text: 'TOP OF THE DAY' });
    head.createDiv({ cls: 'cad-briefing-headline', text: this._briefingHeadline(items) });

    if (!items.length) {
      card.createDiv({ cls: 'cad-briefing-empty', text: 'Nothing flagged. Make today count.' });
      return;
    }

    // On mobile, trim to the top 3 most urgent. _computeBriefing already
    // emits items in priority order (overdue → time → opportunity → wins),
    // so a simple slice keeps what matters most.
    const isMobile = !!(obsidian.Platform && obsidian.Platform.isMobile);
    const hiddenCount = isMobile && items.length > 3 ? items.length - 3 : 0;
    if (isMobile && items.length > 3) items = items.slice(0, 3);

    const list = card.createDiv({ cls: 'cad-briefing-list' });
    items.forEach((it) => {
      const row = list.createDiv({ cls: `cad-briefing-row cad-tone-${it.tone || 'emerald'}` });
      row.createSpan({ cls: 'cad-briefing-icon', text: it.icon });
      row.createSpan({ cls: 'cad-briefing-text', text: it.text });
      if (it.action) {
        row.classList.add('clickable');
        row.addEventListener('click', it.action);
      }
    });
    if (hiddenCount > 0) {
      const more = card.createDiv({ cls: 'cad-briefing-more' });
      more.setText(`+${hiddenCount} more · scroll down for the full picture`);
    }
  }

  _briefingHeadline(items) {
    const hasOverdue = items.some((i) => i.tone === 'rose');
    if (hasOverdue) return 'A couple of things need attention this morning.';
    if (items.length >= 4) return "Here's what's worth your attention today.";
    if (items.length === 0) return 'Inbox zero. Clear runway.';
    return "Here's what's on your radar.";
  }

  async _computeBriefing() {
    const items = [];
    const settings = this.plugin.settings;
    const dealDef = ENTITIES.deal;
    const contactDef = ENTITIES.contact;
    const today = startOfDay(new Date());
    const todayMs = today.getTime();
    const nowMs = Date.now();

    /* 1. Open tasks today */
    try {
      let openTasks = 0;
      if (settings.taskManagementSystem === 'tasknotes') {
        const todayYmd = ymd(new Date());
        const allTaskNotes = listTaskNotesTasks(this.app);
        openTasks = allTaskNotes.filter(t => t.scheduled === todayYmd && !t.done).length;
      } else {
        const file = await ensureDailyNote(this.app, settings);
        const content = await this.app.vault.read(file);
        const parsed = parseSections(content, settings);
        openTasks = parsed.tasks.filter((l) => / \[ \] /.test(l)).length;
      }
      if (openTasks > 0) {
        items.push({
          icon: '🎯',
          tone: 'emerald',
          text: settings.taskManagementSystem === 'tasknotes'
            ? `${openTasks} open ${openTasks === 1 ? 'task' : 'tasks'} scheduled for today`
            : `${openTasks} open ${openTasks === 1 ? 'task' : 'tasks'} on today's note`,
          action: () => this.setMode('planner.today'),
        });
      }
    } catch (_) { }

    /* 2. Overdue reminders */
    const reminders = (settings.reminders || []).filter((r) => !r.done);
    const overdue = reminders.filter((r) => r.when && new Date(r.when).getTime() <= nowMs);
    if (overdue.length) {
      const ex = overdue[0];
      const exTxt = ex.text.length > 50 ? ex.text.slice(0, 47) + '…' : ex.text;
      items.push({
        icon: '⚠',
        tone: 'rose',
        text: overdue.length === 1
          ? `Overdue reminder — "${exTxt}"`
          : `${overdue.length} overdue reminders — "${exTxt}" + ${overdue.length - 1} more`,
        action: () => this.setMode('planner.inbox'),
      });
    }

    /* 3. Reminders due later today */
    const dueToday = reminders.filter((r) => {
      if (!r.when) return false;
      const w = new Date(r.when).getTime();
      return w > nowMs && w < todayMs + 86400000;
    });
    if (dueToday.length) {
      items.push({
        icon: '⏰',
        tone: 'mint',
        text: `${dueToday.length} ${dueToday.length === 1 ? 'reminder' : 'reminders'} due later today`,
        action: () => this.setMode('planner.inbox'),
      });
    }

    /* 4. Deals closing this week */
    const deals = listEntities(this.app, 'deal');
    const weekEnd = todayMs + 7 * 86400000;
    const closingThisWeek = deals.filter((e) => {
      const stage = String(entityValue(e, 'stage', dealDef));
      if (['Won', 'Lost'].includes(stage)) return false;
      const closeBy = entityValue(e, 'closeBy', dealDef);
      if (!closeBy) return false;
      const d = new Date(closeBy);
      return !isNaN(d.getTime()) && d.getTime() >= todayMs && d.getTime() <= weekEnd;
    });
    if (closingThisWeek.length) {
      const value = closingThisWeek.reduce((s, e) => s + (Number(entityValue(e, 'value', dealDef)) || 0), 0);
      items.push({
        icon: '💼',
        tone: 'sky',
        text: `${closingThisWeek.length} ${closingThisWeek.length === 1 ? 'deal closes' : 'deals close'} this week · ${fmtValue(value, 'currency')}`,
        action: () => this.setMode('crm.pipeline'),
      });
    }

    /* 5. Stale contacts on open deals (>30 days since lastContact) */
    const contacts = listEntities(this.app, 'contact');
    const openDeals = deals.filter((e) => !['Won', 'Lost'].includes(String(entityValue(e, 'stage', dealDef))));
    const dealContactNames = new Set(
      openDeals.map((d) => String(entityValue(d, 'contact', dealDef) || '').trim()).filter(Boolean)
    );
    const staleCutoffMs = todayMs - 30 * 86400000;
    let staleSample = null;
    let staleCount = 0;
    contacts.forEach((c) => {
      const name = String(entityValue(c, 'name', contactDef) || '').trim();
      if (!name || !dealContactNames.has(name)) return;
      const lc = entityValue(c, 'lastContact', contactDef);
      const lcMs = lc ? new Date(lc).getTime() : null;
      if (lcMs != null && !isNaN(lcMs) && lcMs >= staleCutoffMs) return;
      staleCount++;
      if (!staleSample) staleSample = { contact: c, name, lcMs };
    });
    if (staleSample) {
      const days = staleSample.lcMs ? Math.floor((todayMs - staleSample.lcMs) / 86400000) : null;
      const linkedDeal = openDeals.find((d) => String(entityValue(d, 'contact', dealDef) || '').trim() === staleSample.name);
      const dealName = linkedDeal ? entityValue(linkedDeal, 'title', dealDef) || '' : '';
      const ago = days === null ? 'never contacted' : `${days} ${days === 1 ? 'day' : 'days'} quiet`;
      const more = staleCount > 1 ? ` (+${staleCount - 1} more)` : '';
      items.push({
        icon: '👤',
        tone: 'warn',
        text: `${staleSample.name} — ${ago}${dealName ? ` · ${dealName}` : ''}${more}`,
        action: () => this.openEntityDetailFromFile(staleSample.contact.file),
      });
    }

    /* 6. Upcoming project milestones (next 14 days) */
    const projectFiles = listEntityFiles(this.app, 'project');
    const upcoming = [];
    for (const f of projectFiles) {
      try {
        const meta = await readProjectMeta(this.app, f);
        if (meta.next && meta.next.date) {
          const ms = meta.next.date.getTime();
          if (ms >= todayMs && ms <= todayMs + 14 * 86400000) {
            upcoming.push({ file: f, milestone: meta.next, name: projectNameFromPath(this.app, f.path) });
          }
        }
      } catch (_) { }
    }
    upcoming.sort((a, b) => a.milestone.date - b.milestone.date);
    if (upcoming.length) {
      const m = upcoming[0];
      const days = Math.max(0, Math.ceil((m.milestone.date.getTime() - todayMs) / 86400000));
      const dayStr = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
      const title = m.milestone.title || 'milestone';
      items.push({
        icon: '📅',
        tone: 'mint',
        text: `${m.name} · "${title}" — due ${dayStr}`,
        action: () => this.openEntityDetail('project', m.file),
      });
    }

    /* 7. Recent wins (deals moved to Won in last 7 days) */
    const winCutoff = nowMs - 7 * 86400000;
    const recentWins = deals.filter((e) => {
      if (String(entityValue(e, 'stage', dealDef)) !== 'Won') return false;
      return e.file && e.file.stat && e.file.stat.mtime >= winCutoff;
    });
    if (recentWins.length) {
      const value = recentWins.reduce((s, e) => s + (Number(entityValue(e, 'value', dealDef)) || 0), 0);
      items.push({
        icon: '🎉',
        tone: 'emerald',
        text: `${recentWins.length} ${recentWins.length === 1 ? 'deal won' : 'deals won'} this week · ${fmtValue(value, 'currency')}`,
        action: () => this.setMode('reports.sales'),
      });
    }

    return items;
  }

  async _homeInboxCard(parent) {
    const reminders = (this.plugin.settings.reminders || []).filter((r) => !r.done);
    const overdueCount = reminders.filter((r) => r.when && new Date(r.when).getTime() <= Date.now()).length;
    const tone = overdueCount > 0 ? 'rose' : 'sky';

    const headTitle = `INBOX — ${reminders.length} item${reminders.length === 1 ? '' : 's'}${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`;
    const body = this._homeCard(parent, headTitle, (head) => {
      const cap = head.createEl('a', { cls: 'cad-home-card-link', text: '+ Capture' });
      cap.style.marginRight = '12px';
      cap.addEventListener('click', (e) => { e.preventDefault(); this.plugin.openQuickCapture(); });
      const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Inbox →' });
      link.addEventListener('click', (e) => { e.preventDefault(); this.setMode('planner.inbox'); });
    }, tone);

    if (!reminders.length) {
      body.createDiv({ cls: 'cad-empty', text: 'Inbox zero — capture anything with + Inbox above (or Cmd+Shift+I).' });
      return;
    }

    // Sort: scheduled by when ascending, unscheduled fall to the end
    const sorted = [...reminders].sort((a, b) => {
      const wa = a.when ? new Date(a.when).getTime() : Infinity;
      const wb = b.when ? new Date(b.when).getTime() : Infinity;
      return wa - wb;
    });

    sorted.slice(0, 5).forEach((r) => {
      const row = body.createDiv({ cls: 'cad-home-row' });
      const isOverdue = r.when && new Date(r.when).getTime() <= Date.now();
      if (isOverdue) row.classList.add('overdue');
      row.createDiv({ cls: 'cad-home-row-date', text: r.when ? reminderTimeStr(r.when) : 'unscheduled' });
      const main = row.createDiv({ cls: 'cad-home-row-main' });
      main.createDiv({ cls: 'cad-home-row-title', text: r.text });
      const metaBits = [];
      if (r.project) metaBits.push(`📁 ${projectNameFromPath(this.app, r.project) || 'project'}`);
      if (r.repeat && r.repeat !== 'none') metaBits.push(r.repeat === 'daily' ? '↻ daily' : '↻ weekly');
      if (r.notes) {
        const firstLine = String(r.notes).split('\n').find((l) => l.trim()) || '';
        if (firstLine) metaBits.push(`📝 ${firstLine.length > 60 ? firstLine.slice(0, 57) + '…' : firstLine}`);
      }
      if (metaBits.length) main.createDiv({ cls: 'cad-home-row-meta', text: metaBits.join('  ·  ') });
      row.addEventListener('click', () => new CadenceReminderEditModal(this.app, this.plugin, r).open());
    });
  }

  async _homeTodayCard(parent) {
    const settings = this.plugin.settings;
    let tasksList = [];
    let todayTaskNotes = [];
    let file = null;

    if (settings.taskManagementSystem === 'tasknotes') {
      const todayYmd = ymd(new Date());
      const allTaskNotes = listTaskNotesTasks(this.app);
      todayTaskNotes = allTaskNotes.filter(t => t.scheduled === todayYmd);
      tasksList = todayTaskNotes.map(t => `- [${t.done ? 'x' : ' '}] ${t.title}`);
    } else {
      file = await ensureDailyNote(this.app, settings);
      const content = await this.app.vault.read(file);
      const parsed = parseSections(content, settings);
      tasksList = parsed.tasks;
    }

    const open = tasksList.filter((l) => / \[ \] /.test(l));
    const done = tasksList.filter((l) => / \[(x|X)\] /.test(l));

    const body = this._homeCard(parent, `TODAY — ${open.length} open · ${done.length} done`, (head) => {
      const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Today →' });
      link.addEventListener('click', (e) => { e.preventDefault(); this.setMode('planner.today'); });
    }, 'emerald');

    if (!tasksList.length) {
      body.createDiv({ cls: 'cad-empty', text: 'No tasks yet — add one with + Task above.' });
      return;
    }

    tasksList.forEach((rawLine, idx) => {
      const checked = / \[(x|X)\] /.test(rawLine);
      const text = rawLine.replace(/^\s*-\s\[(x|X| )\]\s/, '');
      const row = body.createDiv({ cls: 'cad-home-task' + (checked ? ' done' : '') });
      const cb = row.createEl('input', { type: 'checkbox' });
      cb.checked = checked;
      cb.addEventListener('change', async () => {
        if (settings.taskManagementSystem === 'tasknotes') {
          const taskObj = todayTaskNotes[idx];
          await toggleTaskNotesTask(this.app, taskObj.file, cb.checked);
        } else {
          const cur = await this.app.vault.read(file);
          const cp = parseSections(cur, settings);
          const taskLine = cp.tasks[idx] || '';
          const taskText = taskLine.replace(/^\s*-\s\[(x|X| )\]\s/, '').trim();
          const newTasks = cp.tasks.map((line, i) => {
            if (i !== idx) return line;
            return cb.checked
              ? line.replace(/^\s*-\s\[\s\]\s/, '- [x] ')
              : line.replace(/^\s*-\s\[(x|X)\]\s/, '- [ ] ');
          });
          const next = replaceSection(cur, settings.tasksHeading, newTasks.join('\n'));
          await this.app.vault.modify(file, next);
          if (taskText) {
            await this._propagateTaskComplete(taskText, cb.checked, { kind: 'daily', file, date: new Date() });
          }
        }
        this.render();
      });

      if (settings.taskManagementSystem === 'tasknotes') {
        const taskObj = todayTaskNotes[idx];
        const taskLink = row.createEl('a', { cls: 'cad-task-text', text });
        taskLink.style.cursor = 'pointer';
        taskLink.addEventListener('click', (e) => {
          e.preventDefault();
          this.app.workspace.openLinkText(taskObj.file.path, '', false);
        });
      } else {
        row.createSpan({ cls: 'cad-task-text', text });
      }

      /* Project link button + chip */
      let linkedProject = null;
      if (settings.taskManagementSystem === 'tasknotes') {
        const taskObj = todayTaskNotes[idx];
        if (taskObj.projects) {
          const parsed = parseLinkValues(taskObj.projects);
          if (parsed.length > 0) {
            const projFile = this.app.vault.getMarkdownFiles().find(f => f.basename === parsed[0].target);
            if (projFile) {
              linkedProject = projFile.path;
            }
          }
        }
      } else {
        linkedProject = this._getTaskProjectLink(file.path, text);
      }

      if (linkedProject) {
        const chip = row.createEl('a', { cls: 'cad-task-proj-chip', text: '📁 ' + (projectNameFromPath(this.app, linkedProject) || 'Project') });
        chip.title = 'Open linked project';
        chip.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const f = this.app.vault.getAbstractFileByPath(linkedProject);
          if (f && f instanceof obsidian.TFile) this.openEntityDetail('project', f);
        });
      }

      if (settings.taskManagementSystem !== 'tasknotes') {
        const linkBtn = row.createEl('button', { cls: 'cad-task-link-btn' + (linkedProject ? ' linked' : ''), text: linkedProject ? '✎' : '📁' });
        linkBtn.title = linkedProject ? 'Change linked project' : 'Link to a project';
        linkBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this._openTaskProjectPicker(file.path, text, linkedProject);
        });
      }
    });
  }

  async _homeWeekCard(parent) {
    const settings = this.plugin.settings;
    const weekStart = startOfWeek(new Date(), settings.weekStartsOn);
    let open = 0, done = 0;

    if (settings.taskManagementSystem === 'tasknotes') {
      const allTasks = listTaskNotesTasks(this.app);
      const weekDatesList = Array.from({ length: 7 }, (_, i) => ymd(addDays(weekStart, i)));
      allTasks.forEach((t) => {
        if (weekDatesList.includes(t.scheduled)) {
          if (t.done) done++;
          else open++;
        }
      });
    } else {
      for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i);
        const f = this.app.vault.getAbstractFileByPath(dailyNotePath(settings, d));
        if (f && f instanceof obsidian.TFile) {
          const c = await this.app.vault.read(f);
          const p = parseSections(c, settings);
          p.tasks.forEach((l) => { if (/ \[(x|X)\] /.test(l)) done++; else if (/ \[ \] /.test(l)) open++; });
        }
      }
    }
    const total = open + done;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    const body = this._homeCard(parent, `THIS WEEK — ${done}/${total} done`, (head) => {
      const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Calendar →' });
      link.addEventListener('click', (e) => { e.preventDefault(); this.setMode('planner.calendar'); });
    }, 'mint');

    const wrap = body.createDiv({ cls: 'cad-proj-progress-wrap' });
    wrap.dataset.pctBand = pctBand(pct);
    const lbl = wrap.createDiv({ cls: 'cad-proj-progress-label' });
    lbl.createSpan({ text: total ? `${done} of ${total} tasks completed` : 'No tasks logged this week yet' });
    lbl.createSpan({ cls: 'cad-proj-progress-pct', text: `${pct}%` });
    const bar = wrap.createDiv({ cls: 'cad-proj-progress-bar' });
    const fill = bar.createDiv({ cls: 'cad-proj-progress-fill' });
    fill.style.width = `${pct}%`;
  }

  async _homeUpcomingCard(parent) {
    const today = startOfDay(new Date());
    const horizon = addDays(today, 7);
    const items = [];

    // Project deadlines
    const projects = listEntities(this.app, 'project');
    projects.forEach((e) => {
      const due = entityValue(e, 'due', ENTITIES.project);
      if (!due) return;
      const d = new Date(due);
      if (isNaN(d.getTime())) return;
      if (d >= today && d <= horizon) {
        items.push({ date: d, title: entityValue(e, 'name', ENTITIES.project) || e.basename, type: 'Project due', file: e.file });
      }
    });
    // Project milestones (next upcoming per project)
    for (const e of projects) {
      try {
        const meta = await readProjectMeta(this.app, e.file);
        if (meta.next && meta.next.date && meta.next.date >= today && meta.next.date <= horizon) {
          items.push({ date: meta.next.date, title: `${entityValue(e, 'name', ENTITIES.project) || e.basename} — ${meta.next.title || 'milestone'}`, type: 'Milestone', file: e.file });
        }
      } catch (_) { }
    }
    // Registration expiries
    listEntities(this.app, 'registration').forEach((e) => {
      const exp = entityValue(e, 'expires', ENTITIES.registration);
      if (!exp) return;
      const d = new Date(exp);
      if (isNaN(d.getTime())) return;
      if (d >= today && d <= horizon) {
        items.push({ date: d, title: entityValue(e, 'title', ENTITIES.registration) || e.basename, type: 'Registration expires', file: e.file });
      }
    });
    // Cert expiries
    listEntities(this.app, 'certification').forEach((e) => {
      const exp = entityValue(e, 'expires', ENTITIES.certification);
      if (!exp) return;
      const d = new Date(exp);
      if (isNaN(d.getTime())) return;
      if (d >= today && d <= horizon) {
        items.push({ date: d, title: entityValue(e, 'name', ENTITIES.certification) || e.basename, type: 'Cert expires', file: e.file });
      }
    });

    items.sort((a, b) => a.date - b.date);
    const body = this._homeCard(parent, `UPCOMING · NEXT 7 DAYS — ${items.length}`, undefined, 'warn');
    if (!items.length) {
      body.createDiv({ cls: 'cad-empty', text: 'Nothing on the radar.' });
      return;
    }
    items.slice(0, 6).forEach((it) => {
      const row = body.createDiv({ cls: 'cad-home-row' });
      row.createDiv({ cls: 'cad-home-row-date', text: fmtValue(it.date, 'date') });
      const main = row.createDiv({ cls: 'cad-home-row-main' });
      main.createDiv({ cls: 'cad-home-row-title', text: it.title });
      main.createDiv({ cls: 'cad-home-row-meta', text: it.type });
      row.addEventListener('click', () => this.openEntityDetailFromFile(it.file));
    });
  }

  async _homePartnersCard(parent) {
    const partners = listEntities(this.app, 'partner');
    const body = this._homeCard(parent, `PARTNERS — ${partners.length}`, (head) => {
      const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Partners →' });
      link.addEventListener('click', (e) => { e.preventDefault(); this.setMode('prm.partners'); });
    }, 'sky');
    if (!partners.length) {
      body.createDiv({ cls: 'cad-empty', text: 'No partners on the books yet.' });
      return;
    }
    partners.slice(0, 5).forEach((e) => {
      const row = body.createDiv({ cls: 'cad-home-row' });
      const main = row.createDiv({ cls: 'cad-home-row-main' });
      main.createDiv({ cls: 'cad-home-row-title', text: entityValue(e, 'name', ENTITIES.partner) || e.basename });
      const tier = entityValue(e, 'tier', ENTITIES.partner) || '';
      const status = entityValue(e, 'status', ENTITIES.partner) || '';
      main.createDiv({ cls: 'cad-home-row-meta', text: [tier, status].filter(Boolean).join(' · ') });
      row.addEventListener('click', () => this.openEntityDetailFromFile(e.file));
    });
  }

  async _homeProjectsCard(parent) {
    const def = ENTITIES.project;
    const files = listEntityFiles(this.app, 'project');
    const body = this._homeCard(parent, `ACTIVE PROJECTS — ${files.length}`, (head) => {
      const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Projects →' });
      link.addEventListener('click', (e) => { e.preventDefault(); this.setMode('projects.projects'); });
    }, 'emerald');
    if (!files.length) {
      body.createDiv({ cls: 'cad-empty', text: 'No projects yet — hit + Project above.' });
      return;
    }
    const projects = await Promise.all(files.map(async (f) => {
      const e = readEntity(this.app, f);
      const status = String(entityValue(e, 'status', def) || 'active').toLowerCase();
      if (!['active', 'on_hold', 'in_progress'].includes(status.replace(/\s+/g, '_'))) return null;
      const meta = await readProjectMeta(this.app, f);
      return { entity: e, meta };
    }));
    const active = projects.filter(Boolean).slice(0, 3);
    if (!active.length) {
      body.createDiv({ cls: 'cad-empty', text: 'No active projects right now.' });
      return;
    }
    active.forEach((p) => {
      const row = body.createDiv({ cls: 'cad-home-proj' });
      row.dataset.pctBand = pctBand(p.meta.percent);
      const head = row.createDiv({ cls: 'cad-home-proj-head' });
      head.createSpan({ cls: 'cad-home-proj-title', text: entityValue(p.entity, 'name', def) || p.entity.basename });
      head.createSpan({ cls: 'cad-home-proj-pct', text: `${p.meta.percent}%` });
      const bar = row.createDiv({ cls: 'cad-proj-progress-bar' });
      const fill = bar.createDiv({ cls: 'cad-proj-progress-fill' });
      fill.style.width = `${p.meta.percent}%`;
      if (p.meta.next) {
        row.createDiv({ cls: 'cad-home-row-meta', text: `NEXT · ${fmtValue(p.meta.next.date, 'date')}${p.meta.next.title ? ' — ' + p.meta.next.title : ''}` });
      }
      row.addEventListener('click', () => this.openEntityDetail('project', p.entity.file));
    });
  }

  async _homePipelineCard(parent) {
    const def = ENTITIES.deal;
    const deals = listEntities(this.app, 'deal');
    const open = deals.filter((e) => !['Won', 'Lost'].includes(String(entityValue(e, 'stage', def))));
    const value = open.reduce((s, e) => s + (Number(entityValue(e, 'value', def)) || 0), 0);

    const body = this._homeCard(parent, `PIPELINE — ${open.length} open · ${fmtValue(value, 'currency')}`, (head) => {
      const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Pipeline →' });
      link.addEventListener('click', (e) => { e.preventDefault(); this.setMode('crm.pipeline'); });
    }, 'sky');
    if (!open.length) {
      body.createDiv({ cls: 'cad-empty', text: 'No open deals — hit + Deal above.' });
      return;
    }
    const top = [...open].sort((a, b) => (Number(entityValue(b, 'value', def)) || 0) - (Number(entityValue(a, 'value', def)) || 0)).slice(0, 4);
    top.forEach((e) => {
      const row = body.createDiv({ cls: 'cad-home-row' });
      const main = row.createDiv({ cls: 'cad-home-row-main' });
      main.createDiv({ cls: 'cad-home-row-title', text: entityValue(e, 'title', def) || e.basename });
      const stage = entityValue(e, 'stage', def);
      main.createDiv({ cls: 'cad-home-row-meta', text: `${stage || '—'} · ${fmtValue(entityValue(e, 'value', def), 'currency')}` });
      row.addEventListener('click', () => this.openEntityDetailFromFile(e.file));
    });
  }

  async _homeActivitiesCard(parent) {
    const def = ENTITIES.activity;
    const acts = listEntities(this.app, 'activity');
    const body = this._homeCard(parent, `RECENT ACTIVITY — ${acts.length}`, (head) => {
      const link = head.createEl('a', { cls: 'cad-home-card-link', text: 'Open Activities →' });
      link.addEventListener('click', (e) => { e.preventDefault(); this.setMode('crm.activities'); });
    }, 'rose');
    if (!acts.length) {
      body.createDiv({ cls: 'cad-empty', text: 'No activities logged yet.' });
      return;
    }
    const sorted = [...acts].sort((a, b) => {
      const da = new Date(entityValue(a, 'when', def) || 0).getTime();
      const db = new Date(entityValue(b, 'when', def) || 0).getTime();
      return db - da;
    }).slice(0, 5);
    sorted.forEach((e) => {
      const row = body.createDiv({ cls: 'cad-home-row' });
      const main = row.createDiv({ cls: 'cad-home-row-main' });
      main.createDiv({ cls: 'cad-home-row-title', text: entityValue(e, 'subject', def) || e.basename });
      main.createDiv({ cls: 'cad-home-row-meta', text: `${entityValue(e, 'type', def) || '—'} · ${fmtValue(entityValue(e, 'when', def), 'date')}` });
      row.addEventListener('click', () => this.openEntityDetailFromFile(e.file));
    });
  }

  async renderTemplatesDashboard(root) {
    root.addClass('cadence-dashboard');
    root.addClass('cadence-projects');

    this._renderPageHeader(root, 'Templates Dashboard', 'Manage and visually edit the templates for your entities');

    const grid = root.createDiv({
      cls: 'cad-proj-grid'
    });

    // Render Daily Note Template Card
    {
      const templatesFolder = 'Cadence/Templates';
      await ensureFolderSync(this.app, templatesFolder);
      const dailyTemplatePath = `${templatesFolder}/daily.md`;
      const dailyTFile = this.app.vault.getAbstractFileByPath(dailyTemplatePath);
      const exists = !!(dailyTFile && dailyTFile instanceof obsidian.TFile);

      const card = grid.createDiv({
        cls: 'cad-proj-card cad-template-tile'
      });
      card.dataset.entity = 'daily';

      const head = card.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;' } });

      const infoWrap = head.createDiv({ attr: { style: 'display: flex; align-items: center; gap: 12px;' } });
      const iconSpan = infoWrap.createSpan({ cls: 'cad-template-tile-icon' });
      try { obsidian.setIcon(iconSpan, 'sun'); } catch (_) { iconSpan.setText('☀️'); }

      const titleInfo = infoWrap.createDiv();
      titleInfo.createDiv({ text: 'PLANNER', attr: { style: 'font-weight: 700; font-size: 0.7rem; letter-spacing: 0.12em; color: var(--text-muted);' } });
      titleInfo.createEl('h3', { text: 'Daily Note', attr: { style: 'margin: 2px 0 0 0; font-size: 1.15em; font-weight: 700;' } });

      const badge = head.createSpan({
        cls: exists ? 'cad-pill cad-pill-active' : 'cad-pill cad-pill-backlog',
        text: exists ? 'Active Template' : 'Default'
      });
      badge.style.fontSize = '0.7em';
      badge.style.padding = '3px 8px';

      card.createDiv({
        text: `Target Folder: ${this.plugin.settings.dailyNoteFolder || 'daily'}/`,
        attr: { style: 'font-size: 0.8em; font-family: monospace; color: var(--text-muted); background: var(--background-secondary); padding: 4px 8px; border-radius: 4px; margin-bottom: 12px; border: 1px solid var(--background-modifier-border);' }
});

      const desc = card.createDiv({ text: `Defines properties and sections layout for each new daily note created in the planner.`, attr: { style: 'font-size: 0.85em; color: var(--text-muted); margin-bottom: 18px; flex: 1; line-height: 1.4;' } });

      const actions = card.createDiv({ attr: { style: 'display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid var(--border-color); padding-top: 14px; margin-top: auto;' } });

      if (exists) {
        const editBtn = actions.createEl('button', { cls: 'cad-btn primary', text: 'Visual Editor' });
        editBtn.style.padding = '5px 12px';
        editBtn.style.height = 'auto';
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openTemplateDetail('daily', dailyTFile);
        });

        const openBtn = actions.createEl('button', { cls: 'cad-btn', text: 'Raw Note 📝' });
        openBtn.style.padding = '5px 12px';
        openBtn.style.height = 'auto';
        openBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.app.workspace.openLinkText(dailyTemplatePath, '', false);
        });
      } else {
        const resetBtn = actions.createEl('button', {
          cls: 'cad-btn primary',
          text: 'Enable Custom'
        });
        resetBtn.style.padding = '5px 12px';
        resetBtn.style.height = 'auto';
        resetBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const dailyTemplateContent = [
            '# {{date}}',
            '',
            '## Today',
            '- [ ] ',
            '',
            '## Journal',
            '',
            ''
          ].join('\n');
          await this.app.vault.create(dailyTemplatePath, dailyTemplateContent);
          new obsidian.Notice('Daily Note template successfully enabled.');
          this.render();
        });
      }

      card.addEventListener('click', () => {
        if (exists) this.openTemplateDetail('daily', dailyTFile);
      });
    }

    for (const [entityKey, def] of Object.entries(ENTITIES)) {
      const templatesFolder = 'Cadence/Templates';
      await ensureFolderSync(this.app, templatesFolder);

      let foundPath = null;
      let exists = false;
      const pathsToTry = [
        `${templatesFolder}/${entityKey}.md`,
        `${templatesFolder}/${def.label}.md`,
        `${templatesFolder}/${def.plural}.md`,
        `${templatesFolder}/${entityKey.toLowerCase()}.md`,
        `${templatesFolder}/${def.label.toLowerCase()}.md`,
        `${templatesFolder}/${def.plural.toLowerCase()}.md`
      ];

      for (const p of pathsToTry) {
        const tFile = this.app.vault.getAbstractFileByPath(p);
        if (tFile && tFile instanceof obsidian.TFile) {
          exists = true;
          foundPath = p;
          break;
        }
      }

      // Elegant premium tile layout matching project notes exactly, with dynamic entity color bands
      const card = grid.createDiv({
        cls: 'cad-proj-card cad-template-tile'
      });
      card.dataset.entity = entityKey;

      const head = card.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;' } });

      const infoWrap = head.createDiv({ attr: { style: 'display: flex; align-items: center; gap: 12px;' } });
      const iconSpan = infoWrap.createSpan({ cls: 'cad-template-tile-icon' });
      try { obsidian.setIcon(iconSpan, def.icon || 'file-text'); } catch (_) { iconSpan.setText('📝'); }

      const titleInfo = infoWrap.createDiv();
      titleInfo.createDiv({ text: def.label.toUpperCase(), attr: { style: 'font-weight: 700; font-size: 0.7rem; letter-spacing: 0.12em; color: var(--text-muted);' } });
      titleInfo.createEl('h3', { text: def.plural, attr: { style: 'margin: 2px 0 0 0; font-size: 1.15em; font-weight: 700;' } });

      const badge = head.createSpan({
        cls: exists ? 'cad-pill cad-pill-active' : 'cad-pill cad-pill-backlog',
        text: exists ? 'Active Template' : 'Default'
      });
      badge.style.fontSize = '0.7em';
      badge.style.padding = '3px 8px';

      card.createDiv({
        text: `Target Folder: ${def.folder}/`,
        attr: { style: 'font-size: 0.8em; font-family: monospace; color: var(--text-muted); background: var(--background-secondary); padding: 4px 8px; border-radius: 4px; margin-bottom: 12px; border: 1px solid var(--background-modifier-border);' }
});

      const desc = card.createDiv({
        text: `Defines properties and sections layout for each new ${def.label.toLowerCase()} item created.`,
        attr: { style: 'font-size: 0.85em; color: var(--text-muted); margin-bottom: 18px; flex: 1; line-height: 1.4;' }
});

      const actions = card.createDiv({ attr: { style: 'display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid var(--border-color); padding-top: 14px; margin-top: auto;' } });

      if (exists) {
        const editBtn = actions.createEl('button', { cls: 'cad-btn primary', text: 'Visual Editor' });
        editBtn.style.padding = '5px 12px';
        editBtn.style.height = 'auto';
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tFile = this.app.vault.getAbstractFileByPath(foundPath);
          if (tFile) this.openTemplateDetail(entityKey, tFile);
        });

        const openBtn = actions.createEl('button', { cls: 'cad-btn', text: 'Raw Note 📝' });
        openBtn.style.padding = '5px 12px';
        openBtn.style.height = 'auto';
        openBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tFile = this.app.vault.getAbstractFileByPath(foundPath);
          if (tFile) this.app.workspace.openLinkText(tFile.path, '', false);
        });
      }

      const resetBtn = actions.createEl('button', {
        cls: 'cad-btn',
        text: exists ? 'Reset to Default' : 'Enable Custom'
      });
      resetBtn.style.padding = '5px 12px';
      resetBtn.style.height = 'auto';
      if (!exists) resetBtn.classList.add('primary');
      resetBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        let templateContent = entityTemplate(entityKey, '{{name}}');
        if (entityKey === 'project') {
          templateContent = projectTemplate('{{name}}');
        } else if (entityKey === 'company') {
          templateContent += '\n## Description #notes\n_Company description and profile..._\n\n## Contacts #cross-contact-company-table\n\n## Deals #cross-deal-company-kanban\n';
        } else if (entityKey === 'contact') {
          templateContent += '\n## Bio #notes\n_Background, interests, and how we met..._\n\n## Tasks #tasks\n- [ ] Follow up in 2 weeks\n';
        } else {
          templateContent += '\n## Notes #notes\n_Context and general notes..._\n';
        }

        const targetPath = `${templatesFolder}/${entityKey}.md`;
        let tFile = this.app.vault.getAbstractFileByPath(targetPath);
        if (tFile && tFile instanceof obsidian.TFile) {
          if (!confirm(`Are you sure you want to reset the template for ${def.label}? Your visual changes will be overwritten.`)) return;
          await this.app.vault.modify(tFile, templateContent);
          new obsidian.Notice(`Template reset for ${def.label}.`);
        } else {
          await this.app.vault.create(targetPath, templateContent);
          new obsidian.Notice(`Template successfully enabled for ${def.label}.`);
        }
        this.render();
      });

      // Clicking on the tile anywhere also triggers visual editor if custom template exists
      card.addEventListener('click', () => {
        const tFile = foundPath ? this.app.vault.getAbstractFileByPath(foundPath) : null;
        if (tFile) {
          this.openTemplateDetail(entityKey, tFile);
        }
      });
    }
  }

  /* ── Template Detail builder — same layout as a live fiche ── */
  async renderTemplateDetail(root, entityKey, file) {
    root.addClass('cadence-project-detail');
    const def = ENTITIES[entityKey] || { label: 'Daily Note', plural: 'Daily Notes', fields: [] };
    if (!file) { this.closeEntityDetail(); return; }

    const content = await this.app.vault.read(file);
    const sections = parseH2Sections(content);
    const sectionKeys = Object.keys(sections);

    /* Header */
    const head = root.createDiv({ cls: 'cad-detail-header' });
    const headLeft = head.createDiv({ cls: 'cad-detail-header-left' });
    const back = headLeft.createEl('button', { cls: 'cad-btn cad-detail-back', text: '← Templates' });
    back.addEventListener('click', () => this.closeEntityDetail());

    const breadcrumb = headLeft.createDiv({ cls: 'cad-detail-breadcrumb' });
    breadcrumb.createSpan({ cls: 'cad-eyebrow', text: 'TEMPLATE BUILDER' });
    breadcrumb.createSpan({ cls: 'cad-detail-title', text: def.label });
    breadcrumb.createDiv({ cls: 'cad-detail-path', text: file.path });

    const headRight = head.createDiv({ cls: 'cad-detail-header-right' });
    const savedBadge = headRight.createSpan({ cls: 'cad-detail-saved', text: '' });
    const flashSaved = () => {
      savedBadge.setText('Saved');
      savedBadge.addClass('show');
      clearTimeout(savedBadge._t);
      savedBadge._t = setTimeout(() => savedBadge.removeClass('show'), 1400);
    };

    const openNote = headRight.createEl('button', { cls: 'cad-btn', text: 'View Raw Note 📝' });
    openNote.addEventListener('click', () => this.app.workspace.openLinkText(file.path, '', false));

    const deleteBtn = headRight.createEl('button', { cls: 'cad-btn cad-btn-danger', text: 'Delete' });
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Delete this custom template? Cadence will fall back to using the default structure.`)) return;
      try {
        await this.app.vault.trash(file, true);
        new obsidian.Notice(`Custom template deleted.`);
        this.closeEntityDetail();
      } catch (e) {
        new obsidian.Notice(`Error: ${e.message}`);
      }
    });

    /* Two-column body — same layout as a real fiche */
    const cols = root.createDiv({ cls: 'cad-pd-cols' });
    const left = cols.createDiv({ cls: 'cad-pd-col' });
    const right = cols.createDiv({ cls: 'cad-pd-col' });

    const leftKeys = [];
    const rightKeys = [];

    sectionKeys.forEach((key, idx) => {
      if (idx % 2 === 0) {
        leftKeys.push(key);
      } else {
        rightKeys.push(key);
      }
    });

    // For each left-column section: render live widget + delete button
    leftKeys.forEach((rawKey) => {
      this._renderTemplateSectionWithDelete(left, file, sections, rawKey, flashSaved);
    });

    // For each right-column section: render live widget + delete button
    rightKeys.forEach((rawKey) => {
      this._renderTemplateSectionWithDelete(right, file, sections, rawKey, flashSaved);
    });

    /* Toolbar for adding sections */
    const toolbar = root.createDiv({ attr: { style: 'margin-top: 32px; margin-bottom: 48px; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px; border-top: 1px solid var(--border-color);' } });
    toolbar.createDiv({ text: '➕ ADD BLOCK TO TEMPLATE', attr: { style: 'font-weight: 700; font-size: 0.75rem; letter-spacing: 0.15em; color: var(--text-muted);' } });

    const btnRow = toolbar.createDiv({ attr: { style: 'display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;' } });

    const addSectionHelper = async (cleanTitle, tag, defaultBody = '') => {
      const curContent = await this.app.vault.read(file);
      const header = `## ${cleanTitle} ${tag}`.trim();
      const nextContent = curContent.replace(/\s*$/, '') + `\n\n${header}\n${defaultBody}\n`;
      await this.app.vault.modify(file, nextContent);
      new obsidian.Notice(`Section "${cleanTitle}" added to template.`);
      await this._propagateTemplateSectionAdd(entityKey, cleanTitle, tag, defaultBody);
      this.render();
    };

    const addTextBtn = btnRow.createEl('button', { cls: 'cad-btn', text: '📝 Text Area' });
    addTextBtn.addEventListener('click', () => {
      new CadencePromptModal(this.app, {
        title: 'New Text Section',
        placeholder: 'Enter text section title:',
        defaultValue: 'Notes',
        cta: 'Add Block',
        onSubmit: (title) => { addSectionHelper(title, '#notes', '_Enter your notes here..._'); }
      }).open();
    });

    const addTasksBtn = btnRow.createEl('button', { cls: 'cad-btn', text: '📋 Task List' });
    addTasksBtn.addEventListener('click', () => {
      new CadencePromptModal(this.app, {
        title: 'New Task List Block',
        placeholder: 'Enter task list section title:',
        defaultValue: 'Tasks',
        cta: 'Add Block',
        onSubmit: (title) => { addSectionHelper(title, '#tasks', '- [ ] First task in template'); }
      }).open();
    });

    const addMilestonesBtn = btnRow.createEl('button', { cls: 'cad-btn', text: '📅 Milestones / Timeline' });
    addMilestonesBtn.addEventListener('click', () => {
      new CadencePromptModal(this.app, {
        title: 'New Milestones Block',
        placeholder: 'Enter milestones section title:',
        defaultValue: 'Milestones',
        cta: 'Add Block',
        onSubmit: (title) => {
          const today = ymd(new Date());
          addSectionHelper(title, '#milestones', `- [ ] ${today} — First milestone in template`);
        }
      }).open();
    });

    const addCrossBtn = btnRow.createEl('button', { cls: 'cad-btn', text: '🔗 Cross-Linked Data' });
    addCrossBtn.addEventListener('click', () => {
      new CadenceCrossSectionModal(this.app, entityKey, async (config) => {
        const defaultTitle = `Related ${ENTITIES[config.targetEntity]?.plural || 'Links'}`;
        new CadencePromptModal(this.app, {
          title: 'New Cross-Linked Section',
          placeholder: 'Enter section title:',
          defaultValue: defaultTitle,
          cta: 'Add Block',
          onSubmit: (title) => {
            const crossTag = `#cross-${config.targetEntity}-${config.linkField}-${config.viewType}`;
            addSectionHelper(title, crossTag, '');
          }
        }).open();
      }).open();
    });

    const addChartBtn = btnRow.createEl('button', { cls: 'cad-btn', text: '📊 Analytics Chart' });
    addChartBtn.addEventListener('click', () => {
      new CadenceChartSectionModal(this.app, entityKey, (config) => {
        const chartTag = `#chart-${config.targetEntity}-${config.linkField}-${config.groupField}-${config.style}`;
        const defaultTitle = `${ENTITIES[config.targetEntity]?.plural || config.targetEntity} by ${config.groupField}`;
        new CadencePromptModal(this.app, {
          title: 'New Analytics Chart',
          placeholder: 'Enter chart section title:',
          defaultValue: defaultTitle,
          cta: 'Add Chart',
          onSubmit: (title) => { addSectionHelper(title, chartTag, ''); }
        }).open();
      }).open();
    });
  }

  /* Helper: render a live H2 section widget inside the template builder,
     with move (▲▼), view-switcher (for cross/chart), and delete (×) controls */
  _renderTemplateSectionWithDelete(parent, file, sections, rawKey, flashSaved, allRawKeys) {
    const entityKey = file.basename;
    const { cleanLabel, tag } = parseHeaderKey(rawKey);

    // Outer wrapper — draggable to support reordering
    const wrap = parent.createDiv({ attr: { style: 'position: relative; margin-bottom: 12px; transition: transform 0.2s ease;' } });

    // Enable full card dragging for reordering
    wrap.draggable = true;
    wrap.addEventListener('dragstart', (ev) => {
      wrap.style.opacity = '0.5';
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/cadence-template-section', rawKey);
    });
    wrap.addEventListener('dragend', () => {
      wrap.style.opacity = '1';
      wrap.removeClass('drag-over');
    });

    wrap.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      wrap.addClass('drag-over');
      wrap.style.border = '2px dashed var(--interactive-accent)';
      wrap.style.borderRadius = '6px';
    });
    wrap.addEventListener('dragleave', () => {
      wrap.removeClass('drag-over');
      wrap.style.border = 'none';
      wrap.style.borderRadius = '0';
    });
    wrap.addEventListener('drop', async (ev) => {
      ev.preventDefault();
      wrap.removeClass('drag-over');
      wrap.style.border = 'none';
      wrap.style.borderRadius = '0';

      const draggedRawKey = ev.dataTransfer.getData('text/cadence-template-section');
      if (!draggedRawKey || draggedRawKey === rawKey) return;

      const curContent = await this.app.vault.read(file);
      const lines = curContent.split('\n');
      const h2Indices = lines.map((l, i) => (/^##\s/.test(l) ? i : -1)).filter(i => i >= 0);

      const draggedIdx = h2Indices.findIndex(i => lines[i].trim().replace(/^##\s+/, '') === draggedRawKey);
      const targetIdx = h2Indices.findIndex(i => lines[i].trim().replace(/^##\s+/, '') === rawKey);
      if (draggedIdx === -1 || targetIdx === -1) return;

      // Extract section block to move
      const getBlock = (hi) => {
        const start = h2Indices[hi];
        const end = hi + 1 < h2Indices.length ? h2Indices[hi + 1] : lines.length;
        return lines.slice(start, end);
      };

      const draggedBlock = getBlock(draggedIdx);

      // Remove block from lines
      const startDel = h2Indices[draggedIdx];
      lines.splice(startDel, draggedBlock.length);

      // Re-calculate indices to insert at the correct spot
      const linesTemp = lines.join('\n');
      const linesArr = linesTemp.split('\n');
      const h2IndicesNew = linesArr.map((l, i) => (/^##\s/.test(l) ? i : -1)).filter(i => i >= 0);
      const targetIdxNew = h2IndicesNew.findIndex(i => linesArr[i].trim().replace(/^##\s+/, '') === rawKey);

      // Insert before the target section
      const insertPos = h2IndicesNew[targetIdxNew];
      linesArr.splice(insertPos, 0, ...draggedBlock);

      await this.app.vault.modify(file, linesArr.join('\n'));
      this.render();
    });

    // Render the actual live widget
    this._renderDynamicH2Section(wrap, file, sections, rawKey, flashSaved);

    // Grab the card head injected by the widget renderer
    const cardHead = wrap.querySelector('.cad-pd-card-head');
    if (!cardHead) return;

    // ── Controls row appended to the right of the card head ──
    const ctrlRow = cardHead.createDiv({ attr: { style: 'display: flex; align-items: center; gap: 8px; margin-left: 8px; flex-shrink: 0;' } });

    // --- Drag Handle ---
    const grip = ctrlRow.createDiv({ attr: { style: 'cursor: grab; display: flex; align-items: center; justify-content: center; color: var(--text-muted); opacity: 0.7; padding: 2px 4px;' } });
    grip.title = 'Drag card to reorder';
    try { obsidian.setIcon(grip, 'grip-vertical'); } catch (_) { }

    // --- Delete button ---
    const delBtn = ctrlRow.createEl('button', { text: '×', attr: { style: 'color: var(--text-error); padding: 0 4px; font-weight: bold; background: transparent; border: none; font-size: 1.25em; cursor: pointer;' } });
    delBtn.title = `Remove section "${cleanLabel}" from template`;
    delBtn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const usedFiles = await this._getFilesUsingTemplateSection(entityKey, rawKey);
      if (usedFiles.length > 0) {
        const fileNames = usedFiles.map(f => f.basename).join(', ');
        if (!confirm(`Warning: The section "${cleanLabel}" has active content in the following files:\n${fileNames}\n\nAre you sure you want to delete it from the template?`)) {
          return;
        }
      } else {
        if (!confirm(`Remove the section "${cleanLabel}" from this template?`)) return;
      }
      
      const curContent = await this.app.vault.read(file);
      const lines = curContent.split('\n');
      const idx = lines.findIndex(l => l.trim().replace(/^##\s+/, '') === rawKey);
      if (idx !== -1) {
        let endIdx = lines.length;
        for (let i = idx + 1; i < lines.length; i++) {
          if (/^##\s/.test(lines[i])) { endIdx = i; break; }
        }
        lines.splice(idx, endIdx - idx);
        await this.app.vault.modify(file, lines.join('\n'));
        await this._propagateTemplateSectionDelete(entityKey, rawKey);
        new obsidian.Notice(`Section "${cleanLabel}" removed.`);
        this.render();
      }
    });
  }

  _getEntityFiles(entityKey) {
    if (entityKey === 'daily') {
      const folderPath = this.plugin.settings.dailyNoteFolder || 'daily';
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      if (!folder || !folder.children) return [];
      const out = [];
      const walk = (node) => {
        for (const child of node.children) {
          if (child.children) walk(child);
          else if (typeof child.path === 'string' && child.path.toLowerCase().endsWith('.md')) {
            out.push(child);
          }
        }
      };
      walk(folder);
      return out;
    } else {
      return listEntityFiles(this.app, entityKey);
    }
  }

  async _getFilesUsingTemplateSection(entityKey, rawKey) {
    const files = this._getEntityFiles(entityKey);
    const used = [];
    const { cleanLabel } = parseHeaderKey(rawKey);
    for (const file of files) {
      const content = await this.app.vault.read(file);
      const sections = parseH2Sections(content);
      const matchingKey = Object.keys(sections).find(k => parseHeaderKey(k).cleanLabel.toLowerCase() === cleanLabel.toLowerCase());
      if (matchingKey) {
        const body = (sections[matchingKey] || '').trim();
        if (body && !body.startsWith('_Enter your notes here...') && !body.startsWith('_Company description') && !body.startsWith('_Background, interests') && !body.startsWith('_The outcome we want') && !body.startsWith('- [ ] First task') && !body.startsWith('- [ ] First milestone')) {
          used.push(file);
        }
      }
    }
    return used;
  }

  async _propagateTemplateSectionAdd(entityKey, cleanTitle, tag, defaultBody = '') {
    const files = this._getEntityFiles(entityKey);
    const header = `## ${cleanTitle} ${tag}`.trim();
    for (const file of files) {
      const content = await this.app.vault.read(file);
      const sections = parseH2Sections(content);
      const exists = Object.keys(sections).some(k => parseHeaderKey(k).cleanLabel.toLowerCase() === cleanTitle.toLowerCase());
      if (!exists) {
        const nextContent = content.replace(/\s*$/, '') + `\n\n${header}\n${defaultBody}\n`;
        await this.app.vault.modify(file, nextContent);
      }
    }
  }

  async _propagateTemplateSectionDelete(entityKey, rawKey) {
    const files = this._getEntityFiles(entityKey);
    const { cleanLabel } = parseHeaderKey(rawKey);
    for (const file of files) {
      const content = await this.app.vault.read(file);
      const lines = content.split('\n');
      const idx = lines.findIndex(l => {
        if (!/^##\s/.test(l)) return false;
        const key = l.trim().replace(/^##\s+/, '');
        return parseHeaderKey(key).cleanLabel.toLowerCase() === cleanLabel.toLowerCase();
      });
      if (idx !== -1) {
        let endIdx = lines.length;
        for (let i = idx + 1; i < lines.length; i++) {
          if (/^##\s/.test(lines[i])) { endIdx = i; break; }
        }
        lines.splice(idx, endIdx - idx);
        await this.app.vault.modify(file, lines.join('\n'));
      }
    }
  }

  /* ── Inbox (Planner reminders + captures) ── */
  async renderInbox(root) {
    root.addClass('cadence-inbox');
    const all = (this.plugin.settings.reminders || []).filter((r) => !r.done);

    // Sort: scheduled by when, captures by createdAt
    all.sort((a, b) => {
      const wa = a.when ? new Date(a.when).getTime() : Infinity;
      const wb = b.when ? new Date(b.when).getTime() : Infinity;
      if (wa !== wb) return wa - wb;
      const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return cb - ca;
    });

    // Bucket
    const buckets = { now: [], today: [], week: [], later: [] };
    all.forEach((r) => buckets[reminderBucket(r.when)].push(r));

    this._renderPageHeader(root, 'Inbox', `${all.length} ${all.length === 1 ? 'item' : 'items'} · capture once, surface at the right time`, (right) => {
      const captureBtn = right.createEl('button', { cls: 'cad-btn primary', text: '+ Quick capture' });
      captureBtn.addEventListener('click', () => this.plugin.openQuickCapture());
    });

    if (!all.length) {
      const empty = root.createDiv({ cls: 'cad-empty-state' });
      empty.createDiv({ cls: 'cad-empty-state-title', text: 'Inbox zero' });
      empty.createDiv({ cls: 'cad-empty-state-desc', text: 'Capture anything with + Quick capture above (or Cmd+Shift+I). Add a time and Cadence will remind you.' });
      return;
    }

    const sectionLabels = { now: 'NOW · OVERDUE OR DUE WITHIN 1 HOUR', today: 'TODAY', week: 'THIS WEEK', later: 'LATER · UNSCHEDULED' };
    ['now', 'today', 'week', 'later'].forEach((key) => {
      const items = buckets[key];
      if (!items.length) return;
      root.createDiv({ cls: 'cad-section-label-lg', text: `${sectionLabels[key]} · ${items.length}` });
      const list = root.createDiv({ cls: 'cad-inbox-list' });
      items.forEach((r) => this._renderInboxRow(list, r, key));
    });

    /* ── PROJECT TASKS — every open `- [ ]` from every project's ## Tasks ── */
    await this._renderProjectTasksSection(root);
  }

  async _renderProjectTasksSection(root) {
    const projectFiles = listEntityFiles(this.app, 'project');
    if (!projectFiles.length) return;

    /* Read each project's Tasks section + collect open tasks */
    const groups = [];
    let totalOpen = 0;
    for (const file of projectFiles) {
      let content;
      try { content = await this.app.vault.read(file); }
      catch (_) { continue; }
      const sections = parseH2Sections(content);
      const tasksText = sections['Tasks'] || '';
      if (!tasksText.trim()) continue;
      const tasks = parseTasksList(tasksText);
      const open = tasks.filter((t) => !t.done && t.title);
      if (!open.length) continue;
      totalOpen += open.length;
      groups.push({
        file,
        name: projectNameFromPath(this.app, file.path),
        tasks: open,
      });
    }

    if (!totalOpen) return;

    root.createDiv({ cls: 'cad-section-label-lg', text: `PROJECT TASKS · ${totalOpen} open across ${groups.length} ${groups.length === 1 ? 'project' : 'projects'}` });
    const wrap = root.createDiv({ cls: 'cad-pt-wrap' });

    groups.forEach((g) => {
      const card = wrap.createDiv({ cls: 'cad-pt-group' });
      const head = card.createDiv({ cls: 'cad-pt-group-head' });
      const link = head.createEl('a', { cls: 'cad-pt-group-link', text: '📁 ' + g.name });
      link.addEventListener('click', (e) => { e.preventDefault(); this.openEntityDetail('project', g.file); });
      head.createSpan({ cls: 'cad-pt-group-meta', text: `${g.tasks.length} open` });

      const list = card.createDiv({ cls: 'cad-pt-list' });
      g.tasks.forEach((t) => {
        const linked = findProjectTaskReminder(this.plugin, g.file.path, t.title);
        const row = list.createDiv({ cls: 'cad-pt-row' });
        row.createSpan({ cls: 'cad-pt-bullet', text: '•' });
        const txt = row.createSpan({ cls: 'cad-pt-text', text: t.title });
        void txt;
        if (linked && linked.when) {
          row.createSpan({ cls: 'cad-pt-when', text: reminderTimeStr(linked.when) });
        }
        const bell = row.createEl('button', {
          cls: 'cad-btn cad-btn-sm cad-pt-bell' + (linked ? ' linked' : ''),
          text: linked ? '🔔' : '🔕',
        });
        bell.title = linked ? 'Edit reminder' : 'Set a reminder';
        bell.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const existing = findProjectTaskReminder(this.plugin, g.file.path, t.title);
          if (existing) {
            new CadenceReminderEditModal(this.app, this.plugin, existing).open();
          } else {
            new CadenceReminderEditModal(this.app, this.plugin, {
              text: t.title,
              when: null,
              repeat: 'none',
              notes: '',
              project: g.file.path,
            }, { isNew: true }).open();
          }
        });
        row.addEventListener('click', () => this.openEntityDetail('project', g.file));
      });
    });
  }

  _renderInboxRow(parent, r, bucket) {
    const row = parent.createDiv({ cls: 'cad-inbox-row' + (bucket === 'now' ? ' overdue' : '') });

    const left = row.createDiv({ cls: 'cad-inbox-row-left' });
    const tWrap = left.createDiv({ cls: 'cad-inbox-time' });
    if (r.when) {
      tWrap.createSpan({ cls: 'cad-inbox-time-text', text: reminderTimeStr(r.when) });
      if (r.repeat && r.repeat !== 'none') {
        tWrap.createSpan({ cls: 'cad-inbox-repeat', text: r.repeat === 'daily' ? '↻ daily' : '↻ weekly' });
      }
    } else {
      tWrap.createSpan({ cls: 'cad-inbox-time-text muted', text: 'unscheduled' });
    }

    const main = row.createDiv({ cls: 'cad-inbox-row-main' });
    main.createDiv({ cls: 'cad-inbox-row-text', text: r.text });

    if (r.project) {
      const chipRow = main.createDiv({ cls: 'cad-inbox-row-meta-row' });
      const chip = chipRow.createEl('a', { cls: 'cad-rem-project-chip', text: '📁 ' + (projectNameFromPath(this.app, r.project) || 'Project') });
      chip.title = 'Open project';
      chip.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const file = this.app.vault.getAbstractFileByPath(r.project);
        if (file && file instanceof obsidian.TFile) this.openEntityDetail('project', file);
      });
    }

    if (r.notes) {
      const previewLine = String(r.notes).split('\n').find((l) => l.trim()) || '';
      if (previewLine) {
        const note = main.createDiv({ cls: 'cad-inbox-row-notes' });
        note.createSpan({ cls: 'cad-inbox-row-notes-icon', text: '📝 ' });
        note.appendText(previewLine.length > 120 ? previewLine.slice(0, 117) + '…' : previewLine);
      }
    }

    // Row body click → open edit modal
    const openEdit = () => new CadenceReminderEditModal(this.app, this.plugin, r).open();
    left.addEventListener('click', openEdit);
    main.addEventListener('click', openEdit);
    left.style.cursor = 'pointer';
    main.style.cursor = 'pointer';

    const actions = row.createDiv({ cls: 'cad-inbox-actions' });
    const mk = (label, title, fn) => {
      const b = actions.createEl('button', { cls: 'cad-btn cad-btn-sm', text: label });
      b.title = title;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); fn(); });
      return b;
    };
    if (r.when) {
      mk('+15m', 'Snooze 15 minutes', () => this.plugin.snoozeReminder(r.id, 15 * 60 * 1000));
      mk('+1h', 'Snooze 1 hour', () => this.plugin.snoozeReminder(r.id, 60 * 60 * 1000));
      mk('Tom.', 'Snooze to tomorrow 9am', () => {
        const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
        this.plugin.updateReminder(r.id, { when: d.toISOString(), notified: false });
      });
    } else {
      mk('Schedule', 'Add a time', () => openEdit());
    }
    mk('Edit', 'Edit details + notes', () => openEdit());
    const doneBtn = mk('Done', 'Mark done', async () => {
      await this.plugin.completeReminder(r.id);
      if (r.text) await this._propagateTaskComplete(r.text, true, { kind: 'reminder', id: r.id });
    });
    doneBtn.classList.add('primary');
    const delBtn = mk('×', 'Delete', () => {
      if (confirm('Delete this reminder?')) this.plugin.deleteReminder(r.id);
    });
    delBtn.classList.add('cad-btn-danger');
  }

  async _quickAddTodayTask() {
    if (this.plugin.settings.taskManagementSystem === 'tasknotes') {
      const commandId = "tasknotes:create-new-task";
      const hasCommand = this.app.commands && this.app.commands.commands && this.app.commands.commands[commandId];
      if (hasCommand) {
        this.app.commands.executeCommandById(commandId);
        return;
      }
    }
    const text = await this._prompt({
      title: 'Quick add — today',
      placeholder: 'What needs doing?',
      cta: 'Add task',
    });
    if (!text) return;
    const file = await ensureDailyNote(this.app, this.plugin.settings);
    const content = await this.app.vault.read(file);
    const parsed = parseSections(content, this.plugin.settings);
    const newTasks = [...parsed.tasks, `- [ ] ${text}`];
    const next = replaceSection(content, this.plugin.settings.tasksHeading, newTasks.join('\n'));
    await this.app.vault.modify(file, next);
    new obsidian.Notice('Added to today');
  }

  /* ── Pipeline kanban (deals grouped by stage) ───── */
  async renderEntityKanban(root, entityKey, groupBy, groups) {
    root.addClass('cadence-kanban');
    const def = ENTITIES[entityKey];
    const entities = listEntities(this.app, entityKey);
    const totalValue = entities.reduce((sum, e) => sum + (Number(entityValue(e, 'value', def)) || 0), 0);

    this._renderPageHeader(root, def.plural, `${entities.length} ${entities.length === 1 ? def.label.toLowerCase() : def.plural.toLowerCase()} · ${fmtValue(totalValue, 'currency')} total`, (right) => {
      const importBtn = right.createEl('button', { cls: 'cad-btn', text: 'Import CSV' });
      importBtn.addEventListener('click', () => new CadenceImportModal(this.app, { entityKey }).open());
      const btn = right.createEl('button', { cls: 'cad-btn primary', text: `+ New ${def.label}` });
      btn.addEventListener('click', () => this._createEntityFromPrompt(entityKey));
    });

    const board = root.createDiv({ cls: 'cad-kanban-board' });
    groups.forEach((stage) => {
      const items = entities.filter((e) => String(entityValue(e, groupBy, def) || '') === stage);
      const stageValue = items.reduce((s, e) => s + (Number(entityValue(e, 'value', def)) || 0), 0);

      const col = board.createDiv({ cls: 'cad-kanban-col' });
      col.dataset.stage = stage;
      const head = col.createDiv({ cls: 'cad-kanban-col-head' });
      head.createDiv({ cls: 'cad-kanban-col-title', text: stage });
      head.createDiv({ cls: 'cad-kanban-col-meta', text: `${items.length} · ${fmtValue(stageValue, 'currency')}` });

      const list = col.createDiv({ cls: 'cad-kanban-col-list' });

      // Drop target: drop a card here to update its `groupBy` field to this stage.
      list.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        try { ev.dataTransfer.dropEffect = 'move'; } catch (_) { }
        col.addClass('drag-over');
      });
      list.addEventListener('dragleave', (ev) => {
        // Only clear when leaving the column entirely
        if (!col.contains(ev.relatedTarget)) col.removeClass('drag-over');
      });
      list.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        col.removeClass('drag-over');
        const path = ev.dataTransfer.getData('text/cadence-entity');
        const fromStage = ev.dataTransfer.getData('text/cadence-stage');
        if (!path || fromStage === stage) return;
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!file || !(file instanceof obsidian.TFile)) return;
        try {
          await this.app.fileManager.processFrontMatter(file, (fm) => { fm[groupBy] = (groupBy === 'stage') ? [stage] : stage; });
          new obsidian.Notice(`Moved to ${stage}`);
          // The metadataCache.changed listener re-renders for us.
        } catch (e) {
          new obsidian.Notice(`Failed to move: ${e.message}`);
        }
      });

      if (!items.length) {
        list.createDiv({ cls: 'cad-empty', text: '—' });
      } else {
        const isMobile = !!(obsidian.Platform && obsidian.Platform.isMobile);
        items.forEach((e) => {
          const card = list.createDiv({ cls: 'cad-kanban-card' });
          card.dataset.path = e.file.path;
          card.createDiv({ cls: 'cad-kanban-card-title', text: entityValue(e, 'title', def) || e.basename });
          const meta = card.createDiv({ cls: 'cad-kanban-card-meta' });
          const v = entityValue(e, 'value', def);
          if (v) meta.createSpan({ cls: 'cad-kanban-card-value', text: fmtValue(v, 'currency') });

          const coValues = parseLinkValues(entityValue(e, 'company', def));
          if (coValues.length > 0) {
            meta.createSpan({ text: ' · ' });
            coValues.forEach((item, idx) => {
              if (idx > 0) {
                meta.createSpan({ text: ', ' });
              }
              const coLink = meta.createEl('a', { cls: 'cad-company-link', text: item.display });
              coLink.style.textDecoration = 'underline';
              coLink.style.cursor = 'pointer';
              coLink.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const targetFile = this.app.vault.getMarkdownFiles().find(f => f.basename.toLowerCase() === item.target.toLowerCase());
                if (targetFile) this.openEntityDetail('company', targetFile);
                else this.app.workspace.openLinkText(item.target, '', false);
              });
            });
          }

          const contactValues = parseLinkValues(entityValue(e, 'contact', def));
          if (contactValues.length > 0) {
            meta.createSpan({ text: ' · ' });
            contactValues.forEach((item, idx) => {
              if (idx > 0) {
                meta.createSpan({ text: ', ' });
              }
              const ctLink = meta.createEl('a', { cls: 'cad-contact-link', text: item.display });
              ctLink.style.textDecoration = 'underline';
              ctLink.style.cursor = 'pointer';
              ctLink.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const targetFile = this.app.vault.getMarkdownFiles().find(f => f.basename.toLowerCase() === item.target.toLowerCase());
                if (targetFile) this.openEntityDetail('contact', targetFile);
                else this.app.workspace.openLinkText(item.target, '', false);
              });
            });
          }

          /* Drag-to-move is a desktop-only affordance. On mobile, HTML5 drag
             doesn't reliably fire from touch and the `draggable` attribute
             can interfere with native scrolling. Mobile users instead tap
             the card to open detail, then change the stage from there. */
          if (!isMobile) {
            card.draggable = true;
            card.addEventListener('dragstart', (ev) => {
              card.addClass('dragging');
              try {
                ev.dataTransfer.effectAllowed = 'move';
                ev.dataTransfer.setData('text/cadence-entity', e.file.path);
                ev.dataTransfer.setData('text/cadence-stage', stage);
                // Plain text payload too, so dropping into editors yields a link
                ev.dataTransfer.setData('text/plain', `[[${e.file.basename}]]`);
              } catch (_) { }
            });
            card.addEventListener('dragend', () => card.removeClass('dragging'));
          } else {
            card.addClass('cad-kanban-card-touch');
          }
          card.addEventListener('click', () => this.openEntityDetail(entityKey, e.file));
        });
      }
    });
  }

  /* Central chart dispatcher — replaces 4 duplicated if-elseif blocks at call sites. */
  _drawChart(parent, style, data) {
    if (style === 'donut') this._drawDonutChart(parent, data);
    else if (style === 'bar') this._drawBarChart(parent, data);
    else if (style === 'kpi') this._drawKpiGrid(parent, data);
    else this._drawSimpleList(parent, data);
  }

  _drawChartEmpty(parent) {
    const el = parent.createDiv({ cls: 'cad-empty', text: 'No data' });
    el.style.cssText = 'text-align: center; padding: 16px;';
  }

  _drawDonutChart(parent, data) {
    const total = data.reduce((sum, item) => sum + item.count, 0);
    if (total === 0) return this._drawChartEmpty(parent);

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

  _drawBarChart(parent, data) {
    const total = data.reduce((sum, item) => sum + item.count, 0);
    if (total === 0) return this._drawChartEmpty(parent);

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

  _drawKpiGrid(parent, data) {
    if (data.length === 0) return this._drawChartEmpty(parent);
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

  _drawSimpleList(parent, data) {
    if (data.length === 0) return this._drawChartEmpty(parent);

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

  /* ── Projects Dashboard ─────────────────── */
  async renderProjectsDashboard(root) {
    root.addClass('cadence-dashboard');
    root.addClass('cadence-list'); // Reuses list styles

    // Retrieve projects
    const def = ENTITIES.project;
    if (!def) {
      this.renderComingSoon(root, this._resolveSurface(this.mode));
      return;
    }
    const allProjects = listEntities(this.app, 'project');

    // ─── Header ────────────────────────────────────────
    this._renderPageHeader(root, 'Projects Dashboard', 'Status · priority · custom analytics', (right) => {
      const newProj = right.createEl('button', { cls: 'cad-btn primary', text: '+ New Project' });
      newProj.addEventListener('click', () => this._createEntityFromPrompt('project'));
    });

    // ─── Stats strip ───────────────────────────────────
    const statusField = def.fields.find(f => f.key === 'status') || { options: ['active', 'on_hold', 'backlog', 'done', 'cancelled'] };
    const statuses = statusField.options || ['active', 'on_hold', 'backlog', 'done', 'cancelled'];

    const grid = root.createDiv({ cls: 'cad-stat-grid', attr: { style: 'padding-bottom: 24px;' } });

    // 1. Total projects card
    const totalCard = grid.createDiv({ cls: 'cad-stat-card', attr: { style: 'padding: 20px; display: flex; flex-direction: column; justify-content: center; min-height: 280px; margin: 0; position: relative;' } });
    totalCard.dataset.accent = 'sky';
    totalCard.createDiv({ cls: 'cad-stat-label', text: 'TOTAL PROJECTS', attr: { style: 'font-weight: 700; letter-spacing: 0.12em;' } });
    totalCard.createDiv({ cls: 'cad-stat-value', text: String(allProjects.length), attr: { style: 'font-size: 3rem; font-weight: 800; margin-top: 12px; line-height: 1;' } });
    totalCard.createDiv({ cls: 'cad-stat-sub', text: 'Across all active and custom statuses', attr: { style: 'margin-top: 12px; font-size: 0.85em; color: var(--text-muted);' } });

    // 2. Dynamic status cards
    const statusAccents = {
      active: 'emerald',
      done: 'mint',
      cancelled: 'rose',
      backlog: 'purple',
      on_hold: 'warn',
      'on-hold': 'warn'
    };
    const fallbackAccents = ['sky', 'emerald', 'rose', 'purple', 'warn', 'mint'];

    statuses.forEach((status, index) => {
      const items = allProjects.filter(p => String(entityValue(p, 'status', def)).toLowerCase() === status.toLowerCase());
      const accent = statusAccents[status.toLowerCase().replace('-', '_')] || fallbackAccents[index % fallbackAccents.length];

      const colCard = grid.createDiv({ cls: 'cad-stat-card', attr: { style: 'padding: 20px; display: flex; flex-direction: column; min-height: 280px; margin: 0; position: relative;' } });
      colCard.dataset.accent = accent;
      colCard.dataset.stage = status; // For drag & drop target

      // Header info
      colCard.createDiv({
        cls: 'cad-stat-label',
        text: `${status.replace(/_/g, ' ').toUpperCase()} PROJECTS`,
        attr: { style: 'font-weight: 700; letter-spacing: 0.12em;' }
});
      colCard.createDiv({ cls: 'cad-stat-value',
        text: String(items.length), attr: { style: 'font-size: 2.25rem; font-weight: 800; margin-top: 4px;' } });

      // List area inside card
      const list = colCard.createDiv({ attr: { style: 'margin-top: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; padding-right: 4px; min-height: 120px;' } });

      // Drag and drop listeners on the status card itself
      colCard.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        try { ev.dataTransfer.dropEffect = 'move'; } catch (_) { }
        colCard.style.boxShadow = '0 0 0 2px var(--interactive-accent)';
      });
      colCard.addEventListener('dragleave', (ev) => {
        if (!colCard.contains(ev.relatedTarget)) {
          colCard.style.boxShadow = '';
        }
      });
      colCard.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        colCard.style.boxShadow = '';
        const path = ev.dataTransfer.getData('text/cadence-entity');
        const fromStage = ev.dataTransfer.getData('text/cadence-stage-status');
        if (!path || fromStage === status) return;
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!file || !(file instanceof obsidian.TFile)) return;
        try {
          await this.app.fileManager.processFrontMatter(file, (fm) => {
            fm['status'] = status;
          });
          new obsidian.Notice(`Project status set to ${status}`);
          this.render();
        } catch (e) {
          new obsidian.Notice(`Failed to change status: ${e.message}`);
        }
      });

      if (!items.length) {
        list.createDiv({ cls: 'cad-empty', text: 'No projects', attr: { style: 'text-align: center; color: var(--text-faint); margin-top: 32px;' } });
      } else {
        const isMobile = !!(obsidian.Platform && obsidian.Platform.isMobile);
        items.forEach((e) => {
          // Project Row inside card list
          const row = list.createDiv({ cls: 'cad-dash-row', attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: var(--background-secondary); border-radius: 6px; cursor: pointer; border: 1px solid var(--border-color);' } });

          // Left content: Project Name
          const nameEl = row.createDiv({ attr: { style: 'font-weight: 500; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;' } });
          nameEl.setText(entityValue(e, 'name', def) || e.basename);

          // Right content: Priority Pill
          const priorityVal = entityValue(e, 'priority', def);
          if (priorityVal) {
            const pill = row.createDiv({
              cls: `cad-pill cad-pill-${String(priorityVal).toLowerCase().replace(/\s+/g, '_')}`,
              text: String(priorityVal).replace(/_/g, ' ')
            });
            pill.style.fontSize = '0.7em';
            pill.style.padding = '1px 6px';
          }

          row.addEventListener('click', (ev) => {
            ev.stopPropagation();
            this.openEntityDetail('project', e.file);
          });

          if (!isMobile) {
            row.draggable = true;
            row.addEventListener('dragstart', (ev) => {
              row.style.opacity = '0.4';
              try {
                ev.dataTransfer.effectAllowed = 'move';
                ev.dataTransfer.setData('text/cadence-entity', e.file.path);
                ev.dataTransfer.setData('text/cadence-stage-status', status);
                ev.dataTransfer.setData('text/plain', `[[${e.file.basename}]]`);
              } catch (_) { }
            });
            row.addEventListener('dragend', () => {
              row.style.opacity = '';
            });
          }
        });
      }
    });

    // ─── Priority Board Section ────────────────────────
    root.createDiv({ cls: 'cad-section-label-lg', text: 'PROJECTS BY PRIORITY' });

    const boardWrap = root.createDiv({ cls: 'cad-stat-grid', attr: { style: 'padding-top: 0; padding-bottom: 24px;' } });

    const renderBoard = () => {
      boardWrap.empty();

      const priorityField = def.fields.find(field => field.key === 'priority') || { options: ['low', 'medium', 'high'] };
      const priorities = priorityField.options || ['low', 'medium', 'high'];

      const priorityAccents = {
        low: 'sky',
        medium: 'warn',
        high: 'rose'
      };

      priorities.forEach((prio) => {
        const items = allProjects.filter(p => String(entityValue(p, 'priority', def)).toLowerCase() === prio.toLowerCase());
        const accent = priorityAccents[prio.toLowerCase()] || 'sky';

        // Large Priority Stat Card Stack
        const colCard = boardWrap.createDiv({ cls: 'cad-stat-card', attr: { style: 'padding: 20px; display: flex; flex-direction: column; min-height: 280px; margin: 0; position: relative;' } });
        colCard.dataset.accent = accent;
        colCard.dataset.stage = prio; // For drag & drop target

        // Header info
        colCard.createDiv({
          cls: 'cad-stat-label',
          text: `${prio.toUpperCase()} PRIORITY`,
          attr: { style: 'font-weight: 700; letter-spacing: 0.12em;' }
});
        colCard.createDiv({ cls: 'cad-stat-value',
          text: String(items.length), attr: { style: 'font-size: 2.25rem; font-weight: 800; margin-top: 4px;' } });

        // List area inside card
        const list = colCard.createDiv({ attr: { style: 'margin-top: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; padding-right: 4px; min-height: 120px;' } });

        // Drag and drop listeners on the priority card itself
        colCard.addEventListener('dragover', (ev) => {
          ev.preventDefault();
          try { ev.dataTransfer.dropEffect = 'move'; } catch (_) { }
          colCard.style.boxShadow = '0 0 0 2px var(--interactive-accent)';
        });
        colCard.addEventListener('dragleave', (ev) => {
          if (!colCard.contains(ev.relatedTarget)) {
            colCard.style.boxShadow = '';
          }
        });
        colCard.addEventListener('drop', async (ev) => {
          ev.preventDefault();
          colCard.style.boxShadow = '';
          const path = ev.dataTransfer.getData('text/cadence-entity');
          const fromStage = ev.dataTransfer.getData('text/cadence-stage');
          if (!path || fromStage === prio) return;
          const file = this.app.vault.getAbstractFileByPath(path);
          if (!file || !(file instanceof obsidian.TFile)) return;
          try {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
              fm['priority'] = prio;
            });
            new obsidian.Notice(`Project priority set to ${prio}`);
            this.render();
          } catch (e) {
            new obsidian.Notice(`Failed to change priority: ${e.message}`);
          }
        });

        if (!items.length) {
          list.createDiv({ cls: 'cad-empty', text: 'No projects', attr: { style: 'text-align: center; color: var(--text-faint); margin-top: 32px;' } });
        } else {
          const isMobile = !!(obsidian.Platform && obsidian.Platform.isMobile);
          items.forEach((e) => {
            // Project Row inside card list
            const row = list.createDiv({ cls: 'cad-dash-row', attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: var(--background-secondary); border-radius: 6px; cursor: pointer; border: 1px solid var(--border-color);' } });

            // Left content: Project Name
            const nameEl = row.createDiv({ attr: { style: 'font-weight: 500; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;' } });
            nameEl.setText(entityValue(e, 'name', def) || e.basename);

            // Right content: Status Pill
            const statusVal = entityValue(e, 'status', def);
            if (statusVal) {
              const pill = row.createDiv({
                cls: `cad-pill cad-pill-${String(statusVal).toLowerCase().replace(/\s+/g, '_')}`,
                text: String(statusVal).replace(/_/g, ' ')
              });
              pill.style.fontSize = '0.7em';
              pill.style.padding = '1px 6px';
            }

            row.addEventListener('click', (ev) => {
              ev.stopPropagation();
              this.openEntityDetail('project', e.file);
            });

            if (!isMobile) {
              row.draggable = true;
              row.addEventListener('dragstart', (ev) => {
                row.style.opacity = '0.4';
                try {
                  ev.dataTransfer.effectAllowed = 'move';
                  ev.dataTransfer.setData('text/cadence-entity', e.file.path);
                  ev.dataTransfer.setData('text/cadence-stage', prio);
                  ev.dataTransfer.setData('text/plain', `[[${e.file.basename}]]`);
                } catch (_) { }
              });
              row.addEventListener('dragend', () => {
                row.style.opacity = '';
              });
            }
          });
        }
      });
    };
    renderBoard();

    // ─── Custom Widgets / Charts Section ────────────────
    const analyticsHeader = root.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 24px 32px 8px 32px; margin-bottom: 16px;' } });
    const labelEl = analyticsHeader.createEl('span', { cls: 'cad-section-label-lg',
      text: 'ANALYTICS & CHARTS', attr: { style: 'padding: 0; margin: 0; display: inline-block;' } });

    const addWidgetBtn = analyticsHeader.createEl('button', { cls: 'cad-btn primary', text: '+ Add Custom Chart' });

    const widgetsGrid = root.createDiv({ cls: 'cad-dash-cols', attr: { style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-bottom: 24px; padding: 0 32px;' } });

    const renderWidgets = () => {
      widgetsGrid.empty();

      const widgets = this.plugin.settings.projectDashboardWidgets || [];
      if (widgets.length === 0) {
        const emptyWrap = widgetsGrid.createDiv({ attr: { style: 'grid-column: 1 / -1; text-align: center; padding: 32px; background: var(--background-secondary); border-radius: 8px; border: 1px dashed var(--border-color);' } });
        emptyWrap.createDiv({ text: 'No custom charts added yet. Click "+ Add Custom Chart" to create one!', attr: { style: 'color: var(--text-muted); font-size: 0.95em;' } });
        return;
      }

      widgets.forEach((w) => {
        const card = widgetsGrid.createDiv({ cls: 'cad-dash-card', attr: { style: 'margin: 0; display: flex; flex-direction: column;' } });

        // Card Head
        const head = card.createDiv({ cls: 'cad-dash-card-head', attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;' } });
        const fieldKey = w.groupBy;

        head.createDiv({ cls: 'cad-dash-card-title', text: w.title.toUpperCase(), attr: { style: 'font-weight: 700; font-size: 0.75rem; letter-spacing: 0.12em;' } });

        const actionsWrap = head.createDiv({ attr: { style: 'display: flex; gap: 8px; align-items: center;' } });

        // Chart Style Select
        const styleSelect = actionsWrap.createEl('select', { cls: 'cad-prop-input' });
        styleSelect.style.padding = '2px 4px';
        styleSelect.style.fontSize = '0.8em';
        styleSelect.style.height = 'auto';
        styleSelect.style.width = 'auto';
        styleSelect.style.background = 'var(--background-primary)';
        styleSelect.style.color = 'var(--text-normal)';
        styleSelect.style.border = '1px solid var(--border-color)';
        styleSelect.style.borderRadius = '4px';

        [
          { value: 'donut', label: '🍩 Donut' },
          { value: 'bar', label: '📊 Bar' },
          { value: 'kpi', label: '🗃️ KPI Cards' },
          { value: 'list', label: '📋 List' }
        ].forEach(opt => {
          const o = styleSelect.createEl('option', { value: opt.value, text: opt.label });
          if (w.style === opt.value) o.selected = true;
        });

        styleSelect.addEventListener('change', async () => {
          w.style = styleSelect.value;
          await this.plugin.saveSettings();
          this.render();
        });

        // Delete button
        const delBtn = actionsWrap.createEl('button', { cls: 'cad-btn',
          text: '×', attr: { style: 'color: var(--text-error); padding: 2px 8px; font-weight: bold; border-color: var(--text-error); font-size: 1.1em; height: auto; border-radius: 4px; background: transparent;' } });
        delBtn.addEventListener('click', async () => {
          if (!confirm(`Delete chart "${w.title}"?`)) return;
          this.plugin.settings.projectDashboardWidgets = (this.plugin.settings.projectDashboardWidgets || []).filter(item => item.id !== w.id);
          await this.plugin.saveSettings();
          this.render();
        });

        const body = card.createDiv({ cls: 'cad-dash-card-body', attr: { style: 'flex: 1; min-height: 180px; display: flex; flex-direction: column; justify-content: center; padding: 14px;' } });

        // Calculate chart data for this widget
        const counts = {};
        allProjects.forEach(p => {
          let val = entityValue(p, fieldKey, def);
          if (Array.isArray(val)) {
            val.forEach(v => {
              const clean = String(v).replace(/^\[\[|\]\]$/g, '').trim();
              if (clean) counts[clean] = (counts[clean] || 0) + 1;
            });
          } else {
            const clean = String(val || '').replace(/^\[\[|\]\]$/g, '').trim();
            const label = clean || 'Unspecified';
            counts[label] = (counts[label] || 0) + 1;
          }
        });

        const chartData = Object.entries(counts)
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count);

        // Draw chart directly into a fresh div — no innerHTML.
        this._drawChart(body.createDiv(), w.style, chartData);
      });
    };

    // Add custom widget builder listener
    addWidgetBtn.addEventListener('click', () => {
      new CadenceWidgetCreateModal(this.app, async (newWidget) => {
        if (!this.plugin.settings.projectDashboardWidgets) {
          this.plugin.settings.projectDashboardWidgets = [];
        }
        this.plugin.settings.projectDashboardWidgets.push(newWidget);
        await this.plugin.saveSettings();
        this.render();
      }).open();
    });

    renderWidgets();
  }

  /* ── CRM Dashboard ──────────────────────── */
  async renderDashboard(root) {
    root.addClass('cadence-dashboard');

    // ─── Read all the relevant data ────────────────────
    const dealDef = ENTITIES.deal;
    const allDeals = listEntities(this.app, 'deal');
    const open = allDeals.filter((e) => !['Won', 'Lost'].includes(String(entityValue(e, 'stage', dealDef))));
    const won = allDeals.filter((e) => String(entityValue(e, 'stage', dealDef)) === 'Won');
    const lost = allDeals.filter((e) => String(entityValue(e, 'stage', dealDef)) === 'Lost');
    const dealValue = (e) => Number(entityValue(e, 'value', dealDef)) || 0;
    const sumVal = (arr) => arr.reduce((s, e) => s + dealValue(e), 0);
    const winRate = won.length + lost.length === 0 ? 0 : Math.round((won.length / (won.length + lost.length)) * 100);
    const avgDeal = won.length === 0 ? 0 : sumVal(won) / won.length;

    const contacts = listEntityFiles(this.app, 'contact');
    const companies = listEntityFiles(this.app, 'company');
    const partners = listEntityFiles(this.app, 'partner');
    const activities = listEntities(this.app, 'activity');

    // ─── Header ────────────────────────────────────────
    this._renderPageHeader(root, 'CRM Dashboard', 'Pipeline · momentum · recent activity', (right) => {
      const newDeal = right.createEl('button', { cls: 'cad-btn primary', text: '+ New Deal' });
      newDeal.addEventListener('click', () => this._createEntityFromPrompt('deal'));
    });

    // ─── Top stats (5 cards) ───────────────────────────
    const grid = root.createDiv({ cls: 'cad-stat-grid' });
    const stat = (label, value, sub, accent) => {
      const c = grid.createDiv({ cls: 'cad-stat-card' });
      if (accent) c.dataset.accent = accent;
      c.createDiv({ cls: 'cad-stat-label', text: label });
      c.createDiv({ cls: 'cad-stat-value', text: String(value) });
      if (sub) c.createDiv({ cls: 'cad-stat-sub', text: sub });
    };
    stat('OPEN PIPELINE', open.length, fmtValue(sumVal(open), 'currency'), 'sky');
    stat('WON', won.length, fmtValue(sumVal(won), 'currency'), 'emerald');
    stat('LOST', lost.length, fmtValue(sumVal(lost), 'currency'), 'rose');
    stat('WIN RATE', `${winRate}%`, `${won.length}/${won.length + lost.length} closed`, 'mint');
    stat('AVG DEAL', fmtValue(avgDeal, 'currency'), `${won.length} won deals`, 'warn');

    // ─── Pipeline by stage ─────────────────────────────
    root.createDiv({ cls: 'cad-section-label-lg', text: 'PIPELINE BY STAGE' });
    const stageData = getDealStages().map((stage) => {
      const items = allDeals.filter((e) => String(entityValue(e, 'stage', dealDef)) === stage);
      return { stage, items, value: sumVal(items) };
    });
    const maxStageVal = Math.max(1, ...stageData.map((s) => s.value));
    const stageWrap = root.createDiv({ cls: 'cad-stage-bars' });
    stageData.forEach(({ stage, items, value }) => {
      const row = stageWrap.createDiv({ cls: 'cad-stage-bar-row' });
      row.dataset.stage = stage;
      row.createDiv({ cls: 'cad-stage-bar-name', text: stage });
      row.createDiv({ cls: 'cad-stage-bar-count', text: `${items.length}` });
      const barWrap = row.createDiv({ cls: 'cad-stage-bar' });
      const fill = barWrap.createDiv({ cls: 'cad-stage-bar-fill' });
      fill.style.width = `${(value / maxStageVal) * 100}%`;
      row.createDiv({ cls: 'cad-stage-bar-value', text: fmtValue(value, 'currency') });
      row.addEventListener('click', () => this.setMode('crm.pipeline'));
    });

    // ─── Two-column body ───────────────────────────────
    const cols = root.createDiv({ cls: 'cad-dash-cols' });
    const left = cols.createDiv({ cls: 'cad-dash-col' });
    const right = cols.createDiv({ cls: 'cad-dash-col' });

    // Hot deals — top by value, open only
    const topHot = [...open]
      .sort((a, b) => dealValue(b) - dealValue(a))
      .slice(0, 5)
      .map((e) => ({
        title: entityValue(e, 'title', dealDef) || e.basename,
        meta: `${entityValue(e, 'stage', dealDef) || '—'} · ${fmtValue(dealValue(e), 'currency')}`,
        file: e.file,
      }));
    this._dashCardSection(left, 'HOT DEALS · top 5 by value', topHot, 'No open deals yet — hit + New Deal above.');

    // Stale deals — open, not touched in 14+ days (file mtime)
    const staleCutoff = Date.now() - 14 * 86400000;
    const stale = open
      .filter((e) => e.file && e.file.stat && e.file.stat.mtime < staleCutoff)
      .sort((a, b) => (a.file.stat.mtime || 0) - (b.file.stat.mtime || 0))
      .slice(0, 5)
      .map((e) => {
        const days = Math.round((Date.now() - e.file.stat.mtime) / 86400000);
        return {
          title: entityValue(e, 'title', dealDef) || e.basename,
          meta: `${entityValue(e, 'stage', dealDef) || '—'} · ${days}d quiet · ${fmtValue(dealValue(e), 'currency')}`,
          file: e.file,
        };
      });
    this._dashCardSection(left, 'STALE DEALS · 14+ days no edits', stale, 'No stale deals — momentum is good.');

    // Recent activity
    const recentAct = [...activities]
      .sort((a, b) => {
        const da = new Date(entityValue(a, 'when', ENTITIES.activity) || 0).getTime();
        const db = new Date(entityValue(b, 'when', ENTITIES.activity) || 0).getTime();
        return db - da;
      })
      .slice(0, 6)
      .map((e) => {
        const typeVal = entityValue(e, 'type', ENTITIES.activity) || '—';
        const withVal = entityValue(e, 'with', ENTITIES.activity) || '—';
        const dateVal = fmtValue(entityValue(e, 'when', ENTITIES.activity), 'date');
        return {
          title: entityValue(e, 'subject', ENTITIES.activity) || e.basename,
          metaParts: [
            { text: typeVal },
            { text: ' · ' },
            { text: withVal, entityKey: 'contact' },
            { text: ` · ${dateVal}` }
          ],
          file: e.file,
        };
      });
    this._dashCardSection(right, `RECENT ACTIVITY · ${activities.length} total`, recentAct, 'No activity logged yet. Capture a call or meeting under CRM > Activities.');

    // Customer base — mini stat row inside a card
    const baseCard = right.createDiv({ cls: 'cad-dash-card' });
    baseCard.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: `CUSTOMER BASE · ${contacts.length + companies.length + partners.length} records` });
    const baseBody = baseCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' });
    const mkMini = (label, val, accent, mode) => {
      const c = baseBody.createDiv({ cls: 'cad-mini-stat' });
      if (accent) c.dataset.accent = accent;
      c.createDiv({ cls: 'cad-mini-stat-value', text: String(val) });
      c.createDiv({ cls: 'cad-mini-stat-label', text: label });
      if (mode) {
        c.style.cursor = 'pointer';
        c.addEventListener('click', () => this.setMode(mode));
      }
    };
    mkMini('CONTACTS', contacts.length, 'warn', 'crm.contacts');
    mkMini('COMPANIES', companies.length, 'sky', 'crm.companies');
    mkMini('PARTNERS', partners.length, 'rose', 'prm.partners');

    // ─── Custom Widgets / Charts Section ────────────────
    const analyticsHeader = root.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 24px 32px 8px 32px; margin-bottom: 16px;' } });
    const labelEl = analyticsHeader.createEl('span', { cls: 'cad-section-label-lg',
      text: 'ANALYTICS & CHARTS', attr: { style: 'padding: 0; margin: 0; display: inline-block;' } });

    const addWidgetBtn = analyticsHeader.createEl('button', { cls: 'cad-btn primary', text: '+ Add Custom Chart' });

    const widgetsGrid = root.createDiv({ cls: 'cad-dash-cols', attr: { style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-bottom: 24px; padding: 0 32px;' } });

    const renderWidgets = () => {
      widgetsGrid.empty();

      const widgets = this.plugin.settings.crmDashboardWidgets || [];
      if (widgets.length === 0) {
        const emptyWrap = widgetsGrid.createDiv({ attr: { style: 'grid-column: 1 / -1; text-align: center; padding: 32px; background: var(--background-secondary); border-radius: 8px; border: 1px dashed var(--border-color);' } });
        emptyWrap.createDiv({ text: 'No custom charts added yet. Click "+ Add Custom Chart" to create one!', attr: { style: 'color: var(--text-muted); font-size: 0.95em;' } });
        return;
      }

      widgets.forEach((w) => {
        const card = widgetsGrid.createDiv({ cls: 'cad-dash-card', attr: { style: 'margin: 0; display: flex; flex-direction: column;' } });

        // Card Head
        const head = card.createDiv({ cls: 'cad-dash-card-head', attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;' } });
        const fieldKey = w.groupBy;

        head.createDiv({ cls: 'cad-dash-card-title', text: w.title.toUpperCase(), attr: { style: 'font-weight: 700; font-size: 0.75rem; letter-spacing: 0.12em;' } });

        const actionsWrap = head.createDiv({ attr: { style: 'display: flex; gap: 8px; align-items: center;' } });

        // Chart Style Select
        const styleSelect = actionsWrap.createEl('select', { cls: 'cad-prop-input' });
        styleSelect.style.padding = '2px 4px';
        styleSelect.style.fontSize = '0.8em';
        styleSelect.style.height = 'auto';
        styleSelect.style.width = 'auto';
        styleSelect.style.background = 'var(--background-primary)';
        styleSelect.style.color = 'var(--text-normal)';
        styleSelect.style.border = '1px solid var(--border-color)';
        styleSelect.style.borderRadius = '4px';

        [
          { value: 'donut', label: '🍩 Donut' },
          { value: 'bar', label: '📊 Bar' },
          { value: 'kpi', label: '🗃️ KPI Cards' },
          { value: 'list', label: '📋 List' }
        ].forEach(opt => {
          const o = styleSelect.createEl('option', { value: opt.value, text: opt.label });
          if (w.style === opt.value) o.selected = true;
        });

        styleSelect.addEventListener('change', async () => {
          w.style = styleSelect.value;
          await this.plugin.saveSettings();
          this.render();
        });

        // Delete button
        const delBtn = actionsWrap.createEl('button', { cls: 'cad-btn',
          text: '×', attr: { style: 'color: var(--text-error); padding: 2px 8px; font-weight: bold; border-color: var(--text-error); font-size: 1.1em; height: auto; border-radius: 4px; background: transparent;' } });
        delBtn.addEventListener('click', async () => {
          if (!confirm(`Delete chart "${w.title}"?`)) return;
          this.plugin.settings.crmDashboardWidgets = (this.plugin.settings.crmDashboardWidgets || []).filter(item => item.id !== w.id);
          await this.plugin.saveSettings();
          this.render();
        });

        const body = card.createDiv({ cls: 'cad-dash-card-body', attr: { style: 'flex: 1; min-height: 180px; display: flex; flex-direction: column; justify-content: center; padding: 14px;' } });

        // Calculate chart data for this widget
        const counts = {};
        allDeals.forEach(p => {
          let val = entityValue(p, fieldKey, dealDef);
          if (Array.isArray(val)) {
            val.forEach(v => {
              const clean = String(v).replace(/^\[\[|\]\]$/g, '').trim();
              if (clean) counts[clean] = (counts[clean] || 0) + 1;
            });
          } else {
            const clean = String(val || '').replace(/^\[\[|\]\]$/g, '').trim();
            const label = clean || 'Unspecified';
            counts[label] = (counts[label] || 0) + 1;
          }
        });

        const chartData = Object.entries(counts)
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count);

        // Draw chart directly into a fresh div — no innerHTML.
        this._drawChart(body.createDiv(), w.style, chartData);
      });
    };

    addWidgetBtn.addEventListener('click', () => {
      new CadenceWidgetCreateModal(this.app, 'deal', async (newWidget) => {
        if (!this.plugin.settings.crmDashboardWidgets) {
          this.plugin.settings.crmDashboardWidgets = [];
        }
        this.plugin.settings.crmDashboardWidgets.push(newWidget);
        await this.plugin.saveSettings();
        this.render();
      }).open();
    });

    renderWidgets();
  }

  /* Reusable list card on the dashboard. */
  _dashCardSection(parent, title, rows, emptyMsg) {
    const card = parent.createDiv({ cls: 'cad-dash-card' });
    card.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: title });
    const body = card.createDiv({ cls: 'cad-dash-card-body' });
    if (!rows || !rows.length) {
      body.createDiv({ cls: 'cad-empty', text: emptyMsg || 'Nothing here yet.' });
      return;
    }
    rows.forEach((r) => {
      const row = body.createDiv({ cls: 'cad-dash-row' });

      const titleDiv = row.createDiv({ cls: 'cad-dash-row-title' });
      if (r.titleEntityKey) {
        this._renderEntityLinks(titleDiv, r.title, r.titleEntityKey);
      } else {
        titleDiv.setText(r.title || '');
      }

      const metaDiv = row.createDiv({ cls: 'cad-dash-row-meta' });
      if (r.metaParts) {
        r.metaParts.forEach((part) => {
          if (part.entityKey) {
            this._renderEntityLinks(metaDiv, part.text, part.entityKey);
          } else {
            metaDiv.createSpan({ text: part.text || '' });
          }
        });
      } else {
        metaDiv.setText(r.meta || '');
      }

      if (r.file) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => this.openEntityDetailFromFile(r.file));
      }
    });
  }


  /* ── Reports: Productivity (over daily notes) ── */
  async renderProductivity(root) {
    root.addClass('cadence-report');
    const settings = this.plugin.settings;

    // Walk last 30 days
    const today = startOfDay(new Date());
    const days = Array.from({ length: 30 }, (_, i) => addDays(today, -i));
    let totalOpen = 0, totalDone = 0, totalJournalChars = 0;
    let activeDays = 0;
    let streak = 0, streakBroken = false;
    const perDay = [];
    for (const d of days) {
      const f = this.app.vault.getAbstractFileByPath(dailyNotePath(settings, d));
      let open = 0, done = 0, jChars = 0, hasNote = false;
      if (f && f instanceof obsidian.TFile) {
        hasNote = true;
        const c = await this.app.vault.read(f);
        const p = parseSections(c, settings);
        open = p.tasks.filter((l) => / \[ \] /.test(l)).length;
        done = p.tasks.filter((l) => / \[(x|X)\] /.test(l)).length;
        jChars = (p.journal || '').length;
      }
      perDay.push({ date: d, open, done, jChars, hasNote });
      totalOpen += open; totalDone += done; totalJournalChars += jChars;
      if (hasNote) activeDays++;
      if (!streakBroken) {
        if (hasNote && (done > 0 || jChars > 0)) streak++;
        else streakBroken = true;
      }
    }

    const completion = totalOpen + totalDone === 0 ? 0 : Math.round((totalDone / (totalOpen + totalDone)) * 100);

    this._renderPageHeader(root, 'Productivity', 'Last 30 days · across your daily notes');

    const grid = root.createDiv({ cls: 'cad-stat-grid' });
    const stat = (label, value, sub, accent) => {
      const c = grid.createDiv({ cls: 'cad-stat-card' });
      if (accent) c.dataset.accent = accent;
      c.createDiv({ cls: 'cad-stat-label', text: label });
      c.createDiv({ cls: 'cad-stat-value', text: String(value) });
      if (sub) c.createDiv({ cls: 'cad-stat-sub', text: sub });
    };
    stat('COMPLETION', `${completion}%`, `${totalDone}/${totalOpen + totalDone} tasks`, 'emerald');
    stat('STREAK', `${streak}d`, 'consecutive active days', 'mint');
    stat('ACTIVE', `${activeDays}/30`, 'days with a note', 'sky');
    stat('JOURNAL', totalJournalChars.toLocaleString(), 'characters written', 'warn');

    // Bar chart of completed tasks per day (last 14 days, oldest left)
    root.createDiv({ cls: 'cad-section-label-lg', text: 'TASKS DONE — LAST 14 DAYS' });
    const last14 = perDay.slice(0, 14).reverse();
    const max = Math.max(1, ...last14.map((p) => p.done));
    const chart = root.createDiv({ cls: 'cad-bar-chart' });
    last14.forEach((p) => {
      const col = chart.createDiv({ cls: 'cad-bar-col' });
      const bar = col.createDiv({ cls: 'cad-bar' });
      bar.style.height = `${(p.done / max) * 100}%`;
      const ratio = p.done / max;
      bar.dataset.band = p.done === 0 ? 'empty' : ratio < 0.34 ? 'low' : ratio < 0.67 ? 'mid' : 'high';
      const lbl = col.createDiv({ cls: 'cad-bar-label', text: String(p.date.getDate()) });
      bar.title = `${p.date.toLocaleDateString()} — ${p.done} done, ${p.open} open`;
      void lbl;
    });

    /* 12-week completion trend */
    const weekStart = startOfWeek(today, this.plugin.settings.weekStartsOn);
    const weeks = [];
    for (let w = 11; w >= 0; w--) {
      const ws = addDays(weekStart, -w * 7);
      const we = addDays(ws, 7);
      let wd = 0, wo = 0, anyNote = false;
      for (let i = 0; i < 7; i++) {
        const d = addDays(ws, i);
        if (d.getTime() > today.getTime()) break;
        const f = this.app.vault.getAbstractFileByPath(dailyNotePath(settings, d));
        if (f && f instanceof obsidian.TFile) {
          anyNote = true;
          const c = await this.app.vault.read(f);
          const p = parseSections(c, settings);
          p.tasks.forEach((l) => { if (/ \[(x|X)\] /.test(l)) wd++; else if (/ \[ \] /.test(l)) wo++; });
        }
      }
      weeks.push({ start: ws, done: wd, open: wo, any: anyNote, label: ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });
    }
    const maxWeek = Math.max(1, ...weeks.map((w) => w.done));
    root.createDiv({ cls: 'cad-section-label-lg', text: 'COMPLETION TREND — LAST 12 WEEKS' });
    const wkChart = root.createDiv({ cls: 'cad-bar-chart cad-bar-chart-tall' });
    weeks.forEach((w) => {
      const col = wkChart.createDiv({ cls: 'cad-bar-col' });
      const bar = col.createDiv({ cls: 'cad-bar' });
      bar.style.height = `${(w.done / maxWeek) * 100}%`;
      const ratio = w.done / maxWeek;
      bar.dataset.band = w.done === 0 ? 'empty' : ratio < 0.34 ? 'low' : ratio < 0.67 ? 'mid' : 'high';
      bar.title = `Week of ${w.label} — ${w.done} done, ${w.open} open`;
      col.createDiv({ cls: 'cad-bar-label', text: w.label });
    });

    /* Completion by weekday (Mon-Sun aggregated over the 30 days) */
    const wsOn = settings.weekStartsOn;
    const dayBuckets = Array.from({ length: 7 }, () => ({ done: 0, open: 0 }));
    perDay.forEach((p) => {
      // p.date.getDay() returns 0 (Sun) .. 6 (Sat). Re-index based on weekStartsOn.
      const idx = (p.date.getDay() - wsOn + 7) % 7;
      dayBuckets[idx].done += p.done;
      dayBuckets[idx].open += p.open;
    });
    const dayLabels = wsOn === 1
      ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
      : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    root.createDiv({ cls: 'cad-section-label-lg', text: 'COMPLETION BY WEEKDAY · LAST 30 DAYS' });
    const dayCard = root.createDiv({ cls: 'cad-dash-card' });
    dayCard.style.margin = '0 36px 24px 36px';
    const dayBody = dayCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' });
    const dayAccents = ['emerald', 'mint', 'sky', 'warn', 'rose', 'mint', 'sky'];
    dayBuckets.forEach((b, i) => {
      const total = b.done + b.open;
      const pct = total === 0 ? 0 : Math.round((b.done / total) * 100);
      const mini = dayBody.createDiv({ cls: 'cad-mini-stat' });
      mini.dataset.accent = dayAccents[i];
      mini.createDiv({ cls: 'cad-mini-stat-value', text: total === 0 ? '—' : `${pct}%` });
      mini.createDiv({ cls: 'cad-mini-stat-label', text: dayLabels[i] });
      const sub = mini.createDiv({ cls: 'cad-stat-sub' });
      sub.style.marginTop = '4px';
      sub.setText(total === 0 ? 'no data' : `${b.done}/${total}`);
    });
  }

  /* ── Reports: Pipeline (deals breakdown) ──────── */
  async renderReportPipeline(root) {
    root.addClass('cadence-report');
    const def = ENTITIES.deal;
    const deals = listEntities(this.app, 'deal');
    const open = deals.filter((e) => !['Won', 'Lost'].includes(String(entityValue(e, 'stage', def))));
    const won = deals.filter((e) => String(entityValue(e, 'stage', def)) === 'Won');
    const lost = deals.filter((e) => String(entityValue(e, 'stage', def)) === 'Lost');
    const dealValue = (e) => Number(entityValue(e, 'value', def)) || 0;
    const sumVal = (arr) => arr.reduce((s, e) => s + dealValue(e), 0);
    const winRate = won.length + lost.length === 0 ? 0 : Math.round((won.length / (won.length + lost.length)) * 100);

    // Weighted forecast — confidence per stage applied to open deal value.
    const stageConfidence = { 'Lead': 0.10, 'Qualified': 0.25, 'Proposal': 0.50, 'Negotiation': 0.75 };
    const weighted = open.reduce((s, e) => s + dealValue(e) * (stageConfidence[String(entityValue(e, 'stage', def))] || 0), 0);

    this._renderPageHeader(root, 'Pipeline report', 'Coverage, forecast and aging across all deals');

    const grid = root.createDiv({ cls: 'cad-stat-grid' });
    const stat = (label, value, sub, accent) => {
      const c = grid.createDiv({ cls: 'cad-stat-card' });
      if (accent) c.dataset.accent = accent;
      c.createDiv({ cls: 'cad-stat-label', text: label });
      c.createDiv({ cls: 'cad-stat-value', text: String(value) });
      if (sub) c.createDiv({ cls: 'cad-stat-sub', text: sub });
    };
    stat('OPEN', open.length, fmtValue(sumVal(open), 'currency'), 'sky');
    stat('WEIGHTED', fmtValue(weighted, 'currency'), 'forecast on open', 'mint');
    stat('WON', won.length, fmtValue(sumVal(won), 'currency'), 'emerald');
    stat('LOST', lost.length, fmtValue(sumVal(lost), 'currency'), 'rose');
    stat('WIN RATE', `${winRate}%`, `${won.length}/${won.length + lost.length} closed`, 'warn');

    /* By stage table (existing, kept) */
    root.createDiv({ cls: 'cad-section-label-lg', text: 'BY STAGE' });
    const tableWrap = root.createDiv({ cls: 'cad-table-wrap' });
    const table = tableWrap.createEl('table', { cls: 'cad-table' });
    const trh = table.createEl('thead').createEl('tr');
    ['Stage', 'Count', 'Value'].forEach((h) => trh.createEl('th', { text: h }));
    const tbody = table.createEl('tbody');
    getDealStages().forEach((stage) => {
      const items = deals.filter((e) => String(entityValue(e, 'stage', def)) === stage);
      const tr = tbody.createEl('tr');
      tr.createEl('td', { text: stage });
      tr.createEl('td', { text: String(items.length) });
      tr.createEl('td', { text: fmtValue(sumVal(items), 'currency') });
    });

    /* Two-col body: by owner + aging cohorts */
    const cols = root.createDiv({ cls: 'cad-dash-cols' });
    const left = cols.createDiv({ cls: 'cad-dash-col' });
    const right = cols.createDiv({ cls: 'cad-dash-col' });

    // Pipeline by owner
    const byOwner = new Map();
    open.forEach((e) => {
      const owner = String(entityValue(e, 'owner', def) || '(unassigned)');
      if (!byOwner.has(owner)) byOwner.set(owner, { count: 0, value: 0 });
      const o = byOwner.get(owner);
      o.count++; o.value += dealValue(e);
    });
    const ownerRows = [...byOwner.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 8)
      .map(([owner, data]) => ({
        title: owner,
        titleEntityKey: owner === '(unassigned)' ? null : 'contact',
        meta: `${data.count} deal${data.count === 1 ? '' : 's'} · ${fmtValue(data.value, 'currency')}`,
      }));
    this._dashCardSection(left, `OPEN PIPELINE BY OWNER · top ${Math.min(8, byOwner.size)}`, ownerRows, 'No open deals to attribute.');

    // Aging cohorts (file mtime)
    const now = Date.now();
    const cohorts = [
      { label: '0–7 DAYS', cutoff: 7, count: 0, value: 0, accent: 'emerald' },
      { label: '8–30 DAYS', cutoff: 30, count: 0, value: 0, accent: 'mint' },
      { label: '31–90 DAYS', cutoff: 90, count: 0, value: 0, accent: 'warn' },
      { label: '90+ DAYS', cutoff: Infinity, count: 0, value: 0, accent: 'rose' },
    ];
    open.forEach((e) => {
      const mtime = e.file && e.file.stat ? e.file.stat.mtime : now;
      const days = (now - mtime) / 86400000;
      for (const c of cohorts) {
        if (days <= c.cutoff) { c.count++; c.value += dealValue(e); break; }
      }
    });
    const agingCard = right.createDiv({ cls: 'cad-dash-card' });
    agingCard.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: 'AGING · OPEN DEALS BY LAST EDIT' });
    const agingBody = agingCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' });
    cohorts.forEach((c) => {
      const mini = agingBody.createDiv({ cls: 'cad-mini-stat' });
      mini.dataset.accent = c.accent;
      mini.createDiv({ cls: 'cad-mini-stat-value', text: String(c.count) });
      mini.createDiv({ cls: 'cad-mini-stat-label', text: c.label });
      const sub = mini.createDiv({ cls: 'cad-stat-sub' });
      sub.style.marginTop = '4px';
      sub.setText(fmtValue(c.value, 'currency'));
    });

    // Stale top-5 list under aging
    const staleCutoff = now - 30 * 86400000;
    const stale = open
      .filter((e) => e.file && e.file.stat && e.file.stat.mtime < staleCutoff)
      .sort((a, b) => (a.file.stat.mtime || 0) - (b.file.stat.mtime || 0))
      .slice(0, 5)
      .map((e) => ({
        title: entityValue(e, 'title', def) || e.basename,
        meta: `${entityValue(e, 'stage', def) || '—'} · ${Math.round((now - e.file.stat.mtime) / 86400000)}d quiet · ${fmtValue(dealValue(e), 'currency')}`,
        file: e.file,
      }));
    this._dashCardSection(right, 'STALE · 30+ DAYS NO EDITS', stale, 'No deals over 30 days quiet — nice.');
  }

  /* ── Reports: Sales (closed deals) ─────────────── */
  async renderReportSales(root) {
    root.addClass('cadence-report');
    const def = ENTITIES.deal;
    const deals = listEntities(this.app, 'deal');
    const won = deals.filter((e) => String(entityValue(e, 'stage', def)) === 'Won');
    const lost = deals.filter((e) => String(entityValue(e, 'stage', def)) === 'Lost');
    const dealValue = (e) => Number(entityValue(e, 'value', def)) || 0;
    const sumVal = (arr) => arr.reduce((s, e) => s + dealValue(e), 0);

    this._renderPageHeader(root, 'Sales report', 'Closed-won and lost · performance over time');

    const grid = root.createDiv({ cls: 'cad-stat-grid' });
    const stat = (label, value, sub, accent) => {
      const c = grid.createDiv({ cls: 'cad-stat-card' });
      if (accent) c.dataset.accent = accent;
      c.createDiv({ cls: 'cad-stat-label', text: label });
      c.createDiv({ cls: 'cad-stat-value', text: String(value) });
      if (sub) c.createDiv({ cls: 'cad-stat-sub', text: sub });
    };
    stat('REVENUE', fmtValue(sumVal(won), 'currency'), `${won.length} deals`, 'emerald');
    stat('LOST', fmtValue(sumVal(lost), 'currency'), `${lost.length} deals`, 'rose');
    const total = sumVal(won) + sumVal(lost);
    const captureRate = total === 0 ? 0 : Math.round((sumVal(won) / total) * 100);
    stat('CAPTURE', `${captureRate}%`, 'of closed value', 'mint');
    const avg = won.length === 0 ? 0 : sumVal(won) / won.length;
    stat('AVG DEAL', fmtValue(avg, 'currency'), 'won deals', 'sky');

    /* Revenue by month (last 6 months, by file mtime as close proxy) */
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        date: d,
        label: d.toLocaleDateString(undefined, { month: 'short' }),
        revenue: 0,
        count: 0,
      });
    }
    won.forEach((e) => {
      const t = e.file && e.file.stat ? e.file.stat.mtime : null;
      if (!t) return;
      const d = new Date(t);
      const idx = months.findIndex((m) => m.date.getFullYear() === d.getFullYear() && m.date.getMonth() === d.getMonth());
      if (idx >= 0) { months[idx].revenue += dealValue(e); months[idx].count++; }
    });
    const maxRev = Math.max(1, ...months.map((m) => m.revenue));
    root.createDiv({ cls: 'cad-section-label-lg', text: 'REVENUE — LAST 6 MONTHS' });
    const chart = root.createDiv({ cls: 'cad-bar-chart cad-bar-chart-tall' });
    months.forEach((m) => {
      const col = chart.createDiv({ cls: 'cad-bar-col' });
      const bar = col.createDiv({ cls: 'cad-bar' });
      bar.style.height = `${(m.revenue / maxRev) * 100}%`;
      const ratio = m.revenue / maxRev;
      bar.dataset.band = m.revenue === 0 ? 'empty' : ratio < 0.34 ? 'low' : ratio < 0.67 ? 'mid' : 'high';
      bar.title = `${m.label} — ${fmtValue(m.revenue, 'currency')} · ${m.count} deals`;
      col.createDiv({ cls: 'cad-bar-label', text: m.label });
    });

    /* Two-col: top wins + top owners */
    const cols = root.createDiv({ cls: 'cad-dash-cols' });
    const left = cols.createDiv({ cls: 'cad-dash-col' });
    const right = cols.createDiv({ cls: 'cad-dash-col' });

    const topWins = [...won]
      .sort((a, b) => dealValue(b) - dealValue(a))
      .slice(0, 6)
      .map((e) => {
        const companyVal = entityValue(e, 'company', def) || '—';
        const valStr = fmtValue(dealValue(e), 'currency');
        return {
          title: entityValue(e, 'title', def) || e.basename,
          metaParts: [
            { text: companyVal, entityKey: 'company' },
            { text: ` · ${valStr}` }
          ],
          file: e.file,
        };
      });
    this._dashCardSection(left, 'TOP WINS · top 6', topWins, 'No wins logged yet — close one and tag it Won.');

    // Top owners by revenue
    const byOwner = new Map();
    won.forEach((e) => {
      const owner = String(entityValue(e, 'owner', def) || '(unassigned)');
      if (!byOwner.has(owner)) byOwner.set(owner, { count: 0, revenue: 0 });
      const o = byOwner.get(owner);
      o.count++; o.revenue += dealValue(e);
    });
    const ownerRows = [...byOwner.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 6)
      .map(([owner, data]) => ({
        title: owner,
        titleEntityKey: owner === '(unassigned)' ? null : 'contact',
        meta: `${data.count} won · ${fmtValue(data.revenue, 'currency')}`,
      }));
    this._dashCardSection(right, 'OWNER LEADERBOARD · top 6 by revenue', ownerRows, 'No revenue attributed to owners yet.');
  }

  /* ── Reports: Partners (deals attributed to partners) ─ */
  async renderReportPartners(root) {
    root.addClass('cadence-report');
    const dealDef = ENTITIES.deal;
    const partnerDef = ENTITIES.partner;
    const certDef = ENTITIES.certification;
    const deals = listEntities(this.app, 'deal');
    const partners = listEntities(this.app, 'partner');
    const certs = listEntities(this.app, 'certification');
    const dealValue = (e) => Number(entityValue(e, 'value', dealDef)) || 0;

    this._renderPageHeader(root, 'Partners report', 'Partner-sourced revenue, tier mix, certification health');

    // Group deals by 'partner' frontmatter
    const byPartner = new Map();
    deals.forEach((e) => {
      const p = entityValue(e, 'partner', dealDef) || '(direct)';
      if (!byPartner.has(p)) byPartner.set(p, []);
      byPartner.get(p).push(e);
    });
    const partnerSourced = deals.filter((e) => entityValue(e, 'partner', dealDef));
    const partnerWon = partnerSourced.filter((e) => String(entityValue(e, 'stage', dealDef)) === 'Won');

    const grid = root.createDiv({ cls: 'cad-stat-grid' });
    const stat = (label, value, sub, accent) => {
      const c = grid.createDiv({ cls: 'cad-stat-card' });
      if (accent) c.dataset.accent = accent;
      c.createDiv({ cls: 'cad-stat-label', text: label });
      c.createDiv({ cls: 'cad-stat-value', text: String(value) });
      if (sub) c.createDiv({ cls: 'cad-stat-sub', text: sub });
    };
    stat('PARTNERS', partners.length, 'on the books', 'sky');
    stat('PARTNER DEALS', partnerSourced.length, fmtValue(partnerSourced.reduce((s, e) => s + dealValue(e), 0), 'currency'), 'mint');
    stat('PARTNER REV', fmtValue(partnerWon.reduce((s, e) => s + dealValue(e), 0), 'currency'), `${partnerWon.length} won`, 'emerald');
    stat('UNIQUE SOURCES', byPartner.size, 'including direct', 'warn');

    /* Tier breakdown */
    const tierMap = new Map();
    partners.forEach((p) => {
      const t = String(entityValue(p, 'tier', partnerDef) || 'Untiered');
      if (!tierMap.has(t)) tierMap.set(t, 0);
      tierMap.set(t, tierMap.get(t) + 1);
    });
    if (tierMap.size) {
      root.createDiv({ cls: 'cad-section-label-lg', text: 'PARTNERS BY TIER' });
      const tierCard = root.createDiv({ cls: 'cad-dash-card' });
      tierCard.style.margin = '0 36px 18px 36px';
      const tierBody = tierCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' });
      const tierAccent = { 'Gold': 'warn', 'Silver': 'sky', 'Bronze': 'rose', 'Standard': 'mint' };
      [...tierMap.entries()].sort((a, b) => b[1] - a[1]).forEach(([tier, count]) => {
        const mini = tierBody.createDiv({ cls: 'cad-mini-stat' });
        mini.dataset.accent = tierAccent[tier] || 'sky';
        mini.createDiv({ cls: 'cad-mini-stat-value', text: String(count) });
        mini.createDiv({ cls: 'cad-mini-stat-label', text: tier.toUpperCase() });
      });
    }

    /* Two-col: deals-by-partner table + cert expiries */
    const cols = root.createDiv({ cls: 'cad-dash-cols' });
    const left = cols.createDiv({ cls: 'cad-dash-col' });
    const right = cols.createDiv({ cls: 'cad-dash-col' });

    // Deals by partner — keep table style
    const dealsByPartnerCard = left.createDiv({ cls: 'cad-dash-card' });
    dealsByPartnerCard.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: 'DEALS BY PARTNER' });
    const dbpBody = dealsByPartnerCard.createDiv({ cls: 'cad-dash-card-body' });
    if (!byPartner.size) {
      dbpBody.createDiv({ cls: 'cad-empty', text: 'No deals attributed to partners yet.' });
    } else {
      [...byPartner.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 10)
        .forEach(([p, items]) => {
          const v = items.reduce((s, e) => s + dealValue(e), 0);
          const row = dbpBody.createDiv({ cls: 'cad-dash-row' });
          const titleDiv = row.createDiv({ cls: 'cad-dash-row-title' });
          if (p && p !== '(direct)') {
            this._renderEntityLinks(titleDiv, p, 'partner');
          } else {
            titleDiv.setText(p || '');
          }
          row.createDiv({ cls: 'cad-dash-row-meta', text: `${items.length} deal${items.length === 1 ? '' : 's'} · ${fmtValue(v, 'currency')}` });
        });
    }

    // Cert expiries upcoming (next 90 days)
    const now = Date.now();
    const horizon = now + 90 * 86400000;
    const upcomingCerts = certs
      .map((e) => {
        const exp = entityValue(e, 'expires', certDef);
        if (!exp) return null;
        const d = new Date(exp);
        if (isNaN(d.getTime())) return null;
        return { entity: e, date: d };
      })
      .filter((x) => x && x.date.getTime() >= now && x.date.getTime() <= horizon)
      .sort((a, b) => a.date - b.date)
      .slice(0, 8)
      .map((x) => {
        const partnerVal = entityValue(x.entity, 'partner', certDef) || '—';
        const expVal = ` · expires ${fmtValue(x.date, 'date')}`;
        return {
          title: entityValue(x.entity, 'name', certDef) || x.entity.basename,
          metaParts: [
            { text: partnerVal, entityKey: 'partner' },
            { text: expVal }
          ],
          file: x.entity.file,
        };
      });
    this._dashCardSection(right, 'CERTS EXPIRING · NEXT 90 DAYS', upcomingCerts, 'No certifications expiring in the next 90 days.');
  }

  /* ── Reports: Activity (mix of activity types) ─ */
  async renderReportActivity(root) {
    root.addClass('cadence-report');
    const def = ENTITIES.activity;
    const acts = listEntities(this.app, 'activity');

    this._renderPageHeader(root, 'Activity report', 'Calls, meetings, emails and notes — mix and momentum');

    const counts = new Map();
    acts.forEach((e) => {
      const t = String(entityValue(e, 'type', def) || 'unspecified');
      counts.set(t, (counts.get(t) || 0) + 1);
    });

    const grid = root.createDiv({ cls: 'cad-stat-grid' });
    const stat = (label, value, sub, accent) => {
      const c = grid.createDiv({ cls: 'cad-stat-card' });
      if (accent) c.dataset.accent = accent;
      c.createDiv({ cls: 'cad-stat-label', text: label });
      c.createDiv({ cls: 'cad-stat-value', text: String(value) });
      if (sub) c.createDiv({ cls: 'cad-stat-sub', text: sub });
    };
    stat('TOTAL', acts.length, 'all activities', 'emerald');
    const accents = ['sky', 'mint', 'warn', 'rose'];
    let i = 0;
    counts.forEach((v, k) => stat(k.toUpperCase(), v, '', accents[i++ % accents.length]));

    /* Activity by week (last 8 weeks) */
    const now = new Date();
    const weekStart = startOfWeek(now, this.plugin.settings.weekStartsOn);
    const weeks = [];
    for (let w = 7; w >= 0; w--) {
      const ws = addDays(weekStart, -w * 7);
      const we = addDays(ws, 7);
      weeks.push({ start: ws, end: we, count: 0, label: ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });
    }
    acts.forEach((e) => {
      const when = entityValue(e, 'when', def);
      if (!when) return;
      const t = new Date(when).getTime();
      if (isNaN(t)) return;
      const idx = weeks.findIndex((w) => t >= w.start.getTime() && t < w.end.getTime());
      if (idx >= 0) weeks[idx].count++;
    });
    const maxWeek = Math.max(1, ...weeks.map((w) => w.count));
    root.createDiv({ cls: 'cad-section-label-lg', text: 'ACTIVITY — LAST 8 WEEKS' });
    const chart = root.createDiv({ cls: 'cad-bar-chart cad-bar-chart-tall' });
    weeks.forEach((w) => {
      const col = chart.createDiv({ cls: 'cad-bar-col' });
      const bar = col.createDiv({ cls: 'cad-bar' });
      bar.style.height = `${(w.count / maxWeek) * 100}%`;
      const ratio = w.count / maxWeek;
      bar.dataset.band = w.count === 0 ? 'empty' : ratio < 0.34 ? 'low' : ratio < 0.67 ? 'mid' : 'high';
      bar.title = `Week of ${w.label} — ${w.count} activities`;
      col.createDiv({ cls: 'cad-bar-label', text: w.label });
    });

    /* Two-col: top contacts + recent activity */
    const cols = root.createDiv({ cls: 'cad-dash-cols' });
    const left = cols.createDiv({ cls: 'cad-dash-col' });
    const right = cols.createDiv({ cls: 'cad-dash-col' });

    // Top contacts by activity count
    const contactCounts = new Map();
    acts.forEach((e) => {
      const w = String(entityValue(e, 'with', def) || '').trim();
      if (!w) return;
      contactCounts.set(w, (contactCounts.get(w) || 0) + 1);
    });
    const topContactRows = [...contactCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([who, count]) => ({
        title: who,
        titleEntityKey: 'contact',
        meta: `${count} activit${count === 1 ? 'y' : 'ies'}`,
      }));
    this._dashCardSection(left, 'TOP CONTACTS · by activity count', topContactRows, 'No activities tagged with a contact yet.');

    // Recent activity (last 10)
    const recent = [...acts]
      .sort((a, b) => {
        const da = new Date(entityValue(a, 'when', def) || 0).getTime();
        const db = new Date(entityValue(b, 'when', def) || 0).getTime();
        return db - da;
      })
      .slice(0, 10)
      .map((e) => {
        const typeVal = entityValue(e, 'type', def) || '—';
        const withVal = entityValue(e, 'with', def) || '—';
        const dateVal = fmtValue(entityValue(e, 'when', def), 'date');
        return {
          title: entityValue(e, 'subject', def) || e.basename,
          metaParts: [
            { text: typeVal },
            { text: ' · ' },
            { text: withVal, entityKey: 'contact' },
            { text: ` · ${dateVal}` }
          ],
          file: e.file,
        };
      });
    this._dashCardSection(right, 'RECENT ACTIVITY · last 10', recent, 'No activities yet — log one under CRM > Activities.');
  }

  /* ── Reports: Relationship Graph ────────── */
  async renderReportGraph(root) {
    root.addClass('cadence-report');
    this._renderPageHeader(root, 'Graph View', 'Relationship graph showing connections between contacts, companies, partners, projects, deals, and activities.');

    const graphCard = root.createDiv({ cls: 'cad-home-card' });
    graphCard.style.padding = '16px';
    graphCard.style.height = '600px';
    graphCard.style.position = 'relative';
    graphCard.style.overflow = 'hidden';
    graphCard.style.backgroundColor = 'var(--background-secondary)';
    graphCard.style.borderRadius = '8px';
    graphCard.style.border = '1px solid var(--border-color)';
    graphCard.style.marginTop = '24px';
    graphCard.style.marginBottom = '24px';

    const canvas = graphCard.createEl('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.cursor = 'default';

    // Tooltip
    const tooltip = graphCard.createDiv();
    tooltip.style.position = 'absolute';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.padding = '6px 10px';
    tooltip.style.backgroundColor = 'var(--background-primary)';
    tooltip.style.border = '1px solid var(--border-color)';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '12px';
    tooltip.style.color = 'var(--text-normal)';
    tooltip.style.display = 'none';
    tooltip.style.zIndex = '100';
    tooltip.style.boxShadow = 'var(--shadow-s)';

    // Gather Nodes & Links
    const rawFiles = this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith('Cadence/'));
    const resolvedLinks = this.app.metadataCache.resolvedLinks || {};

    const nodes = [];
    const nodeMap = new Map();

    rawFiles.forEach((file) => {
      let type = 'note';
      if (file.path.startsWith('Cadence/Contacts/')) type = 'contact';
      else if (file.path.startsWith('Cadence/Companies/')) type = 'company';
      else if (file.path.startsWith('Cadence/Partners/')) type = 'partner';
      else if (file.path.startsWith('Cadence/Pipeline/')) type = 'deal';
      else if (file.path.startsWith('Cadence/Projects/')) type = 'project';
      else if (file.path.startsWith('Cadence/Activities/')) type = 'activity';
      else if (file.path.startsWith('Cadence/Leads/')) type = 'lead';

      const node = {
        id: file.path,
        name: file.basename,
        type,
        file,
        x: Math.random() * 500 + 150,
        y: Math.random() * 250 + 100,
        vx: 0,
        vy: 0,
        radius: type === 'company' ? 7 : (type === 'project' ? 6.5 : 5)
      };
      nodes.push(node);
      nodeMap.set(file.path, node);
    });

    const links = [];
    nodes.forEach((sourceNode) => {
      const targets = resolvedLinks[sourceNode.id] || {};
      for (const targetPath of Object.keys(targets)) {
        const targetNode = nodeMap.get(targetPath);
        if (targetNode) {
          links.push({ source: sourceNode, target: targetNode });
        }
      }
    });

    // Colors mapping to native Obsidian style & pastel highlights
    const typeColors = {
      contact: 'var(--graph-node-resolved, #f59e0b)',  // warm orange
      company: '#0ea5e9',  // sky blue
      partner: '#ec4899',  // rose pink
      deal: '#10b981',     // emerald green
      project: '#8b5cf6',  // violet purple
      activity: '#64748b', // slate gray
      lead: '#a855f7',     // purple
      note: 'var(--graph-node, #94a3b8)'      // gray
    };

    let width = canvas.clientWidth || 800;
    let height = canvas.clientHeight || 400;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Zoom & Pan state
    let transform = { x: 0, y: 0, k: 1 };
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let draggedNode = null;
    let hoveredNode = null;
    let dragStartPos = { x: 0, y: 0 };
    let hasMovedSinceDown = false;

    // Resize handling
    const resizeObserver = new ResizeObserver(() => {
      if (!canvas.clientWidth) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      ctx.resetTransform();
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    });
    resizeObserver.observe(canvas);

    // Coordinate conversions
    const getMousePos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    const getCanvasPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      return {
        x: (screenX - transform.x) / transform.k,
        y: (screenY - transform.y) / transform.k
      };
    };

    // Interaction Events
    canvas.addEventListener('mousedown', (e) => {
      dragStartPos = { x: e.clientX, y: e.clientY };
      hasMovedSinceDown = false;

      const canvasPos = getCanvasPos(e);
      let found = null;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const dx = canvasPos.x - n.x;
        const dy = canvasPos.y - n.y;
        if (dx * dx + dy * dy < (n.radius + 8) * (n.radius + 8)) {
          found = n;
          break;
        }
      }

      if (found) {
        draggedNode = found;
      } else {
        isPanning = true;
        panStart = { x: e.clientX - transform.x, y: e.clientY - transform.y };
        canvas.style.cursor = 'grabbing';
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      const dist = Math.hypot(e.clientX - dragStartPos.x, e.clientY - dragStartPos.y);
      if (dist > 4) {
        hasMovedSinceDown = true;
      }

      const canvasPos = getCanvasPos(e);

      if (draggedNode) {
        draggedNode.x = canvasPos.x;
        draggedNode.y = canvasPos.y;
        draggedNode.vx = 0;
        draggedNode.vy = 0;
      } else if (isPanning) {
        transform.x = e.clientX - panStart.x;
        transform.y = e.clientY - panStart.y;
      }

      // Hover check using canvasPos
      let found = null;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const dx = canvasPos.x - n.x;
        const dy = canvasPos.y - n.y;
        if (dx * dx + dy * dy < (n.radius + 8) * (n.radius + 8)) {
          found = n;
          break;
        }
      }

      hoveredNode = found;
      if (hoveredNode) {
        canvas.style.cursor = 'pointer';
        tooltip.style.display = 'block';
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        tooltip.style.left = `${screenX + 12}px`;
        tooltip.style.top = `${screenY + 12}px`;
        tooltip.setText(`${hoveredNode.type.toUpperCase()}: ${hoveredNode.name}`);
      } else {
        canvas.style.cursor = isPanning ? 'grabbing' : 'default';
        tooltip.style.display = 'none';
      }
    });

    canvas.addEventListener('mouseup', (e) => {
      isPanning = false;
      canvas.style.cursor = hoveredNode ? 'pointer' : 'default';

      if (!hasMovedSinceDown && hoveredNode) {
        this.openEntityDetail(hoveredNode.type, hoveredNode.file);
      }

      draggedNode = null;
    });

    canvas.addEventListener('mouseleave', () => {
      draggedNode = null;
      isPanning = false;
      hoveredNode = null;
      tooltip.style.display = 'none';
      canvas.style.cursor = 'default';
    });

    // Elegant scroll wheel zoom centered at mouse position
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const mouse = getMousePos(e);

      const zoomIntensity = 0.05;
      const factor = Math.exp(-e.deltaY * zoomIntensity * 0.015);
      const newK = Math.max(0.15, Math.min(4, transform.k * factor));

      transform.x = mouse.x - (mouse.x - transform.x) * (newK / transform.k);
      transform.y = mouse.y - (mouse.y - transform.y) * (newK / transform.k);
      transform.k = newK;
    });

    // Physics Engine
    const step = () => {
      if (!canvas.isConnected) {
        resizeObserver.disconnect();
        return;
      }

      // 1. Repulsion force between nodes
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);
          if (dist < 160) {
            const force = (160 - dist) * 0.04;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (n1 !== draggedNode) { n1.vx -= fx; n1.vy -= fy; }
            if (n2 !== draggedNode) { n2.vx += fx; n2.vy += fy; }
          }
        }
      }

      // 2. Attraction force along links
      links.forEach((l) => {
        const dx = l.target.x - l.source.x;
        const dy = l.target.y - l.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const desiredDist = 65;
        const force = (dist - desiredDist) * 0.009;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (l.source !== draggedNode) { l.source.vx += fx; l.source.vy += fy; }
        if (l.target !== draggedNode) { l.target.vx -= fx; l.target.vy -= fy; }
      });

      // 3. Gravity pulling to center & Update position
      const cx = width / 2;
      const cy = height / 2;
      nodes.forEach((n) => {
        if (n === draggedNode) return;

        const dx = cx - n.x;
        const dy = cy - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        let gravity = 0.0003;
        if (dist > 250) {
          gravity = 0.0012; // soft pull back bounds
        }

        n.vx += dx * gravity;
        n.vy += dy * gravity;

        // Apply velocities and damp (glide damping = 0.92 for buttery smooth!)
        n.x += n.vx;
        n.y += n.vy;
        n.vx *= 0.92;
        n.vy *= 0.92;
      });

      // 4. Render
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);

      // Draw links
      ctx.lineWidth = 0.8 / transform.k;
      ctx.strokeStyle = 'var(--graph-line, var(--border-color, rgba(255, 255, 255, 0.08)))';
      links.forEach((l) => {
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.stroke();
      });

      // Draw nodes
      nodes.forEach((n) => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = typeColors[n.type] || typeColors.note;
        ctx.fill();

        // Highlight ring if hovered
        if (n === hoveredNode) {
          ctx.strokeStyle = 'var(--text-normal, #ffffff)';
          ctx.lineWidth = 2 / transform.k;
          ctx.stroke();
        } else {
          ctx.strokeStyle = 'var(--background-secondary)';
          ctx.lineWidth = 1.2 / transform.k;
          ctx.stroke();
        }
      });

      // Draw elegant labels under nodes
      nodes.forEach((n) => {
        ctx.fillStyle = n === hoveredNode ? 'var(--text-normal)' : 'var(--text-muted)';
        ctx.font = n === hoveredNode ? `bold ${9.5 / transform.k}px var(--font-interface, sans-serif)` : `${8.5 / transform.k}px var(--font-interface, sans-serif)`;
        ctx.textAlign = 'center';
        ctx.fillText(n.name, n.x, n.y + n.radius + 12 / transform.k);
      });

      ctx.restore();

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }

  /* ── PRM Analytics ──────────────────────── */
  async renderPRMAnalytics(root) {
    root.addClass('cadence-report');
    const partnerDef = ENTITIES.partner;
    const dealDef = ENTITIES.deal;
    const partners = listEntities(this.app, 'partner');
    const deals = listEntities(this.app, 'deal');
    const dealValue = (e) => Number(entityValue(e, 'value', dealDef)) || 0;
    const sumVal = (arr) => arr.reduce((s, e) => s + dealValue(e), 0);
    const partnerSourced = deals.filter((e) => entityValue(e, 'partner', dealDef));
    const partnerWon = partnerSourced.filter((e) => String(entityValue(e, 'stage', dealDef)) === 'Won');

    this._renderPageHeader(root, 'PRM analytics', 'Partner programme health, tier mix and revenue contribution');

    const grid = root.createDiv({ cls: 'cad-stat-grid' });
    const stat = (label, value, sub, accent) => {
      const c = grid.createDiv({ cls: 'cad-stat-card' });
      if (accent) c.dataset.accent = accent;
      c.createDiv({ cls: 'cad-stat-label', text: label });
      c.createDiv({ cls: 'cad-stat-value', text: String(value) });
      if (sub) c.createDiv({ cls: 'cad-stat-sub', text: sub });
    };
    stat('PARTNERS', partners.length, 'on the books', 'sky');
    stat('SOURCED DEALS', partnerSourced.length, fmtValue(sumVal(partnerSourced), 'currency'), 'mint');
    stat('PARTNER REVENUE', fmtValue(sumVal(partnerWon), 'currency'), `${partnerWon.length} won`, 'emerald');
    const totalSourcedValue = sumVal(partnerSourced);
    const totalDealValue = sumVal(deals);
    const sharePct = totalDealValue === 0 ? 0 : Math.round((totalSourcedValue / totalDealValue) * 100);
    stat('PARTNER SHARE', `${sharePct}%`, 'of total pipeline value', 'warn');

    /* Tier breakdown */
    const tierMap = new Map();
    const tierValueMap = new Map();
    partners.forEach((p) => {
      const t = String(entityValue(p, 'tier', partnerDef) || 'Untiered');
      tierMap.set(t, (tierMap.get(t) || 0) + 1);
      tierValueMap.set(t, tierValueMap.get(t) || 0);
    });
    // Add tier-attributed revenue: deals where partner matches partner-name and partner.tier is known
    const partnerByName = new Map();
    partners.forEach((p) => partnerByName.set(String(entityValue(p, 'name', partnerDef) || p.basename), p));
    partnerWon.forEach((d) => {
      const pname = String(entityValue(d, 'partner', dealDef) || '');
      const partner = partnerByName.get(pname);
      if (!partner) return;
      const tier = String(entityValue(partner, 'tier', partnerDef) || 'Untiered');
      tierValueMap.set(tier, (tierValueMap.get(tier) || 0) + dealValue(d));
    });

    if (tierMap.size) {
      root.createDiv({ cls: 'cad-section-label-lg', text: 'PARTNERS BY TIER' });
      const tierCard = root.createDiv({ cls: 'cad-dash-card' });
      tierCard.style.margin = '0 36px 18px 36px';
      const tierBody = tierCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' });
      const tierAccent = { 'Gold': 'warn', 'Silver': 'sky', 'Bronze': 'rose', 'Standard': 'mint', 'Untiered': 'mint' };
      [...tierMap.entries()].sort((a, b) => b[1] - a[1]).forEach(([tier, count]) => {
        const value = tierValueMap.get(tier) || 0;
        const mini = tierBody.createDiv({ cls: 'cad-mini-stat' });
        mini.dataset.accent = tierAccent[tier] || 'sky';
        mini.createDiv({ cls: 'cad-mini-stat-value', text: String(count) });
        mini.createDiv({ cls: 'cad-mini-stat-label', text: tier.toUpperCase() });
        const sub = mini.createDiv({ cls: 'cad-stat-sub' });
        sub.style.marginTop = '4px';
        sub.setText(value > 0 ? fmtValue(value, 'currency') : '—');
      });
    }

    /* Two-col: top partners by revenue + funnel */
    const cols = root.createDiv({ cls: 'cad-dash-cols' });
    const left = cols.createDiv({ cls: 'cad-dash-col' });
    const right = cols.createDiv({ cls: 'cad-dash-col' });

    // Top partners by won revenue
    const partnerRevenue = new Map();
    partnerWon.forEach((d) => {
      const p = String(entityValue(d, 'partner', dealDef) || '(direct)');
      partnerRevenue.set(p, (partnerRevenue.get(p) || 0) + dealValue(d));
    });
    const topPartnerRows = [...partnerRevenue.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([p, v]) => {
        const partner = partnerByName.get(p);
        const file = partner ? partner.file : null;
        return {
          title: p,
          meta: fmtValue(v, 'currency'),
          file,
        };
      });
    this._dashCardSection(left, 'TOP PARTNERS · by won revenue', topPartnerRows, 'No partner-attributed wins yet.');

    // Funnel: Sourced → Open → Won
    const sourcedOpen = partnerSourced.filter((e) => !['Won', 'Lost'].includes(String(entityValue(e, 'stage', dealDef))));
    const sourcedLost = partnerSourced.filter((e) => String(entityValue(e, 'stage', dealDef)) === 'Lost');
    const conv = partnerSourced.length === 0 ? 0 : Math.round((partnerWon.length / partnerSourced.length) * 100);
    const funnelCard = right.createDiv({ cls: 'cad-dash-card' });
    funnelCard.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: 'PARTNER FUNNEL' });
    const funnelBody = funnelCard.createDiv({ cls: 'cad-dash-card-body cad-mini-stat-row' });
    const mkF = (label, val, sub, accent) => {
      const m = funnelBody.createDiv({ cls: 'cad-mini-stat' });
      m.dataset.accent = accent;
      m.createDiv({ cls: 'cad-mini-stat-value', text: String(val) });
      m.createDiv({ cls: 'cad-mini-stat-label', text: label });
      const s = m.createDiv({ cls: 'cad-stat-sub' });
      s.style.marginTop = '4px';
      s.setText(sub);
    };
    mkF('SOURCED', partnerSourced.length, fmtValue(sumVal(partnerSourced), 'currency'), 'sky');
    mkF('OPEN', sourcedOpen.length, fmtValue(sumVal(sourcedOpen), 'currency'), 'mint');
    mkF('WON', partnerWon.length, fmtValue(sumVal(partnerWon), 'currency'), 'emerald');
    mkF('LOST', sourcedLost.length, fmtValue(sumVal(sourcedLost), 'currency'), 'rose');

    const convCard = right.createDiv({ cls: 'cad-dash-card' });
    convCard.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: `CONVERSION · sourced → won` });
    const convBody = convCard.createDiv({ cls: 'cad-dash-card-body' });
    convBody.style.padding = '20px 16px';
    const convWrap = convBody.createDiv({ cls: 'cad-proj-progress-wrap' });
    convWrap.dataset.pctBand = pctBand(conv);
    const convLabel = convWrap.createDiv({ cls: 'cad-proj-progress-label' });
    convLabel.createSpan({ text: `${partnerWon.length}/${partnerSourced.length} sourced deals won` });
    convLabel.createSpan({ cls: 'cad-proj-progress-pct', text: `${conv}%` });
    const convBar = convWrap.createDiv({ cls: 'cad-proj-progress-bar' });
    const convFill = convBar.createDiv({ cls: 'cad-proj-progress-fill' });
    convFill.style.width = `${conv}%`;

    // ─── Custom Widgets / Charts Section ────────────────
    const analyticsHeader = root.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 24px 32px 8px 32px; margin-bottom: 16px;' } });
    const labelEl = analyticsHeader.createEl('span', { cls: 'cad-section-label-lg',
      text: 'ANALYTICS & CHARTS', attr: { style: 'padding: 0; margin: 0; display: inline-block;' } });

    const addWidgetBtn = analyticsHeader.createEl('button', { cls: 'cad-btn primary', text: '+ Add Custom Chart' });

    const widgetsGrid = root.createDiv({ cls: 'cad-dash-cols', attr: { style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-bottom: 24px; padding: 0 32px;' } });

    const renderWidgets = () => {
      widgetsGrid.empty();

      const widgets = this.plugin.settings.prmDashboardWidgets || [];
      if (widgets.length === 0) {
        const emptyWrap = widgetsGrid.createDiv({ attr: { style: 'grid-column: 1 / -1; text-align: center; padding: 32px; background: var(--background-secondary); border-radius: 8px; border: 1px dashed var(--border-color);' } });
        emptyWrap.createDiv({ text: 'No custom charts added yet. Click "+ Add Custom Chart" to create one!', attr: { style: 'color: var(--text-muted); font-size: 0.95em;' } });
        return;
      }

      widgets.forEach((w) => {
        const card = widgetsGrid.createDiv({ cls: 'cad-dash-card', attr: { style: 'margin: 0; display: flex; flex-direction: column;' } });

        // Card Head
        const head = card.createDiv({ cls: 'cad-dash-card-head', attr: { style: 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;' } });
        const fieldKey = w.groupBy;

        head.createDiv({ cls: 'cad-dash-card-title', text: w.title.toUpperCase(), attr: { style: 'font-weight: 700; font-size: 0.75rem; letter-spacing: 0.12em;' } });

        const actionsWrap = head.createDiv({ attr: { style: 'display: flex; gap: 8px; align-items: center;' } });

        // Chart Style Select
        const styleSelect = actionsWrap.createEl('select', { cls: 'cad-prop-input' });
        styleSelect.style.padding = '2px 4px';
        styleSelect.style.fontSize = '0.8em';
        styleSelect.style.height = 'auto';
        styleSelect.style.width = 'auto';
        styleSelect.style.background = 'var(--background-primary)';
        styleSelect.style.color = 'var(--text-normal)';
        styleSelect.style.border = '1px solid var(--border-color)';
        styleSelect.style.borderRadius = '4px';

        [
          { value: 'donut', label: '🍩 Donut' },
          { value: 'bar', label: '📊 Bar' },
          { value: 'kpi', label: '🗃️ KPI Cards' },
          { value: 'list', label: '📋 List' }
        ].forEach(opt => {
          const o = styleSelect.createEl('option', { value: opt.value, text: opt.label });
          if (w.style === opt.value) o.selected = true;
        });

        styleSelect.addEventListener('change', async () => {
          w.style = styleSelect.value;
          await this.plugin.saveSettings();
          this.render();
        });

        // Delete button
        const delBtn = actionsWrap.createEl('button', { cls: 'cad-btn',
          text: '×', attr: { style: 'color: var(--text-error); padding: 2px 8px; font-weight: bold; border-color: var(--text-error); font-size: 1.1em; height: auto; border-radius: 4px; background: transparent;' } });
        delBtn.addEventListener('click', async () => {
          if (!confirm(`Delete chart "${w.title}"?`)) return;
          this.plugin.settings.prmDashboardWidgets = (this.plugin.settings.prmDashboardWidgets || []).filter(item => item.id !== w.id);
          await this.plugin.saveSettings();
          this.render();
        });

        const body = card.createDiv({ cls: 'cad-dash-card-body', attr: { style: 'flex: 1; min-height: 180px; display: flex; flex-direction: column; justify-content: center; padding: 14px;' } });

        // Calculate chart data for this widget
        const counts = {};
        partners.forEach(p => {
          let val = entityValue(p, fieldKey, partnerDef);
          if (Array.isArray(val)) {
            val.forEach(v => {
              const clean = String(v).replace(/^\[\[|\]\]$/g, '').trim();
              if (clean) counts[clean] = (counts[clean] || 0) + 1;
            });
          } else {
            const clean = String(val || '').replace(/^\[\[|\]\]$/g, '').trim();
            const label = clean || 'Unspecified';
            counts[label] = (counts[label] || 0) + 1;
          }
        });

        const chartData = Object.entries(counts)
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count);

        // Draw chart directly into a fresh div — no innerHTML.
        this._drawChart(body.createDiv(), w.style, chartData);
      });
    };

    addWidgetBtn.addEventListener('click', () => {
      new CadenceWidgetCreateModal(this.app, 'partner', async (newWidget) => {
        if (!this.plugin.settings.prmDashboardWidgets) {
          this.plugin.settings.prmDashboardWidgets = [];
        }
        this.plugin.settings.prmDashboardWidgets.push(newWidget);
        await this.plugin.saveSettings();
        this.render();
      }).open();
    });

    renderWidgets();
  }

  /* ── Team (contacts where role contains "team") ─ */
  async renderTeam(root) {
    return this.renderEntityList(root, 'contact', {
      title: 'Team',
      filter: (e) => {
        const role = String(entityValue(e, 'role', ENTITIES.contact) || '').toLowerCase();
        return role.includes('team') || role.includes('admin') || role.includes('member');
      },
      columns: ['name', 'role', 'email', 'company'],
    });
  }

  /* ── Settings (opens Obsidian settings → Cadence) ─ */
  async openSettingsTab(root) {
    root.addClass('cadence-soon');
    const wrap = root.createDiv({ cls: 'cad-soon-wrap' });
    const ic = wrap.createDiv({ cls: 'cad-soon-icon' });
    try { obsidian.setIcon(ic, 'settings-2'); } catch (_) { }
    wrap.createDiv({ cls: 'cad-eyebrow', text: 'CADENCE' });
    wrap.createDiv({ cls: 'cad-soon-title', text: 'Settings' });
    wrap.createDiv({ cls: 'cad-soon-desc', text: 'Configure folders, headings, week start, default tab, and the (future) Cadence API connection.' });
    const btn = wrap.createEl('button', { cls: 'cad-btn primary', text: 'Open Cadence settings' });
    btn.style.marginTop = '12px';
    btn.addEventListener('click', () => {
      this.app.setting.open();
      this.app.setting.openTabById(this.plugin.manifest.id);
    });
  }

  /* ── Task completion propagation ──
     When a task is ticked or unticked anywhere, mirror the state to:
       - matching reminders by text (and via reminder.project to the linked project)
       - matching task lines in today's daily note + the linked reminder's date note
     Match is by exact (trimmed) task text. Renaming a task breaks the link. */
  async _propagateTaskComplete(text, done, source) {
    const t = String(text || '').trim();
    if (!t) return;
    source = source || {};

    const reminders = (this.plugin.settings.reminders || []).slice();
    const matches = reminders.filter((r) => r.text && r.text.trim() === t);

    /* 1. Sync matching reminders (skip the source reminder) */
    for (const r of matches) {
      if (source.kind === 'reminder' && r.id === source.id) continue;
      if (!!r.done === !!done) continue;
      await this.plugin.updateReminder(r.id, { done: !!done });
    }

    /* 2. For any matching reminder linked to a project, tick that project's task line */
    const projectsTouched = new Set();
    for (const r of matches) {
      if (!r.project) continue;
      if (source.kind === 'project' && source.file && source.file.path === r.project) continue;
      if (projectsTouched.has(r.project)) continue;
      projectsTouched.add(r.project);
      const file = this.app.vault.getAbstractFileByPath(r.project);
      if (!file || !(file instanceof obsidian.TFile)) continue;
      await this._tickProjectTaskByText(file, t, !!done);
    }

    /* 3. Tick matching task line in relevant daily notes (today + each match's date note + source date) */
    const datesToCheck = new Set([ymd(new Date())]);
    matches.forEach((r) => {
      if (r.when) {
        const d = new Date(r.when);
        if (!isNaN(d.getTime())) datesToCheck.add(ymd(d));
      }
      if (r.createdAt) {
        const d = new Date(r.createdAt);
        if (!isNaN(d.getTime())) datesToCheck.add(ymd(d));
      }
    });
    if (source.kind === 'daily' && source.date) datesToCheck.add(ymd(source.date));
    const settings = this.plugin.settings;
    for (const dateStr of datesToCheck) {
      const path = settings.dailyNoteFolder
        ? `${settings.dailyNoteFolder.replace(/\/$/, '')}/${dateStr}.md`
        : `${dateStr}.md`;
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!file || !(file instanceof obsidian.TFile)) continue;
      if (source.kind === 'daily' && source.file && source.file.path === file.path) continue;
      await this._tickDailyNoteTaskByText(file, t, !!done);
    }
  }

  async _tickProjectTaskByText(file, text, done) {
    let content;
    try { content = await this.app.vault.read(file); } catch (_) { return; }
    const sections = parseH2Sections(content);
    const tasks = parseTasksList(sections['Tasks'] || '');
    let changed = false;
    const updated = tasks.map((tk) => {
      if (tk.title.trim() === text && !!tk.done !== !!done) {
        changed = true;
        return Object.assign({}, tk, { done: !!done });
      }
      return tk;
    });
    if (!changed) return;
    const newSection = stringifyTasks(updated);
    const next = replaceSection(content, '## Tasks', newSection);
    await this.app.vault.modify(file, next);
  }

  async _tickDailyNoteTaskByText(file, text, done) {
    let content;
    try { content = await this.app.vault.read(file); } catch (_) { return; }
    const parsed = parseSections(content, this.plugin.settings);
    let changed = false;
    const updatedTasks = parsed.tasks.map((line) => {
      const lineText = line.replace(/^\s*-\s\[(x|X| )\]\s/, '').trim();
      if (lineText !== text) return line;
      const isDone = / \[(x|X)\] /.test(line);
      if (isDone === !!done) return line;
      changed = true;
      return done
        ? line.replace(/^\s*-\s\[\s\]\s/, '- [x] ')
        : line.replace(/^\s*-\s\[(x|X)\]\s/, '- [ ] ');
    });
    if (!changed) return;
    const newSection = updatedTasks.join('\n');
    const next = replaceSection(content, this.plugin.settings.tasksHeading, newSection);
    await this.app.vault.modify(file, next);
  }

  /* ── Cadence-styled prompt modal ─ */
  _prompt(opts) {
    return new Promise((resolve) => {
      new CadencePromptModal(this.app, {
        title: opts.title || 'Enter a name',
        placeholder: opts.placeholder || '',
        defaultValue: opts.defaultValue || '',
        cta: opts.cta || 'Create',
        onSubmit: resolve,
      }).open();
    });
  }

  async _createEntityFromPrompt(entityKey, defaults = {}) {
    const def = ENTITIES[entityKey];
    new CadenceEntityCreateModal(this.app, entityKey, {
      defaults,
      onSubmit: async (result) => {
        if (!result) return;
        try {
          const file = await createEntity(this.app, entityKey, result.name);
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
                  const targetFile = this.app.vault.getMarkdownFiles().find(tf => tf.basename.toLowerCase() === name.toLowerCase());
                  if (!targetFile) {
                    try {
                      await createEntity(this.app, creationSource, name);
                      const label = targetEntityKey ? ENTITIES[targetEntityKey].label : 'Note';
                      new obsidian.Notice(`Created new ${label}: ${name}`);
                    } catch (e) {
                      console.warn(`Failed to auto-create ${creationSource}`, e);
                    }
                  }
                }
              }
            }
          }

          if (Object.keys(extras).length) {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
              Object.entries(extras).forEach(([k, v]) => {
                if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) return;
                fm[k] = v;
              });
            });
          }
          new obsidian.Notice(`Created ${def.label}: ${file.basename}\nSaved to ${file.path}`, 4000);
          await this.openEntityDetail(entityKey, file);
        } catch (e) {
          new obsidian.Notice(`Cadence: failed to create ${def.label} — ${e.message}`);
        }
      },
    }).open();
  }

  /* ── Today pane ─────────────────────────── */
  async renderTodayPane(root) {
    root.addClass('cadence-today');
    this.todayFile = await ensureDailyNote(this.app, this.plugin.settings);
    const fileContent = await this.app.vault.read(this.todayFile);
    this.todayParsed = parseSections(fileContent, this.plugin.settings);

    let tasksList = [];
    if (this.plugin.settings.taskManagementSystem === 'tasknotes') {
      const todayYmd = ymd(new Date());
      const allTaskNotes = listTaskNotesTasks(this.app);
      this.todayTaskNotes = allTaskNotes.filter(t => t.scheduled === todayYmd);
      tasksList = this.todayTaskNotes.map(t => `- [${t.done ? 'x' : ' '}] ${t.title}`);
    } else {
      tasksList = this.todayParsed.tasks;
    }

    const info = dateInfo();
    root.createDiv({ cls: 'cad-eyebrow', text: info.weekday.toUpperCase() });
    const hero = root.createDiv({ cls: 'cad-date-hero' });
    hero.createSpan({ cls: 'cad-day', text: String(info.day) });
    const monthCol = hero.createDiv();
    monthCol.createDiv({ cls: 'cad-month', text: info.month });
    monthCol.createDiv({ cls: 'cad-year', text: String(info.year) });

    const taskCount = tasksList.filter((l) => / \[ \] /.test(l)).length;
    root.createDiv({
      cls: 'cad-greet',
      text: taskCount === 0
        ? `${greeting()}. Nothing on the books — your day is clear.`
        : `${greeting()}. You have ${taskCount} ${taskCount === 1 ? 'thing' : 'things'} to handle.`,
    });

    /* Tasks */
    const taskSection = root.createDiv({ cls: 'cad-section' });
    const taskLabel = taskSection.createDiv({ cls: 'cad-section-label' });
    taskLabel.createSpan({ text: 'TODAY' });
    const total = tasksList.length;
    const open = tasksList.filter((l) => / \[ \] /.test(l)).length;
    taskLabel.createSpan({ cls: 'cad-count', text: `${open} open · ${total - open} done` });

    if (!tasksList.length) {
      taskSection.createDiv({ cls: 'cad-empty', text: 'No tasks in today\'s note yet.' });
    } else {
      const dailyPath = this.todayFile.path;
      tasksList.forEach((rawLine, idx) => {
        const checked = / \[(x|X)\] /.test(rawLine);
        const text = rawLine.replace(/^\s*-\s\[(x|X| )\]\s/, '');
        const row = taskSection.createDiv({ cls: 'cad-task-row' + (checked ? ' done' : '') });
        const cb = row.createEl('input', { type: 'checkbox' });
        cb.checked = checked;
        cb.addEventListener('change', () => this.toggleTodayTask(idx, cb.checked));

        if (this.plugin.settings.taskManagementSystem === 'tasknotes') {
          const taskObj = this.todayTaskNotes[idx];
          const taskSpan = row.createEl('a', { cls: 'cad-task-text', text });
          taskSpan.style.cursor = 'pointer';
          taskSpan.addEventListener('click', (ev) => {
            ev.preventDefault();
            this.app.workspace.openLinkText(taskObj.file.path, '', false);
          });
        } else {
          row.createSpan({ cls: 'cad-task-text', text });
        }

        /* Project link — chip if linked, then a button */
        let linkedProject = null;
        if (this.plugin.settings.taskManagementSystem === 'tasknotes') {
          const taskObj = this.todayTaskNotes[idx];
          if (taskObj.projects) {
            const parsed = parseLinkValues(taskObj.projects);
            if (parsed.length > 0) {
              const projFile = this.app.vault.getMarkdownFiles().find(f => f.basename === parsed[0].target);
              if (projFile) {
                linkedProject = projFile.path;
              }
            }
          }
        } else {
          linkedProject = this._getTaskProjectLink(dailyPath, text);
        }

        if (linkedProject) {
          const chip = row.createEl('a', { cls: 'cad-task-proj-chip', text: '📁 ' + (projectNameFromPath(this.app, linkedProject) || 'Project') });
          chip.title = 'Open linked project';
          chip.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const file = this.app.vault.getAbstractFileByPath(linkedProject);
            if (file && file instanceof obsidian.TFile) this.openEntityDetail('project', file);
          });
        }

        if (this.plugin.settings.taskManagementSystem !== 'tasknotes') {
          const linkBtn = row.createEl('button', { cls: 'cad-task-link-btn' + (linkedProject ? ' linked' : ''), text: linkedProject ? '✎' : '📁' });
          linkBtn.title = linkedProject ? 'Change linked project' : 'Link to a project';
          linkBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            this._openTaskProjectPicker(dailyPath, text, linkedProject);
          });
        }
      });
    }

    const quickWrap = taskSection.createDiv();
    quickWrap.style.marginTop = '8px';
    const quick = quickWrap.createEl('input', {
      type: 'text',
      placeholder: 'Quick add a task — Enter to save',
    });
    quick.style.width = '100%';
    quick.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && quick.value.trim()) {
        const v = quick.value.trim();
        quick.value = '';
        this.appendTodayTask(v);
      }
    });

    /* Journal */
    const journalSection = root.createDiv({ cls: 'cad-section' });
    journalSection.createDiv({ cls: 'cad-section-label' }).setText('TODAY’S ENTRY');
    const ta = journalSection.createEl('textarea', { cls: 'cad-journal' });
    ta.value = this.todayParsed.journal;
    ta.placeholder = 'Write what’s on your mind…';
    ta.rows = Math.max(8, ta.value.split('\n').length + 2);
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
      if (this._journalSaveTimer) clearTimeout(this._journalSaveTimer);
      this._journalSaveTimer = setTimeout(() => this.saveTodayJournal(ta.value), 800);
    });
    setTimeout(() => { ta.style.height = ta.scrollHeight + 'px'; }, 0);

    /* Custom sections from daily note */
    const allSections = parseH2Sections(fileContent);
    const cleanTasksHeading = (this.plugin.settings.tasksHeading || '## Today').replace(/^##\s+/, '').trim().toLowerCase();
    const cleanJournalHeading = (this.plugin.settings.journalHeading || '## Journal').replace(/^##\s+/, '').trim().toLowerCase();

    const otherKeys = Object.keys(allSections).filter((k) => {
      const cleanK = parseHeaderKey(k).cleanLabel.toLowerCase();
      return cleanK !== cleanTasksHeading && cleanK !== cleanJournalHeading;
    });

    if (otherKeys.length > 0) {
      const customWrap = root.createDiv({ cls: 'cad-custom-sections' });
      customWrap.style.marginTop = '24px';
      customWrap.style.display = 'grid';
      customWrap.style.gridTemplateColumns = 'repeat(auto-fit, minmax(320px, 1fr))';
      customWrap.style.gap = '16px';

      const flashSaved = () => {
        new obsidian.Notice('Section saved');
      };

      otherKeys.forEach((rawKey) => {
        this._renderDynamicH2Section(customWrap, this.todayFile, allSections, rawKey, flashSaved);
      });
    }

    /* Footer */
    const footer = root.createDiv();
    footer.style.marginTop = '24px';
    footer.style.fontSize = '12px';
    footer.style.color = 'var(--cad-ink-4)';
    const link = footer.createEl('a', { text: 'Open today\'s daily note →' });
    link.style.color = 'var(--cad-emerald-deep)';
    link.style.cursor = 'pointer';
    link.addEventListener('click', () => {
      this.app.workspace.openLinkText(this.todayFile.path, '', false);
    });
  }

  async toggleTodayTask(idx, checked) {
    if (this.plugin.settings.taskManagementSystem === 'tasknotes') {
      if (this.todayTaskNotes && this.todayTaskNotes[idx]) {
        const taskObj = this.todayTaskNotes[idx];
        await toggleTaskNotesTask(this.app, taskObj.file, checked);
      }
    } else {
      const content = await this.app.vault.read(this.todayFile);
      const parsed = parseSections(content, this.plugin.settings);
      const taskLine = parsed.tasks[idx] || '';
      const taskText = taskLine.replace(/^\s*-\s\[(x|X| )\]\s/, '').trim();
      const newTasks = parsed.tasks.map((line, i) => {
        if (i !== idx) return line;
        return checked
          ? line.replace(/^\s*-\s\[\s\]\s/, '- [x] ')
          : line.replace(/^\s*-\s\[(x|X)\]\s/, '- [ ] ');
      });
      const newContent = replaceSection(content, this.plugin.settings.tasksHeading, newTasks.join('\n'));
      await this.app.vault.modify(this.todayFile, newContent);
      if (taskText) {
        await this._propagateTaskComplete(taskText, checked, { kind: 'daily', file: this.todayFile, date: new Date() });
      }
    }
    this.render();
  }

  async appendTodayTask(text) {
    if (this.plugin.settings.taskManagementSystem === 'tasknotes') {
      await appendTaskNotesTask(this.app, text, new Date());
    } else {
      const content = await this.app.vault.read(this.todayFile);
      const parsed = parseSections(content, this.plugin.settings);
      const newTasks = [...parsed.tasks, `- [ ] ${text}`];
      const newContent = replaceSection(content, this.plugin.settings.tasksHeading, newTasks.join('\n'));
      await this.app.vault.modify(this.todayFile, newContent);
    }
    this.render();
  }

  async saveTodayJournal(body) {
    const content = await this.app.vault.read(this.todayFile);
    const newContent = replaceSection(content, this.plugin.settings.journalHeading, body || '');
    await this.app.vault.modify(this.todayFile, newContent);
  }

  /* ── Planner pane ───────────────────────── */
  async renderPlannerPane(root) {
    root.addClass('cadence-planner');
    const settings = this.plugin.settings;
    const days = weekDates(this.plannerAnchor, settings.weekStartsOn);
    const today = startOfDay(new Date());

    const header = root.createDiv({ cls: 'cad-pl-header' });
    const titleWrap = header.createDiv({ cls: 'cad-pl-title-wrap' });
    titleWrap.createDiv({ cls: 'cad-eyebrow', text: 'WEEK OF' });
    const startStr = days[0].toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    const endStr = days[6].toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    titleWrap.createDiv({ cls: 'cad-pl-title', text: `${startStr} – ${endStr}` });

    const nav = header.createDiv({ cls: 'cad-pl-nav' });
    const mkBtn = (label, fn, cls = '') => {
      const b = nav.createEl('button', { text: label, cls: 'cad-pl-btn ' + cls });
      b.addEventListener('click', fn);
    };
    mkBtn('◀', () => { this.plannerAnchor = addDays(this.plannerAnchor, -7); this.render(); });
    mkBtn('Today', () => { this.plannerAnchor = startOfDay(new Date()); this.render(); }, 'primary');
    mkBtn('▶', () => { this.plannerAnchor = addDays(this.plannerAnchor, 7); this.render(); });

    let totalOpen = 0, totalDone = 0;
    let dayData = [];

    if (settings.taskManagementSystem === 'tasknotes') {
      const allTasks = listTaskNotesTasks(this.app);
      dayData = days.map((d) => {
        const ymdStr = ymd(d);
        const path = dailyNotePath(settings, d);
        const file = this.app.vault.getAbstractFileByPath(path);
        const tasksForDay = allTasks.filter(t => t.scheduled === ymdStr);
        return {
          date: d,
          path,
          exists: !!file,
          file,
          tasks: tasksForDay.map(t => `- [${t.done ? 'x' : ' '}] ${t.title}`),
          rawTasks: tasksForDay
        };
      });
    } else {
      dayData = await Promise.all(days.map(async (d) => {
        const path = dailyNotePath(settings, d);
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!file || !(file instanceof obsidian.TFile)) {
          return { date: d, path, exists: false, tasks: [] };
        }
        const content = await this.app.vault.read(file);
        const parsed = parseSections(content, settings);
        return { date: d, path, exists: true, file, tasks: parsed.tasks };
      }));
    }

    dayData.forEach((d) => {
      d.tasks.forEach((l) => {
        if (/ \[(x|X)\] /.test(l)) totalDone++;
        else if (/ \[ \] /.test(l)) totalOpen++;
      });
    });

    const stats = root.createDiv({ cls: 'cad-pl-stats' });
    const mkStat = (label, value) => {
      const c = stats.createDiv({ cls: 'cad-pl-stat' });
      c.createDiv({ cls: 'cad-pl-stat-label', text: label });
      c.createDiv({ cls: 'cad-pl-stat-value', text: String(value) });
    };
    mkStat('OPEN', totalOpen);
    mkStat('DONE', totalDone);
    mkStat('TOTAL', totalOpen + totalDone);

    const grid = root.createDiv({ cls: 'cad-pl-grid' });
    dayData.forEach((d) => {
      const isToday = sameDay(d.date, today);
      const col = grid.createDiv({ cls: 'cad-pl-day' + (isToday ? ' today' : '') });

      const colHead = col.createDiv({ cls: 'cad-pl-day-head' });
      colHead.createDiv({
        cls: 'cad-pl-weekday',
        text: d.date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
      });
      colHead.createDiv({ cls: 'cad-pl-daynum', text: String(d.date.getDate()) });
      const open = d.tasks.filter((l) => / \[ \] /.test(l)).length;
      const done = d.tasks.filter((l) => / \[(x|X)\] /.test(l)).length;
      colHead.createDiv({
        cls: 'cad-pl-meta',
        text: d.exists ? `${open} open · ${done} done` : 'no note',
      });
      colHead.addEventListener('click', async () => {
        if (!d.exists) {
          await ensureDailyNote(this.app, settings, d.date);
        }
        this.app.workspace.openLinkText(d.path, '', false);
      });

      const list = col.createDiv({ cls: 'cad-pl-tasks' });
      if (!d.tasks.length) {
        list.createDiv({ cls: 'cad-empty', text: d.exists ? '—' : '' });
      } else {
        d.tasks.forEach((rawLine, idx) => {
          const checked = / \[(x|X)\] /.test(rawLine);
          const text = rawLine.replace(/^\s*-\s\[(x|X| )\]\s/, '');
          const row = list.createDiv({ cls: 'cad-pl-task' + (checked ? ' done' : '') });
          const cb = row.createEl('input', { type: 'checkbox' });
          cb.checked = checked;
          cb.addEventListener('change', () => this.togglePlannerTask(d, idx, cb.checked));

          if (settings.taskManagementSystem === 'tasknotes') {
            const taskObj = d.rawTasks[idx];
            const taskSpan = row.createEl('a', { text });
            taskSpan.style.cursor = 'pointer';
            taskSpan.addEventListener('click', (ev) => {
              ev.preventDefault();
              this.app.workspace.openLinkText(taskObj.file.path, '', false);
            });
          } else {
            row.createSpan({ text });
          }
        });
      }
    });
  }

  async togglePlannerTask(day, idx, checked) {
    if (this.plugin.settings.taskManagementSystem === 'tasknotes') {
      if (day.rawTasks && day.rawTasks[idx]) {
        const taskObj = day.rawTasks[idx];
        await toggleTaskNotesTask(this.app, taskObj.file, checked);
      }
    } else {
      if (!day.file) return;
      const content = await this.app.vault.read(day.file);
      const parsed = parseSections(content, this.plugin.settings);
      const taskLine = parsed.tasks[idx] || '';
      const taskText = taskLine.replace(/^\s*-\s\[(x|X| )\]\s/, '').trim();
      const newTasks = parsed.tasks.map((line, i) => {
        if (i !== idx) return line;
        return checked
          ? line.replace(/^\s*-\s\[\s\]\s/, '- [x] ')
          : line.replace(/^\s*-\s\[(x|X)\]\s/, '- [ ] ');
      });
      const newContent = replaceSection(content, this.plugin.settings.tasksHeading, newTasks.join('\n'));
      await this.app.vault.modify(day.file, newContent);
      if (taskText) {
        await this._propagateTaskComplete(taskText, checked, { kind: 'daily', file: day.file, date: day.date });
      }
    }
    this.render();
  }

  async onClose() { /* nothing */ }
}

/* ─────────── Settings tab ─────────── */
class CadenceSettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Cadence' });

    /* ─── Modules ─── */
    containerEl.createEl('h3', { text: 'Modules' });
    containerEl.createEl('p', {
      text: 'Toggle entire sections of the app. Disabled modules disappear from the left nav and from Reports that depend on them.',
      cls: 'setting-item-description',
    });
    const ensureMods = () => {
      if (!this.plugin.settings.modules) {
        this.plugin.settings.modules = { crm: true, prm: true, planner: true, projects: true };
      }
      if (this.plugin.settings.modules.projects === undefined) {
        this.plugin.settings.modules.projects = true;
      }
      return this.plugin.settings.modules;
    };
    [
      { key: 'planner', label: 'Planner', desc: 'Inbox, Today, Calendar.' },
      { key: 'projects', label: 'Projects', desc: 'Projects with milestones, tasks, and status tracking.' },
      { key: 'crm', label: 'CRM', desc: 'Dashboard, Pipeline, Contacts, Companies, Activities + CRM-driven Reports.' },
      { key: 'prm', label: 'PRM', desc: 'Partners, Registrations, Commissions, Leads, Certifications, Analytics + Partner reports.' },
    ].forEach((m) => {
      new obsidian.Setting(containerEl)
        .setName(m.label)
        .setDesc(m.desc)
        .addToggle((t) => t
          .setValue(ensureMods()[m.key] !== false)
          .onChange(async (v) => {
            ensureMods()[m.key] = v;
            await this.plugin.saveSettings();
            this.plugin.refreshOpenViews();
          }));
    });

    /* ─── Reminders ─── */
    containerEl.createEl('h3', { text: 'Reminders' });
    new obsidian.Setting(containerEl)
      .setName('Desktop notifications')
      .setDesc('In addition to the in-app banner, fire a system notification when a reminder is due. Requires browser permission.')
      .addToggle((t) => t
        .setValue(!!this.plugin.settings.desktopNotifications)
        .onChange(async (v) => {
          this.plugin.settings.desktopNotifications = v;
          await this.plugin.saveSettings();
          if (v && typeof Notification !== 'undefined' && Notification.permission === 'default') {
            try { await Notification.requestPermission(); } catch (_) { }
          }
        }));

    new obsidian.Setting(containerEl)
      .setName('Notification permission')
      .setDesc(typeof Notification === 'undefined'
        ? 'Notifications API not available in this environment.'
        : `Current status: ${Notification.permission}`)
      .addButton((b) => b.setButtonText('Request permission').onClick(async () => {
        if (typeof Notification === 'undefined') return;
        try { await Notification.requestPermission(); this.display(); } catch (_) { }
      }));

    new obsidian.Setting(containerEl)
      .setName('Clear completed reminders')
      .setDesc(`${(this.plugin.settings.reminders || []).filter((r) => r.done).length} completed reminders stored.`)
      .addButton((b) => b.setButtonText('Clear').onClick(async () => {
        this.plugin.settings.reminders = (this.plugin.settings.reminders || []).filter((r) => !r.done);
        await this.plugin.saveSettings();
        this.plugin.refreshOpenViews();
        this.display();
      }));

    /* ─── App ─── */
    containerEl.createEl('h3', { text: 'App' });

    new obsidian.Setting(containerEl)
      .setName('Task management system')
      .setDesc('Choose between the native Cadence manager (using daily notes) or the external TaskNotes plugin.')
      .addDropdown((d) => d
        .addOption('native', 'Native (Cadence)')
        .addOption('tasknotes', 'TaskNotes')
        .setValue(this.plugin.settings.taskManagementSystem || 'native')
        .onChange(async (v) => {
          this.plugin.settings.taskManagementSystem = v;
          await this.plugin.saveSettings();
          this.display();
          this.plugin.refreshOpenViews();
        }));

    if (this.plugin.settings.taskManagementSystem === 'tasknotes') {
      const isTaskNotesActive = this.app.plugins.enabledPlugins.has("tasknotes");
      const statusSetting = new obsidian.Setting(containerEl);
      if (isTaskNotesActive) {
        statusSetting
          .setName('TaskNotes Status')
          .setDesc('TaskNotes is currently installed, activated and successfully connected to Cadence.');
        const statusSpan = statusSetting.controlEl.createSpan({
          text: '🟢 Active and Connected'
        });
        statusSpan.style.color = '#27ae60';
        statusSpan.style.fontWeight = 'bold';
      } else {
        statusSetting
          .setName('TaskNotes not detected')
          .setDesc("The TaskNotes plugin is not enabled or installed in your Obsidian vault.");
        const statusSpan = statusSetting.controlEl.createSpan({
          text: '🔴 Inactive / Not installed'
        });
        statusSpan.style.color = '#c0392b';
        statusSpan.style.fontWeight = 'bold';

        new obsidian.Setting(containerEl)
          .setName('Download TaskNotes')
          .setDesc("Click the button below to open the TaskNotes plugin GitHub page to install it on your Obsidian.")
          .addButton((btn) => btn
            .setButtonText('Download TaskNotes')
            .onClick(() => {
              window.open('https://github.com/callumalpass/obsidian-tasknotes', '_blank');
            }));
      }
    }

    new obsidian.Setting(containerEl)
      .setName('Daily note folder')
      .setDesc('Folder under which daily notes live, e.g. "daily" or "Journal/Daily".')
      .addText((t) => t
        .setPlaceholder('daily')
        .setValue(this.plugin.settings.dailyNoteFolder)
        .onChange(async (v) => { this.plugin.settings.dailyNoteFolder = v; await this.plugin.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName('Tasks heading')
      .setDesc('The H2 inside each daily note where tasks live. Default "## Today".')
      .addText((t) => t
        .setValue(this.plugin.settings.tasksHeading)
        .onChange(async (v) => { this.plugin.settings.tasksHeading = v; await this.plugin.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName('Journal heading')
      .setDesc('The H2 where today\'s journal entry lives. Default "## Journal".')
      .addText((t) => t
        .setValue(this.plugin.settings.journalHeading)
        .onChange(async (v) => { this.plugin.settings.journalHeading = v; await this.plugin.saveSettings(); }));

    new obsidian.Setting(containerEl)
      .setName('Currency')
      .setDesc('Used to format money values across Pipeline, Reports and Commissions.')
      .addDropdown((d) => {
        CURRENCY_OPTIONS.forEach((c) => d.addOption(c.code, c.label));
        d.setValue(this.plugin.settings.currency || 'USD');
        d.onChange(async (v) => {
          this.plugin.settings.currency = v;
          await this.plugin.saveSettings();
          // Re-render any open Cadence tabs so values reformat immediately
          this.app.workspace.getLeavesOfType(VIEW_TYPE_CADENCE_APP).forEach((leaf) => {
            if (leaf.view && typeof leaf.view.render === 'function') leaf.view.render();
          });
        });
      });

    new obsidian.Setting(containerEl)
      .setName('Week starts on')
      .setDesc('First day of the week shown in the Planner tab.')
      .addDropdown((d) => d
        .addOption('1', 'Monday')
        .addOption('0', 'Sunday')
        .setValue(String(this.plugin.settings.weekStartsOn))
        .onChange(async (v) => {
          this.plugin.settings.weekStartsOn = Number(v) === 0 ? 0 : 1;
          await this.plugin.saveSettings();
        }));

    new obsidian.Setting(containerEl)
      .setName('Open Cadence on Obsidian startup')
      .setDesc('Auto-open the Cadence Home command centre when Obsidian launches.')
      .addToggle((t) => t
        .setValue(!!this.plugin.settings.openOnStartup)
        .onChange(async (v) => { this.plugin.settings.openOnStartup = v; await this.plugin.saveSettings(); }));

    const defaultDrop = new obsidian.Setting(containerEl)
      .setName('Default tab')
      .setDesc('Which surface opens first when you launch the Cadence app.');
    defaultDrop.addDropdown((d) => {
      NAV_GROUPS.forEach((g) => {
        g.items.forEach((s) => {
          const prefix = g.label ? `${g.label} · ` : '';
          d.addOption(s.id, prefix + s.label);
        });
      });
      d.setValue(this.plugin.settings.defaultTab || 'planner.today');
      d.onChange(async (v) => { this.plugin.settings.defaultTab = v; await this.plugin.saveSettings(); });
    });

    containerEl.createEl('h3', { text: 'Cloud sync — coming soon' });
    const cloudDesc = containerEl.createEl('p', { cls: 'setting-item-description' });
    cloudDesc.appendText('Future option to two-way sync your vault with a live Cadence instance, so contacts, deals and partners stay aligned across desktop and mobile. ');
    cloudDesc.createEl('strong', { text: 'Not active yet.' });
    cloudDesc.appendText(' These fields are persisted but unused until the sync feature ships in a later release.');
    new obsidian.Setting(containerEl)
      .setName('Cadence base URL')
      .setDesc('Coming soon')
      .addText((t) => {
        t.setPlaceholder('https://your-cadence-instance')
          .setValue(this.plugin.settings.cadenceApiUrl)
          .onChange(async (v) => { this.plugin.settings.cadenceApiUrl = v; await this.plugin.saveSettings(); });
        t.inputEl.disabled = true;
      });
    new obsidian.Setting(containerEl)
      .setName('API token')
      .setDesc('Coming soon')
      .addText((t) => {
        t.setPlaceholder('paste JWT here when sync ships')
          .setValue(this.plugin.settings.cadenceApiToken)
          .onChange(async (v) => { this.plugin.settings.cadenceApiToken = v; await this.plugin.saveSettings(); });
        t.inputEl.disabled = true;
      });

    /* ─── Custom Navigation Pages ─── */
    containerEl.createEl('h3', { text: 'Custom Navigation Pages' });
    containerEl.createEl('p', {
      text: 'Add custom pages to specific sections of your navigation sidebar. You can choose which entity they display and their default layout mode (Table, Kanban, or Card Grid).',
      cls: 'setting-item-description',
    });

    const customPagesDiv = containerEl.createDiv({ cls: 'cad-custom-pages-container' });

    const renderCustomPagesList = () => {
      customPagesDiv.empty();
      const customPages = (this.plugin.settings.customPages || []).slice().sort((a, b) => a.label.localeCompare(b.label));

      if (customPages.length === 0) {
        customPagesDiv.createEl('p', { text: 'No custom pages added yet.', cls: 'setting-item-description' });
      } else {
        const table = customPagesDiv.createEl('table', { cls: 'cad-prop-table' });
        table.style.width = '100%';
        table.style.marginBottom = '16px';
        const thead = table.createEl('thead');
        const hr = thead.createEl('tr');
        hr.createEl('th', { text: 'Label' });
        hr.createEl('th', { text: 'Section' });
        hr.createEl('th', { text: 'Entity Type' });
        hr.createEl('th', { text: 'Default Layout' });
        hr.createEl('th', { text: 'Actions' });

        const tbody = table.createEl('tbody');
        customPages.forEach((p) => {
          const tr = tbody.createEl('tr');
          tr.createEl('td', { text: p.label });

          const sectionLabel = {
            'planner': 'Planner',
            'projects': 'Projects',
            'crm': 'CRM',
            'prm': 'PRM',
            'workflow': 'Workflow',
            'reports': 'Reports'
          }[p.sectionId] || p.sectionId;
          tr.createEl('td', { text: sectionLabel });

          const entityLabel = ENTITIES[p.entityKey] ? ENTITIES[p.entityKey].label : p.entityKey;
          tr.createEl('td', { text: entityLabel });

          const layoutLabel = {
            'table': 'Table View ☰',
            'kanban': 'Kanban Board 🗂',
            'cards': 'Card Grid ⚃'
          }[p.defaultLayout || 'table'];
          tr.createEl('td', { text: layoutLabel });

          const actionsTd = tr.createEl('td');
          const delBtn = actionsTd.createEl('button', { cls: 'cad-btn', text: 'Delete' });
          delBtn.style.color = 'var(--text-error)';
          delBtn.style.padding = '2px 8px';
          delBtn.style.height = 'auto';
          delBtn.addEventListener('click', async () => {
            const originalIndex = this.plugin.settings.customPages.findIndex(page => page.id === p.id);
            if (originalIndex >= 0) {
              const deletedPage = this.plugin.settings.customPages[originalIndex];
              const entityKey = deletedPage.entityKey;

              // 1. Remove page from customPages settings
              this.plugin.settings.customPages.splice(originalIndex, 1);

              // 2. Remove entity schema from customEntities settings
              if (this.plugin.settings.customEntities && this.plugin.settings.customEntities[entityKey]) {
                delete this.plugin.settings.customEntities[entityKey];
              }

              // 3. Delete from in-memory ENTITIES registry
              if (ENTITIES[entityKey]) {
                delete ENTITIES[entityKey];
              }

              await this.plugin.saveSettings();
              this.plugin.refreshOpenViews();
              this.display();
            }
          });
        });
      }

      // Render Add Page Form
      const addForm = customPagesDiv.createDiv({ cls: 'cad-custom-page-add-form' });
      addForm.style.border = '1px dashed var(--border-color)';
      addForm.style.borderRadius = '8px';
      addForm.style.padding = '12px';
      addForm.style.marginTop = '16px';
      addForm.style.background = 'var(--background-primary-alt)';

      addForm.createEl('h4', { text: '+ Add Custom Navigation Page', attr: { style: 'margin-top: 0;' } });

      const formRow = addForm.createDiv();
      formRow.style.display = 'flex';
      formRow.style.flexWrap = 'wrap';
      formRow.style.gap = '12px';
      formRow.style.alignItems = 'flex-end';

      // 1. Label Input
      const labelWrap = formRow.createDiv();
      labelWrap.style.flex = '1';
      labelWrap.style.minWidth = '150px';
      labelWrap.createEl('label', { text: 'Label:', attr: { style: 'display: block; font-size: 0.85em; margin-bottom: 4px; font-weight: 500;' } });
      const labelInput = labelWrap.createEl('input', { type: 'text', placeholder: 'e.g. VIP Contacts' });
      labelInput.style.width = '100%';
      labelInput.style.padding = '4px 8px';

      // 2. Section Selector
      const sectionWrap = formRow.createDiv();
      sectionWrap.style.minWidth = '120px';
      sectionWrap.createEl('label', { text: 'Sidebar Section:', attr: { style: 'display: block; font-size: 0.85em; margin-bottom: 4px; font-weight: 500;' } });
      const sectionSelect = sectionWrap.createEl('select');
      sectionSelect.style.width = '100%';
      sectionSelect.createEl('option', { value: 'planner', text: 'Planner' });
      sectionSelect.createEl('option', { value: 'projects', text: 'Projects' });
      sectionSelect.createEl('option', { value: 'crm', text: 'CRM' });
      sectionSelect.createEl('option', { value: 'prm', text: 'PRM' });
      sectionSelect.createEl('option', { value: 'workflow', text: 'Workflow' });
      sectionSelect.createEl('option', { value: 'reports', text: 'Reports' });

      // 3. Default Layout Selector
      const layoutWrap = formRow.createDiv();
      layoutWrap.style.minWidth = '120px';
      layoutWrap.createEl('label', { text: 'Default Layout:', attr: { style: 'display: block; font-size: 0.85em; margin-bottom: 4px; font-weight: 500;' } });
      const layoutSelect = layoutWrap.createEl('select');
      layoutSelect.style.width = '100%';
      layoutSelect.createEl('option', { value: 'table', text: 'Table view ☰' });
      layoutSelect.createEl('option', { value: 'kanban', text: 'Kanban board 🗂' });
      layoutSelect.createEl('option', { value: 'cards', text: 'Card grid ⚃' });

      // 3.5 Icon Selector
      const iconWrap = formRow.createDiv();
      iconWrap.style.minWidth = '120px';
      iconWrap.createEl('label', { text: 'Icon:', attr: { style: 'display: block; font-size: 0.85em; margin-bottom: 4px; font-weight: 500;' } });
      const iconSelect = iconWrap.createEl('select');
      iconSelect.style.width = '100%';

      const iconOptions = [
        { value: 'file-text', label: '📄 Document (Default)' },
        { value: 'folder-kanban', label: '📁 Folder / Projects' },
        { value: 'users', label: '👥 Users / Contacts' },
        { value: 'building-2', label: '🏢 Building / Companies' },
        { value: 'trending-up', label: '📈 Trending / Sales' },
        { value: 'handshake', label: '🤝 Handshake / Partners' },
        { value: 'target', label: '🎯 Target / Leads' },
        { value: 'zap', label: '⚡ Lightning / Sequences' },
        { value: 'wallet', label: '💼 Wallet / Commissions' },
        { value: 'clipboard-check', label: '📋 Clipboard / Registrations' },
        { value: 'award', label: '🏆 Award / Certifications' },
        { value: 'calendar', label: '📅 Calendar / Activities' },
        { value: 'star', label: '⭐ Star / VIP' },
        { value: 'tag', label: '🏷️ Tag / Categories' },
        { value: 'compass', label: '🧭 Compass / Areas' },
        { value: 'database', label: '🗄️ Database / Items' },
        { value: 'check-square', label: '☑️ Checkbox / Tasks' }
      ];
      iconOptions.forEach(opt => {
        iconSelect.createEl('option', { value: opt.value, text: opt.label });
      });

      // 4. Add Button
      const btnWrap = formRow.createDiv();
      const addBtn = btnWrap.createEl('button', { cls: 'cad-btn primary', text: 'Add Page' });
      addBtn.style.padding = '6px 12px';
      addBtn.style.height = 'auto';

      addBtn.addEventListener('click', async () => {
        const val = (labelInput.value || '').trim();
        if (!val) {
          new obsidian.Notice('Please enter a page label.');
          return;
        }

        // Convert Label (e.g. "Products" or "CPI") to a singular lowercase slug key (e.g. "product" or "cpi")
        let singular = val;
        if (singular.endsWith('s') && singular.length > 1) {
          singular = singular.substring(0, singular.length - 1);
        } else if (singular.endsWith('S') && singular.length > 1) {
          singular = singular.substring(0, singular.length - 1);
        }
        const entityKey = sectionSelect.value + '_' + singular.toLowerCase().replace(/\s+/g, '_');

        // Check if the entity key doesn't exist, and create its schema
        if (!this.plugin.settings.customEntities) {
          this.plugin.settings.customEntities = {};
        }

        let newFields;
        if (this.plugin.settings.customEntities[entityKey]) {
          newFields = this.plugin.settings.customEntities[entityKey];
        } else {
          newFields = [
            { key: 'name', label: 'Name', primary: true, type: 'text' },
            { key: 'type', label: 'Type', type: 'text' }
          ];
          this.plugin.settings.customEntities[entityKey] = newFields;
        }

        const capitalize = (s) => (s === s.toUpperCase()) ? s : (s.charAt(0).toUpperCase() + s.slice(1));

        // Re-register inside ENTITIES
        ENTITIES[entityKey] = {
          folder: `Cadence/${val}`,
          label: capitalize(singular),
          plural: val,
          fields: newFields,
          columns: ['name']
        };

        const newPage = {
          id: `custom.${Date.now()}`,
          label: val,
          icon: iconSelect.value || 'file-text',
          entityKey: entityKey,
          defaultLayout: layoutSelect.value,
          sectionId: sectionSelect.value
        };

        const pages = this.plugin.settings.customPages || [];
        pages.push(newPage);
        this.plugin.settings.customPages = pages;

        // Also save their layout preference under pageLayouts
        if (!this.plugin.settings.pageLayouts) this.plugin.settings.pageLayouts = {};
        this.plugin.settings.pageLayouts[newPage.id] = newPage.defaultLayout;

        await this.plugin.saveSettings();
        this.plugin.refreshOpenViews();
        new obsidian.Notice(`Page "${val}" added successfully.`);
        this.display();
      });
    };

    renderCustomPagesList();

    /* ─── Custom Entity Properties ─── */
    containerEl.createEl('h3', { text: 'Custom Entity Properties' });
    containerEl.createEl('p', {
      text: 'Customize the properties for each core entity (Projects, Pipelines/Deals, Contacts, Companies, and Activities). Critical system properties required for the calendar, Kanban, and dashboard features are locked against deletion or type changes, but their display labels can still be customized.',
      cls: 'setting-item-description',
    });

    let selectedEntityKey = 'project';
    const entitySetting = new obsidian.Setting(containerEl)
      .setName('Select entity')
      .setDesc('Choose which entity to customize.')
      .addDropdown((d) => {
        const getDropdownLabel = (key, ent) => {
          const coreEntitySections = {
            project: 'Projects',
            deal: 'CRM',
            contact: 'CRM',
            company: 'CRM',
            activity: 'CRM',
            partner: 'PRM',
            registration: 'PRM',
            commission: 'PRM',
            lead: 'PRM',
            certification: 'PRM',
            sequence: 'Workflow'
          };

          let sectionLabel = coreEntitySections[key];
          if (!sectionLabel) {
            const customPage = (this.plugin.settings.customPages || []).find(p => p.entityKey === key);
            if (customPage) {
              const sectionId = customPage.sectionId;
              sectionLabel = {
                'planner': 'Planner',
                'projects': 'Projects',
                'crm': 'CRM',
                'prm': 'PRM',
                'workflow': 'Workflow',
                'reports': 'Reports'
              }[sectionId] || sectionId;
            }
          }
          if (!sectionLabel) return ent.label;
          const capSection = sectionLabel.charAt(0).toUpperCase() + sectionLabel.slice(1);
          return `${capSection}/${ent.label}`;
        };

        Object.entries(ENTITIES)
          .map(([key, ent]) => ({ key, ent, dropLabel: getDropdownLabel(key, ent) }))
          .sort((a, b) => a.dropLabel.localeCompare(b.dropLabel))
          .forEach(({ key, dropLabel }) => {
            d.addOption(key, dropLabel);
          });
        d.setValue(selectedEntityKey);
        d.onChange((v) => {
          selectedEntityKey = v;
          renderPropEditor();
        });
      });

    const propEditorDiv = containerEl.createDiv({ cls: 'cad-prop-editor-container' });

    const renderPropEditor = () => {
      propEditorDiv.empty();
      const def = ENTITIES[selectedEntityKey];
      if (!def) return;

      propEditorDiv.createEl('h4', { text: `Properties for: ${def.label}` });

      const table = propEditorDiv.createEl('table', { cls: 'cad-prop-table' });
      const thead = table.createEl('thead');
      const headerRow = thead.createEl('tr');
      headerRow.createEl('th', { text: '', cls: 'cad-prop-drag-header' });
      headerRow.createEl('th', { text: 'Label (Display name)' });
      headerRow.createEl('th', { text: 'Technical Key (Frontmatter)' });
      headerRow.createEl('th', { text: 'Type' });
      headerRow.createEl('th', { text: 'Options / Source' });
      headerRow.createEl('th', { text: '' });

      const tbody = table.createEl('tbody');

      const isPermanentlyLocked = (field) => {
        if (field.primary) return true;
        const isCore = ['contact', 'company', 'partner', 'registration', 'commission', 'lead', 'certification', 'activity', 'sequence', 'project', 'deal'].includes(selectedEntityKey);
        if (isCore) {
          const k = field.key;
          if (selectedEntityKey === 'project' && (k === 'status' || k === 'priority')) return true;
          if (selectedEntityKey === 'deal' && k === 'stage') return true;
        }
        return false;
      };

      const isLocked = (field) => {
        if (isPermanentlyLocked(field)) return true;

        // Default type field to locked (but toggleable) for BOTH core and custom entities
        if (field.locked === undefined) {
          if (field.key === 'type') {
            field.locked = true;
          } else {
            const isCore = ['contact', 'company', 'partner', 'registration', 'commission', 'lead', 'certification', 'activity', 'sequence', 'project', 'deal'].includes(selectedEntityKey);
            if (isCore) {
              field.locked = true;
            } else {
              field.locked = false;
            }
          }
        }
        return !!field.locked;
      };

      const saveAndSync = async () => {
        if (!this.plugin.settings.customEntities) {
          this.plugin.settings.customEntities = {};
        }
        for (const [ek, ent] of Object.entries(ENTITIES)) {
          this.plugin.settings.customEntities[ek] = JSON.parse(JSON.stringify(ent.fields));
        }
        await this.plugin.saveSettings();
        this.plugin.registerCustomPropertyTypes();
        this.plugin.refreshOpenViews();
      };

      const syncSharedProperties = (sourceField) => {
        const key = sourceField.key;
        if (key === 'type') return; // Do NOT sync 'type' properties across entities!
        for (const [ek, ent] of Object.entries(ENTITIES)) {
          ent.fields.forEach(f => {
            if (f.key === key && f !== sourceField) {
              f.label = sourceField.label;
              f.type = sourceField.type;
              if (sourceField.options) {
                f.options = JSON.parse(JSON.stringify(sourceField.options));
              } else {
                delete f.options;
              }
              if (sourceField.suggestionSource) {
                f.suggestionSource = sourceField.suggestionSource;
              } else {
                delete f.suggestionSource;
              }
            }
          });
        }
      };

      let draggedIndex = null;

      def.fields.forEach((field, index) => {
        const tr = tbody.createEl('tr');
        tr.addClass('cad-prop-row');
        const permLocked = isPermanentlyLocked(field);
        const locked = isLocked(field);

        // Prepend drag cell / lock cell
        const tdDrag = tr.createEl('td', { cls: 'cad-prop-drag-cell' });

        if (permLocked) {
          tdDrag.createEl('span', { text: '🔒', cls: 'cad-prop-lock-icon' });
          tr.addClass('cad-prop-row-locked');
        } else if (locked) {
          const lockSpan = tdDrag.createEl('span', { text: '🔐', cls: 'cad-prop-lock-icon' });
          lockSpan.style.cursor = 'pointer';
          lockSpan.title = 'Click to unlock this property';
          lockSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            field.locked = false;
            await saveAndSync();
            renderPropEditor();
          });
          tr.addClass('cad-prop-row-locked');
        } else {
          tdDrag.createEl('span', { text: '⋮⋮', cls: 'cad-prop-drag-handle' });
          const unlockSpan = tdDrag.createEl('span', { text: '🔓', cls: 'cad-prop-unlock-icon' });
          unlockSpan.style.cursor = 'pointer';
          unlockSpan.style.marginLeft = '6px';
          unlockSpan.title = 'Click to lock this property';
          unlockSpan.addEventListener('click', async (e) => {
            e.stopPropagation();
            field.locked = true;
            await saveAndSync();
            renderPropEditor();
          });
          tr.setAttribute('draggable', 'true');
          tr.addClass('cad-prop-row-draggable');

          tr.addEventListener('dragstart', (e) => {
            draggedIndex = index;
            tr.addClass('cad-drag-active');
            e.dataTransfer.setData('text/plain', index.toString());
            e.dataTransfer.effectAllowed = 'move';
          });

          tr.addEventListener('dragend', () => {
            tbody.querySelectorAll('.cad-prop-row').forEach(r => {
              r.removeClass('cad-drag-active');
              r.removeClass('cad-drag-hover');
            });
            draggedIndex = null;
          });
        }

        tr.addEventListener('dragover', (e) => {
          if (draggedIndex !== null && draggedIndex !== index) {
            e.preventDefault();
            tr.addClass('cad-drag-hover');
          }
        });

        tr.addEventListener('dragleave', () => {
          tr.removeClass('cad-drag-hover');
        });

        tr.addEventListener('drop', async (e) => {
          tr.removeClass('cad-drag-hover');
          if (draggedIndex === null || draggedIndex === index) return;
          e.preventDefault();

          // 1. Generate candidate array
          const candidateFields = [...def.fields];
          const [draggedItem] = candidateFields.splice(draggedIndex, 1);
          candidateFields.splice(index, 0, draggedItem);

          // 2. Validate that locked fields have not changed their index
          let isValid = true;
          for (let i = 0; i < def.fields.length; i++) {
            if (isLocked(def.fields[i])) {
              if (!candidateFields[i] || candidateFields[i].key !== def.fields[i].key) {
                isValid = false;
                break;
              }
            }
          }

          if (!isValid) {
            new obsidian.Notice('Impossible de réordonner : les propriétés verrouillées (🔒) doivent conserver leur position initiale.');
            return;
          }

          // 3. Save new order
          def.fields = candidateFields;
          await saveAndSync();
          renderPropEditor();
        });

        // 1. Label Input
        const tdLabel = tr.createEl('td');
        const inputLabel = tdLabel.createEl('input', {
          type: 'text',
          value: field.label || '',
          cls: 'cad-prop-input'
        });
        inputLabel.addEventListener('change', async () => {
          field.label = inputLabel.value.trim() || field.key;
          syncSharedProperties(field);
          await saveAndSync();
        });

        // 2. Tech Key Input with autocomplete suggestions
        const tdKey = tr.createEl('td');
        const keyWrap = tdKey.createDiv({ cls: 'cad-key-wrap' });

        // Build a unique datalist id
        const datalistId = `cad-key-dl-${selectedEntityKey}-${index}`;
        const datalist = keyWrap.createEl('datalist');
        datalist.id = datalistId;

        // Collect all frontmatter keys from vault files as suggestions
        const _allSuggestionKeys = new Set();
        // 1. Keys from all known entity fields
        for (const ent of Object.values(ENTITIES)) {
          ent.fields.forEach(f => _allSuggestionKeys.add(f.key));
        }
        // 2. Keys from actual vault frontmatter (sample up to 200 files for perf)
        try {
          const vaultFiles = this.app.vault.getMarkdownFiles().slice(0, 200);
          for (const vf of vaultFiles) {
            const cache = this.app.metadataCache.getFileCache(vf);
            if (cache && cache.frontmatter) {
              Object.keys(cache.frontmatter).forEach(k => {
                if (k !== 'position') _allSuggestionKeys.add(k);
              });
            }
          }
        } catch (_) { }
        _allSuggestionKeys.forEach(k => datalist.createEl('option', { value: k }));

        const inputKey = keyWrap.createEl('input', {
          type: 'text',
          value: field.key || '',
          cls: 'cad-prop-input'
        });
        inputKey.setAttribute('list', datalistId);
        inputKey.setAttribute('autocomplete', 'off');

        if (locked || field.key === 'type') {
          inputKey.disabled = true;
        } else {
          inputKey.disabled = false;
          inputKey.addEventListener('input', () => {
            // Show suggestions as user types — filter datalist in real time
            const q = inputKey.value.trim().toLowerCase();
            datalist.empty();
            [..._allSuggestionKeys]
              .filter(k => !q || k.toLowerCase().includes(q))
              .sort()
              .forEach(k => datalist.createEl('option', { value: k }));
          });
          inputKey.addEventListener('change', async () => {
            const rawVal = inputKey.value.trim().toLowerCase();
            const sanitized = rawVal.replace(/[^a-z0-9_]/g, '');
            if (!sanitized) {
              new obsidian.Notice('Technical key cannot be empty and must be alphanumeric.');
              inputKey.value = field.key;
              return;
            }
            if (def.fields.some((f, idx) => idx !== index && f.key === sanitized)) {
              new obsidian.Notice('This technical key is already in use.');
              inputKey.value = field.key;
              return;
            }

            const oldKey = field.key;
            // Migrate files of the current selected entity
            await migrateFrontmatterKey(this.app, selectedEntityKey, oldKey, sanitized);
            // Migrate files and update keys of any other entity sharing the same old key
            for (const [ek, ent] of Object.entries(ENTITIES)) {
              if (ek === selectedEntityKey) continue;
              const targetField = ent.fields.find(f => f.key === oldKey);
              if (targetField) {
                await migrateFrontmatterKey(this.app, ek, oldKey, sanitized);
                targetField.key = sanitized;
              }
            }
            field.key = sanitized;
            // After key is renamed, check if the new key matches any existing fields in other entities to sync with them
            const matchingField = Object.entries(ENTITIES)
              .flatMap(([ek, ent]) => ent.fields)
              .find(f => f.key === sanitized && f !== field);
            if (matchingField) {
              field.label = matchingField.label;
              field.type = matchingField.type;
              if (matchingField.options) {
                field.options = JSON.parse(JSON.stringify(matchingField.options));
              } else {
                delete field.options;
              }
              if (matchingField.suggestionSource) {
                field.suggestionSource = matchingField.suggestionSource;
              } else {
                delete field.suggestionSource;
              }
              new obsidian.Notice(`Linked key to existing property "${sanitized}".`);
            } else {
              syncSharedProperties(field);
            }
            await saveAndSync();
            renderPropEditor();
          });
        }

        // 3. Type select dropdown
        const tdType = tr.createEl('td');
        const selectType = tdType.createEl('select', { cls: 'cad-prop-input' });
        const types = field.key === 'type'
          ? [
            { value: 'text', label: 'Text' },
            { value: 'enum', label: 'Select (Enum)' }
          ]
          : [
            { value: 'text', label: 'Text' },
            { value: 'multitext', label: 'List / Multiple Links' },
            { value: 'date', label: 'Date' },
            { value: 'number', label: 'Number' },
            { value: 'currency', label: 'Currency' },
            { value: 'tags', label: 'Tags' },
            { value: 'enum', label: 'Select (Enum)' }
          ];
        types.forEach(t => {
          const opt = selectType.createEl('option', { value: t.value, text: t.label });
          if (field.type === t.value || (!field.type && t.value === 'text')) {
            opt.selected = true;
          }
        });
        if (locked) {
          selectType.disabled = true;
        } else {
          selectType.disabled = false;
          selectType.addEventListener('change', async () => {
            const oldType = field.type || 'text';
            const newType = selectType.value;
            // Migrate current selected entity files
            await migrateFrontmatterType(this.app, selectedEntityKey, field.key, oldType, newType);
            // Migrate files and update types for any other entity sharing this key
            if (field.key !== 'type') {
              for (const [ek, ent] of Object.entries(ENTITIES)) {
                if (ek === selectedEntityKey) continue;
                const targetField = ent.fields.find(f => f.key === field.key);
                if (targetField) {
                  await migrateFrontmatterType(this.app, ek, field.key, oldType, newType);
                  targetField.type = newType;
                }
              }
            }
            field.type = newType;
            syncSharedProperties(field);
            await saveAndSync();
            renderPropEditor();
          });
        }

        // 4. Options input (only for enum) OR suggestion database dropdown (for multitext/tags)
        // Primary fields (name/title/subject) and date/currency types have no options → greyed out
        const tdOptions = tr.createEl('td');
        const isOptionsDisabled = field.primary
          || field.type === 'date'
          || field.type === 'currency';

        if (isOptionsDisabled) {
          const disabledInput = tdOptions.createEl('input', {
            type: 'text',
            cls: 'cad-prop-input',
          });
          disabledInput.disabled = true;
          disabledInput.placeholder = '—';
        } else if (field.type === 'enum') {
          const inputOptions = tdOptions.createEl('input', {
            type: 'text',
            value: field.options ? field.options.join(', ') : '',
            placeholder: 'Option A, Option B...',
            cls: 'cad-prop-input'
          });
          inputOptions.addEventListener('change', async () => {
            const opts = inputOptions.value.split(',')
              .map(s => s.trim())
              .filter(Boolean);
            field.options = opts;
            syncSharedProperties(field);
            await saveAndSync();
          });
        } else if (field.type === 'multitext' || field.type === 'tags') {
          // Source selector: static options + folder picker
          const sourceWrap = tdOptions.createDiv({ cls: 'cad-source-wrap' });
          const selectSource = sourceWrap.createEl('select', { cls: 'cad-prop-input' });
          const staticSources = [
            { value: 'history', label: 'History / Shared' },
            { value: 'tags', label: 'Obsidian Tags' },
            { value: 'none', label: 'None' },
            { value: 'folder', label: 'Folder…' },
          ];

          const activeSource = field.suggestionSource || getFieldSuggestionSource(field);
          const isCustomFolder = activeSource && activeSource.startsWith('folder:');

          staticSources.forEach(s => {
            const opt = selectSource.createEl('option', { value: s.value, text: s.label });
            if (!isCustomFolder && s.value === activeSource) opt.selected = true;
            else if (isCustomFolder && s.value === 'folder') opt.selected = true;
          });

          // Custom folder picker (shown when 'folder' is chosen or a custom folder is active)
          const folderPickerWrap = sourceWrap.createDiv({ cls: 'cad-folder-picker-wrap' });
          folderPickerWrap.style.display = (selectSource.value === 'folder' || isCustomFolder) ? '' : 'none';
          folderPickerWrap.style.marginTop = '4px';
          folderPickerWrap.style.display = (selectSource.value === 'folder' || isCustomFolder) ? 'flex' : 'none';
          folderPickerWrap.style.alignItems = 'center';
          folderPickerWrap.style.gap = '6px';

          // Current folder badge
          const folderBadge = folderPickerWrap.createEl('span', { cls: 'cad-folder-badge' });
          const currentFolderPath = isCustomFolder ? activeSource.slice('folder:'.length) : '';
          folderBadge.setText(currentFolderPath || 'Aucun dossier');
          folderBadge.style.flex = '1';
          folderBadge.style.fontSize = '12px';
          folderBadge.style.color = currentFolderPath ? 'var(--text-normal)' : 'var(--text-faint)';
          folderBadge.style.fontFamily = 'var(--font-monospace)';
          folderBadge.style.overflow = 'hidden';
          folderBadge.style.textOverflow = 'ellipsis';
          folderBadge.style.whiteSpace = 'nowrap';

          // Track current selected folder path
          let _folderPath = currentFolderPath;

          const pickFolderBtn = folderPickerWrap.createEl('button', {
            cls: 'cad-btn cad-btn-sm cad-folder-pick-btn',
            text: '📂 Choisir',
          });
          pickFolderBtn.type = 'button';
          pickFolderBtn.style.flexShrink = '0';
          pickFolderBtn.style.whiteSpace = 'nowrap';

          const saveFolderSource = async (path) => {
            _folderPath = path;
            folderBadge.setText(path || 'Aucun dossier');
            folderBadge.style.color = path ? 'var(--text-normal)' : 'var(--text-faint)';
            field.suggestionSource = path ? `folder:${path}` : 'none';
            syncSharedProperties(field);
            await saveAndSync();
          };

          pickFolderBtn.addEventListener('click', () => {
            // Collect all folders from vault
            const allFolders = this.app.vault.getAllFolders
              ? this.app.vault.getAllFolders()
              : [];
            // Fallback: build folder list from all file paths
            const folderSet = new Set();
            if (!allFolders || !allFolders.length) {
              this.app.vault.getMarkdownFiles().forEach(f => {
                const parts = f.path.split('/');
                for (let i = 1; i < parts.length; i++) {
                  folderSet.add(parts.slice(0, i).join('/'));
                }
              });
            } else {
              allFolders.forEach(f => {
                const p = typeof f === 'string' ? f : (f.path || '');
                if (p) folderSet.add(p);
              });
            }
            const folders = Array.from(folderSet).sort();

            // Open SuggestModal
            const picker = new (class extends obsidian.SuggestModal {
              constructor(app) {
                super(app);
                this.setPlaceholder('Rechercher un dossier du vault…');
              }
              getSuggestions(q) {
                const ql = q.toLowerCase();
                return ql ? folders.filter(f => f.toLowerCase().includes(ql)) : folders;
              }
              renderSuggestion(folder, el) {
                el.createEl('span', { text: '📁 ' });
                el.createEl('span', { text: folder });
              }
              onChooseSuggestion(folder) {
                saveFolderSource(folder);
              }
            })(this.app);
            picker.open();
          });

          selectSource.addEventListener('change', async () => {
            const show = selectSource.value === 'folder';
            folderPickerWrap.style.display = show ? 'flex' : 'none';
            if (!show) {
              _folderPath = '';
              folderBadge.setText('Aucun dossier');
              await saveSugSource();
            }
          });

          const saveSugSource = async () => {
            const v = selectSource.value;
            if (v === 'folder') {
              field.suggestionSource = _folderPath ? `folder:${_folderPath}` : 'none';
            } else {
              field.suggestionSource = v;
            }
            syncSharedProperties(field);
            await saveAndSync();
          };
        } else {
          const disabledInput = tdOptions.createEl('input', {
            type: 'text',
            cls: 'cad-prop-input',
          });
          disabledInput.disabled = true;
          disabledInput.placeholder = '—';
        }

        // 5. Delete button
        const tdDelete = tr.createEl('td');
        const btnDelete = tdDelete.createEl('button', {
          text: '×',
          cls: 'cad-prop-btn-delete'
        });
        if (locked || field.key === 'type') {
          btnDelete.disabled = true;
        } else {
          btnDelete.disabled = false;
          btnDelete.addEventListener('click', async () => {
            def.fields.splice(index, 1);
            await saveAndSync();
            renderPropEditor();
          });
        }
      });

      // + Add property button
      const btnAdd = propEditorDiv.createEl('button', {
        text: '+ Add property',
        cls: 'cad-prop-btn-add'
      });
      btnAdd.addEventListener('click', async () => {
        let counter = 1;
        let newKey = `new_property_${counter}`;
        while (def.fields.some(f => f.key === newKey)) {
          counter++;
          newKey = `new_property_${counter}`;
        }
        def.fields.push({
          key: newKey,
          label: 'New Property',
          type: 'text'
        });
        await saveAndSync();
        renderPropEditor();
      });
    };

    renderPropEditor();
  }
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

export { CadencePlugin };
