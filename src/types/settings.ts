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

/* The settings the app view shell reads. */
export interface AppViewSettings {
  defaultTab?: string;
  dailyNoteFolder?: string;
  weekStartsOn?: number;
  cadenceAppDark?: boolean;
  collapsedGroups?: Record<string, boolean>;
  modules?: Record<string, boolean>;
  customPages?: CustomPage[];
  // TODO: confirm shape — only done/when are read by the shell.
  reminders?: Array<{ done?: boolean; when?: string | null }>;
}
