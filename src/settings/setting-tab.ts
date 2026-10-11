import { PluginSettingTab, Setting, type App } from 'obsidian';
import { NAV_GROUPS, VIEW_TYPE_CADENCE_APP, type NavGroup } from '../constants/nav';
import { CURRENCY_OPTIONS, DEFAULT_SETTINGS } from '../constants/settings';
import type { Reminder } from '../types/reminders';
import type { SettingTabSettings } from '../types/settings';
import { renderCustomPagesSettings, type Option } from './custom-pages';
import { renderEntityPropertiesSettings } from './entity-properties';
import type { SettingTabHost, SettingTabPlugin } from './host';

/* ─────────── Settings tab ───────────
   Obsidian's settings page for the plugin, registered by CadencePlugin with
   addSettingTab. display() draws one section after another; each section is
   a `renderXSettings(tab, containerEl)` function over the SettingTabHost
   seam. See src/views/README.md ("The setting tab"). */

export type { SettingTabHost, SettingTabPlugin } from './host';

/* Obsidian's community-plugin registry, missing from the public obsidian.d.ts. */
interface AppWithPlugins {
  plugins: { enabledPlugins: Set<string> };
}

/* A Cadence app leaf, as the currency dropdown re-renders its view. */
interface RenderableLeaf {
  view?: { render?: unknown } | null;
}

export class CadenceSettingTab extends PluginSettingTab implements SettingTabHost {
  declare plugin: SettingTabPlugin;

  constructor(app: App, plugin: SettingTabPlugin) { super(app, plugin); this.plugin = plugin; }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Cadence' });
    renderModulesSettings(this, containerEl);
    renderReminderSettings(this, containerEl);
    renderAppSettings(this, containerEl);
    renderCloudSyncSettings(this, containerEl);
    renderCustomPagesSettings(this, containerEl);
    renderEntityPropertiesSettings(this, containerEl);
  }
}

/* ─── Modules ─── */

export const MODULE_TOGGLES: Array<{ key: string; label: string; desc: string }> = [
  { key: 'planner', label: 'Planner', desc: 'Inbox, Today, Calendar.' },
  { key: 'projects', label: 'Projects', desc: 'Projects with milestones, tasks, and status tracking.' },
  { key: 'crm', label: 'CRM', desc: 'Dashboard, Pipeline, Contacts, Companies, Activities + CRM-driven Reports.' },
  { key: 'prm', label: 'PRM', desc: 'Partners, Registrations, Commissions, Leads, Certifications, Analytics + Partner reports.' },
];

/* settings.modules, created (as a copy of the defaults) or backfilled in
   place. */
export function ensureModules(settings: SettingTabSettings): Record<string, boolean> {
  if (!settings.modules) {
    settings.modules = { ...DEFAULT_SETTINGS.modules };
  }
  if (settings.modules.projects === undefined) {
    settings.modules.projects = true;
  }
  return settings.modules;
}

export function renderModulesSettings(tab: SettingTabHost, containerEl: HTMLElement): void {
  containerEl.createEl('h3', { text: 'Modules' });
  containerEl.createEl('p', {
    text: 'Toggle entire sections of the app. Disabled modules disappear from the left nav and from Reports that depend on them.',
    cls: 'setting-item-description',
  });
  MODULE_TOGGLES.forEach((m) => {
    new Setting(containerEl)
      .setName(m.label)
      .setDesc(m.desc)
      .addToggle((t) => t
        .setValue(ensureModules(tab.plugin.settings)[m.key] !== false)
        .onChange(async (v) => {
          ensureModules(tab.plugin.settings)[m.key] = v;
          await tab.plugin.saveSettings();
          tab.plugin.refreshOpenViews();
        }));
  });
}

/* ─── Reminders ─── */

/* The browser's Notification API, or undefined where there is none. */
export type NotificationApi = { permission: string } | undefined;

/* Ask for permission only when notifications are switched on and the
   browser has not decided yet. */
export function shouldRequestPermission(enabled: boolean, notification: NotificationApi): boolean {
  return !!(enabled && notification !== undefined && notification.permission === 'default');
}

export function notificationPermissionDesc(notification: NotificationApi): string {
  return notification === undefined
    ? 'Notifications API not available in this environment.'
    : `Current status: ${notification.permission}`;
}

export function completedReminderCount(reminders: Reminder[] | undefined): number {
  return (reminders || []).filter((r) => r.done).length;
}

