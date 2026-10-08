import type { DailyNoteSettings } from '../types/settings';

export interface LinkValue {
  target: string;
  display: string;
}

/* Normalise a frontmatter value (string, wiki-link string or array) into
   link targets with their display aliases. */
export function parseLinkValues(val: unknown): LinkValue[] {
  if (val == null || val === '') return [];
  let rawItems: string[] = [];
  if (Array.isArray(val)) {
    rawItems = val.map(v => String(v).trim());
  } else {
    const str = String(val).trim();
    if (str.includes('[[')) {
      const regex = /\[\[(.*?)\]\]/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(str)) !== null) {
        if (match[1].trim()) {
          rawItems.push(match[1].trim());
        }
      }
      if (rawItems.length === 0 && str) {
        rawItems = str.split(',').map(s => s.trim()).filter(Boolean);
      }
    } else {
      rawItems = str.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return rawItems.map(item => {
    let clean = item.replace(/^\[\[|\]\]$/g, '').trim();
    let display = clean;
    if (clean.includes('|')) {
      const parts = clean.split('|');
      clean = parts[0].trim();
      display = parts[1].trim();
    }
    return { target: clean, display: display };
  }).filter(item => item.target);
}

/* Parse the H2 sections of a markdown file into a map. */
export function parseH2Sections(content: string): Record<string, string> {
  const lines = content.split('\n');
  const sections: Record<string, string> = {};
  let cur: string | null = null, buf: string[] = [];
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      if (cur) sections[cur] = buf.join('\n');
      cur = line.replace(/^##\s+/, '').trim();
      buf = [];
    } else if (cur) {
      buf.push(line);
    }
  }
  if (cur) sections[cur] = buf.join('\n');
  return sections;
}

export interface HeaderKey {
  cleanLabel: string;
  tag: string;
}

export function parseHeaderKey(key: string): HeaderKey {
  const match = key.match(/(.*?)(#[\w\-]+)$/);
  if (match) {
    return {
      cleanLabel: match[1].trim(),
      tag: match[2].trim()
    };
  }
  return {
    cleanLabel: key.trim(),
    tag: ''
  };
}

export interface Milestone {
  done: boolean;
  date: Date | null;
  title: string;
  notes: string;
}

/* Input accepted by stringifyMilestones — callers build these from form
   state, so every field may be missing. */
export interface MilestoneInput {
  done?: boolean;
  date?: unknown;
  title?: string;
  notes?: string;
}

/* Parse milestone lines: `- [x] 2026-05-15 — Title`
   Indented (1-tab or 1-4 spaces) non-empty lines that follow a milestone are
   treated as that milestone's free-form notes.
   Returns array of { done, date (Date|null), title, notes }. */
export function parseMilestones(text: string | null | undefined): Milestone[] {
  if (!text) return [];
  const lines = text.split('\n');
  const items: Milestone[] = [];
  let current: Milestone | null = null;
  for (const line of lines) {
    if (/^\s*-\s\[(x|X| )\]\s/.test(line)) {
      if (current) items.push(current);
      const done = / \[(x|X)\] /.test(line);
      const rest = line.replace(/^\s*-\s\[(x|X| )\]\s/, '');
      const m = rest.match(/^(\d{4}-\d{2}-\d{2})\s*(?:[—–-]\s*)?(.+)?$/);
      const date = m && m[1] ? new Date(m[1]) : null;
      const title = m ? (m[2] || '').trim() : rest.trim();
      current = {
        done,
        date: (date && !isNaN(date.getTime())) ? date : null,
        title,
        notes: '',
      };
    } else if (current && line.trim() && /^[ \t]/.test(line)) {
      // Indented non-empty line → child note for the current milestone.
      // Strip up to 4 leading spaces or one tab; preserve any deeper indent.
      const stripped = line.replace(/^( {1,4}|\t)/, '');
      current.notes = current.notes ? current.notes + '\n' + stripped : stripped;
    }
    // Empty / non-indented non-milestone lines are ignored — they shouldn't
    // appear inside the Milestones section but we won't choke on them.
  }
  if (current) items.push(current);
  return items;
}

/* Format a milestone array back into markdown lines.
   Notes are emitted as 4-space-indented child lines under the milestone. */
export function stringifyMilestones(items: MilestoneInput[] | null | undefined): string {
  if (!items || !items.length) return '';
  return items.map((m) => {
    const box = m.done ? '- [x] ' : '- [ ] ';
    const date = m.date instanceof Date && !isNaN(m.date.getTime())
      ? `${m.date.getFullYear()}-${String(m.date.getMonth() + 1).padStart(2, '0')}-${String(m.date.getDate()).padStart(2, '0')} `
      : '';
    const sep = (date && m.title) ? '— ' : '';
    let line = `${box}${date}${sep}${m.title || ''}`.trimEnd();
    if (m.notes && m.notes.trim()) {
      const noteLines = m.notes.split('\n').map((l) => '    ' + l).join('\n');
      line += '\n' + noteLines;
    }
    return line;
  }).join('\n');
}

export interface TaskItem {
  done: boolean;
  title: string;
}

/* Plain task lines (no date prefix) — for the Tasks H2 section. */
export function parseTasksList(text: string | null | undefined): TaskItem[] {
  if (!text) return [];
  return text.split('\n')
    .filter((l) => /^\s*-\s\[(x|X| )\]\s/.test(l))
    .map((l) => ({
      done: / \[(x|X)\] /.test(l),
      title: l.replace(/^\s*-\s\[(x|X| )\]\s/, ''),
    }));
}

export function stringifyTasks(items: Array<Partial<TaskItem>> | null | undefined): string {
  if (!items || !items.length) return '';
  return items.map((t) => `${t.done ? '- [x] ' : '- [ ] '}${t.title || ''}`).join('\n');
}

export interface DailySections {
  tasks: string[];
  journal: string;
  raw: string;
}

export function parseSections(content: string, settings: Pick<DailyNoteSettings, 'tasksHeading' | 'journalHeading'>): DailySections {
  const lines = content.split('\n');
  const tasks: string[] = [];
  let journal = '';
  let mode: 'tasks' | 'journal' | null = null;
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      const stripped = line.trim();
      if (stripped === settings.tasksHeading) { mode = 'tasks'; continue; }
      if (stripped === settings.journalHeading) { mode = 'journal'; continue; }
      mode = null;
      continue;
    }
    if (mode === 'tasks') {
      if (/^\s*-\s\[(x|X| )\]\s/.test(line)) tasks.push(line);
    } else if (mode === 'journal') {
      journal += (journal ? '\n' : '') + line;
    }
  }
  return { tasks, journal: journal.replace(/\s+$/, ''), raw: content };
}

export function replaceSection(content: string, heading: string, newBody: string): string {
  const lines = content.split('\n');
  const headIdx = lines.findIndex((l) => l.trim() === heading);
  if (headIdx === -1) {
    return content.replace(/\s*$/, '') + `\n\n${heading}\n${newBody}\n`;
  }
  let endIdx = lines.length;
  for (let i = headIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { endIdx = i; break; }
  }
  const before = lines.slice(0, headIdx + 1);
  const after = lines.slice(endIdx);
  const bodyLines = newBody.split('\n');
  return [...before, ...bodyLines, '', ...after].join('\n').replace(/\n{3,}/g, '\n\n');
}
