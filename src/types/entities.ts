import type { TFile } from 'obsidian';

/* Entity interfaces inferred from ENTITIES, DEFAULT_SETTINGS.customEntities,
   entityTemplate/projectTemplate output and the CSV import mapping. Notes are
   user-editable markdown, so every frontmatter field is optional and list
   fields accept a scalar too (users and older versions write both). */

export type FieldType = 'text' | 'email' | 'date' | 'number' | 'currency' | 'enum' | 'tags' | 'multitext';

export interface EntityField {
  key: string;
  label: string;
  // TODO: confirm shape — user-defined fields are persisted in settings and
  // not validated, so unknown type strings can reach here.
  type?: FieldType | string;
  primary?: boolean;
  isList?: boolean;
  options?: string[];
  /** 'none' | 'tags' | 'contact' | 'company' | 'partner' | 'project' | 'history' | 'folder:<path>' | 'entity:<key>' */
  suggestionSource?: string;
}

export interface EntityDef {
  folder: string;
  label: string;
  plural: string;
  fields: EntityField[];
  columns: string[];
}

export type CoreEntityKey =
  | 'contact' | 'company' | 'partner' | 'registration' | 'commission' | 'lead'
  | 'certification' | 'activity' | 'sequence' | 'project' | 'deal';

/** Core keys plus user-defined custom entities. */
export type EntityKey = CoreEntityKey | (string & {});

export type Frontmatter = Record<string, unknown>;

/** A relation or multitext value: `[[Link]]`, `a, b`, or an array of either. */
export type ListValue = string | string[];

export interface Entity<F extends Frontmatter = Frontmatter> {
  file: TFile;
  frontmatter: F;
  basename: string;
}

export interface ContactFrontmatter extends Frontmatter {
  type?: ListValue;
  name?: string;
  email?: ListValue;
  phone?: ListValue;
  company?: ListValue;
  role?: ListValue;
  project?: ListValue;
  lastContact?: string;
  tags?: string[];
}

export interface CompanyFrontmatter extends Frontmatter {
  type?: ListValue;
  name?: string;
  domain?: ListValue;
  industry?: ListValue;
  size?: string;
  owner?: ListValue;
  tags?: string[];
}

export interface DealFrontmatter extends Frontmatter {
  type?: ListValue;
  title?: string;
  /** The template writes `[Lead]`; entityValue unwraps the first item. */
  stage?: ListValue;
  // TODO: confirm shape — CSV import writes strings, forms write numbers.
  value?: number | string;
  company?: ListValue;
  contact?: ListValue;
  owner?: ListValue;
  closeBy?: string;
  project?: ListValue;
}

export interface ProjectFrontmatter extends Frontmatter {
  type?: ListValue;
  name?: string;
  status?: ListValue;
  priority?: ListValue;
  owner?: ListValue;
  started?: string;
  due?: string;
  tags?: string[];
  related_deals?: ListValue;
  related_partners?: ListValue;
}

export interface PartnerFrontmatter extends Frontmatter {
  type?: ListValue;
  name?: string;
  tier?: ListValue;
  status?: ListValue;
  owner?: ListValue;
  region?: string;
}

/* Activities reuse `type` for the activity kind (Call, Email, ...), not the
   entity discriminator, which is why entityTemplate writes a bare `type:`. */
export interface ActivityFrontmatter extends Frontmatter {
  subject?: string;
  type?: ListValue;
  when?: string;
  with?: ListValue;
  company?: ListValue;
  related?: ListValue;
  project?: ListValue;
}

export interface TaskNotesTask {
  file: TFile;
  title: string;
  status: string;
  scheduled: string;
  due: string;
  priority: string;
  // TODO: confirm shape — TaskNotes writes a link list, but scalars are passed through.
  projects: unknown;
  done: boolean;
}

export interface ProjectMeta {
  content: string;
  sections: Record<string, string>;
  milestones: import('../utils/parsing').Milestone[];
  total: number;
  done: number;
  percent: number;
  next: import('../utils/parsing').Milestone | null;
  today: Date;
}