/* The reminders left after Clear: the open ones, in order. */
export function openReminders(reminders: Reminder[] | undefined): Reminder[] {
  return (reminders || []).filter((r) => !r.done);
}

const notificationApi = (): NotificationApi => typeof Notification === 'undefined' ? undefined : Notification;

export function renderReminderSettings(tab: SettingTabHost, containerEl: HTMLElement): void {
  containerEl.createEl('h3', { text: 'Reminders' });
  new Setting(containerEl)
    .setName('Desktop notifications')
    .setDesc('In addition to the in-app banner, fire a system notification when a reminder is due. Requires browser permission.')
    .addToggle((t) => t
      .setValue(!!tab.plugin.settings.desktopNotifications)
      .onChange(async (v) => {
        tab.plugin.settings.desktopNotifications = v;
        await tab.plugin.saveSettings();
        if (shouldRequestPermission(v, notificationApi())) {
          try { await Notification.requestPermission(); } catch (_) { }
        }
      }));

  new Setting(containerEl)
    .setName('Notification permission')
    .setDesc(notificationPermissionDesc(notificationApi()))
    .addButton((b) => b.setButtonText('Request permission').onClick(async () => {
      if (typeof Notification === 'undefined') return;
      try { await Notification.requestPermission(); tab.display(); } catch (_) { }
    }));

  new Setting(containerEl)
    .setName('Clear completed reminders')
    .setDesc(`${completedReminderCount(tab.plugin.settings.reminders)} completed reminders stored.`)
    .addButton((b) => b.setButtonText('Clear').onClick(async () => {
      tab.plugin.settings.reminders = openReminders(tab.plugin.settings.reminders);
      await tab.plugin.saveSettings();
      tab.plugin.refreshOpenViews();
      tab.display();
    }));
}

/* ─── App ─── */

export const TASK_SYSTEM_OPTIONS: Option[] = [
  { value: 'native', label: 'Native (Cadence)' },
  { value: 'tasknotes', label: 'TaskNotes' },
];

export const TASKNOTES_URL = 'https://github.com/callumalpass/obsidian-tasknotes';

/* The TaskNotes status row, shown when TaskNotes is the task system. */
export function taskNotesStatus(active: boolean): { name: string; desc: string; text: string; color: string } {
  return active
    ? {
      name: 'TaskNotes Status',
      desc: 'TaskNotes is currently installed, activated and successfully connected to Cadence.',
      text: '🟢 Active and Connected',
      color: '#27ae60',
    }
    : {
      name: 'TaskNotes not detected',
      desc: 'The TaskNotes plugin is not enabled or installed in your Obsidian vault.',
      text: '🔴 Inactive / Not installed',
      color: '#c0392b',
    };
}

export { CURRENCY_OPTIONS };

/* The week-start dropdown's value → settings.weekStartsOn: 0 for Sunday,
   1 for anything else. */
export function weekStartsOnFromOption(value: string): 0 | 1 {
  return Number(value) === 0 ? 0 : 1;
}

/* Every nav surface, labelled `Group · Surface` (or just the surface in an
   unlabelled group). */
export function defaultTabOptions(groups: NavGroup[]): Option[] {
  return groups.flatMap((g) => g.items.map((s) => {
    const prefix = g.label ? `${g.label} · ` : '';
    return { value: s.id, label: prefix + s.label };
  }));
}

/* Flagged quirk: an unset default tab shows as Planner · Today, while the
   defaults (and the app) use Home. */
export function defaultTabValue(settings: SettingTabSettings): string {
  return settings.defaultTab || 'planner.today';
}

