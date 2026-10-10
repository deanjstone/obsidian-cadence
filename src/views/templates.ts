import { Notice, TFile, setIcon } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceChartSectionModal } from '../modals/chart-section';
import { CadenceCrossSectionModal } from '../modals/cross-section';
import { CadencePromptModal } from '../modals/prompt';
import type { EntityDef, EntityKey } from '../types/entities';
import type { ChartSectionConfig, CrossSectionConfig } from '../types/modals';
import { ymd } from '../utils/dates';
import { splitSectionColumns } from '../utils/field-edit';
import { appendSection, parseH2Sections, parseHeaderKey, type HeaderKey } from '../utils/parsing';
import { DAILY_TEMPLATE_CONTENT, defaultTemplateContent } from '../utils/templates';
import { ensureFolderSync } from '../utils/vault';
import type { FlashSaved } from './components/sections';
import type { AppViewHost } from './host';

/* A custom entity may carry an icon; the core defs have none. TODO: confirm shape */
type TemplateTileDef = EntityDef & { icon?: string };

/* The Saved badge keeps its hide timer on the element. */
type SavedBadge = HTMLSpanElement & { _t?: ReturnType<typeof setTimeout> };

/* The Templates surface: the dashboard of template tiles, the template
   builder (renderTemplateDetail) with its section controls, and the
   propagation of added and deleted sections to the entity's notes. */

