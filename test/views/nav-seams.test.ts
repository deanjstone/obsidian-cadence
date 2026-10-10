import { describe, expect, it } from "vitest";
import { ALL_SURFACES, SURFACE_BY_ID } from "../../src/constants/nav";
import {
  migrateModeId, modeUsesEntityFolder, resolveSurface, routeFor, visibleNavGroups,
} from "../../src/views/nav";
import type { CustomPage } from "../../src/types/settings";

/* Direct tests for the pure nav seams lifted out of CadenceAppView. The
   characterization tests in app-view-*.test.ts drive the same logic through
   the class delegates. */

const pages: CustomPage[] = [
  { id: "custom.1", label: "Vendors", icon: "truck", sectionId: "crm", entityKey: "vendor" },
  { id: "custom.2", label: "Notes", sectionId: "workflow", module: "planner", entityKey: "note" },
];

describe("migrateModeId", () => {
  it("maps old ids, keeps surfaces and custom pages, and defaults to home", () => {
    expect(migrateModeId("today", {})).toBe("planner.today");
    expect(migrateModeId("planner", { customPages: pages })).toBe("planner.calendar");
    expect(migrateModeId("reports.graph", {})).toBe("reports.graph");
    expect(migrateModeId("custom.1", { customPages: pages })).toBe("custom.1");
    expect(migrateModeId("custom.1", {})).toBe("home");
    expect(migrateModeId("valueOf", {})).toBe("valueOf");
  });
});

describe("resolveSurface", () => {
  it("prefers a custom page, then the nav surface, then Home", () => {
    expect(resolveSurface("custom.2", { customPages: pages })).toEqual({
      id: "custom.2", label: "Notes", icon: "file-text", desc: "Custom page displaying note entity.",
    });
    expect(resolveSurface("team", { customPages: pages })).toBe(SURFACE_BY_ID.team);
    expect(resolveSurface("nope", {})).toBe(SURFACE_BY_ID.home);
  });
});

describe("visibleNavGroups", () => {
  it("gates custom pages by their own module before their section's", () => {
    const groups = visibleNavGroups({ customPages: pages, modules: { planner: false } });
    const workflow = groups.find((g) => g.id === "workflow")!;
    expect(workflow.items.map((i) => i.id)).toEqual(["workflow.sequences"]);
    expect(groups.find((g) => g.id === "crm")!.items.at(-1)!.module).toBe("crm");
    expect(groups.map((g) => g.id)).not.toContain("planner");
  });
});

describe("modeUsesEntityFolder", () => {
  it("matches the Cadence/ prefix only", () => {
    expect([modeUsesEntityFolder("Cadence/x.md"), modeUsesEntityFolder("Cadence"), modeUsesEntityFolder(null)]).toEqual([
      true, false, false,
    ]);
  });
});

describe("routeFor", () => {
  it("routes every nav surface id to a surface method or an entity list", () => {
    const routes = Object.fromEntries(ALL_SURFACES.map((s) => [s.id, routeFor(s.id, [])]));
    expect(Object.values(routes).every((r) => r.kind === "surface" || r.kind === "entityList")).toBe(true);
    expect(routes).toMatchObject({
      "home": { kind: "surface", method: "renderHome" },
      "planner.calendar": { kind: "surface", method: "renderPlannerPane" },
      "crm.pipeline": { kind: "entityList", entityKey: "deal" },
      "workflow.sequences": { kind: "entityList", entityKey: "sequence" },
      "reports.productivity": { kind: "surface", method: "renderProductivity" },
      "settings": { kind: "surface", method: "openSettingsTab" },
    });
  });

  it("falls back to a custom page's entity list, then to the coming-soon card", () => {
    expect(routeFor("custom.1", pages)).toEqual({ kind: "entityList", entityKey: "vendor" });
    expect(routeFor("custom.9", pages)).toEqual({ kind: "comingSoon" });
    expect(routeFor("", [])).toEqual({ kind: "comingSoon" });
  });

  it("lets a built surface win over a custom page with the same id", () => {
    expect(routeFor("team", [{ ...pages[0], id: "team" }])).toEqual({ kind: "surface", method: "renderTeam" });
  });

  it("QUIRK: reports an Object.prototype member name as an inherited route, ahead of custom pages", () => {
    expect(routeFor("toString", [{ ...pages[0], id: "toString" }])).toEqual({ kind: "inherited", name: "toString" });
    expect(routeFor("__proto__", [])).toEqual({ kind: "inherited", name: "__proto__" });
  });
});
