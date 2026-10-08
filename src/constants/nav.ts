export interface NavSurface {
  id: string;
  label: string;
  icon: string;
  /** Module toggle (settings.modules) that hides the surface when off. */
  module?: string;
  desc: string;
}

export interface NavGroup {
  id: string;
  label: string;
  module?: string;
  items: NavSurface[];
}

export const VIEW_TYPE_CADENCE_APP = 'cadence-app';

/* ─────────── Nav structure ─────────── */
/* Mirrors the Cadence web-app left nav exactly. Groups can be collapsed.
   Built surfaces have a render method; the rest fall through to the
   coming-soon placeholder, which describes what each surface will do. */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'home_group', label: '',
    items: [
      { id: 'home', label: 'Home', icon: 'home', desc: 'Command centre — today, projects, pipeline and upcoming, all on one screen.' },
    ],
  },
  {
    id: 'planner', label: 'Planner', module: 'planner',
    items: [
      { id: 'planner.inbox', label: 'Inbox', icon: 'inbox', module: 'planner', desc: 'Universal capture + reminders. Anything you toss in here surfaces at the right time.' },
      { id: 'planner.today', label: 'Today', icon: 'sun', module: 'planner', desc: 'Diary view of today\'s daily note.' },
      { id: 'planner.calendar', label: 'Calendar', icon: 'calendar-days', module: 'planner', desc: 'Week view across daily notes.' },
    ],
  },
  {
    id: 'projects', label: 'Projects', module: 'projects',
    items: [
      { id: 'projects.dashboard', label: 'Dashboard', icon: 'layout-grid', module: 'projects', desc: 'Projects Dashboard — high-level stats, status Kanban, priority Kanban, and customizable analytical widgets.' },
      { id: 'projects.projects', label: 'Projects', icon: 'folder-kanban', module: 'projects', desc: 'Active projects with milestones, owners, statuses — kanban over project notes.' },
    ],
  },
  {
    id: 'crm', label: 'CRM', module: 'crm',
    items: [
      { id: 'crm.dashboard', label: 'Dashboard', icon: 'layout-grid', module: 'crm', desc: 'Overview cards — today\'s tasks, deal momentum, recent contacts, week stats.' },
      { id: 'crm.pipeline', label: 'Pipeline', icon: 'trending-up', module: 'crm', desc: 'Sales pipeline. Deals as markdown notes with stage, value and contact frontmatter.' },
      { id: 'crm.contacts', label: 'Contacts', icon: 'users', module: 'crm', desc: 'People as markdown notes — name, email, company, last-talked-to cadence, tags.' },
      { id: 'crm.companies', label: 'Companies', icon: 'building-2', module: 'crm', desc: 'Companies as markdown notes — domain, size, industry, related contacts and deals.' },
      { id: 'crm.activities', label: 'Activities', icon: 'calendar', module: 'crm', desc: 'Cross-cutting activity timeline — calls, meetings, notes against any contact or deal.' },
    ],
  },
  {
    id: 'prm', label: 'PRM', module: 'prm',
    items: [
      { id: 'prm.partners', label: 'Partners', icon: 'handshake', module: 'prm', desc: 'Partner organisations — relationship status, named contacts, joint pipeline.' },
      { id: 'prm.registrations', label: 'Registrations', icon: 'clipboard-check', module: 'prm', desc: 'Deal registrations submitted by partners — status, expiry, attached deals.' },
      { id: 'prm.commissions', label: 'Commissions', icon: 'wallet', module: 'prm', desc: 'Commission ledger across partners — earned, pending, paid, by quarter.' },
      { id: 'prm.leads', label: 'Leads', icon: 'target', module: 'prm', desc: 'Lead distribution — round-robin/queue assignment to partners or reps.' },
      { id: 'prm.certifications', label: 'Certifications', icon: 'award', module: 'prm', desc: 'Partner certifications — track expiries, renewals, training completion.' },
      { id: 'prm.analytics', label: 'Analytics', icon: 'bar-chart-3', module: 'prm', desc: 'PRM analytics — partner-sourced revenue, top performers, lifecycle funnel.' },
    ],
  },
  {
    id: 'workflow', label: 'Workflow',
    items: [
      { id: 'workflow.sequences', label: 'Sequences', icon: 'zap', desc: 'Multi-step outreach sequences — templates, cadence steps, who\'s in which step.' },
    ],
  },
  {
    id: 'reports', label: 'Reports',
    items: [
      { id: 'reports.pipeline', label: 'Pipeline', icon: 'trending-up', module: 'crm', desc: 'Pipeline coverage and weighted forecast — by stage, owner, source.' },
      { id: 'reports.sales', label: 'Sales', icon: 'bar-chart-3', module: 'crm', desc: 'Closed won / lost trends — quota attainment, win rate, average cycle.' },
      { id: 'reports.partners', label: 'Partners', icon: 'handshake', module: 'prm', desc: 'Partner contribution — sourced vs influenced revenue, top tiers.' },
      { id: 'reports.activity', label: 'Activity', icon: 'pie-chart', module: 'crm', desc: 'Activity mix — calls, meetings, emails by rep and account.' },
      { id: 'reports.productivity', label: 'Productivity', icon: 'sun', desc: 'Personal productivity — completion rate, streaks, focus blocks, journal volume.' },
      { id: 'reports.graph', label: 'Graph View', icon: 'network', desc: 'Relationship graph showing connections between contacts, companies, partners, projects, deals, and activities.' },
    ],
  },
  {
    id: 'misc', label: '',
    items: [
      { id: 'team', label: 'Team', icon: 'user-cog', desc: 'Team members, roles, seats — admin view of your Cadence workspace.' },
      { id: 'templates', label: 'Templates', icon: 'file-text', desc: 'Manage your entity templates.' },
      { id: 'settings', label: 'Settings', icon: 'settings-2', desc: 'Cadence app settings — folders, headings, week start, API connection.' },
    ],
  },
];

// Convenience flat lookup
export const ALL_SURFACES: NavSurface[] = NAV_GROUPS.flatMap((g) => g.items);
export const SURFACE_BY_ID: Record<string, NavSurface> = Object.fromEntries(ALL_SURFACES.map((s) => [s.id, s]));

export const BUILT_SURFACES: Set<string> = new Set([
  'home',
  'planner.inbox', 'planner.today', 'planner.calendar',
  'projects.dashboard', 'projects.projects',
  'crm.dashboard', 'crm.pipeline', 'crm.contacts', 'crm.companies', 'crm.activities',
  'prm.partners', 'prm.registrations', 'prm.commissions', 'prm.leads', 'prm.certifications', 'prm.analytics',
  'workflow.sequences',
  'reports.pipeline', 'reports.sales', 'reports.partners', 'reports.activity', 'reports.graph', 'reports.productivity',
  'team', 'templates', 'settings',
]);