export async function renderTemplatesDashboard(view: AppViewHost, root: HTMLElement): Promise<void> {
  root.addClass('cadence-dashboard');
  root.addClass('cadence-projects');

  view._renderPageHeader(root, 'Templates Dashboard', 'Manage and visually edit the templates for your entities');

  const grid = root.createDiv({
    cls: 'cad-proj-grid'
  });

  // Render Daily Note Template Card
  {
    const templatesFolder = 'Cadence/Templates';
    await ensureFolderSync(view.app, templatesFolder);
    const dailyTemplatePath = `${templatesFolder}/daily.md`;
    const dailyTFile = view.app.vault.getAbstractFileByPath(dailyTemplatePath);
    const exists = !!(dailyTFile && dailyTFile instanceof TFile);

    const card = grid.createDiv({
      cls: 'cad-proj-card cad-template-tile'
    });
    card.dataset.entity = 'daily';

    const head = card.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;' } });

    const infoWrap = head.createDiv({ attr: { style: 'display: flex; align-items: center; gap: 12px;' } });
    const iconSpan = infoWrap.createSpan({ cls: 'cad-template-tile-icon' });
    try { setIcon(iconSpan, 'sun'); } catch (_) { iconSpan.setText('☀️'); }

    const titleInfo = infoWrap.createDiv();
    titleInfo.createDiv({ text: 'PLANNER', attr: { style: 'font-weight: 700; font-size: 0.7rem; letter-spacing: 0.12em; color: var(--text-muted);' } });
    titleInfo.createEl('h3', { text: 'Daily Note', attr: { style: 'margin: 2px 0 0 0; font-size: 1.15em; font-weight: 700;' } });

    const badge = head.createSpan(templateBadge(exists));
    badge.style.fontSize = '0.7em';
    badge.style.padding = '3px 8px';

    card.createDiv({
      text: `Target Folder: ${view.plugin.settings.dailyNoteFolder || 'daily'}/`,
      attr: { style: 'font-size: 0.8em; font-family: monospace; color: var(--text-muted); background: var(--background-secondary); padding: 4px 8px; border-radius: 4px; margin-bottom: 12px; border: 1px solid var(--background-modifier-border);' }
});

    const desc = card.createDiv({ text: `Defines properties and sections layout for each new daily note created in the planner.`, attr: { style: 'font-size: 0.85em; color: var(--text-muted); margin-bottom: 18px; flex: 1; line-height: 1.4;' } });

    const actions = card.createDiv({ attr: { style: 'display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid var(--border-color); padding-top: 14px; margin-top: auto;' } });

    if (exists) {
      const editBtn = actions.createEl('button', { cls: 'cad-btn primary', text: 'Visual Editor' });
      editBtn.style.padding = '5px 12px';
      editBtn.style.height = 'auto';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        view.openTemplateDetail('daily', dailyTFile);
      });

      const openBtn = actions.createEl('button', { cls: 'cad-btn', text: 'Raw Note 📝' });
      openBtn.style.padding = '5px 12px';
      openBtn.style.height = 'auto';
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        view.app.workspace.openLinkText(dailyTemplatePath, '', false);
      });
    } else {
      const resetBtn = actions.createEl('button', {
        cls: 'cad-btn primary',
        text: 'Enable Custom'
      });
      resetBtn.style.padding = '5px 12px';
      resetBtn.style.height = 'auto';
      resetBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await view.app.vault.create(dailyTemplatePath, DAILY_TEMPLATE_CONTENT);
        new Notice('Daily Note template successfully enabled.');
        view.render();
      });
    }

    card.addEventListener('click', () => {
      if (exists) view.openTemplateDetail('daily', dailyTFile);
    });
  }

  for (const [entityKey, def] of Object.entries(ENTITIES)) {
    const templatesFolder = 'Cadence/Templates';
    await ensureFolderSync(view.app, templatesFolder);

    let foundPath: string | null = null;
    let exists = false;
    const pathsToTry = templatePathCandidates(templatesFolder, entityKey, def);

    for (const p of pathsToTry) {
      const tFile = view.app.vault.getAbstractFileByPath(p);
      if (tFile && tFile instanceof TFile) {
        exists = true;
        foundPath = p;
        break;
      }
    }

    // Elegant premium tile layout matching project notes exactly, with dynamic entity color bands
    const card = grid.createDiv({
      cls: 'cad-proj-card cad-template-tile'
    });
    card.dataset.entity = entityKey;

    const head = card.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;' } });

    const infoWrap = head.createDiv({ attr: { style: 'display: flex; align-items: center; gap: 12px;' } });
    const iconSpan = infoWrap.createSpan({ cls: 'cad-template-tile-icon' });
    try { setIcon(iconSpan, (def as TemplateTileDef).icon || 'file-text'); } catch (_) { iconSpan.setText('📝'); }

    const titleInfo = infoWrap.createDiv();
    titleInfo.createDiv({ text: def.label.toUpperCase(), attr: { style: 'font-weight: 700; font-size: 0.7rem; letter-spacing: 0.12em; color: var(--text-muted);' } });
    titleInfo.createEl('h3', { text: def.plural, attr: { style: 'margin: 2px 0 0 0; font-size: 1.15em; font-weight: 700;' } });

    const badge = head.createSpan(templateBadge(exists));
    badge.style.fontSize = '0.7em';
    badge.style.padding = '3px 8px';

    card.createDiv({
      text: `Target Folder: ${def.folder}/`,
      attr: { style: 'font-size: 0.8em; font-family: monospace; color: var(--text-muted); background: var(--background-secondary); padding: 4px 8px; border-radius: 4px; margin-bottom: 12px; border: 1px solid var(--background-modifier-border);' }
});

    const desc = card.createDiv({
      text: `Defines properties and sections layout for each new ${def.label.toLowerCase()} item created.`,
      attr: { style: 'font-size: 0.85em; color: var(--text-muted); margin-bottom: 18px; flex: 1; line-height: 1.4;' }
});

    const actions = card.createDiv({ attr: { style: 'display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid var(--border-color); padding-top: 14px; margin-top: auto;' } });

    if (exists) {
      const editBtn = actions.createEl('button', { cls: 'cad-btn primary', text: 'Visual Editor' });
      editBtn.style.padding = '5px 12px';
      editBtn.style.height = 'auto';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tFile = view.app.vault.getAbstractFileByPath(foundPath!);
        if (tFile) view.openTemplateDetail(entityKey, tFile as TFile);
      });

      const openBtn = actions.createEl('button', { cls: 'cad-btn', text: 'Raw Note 📝' });
      openBtn.style.padding = '5px 12px';
      openBtn.style.height = 'auto';
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tFile = view.app.vault.getAbstractFileByPath(foundPath!);
        if (tFile) view.app.workspace.openLinkText(tFile.path, '', false);
      });
    }

    const resetBtn = actions.createEl('button', {
      cls: 'cad-btn',
      text: exists ? 'Reset to Default' : 'Enable Custom'
    });
    resetBtn.style.padding = '5px 12px';
    resetBtn.style.height = 'auto';
    if (!exists) resetBtn.classList.add('primary');
    resetBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const templateContent = defaultTemplateContent(entityKey);

      const targetPath = `${templatesFolder}/${entityKey}.md`;
      let tFile = view.app.vault.getAbstractFileByPath(targetPath);
      if (tFile && tFile instanceof TFile) {
        if (!confirm(`Are you sure you want to reset the template for ${def.label}? Your visual changes will be overwritten.`)) return;
        await view.app.vault.modify(tFile, templateContent);
        new Notice(`Template reset for ${def.label}.`);
      } else {
        await view.app.vault.create(targetPath, templateContent);
        new Notice(`Template successfully enabled for ${def.label}.`);
      }
      view.render();
    });

    // Clicking on the tile anywhere also triggers visual editor if custom template exists
    card.addEventListener('click', () => {
      const tFile = foundPath ? view.app.vault.getAbstractFileByPath(foundPath) : null;
      if (tFile) {
        view.openTemplateDetail(entityKey, tFile as TFile);
      }
    });
  }
}

