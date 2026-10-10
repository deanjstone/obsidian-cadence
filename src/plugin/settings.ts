import { DEFAULT_SETTINGS } from '../constants/settings';
import { ENTITIES } from '../constants/entities';
import type { EntityField } from '../types/entities';
import type { PluginSettings } from '../types/settings';
import { setCurrentCurrency } from '../utils/format';
import type { AppWithMetadataTypes, PluginHost } from './host';

/* Settings load and save, and the property types registered with Obsidian.
   CadencePlugin keeps a one-line delegate for each. loadSettings also
   rebuilds ENTITIES from settings.customEntities. */

export async function loadSettings(plugin: PluginHost): Promise<void> {
  const loadedData = await plugin.loadData() || {};
  plugin.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

  // Deep default customEntities if missing or empty
  if (!plugin.settings.customEntities) {
    plugin.settings.customEntities = {};
  }
  for (const [entityKey, defaultFields] of Object.entries(DEFAULT_SETTINGS.customEntities)) {
    if (!plugin.settings.customEntities[entityKey] || plugin.settings.customEntities[entityKey].length === 0) {
      plugin.settings.customEntities[entityKey] = JSON.parse(JSON.stringify(defaultFields));
    }
  }

  setCurrentCurrency(plugin.settings.currency || 'USD');

  // Initialize default project dashboard widgets if empty/missing
  if (!plugin.settings.projectDashboardWidgets || plugin.settings.projectDashboardWidgets.length === 0) {
    plugin.settings.projectDashboardWidgets = [
      { id: 'w1', title: 'Projects by Status', groupBy: 'status', style: 'donut' },
      { id: 'w2', title: 'Projects by Priority', groupBy: 'priority', style: 'bar' }
    ];
  }
  if (!plugin.settings.crmDashboardWidgets || plugin.settings.crmDashboardWidgets.length === 0) {
    plugin.settings.crmDashboardWidgets = [
      { id: 'c1', title: 'Deals by Stage', groupBy: 'stage', style: 'donut' },
      { id: 'c2', title: 'Deals by Owner', groupBy: 'owner', style: 'bar' }
    ];
  }
  if (!plugin.settings.prmDashboardWidgets || plugin.settings.prmDashboardWidgets.length === 0) {
    plugin.settings.prmDashboardWidgets = [
      { id: 'p1', title: 'Partners by Tier', groupBy: 'tier', style: 'donut' },
      { id: 'p2', title: 'Partners by Status', groupBy: 'status', style: 'bar' }
    ];
  }

  // Clean up any orphan custom entities that have no matching custom page
  const coreEntityKeys = ['contact', 'company', 'partner', 'registration', 'commission', 'lead', 'certification', 'activity', 'sequence', 'project', 'deal'];
  const activeCustomEntityKeys = (plugin.settings.customPages || []).map(p => p.entityKey);
  for (const entityKey of Object.keys(plugin.settings.customEntities)) {
    if (!coreEntityKeys.includes(entityKey) && !activeCustomEntityKeys.includes(entityKey)) {
      delete plugin.settings.customEntities[entityKey];
      if (ENTITIES[entityKey]) {
        delete ENTITIES[entityKey];
      }
    }
  }

  // Reconstruct custom entities from settings
  if (plugin.settings.customEntities) {
    for (const [entityKey, customFields] of Object.entries(plugin.settings.customEntities)) {
      if (ENTITIES[entityKey]) {
        ENTITIES[entityKey].fields = customFields;
      } else {
        // Reconstruct dynamic custom entity type
        const customPages = plugin.settings.customPages || [];
        const customPage = customPages.find(p => p.entityKey === entityKey);

        let label, plural;
        if (customPage) {
          plural = customPage.label;
          if (plural.endsWith('s') && plural.length > 1) {
            label = plural.substring(0, plural.length - 1);
          } else if (plural.endsWith('S') && plural.length > 1) {
            label = plural.substring(0, plural.length - 1);
          } else {
            label = plural;
          }
        } else {
          label = (entityKey === entityKey.toUpperCase()) ? entityKey : (entityKey.charAt(0).toUpperCase() + entityKey.slice(1));
          plural = label + 's';
        }

        ENTITIES[entityKey] = {
          folder: `Cadence/${plural}`,
          label: label,
          plural: plural,
          fields: customFields,
          columns: [customFields[0]?.key || 'name']
        };
      }
    }
  }

  // Ensure 'type' field is in customEntities and ENTITIES fields (except activity)
  for (const [entityKey, def] of Object.entries(ENTITIES)) {
    if (entityKey === 'activity') continue;

    const hasType = def.fields.some(f => f.key === 'type');
    if (!hasType) {
      def.fields.push({
        key: 'type',
        label: 'Type',
        type: 'text'
      });
    }

    // Also ensure it is in the settings' customEntities fields
    if (plugin.settings.customEntities[entityKey]) {
      const hasSetType = plugin.settings.customEntities[entityKey].some(f => f.key === 'type');
      if (!hasSetType) {
        plugin.settings.customEntities[entityKey].push({
          key: 'type',
          label: 'Type',
          type: 'text'
        });
      }
    }
  }
}

export async function saveSettings(plugin: PluginHost): Promise<void> {
  await plugin.saveData(plugin.settings);
  setCurrentCurrency(plugin.settings.currency || 'USD');
}

export function registerCustomPropertyTypes(plugin: PluginHost): void {
  try {
    if ((plugin.app as unknown as AppWithMetadataTypes).metadataTypeManager && typeof (plugin.app as unknown as AppWithMetadataTypes).metadataTypeManager!.setType === 'function') {
      (plugin.app as unknown as AppWithMetadataTypes).metadataTypeManager!.setType('type', 'multitext');
      const customKeys = ['project', 'deal', 'contact', 'company', 'activity'];
      for (const key of customKeys) {
        const def = ENTITIES[key];
        if (!def || !def.fields) continue;
        for (const f of def.fields) {
          if (f.primary) {
            (plugin.app as unknown as AppWithMetadataTypes).metadataTypeManager!.setType(f.key, 'text');
            continue;
          }
          const ftype = f.type || 'text';
          let obsType = 'text';
          if (ftype === 'date') obsType = 'date';
          else if (ftype === 'number' || ftype === 'currency') obsType = 'number';
          else if (ftype === 'tags') obsType = 'tags';
          else if (ftype === 'multitext') obsType = 'multitext';
          else if (f.isList) obsType = 'multitext';

          (plugin.app as unknown as AppWithMetadataTypes).metadataTypeManager!.setType(f.key, obsType);
        }
      }
    }
  } catch (e) {
    console.warn('Cadence: Failed to register property types', e);
  }
}
