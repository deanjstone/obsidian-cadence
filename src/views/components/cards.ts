import type { TFile } from 'obsidian';
import type { AppViewHost } from '../host';

/* The titled row card shared by the CRM dashboard, PRM analytics and the
   four reports. */

/** A meta fragment: plain text, or entity links when entityKey is set. */
export interface DashMetaPart {
  text?: string;
  entityKey?: string;
}

export interface DashCardRow {
  title?: string;
  /** When set, the title is rendered as links to this entity. */
  titleEntityKey?: string;
  /** Used only when metaParts is absent. */
  meta?: string;
  metaParts?: DashMetaPart[];
  /** When set, clicking the row opens the file's detail form. */
  file?: TFile;
}

export function dashCardSection(view: AppViewHost, parent: HTMLElement, title: string, rows: DashCardRow[] | null | undefined, emptyMsg?: string): void {
  const card = parent.createDiv({ cls: 'cad-dash-card' });
  card.createDiv({ cls: 'cad-dash-card-head' }).createDiv({ cls: 'cad-dash-card-title', text: title });
  const body = card.createDiv({ cls: 'cad-dash-card-body' });
  if (!rows || !rows.length) {
    body.createDiv({ cls: 'cad-empty', text: emptyMsg || 'Nothing here yet.' });
    return;
  }
  rows.forEach((r) => {
    const row = body.createDiv({ cls: 'cad-dash-row' });

    const titleDiv = row.createDiv({ cls: 'cad-dash-row-title' });
    if (r.titleEntityKey) {
      view._renderEntityLinks(titleDiv, r.title, r.titleEntityKey);
    } else {
      titleDiv.setText(r.title || '');
    }

    const metaDiv = row.createDiv({ cls: 'cad-dash-row-meta' });
    if (r.metaParts) {
      r.metaParts.forEach((part) => {
        if (part.entityKey) {
          view._renderEntityLinks(metaDiv, part.text, part.entityKey);
        } else {
          metaDiv.createSpan({ text: part.text || '' });
        }
      });
    } else {
      metaDiv.setText(r.meta || '');
    }

    if (r.file) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => view.openEntityDetailFromFile(r.file!));
    }
  });
}