export async function renderTemplateDetail(view: AppViewHost, root: HTMLElement, entityKey: string, file: TFile | null): Promise<void> {
  root.addClass('cadence-project-detail');
  const def = templateDetailDef(entityKey);
  if (!file) { view.closeEntityDetail(); return; }

  const content = await view.app.vault.read(file);
  const sections = parseH2Sections(content);
  const sectionKeys = Object.keys(sections);

  /* Header */
  const head = root.createDiv({ cls: 'cad-detail-header' });
  const headLeft = head.createDiv({ cls: 'cad-detail-header-left' });
  const back = headLeft.createEl('button', { cls: 'cad-btn cad-detail-back', text: '← Templates' });
  back.addEventListener('click', () => view.closeEntityDetail());

  const breadcrumb = headLeft.createDiv({ cls: 'cad-detail-breadcrumb' });
  breadcrumb.createSpan({ cls: 'cad-eyebrow', text: 'TEMPLATE BUILDER' });
  breadcrumb.createSpan({ cls: 'cad-detail-title', text: def.label });
  breadcrumb.createDiv({ cls: 'cad-detail-path', text: file.path });

  const headRight = head.createDiv({ cls: 'cad-detail-header-right' });
  const savedBadge = headRight.createSpan({ cls: 'cad-detail-saved', text: '' });
  const flashSaved = () => {
    savedBadge.setText('Saved');
    savedBadge.addClass('show');
    clearTimeout((savedBadge as SavedBadge)._t);
    (savedBadge as SavedBadge)._t = setTimeout(() => savedBadge.removeClass('show'), 1400);
  };

  const openNote = headRight.createEl('button', { cls: 'cad-btn', text: 'View Raw Note 📝' });
  openNote.addEventListener('click', () => view.app.workspace.openLinkText(file.path, '', false));

  const deleteBtn = headRight.createEl('button', { cls: 'cad-btn cad-btn-danger', text: 'Delete' });
  deleteBtn.addEventListener('click', async () => {
    if (!confirm(`Delete this custom template? Cadence will fall back to using the default structure.`)) return;
    try {
      await view.app.vault.trash(file, true);
      new Notice(`Custom template deleted.`);
      view.closeEntityDetail();
    } catch (e) {
      new Notice(`Error: ${(e as Error).message}`);
    }
  });

  /* Two-column body — same layout as a real fiche */
  const cols = root.createDiv({ cls: 'cad-pd-cols' });
  const left = cols.createDiv({ cls: 'cad-pd-col' });
  const right = cols.createDiv({ cls: 'cad-pd-col' });

  const { left: leftKeys, right: rightKeys } = splitSectionColumns(sectionKeys);

  // For each left-column section: render live widget + delete button
  leftKeys.forEach((rawKey) => {
    view._renderTemplateSectionWithDelete(left, file, sections, rawKey, flashSaved);
  });

  // For each right-column section: render live widget + delete button
  rightKeys.forEach((rawKey) => {
    view._renderTemplateSectionWithDelete(right, file, sections, rawKey, flashSaved);
  });

  /* Toolbar for adding sections */
  const toolbar = root.createDiv({ attr: { style: 'margin-top: 32px; margin-bottom: 48px; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px; border-top: 1px solid var(--border-color);' } });
  toolbar.createDiv({ text: '➕ ADD BLOCK TO TEMPLATE', attr: { style: 'font-weight: 700; font-size: 0.75rem; letter-spacing: 0.15em; color: var(--text-muted);' } });

  const btnRow = toolbar.createDiv({ attr: { style: 'display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;' } });

  /* cleanTitle is null when the title prompt is cancelled: write nothing. */
  const addSectionHelper = async (cleanTitle: string | null, tag: string, defaultBody = '') => {
    if (!cleanTitle) return;
    const curContent = await view.app.vault.read(file);
    const nextContent = appendTemplateSection(curContent, cleanTitle, tag, defaultBody);
    await view.app.vault.modify(file, nextContent);
    new Notice(`Section "${cleanTitle}" added to template.`);
    await view._propagateTemplateSectionAdd(entityKey, cleanTitle as string, tag, defaultBody);
    view.render();
  };

  const addTextBtn = btnRow.createEl('button', { cls: 'cad-btn', text: '📝 Text Area' });
  addTextBtn.addEventListener('click', () => {
    new CadencePromptModal(view.app, {
      title: 'New Text Section',
      placeholder: 'Enter text section title:',
      defaultValue: 'Notes',
      cta: 'Add Block',
      onSubmit: (title) => { addSectionHelper(title, '#notes', '_Enter your notes here..._'); }
    }).open();
  });

  const addTasksBtn = btnRow.createEl('button', { cls: 'cad-btn', text: '📋 Task List' });
  addTasksBtn.addEventListener('click', () => {
    new CadencePromptModal(view.app, {
      title: 'New Task List Block',
      placeholder: 'Enter task list section title:',
      defaultValue: 'Tasks',
      cta: 'Add Block',
      onSubmit: (title) => { addSectionHelper(title, '#tasks', '- [ ] First task in template'); }
    }).open();
  });

  const addMilestonesBtn = btnRow.createEl('button', { cls: 'cad-btn', text: '📅 Milestones / Timeline' });
  addMilestonesBtn.addEventListener('click', () => {
    new CadencePromptModal(view.app, {
      title: 'New Milestones Block',
      placeholder: 'Enter milestones section title:',
      defaultValue: 'Milestones',
      cta: 'Add Block',
      onSubmit: (title) => {
        const today = ymd(new Date());
        addSectionHelper(title, '#milestones', `- [ ] ${today} — First milestone in template`);
      }
    }).open();
  });

  const addCrossBtn = btnRow.createEl('button', { cls: 'cad-btn', text: '🔗 Cross-Linked Data' });
  addCrossBtn.addEventListener('click', () => {
    new CadenceCrossSectionModal(view.app, entityKey, async (config) => {
      const block = crossSectionBlock(config);
      new CadencePromptModal(view.app, {
        title: 'New Cross-Linked Section',
        placeholder: 'Enter section title:',
        defaultValue: block.title,
        cta: 'Add Block',
        onSubmit: (title) => {
          addSectionHelper(title, block.tag, '');
        }
      }).open();
    }).open();
  });

  const addChartBtn = btnRow.createEl('button', { cls: 'cad-btn', text: '📊 Analytics Chart' });
  addChartBtn.addEventListener('click', () => {
    new CadenceChartSectionModal(view.app, entityKey, (config) => {
      const block = chartSectionBlock(config);
      new CadencePromptModal(view.app, {
        title: 'New Analytics Chart',
        placeholder: 'Enter chart section title:',
        defaultValue: block.title,
        cta: 'Add Chart',
        onSubmit: (title) => { addSectionHelper(title, block.tag, ''); }
      }).open();
    }).open();
  });
}

