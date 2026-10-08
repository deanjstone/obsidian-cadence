import { Notice, TFile, type App } from 'obsidian';
import { DEAL_STAGES, ENTITIES } from '../constants/entities';
import type { Entity, EntityDef, EntityField, EntityKey, Frontmatter, ProjectMeta } from '../types/entities';
import { startOfDay, ymd } from './dates';
import { parseH2Sections, parseHeaderKey, parseMilestones } from './parsing';
import { entityTemplate } from './templates';
import { ensureFolderSync, type VaultNode } from './vault';

export function getDealStages(): string[] {
  return getEnumOptions('deal', 'stage', DEAL_STAGES);
}

/* Resolve which entity an arbitrary file belongs to, by frontmatter `type`
   first, then path-prefix fallback. Returns null if not a Cadence entity.
   Flagged quirk: a one-item array `type: [deal]` matches (it indexes
   ENTITIES by its string form) and is returned as the array itself. */
export function entityKeyFromFile(app: App, file: TFile | null | undefined): EntityKey | null {
  if (!file) return null;
  const cache = app.metadataCache.getFileCache(file);
  const t = cache && cache.frontmatter && cache.frontmatter.type;
  if (t && ENTITIES[t as string]) return t as EntityKey;
  for (const [key, def] of Object.entries(ENTITIES)) {
    if (file.path.startsWith(def.folder + '/')) return key;
  }
  return null;
}

/* List markdown files inside an entity's folder, without enumerating the
   whole vault. Walks the specific folder tree only (recursively, in case
   the user organises into sub-folders). */
export function listEntityFiles(app: App, entityKey: EntityKey): TFile[] {
  const def = ENTITIES[entityKey];
  if (!def) return [];
  const root = app.vault.getAbstractFileByPath(def.folder) as VaultNode | null;
  if (!root || !root.children) return [];
  const out: TFile[] = [];
  const walk = (node: VaultNode) => {
    for (const child of node.children!) {
      if (child.children) walk(child);
      else if (typeof child.path === 'string' && child.path.toLowerCase().endsWith('.md')) {
        out.push(child as TFile);
      }
    }
  };
  walk(root);
  return out;
}

export function getEnumOptions(entityKey: EntityKey, fieldKey: string, fallback: string[]): string[] {
  const def = ENTITIES[entityKey];
  if (!def || !def.fields) return fallback;
  const f = def.fields.find(field => field.key === fieldKey);
  return (f && f.options && f.options.length > 0) ? f.options : fallback;
}

export function getFieldSuggestionSource(f: Partial<EntityField> | null | undefined): string {
  if (!f) return 'none';
  if (f.suggestionSource) return f.suggestionSource; // includes folder:X and entity:X as-is
  const k = f.key as string;
  if (f.type === 'tags' || k === 'tags') return 'tags';
  if (['owner', 'assigned', 'contact', 'contacts', 'with'].includes(k)) return 'contact';
  if (k === 'company') return 'company';
  if (k === 'partner') return 'partner';
  if (k === 'related') return 'project';
  if (['domain', 'industry', 'role'].includes(k)) return 'history';
  if (f.type === 'multitext') return 'history';
  return 'none';
}

/* Rewrites one field across every note of an entity when its type changes.
   Flagged quirks (kept as-is): list→list conversions (e.g. multitext→tags)
   flatten arrays to a joined string, and number/currency conversion maps
   text with no digits to 0 rather than null. */
