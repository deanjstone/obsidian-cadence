import type { Entity, EntityDef } from '../types/entities';
import { entityValue } from './entities';

/* Deal totals shared by the CRM dashboard and the Pipeline, Sales and
   Partners reports. */

/* A deal's value as a number; blank or non-numeric is 0. */
export function dealValue(entity: Entity, def: EntityDef): number {
  return Number(entityValue(entity, 'value', def)) || 0;
}

export function sumValues(deals: Entity[], def: EntityDef): number {
  return deals.reduce((s, e) => s + dealValue(e, def), 0);
}

export interface CrmSummary {
  /** Every deal not exactly 'Won' or 'Lost', blank and custom stages included. */
  open: Entity[];
  won: Entity[];
  lost: Entity[];
  openValue: number;
  wonValue: number;
  lostValue: number;
  /** Won over closed, as a whole percent; 0 with nothing closed. */
  winRate: number;
  /** Mean value of the won deals; 0 with none won. */
  avgDeal: number;
}

/* The pipeline totals. Won and Lost match case-sensitively. */
export function crmSummary(deals: Entity[], def: EntityDef): CrmSummary {
  const open = deals.filter((e) => !['Won', 'Lost'].includes(String(entityValue(e, 'stage', def))));
  const won = deals.filter((e) => String(entityValue(e, 'stage', def)) === 'Won');
  const lost = deals.filter((e) => String(entityValue(e, 'stage', def)) === 'Lost');
  const wonValue = sumValues(won, def);
  return {
    open, won, lost,
    openValue: sumValues(open, def),
    wonValue,
    lostValue: sumValues(lost, def),
    winRate: won.length + lost.length === 0 ? 0 : Math.round((won.length / (won.length + lost.length)) * 100),
    avgDeal: won.length === 0 ? 0 : wonValue / won.length,
  };
}
