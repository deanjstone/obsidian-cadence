import { Modal, type App } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import type { EntityKey } from '../types/entities';
import type { ChartSectionConfig } from '../types/modals';

/** The onSubmit payload, copied from the form values. */
export function buildChartSectionConfig(form: ChartSectionConfig): ChartSectionConfig {
  return {
    targetEntity: form.targetEntity,
    linkField: form.linkField,
    groupField: form.groupField,
    style: form.style
  };
}

/* Sensible pre-selections among a target's field keys: link = first field
   named after the parent entity (key or lower-cased label), group = first
   of stage/status/type/priority, in field order. Undefined = no match. */
export function chartSectionDefaults(fieldKeys: string[], parentEntity: EntityKey): { linkField?: string; groupField?: string } {
  const parentDef = ENTITIES[parentEntity];
  const linkField = parentDef
    ? fieldKeys.find((k) => k === parentEntity || k === parentDef.label.toLowerCase())
    : undefined;
  const groupField = fieldKeys.find((k) => ['stage', 'status', 'type', 'priority'].includes(k));
  return { linkField, groupField };
}

/* Modal: pick target entity + link field + group-by field + chart style for a chart block */
export class CadenceChartSectionModal extends Modal {
  declare parentEntity: EntityKey;
  declare onSubmit: (config: ChartSectionConfig) => void;

  constructor(app: App, parentEntity: EntityKey, onSubmit: (config: ChartSectionConfig) => void) {
    super(app);
    this.parentEntity = parentEntity;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('cad-prompt-modal');
    contentEl.createEl('h3', { text: 'Add Analytics Chart Block' });

    // Passed as a `style` key, which DomElementInfo does not have: Obsidian
    // ignores it and these labels render unstyled (flagged, not fixed).
    const style = 'display: block; font-weight: 500; font-size: 0.85em; margin-bottom: 4px; margin-top: 12px;';
    const selStyle = (el: HTMLElement) => {
      el.style.width = '100%';
      el.style.padding = '6px 8px';
      el.style.background = 'var(--background-primary)';
      el.style.color = 'var(--text-normal)';
      el.style.border = '1px solid var(--border-color)';
      el.style.borderRadius = '4px';
    };

    // 1. Target entity
    contentEl.createEl('label', { text: 'Entity to chart:', style } as DomElementInfo);
    const selTarget = contentEl.createEl('select');
    selStyle(selTarget);
    Object.entries(ENTITIES).forEach(([key, def]) => {
      selTarget.createEl('option', { value: key, text: def.plural });
    });

    // 2. Link field (which field on the target entity points back to the parent)
    contentEl.createEl('label', { text: 'Link field (field on target that references this entity):', style } as DomElementInfo);
    const selLink = contentEl.createEl('select');
    selStyle(selLink);

    // 3. Group-by field (which field to aggregate)
    contentEl.createEl('label', { text: 'Group by field (property to chart):', style } as DomElementInfo);
    const selGroup = contentEl.createEl('select');
    selStyle(selGroup);

    const refreshFields = () => {
      const targetKey = selTarget.value;
      const def = ENTITIES[targetKey];
      if (!def) return;
      selLink.empty();
      selGroup.empty();
      def.fields.forEach(f => {
        if (!f.primary) {
          selLink.createEl('option', { value: f.key, text: `${f.label} (${f.key})` });
          selGroup.createEl('option', { value: f.key, text: `${f.label} (${f.key})` });
        }
      });
      const { linkField, groupField } = chartSectionDefaults(Array.from(selLink.options).map((o) => o.value), this.parentEntity);
      if (linkField !== undefined) selLink.value = linkField;
      if (groupField !== undefined) selGroup.value = groupField;
    };
    refreshFields();
    selTarget.addEventListener('change', refreshFields);

    // 4. Chart style
    contentEl.createEl('label', { text: 'Chart Style:', style } as DomElementInfo);
    const selStyle2 = contentEl.createEl('select');
    selStyle(selStyle2);
    [
      { value: 'donut', text: 'Donut Chart 🍩' },
      { value: 'bar', text: 'Horizontal Bar Chart 📊' },
      { value: 'kpi', text: 'KPI Cards Grid 🗃️' },
      { value: 'list', text: 'Simple List 📋' }
    ].forEach(opt => selStyle2.createEl('option', { value: opt.value, text: opt.text }));

    // Buttons
    const row = contentEl.createDiv({ attr: { style: 'display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px;' } });
    row.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.close());
    const ok = row.createEl('button', { text: 'Add Chart', cls: 'mod-cta' });
    ok.addEventListener('click', () => {
      this.onSubmit(buildChartSectionConfig({
        targetEntity: selTarget.value,
        linkField: selLink.value,
        groupField: selGroup.value,
        style: selStyle2.value
      }));
      this.close();
    });
  }
}