export async function migrateFrontmatterType(app: App, entityKey: EntityKey, fieldKey: string, oldType: string, newType: string): Promise<void> {
  if (oldType === newType) return;
  const files = listEntityFiles(app, entityKey);
  if (!files || files.length === 0) return;
  let count = 0;
  for (const file of files) {
    await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
      if (fm[fieldKey] === undefined) return;
      const val = fm[fieldKey];
      let newVal: unknown = val;
      const isNewList = ['multitext', 'tags'].includes(newType);
      const isOldList = ['multitext', 'tags'].includes(oldType) || Array.isArray(val);

      if (isNewList && !isOldList) {
        if (typeof val === 'string') {
          const parts = val.split(',').map(s => s.trim()).filter(Boolean);
          newVal = parts.map(part => {
            if (newType === 'tags') {
              return part.replace(/^#|^\[\[|\]\]$/g, '').trim();
            }
            const isRelationKey = ['owner', 'company', 'contact', 'with', 'related', 'partner'].includes(fieldKey);
            if (isRelationKey) {
              if (!part.startsWith('[[') && !part.endsWith(']]')) {
                return `[[${part}]]`;
              }
            }
            return part;
          });
        } else if (val != null) {
          newVal = [String(val)];
        }
      } else if (!isNewList && isOldList) {
        if (Array.isArray(val)) {
          newVal = val.map(v => String(v).replace(/^\[\[|\]\]$/g, '').trim()).filter(Boolean).join(', ');
        } else if (val != null) {
          newVal = String(val).replace(/^\[\[|\]\]$/g, '').trim();
        }
      } else {
        if (newType === 'number' || newType === 'currency') {
          let cleanStr = String(val);
          if (Array.isArray(val)) cleanStr = String(val[0]);
          cleanStr = cleanStr.replace(/[^0-9.-]/g, '');
          const n = Number(cleanStr);
          newVal = isNaN(n) ? null : n;
        } else if (newType === 'date') {
          let cleanStr = String(val);
          if (Array.isArray(val)) cleanStr = String(val[0]);
          cleanStr = cleanStr.replace(/^\[\[|\]\]$/g, '').trim();
          const match = cleanStr.match(/\d{4}-\d{2}-\d{2}/);
          newVal = match ? match[0] : null;
        } else {
          if (Array.isArray(val)) {
            newVal = val.map(v => String(v).replace(/^\[\[|\]\]$/g, '').trim()).join(', ');
          } else {
            newVal = String(val);
          }
        }
      }
      fm[fieldKey] = newVal;
      count++;
    });
  }
  new Notice(`Migrated ${count} files for field "${fieldKey}" to type "${newType}".`);
}

export async function migrateFrontmatterKey(app: App, entityKey: EntityKey, oldKey: string, newKey: string): Promise<void> {
  if (oldKey === newKey) return;
  const files = listEntityFiles(app, entityKey);
  if (!files || files.length === 0) return;
  let count = 0;
  for (const file of files) {
    await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
      if (fm[oldKey] !== undefined) {
        fm[newKey] = fm[oldKey];
        delete fm[oldKey];
        count++;
      }
    });
  }
  new Notice(`Renamed frontmatter key "${oldKey}" to "${newKey}" in ${count} files.`);
}

export function readEntity(app: App, file: TFile): Entity {
  const cache: { frontmatter?: Frontmatter } = app.metadataCache.getFileCache(file) || {};
  const fm = cache.frontmatter || {};
  return { file, frontmatter: fm, basename: file.basename };
}

export function listEntities(app: App, entityKey: EntityKey): Entity[] {
  return listEntityFiles(app, entityKey).map((f) => readEntity(app, f));
}

/* Read a field for display/sorting. `def` is matched against ENTITIES by
   identity for the `type` fallback. */
export function entityValue(entity: { frontmatter?: Frontmatter; basename: string }, key: string, def?: EntityDef): unknown {
  const fm = entity.frontmatter || {};
  let val = fm[key];
  if (val != null && val !== '') {
    if (key === 'stage' && Array.isArray(val)) {
      return val[0] || '';
    }
    return val;
  }
  // Fallback for type field
  if (key === 'type' && def && def.plural !== 'Activities') {
    for (const [k, d] of Object.entries(ENTITIES)) {
      if (d === def) return k;
    }
  }
  // Fallback: 'name' / 'title' / 'subject' default to file basename
  if (def && def.fields[0] && def.fields[0].key === key) return entity.basename;
  return '';
}

