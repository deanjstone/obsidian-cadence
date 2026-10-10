import { Modal, type App } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import type { EntityKey } from '../types/entities';
import type { CrossSectionConfig } from '../types/modals';

/** Raw form values, as read from the modal's selects. */
export type CrossSectionForm = Omit<CrossSectionConfig, 'id'>;

/** The onSubmit payload: the form plus an `xs_` id from Math.random(). */
export function buildCrossSectionConfig(form: CrossSectionForm): CrossSectionConfig {
  return {
    id: 'xs_' + Math.random().toString(36).slice(2, 10),
    parentEntity: form.parentEntity,
    targetEntity: form.targetEntity,
    linkField: form.linkField,
    viewType: form.viewType
  };
}

/* Cross-linked section: show another entity's notes that link back to the
   parent through one of their fields. */
export class CadenceCrossSectionModal extends Modal {
  declare parentEntity: EntityKey;
  declare onSubmit: (config: CrossSectionConfig) => void;

  constructor(app: App, parentEntity: EntityKey, onSubmit: (config: CrossSectionConfig) => void) {
    super(app);
    this.parentEntity = parentEntity;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('cad-prompt-modal');
    contentEl.createEl('h3', { text: 'Add Cross-Linked Section' });

    contentEl.createEl('label', { text: 'Target Entity to display:', attr: { style: 'display: block; font-weight: 500; font-size: 0.85em; margin-bottom: 4px; margin-top: 12px;' } });
    const selectTarget = contentEl.createEl('select');
    selectTarget.style.width = '100%';
    selectTarget.style.padding = '6px 8px';
    selectTarget.style.background = 'var(--background-primary)';
    selectTarget.style.color = 'var(--text-normal)';
    selectTarget.style.border = '1px solid var(--border-color)';
    selectTarget.style.borderRadius = '4px';

    Object.entries(ENTITIES).forEach(([key, def]) => {
      if (key === this.parentEntity) return;
      selectTarget.createEl('option', { value: key, text: def.plural });
    });

    contentEl.createEl('label', { text: 'Linked Field (in target entity):', attr: { style: 'display: block; font-weight: 500; font-size: 0.85em; margin-bottom: 4px; margin-top: 12px;' } });
    const selectField = contentEl.createEl('select');
    selectField.style.width = '100%';
    selectField.style.padding = '6px 8px';
    selectField.style.background = 'var(--background-primary)';
    selectField.style.color = 'var(--text-normal)';
    selectField.style.border = '1px solid var(--border-color)';
    selectField.style.borderRadius = '4px';

    const populateFields = () => {
      selectField.empty();
      const target = selectTarget.value;
      const def = ENTITIES[target];
      if (def && def.fields) {
        def.fields.forEach(f => {
          if (f.primary) return;
          selectField.createEl('option', { value: f.key, text: `${f.label} (${f.key})` });
        });
      }
    };
    selectTarget.addEventListener('change', populateFields);
    populateFields();

    contentEl.createEl('label', { text: 'Display View Layout:', attr: { style: 'display: block; font-weight: 500; font-size: 0.85em; margin-bottom: 4px; margin-top: 12px;' } });
    const selectView = contentEl.createEl('select');
    selectView.style.width = '100%';
    selectView.style.padding = '6px 8px';
    selectView.style.background = 'var(--background-primary)';
    selectView.style.color = 'var(--text-normal)';
    selectView.style.border = '1px solid var(--border-color)';
    selectView.style.borderRadius = '4px';

    [
      { value: 'table', text: 'Table 📋' },
      { value: 'tile', text: 'Tiles / Cards 🎴' },
      { value: 'kanban', text: 'Kanban Board 🗂️' }
    ].forEach(opt => {
      selectView.createEl('option', { value: opt.value, text: opt.text });
    });

    const submit = () => {
      this.onSubmit(buildCrossSectionConfig({
        parentEntity: this.parentEntity,
        targetEntity: selectTarget.value,
        linkField: selectField.value,
        viewType: selectView.value
      }));
      this.close();
    };

    const row = contentEl.createDiv();
    row.style.display = 'flex';
    row.style.justifyContent = 'flex-end';
    row.style.gap = '8px';
    row.style.marginTop = '18px';

    const cancel = row.createEl('button', { text: 'Cancel' });
    cancel.addEventListener('click', () => this.close());

    const ok = row.createEl('button', { text: 'Add Section', cls: 'mod-cta' });
    ok.addEventListener('click', submit);
  }
}