export function renderTemplateSectionWithDelete(
  view: AppViewHost, parent: HTMLElement, file: TFile, sections: Record<string, string>, rawKey: string,
  flashSaved?: FlashSaved, allRawKeys?: string[],
): void {
  const entityKey = templateEntityKey(file.basename);
  const { cleanLabel, tag } = parseHeaderKey(rawKey);

  // Outer wrapper — draggable to support reordering
  const wrap = parent.createDiv({ attr: { style: 'position: relative; margin-bottom: 12px; transition: transform 0.2s ease;' } });

  // Enable full card dragging for reordering
  wrap.draggable = true;
  wrap.addEventListener('dragstart', (ev) => {
    wrap.style.opacity = '0.5';
    ev.dataTransfer!.effectAllowed = 'move';
    ev.dataTransfer!.setData('text/cadence-template-section', rawKey);
  });
  wrap.addEventListener('dragend', () => {
    wrap.style.opacity = '1';
    wrap.removeClass('drag-over');
  });

  wrap.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    ev.dataTransfer!.dropEffect = 'move';
    wrap.addClass('drag-over');
    wrap.style.border = '2px dashed var(--interactive-accent)';
    wrap.style.borderRadius = '6px';
  });
  wrap.addEventListener('dragleave', () => {
    wrap.removeClass('drag-over');
    wrap.style.border = 'none';
    wrap.style.borderRadius = '0';
  });
  wrap.addEventListener('drop', async (ev) => {
    ev.preventDefault();
    wrap.removeClass('drag-over');
    wrap.style.border = 'none';
    wrap.style.borderRadius = '0';

    const draggedRawKey = ev.dataTransfer!.getData('text/cadence-template-section');
    if (!draggedRawKey || draggedRawKey === rawKey) return;

    const curContent = await view.app.vault.read(file);
    const nextContent = moveTemplateSection(curContent, draggedRawKey, rawKey);
    if (nextContent === null) return;

    await view.app.vault.modify(file, nextContent);
    view.render();
  });

  // Render the actual live widget
  view._renderDynamicH2Section(wrap, file, sections, rawKey, flashSaved);

  // Grab the card head injected by the widget renderer
  const cardHead = wrap.querySelector('.cad-pd-card-head');
  if (!cardHead) return;

  // ── Controls row appended to the right of the card head ──
  const ctrlRow = cardHead.createDiv({ attr: { style: 'display: flex; align-items: center; gap: 8px; margin-left: 8px; flex-shrink: 0;' } });

  // --- Drag Handle ---
  const grip = ctrlRow.createDiv({ attr: { style: 'cursor: grab; display: flex; align-items: center; justify-content: center; color: var(--text-muted); opacity: 0.7; padding: 2px 4px;' } });
  grip.title = 'Drag card to reorder';
  try { setIcon(grip, 'grip-vertical'); } catch (_) { }

  // --- Delete button ---
  const delBtn = ctrlRow.createEl('button', { text: '×', attr: { style: 'color: var(--text-error); padding: 0 4px; font-weight: bold; background: transparent; border: none; font-size: 1.25em; cursor: pointer;' } });
  delBtn.title = `Remove section "${cleanLabel}" from template`;
  delBtn.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    const usedFiles = await view._getFilesUsingTemplateSection(entityKey, rawKey);
    if (!confirm(deleteSectionMessage(cleanLabel, usedFiles.map(f => f.basename)))) return;

    const curContent = await view.app.vault.read(file);
    const nextContent = removeTemplateSection(curContent, rawKey);
    if (nextContent !== null) {
      await view.app.vault.modify(file, nextContent);
      await view._propagateTemplateSectionDelete(entityKey, rawKey);
      new Notice(`Section "${cleanLabel}" removed.`);
      view.render();
    }
  });
}

