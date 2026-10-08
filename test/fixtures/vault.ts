import type { MockFileSpec } from "../mocks/obsidian";

/* Representative Cadence notes, shaped like what the plugin's own templates
   and forms write: list-valued relations as wiki-link arrays, enum fields as
   single-item arrays (the project template writes `status: [active]`), dates
   as YYYY-MM-DD strings. */

export const dealAcme: MockFileSpec = {
  path: "Cadence/Pipeline/Acme renewal.md",
  frontmatter: {
    type: "deal",
    title: "Acme renewal",
    stage: ["Proposal"],
    value: 12000,
    company: ["[[Acme Corp]]"],
    contact: ["[[Jane Doe]]"],
    owner: ["[[Sam Lee]]"],
    closeBy: "2026-11-30",
    project: ["[[Website relaunch]]"],
  },
  body: "\n# Acme renewal\n",
};

/* A deal identified only by its folder (no `type`), with a scalar stage. */
export const dealUntyped: MockFileSpec = {
  path: "Cadence/Pipeline/2026/Globex expansion.md",
  frontmatter: { stage: "Lead", value: "4500" },
  body: "\n# Globex expansion\n",
};

export const contactJane: MockFileSpec = {
  path: "Cadence/Contacts/Jane Doe.md",
  frontmatter: {
    type: "contact",
    name: "Jane Doe",
    email: ["jane@acme.test"],
    phone: [],
    company: ["[[Acme Corp]]"],
    role: ["CTO"],
    project: ["[[Website relaunch]]"],
    lastContact: "2026-09-30",
    tags: ["vip", "tech"],
  },
  body: "\n# Jane Doe\n",
};

export const companyAcme: MockFileSpec = {
  path: "Cadence/Companies/Acme Corp.md",
  frontmatter: {
    type: "company",
    name: "Acme Corp",
    domain: ["acme.test"],
    industry: ["Manufacturing"],
    size: "200-500",
    owner: ["[[Sam Lee]]"],
    tags: [],
  },
  body: "\n# Acme Corp\n",
};

export const projectWebsite: MockFileSpec = {
  path: "Cadence/Projects/Website relaunch.md",
  frontmatter: {
    type: "project",
    name: "Website relaunch",
    status: ["active"],
    priority: ["high"],
    owner: ["[[Sam Lee]]"],
    started: "2026-09-01",
    due: "2026-12-15",
    tags: ["web"],
    related_deals: ["[[Acme renewal]]"],
    related_partners: [],
  },
  body: [
    "",
    "# Website relaunch",
    "",
    "## Brief",
    "_Ship the new site._",
    "",
    "## Milestones",
    "- [x] 2026-09-15 — Design sign-off",
    "- [ ] 2026-11-01 — Beta",
    "    invite 20 users",
    "- [ ] 2026-10-20 — Content freeze",
    "- [ ] Launch party",
    "",
    "## Tasks",
    "- [ ] Write copy",
    "",
  ].join("\n"),
};

/* Project whose milestone section is found by tag rather than its label. */
export const projectTagged: MockFileSpec = {
  path: "Cadence/Projects/Ops.md",
  frontmatter: { type: "project", name: "Ops cleanup" },
  body: "\n## Roadmap #milestones\n- [x] 2026-01-01 — Done\n- [x] 2026-02-01 — Also done\n",
};

export const partnerInitech: MockFileSpec = {
  path: "Cadence/Partners/Initech.md",
  frontmatter: {
    type: "partner",
    name: "Initech",
    tier: "Gold",
    status: "Active",
    owner: ["[[Sam Lee]]"],
    region: "EMEA",
  },
  body: "\n# Initech\n",
};

export const activityCall: MockFileSpec = {
  path: "Cadence/Activities/Kickoff call.md",
  frontmatter: {
    subject: "Kickoff call",
    type: "Call",
    when: "2026-10-01",
    with: ["[[Jane Doe]]"],
    company: ["[[Acme Corp]]"],
    related: "[[Website relaunch]]",
  },
  body: "\n# Kickoff call\n",
};

export const taskNotesTasks: MockFileSpec[] = [
  {
    path: "TaskNotes/Tasks/Write copy.md",
    frontmatter: { title: "Write copy", status: "open", scheduled: "2026-10-09", priority: "high", projects: ["[[Website relaunch]]"] },
  },
  {
    path: "TaskNotes/Tasks/archive/Old task.md",
    frontmatter: { status: "done", projects: "[[Website relaunch|site]]" },
  },
  {
    path: "TaskNotes/Tasks/Unrelated.md",
    frontmatter: { title: "Unrelated", projects: "[[Other]]" },
  },
  { path: "TaskNotes/Tasks/No frontmatter.md" },
  { path: "TaskNotes/Tasks/attachment.pdf" },
];

export const nonEntityNote: MockFileSpec = {
  path: "Notes/Random.md",
  frontmatter: { type: "journal" },
};

export const entityVault: MockFileSpec[] = [
  dealAcme,
  dealUntyped,
  contactJane,
  companyAcme,
  projectWebsite,
  projectTagged,
  partnerInitech,
  activityCall,
  nonEntityNote,
  { path: "Cadence/Contacts/readme.txt" },
];
