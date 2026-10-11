import { Notice, type TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import type { EntityDef, Frontmatter } from '../types/entities';
import { entityKeyFromFile, getFieldSuggestionSource, listEntityFiles } from '../utils/entities';
import type { PluginHost } from './host';

/* The contact↔project sync. onload runs syncContactProjectRelationships on
   every metadataCache 'changed' event and handleProjectDeletion on every
   vault 'delete'. Only contacts' `project` field is written. CadencePlugin
   keeps a one-line delegate for each.

   The sync only adds (#45): a change never removes a project a contact
   lists. Only deleting a project note removes it.

   The link maths is plain data over names and frontmatter: which names a
   value holds (extractEntitiesFromValue), which fields name contacts or
   projects, which contact–project pairs a note backs (noteLinks,
   collectValidLinks), and the `project` value to write (projectLinkValue,
   appendProjectLink, removeProjectLink, contactProjectsPlan). */

/* A note as the sync sees it: its entity type, name and frontmatter. */
export interface SyncNote {
  entityKey: string | null;
  basename: string;
  frontmatter: Frontmatter;
}

/* The names in a frontmatter value: each `[[target]]` (alias dropped) when
   the string has links, else each comma-separated item, else the string.
   Arrays are read item by item. */
export function extractEntitiesFromValue(value: unknown): string[] {
  if (value == null) return [];
  const results: string[] = [];
  const processStr = (str: string) => {
    str = String(str).trim();
    if (!str) return;
    if (str.includes('[[')) {
      const regex = /\[\[(.*?)\]\]/g;
      let match;
      while ((match = regex.exec(str)) !== null) {
        let target = match[1].trim();
        if (target.includes('|')) {
          target = target.split('|')[0].trim();
        }
        if (target) results.push(target);
      }
    } else if (str.includes(',')) {
      str.split(',').forEach(s => {
        const item = s.trim();
        if (item) results.push(item);
      });
    } else {
      results.push(str);
    }
  };
  if (Array.isArray(value)) {
    value.forEach(val => processStr(val));
  } else {
    processStr(value as string);
  }
  return results;
}

/* A contact field: owner, contact, contacts, with or assigned (any case), or
   a field of `entityKey` whose suggestions come from contacts. */
export function isContactField(key: string, entityKey: string | null, entities: Record<string, EntityDef>): boolean {
  if (['owner', 'contact', 'contacts', 'with', 'assigned'].includes(key.toLowerCase())) return true;
  if (entityKey && entities[entityKey]) {
    const fdef = entities[entityKey].fields.find(field => field.key === key);
    if (fdef) {
      const sug = fdef.suggestionSource || getFieldSuggestionSource(fdef);
      if (sug === 'contact' || sug === 'folder:Cadence/Contacts') return true;
    }
  }
  return false;
}

/* A project field: project, projects or related (any case), or a field of
   `entityKey` whose suggestions come from projects. */
export function isProjectField(key: string, entityKey: string | null, entities: Record<string, EntityDef>): boolean {
  if (['project', 'projects', 'related'].includes(key.toLowerCase())) return true;
  if (entityKey && entities[entityKey]) {
    const fdef = entities[entityKey].fields.find(field => field.key === key);
    if (fdef) {
      const sug = fdef.suggestionSource || getFieldSuggestionSource(fdef);
      if (sug === 'project' || sug === 'folder:Cadence/Projects') return true;
    }
  }
  return false;
}

/* The lower-cased contacts and projects one note names: itself if it is a
   contact or a project, every name in a contact or project field, and every
   known contact or project name in any field. `type` is skipped. */
export function noteLinks(
  note: SyncNote,
  contactNames: { has(name: string): boolean },
  projectNames: { has(name: string): boolean },
  entities: Record<string, EntityDef>,
): { contacts: Set<string>; projects: Set<string> } {
  const foundContacts = new Set<string>();
  const foundProjects = new Set<string>();

  if (note.entityKey === 'contact') {
    foundContacts.add(note.basename.toLowerCase());
  } else if (note.entityKey === 'project') {
    foundProjects.add(note.basename.toLowerCase());
  }

  for (const [key, val] of Object.entries(note.frontmatter)) {
    if (key === 'type') continue;
    const extracted = extractEntitiesFromValue(val);
    for (const name of extracted) {
      if (!name) continue;
      const nameLower = name.toLowerCase();
      if (isContactField(key, note.entityKey, entities) || contactNames.has(nameLower)) {
        foundContacts.add(nameLower);
      }
      if (isProjectField(key, note.entityKey, entities) || projectNames.has(nameLower)) {
        foundProjects.add(nameLower);
      }
    }
  }
  return { contacts: foundContacts, projects: foundProjects };
}

/* Every `contact|project` pair (lower-cased) some note backs: each contact a
   note names with each project it names. Contact notes are not sources, so
   a contact cannot back its own links. */
export function collectValidLinks(
  notes: SyncNote[],
  contactNames: { has(name: string): boolean },
  projectNames: { has(name: string): boolean },
  entities: Record<string, EntityDef>,
): Set<string> {
  const validLinks = new Set<string>(); // "contact_lowercase|project_lowercase"
  for (const note of notes) {
    if (note.entityKey === 'contact') continue;
    const { contacts, projects } = noteLinks(note, contactNames, projectNames, entities);
    if (contacts.size > 0 && projects.size > 0) {
      for (const c of contacts) {
        for (const p of projects) {
          validLinks.add(`${c}|${p}`);
        }
      }
    }
  }
  return validLinks;
}

/* A contact's `project` value: one link as a string, several as a list, and
   none as null (the key is deleted). Every name is rewritten as a link. */
export function projectLinkValue(names: string[]): string | string[] | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `[[${names[0]}]]`;
  return names.map(p => `[[${p}]]`);
}