export async function getFilesUsingTemplateSection(view: AppViewHost, entityKey: EntityKey | 'daily', rawKey: string): Promise<TFile[]> {
  const files = view._getEntityFiles(entityKey);
  const notes: Array<TemplateNote<TFile>> = [];
  for (const file of files) {
    notes.push({ file, content: await view.app.vault.read(file) });
  }
  return filesUsingTemplateSection(notes, rawKey);
}

export async function propagateTemplateSectionAdd(
  view: AppViewHost, entityKey: EntityKey | 'daily', cleanTitle: string, tag: string, defaultBody = '',
): Promise<void> {
  const files = view._getEntityFiles(entityKey);
  for (const file of files) {
    const content = await view.app.vault.read(file);
    const nextContent = propagateSectionAdd(content, { cleanTitle, tag, defaultBody });
    if (nextContent !== null) await view.app.vault.modify(file, nextContent);
  }
}

export async function propagateTemplateSectionDelete(view: AppViewHost, entityKey: EntityKey | 'daily', rawKey: string): Promise<void> {
  const files = view._getEntityFiles(entityKey);
  for (const file of files) {
    const content = await view.app.vault.read(file);
    const nextContent = propagateSectionDelete(content, rawKey);
    if (nextContent !== null) await view.app.vault.modify(file, nextContent);
  }
}

/* ── Pure seams ── */

/* Where the dashboard looks for an entity's template, in order: the key,
   the label and the plural, then the same three lower-cased. */
