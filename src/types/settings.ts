/* The subset of plugin settings the extracted helpers read. The full
   settings object is still defined by DEFAULT_SETTINGS in the legacy file. */
export interface DailyNoteSettings {
  dailyNoteFolder?: string;
  tasksHeading: string;
  journalHeading: string;
}
