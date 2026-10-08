import { describe, expect, it } from "vitest";
import { ALL_SURFACES, BUILT_SURFACES, NAV_GROUPS, SURFACE_BY_ID, VIEW_TYPE_CADENCE_APP } from "../../src/legacy/cadence.js";

/* Characterization tests for the nav structure the view renders. */

describe("nav constants", () => {
  it("uses the cadence-app view type", () => {
    expect(VIEW_TYPE_CADENCE_APP).toBe("cadence-app");
  });
  it("defines the groups and surfaces in nav order", () => {
    expect(NAV_GROUPS.map((g: { id: string }) => g.id)).toEqual([
      "home_group", "planner", "projects", "crm", "prm", "workflow", "reports", "misc",
    ]);
    expect(ALL_SURFACES.map((s: { id: string }) => s.id)).toEqual([
      "home",
      "planner.inbox", "planner.today", "planner.calendar",
      "projects.dashboard", "projects.projects",
      "crm.dashboard", "crm.pipeline", "crm.contacts", "crm.companies", "crm.activities",
      "prm.partners", "prm.registrations", "prm.commissions", "prm.leads", "prm.certifications", "prm.analytics",
      "workflow.sequences",
      "reports.pipeline", "reports.sales", "reports.partners", "reports.activity", "reports.productivity", "reports.graph",
      "team", "templates", "settings",
    ]);
  });
  it("indexes surfaces by id", () => {
    for (const s of ALL_SURFACES) expect(SURFACE_BY_ID[s.id]).toBe(s);
  });
  it("marks every surface as built", () => {
    expect([...BUILT_SURFACES].sort()).toEqual(ALL_SURFACES.map((s: { id: string }) => s.id).sort());
  });
});
