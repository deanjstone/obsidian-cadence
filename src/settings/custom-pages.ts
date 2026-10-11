import { Notice } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CORE_ENTITY_KEYS } from '../plugin/settings';
import type { EntityDef, EntityField } from '../types/entities';
import type { CustomPage, SettingTabSettings } from '../types/settings';
import type { SettingTabHost } from './host';

/* ─────────── Custom Navigation Pages ───────────
   The settings section that lists, deletes and adds settings.customPages.
   Adding a page also registers a two-field entity schema for it, in
   settings.customEntities and in the live ENTITIES registry; deleting a
   page drops both, unless the entity is core or another page shows it. */

export interface Option {
  value: string;
  label: string;
}

/* The nav sections a page can be listed under, as the add form offers
   them; the table shows the same labels. */
export const SECTION_OPTIONS: Option[] = [
  { value: 'planner', label: 'Planner' },
  { value: 'projects', label: 'Projects' },
  { value: 'crm', label: 'CRM' },
  { value: 'prm', label: 'PRM' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'reports', label: 'Reports' },
];

/* The add form's layout choices. The table's labels differ in case. */
export const LAYOUT_OPTIONS: Option[] = [
  { value: 'table', label: 'Table view ☰' },
  { value: 'kanban', label: 'Kanban board 🗂' },
  { value: 'cards', label: 'Card grid ⚃' },
];

const LAYOUT_LABELS: Record<string, string> = {
  'table': 'Table View ☰',
  'kanban': 'Kanban Board 🗂',
  'cards': 'Card Grid ⚃',
};

export const ICON_OPTIONS: Option[] = [
  { value: 'file-text', label: '📄 Document (Default)' },
  { value: 'folder-kanban', label: '📁 Folder / Projects' },
  { value: 'users', label: '👥 Users / Contacts' },
  { value: 'building-2', label: '🏢 Building / Companies' },
  { value: 'trending-up', label: '📈 Trending / Sales' },
  { value: 'handshake', label: '🤝 Handshake / Partners' },
  { value: 'target', label: '🎯 Target / Leads' },
  { value: 'zap', label: '⚡ Lightning / Sequences' },
  { value: 'wallet', label: '💼 Wallet / Commissions' },
  { value: 'clipboard-check', label: '📋 Clipboard / Registrations' },
  { value: 'award', label: '🏆 Award / Certifications' },
  { value: 'calendar', label: '📅 Calendar / Activities' },
  { value: 'star', label: '⭐ Star / VIP' },
  { value: 'tag', label: '🏷️ Tag / Categories' },
  { value: 'compass', label: '🧭 Compass / Areas' },
  { value: 'database', label: '🗄️ Database / Items' },
  { value: 'check-square', label: '☑️ Checkbox / Tasks' },
];

const SECTION_LABELS: Record<string, string> = Object.fromEntries(SECTION_OPTIONS.map((o) => [o.value, o.label]));

/* A section's label, or the id itself when it is not one of the six. */
export function sectionLabel(sectionId: string): string {
  return SECTION_LABELS[sectionId] || sectionId;
}

/* The table's layout label; the stored value itself for an unknown layout. */
export function customPageLayoutLabel(layout: string | undefined): string {
  return LAYOUT_LABELS[layout || 'table'] || layout!;
}

export interface CustomPageRow {
  page: CustomPage;
  label: string;
  section: string;
  entity: string;
  layout: string;
}

/* The table's rows: a copy of the pages sorted by label, each with its
   section, entity and layout labels. */
export function customPageRows(customPages: CustomPage[], entities: Record<string, EntityDef>): CustomPageRow[] {
  return customPages.slice().sort((a, b) => a.label.localeCompare(b.label)).map((p) => ({
    page: p,
    label: p.label,
    section: sectionLabel(p.sectionId),
    entity: entities[p.entityKey] ? entities[p.entityKey].label : p.entityKey,
    layout: customPageLayoutLabel(p.defaultLayout),
  }));
}

/* A page label → its singular and the entity key it registers:
   "Products" in CRM → crm_product. Flagged quirk: any trailing s or S is
   dropped, so "Status" → statu. */