/* Writes a projectLinkValue into frontmatter, deleting the key for none. */
export function writeProjectLinks(fm: Frontmatter, names: string[]): void {
  const value = projectLinkValue(names);
  if (value === null) {
    delete fm.project;
  } else {
    fm.project = value;
  }
}

/* The contact's project names with `projectName` appended, unless it is
   already there (case-insensitive). */
export function addProjectLink(current: string[], projectName: string): string[] {
  if (current.some(p => p.toLowerCase() === projectName.toLowerCase())) return current;
  return [...current, projectName];
}

/* A contact's `project` value as the items it holds, each as typed: a
   list's items, or a string split on the commas outside its links. */
function projectItems(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value == null) return [];
  return String(value).split(/,(?![^[]*\]\])/).map(s => s.trim()).filter(Boolean);
}

/* The contact's `project` value with a link to `projectName` appended, or
   null when it already lists it (case-insensitive). The other items stay as
   typed: a plain name is not rewritten as a link (#45). */
export function appendProjectLink(value: unknown, projectName: string): string | string[] | null {
  const names = extractEntitiesFromValue(value);
  if (addProjectLink(names, projectName) === names) return null;
  const items = [...projectItems(value), `[[${projectName}]]`];
  return items.length === 1 ? items[0] : items;
}

/* The contact's project names without `projectName` (case-insensitive). */
export function removeProjectLink(current: string[], projectName: string): string[] {
  return current.filter(p => p.toLowerCase() !== projectName.toLowerCase());
}

/* The backed projects the vault-wide pass adds to one contact, or null when
   it already lists them all (case-insensitively). The sync is additive: a
   project the contact lists is never removed, backed or not (#45). */
export function contactProjectsPlan(existing: string[], backed: string[]): { added: string[] } | null {
  const added = backed.filter(p => !existing.some(ep => ep.toLowerCase() === p.toLowerCase()));
  return added.length > 0 ? { added } : null;
}

