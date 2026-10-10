/* ============================================================
   Cadence — Obsidian app
   Single unified view with internal tab nav (Today / Planner / ...).
   Source-of-truth = your daily-note markdown files.
   The plugin entry. esbuild bundles this file into the root main.js.
   ============================================================ */
import { Notice, Plugin, type TFile } from 'obsidian';
import { VIEW_TYPE_CADENCE_APP } from './constants/nav';
import { CadenceCaptureModal } from './modals/capture';
import { CadenceImportModal } from './modals/import-modal';
import { handleProjectDeletion, syncContactProjectRelationships } from './plugin/contact-project-sync';
import type { PluginHost } from './plugin/host';
import {
  addReminder, completeReminder, deleteReminder, fireReminder, snoozeReminder, tickReminders, updateReminder,
  type ReminderInput,
} from './plugin/reminders-engine';
import { loadSettings, registerCustomPropertyTypes, saveSettings } from './plugin/settings';
import type { SettingTabPlugin } from './settings/host';
import { CadenceSettingTab } from './settings/setting-tab';
import type { EntityKey } from './types/entities';
import type { Reminder } from './types/reminders';
import type { PluginSettings } from './types/settings';
import { sameDay, startOfDay, ymd } from './utils/dates';
import { ensureDailyNote } from './utils/daily-notes';
import { parseSections, replaceSection } from './utils/parsing';
import { reminderTimeStr } from './utils/reminders';
import { ensureDefaultTemplates } from './utils/templates';
import { CadenceAppView } from './views/app-view';
import type { AppViewPlugin } from './views/host';

declare const module: { exports: unknown };

/* What openQuickCapture() pre-fills the capture modal with. */
export interface QuickCapturePrefill {
  text?: string;
  /** ISO timestamp; when set, the modal's "Remind me" toggle starts checked. */
  when?: string | null;
  repeat?: string;
}

/* ─────────── The plugin ───────────
   The reminders engine, the settings load and the contact↔project sync live
   in src/plugin/; the class keeps a one-line delegate for each, because the
   app view, the setting tab and the modals all call them as `plugin.x()`
   (src/views/README.md, "The plugin"). */
export class CadencePlugin extends Plugin implements PluginHost, AppViewPlugin, SettingTabPlugin {
  declare settings: PluginSettings;
  declare _syncInProgress: boolean;

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
        let entityKey: EntityKey = 'contact';
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CADENCE_APP)[0];
        if (leaf && leaf.view) {
          const m = String((leaf.view as CadenceAppView).mode || '');
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
        await this.handleProjectDeletion(file as TFile);
      })
    );
  }

  /* ── Quick capture API ── */
  openQuickCapture(prefill?: QuickCapturePrefill) {
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
          new Notice(`Reminder set · ${reminderTimeStr(result.when)}${dailyNoteAppended ? ` · added to ${noteLabel}` : ''}`);
        } else {
          new Notice(`Captured to Inbox${dailyNoteAppended ? ` · added to ${noteLabel}` : ''}`);
        }
      },
    }).open();
  }

  /* ── Reminders CRUD ── */
  addReminder(partial: ReminderInput) { return addReminder(this, partial); }
  updateReminder(id: string, patch: Partial<Reminder>) { return updateReminder(this, id, patch); }
  deleteReminder(id: string) { return deleteReminder(this, id); }
  snoozeReminder(id: string, ms: number) { return snoozeReminder(this, id, ms); }
  completeReminder(id: string) { return completeReminder(this, id); }

  refreshOpenViews() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_CADENCE_APP).forEach((leaf) => {
      if (leaf.view && typeof (leaf.view as CadenceAppView).render === 'function') (leaf.view as CadenceAppView).render();
    });
  }

  /* ── Reminder ticker ── */
  tickReminders() { return tickReminders(this); }
  _fireReminder(r: Reminder) { return fireReminder(this, r); }

  async openApp(mode: string | null = null) {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CADENCE_APP)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE_CADENCE_APP, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    if (leaf.view && typeof (leaf.view as CadenceAppView).setMode === 'function') {
      const target = mode || (leaf.view as CadenceAppView).mode || 'home';
      // Reset week-view anchor to current week when (re)opening that surface
      if (target === 'planner.calendar') (leaf.view as CadenceAppView).plannerAnchor = startOfDay(new Date());
      await (leaf.view as CadenceAppView).setMode(target);
    }
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CADENCE_APP);
  }

  registerCustomPropertyTypes() { return registerCustomPropertyTypes(this); }
  loadSettings() { return loadSettings(this); }
  syncContactProjectRelationships(changedFile: TFile | null | undefined) { return syncContactProjectRelationships(this, changedFile); }
  handleProjectDeletion(file: TFile | null | undefined) { return handleProjectDeletion(this, file); }
  saveSettings() { return saveSettings(this); }

}

/* Obsidian loads main.js as CommonJS. The original hand-written file set
   module.exports to the plugin class itself (no `default` wrapper), so the
   bundle does the same. */
module.exports = CadencePlugin;
