import type { App, Plugin } from 'obsidian';
import type { SettingTabSettings } from '../types/settings';

/* The settings tab's seam. CadenceSettingTab.display() draws each section
   with a `renderXSettings(tab, containerEl)` function, which reaches the
   plugin, the app and display() through this interface. See
   src/views/README.md ("The setting tab"). */

/* What the tab reads and calls on the plugin. */
export interface SettingTabPlugin extends Plugin {
  settings: SettingTabSettings;
  saveSettings(): Promise<void>;
  refreshOpenViews(): void;
  registerCustomPropertyTypes(): void;
}

/* The tab as its section renderers see it. A section redraws the whole
   page with `tab.display()`. */
export interface SettingTabHost {
  app: App;
  plugin: SettingTabPlugin;
  containerEl: HTMLElement;
  display(): void;
}
