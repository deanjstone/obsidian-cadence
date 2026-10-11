import type { Entity, EntityDef, Frontmatter } from '../types/entities';
import { parseYmd, ymd } from './dates';
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

/** The frontmatter a deal's stage write adds, given its stage `before` and
    `after` (a one-item list reads as its item): `closed: <today>` when the
    deal moves to Won or Lost from any other outcome, so its close date is
    when it closed, not its last edit (#54). Anything else adds nothing, so a
    reopened deal keeps its old date until it closes again. */
export function closedPatch(before: unknown, after: unknown, now: Date): Frontmatter {
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const outcome = stageOutcome(first(after));
  return outcome !== 'open' && outcome !== stageOutcome(first(before)) ? { closed: ymd(now) } : {};
}

/** When a deal closed: its `closed` date (a bare YYYY-MM-DD as local
    midnight, or any date Date reads), else its file mtime for deals that
    predate `closed`, else null (no stat, or an mtime of 0). */
export function dealClosedAt(entity: Entity, def: EntityDef): Date | null {
  const closed = entityValue(entity, 'closed', def);
  if (closed) {
    const d = parseYmd(closed) ?? new Date(closed as string);
    if (!isNaN(d.getTime())) return d;
  }
  const mtime = entity.file && entity.file.stat ? entity.file.stat.mtime : 0;
  return mtime ? new Date(mtime) : null;
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

export interface StageGroup {
  /** The configured option, an off-list stage as first written, or `(no stage)`. */
  stage: string;
  items: Entity[];
}

export const NO_STAGE = '(no stage)';

/* Deals grouped by stage, so every deal is in exactly one group: one group
   per configured stage, in order, then one per stage off the list in
   first-seen order, then `(no stage)` for blank ones. Stages match after
   foldStage, and a Won or Lost spelled like no option ('Closed Won') joins
   the first option with the same outcome. */
export function dealsByStage(deals: Entity[], def: EntityDef, stages: string[]): StageGroup[] {
  const groups: StageGroup[] = stages.map((stage) => ({ stage, items: [] }));
  const byFold = new Map<string, StageGroup>();
  groups.forEach((g) => { if (!byFold.has(foldStage(g.stage))) byFold.set(foldStage(g.stage), g); });
  const byOutcome = new Map<DealOutcome, StageGroup>();
  groups.forEach((g) => {
    const outcome = stageOutcome(g.stage);
    if (outcome !== 'open' && !byOutcome.has(outcome)) byOutcome.set(outcome, g);
  });
  const offList: StageGroup[] = [];
  const noStage: StageGroup = { stage: NO_STAGE, items: [] };
  deals.forEach((e) => {
    const stage = dealStage(e, def).trim();
    const folded = foldStage(stage);
    let group = folded ? byFold.get(folded) || byOutcome.get(stageOutcome(stage)) : noStage;
    if (!group) {
      group = { stage, items: [] };
      byFold.set(folded, group);
      offList.push(group);
    }
    group.items.push(e);
  });
  return [...groups, ...offList, ...(noStage.items.length ? [noStage] : [])];
}

/* Forecast weights for the built-in open stages, by folded name. */
const BUILT_IN_CONFIDENCE: Record<string, number> = { 'lead': 0.10, 'qualified': 0.25, 'proposal': 0.50, 'negotiation': 0.75 };

/* A forecast weight for any stage. A built-in open stage (Lead, Qualified,
   Proposal, Negotiation) keeps its weight in any case. Any other open stage
   on the configured list is weighed by its place among the open options,
   in a straight line between its nearest weighted neighbours (0 before the
   first, 1 after the last). Won, Lost, blank and off-list stages weigh 0. */
export function stageConfidence(stages: string[]): (stage: unknown) => number {
  const open = stages.map(foldStage).filter((s) => s && stageOutcome(s) === 'open');
  const anchors: Array<[number, number]> = [[-1, 0]];
  open.forEach((s, i) => { if (s in BUILT_IN_CONFIDENCE) anchors.push([i, BUILT_IN_CONFIDENCE[s]]); });
  anchors.push([open.length, 1]);
  const weights = new Map<string, number>(Object.entries(BUILT_IN_CONFIDENCE));
  open.forEach((s, i) => {
    if (weights.has(s)) return;
    const before = anchors.filter(([at]) => at < i).pop()!;
    const after = anchors.find(([at]) => at > i)!;
    weights.set(s, before[1] + ((after[1] - before[1]) * (i - before[0])) / (after[0] - before[0]));
  });
  return (stage) => weights.get(foldStage(stage)) ?? 0;
}