export function customPageEntityKey(label: string, sectionId: string): { singular: string; entityKey: string } {
  let singular = label;
  if (singular.endsWith('s') && singular.length > 1) {
    singular = singular.substring(0, singular.length - 1);
  } else if (singular.endsWith('S') && singular.length > 1) {
    singular = singular.substring(0, singular.length - 1);
  }
  return { singular, entityKey: sectionId + '_' + singular.toLowerCase().replace(/\s+/g, '_') };
}

/* The entity's display label: capitalised, unless it is all upper case. */
export function customEntityLabel(singular: string): string {
  return (singular === singular.toUpperCase()) ? singular : (singular.charAt(0).toUpperCase() + singular.slice(1));
}

export interface CustomPageForm {
  label: string;
  sectionId: string;
  layout: string;
  icon: string;
}

/* Adds a page from the form, in place: the schema (an existing one for the
   same key is reused), the ENTITIES entry, the page and its layout
   preference. Refuses a label whose entity another page already shows.
   Returns the notice to show, with the page when it was added.
   `now` is the page id's timestamp. */
export function addCustomPage(
  settings: SettingTabSettings,
  entities: Record<string, EntityDef>,
  form: CustomPageForm,
  now: number,
): { notice: string; page?: CustomPage } {
  const val = (form.label || '').trim();
  if (!val) return { notice: 'Please enter a page label.' };

  const { singular, entityKey } = customPageEntityKey(val, form.sectionId);

  const existing = (settings.customPages || []).find(page => page.entityKey === entityKey);
  if (existing) return { notice: `A page for this entity already exists: "${existing.label}".` };

  if (!settings.customEntities) {
    settings.customEntities = {};
  }

  let newFields: EntityField[];
  if (settings.customEntities[entityKey]) {
    newFields = settings.customEntities[entityKey];
  } else {
    newFields = [
      { key: 'name', label: 'Name', primary: true, type: 'text' },
      { key: 'type', label: 'Type', type: 'text' }
    ];
    settings.customEntities[entityKey] = newFields;
  }

  entities[entityKey] = {
    folder: `Cadence/${val}`,
    label: customEntityLabel(singular),
    plural: val,
    fields: newFields,
    columns: ['name']
  };

  const newPage: CustomPage = {
    id: `custom.${now}`,
    label: val,
    icon: form.icon || 'file-text',
    entityKey: entityKey,
    defaultLayout: form.layout,
    sectionId: form.sectionId
  };

  const pages = settings.customPages || [];
  pages.push(newPage);
  settings.customPages = pages;

  if (!settings.pageLayouts) settings.pageLayouts = {};
  settings.pageLayouts[newPage.id] = newPage.defaultLayout!;

  return { notice: `Page "${val}" added successfully.`, page: newPage };
}

/* Deletes a page by id, in place. Its entity's schema and ENTITIES entry go
   with it, unless the entity is a core one or another page still shows it.
   Returns false when no page has that id. */
export function deleteCustomPage(settings: SettingTabSettings, entities: Record<string, EntityDef>, pageId: string): boolean {
  const originalIndex = settings.customPages!.findIndex(page => page.id === pageId);
  if (originalIndex < 0) return false;
  const entityKey = settings.customPages![originalIndex].entityKey;
  settings.customPages!.splice(originalIndex, 1);
  if (CORE_ENTITY_KEYS.includes(entityKey)) return true;
  if (settings.customPages!.some(page => page.entityKey === entityKey)) return true;
  if (settings.customEntities && settings.customEntities[entityKey]) {
    delete settings.customEntities[entityKey];
  }
  if (entities[entityKey]) {
    delete entities[entityKey];
  }
  return true;
}

