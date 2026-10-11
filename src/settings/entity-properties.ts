import { Notice, Setting, SuggestModal, type App, type TFile, type TFolder } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import type { EntityDef, EntityField, Frontmatter } from '../types/entities';
import type { CustomPage, SettingTabSettings } from '../types/settings';
import { getFieldSuggestionSource, migrateFrontmatterKey, migrateFrontmatterType } from '../utils/entities';
import { sectionLabel, type Option } from './custom-pages';
import type { SettingTabHost } from './host';

/* ─────────── Custom Entity Properties ───────────
   The settings section that edits each entity's field schema. Edits go
   straight into the live ENTITIES registry; every save then copies all of
   ENTITIES into settings.customEntities (snapshotCustomEntities). An edit is
   `applyPropertyEdit(entities, entityKey, edit)`, which changes the registry
   in place and returns the frontmatter migrations to run, so the migrations
   themselves stay in src/utils/entities.ts. */

export const CORE_ENTITY_KEYS = ['contact', 'company', 'partner', 'registration', 'commission', 'lead', 'certification', 'activity', 'sequence', 'project', 'deal'];

/* The nav section each core entity's picker label is prefixed with. */
export const CORE_ENTITY_SECTIONS: Record<string, string> = {
  project: 'Projects',
  deal: 'CRM',
  contact: 'CRM',
  company: 'CRM',
  activity: 'CRM',
  partner: 'PRM',
  registration: 'PRM',
  commission: 'PRM',
  lead: 'PRM',
  certification: 'PRM',
  sequence: 'Workflow'
};

/* "Section/Label": the core section, else the section of a custom page
   showing the entity, else the bare label. */
export function entityPickerLabel(key: string, ent: EntityDef, customPages: CustomPage[]): string {
  let label = CORE_ENTITY_SECTIONS[key];
  if (!label) {
    const customPage = customPages.find(p => p.entityKey === key);
    if (customPage) label = sectionLabel(customPage.sectionId);
  }
  if (!label) return ent.label;
  const capSection = label.charAt(0).toUpperCase() + label.slice(1);
  return `${capSection}/${ent.label}`;
}