export function renderAppSettings(tab: SettingTabHost, containerEl: HTMLElement): void {
  containerEl.createEl('h3', { text: 'App' });

  new Setting(containerEl)
    .setName('Task management system')
    .setDesc('Choose between the native Cadence manager (using daily notes) or the external TaskNotes plugin.')
    .addDropdown((d) => {
      TASK_SYSTEM_OPTIONS.forEach((o) => d.addOption(o.value, o.label));
      d.setValue(tab.plugin.settings.taskManagementSystem || 'native')
        .onChange(async (v) => {
          tab.plugin.settings.taskManagementSystem = v;
          await tab.plugin.saveSettings();
          tab.display();
          tab.plugin.refreshOpenViews();
        });
    });

  if (tab.plugin.settings.taskManagementSystem === 'tasknotes') {
    const isTaskNotesActive = (tab.app as unknown as AppWithPlugins).plugins.enabledPlugins.has("tasknotes");
    const status = taskNotesStatus(isTaskNotesActive);
    const statusSetting = new Setting(containerEl)
      .setName(status.name)
      .setDesc(status.desc);
    const statusSpan = statusSetting.controlEl.createSpan({
      text: status.text
    });
    statusSpan.style.color = status.color;
    statusSpan.style.fontWeight = 'bold';

    if (!isTaskNotesActive) {
      new Setting(containerEl)
        .setName('Download TaskNotes')
        .setDesc("Click the button below to open the TaskNotes plugin GitHub page to install it on your Obsidian.")
        .addButton((btn) => btn
          .setButtonText('Download TaskNotes')
          .onClick(() => {
            window.open(TASKNOTES_URL, '_blank');
          }));
    }
  }

  new Setting(containerEl)
    .setName('Daily note folder')
    .setDesc('Folder under which daily notes live, e.g. "daily" or "Journal/Daily".')
    .addText((t) => t
      .setPlaceholder('daily')
      .setValue(tab.plugin.settings.dailyNoteFolder)
      .onChange(async (v) => { tab.plugin.settings.dailyNoteFolder = v; await tab.plugin.saveSettings(); }));

  new Setting(containerEl)
    .setName('Tasks heading')
    .setDesc('The H2 inside each daily note where tasks live. Default "## Today".')
    .addText((t) => t
      .setValue(tab.plugin.settings.tasksHeading)
      .onChange(async (v) => { tab.plugin.settings.tasksHeading = v; await tab.plugin.saveSettings(); }));

  new Setting(containerEl)
    .setName('Journal heading')
    .setDesc('The H2 where today\'s journal entry lives. Default "## Journal".')
    .addText((t) => t
      .setValue(tab.plugin.settings.journalHeading)
      .onChange(async (v) => { tab.plugin.settings.journalHeading = v; await tab.plugin.saveSettings(); }));

  new Setting(containerEl)
    .setName('Currency')
    .setDesc('Used to format money values across Pipeline, Reports and Commissions.')
    .addDropdown((d) => {
      CURRENCY_OPTIONS.forEach((c) => d.addOption(c.code, c.label));
      d.setValue(tab.plugin.settings.currency || 'USD');
      d.onChange(async (v) => {
        tab.plugin.settings.currency = v;
        await tab.plugin.saveSettings();
        // Re-render any open Cadence tabs so values reformat immediately
        (tab.app.workspace.getLeavesOfType(VIEW_TYPE_CADENCE_APP) as RenderableLeaf[]).forEach((leaf) => {
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
      .setValue(String(tab.plugin.settings.weekStartsOn))
      .onChange(async (v) => {
        tab.plugin.settings.weekStartsOn = weekStartsOnFromOption(v);
        await tab.plugin.saveSettings();
      }));

  new Setting(containerEl)
    .setName('Open Cadence on Obsidian startup')
    .setDesc('Auto-open the Cadence Home command centre when Obsidian launches.')
    .addToggle((t) => t
      .setValue(!!tab.plugin.settings.openOnStartup)
      .onChange(async (v) => { tab.plugin.settings.openOnStartup = v; await tab.plugin.saveSettings(); }));

  new Setting(containerEl)
    .setName('Default tab')
    .setDesc('Which surface opens first when you launch the Cadence app.')
    .addDropdown((d) => {
      defaultTabOptions(NAV_GROUPS).forEach((o) => d.addOption(o.value, o.label));
      d.setValue(defaultTabValue(tab.plugin.settings));
      d.onChange(async (v) => { tab.plugin.settings.defaultTab = v; await tab.plugin.saveSettings(); });
    });
}

/* ─── Cloud sync (coming soon) ─── */

export function renderCloudSyncSettings(tab: SettingTabHost, containerEl: HTMLElement): void {
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
        .setValue(tab.plugin.settings.cadenceApiUrl)
        .onChange(async (v) => { tab.plugin.settings.cadenceApiUrl = v; await tab.plugin.saveSettings(); });
      t.inputEl.disabled = true;
    });
  new Setting(containerEl)
    .setName('API token')
    .setDesc('Coming soon')
    .addText((t) => {
      t.setPlaceholder('paste JWT here when sync ships')
        .setValue(tab.plugin.settings.cadenceApiToken)
        .onChange(async (v) => { tab.plugin.settings.cadenceApiToken = v; await tab.plugin.saveSettings(); });
      t.inputEl.disabled = true;
    });
}
