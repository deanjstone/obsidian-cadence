import { Notice, PluginSettingTab, Setting, SuggestModal, type App, type Plugin, type TFolder } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { NAV_GROUPS, VIEW_TYPE_CADENCE_APP } from '../constants/nav';
import type { EntityDef, EntityField } from '../types/entities';
import type { CustomPage, SettingTabSettings } from '../types/settings';
import { getFieldSuggestionSource, migrateFrontmatterKey, migrateFrontmatterType } from '../utils/entities';

/* ─────────── Settings tab ───────────
   Obsidian's settings page for the plugin, registered by CadencePlugin with
   addSettingTab. See src/views/README.md ("The setting tab") for how it
   follows the view seam. */

/* What the tab reads and calls on the plugin. */
export interface SettingTabPlugin extends Plugin {
  settings: SettingTabSettings;
  saveSettings(): Promise<void>;
  refreshOpenViews(): void;
  registerCustomPropertyTypes(): void;
}

/* The tab as its section renderers see it. */
export interface SettingTabHost {
  app: App;
  plugin: SettingTabPlugin;
  containerEl: HTMLElement;
  display(): void;
}

/* Obsidian's community-plugin registry, missing from the public obsidian.d.ts. */
interface AppWithPlugins {
  plugins: { enabledPlugins: Set<string> };
}

/* A Cadence app leaf, as the currency dropdown re-renders its view. */
interface RenderableLeaf {
  view?: { render?: unknown } | null;
}

