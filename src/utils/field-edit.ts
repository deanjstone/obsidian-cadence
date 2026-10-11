import type { App, TFile } from 'obsidian';
import type { EntityDef, EntityField, Frontmatter } from '../types/entities';
import { getFieldSuggestionSource, listEntityFiles } from './entities';
import type { VaultNode } from './vault';

/* Field editing shared by the entity detail form and the company detail
   page (#15): the save-time coercion, the frontmatter write, and the logic
   behind the chip input (its source, values, suggestions and link targets).
   Plain data in, plain data out; the views keep the DOM. */

/** A number or currency input's value: null (delete the key) when empty or
    not numeric, so clearing the field removes it like any other empty field
    (#50), rather than Number('') writing 0. */
function numberValue(raw: unknown): number | null {
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(raw);
  return isNaN(n) ? null : n;
}

/** Coerce a raw form value for `key` before it is written: tags split on
    commas, numbers and currency to a number (null when empty or not
    numeric), stage to a one-item list, and an empty string to null. A key
    with no field in `def` is written as-is. */
export function coerceFieldEdit(def: EntityDef, key: string, raw: unknown): unknown {
  let value: unknown = raw;
  const fdef = def.fields.find((f) => f.key === key);
  if (fdef) {
    if (fdef.type === 'tags') {
      if (Array.isArray(raw)) {
        value = raw;
      } else {
        value = ((raw as string) || '').split(',').map((t) => t.trim()).filter(Boolean);
      }
    } else if (fdef.type === 'number' || fdef.type === 'currency') {
      value = numberValue(raw);
    } else if (key === 'stage') {
      value = raw ? [raw] : null;
    } else if (raw === '') {
      value = null;
    }
  }
  return value;
}

/** Write one value into a processFrontMatter callback's frontmatter: null,
    undefined and an empty list delete the key. */
export function applyFieldEdit(frontmatter: Frontmatter, key: string, value: unknown): void {
  if (value == null || (Array.isArray(value) && value.length === 0)) {
    delete frontmatter[key];
  } else {
    frontmatter[key] = value;
  }
}

/** The YYYY-MM-DD a date input shows for a stored value, or null when it
    doesn't parse. Read in UTC. */
