import type { TFile } from 'obsidian';
import type { EntityDef, EntityField, Frontmatter } from '../types/entities';
import { getFieldSuggestionSource } from './entities';
import type { VaultNode } from './vault';

/* Field editing shared by the entity detail form and the company detail
   page (#15): the save-time coercion, the frontmatter write, and the logic
   behind the chip input (its source, values, suggestions and link targets).
   Plain data in, plain data out; the views keep the DOM. */

/** Coerce a raw form value for `key` before it is written: tags split on
    commas, numbers and currency to a number (null when not numeric), stage
    to a one-item list, and an empty string to null. A key with no field in
    `def` is written as-is.
    Flagged quirk (kept as-is): an empty number or currency becomes 0, because
    Number('') is 0. */
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
      const n = Number(raw);
      value = isNaN(n) ? null : n;
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

/** True when a field edits as chips: tags, multitext, or any suggestion source. */
export function isChipField(f: EntityField): boolean {
  const fieldType = f.type || 'text';
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
  /** The entity the chips link to: the source itself, or the entity whose
      folder a folder: source names. */
  targetEntityKey: string | null;
  /** A folder: source's path; suggestions list its notes. */
  customFolderPath: string | null;
}

/** How a chip field links, suggests and saves. `listKeys` is
    DETAIL_LIST_KEYS or COMPANY_LIST_KEYS. A folder: source that names an
    entity's folder (case- and trailing-slash-insensitive) targets that
    entity, but keeps its folder path for suggestions. */
export function chipConfig(f: EntityField, entities: Record<string, EntityDef>, listKeys: string[]): ChipConfig {
  const fieldType = f.type || 'text';
  const suggestionSource = getFieldSuggestionSource(f);
  const isEntitySrc = entities[suggestionSource] != null;
  const isFolderSrc = suggestionSource && suggestionSource.startsWith('folder:');
  const isPlainChip = ['tags', 'none', 'history'].includes(suggestionSource);
  const isList = fieldType === 'tags' || fieldType === 'multitext' || f.isList === true || listKeys.includes(f.key);
  let targetEntityKey = isEntitySrc ? suggestionSource : null;
  const customFolderPath = isFolderSrc ? suggestionSource.slice('folder:'.length) : null;

  if (isFolderSrc && customFolderPath) {
    const normalizedPath = customFolderPath.replace(/\/+$/, '').toLowerCase();
    for (const [ek, def] of Object.entries(entities)) {
      if (def && def.folder && def.folder.replace(/\/+$/, '').toLowerCase() === normalizedPath) {
        targetEntityKey = ek;
        break;
      }
    }
  }
  return { suggestionSource, isPlainChip, isList, targetEntityKey, customFolderPath };
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

/** Adding a typed value: blank does nothing, a list's existing value only
    clears the input, otherwise the trimmed name is appended (or replaces
    the value of a single-value field). */
export function chipAdd(values: string[], raw: string, isList: boolean): ChipAdd {
  const name = raw.trim();
  if (!name) return { kind: 'blank' };
  if (isList) {
    if (values.includes(name)) return { kind: 'duplicate' };
    return { kind: 'added', name, values: [...values, name] };
  }
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

/** Basenames of the .md notes under a folder, recursively; none for a
    missing folder or a file. */
export function folderNoteNames(folderNode: VaultNode | null): string[] {
  const names: string[] = [];
  if (folderNode && folderNode.children) {
    const walk = (node: VaultNode) => {
      for (const child of node.children!) {
        if (child.children) walk(child);
        else if (child.path && child.path.endsWith('.md')) names.push((child as TFile).basename);
      }
    };
    walk(folderNode);
  }
  return names;
}

/** Candidates containing the (trimmed, lower-cased) query, minus the chips
    already chosen. An empty query keeps every candidate. */
export function filterSuggestions(candidates: string[], query: string, taken: string[]): string[] {
  return candidates.filter((v) => (!query || v.toLowerCase().includes(query)) && !taken.includes(v));
}

/** The note a chip names: the first markdown file with that basename, any case. */
export function findNoteByName(files: TFile[], name: string): TFile | undefined {
  return files.find(cFile => cFile.basename.toLowerCase() === name.toLowerCase());
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

/** The cell a company or project meta-row field edits with. Chips are
    checked first, so (flagged) an enum with a suggestion source is a chip
    input on those pages but a select on the generic form. */
export function metaControl(f: EntityField): MetaControl {
  if (isChipField(f)) return 'chips';
  return (f.type || 'text') === 'enum' ? 'enum' : 'input';
}

/** An input cell's type: date, number (for number and currency), else text. */
export function metaInputType(fieldType: string): 'date' | 'number' | 'text' {
  return fieldType === 'date' ? 'date' : (fieldType === 'number' || fieldType === 'currency' ? 'number' : 'text');
}

/** What an input cell writes: the text, or a number for number and
    currency; null (delete) when empty or not numeric.
    Flagged quirk (kept as-is): an empty number writes 0, because Number('') is 0. */
export function metaInputValue(fieldType: string, raw: string): string | number | null {
  let val: string | number | null = raw || null;
  if (fieldType === 'number' || fieldType === 'currency') {
    const n = Number(raw);
    val = isNaN(n) ? null : n;
  }
  return val;
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
