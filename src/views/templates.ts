import { Notice, TFile, setIcon } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import { CadenceChartSectionModal } from '../modals/chart-section';
import { CadenceCrossSectionModal } from '../modals/cross-section';
import { CadencePromptModal } from '../modals/prompt';
import type { EntityDef, EntityKey } from '../types/entities';
import { ymd } from '../utils/dates';
import { parseH2Sections, parseHeaderKey } from '../utils/parsing';
import { entityTemplate, projectTemplate } from '../utils/templates';
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

    const badge = head.createSpan({
      cls: exists ? 'cad-pill cad-pill-active' : 'cad-pill cad-pill-backlog',
      text: exists ? 'Active Template' : 'Default'
    });
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
        const dailyTemplateContent = [
          '# {{date}}',
          '',
          '## Today',
          '- [ ] ',
          '',
          '## Journal',
          '',
          ''
        ].join('\n');
        await view.app.vault.create(dailyTemplatePath, dailyTemplateContent);
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
    const pathsToTry = [
      `${templatesFolder}/${entityKey}.md`,
      `${templatesFolder}/${def.label}.md`,
      `${templatesFolder}/${def.plural}.md`,
      `${templatesFolder}/${entityKey.toLowerCase()}.md`,
      `${templatesFolder}/${def.label.toLowerCase()}.md`,
      `${templatesFolder}/${def.plural.toLowerCase()}.md`
    ];

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

    const badge = head.createSpan({
      cls: exists ? 'cad-pill cad-pill-active' : 'cad-pill cad-pill-backlog',
      text: exists ? 'Active Template' : 'Default'
    });
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
      let templateContent = entityTemplate(entityKey, '{{name}}');
      if (entityKey === 'project') {
        templateContent = projectTemplate('{{name}}');
      } else if (entityKey === 'company') {
        templateContent += '\n## Description #notes\n_Company description and profile..._\n\n## Contacts #cross-contact-company-table\n\n## Deals #cross-deal-company-kanban\n';
      } else if (entityKey === 'contact') {
        templateContent += '\n## Bio #notes\n_Background, interests, and how we met..._\n\n## Tasks #tasks\n- [ ] Follow up in 2 weeks\n';
      } else {
        templateContent += '\n## Notes #notes\n_Context and general notes..._\n';
      }

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
  const def = ENTITIES[entityKey] || { label: 'Daily Note', plural: 'Daily Notes', fields: [] };
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

  const leftKeys: string[] = [];
  const rightKeys: string[] = [];

  sectionKeys.forEach((key, idx) => {
    if (idx % 2 === 0) {
      leftKeys.push(key);
    } else {
      rightKeys.push(key);
    }
  });

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

  /* cleanTitle is null when the title prompt is cancelled (flagged). */
  const addSectionHelper = async (cleanTitle: string | null, tag: string, defaultBody = '') => {
    const curContent = await view.app.vault.read(file);
    const header = `## ${cleanTitle} ${tag}`.trim();
    const nextContent = curContent.replace(/\s*$/, '') + `\n\n${header}\n${defaultBody}\n`;
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
      const defaultTitle = `Related ${ENTITIES[config.targetEntity]?.plural || 'Links'}`;
      new CadencePromptModal(view.app, {
        title: 'New Cross-Linked Section',
        placeholder: 'Enter section title:',
        defaultValue: defaultTitle,
        cta: 'Add Block',
        onSubmit: (title) => {
          const crossTag = `#cross-${config.targetEntity}-${config.linkField}-${config.viewType}`;
          addSectionHelper(title, crossTag, '');
        }
      }).open();
    }).open();
  });

  const addChartBtn = btnRow.createEl('button', { cls: 'cad-btn', text: '📊 Analytics Chart' });
  addChartBtn.addEventListener('click', () => {
    new CadenceChartSectionModal(view.app, entityKey, (config) => {
      const chartTag = `#chart-${config.targetEntity}-${config.linkField}-${config.groupField}-${config.style}`;
      const defaultTitle = `${ENTITIES[config.targetEntity]?.plural || config.targetEntity} by ${config.groupField}`;
      new CadencePromptModal(view.app, {
        title: 'New Analytics Chart',
        placeholder: 'Enter chart section title:',
        defaultValue: defaultTitle,
        cta: 'Add Chart',
        onSubmit: (title) => { addSectionHelper(title, chartTag, ''); }
      }).open();
    }).open();
  });
}

