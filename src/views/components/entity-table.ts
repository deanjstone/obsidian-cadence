import type { TFile } from 'obsidian';
import { ENTITIES } from '../../constants/entities';
import type { Entity, EntityField, EntityKey } from '../../types/entities';
import { entityValue, getFieldSuggestionSource, listEntityFiles } from '../../utils/entities';
import { fmtValue } from '../../utils/format';
import { parseLinkValues } from '../../utils/parsing';
import type { VaultNode } from '../../utils/vault';
import type { AppViewHost } from '../host';

/* Entity links and the entity table, shared by the lists, cross sections,
   reports and templates, plus the file lookup the templates use. */

export function renderEntityLinks(view: AppViewHost, parent: HTMLElement, val: unknown, targetEntityKey: string, prefix = ''): void {
  if (!val) return;
  const items = parseLinkValues(val);
  if (items.length === 0) return;
  if (prefix) parent.createSpan({ text: prefix });
  items.forEach((item, idx) => {
    if (idx > 0) parent.createSpan({ text: ', ' });

    let resolvedKey = targetEntityKey;
    if (targetEntityKey && targetEntityKey.startsWith('folder:')) {
      const folderPath = targetEntityKey.slice('folder:'.length).replace(/\/+$/, '').toLowerCase();
      const matchedKey = Object.keys(ENTITIES).find(k => ENTITIES[k].folder.replace(/\/+$/, '').toLowerCase() === folderPath);
      if (matchedKey) {
        resolvedKey = matchedKey;
      }
    }

    const link = parent.createEl('a', { text: item.display, cls: `cad-${resolvedKey}-link` });
    link.style.textDecoration = 'underline';
    link.style.cursor = 'pointer';
    link.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const targetFile = view.app.vault.getMarkdownFiles().find(f => f.basename.toLowerCase() === item.target.toLowerCase());
      if (targetFile) {
        if (ENTITIES[resolvedKey]) {
          view.openEntityDetail(resolvedKey, targetFile);
        } else {
          view.app.workspace.openLinkText(targetFile.path, '', false);
        }
      } else {
        view.app.workspace.openLinkText(item.target, '', false);
      }
    });
  });
}

export function renderOwnerLinks(view: AppViewHost, parent: HTMLElement, ownerVal: unknown, showPrefix = true): void {
  view._renderEntityLinks(parent, ownerVal, 'contact', showPrefix ? 'Owner: ' : '');
}

export function renderEntityTable(view: AppViewHost, parent: HTMLElement, entityKey: EntityKey, filteredList: Entity[], columns: string[]): void {
  const def = ENTITIES[entityKey];
  if (!def) return;

  const tableWrap = parent.createDiv({ cls: 'cad-table-wrap' });
  tableWrap.style.padding = '0';
  tableWrap.style.border = 'none';
  tableWrap.style.boxShadow = 'none';
  tableWrap.style.borderRadius = '0';
  tableWrap.style.marginTop = '0';
  tableWrap.style.overflowX = 'auto';

  const table = tableWrap.createEl('table', { cls: 'cad-table' });
  const cols = columns.map((k) => def.fields.find((f) => f.key === k)).filter(Boolean) as EntityField[];

  const thead = table.createEl('thead');
  const trh = thead.createEl('tr');
  cols.forEach((f) => trh.createEl('th', { text: f.label }));

  const tbody = table.createEl('tbody');
  filteredList.forEach((e) => {
    const tr = tbody.createEl('tr', { cls: 'cad-row' });
    cols.forEach((f, i) => {
      const td = tr.createEl('td');
      const val = entityValue(e, f.key, def);
      const formatted = fmtValue(val, f.type);
      const primaryField = def.fields.find(fd => fd.primary) || def.fields[0];
      const hasPrimaryCol = cols.some(c => c.key === primaryField.key);
      const isPrimaryCol = hasPrimaryCol ? (f.key === primaryField.key) : (i === 0);
      if (isPrimaryCol) {
        const a = td.createEl('a', { cls: 'cad-row-primary', text: formatted || e.basename });
        a.style.fontWeight = 'bold';
        a.style.textDecoration = 'underline';
        a.style.cursor = 'pointer';
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          view.openEntityDetail(entityKey, e.file);
        });
      } else if (f.key === 'owner' || f.key === 'assigned') {
        view._renderOwnerLinks(td, val, false);
      } else {
        const sugSrc = f.suggestionSource || getFieldSuggestionSource(f);
        if (f.type === 'multitext' && sugSrc && sugSrc !== 'none' && sugSrc !== 'tags' && sugSrc !== 'history') {
          const targetSrc = sugSrc === 'history' ? 'folder:Cadence/Shared' : sugSrc;
          view._renderEntityLinks(td, val, targetSrc);
        } else if (f.key === 'company') {
          view._renderEntityLinks(td, val, 'company');
        } else if (f.key === 'partner') {
          view._renderEntityLinks(td, val, 'partner');
        } else if (f.key === 'contact' || f.key === 'contacts' || f.key === 'with') {
          view._renderEntityLinks(td, val, 'contact');
        } else if (f.key === 'related') {
          view._renderEntityLinks(td, val, 'project');
        } else if (f.key === 'stage' && val) {
          const span = td.createSpan({ cls: `cad-pill cad-pill-${(val as string).toLowerCase()}`, text: formatted });
          span.style.fontSize = '10px';
          span.style.padding = '2px 6px';
        } else {
          td.setText(formatted || '—');
        }
      }
    });
  });
}

export function getEntityFiles(view: AppViewHost, entityKey: EntityKey | 'daily'): TFile[] {
  if (entityKey === 'daily') {
    const folderPath = view.plugin.settings.dailyNoteFolder || 'daily';
    const folder = view.app.vault.getAbstractFileByPath(folderPath) as VaultNode | null;
    if (!folder || !folder.children) return [];
    const out: TFile[] = [];
    const walk = (node: VaultNode) => {
      for (const child of node.children!) {
        if (child.children) walk(child);
        else if (typeof child.path === 'string' && child.path.toLowerCase().endsWith('.md')) {
          out.push(child as TFile);
        }
      }
    };
    walk(folder);
    return out;
  } else {
    return listEntityFiles(view.app, entityKey);
  }
}
