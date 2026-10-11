import { DEFAULT_SETTINGS } from '../constants/settings';
import { ENTITIES } from '../constants/entities';
import type { EntityDef, EntityField } from '../types/entities';
import type { CustomPage, PluginSettings } from '../types/settings';
import { guessSingular, setCurrentCurrency } from '../utils/format';
import type { AppWithMetadataTypes, PluginHost } from './host';

/* Settings load and save, and the property types registered with Obsidian.
   CadencePlugin keeps a one-line delegate for each. loadSettings also
   rebuilds ENTITIES from settings.customEntities. */

/* The entity keys loadSettings never prunes. */
export const CORE_ENTITY_KEYS = ['contact', 'company', 'partner', 'registration', 'commission', 'lead', 'certification', 'activity', 'sequence', 'project', 'deal'];

/* The entities whose fields become Obsidian property types. */
export const PROPERTY_TYPE_ENTITIES = ['project', 'deal', 'contact', 'company', 'activity'];

/* A deep copy of DEFAULT_SETTINGS, so a load never shares, or edits, the
   defaults' nested objects. */
export function defaultSettings(): PluginSettings {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

/* Fills what the merge left missing or empty, in place: each default entity
   schema (a deep copy) and the two default widgets of each dashboard. */
export function fillSettingDefaults(settings: PluginSettings, defaults: PluginSettings): void {
  // Deep default customEntities if missing or empty
  if (!settings.customEntities) {
    settings.customEntities = {};
  }
  for (const [entityKey, defaultFields] of Object.entries(defaults.customEntities)) {
    if (!settings.customEntities[entityKey] || settings.customEntities[entityKey].length === 0) {
      settings.customEntities[entityKey] = JSON.parse(JSON.stringify(defaultFields));
    }
  }

  // Initialize default project dashboard widgets if empty/missing
  if (!settings.projectDashboardWidgets || settings.projectDashboardWidgets.length === 0) {
    settings.projectDashboardWidgets = [
      { id: 'w1', title: 'Projects by Status', groupBy: 'status', style: 'donut' },
      { id: 'w2', title: 'Projects by Priority', groupBy: 'priority', style: 'bar' }
    ];
  }
  if (!settings.crmDashboardWidgets || settings.crmDashboardWidgets.length === 0) {
    settings.crmDashboardWidgets = [
      { id: 'c1', title: 'Deals by Stage', groupBy: 'stage', style: 'donut' },
      { id: 'c2', title: 'Deals by Owner', groupBy: 'owner', style: 'bar' }
    ];
  }
  if (!settings.prmDashboardWidgets || settings.prmDashboardWidgets.length === 0) {
    settings.prmDashboardWidgets = [
      { id: 'p1', title: 'Partners by Tier', groupBy: 'tier', style: 'donut' },
      { id: 'p2', title: 'Partners by Status', groupBy: 'status', style: 'bar' }
    ];
  }
}

/* A rebuilt entity's label and plural: from its custom page, or else from
   its key. The label is the singular saved on the page (capitalised), or for
   a page saved before singulars were asked for, a guess from its label
   (guessSingular). Only a core key missing from ENTITIES reaches the key
   branch, so its all-caps case is unreachable. */
export function customEntityNames(entityKey: string, customPage: CustomPage | undefined): { label: string; plural: string } {
  let label, plural;
  if (customPage) {
    plural = customPage.label;
    const singular = (customPage.singular || '').trim();
    label = singular ? singular.charAt(0).toUpperCase() + singular.slice(1) : guessSingular(plural);
  } else {
    label = (entityKey === entityKey.toUpperCase()) ? entityKey : (entityKey.charAt(0).toUpperCase() + entityKey.slice(1));
    plural = label + 's';
  }
  return { label, plural };
}

/* Rebuilds the entity registry from settings.customEntities, editing both
   in place: drops custom schemas with no custom page, points each entity's
   fields at its settings list (rebuilding an entity ENTITIES lacks), and
   adds a text `type` field to every entity but activity. */
export function reconstructEntities(settings: PluginSettings, entities: Record<string, EntityDef>): void {
  // Clean up any orphan custom entities that have no matching custom page
  const activeCustomEntityKeys = (settings.customPages || []).map(p => p.entityKey);
  for (const entityKey of Object.keys(settings.customEntities)) {
    if (!CORE_ENTITY_KEYS.includes(entityKey) && !activeCustomEntityKeys.includes(entityKey)) {
      delete settings.customEntities[entityKey];
      if (entities[entityKey]) {
        delete entities[entityKey];
      }
    }
  }

  // Reconstruct custom entities from settings
  if (settings.customEntities) {
    for (const [entityKey, customFields] of Object.entries(settings.customEntities)) {
      if (entities[entityKey]) {
        entities[entityKey].fields = customFields;
      } else {
        // Reconstruct dynamic custom entity type
        const customPages = settings.customPages || [];
        const customPage = customPages.find(p => p.entityKey === entityKey);
        const { label, plural } = customEntityNames(entityKey, customPage);

        entities[entityKey] = {
          folder: `Cadence/${plural}`,
          label: label,
          plural: plural,
          fields: customFields,
          columns: [customFields[0]?.key || 'name']
        };
      }
    }
  }

  // Ensure a 'type' field on every entity but activity. An entity with a
  // settings list shares it as its fields, so this adds it there too.
  for (const [entityKey, def] of Object.entries(entities)) {
    if (entityKey === 'activity') continue;

    const hasType = def.fields.some(f => f.key === 'type');
    if (!hasType) {
      def.fields.push({
        key: 'type',
        label: 'Type',
        type: 'text'
      });
    }
  }
}

/* The Obsidian property type for an entity field: text for the primary
   field, then by field type, then multitext for any list. An enum is text,
   because Obsidian has no select property type. */
export function propertyTypeFor(f: EntityField): string {
  if (f.primary) return 'text';
  const ftype = f.type || 'text';
  let obsType = 'text';
  if (ftype === 'date') obsType = 'date';
  else if (ftype === 'number' || ftype === 'currency') obsType = 'number';
  else if (ftype === 'tags') obsType = 'tags';
  else if (ftype === 'multitext') obsType = 'multitext';
  else if (f.isList) obsType = 'multitext';
  return obsType;
}

export async function loadSettings(plugin: PluginHost): Promise<void> {
  const loadedData = await plugin.loadData() || {};
  plugin.settings = Object.assign(defaultSettings(), loadedData);
  fillSettingDefaults(plugin.settings, DEFAULT_SETTINGS);
  setCurrentCurrency(plugin.settings.currency || 'USD');
  reconstructEntities(plugin.settings, ENTITIES);
}

export async function saveSettings(plugin: PluginHost): Promise<void> {
  await plugin.saveData(plugin.settings);
  setCurrentCurrency(plugin.settings.currency || 'USD');
}

/* Registers each core entity field's property type. `type` comes only from
   the entities' own type fields (text), never a separate registration. */
export function registerCustomPropertyTypes(plugin: PluginHost): void {
  try {
    const manager = (plugin.app as unknown as AppWithMetadataTypes).metadataTypeManager;
    if (manager && typeof manager.setType === 'function') {
      for (const key of PROPERTY_TYPE_ENTITIES) {
        const def = ENTITIES[key];
        if (!def || !def.fields) continue;
        for (const f of def.fields) {
          manager.setType(f.key, propertyTypeFor(f));
        }
      }
    }
  } catch (e) {
    console.warn('Cadence: Failed to register property types', e);
  }
}