export async function readProjectMeta(app: App, file: TFile): Promise<ProjectMeta> {
  const content = await app.vault.read(file);
  const sections = parseH2Sections(content);

  // Find any milestone section dynamically
  let milestoneText = '';
  for (const [key, val] of Object.entries(sections)) {
    const { cleanLabel, tag } = parseHeaderKey(key);
    if (tag === '#milestones' || cleanLabel.toLowerCase() === 'milestones') {
      milestoneText = val;
      break;
    }
  }

  const milestones = parseMilestones(milestoneText);
  const total = milestones.length;
  const done = milestones.filter((m) => m.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const today = startOfDay(new Date());
  const upcoming = milestones
    .filter((m) => !m.done && m.date)
    .sort((a, b) => (a.date as unknown as number) - (b.date as unknown as number));
  const next = upcoming[0] || null;
  return { content, sections, milestones, total, done, percent, next, today };
}

/* Create a note for an entity key, a `folder:<path>` target, or a raw folder
   path (matched back to an entity folder when possible). */
export async function createEntity(app: App, entityKeyOrFolder: string, rawName?: string): Promise<TFile> {
  let folder = entityKeyOrFolder;
  let label = 'Note';
  let isEntity = false;

  if (ENTITIES[entityKeyOrFolder]) {
    const def = ENTITIES[entityKeyOrFolder];
    folder = def.folder;
    label = def.label;
    isEntity = true;
  } else if (entityKeyOrFolder && entityKeyOrFolder.startsWith('folder:')) {
    folder = entityKeyOrFolder.slice('folder:'.length);
  }

  // Double check if this folder matches an entity in case we got a raw folder path
  if (!isEntity && folder) {
    const normalizedPath = folder.replace(/\/+$/, '').toLowerCase();
    for (const [ek, def] of Object.entries(ENTITIES)) {
      if (def && def.folder && def.folder.replace(/\/+$/, '').toLowerCase() === normalizedPath) {
        entityKeyOrFolder = ek;
        folder = def.folder;
        label = def.label;
        isEntity = true;
        break;
      }
    }
  }

  await ensureFolderSync(app, folder);
  const safeName = (rawName || `Untitled ${label}`).replace(/[\\/:*?"<>|]/g, '-').trim() || 'Untitled';
  let path = `${folder}/${safeName}.md`;
  let n = 2;
  while (app.vault.getAbstractFileByPath(path)) {
    path = `${folder}/${safeName} ${n}.md`;
    n++;
  }

  let template = '';
  let customTemplateContent: string | null = null;
  if (isEntity) {
    const templatesFolder = 'Cadence/Templates';
    await ensureFolderSync(app, templatesFolder);

    const def = ENTITIES[entityKeyOrFolder];
    const pathsToTry = [
      `${templatesFolder}/${entityKeyOrFolder}.md`,
      `${templatesFolder}/${def.label}.md`,
      `${templatesFolder}/${def.plural}.md`,
      `${templatesFolder}/${entityKeyOrFolder.toLowerCase()}.md`,
      `${templatesFolder}/${def.label.toLowerCase()}.md`,
      `${templatesFolder}/${def.plural.toLowerCase()}.md`
    ];
    for (const p of pathsToTry) {
      const tFile = app.vault.getAbstractFileByPath(p);
      if (tFile && tFile instanceof TFile) {
        customTemplateContent = await app.vault.read(tFile);
        break;
      }
    }
  }

  if (customTemplateContent !== null) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    template = customTemplateContent
      .replace(/\{\{name\}\}/gi, safeName)
      .replace(/\{\{title\}\}/gi, safeName)
      .replace(/\{\{date\}\}/gi, ymd(now))
      .replace(/\{\{time\}\}/gi, timeStr);
  } else {
    template = isEntity
      ? entityTemplate(entityKeyOrFolder, safeName)
      : `---\nname: ${safeName}\n---\n\n# ${safeName}\n\n`;
  }

  return await app.vault.create(path, template);
}

/* Resolve a project's display name from its file path. */
export function projectNameFromPath(app: App, path: string | null | undefined): string | null {
  if (!path) return null;
  const file = app.vault.getAbstractFileByPath(path);
  if (!file) return path.split('/').pop()!.replace(/\.md$/, '');
  const cache = app.metadataCache.getFileCache(file as TFile);
  const fmName = cache && cache.frontmatter && cache.frontmatter.name;
  return (fmName as string) || (file as TFile).basename;
}
