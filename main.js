/* Cadence — built from src/ by esbuild (pnpm build). Do not edit main.js directly. */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  CadencePlugin: () => CadencePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian32 = require("obsidian");

// src/constants/nav.ts
var VIEW_TYPE_CADENCE_APP = "cadence-app";
var NAV_GROUPS = [
  {
    id: "home_group",
    label: "",
    items: [
      { id: "home", label: "Home", icon: "home", desc: "Command centre \u2014 today, projects, pipeline and upcoming, all on one screen." }
    ]
  },
  {
    id: "planner",
    label: "Planner",
    module: "planner",
    items: [
      { id: "planner.inbox", label: "Inbox", icon: "inbox", module: "planner", desc: "Universal capture + reminders. Anything you toss in here surfaces at the right time." },
      { id: "planner.today", label: "Today", icon: "sun", module: "planner", desc: "Diary view of today's daily note." },
      { id: "planner.calendar", label: "Calendar", icon: "calendar-days", module: "planner", desc: "Week view across daily notes." }
    ]
  },
  {
    id: "projects",
    label: "Projects",
    module: "projects",
    items: [
      { id: "projects.dashboard", label: "Dashboard", icon: "layout-grid", module: "projects", desc: "Projects Dashboard \u2014 high-level stats, status Kanban, priority Kanban, and customizable analytical widgets." },
      { id: "projects.projects", label: "Projects", icon: "folder-kanban", module: "projects", desc: "Active projects with milestones, owners, statuses \u2014 kanban over project notes." }
    ]
  },
  {
    id: "crm",
    label: "CRM",
    module: "crm",
    items: [
      { id: "crm.dashboard", label: "Dashboard", icon: "layout-grid", module: "crm", desc: "Overview cards \u2014 today's tasks, deal momentum, recent contacts, week stats." },
      { id: "crm.pipeline", label: "Pipeline", icon: "trending-up", module: "crm", desc: "Sales pipeline. Deals as markdown notes with stage, value and contact frontmatter." },
      { id: "crm.contacts", label: "Contacts", icon: "users", module: "crm", desc: "People as markdown notes \u2014 name, email, company, last-talked-to cadence, tags." },
      { id: "crm.companies", label: "Companies", icon: "building-2", module: "crm", desc: "Companies as markdown notes \u2014 domain, size, industry, related contacts and deals." },
      { id: "crm.activities", label: "Activities", icon: "calendar", module: "crm", desc: "Cross-cutting activity timeline \u2014 calls, meetings, notes against any contact or deal." }
    ]
  },
  {
    id: "prm",
    label: "PRM",
    module: "prm",
    items: [
      { id: "prm.partners", label: "Partners", icon: "handshake", module: "prm", desc: "Partner organisations \u2014 relationship status, named contacts, joint pipeline." },
      { id: "prm.registrations", label: "Registrations", icon: "clipboard-check", module: "prm", desc: "Deal registrations submitted by partners \u2014 status, expiry, attached deals." },
      { id: "prm.commissions", label: "Commissions", icon: "wallet", module: "prm", desc: "Commission ledger across partners \u2014 earned, pending, paid, by quarter." },
      { id: "prm.leads", label: "Leads", icon: "target", module: "prm", desc: "Lead distribution \u2014 round-robin/queue assignment to partners or reps." },
      { id: "prm.certifications", label: "Certifications", icon: "award", module: "prm", desc: "Partner certifications \u2014 track expiries, renewals, training completion." },
      { id: "prm.analytics", label: "Analytics", icon: "bar-chart-3", module: "prm", desc: "PRM analytics \u2014 partner-sourced revenue, top performers, lifecycle funnel." }
    ]
  },
  {
    id: "workflow",
    label: "Workflow",
    items: [
      { id: "workflow.sequences", label: "Sequences", icon: "zap", desc: "Multi-step outreach sequences \u2014 templates, cadence steps, who's in which step." }
    ]
  },
  {
    id: "reports",
    label: "Reports",
    items: [
      { id: "reports.pipeline", label: "Pipeline", icon: "trending-up", module: "crm", desc: "Pipeline coverage and weighted forecast \u2014 by stage, owner, source." },
      { id: "reports.sales", label: "Sales", icon: "bar-chart-3", module: "crm", desc: "Closed won / lost trends \u2014 quota attainment, win rate, average cycle." },
      { id: "reports.partners", label: "Partners", icon: "handshake", module: "prm", desc: "Partner contribution \u2014 sourced vs influenced revenue, top tiers." },
      { id: "reports.activity", label: "Activity", icon: "pie-chart", module: "crm", desc: "Activity mix \u2014 calls, meetings, emails by rep and account." },
      { id: "reports.productivity", label: "Productivity", icon: "sun", desc: "Personal productivity \u2014 completion rate, streaks, focus blocks, journal volume." },
      { id: "reports.graph", label: "Graph View", icon: "network", desc: "Relationship graph showing connections between contacts, companies, partners, projects, deals, and activities." }
    ]
  },
  {
    id: "misc",
    label: "",
    items: [
      { id: "team", label: "Team", icon: "user-cog", desc: "Team members, roles, seats \u2014 admin view of your Cadence workspace." },
      { id: "templates", label: "Templates", icon: "file-text", desc: "Manage your entity templates." },
      { id: "settings", label: "Settings", icon: "settings-2", desc: "Cadence app settings \u2014 folders, headings, week start, API connection." }
    ]
  }
];
var ALL_SURFACES = NAV_GROUPS.flatMap((g) => g.items);
var SURFACE_BY_ID = Object.assign(
  /* @__PURE__ */ Object.create(null),
  Object.fromEntries(ALL_SURFACES.map((s) => [s.id, s]))
);
var BUILT_SURFACES = /* @__PURE__ */ new Set([
  "home",
  "planner.inbox",
  "planner.today",
  "planner.calendar",
  "projects.dashboard",
  "projects.projects",
  "crm.dashboard",
  "crm.pipeline",
  "crm.contacts",
  "crm.companies",
  "crm.activities",
  "prm.partners",
  "prm.registrations",
  "prm.commissions",
  "prm.leads",
  "prm.certifications",
  "prm.analytics",
  "workflow.sequences",
  "reports.pipeline",
  "reports.sales",
  "reports.partners",
  "reports.activity",
  "reports.graph",
  "reports.productivity",
  "team",
  "templates",
  "settings"
]);

// src/modals/capture.ts
var import_obsidian = require("obsidian");

// src/utils/dates.ts
function pad(n) {
  return String(n).padStart(2, "0");
}
function ymd(d = /* @__PURE__ */ new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseYmd(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const utc = new Date(s);
  if (isNaN(utc.getTime())) return null;
  const d = /* @__PURE__ */ new Date(0);
  d.setFullYear(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
  d.setHours(0, 0, 0, 0);
  return d;
}
function dailyNotePath(settings, date = /* @__PURE__ */ new Date()) {
  const folder = (settings.dailyNoteFolder || "").replace(/\/$/, "");
  const name = ymd(date);
  return folder ? `${folder}/${name}.md` : `${name}.md`;
}
function partOfDay(now = /* @__PURE__ */ new Date()) {
  const h = now.getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
function greeting() {
  return `Good ${partOfDay()}`;
}
function dateInfo(d = /* @__PURE__ */ new Date()) {
  return {
    weekday: d.toLocaleDateString(void 0, { weekday: "long" }),
    day: d.getDate(),
    month: d.toLocaleDateString(void 0, { month: "long" }),
    year: d.getFullYear()
  };
}
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d, weekStartsOn = 1) {
  const x = startOfDay(d);
  const diff = (x.getDay() - weekStartsOn + 7) % 7;
  return addDays(x, -diff);
}
function weekDates(anchor, weekStartsOn = 1) {
  const start = startOfWeek(anchor, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function toLocalDatetimeValue(d) {
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function fromLocalDatetimeValue(s) {
  if (!s) return null;
  return new Date(s);
}
function newestFirst(items, when) {
  const time = (value) => {
    if (value == null || value === "") return null;
    const t = (parseYmd(value) ?? new Date(value)).getTime();
    return isNaN(t) ? null : t;
  };
  return items.map((item) => ({ item, t: time(when(item)) })).sort((a, b) => a.t === null ? b.t === null ? 0 : 1 : b.t === null ? -1 : b.t - a.t).map(({ item }) => item);
}

// src/modals/capture.ts
var CAPTURE_TIME_MESSAGES = {
  "no-time": "Pick a time, or untick Remind me.",
  "bad-time": "Couldn't read that time. Fix it, or untick Remind me."
};
function buildCaptureResult(form) {
  const text = form.text.trim();
  if (!text) return null;
  if (!form.scheduled) return { text, when: null, repeat: "none" };
  if (form.badInput) return "bad-time";
  if (!form.datetimeValue) return "no-time";
  const d = fromLocalDatetimeValue(form.datetimeValue);
  if (!d || isNaN(d.getTime())) return "bad-time";
  return { text, when: d.toISOString(), repeat: form.repeat || "none" };
}
function defaultCaptureWhen(now) {
  const dft = new Date(now.getTime() + 60 * 60 * 1e3);
  const minutes = dft.getMinutes() + (dft.getSeconds() * 1e3 + dft.getMilliseconds()) / 6e4;
  dft.setMinutes(Math.ceil(minutes / 15) * 15, 0, 0);
  return dft;
}
var QUICK_PICK_DELTA_MS = {
  "+15m": 15 * 60 * 1e3,
  "+1h": 60 * 60 * 1e3,
  "+3h": 3 * 60 * 60 * 1e3
};
function quickPickTime(kind, now) {
  if (kind === "Tomorrow 9am") {
    const d2 = new Date(now.getTime());
    d2.setDate(d2.getDate() + 1);
    d2.setHours(9, 0, 0, 0);
    return d2;
  }
  const d = new Date(now.getTime() + QUICK_PICK_DELTA_MS[kind]);
  d.setSeconds(0, 0);
  return d;
}
var CadenceCaptureModal = class extends import_obsidian.Modal {
  constructor(app, opts = {}) {
    super(app);
    this.onSubmit = opts.onSubmit;
    this.defaultText = opts.defaultText || "";
    this.defaultWhen = opts.defaultWhen || null;
    this.defaultRepeat = opts.defaultRepeat || "none";
    this._submitted = false;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("cad-capture-modal");
    contentEl.createEl("h3", { text: "Quick capture" });
    const textRow = contentEl.createDiv({ cls: "cad-form-row" });
    textRow.createDiv({ cls: "cad-form-label", text: "WHAT" });
    const textInput = textRow.createEl("input", { type: "text", cls: "cad-form-input" });
    textInput.placeholder = "What needs doing?";
    textInput.value = this.defaultText;
    const schedToggleRow = contentEl.createDiv();
    schedToggleRow.style.marginTop = "14px";
    schedToggleRow.style.display = "flex";
    schedToggleRow.style.alignItems = "center";
    schedToggleRow.style.gap = "8px";
    const schedCb = schedToggleRow.createEl("input", { type: "checkbox" });
    const schedLbl = schedToggleRow.createEl("label", { text: "Remind me" });
    schedLbl.style.fontSize = "13px";
    schedLbl.style.cursor = "pointer";
    schedLbl.addEventListener("click", () => {
      schedCb.checked = !schedCb.checked;
      schedCb.dispatchEvent(new Event("change"));
    });
    const schedFields = contentEl.createDiv({ cls: "cad-capture-sched" });
    schedFields.style.display = "none";
    schedFields.style.marginTop = "12px";
    schedFields.style.gap = "12px";
    const dateRow = schedFields.createDiv({ cls: "cad-form-row" });
    dateRow.createDiv({ cls: "cad-form-label", text: "WHEN" });
    const dateInput = dateRow.createEl("input", { type: "datetime-local", cls: "cad-form-input" });
    if (this.defaultWhen) {
      const d = new Date(this.defaultWhen);
      if (!isNaN(d.getTime())) dateInput.value = toLocalDatetimeValue(d);
      else new import_obsidian.Notice(`Couldn't read the reminder time "${this.defaultWhen}". Pick a time, or untick Remind me.`);
    } else {
      dateInput.value = toLocalDatetimeValue(defaultCaptureWhen(/* @__PURE__ */ new Date()));
    }
    const quick = schedFields.createDiv();
    quick.style.display = "flex";
    quick.style.gap = "6px";
    quick.style.marginTop = "8px";
    quick.style.flexWrap = "wrap";
    const pick = (kind) => {
      dateInput.value = toLocalDatetimeValue(quickPickTime(kind, /* @__PURE__ */ new Date()));
    };
    const mkQ = (kind) => {
      const b = quick.createEl("button", { cls: "cad-btn cad-btn-sm", text: kind });
      b.type = "button";
      return b;
    };
    for (const kind of ["+15m", "+1h", "+3h", "Tomorrow 9am"]) mkQ(kind).addEventListener("click", () => pick(kind));
    const repeatRow = schedFields.createDiv({ cls: "cad-form-row" });
    repeatRow.style.marginTop = "10px";
    repeatRow.createDiv({ cls: "cad-form-label", text: "REPEAT" });
    const repeatSelect = repeatRow.createEl("select", { cls: "cad-form-input" });
    [["none", "No repeat"], ["daily", "Daily"], ["weekly", "Weekly"]].forEach(([v, l]) => {
      const o = repeatSelect.createEl("option", { value: v, text: l });
      if (v === this.defaultRepeat) o.selected = true;
    });
    schedCb.addEventListener("change", () => {
      schedFields.style.display = schedCb.checked ? "block" : "none";
    });
    if (this.defaultWhen) {
      schedCb.checked = true;
      schedFields.style.display = "block";
    }
    const row = contentEl.createDiv();
    row.style.display = "flex";
    row.style.justifyContent = "flex-end";
    row.style.gap = "8px";
    row.style.marginTop = "18px";
    const cancel = row.createEl("button", { cls: "cad-btn", text: "Cancel" });
    cancel.type = "button";
    cancel.addEventListener("click", () => this.close());
    const ok = row.createEl("button", { cls: "cad-btn primary", text: "Capture" });
    ok.type = "button";
    const submit = () => {
      if (this._submitted) return;
      const result = buildCaptureResult({
        text: textInput.value,
        scheduled: schedCb.checked,
        datetimeValue: dateInput.value,
        badInput: dateInput.validity?.badInput,
        repeat: repeatSelect.value
      });
      if (!result) {
        textInput.focus();
        return;
      }
      if (typeof result === "string") {
        new import_obsidian.Notice(CAPTURE_TIME_MESSAGES[result]);
        dateInput.focus();
        return;
      }
      this._submitted = true;
      this.close();
      this.onSubmit?.(result);
    };
    ok.addEventListener("click", submit);
    textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    });
    setTimeout(() => textInput.focus(), 0);
  }
  onClose() {
    if (!this._submitted && this.onSubmit) this.onSubmit(null);
    this.contentEl.empty();
  }
};

// src/modals/import-modal.ts
var import_obsidian3 = require("obsidian");

// src/constants/entities.ts
var ENTITIES = {
  contact: {
    folder: "Cadence/Contacts",
    label: "Contact",
    plural: "Contacts",
    fields: [
      { key: "name", label: "Name", primary: true },
      { key: "email", label: "Email", type: "email", isList: true },
      { key: "phone", label: "Phone", isList: true },
      { key: "company", label: "Company", isList: true },
      { key: "role", label: "Role", isList: true },
      // A project relation, edited as chips like company; a form edit auto-creates a missing project (#68).
      { key: "project", label: "Project", type: "multitext", suggestionSource: "project" },
      { key: "lastContact", label: "Last contact", type: "date" },
      { key: "tags", label: "Tags", type: "tags" }
    ],
    columns: ["name", "company", "email", "phone", "role", "lastContact"]
  },
  company: {
    folder: "Cadence/Companies",
    label: "Company",
    plural: "Companies",
    fields: [
      { key: "name", label: "Name", primary: true },
      { key: "domain", label: "Domain", isList: true },
      { key: "industry", label: "Industry", isList: true },
      { key: "size", label: "Size" },
      { key: "owner", label: "Owner" },
      { key: "tags", label: "Tags", type: "tags" }
    ],
    columns: ["name", "domain", "industry", "size", "owner"]
  },
  partner: {
    folder: "Cadence/Partners",
    label: "Partner",
    plural: "Partners",
    fields: [
      { key: "name", label: "Name", primary: true },
      { key: "tier", label: "Tier", type: "enum", options: ["Gold", "Silver", "Bronze", "Standard"] },
      { key: "status", label: "Status", type: "enum", options: ["Active", "Onboarding", "Inactive", "Churned"] },
      { key: "owner", label: "Owner" },
      { key: "region", label: "Region" }
    ],
    columns: ["name", "tier", "status", "region", "owner"]
  },
  registration: {
    folder: "Cadence/Registrations",
    label: "Registration",
    plural: "Registrations",
    fields: [
      { key: "title", label: "Title", primary: true },
      { key: "partner", label: "Partner" },
      { key: "status", label: "Status", type: "enum", options: ["Submitted", "Approved", "Rejected", "Expired"] },
      { key: "value", label: "Value", type: "currency" },
      { key: "submitted", label: "Submitted", type: "date" },
      { key: "expires", label: "Expires", type: "date" }
    ],
    columns: ["title", "partner", "status", "value", "expires"]
  },
  commission: {
    folder: "Cadence/Commissions",
    label: "Commission",
    plural: "Commissions",
    fields: [
      { key: "reference", label: "Ref", primary: true },
      { key: "partner", label: "Partner" },
      { key: "amount", label: "Amount", type: "currency" },
      { key: "status", label: "Status", type: "enum", options: ["Pending", "Earned", "Paid", "Disputed"] },
      { key: "period", label: "Period" },
      { key: "paidOn", label: "Paid on", type: "date" }
    ],
    columns: ["reference", "partner", "amount", "status", "period", "paidOn"]
  },
  lead: {
    folder: "Cadence/Leads",
    label: "Lead",
    plural: "Leads",
    fields: [
      { key: "name", label: "Name", primary: true },
      { key: "company", label: "Company" },
      { key: "source", label: "Source" },
      { key: "status", label: "Status", type: "enum", options: ["New", "Contacted", "Qualified", "Disqualified", "Converted"] },
      { key: "assigned", label: "Assigned" }
    ],
    columns: ["name", "company", "source", "status", "assigned"]
  },
  certification: {
    folder: "Cadence/Certifications",
    label: "Certification",
    plural: "Certifications",
    fields: [
      { key: "name", label: "Name", primary: true },
      { key: "partner", label: "Partner" },
      { key: "level", label: "Level" },
      { key: "issued", label: "Issued", type: "date" },
      { key: "expires", label: "Expires", type: "date" }
    ],
    columns: ["name", "partner", "level", "issued", "expires"]
  },
  activity: {
    folder: "Cadence/Activities",
    label: "Activity",
    plural: "Activities",
    fields: [
      { key: "subject", label: "Subject", primary: true },
      { key: "type", label: "Type", type: "enum", options: ["Call", "Email", "Meeting", "Note", "Task"] },
      { key: "when", label: "When", type: "date" },
      { key: "with", label: "With" },
      { key: "company", label: "Company" },
      { key: "related", label: "Related" }
    ],
    columns: ["when", "type", "subject", "with", "company", "related"]
  },
  sequence: {
    folder: "Cadence/Sequences",
    label: "Sequence",
    plural: "Sequences",
    fields: [
      { key: "name", label: "Name", primary: true },
      { key: "audience", label: "Audience" },
      { key: "steps", label: "Steps", type: "number" },
      { key: "active", label: "Active", type: "number" },
      { key: "status", label: "Status", type: "enum", options: ["Draft", "Active", "Paused", "Archived"] }
    ],
    columns: ["name", "audience", "steps", "active", "status"]
  },
  project: {
    folder: "Cadence/Projects",
    label: "Project",
    plural: "Projects",
    fields: [
      { key: "name", label: "Name", primary: true },
      { key: "status", label: "Status", type: "enum", options: ["active", "on_hold", "backlog", "done", "cancelled"] },
      { key: "priority", label: "Priority", type: "enum", options: ["low", "medium", "high"] },
      { key: "owner", label: "Owner" },
      { key: "started", label: "Started", type: "date" },
      { key: "due", label: "Due", type: "date" },
      { key: "tags", label: "Tags", type: "tags" }
    ],
    columns: ["name", "status", "owner", "due"]
  },
  deal: {
    folder: "Cadence/Pipeline",
    label: "Deal",
    plural: "Deals",
    fields: [
      { key: "title", label: "Title", primary: true },
      { key: "stage", label: "Stage", type: "enum", options: ["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"] },
      { key: "value", label: "Value", type: "currency" },
      { key: "company", label: "Company" },
      { key: "contact", label: "Contact" },
      { key: "owner", label: "Owner" },
      { key: "closeBy", label: "Close by", type: "date" }
    ],
    columns: ["title", "stage", "value", "company", "closeBy"]
  }
};
var DEAL_STAGES = ["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];

// src/utils/csv.ts
function parseCSV(text) {
  if (!text) return [];
  if (text.charCodeAt(0) === 65279) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = "";
  let inQuote = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuote = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuote = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

// src/utils/entities.ts
var import_obsidian2 = require("obsidian");

// src/utils/parsing.ts
function parseLinkValues(val) {
  if (val == null || val === "") return [];
  let rawItems = [];
  if (Array.isArray(val)) {
    rawItems = val.map((v) => String(v).trim());
  } else {
    const str = String(val).trim();
    if (str.includes("[[")) {
      const regex = /\[\[(.*?)\]\]/g;
      let match;
      while ((match = regex.exec(str)) !== null) {
        if (match[1].trim()) {
          rawItems.push(match[1].trim());
        }
      }
      if (rawItems.length === 0 && str) {
        rawItems = str.split(",").map((s) => s.trim()).filter(Boolean);
      }
    } else {
      rawItems = str.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return rawItems.map((item) => {
    let clean = item.replace(/^\[\[|\]\]$/g, "").trim();
    let display = clean;
    if (clean.includes("|")) {
      const parts = clean.split("|");
      clean = parts[0].trim();
      display = parts[1].trim();
    }
    return { target: clean, display };
  }).filter((item) => item.target);
}
function parseH2Sections(content) {
  const lines = content.split("\n");
  const sections = {};
  let cur = null, buf = [];
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      if (cur) sections[cur] = buf.join("\n");
      cur = line.replace(/^##\s+/, "").trim();
      buf = [];
    } else if (cur) {
      buf.push(line);
    }
  }
  if (cur) sections[cur] = buf.join("\n");
  return sections;
}
function parseHeaderKey(key) {
  const match = key.match(/(.*?)(#[\w\-]+)$/);
  if (match) {
    return {
      cleanLabel: match[1].trim(),
      tag: match[2].trim()
    };
  }
  return {
    cleanLabel: key.trim(),
    tag: ""
  };
}
function parseMilestones(text) {
  if (!text) return [];
  const lines = text.split("\n");
  const items = [];
  let current = null;
  for (const line of lines) {
    if (/^\s*-\s\[(x|X| )\]\s/.test(line)) {
      if (current) items.push(current);
      const done = / \[(x|X)\] /.test(line);
      const rest = line.replace(/^\s*-\s\[(x|X| )\]\s/, "");
      const m = rest.match(/^(\d{4}-\d{2}-\d{2})\s*(?:[—–-]\s*)?(.+)?$/);
      const date = m && m[1] ? parseYmd(m[1]) : null;
      const title = m ? (m[2] || "").trim() : rest.trim();
      current = {
        done,
        date,
        title,
        notes: ""
      };
    } else if (current && line.trim() && /^[ \t]/.test(line)) {
      const stripped = line.replace(/^( {1,4}|\t)/, "");
      current.notes = current.notes ? current.notes + "\n" + stripped : stripped;
    }
  }
  if (current) items.push(current);
  return items;
}
function stringifyMilestones(items) {
  if (!items || !items.length) return "";
  return items.map((m) => {
    const box = m.done ? "- [x] " : "- [ ] ";
    const date = m.date instanceof Date && !isNaN(m.date.getTime()) ? `${m.date.getFullYear()}-${String(m.date.getMonth() + 1).padStart(2, "0")}-${String(m.date.getDate()).padStart(2, "0")} ` : "";
    const sep = date && m.title ? "\u2014 " : "";
    let line = `${box}${date}${sep}${m.title || ""}`.trimEnd();
    if (m.notes && m.notes.trim()) {
      const noteLines = m.notes.split("\n").map((l) => "    " + l).join("\n");
      line += "\n" + noteLines;
    }
    return line;
  }).join("\n");
}
function parseTasksList(text) {
  if (!text) return [];
  return text.split("\n").filter((l) => /^\s*-\s\[(x|X| )\]\s/.test(l)).map((l) => ({
    done: / \[(x|X)\] /.test(l),
    title: l.replace(/^\s*-\s\[(x|X| )\]\s/, "")
  }));
}
function stringifyTasks(items) {
  if (!items || !items.length) return "";
  return items.map((t) => `${t.done ? "- [x] " : "- [ ] "}${t.title || ""}`).join("\n");
}
function parseSections(content, settings) {
  const lines = content.split("\n");
  const tasks = [];
  let journal = "";
  let mode = null;
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      const stripped = line.trim();
      if (stripped === settings.tasksHeading) {
        mode = "tasks";
        continue;
      }
      if (stripped === settings.journalHeading) {
        mode = "journal";
        continue;
      }
      mode = null;
      continue;
    }
    if (mode === "tasks") {
      if (/^\s*-\s\[(x|X| )\]\s/.test(line)) tasks.push(line);
    } else if (mode === "journal") {
      journal += (journal ? "\n" : "") + line;
    }
  }
  return { tasks, journal: journal.replace(/\s+$/, ""), raw: content };
}
function appendSection(content, heading, body) {
  return content.replace(/\s*$/, "") + `

${heading}
${body}
`;
}
function replaceSection(content, heading, newBody) {
  const lines = content.split("\n");
  const headIdx = lines.findIndex((l) => l.trim() === heading);
  if (headIdx === -1) {
    return appendSection(content, heading, newBody);
  }
  let endIdx = lines.length;
  for (let i = headIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  const before = lines.slice(0, headIdx + 1);
  const after = lines.slice(endIdx);
  const bodyLines = newBody.split("\n");
  return [...before, ...bodyLines, "", ...after].join("\n").replace(/\n{3,}/g, "\n\n");
}

// src/utils/vault.ts
async function ensureFolderSync(app, path) {
  const parts = path.split("/").filter(Boolean);
  let cur = "";
  for (const p of parts) {
    cur = cur ? `${cur}/${p}` : p;
    if (!app.vault.getAbstractFileByPath(cur)) {
      await app.vault.createFolder(cur).catch(() => {
      });
    }
  }
}

// src/utils/templates.ts
async function ensureDefaultTemplates(app) {
  const templatesFolder = "Cadence/Templates";
  await ensureFolderSync(app, templatesFolder);
  for (const [entityKey, def] of Object.entries(ENTITIES)) {
    const targetPath = `${templatesFolder}/${entityKey}.md`;
    let tFile = app.vault.getAbstractFileByPath(targetPath);
    if (!tFile) {
      await app.vault.create(targetPath, defaultTemplateContent(entityKey));
    }
  }
  const dailyTargetPath = `${templatesFolder}/daily.md`;
  let dailyTFile = app.vault.getAbstractFileByPath(dailyTargetPath);
  if (!dailyTFile) {
    await app.vault.create(dailyTargetPath, DAILY_TEMPLATE_CONTENT);
  }
}
var DAILY_TEMPLATE_CONTENT = [
  "# {{date}}",
  "",
  "## Today",
  "- [ ] ",
  "",
  "## Journal",
  "",
  ""
].join("\n");
function defaultTemplateContent(entityKey) {
  let templateContent = entityTemplate(entityKey, "{{name}}");
  if (entityKey === "project") {
    templateContent = projectTemplate("{{name}}");
  } else if (entityKey === "company") {
    templateContent += "\n## Description #notes\n_Company description and profile..._\n\n## Contacts #cross-contact-company-table\n\n## Deals #cross-deal-company-kanban\n";
  } else if (entityKey === "contact") {
    templateContent += "\n## Bio #notes\n_Background, interests, and how we met..._\n\n## Tasks #tasks\n- [ ] Follow up in 2 weeks\n";
  } else {
    templateContent += "\n## Notes #notes\n_Context and general notes..._\n";
  }
  return templateContent;
}
function entityTemplate(entityKey, name) {
  if (entityKey === "project") return projectTemplate(name);
  const def = ENTITIES[entityKey];
  const lines = ["---"];
  const hasTypeField = def.fields.some((f) => f.key === "type");
  if (!hasTypeField) lines.push(`type: ${entityKey}`);
  def.fields.forEach((f) => {
    if (f.key === "type") {
      if (entityKey === "activity") {
        lines.push("type:");
      } else {
        lines.push(`type: ${entityKey}`);
      }
    } else if (f.key === def.fields[0].key) lines.push(`${f.key}: ${name}`);
    else if (f.type === "tags" || f.isList) lines.push(`${f.key}: []`);
    else if (f.type === "number" || f.type === "currency") lines.push(`${f.key}: 0`);
    else lines.push(`${f.key}:`);
  });
  if (entityKey === "deal") {
    const idx = lines.findIndex((l) => l.startsWith("stage:"));
    if (idx >= 0) lines[idx] = "stage: [Lead]";
  }
  lines.push("---", "", `# ${name}`, "", "");
  return lines.join("\n");
}
function projectTemplate(name) {
  const today = ymd(/* @__PURE__ */ new Date());
  return [
    "---",
    "type: project",
    `name: ${name}`,
    "status: [active]",
    "priority: [medium]",
    "owner: []",
    `started: ${today}`,
    "due:",
    "tags: []",
    "related_deals: []",
    "related_partners: []",
    "---",
    "",
    `# ${name}`,
    "",
    "## Brief",
    "_The outcome we want, why now._",
    "",
    "",
    "## Scope",
    "**In scope:**",
    "- ",
    "",
    "**Out of scope:**",
    "- ",
    "",
    "## Milestones",
    `- [ ] ${today} \u2014 First milestone`,
    "",
    "## Tasks",
    "- [ ] ",
    "",
    "## Risks",
    "- ",
    "",
    "## Stakeholders",
    "- ",
    "",
    "## Notes",
    "",
    ""
  ].join("\n");
}

// src/utils/entities.ts
function getDealStages() {
  return getEnumOptions("deal", "stage", DEAL_STAGES);
}
function entityKeyFromFile(app, file) {
  if (!file) return null;
  const cache = app.metadataCache.getFileCache(file);
  const raw = cache && cache.frontmatter && cache.frontmatter.type;
  const t = Array.isArray(raw) ? raw.length === 1 ? raw[0] : null : raw;
  if (typeof t === "string" && Object.prototype.hasOwnProperty.call(ENTITIES, t) && ENTITIES[t]) return t;
  for (const [key, def] of Object.entries(ENTITIES)) {
    if (file.path.startsWith(def.folder + "/")) return key;
  }
  return null;
}
function listEntityFiles(app, entityKey) {
  const def = ENTITIES[entityKey];
  if (!def) return [];
  const root = app.vault.getAbstractFileByPath(def.folder);
  if (!root || !root.children) return [];
  const out = [];
  const walk = (node) => {
    for (const child of node.children) {
      if (child.children) walk(child);
      else if (typeof child.path === "string" && child.path.toLowerCase().endsWith(".md")) {
        out.push(child);
      }
    }
  };
  walk(root);
  return out;
}
function getEnumOptions(entityKey, fieldKey, fallback) {
  const def = ENTITIES[entityKey];
  if (!def || !def.fields) return fallback;
  const f = def.fields.find((field) => field.key === fieldKey);
  return f && f.options && f.options.length > 0 ? f.options : fallback;
}
function getFieldSuggestionSource(f) {
  if (!f) return "none";
  if (f.suggestionSource) return f.suggestionSource;
  const k = f.key;
  if (f.type === "tags" || k === "tags") return "tags";
  if (["owner", "assigned", "contact", "contacts", "with"].includes(k)) return "contact";
  if (k === "company") return "company";
  if (k === "partner") return "partner";
  if (k === "related") return "project";
  if (["domain", "industry", "role"].includes(k)) return "history";
  if (f.type === "multitext") return "history";
  return "none";
}
async function migrateFrontmatterType(app, entityKey, fieldKey, oldType, newType) {
  if (oldType === newType) return;
  const files = listEntityFiles(app, entityKey);
  if (!files || files.length === 0) return;
  let count = 0;
  for (const file of files) {
    await app.fileManager.processFrontMatter(file, (fm) => {
      if (fm[fieldKey] === void 0) return;
      const val = fm[fieldKey];
      let newVal = val;
      const isNewList = ["multitext", "tags"].includes(newType);
      const isOldList = ["multitext", "tags"].includes(oldType) || Array.isArray(val);
      if (isNewList && !isOldList) {
        if (typeof val === "string") {
          const parts = val.split(",").map((s) => s.trim()).filter(Boolean);
          newVal = parts.map((part) => {
            if (newType === "tags") {
              return part.replace(/^#|^\[\[|\]\]$/g, "").trim();
            }
            const isRelationKey = ["owner", "company", "contact", "with", "related", "partner"].includes(fieldKey);
            if (isRelationKey) {
              if (!part.startsWith("[[") && !part.endsWith("]]")) {
                return `[[${part}]]`;
              }
            }
            return part;
          });
        } else if (val != null) {
          newVal = [String(val)];
        }
      } else if (!isNewList && isOldList) {
        if (Array.isArray(val)) {
          newVal = val.map((v) => String(v).replace(/^\[\[|\]\]$/g, "").trim()).filter(Boolean).join(", ");
        } else if (val != null) {
          newVal = String(val).replace(/^\[\[|\]\]$/g, "").trim();
        }
      } else {
        if (newType === "number" || newType === "currency") {
          let cleanStr = String(val);
          if (Array.isArray(val)) cleanStr = String(val[0]);
          cleanStr = cleanStr.replace(/[^0-9.-]/g, "");
          const n = Number(cleanStr);
          newVal = isNaN(n) ? null : n;
        } else if (newType === "date") {
          let cleanStr = String(val);
          if (Array.isArray(val)) cleanStr = String(val[0]);
          cleanStr = cleanStr.replace(/^\[\[|\]\]$/g, "").trim();
          const match = cleanStr.match(/\d{4}-\d{2}-\d{2}/);
          newVal = match ? match[0] : null;
        } else {
          if (Array.isArray(val)) {
            newVal = val.map((v) => String(v).replace(/^\[\[|\]\]$/g, "").trim()).join(", ");
          } else {
            newVal = String(val);
          }
        }
      }
      fm[fieldKey] = newVal;
      count++;
    });
  }
  new import_obsidian2.Notice(`Migrated ${count} files for field "${fieldKey}" to type "${newType}".`);
}
async function migrateFrontmatterKey(app, entityKey, oldKey, newKey) {
  if (oldKey === newKey) return;
  const files = listEntityFiles(app, entityKey);
  if (!files || files.length === 0) return;
  let count = 0;
  for (const file of files) {
    await app.fileManager.processFrontMatter(file, (fm) => {
      if (fm[oldKey] !== void 0) {
        fm[newKey] = fm[oldKey];
        delete fm[oldKey];
        count++;
      }
    });
  }
  new import_obsidian2.Notice(`Renamed frontmatter key "${oldKey}" to "${newKey}" in ${count} files.`);
}
function readEntity(app, file) {
  const cache = app.metadataCache.getFileCache(file) || {};
  const fm = cache.frontmatter || {};
  return { file, frontmatter: fm, basename: file.basename };
}
function listEntities(app, entityKey) {
  return listEntityFiles(app, entityKey).map((f) => readEntity(app, f));
}
function entityValue(entity, key, def) {
  const fm = entity.frontmatter || {};
  let val = fm[key];
  if (val != null && val !== "") {
    if (key === "stage" && Array.isArray(val)) {
      return val[0] || "";
    }
    return val;
  }
  if (key === "type" && def && def.plural !== "Activities") {
    for (const [k, d] of Object.entries(ENTITIES)) {
      if (d === def) return k;
    }
  }
  if (def && def.fields[0] && def.fields[0].key === key) return entity.basename;
  return "";
}
async function readProjectMeta(app, file) {
  const content = await app.vault.read(file);
  const sections = parseH2Sections(content);
  let milestoneText = "";
  for (const [key, val] of Object.entries(sections)) {
    const { cleanLabel, tag } = parseHeaderKey(key);
    if (tag === "#milestones" || cleanLabel.toLowerCase() === "milestones") {
      milestoneText = val;
      break;
    }
  }
  const milestones = parseMilestones(milestoneText);
  const total = milestones.length;
  const done = milestones.filter((m) => m.done).length;
  const percent = total === 0 ? 0 : Math.round(done / total * 100);
  const today = startOfDay(/* @__PURE__ */ new Date());
  const upcoming = milestones.filter((m) => !m.done && m.date).sort((a, b) => a.date - b.date);
  const next = upcoming[0] || null;
  return { content, sections, milestones, total, done, percent, next, today };
}
async function createEntity(app, entityKeyOrFolder, rawName) {
  let folder = entityKeyOrFolder;
  let label = "Note";
  let isEntity = false;
  if (ENTITIES[entityKeyOrFolder]) {
    const def = ENTITIES[entityKeyOrFolder];
    folder = def.folder;
    label = def.label;
    isEntity = true;
  } else if (entityKeyOrFolder && entityKeyOrFolder.startsWith("folder:")) {
    folder = entityKeyOrFolder.slice("folder:".length);
  }
  if (!isEntity && folder) {
    const normalizedPath = folder.replace(/\/+$/, "").toLowerCase();
    for (const [ek, def] of Object.entries(ENTITIES)) {
      if (def && def.folder && def.folder.replace(/\/+$/, "").toLowerCase() === normalizedPath) {
        entityKeyOrFolder = ek;
        folder = def.folder;
        label = def.label;
        isEntity = true;
        break;
      }
    }
  }
  await ensureFolderSync(app, folder);
  const safeName = (rawName || `Untitled ${label}`).replace(/[\\/:*?"<>|]/g, "-").trim() || "Untitled";
  let path = `${folder}/${safeName}.md`;
  let n = 2;
  while (app.vault.getAbstractFileByPath(path)) {
    path = `${folder}/${safeName} ${n}.md`;
    n++;
  }
  let template = "";
  let customTemplateContent = null;
  if (isEntity) {
    const templatesFolder = "Cadence/Templates";
    await ensureFolderSync(app, templatesFolder);
    const def = ENTITIES[entityKeyOrFolder];
    const pathsToTry = [
      `${templatesFolder}/${entityKeyOrFolder}.md`,
      `${templatesFolder}/${def.label}.md`,
      `${templatesFolder}/${def.plural}.md`,
      `${templatesFolder}/${entityKeyOrFolder.toLowerCase()}.md`,
      `${templatesFolder}/${def.label.toLowerCase()}.md`,
      `${templatesFolder}/${def.plural.toLowerCase()}.md`
    ];
    for (const p of pathsToTry) {
      const tFile = app.vault.getAbstractFileByPath(p);
      if (tFile && tFile instanceof import_obsidian2.TFile) {
        customTemplateContent = await app.vault.read(tFile);
        break;
      }
    }
  }
  if (customTemplateContent !== null) {
    const now = /* @__PURE__ */ new Date();
    const timeStr = now.toLocaleTimeString(void 0, { hour: "2-digit", minute: "2-digit" });
    template = customTemplateContent.replace(/\{\{name\}\}/gi, safeName).replace(/\{\{title\}\}/gi, safeName).replace(/\{\{date\}\}/gi, ymd(now)).replace(/\{\{time\}\}/gi, timeStr);
  } else {
    template = isEntity ? entityTemplate(entityKeyOrFolder, safeName) : `---
name: ${safeName}
---

# ${safeName}

`;
  }
  return await app.vault.create(path, template);
}
function projectNameFromPath(app, path) {
  if (!path) return null;
  const file = app.vault.getAbstractFileByPath(path);
  if (!file) return path.split("/").pop().replace(/\.md$/, "");
  const cache = app.metadataCache.getFileCache(file);
  const fmName = cache && cache.frontmatter && cache.frontmatter.name;
  return fmName || file.basename;
}

// src/modals/csv-import-mapping.ts
function uniqueCsvHeaders(headers) {
  const taken = new Set(headers);
  const seen = /* @__PURE__ */ new Set();
  return headers.map((h) => {
    if (!seen.has(h)) {
      seen.add(h);
      return h;
    }
    let n = 2;
    const named = (i) => h ? `${h} (${i})` : `(${i})`;
    while (taken.has(named(n)) || seen.has(named(n))) n++;
    seen.add(named(n));
    return named(n);
  });
}
function autoDetectCsvMapping(def, headers) {
  const mapping = {};
  if (!def || !headers.length) return mapping;
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  const keyByNorm = {};
  def.fields.forEach((f) => {
    keyByNorm[norm(f.key)] = f.key;
    keyByNorm[norm(f.label)] = f.key;
  });
  const synonyms = {
    "fullname": "name",
    "displayname": "name",
    "contact": "name",
    "companyname": "company",
    "organisation": "company",
    "organization": "company",
    "phone": "name",
    // not great — leave unmapped
    "mail": "email",
    "emailaddress": "email",
    "amount": "value",
    "price": "value",
    "mrr": "value",
    "arr": "value",
    "closedate": "closeBy",
    "expectedclose": "closeBy",
    "lastcontacted": "lastContact",
    "lastcontact": "lastContact"
  };
  headers.forEach((h) => {
    const n = norm(h);
    if (!n) {
      mapping[h] = null;
      return;
    }
    if (keyByNorm[n]) {
      mapping[h] = keyByNorm[n];
      return;
    }
    if (synonyms[n] && def.fields.some((f) => f.key === synonyms[n])) {
      mapping[h] = synonyms[n];
      return;
    }
    const fuzzy = def.fields.find((f) => n.includes(norm(f.key)) || norm(f.key).includes(n));
    mapping[h] = fuzzy ? fuzzy.key : null;
  });
  return mapping;
}
function csvRowExtras(def, mapping, headers, row, primaryKey) {
  const extras = {};
  Object.entries(mapping).forEach(([header, key]) => {
    if (!key || key === primaryKey) return;
    const idx = headers.indexOf(header);
    let val = String(row[idx] || "").trim();
    if (!val) return;
    const fdef = def.fields.find((f) => f.key === key);
    if (fdef) {
      if (fdef.type === "number" || fdef.type === "currency") {
        const cleaned = val.replace(/[^\d.\-]/g, "");
        const n = Number(cleaned);
        if (isNaN(n)) return;
        val = n;
      } else if (fdef.type === "tags") {
        val = val.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
        if (!val.length) return;
      } else if (fdef.type === "date") {
        const d = new Date(val);
        if (!isNaN(d.getTime())) val = d.toISOString().slice(0, 10);
      }
    }
    extras[key] = val;
  });
  return extras;
}

// src/modals/import-modal.ts
function csvColumnSamples(rows, index) {
  return rows.slice(0, 2).map((r) => String(r[index] || "").trim()).filter(Boolean);
}
function csvImportSummary(def, mapping, rowCount) {
  if (rowCount === 0) {
    return { ready: false, text: "The CSV has a header row but no data rows, so there is nothing to import." };
  }
  const primaryMapped = Object.values(mapping).includes(def.fields[0].key);
  if (!primaryMapped) {
    return { ready: false, text: `No CSV column maps to "${def.fields[0].label}" \u2014 required to name the file. Pick a column above.` };
  }
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  return {
    ready: true,
    text: `Will create ${rowCount} ${rowCount === 1 ? def.label.toLowerCase() : def.plural.toLowerCase()} in ${def.folder}/  \xB7  ${mappedCount} column${mappedCount === 1 ? "" : "s"} mapped`
  };
}
function filterCsvFiles(files, query) {
  return files.filter((f) => f.path.toLowerCase().includes(query.toLowerCase()));
}
var CsvFileSuggestModal = class extends import_obsidian3.SuggestModal {
  constructor(app, files, onPick) {
    super(app);
    this.files = files;
    this.onPick = onPick;
    this.setPlaceholder("Search .csv files\u2026");
  }
  getSuggestions(q) {
    return filterCsvFiles(this.files, q);
  }
  renderSuggestion(file, el) {
    el.setText(file.path);
  }
  onChooseSuggestion(file) {
    this.onPick(file);
  }
};
var CadenceImportModal = class extends import_obsidian3.Modal {
  constructor(app, opts) {
    super(app);
    const entityKey = opts && opts.entityKey;
    this.entityKey = entityKey && Object.prototype.hasOwnProperty.call(ENTITIES, entityKey) ? entityKey : "contact";
    this.onSubmit = opts && opts.onSubmit || (() => {
    });
    this._reset();
  }
  /* Forget any parsed CSV, so a reopened modal matches its empty textarea. */
  _reset() {
    this.csvText = "";
    this.headers = [];
    this.rows = [];
    this.mapping = {};
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this._reset();
    contentEl.addClass("cad-import-modal");
    contentEl.createEl("h3", { cls: "cad-create-title", text: "Import from CSV" });
    const entityRow = contentEl.createDiv({ cls: "cad-create-row" });
    entityRow.createDiv({ cls: "cad-create-label", text: "IMPORT AS" });
    const entitySelect = entityRow.createEl("select", { cls: "cad-create-input" });
    Object.entries(ENTITIES).forEach(([key, def]) => {
      const o = entitySelect.createEl("option", { value: key, text: def.plural });
      if (key === this.entityKey) o.selected = true;
    });
    entitySelect.addEventListener("change", () => {
      this.entityKey = entitySelect.value;
      this._autoDetectMapping();
      this._renderPreview();
    });
    const csvRow = contentEl.createDiv({ cls: "cad-create-row" });
    csvRow.style.alignItems = "flex-start";
    csvRow.createDiv({ cls: "cad-create-label", text: "CSV DATA" });
    const csvWrap = csvRow.createDiv();
    csvWrap.style.display = "flex";
    csvWrap.style.flexDirection = "column";
    csvWrap.style.gap = "8px";
    const tabs = csvWrap.createDiv();
    tabs.style.display = "flex";
    tabs.style.gap = "6px";
    const pasteBtn = tabs.createEl("button", { cls: "cad-btn cad-btn-sm", text: "Paste" });
    pasteBtn.type = "button";
    const fileBtn = tabs.createEl("button", { cls: "cad-btn cad-btn-sm", text: "Pick .csv from vault" });
    fileBtn.type = "button";
    const ta = csvWrap.createEl("textarea", { cls: "cad-create-input" });
    ta.rows = 8;
    ta.placeholder = "Paste CSV here, including a header row\u2026";
    ta.style.fontFamily = "var(--font-monospace-theme, var(--font-monospace))";
    ta.style.fontSize = "12px";
    ta.style.resize = "vertical";
    ta.addEventListener("input", () => {
      this.csvText = ta.value;
      this._parse();
      this._renderPreview();
    });
    pasteBtn.addEventListener("click", () => ta.focus());
    fileBtn.addEventListener("click", async () => {
      const csvFiles = this.app.vault.getFiles().filter((f) => f.path.toLowerCase().endsWith(".csv"));
      if (!csvFiles.length) {
        new import_obsidian3.Notice("No .csv files found in vault. Drop one in the vault first.");
        return;
      }
      const picker = new CsvFileSuggestModal(this.app, csvFiles, async (file) => {
        try {
          const text = await this.app.vault.read(file);
          ta.value = text;
          this.csvText = text;
          this._parse();
          this._renderPreview();
        } catch (e) {
          new import_obsidian3.Notice(`Failed to read ${file.path}: ${e.message}`);
        }
      });
      picker.open();
    });
    this.previewEl = contentEl.createDiv({ cls: "cad-import-preview" });
    this._renderPreview();
    const actions = contentEl.createDiv({ cls: "cad-create-actions" });
    const cancel = actions.createEl("button", { cls: "cad-btn", text: "Cancel" });
    cancel.type = "button";
    cancel.addEventListener("click", () => this.close());
    this.importBtn = actions.createEl("button", { cls: "cad-btn primary", text: "Import" });
    this.importBtn.type = "button";
    this.importBtn.disabled = true;
    this.importBtn.addEventListener("click", () => this._submitImport());
  }
  _parse() {
    if (!this.csvText.trim()) {
      this.headers = [];
      this.rows = [];
      return;
    }
    const all = parseCSV(this.csvText);
    if (!all.length) {
      this.headers = [];
      this.rows = [];
      return;
    }
    this.headers = uniqueCsvHeaders(all[0].map((h) => String(h).trim()));
    this.rows = all.slice(1);
    this._autoDetectMapping();
  }
  _autoDetectMapping() {
    this.mapping = autoDetectCsvMapping(ENTITIES[this.entityKey], this.headers);
  }
  _renderPreview() {
    this.previewEl.empty();
    if (!this.headers.length) {
      this.previewEl.createDiv({ cls: "cad-empty", text: "Paste or pick a CSV to preview\u2026" });
      if (this.importBtn) this.importBtn.disabled = true;
      return;
    }
    const def = ENTITIES[this.entityKey];
    const head = this.previewEl.createDiv({ cls: "cad-create-label" });
    head.style.marginTop = "14px";
    head.setText("COLUMN MAPPING");
    const tableWrap = this.previewEl.createDiv({ cls: "cad-import-table-wrap" });
    const table = tableWrap.createEl("table", { cls: "cad-import-table" });
    const thr = table.createEl("thead").createEl("tr");
    thr.createEl("th", { text: "CSV column" });
    thr.createEl("th", { text: "Maps to" });
    thr.createEl("th", { text: "Sample" });
    const tbody = table.createEl("tbody");
    this.headers.forEach((h, i) => {
      const tr = tbody.createEl("tr");
      tr.createEl("td", { text: h });
      const mc = tr.createEl("td");
      const sel = mc.createEl("select", { cls: "cad-create-input cad-import-select" });
      sel.createEl("option", { value: "", text: "\u2014 skip \u2014" });
      def.fields.forEach((f) => {
        const o = sel.createEl("option", { value: f.key, text: f.label });
        if (this.mapping[h] === f.key) o.selected = true;
      });
      sel.addEventListener("change", () => {
        this.mapping[h] = sel.value || null;
        this._renderPreview();
      });
      const sample = tr.createEl("td");
      const samples = csvColumnSamples(this.rows, i);
      sample.setText(samples.join(" \xB7 ").slice(0, 60));
      sample.title = samples.join("\n");
    });
    const summary = this.previewEl.createDiv({ cls: "cad-import-summary" });
    const { ready, text } = csvImportSummary(def, this.mapping, this.rows.length);
    if (!ready) summary.addClass("cad-import-summary-warn");
    summary.setText(text);
    if (this.importBtn) this.importBtn.disabled = !ready;
  }
  async _submitImport() {
    const def = ENTITIES[this.entityKey];
    const primaryKey = def.fields[0].key;
    const primaryHeader = Object.entries(this.mapping).find(([_, v]) => v === primaryKey);
    if (!primaryHeader || !this.rows.length) return;
    const primaryColIdx = this.headers.indexOf(primaryHeader[0]);
    this.importBtn.disabled = true;
    this.importBtn.setText("Importing\u2026");
    const start = Date.now();
    let created = 0;
    let failed = 0;
    for (const row of this.rows) {
      const primaryValue = String(row[primaryColIdx] || "").trim();
      if (!primaryValue) {
        failed++;
        continue;
      }
      try {
        const file = await createEntity(this.app, this.entityKey, primaryValue);
        const extras = csvRowExtras(def, this.mapping, this.headers, row, primaryKey);
        if (Object.keys(extras).length) {
          await this.app.fileManager.processFrontMatter(file, (fm) => {
            Object.entries(extras).forEach(([k, v]) => {
              if (v == null || v === "") return;
              if (Array.isArray(v) && v.length === 0) return;
              fm[k] = v;
            });
          });
        }
        created++;
      } catch (e) {
        failed++;
      }
    }
    const elapsed = ((Date.now() - start) / 1e3).toFixed(1);
    new import_obsidian3.Notice(`Imported ${created} ${def.plural.toLowerCase()} in ${elapsed}s${failed ? ` \xB7 ${failed} skipped` : ""}`, 5e3);
    this.close();
    this.onSubmit({ created, failed, entityKey: this.entityKey });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/plugin/contact-project-sync.ts
var import_obsidian4 = require("obsidian");
function extractEntitiesFromValue(value) {
  if (value == null) return [];
  const results = [];
  const processStr = (str) => {
    str = String(str).trim();
    if (!str) return;
    if (str.includes("[[")) {
      const regex = /\[\[(.*?)\]\]/g;
      let match;
      while ((match = regex.exec(str)) !== null) {
        let target = match[1].trim();
        if (target.includes("|")) {
          target = target.split("|")[0].trim();
        }
        if (target) results.push(target);
      }
    } else if (str.includes(",")) {
      str.split(",").forEach((s) => {
        const item = s.trim();
        if (item) results.push(item);
      });
    } else {
      results.push(str);
    }
  };
  if (Array.isArray(value)) {
    value.forEach((val) => processStr(val));
  } else {
    processStr(value);
  }
  return results;
}
function isContactField(key, entityKey, entities) {
  if (["owner", "contact", "contacts", "with", "assigned"].includes(key.toLowerCase())) return true;
  if (entityKey && entities[entityKey]) {
    const fdef = entities[entityKey].fields.find((field) => field.key === key);
    if (fdef) {
      const sug = fdef.suggestionSource || getFieldSuggestionSource(fdef);
      if (sug === "contact" || sug === "folder:Cadence/Contacts") return true;
    }
  }
  return false;
}
function isProjectField(key, entityKey, entities) {
  if (["project", "projects", "related"].includes(key.toLowerCase())) return true;
  if (entityKey && entities[entityKey]) {
    const fdef = entities[entityKey].fields.find((field) => field.key === key);
    if (fdef) {
      const sug = fdef.suggestionSource || getFieldSuggestionSource(fdef);
      if (sug === "project" || sug === "folder:Cadence/Projects") return true;
    }
  }
  return false;
}
function noteLinks(note, contactNames, projectNames, entities) {
  const foundContacts = /* @__PURE__ */ new Set();
  const foundProjects = /* @__PURE__ */ new Set();
  if (note.entityKey === "contact") {
    foundContacts.add(note.basename.toLowerCase());
  } else if (note.entityKey === "project") {
    foundProjects.add(note.basename.toLowerCase());
  }
  for (const [key, val] of Object.entries(note.frontmatter)) {
    if (key === "type") continue;
    const extracted = extractEntitiesFromValue(val);
    for (const name of extracted) {
      if (!name) continue;
      const nameLower = name.toLowerCase();
      if (isContactField(key, note.entityKey, entities) || contactNames.has(nameLower)) {
        foundContacts.add(nameLower);
      }
      if (isProjectField(key, note.entityKey, entities) || projectNames.has(nameLower)) {
        foundProjects.add(nameLower);
      }
    }
  }
  return { contacts: foundContacts, projects: foundProjects };
}
function collectValidLinks(notes, contactNames, projectNames, entities) {
  const validLinks = /* @__PURE__ */ new Set();
  for (const note of notes) {
    if (note.entityKey === "contact") continue;
    const { contacts, projects } = noteLinks(note, contactNames, projectNames, entities);
    if (contacts.size > 0 && projects.size > 0) {
      for (const c of contacts) {
        for (const p of projects) {
          validLinks.add(`${c}|${p}`);
        }
      }
    }
  }
  return validLinks;
}
function projectLinkValue(names) {
  if (names.length === 0) return null;
  if (names.length === 1) return `[[${names[0]}]]`;
  return names.map((p) => `[[${p}]]`);
}
function writeProjectLinks(fm, names) {
  const value = projectLinkValue(names);
  if (value === null) {
    delete fm.project;
  } else {
    fm.project = value;
  }
}
function addProjectLink(current, projectName) {
  if (current.some((p) => p.toLowerCase() === projectName.toLowerCase())) return current;
  return [...current, projectName];
}
function projectItems(value) {
  if (Array.isArray(value)) return value.map(String);
  if (value == null) return [];
  return String(value).split(/,(?![^[]*\]\])/).map((s) => s.trim()).filter(Boolean);
}
function appendProjectLink(value, projectName) {
  const names = extractEntitiesFromValue(value);
  if (addProjectLink(names, projectName) === names) return null;
  const items = [...projectItems(value), `[[${projectName}]]`];
  return items.length === 1 ? items[0] : items;
}
function removeProjectLink(current, projectName) {
  return current.filter((p) => p.toLowerCase() !== projectName.toLowerCase());
}
function contactProjectsPlan(existing, backed) {
  const added = backed.filter((p) => !existing.some((ep) => ep.toLowerCase() === p.toLowerCase()));
  return added.length > 0 ? { added } : null;
}
async function syncContactProjectRelationships(plugin, changedFile) {
  if (plugin._syncInProgress) return;
  if (!changedFile || !changedFile.path.toLowerCase().endsWith(".md")) return;
  if (!plugin.app.vault.getAbstractFileByPath(changedFile.path)) return;
  try {
    plugin._syncInProgress = true;
    const contactFiles = listEntityFiles(plugin.app, "contact");
    const projectFiles = listEntityFiles(plugin.app, "project");
    const contactMap = /* @__PURE__ */ new Map();
    for (const f of contactFiles) {
      contactMap.set(f.basename.toLowerCase(), f);
    }
    const projectMap = /* @__PURE__ */ new Map();
    for (const f of projectFiles) {
      projectMap.set(f.basename.toLowerCase(), f);
    }
    const frontmatterOf = (f) => (plugin.app.metadataCache.getFileCache(f) || {}).frontmatter || {};
    const changedEntityKey = entityKeyFromFile(plugin.app, changedFile);
    if (changedEntityKey === "contact") {
    } else if (changedEntityKey === "project") {
      const projectLower = changedFile.basename.toLowerCase();
      const projectFm = frontmatterOf(changedFile);
      const projectContacts = [];
      for (const [key, val] of Object.entries(projectFm)) {
        if (key === "type") continue;
        if (isContactField(key, "project", ENTITIES)) {
          projectContacts.push(...extractEntitiesFromValue(val));
        }
      }
      const currentContactsOfProject = new Set(projectContacts.map((c) => c.toLowerCase()));
      for (const [contactLower, contactFile] of contactMap.entries()) {
        const contactProjects = extractEntitiesFromValue(frontmatterOf(contactFile).project);
        const listsProject = contactProjects.some((p) => p.toLowerCase() === projectLower);
        const projectListsContact = currentContactsOfProject.has(contactLower);
        if (projectListsContact && !listsProject) {
          await plugin.app.fileManager.processFrontMatter(contactFile, (cfm) => {
            const value = appendProjectLink(cfm.project, changedFile.basename);
            if (value !== null) cfm.project = value;
          });
          new import_obsidian4.Notice(`Auto-link: project "${changedFile.basename}" added to contact "${contactFile.basename}".`);
        }
      }
    } else {
      const allFiles = plugin.app.vault.getMarkdownFiles();
      const notes = [];
      for (const f of allFiles) {
        const entityKey = entityKeyFromFile(plugin.app, f);
        if (entityKey === "contact") continue;
        const cache = plugin.app.metadataCache.getFileCache(f);
        if (!cache || !cache.frontmatter) continue;
        notes.push({ entityKey, basename: f.basename, frontmatter: cache.frontmatter });
      }
      const validLinks = collectValidLinks(notes, contactMap, projectMap, ENTITIES);
      for (const [contactLower, contactFile] of contactMap.entries()) {
        const existingProjects = extractEntitiesFromValue(frontmatterOf(contactFile).project);
        const projectNamesToLink = /* @__PURE__ */ new Set();
        for (const link of validLinks) {
          const [c, p] = link.split("|");
          if (c === contactLower) {
            const pFile = projectMap.get(p);
            if (pFile) {
              projectNamesToLink.add(pFile.basename);
            }
          }
        }
        const plan = contactProjectsPlan(existingProjects, Array.from(projectNamesToLink));
        if (plan) {
          await plugin.app.fileManager.processFrontMatter(contactFile, (cfm) => {
            for (const name of plan.added) {
              const value = appendProjectLink(cfm.project, name);
              if (value !== null) cfm.project = value;
            }
          });
          new import_obsidian4.Notice(`Auto-link: project "${plan.added.join(", ")}" added to "${contactFile.basename}".`);
        }
      }
    }
  } catch (e) {
    console.error("Cadence: Error in syncContactProjectRelationships", e);
  } finally {
    plugin._syncInProgress = false;
  }
}
async function handleProjectDeletion(plugin, file) {
  if (plugin._syncInProgress) return;
  if (!file || !file.path || !file.path.toLowerCase().endsWith(".md")) return;
  const projectFolder = ENTITIES.project ? ENTITIES.project.folder : "Cadence/Projects";
  if (!file.path.startsWith(projectFolder + "/")) return;
  const projectName = file.basename;
  if (!projectName) return;
  const remaining = listEntityFiles(plugin.app, "project");
  if (remaining.some((f) => f.path !== file.path && f.basename.toLowerCase() === projectName.toLowerCase())) return;
  try {
    plugin._syncInProgress = true;
    const contactFiles = listEntityFiles(plugin.app, "contact");
    for (const contactFile of contactFiles) {
      const contactCache = plugin.app.metadataCache.getFileCache(contactFile) || {};
      const contactFm = contactCache.frontmatter || {};
      const existingProjectsVal = contactFm.project;
      if (!existingProjectsVal) continue;
      const existingProjectNames = extractEntitiesFromValue(existingProjectsVal);
      const hasProject = existingProjectNames.some((p) => p.toLowerCase() === projectName.toLowerCase());
      if (hasProject) {
        const remainingProjects = removeProjectLink(existingProjectNames, projectName);
        await plugin.app.fileManager.processFrontMatter(contactFile, (cfm) => {
          writeProjectLinks(cfm, remainingProjects);
        });
        new import_obsidian4.Notice(`Auto-link: project "${projectName}" removed from contact "${contactFile.basename}".`);
      }
    }
  } catch (e) {
    console.error("Cadence: Error in handleProjectDeletion", e);
  } finally {
    plugin._syncInProgress = false;
  }
}

// src/plugin/reminders-engine.ts
var import_obsidian5 = require("obsidian");

// src/utils/reminders.ts
function reminderId() {
  return "rem_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function isRepeating(repeat) {
  return repeat === "daily" || repeat === "weekly";
}
function repeatLabel(repeat) {
  if (!repeat || !isRepeating(repeat)) return null;
  return `\u21BB ${repeat}`;
}
function nextRepeat(when, repeat) {
  if (!when) return null;
  const d = when instanceof Date ? when : new Date(when);
  if (repeat === "daily") return new Date(d.getTime() + 864e5);
  if (repeat === "weekly") return new Date(d.getTime() + 7 * 864e5);
  return null;
}
function reminderTime(when) {
  if (!when) return null;
  const t = new Date(when).getTime();
  return isNaN(t) ? null : t;
}
function reminderTimeLabel(when) {
  if (!when) return "";
  return reminderTime(when) === null ? "unreadable time" : reminderTimeStr(when);
}
function reminderBucket(when) {
  if (!when) return "later";
  const now = Date.now();
  const w = new Date(when).getTime();
  if (w <= now + 60 * 60 * 1e3) return "now";
  const today = startOfDay(/* @__PURE__ */ new Date()).getTime();
  const tomorrow = today + 864e5;
  if (w < tomorrow) return "today";
  const weekEnd = today + 7 * 864e5;
  if (w < weekEnd) return "week";
  return "later";
}
function findProjectTaskReminder(plugin, projectPath, taskText) {
  if (!projectPath || !taskText) return null;
  const all = plugin.settings.reminders || [];
  return all.find((r) => !r.done && r.project === projectPath && r.text === taskText) || null;
}
function reminderTimeStr(when) {
  if (!when) return "";
  const d = new Date(when);
  if (isNaN(d.getTime())) return "";
  const today = startOfDay(/* @__PURE__ */ new Date()).getTime();
  const dDay = startOfDay(d).getTime();
  const time = d.toLocaleTimeString(void 0, { hour: "2-digit", minute: "2-digit" });
  if (dDay === today) return time;
  if (dDay === today + 864e5) return `Tomorrow ${time}`;
  if (dDay - today < 7 * 864e5 && dDay > today) {
    return d.toLocaleDateString(void 0, { weekday: "short" }) + " " + time;
  }
  return d.toLocaleDateString(void 0, { month: "short", day: "numeric" }) + " " + time;
}

// src/plugin/reminders-engine.ts
function newReminder(partial, now) {
  return {
    id: reminderId(),
    text: partial.text,
    when: partial.when || null,
    repeat: partial.repeat || "none",
    notes: partial.notes || "",
    project: partial.project || null,
    // file path of linked project, if any
    notified: false,
    done: false,
    createdAt: now.toISOString()
  };
}
function isDue(r, now) {
  if (r.done || r.notified) return false;
  if (!r.when) return false;
  const w = new Date(r.when).getTime();
  return !(isNaN(w) || w > now);
}
function dueReminders(reminders, now) {
  return reminders.filter((r) => isDue(r, now));
}
function advanceReminder(r, now) {
  let next = nextRepeat(r.when, r.repeat);
  if (!next || isNaN(next.getTime())) return null;
  while (next.getTime() <= now.getTime()) next = nextRepeat(next, r.repeat);
  return {
    id: reminderId(),
    text: r.text,
    when: next.toISOString(),
    repeat: r.repeat,
    notes: r.notes || "",
    project: r.project || null,
    notified: false,
    done: false,
    createdAt: now.toISOString()
  };
}
function continueSeries(r, now) {
  if (r.advanced || r.notified || r.done) return null;
  return advanceReminder(r, now);
}
function snoozePatch(ms, now) {
  const target = new Date(now + ms);
  return {
    when: target.toISOString(),
    notified: false,
    done: false
  };
}
var COMPLETE_PATCH = { done: true, notified: true };
async function addReminder(plugin, partial) {
  const r = newReminder(partial, /* @__PURE__ */ new Date());
  if (!Array.isArray(plugin.settings.reminders)) plugin.settings.reminders = [];
  plugin.settings.reminders.push(r);
  await plugin.saveSettings();
  plugin.refreshOpenViews();
  return r;
}
async function updateReminder(plugin, id, patch) {
  const i = (plugin.settings.reminders || []).findIndex((r) => r.id === id);
  if (i < 0) return null;
  plugin.settings.reminders[i] = Object.assign({}, plugin.settings.reminders[i], patch);
  await plugin.saveSettings();
  plugin.refreshOpenViews();
  return plugin.settings.reminders[i];
}
async function deleteReminder(plugin, id) {
  plugin.settings.reminders = (plugin.settings.reminders || []).filter((r) => r.id !== id);
  await plugin.saveSettings();
  plugin.refreshOpenViews();
}
function withSeriesHandedOn(plugin, id, patch) {
  const r = (plugin.settings.reminders || []).find((x) => x.id === id);
  if (!r || !isRepeating(r.repeat)) return patch;
  const next = continueSeries(r, /* @__PURE__ */ new Date());
  if (next) plugin.settings.reminders.push(next);
  return { ...patch, advanced: true };
}
async function snoozeReminder(plugin, id, ms) {
  return plugin.updateReminder(id, withSeriesHandedOn(plugin, id, snoozePatch(ms, Date.now())));
}
async function completeReminder(plugin, id) {
  return plugin.updateReminder(id, withSeriesHandedOn(plugin, id, { ...COMPLETE_PATCH }));
}
function tickReminders(plugin) {
  if (!Array.isArray(plugin.settings.reminders)) return;
  const due = dueReminders(plugin.settings.reminders, Date.now());
  const additions = [];
  for (const r of due) {
    plugin._fireReminder(r);
    const next = continueSeries(r, /* @__PURE__ */ new Date());
    if (next) additions.push(next);
    r.notified = true;
    if (isRepeating(r.repeat)) r.advanced = true;
  }
  if (additions.length) plugin.settings.reminders.push(...additions);
  if (due.length) {
    plugin.saveSettings().then(() => plugin.refreshOpenViews());
  }
}
function fireReminder(plugin, r) {
  new import_obsidian5.Notice(`\u23F0  ${r.text}`, 8e3);
  if (plugin.settings.desktopNotifications && typeof Notification !== "undefined") {
    try {
      if (Notification.permission === "granted") {
        new Notification("Cadence reminder", { body: r.text });
      }
    } catch (_) {
    }
  }
}

// src/constants/settings.ts
var DEFAULT_SETTINGS = {
  dailyNoteFolder: "daily",
  dailyNoteFormat: "YYYY-MM-DD",
  journalHeading: "## Journal",
  tasksHeading: "## Today",
  taskManagementSystem: "native",
  weekStartsOn: 1,
  defaultTab: "home",
  openOnStartup: true,
  collapsedGroups: {},
  currency: "USD",
  cadenceAppDark: false,
  taskProjectLinks: {},
  modules: {
    crm: true,
    prm: false,
    planner: true,
    projects: true
  },
  desktopNotifications: true,
  reminders: [],
  customPages: [],
  pageLayouts: {},
  pageKanbanGroupBy: {},
  crossSections: [],
  cadenceApiUrl: "",
  cadenceApiToken: "",
  projectDashboardWidgets: [],
  crmDashboardWidgets: [],
  prmDashboardWidgets: [],
  customEntities: {
    project: [
      { key: "name", label: "Name", primary: true, type: "text" },
      { key: "status", label: "Status", type: "enum", options: ["active", "on_hold", "backlog", "done", "cancelled"] },
      { key: "priority", label: "Priority", type: "enum", options: ["low", "medium", "high"] },
      { key: "owner", label: "Owner", type: "multitext", suggestionSource: "folder:Cadence/Contacts" },
      { key: "started", label: "Started", type: "date" },
      { key: "due", label: "Due", type: "date" },
      { key: "tags", label: "Tags", type: "tags" }
    ],
    contact: [
      { key: "name", label: "Name", primary: true, type: "text" },
      { key: "email", label: "Email", type: "multitext", isList: true, suggestionSource: "none" },
      { key: "phone", label: "Phone", isList: true, type: "multitext", suggestionSource: "none" },
      { key: "company", label: "Company", isList: true, type: "multitext", suggestionSource: "folder:Cadence/Companies" },
      { key: "role", label: "Role", isList: true, type: "multitext" },
      { key: "project", label: "Project", type: "multitext", suggestionSource: "folder:Cadence/Projects" },
      { key: "lastContact", label: "Last contact", type: "date" },
      { key: "tags", label: "Tags", type: "tags" }
    ],
    deal: [
      { key: "title", label: "Title", primary: true, type: "text" },
      { key: "stage", label: "Stage", type: "enum", options: ["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"] },
      { key: "value", label: "Value", type: "currency" },
      { key: "company", label: "Company", type: "multitext", suggestionSource: "folder:Cadence/Companies" },
      { key: "contact", label: "Contact", type: "multitext", suggestionSource: "folder:Cadence/Contacts" },
      { key: "closeBy", label: "Close by", type: "date" },
      { key: "project", label: "Project", type: "multitext", suggestionSource: "folder:Cadence/Projects" },
      { key: "owner", label: "Owner", type: "multitext", suggestionSource: "folder:Cadence/Contacts" }
    ],
    company: [
      { key: "name", label: "Name", primary: true, type: "text" },
      { key: "domain", label: "Domain", isList: true, type: "multitext" },
      { key: "industry", label: "Industry", isList: true, type: "multitext" },
      { key: "size", label: "Size", type: "text" },
      { key: "owner", label: "Owner", type: "multitext", suggestionSource: "folder:Cadence/Contacts" },
      { key: "tags", label: "Tags", type: "tags" }
    ],
    activity: [
      { key: "subject", label: "Subject", primary: true, type: "text" },
      { key: "type", label: "Type", type: "enum", options: ["Call", "Email", "Meeting", "Note", "Task"] },
      { key: "when", label: "When", type: "date" },
      { key: "with", label: "With", type: "multitext", suggestionSource: "folder:Cadence/Contacts" },
      { key: "company", label: "Company", type: "multitext", suggestionSource: "folder:Cadence/Companies" },
      { key: "project", label: "Project", type: "multitext", suggestionSource: "folder:Cadence/Projects" }
    ],
    partner: [
      { key: "name", label: "Name", primary: true },
      { key: "tier", label: "Tier", type: "enum", options: ["Gold", "Silver", "Bronze", "Standard"] },
      { key: "status", label: "Status", type: "enum", options: ["Active", "Onboarding", "Inactive", "Churned"] },
      { key: "owner", label: "Owner", type: "multitext", suggestionSource: "folder:Cadence/Contacts" },
      { key: "region", label: "Region" }
    ],
    registration: [
      { key: "title", label: "Title", primary: true },
      { key: "partner", label: "Partner" },
      { key: "status", label: "Status", type: "enum", options: ["Submitted", "Approved", "Rejected", "Expired"] },
      { key: "value", label: "Value", type: "currency" },
      { key: "submitted", label: "Submitted", type: "date" },
      { key: "expires", label: "Expires", type: "date" }
    ],
    commission: [
      { key: "reference", label: "Ref", primary: true },
      { key: "partner", label: "Partner" },
      { key: "amount", label: "Amount", type: "currency" },
      { key: "status", label: "Status", type: "enum", options: ["Pending", "Earned", "Paid", "Disputed"] },
      { key: "period", label: "Period" },
      { key: "paidOn", label: "Paid on", type: "date" }
    ],
    lead: [
      { key: "name", label: "Name", primary: true },
      { key: "company", label: "Company", type: "multitext", suggestionSource: "folder:Cadence/Companies" },
      { key: "source", label: "Source" },
      { key: "status", label: "Status", type: "enum", options: ["New", "Contacted", "Qualified", "Disqualified", "Converted"] },
      { key: "assigned", label: "Assigned" }
    ],
    certification: [
      { key: "name", label: "Name", primary: true },
      { key: "partner", label: "Partner" },
      { key: "level", label: "Level" },
      { key: "issued", label: "Issued", type: "date" },
      { key: "expires", label: "Expires", type: "date" }
    ],
    sequence: [
      { key: "name", label: "Name", primary: true },
      { key: "audience", label: "Audience" },
      { key: "steps", label: "Steps", type: "number" },
      { key: "active", label: "Active", type: "number" },
      { key: "status", label: "Status", type: "enum", options: ["Draft", "Active", "Paused", "Archived"] }
    ]
  }
};
var CURRENCY_OPTIONS = [
  { code: "USD", label: "USD \u2014 US Dollar" },
  { code: "EUR", label: "EUR \u2014 Euro" },
  { code: "GBP", label: "GBP \u2014 British Pound" },
  { code: "ZAR", label: "ZAR \u2014 South African Rand" },
  { code: "AUD", label: "AUD \u2014 Australian Dollar" },
  { code: "CAD", label: "CAD \u2014 Canadian Dollar" },
  { code: "CHF", label: "CHF \u2014 Swiss Franc" },
  { code: "JPY", label: "JPY \u2014 Japanese Yen" },
  { code: "INR", label: "INR \u2014 Indian Rupee" },
  { code: "BRL", label: "BRL \u2014 Brazilian Real" },
  { code: "AED", label: "AED \u2014 UAE Dirham" }
];

// src/utils/format.ts
function pctBand(pct) {
  if (pct < 25) return "rose";
  if (pct < 50) return "warn";
  if (pct < 75) return "mint";
  return "emerald";
}
function guessSingular(plural) {
  if (plural.length <= 1) return plural;
  if (plural === plural.toUpperCase()) return /[^S]S$/.test(plural) ? plural.slice(0, -1) : plural;
  if (/[^aeiou]ies$/i.test(plural)) return plural.slice(0, -3) + "y";
  if (/(ss|x|z|ch|sh)es$/i.test(plural)) return plural.slice(0, -2);
  if (/(ss|us|is)$/i.test(plural)) return plural;
  if (/s$/i.test(plural)) return plural.slice(0, -1);
  return plural;
}
function pluralize(singular) {
  if (/[^aeiou]y$/i.test(singular)) return singular.slice(0, -1) + "ies";
  if (/(s|x|z|ch|sh)$/i.test(singular)) return singular + "es";
  return singular + "s";
}
function countLabel(count, singular, plural = pluralize(singular)) {
  return `${count} ${count === 1 ? singular : plural}`;
}
var CURRENT_CURRENCY = "USD";
function setCurrentCurrency(code) {
  CURRENT_CURRENCY = code;
}
function fmtValue(val, type) {
  if (val == null || val === "") return "";
  if (type === "tags" && Array.isArray(val)) return val.map((t) => `#${t}`).join(" ");
  if (type === "date") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toLocaleDateString(void 0, { year: "numeric", month: "short", day: "numeric" });
    return String(val);
  }
  if (type === "currency") {
    const n = Number(val);
    if (!isNaN(n)) {
      try {
        return n.toLocaleString(void 0, { style: "currency", currency: CURRENT_CURRENCY, maximumFractionDigits: 0 });
      } catch (_) {
        return n.toLocaleString(void 0, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
      }
    }
    return String(val);
  }
  if (type === "number") return String(val);
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

// src/plugin/settings.ts
var CORE_ENTITY_KEYS = ["contact", "company", "partner", "registration", "commission", "lead", "certification", "activity", "sequence", "project", "deal"];
var PROPERTY_TYPE_ENTITIES = ["project", "deal", "contact", "company", "activity"];
function defaultSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}
function fillSettingDefaults(settings, defaults) {
  if (!settings.customEntities) {
    settings.customEntities = {};
  }
  for (const [entityKey, defaultFields] of Object.entries(defaults.customEntities)) {
    if (!settings.customEntities[entityKey] || settings.customEntities[entityKey].length === 0) {
      settings.customEntities[entityKey] = JSON.parse(JSON.stringify(defaultFields));
    }
  }
  if (!settings.projectDashboardWidgets || settings.projectDashboardWidgets.length === 0) {
    settings.projectDashboardWidgets = [
      { id: "w1", title: "Projects by Status", groupBy: "status", style: "donut" },
      { id: "w2", title: "Projects by Priority", groupBy: "priority", style: "bar" }
    ];
  }
  if (!settings.crmDashboardWidgets || settings.crmDashboardWidgets.length === 0) {
    settings.crmDashboardWidgets = [
      { id: "c1", title: "Deals by Stage", groupBy: "stage", style: "donut" },
      { id: "c2", title: "Deals by Owner", groupBy: "owner", style: "bar" }
    ];
  }
  if (!settings.prmDashboardWidgets || settings.prmDashboardWidgets.length === 0) {
    settings.prmDashboardWidgets = [
      { id: "p1", title: "Partners by Tier", groupBy: "tier", style: "donut" },
      { id: "p2", title: "Partners by Status", groupBy: "status", style: "bar" }
    ];
  }
}
function customEntityNames(entityKey, customPage) {
  let label, plural;
  if (customPage) {
    plural = customPage.label;
    const singular = (customPage.singular || "").trim();
    label = singular ? singular.charAt(0).toUpperCase() + singular.slice(1) : guessSingular(plural);
  } else {
    label = entityKey === entityKey.toUpperCase() ? entityKey : entityKey.charAt(0).toUpperCase() + entityKey.slice(1);
    plural = label + "s";
  }
  return { label, plural };
}
function reconstructEntities(settings, entities) {
  const activeCustomEntityKeys = (settings.customPages || []).map((p) => p.entityKey);
  for (const entityKey of Object.keys(settings.customEntities)) {
    if (!CORE_ENTITY_KEYS.includes(entityKey) && !activeCustomEntityKeys.includes(entityKey)) {
      delete settings.customEntities[entityKey];
      if (entities[entityKey]) {
        delete entities[entityKey];
      }
    }
  }
  if (settings.customEntities) {
    for (const [entityKey, customFields] of Object.entries(settings.customEntities)) {
      if (entities[entityKey]) {
        entities[entityKey].fields = customFields;
      } else {
        const customPages = settings.customPages || [];
        const customPage = customPages.find((p) => p.entityKey === entityKey);
        const { label, plural } = customEntityNames(entityKey, customPage);
        entities[entityKey] = {
          folder: `Cadence/${plural}`,
          label,
          plural,
          fields: customFields,
          columns: [customFields[0]?.key || "name"]
        };
      }
    }
  }
  for (const [entityKey, def] of Object.entries(entities)) {
    if (entityKey === "activity") continue;
    const hasType = def.fields.some((f) => f.key === "type");
    if (!hasType) {
      def.fields.push({
        key: "type",
        label: "Type",
        type: "text"
      });
    }
  }
}
function propertyTypeFor(f) {
  if (f.primary) return "text";
  const ftype = f.type || "text";
  let obsType = "text";
  if (ftype === "date") obsType = "date";
  else if (ftype === "number" || ftype === "currency") obsType = "number";
  else if (ftype === "tags") obsType = "tags";
  else if (ftype === "multitext") obsType = "multitext";
  else if (f.isList) obsType = "multitext";
  return obsType;
}
async function loadSettings(plugin) {
  const loadedData = await plugin.loadData() || {};
  plugin.settings = Object.assign(defaultSettings(), loadedData);
  fillSettingDefaults(plugin.settings, DEFAULT_SETTINGS);
  setCurrentCurrency(plugin.settings.currency || "USD");
  reconstructEntities(plugin.settings, ENTITIES);
}
async function saveSettings(plugin) {
  await plugin.saveData(plugin.settings);
  setCurrentCurrency(plugin.settings.currency || "USD");
}
function registerCustomPropertyTypes(plugin) {
  try {
    const manager = plugin.app.metadataTypeManager;
    if (manager && typeof manager.setType === "function") {
      for (const key of PROPERTY_TYPE_ENTITIES) {
        const def = ENTITIES[key];
        if (!def || !def.fields) continue;
        for (const f of def.fields) {
          manager.setType(f.key, propertyTypeFor(f));
        }
      }
    }
  } catch (e) {
    console.warn("Cadence: Failed to register property types", e);
  }
}

// src/settings/setting-tab.ts
var import_obsidian9 = require("obsidian");

// src/settings/custom-pages.ts
var import_obsidian7 = require("obsidian");

// src/modals/prompt.ts
var import_obsidian6 = require("obsidian");
var CadencePromptModal = class extends import_obsidian6.Modal {
  constructor(app, opts = {}) {
    super(app);
    this.title = opts.title || "Enter a name";
    this.placeholder = opts.placeholder || "";
    this.defaultValue = opts.defaultValue || "";
    this.cta = opts.cta || "Create";
    this.onSubmit = opts.onSubmit;
    this._submitted = false;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("cad-prompt-modal");
    contentEl.createEl("h3", { text: this.title });
    const input = contentEl.createEl("input", { type: "text" });
    input.placeholder = this.placeholder;
    input.value = this.defaultValue;
    input.style.width = "100%";
    input.style.padding = "8px 10px";
    input.style.fontSize = "14px";
    input.style.marginTop = "4px";
    const submit = () => {
      const v = input.value.trim();
      if (!v) {
        input.focus();
        return;
      }
      this._submitted = true;
      this.close();
      this.onSubmit?.(v);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    });
    const row = contentEl.createDiv();
    row.style.display = "flex";
    row.style.justifyContent = "flex-end";
    row.style.gap = "8px";
    row.style.marginTop = "14px";
    const cancel = row.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const ok = row.createEl("button", { text: this.cta, cls: "mod-cta" });
    ok.addEventListener("click", submit);
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }
  onClose() {
    if (!this._submitted && this.onSubmit) this.onSubmit(null);
    this.contentEl.empty();
  }
};

// src/settings/custom-pages.ts
var SECTION_OPTIONS = [
  { value: "planner", label: "Planner" },
  { value: "projects", label: "Projects" },
  { value: "crm", label: "CRM" },
  { value: "prm", label: "PRM" },
  { value: "workflow", label: "Workflow" },
  { value: "reports", label: "Reports" }
];
var LAYOUT_OPTIONS = [
  { value: "table", label: "Table view \u2630" },
  { value: "kanban", label: "Kanban board \u{1F5C2}" },
  { value: "cards", label: "Card grid \u2683" }
];
var LAYOUT_LABELS = {
  "table": "Table View \u2630",
  "kanban": "Kanban Board \u{1F5C2}",
  "cards": "Card Grid \u2683"
};
var ICON_OPTIONS = [
  { value: "file-text", label: "\u{1F4C4} Document (Default)" },
  { value: "folder-kanban", label: "\u{1F4C1} Folder / Projects" },
  { value: "users", label: "\u{1F465} Users / Contacts" },
  { value: "building-2", label: "\u{1F3E2} Building / Companies" },
  { value: "trending-up", label: "\u{1F4C8} Trending / Sales" },
  { value: "handshake", label: "\u{1F91D} Handshake / Partners" },
  { value: "target", label: "\u{1F3AF} Target / Leads" },
  { value: "zap", label: "\u26A1 Lightning / Sequences" },
  { value: "wallet", label: "\u{1F4BC} Wallet / Commissions" },
  { value: "clipboard-check", label: "\u{1F4CB} Clipboard / Registrations" },
  { value: "award", label: "\u{1F3C6} Award / Certifications" },
  { value: "calendar", label: "\u{1F4C5} Calendar / Activities" },
  { value: "star", label: "\u2B50 Star / VIP" },
  { value: "tag", label: "\u{1F3F7}\uFE0F Tag / Categories" },
  { value: "compass", label: "\u{1F9ED} Compass / Areas" },
  { value: "database", label: "\u{1F5C4}\uFE0F Database / Items" },
  { value: "check-square", label: "\u2611\uFE0F Checkbox / Tasks" }
];
var SECTION_LABELS = Object.fromEntries(SECTION_OPTIONS.map((o) => [o.value, o.label]));
function sectionLabel(sectionId2) {
  return SECTION_LABELS[sectionId2] || sectionId2;
}
function customPageLayoutLabel(layout) {
  return LAYOUT_LABELS[layout || "table"] || layout;
}
function customPageRows(customPages, entities) {
  return customPages.slice().sort((a, b) => a.label.localeCompare(b.label)).map((p) => ({
    page: p,
    label: p.label,
    section: sectionLabel(p.sectionId),
    entity: entities[p.entityKey] ? entities[p.entityKey].label : p.entityKey,
    layout: customPageLayoutLabel(p.defaultLayout)
  }));
}
function customPageEntityKey(label, sectionId2, singular) {
  const chosen = (singular || "").trim() || guessSingular(label);
  return { singular: chosen, entityKey: sectionId2 + "_" + chosen.toLowerCase().replace(/\s+/g, "_") };
}
function customEntityLabel(singular) {
  return singular === singular.toUpperCase() ? singular : singular.charAt(0).toUpperCase() + singular.slice(1);
}
function addCustomPage(settings, entities, form, now) {
  const val = (form.label || "").trim();
  if (!val) return { notice: "Please enter a page label." };
  const { singular, entityKey } = customPageEntityKey(val, form.sectionId, form.singular);
  const existing = (settings.customPages || []).find((page) => page.entityKey === entityKey);
  if (existing) return { notice: `A page for this entity already exists: "${existing.label}".` };
  if (!settings.customEntities) {
    settings.customEntities = {};
  }
  let newFields;
  if (settings.customEntities[entityKey]) {
    newFields = settings.customEntities[entityKey];
  } else {
    newFields = [
      { key: "name", label: "Name", primary: true, type: "text" },
      { key: "type", label: "Type", type: "text" }
    ];
    settings.customEntities[entityKey] = newFields;
  }
  entities[entityKey] = {
    folder: `Cadence/${val}`,
    label: customEntityLabel(singular),
    plural: val,
    fields: newFields,
    columns: ["name"]
  };
  const newPage = {
    id: `custom.${now}`,
    label: val,
    icon: form.icon || "file-text",
    entityKey,
    defaultLayout: form.layout,
    sectionId: form.sectionId,
    singular
  };
  const pages = settings.customPages || [];
  pages.push(newPage);
  settings.customPages = pages;
  if (!settings.pageLayouts) settings.pageLayouts = {};
  settings.pageLayouts[newPage.id] = newPage.defaultLayout;
  return { notice: `Page "${val}" added successfully.`, page: newPage };
}
function deleteCustomPage(settings, entities, pageId) {
  const originalIndex = settings.customPages.findIndex((page) => page.id === pageId);
  if (originalIndex < 0) return false;
  const entityKey = settings.customPages[originalIndex].entityKey;
  settings.customPages.splice(originalIndex, 1);
  if (CORE_ENTITY_KEYS.includes(entityKey)) return true;
  if (settings.customPages.some((page) => page.entityKey === entityKey)) return true;
  if (settings.customEntities && settings.customEntities[entityKey]) {
    delete settings.customEntities[entityKey];
  }
  if (entities[entityKey]) {
    delete entities[entityKey];
  }
  return true;
}
function renderCustomPagesSettings(tab, containerEl) {
  containerEl.createEl("h3", { text: "Custom Navigation Pages" });
  containerEl.createEl("p", {
    text: "Add custom pages to specific sections of your navigation sidebar. You can choose which entity they display and their default layout mode (Table, Kanban, or Card Grid).",
    cls: "setting-item-description"
  });
  const customPagesDiv = containerEl.createDiv({ cls: "cad-custom-pages-container" });
  const renderCustomPagesList = () => {
    customPagesDiv.empty();
    const rows = customPageRows(tab.plugin.settings.customPages || [], ENTITIES);
    if (rows.length === 0) {
      customPagesDiv.createEl("p", { text: "No custom pages added yet.", cls: "setting-item-description" });
    } else {
      const table = customPagesDiv.createEl("table", { cls: "cad-prop-table" });
      table.style.width = "100%";
      table.style.marginBottom = "16px";
      const thead = table.createEl("thead");
      const hr = thead.createEl("tr");
      hr.createEl("th", { text: "Label" });
      hr.createEl("th", { text: "Section" });
      hr.createEl("th", { text: "Entity Type" });
      hr.createEl("th", { text: "Default Layout" });
      hr.createEl("th", { text: "Actions" });
      const tbody = table.createEl("tbody");
      rows.forEach((row) => {
        const tr = tbody.createEl("tr");
        tr.createEl("td", { text: row.label });
        tr.createEl("td", { text: row.section });
        tr.createEl("td", { text: row.entity });
        tr.createEl("td", { text: row.layout });
        const actionsTd = tr.createEl("td");
        const delBtn = actionsTd.createEl("button", { cls: "cad-btn", text: "Delete" });
        delBtn.style.color = "var(--text-error)";
        delBtn.style.padding = "2px 8px";
        delBtn.style.height = "auto";
        delBtn.addEventListener("click", async () => {
          if (deleteCustomPage(tab.plugin.settings, ENTITIES, row.page.id)) {
            await tab.plugin.saveSettings();
            tab.plugin.refreshOpenViews();
            tab.display();
          }
        });
      });
    }
    const addForm = customPagesDiv.createDiv({ cls: "cad-custom-page-add-form" });
    addForm.style.border = "1px dashed var(--border-color)";
    addForm.style.borderRadius = "8px";
    addForm.style.padding = "12px";
    addForm.style.marginTop = "16px";
    addForm.style.background = "var(--background-primary-alt)";
    addForm.createEl("h4", { text: "+ Add Custom Navigation Page", attr: { style: "margin-top: 0;" } });
    const formRow = addForm.createDiv();
    formRow.style.display = "flex";
    formRow.style.flexWrap = "wrap";
    formRow.style.gap = "12px";
    formRow.style.alignItems = "flex-end";
    const labelStyle = "display: block; font-size: 0.85em; margin-bottom: 4px; font-weight: 500;";
    const labelWrap = formRow.createDiv();
    labelWrap.style.flex = "1";
    labelWrap.style.minWidth = "150px";
    labelWrap.createEl("label", { text: "Label:", attr: { style: labelStyle } });
    const labelInput = labelWrap.createEl("input", { type: "text", placeholder: "e.g. VIP Contacts" });
    labelInput.style.width = "100%";
    labelInput.style.padding = "4px 8px";
    const selectField = (label, options) => {
      const wrap = formRow.createDiv();
      wrap.style.minWidth = "120px";
      wrap.createEl("label", { text: label, attr: { style: labelStyle } });
      const select = wrap.createEl("select");
      select.style.width = "100%";
      options.forEach((opt) => {
        select.createEl("option", { value: opt.value, text: opt.label });
      });
      return select;
    };
    const sectionSelect = selectField("Sidebar Section:", SECTION_OPTIONS);
    const layoutSelect = selectField("Default Layout:", LAYOUT_OPTIONS);
    const iconSelect = selectField("Icon:", ICON_OPTIONS);
    const btnWrap = formRow.createDiv();
    const addBtn = btnWrap.createEl("button", { cls: "cad-btn primary", text: "Add Page" });
    addBtn.style.padding = "6px 12px";
    addBtn.style.height = "auto";
    const addPage = async (form) => {
      const result = addCustomPage(tab.plugin.settings, ENTITIES, form, Date.now());
      if (!result.page) {
        new import_obsidian7.Notice(result.notice);
        return;
      }
      await tab.plugin.saveSettings();
      tab.plugin.refreshOpenViews();
      new import_obsidian7.Notice(result.notice);
      tab.display();
    };
    addBtn.addEventListener("click", () => {
      const form = {
        label: labelInput.value,
        sectionId: sectionSelect.value,
        layout: layoutSelect.value,
        icon: iconSelect.value
      };
      const label = (form.label || "").trim();
      if (!label) {
        void addPage(form);
        return;
      }
      new CadencePromptModal(tab.app, {
        title: `Singular name for "${label}"`,
        placeholder: "e.g. Product",
        defaultValue: guessSingular(label),
        cta: "Add Page",
        onSubmit: (singular) => {
          if (singular) void addPage({ ...form, singular });
        }
      }).open();
    });
  };
  renderCustomPagesList();
}

// src/settings/entity-properties.ts
var import_obsidian8 = require("obsidian");
var CORE_ENTITY_KEYS2 = ["contact", "company", "partner", "registration", "commission", "lead", "certification", "activity", "sequence", "project", "deal"];
var CORE_ENTITY_SECTIONS = {
  project: "Projects",
  deal: "CRM",
  contact: "CRM",
  company: "CRM",
  activity: "CRM",
  partner: "PRM",
  registration: "PRM",
  commission: "PRM",
  lead: "PRM",
  certification: "PRM",
  sequence: "Workflow"
};
function entityPickerLabel(key, ent, customPages) {
  let label = CORE_ENTITY_SECTIONS[key];
  if (!label) {
    const customPage = customPages.find((p) => p.entityKey === key);
    if (customPage) label = sectionLabel(customPage.sectionId);
  }
  if (!label) return ent.label;
  const capSection = label.charAt(0).toUpperCase() + label.slice(1);
  return `${capSection}/${ent.label}`;
}
function entityPickerOptions(entities, customPages) {
  return Object.entries(entities).map(([key, ent]) => ({ value: key, label: entityPickerLabel(key, ent, customPages) })).sort((a, b) => a.label.localeCompare(b.label));
}
function isPermanentlyLocked(entityKey, field) {
  if (field.primary) return true;
  const k = field.key;
  if (entityKey === "project" && (k === "status" || k === "priority")) return true;
  if (entityKey === "deal" && k === "stage") return true;
  return false;
}
function areOptionsLocked(entityKey, field) {
  return isPermanentlyLocked(entityKey, field) && !(entityKey === "deal" && field.key === "stage");
}
function isFieldLocked(entityKey, field) {
  if (isPermanentlyLocked(entityKey, field)) return true;
  if (field.locked !== void 0) return !!field.locked;
  return field.key === "type" || CORE_ENTITY_KEYS2.includes(entityKey);
}
function snapshotCustomEntities(settings, entities) {
  if (!settings.customEntities) {
    settings.customEntities = {};
  }
  for (const [ek, ent] of Object.entries(entities)) {
    settings.customEntities[ek] = JSON.parse(JSON.stringify(ent.fields));
  }
}
function fieldKeySuggestions(entities, frontmatters) {
  const keys = /* @__PURE__ */ new Set();
  for (const ent of Object.values(entities)) {
    ent.fields.forEach((f) => keys.add(f.key));
  }
  for (const fm of frontmatters) {
    Object.keys(fm).forEach((k) => {
      if (k !== "position") keys.add(k);
    });
  }
  return keys;
}
function filterKeySuggestions(keys, typed) {
  const q = typed.trim().toLowerCase();
  return [...keys].filter((k) => !q || k.toLowerCase().includes(q)).sort();
}
function sanitizeFieldKey(raw) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}
function parseEnumOptions(raw) {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
var FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "multitext", label: "List / Multiple Links" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "tags", label: "Tags" },
  { value: "enum", label: "Select (Enum)" }
];
var TYPE_FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "enum", label: "Select (Enum)" }
];
function fieldTypeOptions(field) {
  const types = field.key === "type" ? TYPE_FIELD_TYPE_OPTIONS : FIELD_TYPE_OPTIONS;
  return types.map((t) => ({ ...t, selected: field.type === t.value || !field.type && t.value === "text" }));
}
function optionsCellKind(field) {
  if (field.primary || field.type === "date" || field.type === "currency") return "none";
  if (field.type === "enum") return "enum";
  if (field.type === "multitext" || field.type === "tags") return "source";
  return "none";
}
var SOURCE_OPTIONS = [
  { value: "history", label: "History / Shared" },
  { value: "tags", label: "Obsidian Tags" },
  { value: "none", label: "None" },
  { value: "folder", label: "Folder\u2026" }
];
function otherSource(field) {
  const activeSource = field.suggestionSource || getFieldSuggestionSource(field);
  if (!activeSource || activeSource.startsWith("folder:")) return null;
  return SOURCE_OPTIONS.some((s) => s.value === activeSource) ? null : activeSource;
}
function sourceOptions(field) {
  const other = otherSource(field);
  if (!other) return SOURCE_OPTIONS;
  const name = other.startsWith("entity:") ? other.slice("entity:".length) : other;
  return [{ value: other, label: `${name.charAt(0).toUpperCase()}${name.slice(1)} notes` }, ...SOURCE_OPTIONS];
}
function sourceState(field) {
  const activeSource = field.suggestionSource || getFieldSuggestionSource(field);
  const isCustomFolder = !!(activeSource && activeSource.startsWith("folder:"));
  let selected = otherSource(field);
  SOURCE_OPTIONS.forEach((s) => {
    if (!isCustomFolder && s.value === activeSource) selected = s.value;
    else if (isCustomFolder && s.value === "folder") selected = s.value;
  });
  return { selected, isCustomFolder, folderPath: isCustomFolder ? activeSource.slice("folder:".length) : "" };
}
function folderSource(path) {
  return path ? `folder:${path}` : "none";
}
function folderBadge(path) {
  return { text: path || "No folder", color: path ? "var(--text-normal)" : "var(--text-faint)" };
}
function vaultFolderPaths(allFolders, markdownFiles) {
  const folderSet = /* @__PURE__ */ new Set();
  if (!allFolders || !allFolders.length) {
    markdownFiles().forEach((f) => {
      const parts = f.path.split("/");
      for (let i = 1; i < parts.length; i++) {
        folderSet.add(parts.slice(0, i).join("/"));
      }
    });
  } else {
    allFolders.forEach((f) => {
      const p = typeof f === "string" ? f : f.path || "";
      if (p) folderSet.add(p);
    });
  }
  return Array.from(folderSet).sort();
}
function filterFolders(folders, query) {
  const ql = query.toLowerCase();
  return ql ? folders.filter((f) => f.toLowerCase().includes(ql)) : folders;
}
function nextPropertyKey(fields) {
  let counter = 1;
  let newKey = `new_property_${counter}`;
  while (fields.some((f) => f.key === newKey)) {
    counter++;
    newKey = `new_property_${counter}`;
  }
  return newKey;
}
function moveField(fields, from, to, isLocked) {
  const candidateFields = [...fields];
  const [draggedItem] = candidateFields.splice(from, 1);
  candidateFields.splice(to, 0, draggedItem);
  for (let i = 0; i < fields.length; i++) {
    if (isLocked(fields[i])) {
      if (!candidateFields[i] || candidateFields[i].key !== fields[i].key) return null;
    }
  }
  return candidateFields;
}
function applyPropertyEdit(entities, entityKey, edit) {
  const def = entities[entityKey];
  const migrations = [];
  switch (edit.kind) {
    case "label": {
      edit.field.label = edit.value.trim() || edit.field.key;
      return { ok: true, migrations, rerender: false };
    }
    case "options": {
      edit.field.options = parseEnumOptions(edit.value);
      return { ok: true, migrations, rerender: false };
    }
    case "source": {
      edit.field.suggestionSource = edit.value;
      return { ok: true, migrations, rerender: false };
    }
    case "lock": {
      edit.field.locked = edit.locked;
      return { ok: true, migrations, rerender: true };
    }
    case "key": {
      const { field } = edit;
      const sanitized = sanitizeFieldKey(edit.value);
      if (!sanitized) return { ok: false, notice: "Technical key cannot be empty and must be alphanumeric." };
      if (def.fields.some((f, idx) => idx !== edit.index && f.key === sanitized)) {
        return { ok: false, notice: "This technical key is already in use." };
      }
      const oldKey = field.key;
      if (sanitized === oldKey) return { ok: true, migrations, rerender: true };
      migrations.push({ kind: "key", entityKey, oldKey, newKey: sanitized });
      field.key = sanitized;
      return { ok: true, migrations, rerender: true };
    }
    case "type": {
      const { field } = edit;
      const oldType = field.type || "text";
      const newType = edit.value;
      migrations.push({ kind: "type", entityKey, fieldKey: field.key, oldType, newType });
      field.type = newType;
      return { ok: true, migrations, rerender: true };
    }
    case "remove": {
      def.fields.splice(edit.index, 1);
      return { ok: true, migrations, rerender: true };
    }
    case "add": {
      def.fields.push({
        key: nextPropertyKey(def.fields),
        label: "New Property",
        type: "text"
      });
      return { ok: true, migrations, rerender: true };
    }
    case "move": {
      const candidateFields = moveField(def.fields, edit.from, edit.to, (f) => isFieldLocked(entityKey, f));
      if (!candidateFields) {
        return { ok: false, notice: "Cannot reorder: locked properties (\u{1F512}) must keep their original position." };
      }
      def.fields = candidateFields;
      return { ok: true, migrations, rerender: true };
    }
  }
}
var FolderSuggestModal = class extends import_obsidian8.SuggestModal {
  folders;
  onChoose;
  constructor(app, folders, onChoose) {
    super(app);
    this.folders = folders;
    this.onChoose = onChoose;
    this.setPlaceholder("Search vault folders\u2026");
  }
  getSuggestions(q) {
    return filterFolders(this.folders, q);
  }
  renderSuggestion(folder, el) {
    el.createEl("span", { text: "\u{1F4C1} " });
    el.createEl("span", { text: folder });
  }
  onChooseSuggestion(folder) {
    this.onChoose(folder);
  }
};
function renderEntityPropertiesSettings(tab, containerEl) {
  containerEl.createEl("h3", { text: "Custom Entity Properties" });
  containerEl.createEl("p", {
    text: "Customize the properties for each core entity (Projects, Pipelines/Deals, Contacts, Companies, and Activities). Critical system properties required for the calendar, Kanban, and dashboard features are locked against deletion or type changes, but their display labels can still be customized.",
    cls: "setting-item-description"
  });
  let selectedEntityKey = "project";
  new import_obsidian8.Setting(containerEl).setName("Select entity").setDesc("Choose which entity to customize.").addDropdown((d) => {
    entityPickerOptions(ENTITIES, tab.plugin.settings.customPages || []).forEach(({ value, label }) => {
      d.addOption(value, label);
    });
    d.setValue(selectedEntityKey);
    d.onChange((v) => {
      selectedEntityKey = v;
      renderPropEditor();
    });
  });
  const propEditorDiv = containerEl.createDiv({ cls: "cad-prop-editor-container" });
  const renderPropEditor = () => {
    propEditorDiv.empty();
    const def = ENTITIES[selectedEntityKey];
    if (!def) return;
    propEditorDiv.createEl("h4", { text: `Properties for: ${def.label}` });
    const table = propEditorDiv.createEl("table", { cls: "cad-prop-table" });
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    headerRow.createEl("th", { text: "", cls: "cad-prop-drag-header" });
    headerRow.createEl("th", { text: "Label (Display name)" });
    headerRow.createEl("th", { text: "Technical Key (Frontmatter)" });
    headerRow.createEl("th", { text: "Type" });
    headerRow.createEl("th", { text: "Options / Source" });
    headerRow.createEl("th", { text: "" });
    const tbody = table.createEl("tbody");
    const saveAndSync = async () => {
      snapshotCustomEntities(tab.plugin.settings, ENTITIES);
      await tab.plugin.saveSettings();
      tab.plugin.registerCustomPropertyTypes();
      tab.plugin.refreshOpenViews();
    };
    const commit = async (result) => {
      for (const m of result.migrations) {
        if (m.kind === "key") await migrateFrontmatterKey(tab.app, m.entityKey, m.oldKey, m.newKey);
        else await migrateFrontmatterType(tab.app, m.entityKey, m.fieldKey, m.oldType, m.newType);
      }
      if (result.notice) new import_obsidian8.Notice(result.notice);
      await saveAndSync();
      if (result.rerender) renderPropEditor();
    };
    const edit = (change) => applyPropertyEdit(ENTITIES, selectedEntityKey, change);
    let draggedIndex = null;
    const frontmatters = [];
    try {
      const vaultFiles = tab.app.vault.getMarkdownFiles().slice(0, 200);
      for (const vf of vaultFiles) {
        const cache = tab.app.metadataCache.getFileCache(vf);
        if (cache && cache.frontmatter) frontmatters.push(cache.frontmatter);
      }
    } catch (error) {
      console.warn("Cadence: could not read frontmatter for key suggestions", error);
    }
    const _allSuggestionKeys = fieldKeySuggestions(ENTITIES, frontmatters);
    def.fields.forEach((field, index) => {
      const tr = tbody.createEl("tr");
      tr.addClass("cad-prop-row");
      const permLocked = isPermanentlyLocked(selectedEntityKey, field);
      const locked = isFieldLocked(selectedEntityKey, field);
      const tdDrag = tr.createEl("td", { cls: "cad-prop-drag-cell" });
      if (permLocked) {
        tdDrag.createEl("span", { text: "\u{1F512}", cls: "cad-prop-lock-icon" });
        tr.addClass("cad-prop-row-locked");
      } else if (locked) {
        const lockSpan = tdDrag.createEl("span", { text: "\u{1F510}", cls: "cad-prop-lock-icon" });
        lockSpan.style.cursor = "pointer";
        lockSpan.title = "Click to unlock this property";
        lockSpan.addEventListener("click", async (e) => {
          e.stopPropagation();
          await commit(edit({ kind: "lock", field, locked: false }));
        });
        tr.addClass("cad-prop-row-locked");
      } else {
        tdDrag.createEl("span", { text: "\u22EE\u22EE", cls: "cad-prop-drag-handle" });
        const unlockSpan = tdDrag.createEl("span", { text: "\u{1F513}", cls: "cad-prop-unlock-icon" });
        unlockSpan.style.cursor = "pointer";
        unlockSpan.style.marginLeft = "6px";
        unlockSpan.title = "Click to lock this property";
        unlockSpan.addEventListener("click", async (e) => {
          e.stopPropagation();
          await commit(edit({ kind: "lock", field, locked: true }));
        });
        tr.setAttribute("draggable", "true");
        tr.addClass("cad-prop-row-draggable");
        tr.addEventListener("dragstart", (e) => {
          draggedIndex = index;
          tr.addClass("cad-drag-active");
          e.dataTransfer.setData("text/plain", index.toString());
          e.dataTransfer.effectAllowed = "move";
        });
        tr.addEventListener("dragend", () => {
          tbody.querySelectorAll(".cad-prop-row").forEach((r) => {
            r.removeClass("cad-drag-active");
            r.removeClass("cad-drag-hover");
          });
          draggedIndex = null;
        });
      }
      tr.addEventListener("dragover", (e) => {
        if (draggedIndex !== null && draggedIndex !== index) {
          e.preventDefault();
          tr.addClass("cad-drag-hover");
        }
      });
      tr.addEventListener("dragleave", () => {
        tr.removeClass("cad-drag-hover");
      });
      tr.addEventListener("drop", async (e) => {
        tr.removeClass("cad-drag-hover");
        if (draggedIndex === null || draggedIndex === index) return;
        e.preventDefault();
        const result = applyPropertyEdit(ENTITIES, selectedEntityKey, { kind: "move", from: draggedIndex, to: index });
        if (!result.ok) {
          new import_obsidian8.Notice(result.notice);
          return;
        }
        await commit(result);
      });
      const tdLabel = tr.createEl("td");
      const inputLabel = tdLabel.createEl("input", {
        type: "text",
        value: field.label || "",
        cls: "cad-prop-input"
      });
      inputLabel.addEventListener("change", async () => {
        await commit(edit({ kind: "label", field, value: inputLabel.value }));
      });
      const tdKey = tr.createEl("td");
      const keyWrap = tdKey.createDiv({ cls: "cad-key-wrap" });
      const datalistId = `cad-key-dl-${selectedEntityKey}-${index}`;
      const datalist = keyWrap.createEl("datalist");
      datalist.id = datalistId;
      _allSuggestionKeys.forEach((k) => datalist.createEl("option", { value: k }));
      const inputKey = keyWrap.createEl("input", {
        type: "text",
        value: field.key || "",
        cls: "cad-prop-input"
      });
      inputKey.setAttribute("list", datalistId);
      inputKey.setAttribute("autocomplete", "off");
      if (locked || field.key === "type") {
        inputKey.disabled = true;
      } else {
        inputKey.disabled = false;
        inputKey.addEventListener("input", () => {
          datalist.empty();
          filterKeySuggestions(_allSuggestionKeys, inputKey.value).forEach((k) => datalist.createEl("option", { value: k }));
        });
        inputKey.addEventListener("change", async () => {
          const result = applyPropertyEdit(ENTITIES, selectedEntityKey, { kind: "key", field, index, value: inputKey.value });
          if (!result.ok) {
            new import_obsidian8.Notice(result.notice);
            inputKey.value = field.key;
            return;
          }
          await commit(result);
        });
      }
      const tdType = tr.createEl("td");
      const selectType = tdType.createEl("select", { cls: "cad-prop-input" });
      fieldTypeOptions(field).forEach((t) => {
        const opt = selectType.createEl("option", { value: t.value, text: t.label });
        if (t.selected) {
          opt.selected = true;
        }
      });
      if (locked) {
        selectType.disabled = true;
      } else {
        selectType.disabled = false;
        selectType.addEventListener("change", async () => {
          await commit(edit({ kind: "type", field, value: selectType.value }));
        });
      }
      const tdOptions = tr.createEl("td");
      const optionsKind = optionsCellKind(field);
      if (optionsKind === "enum") {
        const inputOptions = tdOptions.createEl("input", {
          type: "text",
          value: field.options ? field.options.join(", ") : "",
          placeholder: "Option A, Option B...",
          cls: "cad-prop-input"
        });
        if (areOptionsLocked(selectedEntityKey, field)) {
          inputOptions.disabled = true;
        } else {
          inputOptions.addEventListener("change", async () => {
            await commit(edit({ kind: "options", field, value: inputOptions.value }));
          });
        }
      } else if (optionsKind === "source") {
        const sourceWrap = tdOptions.createDiv({ cls: "cad-source-wrap" });
        const selectSource = sourceWrap.createEl("select", { cls: "cad-prop-input" });
        const { selected, isCustomFolder, folderPath: currentFolderPath } = sourceState(field);
        sourceOptions(field).forEach((s) => {
          const opt = selectSource.createEl("option", { value: s.value, text: s.label });
          if (s.value === selected) opt.selected = true;
        });
        const folderPickerWrap = sourceWrap.createDiv({ cls: "cad-folder-picker-wrap" });
        folderPickerWrap.style.marginTop = "4px";
        folderPickerWrap.style.display = selectSource.value === "folder" || isCustomFolder ? "flex" : "none";
        folderPickerWrap.style.alignItems = "center";
        folderPickerWrap.style.gap = "6px";
        const folderBadgeEl = folderPickerWrap.createEl("span", { cls: "cad-folder-badge" });
        const badge = folderBadge(currentFolderPath);
        folderBadgeEl.setText(badge.text);
        folderBadgeEl.style.flex = "1";
        folderBadgeEl.style.fontSize = "12px";
        folderBadgeEl.style.color = badge.color;
        folderBadgeEl.style.fontFamily = "var(--font-monospace)";
        folderBadgeEl.style.overflow = "hidden";
        folderBadgeEl.style.textOverflow = "ellipsis";
        folderBadgeEl.style.whiteSpace = "nowrap";
        let _folderPath = currentFolderPath;
        const pickFolderBtn = folderPickerWrap.createEl("button", {
          cls: "cad-btn cad-btn-sm cad-folder-pick-btn",
          text: "\u{1F4C2} Choose"
        });
        pickFolderBtn.type = "button";
        pickFolderBtn.style.flexShrink = "0";
        pickFolderBtn.style.whiteSpace = "nowrap";
        const saveFolderSource = async (path) => {
          _folderPath = path;
          const chosen = folderBadge(path);
          folderBadgeEl.setText(chosen.text);
          folderBadgeEl.style.color = chosen.color;
          await commit(edit({ kind: "source", field, value: folderSource(path) }));
        };
        const saveSugSource = async () => {
          const v = selectSource.value;
          await commit(edit({ kind: "source", field, value: v === "folder" ? folderSource(_folderPath) : v }));
        };
        pickFolderBtn.addEventListener("click", () => {
          const vault = tab.app.vault;
          const folders = vaultFolderPaths(vault.getAllFolders ? vault.getAllFolders() : [], () => vault.getMarkdownFiles());
          new FolderSuggestModal(tab.app, folders, (folder) => {
            saveFolderSource(folder);
          }).open();
        });
        selectSource.addEventListener("change", async () => {
          const show = selectSource.value === "folder";
          folderPickerWrap.style.display = show ? "flex" : "none";
          if (!show) {
            _folderPath = "";
            const cleared = folderBadge("");
            folderBadgeEl.setText(cleared.text);
            folderBadgeEl.style.color = cleared.color;
            await saveSugSource();
          }
        });
      } else {
        const disabledInput = tdOptions.createEl("input", {
          type: "text",
          cls: "cad-prop-input"
        });
        disabledInput.disabled = true;
        disabledInput.placeholder = "\u2014";
      }
      const tdDelete = tr.createEl("td");
      const btnDelete = tdDelete.createEl("button", {
        text: "\xD7",
        cls: "cad-prop-btn-delete"
      });
      if (locked || field.key === "type") {
        btnDelete.disabled = true;
      } else {
        btnDelete.disabled = false;
        btnDelete.addEventListener("click", async () => {
          await commit(edit({ kind: "remove", index }));
        });
      }
    });
    const btnAdd = propEditorDiv.createEl("button", {
      text: "+ Add property",
      cls: "cad-prop-btn-add"
    });
    btnAdd.addEventListener("click", async () => {
      await commit(edit({ kind: "add" }));
    });
  };
  renderPropEditor();
}

// src/settings/setting-tab.ts
var CadenceSettingTab = class extends import_obsidian9.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Cadence" });
    renderModulesSettings(this, containerEl);
    renderReminderSettings(this, containerEl);
    renderAppSettings(this, containerEl);
    renderCloudSyncSettings(this, containerEl);
    renderCustomPagesSettings(this, containerEl);
    renderEntityPropertiesSettings(this, containerEl);
  }
};
var MODULE_TOGGLES = [
  { key: "planner", label: "Planner", desc: "Inbox, Today, Calendar." },
  { key: "projects", label: "Projects", desc: "Projects with milestones, tasks, and status tracking." },
  { key: "crm", label: "CRM", desc: "Dashboard, Pipeline, Contacts, Companies, Activities + CRM-driven Reports." },
  { key: "prm", label: "PRM", desc: "Partners, Registrations, Commissions, Leads, Certifications, Analytics + Partner reports." }
];
function ensureModules(settings) {
  if (!settings.modules) {
    settings.modules = { ...DEFAULT_SETTINGS.modules };
  }
  if (settings.modules.projects === void 0) {
    settings.modules.projects = true;
  }
  return settings.modules;
}
function renderModulesSettings(tab, containerEl) {
  containerEl.createEl("h3", { text: "Modules" });
  containerEl.createEl("p", {
    text: "Toggle entire sections of the app. Disabled modules disappear from the left nav and from Reports that depend on them.",
    cls: "setting-item-description"
  });
  MODULE_TOGGLES.forEach((m) => {
    new import_obsidian9.Setting(containerEl).setName(m.label).setDesc(m.desc).addToggle((t) => t.setValue(ensureModules(tab.plugin.settings)[m.key] !== false).onChange(async (v) => {
      ensureModules(tab.plugin.settings)[m.key] = v;
      await tab.plugin.saveSettings();
      tab.plugin.refreshOpenViews();
    }));
  });
}
function shouldRequestPermission(enabled, notification) {
  return !!(enabled && notification !== void 0 && notification.permission === "default");
}
function notificationPermissionDesc(notification) {
  return notification === void 0 ? "Notifications API not available in this environment." : `Current status: ${notification.permission}`;
}
function completedReminderCount(reminders) {
  return (reminders || []).filter((r) => r.done).length;
}
function openReminders(reminders) {
  return (reminders || []).filter((r) => !r.done);
}
var notificationApi = () => typeof Notification === "undefined" ? void 0 : Notification;
function renderReminderSettings(tab, containerEl) {
  containerEl.createEl("h3", { text: "Reminders" });
  new import_obsidian9.Setting(containerEl).setName("Desktop notifications").setDesc("In addition to the in-app banner, fire a system notification when a reminder is due. Requires browser permission.").addToggle((t) => t.setValue(!!tab.plugin.settings.desktopNotifications).onChange(async (v) => {
    tab.plugin.settings.desktopNotifications = v;
    await tab.plugin.saveSettings();
    if (shouldRequestPermission(v, notificationApi())) {
      try {
        await Notification.requestPermission();
      } catch (_) {
      }
    }
  }));
  new import_obsidian9.Setting(containerEl).setName("Notification permission").setDesc(notificationPermissionDesc(notificationApi())).addButton((b) => b.setButtonText("Request permission").onClick(async () => {
    if (typeof Notification === "undefined") return;
    try {
      await Notification.requestPermission();
      tab.display();
    } catch (_) {
    }
  }));
  new import_obsidian9.Setting(containerEl).setName("Clear completed reminders").setDesc(`${completedReminderCount(tab.plugin.settings.reminders)} completed reminders stored.`).addButton((b) => b.setButtonText("Clear").onClick(async () => {
    tab.plugin.settings.reminders = openReminders(tab.plugin.settings.reminders);
    await tab.plugin.saveSettings();
    tab.plugin.refreshOpenViews();
    tab.display();
  }));
}
var TASK_SYSTEM_OPTIONS = [
  { value: "native", label: "Native (Cadence)" },
  { value: "tasknotes", label: "TaskNotes" }
];
var TASKNOTES_URL = "https://github.com/callumalpass/obsidian-tasknotes";
function taskNotesStatus(active) {
  return active ? {
    name: "TaskNotes Status",
    desc: "TaskNotes is currently installed, activated and successfully connected to Cadence.",
    text: "\u{1F7E2} Active and Connected",
    color: "#27ae60"
  } : {
    name: "TaskNotes not detected",
    desc: "The TaskNotes plugin is not enabled or installed in your Obsidian vault.",
    text: "\u{1F534} Inactive / Not installed",
    color: "#c0392b"
  };
}
function weekStartsOnFromOption(value) {
  return Number(value) === 0 ? 0 : 1;
}
function defaultTabOptions(groups) {
  return groups.flatMap((g) => g.items.map((s) => {
    const prefix = g.label ? `${g.label} \xB7 ` : "";
    return { value: s.id, label: prefix + s.label };
  }));
}
function defaultTabValue(settings) {
  return settings.defaultTab || DEFAULT_SETTINGS.defaultTab;
}
function renderAppSettings(tab, containerEl) {
  containerEl.createEl("h3", { text: "App" });
  new import_obsidian9.Setting(containerEl).setName("Task management system").setDesc("Choose between the native Cadence manager (using daily notes) or the external TaskNotes plugin.").addDropdown((d) => {
    TASK_SYSTEM_OPTIONS.forEach((o) => d.addOption(o.value, o.label));
    d.setValue(tab.plugin.settings.taskManagementSystem || "native").onChange(async (v) => {
      tab.plugin.settings.taskManagementSystem = v;
      await tab.plugin.saveSettings();
      tab.display();
      tab.plugin.refreshOpenViews();
    });
  });
  if (tab.plugin.settings.taskManagementSystem === "tasknotes") {
    const isTaskNotesActive = tab.app.plugins.enabledPlugins.has("tasknotes");
    const status = taskNotesStatus(isTaskNotesActive);
    const statusSetting = new import_obsidian9.Setting(containerEl).setName(status.name).setDesc(status.desc);
    const statusSpan = statusSetting.controlEl.createSpan({
      text: status.text
    });
    statusSpan.style.color = status.color;
    statusSpan.style.fontWeight = "bold";
    if (!isTaskNotesActive) {
      new import_obsidian9.Setting(containerEl).setName("Download TaskNotes").setDesc("Click the button below to open the TaskNotes plugin GitHub page to install it on your Obsidian.").addButton((btn) => btn.setButtonText("Download TaskNotes").onClick(() => {
        window.open(TASKNOTES_URL, "_blank");
      }));
    }
  }
  new import_obsidian9.Setting(containerEl).setName("Daily note folder").setDesc('Folder under which daily notes live, e.g. "daily" or "Journal/Daily".').addText((t) => t.setPlaceholder("daily").setValue(tab.plugin.settings.dailyNoteFolder).onChange(async (v) => {
    tab.plugin.settings.dailyNoteFolder = v;
    await tab.plugin.saveSettings();
  }));
  new import_obsidian9.Setting(containerEl).setName("Tasks heading").setDesc('The H2 inside each daily note where tasks live. Default "## Today".').addText((t) => t.setValue(tab.plugin.settings.tasksHeading).onChange(async (v) => {
    tab.plugin.settings.tasksHeading = v;
    await tab.plugin.saveSettings();
  }));
  new import_obsidian9.Setting(containerEl).setName("Journal heading").setDesc(`The H2 where today's journal entry lives. Default "## Journal".`).addText((t) => t.setValue(tab.plugin.settings.journalHeading).onChange(async (v) => {
    tab.plugin.settings.journalHeading = v;
    await tab.plugin.saveSettings();
  }));
  new import_obsidian9.Setting(containerEl).setName("Currency").setDesc("Used to format money values across Pipeline, Reports and Commissions.").addDropdown((d) => {
    CURRENCY_OPTIONS.forEach((c) => d.addOption(c.code, c.label));
    d.setValue(tab.plugin.settings.currency || "USD");
    d.onChange(async (v) => {
      tab.plugin.settings.currency = v;
      await tab.plugin.saveSettings();
      tab.app.workspace.getLeavesOfType(VIEW_TYPE_CADENCE_APP).forEach((leaf) => {
        if (leaf.view && typeof leaf.view.render === "function") leaf.view.render();
      });
    });
  });
  new import_obsidian9.Setting(containerEl).setName("Week starts on").setDesc("First day of the week shown in the Planner tab.").addDropdown((d) => d.addOption("1", "Monday").addOption("0", "Sunday").setValue(String(tab.plugin.settings.weekStartsOn)).onChange(async (v) => {
    tab.plugin.settings.weekStartsOn = weekStartsOnFromOption(v);
    await tab.plugin.saveSettings();
  }));
  new import_obsidian9.Setting(containerEl).setName("Open Cadence on Obsidian startup").setDesc("Auto-open the Cadence Home command centre when Obsidian launches.").addToggle((t) => t.setValue(!!tab.plugin.settings.openOnStartup).onChange(async (v) => {
    tab.plugin.settings.openOnStartup = v;
    await tab.plugin.saveSettings();
  }));
  new import_obsidian9.Setting(containerEl).setName("Default tab").setDesc("Which surface opens first when you launch the Cadence app.").addDropdown((d) => {
    defaultTabOptions(NAV_GROUPS).forEach((o) => d.addOption(o.value, o.label));
    d.setValue(defaultTabValue(tab.plugin.settings));
    d.onChange(async (v) => {
      tab.plugin.settings.defaultTab = v;
      await tab.plugin.saveSettings();
    });
  });
}
function renderCloudSyncSettings(tab, containerEl) {
  containerEl.createEl("h3", { text: "Cloud sync \u2014 coming soon" });
  const cloudDesc = containerEl.createEl("p", { cls: "setting-item-description" });
  cloudDesc.appendText("Future option to two-way sync your vault with a live Cadence instance, so contacts, deals and partners stay aligned across desktop and mobile. ");
  cloudDesc.createEl("strong", { text: "Not active yet." });
  cloudDesc.appendText(" These fields are persisted but unused until the sync feature ships in a later release.");
  new import_obsidian9.Setting(containerEl).setName("Cadence base URL").setDesc("Coming soon").addText((t) => {
    t.setPlaceholder("https://your-cadence-instance").setValue(tab.plugin.settings.cadenceApiUrl).onChange(async (v) => {
      tab.plugin.settings.cadenceApiUrl = v;
      await tab.plugin.saveSettings();
    });
    t.inputEl.disabled = true;
  });
  new import_obsidian9.Setting(containerEl).setName("API token").setDesc("Coming soon").addText((t) => {
    t.setPlaceholder("paste JWT here when sync ships").setValue(tab.plugin.settings.cadenceApiToken).onChange(async (v) => {
      tab.plugin.settings.cadenceApiToken = v;
      await tab.plugin.saveSettings();
    });
    t.inputEl.disabled = true;
  });
}

// src/utils/daily-notes.ts
var import_obsidian10 = require("obsidian");
function findDailyNote(app, settings, date = /* @__PURE__ */ new Date()) {
  const file = app.vault.getAbstractFileByPath(dailyNotePath(settings, date));
  return file instanceof import_obsidian10.TFile ? file : null;
}
async function ensureDailyNote(app, settings, date = /* @__PURE__ */ new Date()) {
  const path = dailyNotePath(settings, date);
  let file = app.vault.getAbstractFileByPath(path);
  if (file) return file;
  const folder = (settings.dailyNoteFolder || "").replace(/\/$/, "");
  if (folder && !app.vault.getAbstractFileByPath(folder)) {
    try {
      await app.vault.createFolder(folder);
    } catch (_) {
    }
  }
  let template = "";
  const dailyTemplatePath = "Cadence/Templates/daily.md";
  const dailyTemplateFile = app.vault.getAbstractFileByPath(dailyTemplatePath);
  if (dailyTemplateFile && dailyTemplateFile instanceof import_obsidian10.TFile) {
    const rawTemplate = await app.vault.read(dailyTemplateFile);
    const now = /* @__PURE__ */ new Date();
    const timeStr = now.toLocaleTimeString(void 0, { hour: "2-digit", minute: "2-digit" });
    template = rawTemplate.replace(/\{\{name\}\}/gi, ymd(date)).replace(/\{\{title\}\}/gi, ymd(date)).replace(/\{\{date\}\}/gi, ymd(date)).replace(/\{\{time\}\}/gi, timeStr);
  } else {
    template = [
      `# ${ymd(date)}`,
      "",
      settings.tasksHeading,
      "- [ ] ",
      "",
      settings.journalHeading,
      "",
      ""
    ].join("\n");
  }
  file = await app.vault.create(path, template);
  return file;
}

// src/views/app-view.ts
var import_obsidian31 = require("obsidian");

// src/modals/entity-create.ts
var import_obsidian11 = require("obsidian");

// src/utils/field-edit.ts
function numberValue(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return isNaN(n) ? null : n;
}
function coerceFieldEdit(def, key, raw) {
  let value = raw;
  const fdef = def.fields.find((f) => f.key === key);
  if (fdef) {
    if (fdef.type === "tags") {
      if (Array.isArray(raw)) {
        value = raw;
      } else {
        value = (raw || "").split(",").map((t) => t.trim()).filter(Boolean);
      }
    } else if (fdef.type === "number" || fdef.type === "currency") {
      value = numberValue(raw);
    } else if (key === "stage") {
      value = raw ? [raw] : null;
    } else if (raw === "") {
      value = null;
    }
  }
  return value;
}
function applyFieldEdit(frontmatter, key, value) {
  if (value == null || Array.isArray(value) && value.length === 0) {
    delete frontmatter[key];
  } else {
    frontmatter[key] = value;
  }
}
function dateInputValue(current) {
  const d = new Date(current);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function enumCurrent(current) {
  return Array.isArray(current) ? String(current[0] || "") : String(current || "");
}
function withStoredOption(options, stored) {
  return stored === "" || options.includes(stored) ? options : [...options, stored];
}
function isChipField(f) {
  const fieldType = f.type || "text";
  if (f.isList === true && (fieldType === "text" || fieldType === "email")) return true;
  return fieldType === "tags" || fieldType === "multitext" || getFieldSuggestionSource(f) !== "none";
}
var DETAIL_LIST_KEYS = ["tags", "owner", "assigned", "contacts", "domain", "industry", "role", "with", "related"];
var COMPANY_LIST_KEYS = ["owner", "contacts", "domain", "industry", "role", "with", "related"];
function suggestionTarget(suggestionSource, entities) {
  const isEntity = (key) => Object.prototype.hasOwnProperty.call(entities, key) && entities[key] != null;
  if (isEntity(suggestionSource)) return { targetEntityKey: suggestionSource, customFolderPath: null };
  if (suggestionSource.startsWith("entity:")) {
    const key = suggestionSource.slice("entity:".length);
    return { targetEntityKey: isEntity(key) ? key : null, customFolderPath: null };
  }
  if (!suggestionSource.startsWith("folder:")) return { targetEntityKey: null, customFolderPath: null };
  const path = suggestionSource.slice("folder:".length).replace(/\/+$/, "");
  if (!path) return { targetEntityKey: null, customFolderPath: null };
  for (const [ek, def] of Object.entries(entities)) {
    if (def && def.folder && def.folder.replace(/\/+$/, "").toLowerCase() === path.toLowerCase()) {
      return { targetEntityKey: ek, customFolderPath: def.folder.replace(/\/+$/, "") };
    }
  }
  return { targetEntityKey: null, customFolderPath: path };
}
function chipConfig(f, entities, listKeys) {
  const fieldType = f.type || "text";
  const suggestionSource = getFieldSuggestionSource(f);
  const isPlainChip = ["tags", "none", "history"].includes(suggestionSource);
  const isList = fieldType === "tags" || fieldType === "multitext" || f.isList === true || listKeys.includes(f.key);
  const { targetEntityKey, customFolderPath } = suggestionTarget(suggestionSource, entities);
  return { suggestionSource, isPlainChip, isList, targetEntityKey, customFolderPath };
}
function chipLabel(value, suggestionSource) {
  return suggestionSource === "history" ? value.replace(/^\[\[|\]\]$/g, "").trim() : value;
}
function unwrapChip(v, isPlainChip) {
  return isPlainChip ? String(v).trim() : String(v).replace(/^\[\[|\]\]$/g, "").trim();
}
function chipValues(current, isPlainChip) {
  if (Array.isArray(current)) {
    return current.map((v) => unwrapChip(v, isPlainChip)).filter(Boolean);
  } else if (current != null && current !== "") {
    return [unwrapChip(current, isPlainChip)].filter(Boolean);
  }
  return [];
}
function chipWriteValue(values, isPlainChip, isList) {
  if (isPlainChip) {
    return isList ? values : values[0] || null;
  }
  return isList ? values.map((o) => `[[${o}]]`) : values[0] ? `[[${values[0]}]]` : null;
}
function chipAdd(values, raw, isList, label = (v) => v) {
  const name = raw.trim();
  if (!name) return { kind: "blank" };
  if (values.some((v) => label(v) === name)) return { kind: "duplicate" };
  if (isList) return { kind: "added", name, values: [...values, name] };
  return { kind: "added", name, values: [name] };
}
function historyValues(frontmatters, key) {
  const allValues = /* @__PURE__ */ new Set();
  frontmatters.forEach((fm) => {
    const val = fm[key];
    if (Array.isArray(val)) {
      val.forEach((v) => {
        if (v) allValues.add(String(v).replace(/^\[\[|\]\]$/g, "").trim());
      });
    } else if (val != null && val !== "") {
      allValues.add(String(val).replace(/^\[\[|\]\]$/g, "").trim());
    }
  });
  return Array.from(allValues);
}
function folderNotes(folderNode) {
  const notes = [];
  if (folderNode && folderNode.children) {
    const walk = (node) => {
      for (const child of node.children) {
        if (child.children) walk(child);
        else if (child.path && child.path.endsWith(".md")) notes.push(child);
      }
    };
    walk(folderNode);
  }
  return notes;
}
function chipScopeNotes(app, targetEntityKey, customFolderPath) {
  if (customFolderPath) return folderNotes(app.vault.getAbstractFileByPath(customFolderPath));
  if (targetEntityKey) return listEntityFiles(app, targetEntityKey);
  return [];
}
function filterSuggestions(candidates, query, taken) {
  return candidates.filter((v) => (!query || v.toLowerCase().includes(query)) && !taken.includes(v));
}
function findNoteByName(files, name) {
  return files.find((cFile) => cFile.basename === name) || files.find((cFile) => cFile.basename.toLowerCase() === name.toLowerCase());
}
function chipLinkTarget(targetEntityKey, targetFile, name) {
  if (targetFile) {
    if (targetEntityKey && !targetEntityKey.startsWith("folder:")) {
      return { kind: "entity", entityKey: targetEntityKey, file: targetFile };
    }
    return { kind: "file", file: targetFile };
  }
  return { kind: "link", linktext: name };
}
var AUTO_CREATE_ENTITIES = ["contact", "company", "project"];
function autoCreatesNote(targetEntityKey) {
  return targetEntityKey != null && AUTO_CREATE_ENTITIES.includes(targetEntityKey);
}
function chipCreation(suggestionSource, targetEntityKey, entities) {
  return {
    source: suggestionSource === "history" ? "folder:Cadence/Shared" : targetEntityKey || suggestionSource,
    label: entities[targetEntityKey] ? entities[targetEntityKey].label : "Note"
  };
}
function metaControl(f) {
  if ((f.type || "text") === "enum") return "enum";
  return isChipField(f) ? "chips" : "input";
}
function metaInputType(fieldType) {
  return fieldType === "date" ? "date" : fieldType === "number" || fieldType === "currency" ? "number" : "text";
}
function metaInputValue(fieldType, raw) {
  if (fieldType === "number" || fieldType === "currency") return numberValue(raw);
  return raw || null;
}
function splitSectionColumns(keys) {
  const left = [];
  const right = [];
  keys.forEach((key, idx) => {
    if (idx % 2 === 0) {
      left.push(key);
    } else {
      right.push(key);
    }
  });
  return { left, right };
}

// src/modals/entity-create.ts
var PLACEHOLDER_EXAMPLES = {
  contact: "e.g. Jane Smith",
  company: "e.g. Acme Corp",
  partner: "e.g. Acme Distribution",
  deal: "e.g. Acme \u2014 FTTH expansion",
  registration: "e.g. Vodacom 12-site FTTB",
  commission: "e.g. C-2026-Q2-0042",
  lead: "e.g. Sarah from Vodacom",
  certification: "e.g. Cisco CCNP \u2014 May 2026",
  activity: "e.g. Discovery call with Jane",
  sequence: "e.g. Outbound \u2014 SMB",
  project: "e.g. Q3 Cadence launch"
};
function placeholderFor(entityKey, isPrimary) {
  if (!isPrimary) return "";
  return PLACEHOLDER_EXAMPLES[entityKey] || "";
}
function defaultEnumValue(f) {
  if (["stage", "status", "priority", "tier", "type"].includes(f.key) && f.options && f.options.length) {
    const sensible = f.key === "stage" ? "Lead" : f.key === "status" ? f.options.find((o) => /active|new|draft|submitted|pending/i.test(o)) || f.options[0] : f.key === "priority" ? f.options.find((o) => /medium/i.test(o)) || f.options[0] : f.options[0];
    if (f.options.includes(sensible)) return sensible;
  }
  return void 0;
}
function buildEntityCreateValues(def, inputs) {
  const values = {};
  let primaryValue = null;
  inputs.forEach((input, idx) => {
    const { key, type } = input;
    let raw = input.value;
    if (idx === 0) {
      primaryValue = (raw || "").trim();
      raw = primaryValue;
    }
    if (raw === "" || raw == null) return;
    const f = def.fields.find((fd) => fd.key === key);
    const suggestionSource = getFieldSuggestionSource(f);
    const isWikilink = suggestionSource !== "none" && suggestionSource !== "tags" && suggestionSource !== "history";
    const isEntityRef = ["owner", "assigned", "company", "contact", "contacts", "partner", "with", "related"].includes(key) || isWikilink;
    const isListField = type === "tags" || type === "multitext" || f && f.isList || ["domain", "industry", "role", "tags"].includes(key) || isEntityRef;
    if (isListField) {
      const parts = raw.split(",").map((t) => t.trim()).filter(Boolean);
      if (isEntityRef) {
        raw = parts.map((p) => `[[${p.replace(/^\[\[|\]\]$/g, "")}]]`);
      } else {
        raw = parts;
      }
    } else if (type === "number" || type === "currency") {
      const n = Number(raw);
      raw = isNaN(n) ? null : n;
    }
    if (raw == null) return;
    if (Array.isArray(raw) && raw.length === 0) return;
    values[key] = raw;
  });
  if (!primaryValue) return null;
  return { name: primaryValue, values };
}
function entityCreateSuggestions(app, f, suggestionSource, fullVal) {
  const lastCommaIdx = fullVal.lastIndexOf(",");
  const query = (lastCommaIdx === -1 ? fullVal : fullVal.slice(lastCommaIdx + 1)).trim().toLowerCase();
  if (!query) return [];
  const { targetEntityKey, customFolderPath } = suggestionTarget(suggestionSource, ENTITIES);
  const typedNames = fullVal.split(",").map((s) => s.trim().replace(/^\[\[|\]\]$/g, "").toLowerCase()).filter(Boolean);
  let filtered = [];
  if (suggestionSource === "tags") {
    const suggestions = Object.keys(app.metadataCache.getTags() || {}).map((t) => t.replace(/^#/, ""));
    filtered = suggestions.filter(
      (v) => v.toLowerCase().includes(query) && !typedNames.includes(v.toLowerCase())
    );
  } else if (suggestionSource === "history") {
    const allFiles = app.vault.getMarkdownFiles();
    const allValues = /* @__PURE__ */ new Set();
    allFiles.forEach((file) => {
      const cache = app.metadataCache.getFileCache(file);
      const fm = cache && cache.frontmatter || {};
      const val = fm[f.key];
      if (Array.isArray(val)) {
        val.forEach((v) => {
          if (v) allValues.add(String(v).replace(/^\[\[|\]\]$/g, "").trim());
        });
      } else if (val != null && val !== "") {
        allValues.add(String(val).replace(/^\[\[|\]\]$/g, "").trim());
      }
    });
    filtered = Array.from(allValues).filter(
      (v) => v.toLowerCase().includes(query) && !typedNames.includes(v.toLowerCase())
    );
  } else if (suggestionSource !== "none") {
    if (customFolderPath) {
      const folderNode = app.vault.getAbstractFileByPath(customFolderPath);
      const names = [];
      if (folderNode && folderNode.children) {
        const walk = (node) => {
          for (const child of node.children) {
            if (child.children) walk(child);
            else if (child.path && child.path.endsWith(".md")) names.push(child.basename);
          }
        };
        walk(folderNode);
      }
      filtered = names.filter(
        (n) => n.toLowerCase().includes(query) && !typedNames.includes(n.toLowerCase())
      );
    } else {
      const targetKey = targetEntityKey || (f.key === "company" ? "company" : f.key === "partner" ? "partner" : f.key === "related" ? "project" : "contact");
      const entitiesList = listEntities(app, targetKey);
      filtered = entitiesList.filter(
        (c) => c.basename.toLowerCase().includes(query) && !typedNames.includes(c.basename.toLowerCase())
      ).map((c) => c.basename);
    }
  }
  return filtered;
}
var CadenceEntityCreateModal = class extends import_obsidian11.Modal {
  constructor(app, entityKey, opts = {}) {
    super(app);
    this.entityKey = entityKey;
    this.def = ENTITIES[entityKey];
    this.onSubmit = opts.onSubmit;
    this.defaults = opts.defaults || {};
    this._submitted = false;
  }
  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    contentEl.addClass("cad-create-modal");
    if (modalEl) modalEl.addClass("cad-create-modal-shell");
    contentEl.createEl("h3", { cls: "cad-create-title", text: `New ${this.def.label}` });
    const form = contentEl.createDiv({ cls: "cad-create-form" });
    const inputs = [];
    this.def.fields.forEach((f) => {
      if (f.key === "type" && f.type !== "enum") return;
      const isPrimary = inputs.length === 0;
      const row = form.createDiv({ cls: "cad-create-row" });
      const label = row.createDiv({ cls: "cad-create-label" });
      label.setText(f.label.toUpperCase() + (isPrimary ? " *" : ""));
      let input;
      const fieldType = f.type || "text";
      if (fieldType === "enum") {
        input = row.createEl("select", { cls: "cad-create-input" });
        input.createEl("option", { value: "", text: "\u2014 \u2014" });
        (f.options || []).forEach((opt) => input.createEl("option", { value: opt, text: opt }));
        const sensible = defaultEnumValue(f);
        if (sensible !== void 0) input.value = sensible;
      } else if (fieldType === "date") {
        input = row.createEl("input", { type: "date", cls: "cad-create-input" });
      } else if (fieldType === "number" || fieldType === "currency") {
        input = row.createEl("input", { type: "number", cls: "cad-create-input" });
        input.placeholder = "0";
      } else if (fieldType === "email") {
        input = row.createEl("input", { type: "email", cls: "cad-create-input" });
        input.placeholder = "name@example.com";
      } else {
        input = row.createEl("input", { type: "text", cls: "cad-create-input" });
        input.placeholder = fieldType === "tags" ? "tag1, tag2" : this._placeholderFor(f, isPrimary);
        const suggestionSource = getFieldSuggestionSource(f);
        const hasSuggestions = suggestionSource !== "none";
        if (hasSuggestions) {
          row.style.position = "relative";
          const suggestionsBox = row.createDiv({ cls: "cad-pd-tag-suggestions" });
          suggestionsBox.style.position = "absolute";
          suggestionsBox.style.zIndex = "10000";
          suggestionsBox.style.backgroundColor = "var(--background-secondary)";
          suggestionsBox.style.border = "1px solid var(--border-color)";
          suggestionsBox.style.borderRadius = "4px";
          suggestionsBox.style.boxShadow = "var(--shadow-s)";
          suggestionsBox.style.maxHeight = "150px";
          suggestionsBox.style.overflowY = "auto";
          suggestionsBox.style.display = "none";
          suggestionsBox.style.width = "calc(100% - 130px)";
          suggestionsBox.style.boxSizing = "border-box";
          suggestionsBox.style.top = "100%";
          suggestionsBox.style.right = "0";
          suggestionsBox.style.marginTop = "4px";
          const updateSuggestions = () => {
            const fullVal = input.value;
            const lastCommaIdx = fullVal.lastIndexOf(",");
            suggestionsBox.empty();
            const filtered = entityCreateSuggestions(this.app, f, suggestionSource, fullVal);
            if (filtered.length === 0) {
              suggestionsBox.style.display = "none";
              return;
            }
            filtered.forEach((valStr) => {
              const item = suggestionsBox.createDiv({ cls: "cad-suggestion-item" });
              item.style.padding = "6px 10px";
              item.style.cursor = "pointer";
              item.style.fontSize = "13px";
              item.style.color = "var(--text-normal)";
              item.setText(valStr);
              item.addEventListener("mouseenter", () => {
                item.style.backgroundColor = "var(--background-modifier-hover)";
              });
              item.addEventListener("mouseleave", () => {
                item.style.backgroundColor = "transparent";
              });
              item.addEventListener("mousedown", (ev) => {
                ev.preventDefault();
                const baseVal = lastCommaIdx === -1 ? "" : fullVal.slice(0, lastCommaIdx + 1) + " ";
                input.value = baseVal + valStr + ", ";
                suggestionsBox.style.display = "none";
                input.focus();
              });
            });
            suggestionsBox.style.display = "block";
          };
          input.addEventListener("input", updateSuggestions);
          input.addEventListener("focus", updateSuggestions);
          input.addEventListener("blur", () => {
            setTimeout(() => {
              suggestionsBox.style.display = "none";
            }, 180);
          });
        }
      }
      input.dataset.fieldKey = f.key;
      input.dataset.fieldType = fieldType;
      if (isPrimary) input.required = true;
      if (this.defaults && this.defaults[f.key] != null) {
        const value = String(this.defaults[f.key]);
        if (fieldType === "enum" && !(f.options || []).includes(value) && value !== "") {
          input.createEl("option", { value, text: value });
        }
        input.value = value;
      }
      inputs.push(input);
    });
    const actions = contentEl.createDiv({ cls: "cad-create-actions" });
    const cancel = actions.createEl("button", { cls: "cad-btn", text: "Cancel" });
    cancel.type = "button";
    cancel.addEventListener("click", () => this.close());
    const submitBtn = actions.createEl("button", { cls: "cad-btn primary", text: `Create ${this.def.label}` });
    submitBtn.type = "button";
    const submit = () => {
      const result = buildEntityCreateValues(this.def, inputs.map((el) => ({
        key: el.dataset.fieldKey,
        type: el.dataset.fieldType,
        value: el.value
      })));
      if (!result) {
        if (inputs[0]) inputs[0].focus();
        return;
      }
      this._submitted = true;
      this.close();
      this.onSubmit?.(result);
    };
    submitBtn.addEventListener("click", submit);
    inputs.forEach((el) => {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && el.tagName === "INPUT") {
          e.preventDefault();
          submit();
        }
        if (e.key === "Escape") this.close();
      });
    });
    setTimeout(() => {
      if (inputs[0]) {
        inputs[0].focus();
      }
    }, 0);
  }
  _placeholderFor(field, isPrimary) {
    return placeholderFor(this.entityKey, isPrimary);
  }
  onClose() {
    if (!this._submitted && this.onSubmit) this.onSubmit(null);
    this.contentEl.empty();
  }
};

// src/views/calendar.ts
var import_obsidian12 = require("obsidian");

// src/utils/task-lines.ts
var TASK_PREFIX = /^\s*-\s\[(x|X| )\]\s/;
function taskLineState(line) {
  const match = TASK_PREFIX.exec(line);
  if (!match) return null;
  return match[1] === " " ? "open" : "done";
}
function setTaskLineState(line, done) {
  return line.replace(/^(\s*-\s\[)(x|X| )(\]\s)/, (whole, open, box, close) => {
    if (box !== " " === done) return whole;
    return `${open}${done ? "x" : " "}${close}`;
  });
}
function isTasksSectionKey(rawKey) {
  const { cleanLabel, tag } = parseHeaderKey(rawKey);
  return tag === "#tasks" || cleanLabel.toLowerCase() === "tasks";
}
function sectionTaskLineIndexes(lines, inSection) {
  const indexes = [];
  let active = false;
  lines.forEach((line, i) => {
    if (/^##\s/.test(line)) {
      active = inSection(line.trim());
      return;
    }
    if (active && TASK_PREFIX.test(line)) indexes.push(i);
  });
  return indexes;
}
function tickLinesByText(lines, indexes, text, done) {
  let changed = false;
  for (const i of indexes) {
    if (lines[i].replace(TASK_PREFIX, "").trim() !== text) continue;
    const next = setTaskLineState(lines[i], done);
    if (next === lines[i]) continue;
    lines[i] = next;
    changed = true;
  }
  return changed ? lines.join("\n") : null;
}
function taskNotesToday(allTaskNotes, todayYmd) {
  const tasks = allTaskNotes.filter((t) => t.scheduled === todayYmd);
  return { tasks, lines: tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.title}`) };
}
function toggleTaskLine(tasks, idx, checked) {
  const taskLine = tasks[idx];
  if (taskLine === void 0) return null;
  return {
    tasks: tasks.map((line, i) => i === idx ? setTaskLineState(line, checked) : line),
    taskText: taskLine.replace(TASK_PREFIX, "").trim()
  };
}
function taskRefAt(texts, idx) {
  const text = texts[idx];
  if (text === void 0) return null;
  return { text, occurrence: texts.slice(0, idx).filter((t) => t === text).length };
}
function taskLineRef(lines, idx) {
  return taskRefAt(lines.map((line) => line.replace(TASK_PREFIX, "")), idx);
}
function findTaskLine(lines, ref) {
  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].replace(TASK_PREFIX, "") !== ref.text) continue;
    if (seen === ref.occurrence) return i;
    seen++;
  }
  return -1;
}
function countTaskLines(lines) {
  let open = 0, done = 0;
  lines.forEach((l) => {
    const state = taskLineState(l);
    if (state === "done") done++;
    else if (state === "open") open++;
  });
  return { open, done };
}
function withoutBlankTasks(lines) {
  return lines.filter((line) => taskLineState(line) === null || line.replace(TASK_PREFIX, "").trim() !== "");
}
function taskLineRows(lines) {
  return lines.map((rawLine) => ({
    checked: taskLineState(rawLine) === "done",
    text: rawLine.replace(TASK_PREFIX, "")
  }));
}
function toggleDailyTask(content, settings, idx, checked) {
  const lines = content.split("\n");
  const lineIdx = sectionTaskLineIndexes(lines, (heading) => heading === settings.tasksHeading)[idx];
  if (lineIdx === void 0) return null;
  const toggled = toggleTaskLine(lines, lineIdx, checked);
  return { content: toggled.tasks.join("\n"), taskText: toggled.taskText };
}
function toggleDailyTaskByRef(content, settings, ref, checked) {
  const idx = findTaskLine(parseSections(content, settings).tasks, ref);
  return idx === -1 ? null : toggleDailyTask(content, settings, idx, checked);
}
function toggleProjectTaskByRef(content, rawKey, ref, checked) {
  const lines = content.split("\n");
  const isHeading = (line) => /^##\s/.test(line);
  const start = lines.map((line) => isHeading(line) && line.replace(/^##\s+/, "").trim() === rawKey).lastIndexOf(true);
  if (start === -1) return null;
  const indexes = [];
  for (let i = start + 1; i < lines.length && !isHeading(lines[i]); i++) {
    if (TASK_PREFIX.test(lines[i])) indexes.push(i);
  }
  const at = findTaskLine(indexes.map((i) => lines[i]), ref);
  if (at === -1) return null;
  const toggled = toggleTaskLine(lines, indexes[at], checked);
  return { content: toggled.tasks.join("\n"), taskText: toggled.taskText };
}
function appendDailyTask(content, settings, text) {
  const parsed = parseSections(content, settings);
  const newTasks = [...parsed.tasks, `- [ ] ${text}`];
  return replaceSection(content, settings.tasksHeading, newTasks.join("\n"));
}
function replaceJournal(content, settings, body) {
  return replaceSection(content, settings.journalHeading, body || "");
}
function tickProjectTasks(content, text, done) {
  const lines = content.split("\n");
  const indexes = sectionTaskLineIndexes(lines, (heading) => isTasksSectionKey(heading.replace(/^##\s+/, "")));
  return tickLinesByText(lines, indexes, text, !!done);
}
function tickDailyTasks(content, settings, text, done) {
  const lines = content.split("\n");
  const indexes = sectionTaskLineIndexes(lines, (heading) => heading === settings.tasksHeading);
  return tickLinesByText(lines, indexes, text, !!done);
}

// src/utils/tasknotes.ts
function listTaskNotesTasks(app) {
  const folderPath = "TaskNotes/Tasks";
  const folder = app.vault.getAbstractFileByPath(folderPath);
  if (!folder || !folder.children) return [];
  const tasks = [];
  const walk = (node) => {
    for (const child of node.children) {
      if (child.children) walk(child);
      else if (typeof child.path === "string" && child.path.toLowerCase().endsWith(".md")) {
        const cache = app.metadataCache.getFileCache(child);
        const fm = cache && cache.frontmatter || {};
        tasks.push({
          file: child,
          title: fm.title || child.basename,
          status: fm.status || "open",
          scheduled: fm.scheduled || "",
          due: fm.due || "",
          priority: fm.priority || "normal",
          projects: fm.projects || "",
          done: fm.status === "done"
        });
      }
    }
  };
  walk(folder);
  return tasks;
}
function listTaskNotesTasksForFile(app, file) {
  const allTasks = listTaskNotesTasks(app);
  const name = file.basename;
  return allTasks.filter((t) => {
    if (!t.projects) return false;
    const links = parseLinkValues(t.projects);
    return links.some((l) => l.target === name);
  });
}
async function toggleTaskNotesTask(app, taskFile, checked) {
  await app.fileManager.processFrontMatter(taskFile, (fm) => {
    fm.status = checked ? "done" : "open";
  });
}
async function appendTaskNotesTask(app, text, date = /* @__PURE__ */ new Date()) {
  const ymdStr = ymd(date);
  const folderPath = "TaskNotes/Tasks";
  await ensureFolderSync(app, folderPath);
  const cleanTitle = text.replace(/[\\/:*?"<>|]/g, "").trim();
  let filename = `${folderPath}/${cleanTitle}.md`;
  let file = app.vault.getAbstractFileByPath(filename);
  let counter = 1;
  while (file) {
    filename = `${folderPath}/${cleanTitle} (${counter}).md`;
    file = app.vault.getAbstractFileByPath(filename);
    counter++;
  }
  const content = `---
title: ${text}
status: open
scheduled: ${ymdStr}
priority: normal
---
`;
  await app.vault.create(filename, content);
}
function projectLinkTargets(app) {
  return listEntities(app, "project").map((e) => ({
    basename: e.basename,
    path: e.file.path,
    name: String(entityValue(e, "name", ENTITIES.project) || "")
  }));
}
function taskNotesProjectPath(projects, targets) {
  if (!projects) return null;
  const parsed = parseLinkValues(projects);
  if (!parsed.length) return null;
  const target = parsed[0].target.toLowerCase();
  const match = targets.find((t) => (t.name || "").trim().toLowerCase() === target) || targets.find((t) => t.basename.toLowerCase() === target) || targets.find((t) => t.path.replace(/\.md$/i, "").toLowerCase() === target);
  return match ? match.path : null;
}

// src/views/calendar.ts
function plannerWeekTitle(days) {
  const startStr = days[0].toLocaleDateString(void 0, { month: "long", day: "numeric" });
  const endStr = days[6].toLocaleDateString(void 0, { month: "long", day: "numeric", year: "numeric" });
  return `${startStr} \u2013 ${endStr}`;
}
function plannerWeek(dayData, today) {
  const totals = countTaskLines(dayData.flatMap((d) => d.tasks));
  const columns = dayData.map((d) => {
    const { open, done } = countTaskLines(d.tasks);
    return {
      isToday: sameDay(d.date, today),
      weekday: d.date.toLocaleDateString(void 0, { weekday: "short" }).toUpperCase(),
      dayNum: String(d.date.getDate()),
      meta: d.exists || d.tasks.length ? `${open} open \xB7 ${done} done` : "no note",
      empty: d.tasks.length ? null : d.exists ? "\u2014" : "",
      rows: taskLineRows(d.tasks)
    };
  });
  return { stats: { open: totals.open, done: totals.done, total: totals.open + totals.done }, columns };
}
async function renderPlannerPane(view, root) {
  root.addClass("cadence-planner");
  const settings = view.plugin.settings;
  const days = weekDates(view.plannerAnchor, settings.weekStartsOn);
  const today = startOfDay(/* @__PURE__ */ new Date());
  const header = root.createDiv({ cls: "cad-pl-header" });
  const titleWrap = header.createDiv({ cls: "cad-pl-title-wrap" });
  titleWrap.createDiv({ cls: "cad-eyebrow", text: "WEEK OF" });
  titleWrap.createDiv({ cls: "cad-pl-title", text: plannerWeekTitle(days) });
  const nav = header.createDiv({ cls: "cad-pl-nav" });
  const mkBtn = (label, fn, cls = "") => {
    const b = nav.createEl("button", { text: label, cls: "cad-pl-btn " + cls });
    b.addEventListener("click", fn);
  };
  mkBtn("\u25C0", () => {
    view.plannerAnchor = addDays(view.plannerAnchor, -7);
    view.render();
  });
  mkBtn("Today", () => {
    view.plannerAnchor = startOfDay(/* @__PURE__ */ new Date());
    view.render();
  }, "primary");
  mkBtn("\u25B6", () => {
    view.plannerAnchor = addDays(view.plannerAnchor, 7);
    view.render();
  });
  let dayData = [];
  if (settings.taskManagementSystem === "tasknotes") {
    const allTasks = listTaskNotesTasks(view.app);
    dayData = days.map((d) => {
      const path = dailyNotePath(settings, d);
      const file = findDailyNote(view.app, settings, d);
      const forDay = taskNotesToday(allTasks, ymd(d));
      return {
        date: d,
        path,
        exists: !!file,
        file,
        tasks: forDay.lines,
        rawTasks: forDay.tasks
      };
    });
  } else {
    dayData = await Promise.all(days.map(async (d) => {
      const path = dailyNotePath(settings, d);
      const file = view.app.vault.getAbstractFileByPath(path);
      if (!file || !(file instanceof import_obsidian12.TFile)) {
        return { date: d, path, exists: false, tasks: [] };
      }
      const content = await view.app.vault.read(file);
      const parsed = parseSections(content, settings);
      return { date: d, path, exists: true, file, tasks: withoutBlankTasks(parsed.tasks) };
    }));
  }
  const week = plannerWeek(dayData, today);
  const stats = root.createDiv({ cls: "cad-pl-stats" });
  const mkStat = (label, value) => {
    const c = stats.createDiv({ cls: "cad-pl-stat" });
    c.createDiv({ cls: "cad-pl-stat-label", text: label });
    c.createDiv({ cls: "cad-pl-stat-value", text: String(value) });
  };
  mkStat("OPEN", week.stats.open);
  mkStat("DONE", week.stats.done);
  mkStat("TOTAL", week.stats.total);
  const grid = root.createDiv({ cls: "cad-pl-grid" });
  dayData.forEach((d, dayIdx) => {
    const column = week.columns[dayIdx];
    const col = grid.createDiv({ cls: "cad-pl-day" + (column.isToday ? " today" : "") });
    const colHead = col.createDiv({ cls: "cad-pl-day-head" });
    colHead.createDiv({ cls: "cad-pl-weekday", text: column.weekday });
    colHead.createDiv({ cls: "cad-pl-daynum", text: column.dayNum });
    colHead.createDiv({ cls: "cad-pl-meta", text: column.meta });
    colHead.addEventListener("click", async () => {
      if (!d.exists) {
        await ensureDailyNote(view.app, settings, d.date);
      }
      view.app.workspace.openLinkText(d.path, "", false);
    });
    const list = col.createDiv({ cls: "cad-pl-tasks" });
    if (column.empty !== null) {
      list.createDiv({ cls: "cad-empty", text: column.empty });
    } else {
      column.rows.forEach(({ checked, text }, idx) => {
        const row = list.createDiv({ cls: "cad-pl-task" + (checked ? " done" : "") });
        const cb = row.createEl("input", { type: "checkbox" });
        cb.checked = checked;
        cb.addEventListener("change", () => view.togglePlannerTask(d, idx, cb.checked));
        if (settings.taskManagementSystem === "tasknotes") {
          const taskObj = d.rawTasks[idx];
          const taskSpan = row.createEl("a", { text });
          taskSpan.style.cursor = "pointer";
          taskSpan.addEventListener("click", (ev) => {
            ev.preventDefault();
            view.app.workspace.openLinkText(taskObj.file.path, "", false);
          });
        } else {
          row.createSpan({ text });
        }
      });
    }
  });
}
async function togglePlannerTask(view, day, idx, checked) {
  if (view.plugin.settings.taskManagementSystem === "tasknotes") {
    if (day.rawTasks && day.rawTasks[idx]) {
      const taskObj = day.rawTasks[idx];
      await toggleTaskNotesTask(view.app, taskObj.file, checked);
      await view._propagateTaskComplete(taskObj.title, checked, { kind: "tasknotes", file: taskObj.file });
    }
  } else {
    const ref = taskLineRef(day.tasks, idx);
    if (day.file && ref) await view._tickDailyNoteTask(day.file, ref, checked, day.date);
  }
  view.render();
}

// src/views/company-detail.ts
var import_obsidian14 = require("obsidian");

// src/modals/confirm.ts
var import_obsidian13 = require("obsidian");
var CONFIRM_BUTTON_CLS = {
  danger: "cad-btn primary danger",
  primary: "cad-btn primary"
};
var CadenceConfirmModal = class extends import_obsidian13.Modal {
  constructor(app, opts = {}) {
    super(app);
    this.title = opts.title || "Confirm Action";
    this.message = opts.message || "Are you sure?";
    this.confirmLabel = opts.confirmLabel || "Confirm";
    this.cancelLabel = opts.cancelLabel || "Cancel";
    this.confirmStyle = opts.confirmStyle && Object.prototype.hasOwnProperty.call(CONFIRM_BUTTON_CLS, opts.confirmStyle) ? opts.confirmStyle : "danger";
    this.onConfirm = opts.onConfirm;
    this.onCancel = opts.onCancel;
    this._responded = false;
    this.contentEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this._respond(e.target === this._cancelBtn ? this.onCancel : this.onConfirm);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        this._respond(this.onCancel);
      }
    });
  }
  /* Answer once: close, then call the callback. */
  _respond(callback) {
    if (this._responded) return;
    this._responded = true;
    this.close();
    callback?.();
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this._responded = false;
    contentEl.addClass("cad-prompt-modal");
    contentEl.addClass("cad-confirm-modal");
    contentEl.createEl("h3", { text: this.title });
    const msg = contentEl.createEl("p", { text: this.message });
    msg.style.fontSize = "14px";
    msg.style.marginTop = "8px";
    msg.style.marginBottom = "20px";
    msg.style.color = "var(--text-muted)";
    const row = contentEl.createDiv();
    row.style.display = "flex";
    row.style.justifyContent = "flex-end";
    row.style.gap = "8px";
    const cancelBtn = row.createEl("button", { text: this.cancelLabel, cls: "cad-btn" });
    cancelBtn.addEventListener("click", () => this._respond(this.onCancel));
    this._cancelBtn = cancelBtn;
    const confirmBtn = row.createEl("button", { text: this.confirmLabel, cls: CONFIRM_BUTTON_CLS[this.confirmStyle] });
    confirmBtn.addEventListener("click", () => this._respond(this.onConfirm));
    setTimeout(() => confirmBtn.focus(), 50);
  }
  onClose() {
    if (!this._responded && this.onCancel) {
      this._responded = true;
      this.onCancel();
    }
    this.contentEl.empty();
  }
};

// src/views/company-detail.ts
function companyDetailTitle(fm, basename) {
  return fm.name != null && fm.name !== "" ? fm.name : basename;
}
function companyMetaFields(def) {
  return def.fields.filter((f) => !f.primary && !(f.key === "type" && f.type !== "enum"));
}
async function renderCompanyDetail(view, root, file) {
  root.addClass("cadence-project-detail");
  const def = ENTITIES.company;
  const cache = view.app.metadataCache.getFileCache(file) || {};
  const fm = Object.assign({}, cache.frontmatter || {});
  const titleVal = companyDetailTitle(fm, file.basename);
  const head = root.createDiv({ cls: "cad-detail-header" });
  const headLeft = head.createDiv({ cls: "cad-detail-header-left" });
  const back = headLeft.createEl("button", { cls: "cad-btn cad-detail-back", text: "\u2190 Companies" });
  back.addEventListener("click", () => view.closeEntityDetail());
  const breadcrumb = headLeft.createDiv({ cls: "cad-detail-breadcrumb" });
  breadcrumb.createSpan({ cls: "cad-eyebrow", text: "COMPANY" });
  breadcrumb.createSpan({ cls: "cad-detail-title", text: String(titleVal) });
  breadcrumb.createDiv({ cls: "cad-detail-path", text: file.path });
  const headRight = head.createDiv({ cls: "cad-detail-header-right" });
  const savedBadge = headRight.createSpan({ cls: "cad-detail-saved", text: "" });
  const flashSaved = () => {
    savedBadge.setText("Saved");
    savedBadge.addClass("show");
    clearTimeout(savedBadge._t);
    savedBadge._t = setTimeout(() => savedBadge.removeClass("show"), 1400);
  };
  const writeField = async (key, value) => {
    try {
      await view.app.fileManager.processFrontMatter(file, (frontmatter) => applyFieldEdit(frontmatter, key, value));
      flashSaved();
    } catch (e) {
      new import_obsidian14.Notice(`Save failed: ${e.message}`);
    }
  };
  const openNote = headRight.createEl("button", { cls: "cad-btn", text: "Open as note" });
  openNote.addEventListener("click", () => view.app.workspace.openLinkText(file.path, "", false));
  const deleteBtn = headRight.createEl("button", { cls: "cad-btn cad-btn-danger", text: "Delete" });
  deleteBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    new CadenceConfirmModal(view.app, {
      title: "Delete Company",
      message: "Delete this company? This moves the file to trash.",
      confirmLabel: "Delete",
      onConfirm: () => {
        deleteBtn.blur();
        setTimeout(async () => {
          try {
            await view.app.vault.trash(file, true);
            new import_obsidian14.Notice(`Deleted company: ${file.basename}`);
            view.closeEntityDetail();
          } catch (e) {
            new import_obsidian14.Notice(`Delete failed: ${e.message}`);
          }
        }, 50);
      }
    }).open();
  });
  const hero = root.createDiv({ cls: "cad-pd-hero" });
  const metaRow = hero.createDiv({ cls: "cad-pd-meta" });
  const mkMeta = (f) => {
    const label = f.label;
    const key = f.key;
    const fieldType = f.type || "text";
    const cell = metaRow.createDiv({ cls: "cad-pd-meta-cell" });
    cell.style.position = "relative";
    cell.createDiv({ cls: "cad-pd-meta-label", text: label.toUpperCase() });
    const current = fm[key];
    const control = metaControl(f);
    if (control === "chips") {
      view._renderChipInput(cell, f, current, {
        listKeys: COMPANY_LIST_KEYS,
        layout: "meta",
        save: (value) => writeField(key, value)
      });
    } else if (control === "enum") {
      const sel = cell.createEl("select", { cls: "cad-pd-meta-input" });
      sel.style.border = "none";
      sel.style.background = "transparent";
      sel.style.color = "var(--text-normal)";
      sel.style.outline = "none";
      sel.style.width = "100%";
      sel.createEl("option", { value: "", text: "\u2014" });
      const stored = enumCurrent(current);
      withStoredOption(f.options || [], stored).forEach((opt) => {
        const o = sel.createEl("option", { value: opt, text: opt });
        if (stored === opt) o.selected = true;
      });
      const commit = async () => {
        await writeField(key, coerceFieldEdit(def, key, sel.value));
      };
      sel.addEventListener("change", commit);
    } else {
      const inp = cell.createEl("input", { type: metaInputType(fieldType), cls: "cad-pd-meta-input" });
      if (fieldType === "currency") inp.placeholder = `${view.plugin.settings.currency || "USD"} amount`;
      if (fieldType === "date" && current) {
        const date = dateInputValue(current);
        if (date !== null) inp.value = date;
      } else if (current != null) {
        inp.value = String(current);
      }
      let t;
      const commit = () => writeField(key, metaInputValue(fieldType, inp.value));
      inp.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(commit, 350);
      });
      inp.addEventListener("blur", commit);
    }
  };
  companyMetaFields(def).forEach((f) => mkMeta(f));
  const cols = root.createDiv({ cls: "cad-pd-cols" });
  const left = cols.createDiv({ cls: "cad-pd-col" });
  const right = cols.createDiv({ cls: "cad-pd-col" });
  const content = await view.app.vault.read(file);
  const sections = parseH2Sections(content);
  const { left: leftKeys, right: rightKeys } = splitSectionColumns(Object.keys(sections));
  leftKeys.forEach((key) => {
    view._renderDynamicH2Section(left, file, sections, key, flashSaved);
  });
  rightKeys.forEach((key) => {
    view._renderDynamicH2Section(right, file, sections, key, flashSaved);
  });
  const crossSectionContainer = root.createDiv({ attr: { style: "padding: 0 32px;" } });
  view._renderCrossSections(crossSectionContainer, "company", titleVal);
}

// src/views/components/cards.ts
function dashCardSection(view, parent, title, rows, emptyMsg) {
  const card = parent.createDiv({ cls: "cad-dash-card" });
  card.createDiv({ cls: "cad-dash-card-head" }).createDiv({ cls: "cad-dash-card-title", text: title });
  const body = card.createDiv({ cls: "cad-dash-card-body" });
  if (!rows || !rows.length) {
    body.createDiv({ cls: "cad-empty", text: emptyMsg || "Nothing here yet." });
    return;
  }
  rows.forEach((r) => {
    const row = body.createDiv({ cls: "cad-dash-row" });
    const titleDiv = row.createDiv({ cls: "cad-dash-row-title" });
    if (r.titleEntityKey) {
      view._renderEntityLinks(titleDiv, r.title, r.titleEntityKey);
    } else {
      titleDiv.setText(r.title || "");
    }
    const metaDiv = row.createDiv({ cls: "cad-dash-row-meta" });
    if (r.metaParts) {
      const parts = [{ text: r.meta }, ...r.metaParts].filter((part) => String(part.text ?? "").trim() !== "");
      parts.forEach((part, index) => {
        if (index > 0 && !String(parts[index - 1].text).trimEnd().endsWith("\xB7") && !String(part.text).trimStart().startsWith("\xB7")) {
          metaDiv.createSpan({ text: " \xB7 " });
        }
        if (part.entityKey) {
          view._renderEntityLinks(metaDiv, part.text, part.entityKey);
        } else {
          metaDiv.createSpan({ text: part.text });
        }
      });
    } else {
      metaDiv.setText(r.meta || "");
    }
    if (r.file) {
      row.style.cursor = "pointer";
      row.addEventListener("click", () => view.openEntityDetailFromFile(r.file));
    }
  });
}

// src/views/components/charts.ts
var CHART_COLORS = ["#38bdf8", "#34d399", "#f43f5e", "#a855f7", "#f97316", "#06b6d4", "#eab308"];
var KPI_ACCENTS = ["sky", "emerald", "rose", "purple", "warn", "mint"];
function toChartData(counts) {
  return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}
function chartData(entities, widget, def) {
  const fieldKey = widget.groupBy;
  const counts = {};
  entities.forEach((p) => {
    const val = entityValue(p, fieldKey, def);
    if (Array.isArray(val)) {
      val.forEach((v) => {
        const clean = String(v).replace(/^\[\[|\]\]$/g, "").trim();
        if (clean) counts[clean] = (counts[clean] || 0) + 1;
      });
    } else {
      const clean = String(val || "").replace(/^\[\[|\]\]$/g, "").trim();
      const label = clean || "Unspecified";
      counts[label] = (counts[label] || 0) + 1;
    }
  });
  return toChartData(counts);
}
var WIDGET_STYLE_OPTIONS = [
  { value: "donut", label: "\u{1F369} Donut" },
  { value: "bar", label: "\u{1F4CA} Bar" },
  { value: "kpi", label: "\u{1F5C3}\uFE0F KPI Cards" },
  { value: "list", label: "\u{1F4CB} List" }
];
function chartStyleOf(style) {
  const known = WIDGET_STYLE_OPTIONS.map((option) => option.value);
  if (known.includes(style)) return style;
  return style.split("-").reverse().find((part) => known.includes(part)) ?? style;
}
function dashboardWidgets(settings, key) {
  return settings[key] || [];
}
function widgetTitle(widget) {
  return String(widget.title ?? "").trim() || "Untitled chart";
}
function removeWidget(widgets, id) {
  return (widgets || []).filter((item) => item.id !== id);
}
function sectionChartData(entities, groupField, def) {
  return chartData(entities, { groupBy: groupField }, def);
}
function donutGeometry(data) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const r = 50;
  const circ = 2 * Math.PI * r;
  let currentOffset = 0;
  const segments = data.map((item, index) => {
    const pct = item.count / total;
    const strokeLength = pct * circ;
    const segment = { color: CHART_COLORS[index % CHART_COLORS.length], length: strokeLength, offset: currentOffset, percent: Math.round(pct * 100) };
    currentOffset += strokeLength;
    return segment;
  });
  return { total, r, circ, segments };
}
function barRows(data) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const maxCount = Math.max(1, ...data.map((item) => item.count));
  return data.map((item, index) => ({
    color: CHART_COLORS[index % CHART_COLORS.length],
    width: item.count / maxCount * 100,
    percent: Math.round(item.count / total * 100)
  }));
}
function kpiCards(data) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  return data.map((item, index) => ({
    accent: KPI_ACCENTS[index % KPI_ACCENTS.length],
    percent: total === 0 ? 0 : Math.round(item.count / total * 100)
  }));
}
function chartTotal(data) {
  return data.reduce((sum, item) => sum + item.count, 0);
}
function drawChart(view, parent, style, data) {
  if (style === "donut") view._drawDonutChart(parent, data);
  else if (style === "bar") view._drawBarChart(parent, data);
  else if (style === "kpi") view._drawKpiGrid(parent, data);
  else view._drawSimpleList(parent, data);
}
function drawChartEmpty(view, parent) {
  const el = parent.createDiv({ cls: "cad-empty", text: "No data" });
  el.style.cssText = "text-align: center; padding: 16px;";
}
function drawDonutChart(view, parent, allData) {
  const data = allData.filter((item) => item.count > 0);
  const { total, r, circ, segments } = donutGeometry(data);
  if (total === 0) return view._drawChartEmpty(parent);
  const container = parent.createDiv({ cls: "cad-donut-chart-container" });
  container.style.cssText = "display: flex; align-items: center; justify-content: center; gap: 24px; padding: 12px;";
  const svgWrap = container.createDiv({ cls: "cad-donut-svg-wrap" });
  svgWrap.style.cssText = "position: relative; width: 140px; height: 140px; flex-shrink: 0;";
  const svg = svgWrap.createSvg("svg", { attr: { width: "140", height: "140", viewBox: "0 0 140 140" } });
  svg.createSvg("circle", { attr: { cx: "70", cy: "70", r: String(r), fill: "transparent", stroke: "var(--background-secondary)", "stroke-width": "12" } });
  segments.forEach((segment) => {
    svg.createSvg("circle", {
      cls: "cad-donut-segment",
      attr: {
        cx: "70",
        cy: "70",
        r: String(r),
        fill: "transparent",
        stroke: segment.color,
        "stroke-width": "12",
        "stroke-dasharray": `${segment.length} ${circ}`,
        "stroke-dashoffset": String(-segment.offset),
        transform: "rotate(-90 70 70)"
      }
    });
  });
  const center = svgWrap.createDiv({ cls: "cad-donut-center" });
  center.style.cssText = "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center;";
  const centerTotal = center.createSpan({ cls: "cad-donut-center-total", text: String(total) });
  centerTotal.style.cssText = "font-size: 1.25rem; font-weight: 700; color: var(--text-normal);";
  const centerLabel = center.createSpan({ cls: "cad-donut-center-label", text: "Total" });
  centerLabel.style.cssText = "font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;";
  const legend = container.createDiv({ cls: "cad-donut-legend" });
  legend.style.cssText = "display: flex; flex-direction: column; gap: 6px; flex: 1;";
  data.forEach((item, index) => {
    const { color, percent } = segments[index];
    const row = legend.createDiv({ cls: "cad-donut-legend-item" });
    row.style.cssText = "display: flex; align-items: center; gap: 8px; font-size: 0.85em;";
    const swatch = row.createSpan({ cls: "cad-donut-legend-color" });
    swatch.style.cssText = `display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${color}; flex-shrink: 0;`;
    const labelEl = row.createSpan({ cls: "cad-donut-legend-label", text: String(item.label) });
    labelEl.style.cssText = "flex: 1; color: var(--text-normal); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;";
    const countEl = row.createSpan({ cls: "cad-donut-legend-count", text: `${item.count} (${percent}%)` });
    countEl.style.cssText = "font-weight: 700; color: var(--text-muted);";
  });
}
function drawBarChart(view, parent, data) {
  if (chartTotal(data) === 0) return view._drawChartEmpty(parent);
  const rows = barRows(data);
  const bars = parent.createDiv({ cls: "cad-stage-bars" });
  bars.style.cssText = "padding: 12px 0; display: flex; flex-direction: column; gap: 8px;";
  data.forEach((item, index) => {
    const { color, width, percent } = rows[index];
    const row = bars.createDiv({ cls: "cad-stage-bar-row" });
    row.style.cssText = "display: flex; align-items: center; margin-bottom: 0; padding: 4px 8px; border-radius: 6px;";
    const name = row.createDiv({ cls: "cad-stage-bar-name", text: String(item.label) });
    name.style.cssText = "width: 120px; font-weight: 500; font-size: 0.85em; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;";
    const count = row.createDiv({ cls: "cad-stage-bar-count", text: String(item.count) });
    count.style.cssText = "margin-right: 12px; font-weight: 700; color: var(--text-muted); font-size: 0.85em;";
    const bar = row.createDiv({ cls: "cad-stage-bar" });
    bar.style.cssText = "flex: 1; background: var(--background-secondary); border-radius: 4px; height: 10px; overflow: hidden; position: relative;";
    const fill = bar.createDiv({ cls: "cad-stage-bar-fill" });
    fill.style.cssText = `width: ${width}%; background-color: ${color}; height: 100%; border-radius: 4px; transition: width 0.3s ease;`;
    const value = row.createDiv({ cls: "cad-stage-bar-value", text: `${percent}%` });
    value.style.cssText = "margin-left: 12px; font-size: 0.8em; color: var(--text-faint); font-weight: 600; min-width: 36px; text-align: right;";
  });
}
function drawKpiGrid(view, parent, data) {
  if (chartTotal(data) === 0) return view._drawChartEmpty(parent);
  const cards = kpiCards(data);
  const grid = parent.createDiv({ cls: "cad-stat-grid" });
  grid.style.cssText = "grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; padding: 12px 0; margin: 0;";
  data.forEach((item, index) => {
    const { accent, percent } = cards[index];
    const card = grid.createDiv({ cls: "cad-stat-card", attr: { "data-accent": accent } });
    card.style.cssText = "padding: 10px 12px; display: flex; flex-direction: column; justify-content: center; min-height: 70px;";
    const label = card.createDiv({ cls: "cad-stat-label", text: String(item.label).toUpperCase() });
    label.style.cssText = "font-size: 0.65rem; letter-spacing: 0.08em; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;";
    const value = card.createDiv({ cls: "cad-stat-value", text: String(item.count) });
    value.style.cssText = "font-size: 1.25rem; font-weight: 800; margin: 2px 0; line-height: 1;";
    const sub = card.createDiv({ cls: "cad-stat-sub", text: `${percent}% of total` });
    sub.style.cssText = "font-size: 9px; margin-top: 0;";
  });
}
function drawSimpleList(view, parent, data) {
  if (chartTotal(data) === 0) return view._drawChartEmpty(parent);
  const list = parent.createDiv({ cls: "cad-simple-list" });
  list.style.cssText = "display: flex; flex-direction: column; gap: 6px; padding: 8px 0;";
  data.forEach((item) => {
    const row = list.createDiv({ cls: "cad-list-item" });
    row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: var(--background-secondary); border-radius: 6px; font-size: 0.9em;";
    const label = row.createSpan({ text: String(item.label) });
    label.style.cssText = "font-weight: 500; color: var(--text-normal); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;";
    const count = row.createSpan({ text: String(item.count) });
    count.style.cssText = "font-weight: 700; background: var(--background-primary); padding: 1px 8px; border-radius: 4px; border: 1px solid var(--border-color); color: var(--text-muted);";
  });
}

// src/views/components/chip-input.ts
var import_obsidian15 = require("obsidian");
function renderChipInput(view, parent, f, current, opts) {
  const { suggestionSource, isPlainChip, isList, targetEntityKey, customFolderPath } = chipConfig(f, ENTITIES, opts.listKeys);
  const chipText = (value) => chipLabel(value, suggestionSource);
  const isForm = opts.layout === "form";
  const wrap = parent.createDiv({ cls: "cad-pd-tag-input-wrap" });
  wrap.style.display = "flex";
  wrap.style.flexWrap = "wrap";
  wrap.style.gap = "6px";
  wrap.style.alignItems = "center";
  wrap.style.border = "none";
  wrap.style.borderRadius = "0";
  wrap.style.padding = "4px 0";
  wrap.style.minHeight = "36px";
  wrap.style.backgroundColor = "transparent";
  wrap.style.cursor = "text";
  let inp;
  if (isForm) {
    inp = wrap.createEl("input", { type: "text" });
    inp.style.border = "none";
    inp.style.outline = "none";
    inp.style.background = "transparent";
    inp.style.flex = "1";
    inp.style.minWidth = "80px";
    inp.style.color = "var(--text-normal)";
    inp.style.padding = "0";
    inp.style.margin = "0";
    inp.style.height = "24px";
  } else {
    inp = wrap.createEl("input", { type: "text", cls: "cad-pd-tag-input-field" });
    inp.style.border = "none";
    inp.style.outline = "none";
    inp.style.background = "transparent";
    inp.style.color = "var(--text-normal)";
    inp.style.flex = "1";
    inp.style.minWidth = "80px";
    inp.style.padding = "0";
    inp.style.height = "24px";
    inp.style.lineHeight = "24px";
  }
  inp.placeholder = `Add ${f.label.toLowerCase()}...`;
  const suggestionsBox = parent.createDiv({ cls: "cad-pd-tag-suggestions" });
  suggestionsBox.style.position = "absolute";
  suggestionsBox.style.zIndex = "10000";
  suggestionsBox.style.backgroundColor = "var(--background-secondary)";
  suggestionsBox.style.border = "1px solid var(--border-color)";
  suggestionsBox.style.borderRadius = "4px";
  suggestionsBox.style.boxShadow = "var(--shadow-s)";
  suggestionsBox.style.maxHeight = "150px";
  suggestionsBox.style.overflowY = "auto";
  suggestionsBox.style.display = "none";
  suggestionsBox.style.width = isForm ? "calc(100% - 150px)" : "100%";
  suggestionsBox.style.boxSizing = "border-box";
  suggestionsBox.style.top = "100%";
  if (isForm) suggestionsBox.style.right = "0";
  else suggestionsBox.style.left = "0";
  suggestionsBox.style.marginTop = "4px";
  let valuesList = chipValues(current, isPlainChip);
  const updateSuggestions = () => {
    const query = inp.value.trim().toLowerCase();
    suggestionsBox.empty();
    let candidates = [];
    if (suggestionSource === "tags") {
      candidates = Object.keys(view.app.metadataCache.getTags() || {}).map((t) => t.replace(/^#/, ""));
    } else if (suggestionSource === "history") {
      candidates = historyValues(view.app.vault.getMarkdownFiles().map((fl) => {
        const cache = view.app.metadataCache.getFileCache(fl);
        return cache && cache.frontmatter || {};
      }), f.key);
    } else if (suggestionSource !== "none") {
      candidates = chipScopeNotes(view.app, targetEntityKey, customFolderPath).map((note) => note.basename);
    }
    const filtered = filterSuggestions(candidates, query, valuesList.map(chipText));
    if (filtered.length === 0) {
      suggestionsBox.style.display = "none";
      return;
    }
    filtered.forEach((valStr) => {
      const item = suggestionsBox.createDiv({ cls: "cad-suggestion-item" });
      item.style.padding = "6px 10px";
      item.style.cursor = "pointer";
      item.style.fontSize = "13px";
      item.style.color = "var(--text-normal)";
      item.setText(valStr);
      item.addEventListener("mouseenter", () => {
        item.style.backgroundColor = "var(--background-modifier-hover)";
      });
      item.addEventListener("mouseleave", () => {
        item.style.backgroundColor = "transparent";
      });
      item.addEventListener("mousedown", async (ev) => {
        ev.preventDefault();
        await addVal(valStr);
        suggestionsBox.style.display = "none";
      });
    });
    suggestionsBox.style.display = "block";
  };
  const renderChips = () => {
    const existing = wrap.querySelectorAll(".cad-tag-chip");
    existing.forEach((c) => c.remove());
    valuesList.forEach((valName) => {
      const chip = wrap.createDiv({ cls: "cad-tag-chip" });
      chip.style.display = "inline-flex";
      chip.style.alignItems = "center";
      chip.style.gap = "6px";
      chip.style.backgroundColor = "var(--background-secondary, #eee)";
      chip.style.padding = "2px 8px";
      chip.style.borderRadius = "12px";
      chip.style.fontSize = "12px";
      chip.style.height = "24px";
      chip.style.boxSizing = "border-box";
      chip.style.color = "var(--text-normal)";
      const labelSpan = chip.createSpan({ text: chipText(valName) });
      if (!isPlainChip) {
        labelSpan.style.textDecoration = "underline";
        labelSpan.style.cursor = "pointer";
        labelSpan.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const target = chipLinkTarget(targetEntityKey, findNoteByName(chipScopeNotes(view.app, targetEntityKey, customFolderPath), valName), valName);
          if (target.kind === "entity") {
            view.openEntityDetail(target.entityKey, target.file);
          } else if (target.kind === "file") {
            view.openEntityDetailFromFile(target.file);
          } else {
            view.app.workspace.openLinkText(target.linktext, "", false);
          }
        });
      }
      const close = chip.createSpan({ text: "\xD7" });
      close.style.cursor = "pointer";
      close.style.fontWeight = "bold";
      close.style.fontSize = "14px";
      close.style.lineHeight = "1";
      close.style.color = "var(--text-muted)";
      close.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        valuesList = valuesList.filter((v) => v !== valName);
        await save();
        renderChips();
      });
      wrap.insertBefore(chip, inp);
    });
  };
  const save = async () => {
    await opts.save(chipWriteValue(valuesList, isPlainChip, isList));
  };
  const addVal = async (raw) => {
    const added = chipAdd(valuesList, raw, isList, chipText);
    if (added.kind === "blank") return;
    inp.value = "";
    if (added.kind === "duplicate") return;
    const { name } = added;
    valuesList = added.values;
    renderChips();
    await save();
    if (!isPlainChip && autoCreatesNote(targetEntityKey)) {
      const targetFile = findNoteByName(chipScopeNotes(view.app, targetEntityKey, customFolderPath), name);
      if (!targetFile) {
        try {
          const creation = chipCreation(suggestionSource, targetEntityKey, ENTITIES);
          await createEntity(view.app, creation.source, name);
          new import_obsidian15.Notice(`Created new ${creation.label}: ${name}`);
        } catch (e) {
          console.warn(`Failed to auto-create ${targetEntityKey || suggestionSource}`, e);
        }
      }
    }
  };
  inp.addEventListener("input", updateSuggestions);
  inp.addEventListener("focus", updateSuggestions);
  inp.addEventListener("keydown", async (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      await addVal(inp.value);
      suggestionsBox.style.display = "none";
    } else if (ev.key === "Backspace" && !inp.value && valuesList.length > 0) {
      valuesList.pop();
      await save();
      renderChips();
    }
  });
  inp.addEventListener("blur", async () => {
    setTimeout(async () => {
      suggestionsBox.style.display = "none";
      if (inp.value.trim()) {
        await addVal(inp.value);
      }
    }, 180);
  });
  wrap.addEventListener("click", () => inp.focus());
  renderChips();
}

// src/views/components/entity-table.ts
function renderEntityLinks(view, parent, val, targetEntityKey, prefix = "") {
  if (!val) return;
  const items = parseLinkValues(val);
  if (items.length === 0) return;
  if (prefix) parent.createSpan({ text: prefix });
  items.forEach((item, idx) => {
    if (idx > 0) parent.createSpan({ text: ", " });
    let resolvedKey = targetEntityKey;
    if (targetEntityKey && targetEntityKey.startsWith("folder:")) {
      const folderPath = targetEntityKey.slice("folder:".length).replace(/\/+$/, "").toLowerCase();
      const matchedKey = Object.keys(ENTITIES).find((k) => ENTITIES[k].folder.replace(/\/+$/, "").toLowerCase() === folderPath);
      resolvedKey = matchedKey || "note";
    }
    const link = parent.createEl("a", { text: item.display, cls: `cad-${resolvedKey}-link` });
    link.style.textDecoration = "underline";
    link.style.cursor = "pointer";
    link.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const targetFile = view.app.vault.getMarkdownFiles().find((f) => f.basename.toLowerCase() === item.target.toLowerCase());
      if (targetFile) {
        if (ENTITIES[resolvedKey]) {
          view.openEntityDetail(resolvedKey, targetFile);
        } else {
          view.app.workspace.openLinkText(targetFile.path, "", false);
        }
      } else {
        view.app.workspace.openLinkText(item.target, "", false);
      }
    });
  });
}
function renderOwnerLinks(view, parent, ownerVal, showPrefix = true) {
  view._renderEntityLinks(parent, ownerVal, "contact", showPrefix ? "Owner: " : "");
}
function renderEntityTable(view, parent, entityKey, filteredList, columns) {
  const def = ENTITIES[entityKey];
  if (!def) return;
  const tableWrap = parent.createDiv({ cls: "cad-table-wrap" });
  tableWrap.style.padding = "0";
  tableWrap.style.border = "none";
  tableWrap.style.boxShadow = "none";
  tableWrap.style.borderRadius = "0";
  tableWrap.style.marginTop = "0";
  tableWrap.style.overflowX = "auto";
  const table = tableWrap.createEl("table", { cls: "cad-table" });
  const cols = columns.map((k) => def.fields.find((f) => f.key === k)).filter(Boolean);
  const thead = table.createEl("thead");
  const trh = thead.createEl("tr");
  cols.forEach((f) => trh.createEl("th", { text: f.label }));
  const tbody = table.createEl("tbody");
  filteredList.forEach((e) => {
    const tr = tbody.createEl("tr", { cls: "cad-row" });
    cols.forEach((f, i) => {
      const td = tr.createEl("td");
      const val = entityValue(e, f.key, def);
      const formatted = fmtValue(val, f.type);
      const primaryField2 = def.fields.find((fd) => fd.primary) || def.fields[0];
      const hasPrimaryCol = cols.some((c) => c.key === primaryField2.key);
      const isPrimaryCol = hasPrimaryCol ? f.key === primaryField2.key : i === 0;
      if (isPrimaryCol) {
        const a = td.createEl("a", { cls: "cad-row-primary", text: formatted || e.basename });
        a.style.fontWeight = "bold";
        a.style.textDecoration = "underline";
        a.style.cursor = "pointer";
        a.addEventListener("click", (ev) => {
          ev.preventDefault();
          view.openEntityDetail(entityKey, e.file);
        });
      } else if (f.key === "owner" || f.key === "assigned") {
        view._renderOwnerLinks(td, val, false);
      } else {
        const sugSrc = f.suggestionSource || getFieldSuggestionSource(f);
        if (f.type === "multitext" && sugSrc && sugSrc !== "none" && sugSrc !== "tags" && sugSrc !== "history") {
          view._renderEntityLinks(td, val, sugSrc);
        } else if (f.key === "company") {
          view._renderEntityLinks(td, val, "company");
        } else if (f.key === "partner") {
          view._renderEntityLinks(td, val, "partner");
        } else if (f.key === "contact" || f.key === "contacts" || f.key === "with") {
          view._renderEntityLinks(td, val, "contact");
        } else if (f.key === "related") {
          view._renderEntityLinks(td, val, "project");
        } else if (f.key === "stage" && val) {
          const span = td.createSpan({ cls: `cad-pill cad-pill-${String(val).trim().toLowerCase().replace(/\s+/g, "-")}`, text: formatted });
          span.style.fontSize = "10px";
          span.style.padding = "2px 6px";
        } else {
          td.setText(formatted || "\u2014");
        }
      }
    });
  });
}
function getEntityFiles(view, entityKey) {
  if (entityKey === "daily") {
    const folderPath = (view.plugin.settings.dailyNoteFolder || "").replace(/\/$/, "");
    if (!folderPath) {
      return view.app.vault.getMarkdownFiles().filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f.path));
    }
    const folder = view.app.vault.getAbstractFileByPath(folderPath);
    if (!folder || !folder.children) return [];
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (child.children) walk(child);
        else if (typeof child.path === "string" && child.path.toLowerCase().endsWith(".md")) {
          out.push(child);
        }
      }
    };
    walk(folder);
    return out;
  } else {
    return listEntityFiles(view.app, entityKey);
  }
}

// src/views/components/sections.ts
var import_obsidian16 = require("obsidian");
function linksTo(val, name) {
  const cleanName = name.trim().toLowerCase();
  return parseLinkValues(val).some((link) => link.target.toLowerCase() === cleanName);
}
function crossSectionRows(entities, linkField, parentName, frontmatterOf) {
  return entities.filter((e) => linksTo(frontmatterOf(e)[linkField], parentName));
}
var CROSS_VIEW_TYPES = ["table", "kanban", "tile"];
function isFilled(val) {
  if (Array.isArray(val)) return val.some((v) => v != null && String(v).trim() !== "");
  return val != null && val !== "";
}
function crossViewType(viewType) {
  return CROSS_VIEW_TYPES.includes(viewType) ? viewType : "table";
}
function frontmatterReader(view) {
  return (e) => {
    const cache = view.app.metadataCache.getFileCache(e.file);
    return cache && cache.frontmatter || {};
  };
}
function dynamicH2Kind(rawKey) {
  const { cleanLabel, tag } = parseHeaderKey(rawKey);
  const cleanLower = cleanLabel.toLowerCase();
  if (isTasksSectionKey(rawKey)) return { kind: "tasks", cleanLabel };
  if (tag === "#milestones" || cleanLower === "milestones") return { kind: "milestones", cleanLabel };
  if (tag.startsWith("#cross-")) {
    const crossParts = tag.slice("#cross-".length).split("-");
    const viewType = crossParts[crossParts.length - 1];
    if (crossParts.length < 3 || crossParts.length > 3 && !CROSS_VIEW_TYPES.includes(viewType)) return { kind: "malformed", cleanLabel };
    return { kind: "cross", cleanLabel, targetEntity: crossParts[0], linkField: crossParts.slice(1, -1).join("-"), viewType };
  }
  if (tag.startsWith("#chart-")) {
    const chartParts = tag.slice("#chart-".length).split("-");
    if (chartParts.length < 4) return { kind: "malformed", cleanLabel };
    return {
      kind: "chart",
      cleanLabel,
      targetEntity: chartParts[0],
      linkField: chartParts[1],
      groupField: chartParts[2],
      chartStyle: chartParts.slice(3).join("-")
    };
  }
  return { kind: "text", cleanLabel };
}
function renderMarkdownTextCard(view, parent, file, sectionKey, label, initialValue, placeholder, flashSaved) {
  const card = parent.createDiv({ cls: "cad-pd-card" });
  const head = card.createDiv({ cls: "cad-pd-card-head" });
  head.createDiv({ cls: "cad-pd-card-title", text: label });
  const openBtn = head.createEl("button", { cls: "cad-btn cad-btn-sm", attr: { style: "margin-left: auto; padding: 4px 6px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; border: 1px solid var(--border-color); background: transparent; cursor: pointer;" } });
  openBtn.title = "Open this note natively to edit with full Live Preview & Autocomplete";
  try {
    (0, import_obsidian16.setIcon)(openBtn, "file-text");
  } catch (_) {
  }
  openBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    view.app.workspace.openLinkText(file.path, "", "split");
  });
  const body = card.createDiv({ attr: { style: "padding: 12px; min-height: 40px; position: relative;" } });
  const previewDiv = body.createDiv({ cls: "markdown-preview-view", attr: { style: "padding: 0; min-height: 30px;" } });
  const renderPreview = async () => {
    previewDiv.empty();
    const rawText = initialValue || "";
    if (!rawText.trim()) {
      previewDiv.createDiv({ text: placeholder || "Empty section.", attr: { style: "color: var(--text-faint); font-style: italic; font-size: 0.9em; padding: 4px 0;" } });
      return;
    }
    try {
      await import_obsidian16.MarkdownRenderer.render(view.app, rawText, previewDiv, file.path, view);
    } catch (error) {
      console.warn("Cadence: markdown render failed, showing the raw text", error);
      previewDiv.empty();
      previewDiv.setText(rawText);
      return;
    }
    previewDiv.querySelectorAll("a.internal-link").forEach((a) => {
      const href = a.getAttribute("data-href") || a.getAttribute("href");
      if (href) {
        a.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          view.app.workspace.openLinkText(href, file.path, false);
        });
      }
    });
  };
  void renderPreview();
}
function renderProjectTextSection(view, parent, file, sections, def, flashSaved) {
  const initial = (sections[def.key] || "").replace(/^\s+|\s+$/g, "");
  view._renderMarkdownTextCard(parent, file, def.key, def.label, initial, def.placeholder, flashSaved);
}
function renderGenericTextSection(view, parent, file, sections, key, flashSaved) {
  const { cleanLabel } = parseHeaderKey(key);
  const initial = (sections[key] || "").replace(/^\s+|\s+$/g, "");
  view._renderMarkdownTextCard(parent, file, key, cleanLabel.toUpperCase(), initial, `Content for ${cleanLabel}...`, flashSaved);
}
function renderSingleCrossSection(view, parent, targetEntity, linkField, requestedViewType, parentName, preFilteredList = null) {
  const def = ENTITIES[targetEntity];
  if (!def) return;
  const viewType = crossViewType(requestedViewType);
  const filteredList = preFilteredList || crossSectionRows(listEntities(view.app, targetEntity), linkField, parentName, frontmatterReader(view));
  const secWrap = parent.createDiv({ attr: { style: "margin-top: 12px; margin-bottom: 12px;" } });
  if (filteredList.length === 0) {
    secWrap.createDiv({ cls: "cad-empty", text: "No linked items found." });
    return;
  }
  if (viewType === "table") {
    const columns = def.columns || [def.fields[0].key];
    view._renderEntityTable(secWrap, targetEntity, filteredList, columns);
  } else if (viewType === "tile") {
    const grid = secWrap.createDiv({ cls: "cad-proj-grid" });
    filteredList.forEach((e) => {
      if (targetEntity === "project") {
        const card = grid.createDiv({ cls: "cad-proj-card" });
        const head = card.createDiv({ cls: "cad-proj-card-head" });
        const title = head.createEl("a", { cls: "cad-proj-title", text: entityValue(e, "name", def) || e.basename });
        title.addEventListener("click", (ev) => {
          ev.preventDefault();
          view.openEntityDetail("project", e.file);
        });
        const status = String(entityValue(e, "status", def) || "active");
        const priority = String(entityValue(e, "priority", def) || "");
        const pillRow = head.createDiv({ cls: "cad-proj-pills" });
        pillRow.createSpan({ cls: `cad-pill cad-pill-${status.toLowerCase().replace(/\s+/g, "-")}`, text: status });
        if (priority) pillRow.createSpan({ cls: `cad-pill cad-pill-prio-${priority.toLowerCase()}`, text: priority });
        const metaRow = card.createDiv({ cls: "cad-proj-meta" });
        const owner = entityValue(e, "owner", def);
        const due = entityValue(e, "due", def);
        if (owner) view._renderOwnerLinks(metaRow, owner);
        if (due) metaRow.createSpan({ text: `Due: ${fmtValue(due, "date")}` });
        const progWrap = card.createDiv({ cls: "cad-proj-progress-wrap" });
        const progLabel = progWrap.createDiv({ cls: "cad-proj-progress-label" });
        const progTextSpan = progLabel.createSpan({ text: "Loading milestones..." });
        const progPctSpan = progLabel.createSpan({ cls: "cad-proj-progress-pct", text: "" });
        const bar = progWrap.createDiv({ cls: "cad-proj-progress-bar" });
        const fill = bar.createDiv({ cls: "cad-proj-progress-fill" });
        fill.style.width = "0%";
        const nextRow = card.createDiv({ cls: "cad-proj-next" });
        readProjectMeta(view.app, e.file).then((pm) => {
          progWrap.dataset.pctBand = pctBand(pm.percent);
          progTextSpan.setText(`${pm.done}/${pm.total} milestones`);
          progPctSpan.setText(`${pm.percent}%`);
          fill.style.width = `${pm.percent}%`;
          if (pm.next) {
            nextRow.createSpan({ cls: "cad-proj-next-label", text: "NEXT \xB7 " });
            nextRow.createSpan({ cls: "cad-proj-next-date", text: fmtValue(pm.next.date, "date") });
            if (pm.next.title) nextRow.createSpan({ text: ` \u2014 ${pm.next.title}` });
          }
        });
      } else {
        const card = grid.createDiv({ cls: "cad-proj-card" });
        const head = card.createDiv({ cls: "cad-proj-card-head" });
        const primaryField2 = def.fields.find((f) => f.primary) || def.fields[0];
        const titleText = entityValue(e, primaryField2.key, def) || e.basename;
        const title = head.createEl("a", { cls: "cad-proj-title", text: titleText });
        title.addEventListener("click", (ev) => {
          ev.preventDefault();
          view.openEntityDetail(targetEntity, e.file);
        });
        const pillRow = head.createDiv({ cls: "cad-proj-pills" });
        const statusField = def.fields.find((f) => f.key === "status" || f.key === "type" || f.key === "tier") || def.fields.find((f) => f.type === "enum");
        if (statusField) {
          const val = entityValue(e, statusField.key, def);
          if (val) {
            const clean = Array.isArray(val) ? val[0] : val;
            pillRow.createSpan({ cls: `cad-pill cad-pill-${String(clean).toLowerCase().replace(/\s+/g, "-")}`, text: String(clean) });
          }
        }
        const metaRow = card.createDiv({ cls: "cad-proj-meta" });
        let count = 0;
        def.fields.forEach((f) => {
          if (f.key !== primaryField2.key && (!statusField || f.key !== statusField.key) && count < 4) {
            const val = entityValue(e, f.key, def);
            if (isFilled(val)) {
              count++;
              const fieldDiv = metaRow.createDiv();
              fieldDiv.style.marginBottom = "2px";
              fieldDiv.createSpan({ text: `${f.label}: `, attr: { style: "font-weight: 500; color: var(--text-muted);" } });
              const isLinkProperty = f.key === "company" || f.key === "contact" || f.key === "partner" || f.key === "owner" || f.key === "project" || f.suggestionSource && f.suggestionSource.startsWith("folder:");
              if (isLinkProperty) {
                const links = parseLinkValues(val);
                links.forEach((link, lidx) => {
                  if (lidx > 0) fieldDiv.createSpan({ text: ", " });
                  const aLink = fieldDiv.createEl("a", { text: link.display });
                  aLink.style.textDecoration = "underline";
                  aLink.style.cursor = "pointer";
                  aLink.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const targetFile = view.app.vault.getMarkdownFiles().find((f2) => f2.basename.toLowerCase() === link.target.toLowerCase());
                    let relatedKey = f.key === "owner" ? "contact" : f.key;
                    if (f.suggestionSource && f.suggestionSource.startsWith("folder:")) {
                      const folder = f.suggestionSource.replace("folder:", "").split("/").pop().toLowerCase();
                      const found = Object.keys(ENTITIES).find((k) => ENTITIES[k].folder.toLowerCase().endsWith(folder) || ENTITIES[k].plural.toLowerCase() === folder);
                      if (found) relatedKey = found;
                    }
                    if (targetFile) view.openEntityDetail(relatedKey, targetFile);
                    else view.app.workspace.openLinkText(link.target, "", false);
                  });
                });
              } else {
                fieldDiv.createSpan({ text: fmtValue(val, f.type) });
              }
            }
          }
        });
      }
    });
  } else if (viewType === "kanban") {
    const board = secWrap.createDiv({ cls: "cad-kanban-board" });
    const groupField = def.fields.find((f) => f.key === "stage" || f.key === "status" || f.key === "type" || f.type === "enum") || def.fields[1];
    const columns = groupField.options || ["To Do", "In Progress", "Done"];
    const isMobile = !!(import_obsidian16.Platform && import_obsidian16.Platform.isMobile);
    columns.forEach((colName) => {
      const items = filteredList.filter((e) => {
        const val = entityValue(e, groupField.key, def);
        const cleanVal = Array.isArray(val) ? val[0] : val;
        return String(cleanVal || "").toLowerCase() === colName.toLowerCase();
      });
      const hasValField = def.fields.find((f) => f.key === "value" || f.key === "amount");
      const colValueSum = hasValField ? items.reduce((s, e) => s + (Number(entityValue(e, hasValField.key, def)) || 0), 0) : 0;
      const col = board.createDiv({ cls: "cad-kanban-col" });
      col.dataset.stage = colName;
      const colHead = col.createDiv({ cls: "cad-kanban-col-head" });
      colHead.createDiv({ cls: "cad-kanban-col-title", text: colName.toUpperCase() });
      colHead.createDiv({
        cls: "cad-kanban-col-meta",
        text: hasValField ? `${items.length} \xB7 ${fmtValue(colValueSum, "currency")}` : `${items.length}`
      });
      const list = col.createDiv({ cls: "cad-kanban-col-list" });
      list.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        try {
          ev.dataTransfer.dropEffect = "move";
        } catch (_) {
        }
        col.addClass("drag-over");
      });
      list.addEventListener("dragleave", (ev) => {
        if (!col.contains(ev.relatedTarget)) col.removeClass("drag-over");
      });
      list.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        col.removeClass("drag-over");
        const path = ev.dataTransfer.getData("text/cadence-entity");
        const fromStage = ev.dataTransfer.getData("text/cadence-stage");
        if (!path || fromStage === colName) return;
        const file = view.app.vault.getAbstractFileByPath(path);
        if (!file || !(file instanceof import_obsidian16.TFile)) return;
        try {
          await view.app.fileManager.processFrontMatter(file, (fm) => {
            const isList = groupField.type === "multitext" || groupField.type === "tags" || groupField.isList === true;
            const isLink = groupField.suggestionSource && groupField.suggestionSource !== "none" && groupField.suggestionSource !== "tags" && groupField.suggestionSource !== "history";
            if (isList) {
              fm[groupField.key] = isLink ? [`[[${colName}]]`] : [colName];
            } else {
              fm[groupField.key] = isLink ? `[[${colName}]]` : colName;
            }
          });
          new import_obsidian16.Notice(`Moved to ${colName}`);
          view.render();
        } catch (e) {
          new import_obsidian16.Notice(`Failed to move: ${e.message}`);
        }
      });
      if (!items.length) {
        list.createDiv({ cls: "cad-empty", text: "\u2014" });
      } else {
        items.forEach((e) => {
          const card = list.createDiv({ cls: "cad-kanban-card" });
          card.dataset.path = e.file.path;
          const primaryField2 = def.fields.find((f) => f.primary) || def.fields[0];
          card.createDiv({ cls: "cad-kanban-card-title", text: entityValue(e, primaryField2.key, def) || e.basename });
          const meta = card.createDiv({ cls: "cad-kanban-card-meta" });
          if (hasValField) {
            const v = entityValue(e, hasValField.key, def);
            if (v) meta.createSpan({ cls: "cad-kanban-card-value", text: fmtValue(v, "currency") });
          }
          const relFields = ["company", "contact", "owner", "assigned"];
          relFields.forEach((rf) => {
            if (rf === groupField.key) return;
            const rfDef = def.fields.find((f) => f.key === rf);
            if (rfDef) {
              const vals = parseLinkValues(entityValue(e, rf, def));
              vals.forEach((v) => {
                if (meta.children.length > 0) meta.createSpan({ text: " \xB7 " });
                const link = meta.createEl("a", { text: v.display });
                link.style.textDecoration = "underline";
                link.style.cursor = "pointer";
                link.addEventListener("click", (ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  const targetFile = view.app.vault.getMarkdownFiles().find((f) => f.basename.toLowerCase() === v.target.toLowerCase());
                  if (targetFile) view.openEntityDetail(rf === "owner" || rf === "assigned" ? "contact" : rf, targetFile);
                  else view.app.workspace.openLinkText(v.target, "", false);
                });
              });
            }
          });
          if (!isMobile) {
            card.draggable = true;
            card.addEventListener("dragstart", (ev) => {
              card.addClass("dragging");
              try {
                ev.dataTransfer.effectAllowed = "move";
                ev.dataTransfer.setData("text/cadence-entity", e.file.path);
                ev.dataTransfer.setData("text/cadence-stage", colName);
                ev.dataTransfer.setData("text/plain", `[[${e.file.basename}]]`);
              } catch (_) {
              }
            });
            card.addEventListener("dragend", () => card.removeClass("dragging"));
          } else {
            card.addClass("cad-kanban-card-touch");
          }
          card.addEventListener("click", () => view.openEntityDetail(targetEntity, e.file));
        });
      }
    });
  }
}
function renderCrossSections(view, parent, parentEntity, parentName) {
  const crossSections = view.plugin.settings.crossSections || [];
  const configs = crossSections.filter((c) => c.parentEntity === parentEntity);
  if (configs.length === 0) return;
  configs.forEach((config) => {
    const def = ENTITIES[config.targetEntity];
    if (!def) return;
    const filteredList = crossSectionRows(listEntities(view.app, config.targetEntity), config.linkField, parentName, frontmatterReader(view));
    const secWrap = parent.createDiv({ attr: { style: "margin-top: 24px; margin-bottom: 24px;" } });
    const head = secWrap.createDiv({ attr: { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;" } });
    head.createEl("h3", {
      text: `${def.plural.toUpperCase()} (${config.linkField.toUpperCase()}) \u2014 ${config.viewType.toUpperCase()}`,
      attr: { style: "margin: 0; font-size: 1.1em; font-weight: 700; letter-spacing: 0.05em;" }
    });
    const delBtn = head.createEl("button", { text: "\xD7", attr: { style: "color: var(--text-error); border: 1px solid var(--text-error); padding: 2px 8px; font-weight: bold; border-radius: 4px; background: transparent; cursor: pointer;" } });
    delBtn.title = "Delete this cross section";
    delBtn.addEventListener("click", async () => {
      if (!confirm("Delete this cross section?")) return;
      view.plugin.settings.crossSections = (view.plugin.settings.crossSections || []).filter((c) => c.id !== config.id);
      await view.plugin.saveSettings();
      view.render();
    });
    if (filteredList.length === 0) {
      secWrap.createDiv({ cls: "cad-empty", text: "No linked items found." });
      return;
    }
    const viewType = crossViewType(config.viewType);
    if (viewType === "table") {
      const columns = def.columns || [def.fields[0].key];
      view._renderEntityTable(secWrap, config.targetEntity, filteredList, columns);
    } else if (viewType === "tile") {
      const grid = secWrap.createDiv({ attr: { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 12px;" } });
      filteredList.forEach((e) => {
        const card = grid.createDiv({ cls: "cad-proj-card", attr: { style: "cursor: pointer; padding: 16px; background: var(--background-secondary); border: 1px solid var(--border-color); border-radius: 6px;" } });
        const title = card.createEl("h4", { text: entityValue(e, def.fields[0].key, def) || e.basename, attr: { style: "margin: 0 0 8px 0; font-weight: 600;" } });
        card.addEventListener("click", () => view.openEntityDetail(config.targetEntity, e.file));
        const meta = card.createDiv({ attr: { style: "font-size: 0.85em; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px;" } });
        def.fields.slice(1, 4).forEach((f) => {
          const val = entityValue(e, f.key, def);
          if (isFilled(val)) {
            meta.createDiv({ text: `${f.label}: ${fmtValue(val, f.type)}` });
          }
        });
      });
    } else if (viewType === "kanban") {
      const kanbanWrap = secWrap.createDiv({ attr: { style: "display: flex; gap: 16px; overflow-x: auto; padding-bottom: 8px; margin-top: 12px;" } });
      const groupField = def.fields.find((f) => f.key === "stage" || f.key === "status" || f.key === "type" || f.type === "enum") || def.fields[1];
      const columns = groupField.options || ["To Do", "In Progress", "Done"];
      columns.forEach((colName) => {
        const col = kanbanWrap.createDiv({ cls: "cad-stat-card", attr: { style: "flex: 0 0 280px; padding: 12px; display: flex; flex-direction: column; min-height: 250px; background: var(--background-secondary); border: 1px solid var(--border-color); border-radius: 6px;" } });
        col.createDiv({ text: colName.toUpperCase(), attr: { style: "font-weight: 700; font-size: 0.8em; letter-spacing: 0.08em; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;" } });
        const colItems = filteredList.filter((e) => {
          const val = entityValue(e, groupField.key, def);
          const cleanVal = Array.isArray(val) ? val[0] : val;
          return String(cleanVal || "").toLowerCase() === colName.toLowerCase();
        });
        if (colItems.length === 0) {
          col.createDiv({ text: "No items", attr: { style: "color: var(--text-faint); text-align: center; margin-top: 24px; font-size: 0.85em;" } });
        } else {
          const itemsList = col.createDiv({ attr: { style: "display: flex; flex-direction: column; gap: 8px;" } });
          colItems.forEach((e) => {
            const itemCard = itemsList.createDiv({ cls: "cad-dash-row", attr: { style: "padding: 8px 10px; cursor: pointer; border-radius: 4px; background: var(--background-primary); border: 1px solid var(--border-color); font-weight: 500;" } });
            itemCard.setText(entityValue(e, def.fields[0].key, def) || e.basename);
            itemCard.addEventListener("click", () => view.openEntityDetail(config.targetEntity, e.file));
          });
        }
      });
    }
  });
}
function renderDynamicH2Section(view, parent, file, sections, rawKey, flashSaved) {
  const h2 = dynamicH2Kind(rawKey);
  const { cleanLabel } = h2;
  if (h2.kind === "malformed" || (h2.kind === "cross" || h2.kind === "chart") && !ENTITIES[h2.targetEntity]) {
    view._renderGenericTextSection(parent, file, sections, rawKey, flashSaved);
    return;
  }
  if (h2.kind === "tasks") {
    const taskList = parseTasksList(sections[rawKey] || "");
    view._renderTaskSection(parent, file, taskList, flashSaved, rawKey);
  } else if (h2.kind === "milestones") {
    const milestoneList = parseMilestones(sections[rawKey] || "");
    view._renderMilestoneSection(parent, file, milestoneList, flashSaved, rawKey);
  } else if (h2.kind === "cross") {
    const { targetEntity, linkField, viewType } = h2;
    const def = ENTITIES[targetEntity];
    const parentName = file.basename;
    const filteredList = crossSectionRows(listEntities(view.app, targetEntity), linkField, parentName, frontmatterReader(view));
    const card = parent.createDiv({ cls: "cad-pd-card" });
    card.style.gridColumn = "1 / -1";
    const head = card.createDiv({ cls: "cad-pd-card-head" });
    head.createDiv({ cls: "cad-pd-card-title", text: `${cleanLabel.toUpperCase()} \xB7 ${filteredList.length}` });
    const addBtn = head.createEl("button", { cls: "cad-btn cad-btn-sm", text: `+ Add ${def.label}` });
    addBtn.addEventListener("click", () => {
      view._createEntityFromPrompt(targetEntity, { [linkField]: `[[${parentName}]]` });
    });
    const viewSwitch = head.createDiv({ attr: { style: "display: flex; gap: 3px; margin-left: 8px;" } });
    const viewOptions = [
      { v: "table", icon: "layout-list", title: "Table View" },
      { v: "kanban", icon: "kanban", title: "Kanban Board" },
      { v: "tile", icon: "layout-grid", title: "Tile Grid" }
    ];
    viewOptions.forEach(({ v, icon, title }) => {
      const vBtn = viewSwitch.createEl("button", { attr: { style: `padding: 4px 6px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; cursor: pointer; border: 1px solid var(--border-color); background: ${v === viewType ? "var(--interactive-accent)" : "transparent"}; color: ${v === viewType ? "var(--text-on-accent)" : "var(--text-muted)"};` } });
      vBtn.title = title;
      try {
        (0, import_obsidian16.setIcon)(vBtn, icon);
      } catch (_) {
      }
      if (v !== viewType) {
        vBtn.addEventListener("click", async () => {
          const newTag = `#cross-${targetEntity}-${linkField}-${v}`;
          const curContent = await view.app.vault.read(file);
          const escaped = rawKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const newContent = curContent.replace(
            new RegExp(`^(## ${escaped})$`, "m"),
            `## ${cleanLabel} ${newTag}`
          );
          await view.app.vault.modify(file, newContent);
          view.render();
        });
      }
    });
    const body = card.createDiv({ attr: { style: "padding: 12px;" } });
    view._renderSingleCrossSection(body, targetEntity, linkField, viewType, parentName, filteredList);
  } else if (h2.kind === "chart") {
    const { targetEntity, linkField, groupField } = h2;
    const chartStyle = chartStyleOf(h2.chartStyle);
    const def = ENTITIES[targetEntity];
    const parentName = file.basename;
    const filteredList = crossSectionRows(listEntities(view.app, targetEntity), linkField, parentName, frontmatterReader(view));
    const chartData2 = sectionChartData(filteredList, groupField, def);
    const card = parent.createDiv({ cls: "cad-pd-card" });
    card.style.gridColumn = "1 / -1";
    const head = card.createDiv({ cls: "cad-pd-card-head" });
    head.createDiv({ cls: "cad-pd-card-title", text: `${cleanLabel.toUpperCase()} \xB7 ${filteredList.length} ${def.plural}` });
    const styleSwitch = head.createDiv({ attr: { style: "display: flex; gap: 3px; margin-left: 8px;" } });
    [{ v: "donut", icon: "\u{1F369}" }, { v: "bar", icon: "\u{1F4CA}" }, { v: "kpi", icon: "\u{1F5C3}\uFE0F" }, { v: "list", icon: "\u{1F4CB}" }].forEach(({ v, icon }) => {
      const sBtn = styleSwitch.createEl("button", {
        text: icon,
        attr: { style: `padding: 1px 5px; font-size: 0.85em; border-radius: 3px; cursor: pointer; border: 1px solid var(--border-color); background: ${v === chartStyle ? "var(--interactive-accent)" : "transparent"}; opacity: ${v === chartStyle ? "1" : "0.55"};` }
      });
      sBtn.title = v;
      if (v !== chartStyle) {
        sBtn.addEventListener("click", async () => {
          const newTag = `#chart-${targetEntity}-${linkField}-${groupField}-${v}`;
          const curContent = await view.app.vault.read(file);
          const escaped = rawKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const newContent = curContent.replace(
            new RegExp(`^(## ${escaped})$`, "m"),
            `## ${cleanLabel} ${newTag}`
          );
          await view.app.vault.modify(file, newContent);
          view.render();
        });
      }
    });
    const body = card.createDiv({ cls: "cad-dash-card-body", attr: { style: "flex: 1; min-height: 180px; display: flex; flex-direction: column; justify-content: center; padding: 14px;" } });
    view._drawChart(body.createDiv(), chartStyle, chartData2);
  } else {
    view._renderGenericTextSection(parent, file, sections, rawKey, flashSaved);
  }
}

// src/modals/widget-create.ts
var import_obsidian17 = require("obsidian");
function buildWidgetConfig(form) {
  const title = form.title.trim();
  if (!title) return null;
  return {
    id: `widget.${Date.now()}`,
    title,
    groupBy: form.groupBy,
    style: form.style
  };
}
var CadenceWidgetCreateModal = class extends import_obsidian17.Modal {
  constructor(app, entityKey, onSubmit, onCancel) {
    super(app);
    if (typeof entityKey === "function") {
      this.onSubmit = entityKey;
      this.entityKey = "project";
    } else {
      this.entityKey = entityKey || "project";
      this.onSubmit = onSubmit;
    }
    this.onCancel = onCancel;
    this._submitted = false;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this._submitted = false;
    contentEl.addClass("cad-prompt-modal");
    contentEl.createEl("h3", { text: "Add Custom Chart Widget" });
    contentEl.createEl("label", { text: "Chart Title:", attr: { style: "display: block; font-weight: 500; font-size: 0.85em; margin-bottom: 4px; margin-top: 12px;" } });
    const inputTitle = contentEl.createEl("input", { type: "text", placeholder: `e.g. ${this.entityKey.toUpperCase()} by Group` });
    inputTitle.style.width = "100%";
    inputTitle.style.padding = "6px 8px";
    const entityLabel = ENTITIES[this.entityKey] ? ENTITIES[this.entityKey].plural || this.entityKey : this.entityKey;
    contentEl.createEl("label", { text: `Group ${entityLabel.toUpperCase()} by Property:`, attr: { style: "display: block; font-weight: 500; font-size: 0.85em; margin-bottom: 4px; margin-top: 12px;" } });
    const selectProp = contentEl.createEl("select");
    selectProp.style.width = "100%";
    selectProp.style.padding = "6px 8px";
    selectProp.style.background = "var(--background-primary)";
    selectProp.style.color = "var(--text-normal)";
    selectProp.style.border = "1px solid var(--border-color)";
    selectProp.style.borderRadius = "4px";
    const fields = ENTITIES[this.entityKey] ? ENTITIES[this.entityKey].fields || [] : [];
    fields.forEach((f) => {
      if (f.primary) return;
      selectProp.createEl("option", { value: f.key, text: `${f.label} (${f.key})` });
    });
    contentEl.createEl("label", { text: "Chart Style:", attr: { style: "display: block; font-weight: 500; font-size: 0.85em; margin-bottom: 4px; margin-top: 12px;" } });
    const selectStyle = contentEl.createEl("select");
    selectStyle.style.width = "100%";
    selectStyle.style.padding = "6px 8px";
    selectStyle.style.background = "var(--background-primary)";
    selectStyle.style.color = "var(--text-normal)";
    selectStyle.style.border = "1px solid var(--border-color)";
    selectStyle.style.borderRadius = "4px";
    [
      { value: "donut", text: "Donut Chart \u{1F369}" },
      { value: "bar", text: "Horizontal Bar Chart \u{1F4CA}" },
      { value: "kpi", text: "KPI Cards Grid \u{1F5C3}\uFE0F" },
      { value: "list", text: "Simple List \u{1F4CB}" }
    ].forEach((opt) => {
      selectStyle.createEl("option", { value: opt.value, text: opt.text });
    });
    const submit = () => {
      const config = buildWidgetConfig({ title: inputTitle.value, groupBy: selectProp.value, style: selectStyle.value });
      if (!config) {
        new import_obsidian17.Notice("Please enter a chart title.");
        inputTitle.focus();
        return;
      }
      if (!config.groupBy) {
        new import_obsidian17.Notice(`There is no property to group ${entityLabel} by.`);
        return;
      }
      this._submitted = true;
      this.onSubmit?.(config);
      this.close();
    };
    const row = contentEl.createDiv();
    row.style.display = "flex";
    row.style.justifyContent = "flex-end";
    row.style.gap = "8px";
    row.style.marginTop = "18px";
    const cancel = row.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const ok = row.createEl("button", { text: "Create Widget", cls: "mod-cta" });
    ok.disabled = !selectProp.options.length;
    ok.addEventListener("click", submit);
    setTimeout(() => inputTitle.focus(), 0);
  }
  onClose() {
    if (!this._submitted && this.onCancel) {
      this._submitted = true;
      this.onCancel();
    }
    this.contentEl.empty();
  }
};

// src/utils/deals.ts
function foldStage(stage) {
  return String(stage ?? "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
}
function stageOutcome(stage) {
  const folded = foldStage(stage).replace(/^closed /, "");
  return folded === "won" ? "won" : folded === "lost" ? "lost" : "open";
}
function dealStage(entity, def) {
  return String(entityValue(entity, "stage", def));
}
function dealOutcome(entity, def) {
  return stageOutcome(dealStage(entity, def));
}
function closedPatch(before, after, now) {
  const first = (v) => Array.isArray(v) ? v[0] : v;
  const outcome = stageOutcome(first(after));
  return outcome !== "open" && outcome !== stageOutcome(first(before)) ? { closed: ymd(now) } : {};
}
function dealClosedAt(entity, def) {
  const closed = entityValue(entity, "closed", def);
  if (closed) {
    const d = parseYmd(closed) ?? new Date(closed);
    if (!isNaN(d.getTime())) return d;
  }
  const mtime = entity.file && entity.file.stat ? entity.file.stat.mtime : 0;
  return mtime ? new Date(mtime) : null;
}
function dealValue(entity, def) {
  return Number(entityValue(entity, "value", def)) || 0;
}
function sumValues(deals, def) {
  return deals.reduce((s, e) => s + dealValue(e, def), 0);
}
function crmSummary(deals, def) {
  const open = deals.filter((e) => dealOutcome(e, def) === "open");
  const won = deals.filter((e) => dealOutcome(e, def) === "won");
  const lost = deals.filter((e) => dealOutcome(e, def) === "lost");
  const wonValue = sumValues(won, def);
  return {
    open,
    won,
    lost,
    openValue: sumValues(open, def),
    wonValue,
    lostValue: sumValues(lost, def),
    winRate: won.length + lost.length === 0 ? 0 : Math.round(won.length / (won.length + lost.length) * 100),
    avgDeal: won.length === 0 ? 0 : wonValue / won.length
  };
}
var NO_STAGE = "(no stage)";
function dealsByStage(deals, def, stages) {
  const groups = stages.map((stage) => ({ stage, items: [] }));
  const byFold = /* @__PURE__ */ new Map();
  groups.forEach((g) => {
    if (!byFold.has(foldStage(g.stage))) byFold.set(foldStage(g.stage), g);
  });
  const byOutcome = /* @__PURE__ */ new Map();
  groups.forEach((g) => {
    const outcome = stageOutcome(g.stage);
    if (outcome !== "open" && !byOutcome.has(outcome)) byOutcome.set(outcome, g);
  });
  const offList = [];
  const noStage = { stage: NO_STAGE, items: [] };
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
  return [...groups, ...offList, ...noStage.items.length ? [noStage] : []];
}
var BUILT_IN_CONFIDENCE = { "lead": 0.1, "qualified": 0.25, "proposal": 0.5, "negotiation": 0.75 };
function stageConfidence(stages) {
  const open = stages.map(foldStage).filter((s) => s && stageOutcome(s) === "open");
  const anchors = [[-1, 0]];
  open.forEach((s, i) => {
    if (s in BUILT_IN_CONFIDENCE) anchors.push([i, BUILT_IN_CONFIDENCE[s]]);
  });
  anchors.push([open.length, 1]);
  const weights = new Map(Object.entries(BUILT_IN_CONFIDENCE));
  open.forEach((s, i) => {
    if (weights.has(s)) return;
    const before = anchors.filter(([at]) => at < i).pop();
    const after = anchors.find(([at]) => at > i);
    weights.set(s, before[1] + (after[1] - before[1]) * (i - before[0]) / (after[0] - before[0]));
  });
  return (stage) => weights.get(foldStage(stage)) ?? 0;
}
function linkedNames(value) {
  const seen = /* @__PURE__ */ new Set();
  return parseLinkValues(value).map((v) => v.target).filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function partnerResolver(partners, partnerDef) {
  const byName = /* @__PURE__ */ new Map();
  partners.forEach((p) => {
    const name = String(entityValue(p, "name", partnerDef) || "").trim().toLowerCase();
    if (name && !byName.has(name)) byName.set(name, p);
  });
  partners.forEach((p) => {
    const base = p.basename.toLowerCase();
    if (!byName.has(base)) byName.set(base, p);
  });
  return (deal, dealDef) => linkedNames(entityValue(deal, "partner", dealDef)).map((name) => {
    const partner = byName.get(name.toLowerCase()) || null;
    return partner ? { key: `partner:${partner.file.path}`, name: String(entityValue(partner, "name", partnerDef) || partner.basename), partner } : { key: `name:${name.toLowerCase()}`, name, partner: null };
  });
}

// src/views/crm-dashboard.ts
var DAY_MS = 864e5;
function crmStatCards(summary) {
  const { open, won, lost, winRate, avgDeal } = summary;
  return [
    { label: "OPEN PIPELINE", value: open.length, sub: fmtValue(summary.openValue, "currency"), accent: "sky" },
    { label: "WON", value: won.length, sub: fmtValue(summary.wonValue, "currency"), accent: "emerald" },
    { label: "LOST", value: lost.length, sub: fmtValue(summary.lostValue, "currency"), accent: "rose" },
    { label: "WIN RATE", value: `${winRate}%`, sub: `${won.length}/${won.length + lost.length} closed`, accent: "mint" },
    { label: "AVG DEAL", value: fmtValue(avgDeal, "currency"), sub: countLabel(won.length, "won deal"), accent: "warn" }
  ];
}
function pipelineByStage(deals, def, stages) {
  const stageData = dealsByStage(deals, def, stages).map(({ stage, items }) => ({ stage, count: items.length, value: sumValues(items, def) }));
  const maxStageVal = Math.max(1, ...stageData.map((s) => s.value));
  return stageData.map((s) => ({ ...s, width: `${s.value / maxStageVal * 100}%` }));
}
function dealTitle(entity, def) {
  return entityValue(entity, "title", def) || entity.basename;
}
function hotDeals(open, def) {
  return [...open].sort((a, b) => dealValue(b, def) - dealValue(a, def)).slice(0, 5).map((e) => ({
    title: dealTitle(e, def),
    meta: `${entityValue(e, "stage", def) || "\u2014"} \xB7 ${fmtValue(dealValue(e, def), "currency")}`,
    file: e.file
  }));
}
function staleDeals(open, def, now) {
  const staleCutoff = now - 14 * DAY_MS;
  return open.filter((e) => e.file && e.file.stat && e.file.stat.mtime < staleCutoff).sort((a, b) => (a.file.stat.mtime || 0) - (b.file.stat.mtime || 0)).slice(0, 5).map((e) => {
    const days = Math.round((now - e.file.stat.mtime) / DAY_MS);
    return {
      title: dealTitle(e, def),
      meta: `${entityValue(e, "stage", def) || "\u2014"} \xB7 ${days}d quiet \xB7 ${fmtValue(dealValue(e, def), "currency")}`,
      file: e.file
    };
  });
}
function recentActivities(activities, def) {
  return newestFirst(activities, (e) => entityValue(e, "when", def)).slice(0, 6).map((e) => {
    const typeVal = entityValue(e, "type", def) || "\u2014";
    const withVal = entityValue(e, "with", def) || "\u2014";
    const dateVal = fmtValue(entityValue(e, "when", def), "date");
    return {
      title: entityValue(e, "subject", def) || e.basename,
      metaParts: [
        { text: typeVal },
        { text: " \xB7 " },
        { text: withVal, entityKey: "contact" },
        { text: ` \xB7 ${dateVal}` }
      ],
      file: e.file
    };
  });
}
function customerBase(counts) {
  return {
    title: `CUSTOMER BASE \xB7 ${counts.contacts + counts.companies + counts.partners} records`,
    stats: [
      { label: "CONTACTS", value: counts.contacts, accent: "warn", mode: "crm.contacts" },
      { label: "COMPANIES", value: counts.companies, accent: "sky", mode: "crm.companies" },
      { label: "PARTNERS", value: counts.partners, accent: "rose", mode: "prm.partners" }
    ]
  };
}
async function renderCrmDashboard(view, root) {
  root.addClass("cadence-dashboard");
  const dealDef = ENTITIES.deal;
  const allDeals = listEntities(view.app, "deal");
  const summary = crmSummary(allDeals, dealDef);
  const contacts = listEntityFiles(view.app, "contact");
  const companies = listEntityFiles(view.app, "company");
  const partners = listEntityFiles(view.app, "partner");
  const activities = listEntities(view.app, "activity");
  view._renderPageHeader(root, "CRM Dashboard", "Pipeline \xB7 momentum \xB7 recent activity", (right2) => {
    const newDeal = right2.createEl("button", { cls: "cad-btn primary", text: "+ New Deal" });
    newDeal.addEventListener("click", () => view._createEntityFromPrompt("deal"));
  });
  const grid = root.createDiv({ cls: "cad-stat-grid" });
  const stat = (label, value, sub, accent) => {
    const c = grid.createDiv({ cls: "cad-stat-card" });
    if (accent) c.dataset.accent = accent;
    c.createDiv({ cls: "cad-stat-label", text: label });
    c.createDiv({ cls: "cad-stat-value", text: String(value) });
    if (sub) c.createDiv({ cls: "cad-stat-sub", text: sub });
  };
  crmStatCards(summary).forEach((card) => stat(card.label, card.value, card.sub, card.accent));
  root.createDiv({ cls: "cad-section-label-lg", text: "PIPELINE BY STAGE" });
  const stageWrap = root.createDiv({ cls: "cad-stage-bars" });
  pipelineByStage(allDeals, dealDef, getDealStages()).forEach(({ stage, count, value, width }) => {
    const row = stageWrap.createDiv({ cls: "cad-stage-bar-row" });
    row.dataset.stage = stage;
    row.createDiv({ cls: "cad-stage-bar-name", text: stage });
    row.createDiv({ cls: "cad-stage-bar-count", text: `${count}` });
    const barWrap = row.createDiv({ cls: "cad-stage-bar" });
    const fill = barWrap.createDiv({ cls: "cad-stage-bar-fill" });
    fill.style.width = width;
    row.createDiv({ cls: "cad-stage-bar-value", text: fmtValue(value, "currency") });
    row.addEventListener("click", () => {
      view.listFilter = stage === NO_STAGE ? null : { entityKey: "deal", key: "stage", value: stage };
      view.setMode("crm.pipeline");
    });
  });
  const cols = root.createDiv({ cls: "cad-dash-cols" });
  const left = cols.createDiv({ cls: "cad-dash-col" });
  const right = cols.createDiv({ cls: "cad-dash-col" });
  view._dashCardSection(left, "HOT DEALS \xB7 top 5 by value", hotDeals(summary.open, dealDef), "No open deals yet \u2014 hit + New Deal above.");
  view._dashCardSection(left, "STALE DEALS \xB7 14+ days no edits", staleDeals(summary.open, dealDef, Date.now()), "No stale deals \u2014 momentum is good.");
  const recentAct = recentActivities(activities, ENTITIES.activity);
  view._dashCardSection(right, `RECENT ACTIVITY \xB7 ${activities.length} total`, recentAct, "No activity logged yet. Capture a call or meeting under CRM > Activities.");
  const baseCard = right.createDiv({ cls: "cad-dash-card" });
  const base = customerBase({ contacts: contacts.length, companies: companies.length, partners: partners.length });
  baseCard.createDiv({ cls: "cad-dash-card-head" }).createDiv({ cls: "cad-dash-card-title", text: base.title });
  const baseBody = baseCard.createDiv({ cls: "cad-dash-card-body cad-mini-stat-row" });
  const mkMini = (label, val, accent, mode) => {
    const c = baseBody.createDiv({ cls: "cad-mini-stat" });
    if (accent) c.dataset.accent = accent;
    c.createDiv({ cls: "cad-mini-stat-value", text: String(val) });
    c.createDiv({ cls: "cad-mini-stat-label", text: label });
    if (mode) {
      c.style.cursor = "pointer";
      c.addEventListener("click", () => view.setMode(mode));
    }
  };
  base.stats.forEach((mini) => mkMini(mini.label, mini.value, mini.accent, mini.mode));
  const analyticsHeader = root.createDiv({ attr: { style: "display: flex; justify-content: space-between; align-items: center; padding: 24px 32px 8px 32px; margin-bottom: 16px;" } });
  analyticsHeader.createEl("span", {
    cls: "cad-section-label-lg",
    text: "ANALYTICS & CHARTS",
    attr: { style: "padding: 0; margin: 0; display: inline-block;" }
  });
  const addWidgetBtn = analyticsHeader.createEl("button", { cls: "cad-btn primary", text: "+ Add Custom Chart" });
  const widgetsGrid = root.createDiv({ cls: "cad-dash-cols", attr: { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-bottom: 24px; padding: 0 32px;" } });
  const renderWidgets = () => {
    widgetsGrid.empty();
    const widgets = dashboardWidgets(view.plugin.settings, "crmDashboardWidgets");
    if (widgets.length === 0) {
      const emptyWrap = widgetsGrid.createDiv({ attr: { style: "grid-column: 1 / -1; text-align: center; padding: 32px; background: var(--background-secondary); border-radius: 8px; border: 1px dashed var(--border-color);" } });
      emptyWrap.createDiv({ text: 'No custom charts added yet. Click "+ Add Custom Chart" to create one!', attr: { style: "color: var(--text-muted); font-size: 0.95em;" } });
      return;
    }
    widgets.forEach((w) => {
      const card = widgetsGrid.createDiv({ cls: "cad-dash-card", attr: { style: "margin: 0; display: flex; flex-direction: column;" } });
      const head = card.createDiv({ cls: "cad-dash-card-head", attr: { style: "display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;" } });
      head.createDiv({ cls: "cad-dash-card-title", text: widgetTitle(w).toUpperCase(), attr: { style: "font-weight: 700; font-size: 0.75rem; letter-spacing: 0.12em;" } });
      const actionsWrap = head.createDiv({ attr: { style: "display: flex; gap: 8px; align-items: center;" } });
      const styleSelect = actionsWrap.createEl("select", { cls: "cad-prop-input" });
      styleSelect.style.padding = "2px 4px";
      styleSelect.style.fontSize = "0.8em";
      styleSelect.style.height = "auto";
      styleSelect.style.width = "auto";
      styleSelect.style.background = "var(--background-primary)";
      styleSelect.style.color = "var(--text-normal)";
      styleSelect.style.border = "1px solid var(--border-color)";
      styleSelect.style.borderRadius = "4px";
      WIDGET_STYLE_OPTIONS.forEach((opt) => {
        const o = styleSelect.createEl("option", { value: opt.value, text: opt.label });
        if (w.style === opt.value) o.selected = true;
      });
      styleSelect.addEventListener("change", async () => {
        w.style = styleSelect.value;
        await view.plugin.saveSettings();
        view.render();
      });
      const delBtn = actionsWrap.createEl("button", {
        cls: "cad-btn",
        text: "\xD7",
        attr: { style: "color: var(--text-error); padding: 2px 8px; font-weight: bold; border-color: var(--text-error); font-size: 1.1em; height: auto; border-radius: 4px; background: transparent;" }
      });
      delBtn.addEventListener("click", async () => {
        if (!confirm(`Delete chart "${widgetTitle(w)}"?`)) return;
        view.plugin.settings.crmDashboardWidgets = removeWidget(view.plugin.settings.crmDashboardWidgets, w.id);
        await view.plugin.saveSettings();
        view.render();
      });
      const body = card.createDiv({ cls: "cad-dash-card-body", attr: { style: "flex: 1; min-height: 180px; display: flex; flex-direction: column; justify-content: center; padding: 14px;" } });
      view._drawChart(body.createDiv(), w.style, chartData(allDeals, w, dealDef));
    });
  };
  addWidgetBtn.addEventListener("click", () => {
    new CadenceWidgetCreateModal(view.app, "deal", async (newWidget) => {
      if (!view.plugin.settings.crmDashboardWidgets) {
        view.plugin.settings.crmDashboardWidgets = [];
      }
      view.plugin.settings.crmDashboardWidgets.push(newWidget);
      await view.plugin.saveSettings();
      view.render();
    }).open();
  });
  renderWidgets();
}

// src/views/entity-detail.ts
var import_obsidian18 = require("obsidian");
function entityDetailTitle(fm, primaryKey, basename) {
  return fm[primaryKey] != null && fm[primaryKey] !== "" ? fm[primaryKey] : basename;
}
function detailFields(def) {
  return def.fields.filter((f) => !(f.key === "type" && f.type !== "enum"));
}
function detailControl(f) {
  const fieldType = f.type || "text";
  if (fieldType === "enum") return "enum";
  if (fieldType === "date") return "date";
  if (fieldType === "number" || fieldType === "currency") return "number";
  if (fieldType === "email") return f.isList === true ? "chips" : "email";
  return isChipField(f) ? "chips" : "text";
}
async function renderEntityDetail(view, root, entityKey, file) {
  if (entityKey === "project") return view.renderProjectDetail(root, file);
  if (entityKey === "company") return view.renderCompanyDetail(root, file);
  root.addClass("cadence-detail");
  const def = ENTITIES[entityKey];
  if (!def || !file) {
    view.closeEntityDetail();
    return;
  }
  const cache = view.app.metadataCache.getFileCache(file) || {};
  const fm = Object.assign({}, cache.frontmatter || {});
  const primaryKey = def.fields[0].key;
  const titleVal = entityDetailTitle(fm, primaryKey, file.basename);
  const head = root.createDiv({ cls: "cad-detail-header" });
  const headLeft = head.createDiv({ cls: "cad-detail-header-left" });
  const back = headLeft.createEl("button", { cls: "cad-btn cad-detail-back", text: "\u2190 " + def.plural });
  back.addEventListener("click", () => view.closeEntityDetail());
  const breadcrumb = headLeft.createDiv({ cls: "cad-detail-breadcrumb" });
  breadcrumb.createSpan({ cls: "cad-eyebrow", text: def.plural.toUpperCase() });
  breadcrumb.createSpan({ cls: "cad-detail-title", text: String(titleVal) });
  breadcrumb.createDiv({ cls: "cad-detail-path", text: file.path });
  const headRight = head.createDiv({ cls: "cad-detail-header-right" });
  const savedBadge = headRight.createSpan({ cls: "cad-detail-saved", text: "" });
  const openNote = headRight.createEl("button", { cls: "cad-btn", text: "Open as note" });
  openNote.addEventListener("click", () => view.app.workspace.openLinkText(file.path, "", false));
  const deleteBtn = headRight.createEl("button", { cls: "cad-btn cad-btn-danger", text: "Delete" });
  deleteBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    new CadenceConfirmModal(view.app, {
      title: `Delete ${def.label}`,
      message: `Delete this ${def.label.toLowerCase()}? This moves the file to trash.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        deleteBtn.blur();
        setTimeout(async () => {
          try {
            await view.app.vault.trash(file, true);
            new import_obsidian18.Notice(`Deleted ${def.label}: ${file.basename}`);
            view.closeEntityDetail();
          } catch (e) {
            new import_obsidian18.Notice(`Delete failed: ${e.message}`);
          }
        }, 50);
      }
    }).open();
  });
  const form = root.createDiv({ cls: "cad-detail-form" });
  let saveTimer = null;
  const flashSaved = () => {
    savedBadge.setText("Saved");
    savedBadge.addClass("show");
    clearTimeout(savedBadge._t);
    savedBadge._t = setTimeout(() => savedBadge.removeClass("show"), 1400);
  };
  const writeField = async (key, raw) => {
    try {
      const value = coerceFieldEdit(def, key, raw);
      await view.app.fileManager.processFrontMatter(file, (frontmatter) => {
        const before = frontmatter[key];
        applyFieldEdit(frontmatter, key, value);
        if (entityKey === "deal" && key === "stage") Object.assign(frontmatter, closedPatch(before, frontmatter[key], /* @__PURE__ */ new Date()));
      });
      flashSaved();
    } catch (e) {
      new import_obsidian18.Notice(`Save failed: ${e.message}`);
    }
  };
  const debouncedWrite = (key, val) => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => writeField(key, val), 350);
  };
  detailFields(def).forEach((f) => {
    const row = form.createDiv({ cls: "cad-form-row" });
    row.createDiv({ cls: "cad-form-label", text: f.label.toUpperCase() });
    const current = fm[f.key];
    const fieldType = f.type || "text";
    const control = detailControl(f);
    if (control === "enum") {
      const sel = row.createEl("select", { cls: "cad-form-input" });
      sel.createEl("option", { value: "", text: "\u2014" });
      const stored = enumCurrent(current);
      withStoredOption(f.options || [], stored).forEach((opt) => {
        const o = sel.createEl("option", { value: opt, text: opt });
        if (stored === opt) o.selected = true;
      });
      sel.addEventListener("change", () => writeField(f.key, sel.value));
    } else if (control === "date") {
      const inp = row.createEl("input", { type: "date", cls: "cad-form-input" });
      if (current) {
        const date = dateInputValue(current);
        if (date !== null) inp.value = date;
      }
      inp.addEventListener("change", () => writeField(f.key, inp.value));
    } else if (control === "number") {
      const inp = row.createEl("input", { type: "number", cls: "cad-form-input" });
      if (current != null) inp.value = String(current);
      if (fieldType === "currency") inp.placeholder = `${view.plugin.settings.currency || "USD"} amount`;
      inp.addEventListener("input", () => debouncedWrite(f.key, inp.value));
      inp.addEventListener("blur", () => writeField(f.key, inp.value));
    } else if (control === "email") {
      const inp = row.createEl("input", { type: "email", cls: "cad-form-input" });
      if (current) inp.value = String(current);
      inp.addEventListener("input", () => debouncedWrite(f.key, inp.value));
      inp.addEventListener("blur", () => writeField(f.key, inp.value));
    } else {
      if (control === "chips") {
        row.style.position = "relative";
        view._renderChipInput(row, f, fm[f.key], {
          listKeys: DETAIL_LIST_KEYS,
          layout: "form",
          save: (value) => writeField(f.key, value)
        });
      } else {
        const inp = row.createEl("input", { type: "text", cls: "cad-form-input" });
        if (current) inp.value = String(current);
        if (f.key === primaryKey) inp.placeholder = `${def.label} name`;
        inp.addEventListener("input", () => debouncedWrite(f.key, inp.value));
        inp.addEventListener("blur", () => writeField(f.key, inp.value));
      }
    }
  });
  const content = await view.app.vault.read(file);
  const sections = parseH2Sections(content);
  const sectionKeys = Object.keys(sections);
  if (sectionKeys.length > 0) {
    const sectionsHeader = root.createDiv({ cls: "cad-section-label-lg", text: "NOTE SECTIONS" });
    sectionsHeader.style.marginTop = "24px";
    sectionsHeader.style.marginBottom = "12px";
    const sectionsGrid = root.createDiv({ cls: "cad-pd-cols" });
    sectionsGrid.style.display = "grid";
    sectionsGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(350px, 1fr))";
    sectionsGrid.style.gap = "16px";
    sectionsGrid.style.marginBottom = "24px";
    sectionKeys.forEach((key) => {
      view._renderDynamicH2Section(sectionsGrid, file, sections, key, flashSaved);
    });
  }
  view._renderCrossSections(root, entityKey, titleVal);
}

// src/views/entity-list.ts
var import_obsidian19 = require("obsidian");

// src/views/kanban.ts
function unwrapLink(value) {
  return String(value).trim().replace(/^\[\[|\]\]$/g, "").trim();
}
function isRelationField(f) {
  return !["none", "tags", "history"].includes(getFieldSuggestionSource(f));
}
function kanbanGroupBy(entityKey, def, saved) {
  const offered = kanbanGroupByFields(def);
  if (saved && offered.some((f) => f.key === saved)) return saved;
  if (entityKey === "deal" && offered.some((f) => f.key === "stage")) return "stage";
  const typed = offered.find((f) => f.type === "enum" || f.type === "text");
  return (typed || offered[0])?.key ?? "";
}
function kanbanOptions(def, groupBy) {
  const f = def.fields.find((field) => field.key === groupBy);
  return f ? f.options || [] : [];
}
function distinctGroups(entities, groupBy, def) {
  const uniqueVals = /* @__PURE__ */ new Set();
  entities.forEach((e) => {
    kanbanValues(entityValue(e, groupBy, def)).forEach((v) => uniqueVals.add(v));
  });
  return Array.from(uniqueVals);
}
function getEntityKanbanParams(view, entityKey) {
  const def = ENTITIES[entityKey];
  if (!def) return { groupBy: "status", groups: ["Active", "Done"] };
  const groupBy = kanbanGroupBy(entityKey, def, view.plugin.settings.pageKanbanGroupBy?.[entityKey]);
  let groups = kanbanOptions(def, groupBy);
  if (groupBy && !groups.length) groups = distinctGroups(listEntities(view.app, entityKey), groupBy, def);
  return { groupBy, groups };
}
function kanbanGroupByFields(def) {
  return def.fields.filter((field) => !field.primary && (["enum", "text", "multitext", "tags"].includes(field.type) || isRelationField(field)));
}
function kanbanValues(val) {
  if (val == null || val === "") return [];
  const parts = Array.isArray(val) ? val : String(val).split(/,(?![^[]*\]\])/);
  return parts.map(unwrapLink).filter(Boolean);
}
function kanbanGroups(list, groupBy, groups, def) {
  const columns = groups.map((stage) => ({ stage, items: [] }));
  const byValue = /* @__PURE__ */ new Map();
  columns.forEach((c) => {
    if (!byValue.has(c.stage.toLowerCase())) byValue.set(c.stage.toLowerCase(), c);
  });
  const field = def.fields.find((f) => f.key === groupBy);
  const blank = { stage: `(no ${(field ? field.label : groupBy || "group").toLowerCase()})`, items: [], blank: true };
  list.forEach((e) => {
    const values = groupBy ? kanbanValues(entityValue(e, groupBy, def)) : [];
    if (!values.length) {
      blank.items.push(e);
      return;
    }
    const value = values.find((v) => byValue.has(v.toLowerCase())) ?? values[0];
    let col = byValue.get(value.toLowerCase());
    if (!col) {
      col = { stage: value, items: [] };
      columns.push(col);
      byValue.set(value.toLowerCase(), col);
    }
    col.items.push(e);
  });
  return blank.items.length ? [...columns, blank] : columns;
}
function kanbanValueField(def) {
  return def.fields.find((f) => f.type === "currency" || f.type === "number");
}
function kanbanColumnMeta(items, def) {
  const valueField = kanbanValueField(def);
  if (valueField) {
    const sum = items.reduce((s, e) => s + (Number(entityValue(e, valueField.key, def)) || 0), 0);
    return `${items.length} \xB7 ${fmtValue(sum, valueField.type)}`;
  }
  return `${items.length}`;
}
function kanbanDropValue(fDef, stage) {
  const isList = fDef && (fDef.type === "multitext" || fDef.type === "tags" || fDef.isList === true || fDef.key === "stage");
  const isLink = fDef && isRelationField(fDef);
  if (isList) {
    return isLink ? [`[[${stage}]]`] : [stage];
  }
  return isLink ? `[[${stage}]]` : stage;
}
function kanbanCardLinks(e, def) {
  const relFields = ["company", "contact", "owner", "assigned"];
  return relFields.flatMap((rf) => {
    const rfDef = def.fields.find((f) => f.key === rf);
    if (!rfDef) return [];
    return parseLinkValues(entityValue(e, rf, def)).map((v) => ({
      display: v.display,
      target: v.target,
      entityKey: rf === "owner" || rf === "assigned" ? "contact" : rf
    }));
  });
}

// src/views/entity-list.ts
var LIST_LAYOUTS = ["table", "kanban", "cards"];
function listLayout(mode, pageLayouts) {
  const saved = pageLayouts?.[mode];
  if (saved && LIST_LAYOUTS.includes(saved)) return saved;
  return mode === "projects.projects" ? "cards" : mode === "crm.pipeline" ? "kanban" : "table";
}
function listSubtitle(count, def) {
  return `${count} ${count === 1 ? def.label.toLowerCase() : def.plural.toLowerCase()} in ${def.folder}`;
}
function filterableKeys(def) {
  return def.fields.map((f) => f.key).filter((k) => {
    const fdef = def.fields.find((f) => f.key === k);
    return !!fdef && (fdef.type === "enum" || ["company", "role", "with", "related", "status", "tier", "type"].includes(k));
  });
}
function filterValue(e, k, def) {
  const raw = e.frontmatter?.[k];
  return raw == null || raw === "" ? "" : entityValue(e, k, def);
}
function filterOptions(entities, def) {
  return filterableKeys(def).flatMap((k) => {
    const fdef = def.fields.find((f) => f.key === k);
    if (!fdef) return [];
    const uniqueVals = /* @__PURE__ */ new Map();
    entities.forEach((e) => {
      const val = filterValue(e, k, def);
      (Array.isArray(val) ? val : [val]).forEach((v) => {
        if (v == null || v === "") return;
        const clean = unwrapLink(v);
        if (clean && !uniqueVals.has(clean.toLowerCase())) uniqueVals.set(clean.toLowerCase(), clean);
      });
    });
    if (uniqueVals.size === 0) return [];
    const values = Array.from(uniqueVals.values()).sort((a, b) => a.localeCompare(b, void 0, { numeric: true, sensitivity: "base" }));
    return [{ field: fdef, values }];
  });
}
function listColumns(def, columns) {
  const baseCols = columns || def.columns;
  const cols = baseCols.map((k) => def.fields.find((f) => f.key === k)).filter(Boolean);
  if (columns) return cols;
  def.fields.forEach((f) => {
    if (!baseCols.includes(f.key) && !cols.some((c) => c.key === f.key)) {
      cols.push(f);
    }
  });
  return cols;
}
function filterEntities(list, def, cols, query) {
  const searchVal = query.search;
  return list.filter((e) => {
    if (searchVal) {
      const match = cols.some((f) => {
        const val = entityValue(e, f.key, def);
        if (val == null) return false;
        return String(val).toLowerCase().includes(searchVal);
      }) || e.basename.toLowerCase().includes(searchVal);
      if (!match) return false;
    }
    for (const [k, filterVal] of Object.entries(query.filters)) {
      if (!filterVal) continue;
      const val = filterValue(e, k, def);
      if (Array.isArray(val)) {
        const cleanVals = val.map((v) => unwrapLink(v).toLowerCase());
        if (!cleanVals.includes(filterVal.toLowerCase())) return false;
      } else {
        const cleanVal = unwrapLink(val || "").toLowerCase();
        if (cleanVal !== filterVal.toLowerCase()) return false;
      }
    }
    return true;
  });
}
function sortEntities(list, def, sort) {
  const sorted = list.slice();
  const currentSortField = sort.field;
  if (currentSortField) {
    const fdef = def.fields.find((f) => f.key === currentSortField);
    const ftype = fdef ? fdef.type : "text";
    sorted.sort((a, b) => {
      let valA = entityValue(a, currentSortField, def);
      let valB = entityValue(b, currentSortField, def);
      if (valA && typeof valA === "string") valA = unwrapLink(valA);
      if (valB && typeof valB === "string") valB = unwrapLink(valB);
      if (Array.isArray(valA)) valA = valA.map(unwrapLink).join(", ");
      if (Array.isArray(valB)) valB = valB.map(unwrapLink).join(", ");
      if (valA == null) valA = "";
      if (valB == null) valB = "";
      let diff = 0;
      if (ftype === "number" || ftype === "currency") {
        diff = Number(valA) - Number(valB);
      } else if (ftype === "date") {
        const dateA = new Date(valA).getTime() || 0;
        const dateB = new Date(valB).getTime() || 0;
        diff = dateA - dateB;
      } else {
        diff = String(valA).localeCompare(String(valB), void 0, { numeric: true, sensitivity: "base" });
      }
      return sort.asc ? diff : -diff;
    });
  }
  return sorted;
}
function nextSort(sort, key) {
  return sort.field === key ? { field: key, asc: !sort.asc } : { field: key, asc: true };
}
function primaryField(def) {
  return def.fields.find((f) => f.primary) || def.fields[0];
}
function tableCell(f) {
  if (f.key === "owner" || f.key === "assigned") return { kind: "owner" };
  const sugSrc = f.suggestionSource || getFieldSuggestionSource(f);
  if (f.type === "multitext" && sugSrc && sugSrc !== "none" && sugSrc !== "tags" && sugSrc !== "history") {
    return { kind: "links", target: sugSrc };
  }
  if (f.key === "company") return { kind: "links", target: "company" };
  if (f.key === "partner") return { kind: "links", target: "partner" };
  if (f.key === "contact" || f.key === "contacts" || f.key === "with") return { kind: "links", target: "contact" };
  if (f.key === "related") return { kind: "links", target: "project" };
  return { kind: "text" };
}
function cardStatusField(def) {
  return ["status", "type", "tier"].map((k) => def.fields.find((f) => f.key === k)).find(Boolean) || def.fields.find((f) => f.type === "enum");
}
function pillText(val) {
  const clean = Array.isArray(val) ? val[0] : val;
  return String(clean);
}
function pillClass(text) {
  return `cad-pill-${text.toLowerCase().replace(/\s+/g, "-")}`;
}
function cardMetaRows(e, def, primary, statusField) {
  const rows = [];
  def.fields.forEach((f) => {
    if (f.key !== primary.key && (!statusField || f.key !== statusField.key) && rows.length < 4) {
      const val = entityValue(e, f.key, def);
      if (val != null && val !== "") {
        const isLinkProperty = f.key === "company" || f.key === "contact" || f.key === "partner" || f.key === "owner" || f.key === "project" || !!f.suggestionSource && f.suggestionSource.startsWith("folder:");
        rows.push({ field: f, value: val, isLink: isLinkProperty });
      }
    }
  });
  return rows;
}
function cardLinkEntityKey(f, entities) {
  let relatedKey = f.key === "owner" ? "contact" : f.key;
  if (f.suggestionSource && f.suggestionSource.startsWith("folder:")) {
    const folder = f.suggestionSource.replace("folder:", "").split("/").pop().toLowerCase();
    const found = Object.keys(entities).find((k) => entities[k].folder.toLowerCase().endsWith(folder) || entities[k].plural.toLowerCase() === folder);
    if (found) relatedKey = found;
  }
  return relatedKey;
}
async function renderEntityList(view, root, entityKey, opts = {}) {
  root.addClass("cadence-list");
  const def = ENTITIES[entityKey];
  if (!def) {
    view.renderComingSoon(root, view._resolveSurface(view.mode));
    return;
  }
  const entities = listEntities(view.app, entityKey);
  const filtered = opts.filter ? entities.filter(opts.filter) : entities;
  const mode = view.mode;
  const layout = listLayout(mode, view.plugin.settings.pageLayouts);
  view._renderPageHeader(root, opts.title || def.plural, listSubtitle(filtered.length, def), (right) => {
    const switcher = right.createDiv({ cls: "cad-layout-switcher" });
    switcher.style.display = "inline-flex";
    switcher.style.gap = "4px";
    switcher.style.marginRight = "12px";
    switcher.style.border = "1px solid var(--border-color)";
    switcher.style.borderRadius = "6px";
    switcher.style.overflow = "hidden";
    switcher.style.padding = "2px";
    switcher.style.background = "var(--background-secondary)";
    const layouts = [
      { key: "table", icon: "layout-list", title: "Table view" },
      { key: "kanban", icon: "kanban", title: "Kanban board" },
      { key: "cards", icon: "layout-grid", title: "Card grid" }
    ];
    layouts.forEach((l) => {
      const btn2 = switcher.createEl("button", { cls: "cad-topbar-icon-btn" });
      btn2.style.padding = "4px 8px";
      btn2.style.height = "auto";
      btn2.style.border = "none";
      btn2.style.background = layout === l.key ? "var(--background-modifier-border)" : "transparent";
      btn2.style.borderRadius = "4px";
      btn2.style.cursor = "pointer";
      try {
        (0, import_obsidian19.setIcon)(btn2, l.icon);
      } catch (_) {
      }
      btn2.title = l.title;
      btn2.addEventListener("click", async (e) => {
        e.preventDefault();
        if (!view.plugin.settings.pageLayouts) view.plugin.settings.pageLayouts = {};
        view.plugin.settings.pageLayouts[mode] = l.key;
        await view.plugin.saveSettings();
        view.render();
      });
    });
    const importBtn = right.createEl("button", { cls: "cad-btn", text: "Import CSV" });
    importBtn.addEventListener("click", () => new CadenceImportModal(view.app, { entityKey }).open());
    const btn = right.createEl("button", { cls: "cad-btn primary", text: `+ New ${def.label}` });
    btn.addEventListener("click", () => view._createEntityFromPrompt(entityKey));
  });
  const pending = view.listFilter && view.listFilter.entityKey === entityKey ? view.listFilter : null;
  if (pending) view.listFilter = null;
  if (!filtered.length) {
    const empty = root.createDiv({ cls: "cad-empty-state" });
    empty.createDiv({ cls: "cad-empty-state-title", text: `No ${def.plural.toLowerCase()} yet` });
    empty.createDiv({ cls: "cad-empty-state-desc", text: `Drop a markdown note in ${def.folder}/ with frontmatter, or hit "+ New" above.` });
    return;
  }
  const controls = root.createDiv({ cls: "cad-list-controls" });
  controls.style.display = "flex";
  controls.style.gap = "12px";
  controls.style.alignItems = "center";
  controls.style.marginBottom = "16px";
  controls.style.flexWrap = "wrap";
  const searchWrap = controls.createDiv({ cls: "cad-search-wrap" });
  searchWrap.style.display = "flex";
  searchWrap.style.alignItems = "center";
  searchWrap.style.gap = "6px";
  searchWrap.style.flex = "1";
  searchWrap.style.minWidth = "200px";
  const searchInput = searchWrap.createEl("input", {
    type: "text",
    cls: "cad-pd-meta-input",
    placeholder: `Search ${def.plural.toLowerCase()}...`
  });
  searchInput.style.width = "100%";
  searchInput.style.margin = "0";
  const kanbanParams = layout === "kanban" ? view.getEntityKanbanParams(entityKey) : null;
  if (kanbanParams) {
    const kanbanFields = kanbanGroupByFields(def);
    if (kanbanFields.length > 0) {
      const groupSelectWrap = controls.createDiv({ attr: { style: "display: inline-flex; align-items: center; gap: 6px; margin-left: auto;" } });
      groupSelectWrap.createSpan({ text: "Group columns by:", attr: { style: "font-size: 0.85em; color: var(--text-muted); font-weight: 600;" } });
      const groupSelect = groupSelectWrap.createEl("select", { cls: "cad-prop-input" });
      groupSelect.style.padding = "6px 10px";
      groupSelect.style.height = "auto";
      groupSelect.style.width = "auto";
      groupSelect.style.background = "var(--background-secondary)";
      groupSelect.style.color = "var(--text-normal)";
      groupSelect.style.border = "1px solid var(--border-color)";
      groupSelect.style.borderRadius = "6px";
      kanbanFields.forEach((f) => {
        const optEl = groupSelect.createEl("option", { value: f.key, text: f.label });
        if (kanbanParams.groupBy === f.key) optEl.selected = true;
      });
      groupSelect.addEventListener("change", async () => {
        if (!view.plugin.settings.pageKanbanGroupBy) view.plugin.settings.pageKanbanGroupBy = {};
        view.plugin.settings.pageKanbanGroupBy[entityKey] = groupSelect.value;
        await view.plugin.saveSettings();
        view.render();
      });
    }
  }
  const query = { search: "", filters: {} };
  let sort = { field: (opts.columns || def.columns)[0] || "", asc: true };
  filterOptions(filtered, def).forEach(({ field: fdef, values }) => {
    const k = fdef.key;
    const filterWrap = controls.createDiv({ cls: "cad-filter-select-wrap" });
    filterWrap.style.display = "flex";
    filterWrap.style.alignItems = "center";
    filterWrap.style.gap = "6px";
    const sel = filterWrap.createEl("select", { cls: "cad-pd-meta-input" });
    sel.style.margin = "0";
    sel.style.padding = "4px 8px";
    sel.style.minHeight = "30px";
    sel.style.border = "1px solid var(--border-color)";
    sel.style.borderRadius = "4px";
    sel.createEl("option", { value: "", text: `All ${pluralize(fdef.label)}` });
    values.forEach((v) => {
      sel.createEl("option", { value: v, text: v });
    });
    const start = pending && pending.key === k ? values.find((v) => v.toLowerCase() === pending.value.toLowerCase()) : void 0;
    if (start) {
      sel.value = start;
      query.filters[k] = start;
    }
    sel.addEventListener("change", () => {
      query.filters[k] = sel.value;
      renderContent();
    });
  });
  const cols = listColumns(def, opts.columns);
  const tableWrap = root.createDiv({ cls: "cad-table-wrap" });
  const kanbanWrap = root.createDiv({ cls: "cad-kanban-board-wrap" });
  const cardsWrap = root.createDiv({ cls: "cad-proj-grid-wrap" });
  const renderContent = async () => {
    tableWrap.style.display = "none";
    tableWrap.empty();
    kanbanWrap.style.display = "none";
    kanbanWrap.empty();
    cardsWrap.style.display = "none";
    cardsWrap.empty();
    const displayed = sortEntities(filterEntities(filtered, def, def.fields, query), def, sort);
    if (layout === "table") {
      tableWrap.style.display = "block";
      const table = tableWrap.createEl("table", { cls: "cad-table" });
      const thead = table.createEl("thead");
      const trh = thead.createEl("tr");
      const headers = [];
      cols.forEach((f) => {
        const th = trh.createEl("th");
        th.style.cursor = "pointer";
        th.style.userSelect = "none";
        const thSpan = th.createSpan({ text: f.label + " " });
        const indicator = th.createSpan({ text: f.key === sort.field ? sort.asc ? "\u25B2" : "\u25BC" : "\u2195" });
        indicator.style.opacity = f.key === sort.field ? "1" : "0.4";
        indicator.style.marginLeft = "4px";
        headers.push({ key: f.key, th, indicator });
        th.addEventListener("click", () => {
          sort = nextSort(sort, f.key);
          renderContent();
        });
      });
      const tbody = table.createEl("tbody");
      if (displayed.length === 0) {
        const tr = tbody.createEl("tr");
        const td = tr.createEl("td", { text: "No matching entries found." });
        td.colSpan = cols.length;
        td.style.textAlign = "center";
        td.style.color = "var(--text-muted)";
        td.style.padding = "20px";
      } else {
        displayed.forEach((e) => {
          const tr = tbody.createEl("tr", { cls: "cad-row" });
          cols.forEach((f, i) => {
            const td = tr.createEl("td");
            const val = entityValue(e, f.key, def);
            const formatted = fmtValue(val, f.type);
            const primary = primaryField(def);
            const hasPrimaryCol = cols.some((c) => c.key === primary.key);
            const isPrimaryCol = hasPrimaryCol ? f.key === primary.key : i === 0;
            if (isPrimaryCol) {
              const a = td.createEl("a", { cls: "cad-row-primary", text: formatted || e.basename });
              a.addEventListener("click", (ev) => {
                ev.preventDefault();
                view.openEntityDetail(entityKey, e.file);
              });
            } else {
              const cell = tableCell(f);
              if (cell.kind === "owner") view._renderOwnerLinks(td, val, false);
              else if (cell.kind === "links") view._renderEntityLinks(td, val, cell.target);
              else td.setText(formatted);
            }
          });
        });
      }
    } else if (kanbanParams) {
      kanbanWrap.style.display = "block";
      const { groupBy, groups } = kanbanParams;
      const board = kanbanWrap.createDiv({ cls: "cad-kanban-board" });
      const valueField = kanbanValueField(def);
      kanbanGroups(displayed, groupBy, groups, def).forEach(({ stage, items, blank }) => {
        const col = board.createDiv({ cls: "cad-kanban-col" });
        col.dataset.stage = stage;
        const head = col.createDiv({ cls: "cad-kanban-col-head" });
        head.createDiv({ cls: "cad-kanban-col-title", text: stage });
        head.createDiv({ cls: "cad-kanban-col-meta", text: kanbanColumnMeta(items, def) });
        const list = col.createDiv({ cls: "cad-kanban-col-list" });
        if (!blank) {
          list.addEventListener("dragover", (ev) => {
            ev.preventDefault();
            try {
              ev.dataTransfer.dropEffect = "move";
            } catch (_) {
            }
            col.addClass("drag-over");
          });
          list.addEventListener("dragleave", (ev) => {
            if (!col.contains(ev.relatedTarget)) col.removeClass("drag-over");
          });
          list.addEventListener("drop", async (ev) => {
            ev.preventDefault();
            col.removeClass("drag-over");
            const path = ev.dataTransfer.getData("text/cadence-entity");
            const fromStage = ev.dataTransfer.getData("text/cadence-stage");
            if (!path || fromStage === stage) return;
            const file = view.app.vault.getAbstractFileByPath(path);
            if (!file || !(file instanceof import_obsidian19.TFile)) return;
            try {
              await view.app.fileManager.processFrontMatter(file, (fm) => {
                const before = fm[groupBy];
                fm[groupBy] = kanbanDropValue(def.fields.find((fd) => fd.key === groupBy), stage);
                if (entityKey === "deal" && groupBy === "stage") Object.assign(fm, closedPatch(before, fm[groupBy], /* @__PURE__ */ new Date()));
              });
              new import_obsidian19.Notice(`Moved to ${stage}`);
            } catch (e) {
              new import_obsidian19.Notice(`Failed to move: ${e.message}`);
            }
          });
        }
        if (!items.length) {
          list.createDiv({ cls: "cad-empty", text: "\u2014" });
        } else {
          const isMobile = !!(import_obsidian19.Platform && import_obsidian19.Platform.isMobile);
          items.forEach((e) => {
            const card = list.createDiv({ cls: "cad-kanban-card" });
            card.dataset.path = e.file.path;
            card.createDiv({ cls: "cad-kanban-card-title", text: entityValue(e, primaryField(def).key, def) || e.basename });
            const meta = card.createDiv({ cls: "cad-kanban-card-meta" });
            if (valueField) {
              const val = entityValue(e, valueField.key, def);
              if (val) meta.createSpan({ text: fmtValue(val, valueField.type) });
            }
            kanbanCardLinks(e, def).forEach((v) => {
              meta.createSpan({ text: " \xB7 " });
              const link = meta.createEl("a", { text: v.display });
              link.style.textDecoration = "underline";
              link.style.cursor = "pointer";
              link.addEventListener("click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const targetFile = view.app.vault.getMarkdownFiles().find((f) => f.basename.toLowerCase() === v.target.toLowerCase());
                if (targetFile) view.openEntityDetail(v.entityKey, targetFile);
                else view.app.workspace.openLinkText(v.target, "", false);
              });
            });
            if (!isMobile) {
              card.draggable = true;
              card.addEventListener("dragstart", (ev) => {
                card.addClass("dragging");
                try {
                  ev.dataTransfer.effectAllowed = "move";
                  ev.dataTransfer.setData("text/cadence-entity", e.file.path);
                  ev.dataTransfer.setData("text/cadence-stage", stage);
                  ev.dataTransfer.setData("text/plain", `[[${e.file.basename}]]`);
                } catch (_) {
                }
              });
              card.addEventListener("dragend", () => card.removeClass("dragging"));
            } else {
              card.addClass("cad-kanban-card-touch");
            }
            card.addEventListener("click", () => view.openEntityDetail(entityKey, e.file));
          });
        }
      });
    } else if (layout === "cards") {
      cardsWrap.style.display = "block";
      const grid = cardsWrap.createDiv({ cls: "cad-proj-grid" });
      if (entityKey === "project") {
        const projects = await Promise.all(displayed.map(async (e) => {
          const meta = await readProjectMeta(view.app, e.file);
          return { entity: e, meta };
        }));
        projects.forEach((p) => {
          const card = grid.createDiv({ cls: "cad-proj-card" });
          const head = card.createDiv({ cls: "cad-proj-card-head" });
          const title = head.createEl("a", { cls: "cad-proj-title", text: entityValue(p.entity, "name", def) || p.entity.basename });
          title.addEventListener("click", (ev) => {
            ev.preventDefault();
            view.openEntityDetail("project", p.entity.file);
          });
          const status = String(entityValue(p.entity, "status", def) || "active");
          const priority = String(entityValue(p.entity, "priority", def) || "");
          const pillRow = head.createDiv({ cls: "cad-proj-pills" });
          pillRow.createSpan({ cls: `cad-pill ${pillClass(status)}`, text: status });
          if (priority) pillRow.createSpan({ cls: `cad-pill cad-pill-prio-${priority.toLowerCase()}`, text: priority });
          const metaRow = card.createDiv({ cls: "cad-proj-meta" });
          const owner = entityValue(p.entity, "owner", def);
          const due = entityValue(p.entity, "due", def);
          if (owner) view._renderOwnerLinks(metaRow, owner);
          if (due) metaRow.createSpan({ text: `Due: ${fmtValue(due, "date")}` });
          const progWrap = card.createDiv({ cls: "cad-proj-progress-wrap" });
          progWrap.dataset.pctBand = pctBand(p.meta.percent);
          const progLabel = progWrap.createDiv({ cls: "cad-proj-progress-label" });
          progLabel.createSpan({ text: `${p.meta.done}/${p.meta.total} milestones` });
          progLabel.createSpan({ cls: "cad-proj-progress-pct", text: `${p.meta.percent}%` });
          const bar = progWrap.createDiv({ cls: "cad-proj-progress-bar" });
          const fill = bar.createDiv({ cls: "cad-proj-progress-fill" });
          fill.style.width = `${p.meta.percent}%`;
          if (p.meta.next) {
            const nextRow = card.createDiv({ cls: "cad-proj-next" });
            nextRow.createSpan({ cls: "cad-proj-next-label", text: "NEXT \xB7 " });
            nextRow.createSpan({ cls: "cad-proj-next-date", text: fmtValue(p.meta.next.date, "date") });
            if (p.meta.next.title) nextRow.createSpan({ text: ` \u2014 ${p.meta.next.title}` });
          }
        });
      } else {
        displayed.forEach((e) => {
          const card = grid.createDiv({ cls: "cad-proj-card" });
          const head = card.createDiv({ cls: "cad-proj-card-head" });
          const primary = primaryField(def);
          const titleText = entityValue(e, primary.key, def) || e.basename;
          const title = head.createEl("a", { cls: "cad-proj-title", text: titleText });
          title.addEventListener("click", (ev) => {
            ev.preventDefault();
            view.openEntityDetail(entityKey, e.file);
          });
          const pillRow = head.createDiv({ cls: "cad-proj-pills" });
          const statusField = cardStatusField(def);
          if (statusField) {
            const val = entityValue(e, statusField.key, def);
            if (val) {
              const text = pillText(val);
              pillRow.createSpan({ cls: `cad-pill ${pillClass(text)}`, text });
            }
          }
          const metaRow = card.createDiv({ cls: "cad-proj-meta" });
          cardMetaRows(e, def, primary, statusField).forEach(({ field: f, value: val, isLink }) => {
            const formatted = fmtValue(val, f.type);
            const fieldDiv = metaRow.createDiv();
            fieldDiv.style.marginBottom = "2px";
            fieldDiv.createSpan({ text: `${f.label}: `, attr: { style: "font-weight: 500; color: var(--text-muted);" } });
            if (isLink) {
              const links = parseLinkValues(val);
              links.forEach((link, lidx) => {
                if (lidx > 0) fieldDiv.createSpan({ text: ", " });
                const aLink = fieldDiv.createEl("a", { text: link.display });
                aLink.style.textDecoration = "underline";
                aLink.style.cursor = "pointer";
                aLink.addEventListener("click", (ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  const targetFile = view.app.vault.getMarkdownFiles().find((f2) => f2.basename.toLowerCase() === link.target.toLowerCase());
                  const relatedKey = cardLinkEntityKey(f, ENTITIES);
                  if (targetFile) view.openEntityDetail(relatedKey, targetFile);
                  else view.app.workspace.openLinkText(link.target, "", false);
                });
              });
            } else {
              fieldDiv.createSpan({ text: formatted });
            }
          });
        });
      }
    }
  };
  searchInput.addEventListener("input", () => {
    query.search = searchInput.value.trim().toLowerCase();
    renderContent();
  });
  renderContent();
}

// src/views/home.ts
var import_obsidian21 = require("obsidian");

// src/modals/reminder-edit.ts
var import_obsidian20 = require("obsidian");
var BAD_TIME_MESSAGE = "Couldn't read that time, so nothing was saved. Fix it, or Clear it to unschedule.";
function buildReminderPatch(form, reminder) {
  const text = form.text.trim();
  if (!text) return null;
  let when = null;
  if (form.badInput) return "bad-time";
  if (form.datetimeValue) {
    const d = fromLocalDatetimeValue(form.datetimeValue);
    if (!d || isNaN(d.getTime())) return "bad-time";
    when = d.toISOString();
  }
  const fields = {
    text,
    notes: form.notes,
    repeat: form.repeat || "none",
    project: reminder.project || null,
    when
  };
  if (when !== (reminder.when || null)) fields.notified = false;
  return fields;
}
function filterReminderProjects(projects, query) {
  const q = (query || "").toLowerCase();
  return projects.filter((p) => p.name.toLowerCase().includes(q) || p.file.path.toLowerCase().includes(q));
}
var ReminderProjectSuggestModal = class extends import_obsidian20.SuggestModal {
  constructor(app, projs, onChoose) {
    super(app);
    this.projs = projs;
    this.onChoose = onChoose;
    this.setPlaceholder("Search projects to link this reminder to\u2026");
  }
  getSuggestions(query) {
    return filterReminderProjects(this.projs, query);
  }
  renderSuggestion(item, el) {
    el.setText("\u{1F4C1}  " + item.name);
  }
  onChooseSuggestion(item) {
    this.onChoose(item);
  }
};
var CadenceReminderEditModal = class extends import_obsidian20.Modal {
  constructor(app, plugin, reminder, opts) {
    super(app);
    this.plugin = plugin;
    this.reminder = reminder;
    this.project = reminder.project || null;
    this.isNew = opts && opts.isNew || false;
    this._submitted = false;
    this._busy = false;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("cad-create-modal");
    contentEl.addClass("cad-reminder-edit-modal");
    contentEl.createEl("h3", { cls: "cad-create-title", text: this.isNew ? "New reminder" : "Edit reminder" });
    const form = contentEl.createDiv({ cls: "cad-create-form" });
    const textRow = form.createDiv({ cls: "cad-create-row" });
    textRow.createDiv({ cls: "cad-create-label", text: "WHAT *" });
    const textInput = textRow.createEl("input", { type: "text", cls: "cad-create-input" });
    textInput.value = this.reminder.text || "";
    textInput.placeholder = "What needs doing?";
    const whenRow = form.createDiv({ cls: "cad-create-row" });
    whenRow.createDiv({ cls: "cad-create-label", text: "WHEN" });
    const whenWrap = whenRow.createDiv();
    whenWrap.style.display = "flex";
    whenWrap.style.gap = "8px";
    whenWrap.style.alignItems = "center";
    const dateInput = whenWrap.createEl("input", { type: "datetime-local", cls: "cad-create-input" });
    dateInput.style.flex = "1";
    if (this.reminder.when) {
      const d = new Date(this.reminder.when);
      if (!isNaN(d.getTime())) dateInput.value = toLocalDatetimeValue(d);
    }
    const clearBtn = whenWrap.createEl("button", { cls: "cad-btn cad-btn-sm", text: "Clear" });
    clearBtn.type = "button";
    clearBtn.title = "Move to unscheduled";
    clearBtn.addEventListener("click", () => {
      dateInput.value = "";
    });
    const repeatRow = form.createDiv({ cls: "cad-create-row" });
    repeatRow.createDiv({ cls: "cad-create-label", text: "REPEAT" });
    const repeatSel = repeatRow.createEl("select", { cls: "cad-create-input" });
    [["none", "No repeat"], ["daily", "Daily"], ["weekly", "Weekly"]].forEach(([v, l]) => {
      const o = repeatSel.createEl("option", { value: v, text: l });
      if (v === (this.reminder.repeat || "none")) o.selected = true;
    });
    const projectRow = form.createDiv({ cls: "cad-create-row" });
    projectRow.createDiv({ cls: "cad-create-label", text: "PROJECT" });
    const projectField = projectRow.createDiv({ cls: "cad-rem-project-field" });
    const renderProjectField = () => {
      projectField.empty();
      if (this.project) {
        const projectPath = this.project;
        const chip = projectField.createEl("a", { cls: "cad-rem-project-chip", text: "\u{1F4C1} " + (projectNameFromPath(this.app, projectPath) || "Project") });
        chip.title = "Open project (closes this modal)";
        chip.addEventListener("click", (e) => {
          e.preventDefault();
          const file = this.app.vault.getAbstractFileByPath(projectPath);
          if (!(file instanceof import_obsidian20.TFile)) {
            new import_obsidian20.Notice(`Project note not found: ${projectPath}`);
            return;
          }
          this._submitted = true;
          this.close();
          const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CADENCE_APP)[0];
          if (leaf && leaf.view && typeof leaf.view.openEntityDetail === "function") {
            leaf.view.openEntityDetail("project", file);
          } else {
            this.app.workspace.openLinkText(file.path, "", false);
          }
        });
        const changeBtn = projectField.createEl("button", { cls: "cad-btn cad-btn-sm", text: "Change" });
        changeBtn.type = "button";
        changeBtn.addEventListener("click", () => this._openReminderProjectPicker(renderProjectField));
        const removeBtn = projectField.createEl("button", { cls: "cad-btn cad-btn-sm cad-btn-danger", text: "Remove" });
        removeBtn.type = "button";
        removeBtn.addEventListener("click", () => {
          this.project = null;
          renderProjectField();
        });
      } else {
        const linkBtn = projectField.createEl("button", { cls: "cad-btn cad-btn-sm", text: "\u{1F4C1} Link to project" });
        linkBtn.type = "button";
        linkBtn.addEventListener("click", () => this._openReminderProjectPicker(renderProjectField));
      }
    };
    renderProjectField();
    const notesRow = form.createDiv({ cls: "cad-create-row" });
    notesRow.style.alignItems = "flex-start";
    notesRow.createDiv({ cls: "cad-create-label", text: "NOTES" });
    const notesArea = notesRow.createEl("textarea", { cls: "cad-create-input" });
    notesArea.rows = 6;
    notesArea.placeholder = "Context, follow-ups, what happened, related links\u2026";
    notesArea.value = this.reminder.notes || "";
    notesArea.style.resize = "vertical";
    notesArea.style.fontFamily = "inherit";
    const actions = contentEl.createDiv({ cls: "cad-create-actions" });
    if (!this.isNew) {
      const del = actions.createEl("button", { cls: "cad-btn cad-btn-danger", text: "Delete" });
      del.type = "button";
      del.style.marginRight = "auto";
      del.addEventListener("click", () => {
        if (this._busy) return;
        new CadenceConfirmModal(this.app, {
          title: "Delete reminder",
          message: "Delete this reminder?",
          confirmLabel: "Delete",
          onConfirm: async () => {
            if (this._busy) return;
            this._busy = true;
            try {
              await this.plugin.deleteReminder(this.reminder.id);
            } finally {
              this._busy = false;
            }
            this._submitted = true;
            this.close();
          }
        }).open();
      });
    }
    const cancel = actions.createEl("button", { cls: "cad-btn", text: "Cancel" });
    cancel.type = "button";
    cancel.addEventListener("click", () => this.close());
    const save = actions.createEl("button", { cls: "cad-btn primary", text: this.isNew ? "Create reminder" : "Save" });
    save.type = "button";
    const submit = async () => {
      if (this._busy || this._submitted) return;
      const fields = buildReminderPatch({
        text: textInput.value,
        notes: notesArea.value,
        repeat: repeatSel.value,
        datetimeValue: dateInput.value,
        badInput: dateInput.validity?.badInput
      }, { ...this.reminder, project: this.project });
      if (!fields) {
        textInput.focus();
        return;
      }
      if (fields === "bad-time") {
        new import_obsidian20.Notice(BAD_TIME_MESSAGE);
        dateInput.focus();
        return;
      }
      this._busy = true;
      try {
        if (this.isNew) {
          await this.plugin.addReminder(fields);
          new import_obsidian20.Notice(fields.when ? `Reminder set \xB7 ${reminderTimeStr(fields.when)}` : "Captured to Inbox");
        } else {
          await this.plugin.updateReminder(this.reminder.id, fields);
        }
      } finally {
        this._busy = false;
      }
      this._submitted = true;
      this.close();
    };
    save.addEventListener("click", submit);
    notesArea.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submit();
      }
      if (e.key === "Escape") this.close();
    });
    textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
      if (e.key === "Escape") this.close();
    });
    setTimeout(() => textInput.focus(), 0);
  }
  onClose() {
    this.contentEl.empty();
  }
  _openReminderProjectPicker(rerender) {
    const projectFiles = listEntityFiles(this.app, "project");
    if (!projectFiles.length) {
      new import_obsidian20.Notice("No projects yet. Create one in Planner \u2192 Projects first.");
      return;
    }
    const projects = projectFiles.map((f) => ({ file: f, name: projectNameFromPath(this.app, f.path) }));
    const picker = new ReminderProjectSuggestModal(this.app, projects, (item) => {
      this.project = item.file.path;
      rerender();
    });
    picker.open();
  }
};

// src/views/home.ts
async function renderHome(view, root) {
  root.addClass("cadence-home");
  const today = /* @__PURE__ */ new Date();
  const dateStr = today.toLocaleDateString(void 0, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  view._renderPageHeader(root, `${greeting()}.`, dateStr, (right2) => {
    const mk = (label, fn) => {
      const b = right2.createEl("button", { cls: "cad-btn", text: label });
      b.addEventListener("click", fn);
      return b;
    };
    mk("+ Task", () => view._quickAddTodayTask());
    mk("+ Deal", () => view._createEntityFromPrompt("deal"));
    mk("+ Contact", () => view._createEntityFromPrompt("contact"));
    mk("+ Project", () => view._createEntityFromPrompt("project"));
    const newInbox = mk("+ Inbox", () => view.plugin.openQuickCapture());
    newInbox.classList.add("primary");
  });
  await view._renderBriefing(root);
  const cols = root.createDiv({ cls: "cad-home-cols" });
  const left = cols.createDiv({ cls: "cad-home-col" });
  const right = cols.createDiv({ cls: "cad-home-col" });
  await view._homeInboxCard(left);
  await view._homeTodayCard(left);
  await view._homeWeekCard(left);
  await view._homeUpcomingCard(left);
  await view._homePartnersCard(left);
  await view._homeProjectsCard(right);
  await view._homePipelineCard(right);
  await view._homeActivitiesCard(right);
}
function homeCard(view, parent, title, action, tone) {
  const card = parent.createDiv({ cls: "cad-home-card" });
  if (tone) card.dataset.tone = tone;
  const head = card.createDiv({ cls: "cad-home-card-head" });
  head.createDiv({ cls: "cad-home-card-title", text: title });
  if (typeof action === "function") action(head);
  return card.createDiv({ cls: "cad-home-card-body" });
}
async function renderBriefing(view, root) {
  const items = await view._computeBriefing();
  const card = root.createDiv({ cls: "cad-briefing" });
  const head = card.createDiv({ cls: "cad-briefing-head" });
  head.createDiv({ cls: "cad-briefing-eyebrow", text: "TOP OF THE DAY" });
  head.createDiv({ cls: "cad-briefing-headline", text: view._briefingHeadline(items) });
  if (!items.length) {
    card.createDiv({ cls: "cad-briefing-empty", text: "Nothing flagged. Make today count." });
    return;
  }
  const { shown, hiddenCount } = visibleBriefing(items, !!(import_obsidian21.Platform && import_obsidian21.Platform.isMobile));
  const list = card.createDiv({ cls: "cad-briefing-list" });
  shown.forEach((it) => {
    const row = list.createDiv({ cls: `cad-briefing-row cad-tone-${it.tone || "emerald"}` });
    row.createSpan({ cls: "cad-briefing-icon", text: it.icon });
    row.createSpan({ cls: "cad-briefing-text", text: it.text });
    if (it.action) {
      row.classList.add("clickable");
      row.addEventListener("click", it.action);
    }
  });
  if (hiddenCount > 0) {
    const more = card.createDiv({ cls: "cad-briefing-more" });
    more.setText(`+${hiddenCount} more \xB7 scroll down for the full picture`);
  }
}
function visibleBriefing(items, isMobile) {
  const hiddenCount = isMobile && items.length > 3 ? items.length - 3 : 0;
  return { shown: isMobile && items.length > 3 ? items.slice(0, 3) : items, hiddenCount };
}
function briefingHeadline(items, now = /* @__PURE__ */ new Date()) {
  const hasOverdue = items.some((i) => i.tone === "rose");
  if (hasOverdue) return `A couple of things need attention this ${partOfDay(now)}.`;
  if (items.length >= 4) return "Here's what's worth your attention today.";
  if (items.length === 0) return "Inbox zero. Clear runway.";
  return "Here's what's on your radar.";
}
function computeBriefing(data, now) {
  const items = [];
  const dealDef = ENTITIES.deal;
  const contactDef = ENTITIES.contact;
  const today = startOfDay(now);
  const todayMs = today.getTime();
  const nowMs = now.getTime();
  const openTasks = data.openTasks ?? 0;
  if (openTasks > 0) {
    items.push({
      icon: "\u{1F3AF}",
      tone: "emerald",
      text: data.taskManagementSystem === "tasknotes" ? `${openTasks} open ${openTasks === 1 ? "task" : "tasks"} scheduled for today` : `${openTasks} open ${openTasks === 1 ? "task" : "tasks"} on today's note`,
      target: { kind: "mode", mode: "planner.today" }
    });
  }
  const reminders = (data.reminders || []).filter((r) => !r.done);
  const overdue = reminders.filter((r) => r.when && new Date(r.when).getTime() <= nowMs);
  if (overdue.length) {
    const ex = overdue.reduce((a, b) => new Date(b.when).getTime() < new Date(a.when).getTime() ? b : a);
    const exTxt = ex.text.length > 50 ? ex.text.slice(0, 47) + "\u2026" : ex.text;
    items.push({
      icon: "\u26A0",
      tone: "rose",
      text: overdue.length === 1 ? `Overdue reminder \u2014 "${exTxt}"` : `${overdue.length} overdue reminders \u2014 "${exTxt}" + ${overdue.length - 1} more`,
      target: { kind: "mode", mode: "planner.inbox" }
    });
  }
  const dueToday = reminders.filter((r) => {
    if (!r.when) return false;
    const w = new Date(r.when).getTime();
    return w > nowMs && w < todayMs + 864e5;
  });
  if (dueToday.length) {
    items.push({
      icon: "\u23F0",
      tone: "mint",
      text: `${dueToday.length} ${dueToday.length === 1 ? "reminder" : "reminders"} due later today`,
      target: { kind: "mode", mode: "planner.inbox" }
    });
  }
  const deals = data.deals;
  const weekEnd = todayMs + 7 * 864e5;
  const closingThisWeek = deals.filter((e) => {
    if (dealOutcome(e, dealDef) !== "open") return false;
    const closeBy = entityValue(e, "closeBy", dealDef);
    if (!closeBy) return false;
    const d = new Date(closeBy);
    return !isNaN(d.getTime()) && d.getTime() >= todayMs && d.getTime() <= weekEnd;
  });
  if (closingThisWeek.length) {
    const value = closingThisWeek.reduce((s, e) => s + (Number(entityValue(e, "value", dealDef)) || 0), 0);
    items.push({
      icon: "\u{1F4BC}",
      tone: "sky",
      text: `${closingThisWeek.length} ${closingThisWeek.length === 1 ? "deal closes" : "deals close"} this week \xB7 ${fmtValue(value, "currency")}`,
      target: { kind: "mode", mode: "crm.pipeline" }
    });
  }
  const contacts = data.contacts;
  const openDeals = deals.filter((e) => dealOutcome(e, dealDef) === "open");
  const dealContacts = openDeals.map((d) => ({
    deal: d,
    names: new Set(linkedNames(entityValue(d, "contact", dealDef)).map((n) => n.toLowerCase()))
  }));
  const dealFor = (c, name) => dealContacts.find(({ names }) => names.has(name.toLowerCase()) || names.has(c.basename.toLowerCase()));
  const staleCutoffMs = todayMs - 30 * 864e5;
  let staleSample = null;
  let staleCount = 0;
  contacts.forEach((c) => {
    const name = String(entityValue(c, "name", contactDef) || "").trim();
    if (!name) return;
    const linked = dealFor(c, name);
    if (!linked) return;
    const lc = entityValue(c, "lastContact", contactDef);
    const lcMs = lc ? new Date(lc).getTime() : NaN;
    if (!isNaN(lcMs) && lcMs >= staleCutoffMs) return;
    staleCount++;
    if (!staleSample) staleSample = { contact: c, name, deal: linked.deal, lc, lcMs };
  });
  if (staleSample) {
    const { contact, name, deal, lc, lcMs } = staleSample;
    const days = Math.floor((todayMs - lcMs) / 864e5);
    const dealName = entityValue(deal, "title", dealDef) || "";
    const ago = !lc ? "never contacted" : isNaN(lcMs) ? "last contact unreadable" : `${days} ${days === 1 ? "day" : "days"} quiet`;
    const more = staleCount > 1 ? ` (+${staleCount - 1} more)` : "";
    items.push({
      icon: "\u{1F464}",
      tone: "warn",
      text: `${name} \u2014 ${ago}${dealName ? ` \xB7 ${dealName}` : ""}${more}`,
      target: { kind: "file", file: contact.file }
    });
  }
  const upcoming = [];
  for (const p of data.projects) {
    if (p.next && p.next.date) {
      const ms = p.next.date.getTime();
      if (ms >= todayMs && ms <= todayMs + 14 * 864e5) {
        upcoming.push({ file: p.file, milestone: p.next, name: p.name });
      }
    }
  }
  upcoming.sort((a, b) => a.milestone.date - b.milestone.date);
  if (upcoming.length) {
    const m = upcoming[0];
    const days = Math.max(0, Math.ceil((m.milestone.date.getTime() - todayMs) / 864e5));
    const dayStr = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    const title = m.milestone.title || "milestone";
    items.push({
      icon: "\u{1F4C5}",
      tone: "mint",
      text: `${m.name} \xB7 "${title}" \u2014 due ${dayStr}`,
      target: { kind: "project", file: m.file }
    });
  }
  const winCutoff = nowMs - 7 * 864e5;
  const recentWins = deals.filter((e) => {
    if (dealOutcome(e, dealDef) !== "won") return false;
    const closedAt = dealClosedAt(e, dealDef);
    return !!closedAt && closedAt.getTime() >= winCutoff;
  });
  if (recentWins.length) {
    const value = recentWins.reduce((s, e) => s + (Number(entityValue(e, "value", dealDef)) || 0), 0);
    items.push({
      icon: "\u{1F389}",
      tone: "emerald",
      text: `${recentWins.length} ${recentWins.length === 1 ? "deal won" : "deals won"} this week \xB7 ${fmtValue(value, "currency")}`,
      target: { kind: "mode", mode: "reports.sales" }
    });
  }
  return items;
}
function nextUpcomingMilestone(milestones, now) {
  const todayMs = startOfDay(now).getTime();
  return milestones.filter((m) => !m.done && m.date && m.date.getTime() >= todayMs).sort((a, b) => a.date.getTime() - b.date.getTime())[0] || null;
}
async function loadBriefing(view) {
  const settings = view.plugin.settings;
  let openTasks = null;
  try {
    if (settings.taskManagementSystem === "tasknotes") {
      const todayYmd = ymd(/* @__PURE__ */ new Date());
      const allTaskNotes = listTaskNotesTasks(view.app);
      openTasks = allTaskNotes.filter((t) => t.scheduled === todayYmd && !t.done).length;
    } else {
      const file = findDailyNote(view.app, settings);
      if (file) {
        const parsed = parseSections(await view.app.vault.read(file), settings);
        openTasks = countTaskLines(withoutBlankTasks(parsed.tasks)).open;
      } else {
        openTasks = 0;
      }
    }
  } catch (_) {
  }
  const deals = listEntities(view.app, "deal");
  const contacts = listEntities(view.app, "contact");
  const projects = [];
  for (const f of listEntityFiles(view.app, "project")) {
    try {
      const meta = await readProjectMeta(view.app, f);
      projects.push({ file: f, name: projectNameFromPath(view.app, f.path), next: nextUpcomingMilestone(meta.milestones, /* @__PURE__ */ new Date()) });
    } catch (_) {
    }
  }
  const entries = computeBriefing({
    taskManagementSystem: settings.taskManagementSystem,
    openTasks,
    reminders: settings.reminders,
    deals,
    contacts,
    projects
  }, /* @__PURE__ */ new Date());
  return entries.map(({ icon, tone, text, target }) => ({ icon, tone, text, action: briefingAction(view, target) }));
}
function briefingAction(view, target) {
  if (target.kind === "file") return () => view.openEntityDetailFromFile(target.file);
  if (target.kind === "project") return () => view.openEntityDetail("project", target.file);
  return () => view.setMode(target.mode);
}
function selectInboxCard(allReminders, now) {
  const nowMs = now.getTime();
  const reminders = (allReminders || []).filter((r) => !r.done);
  const isOverdue = (r) => (reminderTime(r.when) ?? Infinity) <= nowMs;
  const overdueCount2 = reminders.filter(isOverdue).length;
  const tone = overdueCount2 > 0 ? "rose" : "sky";
  const title = `INBOX \u2014 ${reminders.length} item${reminders.length === 1 ? "" : "s"}${overdueCount2 > 0 ? ` \xB7 ${overdueCount2} overdue` : ""}`;
  const sorted = [...reminders].sort((a, b) => {
    const wa = reminderTime(a.when) ?? Infinity;
    const wb = reminderTime(b.when) ?? Infinity;
    return wa - wb;
  });
  const rows = sorted.slice(0, 5).map((reminder) => ({ reminder, overdue: isOverdue(reminder) }));
  return { reminders, overdueCount: overdueCount2, tone, title, rows };
}
function inboxRowMeta(r, projectName) {
  const metaBits = [];
  if (r.project) metaBits.push(`\u{1F4C1} ${projectName(r.project) || "project"}`);
  const repeat = repeatLabel(r.repeat);
  if (repeat) metaBits.push(repeat);
  if (r.notes) {
    const firstLine = String(r.notes).split("\n").find((l) => l.trim()) || "";
    if (firstLine) metaBits.push(`\u{1F4DD} ${firstLine.length > 60 ? firstLine.slice(0, 57) + "\u2026" : firstLine}`);
  }
  return metaBits;
}
async function homeInboxCard(view, parent) {
  const { reminders, tone, title: headTitle, rows } = selectInboxCard(view.plugin.settings.reminders, /* @__PURE__ */ new Date());
  const body = view._homeCard(parent, headTitle, (head) => {
    const cap = head.createEl("a", { cls: "cad-home-card-link", text: "+ Capture" });
    cap.style.marginRight = "12px";
    cap.addEventListener("click", (e) => {
      e.preventDefault();
      view.plugin.openQuickCapture();
    });
    const link = head.createEl("a", { cls: "cad-home-card-link", text: "Open Inbox \u2192" });
    link.addEventListener("click", (e) => {
      e.preventDefault();
      view.setMode("planner.inbox");
    });
  }, tone);
  if (!reminders.length) {
    body.createDiv({ cls: "cad-empty", text: "Inbox zero \u2014 capture anything with + Inbox above (or Cmd+Shift+I)." });
    return;
  }
  rows.forEach(({ reminder: r, overdue }) => {
    const row = body.createDiv({ cls: "cad-home-row" });
    if (overdue) row.classList.add("overdue");
    row.createDiv({ cls: "cad-home-row-date", text: r.when ? reminderTimeLabel(r.when) : "unscheduled" });
    const main = row.createDiv({ cls: "cad-home-row-main" });
    main.createDiv({ cls: "cad-home-row-title", text: r.text });
    const metaBits = inboxRowMeta(r, (path) => projectNameFromPath(view.app, path));
    if (metaBits.length) main.createDiv({ cls: "cad-home-row-meta", text: metaBits.join("  \xB7  ") });
    row.addEventListener("click", () => new CadenceReminderEditModal(view.app, view.plugin, r).open());
  });
}
function selectTodayCard(tasksList) {
  const { open, done } = countTaskLines(tasksList);
  const rows = taskLineRows(tasksList);
  return { open, done, title: `TODAY \u2014 ${open} open \xB7 ${done} done`, rows };
}
async function homeTodayCard(view, parent) {
  const settings = view.plugin.settings;
  let tasksList = [];
  let todayTaskNotes = [];
  let file = null;
  if (settings.taskManagementSystem === "tasknotes") {
    const todayYmd = ymd(/* @__PURE__ */ new Date());
    const today = taskNotesToday(listTaskNotesTasks(view.app), todayYmd);
    todayTaskNotes = today.tasks;
    tasksList = today.lines;
  } else {
    file = findDailyNote(view.app, settings);
    if (file) tasksList = withoutBlankTasks(parseSections(await view.app.vault.read(file), settings).tasks);
  }
  const { title, rows } = selectTodayCard(tasksList);
  const body = view._homeCard(parent, title, (head) => {
    const link = head.createEl("a", { cls: "cad-home-card-link", text: "Open Today \u2192" });
    link.addEventListener("click", (e) => {
      e.preventDefault();
      view.setMode("planner.today");
    });
  }, "emerald");
  if (!tasksList.length) {
    body.createDiv({ cls: "cad-empty", text: "No tasks yet \u2014 add one with + Task above." });
    return;
  }
  let projectTargets;
  rows.forEach(({ checked, text }, idx) => {
    const row = body.createDiv({ cls: "cad-home-task" + (checked ? " done" : "") });
    const cb = row.createEl("input", { type: "checkbox" });
    cb.checked = checked;
    cb.addEventListener("change", async () => {
      if (settings.taskManagementSystem === "tasknotes") {
        const taskObj = todayTaskNotes[idx];
        await toggleTaskNotesTask(view.app, taskObj.file, cb.checked);
        await view._propagateTaskComplete(taskObj.title, cb.checked, { kind: "tasknotes", file: taskObj.file });
      } else {
        await view._tickDailyNoteTask(file, taskLineRef(tasksList, idx), cb.checked, /* @__PURE__ */ new Date());
      }
      view.render();
    });
    if (settings.taskManagementSystem === "tasknotes") {
      const taskObj = todayTaskNotes[idx];
      const taskLink = row.createEl("a", { cls: "cad-task-text", text });
      taskLink.style.cursor = "pointer";
      taskLink.addEventListener("click", (e) => {
        e.preventDefault();
        view.app.workspace.openLinkText(taskObj.file.path, "", false);
      });
    } else {
      row.createSpan({ cls: "cad-task-text", text });
    }
    let linkedProject = null;
    if (settings.taskManagementSystem === "tasknotes") {
      const taskObj = todayTaskNotes[idx];
      if (taskObj.projects) linkedProject = taskNotesProjectPath(taskObj.projects, projectTargets ??= projectLinkTargets(view.app));
    } else {
      linkedProject = view._getTaskProjectLink(file.path, text);
    }
    if (linkedProject) {
      const chip = row.createEl("a", { cls: "cad-task-proj-chip", text: "\u{1F4C1} " + (projectNameFromPath(view.app, linkedProject) || "Project") });
      chip.title = "Open linked project";
      chip.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const f = view.app.vault.getAbstractFileByPath(linkedProject);
        if (f && f instanceof import_obsidian21.TFile) view.openEntityDetail("project", f);
      });
    }
    if (settings.taskManagementSystem !== "tasknotes") {
      const linkBtn = row.createEl("button", { cls: "cad-task-link-btn" + (linkedProject ? " linked" : ""), text: linkedProject ? "\u270E" : "\u{1F4C1}" });
      linkBtn.title = linkedProject ? "Change linked project" : "Link to a project";
      linkBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        view._openTaskProjectPicker(file.path, text, linkedProject);
      });
    }
  });
}
function countWeekTaskNotes(allTasks, weekYmds) {
  let open = 0, done = 0;
  allTasks.forEach((t) => {
    if (weekYmds.includes(t.scheduled)) {
      if (t.done) done++;
      else open++;
    }
  });
  return { open, done };
}
function weekProgress(open, done) {
  const total = open + done;
  const pct = total === 0 ? 0 : Math.round(done / total * 100);
  return {
    total,
    pct,
    band: pctBand(pct),
    title: `THIS WEEK \u2014 ${done}/${total} done`,
    label: total ? `${done} of ${total} tasks completed` : "No tasks logged this week yet"
  };
}
async function homeWeekCard(view, parent) {
  const settings = view.plugin.settings;
  const weekStart = startOfWeek(/* @__PURE__ */ new Date(), settings.weekStartsOn);
  let open = 0, done = 0;
  if (settings.taskManagementSystem === "tasknotes") {
    const allTasks = listTaskNotesTasks(view.app);
    const weekDatesList = Array.from({ length: 7 }, (_, i) => ymd(addDays(weekStart, i)));
    ({ open, done } = countWeekTaskNotes(allTasks, weekDatesList));
  } else {
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const f = view.app.vault.getAbstractFileByPath(dailyNotePath(settings, d));
      if (f && f instanceof import_obsidian21.TFile) {
        const c = await view.app.vault.read(f);
        const p = parseSections(c, settings);
        const counts = countTaskLines(withoutBlankTasks(p.tasks));
        open += counts.open;
        done += counts.done;
      }
    }
  }
  const { pct, band, title, label } = weekProgress(open, done);
  const body = view._homeCard(parent, title, (head) => {
    const link = head.createEl("a", { cls: "cad-home-card-link", text: "Open Calendar \u2192" });
    link.addEventListener("click", (e) => {
      e.preventDefault();
      view.setMode("planner.calendar");
    });
  }, "mint");
  const wrap = body.createDiv({ cls: "cad-proj-progress-wrap" });
  wrap.dataset.pctBand = band;
  const lbl = wrap.createDiv({ cls: "cad-proj-progress-label" });
  lbl.createSpan({ text: label });
  lbl.createSpan({ cls: "cad-proj-progress-pct", text: `${pct}%` });
  const bar = wrap.createDiv({ cls: "cad-proj-progress-bar" });
  const fill = bar.createDiv({ cls: "cad-proj-progress-fill" });
  fill.style.width = `${pct}%`;
}
function selectUpcomingItems(data, now) {
  const today = startOfDay(now);
  const horizon = addDays(today, 7);
  const items = [];
  data.projects.forEach((e) => {
    const due = entityValue(e, "due", ENTITIES.project);
    if (!due) return;
    const d = new Date(due);
    if (isNaN(d.getTime())) return;
    if (d >= today && d <= horizon) {
      items.push({ date: d, title: entityValue(e, "name", ENTITIES.project) || e.basename, type: "Project due", file: e.file });
    }
  });
  for (const { entity: e, next } of data.projectNext) {
    if (next && next.date && next.date >= today && next.date <= horizon) {
      items.push({ date: next.date, title: `${entityValue(e, "name", ENTITIES.project) || e.basename} \u2014 ${next.title || "milestone"}`, type: "Milestone", file: e.file });
    }
  }
  data.registrations.forEach((e) => {
    const exp = entityValue(e, "expires", ENTITIES.registration);
    if (!exp) return;
    const d = new Date(exp);
    if (isNaN(d.getTime())) return;
    if (d >= today && d <= horizon) {
      items.push({ date: d, title: entityValue(e, "title", ENTITIES.registration) || e.basename, type: "Registration expires", file: e.file });
    }
  });
  data.certifications.forEach((e) => {
    const exp = entityValue(e, "expires", ENTITIES.certification);
    if (!exp) return;
    const d = new Date(exp);
    if (isNaN(d.getTime())) return;
    if (d >= today && d <= horizon) {
      items.push({ date: d, title: entityValue(e, "name", ENTITIES.certification) || e.basename, type: "Cert expires", file: e.file });
    }
  });
  items.sort((a, b) => a.date - b.date);
  return items;
}
async function homeUpcomingCard(view, parent) {
  const projects = listEntities(view.app, "project");
  const projectNext = [];
  for (const e of projects) {
    try {
      const meta = await readProjectMeta(view.app, e.file);
      projectNext.push({ entity: e, next: nextUpcomingMilestone(meta.milestones, /* @__PURE__ */ new Date()) });
    } catch (_) {
    }
  }
  const items = selectUpcomingItems({
    projects,
    projectNext,
    registrations: listEntities(view.app, "registration"),
    certifications: listEntities(view.app, "certification")
  }, /* @__PURE__ */ new Date());
  const body = view._homeCard(parent, `UPCOMING \xB7 NEXT 7 DAYS \u2014 ${items.length}`, void 0, "warn");
  if (!items.length) {
    body.createDiv({ cls: "cad-empty", text: "Nothing on the radar." });
    return;
  }
  items.slice(0, 6).forEach((it) => {
    const row = body.createDiv({ cls: "cad-home-row" });
    row.createDiv({ cls: "cad-home-row-date", text: fmtValue(it.date, "date") });
    const main = row.createDiv({ cls: "cad-home-row-main" });
    main.createDiv({ cls: "cad-home-row-title", text: it.title });
    main.createDiv({ cls: "cad-home-row-meta", text: it.type });
    row.addEventListener("click", () => view.openEntityDetailFromFile(it.file));
  });
}
function selectPartnerRows(partners) {
  return partners.slice(0, 5).map((e) => {
    const tier = entityValue(e, "tier", ENTITIES.partner) || "";
    const status = entityValue(e, "status", ENTITIES.partner) || "";
    return {
      entity: e,
      name: entityValue(e, "name", ENTITIES.partner) || e.basename,
      meta: [tier, status].filter(Boolean).join(" \xB7 ")
    };
  });
}
async function homePartnersCard(view, parent) {
  const partners = listEntities(view.app, "partner");
  const body = view._homeCard(parent, `PARTNERS \u2014 ${partners.length}`, (head) => {
    const link = head.createEl("a", { cls: "cad-home-card-link", text: "Open Partners \u2192" });
    link.addEventListener("click", (e) => {
      e.preventDefault();
      view.setMode("prm.partners");
    });
  }, "sky");
  if (!partners.length) {
    body.createDiv({ cls: "cad-empty", text: "No partners on the books yet." });
    return;
  }
  selectPartnerRows(partners).forEach(({ entity: e, name, meta }) => {
    const row = body.createDiv({ cls: "cad-home-row" });
    const main = row.createDiv({ cls: "cad-home-row-main" });
    main.createDiv({ cls: "cad-home-row-title", text: name });
    main.createDiv({ cls: "cad-home-row-meta", text: meta });
    row.addEventListener("click", () => view.openEntityDetailFromFile(e.file));
  });
}
function isHomeActiveProject(e) {
  const status = String(entityValue(e, "status", ENTITIES.project) || "active").toLowerCase();
  return ["active", "on_hold", "in_progress"].includes(status.replace(/\s+/g, "_"));
}
async function homeProjectsCard(view, parent) {
  const def = ENTITIES.project;
  const files = listEntityFiles(view.app, "project");
  const activeEntities = files.map((f) => readEntity(view.app, f)).filter(isHomeActiveProject);
  const body = view._homeCard(parent, `ACTIVE PROJECTS \u2014 ${activeEntities.length}`, (head) => {
    const link = head.createEl("a", { cls: "cad-home-card-link", text: "Open Projects \u2192" });
    link.addEventListener("click", (e) => {
      e.preventDefault();
      view.setMode("projects.projects");
    });
  }, "emerald");
  if (!files.length) {
    body.createDiv({ cls: "cad-empty", text: "No projects yet \u2014 hit + Project above." });
    return;
  }
  const active = await Promise.all(
    activeEntities.slice(0, 3).map(async (entity) => ({ entity, meta: await readProjectMeta(view.app, entity.file) }))
  );
  if (!active.length) {
    body.createDiv({ cls: "cad-empty", text: "No active projects right now." });
    return;
  }
  active.forEach((p) => {
    const row = body.createDiv({ cls: "cad-home-proj" });
    row.dataset.pctBand = pctBand(p.meta.percent);
    const head = row.createDiv({ cls: "cad-home-proj-head" });
    head.createSpan({ cls: "cad-home-proj-title", text: entityValue(p.entity, "name", def) || p.entity.basename });
    head.createSpan({ cls: "cad-home-proj-pct", text: `${p.meta.percent}%` });
    const bar = row.createDiv({ cls: "cad-proj-progress-bar" });
    const fill = bar.createDiv({ cls: "cad-proj-progress-fill" });
    fill.style.width = `${p.meta.percent}%`;
    if (p.meta.next) {
      row.createDiv({ cls: "cad-home-row-meta", text: `NEXT \xB7 ${fmtValue(p.meta.next.date, "date")}${p.meta.next.title ? " \u2014 " + p.meta.next.title : ""}` });
    }
    row.addEventListener("click", () => view.openEntityDetail("project", p.entity.file));
  });
}
function selectPipelineCard(deals) {
  const def = ENTITIES.deal;
  const open = deals.filter((e) => dealOutcome(e, def) === "open");
  const value = open.reduce((s, e) => s + (Number(entityValue(e, "value", def)) || 0), 0);
  const top = [...open].sort((a, b) => (Number(entityValue(b, "value", def)) || 0) - (Number(entityValue(a, "value", def)) || 0)).slice(0, 4);
  return { open, value, top };
}
async function homePipelineCard(view, parent) {
  const def = ENTITIES.deal;
  const { open, value, top } = selectPipelineCard(listEntities(view.app, "deal"));
  const body = view._homeCard(parent, `PIPELINE \u2014 ${open.length} open \xB7 ${fmtValue(value, "currency")}`, (head) => {
    const link = head.createEl("a", { cls: "cad-home-card-link", text: "Open Pipeline \u2192" });
    link.addEventListener("click", (e) => {
      e.preventDefault();
      view.setMode("crm.pipeline");
    });
  }, "sky");
  if (!open.length) {
    body.createDiv({ cls: "cad-empty", text: "No open deals \u2014 hit + Deal above." });
    return;
  }
  top.forEach((e) => {
    const row = body.createDiv({ cls: "cad-home-row" });
    const main = row.createDiv({ cls: "cad-home-row-main" });
    main.createDiv({ cls: "cad-home-row-title", text: entityValue(e, "title", def) || e.basename });
    const stage = entityValue(e, "stage", def);
    main.createDiv({ cls: "cad-home-row-meta", text: `${stage || "\u2014"} \xB7 ${fmtValue(entityValue(e, "value", def), "currency")}` });
    row.addEventListener("click", () => view.openEntityDetailFromFile(e.file));
  });
}
function selectRecentActivities(acts) {
  const def = ENTITIES.activity;
  return newestFirst(acts, (e) => entityValue(e, "when", def)).slice(0, 5);
}
async function homeActivitiesCard(view, parent) {
  const def = ENTITIES.activity;
  const acts = listEntities(view.app, "activity");
  const body = view._homeCard(parent, `RECENT ACTIVITY \u2014 ${acts.length}`, (head) => {
    const link = head.createEl("a", { cls: "cad-home-card-link", text: "Open Activities \u2192" });
    link.addEventListener("click", (e) => {
      e.preventDefault();
      view.setMode("crm.activities");
    });
  }, "rose");
  if (!acts.length) {
    body.createDiv({ cls: "cad-empty", text: "No activities logged yet." });
    return;
  }
  selectRecentActivities(acts).forEach((e) => {
    const row = body.createDiv({ cls: "cad-home-row" });
    const main = row.createDiv({ cls: "cad-home-row-main" });
    main.createDiv({ cls: "cad-home-row-title", text: entityValue(e, "subject", def) || e.basename });
    main.createDiv({ cls: "cad-home-row-meta", text: `${entityValue(e, "type", def) || "\u2014"} \xB7 ${fmtValue(entityValue(e, "when", def), "date")}` });
    row.addEventListener("click", () => view.openEntityDetailFromFile(e.file));
  });
}

// src/views/inbox.ts
var import_obsidian22 = require("obsidian");
function overdueCount(reminders, now) {
  const open = (reminders || []).filter((r) => !r.done);
  return open.filter((r) => (reminderTime(r.when) ?? Infinity) <= now).length;
}
function inboxOverdueCount(view) {
  return overdueCount(view.plugin.settings.reminders, Date.now());
}
var INBOX_SECTION_LABELS = { now: "NOW \xB7 OVERDUE OR DUE WITHIN 1 HOUR", today: "TODAY", week: "THIS WEEK", later: "LATER \xB7 UNSCHEDULED" };
function inboxRows(reminders) {
  const all = (reminders || []).filter((r) => !r.done);
  all.sort((a, b) => {
    const wa = reminderTime(a.when) ?? Infinity;
    const wb = reminderTime(b.when) ?? Infinity;
    if (wa !== wb) return wa - wb;
    const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return cb - ca;
  });
  const buckets = { now: [], today: [], week: [], later: [] };
  all.forEach((r) => buckets[reminderBucket(r.when)].push(r));
  const sections = ["now", "today", "week", "later"].filter((key) => buckets[key].length).map((key) => ({ key, label: `${INBOX_SECTION_LABELS[key]} \xB7 ${buckets[key].length}`, items: buckets[key] }));
  return {
    count: all.length,
    subtitle: `${all.length} ${all.length === 1 ? "item" : "items"} \xB7 capture once, surface at the right time`,
    sections
  };
}
async function renderInbox(view, root) {
  root.addClass("cadence-inbox");
  const inbox = inboxRows(view.plugin.settings.reminders);
  view._renderPageHeader(root, "Inbox", inbox.subtitle, (right) => {
    const captureBtn = right.createEl("button", { cls: "cad-btn primary", text: "+ Quick capture" });
    captureBtn.addEventListener("click", () => view.plugin.openQuickCapture());
  });
  if (!inbox.count) {
    const empty = root.createDiv({ cls: "cad-empty-state" });
    empty.createDiv({ cls: "cad-empty-state-title", text: "Inbox zero" });
    empty.createDiv({ cls: "cad-empty-state-desc", text: "Capture anything with + Quick capture above (or Cmd+Shift+I). Add a time and Cadence will remind you." });
  }
  inbox.sections.forEach(({ key, label, items }) => {
    root.createDiv({ cls: "cad-section-label-lg", text: label });
    const list = root.createDiv({ cls: "cad-inbox-list" });
    items.forEach((r) => view._renderInboxRow(list, r, key));
  });
  await view._renderProjectTasksSection(root);
}
function openProjectTasks(content) {
  const sections = parseH2Sections(content);
  return parseTasksList(sections["Tasks"] || "").filter((t) => !t.done && t.title);
}
function projectTasksHeading(totalOpen, groupCount) {
  return `PROJECT TASKS \xB7 ${totalOpen} open across ${groupCount} ${groupCount === 1 ? "project" : "projects"}`;
}
async function renderProjectTasksSection(view, root) {
  const projectFiles = listEntityFiles(view.app, "project");
  if (!projectFiles.length) return;
  const groups = [];
  let totalOpen = 0;
  for (const file of projectFiles) {
    let content;
    try {
      content = await view.app.vault.read(file);
    } catch (_) {
      continue;
    }
    const open = openProjectTasks(content);
    if (!open.length) continue;
    totalOpen += open.length;
    groups.push({
      file,
      name: projectNameFromPath(view.app, file.path),
      tasks: open
    });
  }
  if (!totalOpen) return;
  root.createDiv({ cls: "cad-section-label-lg", text: projectTasksHeading(totalOpen, groups.length) });
  const wrap = root.createDiv({ cls: "cad-pt-wrap" });
  groups.forEach((g) => {
    const card = wrap.createDiv({ cls: "cad-pt-group" });
    const head = card.createDiv({ cls: "cad-pt-group-head" });
    const link = head.createEl("a", { cls: "cad-pt-group-link", text: "\u{1F4C1} " + g.name });
    link.addEventListener("click", (e) => {
      e.preventDefault();
      view.openEntityDetail("project", g.file);
    });
    head.createSpan({ cls: "cad-pt-group-meta", text: `${g.tasks.length} open` });
    const list = card.createDiv({ cls: "cad-pt-list" });
    g.tasks.forEach((t) => {
      const linked = findProjectTaskReminder(view.plugin, g.file.path, t.title);
      const row = list.createDiv({ cls: "cad-pt-row" });
      row.createSpan({ cls: "cad-pt-bullet", text: "\u2022" });
      const txt = row.createSpan({ cls: "cad-pt-text", text: t.title });
      void txt;
      if (linked && linked.when) {
        row.createSpan({ cls: "cad-pt-when", text: reminderTimeLabel(linked.when) });
      }
      const bell = row.createEl("button", {
        cls: "cad-btn cad-btn-sm cad-pt-bell" + (linked ? " linked" : ""),
        text: linked ? "\u{1F514}" : "\u{1F515}"
      });
      bell.title = linked ? "Edit reminder" : "Set a reminder";
      bell.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const existing = findProjectTaskReminder(view.plugin, g.file.path, t.title);
        if (existing) {
          new CadenceReminderEditModal(view.app, view.plugin, existing).open();
        } else {
          new CadenceReminderEditModal(view.app, view.plugin, {
            text: t.title,
            when: null,
            repeat: "none",
            notes: "",
            project: g.file.path
          }, { isNew: true }).open();
        }
      });
      row.addEventListener("click", () => view.openEntityDetail("project", g.file));
    });
  });
}
function notesPreview(notes) {
  if (!notes) return "";
  const previewLine = String(notes).split("\n").find((l) => l.trim()) || "";
  return previewLine.length > 120 ? previewLine.slice(0, 117) + "\u2026" : previewLine;
}
function tomorrowAtNine(now) {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}
function inboxRowActions(scheduled) {
  const timed = scheduled ? [
    { action: "snooze15", label: "+15m", title: "Snooze 15 minutes" },
    { action: "snooze60", label: "+1h", title: "Snooze 1 hour" },
    { action: "tomorrow", label: "Tom.", title: "Snooze to tomorrow 9am" }
  ] : [{ action: "schedule", label: "Schedule", title: "Add a time" }];
  return [
    ...timed,
    { action: "edit", label: "Edit", title: "Edit details + notes" },
    { action: "done", label: "Done", title: "Mark done" },
    { action: "delete", label: "\xD7", title: "Delete" }
  ];
}
function renderInboxRow(view, parent, r, bucket) {
  const row = parent.createDiv({ cls: "cad-inbox-row" + (bucket === "now" ? " overdue" : "") });
  const left = row.createDiv({ cls: "cad-inbox-row-left" });
  const tWrap = left.createDiv({ cls: "cad-inbox-time" });
  if (r.when && reminderTime(r.when) === null) {
    tWrap.createSpan({ cls: "cad-inbox-time-text muted", text: reminderTimeLabel(r.when) });
  } else if (r.when) {
    tWrap.createSpan({ cls: "cad-inbox-time-text", text: reminderTimeLabel(r.when) });
    const repeat = repeatLabel(r.repeat);
    if (repeat) tWrap.createSpan({ cls: "cad-inbox-repeat", text: repeat });
  } else {
    tWrap.createSpan({ cls: "cad-inbox-time-text muted", text: "unscheduled" });
  }
  const main = row.createDiv({ cls: "cad-inbox-row-main" });
  main.createDiv({ cls: "cad-inbox-row-text", text: r.text });
  if (r.project) {
    const chipRow = main.createDiv({ cls: "cad-inbox-row-meta-row" });
    const chip = chipRow.createEl("a", { cls: "cad-rem-project-chip", text: "\u{1F4C1} " + (projectNameFromPath(view.app, r.project) || "Project") });
    chip.title = "Open project";
    chip.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const file = view.app.vault.getAbstractFileByPath(r.project);
      if (file && file instanceof import_obsidian22.TFile) view.openEntityDetail("project", file);
    });
  }
  const preview = notesPreview(r.notes);
  if (preview) {
    const note = main.createDiv({ cls: "cad-inbox-row-notes" });
    note.createSpan({ cls: "cad-inbox-row-notes-icon", text: "\u{1F4DD} " });
    note.appendText(preview);
  }
  const openEdit = () => new CadenceReminderEditModal(view.app, view.plugin, r).open();
  left.addEventListener("click", openEdit);
  main.addEventListener("click", openEdit);
  left.style.cursor = "pointer";
  main.style.cursor = "pointer";
  const actions = row.createDiv({ cls: "cad-inbox-actions" });
  const mk = (label, title, fn) => {
    const b = actions.createEl("button", { cls: "cad-btn cad-btn-sm", text: label });
    b.title = title;
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      fn();
    });
    return b;
  };
  const handlers = {
    snooze15: () => view.plugin.snoozeReminder(r.id, 15 * 60 * 1e3),
    snooze60: () => view.plugin.snoozeReminder(r.id, 60 * 60 * 1e3),
    /* A snooze, so a repeating occurrence hands its series on first (#66). */
    tomorrow: () => {
      const now = Date.now();
      return view.plugin.snoozeReminder(r.id, new Date(tomorrowAtNine(new Date(now))).getTime() - now);
    },
    schedule: () => openEdit(),
    edit: () => openEdit(),
    done: async () => {
      await view.plugin.completeReminder(r.id);
      if (r.text) await view._propagateTaskComplete(r.text, true, { kind: "reminder", id: r.id });
    },
    delete: () => new CadenceConfirmModal(view.app, {
      title: "Delete reminder",
      message: "Delete this reminder?",
      confirmLabel: "Delete",
      onConfirm: () => view.plugin.deleteReminder(r.id)
    }).open()
  };
  inboxRowActions(!!r.when).forEach(({ action, label, title }) => {
    const b = mk(label, title, handlers[action]);
    if (action === "done") b.classList.add("primary");
    if (action === "delete") b.classList.add("cad-btn-danger");
  });
}

// src/views/nav.ts
var LEGACY_MODE_IDS = { today: "planner.today", planner: "planner.calendar" };
var ownKey = (table, id) => Object.prototype.hasOwnProperty.call(table, id);
function customPageMode(page) {
  const id = page.id;
  const taken = !!SURFACE_BY_ID[id] || ownKey(LEGACY_MODE_IDS, id) || id in Object.prototype;
  return taken ? `custom.${id}` : id;
}
function customPageFor(mode, customPages) {
  return customPages.find((p) => customPageMode(p) === mode);
}
function migrateModeId(id, settings) {
  if (ownKey(LEGACY_MODE_IDS, id)) return LEGACY_MODE_IDS[id];
  if (SURFACE_BY_ID[id]) return id;
  const customPages = settings.customPages || [];
  if (customPageFor(id, customPages)) return id;
  const byId = customPages.find((p) => p.id === id);
  return byId ? customPageMode(byId) : "home";
}
function resolveSurface(id, settings) {
  const custom = customPageFor(id, settings.customPages || []);
  if (custom) {
    return {
      id: customPageMode(custom),
      label: custom.label,
      icon: custom.icon || "file-text",
      desc: `Custom page displaying ${custom.entityKey} entity.`
    };
  }
  return SURFACE_BY_ID[id] || SURFACE_BY_ID["home"];
}
function visibleNavGroups(settings) {
  const mods = settings.modules || { crm: true, prm: true, planner: true, projects: true };
  const groups = JSON.parse(JSON.stringify(NAV_GROUPS));
  const customPages = settings.customPages || [];
  customPages.forEach((p) => {
    const g = groups.find((group) => group.id === p.sectionId);
    if (g) {
      g.items.push({
        id: customPageMode(p),
        label: p.label,
        icon: p.icon || "file-text",
        module: p.module || p.sectionId,
        desc: `Custom page displaying ${p.entityKey} entity.`
      });
    }
  });
  return groups.map((g) => {
    if (g.module && mods[g.module] === false) return null;
    const items = g.items.filter((it) => !it.module || mods[it.module] !== false);
    if (!items.length) return null;
    return Object.assign({}, g, { items });
  }).filter(Boolean);
}
function modeUsesEntityFolder(path) {
  if (!path) return false;
  return path.startsWith("Cadence/");
}
var surface = (method) => ({ kind: "surface", method });
var entityList = (entityKey) => ({ kind: "entityList", entityKey });
var SURFACE_ROUTES = new Map(Object.entries({
  "home": surface("renderHome"),
  "planner.inbox": surface("renderInbox"),
  "planner.today": surface("renderTodayPane"),
  "planner.calendar": surface("renderPlannerPane"),
  "projects.dashboard": surface("renderProjectsDashboard"),
  "projects.projects": entityList("project"),
  "crm.dashboard": surface("renderDashboard"),
  "crm.pipeline": entityList("deal"),
  "crm.contacts": entityList("contact"),
  "crm.companies": entityList("company"),
  "crm.activities": entityList("activity"),
  "prm.partners": entityList("partner"),
  "prm.registrations": entityList("registration"),
  "prm.commissions": entityList("commission"),
  "prm.leads": entityList("lead"),
  "prm.certifications": entityList("certification"),
  "prm.analytics": surface("renderPRMAnalytics"),
  "workflow.sequences": entityList("sequence"),
  "reports.pipeline": surface("renderReportPipeline"),
  "reports.sales": surface("renderReportSales"),
  "reports.partners": surface("renderReportPartners"),
  "reports.activity": surface("renderReportActivity"),
  "reports.graph": surface("renderReportGraph"),
  "reports.productivity": surface("renderProductivity"),
  "team": surface("renderTeam"),
  "templates": surface("renderTemplatesDashboard"),
  "settings": surface("openSettingsTab")
}));
function routeFor(mode, customPages) {
  const built = SURFACE_ROUTES.get(mode);
  if (built) return built;
  const custom = customPageFor(mode, customPages);
  if (custom) return entityList(custom.entityKey);
  return { kind: "comingSoon" };
}
function toggleMobileNav(view, force) {
  const root = view.containerEl.children[1];
  view.mobileNavOpen = typeof force === "boolean" ? force : !view.mobileNavOpen;
  if (root) root.toggleClass("cad-mobile-nav-open", view.mobileNavOpen);
}
async function toggleCadenceDark(view) {
  view.plugin.settings.cadenceAppDark = !view.plugin.settings.cadenceAppDark;
  await view.plugin.saveSettings();
  view.render();
}
async function setMode(view, m) {
  view.mode = view._migrateModeId(m);
  view.detailFile = null;
  view.detailEntityKey = null;
  await view.render();
}
async function toggleGroup(view, groupId) {
  const collapsed = view.plugin.settings.collapsedGroups || {};
  collapsed[groupId] = !collapsed[groupId];
  view.plugin.settings.collapsedGroups = collapsed;
  await view.plugin.saveSettings();
  await view.render();
}

// src/views/prm.ts
var TIER_ACCENT = { "Gold": "warn", "Silver": "sky", "Bronze": "rose", "Standard": "mint", "Untiered": "mint" };
function prmAnalytics(partners, deals, defs = { partner: ENTITIES.partner, deal: ENTITIES.deal }) {
  const { partner: partnerDef, deal: dealDef } = defs;
  const partnersOf = partnerResolver(partners, partnerDef);
  const partnerSourced = deals.filter((e) => partnersOf(e, dealDef).length > 0);
  const { open: sourcedOpen, won: partnerWon, lost: sourcedLost, openValue, wonValue, lostValue } = crmSummary(partnerSourced, dealDef);
  const sourcedValue = sumValues(partnerSourced, dealDef);
  const totalDealValue = sumValues(deals, dealDef);
  const sharePct = totalDealValue === 0 ? 0 : Math.round(sourcedValue / totalDealValue * 100);
  const tierMap = /* @__PURE__ */ new Map();
  const tierValueMap = /* @__PURE__ */ new Map();
  partners.forEach((p) => {
    const t = String(entityValue(p, "tier", partnerDef) || "Untiered");
    tierMap.set(t, (tierMap.get(t) || 0) + 1);
    tierValueMap.set(t, tierValueMap.get(t) || 0);
  });
  const partnerRevenue = /* @__PURE__ */ new Map();
  partnerWon.forEach((d) => {
    partnersOf(d, dealDef).forEach(({ key, name, partner }) => {
      const row = partnerRevenue.get(key) || { name, partner, value: 0 };
      row.value += dealValue(d, dealDef);
      partnerRevenue.set(key, row);
      if (!partner) return;
      const tier = String(entityValue(partner, "tier", partnerDef) || "Untiered");
      tierValueMap.set(tier, (tierValueMap.get(tier) || 0) + dealValue(d, dealDef));
    });
  });
  const closed = partnerWon.length + sourcedLost.length;
  const conv = closed === 0 ? 0 : Math.round(partnerWon.length / closed * 100);
  const currency = (value) => fmtValue(value, "currency");
  return {
    stats: [
      { label: "PARTNERS", value: partners.length, sub: "on the books", accent: "sky" },
      { label: "SOURCED DEALS", value: partnerSourced.length, sub: currency(sourcedValue), accent: "mint" },
      { label: "PARTNER REVENUE", value: currency(wonValue), sub: `${partnerWon.length} won`, accent: "emerald" },
      { label: "PARTNER SHARE", value: `${sharePct}%`, sub: "of total deal value", accent: "warn" }
    ],
    tiers: [...tierMap.entries()].sort((a, b) => b[1] - a[1]).map(([tier, count]) => {
      const value = tierValueMap.get(tier) || 0;
      return { label: tier.toUpperCase(), value: String(count), accent: TIER_ACCENT[tier] || "sky", sub: value > 0 ? currency(value) : "\u2014" };
    }),
    topPartners: [...partnerRevenue.values()].sort((a, b) => b.value - a.value).slice(0, 8).map(({ name, partner, value }) => ({ title: name, meta: currency(value), file: partner ? partner.file : null })),
    funnel: [
      { label: "SOURCED", value: String(partnerSourced.length), sub: currency(sourcedValue), accent: "sky" },
      { label: "OPEN", value: String(sourcedOpen.length), sub: currency(openValue), accent: "mint" },
      { label: "WON", value: String(partnerWon.length), sub: currency(wonValue), accent: "emerald" },
      { label: "LOST", value: String(sourcedLost.length), sub: currency(lostValue), accent: "rose" }
    ],
    conversion: { won: partnerWon.length, closed, pct: conv, band: pctBand(conv) }
  };
}
var TEAM_ROLE = /\b(team|admin|member)s?\b/i;
function isTeamMember(entity, def = ENTITIES.contact) {
  const role = entityValue(entity, "role", def);
  const roles = Array.isArray(role) ? role : [role];
  return roles.some((r) => r != null && TEAM_ROLE.test(String(r)));
}
function teamListOptions() {
  return {
    title: "Team",
    filter: (e) => isTeamMember(e),
    columns: ["name", "role", "email", "company"]
  };
}
function drawMiniStats(body, minis) {
  minis.forEach((m) => {
    const mini = body.createDiv({ cls: "cad-mini-stat" });
    mini.dataset.accent = m.accent;
    mini.createDiv({ cls: "cad-mini-stat-value", text: m.value });
    mini.createDiv({ cls: "cad-mini-stat-label", text: m.label });
    const sub = mini.createDiv({ cls: "cad-stat-sub" });
    sub.style.marginTop = "4px";
    sub.setText(m.sub ?? "");
  });
}
async function renderPRMAnalytics(view, root) {
  root.addClass("cadence-report");
  const partnerDef = ENTITIES.partner;
  const partners = listEntities(view.app, "partner");
  const report = prmAnalytics(partners, listEntities(view.app, "deal"));
  view._renderPageHeader(root, "PRM analytics", "Partner programme health, tier mix and revenue contribution");
  const grid = root.createDiv({ cls: "cad-stat-grid" });
  report.stats.forEach(({ label, value, sub, accent }) => {
    const c = grid.createDiv({ cls: "cad-stat-card" });
    if (accent) c.dataset.accent = accent;
    c.createDiv({ cls: "cad-stat-label", text: label });
    c.createDiv({ cls: "cad-stat-value", text: String(value) });
    if (sub) c.createDiv({ cls: "cad-stat-sub", text: sub });
  });
  if (report.tiers.length) {
    root.createDiv({ cls: "cad-section-label-lg", text: "PARTNERS BY TIER" });
    const tierCard = root.createDiv({ cls: "cad-dash-card" });
    tierCard.style.margin = "0 36px 18px 36px";
    drawMiniStats(tierCard.createDiv({ cls: "cad-dash-card-body cad-mini-stat-row" }), report.tiers);
  }
  const cols = root.createDiv({ cls: "cad-dash-cols" });
  const left = cols.createDiv({ cls: "cad-dash-col" });
  const right = cols.createDiv({ cls: "cad-dash-col" });
  view._dashCardSection(left, "TOP PARTNERS \xB7 by won revenue", report.topPartners, "No partner-attributed wins yet.");
  const funnelCard = right.createDiv({ cls: "cad-dash-card" });
  funnelCard.createDiv({ cls: "cad-dash-card-head" }).createDiv({ cls: "cad-dash-card-title", text: "PARTNER FUNNEL" });
  drawMiniStats(funnelCard.createDiv({ cls: "cad-dash-card-body cad-mini-stat-row" }), report.funnel);
  const { won, closed, pct: conv, band } = report.conversion;
  const convCard = right.createDiv({ cls: "cad-dash-card" });
  convCard.createDiv({ cls: "cad-dash-card-head" }).createDiv({ cls: "cad-dash-card-title", text: `CONVERSION \xB7 closed \u2192 won` });
  const convBody = convCard.createDiv({ cls: "cad-dash-card-body" });
  convBody.style.padding = "20px 16px";
  const convWrap = convBody.createDiv({ cls: "cad-proj-progress-wrap" });
  convWrap.dataset.pctBand = band;
  const convLabel = convWrap.createDiv({ cls: "cad-proj-progress-label" });
  convLabel.createSpan({ text: `${won}/${closed} closed partner deals won` });
  convLabel.createSpan({ cls: "cad-proj-progress-pct", text: `${conv}%` });
  const convBar = convWrap.createDiv({ cls: "cad-proj-progress-bar" });
  const convFill = convBar.createDiv({ cls: "cad-proj-progress-fill" });
  convFill.style.width = `${conv}%`;
  const analyticsHeader = root.createDiv({ attr: { style: "display: flex; justify-content: space-between; align-items: center; padding: 24px 32px 8px 32px; margin-bottom: 16px;" } });
  analyticsHeader.createEl("span", {
    cls: "cad-section-label-lg",
    text: "ANALYTICS & CHARTS",
    attr: { style: "padding: 0; margin: 0; display: inline-block;" }
  });
  const addWidgetBtn = analyticsHeader.createEl("button", { cls: "cad-btn primary", text: "+ Add Custom Chart" });
  const widgetsGrid = root.createDiv({ cls: "cad-dash-cols", attr: { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-bottom: 24px; padding: 0 32px;" } });
  const renderWidgets = () => {
    widgetsGrid.empty();
    const widgets = dashboardWidgets(view.plugin.settings, "prmDashboardWidgets");
    if (widgets.length === 0) {
      const emptyWrap = widgetsGrid.createDiv({ attr: { style: "grid-column: 1 / -1; text-align: center; padding: 32px; background: var(--background-secondary); border-radius: 8px; border: 1px dashed var(--border-color);" } });
      emptyWrap.createDiv({ text: 'No custom charts added yet. Click "+ Add Custom Chart" to create one!', attr: { style: "color: var(--text-muted); font-size: 0.95em;" } });
      return;
    }
    widgets.forEach((w) => {
      const card = widgetsGrid.createDiv({ cls: "cad-dash-card", attr: { style: "margin: 0; display: flex; flex-direction: column;" } });
      const head = card.createDiv({ cls: "cad-dash-card-head", attr: { style: "display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;" } });
      head.createDiv({ cls: "cad-dash-card-title", text: widgetTitle(w).toUpperCase(), attr: { style: "font-weight: 700; font-size: 0.75rem; letter-spacing: 0.12em;" } });
      const actionsWrap = head.createDiv({ attr: { style: "display: flex; gap: 8px; align-items: center;" } });
      const styleSelect = actionsWrap.createEl("select", { cls: "cad-prop-input" });
      styleSelect.style.padding = "2px 4px";
      styleSelect.style.fontSize = "0.8em";
      styleSelect.style.height = "auto";
      styleSelect.style.width = "auto";
      styleSelect.style.background = "var(--background-primary)";
      styleSelect.style.color = "var(--text-normal)";
      styleSelect.style.border = "1px solid var(--border-color)";
      styleSelect.style.borderRadius = "4px";
      WIDGET_STYLE_OPTIONS.forEach((opt) => {
        const o = styleSelect.createEl("option", { value: opt.value, text: opt.label });
        if (w.style === opt.value) o.selected = true;
      });
      styleSelect.addEventListener("change", async () => {
        w.style = styleSelect.value;
        await view.plugin.saveSettings();
        view.render();
      });
      const delBtn = actionsWrap.createEl("button", {
        cls: "cad-btn",
        text: "\xD7",
        attr: { style: "color: var(--text-error); padding: 2px 8px; font-weight: bold; border-color: var(--text-error); font-size: 1.1em; height: auto; border-radius: 4px; background: transparent;" }
      });
      delBtn.addEventListener("click", async () => {
        if (!confirm(`Delete chart "${widgetTitle(w)}"?`)) return;
        view.plugin.settings.prmDashboardWidgets = removeWidget(view.plugin.settings.prmDashboardWidgets, w.id);
        await view.plugin.saveSettings();
        view.render();
      });
      const body = card.createDiv({ cls: "cad-dash-card-body", attr: { style: "flex: 1; min-height: 180px; display: flex; flex-direction: column; justify-content: center; padding: 14px;" } });
      view._drawChart(body.createDiv(), w.style, chartData(partners, w, partnerDef));
    });
  };
  addWidgetBtn.addEventListener("click", () => {
    new CadenceWidgetCreateModal(view.app, "partner", async (newWidget) => {
      if (!view.plugin.settings.prmDashboardWidgets) {
        view.plugin.settings.prmDashboardWidgets = [];
      }
      view.plugin.settings.prmDashboardWidgets.push(newWidget);
      await view.plugin.saveSettings();
      view.render();
    }).open();
  });
  renderWidgets();
}
async function renderTeam(view, root) {
  return view.renderEntityList(root, "contact", teamListOptions());
}

// src/views/project-detail.ts
var import_obsidian23 = require("obsidian");
function projectDetailTitle(fm, basename) {
  return fm.name != null && fm.name !== "" ? fm.name : basename;
}
var PROJECT_STATUS_FALLBACK = ["active", "on_hold", "backlog", "done", "cancelled"];
var PROJECT_PRIORITY_FALLBACK = ["low", "medium", "high"];
function storedText(stored) {
  return stored == null ? "" : String(stored);
}
function projectPills(fm, statusOptions, priorityOptions) {
  const status = String(fm.status || "active");
  const priority = String(fm.priority || "");
  return [
    { key: "status", cls: "cad-pill cad-pill-" + status.toLowerCase().replace(/\s+/g, "-"), options: withStoredOption(statusOptions, storedText(fm.status)), current: status },
    { key: "priority", cls: "cad-pill cad-pill-prio-" + (priority || "medium").toLowerCase(), options: withStoredOption(priorityOptions, storedText(fm.priority)), current: priority || "medium" }
  ];
}
function projectMetaFields(def) {
  return def.fields.filter((f) => !(f.primary || f.key === "status" || f.key === "priority") && !(f.key === "type" && f.type !== "enum"));
}
function writeProjectFrontmatter(frontmatter, patch) {
  Object.entries(patch).forEach(([k, v]) => {
    if (v == null || v === "" || Array.isArray(v) && v.length === 0) delete frontmatter[k];
    else frontmatter[k] = v;
  });
}
function projectProgress(meta) {
  if (!(meta.total > 0)) return null;
  return { band: pctBand(meta.percent), label: `${meta.done}/${meta.total} milestones complete`, percent: `${meta.percent}%` };
}
var PROJECT_TEXT_SECTIONS = {
  brief: { label: "BRIEF", rows: 4, placeholder: "The outcome we want, why now." },
  scope: { label: "SCOPE", rows: 5, placeholder: "In scope / out of scope." },
  risks: { label: "RISKS", rows: 4, placeholder: "What could go wrong." },
  stakeholders: { label: "STAKEHOLDERS", rows: 3, placeholder: "Who cares about this project." },
  notes: { label: "NOTES", rows: 5, placeholder: "Anything else." }
};
function projectTextSection(key) {
  const { cleanLabel } = parseHeaderKey(key);
  const metaInfo = PROJECT_TEXT_SECTIONS[cleanLabel.toLowerCase()];
  return metaInfo ? { key, label: metaInfo.label, rows: metaInfo.rows, placeholder: metaInfo.placeholder } : null;
}
function milestoneCardTitle(rawKey, milestones) {
  const { cleanLabel } = parseHeaderKey(rawKey);
  return `${cleanLabel.toUpperCase()} \xB7 ${milestones.filter((m) => m.done).length}/${milestones.length}`;
}
function milestoneDateValue(date) {
  return date instanceof Date && !isNaN(date.getTime()) ? ymd(date) : null;
}
function milestoneDateFromInput(value) {
  return value ? parseYmd(value) : null;
}
function milestoneNotesFromInput(value) {
  return value.trim() ? value : "";
}
function commitMilestones(content, items, rawKey = "Milestones") {
  const body = stringifyMilestones(items);
  return replaceSection(content, `## ${rawKey}`, body || "");
}
function updateItem(items, idx, patch) {
  return items.map((item, i) => i === idx ? { ...item, ...patch } : item);
}
function removeItem(items, idx) {
  return items.filter((_, i) => i !== idx);
}
function addMilestone(items, today) {
  return [...items, { done: false, date: today, title: "" }];
}
function taskCardTitle(rawKey, tasks) {
  const open = tasks.filter((t) => !t.done).length;
  const { cleanLabel } = parseHeaderKey(rawKey);
  return `${cleanLabel.toUpperCase()} \xB7 ${open} open \xB7 ${tasks.length - open} done`;
}
function taskNotesItems(tasks) {
  return tasks.map((t) => ({ done: t.done, title: t.title }));
}
function commitTasks(content, items, rawKey = "Tasks") {
  const body = stringifyTasks(items);
  return replaceSection(content, `## ${rawKey}`, body || "");
}
function addTask(items) {
  return [...items, { done: false, title: "" }];
}
function taskBell(linked) {
  return {
    cls: "cad-btn cad-btn-sm cad-pd-task-bell" + (linked ? " linked" : ""),
    text: linked ? "\u{1F514}" : "\u{1F515}",
    title: linked ? `Edit reminder${linked.when ? " \xB7 " + reminderTimeStr(linked.when) : ""}` : "Set a reminder for this task"
  };
}
function newTaskReminder(text, projectPath) {
  return {
    text,
    when: null,
    repeat: "none",
    notes: "",
    project: projectPath
  };
}
var TASKNOTES_FOLDER = "TaskNotes/Tasks";
var TASKNOTES_PROMPT = {
  title: "Add a task (TaskNotes)",
  placeholder: "What needs doing?",
  cta: "Add"
};
function taskNotePath(folderPath, text, exists) {
  const cleanTitle = text.replace(/[\\/:*?"<>|]/g, "").trim();
  let filename = `${folderPath}/${cleanTitle}.md`;
  let counter = 1;
  while (exists(filename)) {
    filename = `${folderPath}/${cleanTitle} (${counter}).md`;
    counter++;
  }
  return filename;
}
function taskNoteContent(text, today, projectBasename) {
  return `---
title: ${JSON.stringify(text)}
status: open
scheduled: ${ymd(today)}
projects: "[[${projectBasename}]]"
priority: normal
---
`;
}
function replaceItems(items, next) {
  items.splice(0, items.length, ...next);
}
function rowHandle(items, item) {
  let current = item;
  return {
    index: () => items.indexOf(current),
    item: () => items.includes(current) ? current : void 0,
    patch(patch) {
      const at = items.indexOf(current);
      if (at === -1) return false;
      replaceItems(items, updateItem(items, at, patch));
      current = items[at];
      return true;
    },
    remove() {
      const at = items.indexOf(current);
      if (at === -1) return false;
      replaceItems(items, removeItem(items, at));
      return true;
    }
  };
}
async function renderProjectDetail(view, root, file) {
  root.addClass("cadence-project-detail");
  const def = ENTITIES.project;
  const cache = view.app.metadataCache.getFileCache(file) || {};
  const fm = Object.assign({}, cache.frontmatter || {});
  const meta = await readProjectMeta(view.app, file);
  const titleVal = projectDetailTitle(fm, file.basename);
  const head = root.createDiv({ cls: "cad-detail-header" });
  const headLeft = head.createDiv({ cls: "cad-detail-header-left" });
  const back = headLeft.createEl("button", { cls: "cad-btn cad-detail-back", text: "\u2190 Projects" });
  back.addEventListener("click", () => view.closeEntityDetail());
  const breadcrumb = headLeft.createDiv({ cls: "cad-detail-breadcrumb" });
  breadcrumb.createSpan({ cls: "cad-eyebrow", text: "PROJECT" });
  breadcrumb.createSpan({ cls: "cad-detail-title", text: String(titleVal) });
  breadcrumb.createDiv({ cls: "cad-detail-path", text: file.path });
  const headRight = head.createDiv({ cls: "cad-detail-header-right" });
  const savedBadge = headRight.createSpan({ cls: "cad-detail-saved", text: "" });
  const flashSaved = () => {
    savedBadge.setText("Saved");
    savedBadge.addClass("show");
    clearTimeout(savedBadge._t);
    savedBadge._t = setTimeout(() => savedBadge.removeClass("show"), 1400);
  };
  const openNote = headRight.createEl("button", { cls: "cad-btn", text: "Open as note" });
  openNote.addEventListener("click", () => view.app.workspace.openLinkText(file.path, "", false));
  const deleteBtn = headRight.createEl("button", { cls: "cad-btn cad-btn-danger", text: "Delete" });
  deleteBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    new CadenceConfirmModal(view.app, {
      title: "Delete Project",
      message: "Delete this project? This moves the file to trash.",
      confirmLabel: "Delete",
      onConfirm: () => {
        deleteBtn.blur();
        setTimeout(async () => {
          try {
            await view.app.vault.trash(file, true);
            new import_obsidian23.Notice(`Deleted project: ${file.basename}`);
            view.closeEntityDetail();
          } catch (e) {
            new import_obsidian23.Notice(`Delete failed: ${e.message}`);
          }
        }, 50);
      }
    }).open();
  });
  const hero = root.createDiv({ cls: "cad-pd-hero" });
  const pillRow = hero.createDiv({ cls: "cad-pd-pills" });
  const statusOptions = getEnumOptions("project", "status", PROJECT_STATUS_FALLBACK);
  const prioOptions = getEnumOptions("project", "priority", PROJECT_PRIORITY_FALLBACK);
  projectPills(fm, statusOptions, prioOptions).forEach((pill) => {
    const wrap = pillRow.createDiv({ cls: `cad-pd-select-wrap ${pill.cls}` });
    const sel = wrap.createEl("select", { cls: "cad-pd-select" });
    pill.options.forEach((opt) => {
      const o = sel.createEl("option", { value: opt, text: opt });
      if (pill.current === opt) o.selected = true;
    });
    sel.addEventListener("change", () => view._writeProjectFrontmatter(file, { [pill.key]: sel.value }, flashSaved));
  });
  const metaRow = hero.createDiv({ cls: "cad-pd-meta" });
  const mkMeta = (f) => {
    const label = f.label;
    const key = f.key;
    const fieldType = f.type || "text";
    const cell = metaRow.createDiv({ cls: "cad-pd-meta-cell" });
    cell.style.position = "relative";
    cell.createDiv({ cls: "cad-pd-meta-label", text: label.toUpperCase() });
    const current = fm[key];
    const control = metaControl(f);
    if (control === "chips") {
      view._renderChipInput(cell, f, current, {
        listKeys: COMPANY_LIST_KEYS,
        layout: "meta",
        save: (value) => view._writeProjectFrontmatter(file, { [key]: value }, flashSaved)
      });
    } else if (control === "enum") {
      const sel = cell.createEl("select", { cls: "cad-pd-meta-input" });
      sel.style.border = "none";
      sel.style.background = "transparent";
      sel.style.color = "var(--text-normal)";
      sel.style.outline = "none";
      sel.style.width = "100%";
      sel.createEl("option", { value: "", text: "\u2014" });
      const stored = enumCurrent(current);
      withStoredOption(f.options || [], stored).forEach((opt) => {
        const o = sel.createEl("option", { value: opt, text: opt });
        if (stored === opt) o.selected = true;
      });
      const commit = async () => {
        const val = sel.value || null;
        await view._writeProjectFrontmatter(file, { [key]: val }, flashSaved);
      };
      sel.addEventListener("change", commit);
    } else {
      const inp = cell.createEl("input", { type: metaInputType(fieldType), cls: "cad-pd-meta-input" });
      if (fieldType === "currency") inp.placeholder = `${view.plugin.settings.currency || "USD"} amount`;
      if (fieldType === "date" && current) {
        const date = dateInputValue(current);
        if (date !== null) inp.value = date;
      } else if (current != null) {
        inp.value = String(current);
      }
      let t;
      const commit = () => {
        view._writeProjectFrontmatter(file, { [key]: metaInputValue(fieldType, inp.value) }, flashSaved);
      };
      inp.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(commit, 350);
      });
      inp.addEventListener("blur", commit);
    }
  };
  projectMetaFields(def).forEach((f) => mkMeta(f));
  const progress = projectProgress(meta);
  if (progress) {
    const progWrap = hero.createDiv({ cls: "cad-proj-progress-wrap cad-pd-progress" });
    progWrap.dataset.pctBand = progress.band;
    const progLabel = progWrap.createDiv({ cls: "cad-proj-progress-label" });
    progLabel.createSpan({ text: progress.label });
    progLabel.createSpan({ cls: "cad-proj-progress-pct", text: progress.percent });
    const bar = progWrap.createDiv({ cls: "cad-proj-progress-bar" });
    const fill = bar.createDiv({ cls: "cad-proj-progress-fill" });
    fill.style.width = progress.percent;
  }
  const cols = root.createDiv({ cls: "cad-pd-cols" });
  const left = cols.createDiv({ cls: "cad-pd-col" });
  const right = cols.createDiv({ cls: "cad-pd-col" });
  const { left: leftKeys, right: rightKeys } = splitSectionColumns(Object.keys(meta.sections));
  leftKeys.forEach((key) => {
    view._renderDynamicH2Section(left, file, meta.sections, key, flashSaved);
  });
  rightKeys.forEach((key) => {
    const textSection = projectTextSection(key);
    if (textSection) {
      view._renderProjectTextSection(right, file, meta.sections, textSection, flashSaved);
    } else {
      view._renderDynamicH2Section(right, file, meta.sections, key, flashSaved);
    }
  });
  const crossSectionContainer = root.createDiv({ attr: { style: "padding: 0 32px; width: 100%; clear: both;" } });
  view._renderCrossSections(crossSectionContainer, "project", titleVal);
}
function renderMilestoneSection(view, parent, file, milestones, flashSaved, rawKey = "Milestones") {
  const card = parent.createDiv({ cls: "cad-pd-card" });
  const head = card.createDiv({ cls: "cad-pd-card-head" });
  head.createDiv({ cls: "cad-pd-card-title", text: milestoneCardTitle(rawKey, milestones) });
  const addBtn = head.createEl("button", { cls: "cad-btn cad-btn-sm", text: "+ Add" });
  const list = card.createDiv({ cls: "cad-pd-checklist" });
  const renderRows = (items) => {
    list.empty();
    if (!items.length) {
      list.createDiv({ cls: "cad-empty", text: "No milestones yet \u2014 add the first one." });
      return;
    }
    items.forEach((m) => {
      const mile = rowHandle(items, m);
      const wrapper = list.createDiv({ cls: "cad-mile-wrapper" });
      const row = wrapper.createDiv({ cls: "cad-pd-mile-row" + (m.done ? " done" : "") });
      const cb = row.createEl("input", { type: "checkbox" });
      cb.checked = !!m.done;
      cb.addEventListener("change", async () => {
        if (!mile.patch({ done: cb.checked })) return;
        await view._commitMilestones(file, items, flashSaved, false, rawKey);
      });
      const dateInp = row.createEl("input", { type: "date", cls: "cad-pd-mile-date" });
      const dateValue = milestoneDateValue(m.date);
      if (dateValue !== null) dateInp.value = dateValue;
      let dt;
      dateInp.addEventListener("input", () => {
        clearTimeout(dt);
        dt = setTimeout(async () => {
          if (!mile.patch({ date: milestoneDateFromInput(dateInp.value) })) return;
          await view._commitMilestones(file, items, flashSaved, true, rawKey);
        }, 350);
      });
      const titleInp = row.createEl("input", { type: "text", cls: "cad-pd-mile-title" });
      titleInp.value = m.title || "";
      titleInp.placeholder = "Milestone title";
      let tt;
      titleInp.addEventListener("input", () => {
        clearTimeout(tt);
        tt = setTimeout(async () => {
          if (!mile.patch({ title: titleInp.value })) return;
          await view._commitMilestones(file, items, flashSaved, true, rawKey);
        }, 400);
      });
      const del = row.createEl("button", { cls: "cad-btn cad-btn-sm cad-btn-danger", text: "\xD7" });
      del.title = "Delete milestone";
      del.addEventListener("click", async () => {
        if (!mile.remove()) return;
        await view._commitMilestones(file, items, flashSaved, false, rawKey);
      });
      const notesEl = wrapper.createDiv({ cls: "cad-mile-notes-section" });
      const renderNotesIdle = () => {
        notesEl.empty();
        const notes = mile.item()?.notes || "";
        const hasNotes = notes.trim().length > 0;
        if (hasNotes) {
          const preview = notesEl.createDiv({ cls: "cad-mile-notes-preview" });
          preview.setText(notes);
          preview.title = "Click to edit notes";
          preview.addEventListener("click", openNotesEditor);
        } else {
          const addBtn2 = notesEl.createEl("a", { cls: "cad-mile-notes-add", text: "+ Add notes" });
          addBtn2.addEventListener("click", (e) => {
            e.preventDefault();
            openNotesEditor();
          });
        }
      };
      const openNotesEditor = () => {
        notesEl.empty();
        const ta = notesEl.createEl("textarea", { cls: "cad-mile-notes-textarea" });
        ta.value = mile.item()?.notes || "";
        ta.placeholder = "Notes \u2014 context, follow-ups, what happened\u2026";
        const autosize = () => {
          ta.style.height = "auto";
          ta.style.height = Math.max(60, ta.scrollHeight + 2) + "px";
        };
        let nt;
        const saveNotes = async () => {
          const notes = milestoneNotesFromInput(ta.value);
          if (notes === (mile.item()?.notes || "")) return;
          if (!mile.patch({ notes })) return;
          await view._commitMilestones(file, items, flashSaved, true, rawKey);
        };
        ta.addEventListener("input", () => {
          autosize();
          clearTimeout(nt);
          nt = setTimeout(saveNotes, 400);
        });
        ta.addEventListener("blur", async () => {
          clearTimeout(nt);
          await saveNotes();
          renderNotesIdle();
        });
        setTimeout(() => {
          ta.focus();
          autosize();
        }, 0);
      };
      renderNotesIdle();
    });
  };
  renderRows(milestones);
  addBtn.addEventListener("click", async () => {
    replaceItems(milestones, addMilestone(milestones, /* @__PURE__ */ new Date()));
    await view._commitMilestones(file, milestones, flashSaved, false, rawKey);
  });
}
async function saveMilestones(view, file, items, flashSaved, skipRender = false, rawKey = "Milestones") {
  const snapshot = [...items];
  const content = await view.app.vault.read(file);
  await view.app.vault.modify(file, commitMilestones(content, snapshot, rawKey));
  if (typeof flashSaved === "function") flashSaved();
  if (!skipRender) view.render();
}
function renderTaskSection(view, parent, file, tasks, flashSaved, rawKey = "Tasks") {
  const card = parent.createDiv({ cls: "cad-pd-card" });
  const head = card.createDiv({ cls: "cad-pd-card-head" });
  let tasksList = tasks;
  let fileTaskNotes = [];
  if (view.plugin.settings.taskManagementSystem === "tasknotes") {
    fileTaskNotes = listTaskNotesTasksForFile(view.app, file);
    tasksList = taskNotesItems(fileTaskNotes);
  }
  head.createDiv({ cls: "cad-pd-card-title", text: taskCardTitle(rawKey, tasksList) });
  const addBtn = head.createEl("button", { cls: "cad-btn cad-btn-sm", text: "+ Add" });
  const list = card.createDiv({ cls: "cad-pd-checklist" });
  const renderRows = (items) => {
    list.empty();
    if (!items.length) {
      list.createDiv({ cls: "cad-empty", text: "No tasks yet." });
      return;
    }
    items.forEach((t, idx) => {
      const task = rowHandle(items, t);
      const row = list.createDiv({ cls: "cad-pd-task-row" + (t.done ? " done" : "") });
      const cb = row.createEl("input", { type: "checkbox" });
      cb.checked = !!t.done;
      cb.addEventListener("change", async () => {
        if (view.plugin.settings.taskManagementSystem === "tasknotes") {
          const taskObj = fileTaskNotes[idx];
          await toggleTaskNotesTask(view.app, taskObj.file, cb.checked);
          await view._propagateTaskComplete(taskObj.title, cb.checked, { kind: "tasknotes", file: taskObj.file });
        } else {
          await tickProjectTaskRow(view, file, items, task, cb.checked, flashSaved, rawKey);
        }
        view.render();
      });
      if (view.plugin.settings.taskManagementSystem === "tasknotes") {
        const taskObj = fileTaskNotes[idx];
        const taskLink = row.createEl("a", { cls: "cad-task-text", text: t.title });
        taskLink.style.cursor = "pointer";
        taskLink.style.flex = "1";
        taskLink.style.marginRight = "8px";
        taskLink.addEventListener("click", (ev) => {
          ev.preventDefault();
          view.app.workspace.openLinkText(taskObj.file.path, "", false);
        });
      } else {
        const titleInp = row.createEl("input", { type: "text", cls: "cad-pd-task-title" });
        titleInp.value = t.title || "";
        titleInp.placeholder = "Task description";
        let tt;
        titleInp.addEventListener("input", () => {
          clearTimeout(tt);
          tt = setTimeout(async () => {
            if (!task.patch({ title: titleInp.value })) return;
            await view._commitTasks(file, items, flashSaved, true, rawKey);
          }, 400);
        });
        const bellState = taskBell(findProjectTaskReminder(view.plugin, file.path, t.title || ""));
        const bell = row.createEl("button", { cls: bellState.cls, text: bellState.text });
        bell.title = bellState.title;
        bell.addEventListener("click", async () => {
          const taskText = titleInp.value.trim();
          if (!taskText) {
            new import_obsidian23.Notice("Add a task title first.");
            titleInp.focus();
            return;
          }
          if (!task.patch({ title: titleInp.value })) return;
          await view._commitTasks(file, items, flashSaved, true, rawKey);
          const existing = findProjectTaskReminder(view.plugin, file.path, taskText);
          if (existing) {
            new CadenceReminderEditModal(view.app, view.plugin, existing).open();
          } else {
            new CadenceReminderEditModal(view.app, view.plugin, newTaskReminder(taskText, file.path), { isNew: true }).open();
          }
        });
      }
      if (view.plugin.settings.taskManagementSystem !== "tasknotes") {
        const del = row.createEl("button", { cls: "cad-btn cad-btn-sm cad-btn-danger", text: "\xD7" });
        del.addEventListener("click", async () => {
          if (!task.remove()) return;
          await view._commitTasks(file, items, flashSaved, false, rawKey);
        });
      }
    });
  };
  renderRows(tasksList);
  addBtn.addEventListener("click", async () => {
    if (view.plugin.settings.taskManagementSystem === "tasknotes") {
      const commandId = "tasknotes:create-new-task";
      const commands = view.app.commands;
      const hasCommand = commands && commands.commands && commands.commands[commandId];
      if (hasCommand) {
        commands.executeCommandById(commandId);
        return;
      }
      const text = await view._prompt(TASKNOTES_PROMPT);
      if (!text) return;
      await ensureFolderSync(view.app, TASKNOTES_FOLDER);
      const filename = taskNotePath(TASKNOTES_FOLDER, text, (path) => !!view.app.vault.getAbstractFileByPath(path));
      await view.app.vault.create(filename, taskNoteContent(text, /* @__PURE__ */ new Date(), file.basename));
      view.render();
      return;
    }
    replaceItems(tasks, addTask(tasks));
    await view._commitTasks(file, tasks, flashSaved, false, rawKey);
  });
}
async function tickProjectTaskRow(view, file, items, task, checked, flashSaved, rawKey) {
  const idx = task.index();
  const ref = idx === -1 ? null : taskRefAt(items.map((item) => item.title || ""), idx);
  const content = await view.app.vault.read(file);
  const toggled = ref ? toggleProjectTaskByRef(content, rawKey, ref, checked) : null;
  if (!toggled) {
    new import_obsidian23.Notice("That task changed in the note, so nothing was ticked.");
    return;
  }
  await view.app.vault.modify(file, toggled.content);
  task.patch({ done: checked });
  if (typeof flashSaved === "function") flashSaved();
  if (toggled.taskText) await view._propagateTaskComplete(toggled.taskText, checked, { kind: "project", file });
}
async function saveTasks(view, file, items, flashSaved, skipRender = false, rawKey = "Tasks") {
  const snapshot = [...items];
  const content = await view.app.vault.read(file);
  await view.app.vault.modify(file, commitTasks(content, snapshot, rawKey));
  if (typeof flashSaved === "function") flashSaved();
  if (!skipRender) view.render();
}
async function saveProjectFrontmatter(view, file, patch, flashSaved) {
  try {
    await view.app.fileManager.processFrontMatter(file, (fm) => writeProjectFrontmatter(fm, patch));
    if (typeof flashSaved === "function") flashSaved();
  } catch (e) {
    new import_obsidian23.Notice(`Save failed: ${e.message}`);
  }
}

// src/views/projects-dashboard.ts
var import_obsidian24 = require("obsidian");
var PROJECT_STATUSES = ["active", "on_hold", "backlog", "done", "cancelled"];
var PROJECT_PRIORITIES = ["low", "medium", "high"];
var STATUS_ACCENTS = {
  active: "emerald",
  done: "mint",
  cancelled: "rose",
  backlog: "purple",
  on_hold: "warn",
  "on-hold": "warn"
};
var FALLBACK_ACCENTS = ["sky", "emerald", "rose", "purple", "warn", "mint"];
var PRIORITY_ACCENTS = {
  low: "sky",
  medium: "warn",
  high: "rose"
};
function dashboardOptions(def, key, fallback) {
  const field = def.fields.find((f) => f.key === key);
  return field && field.options && field.options.length ? field.options : fallback;
}
function statusAccent(status, index) {
  return STATUS_ACCENTS[status.toLowerCase().replace("-", "_")] || FALLBACK_ACCENTS[index % FALLBACK_ACCENTS.length];
}
function priorityAccent(priority) {
  return PRIORITY_ACCENTS[priority.toLowerCase()] || "sky";
}
function optionKey(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "_");
}
function projectsWith(projects, def, key, option) {
  return projects.filter((p) => optionKey(entityValue(p, key, def)) === optionKey(option));
}
function projectsSummary(projects, def) {
  const statuses = dashboardOptions(def, "status", PROJECT_STATUSES).map((status, index) => ({
    value: status,
    label: `${status.replace(/_/g, " ").toUpperCase()} PROJECTS`,
    accent: statusAccent(status, index),
    items: projectsWith(projects, def, "status", status)
  }));
  const carded = new Set(statuses.flatMap((c) => c.items));
  return {
    total: projects.length,
    statuses,
    otherStatuses: projects.filter((p) => !carded.has(p)),
    priorities: dashboardOptions(def, "priority", PROJECT_PRIORITIES).map((prio) => ({
      value: prio,
      label: `${prio.toUpperCase()} PRIORITY`,
      accent: priorityAccent(prio),
      items: projectsWith(projects, def, "priority", prio)
    }))
  };
}
function projectRowName(entity, def) {
  return entityValue(entity, "name", def) || entity.basename;
}
function dashRowPill(value) {
  if (!value) return null;
  return {
    cls: `cad-pill cad-pill-${String(value).toLowerCase().replace(/\s+/g, "-")}`,
    text: String(value).replace(/_/g, " ")
  };
}
function acceptsDrop(path, fromStage, stage) {
  return !(!path || fromStage === stage);
}
function dropChanges(current, target) {
  return optionKey(current) !== optionKey(target);
}
async function dropOntoCard(view, def, path, key, value) {
  const file = view.app.vault.getAbstractFileByPath(path);
  if (!file || !(file instanceof import_obsidian24.TFile)) return;
  if (entityKeyFromFile(view.app, file) !== "project") return;
  if (!dropChanges(entityValue(readEntity(view.app, file), key, def), value)) return;
  try {
    await view.app.fileManager.processFrontMatter(file, (fm) => {
      fm[key] = value;
    });
    new import_obsidian24.Notice(`Project ${key} set to ${value}`);
    view.render();
  } catch (e) {
    new import_obsidian24.Notice(`Failed to change ${key}: ${e.message}`);
  }
}
async function renderProjectsDashboard(view, root) {
  root.addClass("cadence-dashboard");
  root.addClass("cadence-list");
  const def = ENTITIES.project;
  if (!def) {
    view.renderComingSoon(root, view._resolveSurface(view.mode));
    return;
  }
  const allProjects = listEntities(view.app, "project");
  view._renderPageHeader(root, "Projects Dashboard", "Status \xB7 priority \xB7 custom analytics", (right) => {
    const newProj = right.createEl("button", { cls: "cad-btn primary", text: "+ New Project" });
    newProj.addEventListener("click", () => view._createEntityFromPrompt("project"));
  });
  const summary = projectsSummary(allProjects, def);
  const grid = root.createDiv({ cls: "cad-stat-grid", attr: { style: "padding-bottom: 24px;" } });
  const totalCard = grid.createDiv({ cls: "cad-stat-card", attr: { style: "padding: 20px; display: flex; flex-direction: column; justify-content: center; min-height: 280px; margin: 0; position: relative;" } });
  totalCard.dataset.accent = "sky";
  totalCard.createDiv({ cls: "cad-stat-label", text: "TOTAL PROJECTS", attr: { style: "font-weight: 700; letter-spacing: 0.12em;" } });
  totalCard.createDiv({ cls: "cad-stat-value", text: String(summary.total), attr: { style: "font-size: 3rem; font-weight: 800; margin-top: 12px; line-height: 1;" } });
  totalCard.createDiv({ cls: "cad-stat-sub", text: "Across all active and custom statuses", attr: { style: "margin-top: 12px; font-size: 0.85em; color: var(--text-muted);" } });
  const drawStatusCard = ({ value: status, label, accent, items }, droppable) => {
    const colCard = grid.createDiv({ cls: "cad-stat-card", attr: { style: "padding: 20px; display: flex; flex-direction: column; min-height: 280px; margin: 0; position: relative;" } });
    colCard.dataset.accent = accent;
    if (droppable) colCard.dataset.stage = status;
    colCard.createDiv({
      cls: "cad-stat-label",
      text: label,
      attr: { style: "font-weight: 700; letter-spacing: 0.12em;" }
    });
    colCard.createDiv({
      cls: "cad-stat-value",
      text: String(items.length),
      attr: { style: "font-size: 2.25rem; font-weight: 800; margin-top: 4px;" }
    });
    const list = colCard.createDiv({ attr: { style: "margin-top: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; padding-right: 4px; min-height: 120px;" } });
    if (droppable) {
      colCard.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        try {
          ev.dataTransfer.dropEffect = "move";
        } catch (_) {
        }
        colCard.style.boxShadow = "0 0 0 2px var(--interactive-accent)";
      });
      colCard.addEventListener("dragleave", (ev) => {
        if (!colCard.contains(ev.relatedTarget)) {
          colCard.style.boxShadow = "";
        }
      });
      colCard.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        colCard.style.boxShadow = "";
        const path = ev.dataTransfer.getData("text/cadence-entity");
        const fromStage = ev.dataTransfer.getData("text/cadence-stage-status");
        if (!acceptsDrop(path, fromStage, status)) return;
        await dropOntoCard(view, def, path, "status", status);
      });
    }
    if (!items.length) {
      list.createDiv({ cls: "cad-empty", text: "No projects", attr: { style: "text-align: center; color: var(--text-faint); margin-top: 32px;" } });
    } else {
      const isMobile = !!(import_obsidian24.Platform && import_obsidian24.Platform.isMobile);
      items.forEach((e) => {
        const row = list.createDiv({ cls: "cad-dash-row", attr: { style: "display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: var(--background-secondary); border-radius: 6px; cursor: pointer; border: 1px solid var(--border-color);" } });
        const nameEl = row.createDiv({ attr: { style: "font-weight: 500; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;" } });
        nameEl.setText(projectRowName(e, def));
        const pillData = dashRowPill(entityValue(e, "priority", def));
        if (pillData) {
          const pill = row.createDiv(pillData);
          pill.style.fontSize = "0.7em";
          pill.style.padding = "1px 6px";
        }
        row.addEventListener("click", (ev) => {
          ev.stopPropagation();
          view.openEntityDetail("project", e.file);
        });
        if (!isMobile) {
          row.draggable = true;
          row.addEventListener("dragstart", (ev) => {
            row.style.opacity = "0.4";
            try {
              ev.dataTransfer.effectAllowed = "move";
              ev.dataTransfer.setData("text/cadence-entity", e.file.path);
              ev.dataTransfer.setData("text/cadence-stage-status", status);
              ev.dataTransfer.setData("text/plain", `[[${e.file.basename}]]`);
            } catch (_) {
            }
          });
          row.addEventListener("dragend", () => {
            row.style.opacity = "";
          });
        }
      });
    }
  };
  summary.statuses.forEach((column) => drawStatusCard(column, true));
  if (summary.otherStatuses.length) {
    drawStatusCard({ value: "", label: "OTHER PROJECTS", accent: "sky", items: summary.otherStatuses }, false);
  }
  root.createDiv({ cls: "cad-section-label-lg", text: "PROJECTS BY PRIORITY" });
  const boardWrap = root.createDiv({ cls: "cad-stat-grid", attr: { style: "padding-top: 0; padding-bottom: 24px;" } });
  const renderBoard = () => {
    boardWrap.empty();
    summary.priorities.forEach(({ value: prio, label, accent, items }) => {
      const colCard = boardWrap.createDiv({ cls: "cad-stat-card", attr: { style: "padding: 20px; display: flex; flex-direction: column; min-height: 280px; margin: 0; position: relative;" } });
      colCard.dataset.accent = accent;
      colCard.dataset.stage = prio;
      colCard.createDiv({
        cls: "cad-stat-label",
        text: label,
        attr: { style: "font-weight: 700; letter-spacing: 0.12em;" }
      });
      colCard.createDiv({
        cls: "cad-stat-value",
        text: String(items.length),
        attr: { style: "font-size: 2.25rem; font-weight: 800; margin-top: 4px;" }
      });
      const list = colCard.createDiv({ attr: { style: "margin-top: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; padding-right: 4px; min-height: 120px;" } });
      colCard.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        try {
          ev.dataTransfer.dropEffect = "move";
        } catch (_) {
        }
        colCard.style.boxShadow = "0 0 0 2px var(--interactive-accent)";
      });
      colCard.addEventListener("dragleave", (ev) => {
        if (!colCard.contains(ev.relatedTarget)) {
          colCard.style.boxShadow = "";
        }
      });
      colCard.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        colCard.style.boxShadow = "";
        const path = ev.dataTransfer.getData("text/cadence-entity");
        const fromStage = ev.dataTransfer.getData("text/cadence-stage");
        if (!acceptsDrop(path, fromStage, prio)) return;
        await dropOntoCard(view, def, path, "priority", prio);
      });
      if (!items.length) {
        list.createDiv({ cls: "cad-empty", text: "No projects", attr: { style: "text-align: center; color: var(--text-faint); margin-top: 32px;" } });
      } else {
        const isMobile = !!(import_obsidian24.Platform && import_obsidian24.Platform.isMobile);
        items.forEach((e) => {
          const row = list.createDiv({ cls: "cad-dash-row", attr: { style: "display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: var(--background-secondary); border-radius: 6px; cursor: pointer; border: 1px solid var(--border-color);" } });
          const nameEl = row.createDiv({ attr: { style: "font-weight: 500; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;" } });
          nameEl.setText(projectRowName(e, def));
          const pillData = dashRowPill(entityValue(e, "status", def));
          if (pillData) {
            const pill = row.createDiv(pillData);
            pill.style.fontSize = "0.7em";
            pill.style.padding = "1px 6px";
          }
          row.addEventListener("click", (ev) => {
            ev.stopPropagation();
            view.openEntityDetail("project", e.file);
          });
          if (!isMobile) {
            row.draggable = true;
            row.addEventListener("dragstart", (ev) => {
              row.style.opacity = "0.4";
              try {
                ev.dataTransfer.effectAllowed = "move";
                ev.dataTransfer.setData("text/cadence-entity", e.file.path);
                ev.dataTransfer.setData("text/cadence-stage", prio);
                ev.dataTransfer.setData("text/plain", `[[${e.file.basename}]]`);
              } catch (_) {
              }
            });
            row.addEventListener("dragend", () => {
              row.style.opacity = "";
            });
          }
        });
      }
    });
  };
  renderBoard();
  const analyticsHeader = root.createDiv({ attr: { style: "display: flex; justify-content: space-between; align-items: center; padding: 24px 32px 8px 32px; margin-bottom: 16px;" } });
  analyticsHeader.createEl("span", {
    cls: "cad-section-label-lg",
    text: "ANALYTICS & CHARTS",
    attr: { style: "padding: 0; margin: 0; display: inline-block;" }
  });
  const addWidgetBtn = analyticsHeader.createEl("button", { cls: "cad-btn primary", text: "+ Add Custom Chart" });
  const widgetsGrid = root.createDiv({ cls: "cad-dash-cols", attr: { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-bottom: 24px; padding: 0 32px;" } });
  const renderWidgets = () => {
    widgetsGrid.empty();
    const widgets = dashboardWidgets(view.plugin.settings, "projectDashboardWidgets");
    if (widgets.length === 0) {
      const emptyWrap = widgetsGrid.createDiv({ attr: { style: "grid-column: 1 / -1; text-align: center; padding: 32px; background: var(--background-secondary); border-radius: 8px; border: 1px dashed var(--border-color);" } });
      emptyWrap.createDiv({ text: 'No custom charts added yet. Click "+ Add Custom Chart" to create one!', attr: { style: "color: var(--text-muted); font-size: 0.95em;" } });
      return;
    }
    widgets.forEach((w) => {
      const card = widgetsGrid.createDiv({ cls: "cad-dash-card", attr: { style: "margin: 0; display: flex; flex-direction: column;" } });
      const head = card.createDiv({ cls: "cad-dash-card-head", attr: { style: "display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;" } });
      head.createDiv({ cls: "cad-dash-card-title", text: widgetTitle(w).toUpperCase(), attr: { style: "font-weight: 700; font-size: 0.75rem; letter-spacing: 0.12em;" } });
      const actionsWrap = head.createDiv({ attr: { style: "display: flex; gap: 8px; align-items: center;" } });
      const styleSelect = actionsWrap.createEl("select", { cls: "cad-prop-input" });
      styleSelect.style.padding = "2px 4px";
      styleSelect.style.fontSize = "0.8em";
      styleSelect.style.height = "auto";
      styleSelect.style.width = "auto";
      styleSelect.style.background = "var(--background-primary)";
      styleSelect.style.color = "var(--text-normal)";
      styleSelect.style.border = "1px solid var(--border-color)";
      styleSelect.style.borderRadius = "4px";
      WIDGET_STYLE_OPTIONS.forEach((opt) => {
        const o = styleSelect.createEl("option", { value: opt.value, text: opt.label });
        if (w.style === opt.value) o.selected = true;
      });
      styleSelect.addEventListener("change", async () => {
        w.style = styleSelect.value;
        await view.plugin.saveSettings();
        view.render();
      });
      const delBtn = actionsWrap.createEl("button", {
        cls: "cad-btn",
        text: "\xD7",
        attr: { style: "color: var(--text-error); padding: 2px 8px; font-weight: bold; border-color: var(--text-error); font-size: 1.1em; height: auto; border-radius: 4px; background: transparent;" }
      });
      delBtn.addEventListener("click", async () => {
        if (!confirm(`Delete chart "${widgetTitle(w)}"?`)) return;
        view.plugin.settings.projectDashboardWidgets = removeWidget(view.plugin.settings.projectDashboardWidgets, w.id);
        await view.plugin.saveSettings();
        view.render();
      });
      const body = card.createDiv({ cls: "cad-dash-card-body", attr: { style: "flex: 1; min-height: 180px; display: flex; flex-direction: column; justify-content: center; padding: 14px;" } });
      view._drawChart(body.createDiv(), w.style, chartData(allProjects, w, def));
    });
  };
  addWidgetBtn.addEventListener("click", () => {
    new CadenceWidgetCreateModal(view.app, async (newWidget) => {
      if (!view.plugin.settings.projectDashboardWidgets) {
        view.plugin.settings.projectDashboardWidgets = [];
      }
      view.plugin.settings.projectDashboardWidgets.push(newWidget);
      await view.plugin.saveSettings();
      view.render();
    }).open();
  });
  renderWidgets();
}

// src/views/report-graph.ts
var TYPE_BY_FOLDER = Object.entries(ENTITIES).map(([key, def]) => [`${def.folder}/`, key]);
function graphNodeType(path) {
  for (const [folder, type] of TYPE_BY_FOLDER) if (path.startsWith(folder)) return type;
  return "note";
}
function graphNodeRadius(type) {
  return type === "company" ? 7 : type === "project" ? 6.5 : 5;
}
var GRAPH_TYPE_COLORS = {
  contact: "var(--graph-node-resolved, #f59e0b)",
  // warm orange
  company: "#0ea5e9",
  // sky blue
  partner: "#ec4899",
  // rose pink
  deal: "#10b981",
  // emerald green
  project: "#8b5cf6",
  // violet purple
  activity: "#64748b",
  // slate gray
  lead: "#a855f7",
  // purple
  registration: "#14b8a6",
  // teal
  commission: "#eab308",
  // amber
  certification: "#6366f1",
  // indigo
  sequence: "#84cc16",
  // lime
  note: "var(--graph-node, #94a3b8)"
  // gray
};
function graphNodeColor(type) {
  return GRAPH_TYPE_COLORS[type] || GRAPH_TYPE_COLORS.note;
}
var GRAPH_THEME = {
  line: "var(--graph-line, var(--border-color, rgba(255, 255, 255, 0.08)))",
  ring: "var(--background-secondary, #202020)",
  hover: "var(--text-normal, #ffffff)",
  label: "var(--text-muted, #999999)",
  font: "var(--font-interface, sans-serif)"
};
function resolveCssVar(value, lookup, depth = 0) {
  const trimmed = value.trim();
  const match = /^var\(\s*(--[\w-]+)\s*(?:,([\s\S]*))?\)$/.exec(trimmed);
  if (!match) return trimmed;
  if (depth > 8) return "";
  const own = lookup(match[1]).trim();
  const resolved = own ? resolveCssVar(own, lookup, depth + 1) : "";
  if (resolved) return resolved;
  return match[2] === void 0 ? "" : resolveCssVar(match[2], lookup, depth + 1);
}
function buildEntityGraph(files, resolvedLinks, random = Math.random, size = { width: 800, height: 400 }) {
  const nodes = [];
  const nodeMap = /* @__PURE__ */ new Map();
  files.filter((f) => f.path.startsWith("Cadence/")).forEach((file) => {
    const type = graphNodeType(file.path);
    const node = {
      id: file.path,
      name: file.basename,
      type,
      file,
      x: random() * size.width * 0.625 + size.width * 0.1875,
      y: random() * size.height * 0.625 + size.height * 0.25,
      vx: 0,
      vy: 0,
      radius: graphNodeRadius(type)
    };
    nodes.push(node);
    nodeMap.set(file.path, node);
  });
  const links = [];
  nodes.forEach((sourceNode) => {
    const targets = resolvedLinks[sourceNode.id] || {};
    for (const targetPath of Object.keys(targets)) {
      const targetNode = nodeMap.get(targetPath);
      if (targetNode) {
        links.push({ source: sourceNode, target: targetNode });
      }
    }
  });
  return { nodes, links };
}
function layoutGraph(graph, size, pinned = null) {
  const { nodes, links } = graph;
  for (let i = 0; i < nodes.length; i++) {
    const n1 = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const n2 = nodes[j];
      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const distSq = dx * dx + dy * dy || 1;
      const dist = Math.sqrt(distSq);
      if (dist < 160) {
        const force = (160 - dist) * 0.04;
        const fx = dx / dist * force;
        const fy = dy / dist * force;
        if (n1 !== pinned) {
          n1.vx -= fx;
          n1.vy -= fy;
        }
        if (n2 !== pinned) {
          n2.vx += fx;
          n2.vy += fy;
        }
      }
    }
  }
  links.forEach((l) => {
    const dx = l.target.x - l.source.x;
    const dy = l.target.y - l.source.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const desiredDist = 65;
    const force = (dist - desiredDist) * 9e-3;
    const fx = dx / dist * force;
    const fy = dy / dist * force;
    if (l.source !== pinned) {
      l.source.vx += fx;
      l.source.vy += fy;
    }
    if (l.target !== pinned) {
      l.target.vx -= fx;
      l.target.vy -= fy;
    }
  });
  const cx = size.width / 2;
  const cy = size.height / 2;
  nodes.forEach((n) => {
    if (n === pinned) return;
    const dx = cx - n.x;
    const dy = cy - n.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    let gravity = 3e-4;
    if (dist > 250) {
      gravity = 12e-4;
    }
    n.vx += dx * gravity;
    n.vy += dy * gravity;
    n.x += n.vx;
    n.y += n.vy;
    n.vx *= 0.92;
    n.vy *= 0.92;
  });
}
var SETTLE_SPEED = 0.01;
function graphSettled(nodes, pinned = null) {
  if (pinned) return false;
  return nodes.every((n) => Math.hypot(n.vx, n.vy) < SETTLE_SPEED);
}
function toGraphPoint(screen, transform) {
  return {
    x: (screen.x - transform.x) / transform.k,
    y: (screen.y - transform.y) / transform.k
  };
}
function nodeAt(nodes, point) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    const dx = point.x - n.x;
    const dy = point.y - n.y;
    if (dx * dx + dy * dy < (n.radius + 8) * (n.radius + 8)) {
      return n;
    }
  }
  return null;
}
function zoomAt(transform, mouse, deltaY) {
  const zoomIntensity = 0.05;
  const factor = Math.exp(-deltaY * zoomIntensity * 0.015);
  const newK = Math.max(0.15, Math.min(4, transform.k * factor));
  return {
    x: mouse.x - (mouse.x - transform.x) * (newK / transform.k),
    y: mouse.y - (mouse.y - transform.y) * (newK / transform.k),
    k: newK
  };
}
function graphTooltip(node) {
  return `${node.type.toUpperCase()}: ${node.name}`;
}
async function renderReportGraph(view, root) {
  root.addClass("cadence-report");
  view._renderPageHeader(root, "Graph View", "Relationship graph showing connections between contacts, companies, partners, projects, deals, and activities.");
  const graphCard = root.createDiv({ cls: "cad-home-card" });
  graphCard.style.padding = "16px";
  graphCard.style.height = "600px";
  graphCard.style.position = "relative";
  graphCard.style.overflow = "hidden";
  graphCard.style.backgroundColor = "var(--background-secondary)";
  graphCard.style.borderRadius = "8px";
  graphCard.style.border = "1px solid var(--border-color)";
  graphCard.style.marginTop = "24px";
  graphCard.style.marginBottom = "24px";
  const canvas = graphCard.createEl("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.cursor = "default";
  const tooltip = graphCard.createDiv();
  tooltip.style.position = "absolute";
  tooltip.style.pointerEvents = "none";
  tooltip.style.padding = "6px 10px";
  tooltip.style.backgroundColor = "var(--background-primary)";
  tooltip.style.border = "1px solid var(--border-color)";
  tooltip.style.borderRadius = "4px";
  tooltip.style.fontSize = "12px";
  tooltip.style.color = "var(--text-normal)";
  tooltip.style.display = "none";
  tooltip.style.zIndex = "100";
  tooltip.style.boxShadow = "var(--shadow-s)";
  let width = canvas.clientWidth || 800;
  let height = canvas.clientHeight || 400;
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  const ctx = canvas.getContext("2d");
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  const { nodes, links } = buildEntityGraph(
    view.app.vault.getMarkdownFiles(),
    view.app.metadataCache.resolvedLinks || {},
    Math.random,
    { width, height }
  );
  let transform = { x: 0, y: 0, k: 1 };
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let draggedNode = null;
  let hoveredNode = null;
  let dragStartPos = { x: 0, y: 0 };
  let hasMovedSinceDown = false;
  const resizeObserver = new ResizeObserver(() => {
    if (!canvas.isConnected) {
      stop();
      return;
    }
    if (!canvas.clientWidth) return;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.resetTransform();
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    requestDraw();
  });
  resizeObserver.observe(canvas);
  let frameQueued = false;
  const requestDraw = () => {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(step);
  };
  const stop = () => {
    resizeObserver.disconnect();
    view.app.workspace.offref(cssChange);
  };
  let palette = null;
  const resolvePalette = () => {
    const style = getComputedStyle(graphCard);
    const themed = (value) => resolveCssVar(value, (name) => style.getPropertyValue(name));
    const nodeColors = /* @__PURE__ */ new Map();
    return {
      line: themed(GRAPH_THEME.line),
      ring: themed(GRAPH_THEME.ring),
      hover: themed(GRAPH_THEME.hover),
      label: themed(GRAPH_THEME.label),
      font: themed(GRAPH_THEME.font),
      node: (type) => {
        if (!nodeColors.has(type)) nodeColors.set(type, themed(graphNodeColor(type)));
        return nodeColors.get(type);
      }
    };
  };
  const cssChange = view.app.workspace.on("css-change", () => {
    palette = null;
    requestDraw();
  });
  view.registerEvent(cssChange);
  const getMousePos = (e) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };
  const getCanvasPos = (e) => toGraphPoint(getMousePos(e), transform);
  const openNode = (node) => {
    if (node.type === "note") view.openEntityDetailFromFile(node.file);
    else view.openEntityDetail(node.type, node.file);
  };
  const press = (e) => {
    requestDraw();
    dragStartPos = { x: e.clientX, y: e.clientY };
    hasMovedSinceDown = false;
    const canvasPos = getCanvasPos(e);
    const found = nodeAt(nodes, canvasPos);
    if (found) {
      draggedNode = found;
    } else {
      isPanning = true;
      panStart = { x: e.clientX - transform.x, y: e.clientY - transform.y };
      canvas.style.cursor = "grabbing";
    }
  };
  const move = (e) => {
    requestDraw();
    const dist = Math.hypot(e.clientX - dragStartPos.x, e.clientY - dragStartPos.y);
    if (dist > 4) {
      hasMovedSinceDown = true;
    }
    const canvasPos = getCanvasPos(e);
    if (draggedNode) {
      draggedNode.x = canvasPos.x;
      draggedNode.y = canvasPos.y;
      draggedNode.vx = 0;
      draggedNode.vy = 0;
    } else if (isPanning) {
      transform.x = e.clientX - panStart.x;
      transform.y = e.clientY - panStart.y;
    }
    const found = nodeAt(nodes, canvasPos);
    hoveredNode = found;
    if (hoveredNode) {
      canvas.style.cursor = "pointer";
      tooltip.style.display = "block";
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      tooltip.style.left = `${screenX + 12}px`;
      tooltip.style.top = `${screenY + 12}px`;
      tooltip.setText(graphTooltip(hoveredNode));
    } else {
      canvas.style.cursor = isPanning ? "grabbing" : "default";
      tooltip.style.display = "none";
    }
  };
  const release = () => {
    requestDraw();
    const pressed = draggedNode;
    isPanning = false;
    draggedNode = null;
    canvas.style.cursor = hoveredNode ? "pointer" : "default";
    if (!hasMovedSinceDown && pressed) openNode(pressed);
  };
  const leave = () => {
    requestDraw();
    draggedNode = null;
    isPanning = false;
    hoveredNode = null;
    tooltip.style.display = "none";
    canvas.style.cursor = "default";
  };
  canvas.addEventListener("mousedown", (e) => press(e));
  canvas.addEventListener("mousemove", (e) => move(e));
  canvas.addEventListener("mouseup", () => release());
  canvas.addEventListener("mouseleave", () => leave());
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) {
      leave();
      return;
    }
    e.preventDefault();
    press(e.touches[0]);
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length !== 1 || !draggedNode && !isPanning) return;
    e.preventDefault();
    move(e.touches[0]);
  }, { passive: false });
  canvas.addEventListener("touchend", (e) => {
    if (!draggedNode && !isPanning) return;
    e.preventDefault();
    release();
    leave();
  }, { passive: false });
  canvas.addEventListener("touchcancel", () => leave());
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const mouse = getMousePos(e);
    transform = zoomAt(transform, mouse, e.deltaY);
    requestDraw();
  });
  const step = () => {
    frameQueued = false;
    if (!canvas.isConnected) {
      stop();
      return;
    }
    layoutGraph({ nodes, links }, { width, height }, draggedNode);
    const colors = palette ??= resolvePalette();
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);
    ctx.lineWidth = 0.8 / transform.k;
    ctx.strokeStyle = colors.line;
    links.forEach((l) => {
      ctx.beginPath();
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);
      ctx.stroke();
    });
    nodes.forEach((n) => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = colors.node(n.type);
      ctx.fill();
      if (n === hoveredNode) {
        ctx.strokeStyle = colors.hover;
        ctx.lineWidth = 2 / transform.k;
        ctx.stroke();
      } else {
        ctx.strokeStyle = colors.ring;
        ctx.lineWidth = 1.2 / transform.k;
        ctx.stroke();
      }
    });
    nodes.forEach((n) => {
      ctx.fillStyle = n === hoveredNode ? colors.hover : colors.label;
      ctx.font = n === hoveredNode ? `bold ${9.5 / transform.k}px ${colors.font}` : `${8.5 / transform.k}px ${colors.font}`;
      ctx.textAlign = "center";
      ctx.fillText(n.name, n.x, n.y + n.radius + 12 / transform.k);
    });
    ctx.restore();
    if (!graphSettled(nodes, draggedNode)) requestDraw();
  };
  requestDraw();
}

// src/views/reports.ts
var import_obsidian25 = require("obsidian");
var DAY_MS2 = 864e5;
function reportBar(value, max) {
  const ratio = value / max;
  return {
    height: `${value / max * 100}%`,
    band: value === 0 ? "empty" : ratio < 0.34 ? "low" : ratio < 0.67 ? "mid" : "high"
  };
}
function entityTitle(entity, key, def) {
  return entityValue(entity, key, def) || entity.basename;
}
var UNASSIGNED = "(unassigned)";
function ownerTotals(deals, def) {
  const byOwner = /* @__PURE__ */ new Map();
  deals.forEach((e) => {
    const owners = linkedNames(entityValue(e, "owner", def));
    (owners.length ? owners : [UNASSIGNED]).forEach((owner) => {
      const key = owner === UNASSIGNED ? "" : owner.toLowerCase();
      const total = byOwner.get(key) || { owner, count: 0, value: 0 };
      total.count++;
      total.value += dealValue(e, def);
      byOwner.set(key, total);
    });
  });
  return [...byOwner.values()];
}
function ownerRows(totals, limit, meta) {
  return [...totals].sort((a, b) => b.value - a.value).slice(0, limit).map((total) => ({
    title: total.owner,
    titleEntityKey: total.owner === UNASSIGNED ? null : "contact",
    meta: meta(total)
  }));
}
function pipelineReport(deals, def, stages, now) {
  const { open, won, lost, openValue, wonValue, lostValue, winRate } = crmSummary(deals, def);
  const confidence = stageConfidence(stages);
  const weighted = open.reduce((s, e) => s + dealValue(e, def) * confidence(entityValue(e, "stage", def)), 0);
  const cohorts = [
    { label: "0\u20137 DAYS", cutoff: 7, count: 0, value: 0, accent: "emerald" },
    { label: "8\u201330 DAYS", cutoff: 30, count: 0, value: 0, accent: "mint" },
    { label: "31\u201390 DAYS", cutoff: 90, count: 0, value: 0, accent: "warn" },
    { label: "90+ DAYS", cutoff: Infinity, count: 0, value: 0, accent: "rose" }
  ];
  open.forEach((e) => {
    const mtime = e.file && e.file.stat ? e.file.stat.mtime : now;
    const days = (now - mtime) / DAY_MS2;
    for (const c of cohorts) {
      if (days <= c.cutoff) {
        c.count++;
        c.value += dealValue(e, def);
        break;
      }
    }
  });
  const staleCutoff = now - 30 * DAY_MS2;
  const stale = open.filter((e) => e.file && e.file.stat && e.file.stat.mtime < staleCutoff).sort((a, b) => (a.file.stat.mtime || 0) - (b.file.stat.mtime || 0)).slice(0, 5).map((e) => ({
    title: entityTitle(e, "title", def),
    meta: `${entityValue(e, "stage", def) || "\u2014"} \xB7 ${Math.round((now - e.file.stat.mtime) / DAY_MS2)}d quiet \xB7 ${fmtValue(dealValue(e, def), "currency")}`,
    file: e.file
  }));
  return {
    open,
    won,
    lost,
    weighted,
    winRate,
    stats: [
      { label: "OPEN", value: open.length, sub: fmtValue(openValue, "currency"), accent: "sky" },
      { label: "WEIGHTED", value: fmtValue(weighted, "currency"), sub: "forecast on open", accent: "mint" },
      { label: "WON", value: won.length, sub: fmtValue(wonValue, "currency"), accent: "emerald" },
      { label: "LOST", value: lost.length, sub: fmtValue(lostValue, "currency"), accent: "rose" },
      { label: "WIN RATE", value: `${winRate}%`, sub: `${won.length}/${won.length + lost.length} closed`, accent: "warn" }
    ],
    byStage: dealsByStage(deals, def, stages).map(({ stage, items }) => ({ stage, count: items.length, value: sumValues(items, def) })),
    owners: ownerRows(
      ownerTotals(open, def),
      8,
      (o) => `${o.count} deal${o.count === 1 ? "" : "s"} \xB7 ${fmtValue(o.value, "currency")}`
    ),
    cohorts: cohorts.map(({ label, count, value, accent }) => ({
      label,
      value: String(count),
      accent,
      sub: fmtValue(value, "currency"),
      count,
      total: value
    })),
    stale
  };
}
function salesReport(deals, def, now) {
  const { won, lost, wonValue, lostValue, avgDeal } = crmSummary(deals, def);
  const total = wonValue + lostValue;
  const captureRate = total === 0 ? 0 : Math.round(wonValue / total * 100);
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ date: d, label: d.toLocaleDateString(void 0, { month: "short" }), revenue: 0, count: 0 });
  }
  won.forEach((e) => {
    const d = dealClosedAt(e, def);
    if (!d) return;
    const idx = months.findIndex((m) => m.date.getFullYear() === d.getFullYear() && m.date.getMonth() === d.getMonth());
    if (idx >= 0) {
      months[idx].revenue += dealValue(e, def);
      months[idx].count++;
    }
  });
  const maxRev = Math.max(1, ...months.map((m) => m.revenue));
  return {
    won,
    lost,
    captureRate,
    stats: [
      { label: "REVENUE", value: fmtValue(wonValue, "currency"), sub: countLabel(won.length, "deal"), accent: "emerald" },
      { label: "LOST", value: fmtValue(lostValue, "currency"), sub: countLabel(lost.length, "deal"), accent: "rose" },
      { label: "CAPTURE", value: `${captureRate}%`, sub: "of closed value", accent: "mint" },
      { label: "AVG DEAL", value: fmtValue(avgDeal, "currency"), sub: "won deals", accent: "sky" }
    ],
    months,
    bars: months.map((m) => ({
      label: m.label,
      title: `${m.label} \u2014 ${fmtValue(m.revenue, "currency")} \xB7 ${countLabel(m.count, "deal")}`,
      ...reportBar(m.revenue, maxRev)
    })),
    topWins: [...won].sort((a, b) => dealValue(b, def) - dealValue(a, def)).slice(0, 6).map((e) => ({
      title: entityTitle(e, "title", def),
      metaParts: [
        { text: entityValue(e, "company", def) || "\u2014", entityKey: "company" },
        { text: ` \xB7 ${fmtValue(dealValue(e, def), "currency")}` }
      ],
      file: e.file
    })),
    owners: ownerRows(ownerTotals(won, def), 6, (o) => `${o.count} won \xB7 ${fmtValue(o.value, "currency")}`)
  };
}
var TIER_ACCENT2 = { "Gold": "warn", "Silver": "sky", "Bronze": "rose", "Standard": "mint" };
function partnersReport(deals, partners, certs, now, defs = { deal: ENTITIES.deal, partner: ENTITIES.partner, certification: ENTITIES.certification }) {
  const { deal: dealDef, partner: partnerDef, certification: certDef } = defs;
  const partnersOf = partnerResolver(partners, partnerDef);
  const byPartner = /* @__PURE__ */ new Map();
  const addSource = (key, partner, e) => {
    if (!byPartner.has(key)) byPartner.set(key, { partner, items: [] });
    byPartner.get(key).items.push(e);
  };
  deals.forEach((e) => {
    const refs = partnersOf(e, dealDef);
    if (!refs.length) addSource("(direct)", "(direct)", e);
    refs.forEach(({ key, name, partner }) => {
      const link = partner ? partner.basename === name ? name : `[[${partner.basename}|${name}]]` : name;
      addSource(key, link, e);
    });
  });
  const partnerSourced = deals.filter((e) => partnersOf(e, dealDef).length > 0);
  const partnerWon = partnerSourced.filter((e) => dealOutcome(e, dealDef) === "won");
  const tierMap = /* @__PURE__ */ new Map();
  partners.forEach((p) => {
    const t = String(entityValue(p, "tier", partnerDef) || "Untiered");
    if (!tierMap.has(t)) tierMap.set(t, 0);
    tierMap.set(t, tierMap.get(t) + 1);
  });
  const horizon = now + 90 * DAY_MS2;
  const today = startOfDay(now).getTime();
  const upcoming = certs.map((e) => {
    const exp = entityValue(e, "expires", certDef);
    if (!exp) return null;
    const d = parseYmd(exp) ?? new Date(exp);
    if (isNaN(d.getTime())) return null;
    return { entity: e, date: d };
  }).filter((x) => x && x.date.getTime() >= today && x.date.getTime() <= horizon).sort((a, b) => a.date - b.date).slice(0, 8);
  return {
    partnerSourced,
    partnerWon,
    stats: [
      { label: "PARTNERS", value: partners.length, sub: "on the books", accent: "sky" },
      { label: "PARTNER DEALS", value: partnerSourced.length, sub: fmtValue(sumValues(partnerSourced, dealDef), "currency"), accent: "mint" },
      { label: "PARTNER REV", value: fmtValue(sumValues(partnerWon, dealDef), "currency"), sub: `${partnerWon.length} won`, accent: "emerald" },
      { label: "UNIQUE SOURCES", value: byPartner.size, sub: "including direct", accent: "warn" }
    ],
    tiers: [...tierMap.entries()].sort((a, b) => b[1] - a[1]).map(([tier, count]) => ({ label: tier.toUpperCase(), value: String(count), accent: TIER_ACCENT2[tier] || "sky" })),
    sources: [...byPartner.values()].sort((a, b) => b.items.length - a.items.length).slice(0, 10).map(({ partner, items }) => ({
      partner,
      count: items.length,
      meta: `${items.length} deal${items.length === 1 ? "" : "s"} \xB7 ${fmtValue(sumValues(items, dealDef), "currency")}`
    })),
    certs: upcoming.map((x) => ({
      title: entityTitle(x.entity, "name", certDef),
      metaParts: [
        { text: entityValue(x.entity, "partner", certDef) || "\u2014", entityKey: "partner" },
        { text: ` \xB7 expires ${fmtValue(x.date, "date")}` }
      ],
      file: x.entity.file
    }))
  };
}
var ACTIVITY_ACCENTS = ["sky", "mint", "warn", "rose"];
function orDash(value) {
  return value == null || String(value).trim() === "" ? "\u2014" : value;
}
function activityReport(activities, def, now, weekStartsOn) {
  const counts = /* @__PURE__ */ new Map();
  activities.forEach((e) => {
    const t = String(entityValue(e, "type", def) ?? "").trim().toLowerCase() || "unspecified";
    counts.set(t, (counts.get(t) || 0) + 1);
  });
  const stats = [{ label: "TOTAL", value: activities.length, sub: "all activities", accent: "emerald" }];
  let i = 0;
  counts.forEach((v, k) => stats.push({ label: k.toUpperCase(), value: v, sub: "", accent: ACTIVITY_ACCENTS[i++ % ACTIVITY_ACCENTS.length] }));
  const weekStart = startOfWeek(now, weekStartsOn);
  const weeks = [];
  for (let w = 7; w >= 0; w--) {
    const ws = addDays(weekStart, -w * 7);
    weeks.push({ start: ws, end: addDays(ws, 7), count: 0, label: ws.toLocaleDateString(void 0, { month: "short", day: "numeric" }) });
  }
  activities.forEach((e) => {
    const when = entityValue(e, "when", def);
    if (!when) return;
    const t = new Date(when).getTime();
    if (isNaN(t)) return;
    const idx = weeks.findIndex((w) => t >= w.start.getTime() && t < w.end.getTime());
    if (idx >= 0) weeks[idx].count++;
  });
  const maxWeek = Math.max(1, ...weeks.map((w) => w.count));
  const contactCounts = /* @__PURE__ */ new Map();
  activities.forEach((e) => {
    const w = String(entityValue(e, "with", def) || "").trim();
    if (!w) return;
    contactCounts.set(w, (contactCounts.get(w) || 0) + 1);
  });
  return {
    stats,
    weeks,
    bars: weeks.map((w) => ({ label: w.label, title: `Week of ${w.label} \u2014 ${countLabel(w.count, "activity")}`, ...reportBar(w.count, maxWeek) })),
    topContacts: [...contactCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([who, count]) => ({ title: who, titleEntityKey: "contact", meta: `${count} activit${count === 1 ? "y" : "ies"}` })),
    recent: newestFirst(activities, (e) => entityValue(e, "when", def)).slice(0, 10).map((e) => ({
      title: entityTitle(e, "subject", def),
      metaParts: [
        { text: orDash(entityValue(e, "type", def)) },
        { text: " \xB7 " },
        { text: orDash(entityValue(e, "with", def)), entityKey: "contact" },
        { text: ` \xB7 ${fmtValue(entityValue(e, "when", def), "date")}` }
      ],
      file: e.file
    }))
  };
}
var WEEKDAY_ACCENTS = ["emerald", "mint", "sky", "warn", "rose", "mint", "sky"];
var WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
function productivityDates(now, weekStartsOn) {
  const today = startOfDay(now);
  const first = addDays(startOfWeek(today, weekStartsOn), -11 * 7);
  const dates = [];
  for (let d = first; d.getTime() <= today.getTime(); d = addDays(d, 1)) dates.push(d);
  return dates;
}
function productivityReport(notes, now, settings) {
  const today = startOfDay(now);
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, -i));
  let totalOpen = 0, totalDone = 0, totalJournalChars = 0;
  let activeDays = 0;
  let streak = 0, streakBroken = false;
  const perDay = [];
  days.forEach((d, i) => {
    const c = notes.get(ymd(d));
    let open = 0, done = 0, jChars = 0, hasNote = false;
    if (c !== void 0) {
      hasNote = true;
      const p = parseSections(c, settings);
      ({ open, done } = countTaskLines(p.tasks));
      jChars = (p.journal || "").length;
    }
    perDay.push({ date: d, open, done, jChars, hasNote });
    totalOpen += open;
    totalDone += done;
    totalJournalChars += jChars;
    if (hasNote) activeDays++;
    if (!streakBroken) {
      if (hasNote && (done > 0 || jChars > 0)) streak++;
      else if (i > 0) streakBroken = true;
    }
  });
  const completion = totalOpen + totalDone === 0 ? 0 : Math.round(totalDone / (totalOpen + totalDone) * 100);
  const last14 = perDay.slice(0, 14).reverse();
  const max = Math.max(1, ...last14.map((p) => p.done));
  const weekStart = startOfWeek(today, settings.weekStartsOn);
  const weeks = [];
  for (let w = 11; w >= 0; w--) {
    const ws = addDays(weekStart, -w * 7);
    let wd = 0, wo = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      if (d.getTime() > today.getTime()) break;
      const c = notes.get(ymd(d));
      if (c !== void 0) {
        const counts = countTaskLines(parseSections(c, settings).tasks);
        wd += counts.done;
        wo += counts.open;
      }
    }
    weeks.push({ done: wd, open: wo, label: ws.toLocaleDateString(void 0, { month: "short", day: "numeric" }) });
  }
  const maxWeek = Math.max(1, ...weeks.map((w) => w.done));
  const wsOn = settings.weekStartsOn ?? 1;
  const dayBuckets = Array.from({ length: 7 }, () => ({ done: 0, open: 0 }));
  perDay.forEach((p) => {
    const idx = (p.date.getDay() - wsOn + 7) % 7;
    dayBuckets[idx].done += p.done;
    dayBuckets[idx].open += p.open;
  });
  const dayLabels = WEEKDAY_LABELS.map((_, i) => WEEKDAY_LABELS[(wsOn + i) % 7]);
  return {
    totalOpen,
    totalDone,
    journalChars: totalJournalChars,
    activeDays,
    streak,
    completion,
    stats: [
      { label: "COMPLETION", value: `${completion}%`, sub: `${totalDone}/${totalOpen + totalDone} tasks`, accent: "emerald" },
      { label: "STREAK", value: `${streak}d`, sub: "consecutive active days", accent: "mint" },
      { label: "ACTIVE", value: `${activeDays}/30`, sub: "days with a note", accent: "sky" },
      { label: "JOURNAL", value: totalJournalChars.toLocaleString(), sub: "characters written", accent: "warn" }
    ],
    days: last14.map((p) => ({
      label: String(p.date.getDate()),
      title: `${p.date.toLocaleDateString()} \u2014 ${p.done} done, ${p.open} open`,
      ...reportBar(p.done, max)
    })),
    weeks: weeks.map((w) => ({ label: w.label, title: `Week of ${w.label} \u2014 ${w.done} done, ${w.open} open`, ...reportBar(w.done, maxWeek) })),
    weekdays: dayBuckets.map((b, i) => {
      const total = b.done + b.open;
      const pct = total === 0 ? 0 : Math.round(b.done / total * 100);
      return { label: dayLabels[i], value: total === 0 ? "\u2014" : `${pct}%`, accent: WEEKDAY_ACCENTS[i], sub: total === 0 ? "no data" : `${b.done}/${total}` };
    })
  };
}
function drawStats(root, cards) {
  const grid = root.createDiv({ cls: "cad-stat-grid" });
  const stat = (label, value, sub, accent) => {
    const c = grid.createDiv({ cls: "cad-stat-card" });
    if (accent) c.dataset.accent = accent;
    c.createDiv({ cls: "cad-stat-label", text: label });
    c.createDiv({ cls: "cad-stat-value", text: String(value) });
    if (sub) c.createDiv({ cls: "cad-stat-sub", text: sub });
  };
  cards.forEach((card) => stat(card.label, card.value, card.sub, card.accent));
}
function drawBars(chart, bars) {
  bars.forEach((b) => {
    const col = chart.createDiv({ cls: "cad-bar-col" });
    const bar = col.createDiv({ cls: "cad-bar" });
    bar.style.height = b.height;
    bar.dataset.band = b.band;
    bar.title = b.title;
    col.createDiv({ cls: "cad-bar-label", text: b.label });
  });
}
function drawMiniStats2(body, minis) {
  minis.forEach((m) => {
    const mini = body.createDiv({ cls: "cad-mini-stat" });
    mini.dataset.accent = m.accent;
    mini.createDiv({ cls: "cad-mini-stat-value", text: m.value });
    mini.createDiv({ cls: "cad-mini-stat-label", text: m.label });
    if (m.sub !== void 0) {
      const sub = mini.createDiv({ cls: "cad-stat-sub" });
      sub.style.marginTop = "4px";
      sub.setText(m.sub);
    }
  });
}
function twoColumns(root) {
  const cols = root.createDiv({ cls: "cad-dash-cols" });
  return { left: cols.createDiv({ cls: "cad-dash-col" }), right: cols.createDiv({ cls: "cad-dash-col" }) };
}
async function renderReportPipeline(view, root) {
  root.addClass("cadence-report");
  const def = ENTITIES.deal;
  const report = pipelineReport(listEntities(view.app, "deal"), def, getDealStages(), Date.now());
  view._renderPageHeader(root, "Pipeline report", "Coverage, forecast and aging across all deals");
  drawStats(root, report.stats);
  root.createDiv({ cls: "cad-section-label-lg", text: "BY STAGE" });
  const tableWrap = root.createDiv({ cls: "cad-table-wrap" });
  const table = tableWrap.createEl("table", { cls: "cad-table" });
  const trh = table.createEl("thead").createEl("tr");
  ["Stage", "Count", "Value"].forEach((h) => trh.createEl("th", { text: h }));
  const tbody = table.createEl("tbody");
  report.byStage.forEach(({ stage, count, value }) => {
    const tr = tbody.createEl("tr");
    tr.createEl("td", { text: stage });
    tr.createEl("td", { text: String(count) });
    tr.createEl("td", { text: fmtValue(value, "currency") });
  });
  const { left, right } = twoColumns(root);
  view._dashCardSection(left, `OPEN PIPELINE BY OWNER \xB7 top ${report.owners.length}`, report.owners, "No open deals to attribute.");
  const agingCard = right.createDiv({ cls: "cad-dash-card" });
  agingCard.createDiv({ cls: "cad-dash-card-head" }).createDiv({ cls: "cad-dash-card-title", text: "AGING \xB7 OPEN DEALS BY LAST EDIT" });
  drawMiniStats2(agingCard.createDiv({ cls: "cad-dash-card-body cad-mini-stat-row" }), report.cohorts);
  view._dashCardSection(right, "STALE \xB7 30+ DAYS NO EDITS", report.stale, "No deals over 30 days quiet \u2014 nice.");
}
async function renderReportSales(view, root) {
  root.addClass("cadence-report");
  const report = salesReport(listEntities(view.app, "deal"), ENTITIES.deal, /* @__PURE__ */ new Date());
  view._renderPageHeader(root, "Sales report", "Closed-won and lost \xB7 performance over time");
  drawStats(root, report.stats);
  root.createDiv({ cls: "cad-section-label-lg", text: "REVENUE \u2014 LAST 6 MONTHS" });
  drawBars(root.createDiv({ cls: "cad-bar-chart cad-bar-chart-tall" }), report.bars);
  const { left, right } = twoColumns(root);
  view._dashCardSection(left, "TOP WINS \xB7 top 6", report.topWins, "No wins logged yet \u2014 close one and tag it Won.");
  view._dashCardSection(right, "OWNER LEADERBOARD \xB7 top 6 by revenue", report.owners, "No revenue attributed to owners yet.");
}
async function renderReportPartners(view, root) {
  root.addClass("cadence-report");
  const report = partnersReport(
    listEntities(view.app, "deal"),
    listEntities(view.app, "partner"),
    listEntities(view.app, "certification"),
    Date.now()
  );
  view._renderPageHeader(root, "Partners report", "Partner-sourced revenue, tier mix, certification health");
  drawStats(root, report.stats);
  if (report.tiers.length) {
    root.createDiv({ cls: "cad-section-label-lg", text: "PARTNERS BY TIER" });
    const tierCard = root.createDiv({ cls: "cad-dash-card" });
    tierCard.style.margin = "0 36px 18px 36px";
    drawMiniStats2(tierCard.createDiv({ cls: "cad-dash-card-body cad-mini-stat-row" }), report.tiers);
  }
  const { left, right } = twoColumns(root);
  const dealsByPartnerCard = left.createDiv({ cls: "cad-dash-card" });
  dealsByPartnerCard.createDiv({ cls: "cad-dash-card-head" }).createDiv({ cls: "cad-dash-card-title", text: "DEALS BY PARTNER" });
  const dbpBody = dealsByPartnerCard.createDiv({ cls: "cad-dash-card-body" });
  if (!report.partnerSourced.length) {
    dbpBody.createDiv({ cls: "cad-empty", text: "No deals attributed to partners yet." });
  } else {
    report.sources.forEach(({ partner: p, meta }) => {
      const row = dbpBody.createDiv({ cls: "cad-dash-row" });
      const titleDiv = row.createDiv({ cls: "cad-dash-row-title" });
      if (p && p !== "(direct)") {
        view._renderEntityLinks(titleDiv, p, "partner");
      } else {
        titleDiv.setText(p || "");
      }
      row.createDiv({ cls: "cad-dash-row-meta", text: meta });
    });
  }
  view._dashCardSection(right, "CERTS EXPIRING \xB7 NEXT 90 DAYS", report.certs, "No certifications expiring in the next 90 days.");
}
async function renderReportActivity(view, root) {
  root.addClass("cadence-report");
  const report = activityReport(listEntities(view.app, "activity"), ENTITIES.activity, /* @__PURE__ */ new Date(), view.plugin.settings.weekStartsOn);
  view._renderPageHeader(root, "Activity report", "Calls, meetings, emails and notes \u2014 mix and momentum");
  drawStats(root, report.stats);
  root.createDiv({ cls: "cad-section-label-lg", text: "ACTIVITY \u2014 LAST 8 WEEKS" });
  drawBars(root.createDiv({ cls: "cad-bar-chart cad-bar-chart-tall" }), report.bars);
  const { left, right } = twoColumns(root);
  view._dashCardSection(left, "TOP CONTACTS \xB7 by activity count", report.topContacts, "No activities tagged with a contact yet.");
  view._dashCardSection(right, "RECENT ACTIVITY \xB7 last 10", report.recent, "No activities yet \u2014 log one under CRM > Activities.");
}
async function renderProductivity(view, root) {
  root.addClass("cadence-report");
  const settings = view.plugin.settings;
  const now = /* @__PURE__ */ new Date();
  const notes = /* @__PURE__ */ new Map();
  for (const d of productivityDates(now, settings.weekStartsOn)) {
    const f = view.app.vault.getAbstractFileByPath(dailyNotePath(settings, d));
    if (f && f instanceof import_obsidian25.TFile) notes.set(ymd(d), await view.app.vault.read(f));
  }
  const report = productivityReport(notes, now, settings);
  view._renderPageHeader(root, "Productivity", "Last 30 days \xB7 across your daily notes");
  drawStats(root, report.stats);
  root.createDiv({ cls: "cad-section-label-lg", text: "TASKS DONE \u2014 LAST 14 DAYS" });
  drawBars(root.createDiv({ cls: "cad-bar-chart" }), report.days);
  root.createDiv({ cls: "cad-section-label-lg", text: "COMPLETION TREND \u2014 LAST 12 WEEKS" });
  drawBars(root.createDiv({ cls: "cad-bar-chart cad-bar-chart-tall" }), report.weeks);
  root.createDiv({ cls: "cad-section-label-lg", text: "COMPLETION BY WEEKDAY \xB7 LAST 30 DAYS" });
  const dayCard = root.createDiv({ cls: "cad-dash-card" });
  dayCard.style.margin = "0 36px 24px 36px";
  drawMiniStats2(dayCard.createDiv({ cls: "cad-dash-card-body cad-mini-stat-row" }), report.weekdays);
}

// src/views/task-links.ts
var import_obsidian26 = require("obsidian");
function taskLinkKey(dailyPath, text) {
  return `${dailyPath}::${(text || "").trim()}`;
}
function getTaskProjectLink(view, dailyPath, text) {
  const map = view.plugin.settings && view.plugin.settings.taskProjectLinks || {};
  return map[view._taskLinkKey(dailyPath, text)] || null;
}
async function setTaskProjectLink(view, dailyPath, text, projectPath) {
  if (!view.plugin.settings.taskProjectLinks) view.plugin.settings.taskProjectLinks = {};
  const key = view._taskLinkKey(dailyPath, text);
  if (projectPath) {
    view.plugin.settings.taskProjectLinks[key] = projectPath;
  } else {
    delete view.plugin.settings.taskProjectLinks[key];
  }
  await view.plugin.saveSettings();
  view.render();
}
function openTaskProjectPicker(view, dailyPath, text, currentLink) {
  const projectFiles = listEntityFiles(view.app, "project");
  if (!projectFiles.length) {
    new import_obsidian26.Notice("No projects yet. Create one in Planner \u2192 Projects first.");
    return;
  }
  const projects = projectFiles.map((f) => ({
    file: f,
    name: projectNameFromPath(view.app, f.path)
  }));
  const picker = new class extends import_obsidian26.SuggestModal {
    constructor(app, projs, hasLink) {
      super(app);
      this.projs = projs;
      this.hasLink = hasLink;
      this.setPlaceholder(hasLink ? 'Pick a project (or type "unlink" to remove)' : "Pick a project to link this task to");
    }
    getSuggestions(query) {
      const q = (query || "").toLowerCase();
      const matches = this.projs.filter((p) => p.name.toLowerCase().includes(q));
      if (this.hasLink && (q === "" || "unlink".includes(q))) {
        return [{ unlink: true, name: "\u2014 Remove link \u2014" }, ...matches];
      }
      return matches;
    }
    renderSuggestion(item, el) {
      if (item.unlink) {
        el.setText(item.name);
        el.style.color = "var(--text-error, #c0392b)";
      } else {
        el.setText("\u{1F4C1}  " + item.name);
      }
    }
    onChooseSuggestion(item) {
      if (item.unlink) view._setTaskProjectLink(dailyPath, text, null);
      else view._setTaskProjectLink(dailyPath, text, item.file.path);
    }
  }(view.app, projects, !!currentLink);
  picker.open();
}
function propagationTargets(text, done, source, reminders, dailyNoteFolder, now, taskProjectLinks = {}) {
  const t = String(text || "").trim();
  if (!t) return null;
  source = source || {};
  const matches = reminders.filter((r) => r.text && r.text.trim() === t);
  const reminderIds = [];
  for (const r of matches) {
    if (source.kind === "reminder" && r.id === source.id) continue;
    if (!!r.done === !!done) continue;
    reminderIds.push(r.id);
  }
  const projectPaths = [];
  const sourceProject = source.kind === "project" && source.file ? source.file.path : null;
  const addProject = (path) => {
    if (!path || path === sourceProject) return;
    if (projectPaths.includes(path)) return;
    projectPaths.push(path);
  };
  for (const r of matches) addProject(r.project);
  const datesToCheck = /* @__PURE__ */ new Set([ymd(now)]);
  matches.forEach((r) => {
    if (r.when) {
      const d = new Date(r.when);
      if (!isNaN(d.getTime())) datesToCheck.add(ymd(d));
    }
    if (r.createdAt) {
      const d = new Date(r.createdAt);
      if (!isNaN(d.getTime())) datesToCheck.add(ymd(d));
    }
  });
  if (source.kind === "daily" && source.date) datesToCheck.add(ymd(source.date));
  const dailyPaths = [];
  const linkedFrom = source.kind === "daily" && source.file ? [source.file.path] : [];
  for (const dateStr of datesToCheck) {
    const path = dailyNoteFolder ? `${dailyNoteFolder.replace(/\/$/, "")}/${dateStr}.md` : `${dateStr}.md`;
    if (!linkedFrom.includes(path)) linkedFrom.push(path);
    if (source.kind === "daily" && source.file && source.file.path === path) continue;
    dailyPaths.push(path);
  }
  for (const path of linkedFrom) addProject(taskProjectLinks[taskLinkKey(path, t)]);
  return { text: t, reminderIds, projectPaths, dailyPaths };
}
async function propagateTaskComplete(view, text, done, source) {
  const settings = view.plugin.settings;
  const targets = propagationTargets(
    text,
    done,
    source,
    (settings.reminders || []).slice(),
    settings.dailyNoteFolder,
    /* @__PURE__ */ new Date(),
    settings.taskProjectLinks || {}
  );
  if (!targets) return;
  for (const id of targets.reminderIds) {
    if (done) await view.plugin.completeReminder(id);
    else await view.plugin.updateReminder(id, { done: false });
  }
  for (const path of targets.projectPaths) {
    const file = view.app.vault.getAbstractFileByPath(path);
    if (!file || !(file instanceof import_obsidian26.TFile)) continue;
    await view._tickProjectTaskByText(file, targets.text, !!done);
  }
  for (const path of targets.dailyPaths) {
    const file = view.app.vault.getAbstractFileByPath(path);
    if (!file || !(file instanceof import_obsidian26.TFile)) continue;
    await view._tickDailyNoteTaskByText(file, targets.text, !!done);
  }
}
async function readTickTarget(view, file) {
  try {
    return await view.app.vault.read(file);
  } catch (error) {
    new import_obsidian26.Notice(`Couldn't update ${file.path}: ${error.message}`);
    return null;
  }
}
async function tickProjectTaskByText(view, file, text, done) {
  const content = await readTickTarget(view, file);
  if (content === null) return;
  const next = tickProjectTasks(content, text, done);
  if (next === null) return;
  await view.app.vault.modify(file, next);
}
async function tickDailyNoteTaskByText(view, file, text, done) {
  const content = await readTickTarget(view, file);
  if (content === null) return;
  const next = tickDailyTasks(content, view.plugin.settings, text, done);
  if (next === null) return;
  await view.app.vault.modify(file, next);
}
async function tickDailyNoteTask(view, file, ref, checked, date) {
  const content = await view.app.vault.read(file);
  const toggled = toggleDailyTaskByRef(content, view.plugin.settings, ref, checked);
  if (!toggled) {
    new import_obsidian26.Notice("That task changed in the note, so nothing was ticked.");
    return;
  }
  await view.app.vault.modify(file, toggled.content);
  if (toggled.taskText) {
    await view._propagateTaskComplete(toggled.taskText, checked, { kind: "daily", file, date });
  }
}

// src/views/templates.ts
var import_obsidian29 = require("obsidian");

// src/modals/chart-section.ts
var import_obsidian28 = require("obsidian");

// src/modals/cross-section.ts
var import_obsidian27 = require("obsidian");
function sectionId(prefix) {
  return prefix + Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}
function noLinkFieldMessage(targetEntity, linkField) {
  if (linkField) return null;
  return `${ENTITIES[targetEntity]?.plural || targetEntity} have no field to link by.`;
}
function buildCrossSectionConfig(form) {
  return {
    id: sectionId("xs_"),
    parentEntity: form.parentEntity,
    targetEntity: form.targetEntity,
    linkField: form.linkField,
    viewType: form.viewType
  };
}
var CadenceCrossSectionModal = class extends import_obsidian27.Modal {
  constructor(app, parentEntity, onSubmit) {
    super(app);
    this.parentEntity = parentEntity;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("cad-prompt-modal");
    contentEl.createEl("h3", { text: "Add Cross-Linked Section" });
    contentEl.createEl("label", { text: "Target Entity to display:", attr: { style: "display: block; font-weight: 500; font-size: 0.85em; margin-bottom: 4px; margin-top: 12px;" } });
    const selectTarget = contentEl.createEl("select");
    selectTarget.style.width = "100%";
    selectTarget.style.padding = "6px 8px";
    selectTarget.style.background = "var(--background-primary)";
    selectTarget.style.color = "var(--text-normal)";
    selectTarget.style.border = "1px solid var(--border-color)";
    selectTarget.style.borderRadius = "4px";
    Object.entries(ENTITIES).forEach(([key, def]) => {
      if (key === this.parentEntity) return;
      selectTarget.createEl("option", { value: key, text: def.plural });
    });
    contentEl.createEl("label", { text: "Linked Field (in target entity):", attr: { style: "display: block; font-weight: 500; font-size: 0.85em; margin-bottom: 4px; margin-top: 12px;" } });
    const selectField = contentEl.createEl("select");
    selectField.style.width = "100%";
    selectField.style.padding = "6px 8px";
    selectField.style.background = "var(--background-primary)";
    selectField.style.color = "var(--text-normal)";
    selectField.style.border = "1px solid var(--border-color)";
    selectField.style.borderRadius = "4px";
    const populateFields = () => {
      selectField.empty();
      const target = selectTarget.value;
      const def = ENTITIES[target];
      if (def && def.fields) {
        def.fields.forEach((f) => {
          if (f.primary) return;
          selectField.createEl("option", { value: f.key, text: `${f.label} (${f.key})` });
        });
      }
    };
    selectTarget.addEventListener("change", populateFields);
    populateFields();
    contentEl.createEl("label", { text: "Display View Layout:", attr: { style: "display: block; font-weight: 500; font-size: 0.85em; margin-bottom: 4px; margin-top: 12px;" } });
    const selectView = contentEl.createEl("select");
    selectView.style.width = "100%";
    selectView.style.padding = "6px 8px";
    selectView.style.background = "var(--background-primary)";
    selectView.style.color = "var(--text-normal)";
    selectView.style.border = "1px solid var(--border-color)";
    selectView.style.borderRadius = "4px";
    [
      { value: "table", text: "Table \u{1F4CB}" },
      { value: "tile", text: "Tiles / Cards \u{1F3B4}" },
      { value: "kanban", text: "Kanban Board \u{1F5C2}\uFE0F" }
    ].forEach((opt) => {
      selectView.createEl("option", { value: opt.value, text: opt.text });
    });
    const submit = () => {
      const blank = noLinkFieldMessage(selectTarget.value, selectField.value);
      if (blank) {
        new import_obsidian27.Notice(blank);
        return;
      }
      this.onSubmit(buildCrossSectionConfig({
        parentEntity: this.parentEntity,
        targetEntity: selectTarget.value,
        linkField: selectField.value,
        viewType: selectView.value
      }));
      this.close();
    };
    const row = contentEl.createDiv();
    row.style.display = "flex";
    row.style.justifyContent = "flex-end";
    row.style.gap = "8px";
    row.style.marginTop = "18px";
    const cancel = row.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const ok = row.createEl("button", { text: "Add Section", cls: "mod-cta" });
    ok.addEventListener("click", submit);
  }
};

// src/modals/chart-section.ts
function buildChartSectionConfig(form) {
  return {
    id: sectionId("ch_"),
    parentEntity: form.parentEntity,
    targetEntity: form.targetEntity,
    linkField: form.linkField,
    groupField: form.groupField,
    style: form.style
  };
}
function chartSectionDefaults(fieldKeys, parentEntity) {
  const parentDef = ENTITIES[parentEntity];
  const linkField = parentDef ? fieldKeys.find((k) => k === parentEntity || k === parentDef.label.toLowerCase()) : void 0;
  const groupField = fieldKeys.find((k) => ["stage", "status", "type", "priority"].includes(k));
  return { linkField, groupField };
}
var CadenceChartSectionModal = class extends import_obsidian28.Modal {
  constructor(app, parentEntity, onSubmit) {
    super(app);
    this.parentEntity = parentEntity;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("cad-prompt-modal");
    contentEl.createEl("h3", { text: "Add Analytics Chart Block" });
    const style = "display: block; font-weight: 500; font-size: 0.85em; margin-bottom: 4px; margin-top: 12px;";
    const selStyle = (el) => {
      el.style.width = "100%";
      el.style.padding = "6px 8px";
      el.style.background = "var(--background-primary)";
      el.style.color = "var(--text-normal)";
      el.style.border = "1px solid var(--border-color)";
      el.style.borderRadius = "4px";
    };
    contentEl.createEl("label", { text: "Entity to chart:", attr: { style } });
    const selTarget = contentEl.createEl("select");
    selStyle(selTarget);
    Object.entries(ENTITIES).forEach(([key, def]) => {
      if (key === this.parentEntity) return;
      selTarget.createEl("option", { value: key, text: def.plural });
    });
    contentEl.createEl("label", { text: "Link field (field on target that references this entity):", attr: { style } });
    const selLink = contentEl.createEl("select");
    selStyle(selLink);
    contentEl.createEl("label", { text: "Group by field (property to chart):", attr: { style } });
    const selGroup = contentEl.createEl("select");
    selStyle(selGroup);
    const refreshFields = () => {
      const targetKey = selTarget.value;
      const def = ENTITIES[targetKey];
      if (!def) return;
      selLink.empty();
      selGroup.empty();
      def.fields.forEach((f) => {
        if (!f.primary) {
          selLink.createEl("option", { value: f.key, text: `${f.label} (${f.key})` });
          selGroup.createEl("option", { value: f.key, text: `${f.label} (${f.key})` });
        }
      });
      const { linkField, groupField } = chartSectionDefaults(Array.from(selLink.options).map((o) => o.value), this.parentEntity);
      if (linkField !== void 0) selLink.value = linkField;
      if (groupField !== void 0) selGroup.value = groupField;
    };
    refreshFields();
    selTarget.addEventListener("change", refreshFields);
    contentEl.createEl("label", { text: "Chart Style:", attr: { style } });
    const selStyle2 = contentEl.createEl("select");
    selStyle(selStyle2);
    [
      { value: "donut", text: "Donut Chart \u{1F369}" },
      { value: "bar", text: "Horizontal Bar Chart \u{1F4CA}" },
      { value: "kpi", text: "KPI Cards Grid \u{1F5C3}\uFE0F" },
      { value: "list", text: "Simple List \u{1F4CB}" }
    ].forEach((opt) => selStyle2.createEl("option", { value: opt.value, text: opt.text }));
    const row = contentEl.createDiv({ attr: { style: "display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px;" } });
    row.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    const ok = row.createEl("button", { text: "Add Chart", cls: "mod-cta" });
    ok.addEventListener("click", () => {
      const blank = noLinkFieldMessage(selTarget.value, selLink.value);
      if (blank) {
        new import_obsidian28.Notice(blank);
        return;
      }
      this.onSubmit(buildChartSectionConfig({
        parentEntity: this.parentEntity,
        targetEntity: selTarget.value,
        linkField: selLink.value,
        groupField: selGroup.value,
        style: selStyle2.value
      }));
      this.close();
    });
  }
};

// src/views/templates.ts
async function renderTemplatesDashboard(view, root) {
  root.addClass("cadence-dashboard");
  root.addClass("cadence-projects");
  view._renderPageHeader(root, "Templates Dashboard", "Manage and visually edit the templates for your entities");
  const grid = root.createDiv({
    cls: "cad-proj-grid"
  });
  const templatesFolder = "Cadence/Templates";
  await ensureFolderSync(view.app, templatesFolder);
  {
    const dailyTemplatePath = `${templatesFolder}/daily.md`;
    const dailyTFile = view.app.vault.getAbstractFileByPath(dailyTemplatePath);
    const exists = !!(dailyTFile && dailyTFile instanceof import_obsidian29.TFile);
    const card = grid.createDiv({
      cls: "cad-proj-card cad-template-tile"
    });
    card.dataset.entity = "daily";
    const head = card.createDiv({ attr: { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;" } });
    const infoWrap = head.createDiv({ attr: { style: "display: flex; align-items: center; gap: 12px;" } });
    const iconSpan = infoWrap.createSpan({ cls: "cad-template-tile-icon" });
    try {
      (0, import_obsidian29.setIcon)(iconSpan, "sun");
    } catch (_) {
      iconSpan.setText("\u2600\uFE0F");
    }
    const titleInfo = infoWrap.createDiv();
    titleInfo.createDiv({ text: "PLANNER", attr: { style: "font-weight: 700; font-size: 0.7rem; letter-spacing: 0.12em; color: var(--text-muted);" } });
    titleInfo.createEl("h3", { text: "Daily Note", attr: { style: "margin: 2px 0 0 0; font-size: 1.15em; font-weight: 700;" } });
    const badge = head.createSpan(templateBadge(exists));
    badge.style.fontSize = "0.7em";
    badge.style.padding = "3px 8px";
    card.createDiv({
      text: view.plugin.settings.dailyNoteFolder ? `Target Folder: ${view.plugin.settings.dailyNoteFolder}/` : "Target Folder: vault root",
      attr: { style: "font-size: 0.8em; font-family: monospace; color: var(--text-muted); background: var(--background-secondary); padding: 4px 8px; border-radius: 4px; margin-bottom: 12px; border: 1px solid var(--background-modifier-border);" }
    });
    const desc = card.createDiv({ text: `Defines properties and sections layout for each new daily note created in the planner.`, attr: { style: "font-size: 0.85em; color: var(--text-muted); margin-bottom: 18px; flex: 1; line-height: 1.4;" } });
    const actions = card.createDiv({ attr: { style: "display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid var(--border-color); padding-top: 14px; margin-top: auto;" } });
    if (exists) {
      const editBtn = actions.createEl("button", { cls: "cad-btn primary", text: "Visual Editor" });
      editBtn.style.padding = "5px 12px";
      editBtn.style.height = "auto";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        view.openTemplateDetail("daily", dailyTFile);
      });
      const openBtn = actions.createEl("button", { cls: "cad-btn", text: "Raw Note \u{1F4DD}" });
      openBtn.style.padding = "5px 12px";
      openBtn.style.height = "auto";
      openBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        view.app.workspace.openLinkText(dailyTemplatePath, "", false);
      });
    } else {
      const resetBtn = actions.createEl("button", {
        cls: "cad-btn primary",
        text: "Enable Custom"
      });
      resetBtn.style.padding = "5px 12px";
      resetBtn.style.height = "auto";
      resetBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await view.app.vault.create(dailyTemplatePath, DAILY_TEMPLATE_CONTENT);
        new import_obsidian29.Notice("Daily Note template successfully enabled.");
        view.render();
      });
    }
    card.addEventListener("click", () => {
      if (exists) view.openTemplateDetail("daily", dailyTFile);
    });
  }
  for (const [entityKey, def] of Object.entries(ENTITIES)) {
    let foundPath = null;
    let exists = false;
    const pathsToTry = templatePathCandidates(templatesFolder, entityKey, def);
    for (const p of pathsToTry) {
      const tFile = view.app.vault.getAbstractFileByPath(p);
      if (tFile && tFile instanceof import_obsidian29.TFile) {
        exists = true;
        foundPath = p;
        break;
      }
    }
    const card = grid.createDiv({
      cls: "cad-proj-card cad-template-tile"
    });
    card.dataset.entity = entityKey;
    const head = card.createDiv({ attr: { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;" } });
    const infoWrap = head.createDiv({ attr: { style: "display: flex; align-items: center; gap: 12px;" } });
    const iconSpan = infoWrap.createSpan({ cls: "cad-template-tile-icon" });
    try {
      (0, import_obsidian29.setIcon)(iconSpan, def.icon || "file-text");
    } catch (_) {
      iconSpan.setText("\u{1F4DD}");
    }
    const titleInfo = infoWrap.createDiv();
    titleInfo.createDiv({ text: def.label.toUpperCase(), attr: { style: "font-weight: 700; font-size: 0.7rem; letter-spacing: 0.12em; color: var(--text-muted);" } });
    titleInfo.createEl("h3", { text: def.plural, attr: { style: "margin: 2px 0 0 0; font-size: 1.15em; font-weight: 700;" } });
    const badge = head.createSpan(templateBadge(exists));
    badge.style.fontSize = "0.7em";
    badge.style.padding = "3px 8px";
    card.createDiv({
      text: `Target Folder: ${def.folder}/`,
      attr: { style: "font-size: 0.8em; font-family: monospace; color: var(--text-muted); background: var(--background-secondary); padding: 4px 8px; border-radius: 4px; margin-bottom: 12px; border: 1px solid var(--background-modifier-border);" }
    });
    const desc = card.createDiv({
      text: `Defines properties and sections layout for each new ${def.label.toLowerCase()} item created.`,
      attr: { style: "font-size: 0.85em; color: var(--text-muted); margin-bottom: 18px; flex: 1; line-height: 1.4;" }
    });
    const actions = card.createDiv({ attr: { style: "display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid var(--border-color); padding-top: 14px; margin-top: auto;" } });
    if (exists) {
      const editBtn = actions.createEl("button", { cls: "cad-btn primary", text: "Visual Editor" });
      editBtn.style.padding = "5px 12px";
      editBtn.style.height = "auto";
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const tFile = view.app.vault.getAbstractFileByPath(foundPath);
        if (tFile) view.openTemplateDetail(entityKey, tFile);
      });
      const openBtn = actions.createEl("button", { cls: "cad-btn", text: "Raw Note \u{1F4DD}" });
      openBtn.style.padding = "5px 12px";
      openBtn.style.height = "auto";
      openBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const tFile = view.app.vault.getAbstractFileByPath(foundPath);
        if (tFile) view.app.workspace.openLinkText(tFile.path, "", false);
      });
    }
    const resetBtn = actions.createEl("button", {
      cls: "cad-btn",
      text: exists ? "Reset to Default" : "Enable Custom"
    });
    resetBtn.style.padding = "5px 12px";
    resetBtn.style.height = "auto";
    if (!exists) resetBtn.classList.add("primary");
    resetBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const templateContent = defaultTemplateContent(entityKey);
      const targetPath = foundPath ?? `${templatesFolder}/${entityKey}.md`;
      let tFile = view.app.vault.getAbstractFileByPath(targetPath);
      if (tFile && tFile instanceof import_obsidian29.TFile) {
        if (!confirm(`Are you sure you want to reset the template for ${def.label}? Your visual changes will be overwritten.`)) return;
        await view.app.vault.modify(tFile, templateContent);
        new import_obsidian29.Notice(`Template reset for ${def.label}.`);
      } else {
        await view.app.vault.create(targetPath, templateContent);
        new import_obsidian29.Notice(`Template successfully enabled for ${def.label}.`);
      }
      view.render();
    });
    card.addEventListener("click", () => {
      const tFile = foundPath ? view.app.vault.getAbstractFileByPath(foundPath) : null;
      if (tFile) {
        view.openTemplateDetail(entityKey, tFile);
      }
    });
  }
}
async function renderTemplateDetail(view, root, entityKey, file) {
  root.addClass("cadence-project-detail");
  const def = templateDetailDef(entityKey);
  if (!file) {
    view.closeEntityDetail();
    return;
  }
  const content = await view.app.vault.read(file);
  const sections = parseH2Sections(content);
  const sectionKeys = Object.keys(sections);
  const head = root.createDiv({ cls: "cad-detail-header" });
  const headLeft = head.createDiv({ cls: "cad-detail-header-left" });
  const back = headLeft.createEl("button", { cls: "cad-btn cad-detail-back", text: "\u2190 Templates" });
  back.addEventListener("click", () => view.closeEntityDetail());
  const breadcrumb = headLeft.createDiv({ cls: "cad-detail-breadcrumb" });
  breadcrumb.createSpan({ cls: "cad-eyebrow", text: "TEMPLATE BUILDER" });
  breadcrumb.createSpan({ cls: "cad-detail-title", text: def.label });
  breadcrumb.createDiv({ cls: "cad-detail-path", text: file.path });
  const headRight = head.createDiv({ cls: "cad-detail-header-right" });
  const savedBadge = headRight.createSpan({ cls: "cad-detail-saved", text: "" });
  const flashSaved = () => {
    savedBadge.setText("Saved");
    savedBadge.addClass("show");
    clearTimeout(savedBadge._t);
    savedBadge._t = setTimeout(() => savedBadge.removeClass("show"), 1400);
  };
  const openNote = headRight.createEl("button", { cls: "cad-btn", text: "View Raw Note \u{1F4DD}" });
  openNote.addEventListener("click", () => view.app.workspace.openLinkText(file.path, "", false));
  const deleteBtn = headRight.createEl("button", { cls: "cad-btn cad-btn-danger", text: "Delete" });
  deleteBtn.addEventListener("click", async () => {
    if (!confirm(`Delete this custom template? Cadence will fall back to using the default structure.`)) return;
    try {
      await view.app.vault.trash(file, true);
      new import_obsidian29.Notice(`Custom template deleted.`);
      view.closeEntityDetail();
    } catch (e) {
      new import_obsidian29.Notice(`Error: ${e.message}`);
    }
  });
  const cols = root.createDiv({ cls: "cad-pd-cols" });
  const left = cols.createDiv({ cls: "cad-pd-col" });
  const right = cols.createDiv({ cls: "cad-pd-col" });
  const { left: leftKeys, right: rightKeys } = splitSectionColumns(sectionKeys);
  leftKeys.forEach((rawKey) => {
    view._renderTemplateSectionWithDelete(left, file, sections, rawKey, flashSaved);
  });
  rightKeys.forEach((rawKey) => {
    view._renderTemplateSectionWithDelete(right, file, sections, rawKey, flashSaved);
  });
  const toolbar = root.createDiv({ attr: { style: "margin-top: 32px; margin-bottom: 48px; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px; border-top: 1px solid var(--border-color);" } });
  toolbar.createDiv({ text: "\u2795 ADD BLOCK TO TEMPLATE", attr: { style: "font-weight: 700; font-size: 0.75rem; letter-spacing: 0.15em; color: var(--text-muted);" } });
  const btnRow = toolbar.createDiv({ attr: { style: "display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;" } });
  const addSectionHelper = async (cleanTitle, tag, defaultBody = "") => {
    if (!cleanTitle) return;
    const curContent = await view.app.vault.read(file);
    const nextContent = appendTemplateSection(curContent, cleanTitle, tag, defaultBody);
    if (nextContent === null) {
      new import_obsidian29.Notice(`Section "${cleanTitle}" is already in this template.`);
      return;
    }
    await view.app.vault.modify(file, nextContent);
    new import_obsidian29.Notice(`Section "${cleanTitle}" added to template.`);
    await view._propagateTemplateSectionAdd(entityKey, cleanTitle, tag, defaultBody);
    view.render();
  };
  const addTextBtn = btnRow.createEl("button", { cls: "cad-btn", text: "\u{1F4DD} Text Area" });
  addTextBtn.addEventListener("click", () => {
    new CadencePromptModal(view.app, {
      title: "New Text Section",
      placeholder: "Enter text section title:",
      defaultValue: "Notes",
      cta: "Add Block",
      onSubmit: (title) => {
        addSectionHelper(title, "#notes", "_Enter your notes here..._");
      }
    }).open();
  });
  const addTasksBtn = btnRow.createEl("button", { cls: "cad-btn", text: "\u{1F4CB} Task List" });
  addTasksBtn.addEventListener("click", () => {
    new CadencePromptModal(view.app, {
      title: "New Task List Block",
      placeholder: "Enter task list section title:",
      defaultValue: "Tasks",
      cta: "Add Block",
      onSubmit: (title) => {
        addSectionHelper(title, "#tasks", "- [ ] First task in template");
      }
    }).open();
  });
  const addMilestonesBtn = btnRow.createEl("button", { cls: "cad-btn", text: "\u{1F4C5} Milestones / Timeline" });
  addMilestonesBtn.addEventListener("click", () => {
    new CadencePromptModal(view.app, {
      title: "New Milestones Block",
      placeholder: "Enter milestones section title:",
      defaultValue: "Milestones",
      cta: "Add Block",
      onSubmit: (title) => {
        const today = ymd(/* @__PURE__ */ new Date());
        addSectionHelper(title, "#milestones", `- [ ] ${today} \u2014 First milestone in template`);
      }
    }).open();
  });
  const addCrossBtn = btnRow.createEl("button", { cls: "cad-btn", text: "\u{1F517} Cross-Linked Data" });
  addCrossBtn.addEventListener("click", () => {
    new CadenceCrossSectionModal(view.app, entityKey, async (config) => {
      const block = crossSectionBlock(config);
      new CadencePromptModal(view.app, {
        title: "New Cross-Linked Section",
        placeholder: "Enter section title:",
        defaultValue: block.title,
        cta: "Add Block",
        onSubmit: (title) => {
          addSectionHelper(title, block.tag, "");
        }
      }).open();
    }).open();
  });
  const addChartBtn = btnRow.createEl("button", { cls: "cad-btn", text: "\u{1F4CA} Analytics Chart" });
  addChartBtn.addEventListener("click", () => {
    new CadenceChartSectionModal(view.app, entityKey, (config) => {
      const block = chartSectionBlock(config);
      new CadencePromptModal(view.app, {
        title: "New Analytics Chart",
        placeholder: "Enter chart section title:",
        defaultValue: block.title,
        cta: "Add Chart",
        onSubmit: (title) => {
          addSectionHelper(title, block.tag, "");
        }
      }).open();
    }).open();
  });
}
function renderTemplateSectionWithDelete(view, parent, file, sections, rawKey, flashSaved) {
  const entityKey = templateEntityKey(file.basename);
  const { cleanLabel, tag } = parseHeaderKey(rawKey);
  const wrap = parent.createDiv({ attr: { style: "position: relative; margin-bottom: 12px; transition: transform 0.2s ease;" } });
  wrap.draggable = true;
  wrap.addEventListener("dragstart", (ev) => {
    wrap.style.opacity = "0.5";
    ev.dataTransfer.effectAllowed = "move";
    ev.dataTransfer.setData("text/cadence-template-section", rawKey);
  });
  wrap.addEventListener("dragend", () => {
    wrap.style.opacity = "1";
    wrap.removeClass("drag-over");
  });
  wrap.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
    wrap.addClass("drag-over");
    wrap.style.border = "2px dashed var(--interactive-accent)";
    wrap.style.borderRadius = "6px";
  });
  wrap.addEventListener("dragleave", () => {
    wrap.removeClass("drag-over");
    wrap.style.border = "none";
    wrap.style.borderRadius = "0";
  });
  wrap.addEventListener("drop", async (ev) => {
    ev.preventDefault();
    wrap.removeClass("drag-over");
    wrap.style.border = "none";
    wrap.style.borderRadius = "0";
    const draggedRawKey = ev.dataTransfer.getData("text/cadence-template-section");
    if (!draggedRawKey || draggedRawKey === rawKey) return;
    const curContent = await view.app.vault.read(file);
    const nextContent = moveTemplateSection(curContent, draggedRawKey, rawKey);
    if (nextContent === null) return;
    await view.app.vault.modify(file, nextContent);
    view.render();
  });
  view._renderDynamicH2Section(wrap, file, sections, rawKey, flashSaved);
  const cardHead = wrap.querySelector(".cad-pd-card-head");
  if (!cardHead) return;
  const ctrlRow = cardHead.createDiv({ attr: { style: "display: flex; align-items: center; gap: 8px; margin-left: 8px; flex-shrink: 0;" } });
  const grip = ctrlRow.createDiv({ attr: { style: "cursor: grab; display: flex; align-items: center; justify-content: center; color: var(--text-muted); opacity: 0.7; padding: 2px 4px;" } });
  grip.title = "Drag card to reorder";
  try {
    (0, import_obsidian29.setIcon)(grip, "grip-vertical");
  } catch (_) {
  }
  const delBtn = ctrlRow.createEl("button", { text: "\xD7", attr: { style: "color: var(--text-error); padding: 0 4px; font-weight: bold; background: transparent; border: none; font-size: 1.25em; cursor: pointer;" } });
  delBtn.title = `Remove section "${cleanLabel}" from template`;
  delBtn.addEventListener("click", async (ev) => {
    ev.stopPropagation();
    const propagates = entityKey !== "daily";
    const usedFiles = propagates ? await view._getFilesUsingTemplateSection(entityKey, rawKey) : [];
    if (!confirm(deleteSectionMessage(cleanLabel, usedFiles.map((f) => f.basename)))) return;
    const curContent = await view.app.vault.read(file);
    const nextContent = removeTemplateSection(curContent, rawKey);
    if (nextContent !== null) {
      await view.app.vault.modify(file, nextContent);
      if (propagates) await view._propagateTemplateSectionDelete(entityKey, rawKey);
      new import_obsidian29.Notice(`Section "${cleanLabel}" removed.`);
      view.render();
    }
  });
}
async function getFilesUsingTemplateSection(view, entityKey, rawKey) {
  const files = view._getEntityFiles(entityKey);
  const notes = [];
  for (const file of files) {
    notes.push({ file, content: await view.app.vault.read(file) });
  }
  return filesUsingTemplateSection(notes, rawKey);
}
async function propagateTemplateSectionAdd(view, entityKey, cleanTitle, tag, defaultBody = "") {
  const files = view._getEntityFiles(entityKey);
  for (const file of files) {
    const content = await view.app.vault.read(file);
    const nextContent = propagateSectionAdd(content, { cleanTitle, tag, defaultBody });
    if (nextContent !== null) await view.app.vault.modify(file, nextContent);
  }
}
async function propagateTemplateSectionDelete(view, entityKey, rawKey) {
  const files = view._getEntityFiles(entityKey);
  for (const file of files) {
    const content = await view.app.vault.read(file);
    const nextContent = propagateSectionDelete(content, rawKey);
    if (nextContent !== null) await view.app.vault.modify(file, nextContent);
  }
}
function templatePathCandidates(folder, entityKey, def) {
  return [
    `${folder}/${entityKey}.md`,
    `${folder}/${def.label}.md`,
    `${folder}/${def.plural}.md`,
    `${folder}/${entityKey.toLowerCase()}.md`,
    `${folder}/${def.label.toLowerCase()}.md`,
    `${folder}/${def.plural.toLowerCase()}.md`
  ];
}
function templateEntityKey(basename) {
  const name = basename.toLowerCase();
  if (name === "daily") return "daily";
  const match = Object.entries(ENTITIES).find(([key, def]) => [key, def.label, def.plural].some((n) => n.toLowerCase() === name));
  return match ? match[0] : basename;
}
function templateBadge(exists) {
  return {
    cls: exists ? "cad-pill cad-pill-active" : "cad-pill cad-pill-backlog",
    text: exists ? "Active Template" : "Default"
  };
}
function templateDetailDef(entityKey) {
  return ENTITIES[entityKey] || { label: "Daily Note", plural: "Daily Notes", fields: [] };
}
function crossSectionBlock(config) {
  return {
    tag: `#cross-${config.targetEntity}-${config.linkField}-${config.viewType}`,
    title: `Related ${ENTITIES[config.targetEntity]?.plural || "Links"}`
  };
}
function chartSectionBlock(config) {
  return {
    tag: `#chart-${config.targetEntity}-${config.linkField}-${config.groupField}-${config.style}`,
    title: `${ENTITIES[config.targetEntity]?.plural || config.targetEntity} by ${config.groupField}`
  };
}
function templateHeader(cleanTitle, tag) {
  return `## ${cleanTitle} ${tag}`.trim();
}
function appendTemplateSection(content, cleanTitle, tag, defaultBody = "") {
  const name = cleanTitle.trim().toLowerCase();
  const exists = Object.keys(parseH2Sections(content)).some((k) => parseHeaderKey(k).cleanLabel.toLowerCase() === name);
  if (exists) return null;
  return appendSection(content, templateHeader(cleanTitle, tag), defaultBody);
}
function sameSection(key, other) {
  const { cleanLabel, tag } = parseHeaderKey(key);
  return cleanLabel.toLowerCase() === other.cleanLabel.toLowerCase() && tag.toLowerCase() === other.tag.toLowerCase();
}
function spliceSection(lines, idx) {
  let endIdx = lines.length;
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  if (endIdx === lines.length && idx > 0 && lines[idx - 1] !== "" && lines[endIdx - 1] === "") endIdx--;
  lines.splice(idx, endIdx - idx);
}
function propagateSectionAdd(content, section) {
  if (!section.cleanTitle?.trim()) return null;
  const sections = parseH2Sections(content);
  const target = parseHeaderKey(templateHeader(section.cleanTitle, section.tag).replace(/^##\s+/, ""));
  const exists = Object.keys(sections).some((k) => sameSection(k, target));
  if (exists) return null;
  return appendSection(content, templateHeader(section.cleanTitle, section.tag), section.defaultBody ?? "");
}
function propagateSectionDelete(content, sectionKey) {
  const target = parseHeaderKey(sectionKey);
  const lines = content.split("\n");
  let removed = false;
  for (let idx = lines.length - 1; idx >= 0; idx--) {
    if (!/^##\s/.test(lines[idx])) continue;
    if (!sameSection(lines[idx].trim().replace(/^##\s+/, ""), target)) continue;
    spliceSection(lines, idx);
    removed = true;
  }
  return removed ? lines.join("\n") : null;
}
function removeTemplateSection(content, rawKey) {
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => /^##\s/.test(l) && l.replace(/^##\s+/, "").trim() === rawKey);
  if (idx === -1) return null;
  spliceSection(lines, idx);
  return lines.join("\n");
}
function moveTemplateSection(content, draggedRawKey, targetRawKey) {
  if (draggedRawKey === targetRawKey) return null;
  const lines = content.split("\n");
  const keyAt = (ls, i) => ls[i].trim().replace(/^##\s+/, "");
  const h2Indices = lines.map((l, i) => /^##\s/.test(l) ? i : -1).filter((i) => i >= 0);
  const draggedIdx = h2Indices.findIndex((i) => keyAt(lines, i) === draggedRawKey);
  const targetIdx = h2Indices.findIndex((i) => keyAt(lines, i) === targetRawKey);
  if (draggedIdx === -1 || targetIdx === -1) return null;
  const start = h2Indices[draggedIdx];
  const end = draggedIdx + 1 < h2Indices.length ? h2Indices[draggedIdx + 1] : lines.length;
  const draggedBlock = lines.slice(start, end);
  lines.splice(start, draggedBlock.length);
  if (draggedBlock[draggedBlock.length - 1] !== "") draggedBlock.push("");
  const h2IndicesNew = lines.map((l, i) => /^##\s/.test(l) ? i : -1).filter((i) => i >= 0);
  const targetIdxNew = h2IndicesNew.findIndex((i) => keyAt(lines, i) === targetRawKey);
  lines.splice(h2IndicesNew[targetIdxNew], 0, ...draggedBlock);
  return lines.join("\n");
}
function deleteSectionMessage(cleanLabel, usedNames) {
  if (usedNames.length > 0) {
    return `Warning: The section "${cleanLabel}" has active content in the following files:
${usedNames.join(", ")}

Are you sure you want to delete it from the template?`;
  }
  return `Remove the section "${cleanLabel}" from this template?`;
}
var TEMPLATE_PLACEHOLDERS = [
  "_Enter your notes here...",
  "_Context and general notes",
  "_Company description",
  "_Background, interests",
  "_The outcome we want",
  "- [ ] First task",
  "- [ ] First milestone"
];
var TEMPLATE_PLACEHOLDER_PATTERNS = [
  /^- \[ \] \d{4}-\d{2}-\d{2} — First milestone/,
  /^- \[ \]\s*(\n|$)/
];
function isPlaceholderBody(body) {
  return TEMPLATE_PLACEHOLDERS.some((p) => body.startsWith(p)) || TEMPLATE_PLACEHOLDER_PATTERNS.some((p) => p.test(body));
}
function sectionInUse(content, sectionKey) {
  const target = parseHeaderKey(sectionKey);
  const sections = parseH2Sections(content);
  return Object.keys(sections).filter((k) => sameSection(k, target)).some((k) => {
    const body = (sections[k] || "").trim();
    return !!body && !isPlaceholderBody(body);
  });
}
function filesUsingTemplateSection(notes, sectionKey) {
  return notes.filter((n) => sectionInUse(n.content, sectionKey)).map((n) => n.file);
}

// src/views/today.ts
var import_obsidian30 = require("obsidian");
async function quickAddTodayTask(view) {
  if (view.plugin.settings.taskManagementSystem === "tasknotes") {
    const commandId = "tasknotes:create-new-task";
    const commands = view.app.commands;
    const hasCommand = commands && commands.commands && commands.commands[commandId];
    if (hasCommand) {
      commands.executeCommandById(commandId);
      return;
    }
  }
  const text = await view._prompt({
    title: "Quick add \u2014 today",
    placeholder: "What needs doing?",
    cta: "Add task"
  });
  if (!text) return;
  if (view.plugin.settings.taskManagementSystem === "tasknotes") {
    await appendTaskNotesTask(view.app, text, /* @__PURE__ */ new Date());
  } else {
    const file = await ensureDailyNote(view.app, view.plugin.settings);
    const content = await view.app.vault.read(file);
    await view.app.vault.modify(file, appendDailyTask(content, view.plugin.settings, text));
  }
  new import_obsidian30.Notice("Added to today");
  view.render();
}
function todaySummary(tasksList, greet) {
  const { open, done } = countTaskLines(tasksList);
  return {
    greeting: open === 0 ? `${greet}. Nothing on the books \u2014 your day is clear.` : `${greet}. You have ${open} ${open === 1 ? "thing" : "things"} to handle.`,
    count: `${open} open \xB7 ${done} done`
  };
}
function customSectionKeys(sections, settings) {
  const cleanTasksHeading = (settings.tasksHeading || "## Today").replace(/^##\s+/, "").trim().toLowerCase();
  const cleanJournalHeading = (settings.journalHeading || "## Journal").replace(/^##\s+/, "").trim().toLowerCase();
  return Object.keys(sections).filter((k) => {
    const cleanK = parseHeaderKey(k).cleanLabel.toLowerCase();
    return cleanK !== cleanTasksHeading && cleanK !== cleanJournalHeading;
  });
}
function journalRows(value) {
  return Math.max(8, value.split("\n").length + 2);
}
async function renderTodayPane(view, root) {
  root.addClass("cadence-today");
  view.todayFile = findDailyNote(view.app, view.plugin.settings);
  const fileContent = view.todayFile ? await view.app.vault.read(view.todayFile) : "";
  view.todayParsed = parseSections(fileContent, view.plugin.settings);
  let tasksList = [];
  if (view.plugin.settings.taskManagementSystem === "tasknotes") {
    const today = taskNotesToday(listTaskNotesTasks(view.app), ymd(/* @__PURE__ */ new Date()));
    view.todayTaskNotes = today.tasks;
    tasksList = today.lines;
  } else {
    tasksList = withoutBlankTasks(view.todayParsed.tasks);
  }
  const info = dateInfo();
  root.createDiv({ cls: "cad-eyebrow", text: info.weekday.toUpperCase() });
  const hero = root.createDiv({ cls: "cad-date-hero" });
  hero.createSpan({ cls: "cad-day", text: String(info.day) });
  const monthCol = hero.createDiv();
  monthCol.createDiv({ cls: "cad-month", text: info.month });
  monthCol.createDiv({ cls: "cad-year", text: String(info.year) });
  const summary = todaySummary(tasksList, greeting());
  root.createDiv({ cls: "cad-greet", text: summary.greeting });
  const taskSection = root.createDiv({ cls: "cad-section" });
  const taskLabel = taskSection.createDiv({ cls: "cad-section-label" });
  taskLabel.createSpan({ text: "TODAY" });
  taskLabel.createSpan({ cls: "cad-count", text: summary.count });
  if (!tasksList.length) {
    taskSection.createDiv({ cls: "cad-empty", text: "No tasks in today's note yet." });
  } else {
    const dailyPath = view.todayFile?.path ?? dailyNotePath(view.plugin.settings);
    let projectTargets;
    taskLineRows(tasksList).forEach(({ checked, text }, idx) => {
      const row = taskSection.createDiv({ cls: "cad-task-row" + (checked ? " done" : "") });
      const cb = row.createEl("input", { type: "checkbox" });
      cb.checked = checked;
      cb.addEventListener("change", () => view.toggleTodayTask(idx, cb.checked));
      if (view.plugin.settings.taskManagementSystem === "tasknotes") {
        const taskObj = view.todayTaskNotes[idx];
        const taskSpan = row.createEl("a", { cls: "cad-task-text", text });
        taskSpan.style.cursor = "pointer";
        taskSpan.addEventListener("click", (ev) => {
          ev.preventDefault();
          view.app.workspace.openLinkText(taskObj.file.path, "", false);
        });
      } else {
        row.createSpan({ cls: "cad-task-text", text });
      }
      let linkedProject = null;
      if (view.plugin.settings.taskManagementSystem === "tasknotes") {
        const taskObj = view.todayTaskNotes[idx];
        if (taskObj.projects) linkedProject = taskNotesProjectPath(taskObj.projects, projectTargets ??= projectLinkTargets(view.app));
      } else {
        linkedProject = view._getTaskProjectLink(dailyPath, text);
      }
      if (linkedProject) {
        const chip = row.createEl("a", { cls: "cad-task-proj-chip", text: "\u{1F4C1} " + (projectNameFromPath(view.app, linkedProject) || "Project") });
        chip.title = "Open linked project";
        chip.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const file = view.app.vault.getAbstractFileByPath(linkedProject);
          if (file && file instanceof import_obsidian30.TFile) view.openEntityDetail("project", file);
        });
      }
      if (view.plugin.settings.taskManagementSystem !== "tasknotes") {
        const linkBtn = row.createEl("button", { cls: "cad-task-link-btn" + (linkedProject ? " linked" : ""), text: linkedProject ? "\u270E" : "\u{1F4C1}" });
        linkBtn.title = linkedProject ? "Change linked project" : "Link to a project";
        linkBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          view._openTaskProjectPicker(dailyPath, text, linkedProject);
        });
      }
    });
  }
  const quickWrap = taskSection.createDiv();
  quickWrap.style.marginTop = "8px";
  const quick = quickWrap.createEl("input", {
    type: "text",
    placeholder: "Quick add a task \u2014 Enter to save"
  });
  quick.style.width = "100%";
  quick.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && quick.value.trim()) {
      const v = quick.value.trim();
      quick.value = "";
      view.appendTodayTask(v);
    }
  });
  const journalSection = root.createDiv({ cls: "cad-section" });
  journalSection.createDiv({ cls: "cad-section-label" }).setText("TODAY\u2019S ENTRY");
  const ta = journalSection.createEl("textarea", { cls: "cad-journal" });
  ta.value = view.todayParsed.journal;
  ta.placeholder = "Write what\u2019s on your mind\u2026";
  ta.rows = journalRows(ta.value);
  ta.addEventListener("input", () => {
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
    if (view._journalSaveTimer) clearTimeout(view._journalSaveTimer);
    view._journalSaveTimer = setTimeout(() => view.saveTodayJournal(ta.value), 800);
  });
  setTimeout(() => {
    ta.style.height = ta.scrollHeight + "px";
  }, 0);
  const allSections = parseH2Sections(fileContent);
  const otherKeys = customSectionKeys(allSections, view.plugin.settings);
  if (otherKeys.length > 0) {
    const customWrap = root.createDiv({ cls: "cad-custom-sections" });
    customWrap.style.marginTop = "24px";
    customWrap.style.display = "grid";
    customWrap.style.gridTemplateColumns = "repeat(auto-fit, minmax(320px, 1fr))";
    customWrap.style.gap = "16px";
    const flashSaved = () => {
      new import_obsidian30.Notice("Section saved");
    };
    otherKeys.forEach((rawKey) => {
      view._renderDynamicH2Section(customWrap, view.todayFile, allSections, rawKey, flashSaved);
    });
  }
  const footer = root.createDiv();
  footer.style.marginTop = "24px";
  footer.style.fontSize = "12px";
  footer.style.color = "var(--cad-ink-4)";
  const link = footer.createEl("a", { text: "Open today's daily note \u2192" });
  link.style.color = "var(--cad-emerald-deep)";
  link.style.cursor = "pointer";
  link.addEventListener("click", async () => {
    const file = view.todayFile ?? await todayNote(view);
    view.app.workspace.openLinkText(file.path, "", false);
  });
}
async function toggleTodayTask(view, idx, checked) {
  if (view.plugin.settings.taskManagementSystem === "tasknotes") {
    if (view.todayTaskNotes && view.todayTaskNotes[idx]) {
      const taskObj = view.todayTaskNotes[idx];
      await toggleTaskNotesTask(view.app, taskObj.file, checked);
      await view._propagateTaskComplete(taskObj.title, checked, { kind: "tasknotes", file: taskObj.file });
    }
  } else {
    const ref = view.todayParsed ? taskLineRef(withoutBlankTasks(view.todayParsed.tasks), idx) : null;
    if (ref && view.todayFile) await view._tickDailyNoteTask(view.todayFile, ref, checked, /* @__PURE__ */ new Date());
  }
  view.render();
}
async function appendTodayTask(view, text) {
  if (view.plugin.settings.taskManagementSystem === "tasknotes") {
    await appendTaskNotesTask(view.app, text, /* @__PURE__ */ new Date());
  } else {
    const file = await todayNote(view);
    const content = await view.app.vault.read(file);
    await view.app.vault.modify(file, appendDailyTask(content, view.plugin.settings, text));
  }
  view.render();
}
async function saveTodayJournal(view, body) {
  const file = await todayNote(view);
  const content = await view.app.vault.read(file);
  await view.app.vault.modify(file, replaceJournal(content, view.plugin.settings, body));
}
async function todayNote(view) {
  if (!view.todayFile) view.todayFile = await ensureDailyNote(view.app, view.plugin.settings);
  return view.todayFile;
}

// src/views/app-view.ts
function initAppViewState(view, plugin) {
  view.plugin = plugin;
  const raw = plugin.settings.defaultTab || DEFAULT_SETTINGS.defaultTab;
  view.mode = view._migrateModeId(raw);
  view.todayFile = null;
  view.todayParsed = null;
  view._journalSaveTimer = null;
  view.plannerAnchor = startOfDay(/* @__PURE__ */ new Date());
  view.detailFile = null;
  view.detailEntityKey = null;
  view.mobileNavOpen = false;
}
async function openEntityDetail(view, entityKey, file) {
  if (!file || !entityKey) return;
  view.detailEntityKey = entityKey;
  view.detailFile = file;
  await view.render();
}
async function openTemplateDetail(view, entityKey, file) {
  if (!file || !entityKey) return;
  view.detailEntityKey = "template:" + entityKey;
  view.detailFile = file;
  await view.render();
}
async function openEntityDetailFromFile(view, file) {
  const key = entityKeyFromFile(view.app, file);
  if (!key) {
    view.app.workspace.openLinkText(file.path, "", false);
    return;
  }
  return view.openEntityDetail(key, file);
}
async function closeEntityDetail(view) {
  view.detailFile = null;
  view.detailEntityKey = null;
  await view.render();
}
async function onOpenAppView(view) {
  view.containerEl.children[1].empty();
  await view.render();
  view.registerEvent(view.app.workspace.on("editor-change", (editor, info) => {
    const file = info.file;
    if (!file) return;
    let shouldRender = false;
    if (view.detailFile && file.path === view.detailFile.path) {
      shouldRender = true;
    } else if (view.mode === "planner.today" && view.todayFile && file.path === view.todayFile.path) {
      shouldRender = true;
    }
    if (shouldRender) {
      if (view._liveRenderTimer) clearTimeout(view._liveRenderTimer);
      view._liveRenderTimer = setTimeout(() => {
        view.render();
      }, 300);
    }
  }));
  view.registerEvent(view.app.vault.on("modify", (file) => {
    if (view.detailFile && file && file.path === view.detailFile.path) {
      if (view.app.workspace.getActiveLeaf() === view.leaf) return;
      return view.render();
    }
    if (view.mode === "planner.today" && view.todayFile && file.path === view.todayFile.path) {
      return view.render();
    }
    if (view.mode === "planner.calendar") {
      const days = weekDates(view.plannerAnchor, view.plugin.settings.weekStartsOn);
      const paths = days.map((d) => dailyNotePath(view.plugin.settings, d));
      if (paths.includes(file.path)) return view.render();
    }
    if (view._modeUsesEntityFolder(file.path)) return view.render();
  }));
  const entityRefresh = (file) => {
    if (view.detailFile && file && file.path === view.detailFile.path) return;
    if (view._modeUsesEntityFolder(file && file.path)) view.render();
  };
  view.registerEvent(view.app.vault.on("create", entityRefresh));
  view.registerEvent(view.app.vault.on("delete", (file) => {
    if (view.detailFile && file && file.path === view.detailFile.path) {
      view.closeEntityDetail();
      return;
    }
    entityRefresh(file);
  }));
  view.registerEvent(view.app.vault.on("rename", (file, oldPath) => {
    if (view.detailFile && file && file.path === view.detailFile.path) return;
    if (view._modeUsesEntityFolder(file && file.path) || view._modeUsesEntityFolder(oldPath)) view.render();
  }));
  view.registerEvent(view.app.metadataCache.on("changed", (file) => {
    if (view.detailFile && file && file.path === view.detailFile.path) {
      if (view.app.workspace.getActiveLeaf() === view.leaf) return;
      return view.render();
    }
    if (view._modeUsesEntityFolder(file && file.path)) view.render();
  }));
  view.registerEvent(view.app.workspace.on("active-leaf-change", (leaf) => {
    if (leaf === view.leaf) {
      view.render();
    }
  }));
}
async function renderAppView(view) {
  if (view._isRendering) {
    view._needsRenderAgain = true;
    return;
  }
  view._isRendering = true;
  view._needsRenderAgain = false;
  try {
    const root = view.containerEl.children[1];
    root.empty();
    root.addClass("cadence-app");
    root.toggleClass("cad-dark", !!view.plugin.settings.cadenceAppDark);
    view.mode = view._migrateModeId(view.mode);
    const active = view._resolveSurface(view.mode);
    const topbar = root.createDiv({ cls: "cad-app-topbar" });
    const burger = topbar.createEl("button", { cls: "cad-mobile-burger" });
    try {
      (0, import_obsidian31.setIcon)(burger, "menu");
    } catch (_) {
    }
    burger.title = "Show nav";
    burger.addEventListener("click", () => view._toggleMobileNav());
    const brand = topbar.createDiv({ cls: "cad-app-brand" });
    brand.createSpan({ cls: "cad-app-brand-mark", text: "\u25D0" });
    brand.createSpan({ cls: "cad-app-brand-text", text: "Cadence" });
    const topRight = topbar.createDiv({ cls: "cad-app-topbar-right" });
    const dark = !!view.plugin.settings.cadenceAppDark;
    const themeBtn = topRight.createEl("button", { cls: "cad-topbar-icon-btn" });
    try {
      (0, import_obsidian31.setIcon)(themeBtn, dark ? "sun" : "moon");
    } catch (_) {
    }
    themeBtn.title = dark ? "Cadence: switch to light" : "Cadence: switch to dark";
    themeBtn.addEventListener("click", () => view._toggleCadenceDark());
    const eyebrow = topRight.createDiv({ cls: "cad-app-topbar-meta" });
    eyebrow.setText(active.label.toUpperCase());
    const body = root.createDiv({ cls: "cad-app-body" });
    const backdrop = body.createDiv({ cls: "cad-mobile-backdrop" });
    backdrop.addEventListener("click", () => view._toggleMobileNav(false));
    const nav = body.createDiv({ cls: "cad-app-nav" });
    const collapsed = view.plugin.settings.collapsedGroups || {};
    const visibleGroups = view._visibleNavGroups();
    visibleGroups.forEach((group) => {
      const groupEl = nav.createDiv({ cls: "cad-nav-group" });
      const isCollapsed = !!collapsed[group.id];
      if (group.label) {
        const head = groupEl.createDiv({ cls: "cad-nav-group-head" });
        const chev = head.createSpan({ cls: "cad-nav-group-chev" });
        try {
          (0, import_obsidian31.setIcon)(chev, isCollapsed ? "chevron-right" : "chevron-down");
        } catch (_) {
        }
        head.createSpan({ cls: "cad-nav-group-label", text: group.label.toUpperCase() });
        head.addEventListener("click", () => view.toggleGroup(group.id));
      }
      if (!isCollapsed || !group.label) {
        const list = groupEl.createDiv({ cls: "cad-nav-group-items" });
        group.items.forEach((s) => {
          const item = list.createDiv({
            cls: "cad-app-nav-item" + (view.mode === s.id ? " active" : "")
          });
          const ic = item.createSpan({ cls: "cad-app-nav-icon" });
          try {
            (0, import_obsidian31.setIcon)(ic, s.icon);
          } catch (_) {
          }
          item.createSpan({ cls: "cad-app-nav-label", text: s.label });
          if (!BUILT_SURFACES.has(s.id) && !s.id.startsWith("custom.")) {
            item.createSpan({ cls: "cad-app-nav-badge", text: "soon" });
          }
          if (s.id === "planner.inbox") {
            const overdue = view._inboxOverdueCount();
            if (overdue > 0) item.createSpan({ cls: "cad-app-nav-badge cad-nav-badge-alert", text: String(overdue) });
          }
          item.addEventListener("click", () => {
            view.setMode(s.id);
            if (view.mobileNavOpen) view._toggleMobileNav(false);
          });
        });
      }
    });
    let content = body.createDiv({ cls: "cad-app-content" });
    if (view.detailFile && view.detailEntityKey) {
      const exists = view.app.vault.getAbstractFileByPath(view.detailFile.path);
      if (!exists) {
        view.detailFile = null;
        view.detailEntityKey = null;
      } else {
        try {
          if (view.detailEntityKey.startsWith("template:")) {
            const entityKey = view.detailEntityKey.slice("template:".length);
            await view.renderTemplateDetail(content, entityKey, view.detailFile);
          } else {
            await view.renderEntityDetail(content, view.detailEntityKey, view.detailFile);
          }
          return;
        } catch (e) {
          console.error("Cadence: Failed to render detail view", e);
          view.detailFile = null;
          view.detailEntityKey = null;
          content.remove();
          content = body.createDiv({ cls: "cad-app-content" });
        }
      }
    }
    const route = routeFor(view.mode, view.plugin.settings.customPages || []);
    if (route.kind === "surface") {
      await view[route.method](content);
    } else if (route.kind === "entityList") {
      await view.renderEntityList(content, route.entityKey);
    } else {
      view.renderComingSoon(content, active);
    }
  } finally {
    view._isRendering = false;
    if (view._needsRenderAgain) {
      view._needsRenderAgain = false;
      view.render();
    }
  }
}
function renderComingSoon(view, root, surface2) {
  root.addClass("cadence-soon");
  const wrap = root.createDiv({ cls: "cad-soon-wrap" });
  wrap.createDiv({ cls: "cad-eyebrow", text: "COMING SOON" });
  wrap.createDiv({ cls: "cad-soon-title", text: surface2.label });
  wrap.createDiv({ cls: "cad-soon-desc", text: surface2.desc });
  const ic = wrap.createDiv({ cls: "cad-soon-icon" });
  try {
    (0, import_obsidian31.setIcon)(ic, surface2.icon);
  } catch (_) {
  }
  const meta = wrap.createDiv({ cls: "cad-soon-meta" });
  meta.setText("This surface is scaffolded but not yet built. Tell the team to flesh it out next.");
}
function renderPageHeader(view, root, title, subtitle, actions) {
  const head = root.createDiv({ cls: "cad-page-header" });
  const left = head.createDiv({ cls: "cad-page-header-left" });
  left.createDiv({ cls: "cad-eyebrow", text: "CADENCE" });
  left.createDiv({ cls: "cad-page-title", text: title });
  if (subtitle) left.createDiv({ cls: "cad-page-subtitle", text: subtitle });
  const right = head.createDiv({ cls: "cad-page-header-right" });
  if (typeof actions === "function") actions(right);
  return head;
}
async function openSettingsTab(view, root) {
  root.addClass("cadence-soon");
  const wrap = root.createDiv({ cls: "cad-soon-wrap" });
  const ic = wrap.createDiv({ cls: "cad-soon-icon" });
  try {
    (0, import_obsidian31.setIcon)(ic, "settings-2");
  } catch (_) {
  }
  wrap.createDiv({ cls: "cad-eyebrow", text: "CADENCE" });
  wrap.createDiv({ cls: "cad-soon-title", text: "Settings" });
  wrap.createDiv({ cls: "cad-soon-desc", text: "Configure folders, headings, week start, default tab, and the (future) Cadence API connection." });
  const btn = wrap.createEl("button", { cls: "cad-btn primary", text: "Open Cadence settings" });
  btn.style.marginTop = "12px";
  btn.addEventListener("click", () => {
    view.app.setting.open();
    view.app.setting.openTabById(view.plugin.manifest.id);
  });
}
function openPrompt(view, opts) {
  return new Promise((resolve) => {
    new CadencePromptModal(view.app, {
      title: opts.title || "Enter a name",
      placeholder: opts.placeholder || "",
      defaultValue: opts.defaultValue || "",
      cta: opts.cta || "Create",
      onSubmit: resolve
    }).open();
  });
}
async function createEntityFromPrompt(view, entityKey, defaults = {}) {
  const def = ENTITIES[entityKey];
  new CadenceEntityCreateModal(view.app, entityKey, {
    defaults,
    onSubmit: async (result) => {
      if (!result) return;
      try {
        const file = await createEntity(view.app, entityKey, result.name);
        const { extras, links } = planEntityLinks(def, defaults, result.values);
        for (const link of links) {
          const targetFile = view.app.vault.getMarkdownFiles().find((tf) => tf.basename.toLowerCase() === link.name.toLowerCase());
          if (!targetFile) {
            try {
              await createEntity(view.app, link.creationSource, link.name);
              new import_obsidian31.Notice(`Created new ${link.label}: ${link.name}`);
            } catch (e) {
              console.warn(`Failed to auto-create ${link.creationSource}`, e);
            }
          }
        }
        if (Object.keys(extras).length) {
          await view.app.fileManager.processFrontMatter(file, (fm) => {
            Object.entries(extras).forEach(([k, v]) => {
              if (v == null || v === "" || Array.isArray(v) && v.length === 0) return;
              fm[k] = v;
            });
          });
        }
        new import_obsidian31.Notice(`Created ${def.label}: ${file.basename}
Saved to ${file.path}`, 4e3);
        await view.openEntityDetail(entityKey, file);
      } catch (e) {
        new import_obsidian31.Notice(`Cadence: failed to create ${def.label} \u2014 ${e.message}`);
      }
    }
  }).open();
}
function planEntityLinks(def, defaults, values) {
  const primaryKey = def.fields[0].key;
  const extras = Object.assign({}, defaults, values);
  delete extras[primaryKey];
  const links = [];
  for (const f of def.fields) {
    const suggestionSource = getFieldSuggestionSource(f);
    if (suggestionSource !== "none" && suggestionSource !== "tags" && suggestionSource !== "history") {
      const key = f.key;
      if (extras[key]) {
        const rawVal = extras[key];
        const parts = Array.isArray(rawVal) ? rawVal.map(String) : String(rawVal).split(",");
        const names = parts.map((n) => n.trim().replace(/^\[\[|\]\]$/g, "").trim()).filter(Boolean);
        extras[key] = names.map((n) => `[[${n}]]`);
        const source = suggestionSource.startsWith("entity:") ? suggestionSource.slice("entity:".length) : suggestionSource;
        let targetEntityKey = ENTITIES[source] ? source : null;
        if (source.startsWith("folder:")) {
          const customFolderPath = source.slice("folder:".length);
          const normalizedPath = customFolderPath.replace(/\/+$/, "").toLowerCase();
          for (const [ek, edef] of Object.entries(ENTITIES)) {
            if (edef && edef.folder && edef.folder.replace(/\/+$/, "").toLowerCase() === normalizedPath) {
              targetEntityKey = ek;
              break;
            }
          }
        }
        if (!autoCreatesNote(targetEntityKey)) continue;
        const label = targetEntityKey ? ENTITIES[targetEntityKey].label : "Note";
        for (const name of names) links.push({ name, creationSource: source, label });
      }
    }
  }
  return { extras, links };
}
var CadenceAppView = class extends import_obsidian31.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    initAppViewState(this, plugin);
  }
  _toggleMobileNav(force) {
    return toggleMobileNav(this, force);
  }
  openEntityDetail(entityKey, file) {
    return openEntityDetail(this, entityKey, file);
  }
  openTemplateDetail(entityKey, file) {
    return openTemplateDetail(this, entityKey, file);
  }
  openEntityDetailFromFile(file) {
    return openEntityDetailFromFile(this, file);
  }
  closeEntityDetail() {
    return closeEntityDetail(this);
  }
  _migrateModeId(id) {
    return migrateModeId(id, this.plugin.settings);
  }
  _resolveSurface(id) {
    return resolveSurface(id, this.plugin.settings);
  }
  getEntityKanbanParams(entityKey) {
    return getEntityKanbanParams(this, entityKey);
  }
  /* Toggle Cadence-app dark mode. Scoped to `.cadence-app` only —
     does not affect Obsidian's overall light/dark mode. Persisted in settings. */
  _toggleCadenceDark() {
    return toggleCadenceDark(this);
  }
  _visibleNavGroups() {
    return visibleNavGroups(this.plugin.settings);
  }
  /* Link a daily-note task to a project. Keyed by (dailyPath, taskText). */
  _taskLinkKey(dailyPath, text) {
    return taskLinkKey(dailyPath, text);
  }
  _getTaskProjectLink(dailyPath, text) {
    return getTaskProjectLink(this, dailyPath, text);
  }
  _setTaskProjectLink(dailyPath, text, projectPath) {
    return setTaskProjectLink(this, dailyPath, text, projectPath);
  }
  _openTaskProjectPicker(dailyPath, text, currentLink) {
    return openTaskProjectPicker(this, dailyPath, text, currentLink);
  }
  _inboxOverdueCount() {
    return inboxOverdueCount(this);
  }
  getViewType() {
    return VIEW_TYPE_CADENCE_APP;
  }
  getDisplayText() {
    return "Cadence";
  }
  getIcon() {
    return "sparkles";
  }
  setMode(m) {
    return setMode(this, m);
  }
  toggleGroup(groupId) {
    return toggleGroup(this, groupId);
  }
  onOpen() {
    return onOpenAppView(this);
  }
  _modeUsesEntityFolder(path) {
    return modeUsesEntityFolder(path);
  }
  render() {
    return renderAppView(this);
  }
  renderComingSoon(root, surface2) {
    return renderComingSoon(this, root, surface2);
  }
  /* ── Generic page header ────────────────── */
  _renderPageHeader(root, title, subtitle, actions) {
    return renderPageHeader(this, root, title, subtitle, actions);
  }
  /* ── Generic entity LIST view ───────────── */
  renderEntityList(root, entityKey, opts) {
    return renderEntityList(this, root, entityKey, opts);
  }
  /* ── Entity DETAIL view (in-app form, autosaves to frontmatter) ── */
  renderEntityDetail(root, entityKey, file) {
    return renderEntityDetail(this, root, entityKey, file);
  }
  _renderEntityTable(parent, entityKey, filteredList, columns) {
    return renderEntityTable(this, parent, entityKey, filteredList, columns);
  }
  _renderChipInput(parent, f, current, opts) {
    return renderChipInput(this, parent, f, current, opts);
  }
  renderCompanyDetail(root, file) {
    return renderCompanyDetail(this, root, file);
  }
  /* ── Project DETAIL view (real PM surface) ─────── */
  renderProjectDetail(root, file) {
    return renderProjectDetail(this, root, file);
  }
  _renderMilestoneSection(parent, file, milestones, flashSaved, rawKey) {
    return renderMilestoneSection(this, parent, file, milestones, flashSaved, rawKey);
  }
  _commitMilestones(file, items, flashSaved, skipRender, rawKey) {
    return saveMilestones(this, file, items, flashSaved, skipRender, rawKey);
  }
  _renderTaskSection(parent, file, tasks, flashSaved, rawKey) {
    return renderTaskSection(this, parent, file, tasks, flashSaved, rawKey);
  }
  _commitTasks(file, items, flashSaved, skipRender, rawKey) {
    return saveTasks(this, file, items, flashSaved, skipRender, rawKey);
  }
  _writeProjectFrontmatter(file, patch, flashSaved) {
    return saveProjectFrontmatter(this, file, patch, flashSaved);
  }
  _renderMarkdownTextCard(parent, file, sectionKey, label, initialValue, placeholder, flashSaved) {
    return renderMarkdownTextCard(this, parent, file, sectionKey, label, initialValue, placeholder, flashSaved);
  }
  _renderProjectTextSection(parent, file, sections, def, flashSaved) {
    return renderProjectTextSection(this, parent, file, sections, def, flashSaved);
  }
  _renderGenericTextSection(parent, file, sections, key, flashSaved) {
    return renderGenericTextSection(this, parent, file, sections, key, flashSaved);
  }
  _renderSingleCrossSection(parent, targetEntity, linkField, viewType, parentName, preFilteredList) {
    return renderSingleCrossSection(this, parent, targetEntity, linkField, viewType, parentName, preFilteredList);
  }
  _renderDynamicH2Section(parent, file, sections, rawKey, flashSaved) {
    return renderDynamicH2Section(this, parent, file, sections, rawKey, flashSaved);
  }
  _renderCrossSections(parent, parentEntity, parentName) {
    return renderCrossSections(this, parent, parentEntity, parentName);
  }
  _renderEntityLinks(parent, val, targetEntityKey, prefix) {
    return renderEntityLinks(this, parent, val, targetEntityKey, prefix);
  }
  _renderOwnerLinks(parent, ownerVal, showPrefix) {
    return renderOwnerLinks(this, parent, ownerVal, showPrefix);
  }
  /* ── Home / Command Centre ───────────────── */
  renderHome(root) {
    return renderHome(this, root);
  }
  _homeCard(parent, title, action, tone) {
    return homeCard(this, parent, title, action, tone);
  }
  /* ── Top of the day — assistant-style daily briefing ── */
  _renderBriefing(root) {
    return renderBriefing(this, root);
  }
  _briefingHeadline(items) {
    return briefingHeadline(items);
  }
  _computeBriefing() {
    return loadBriefing(this);
  }
  _homeInboxCard(parent) {
    return homeInboxCard(this, parent);
  }
  _homeTodayCard(parent) {
    return homeTodayCard(this, parent);
  }
  _homeWeekCard(parent) {
    return homeWeekCard(this, parent);
  }
  _homeUpcomingCard(parent) {
    return homeUpcomingCard(this, parent);
  }
  _homePartnersCard(parent) {
    return homePartnersCard(this, parent);
  }
  _homeProjectsCard(parent) {
    return homeProjectsCard(this, parent);
  }
  _homePipelineCard(parent) {
    return homePipelineCard(this, parent);
  }
  _homeActivitiesCard(parent) {
    return homeActivitiesCard(this, parent);
  }
  renderTemplatesDashboard(root) {
    return renderTemplatesDashboard(this, root);
  }
  renderTemplateDetail(root, entityKey, file) {
    return renderTemplateDetail(this, root, entityKey, file);
  }
  _renderTemplateSectionWithDelete(parent, file, sections, rawKey, flashSaved) {
    return renderTemplateSectionWithDelete(this, parent, file, sections, rawKey, flashSaved);
  }
  _getEntityFiles(entityKey) {
    return getEntityFiles(this, entityKey);
  }
  _getFilesUsingTemplateSection(entityKey, rawKey) {
    return getFilesUsingTemplateSection(this, entityKey, rawKey);
  }
  _propagateTemplateSectionAdd(entityKey, cleanTitle, tag, defaultBody) {
    return propagateTemplateSectionAdd(this, entityKey, cleanTitle, tag, defaultBody);
  }
  _propagateTemplateSectionDelete(entityKey, rawKey) {
    return propagateTemplateSectionDelete(this, entityKey, rawKey);
  }
  /* ── Inbox (Planner reminders + captures) ── */
  renderInbox(root) {
    return renderInbox(this, root);
  }
  _renderProjectTasksSection(root) {
    return renderProjectTasksSection(this, root);
  }
  _renderInboxRow(parent, r, bucket) {
    return renderInboxRow(this, parent, r, bucket);
  }
  _quickAddTodayTask() {
    return quickAddTodayTask(this);
  }
  /* Central chart dispatcher — replaces 4 duplicated if-elseif blocks at call sites. */
  _drawChart(parent, style, data) {
    return drawChart(this, parent, style, data);
  }
  _drawChartEmpty(parent) {
    return drawChartEmpty(this, parent);
  }
  _drawDonutChart(parent, data) {
    return drawDonutChart(this, parent, data);
  }
  _drawBarChart(parent, data) {
    return drawBarChart(this, parent, data);
  }
  _drawKpiGrid(parent, data) {
    return drawKpiGrid(this, parent, data);
  }
  _drawSimpleList(parent, data) {
    return drawSimpleList(this, parent, data);
  }
  /* ── Projects Dashboard ─────────────────── */
  renderProjectsDashboard(root) {
    return renderProjectsDashboard(this, root);
  }
  /* ── CRM Dashboard ──────────────────────── */
  renderDashboard(root) {
    return renderCrmDashboard(this, root);
  }
  /* Reusable list card on the dashboard. */
  _dashCardSection(parent, title, rows, emptyMsg) {
    return dashCardSection(this, parent, title, rows, emptyMsg);
  }
  /* ── Reports: Productivity (over daily notes) ── */
  renderProductivity(root) {
    return renderProductivity(this, root);
  }
  /* ── Reports: Pipeline (deals breakdown) ──────── */
  renderReportPipeline(root) {
    return renderReportPipeline(this, root);
  }
  /* ── Reports: Sales (closed deals) ─────────────── */
  renderReportSales(root) {
    return renderReportSales(this, root);
  }
  /* ── Reports: Partners (deals attributed to partners) ─ */
  renderReportPartners(root) {
    return renderReportPartners(this, root);
  }
  /* ── Reports: Activity (mix of activity types) ─ */
  renderReportActivity(root) {
    return renderReportActivity(this, root);
  }
  /* ── Reports: Relationship Graph ────────── */
  renderReportGraph(root) {
    return renderReportGraph(this, root);
  }
  /* ── PRM Analytics ──────────────────────── */
  renderPRMAnalytics(root) {
    return renderPRMAnalytics(this, root);
  }
  /* ── Team (contacts where role contains "team") ─ */
  renderTeam(root) {
    return renderTeam(this, root);
  }
  /* ── Settings (opens Obsidian settings → Cadence) ─ */
  openSettingsTab(root) {
    return openSettingsTab(this, root);
  }
  /* ── Task completion propagation ──
     When a task is ticked or unticked anywhere, mirror the state to:
       - matching reminders by text (and via reminder.project to the linked project)
       - matching task lines in today's daily note + the linked reminder's date note
     Match is by exact (trimmed) task text. Renaming a task breaks the link. */
  _propagateTaskComplete(text, done, source) {
    return propagateTaskComplete(this, text, done, source);
  }
  _tickProjectTaskByText(file, text, done) {
    return tickProjectTaskByText(this, file, text, done);
  }
  _tickDailyNoteTaskByText(file, text, done) {
    return tickDailyNoteTaskByText(this, file, text, done);
  }
  _tickDailyNoteTask(file, ref, checked, date) {
    return tickDailyNoteTask(this, file, ref, checked, date);
  }
  /* ── Cadence-styled prompt modal ─ */
  _prompt(opts) {
    return openPrompt(this, opts);
  }
  _createEntityFromPrompt(entityKey, defaults) {
    return createEntityFromPrompt(this, entityKey, defaults);
  }
  /* ── Today pane ─────────────────────────── */
  renderTodayPane(root) {
    return renderTodayPane(this, root);
  }
  toggleTodayTask(idx, checked) {
    return toggleTodayTask(this, idx, checked);
  }
  appendTodayTask(text) {
    return appendTodayTask(this, text);
  }
  saveTodayJournal(body) {
    return saveTodayJournal(this, body);
  }
  /* ── Planner pane ───────────────────────── */
  renderPlannerPane(root) {
    return renderPlannerPane(this, root);
  }
  togglePlannerTask(day, idx, checked) {
    return togglePlannerTask(this, day, idx, checked);
  }
  async onClose() {
  }
};

// src/main.ts
var CadencePlugin = class extends import_obsidian32.Plugin {
  async onload() {
    await this.loadSettings();
    this.app.workspace.onLayoutReady(async () => {
      this.registerCustomPropertyTypes();
      await ensureDefaultTemplates(this.app);
    });
    this.registerView(
      VIEW_TYPE_CADENCE_APP,
      (leaf) => new CadenceAppView(leaf, this)
    );
    this.addRibbonIcon("sparkles", "Open Cadence", () => this.openApp());
    this.addCommand({
      id: "open-cadence",
      name: "Open Cadence",
      callback: () => this.openApp()
    });
    this.addCommand({
      id: "open-cadence-home",
      name: "Open Cadence \u2014 Home (command centre)",
      callback: () => this.openApp("home")
    });
    this.addCommand({
      id: "open-cadence-today",
      name: "Open Cadence \u2014 Today",
      callback: () => this.openApp("planner.today")
    });
    this.addCommand({
      id: "open-cadence-calendar",
      name: "Open Cadence \u2014 Calendar (week)",
      callback: () => this.openApp("planner.calendar")
    });
    this.addCommand({
      id: "open-cadence-pipeline",
      name: "Open Cadence \u2014 Pipeline",
      callback: () => this.openApp("crm.pipeline")
    });
    this.addCommand({
      id: "new-daily-entry",
      name: "New today entry (creates if missing)",
      callback: async () => {
        const file = await ensureDailyNote(this.app, this.settings);
        this.app.workspace.openLinkText(file.path, "", false);
      }
    });
    this.addSettingTab(new CadenceSettingTab(this.app, this));
    this.addRibbonIcon("plus-circle", "Cadence quick capture", () => this.openQuickCapture());
    this.addCommand({
      id: "quick-capture",
      name: "Quick capture (with optional reminder)",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "i" }],
      callback: () => this.openQuickCapture()
    });
    this.addCommand({
      id: "open-cadence-inbox",
      name: "Open Cadence \u2014 Inbox",
      callback: () => this.openApp("planner.inbox")
    });
    this.addCommand({
      id: "cadence-import-csv",
      name: "Import from CSV",
      callback: () => {
        let entityKey = "contact";
        const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CADENCE_APP)[0];
        if (leaf && leaf.view) {
          const m = String(leaf.view.mode || "");
          if (m === "crm.contacts") entityKey = "contact";
          else if (m === "crm.companies") entityKey = "company";
          else if (m === "crm.activities") entityKey = "activity";
          else if (m === "crm.pipeline") entityKey = "deal";
          else if (m === "prm.partners") entityKey = "partner";
          else if (m === "prm.registrations") entityKey = "registration";
          else if (m === "prm.commissions") entityKey = "commission";
          else if (m === "prm.leads") entityKey = "lead";
          else if (m === "prm.certifications") entityKey = "certification";
          else if (m === "workflow.sequences") entityKey = "sequence";
          else if (m === "projects.projects") entityKey = "project";
        }
        new CadenceImportModal(this.app, { entityKey }).open();
      }
    });
    this.app.workspace.onLayoutReady(() => this.tickReminders());
    this.registerInterval(window.setInterval(() => this.tickReminders(), 30 * 1e3));
    if (this.settings.openOnStartup) {
      this.app.workspace.onLayoutReady(() => this.openApp("home"));
    }
    this._syncInProgress = false;
    this.registerEvent(
      this.app.metadataCache.on("changed", async (file) => {
        await this.syncContactProjectRelationships(file);
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", async (file) => {
        await this.handleProjectDeletion(file);
      })
    );
  }
  /* ── Quick capture API ── */
  openQuickCapture(prefill) {
    new CadenceCaptureModal(this.app, {
      defaultText: prefill && prefill.text ? prefill.text : "",
      defaultWhen: prefill && prefill.when ? prefill.when : null,
      defaultRepeat: prefill && prefill.repeat ? prefill.repeat : "none",
      onSubmit: async (result) => {
        if (!result) return;
        const whenDate = result.when ? new Date(result.when) : null;
        const unreadable = whenDate !== null && isNaN(whenDate.getTime());
        const when = whenDate && !unreadable ? result.when : null;
        await this.addReminder({
          text: result.text,
          when,
          repeat: when ? result.repeat || "none" : "none"
        });
        const noteDate = when ? whenDate : /* @__PURE__ */ new Date();
        let dailyNoteAppended = false;
        try {
          const file = await ensureDailyNote(this.app, this.settings, noteDate);
          const content = await this.app.vault.read(file);
          const parsed = parseSections(content, this.settings);
          const newTasks = [...parsed.tasks, `- [ ] ${result.text}`];
          const next = replaceSection(content, this.settings.tasksHeading, newTasks.join("\n"));
          await this.app.vault.modify(file, next);
          dailyNoteAppended = true;
        } catch (_) {
        }
        const noteLabel = sameDay(noteDate, /* @__PURE__ */ new Date()) ? "today's note" : `${ymd(noteDate)} note`;
        const appended = dailyNoteAppended ? ` \xB7 added to ${noteLabel}` : "";
        if (when) {
          new import_obsidian32.Notice(`Reminder set \xB7 ${reminderTimeStr(when)}${appended}`);
        } else if (unreadable) {
          new import_obsidian32.Notice(`Captured to Inbox (couldn't read the time "${result.when}")${appended}`);
        } else {
          new import_obsidian32.Notice(`Captured to Inbox${appended}`);
        }
      }
    }).open();
  }
  /* ── Reminders CRUD ── */
  addReminder(partial) {
    return addReminder(this, partial);
  }
  updateReminder(id, patch) {
    return updateReminder(this, id, patch);
  }
  deleteReminder(id) {
    return deleteReminder(this, id);
  }
  snoozeReminder(id, ms) {
    return snoozeReminder(this, id, ms);
  }
  completeReminder(id) {
    return completeReminder(this, id);
  }
  refreshOpenViews() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_CADENCE_APP).forEach((leaf) => {
      if (leaf.view && typeof leaf.view.render === "function") leaf.view.render();
    });
  }
  /* ── Reminder ticker ── */
  tickReminders() {
    return tickReminders(this);
  }
  _fireReminder(r) {
    return fireReminder(this, r);
  }
  async openApp(mode = null) {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CADENCE_APP)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE_CADENCE_APP, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    if (leaf.view && typeof leaf.view.setMode === "function") {
      const target = mode || leaf.view.mode || "home";
      if (target === "planner.calendar") leaf.view.plannerAnchor = startOfDay(/* @__PURE__ */ new Date());
      await leaf.view.setMode(target);
    }
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CADENCE_APP);
  }
  registerCustomPropertyTypes() {
    return registerCustomPropertyTypes(this);
  }
  loadSettings() {
    return loadSettings(this);
  }
  syncContactProjectRelationships(changedFile) {
    return syncContactProjectRelationships(this, changedFile);
  }
  handleProjectDeletion(file) {
    return handleProjectDeletion(this, file);
  }
  saveSettings() {
    return saveSettings(this);
  }
};
module.exports = CadencePlugin;
