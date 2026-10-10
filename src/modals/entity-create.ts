import { Modal, type App } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { getFieldSuggestionSource, listEntities } from '../utils/entities';
import type { EntityDef, EntityField, EntityKey } from '../types/entities';
import type { EntityCreateResult } from '../types/modals';

export interface EntityCreateOptions {
  /** Called with the new entity, or null when closed without submitting.
      Typed optional: without it, closing is quiet but submitting throws. */
  onSubmit?: (result: EntityCreateResult | null) => void;
  /** Field key → pre-filled value (stringified into the input). */
  defaults?: Record<string, unknown>;
}

/* MetadataCache.getTags(), as Obsidian ships it. */
interface TagSource {
  getTags(): Record<string, number> | null;
}

/* A vault folder or file, as the folder:<path> suggestion walk reads it. */
interface FolderNode {
  path?: string;
  basename?: string;
  children?: FolderNode[];
}

/** One form input, as read back on submit. */
export interface EntityCreateInput {
  key: string;
  /** The field type the input was built for; undefined reads as text. */
  type?: string;
  value: string;
}

const PLACEHOLDER_EXAMPLES: Record<string, string> = {
  contact: 'e.g. Jane Smith',
  company: 'e.g. Acme Corp',
  partner: 'e.g. Acme Distribution',
  deal: 'e.g. Acme — FTTH expansion',
  registration: 'e.g. Vodacom 12-site FTTB',
  commission: 'e.g. C-2026-Q2-0042',
  lead: 'e.g. Sarah from Vodacom',
  certification: 'e.g. Cisco CCNP — May 2026',
  activity: 'e.g. Discovery call with Jane',
  sequence: 'e.g. Outbound — SMB',
  project: 'e.g. Q3 Cadence launch',
};

/** The primary field's example placeholder; '' for any other field or an
    entity without an example. */
export function placeholderFor(entityKey: EntityKey, isPrimary: boolean): string {
  if (!isPrimary) return '';
  return PLACEHOLDER_EXAMPLES[entityKey] || '';
}

/** The enum option pre-selected for a new entity, or undefined to leave
    the blank option. Only stage, status, priority, tier and type get one;
    stage stays blank without a 'Lead' option. */
export function defaultEnumValue(f: EntityField): string | undefined {
  if (['stage', 'status', 'priority', 'tier', 'type'].includes(f.key) && f.options && f.options.length) {
    const sensible = f.key === 'stage' ? 'Lead'
      : f.key === 'status' ? (f.options.find((o) => /active|new|draft|submitted|pending/i.test(o)) || f.options[0])
        : f.key === 'priority' ? (f.options.find((o) => /medium/i.test(o)) || f.options[0])
          : f.options[0];
    if (f.options.includes(sensible)) return sensible;
  }
  return undefined;
}

/** The onSubmit payload, or null while the first input is blank. Entity
    references become `[[wiki-link]]` lists; tags, multitext, isList and the
    domain/industry/role/tags keys become plain lists; numbers and currency
    are parsed (unparseable ones dropped); everything else stays a string.
    Empty values and empty lists are left out. The primary value is trimmed
    for `name` but kept as typed in `values` (flagged, not fixed). */
export function buildEntityCreateValues(def: EntityDef, inputs: EntityCreateInput[]): EntityCreateResult | null {
  const values: Record<string, unknown> = {};
  let primaryValue = null as string | null;
  inputs.forEach((input, idx) => {
    const { key, type } = input;
    let raw: string | string[] | number | null = input.value;
    if (idx === 0) primaryValue = (raw || '').trim();
    if (raw === '' || raw == null) return;

    const f = def.fields.find(fd => fd.key === key);
    const suggestionSource = getFieldSuggestionSource(f);
    const isWikilink = suggestionSource !== 'none' && suggestionSource !== 'tags' && suggestionSource !== 'history';
    const isEntityRef = ['owner', 'assigned', 'company', 'contact', 'contacts', 'partner', 'with', 'related'].includes(key) || isWikilink;
    const isListField = type === 'tags' || type === 'multitext' || (f && f.isList) || ['domain', 'industry', 'role', 'tags'].includes(key) || isEntityRef;

    if (isListField) {
      const parts = raw.split(',').map((t) => t.trim()).filter(Boolean);
      if (isEntityRef) {
        raw = parts.map(p => `[[${p.replace(/^\[\[|\]\]$/g, '')}]]`);
      } else {
        raw = parts;
      }
    } else if (isEntityRef) {
      // Unreachable: every entity reference is also a list field.
      raw = `[[${raw.replace(/^\[\[|\]\]$/g, '').trim()}]]`;
    } else if (type === 'number' || type === 'currency') {
      const n = Number(raw);
      raw = isNaN(n) ? null : n;
    }
    if (raw == null) return;
    if (Array.isArray(raw) && raw.length === 0) return;
    values[key] = raw;
  });
  if (!primaryValue) return null;
  return { name: primaryValue, values };
}

