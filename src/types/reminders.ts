export type ReminderRepeat = 'none' | 'daily' | 'weekly';

/* Shape written by CadencePlugin.addReminder and persisted in settings. */
export interface Reminder {
  id: string;
  text: string;
  /** ISO timestamp, or null for an unscheduled inbox item. */
  when: string | null;
  // TODO: confirm shape — only 'none' | 'daily' | 'weekly' are produced, but
  // persisted data is not validated on load.
  repeat: ReminderRepeat | string;
  notes: string;
  /** Vault path of the linked project note, if any. */
  project: string | null;
  notified: boolean;
  done: boolean;
  createdAt: string;
  /** Set once a repeating occurrence has scheduled the next one in its
      series (when it fired, was completed or was snoozed), so it never
      schedules a second. Absent on one-offs and on reminders saved before
      #44. */
  advanced?: boolean;
}

export type ReminderBucket = 'now' | 'today' | 'week' | 'later';
