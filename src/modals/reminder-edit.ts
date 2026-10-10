import { Modal, Notice, SuggestModal, TFile, type App } from 'obsidian';
import { VIEW_TYPE_CADENCE_APP } from '../constants/nav';
import { fromLocalDatetimeValue, toLocalDatetimeValue } from '../utils/dates';
import { listEntityFiles, projectNameFromPath } from '../utils/entities';
import { reminderTimeStr } from '../utils/reminders';
import type { ReminderPatch } from '../types/modals';
import type { Reminder } from '../types/reminders';

/* The CadencePlugin reminder API this modal writes through. */
export interface ReminderStore {
  addReminder(partial: ReminderPatch): Promise<unknown>;
  updateReminder(id: string, patch: ReminderPatch): Promise<unknown>;
  deleteReminder(id: string): Promise<void>;
}

export interface ReminderEditOptions {
  isNew?: boolean;
}

/** A project offered by the reminder project picker. */
export interface ReminderProjectChoice {
  file: TFile;
  name: string;
}

/* The Cadence view, as far as the project chip needs it. */
interface ProjectDetailHost {
  openEntityDetail?: (entityKey: 'project', file: TFile) => void;
}

/* ─────────── Reminder edit modal (text/when/repeat/notes/delete) ─────────── */
export class CadenceReminderEditModal extends Modal {
  declare plugin: ReminderStore;
  /** The caller's reminder object. The project field mutates it in place. */
  declare reminder: Partial<Reminder>;
  declare isNew: boolean;
  declare _submitted: boolean;

