import { Modal, Notice, type App } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import type { EntityKey } from '../types/entities';
import type { WidgetConfig } from '../types/modals';

export type WidgetSubmit = (config: WidgetConfig) => void;

/** Raw form values, as read from the modal's inputs. */
export interface WidgetForm {
  title: string;
  groupBy: string;
  style: string;
}

/** The onSubmit payload, or null when the trimmed title is blank. */
export function buildWidgetConfig(form: WidgetForm): WidgetConfig | null {
  const title = form.title.trim();
  if (!title) return null;
  return {
    id: `widget.${Date.now()}`,
    title,
    groupBy: form.groupBy,
    style: form.style
  };
}

/* Dashboard chart widget: title, group-by field and chart style. Also
   accepts (app, onSubmit), in which case the entity is 'project'. */
export class CadenceWidgetCreateModal extends Modal {
  declare entityKey: EntityKey;
  declare onSubmit: WidgetSubmit | undefined;

  constructor(app: App, entityKey: EntityKey | WidgetSubmit | undefined, onSubmit?: WidgetSubmit) {
    super(app);
    // If only two args were passed, onSubmit is the second arg
    if (typeof entityKey === 'function') {
      this.onSubmit = entityKey;
      this.entityKey = 'project';
    } else {
      this.entityKey = entityKey || 'project';
      this.onSubmit = onSubmit;
    }
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('cad-prompt-modal');
    contentEl.createEl('h3', { text: 'Add Custom Chart Widget' });

    // 1. Title
    contentEl.createEl('label', { text: 'Chart Title:', attr: { style: 'display: block; font-weight: 500; font-size: 0.85em; margin-bottom: 4px; margin-top: 12px;' } });
    const inputTitle = contentEl.createEl('input', { type: 'text', placeholder: `e.g. ${this.entityKey.toUpperCase()} by Group` });
    inputTitle.style.width = '100%';
    inputTitle.style.padding = '6px 8px';

    // 2. Property to group by
    const entityLabel = ENTITIES[this.entityKey] ? (ENTITIES[this.entityKey].plural || this.entityKey) : this.entityKey;
    contentEl.createEl('label', { text: `Group ${entityLabel.toUpperCase()} by Property:`, attr: { style: 'display: block; font-weight: 500; font-size: 0.85em; margin-bottom: 4px; margin-top: 12px;' }});
    const selectProp = contentEl.createEl('select');
    selectProp.style.width = '100%';
    selectProp.style.padding = '6px 8px';
    selectProp.style.background = 'var(--background-primary)';
    selectProp.style.color = 'var(--text-normal)';
    selectProp.style.border = '1px solid var(--border-color)';
    selectProp.style.borderRadius = '4px';

    const fields = ENTITIES[this.entityKey] ? (ENTITIES[this.entityKey].fields || []) : [];
    fields.forEach(f => {
      if (f.primary) return;
      selectProp.createEl('option', { value: f.key, text: `${f.label} (${f.key})` });
    });

    // 3. Chart Style
    contentEl.createEl('label', { text: 'Chart Style:', attr: { style: 'display: block; font-weight: 500; font-size: 0.85em; margin-bottom: 4px; margin-top: 12px;' } });
    const selectStyle = contentEl.createEl('select');
    selectStyle.style.width = '100%';
    selectStyle.style.padding = '6px 8px';
    selectStyle.style.background = 'var(--background-primary)';
    selectStyle.style.color = 'var(--text-normal)';
    selectStyle.style.border = '1px solid var(--border-color)';
    selectStyle.style.borderRadius = '4px';

    [
      { value: 'donut', text: 'Donut Chart 🍩' },
      { value: 'bar', text: 'Horizontal Bar Chart 📊' },
      { value: 'kpi', text: 'KPI Cards Grid 🗃️' },
      { value: 'list', text: 'Simple List 📋' }
    ].forEach(opt => {
      selectStyle.createEl('option', { value: opt.value, text: opt.text });
    });

    const submit = () => {
      const config = buildWidgetConfig({ title: inputTitle.value, groupBy: selectProp.value, style: selectStyle.value });

      if (!config) {
        new Notice('Please enter a chart title.');
        inputTitle.focus();
        return;
      }

      // Throws when constructed without onSubmit (flagged, not fixed).
      this.onSubmit!(config);
      this.close();
    };

    // 4. Buttons
    const row = contentEl.createDiv();
    row.style.display = 'flex';
    row.style.justifyContent = 'flex-end';
    row.style.gap = '8px';
    row.style.marginTop = '18px';

    const cancel = row.createEl('button', { text: 'Cancel' });
    cancel.addEventListener('click', () => this.close());

    const ok = row.createEl('button', { text: 'Create Widget', cls: 'mod-cta' });
    ok.addEventListener('click', submit);

    setTimeout(() => inputTitle.focus(), 0);
  }
}
