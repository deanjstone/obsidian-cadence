import type { CrossSectionConfig } from './modals';
import type { Reminder } from './reminders';

/* The subset of plugin settings the extracted helpers read. The full
   settings object is still defined by DEFAULT_SETTINGS in the legacy file. */
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
}