export function renderCustomPagesSettings(tab: SettingTabHost, containerEl: HTMLElement): void {
  containerEl.createEl('h3', { text: 'Custom Navigation Pages' });
  containerEl.createEl('p', {
    text: 'Add custom pages to specific sections of your navigation sidebar. You can choose which entity they display and their default layout mode (Table, Kanban, or Card Grid).',
    cls: 'setting-item-description',
  });

  const customPagesDiv = containerEl.createDiv({ cls: 'cad-custom-pages-container' });

  const renderCustomPagesList = () => {
    customPagesDiv.empty();
    const rows = customPageRows(tab.plugin.settings.customPages || [], ENTITIES);

    if (rows.length === 0) {
      customPagesDiv.createEl('p', { text: 'No custom pages added yet.', cls: 'setting-item-description' });
    } else {
      const table = customPagesDiv.createEl('table', { cls: 'cad-prop-table' });
      table.style.width = '100%';
      table.style.marginBottom = '16px';
      const thead = table.createEl('thead');
      const hr = thead.createEl('tr');
      hr.createEl('th', { text: 'Label' });
      hr.createEl('th', { text: 'Section' });
      hr.createEl('th', { text: 'Entity Type' });
      hr.createEl('th', { text: 'Default Layout' });
      hr.createEl('th', { text: 'Actions' });

      const tbody = table.createEl('tbody');
      rows.forEach((row) => {
        const tr = tbody.createEl('tr');
        tr.createEl('td', { text: row.label });
        tr.createEl('td', { text: row.section });
        tr.createEl('td', { text: row.entity });
        tr.createEl('td', { text: row.layout });

        const actionsTd = tr.createEl('td');
        const delBtn = actionsTd.createEl('button', { cls: 'cad-btn', text: 'Delete' });
        delBtn.style.color = 'var(--text-error)';
        delBtn.style.padding = '2px 8px';
        delBtn.style.height = 'auto';
        delBtn.addEventListener('click', async () => {
          if (deleteCustomPage(tab.plugin.settings, ENTITIES, row.page.id)) {
            await tab.plugin.saveSettings();
            tab.plugin.refreshOpenViews();
            tab.display();
          }
        });
      });
    }

    // Render Add Page Form
    const addForm = customPagesDiv.createDiv({ cls: 'cad-custom-page-add-form' });
    addForm.style.border = '1px dashed var(--border-color)';
    addForm.style.borderRadius = '8px';
    addForm.style.padding = '12px';
    addForm.style.marginTop = '16px';
    addForm.style.background = 'var(--background-primary-alt)';

    addForm.createEl('h4', { text: '+ Add Custom Navigation Page', attr: { style: 'margin-top: 0;' } });

    const formRow = addForm.createDiv();
    formRow.style.display = 'flex';
    formRow.style.flexWrap = 'wrap';
    formRow.style.gap = '12px';
    formRow.style.alignItems = 'flex-end';

    const labelStyle = 'display: block; font-size: 0.85em; margin-bottom: 4px; font-weight: 500;';

    // 1. Label Input
    const labelWrap = formRow.createDiv();
    labelWrap.style.flex = '1';
    labelWrap.style.minWidth = '150px';
    labelWrap.createEl('label', { text: 'Label:', attr: { style: labelStyle } });
    const labelInput = labelWrap.createEl('input', { type: 'text', placeholder: 'e.g. VIP Contacts' });
    labelInput.style.width = '100%';
    labelInput.style.padding = '4px 8px';

    // 2. Section, 3. Default Layout and 3.5 Icon selectors
    const selectField = (label: string, options: Option[]) => {
      const wrap = formRow.createDiv();
      wrap.style.minWidth = '120px';
      wrap.createEl('label', { text: label, attr: { style: labelStyle } });
      const select = wrap.createEl('select');
      select.style.width = '100%';
      options.forEach(opt => {
        select.createEl('option', { value: opt.value, text: opt.label });
      });
      return select;
    };
    const sectionSelect = selectField('Sidebar Section:', SECTION_OPTIONS);
    const layoutSelect = selectField('Default Layout:', LAYOUT_OPTIONS);
    const iconSelect = selectField('Icon:', ICON_OPTIONS);

    // 4. Add Button
    const btnWrap = formRow.createDiv();
    const addBtn = btnWrap.createEl('button', { cls: 'cad-btn primary', text: 'Add Page' });
    addBtn.style.padding = '6px 12px';
    addBtn.style.height = 'auto';

    addBtn.addEventListener('click', async () => {
      const result = addCustomPage(tab.plugin.settings, ENTITIES, {
        label: labelInput.value,
        sectionId: sectionSelect.value,
        layout: layoutSelect.value,
        icon: iconSelect.value,
      }, Date.now());
      if (!result.page) {
        new Notice(result.notice);
        return;
      }

      await tab.plugin.saveSettings();
      tab.plugin.refreshOpenViews();
      new Notice(result.notice);
      tab.display();
    });
  };

  renderCustomPagesList();
}
