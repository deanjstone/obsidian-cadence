import { describe, expect, it } from "vitest";
import type { TFile } from "obsidian";
import { ENTITIES } from "../../src/constants/entities";
import { isTeamMember, prmAnalytics, teamListOptions } from "../../src/views/prm";
import { fmtValue, pctBand } from "../../src/utils/format";
import type { Entity } from "../../src/types/entities";

/* Direct tests for the PRM analytics and Team seams over plain entities,
   with no view and no vault. */

const entity = (basename: string, frontmatter: Record<string, unknown>): Entity =>
  ({ file: { path: `${basename}.md`, basename } as TFile, frontmatter, basename });
const cur = (n: number) => fmtValue(n, "currency");

const PARTNERS = [
  entity("Acme", { tier: "Gold" }),
  entity("Beta", { name: "Beta Ltd", tier: "Bronze" }),
  entity("Cee", {}),
];
const DEALS = [
  entity("D1", { stage: "Won", value: 100, partner: "Acme" }),
  entity("D2", { stage: "Won", value: "300", partner: "Beta Ltd" }),
  entity("D3", { stage: "Lost", value: 50, partner: "Acme" }),
  entity("D4", { stage: "Negotiation", value: 25, partner: "Nobody" }),
  entity("D5", { stage: "Won", value: 1000 }),
];

describe("prmAnalytics", () => {
  it("returns the stats, tiers, top partners, funnel and conversion", () => {
    expect(prmAnalytics(PARTNERS, DEALS)).toEqual({
      stats: [
        { label: "PARTNERS", value: 3, sub: "on the books", accent: "sky" },
        { label: "SOURCED DEALS", value: 4, sub: cur(475), accent: "mint" },
        { label: "PARTNER REVENUE", value: cur(400), sub: "2 won", accent: "emerald" },
        { label: "PARTNER SHARE", value: "32%", sub: "of total deal value", accent: "warn" },
      ],
      tiers: [
        { label: "GOLD", value: "1", accent: "warn", sub: cur(100) },
        { label: "BRONZE", value: "1", accent: "rose", sub: cur(300) },
        { label: "UNTIERED", value: "1", accent: "mint", sub: "—" },
      ],
      topPartners: [
        { title: "Beta Ltd", meta: cur(300), file: PARTNERS[1].file },
        { title: "Acme", meta: cur(100), file: PARTNERS[0].file },
      ],
      funnel: [
        { label: "SOURCED", value: "4", sub: cur(475), accent: "sky" },
        { label: "OPEN", value: "1", sub: cur(25), accent: "mint" },
        { label: "WON", value: "2", sub: cur(400), accent: "emerald" },
        { label: "LOST", value: "1", sub: cur(50), accent: "rose" },
      ],
      conversion: { won: 2, closed: 3, pct: 67, band: pctBand(67) },
    });
  });

  it("is all zeros with no data", () => {
    const empty = prmAnalytics([], []);
    expect(empty.stats.map((s) => s.value)).toEqual([0, 0, cur(0), "0%"]);
    expect([empty.tiers, empty.topPartners]).toEqual([[], []]);
    expect(empty.conversion).toEqual({ won: 0, closed: 0, pct: 0, band: pctBand(0) });
  });

  it("sorts tiers by count, keeping first-seen order on ties, with sky for a tier off the accent list", () => {
    const partners = ["Platinum", "Gold", "Gold", undefined].map((tier, i) => entity(`P${i}`, tier ? { tier } : {}));
    expect(prmAnalytics(partners, []).tiers.map((t) => [t.label, t.value, t.accent])).toEqual([
      ["GOLD", "2", "warn"], ["PLATINUM", "1", "sky"], ["UNTIERED", "1", "mint"],
    ]);
  });

  it("sums every won deal per partner value into the top partners, top 8 by revenue", () => {
    const deals = [
      ...Array.from({ length: 9 }, (_, i) => entity(`D${i}`, { stage: "Won", value: 10 * (i + 1), partner: `P${i}` })),
      entity("X", { stage: "Won", value: 5, partner: "P0" }),
    ];
    const rows = prmAnalytics([], deals).topPartners;
    expect(rows.map((r) => [r.title, r.meta, r.file])).toEqual([
      ["P8", cur(90), null], ["P7", cur(80), null], ["P6", cur(70), null], ["P5", cur(60), null],
      ["P4", cur(50), null], ["P3", cur(40), null], ["P2", cur(30), null], ["P1", cur(20), null],
    ]);
  });

  it("names a partner by link target in any case, so a wikilinked or differently-cased partner earns its tier revenue", () => {
    const deals = [entity("A", { stage: "Won", value: 10, partner: "[[Acme]]" }), entity("B", { stage: "Won", value: 20, partner: "acme" })];
    const report = prmAnalytics([PARTNERS[0]], deals);
    expect(report.tiers).toEqual([{ label: "GOLD", value: "1", accent: "warn", sub: cur(30) }]);
    expect(report.topPartners).toEqual([{ title: "Acme", meta: cur(30), file: PARTNERS[0].file }]);
  });

  it("takes the defs it is given", () => {
    const def = { ...ENTITIES.deal, fields: ENTITIES.deal.fields };
    const report = prmAnalytics([], [entity("A", { stage: "Won", value: 7, partner: "X" })], { partner: ENTITIES.partner, deal: def });
    expect(report.funnel[2]).toEqual({ label: "WON", value: "1", sub: cur(7), accent: "emerald" });
  });
});

describe("isTeamMember and teamListOptions", () => {
  it("matches team, admin or member anywhere in the role, in any case", () => {
    const roles = ["Team", "admin", "MEMBER", "Teammate", "Remember", "Sales", "", undefined, ["Sales", "Admin"]];
    expect(roles.map((role) => isTeamMember(entity("c", role === undefined ? {} : { role })))).toEqual([
      true, true, true, true, true, false, false, false, true,
    ]);
  });

  it("gives the Team title, the team filter and four leading columns, fresh on each call", () => {
    const opts = teamListOptions();
    expect([opts.title, opts.columns]).toEqual(["Team", ["name", "role", "email", "company"]]);
    expect(opts.filter!(entity("c", { role: "admin" }))).toBe(true);
    expect(opts.filter!(entity("c", { role: "client" }))).toBe(false);
    expect(teamListOptions().columns).not.toBe(opts.columns);
  });
});