/* The entity picker's options, sorted by label. */
export function entityPickerOptions(entities: Record<string, EntityDef>, customPages: CustomPage[]): Option[] {
  return Object.entries(entities)
    .map(([key, ent]) => ({ value: key, label: entityPickerLabel(key, ent, customPages) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/* Primary fields, the project's status and priority, and the deal's stage
   can never be unlocked. */
export function isPermanentlyLocked(entityKey: string, field: EntityField): boolean {
  if (field.primary) return true;
  const k = field.key;
  if (entityKey === 'project' && (k === 'status' || k === 'priority')) return true;
  if (entityKey === 'deal' && k === 'stage') return true;
  return false;
}

/* Whether a field is locked: its `locked` flag, else true for `type` and
   for every core entity's field, false for a custom entity's. Reading the
   default writes nothing into the registry. */
export function isFieldLocked(entityKey: string, field: EntityField): boolean {
  if (isPermanentlyLocked(entityKey, field)) return true;
  if (field.locked !== undefined) return !!field.locked;
  return field.key === 'type' || CORE_ENTITY_KEYS.includes(entityKey);
}

/* Copy every entity's fields into settings.customEntities (deep copies). */
export function snapshotCustomEntities(settings: SettingTabSettings, entities: Record<string, EntityDef>): void {
  if (!settings.customEntities) {
    settings.customEntities = {};
  }
  for (const [ek, ent] of Object.entries(entities)) {
    settings.customEntities[ek] = JSON.parse(JSON.stringify(ent.fields));
  }
}

/* The key input's suggestions: every entity's field keys, then the keys of
   the given notes' frontmatter (except Obsidian's `position`), in first-seen
   order. The tab passes up to 200 notes. */
export function fieldKeySuggestions(entities: Record<string, EntityDef>, frontmatters: Frontmatter[]): Set<string> {
  const keys = new Set<string>();
  for (const ent of Object.values(entities)) {
    ent.fields.forEach(f => keys.add(f.key));
  }
  for (const fm of frontmatters) {
    Object.keys(fm).forEach(k => {
      if (k !== 'position') keys.add(k);
    });
  }
  return keys;
}

/* The suggestions containing what has been typed (trimmed, any case), sorted. */
export function filterKeySuggestions(keys: Iterable<string>, typed: string): string[] {
  const q = typed.trim().toLowerCase();
  return [...keys].filter(k => !q || k.toLowerCase().includes(q)).sort();
}

/* A typed key, lower-cased and stripped to a-z, 0-9 and _. */
export function sanitizeFieldKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

/* The comma list typed into an enum's options input. */
export function parseEnumOptions(raw: string): string[] {
  return raw.split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export const FIELD_TYPE_OPTIONS: Option[] = [
  { value: 'text', label: 'Text' },
  { value: 'multitext', label: 'List / Multiple Links' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'tags', label: 'Tags' },
  { value: 'enum', label: 'Select (Enum)' }
];

/* A `type` field can only be Text or Select. */
const TYPE_FIELD_TYPE_OPTIONS: Option[] = [
  { value: 'text', label: 'Text' },
  { value: 'enum', label: 'Select (Enum)' }
];

/* The type select's options; the field's type is selected, Text when it
   has none. A type that is not offered (email) selects nothing. */
export function fieldTypeOptions(field: EntityField): Array<Option & { selected: boolean }> {
  const types = field.key === 'type' ? TYPE_FIELD_TYPE_OPTIONS : FIELD_TYPE_OPTIONS;
  return types.map(t => ({ ...t, selected: field.type === t.value || (!field.type && t.value === 'text') }));
}

/* What the Options / Source cell holds: nothing for primary, date and
   currency fields, a comma list for enums, a source picker for lists and
   tags, and nothing for the rest. */
export function optionsCellKind(field: EntityField): 'none' | 'enum' | 'source' {
  if (field.primary || field.type === 'date' || field.type === 'currency') return 'none';
  if (field.type === 'enum') return 'enum';
  if (field.type === 'multitext' || field.type === 'tags') return 'source';
  return 'none';
}

export const SOURCE_OPTIONS: Option[] = [
  { value: 'history', label: 'History / Shared' },
  { value: 'tags', label: 'Obsidian Tags' },
  { value: 'none', label: 'None' },
  { value: 'folder', label: 'Folder…' },
];

/* The field's source, else the derived one, when it is not a folder and
   not one of SOURCE_OPTIONS (owner → contact, entity:deal); else null. */
function otherSource(field: EntityField): string | null {
  const activeSource = field.suggestionSource || getFieldSuggestionSource(field);
  if (!activeSource || activeSource.startsWith('folder:')) return null;
  return SOURCE_OPTIONS.some(s => s.value === activeSource) ? null : activeSource;
}

/* The source picker's options: SOURCE_OPTIONS, led by the field's own
   source when it is not one of them, labelled by its entity ("Contact
   notes"), so the select can show it. */
export function sourceOptions(field: EntityField): Option[] {
  const other = otherSource(field);
  if (!other) return SOURCE_OPTIONS;
  const name = other.startsWith('entity:') ? other.slice('entity:'.length) : other;
  return [{ value: other, label: `${name.charAt(0).toUpperCase()}${name.slice(1)} notes` }, ...SOURCE_OPTIONS];
}

/* The source picker's state: the field's source (else the derived one),
   whether it is a `folder:<path>`, that path, and which option is
   selected: a source that is not in SOURCE_OPTIONS selects its own
   option (sourceOptions). */
export function sourceState(field: EntityField): { selected: string | null; isCustomFolder: boolean; folderPath: string } {
  const activeSource = field.suggestionSource || getFieldSuggestionSource(field);
  const isCustomFolder = !!(activeSource && activeSource.startsWith('folder:'));
  let selected: string | null = otherSource(field);
  SOURCE_OPTIONS.forEach(s => {
    if (!isCustomFolder && s.value === activeSource) selected = s.value;
    else if (isCustomFolder && s.value === 'folder') selected = s.value;
  });
  return { selected, isCustomFolder, folderPath: isCustomFolder ? activeSource.slice('folder:'.length) : '' };
}

/* The source a folder path saves as: `folder:<path>`, or none without one. */
export function folderSource(path: string): string {
  return path ? `folder:${path}` : 'none';
}

/* The folder badge's text and colour. */
export function folderBadge(path: string): { text: string; color: string } {
  return { text: path || 'Aucun dossier', color: path ? 'var(--text-normal)' : 'var(--text-faint)' };
}

/* The folder picker's list, sorted: the vault's folders when it lists any
   (as paths or folder objects; empty paths dropped), else every folder
   that holds a note, read from `markdownFiles` only then. */
export function vaultFolderPaths(allFolders: Array<TFolder | string> | null | undefined, markdownFiles: () => TFile[]): string[] {
  const folderSet = new Set<string>();
  if (!allFolders || !allFolders.length) {
    markdownFiles().forEach(f => {
      const parts = f.path.split('/');
      for (let i = 1; i < parts.length; i++) {
        folderSet.add(parts.slice(0, i).join('/'));
      }
    });
  } else {
    allFolders.forEach(f => {
      const p = typeof f === 'string' ? f : (f.path || '');
      if (p) folderSet.add(p);
    });
  }
  return Array.from(folderSet).sort();
}

/* Folders containing the query, any case; all of them for an empty query. */
export function filterFolders(folders: string[], query: string): string[] {
  const ql = query.toLowerCase();
  return ql ? folders.filter(f => f.toLowerCase().includes(ql)) : folders;
}

/* The next free `new_property_N` key. */
export function nextPropertyKey(fields: EntityField[]): string {
  let counter = 1;
  let newKey = `new_property_${counter}`;
  while (fields.some(f => f.key === newKey)) {
    counter++;
    newKey = `new_property_${counter}`;
  }
  return newKey;
}

/* `fields` with the field at `from` moved to `to`, as a new array, or null
   when a locked field would change position. */
export function moveField(fields: EntityField[], from: number, to: number, isLocked: (field: EntityField) => boolean): EntityField[] | null {
  const candidateFields = [...fields];
  const [draggedItem] = candidateFields.splice(from, 1);
  candidateFields.splice(to, 0, draggedItem);
  for (let i = 0; i < fields.length; i++) {
    if (isLocked(fields[i])) {
      if (!candidateFields[i] || candidateFields[i].key !== fields[i].key) return null;
    }
  }
  return candidateFields;
}

export type FrontmatterMigration =
  | { kind: 'key'; entityKey: string; oldKey: string; newKey: string }
  | { kind: 'type'; entityKey: string; fieldKey: string; oldType: string; newType: string };

/* One edit in the property table. `field` is the row's field object;
   `index` is its position in the entity's fields. */
export type PropertyEdit =
  | { kind: 'label'; field: EntityField; value: string }
  | { kind: 'key'; field: EntityField; index: number; value: string }
  | { kind: 'type'; field: EntityField; value: string }
  | { kind: 'options'; field: EntityField; value: string }
  | { kind: 'source'; field: EntityField; value: string }
  | { kind: 'lock'; field: EntityField; locked: boolean }
  | { kind: 'remove'; index: number }
  | { kind: 'add' }
  | { kind: 'move'; from: number; to: number };

export type PropertyEditResult =
  | { ok: false; notice: string }
  | { ok: true; migrations: FrontmatterMigration[]; notice?: string; rerender: boolean };

export type AppliedPropertyEdit = Extract<PropertyEditResult, { ok: true }>;

/* Applies one edit to the registry, in place, and returns the frontmatter
   migrations to run (in order), a notice to show after them, and whether
   the table is redrawn. A refused edit changes nothing and returns its
   notice. An edit changes only the field it is made on: same-key fields
   on other entities are independent (#47). */
export function applyPropertyEdit(entities: Record<string, EntityDef>, entityKey: string, edit: PropertyEdit): PropertyEditResult {
  const def = entities[entityKey];
  const migrations: FrontmatterMigration[] = [];
  switch (edit.kind) {
    case 'label': {
      edit.field.label = edit.value.trim() || edit.field.key;
      return { ok: true, migrations, rerender: false };
    }
    case 'options': {
      edit.field.options = parseEnumOptions(edit.value);
      return { ok: true, migrations, rerender: false };
    }
    case 'source': {
      edit.field.suggestionSource = edit.value;
      return { ok: true, migrations, rerender: false };
    }
    case 'lock': {
      edit.field.locked = edit.locked;
      return { ok: true, migrations, rerender: true };
    }
    case 'key': {
      const { field } = edit;
      const sanitized = sanitizeFieldKey(edit.value);
      if (!sanitized) return { ok: false, notice: 'Technical key cannot be empty and must be alphanumeric.' };
      if (def.fields.some((f, idx) => idx !== edit.index && f.key === sanitized)) {
        return { ok: false, notice: 'This technical key is already in use.' };
      }

      const oldKey = field.key;
      if (sanitized === oldKey) return { ok: true, migrations, rerender: true };
      migrations.push({ kind: 'key', entityKey, oldKey, newKey: sanitized });
      field.key = sanitized;
      return { ok: true, migrations, rerender: true };
    }
    case 'type': {
      const { field } = edit;
      const oldType = field.type || 'text';
      const newType = edit.value;
      migrations.push({ kind: 'type', entityKey, fieldKey: field.key, oldType, newType });
      field.type = newType;
      return { ok: true, migrations, rerender: true };
    }
    case 'remove': {
      def.fields.splice(edit.index, 1);
      return { ok: true, migrations, rerender: true };
    }
    case 'add': {
      def.fields.push({
        key: nextPropertyKey(def.fields),
        label: 'New Property',
        type: 'text'
      });
      return { ok: true, migrations, rerender: true };
    }
    case 'move': {
      const candidateFields = moveField(def.fields, edit.from, edit.to, (f) => isFieldLocked(entityKey, f));
      if (!candidateFields) {
        return { ok: false, notice: 'Impossible de réordonner : les propriétés verrouillées (🔒) doivent conserver leur position initiale.' };
      }
      def.fields = candidateFields;
      return { ok: true, migrations, rerender: true };
    }
  }
}

/* The source picker's folder search, over a fixed folder list. */
export class FolderSuggestModal extends SuggestModal<string> {
  folders: string[];
  onChoose: (folder: string) => void;

  constructor(app: App, folders: string[], onChoose: (folder: string) => void) {
    super(app);
    this.folders = folders;
    this.onChoose = onChoose;
    this.setPlaceholder('Rechercher un dossier du vault…');
  }

  getSuggestions(q: string): string[] {
    return filterFolders(this.folders, q);
  }

  renderSuggestion(folder: string, el: HTMLElement): void {
    el.createEl('span', { text: '📁 ' });
    el.createEl('span', { text: folder });
  }

  onChooseSuggestion(folder: string): void {
    this.onChoose(folder);
  }
}

export function renderEntityPropertiesSettings(tab: SettingTabHost, containerEl: HTMLElement): void {
  containerEl.createEl('h3', { text: 'Custom Entity Properties' });
  containerEl.createEl('p', {
    text: 'Customize the properties for each core entity (Projects, Pipelines/Deals, Contacts, Companies, and Activities). Critical system properties required for the calendar, Kanban, and dashboard features are locked against deletion or type changes, but their display labels can still be customized.',
    cls: 'setting-item-description',
  });

  let selectedEntityKey = 'project';
  new Setting(containerEl)
    .setName('Select entity')
    .setDesc('Choose which entity to customize.')
    .addDropdown((d) => {
      entityPickerOptions(ENTITIES, tab.plugin.settings.customPages || []).forEach(({ value, label }) => {
        d.addOption(value, label);
      });
      d.setValue(selectedEntityKey);
      d.onChange((v) => {
        selectedEntityKey = v;
        renderPropEditor();
      });
    });

  const propEditorDiv = containerEl.createDiv({ cls: 'cad-prop-editor-container' });

  const renderPropEditor = () => {
    propEditorDiv.empty();
    const def = ENTITIES[selectedEntityKey];
    if (!def) return;

    propEditorDiv.createEl('h4', { text: `Properties for: ${def.label}` });

    const table = propEditorDiv.createEl('table', { cls: 'cad-prop-table' });
    const thead = table.createEl('thead');
    const headerRow = thead.createEl('tr');
    headerRow.createEl('th', { text: '', cls: 'cad-prop-drag-header' });
    headerRow.createEl('th', { text: 'Label (Display name)' });
    headerRow.createEl('th', { text: 'Technical Key (Frontmatter)' });
    headerRow.createEl('th', { text: 'Type' });
    headerRow.createEl('th', { text: 'Options / Source' });
    headerRow.createEl('th', { text: '' });

    const tbody = table.createEl('tbody');

    const saveAndSync = async () => {
      snapshotCustomEntities(tab.plugin.settings, ENTITIES);
      await tab.plugin.saveSettings();
      tab.plugin.registerCustomPropertyTypes();
      tab.plugin.refreshOpenViews();
    };

    /* Run an applied edit's migrations in order, show its notice, save,
       and redraw the table if the edit asks. */
    const commit = async (result: AppliedPropertyEdit) => {
      for (const m of result.migrations) {
        if (m.kind === 'key') await migrateFrontmatterKey(tab.app, m.entityKey, m.oldKey, m.newKey);
        else await migrateFrontmatterType(tab.app, m.entityKey, m.fieldKey, m.oldType, m.newType);
      }
      if (result.notice) new Notice(result.notice);
      await saveAndSync();
      if (result.rerender) renderPropEditor();
    };

    const edit = (change: PropertyEdit) => applyPropertyEdit(ENTITIES, selectedEntityKey, change) as AppliedPropertyEdit;

    let draggedIndex: number | null = null;

    def.fields.forEach((field, index) => {
      const tr = tbody.createEl('tr');
      tr.addClass('cad-prop-row');
      const permLocked = isPermanentlyLocked(selectedEntityKey, field);
      const locked = isFieldLocked(selectedEntityKey, field);

      // Prepend drag cell / lock cell
      const tdDrag = tr.createEl('td', { cls: 'cad-prop-drag-cell' });

      if (permLocked) {
        tdDrag.createEl('span', { text: '🔒', cls: 'cad-prop-lock-icon' });
        tr.addClass('cad-prop-row-locked');
      } else if (locked) {
        const lockSpan = tdDrag.createEl('span', { text: '🔐', cls: 'cad-prop-lock-icon' });
        lockSpan.style.cursor = 'pointer';
        lockSpan.title = 'Click to unlock this property';
        lockSpan.addEventListener('click', async (e) => {
          e.stopPropagation();
          await commit(edit({ kind: 'lock', field, locked: false }));
        });
        tr.addClass('cad-prop-row-locked');
      } else {
        tdDrag.createEl('span', { text: '⋮⋮', cls: 'cad-prop-drag-handle' });
        const unlockSpan = tdDrag.createEl('span', { text: '🔓', cls: 'cad-prop-unlock-icon' });
        unlockSpan.style.cursor = 'pointer';
        unlockSpan.style.marginLeft = '6px';
        unlockSpan.title = 'Click to lock this property';
        unlockSpan.addEventListener('click', async (e) => {
          e.stopPropagation();
          await commit(edit({ kind: 'lock', field, locked: true }));
        });
        tr.setAttribute('draggable', 'true');
        tr.addClass('cad-prop-row-draggable');

        tr.addEventListener('dragstart', (e) => {
          draggedIndex = index;
          tr.addClass('cad-drag-active');
          e.dataTransfer!.setData('text/plain', index.toString());
          e.dataTransfer!.effectAllowed = 'move';
        });

        tr.addEventListener('dragend', () => {
          tbody.querySelectorAll('.cad-prop-row').forEach(r => {
            r.removeClass('cad-drag-active');
            r.removeClass('cad-drag-hover');
          });
          draggedIndex = null;
        });
      }

      tr.addEventListener('dragover', (e) => {
        if (draggedIndex !== null && draggedIndex !== index) {
          e.preventDefault();
          tr.addClass('cad-drag-hover');
        }
      });

      tr.addEventListener('dragleave', () => {
        tr.removeClass('cad-drag-hover');
      });

      tr.addEventListener('drop', async (e) => {
        tr.removeClass('cad-drag-hover');
        if (draggedIndex === null || draggedIndex === index) return;
        e.preventDefault();

        const result = applyPropertyEdit(ENTITIES, selectedEntityKey, { kind: 'move', from: draggedIndex, to: index });
        if (!result.ok) {
          new Notice(result.notice);
          return;
        }
        await commit(result);
      });

      // 1. Label Input
      const tdLabel = tr.createEl('td');
      const inputLabel = tdLabel.createEl('input', {
        type: 'text',
        value: field.label || '',
        cls: 'cad-prop-input'
      });
      inputLabel.addEventListener('change', async () => {
        await commit(edit({ kind: 'label', field, value: inputLabel.value }));
      });

      // 2. Tech Key Input with autocomplete suggestions
      const tdKey = tr.createEl('td');
      const keyWrap = tdKey.createDiv({ cls: 'cad-key-wrap' });

      // Build a unique datalist id
      const datalistId = `cad-key-dl-${selectedEntityKey}-${index}`;
      const datalist = keyWrap.createEl('datalist');
      datalist.id = datalistId;

      // Keys from all known entity fields, then from actual vault frontmatter (sample up to 200 files for perf)
      const frontmatters: Frontmatter[] = [];
      try {
        const vaultFiles = tab.app.vault.getMarkdownFiles().slice(0, 200);
        for (const vf of vaultFiles) {
          const cache = tab.app.metadataCache.getFileCache(vf);
          if (cache && cache.frontmatter) frontmatters.push(cache.frontmatter);
        }
      } catch (_) { }
      const _allSuggestionKeys = fieldKeySuggestions(ENTITIES, frontmatters);
      _allSuggestionKeys.forEach(k => datalist.createEl('option', { value: k }));

      const inputKey = keyWrap.createEl('input', {
        type: 'text',
        value: field.key || '',
        cls: 'cad-prop-input'
      });
      inputKey.setAttribute('list', datalistId);
      inputKey.setAttribute('autocomplete', 'off');

      if (locked || field.key === 'type') {
        inputKey.disabled = true;
      } else {
        inputKey.disabled = false;
        inputKey.addEventListener('input', () => {
          // Show suggestions as user types — filter datalist in real time
          datalist.empty();
          filterKeySuggestions(_allSuggestionKeys, inputKey.value)
            .forEach(k => datalist.createEl('option', { value: k }));
        });
        inputKey.addEventListener('change', async () => {
          const result = applyPropertyEdit(ENTITIES, selectedEntityKey, { kind: 'key', field, index, value: inputKey.value });
          if (!result.ok) {
            new Notice(result.notice);
            inputKey.value = field.key;
            return;
          }
          await commit(result);
        });
      }

      // 3. Type select dropdown
      const tdType = tr.createEl('td');
      const selectType = tdType.createEl('select', { cls: 'cad-prop-input' });
      fieldTypeOptions(field).forEach(t => {
        const opt = selectType.createEl('option', { value: t.value, text: t.label });
        if (t.selected) {
          opt.selected = true;
        }
      });
      if (locked) {
        selectType.disabled = true;
      } else {
        selectType.disabled = false;
        selectType.addEventListener('change', async () => {
          await commit(edit({ kind: 'type', field, value: selectType.value }));
        });
      }

      // 4. Options input (only for enum) OR suggestion database dropdown (for multitext/tags)
      // Primary fields (name/title/subject) and date/currency types have no options → greyed out
      const tdOptions = tr.createEl('td');
      const optionsKind = optionsCellKind(field);

      if (optionsKind === 'enum') {
        const inputOptions = tdOptions.createEl('input', {
          type: 'text',
          value: field.options ? field.options.join(', ') : '',
          placeholder: 'Option A, Option B...',
          cls: 'cad-prop-input'
        });
        inputOptions.addEventListener('change', async () => {
          await commit(edit({ kind: 'options', field, value: inputOptions.value }));
        });
      } else if (optionsKind === 'source') {
        // Source selector: static options + folder picker
        const sourceWrap = tdOptions.createDiv({ cls: 'cad-source-wrap' });
        const selectSource = sourceWrap.createEl('select', { cls: 'cad-prop-input' });
        const { selected, isCustomFolder, folderPath: currentFolderPath } = sourceState(field);

        sourceOptions(field).forEach(s => {
          const opt = selectSource.createEl('option', { value: s.value, text: s.label });
          if (s.value === selected) opt.selected = true;
        });

        // Custom folder picker (shown when 'folder' is chosen or a custom folder is active)
        const folderPickerWrap = sourceWrap.createDiv({ cls: 'cad-folder-picker-wrap' });
        folderPickerWrap.style.marginTop = '4px';
        folderPickerWrap.style.display = (selectSource.value === 'folder' || isCustomFolder) ? 'flex' : 'none';
        folderPickerWrap.style.alignItems = 'center';
        folderPickerWrap.style.gap = '6px';

        // Current folder badge
        const folderBadgeEl = folderPickerWrap.createEl('span', { cls: 'cad-folder-badge' });
        const badge = folderBadge(currentFolderPath);
        folderBadgeEl.setText(badge.text);
        folderBadgeEl.style.flex = '1';
        folderBadgeEl.style.fontSize = '12px';
        folderBadgeEl.style.color = badge.color;
        folderBadgeEl.style.fontFamily = 'var(--font-monospace)';
        folderBadgeEl.style.overflow = 'hidden';
        folderBadgeEl.style.textOverflow = 'ellipsis';
        folderBadgeEl.style.whiteSpace = 'nowrap';

        // Track current selected folder path
        let _folderPath = currentFolderPath;

        const pickFolderBtn = folderPickerWrap.createEl('button', {
          cls: 'cad-btn cad-btn-sm cad-folder-pick-btn',
          text: '📂 Choisir',
        });
        pickFolderBtn.type = 'button';
        pickFolderBtn.style.flexShrink = '0';
        pickFolderBtn.style.whiteSpace = 'nowrap';

        const saveFolderSource = async (path: string) => {
          _folderPath = path;
          const chosen = folderBadge(path);
          folderBadgeEl.setText(chosen.text);
          folderBadgeEl.style.color = chosen.color;
          await commit(edit({ kind: 'source', field, value: folderSource(path) }));
        };

        const saveSugSource = async () => {
          const v = selectSource.value;
          await commit(edit({ kind: 'source', field, value: v === 'folder' ? folderSource(_folderPath) : v }));
        };

        pickFolderBtn.addEventListener('click', () => {
          const vault = tab.app.vault;
          const folders = vaultFolderPaths(vault.getAllFolders ? vault.getAllFolders() : [], () => vault.getMarkdownFiles());
          new FolderSuggestModal(tab.app, folders, (folder) => {
            saveFolderSource(folder);
          }).open();
        });

        selectSource.addEventListener('change', async () => {
          const show = selectSource.value === 'folder';
          folderPickerWrap.style.display = show ? 'flex' : 'none';
          if (!show) {
            _folderPath = '';
            folderBadgeEl.setText(folderBadge('').text);
            await saveSugSource();
          }
        });
      } else {
        const disabledInput = tdOptions.createEl('input', {
          type: 'text',
          cls: 'cad-prop-input',
        });
        disabledInput.disabled = true;
        disabledInput.placeholder = '—';
      }

      // 5. Delete button
      const tdDelete = tr.createEl('td');
      const btnDelete = tdDelete.createEl('button', {
        text: '×',
        cls: 'cad-prop-btn-delete'
      });
      if (locked || field.key === 'type') {
        btnDelete.disabled = true;
      } else {
        btnDelete.disabled = false;
        btnDelete.addEventListener('click', async () => {
          await commit(edit({ kind: 'remove', index }));
        });
      }
    });

    // + Add property button
    const btnAdd = propEditorDiv.createEl('button', {
      text: '+ Add property',
      cls: 'cad-prop-btn-add'
    });
    btnAdd.addEventListener('click', async () => {
      await commit(edit({ kind: 'add' }));
    });
  };

  renderPropEditor();
}
