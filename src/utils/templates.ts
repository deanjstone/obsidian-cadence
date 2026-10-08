import type { App } from 'obsidian';
import { ENTITIES } from '../constants/entities';
import type { EntityKey } from '../types/entities';
import { ymd } from './dates';
import { ensureFolderSync } from './vault';

export async function ensureDefaultTemplates(app: App): Promise<void> {
  const templatesFolder = 'Cadence/Templates';
  await ensureFolderSync(app, templatesFolder);
  for (const [entityKey, def] of Object.entries(ENTITIES)) {
    const targetPath = `${templatesFolder}/${entityKey}.md`;
    let tFile = app.vault.getAbstractFileByPath(targetPath);
    if (!tFile) {
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
      await app.vault.create(targetPath, templateContent);
    }
  }

  // Ensure daily note template exists
  const dailyTargetPath = `${templatesFolder}/daily.md`;
  let dailyTFile = app.vault.getAbstractFileByPath(dailyTargetPath);
  if (!dailyTFile) {
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
    await app.vault.create(dailyTargetPath, dailyTemplateContent);
  }
}

/* Throws a TypeError for an entity key that is not registered (def is
   undefined) — callers only pass registered keys. */
export function entityTemplate(entityKey: EntityKey, name: string): string {
  if (entityKey === 'project') return projectTemplate(name);

  const def = ENTITIES[entityKey];
  const lines = ['---'];
  const hasTypeField = def.fields.some((f) => f.key === 'type');
  if (!hasTypeField) lines.push(`type: ${entityKey}`);

  def.fields.forEach((f) => {
    if (f.key === 'type') {
      if (entityKey === 'activity') {
        lines.push('type:');
      } else {
        lines.push(`type: ${entityKey}`);
      }
    }
    else if (f.key === def.fields[0].key) lines.push(`${f.key}: ${name}`);
    else if (f.type === 'tags' || f.isList) lines.push(`${f.key}: []`);
    else if (f.type === 'number' || f.type === 'currency') lines.push(`${f.key}: 0`);
    else lines.push(`${f.key}:`);
  });
  // Pipeline default stage
  if (entityKey === 'deal') {
    const idx = lines.findIndex((l) => l.startsWith('stage:'));
    if (idx >= 0) lines[idx] = 'stage: [Lead]';
  }
  lines.push('---', '', `# ${name}`, '', '');
  return lines.join('\n');
}

export function projectTemplate(name: string): string {
  const today = ymd(new Date());
  return [
    '---',
    'type: project',
    `name: ${name}`,
    'status: [active]',
    'priority: [medium]',
    'owner: []',
    `started: ${today}`,
    'due:',
    'tags: []',
    'related_deals: []',
    'related_partners: []',
    '---',
    '',
    `# ${name}`,
    '',
    '## Brief',
    '_The outcome we want, why now._',
    '',
    '',
    '## Scope',
    '**In scope:**',
    '- ',
    '',
    '**Out of scope:**',
    '- ',
    '',
    '## Milestones',
    `- [ ] ${today} — First milestone`,
    '',
    '## Tasks',
    '- [ ] ',
    '',
    '## Risks',
    '- ',
    '',
    '## Stakeholders',
    '- ',
    '',
    '## Notes',
    '',
    '',
  ].join('\n');
}
