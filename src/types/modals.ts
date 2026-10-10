import type { EntityKey } from './entities';

/* onSubmit payloads of the small dashboard/section modals. The view stores
   them in settings (projectDashboardWidgets, crossSections, page layouts). */

/** Chart style shared by dashboard widgets and chart blocks. */
export type ChartStyle = 'donut' | 'bar' | 'kpi' | 'list';

/** Section layout offered by the cross-section modal. */
export type CrossSectionViewType = 'table' | 'tile' | 'kanban';

export interface WidgetConfig {
  /** `widget.<Date.now()>` */
  id: string;
  title: string;
  /** Field key, or '' when the entity has no non-primary fields. */
  groupBy: string;
  // TODO: confirm shape — read from a <select>, so any string the DOM holds.
  style: ChartStyle | string;
}

export interface CrossSectionConfig {
  /** `xs_` + up to 8 base-36 chars of Math.random(). */
  id: string;
  parentEntity: EntityKey;
  targetEntity: EntityKey;
  linkField: string;
  viewType: CrossSectionViewType | string;
}

export interface ChartSectionConfig {
  targetEntity: EntityKey;
  linkField: string;
  groupField: string;
  style: ChartStyle | string;
}

/** Quick-capture onSubmit payload. `when` is null for an inbox capture. */
export interface CaptureResult {
  text: string;
  /** ISO timestamp. */
  when: string | null;
  // TODO: confirm shape — read from a <select>, so any string the DOM holds.
  repeat: string;
}

/* Fields the reminder edit modal hands to addReminder / updateReminder.
   `when` and `notified` are omitted when the time input is unparseable or
   (for `notified`) unchanged. */
export interface ReminderPatch {
  text: string;
  notes: string;
  repeat: string;
  /** Vault path of the linked project. */
  project: string | null;
  when?: string | null;
  notified?: boolean;
}

/** CSV import onSubmit payload: notes created, and rows skipped (blank
    primary value) or failed. */
export interface ImportResult {
  created: number;
  failed: number;
  entityKey: EntityKey;
}

/** Entity create onSubmit payload. `name` is the trimmed primary value;
    `values` holds every non-empty field, the primary one untrimmed. */
export interface EntityCreateResult {
  name: string;
  /** Strings, wiki-link or plain string lists, or numbers. */
  values: Record<string, unknown>;
}