export function templatePathCandidates(folder: string, entityKey: string, def: Pick<EntityDef, 'label' | 'plural'>): string[] {
  return [
    `${folder}/${entityKey}.md`,
    `${folder}/${def.label}.md`,
    `${folder}/${def.plural}.md`,
    `${folder}/${entityKey.toLowerCase()}.md`,
    `${folder}/${def.label.toLowerCase()}.md`,
    `${folder}/${def.plural.toLowerCase()}.md`
  ];
}

/* The entity a template file is for, from its basename: an entity key,
   label or plural (any case, as templatePathCandidates finds them), or
   'daily'. An unknown basename is returned as-is. */
export function templateEntityKey(basename: string): EntityKey | 'daily' {
  const name = basename.toLowerCase();
  if (name === 'daily') return 'daily';
  const match = Object.entries(ENTITIES).find(([key, def]) =>
    [key, def.label, def.plural].some(n => n.toLowerCase() === name));
  return match ? match[0] : basename;
}

/* A tile's status pill. */
export function templateBadge(exists: boolean): { cls: string; text: string } {
  return {
    cls: exists ? 'cad-pill cad-pill-active' : 'cad-pill cad-pill-backlog',
    text: exists ? 'Active Template' : 'Default'
  };
}

/* The builder's entity def; a key with no def (the daily template) is a Daily Note. */
export function templateDetailDef(entityKey: string): Pick<EntityDef, 'label' | 'plural' | 'fields'> {
  return ENTITIES[entityKey] || { label: 'Daily Note', plural: 'Daily Notes', fields: [] };
}

/* A cross-linked block's tag and suggested title. */
export function crossSectionBlock(config: CrossSectionConfig): { tag: string; title: string } {
  return {
    tag: `#cross-${config.targetEntity}-${config.linkField}-${config.viewType}`,
    title: `Related ${ENTITIES[config.targetEntity]?.plural || 'Links'}`,
  };
}

/* A chart block's tag and suggested title. */
export function chartSectionBlock(config: ChartSectionConfig): { tag: string; title: string } {
  return {
    tag: `#chart-${config.targetEntity}-${config.linkField}-${config.groupField}-${config.style}`,
    title: `${ENTITIES[config.targetEntity]?.plural || config.targetEntity} by ${config.groupField}`,
  };
}

/* A section's H2 line; a blank tag leaves no trailing space. */
export function templateHeader(cleanTitle: string, tag: string): string {
  return `## ${cleanTitle} ${tag}`.trim();
}

/* Append a section to a template. Flagged: it does not check for an
   existing section of the same name. */
export function appendTemplateSection(content: string, cleanTitle: string, tag: string, defaultBody = ''): string {
  return appendSection(content, templateHeader(cleanTitle, tag), defaultBody);
}

/** A section added to a template, as propagated to the entity's notes. */
export interface TemplateSection {
  cleanTitle: string;
  tag: string;
  defaultBody?: string;
}

/* Same section: the labels and the tags both match, case-insensitively. A
   same-named section with another tag, or none, is the user's own. */
function sameSection(key: string, other: HeaderKey): boolean {
  const { cleanLabel, tag } = parseHeaderKey(key);
  return cleanLabel.toLowerCase() === other.cleanLabel.toLowerCase()
    && tag.toLowerCase() === other.tag.toLowerCase();
}

/* Remove lines[idx] and everything up to the next H2 line, in place. A
   last section keeps the note's final newline. */
function spliceSection(lines: string[], idx: number): void {
  let endIdx = lines.length;
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { endIdx = i; break; }
  }
  if (endIdx === lines.length && idx > 0 && lines[idx - 1] !== '' && lines[endIdx - 1] === '') endIdx--;
  lines.splice(idx, endIdx - idx);
}

/* Propagate an added section to one note: append it, unless the note has
   the same H2 section (name and tag). null = no change, as for a missing
   or blank title (a cancelled prompt). */
