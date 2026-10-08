import type { EntityDef, EntityKey } from '../types/entities';

/* ─────────── Entity registry ───────────
   Each entity = a folder of markdown notes with a known frontmatter shape.
   The generic renderEntityList renders any of them; specialised views
   (Pipeline kanban, Dashboard, Reports) compose on top of the same data.
   Mutated in place by the plugin (custom entities, field edits); never
   reassigned, so every module shares the one object. */
export const ENTITIES: Record<EntityKey, EntityDef> = {
  contact: {
    folder: 'Cadence/Contacts',
    label: 'Contact', plural: 'Contacts',
    fields: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'email', label: 'Email', type: 'email', isList: true },
      { key: 'phone', label: 'Phone', isList: true },
      { key: 'company', label: 'Company', isList: true },
      { key: 'role', label: 'Role', isList: true },
      { key: 'lastContact', label: 'Last contact', type: 'date' },
      { key: 'tags', label: 'Tags', type: 'tags' },
    ],
    columns: ['name', 'company', 'email', 'phone', 'role', 'lastContact'],
  },
  company: {
    folder: 'Cadence/Companies',
    label: 'Company', plural: 'Companies',
    fields: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'domain', label: 'Domain', isList: true },
      { key: 'industry', label: 'Industry', isList: true },
      { key: 'size', label: 'Size' },
      { key: 'owner', label: 'Owner' },
      { key: 'tags', label: 'Tags', type: 'tags' },
    ],
    columns: ['name', 'domain', 'industry', 'size', 'owner'],
  },
  partner: {
    folder: 'Cadence/Partners',
    label: 'Partner', plural: 'Partners',
    fields: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'tier', label: 'Tier', type: 'enum', options: ['Gold', 'Silver', 'Bronze', 'Standard'] },
      { key: 'status', label: 'Status', type: 'enum', options: ['Active', 'Onboarding', 'Inactive', 'Churned'] },
      { key: 'owner', label: 'Owner' },
      { key: 'region', label: 'Region' },
    ],
    columns: ['name', 'tier', 'status', 'region', 'owner'],
  },
  registration: {
    folder: 'Cadence/Registrations',
    label: 'Registration', plural: 'Registrations',
    fields: [
      { key: 'title', label: 'Title', primary: true },
      { key: 'partner', label: 'Partner' },
      { key: 'status', label: 'Status', type: 'enum', options: ['Submitted', 'Approved', 'Rejected', 'Expired'] },
      { key: 'value', label: 'Value', type: 'currency' },
      { key: 'submitted', label: 'Submitted', type: 'date' },
      { key: 'expires', label: 'Expires', type: 'date' },
    ],
    columns: ['title', 'partner', 'status', 'value', 'expires'],
  },
  commission: {
    folder: 'Cadence/Commissions',
    label: 'Commission', plural: 'Commissions',
    fields: [
      { key: 'reference', label: 'Ref', primary: true },
      { key: 'partner', label: 'Partner' },
      { key: 'amount', label: 'Amount', type: 'currency' },
      { key: 'status', label: 'Status', type: 'enum', options: ['Pending', 'Earned', 'Paid', 'Disputed'] },
      { key: 'period', label: 'Period' },
      { key: 'paidOn', label: 'Paid on', type: 'date' },
    ],
    columns: ['reference', 'partner', 'amount', 'status', 'period', 'paidOn'],
  },
  lead: {
    folder: 'Cadence/Leads',
    label: 'Lead', plural: 'Leads',
    fields: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'company', label: 'Company' },
      { key: 'source', label: 'Source' },
      { key: 'status', label: 'Status', type: 'enum', options: ['New', 'Contacted', 'Qualified', 'Disqualified', 'Converted'] },
      { key: 'assigned', label: 'Assigned' },
    ],
    columns: ['name', 'company', 'source', 'status', 'assigned'],
  },
  certification: {
    folder: 'Cadence/Certifications',
    label: 'Certification', plural: 'Certifications',
    fields: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'partner', label: 'Partner' },
      { key: 'level', label: 'Level' },
      { key: 'issued', label: 'Issued', type: 'date' },
      { key: 'expires', label: 'Expires', type: 'date' },
    ],
    columns: ['name', 'partner', 'level', 'issued', 'expires'],
  },
  activity: {
    folder: 'Cadence/Activities',
    label: 'Activity', plural: 'Activities',
    fields: [
      { key: 'subject', label: 'Subject', primary: true },
      { key: 'type', label: 'Type', type: 'enum', options: ['Call', 'Email', 'Meeting', 'Note', 'Task'] },
      { key: 'when', label: 'When', type: 'date' },
      { key: 'with', label: 'With' },
      { key: 'company', label: 'Company' },
      { key: 'related', label: 'Related' },
    ],
    columns: ['when', 'type', 'subject', 'with', 'company', 'related'],
  },
  sequence: {
    folder: 'Cadence/Sequences',
    label: 'Sequence', plural: 'Sequences',
    fields: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'audience', label: 'Audience' },
      { key: 'steps', label: 'Steps', type: 'number' },
      { key: 'active', label: 'Active', type: 'number' },
      { key: 'status', label: 'Status', type: 'enum', options: ['Draft', 'Active', 'Paused', 'Archived'] },
    ],
    columns: ['name', 'audience', 'steps', 'active', 'status'],
  },
  project: {
    folder: 'Cadence/Projects',
    label: 'Project', plural: 'Projects',
    fields: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'status', label: 'Status', type: 'enum', options: ['active', 'on_hold', 'backlog', 'done', 'cancelled'] },
      { key: 'priority', label: 'Priority', type: 'enum', options: ['low', 'medium', 'high'] },
      { key: 'owner', label: 'Owner' },
      { key: 'started', label: 'Started', type: 'date' },
      { key: 'due', label: 'Due', type: 'date' },
      { key: 'tags', label: 'Tags', type: 'tags' },
    ],
    columns: ['name', 'status', 'owner', 'due'],
  },
  deal: {
    folder: 'Cadence/Pipeline',
    label: 'Deal', plural: 'Deals',
    fields: [
      { key: 'title', label: 'Title', primary: true },
      { key: 'stage', label: 'Stage', type: 'enum', options: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'] },
      { key: 'value', label: 'Value', type: 'currency' },
      { key: 'company', label: 'Company' },
      { key: 'contact', label: 'Contact' },
      { key: 'owner', label: 'Owner' },
      { key: 'closeBy', label: 'Close by', type: 'date' },
    ],
    columns: ['title', 'stage', 'value', 'company', 'closeBy'],
  },
};

export const DEAL_STAGES: string[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
