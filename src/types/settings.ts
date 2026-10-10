import type { EntityField } from './entities';
import type { CrossSectionConfig, WidgetConfig } from './modals';
import type { Reminder } from './reminders';

/* The subset of plugin settings the extracted helpers read. The full
   settings object is PluginSettings, with its defaults in DEFAULT_SETTINGS
   (src/constants/settings.ts). */
export interface DailyNoteSettings {
  dailyNoteFolder?: string;
  tasksHeading: string;
  journalHeading: string;
}

/* A user-defined nav page (settings.customPages). Ids are `custom.<ms>` when
   created from the settings tab. */
export interface CustomPage {
  id: string;
  label: string;
  icon?: string;
  /** NAV_GROUPS id the page is listed under. */
  sectionId: string;
  /** Module toggle that hides the page; defaults to sectionId. */
  module?: string;
  entityKey: string;
  /** 'table' | 'kanban' | 'cards', chosen when the page is added. */
  defaultLayout?: string;
}

/* The settings the app view shell and its moved surfaces read. The daily-note
   fields always come from DEFAULT_SETTINGS. */
export interface AppViewSettings extends DailyNoteSettings {
  defaultTab?: string;
  weekStartsOn?: number;
  cadenceAppDark?: boolean;
  collapsedGroups?: Record<string, boolean>;
  modules?: Record<string, boolean>;
  customPages?: CustomPage[];
  /** 'tasknotes' reads tasks from TaskNotes/Tasks; anything else from the daily note. */
  taskManagementSystem?: string;
  /** Daily-note task → project path, keyed by `${dailyPath}::${taskText}`. */
  taskProjectLinks?: Record<string, string>;
  reminders?: Reminder[];
  /** Settings-driven cross sections on entity detail forms. */
  crossSections?: CrossSectionConfig[];
  /** Entity-list layout ('table' | 'kanban' | 'cards'), keyed by surface id. */
  pageLayouts?: Record<string, string>;
  /** Kanban group-by field, keyed by entity key. */
  pageKanbanGroupBy?: Record<string, string>;
  /** ISO code for currency fields; detail forms show it as the placeholder. */
  currency?: string;
  /** The Projects dashboard's custom chart widgets. */
  projectDashboardWidgets?: WidgetConfig[];
  /** The CRM dashboard's custom chart widgets. */
  crmDashboardWidgets?: WidgetConfig[];
  /** PRM analytics' custom chart widgets. */
  prmDashboardWidgets?: WidgetConfig[];
}

/* The settings the setting tab reads and writes, on top of the view's. */
export interface SettingTabSettings extends AppViewSettings {
  dailyNoteFolder: string;
  openOnStartup?: boolean;
  desktopNotifications?: boolean;
  /** Persisted for the coming-soon cloud sync; unused. */
  cadenceApiUrl: string;
  cadenceApiToken: string;
  /** Every entity's field schema, keyed by entity key; copied into ENTITIES on load. */
  customEntities?: Record<string, EntityField[]>;
}

/* Everything the plugin persists: DEFAULT_SETTINGS merged with the saved
   data (loadSettings in src/plugin/settings.ts). Saved data is not
   validated, so unknown keys survive the merge. */
export interface PluginSettings extends SettingTabSettings {
  dailyNoteFormat: string;
  journalHeading: string;
  tasksHeading: string;
  taskManagementSystem: string;
  weekStartsOn: number;
  defaultTab: string;
  openOnStartup: boolean;
  collapsedGroups: Record<string, boolean>;
  currency: string;
  cadenceAppDark: boolean;
  taskProjectLinks: Record<string, string>;
  modules: Record<string, boolean>;
  desktopNotifications: boolean;
  reminders: Reminder[];
  customPages: CustomPage[];
  pageLayouts: Record<string, string>;
  pageKanbanGroupBy: Record<string, string>;
  crossSections: CrossSectionConfig[];
  projectDashboardWidgets: WidgetConfig[];
  crmDashboardWidgets: WidgetConfig[];
  prmDashboardWidgets: WidgetConfig[];
  customEntities: Record<string, EntityField[]>;
}
