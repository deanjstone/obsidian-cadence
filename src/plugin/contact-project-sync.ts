import { Notice, type TFile } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import type { Frontmatter } from '../types/entities';
import { createEntity, entityKeyFromFile, getFieldSuggestionSource, listEntityFiles } from '../utils/entities';
import type { PluginHost } from './host';

/* The contact↔project sync. onload runs syncContactProjectRelationships on
   every metadataCache 'changed' event and handleProjectDeletion on every
   vault 'delete'. Only contacts' `project` field is written. CadencePlugin
   keeps a one-line delegate for each. */

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

    // Helper to extract names from frontmatter values
    const extractEntitiesFromValue = (value: unknown): string[] => {
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
    };

    const isContactField = (key: string, ek: string | null) => {
      if (['owner', 'contact', 'contacts', 'with', 'assigned'].includes(key.toLowerCase())) return true;
      if (ek && ENTITIES[ek]) {
        const fdef = ENTITIES[ek].fields.find(field => field.key === key);
        if (fdef) {
          const sug = fdef.suggestionSource || getFieldSuggestionSource(fdef);
          if (sug === 'contact' || sug === 'folder:Cadence/Contacts') return true;
        }
      }
      return false;
    };

    const isProjectField = (key: string, ek: string | null) => {
      if (['project', 'projects', 'related'].includes(key.toLowerCase())) return true;
      if (ek && ENTITIES[ek]) {
        const fdef = ENTITIES[ek].fields.find(field => field.key === key);
        if (fdef) {
          const sug = fdef.suggestionSource || getFieldSuggestionSource(fdef);
          if (sug === 'project' || sug === 'folder:Cadence/Projects') return true;
        }
      }
      return false;
    };

    const changedEntityKey = entityKeyFromFile(plugin.app, changedFile);

    if (changedEntityKey === 'contact') {
      const contactLower = changedFile.basename.toLowerCase();
      const contactCache = plugin.app.metadataCache.getFileCache(changedFile) || {};
      const contactFm = contactCache.frontmatter || {};
      const existingProjectsVal = contactFm.project;
      const currentProjectsOfContact = new Set(
        extractEntitiesFromValue(existingProjectsVal).map(p => p.toLowerCase())
      );

      // Auto-create any projects in contact sheet that do not exist yet
      for (const p of currentProjectsOfContact) {
        if (!projectMap.has(p)) {
          try {
            const allFiles = plugin.app.vault.getMarkdownFiles();
            const originalName = allFiles.find(f => f.basename.toLowerCase() === p)?.basename || (p.charAt(0).toUpperCase() + p.slice(1));
            const projectFile = await createEntity(plugin.app, 'project', originalName);
            projectMap.set(p, projectFile);
            new Notice(`Fiche projet créée automatiquement pour "${originalName}".`);
          } catch (e) {
            console.error(`Cadence: Failed to auto-create project ${p}`, e);
          }
        }
      }

      // We only sync projects to contacts (one-way relationship).
      // Editing a contact sheet does not push the contact name back to project owner fields.
    }
    else if (changedEntityKey === 'project') {
      const projectLower = changedFile.basename.toLowerCase();
      const projectCache = plugin.app.metadataCache.getFileCache(changedFile) || {};
      const projectFm = projectCache.frontmatter || {};

      const projectContacts = [];
      for (const [key, val] of Object.entries(projectFm)) {
        if (key === 'type') continue;
        if (isContactField(key, 'project')) {
          projectContacts.push(...extractEntitiesFromValue(val));
        }
      }
      const currentContactsOfProject = new Set(projectContacts.map(c => c.toLowerCase()));

      // Auto-create any contacts in project sheet that do not exist yet
      for (const c of currentContactsOfProject) {
        if (!contactMap.has(c)) {
          try {
            const allFiles = plugin.app.vault.getMarkdownFiles();
            const originalName = allFiles.find(f => f.basename.toLowerCase() === c)?.basename || (c.charAt(0).toUpperCase() + c.slice(1));
            const contactFile = await createEntity(plugin.app, 'contact', originalName);
            contactMap.set(c, contactFile);
            new Notice(`Fiche contact créée automatiquement pour "${originalName}".`);
          } catch (e) {
            console.error(`Cadence: Failed to auto-create contact ${c}`, e);
          }
        }
      }

      // For each contact in the vault, check if they should be linked
      for (const [contactLower, contactFile] of contactMap.entries()) {
        const contactCache = plugin.app.metadataCache.getFileCache(contactFile) || {};
        const contactFm = contactCache.frontmatter || {};
        const existingProjectsVal = contactFm.project;
        const contactProjects = extractEntitiesFromValue(existingProjectsVal);
        const listsProject = contactProjects.some(p => p.toLowerCase() === projectLower);
        const projectListsContact = currentContactsOfProject.has(contactLower);

        if (projectListsContact && !listsProject) {
          // User manually added contact to project sheet!
          await plugin.app.fileManager.processFrontMatter(contactFile, (cfm) => {
            const currentProjects = extractEntitiesFromValue(cfm.project);
            if (!currentProjects.some(p => p.toLowerCase() === projectLower)) {
              currentProjects.push(changedFile.basename);
              if (currentProjects.length === 1) {
                cfm.project = `[[${currentProjects[0]}]]`;
              } else {
                cfm.project = currentProjects.map(p => `[[${p}]]`);
              }
            }
          });
          new Notice(`Lien automatique : Projet "${changedFile.basename}" associé au contact "${contactFile.basename}".`);
        } else if (!projectListsContact && listsProject) {
          // User removed contact from project sheet! Check if there is any other note listing both.
          let hasOtherSource = false;
          const allFiles = plugin.app.vault.getMarkdownFiles();
          for (const f of allFiles) {
            if (f.path === changedFile.path || f.path === contactFile.path) continue;
            const cache = plugin.app.metadataCache.getFileCache(f);
            if (!cache || !cache.frontmatter) continue;
            const fm = cache.frontmatter;

            const fEntityKey = entityKeyFromFile(plugin.app, f);
            const foundContacts = new Set<string>();
            const foundProjects = new Set<string>();

            if (fEntityKey === 'contact') {
              foundContacts.add(f.basename.toLowerCase());
            } else if (fEntityKey === 'project') {
              foundProjects.add(f.basename.toLowerCase());
            }

            for (const [key, val] of Object.entries(fm)) {
              if (key === 'type') continue;
              const extracted = extractEntitiesFromValue(val);
              for (const name of extracted) {
                if (!name) continue;
                const nameLower = name.toLowerCase();
                if (isContactField(key, fEntityKey) || contactMap.has(nameLower)) {
                  foundContacts.add(nameLower);
                }
                if (isProjectField(key, fEntityKey) || projectMap.has(nameLower)) {
                  foundProjects.add(nameLower);
                }
              }
            }

            if (foundContacts.has(contactLower) && foundProjects.has(projectLower)) {
              hasOtherSource = true;
              break;
            }
          }

          if (!hasOtherSource) {
            await plugin.app.fileManager.processFrontMatter(contactFile, (cfm) => {
              const currentProjects = extractEntitiesFromValue(cfm.project);
              const newProjects = currentProjects.filter(p => p.toLowerCase() !== projectLower);
              if (newProjects.length === 0) {
                delete cfm.project;
              } else if (newProjects.length === 1) {
                cfm.project = `[[${newProjects[0]}]]`;
              } else {
                cfm.project = newProjects.map(p => `[[${p}]]`);
              }
            });
            new Notice(`Lien automatique : Projet "${changedFile.basename}" dissocié du contact "${contactFile.basename}".`);
          }
        }
      }
    }
    else {
      // Vault-wide scan to build the set of valid contact-project links.
      // We exclude Contact sheets as relationship sources to prevent self-reinforcing loops.
      const validLinks = new Set<string>(); // "contact_lowercase|project_lowercase"

      const allFiles = plugin.app.vault.getMarkdownFiles();
      for (const f of allFiles) {
        const fEntityKey = entityKeyFromFile(plugin.app, f);
        if (fEntityKey === 'contact') continue;

        const cache = plugin.app.metadataCache.getFileCache(f);
        if (!cache || !cache.frontmatter) continue;
        const fm = cache.frontmatter;

        const foundContacts = new Set<string>();
        const foundProjects = new Set<string>();

        if (fEntityKey === 'project') {
          foundProjects.add(f.basename.toLowerCase());
        }

        for (const [key, val] of Object.entries(fm)) {
          if (key === 'type') continue;
          const extracted = extractEntitiesFromValue(val);
          for (const name of extracted) {
            if (!name) continue;
            const nameLower = name.toLowerCase();
            if (isContactField(key, fEntityKey) || contactMap.has(nameLower)) {
              foundContacts.add(nameLower);
            }
            if (isProjectField(key, fEntityKey) || projectMap.has(nameLower)) {
              foundProjects.add(nameLower);
            }
          }
        }

        if (foundContacts.size > 0 && foundProjects.size > 0) {
          for (const c of foundContacts) {
            for (const p of foundProjects) {
              validLinks.add(`${c}|${p}`);
            }
          }
        }
      }

      // Auto-create any referenced Contacts or Projects that do not exist yet
      for (const link of validLinks) {
        const [c, p] = link.split('|');

        let contactFile = contactMap.get(c);
        if (!contactFile) {
          try {
            const originalName = allFiles.find(f => f.basename.toLowerCase() === c)?.basename || (c.charAt(0).toUpperCase() + c.slice(1));
            contactFile = await createEntity(plugin.app, 'contact', originalName);
            contactMap.set(c, contactFile);
            new Notice(`Fiche contact créée automatiquement pour "${originalName}".`);
          } catch (e) {
            console.error(`Cadence: Failed to auto-create contact ${c}`, e);
          }
        }

        let projectFile = projectMap.get(p);
        if (!projectFile) {
          try {
            const originalName = allFiles.find(f => f.basename.toLowerCase() === p)?.basename || (p.charAt(0).toUpperCase() + p.slice(1));
            projectFile = await createEntity(plugin.app, 'project', originalName);
            projectMap.set(p, projectFile);
            new Notice(`Fiche projet créée automatiquement pour "${originalName}".`);
          } catch (e) {
            console.error(`Cadence: Failed to auto-create project ${p}`, e);
          }
        }
      }

      // Sync all Contacts according to validLinks
      for (const [contactLower, contactFile] of contactMap.entries()) {
        const contactCache = plugin.app.metadataCache.getFileCache(contactFile) || {};
        const contactFm = contactCache.frontmatter || {};
        const existingProjectsVal = contactFm.project;
        const existingProjects = extractEntitiesFromValue(existingProjectsVal);

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

        const existingLower = existingProjects.map(p => p.toLowerCase());
        const targetLower = Array.from(projectNamesToLink).map(p => p.toLowerCase());

        let needsUpdate = false;
        for (const p of existingLower) {
          if (!targetLower.includes(p)) {
            needsUpdate = true;
            break;
          }
        }
        for (const p of targetLower) {
          if (!existingLower.includes(p)) {
            needsUpdate = true;
            break;
          }
        }

        if (needsUpdate) {
          const sortedProjects = Array.from(projectNamesToLink);
          const formattedVal = sortedProjects.length === 0
            ? null
            : (sortedProjects.length === 1
              ? `[[${sortedProjects[0]}]]`
              : sortedProjects.map(p => `[[${p}]]`)
            );

          await plugin.app.fileManager.processFrontMatter(contactFile, (cfm) => {
            if (formattedVal === null) {
              delete cfm.project;
            } else {
              cfm.project = formattedVal;
            }
          });

          const added = sortedProjects.filter(p => !existingProjects.some(ep => ep.toLowerCase() === p.toLowerCase()));
          const removed = existingProjects.filter(ep => !sortedProjects.some(p => p.toLowerCase() === ep.toLowerCase()));

          if (added.length > 0) {
            new Notice(`Lien automatique : Projet "${added.join(', ')}" associé à "${contactFile.basename}".`);
          }
          if (removed.length > 0) {
            new Notice(`Lien automatique : Projet "${removed.join(', ')}" dissocié de "${contactFile.basename}".`);
          }
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

  try {
    plugin._syncInProgress = true;

    // Load all contact files
    const contactFiles = listEntityFiles(plugin.app, 'contact');

    // Helper to extract names
    const extractEntitiesFromValue = (value: unknown): string[] => {
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
    };

    for (const contactFile of contactFiles) {
      const contactCache = plugin.app.metadataCache.getFileCache(contactFile) || {};
      const contactFm = contactCache.frontmatter || {};
      const existingProjectsVal = contactFm.project;
      if (!existingProjectsVal) continue;

      const existingProjectNames = extractEntitiesFromValue(existingProjectsVal);
      const hasProject = existingProjectNames.some(p => p.toLowerCase() === projectName.toLowerCase());

      if (hasProject) {
        const remainingProjects = existingProjectNames.filter(p => p.toLowerCase() !== projectName.toLowerCase());

        await plugin.app.fileManager.processFrontMatter(contactFile, (cfm) => {
          if (remainingProjects.length === 0) {
            delete cfm.project;
          } else if (remainingProjects.length === 1) {
            cfm.project = `[[${remainingProjects[0]}]]`;
          } else {
            cfm.project = remainingProjects.map(p => `[[${p}]]`);
          }
        });

        new Notice(`Lien automatique : Projet "${projectName}" supprimé du contact "${contactFile.basename}".`);
      }
    }
  } catch (e) {
    console.error('Cadence: Error in handleProjectDeletion', e);
  } finally {
    plugin._syncInProgress = false;
  }
}