  constructor(app: App, plugin: ReminderStore, reminder: Partial<Reminder>, opts?: ReminderEditOptions) {
    super(app);
    this.plugin = plugin;
    this.reminder = reminder;
    this.isNew = (opts && opts.isNew) || false;
    this._submitted = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('cad-create-modal');
    contentEl.addClass('cad-reminder-edit-modal');
    contentEl.createEl('h3', { cls: 'cad-create-title', text: this.isNew ? 'New reminder' : 'Edit reminder' });

    const form = contentEl.createDiv({ cls: 'cad-create-form' });

    /* Text */
    const textRow = form.createDiv({ cls: 'cad-create-row' });
    textRow.createDiv({ cls: 'cad-create-label', text: 'WHAT *' });
    const textInput = textRow.createEl('input', { type: 'text', cls: 'cad-create-input' });
    textInput.value = this.reminder.text || '';
    textInput.placeholder = 'What needs doing?';

    /* When */
    const whenRow = form.createDiv({ cls: 'cad-create-row' });
    whenRow.createDiv({ cls: 'cad-create-label', text: 'WHEN' });
    const whenWrap = whenRow.createDiv();
    whenWrap.style.display = 'flex';
    whenWrap.style.gap = '8px';
    whenWrap.style.alignItems = 'center';
    const dateInput = whenWrap.createEl('input', { type: 'datetime-local', cls: 'cad-create-input' });
    dateInput.style.flex = '1';
    if (this.reminder.when) {
      const d = new Date(this.reminder.when);
      if (!isNaN(d.getTime())) dateInput.value = toLocalDatetimeValue(d);
    }
    const clearBtn = whenWrap.createEl('button', { cls: 'cad-btn cad-btn-sm', text: 'Clear' });
    clearBtn.type = 'button';
    clearBtn.title = 'Move to unscheduled';
    clearBtn.addEventListener('click', () => { dateInput.value = ''; });

    /* Repeat */
    const repeatRow = form.createDiv({ cls: 'cad-create-row' });
    repeatRow.createDiv({ cls: 'cad-create-label', text: 'REPEAT' });
    const repeatSel = repeatRow.createEl('select', { cls: 'cad-create-input' });
    [['none', 'No repeat'], ['daily', 'Daily'], ['weekly', 'Weekly']].forEach(([v, l]) => {
      const o = repeatSel.createEl('option', { value: v, text: l });
      if (v === (this.reminder.repeat || 'none')) o.selected = true;
    });

    /* Project link */
    const projectRow = form.createDiv({ cls: 'cad-create-row' });
    projectRow.createDiv({ cls: 'cad-create-label', text: 'PROJECT' });
    const projectField = projectRow.createDiv({ cls: 'cad-rem-project-field' });
    const renderProjectField = () => {
      projectField.empty();
      if (this.reminder.project) {
        const chip = projectField.createEl('a', { cls: 'cad-rem-project-chip', text: '📁 ' + (projectNameFromPath(this.app, this.reminder.project) || 'Project') });
        chip.title = 'Open project (closes this modal)';
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          const file = this.app.vault.getAbstractFileByPath(this.reminder.project!);
          if (file && file instanceof TFile) {
            this._submitted = true;
            this.close();
            const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CADENCE_APP)[0] as { view?: ProjectDetailHost } | undefined;
            if (leaf && leaf.view && typeof leaf.view.openEntityDetail === 'function') {
              leaf.view.openEntityDetail('project', file);
            }
          }
        });
        const changeBtn = projectField.createEl('button', { cls: 'cad-btn cad-btn-sm', text: 'Change' });
        changeBtn.type = 'button';
        changeBtn.addEventListener('click', () => this._openReminderProjectPicker(renderProjectField));
        const removeBtn = projectField.createEl('button', { cls: 'cad-btn cad-btn-sm cad-btn-danger', text: 'Remove' });
        removeBtn.type = 'button';
        removeBtn.addEventListener('click', () => {
          this.reminder.project = null;
          renderProjectField();
        });
      } else {
        const linkBtn = projectField.createEl('button', { cls: 'cad-btn cad-btn-sm', text: '📁 Link to project' });
        linkBtn.type = 'button';
        linkBtn.addEventListener('click', () => this._openReminderProjectPicker(renderProjectField));
      }
    };
    renderProjectField();

    /* Notes */
    const notesRow = form.createDiv({ cls: 'cad-create-row' });
    notesRow.style.alignItems = 'flex-start';
    notesRow.createDiv({ cls: 'cad-create-label', text: 'NOTES' });
    const notesArea = notesRow.createEl('textarea', { cls: 'cad-create-input' });
    notesArea.rows = 6;
    notesArea.placeholder = 'Context, follow-ups, what happened, related links…';
    notesArea.value = this.reminder.notes || '';
    notesArea.style.resize = 'vertical';
    notesArea.style.fontFamily = 'inherit';

    /* Actions */
    const actions = contentEl.createDiv({ cls: 'cad-create-actions' });
    if (!this.isNew) {
      const del = actions.createEl('button', { cls: 'cad-btn cad-btn-danger', text: 'Delete' });
      del.type = 'button';
      del.style.marginRight = 'auto';
      del.addEventListener('click', async () => {
        // Flagged, not fixed: native window.confirm, not CadenceConfirmModal.
        if (!confirm('Delete this reminder?')) return;
        await this.plugin.deleteReminder(this.reminder.id!);
        this._submitted = true;
        this.close();
      });
    }
    const cancel = actions.createEl('button', { cls: 'cad-btn', text: 'Cancel' });
    cancel.type = 'button';
    cancel.addEventListener('click', () => this.close());
    const save = actions.createEl('button', { cls: 'cad-btn primary', text: this.isNew ? 'Create reminder' : 'Save' });
    save.type = 'button';

    const submit = async () => {
      const text = textInput.value.trim();
      if (!text) { textInput.focus(); return; }
      const fields: ReminderPatch = {
        text,
        notes: notesArea.value,
        repeat: repeatSel.value || 'none',
        project: this.reminder.project || null,
      };
      if (dateInput.value) {
        const d = fromLocalDatetimeValue(dateInput.value);
        if (d && !isNaN(d.getTime())) {
          fields.when = d.toISOString();
          if (fields.when !== this.reminder.when) fields.notified = false;
        }
      } else {
        fields.when = null;
        fields.notified = false;
      }
      if (this.isNew) {
        await this.plugin.addReminder(fields);
        new Notice(fields.when
          ? `Reminder set · ${reminderTimeStr(fields.when)}`
          : 'Captured to Inbox');
      } else {
        await this.plugin.updateReminder(this.reminder.id!, fields);
      }
      this._submitted = true;
      this.close();
    };
    save.addEventListener('click', submit);

    // Submit on Cmd/Ctrl+Enter from notes area; Esc cancels
    notesArea.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
      if (e.key === 'Escape') this.close();
    });
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      if (e.key === 'Escape') this.close();
    });

    setTimeout(() => textInput.focus(), 0);
  }

  onClose() { this.contentEl.empty(); }

  _openReminderProjectPicker(rerender: () => void) {
    // Use the scoped listEntityFiles helper rather than enumerating the whole vault.
    const projectFiles = listEntityFiles(this.app, 'project');
    if (!projectFiles.length) {
      new Notice('No projects yet. Create one in Planner → Projects first.');
      return;
    }
    // Names are never null here: every path came from the vault.
    const projects = projectFiles.map((f) => ({ file: f, name: projectNameFromPath(this.app, f.path) }));
    const reminder = this.reminder;
    const picker = new (class extends SuggestModal<ReminderProjectChoice> {
      declare projs: ReminderProjectChoice[];
      constructor(app: App, projs: ReminderProjectChoice[]) {
        super(app);
        this.projs = projs;
        this.setPlaceholder('Search projects to link this reminder to…');
      }
      getSuggestions(query: string) {
        const q = (query || '').toLowerCase();
        return this.projs.filter((p) => p.name.toLowerCase().includes(q));
      }
      renderSuggestion(item: ReminderProjectChoice, el: HTMLElement) { el.setText('📁  ' + item.name); }
      onChooseSuggestion(item: ReminderProjectChoice) {
        reminder.project = item.file.path;
        rerender();
      }
    })(this.app, projects as ReminderProjectChoice[]);
    picker.open();
  }
}