export const CURRENCY_OPTIONS: Array<{ code: string; label: string }> = [
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

export class CadenceSettingTab extends PluginSettingTab implements SettingTabHost {
  declare plugin: SettingTabPlugin;

  constructor(app: App, plugin: SettingTabPlugin) { super(app, plugin); this.plugin = plugin; }

  display(): void {
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
      new Setting(containerEl)
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
    new Setting(containerEl)
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

    new Setting(containerEl)
      .setName('Notification permission')
      .setDesc(typeof Notification === 'undefined'
        ? 'Notifications API not available in this environment.'
        : `Current status: ${Notification.permission}`)
      .addButton((b) => b.setButtonText('Request permission').onClick(async () => {
        if (typeof Notification === 'undefined') return;
        try { await Notification.requestPermission(); this.display(); } catch (_) { }
      }));

    new Setting(containerEl)
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

    new Setting(containerEl)
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
      const isTaskNotesActive = (this.app as unknown as AppWithPlugins).plugins.enabledPlugins.has("tasknotes");
      const statusSetting = new Setting(containerEl);
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

        new Setting(containerEl)
          .setName('Download TaskNotes')
          .setDesc("Click the button below to open the TaskNotes plugin GitHub page to install it on your Obsidian.")
          .addButton((btn) => btn
            .setButtonText('Download TaskNotes')
            .onClick(() => {
              window.open('https://github.com/callumalpass/obsidian-tasknotes', '_blank');
            }));
      }
    }

    new Setting(containerEl)
      .setName('Daily note folder')
      .setDesc('Folder under which daily notes live, e.g. "daily" or "Journal/Daily".')
      .addText((t) => t
        .setPlaceholder('daily')
        .setValue(this.plugin.settings.dailyNoteFolder)
        .onChange(async (v) => { this.plugin.settings.dailyNoteFolder = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Tasks heading')
      .setDesc('The H2 inside each daily note where tasks live. Default "## Today".')
      .addText((t) => t
        .setValue(this.plugin.settings.tasksHeading)
        .onChange(async (v) => { this.plugin.settings.tasksHeading = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Journal heading')
      .setDesc('The H2 where today\'s journal entry lives. Default "## Journal".')
      .addText((t) => t
        .setValue(this.plugin.settings.journalHeading)
        .onChange(async (v) => { this.plugin.settings.journalHeading = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Currency')
      .setDesc('Used to format money values across Pipeline, Reports and Commissions.')
      .addDropdown((d) => {
        CURRENCY_OPTIONS.forEach((c) => d.addOption(c.code, c.label));
        d.setValue(this.plugin.settings.currency || 'USD');
        d.onChange(async (v) => {
          this.plugin.settings.currency = v;
          await this.plugin.saveSettings();
          // Re-render any open Cadence tabs so values reformat immediately
          (this.app.workspace.getLeavesOfType(VIEW_TYPE_CADENCE_APP) as RenderableLeaf[]).forEach((leaf) => {
            if (leaf.view && typeof leaf.view.render === 'function') leaf.view.render();
          });
        });
      });

    new Setting(containerEl)
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

    new Setting(containerEl)
      .setName('Open Cadence on Obsidian startup')
      .setDesc('Auto-open the Cadence Home command centre when Obsidian launches.')
      .addToggle((t) => t
        .setValue(!!this.plugin.settings.openOnStartup)
        .onChange(async (v) => { this.plugin.settings.openOnStartup = v; await this.plugin.saveSettings(); }));

    const defaultDrop = new Setting(containerEl)
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
    new Setting(containerEl)
      .setName('Cadence base URL')
      .setDesc('Coming soon')
      .addText((t) => {
        t.setPlaceholder('https://your-cadence-instance')
          .setValue(this.plugin.settings.cadenceApiUrl)
          .onChange(async (v) => { this.plugin.settings.cadenceApiUrl = v; await this.plugin.saveSettings(); });
        t.inputEl.disabled = true;
      });
    new Setting(containerEl)
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

          const sectionLabel = ({
            'planner': 'Planner',
            'projects': 'Projects',
            'crm': 'CRM',
            'prm': 'PRM',
            'workflow': 'Workflow',
            'reports': 'Reports'
          } as Record<string, string>)[p.sectionId] || p.sectionId;
          tr.createEl('td', { text: sectionLabel });

          const entityLabel = ENTITIES[p.entityKey] ? ENTITIES[p.entityKey].label : p.entityKey;
          tr.createEl('td', { text: entityLabel });

          const layoutLabel = ({
            'table': 'Table View ☰',
            'kanban': 'Kanban Board 🗂',
            'cards': 'Card Grid ⚃'
          } as Record<string, string>)[p.defaultLayout || 'table'];
          tr.createEl('td', { text: layoutLabel });

          const actionsTd = tr.createEl('td');
          const delBtn = actionsTd.createEl('button', { cls: 'cad-btn', text: 'Delete' });
          delBtn.style.color = 'var(--text-error)';
          delBtn.style.padding = '2px 8px';
          delBtn.style.height = 'auto';
          delBtn.addEventListener('click', async () => {
            const originalIndex = this.plugin.settings.customPages!.findIndex(page => page.id === p.id);
            if (originalIndex >= 0) {
              const deletedPage = this.plugin.settings.customPages![originalIndex];
              const entityKey = deletedPage.entityKey;

              // 1. Remove page from customPages settings
              this.plugin.settings.customPages!.splice(originalIndex, 1);

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
          new Notice('Please enter a page label.');
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

        let newFields: EntityField[];
        if (this.plugin.settings.customEntities[entityKey]) {
          newFields = this.plugin.settings.customEntities[entityKey];
        } else {
          newFields = [
            { key: 'name', label: 'Name', primary: true, type: 'text' },
            { key: 'type', label: 'Type', type: 'text' }
          ];
          this.plugin.settings.customEntities[entityKey] = newFields;
        }

        const capitalize = (s: string) => (s === s.toUpperCase()) ? s : (s.charAt(0).toUpperCase() + s.slice(1));

        // Re-register inside ENTITIES
        ENTITIES[entityKey] = {
          folder: `Cadence/${val}`,
          label: capitalize(singular),
          plural: val,
          fields: newFields,
          columns: ['name']
        };

        const newPage: CustomPage = {
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
        this.plugin.settings.pageLayouts[newPage.id] = newPage.defaultLayout!;

        await this.plugin.saveSettings();
        this.plugin.refreshOpenViews();
        new Notice(`Page "${val}" added successfully.`);
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
    const entitySetting = new Setting(containerEl)
      .setName('Select entity')
      .setDesc('Choose which entity to customize.')
      .addDropdown((d) => {
        const getDropdownLabel = (key: string, ent: EntityDef) => {
          const coreEntitySections: Record<string, string> = {
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
              sectionLabel = ({
                'planner': 'Planner',
                'projects': 'Projects',
                'crm': 'CRM',
                'prm': 'PRM',
                'workflow': 'Workflow',
                'reports': 'Reports'
              } as Record<string, string>)[sectionId] || sectionId;
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

      const isPermanentlyLocked = (field: EntityField) => {
        if (field.primary) return true;
        const isCore = ['contact', 'company', 'partner', 'registration', 'commission', 'lead', 'certification', 'activity', 'sequence', 'project', 'deal'].includes(selectedEntityKey);
        if (isCore) {
          const k = field.key;
          if (selectedEntityKey === 'project' && (k === 'status' || k === 'priority')) return true;
          if (selectedEntityKey === 'deal' && k === 'stage') return true;
        }
        return false;
      };

      const isLocked = (field: EntityField) => {
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
          this.plugin.settings.customEntities![ek] = JSON.parse(JSON.stringify(ent.fields));
        }
        await this.plugin.saveSettings();
        this.plugin.registerCustomPropertyTypes();
        this.plugin.refreshOpenViews();
      };

      const syncSharedProperties = (sourceField: EntityField) => {
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

      let draggedIndex: number | null = null;

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
            e.dataTransfer!.setData('text/plain', index.toString());
            e.dataTransfer!.effectAllowed = 'move';
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
          const [draggedItem] = candidateFields.splice(draggedIndex!, 1);
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
            new Notice('Impossible de réordonner : les propriétés verrouillées (🔒) doivent conserver leur position initiale.');
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
        const _allSuggestionKeys = new Set<string>();
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
              new Notice('Technical key cannot be empty and must be alphanumeric.');
              inputKey.value = field.key;
              return;
            }
            if (def.fields.some((f, idx) => idx !== index && f.key === sanitized)) {
              new Notice('This technical key is already in use.');
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
              new Notice(`Linked key to existing property "${sanitized}".`);
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
        const types: Array<{ value: string; label: string }> = field.key === 'type'
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

          const saveFolderSource = async (path: string) => {
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
            const folderSet = new Set<string>();
            if (!allFolders || !allFolders.length) {
              this.app.vault.getMarkdownFiles().forEach(f => {
                const parts = f.path.split('/');
                for (let i = 1; i < parts.length; i++) {
                  folderSet.add(parts.slice(0, i).join('/'));
                }
              });
            } else {
              allFolders.forEach(f => {
                const p = typeof f === 'string' ? f : ((f as TFolder).path || '');
                if (p) folderSet.add(p);
              });
            }
            const folders: string[] = Array.from(folderSet).sort();

            // Open SuggestModal
            const picker = new (class extends SuggestModal<string> {
              constructor(app: App) {
                super(app);
                this.setPlaceholder('Rechercher un dossier du vault…');
              }
              getSuggestions(q: string): string[] {
                const ql = q.toLowerCase();
                return ql ? folders.filter(f => f.toLowerCase().includes(ql)) : folders;
              }
              renderSuggestion(folder: string, el: HTMLElement): void {
                el.createEl('span', { text: '📁 ' });
                el.createEl('span', { text: folder });
              }
              onChooseSuggestion(folder: string): void {
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