export function propagateSectionAdd(content: string, section: TemplateSection): string | null {
  if (!section.cleanTitle?.trim()) return null;
  const sections = parseH2Sections(content);
  const target = parseHeaderKey(templateHeader(section.cleanTitle, section.tag).replace(/^##\s+/, ''));
  const exists = Object.keys(sections).some(k => sameSection(k, target));
  if (exists) return null;
  return appendSection(content, templateHeader(section.cleanTitle, section.tag), section.defaultBody ?? '');
}

/* Propagate a deleted section to one note: remove every H2 section that is
   the same section (name and tag), each up to the next H2. null = no change. */
export function propagateSectionDelete(content: string, sectionKey: string): string | null {
  const target = parseHeaderKey(sectionKey);
  const lines = content.split('\n');
  let removed = false;
  for (let idx = lines.length - 1; idx >= 0; idx--) {
    if (!/^##\s/.test(lines[idx])) continue;
    if (!sameSection(lines[idx].trim().replace(/^##\s+/, ''), target)) continue;
    spliceSection(lines, idx);
    removed = true;
  }
  return removed ? lines.join('\n') : null;
}

/* Remove a section from the template itself: the first H2 heading whose
   key (as parseH2Sections reads it) is exactly the raw key, up to the next
   H2. A plain line with the same text is not a heading. null = not found. */
export function removeTemplateSection(content: string, rawKey: string): string | null {
  const lines = content.split('\n');
  const idx = lines.findIndex(l => /^##\s/.test(l) && l.replace(/^##\s+/, '').trim() === rawKey);
  if (idx === -1) return null;
  spliceSection(lines, idx);
  return lines.join('\n');
}

/* Move the dragged H2 section (heading to the next H2) to just before the
   target section. null when the keys are the same or either is not an H2
   in the content.
   Flagged: the block moves as-is, so a last section with no trailing blank
   line runs into the heading after it. */
export function moveTemplateSection(content: string, draggedRawKey: string, targetRawKey: string): string | null {
  if (draggedRawKey === targetRawKey) return null;
  const lines = content.split('\n');
  const keyAt = (ls: string[], i: number) => ls[i].trim().replace(/^##\s+/, '');
  const h2Indices = lines.map((l, i) => (/^##\s/.test(l) ? i : -1)).filter(i => i >= 0);

  const draggedIdx = h2Indices.findIndex(i => keyAt(lines, i) === draggedRawKey);
  const targetIdx = h2Indices.findIndex(i => keyAt(lines, i) === targetRawKey);
  if (draggedIdx === -1 || targetIdx === -1) return null;

  const start = h2Indices[draggedIdx];
  const end = draggedIdx + 1 < h2Indices.length ? h2Indices[draggedIdx + 1] : lines.length;
  const draggedBlock = lines.slice(start, end);
  lines.splice(start, draggedBlock.length);

  const h2IndicesNew = lines.map((l, i) => (/^##\s/.test(l) ? i : -1)).filter(i => i >= 0);
  const targetIdxNew = h2IndicesNew.findIndex(i => keyAt(lines, i) === targetRawKey);
  lines.splice(h2IndicesNew[targetIdxNew], 0, ...draggedBlock);
  return lines.join('\n');
}

/* The × confirm text: a warning naming the notes with content, or a plain ask. */
export function deleteSectionMessage(cleanLabel: string, usedNames: string[]): string {
  if (usedNames.length > 0) {
    return `Warning: The section "${cleanLabel}" has active content in the following files:\n${usedNames.join(', ')}\n\nAre you sure you want to delete it from the template?`;
  }
  return `Remove the section "${cleanLabel}" from this template?`;
}

/* Starter bodies that don't count as content. Flagged: '_Context and
   general notes..._' (most entities' Notes), a dated first milestone and
   an empty '- [ ]' task are missing, so untouched notes count as in use. */
export const TEMPLATE_PLACEHOLDERS = [
  '_Enter your notes here...',
  '_Company description',
  '_Background, interests',
  '_The outcome we want',
  '- [ ] First task',
  '- [ ] First milestone',
];

/* Does the note have the same section (name and tag) with real content? */
export function sectionInUse(content: string, sectionKey: string): boolean {
  const target = parseHeaderKey(sectionKey);
  const sections = parseH2Sections(content);
  return Object.keys(sections).filter(k => sameSection(k, target)).some((k) => {
    const body = (sections[k] || '').trim();
    return !!body && !TEMPLATE_PLACEHOLDERS.some(p => body.startsWith(p));
  });
}

/** A note and its content, as read from the vault. */
export interface TemplateNote<F> {
  file: F;
  content: string;
}

/* The notes whose section has content, in the order given. */
export function filesUsingTemplateSection<F>(notes: Array<TemplateNote<F>>, sectionKey: string): F[] {
  return notes.filter(n => sectionInUse(n.content, sectionKey)).map(n => n.file);
}
