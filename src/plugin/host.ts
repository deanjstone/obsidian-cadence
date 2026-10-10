import type { App } from 'obsidian';
import type { Reminder } from '../types/reminders';
import type { PluginSettings } from '../types/settings';

/* The plugin's seam. CadencePlugin (still in src/legacy/cadence.js) keeps a
   one-line delegate for each method that moved to src/plugin/, and the
   moved functions reach the plugin through this interface. See
   src/views/README.md ("The plugin"). */
export interface PluginHost {
  app: App;
  settings: PluginSettings;
  /** Set while a contact↔project sync or project-deletion pass writes frontmatter. */
  _syncInProgress: boolean;
  // TODO: confirm shape — Obsidian types loadData() as Promise<any>; it is
  // whatever data.json holds, or null on a fresh install.
  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<void>;
  saveSettings(): Promise<void>;
  refreshOpenViews(): void;
  updateReminder(id: string, patch: Partial<Reminder>): Promise<Reminder | null>;
  _fireReminder(r: Reminder): void;
}

/* Obsidian's property-type registry (not in the public obsidian.d.ts). */
export interface MetadataTypeManager {
  setType(key: string, type: string): void;
}

export interface AppWithMetadataTypes {
  metadataTypeManager?: MetadataTypeManager;
}
