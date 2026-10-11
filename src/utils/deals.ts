import type { Entity, EntityDef } from '../types/entities';
import { entityValue } from './entities';

/* Deal totals shared by the CRM dashboard, Home, PRM analytics and the
   Pipeline, Sales and Partners reports: one rule for a deal's outcome. */

/** A stage folded for comparison: trimmed, lower-cased, with runs of
    spaces, `-` and `_` read as one space. */
export function foldStage(stage: unknown): string {
  return String(stage ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
}

export type DealOutcome = 'open' | 'won' | 'lost';

/** A stage's outcome, in any case: `won` or `closed won` is won, `lost` or
    `closed lost` is lost, and anything else (blank and custom stages
    included) is open. Customised stage options keep closing as long as the
    closed ones are still called Won and Lost (#54). */
export function stageOutcome(stage: unknown): DealOutcome {
  const folded = foldStage(stage).replace(/^closed /, '');
  return folded === 'won' ? 'won' : folded === 'lost' ? 'lost' : 'open';
}

/** A deal's stage as text: a one-item list reads as its item. */
export function dealStage(entity: Entity, def: EntityDef): string {
  return String(entityValue(entity, 'stage', def));
}

export function dealOutcome(entity: Entity, def: EntityDef): DealOutcome {
  return stageOutcome(dealStage(entity, def));
}

/* A deal's value as a number; blank or non-numeric is 0. */
export function dealValue(entity: Entity, def: EntityDef): number {
  return Number(entityValue(entity, 'value', def)) || 0;
}

export function sumValues(deals: Entity[], def: EntityDef): number {
  return deals.reduce((s, e) => s + dealValue(e, def), 0);
}

export interface CrmSummary {
  /** Every deal not Won or Lost (in any case), blank and custom stages included. */
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

/* The pipeline totals, split by dealOutcome. */
export function crmSummary(deals: Entity[], def: EntityDef): CrmSummary {
  const open = deals.filter((e) => dealOutcome(e, def) === 'open');
  const won = deals.filter((e) => dealOutcome(e, def) === 'won');
  const lost = deals.filter((e) => dealOutcome(e, def) === 'lost');
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