export async function syncContactProjectRelationships(plugin: PluginHost, changedFile: TFile | null | undefined): Promise<void> {
  if (plugin._syncInProgress) return;
  if (!changedFile || !changedFile.path.toLowerCase().endsWith('.md')) return;

  // Check if file still exists in vault before continuing!
  if (!plugin.app.vault.getAbstractFileByPath(changedFile.path)) return;

  try {
    plugin._syncInProgress = true;

    // 1. Get all contact files and project files
    const contactFiles = listEntityFiles(plugin.app, 'contact');
    const projectFiles = listEntityFiles(plugin.app, 'project');

    const contactMap = new Map<string, TFile>();
    for (const f of contactFiles) {
      contactMap.set(f.basename.toLowerCase(), f);
    }

    const projectMap = new Map<string, TFile>();
    for (const f of projectFiles) {
      projectMap.set(f.basename.toLowerCase(), f);
    }

    const frontmatterOf = (f: TFile): Frontmatter => (plugin.app.metadataCache.getFileCache(f) || {}).frontmatter || {};

    const changedEntityKey = entityKeyFromFile(plugin.app, changedFile);

    if (changedEntityKey === 'contact') {
      // We only sync projects to contacts (one-way relationship).
      // Editing a contact sheet does not push the contact name back to project owner fields,
      // and the sync never creates notes (#45): only a form edit to a relation field does.
    }
    else if (changedEntityKey === 'project') {
      const projectLower = changedFile.basename.toLowerCase();
      const projectFm = frontmatterOf(changedFile);

      const projectContacts: string[] = [];
      for (const [key, val] of Object.entries(projectFm)) {
        if (key === 'type') continue;
        if (isContactField(key, 'project', ENTITIES)) {
          projectContacts.push(...extractEntitiesFromValue(val));
        }
      }
      const currentContactsOfProject = new Set(projectContacts.map(c => c.toLowerCase()));

      // For each contact in the vault, check if they should be linked
      for (const [contactLower, contactFile] of contactMap.entries()) {
        const contactProjects = extractEntitiesFromValue(frontmatterOf(contactFile).project);
        const listsProject = contactProjects.some(p => p.toLowerCase() === projectLower);
        const projectListsContact = currentContactsOfProject.has(contactLower);

        if (projectListsContact && !listsProject) {
          // User manually added contact to project sheet!
          await plugin.app.fileManager.processFrontMatter(contactFile, (cfm: Frontmatter) => {
            const value = appendProjectLink(cfm.project, changedFile.basename);
            if (value !== null) cfm.project = value;
          });
          new Notice(`Auto-link: project "${changedFile.basename}" added to contact "${contactFile.basename}".`);
        }
      }
    }
    else {
      // Vault-wide scan to build the set of valid contact-project links.
      // We exclude Contact sheets as relationship sources to prevent self-reinforcing loops.
      const allFiles = plugin.app.vault.getMarkdownFiles();
      const notes: SyncNote[] = [];
      for (const f of allFiles) {
        const entityKey = entityKeyFromFile(plugin.app, f);
        if (entityKey === 'contact') continue;
        const cache = plugin.app.metadataCache.getFileCache(f);
        if (!cache || !cache.frontmatter) continue;
        notes.push({ entityKey, basename: f.basename, frontmatter: cache.frontmatter });
      }
      const validLinks = collectValidLinks(notes, contactMap, projectMap, ENTITIES);

      // Sync all Contacts according to validLinks
      for (const [contactLower, contactFile] of contactMap.entries()) {
        const existingProjects = extractEntitiesFromValue(frontmatterOf(contactFile).project);

        const projectNamesToLink = new Set<string>();
        for (const link of validLinks) {
          const [c, p] = link.split('|');
          if (c === contactLower) {
            const pFile = projectMap.get(p);
            if (pFile) {
              projectNamesToLink.add(pFile.basename);
            }
          }
        }

        const plan = contactProjectsPlan(existingProjects, Array.from(projectNamesToLink));
        if (plan) {
          await plugin.app.fileManager.processFrontMatter(contactFile, (cfm: Frontmatter) => {
            for (const name of plan.added) {
              const value = appendProjectLink(cfm.project, name);
              if (value !== null) cfm.project = value;
            }
          });
          new Notice(`Auto-link: project "${plan.added.join(', ')}" added to "${contactFile.basename}".`);
        }
      }

      // We only sync projects to contacts (one-way relationship).
      // The project's owner field is not automatically updated by same-file or contact references.
    }
  } catch (e) {
    console.error('Cadence: Error in syncContactProjectRelationships', e);
  } finally {
    plugin._syncInProgress = false;
  }
}

export async function handleProjectDeletion(plugin: PluginHost, file: TFile | null | undefined): Promise<void> {
  if (plugin._syncInProgress) return;
  if (!file || !file.path || !file.path.toLowerCase().endsWith('.md')) return;

  // Check if the deleted file was inside the Projects folder
  const projectFolder = ENTITIES.project ? ENTITIES.project.folder : 'Cadence/Projects';
  if (!file.path.startsWith(projectFolder + '/')) return;

  const projectName = file.basename;
  if (!projectName) return;

  // Projects can sit in sub-folders, so a deleted note there counts only
  // when no other project note of that name remains (#45).
  const remaining = listEntityFiles(plugin.app, 'project');
  if (remaining.some(f => f.path !== file.path && f.basename.toLowerCase() === projectName.toLowerCase())) return;

  try {
    plugin._syncInProgress = true;

    // Load all contact files
    const contactFiles = listEntityFiles(plugin.app, 'contact');

    for (const contactFile of contactFiles) {
      const contactCache = plugin.app.metadataCache.getFileCache(contactFile) || {};
      const contactFm = contactCache.frontmatter || {};
      const existingProjectsVal = contactFm.project;
      if (!existingProjectsVal) continue;

      const existingProjectNames = extractEntitiesFromValue(existingProjectsVal);
      const hasProject = existingProjectNames.some(p => p.toLowerCase() === projectName.toLowerCase());

      if (hasProject) {
        const remainingProjects = removeProjectLink(existingProjectNames, projectName);

        await plugin.app.fileManager.processFrontMatter(contactFile, (cfm: Frontmatter) => {
          writeProjectLinks(cfm, remainingProjects);
        });

        new Notice(`Auto-link: project "${projectName}" removed from contact "${contactFile.basename}".`);
      }
    }
  } catch (e) {
    console.error('Cadence: Error in handleProjectDeletion', e);
  } finally {
    plugin._syncInProgress = false;
  }
}