/** Typeahead suggestions for a text field: names or values containing the
    text after the last comma, minus names already typed. Reads vault tags,
    the same key across markdown notes (history), a folder:<path> walk, or
    an entity's notes. An entity:<key> source is not an ENTITIES key, so it
    falls back to the field-key rule (flagged, not fixed). */
export function entityCreateSuggestions(app: App, f: EntityField, suggestionSource: string, fullVal: string): string[] {
  const lastCommaIdx = fullVal.lastIndexOf(',');
  const query = (lastCommaIdx === -1 ? fullVal : fullVal.slice(lastCommaIdx + 1)).trim().toLowerCase();
  if (!query) return [];

  const isEntitySrc = ENTITIES[suggestionSource] != null;
  const isFolderSrc = suggestionSource && suggestionSource.startsWith('folder:');
  const customFolderPath = isFolderSrc ? suggestionSource.slice('folder:'.length) : null;
  const typedNames = fullVal.split(',').map(s => s.trim().replace(/^\[\[|\]\]$/g, '').toLowerCase()).filter(Boolean);

  let filtered: string[] = [];
  if (suggestionSource === 'tags') {
    // getTags() is not in the public obsidian.d.ts.
    const suggestions = Object.keys((app.metadataCache as unknown as TagSource).getTags() || {}).map(t => t.replace(/^#/, ''));
    filtered = suggestions.filter((v) =>
      v.toLowerCase().includes(query) &&
      !typedNames.includes(v.toLowerCase())
    );
  } else if (suggestionSource === 'history') {
    const allFiles = app.vault.getMarkdownFiles();
    const allValues = new Set<string>();
    allFiles.forEach(file => {
      const cache = app.metadataCache.getFileCache(file);
      const fm: Record<string, unknown> = cache && cache.frontmatter || {};
      const val = fm[f.key];
      if (Array.isArray(val)) {
        val.forEach(v => { if (v) allValues.add(String(v).replace(/^\[\[|\]\]$/g, '').trim()); });
      } else if (val != null && val !== '') {
        allValues.add(String(val).replace(/^\[\[|\]\]$/g, '').trim());
      }
    });
    filtered = Array.from(allValues).filter((v) =>
      v.toLowerCase().includes(query) &&
      !typedNames.includes(v.toLowerCase())
    );
  } else if (suggestionSource !== 'none') {
    if (customFolderPath) {
      const folderNode = app.vault.getAbstractFileByPath(customFolderPath) as FolderNode | null;
      const names: string[] = [];
      if (folderNode && folderNode.children) {
        const walk = (node: FolderNode) => {
          for (const child of node.children!) {
            if (child.children) walk(child);
            else if (child.path && child.path.endsWith('.md')) names.push(child.basename!);
          }
        };
        walk(folderNode);
      }
      filtered = names.filter(n =>
        n.toLowerCase().includes(query) && !typedNames.includes(n.toLowerCase())
      );
    } else {
      const targetKey = isEntitySrc ? suggestionSource : (f.key === 'company' ? 'company' : (f.key === 'partner' ? 'partner' : (f.key === 'related' ? 'project' : 'contact')));
      const entitiesList = listEntities(app, targetKey);
      filtered = entitiesList.filter((c) =>
        c.basename.toLowerCase().includes(query) &&
        !typedNames.includes(c.basename.toLowerCase())
      ).map(c => c.basename);
    }
  }
  return filtered;
}

/* ─────────── Entity create modal (rich, all fields up-front) ─────────── */
export class CadenceEntityCreateModal extends Modal {
  declare entityKey: EntityKey;
  declare def: EntityDef;
  declare onSubmit?: (result: EntityCreateResult | null) => void;
  declare defaults: Record<string, unknown>;
  declare _submitted: boolean;

  constructor(app: App, entityKey: EntityKey, opts: EntityCreateOptions) {
    super(app);
    this.entityKey = entityKey;
    this.def = ENTITIES[entityKey];
    this.onSubmit = opts.onSubmit;
    this.defaults = opts.defaults || {};
    this._submitted = false;
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    contentEl.addClass('cad-create-modal');
    if (modalEl) modalEl.addClass('cad-create-modal-shell');

    contentEl.createEl('h3', { cls: 'cad-create-title', text: `New ${this.def.label}` });

    const form = contentEl.createDiv({ cls: 'cad-create-form' });
    const inputs: Array<HTMLInputElement | HTMLSelectElement> = [];

    this.def.fields.forEach((f, idx) => {
      if (f.key === 'type' && f.type !== 'enum') return;
      const isPrimary = idx === 0;
      const row = form.createDiv({ cls: 'cad-create-row' });
      const label = row.createDiv({ cls: 'cad-create-label' });
      label.setText(f.label.toUpperCase() + (isPrimary ? ' *' : ''));

      let input: HTMLInputElement | HTMLSelectElement;
      const fieldType = f.type || 'text';

      if (fieldType === 'enum') {
        input = row.createEl('select', { cls: 'cad-create-input' });
        input.createEl('option', { value: '', text: '— —' });
        (f.options || []).forEach((opt) => input.createEl('option', { value: opt, text: opt }));
        const sensible = defaultEnumValue(f);
        if (sensible !== undefined) input.value = sensible;
      } else if (fieldType === 'date') {
        input = row.createEl('input', { type: 'date', cls: 'cad-create-input' });
      } else if (fieldType === 'number' || fieldType === 'currency') {
        input = row.createEl('input', { type: 'number', cls: 'cad-create-input' });
        input.placeholder = '0';
      } else if (fieldType === 'email') {
        input = row.createEl('input', { type: 'email', cls: 'cad-create-input' });
        input.placeholder = 'name@example.com';
      } else {
        input = row.createEl('input', { type: 'text', cls: 'cad-create-input' });
        input.placeholder = fieldType === 'tags' ? 'tag1, tag2' : this._placeholderFor(f, isPrimary);

        const suggestionSource = getFieldSuggestionSource(f);
        const hasSuggestions = suggestionSource !== 'none';

        if (hasSuggestions) {
          row.style.position = 'relative'; // Ensure absolute positioning of suggestions works
          const suggestionsBox = row.createDiv({ cls: 'cad-pd-tag-suggestions' });
          suggestionsBox.style.position = 'absolute';
          suggestionsBox.style.zIndex = '10000';
          suggestionsBox.style.backgroundColor = 'var(--background-secondary)';
          suggestionsBox.style.border = '1px solid var(--border-color)';
          suggestionsBox.style.borderRadius = '4px';
          suggestionsBox.style.boxShadow = 'var(--shadow-s)';
          suggestionsBox.style.maxHeight = '150px';
          suggestionsBox.style.overflowY = 'auto';
          suggestionsBox.style.display = 'none';
          suggestionsBox.style.width = 'calc(100% - 130px)'; // Account for the label width
          suggestionsBox.style.boxSizing = 'border-box';
          suggestionsBox.style.top = '100%';
          suggestionsBox.style.right = '0';
          suggestionsBox.style.marginTop = '4px';

          const updateSuggestions = () => {
            const fullVal = input.value;
            const lastCommaIdx = fullVal.lastIndexOf(',');
            suggestionsBox.empty();
            const filtered = entityCreateSuggestions(this.app, f, suggestionSource, fullVal);

            if (filtered.length === 0) {
              suggestionsBox.style.display = 'none';
              return;
            }

            filtered.forEach((valStr) => {
              const item = suggestionsBox.createDiv({ cls: 'cad-suggestion-item' });
              item.style.padding = '6px 10px';
              item.style.cursor = 'pointer';
              item.style.fontSize = '13px';
              item.style.color = 'var(--text-normal)';
              item.setText(valStr);

              item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = 'var(--background-modifier-hover)';
              });
              item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = 'transparent';
              });
              item.addEventListener('mousedown', (ev) => {
                ev.preventDefault(); // Prevents losing focus!
                const baseVal = lastCommaIdx === -1 ? '' : fullVal.slice(0, lastCommaIdx + 1) + ' ';
                input.value = baseVal + valStr + ', ';
                suggestionsBox.style.display = 'none';
                input.focus();
              });
            });

            suggestionsBox.style.display = 'block';
          };

          input.addEventListener('input', updateSuggestions);
          input.addEventListener('focus', updateSuggestions);
          input.addEventListener('blur', () => {
            setTimeout(() => { suggestionsBox.style.display = 'none'; }, 180);
          });
        }
      }
      input.dataset.fieldKey = f.key;
      input.dataset.fieldType = fieldType;
      if (isPrimary) input.required = true;
      if (this.defaults && this.defaults[f.key] != null) {
        input.value = String(this.defaults[f.key]);
      }
      inputs.push(input);
    });

    /* Action row */
    const actions = contentEl.createDiv({ cls: 'cad-create-actions' });
    const cancel = actions.createEl('button', { cls: 'cad-btn', text: 'Cancel' });
    cancel.type = 'button';
    cancel.addEventListener('click', () => this.close());

    const submitBtn = actions.createEl('button', { cls: 'cad-btn primary', text: `Create ${this.def.label}` });
    submitBtn.type = 'button';

    const submit = () => {
      const result = buildEntityCreateValues(this.def, inputs.map((el) => ({
        key: el.dataset.fieldKey!,
        type: el.dataset.fieldType,
        value: el.value,
      })));
      if (!result) {
        if (inputs[0]) inputs[0].focus();
        return;
      }
      this._submitted = true;
      this.close();
      this.onSubmit!(result);
    };
    submitBtn.addEventListener('click', submit);

    // Submit on Enter from any text input
    inputs.forEach((el) => {
      (el as HTMLElement).addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && el.tagName === 'INPUT') { e.preventDefault(); submit(); }
        if (e.key === 'Escape') this.close();
      });
    });

    setTimeout(() => { if (inputs[0]) { inputs[0].focus(); } }, 0);
  }

  _placeholderFor(field: EntityField, isPrimary: boolean) {
    return placeholderFor(this.entityKey, isPrimary);
  }

  onClose() {
    if (!this._submitted && this.onSubmit) this.onSubmit(null);
    this.contentEl.empty();
  }
}