export function renderTemplateSectionWithDelete(
  view: AppViewHost, parent: HTMLElement, file: TFile, sections: Record<string, string>, rawKey: string,
  flashSaved?: FlashSaved, allRawKeys?: string[],
): void {
  const entityKey = file.basename;
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
    const lines = curContent.split('\n');
    const h2Indices = lines.map((l, i) => (/^##\s/.test(l) ? i : -1)).filter(i => i >= 0);

    const draggedIdx = h2Indices.findIndex(i => lines[i].trim().replace(/^##\s+/, '') === draggedRawKey);
    const targetIdx = h2Indices.findIndex(i => lines[i].trim().replace(/^##\s+/, '') === rawKey);
    if (draggedIdx === -1 || targetIdx === -1) return;

    // Extract section block to move
    const getBlock = (hi: number) => {
      const start = h2Indices[hi];
      const end = hi + 1 < h2Indices.length ? h2Indices[hi + 1] : lines.length;
      return lines.slice(start, end);
    };

    const draggedBlock = getBlock(draggedIdx);

    // Remove block from lines
    const startDel = h2Indices[draggedIdx];
    lines.splice(startDel, draggedBlock.length);

    // Re-calculate indices to insert at the correct spot
    const linesTemp = lines.join('\n');
    const linesArr = linesTemp.split('\n');
    const h2IndicesNew = linesArr.map((l, i) => (/^##\s/.test(l) ? i : -1)).filter(i => i >= 0);
    const targetIdxNew = h2IndicesNew.findIndex(i => linesArr[i].trim().replace(/^##\s+/, '') === rawKey);

    // Insert before the target section
    const insertPos = h2IndicesNew[targetIdxNew];
    linesArr.splice(insertPos, 0, ...draggedBlock);

    await view.app.vault.modify(file, linesArr.join('\n'));
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
    if (usedFiles.length > 0) {
      const fileNames = usedFiles.map(f => f.basename).join(', ');
      if (!confirm(`Warning: The section "${cleanLabel}" has active content in the following files:\n${fileNames}\n\nAre you sure you want to delete it from the template?`)) {
        return;
      }
    } else {
      if (!confirm(`Remove the section "${cleanLabel}" from this template?`)) return;
    }
    
    const curContent = await view.app.vault.read(file);
    const lines = curContent.split('\n');
    const idx = lines.findIndex(l => l.trim().replace(/^##\s+/, '') === rawKey);
    if (idx !== -1) {
      let endIdx = lines.length;
      for (let i = idx + 1; i < lines.length; i++) {
        if (/^##\s/.test(lines[i])) { endIdx = i; break; }
      }
      lines.splice(idx, endIdx - idx);
      await view.app.vault.modify(file, lines.join('\n'));
      await view._propagateTemplateSectionDelete(entityKey, rawKey);
      new Notice(`Section "${cleanLabel}" removed.`);
      view.render();
    }
  });
}

export async function getFilesUsingTemplateSection(view: AppViewHost, entityKey: EntityKey | 'daily', rawKey: string): Promise<TFile[]> {
  const files = view._getEntityFiles(entityKey);
  const used = [];
  const { cleanLabel } = parseHeaderKey(rawKey);
  for (const file of files) {
    const content = await view.app.vault.read(file);
    const sections = parseH2Sections(content);
    const matchingKey = Object.keys(sections).find(k => parseHeaderKey(k).cleanLabel.toLowerCase() === cleanLabel.toLowerCase());
    if (matchingKey) {
      const body = (sections[matchingKey] || '').trim();
      if (body && !body.startsWith('_Enter your notes here...') && !body.startsWith('_Company description') && !body.startsWith('_Background, interests') && !body.startsWith('_The outcome we want') && !body.startsWith('- [ ] First task') && !body.startsWith('- [ ] First milestone')) {
        used.push(file);
      }
    }
  }
  return used;
}

export async function propagateTemplateSectionAdd(
  view: AppViewHost, entityKey: EntityKey | 'daily', cleanTitle: string, tag: string, defaultBody = '',
): Promise<void> {
  const files = view._getEntityFiles(entityKey);
  const header = `## ${cleanTitle} ${tag}`.trim();
  for (const file of files) {
    const content = await view.app.vault.read(file);
    const sections = parseH2Sections(content);
    const exists = Object.keys(sections).some(k => parseHeaderKey(k).cleanLabel.toLowerCase() === cleanTitle.toLowerCase());
    if (!exists) {
      const nextContent = content.replace(/\s*$/, '') + `\n\n${header}\n${defaultBody}\n`;
      await view.app.vault.modify(file, nextContent);
    }
  }
}

export async function propagateTemplateSectionDelete(view: AppViewHost, entityKey: EntityKey | 'daily', rawKey: string): Promise<void> {
  const files = view._getEntityFiles(entityKey);
  const { cleanLabel } = parseHeaderKey(rawKey);
  for (const file of files) {
    const content = await view.app.vault.read(file);
    const lines = content.split('\n');
    const idx = lines.findIndex(l => {
      if (!/^##\s/.test(l)) return false;
      const key = l.trim().replace(/^##\s+/, '');
      return parseHeaderKey(key).cleanLabel.toLowerCase() === cleanLabel.toLowerCase();
    });
    if (idx !== -1) {
      let endIdx = lines.length;
      for (let i = idx + 1; i < lines.length; i++) {
        if (/^##\s/.test(lines[i])) { endIdx = i; break; }
      }
      lines.splice(idx, endIdx - idx);
      await view.app.vault.modify(file, lines.join('\n'));
    }
  }
}