export function dateInputValue(current: unknown): string | null {
  const d = new Date(current as string);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** The option a select shows as chosen: a list's first value, else the value. */
export function enumCurrent(current: unknown): string {
  return Array.isArray(current) ? String(current[0] || '') : String(current || '');
}

/** A select's options: the field's options, then a stored value that is not
    one of them, so the select shows (and keeps) what the note holds (#50,
    #89). An empty stored value adds nothing. */
export function withStoredOption(options: string[], stored: string): string[] {
  return stored === '' || options.includes(stored) ? options : [...options, stored];
}

/** True when a field edits as chips: tags, multitext, any suggestion source,
    or a text or email list (contact phone and email), which a plain input
    would write back as a scalar (#50). */
export function isChipField(f: EntityField): boolean {
  const fieldType = f.type || 'text';
  if (f.isList === true && (fieldType === 'text' || fieldType === 'email')) return true;
  return fieldType === 'tags' || fieldType === 'multitext' || getFieldSuggestionSource(f) !== 'none';
}

/** Keys the generic detail form edits as a list whatever their type. */
export const DETAIL_LIST_KEYS = ['tags', 'owner', 'assigned', 'contacts', 'domain', 'industry', 'role', 'with', 'related'];

/** The company and project pages' list keys. Flagged: it lacks `tags`
    (tags fields are lists by type anyway) and `assigned`. */
export const COMPANY_LIST_KEYS = ['owner', 'contacts', 'domain', 'industry', 'role', 'with', 'related'];

export interface ChipConfig {
  suggestionSource: string;
  /** tags, none and history sources: values are stored and shown as-is. */
  isPlainChip: boolean;
  /** Written as a list; otherwise one value replaces the last. */
  isList: boolean;
  /** The entity the chips link to: the source itself, the entity an
      entity:<key> source names, or the entity whose folder a folder:
      source names. */
  targetEntityKey: string | null;
  /** A folder: source's path; suggestions list its notes. */
  customFolderPath: string | null;
}

/** The entity and folder a suggestion source names (#56). An entity key or
    `entity:<key>` names that entity (own keys only). A `folder:<path>` names
    the path without trailing slashes; when that is an entity's folder, in
    any case, it names the entity and its folder as the entity spells it. */
export function suggestionTarget(
  suggestionSource: string, entities: Record<string, EntityDef>,
): { targetEntityKey: string | null; customFolderPath: string | null } {
  const isEntity = (key: string) => Object.prototype.hasOwnProperty.call(entities, key) && entities[key] != null;
  if (isEntity(suggestionSource)) return { targetEntityKey: suggestionSource, customFolderPath: null };
  if (suggestionSource.startsWith('entity:')) {
    const key = suggestionSource.slice('entity:'.length);
    return { targetEntityKey: isEntity(key) ? key : null, customFolderPath: null };
  }
  if (!suggestionSource.startsWith('folder:')) return { targetEntityKey: null, customFolderPath: null };
  const path = suggestionSource.slice('folder:'.length).replace(/\/+$/, '');
  if (!path) return { targetEntityKey: null, customFolderPath: null };
  for (const [ek, def] of Object.entries(entities)) {
    if (def && def.folder && def.folder.replace(/\/+$/, '').toLowerCase() === path.toLowerCase()) {
      return { targetEntityKey: ek, customFolderPath: def.folder.replace(/\/+$/, '') };
    }
  }
  return { targetEntityKey: null, customFolderPath: path };
}

/** How a chip field links, suggests and saves. `listKeys` is
    DETAIL_LIST_KEYS or COMPANY_LIST_KEYS. The target comes from
    suggestionTarget. */
export function chipConfig(f: EntityField, entities: Record<string, EntityDef>, listKeys: string[]): ChipConfig {
  const fieldType = f.type || 'text';
  const suggestionSource = getFieldSuggestionSource(f);
  const isPlainChip = ['tags', 'none', 'history'].includes(suggestionSource);
  const isList = fieldType === 'tags' || fieldType === 'multitext' || f.isList === true || listKeys.includes(f.key);
  const { targetEntityKey, customFolderPath } = suggestionTarget(suggestionSource, entities);
  return { suggestionSource, isPlainChip, isList, targetEntityKey, customFolderPath };
}

/** What a chip shows for a stored value: a history value unwrapped from
    [[ ]], like its suggestions (#56); any other value as it is. The value
    itself is written back unchanged. */
export function chipLabel(value: string, suggestionSource: string): string {
  return suggestionSource === 'history' ? value.replace(/^\[\[|\]\]$/g, '').trim() : value;
}

/** One stored value as a chip: trimmed, and unwrapped from [[ ]] unless plain. */
export function unwrapChip(v: unknown, isPlainChip: boolean): string {
  return isPlainChip ? String(v).trim() : String(v).replace(/^\[\[|\]\]$/g, '').trim();
}

/** The chips for a stored value (a list or a scalar), dropping empties. */
export function chipValues(current: unknown, isPlainChip: boolean): string[] {
  if (Array.isArray(current)) {
    return current.map(v => unwrapChip(v, isPlainChip)).filter(Boolean);
  } else if (current != null && current !== '') {
    return [unwrapChip(current, isPlainChip)].filter(Boolean);
  }
  return [];
}

/** What a chip field saves: the values, or links to them, as a list or as
    the first value (null when there is none). */
export function chipWriteValue(values: string[], isPlainChip: boolean, isList: boolean): string | string[] | null {
  if (isPlainChip) {
    return isList ? values : (values[0] || null);
  }
  return isList ? values.map(o => `[[${o}]]`) : (values[0] ? `[[${values[0]}]]` : null);
}

export type ChipAdd =
  | { kind: 'blank' }
  | { kind: 'duplicate' }
  | { kind: 'added'; name: string; values: string[] };

/** Adding a typed value: blank does nothing, a value already chosen (by
    its label, so `Board` matches a stored `[[Board]]`) only clears the
    input, in a list or a single-value field (#56); otherwise the trimmed
    name is appended (or replaces the value of a single-value field). */
export function chipAdd(values: string[], raw: string, isList: boolean, label: (value: string) => string = (v) => v): ChipAdd {
  const name = raw.trim();
  if (!name) return { kind: 'blank' };
  if (values.some((v) => label(v) === name)) return { kind: 'duplicate' };
  if (isList) return { kind: 'added', name, values: [...values, name] };
  return { kind: 'added', name, values: [name] };
}

/** Every value `key` has across the given frontmatters, unwrapped and
    deduplicated, in first-seen order. */
export function historyValues(frontmatters: Frontmatter[], key: string): string[] {
  const allValues = new Set<string>();
  frontmatters.forEach(fm => {
    const val = fm[key];
    if (Array.isArray(val)) {
      val.forEach(v => { if (v) allValues.add(String(v).replace(/^\[\[|\]\]$/g, '').trim()); });
    } else if (val != null && val !== '') {
      allValues.add(String(val).replace(/^\[\[|\]\]$/g, '').trim());
    }
  });
  return Array.from(allValues);
}

/** The .md notes under a folder, recursively; none for a missing folder
    or a file. */
export function folderNotes(folderNode: VaultNode | null): TFile[] {
  const notes: TFile[] = [];
  if (folderNode && folderNode.children) {
    const walk = (node: VaultNode) => {
      for (const child of node.children!) {
        if (child.children) walk(child);
        else if (child.path && child.path.endsWith('.md')) notes.push(child as TFile);
      }
    };
    walk(folderNode);
  }
  return notes;
}

/** Basenames of the .md notes under a folder, recursively. */
export function folderNoteNames(folderNode: VaultNode | null): string[] {
  return folderNotes(folderNode).map((note) => note.basename);
}

/** The notes a link chip can name (#56): its folder's notes, else its
    target entity's notes, else none. Suggestions, click-through and the
    auto-create check all read this, not the whole vault. */
export function chipScopeNotes(app: App, targetEntityKey: string | null, customFolderPath: string | null): TFile[] {
  if (customFolderPath) return folderNotes(app.vault.getAbstractFileByPath(customFolderPath) as VaultNode | null);
  if (targetEntityKey) return listEntityFiles(app, targetEntityKey);
  return [];
}

/** Candidates containing the (trimmed, lower-cased) query, minus the chips
    already chosen. An empty query keeps every candidate. */
export function filterSuggestions(candidates: string[], query: string, taken: string[]): string[] {
  return candidates.filter((v) => (!query || v.toLowerCase().includes(query)) && !taken.includes(v));
}

/** The note a chip names among `files` (its scope, chipScopeNotes): the
    one with that exact basename, else the first in any case. */
export function findNoteByName(files: TFile[], name: string): TFile | undefined {
  return files.find(cFile => cFile.basename === name)
    || files.find(cFile => cFile.basename.toLowerCase() === name.toLowerCase());
}

export type ChipLinkTarget =
  | { kind: 'entity'; entityKey: string; file: TFile }
  | { kind: 'file'; file: TFile }
  | { kind: 'link'; linktext: string };

/** Where clicking a link chip goes: the note's detail form as the target
    entity, its detail form by its own entity, or the bare link when there
    is no such note. */
export function chipLinkTarget(targetEntityKey: string | null, targetFile: TFile | undefined, name: string): ChipLinkTarget {
  if (targetFile) {
    if (targetEntityKey && !targetEntityKey.startsWith('folder:')) {
      return { kind: 'entity', entityKey: targetEntityKey, file: targetFile };
    }
    return { kind: 'file', file: targetFile };
  }
  return { kind: 'link', linktext: name };
}

/** The entities a form edit may auto-create a note for: the targets of the
    relation fields (#45, owner decision 2026-10-11). Any other link chip
    links to the name without creating a note. */
export const AUTO_CREATE_ENTITIES = ['contact', 'company', 'project'];

/** True when adding a link to a missing note should create it. */
export function autoCreatesNote(targetEntityKey: string | null): boolean {
  return targetEntityKey != null && AUTO_CREATE_ENTITIES.includes(targetEntityKey);
}

/** Where a new note for a link chip is created, and the label its notice uses.
    Flagged: the `history` branch is unreachable, because history chips are
    plain and never create notes. */
export function chipCreation(
  suggestionSource: string, targetEntityKey: string | null, entities: Record<string, EntityDef>,
): { source: string; label: string } {
  return {
    source: suggestionSource === 'history' ? 'folder:Cadence/Shared' : (targetEntityKey || suggestionSource),
    label: entities[targetEntityKey as string] ? entities[targetEntityKey as string].label : 'Note',
  };
}

export type MetaControl = 'chips' | 'enum' | 'input';

/** The cell a company or project meta-row field edits with. Enum is
    checked first, so an enum with a suggestion source is a select, as on
    the generic form (#56). */
export function metaControl(f: EntityField): MetaControl {
  if ((f.type || 'text') === 'enum') return 'enum';
  return isChipField(f) ? 'chips' : 'input';
}

/** An input cell's type: date, number (for number and currency), else text. */
export function metaInputType(fieldType: string): 'date' | 'number' | 'text' {
  return fieldType === 'date' ? 'date' : (fieldType === 'number' || fieldType === 'currency' ? 'number' : 'text');
}

/** What an input cell writes: the text, or a number for number and
    currency; null (delete) when empty or not numeric. */
export function metaInputValue(fieldType: string, raw: string): string | number | null {
  if (fieldType === 'number' || fieldType === 'currency') return numberValue(raw);
  return raw || null;
}

/** The detail pages' two columns: sections alternate between them: 1st, 3rd, … left; 2nd, 4th, … right. */
export function splitSectionColumns(keys: string[]): { left: string[]; right: string[] } {
  const left: string[] = [];
  const right: string[] = [];
  keys.forEach((key, idx) => {
    if (idx % 2 === 0) {
      left.push(key);
    } else {
      right.push(key);
    }
  });
  return { left, right };
}
