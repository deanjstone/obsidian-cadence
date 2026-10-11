import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeElement, type MockFileSpec } from "../mocks/obsidian";
import { makeAppView } from "../helpers/app-view";
import { withTimezone, ZONES } from "../helpers/timezone";
import { fmtValue } from "../../src/utils/format";

/* Characterization tests for the Partners report, renderReportPartners:
   the four stat cards, partners by tier, deals grouped by their `partner`
   frontmatter, and certifications expiring in the next 90 days. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const NOW = Date.UTC(2026, 9, 11, 12);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup(files: MockFileSpec[] = []) {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  const made = makeAppView({ files });
  made.view.mode = "reports.partners";
  const root = new FakeElement("div");
  const sections = vi.spyOn(made.view, "_dashCardSection").mockImplementation(() => {});
  const links = vi.spyOn(made.view, "_renderEntityLinks").mockImplementation(() => {});
  return { ...made, root, sections, links };
}

const partner = (name: string, frontmatter: Record<string, unknown> = {}): MockFileSpec => ({ path: `Cadence/Partners/${name}.md`, frontmatter });
const deal = (name: string, frontmatter: Record<string, unknown>): MockFileSpec => ({ path: `Cadence/Pipeline/${name}.md`, frontmatter });
const cert = (name: string, frontmatter: Record<string, unknown>): MockFileSpec => ({ path: `Cadence/Certifications/${name}.md`, frontmatter });

const PARTNERS = [
  partner("P1", { tier: "Gold" }), partner("P2", { tier: "Gold" }), partner("P3", { tier: "Silver" }),
  partner("P4"), partner("P5", { tier: "Platinum" }),
];
const ACME_LIST = ["[[Acme]]"];
const DEALS = [
  deal("D1", { stage: "Won", value: 1000, partner: "[[Acme]]" }),
  deal("D2", { stage: "Lead", value: "500", partner: "[[Acme]]" }),
  deal("D3", { stage: "Won", value: 2000, partner: "[[Beta]]" }),
  deal("D4", { stage: "Won", value: 300 }),
  deal("D5", { stage: "Lead", value: 100, partner: "" }),
  deal("D6", { stage: "Lead", value: 50, partner: ACME_LIST }),
];
const CERTS = [
  cert("C1", { name: "ISO", partner: "[[Acme]]", expires: "2026-10-20" }),
  cert("C2", { expires: "2026-12-31" }),
  cert("C3", { name: "Late", expires: "2027-02-01" }),
  cert("C4", { name: "Past", expires: "2026-10-01" }),
  cert("C5", { name: "Undated" }),
  cert("C6", { name: "Garbage", expires: "garbage" }),
  cert("C7", { name: "Today", expires: "2026-10-11" }),
  cert("C8", { name: "Edge", partner: "[[Beta]]", expires: "2027-01-09" }),
];
const ALL = [...PARTNERS, ...DEALS, ...CERTS];

const cur = (n: number) => fmtValue(n, "currency");
const headerTexts = (root: FakeElement) => root.children[0].children[0].children.map((c) => c.text);
const stats = (root: FakeElement) => root.children[1].children.map((c) => [c.dataset.accent, ...c.children.map((x) => x.text)]);
const cols = (root: FakeElement) => root.children[root.children.length - 1];
const dealsCard = (root: FakeElement) => cols(root).children[0].children[0];
const dealRows = (root: FakeElement) => dealsCard(root).children[1].children.map((r) => [r.children[0].text, r.children[1].text]);
const section = (sections: Any, title: string) => sections.mock.calls.find((c: Any[]) => String(c[1]).startsWith(title));

describe("renderReportPartners: layout and stats", () => {
  it("adds the report class, renders the header and lays out stats, tiers and two columns", async () => {
    const { view, root } = setup(ALL);
    await view.renderReportPartners(root);
    expect(root.classes).toEqual(["cadence-report"]);
    expect(headerTexts(root)).toEqual(["CADENCE", "Partners report", "Partner-sourced revenue, tier mix, certification health"]);
    expect(root.children.map((c) => [c.classes, c.text])).toEqual([
      [["cad-page-header"], ""],
      [["cad-stat-grid"], ""],
      [["cad-section-label-lg"], "PARTNERS BY TIER"],
      [["cad-dash-card"], ""],
      [["cad-dash-cols"], ""],
    ]);
  });

  it("counts sources by the partner they name, so a one-item list and a wikilink to the same partner are one source", async () => {
    const { view, root } = setup(ALL);
    await view.renderReportPartners(root);
    expect(stats(root)).toEqual([
      ["sky", "PARTNERS", "5", "on the books"],
      ["mint", "PARTNER DEALS", "4", cur(3550)],
      ["emerald", "PARTNER REV", cur(3000), "2 won"],
      ["warn", "UNIQUE SOURCES", "3", "including direct"],
    ]);
  });

  it("shows zeros, no tier section and the empty deals card with nothing in the vault", async () => {
    const { view, root } = setup();
    await view.renderReportPartners(root);
    expect(stats(root)).toEqual([
      ["sky", "PARTNERS", "0", "on the books"],
      ["mint", "PARTNER DEALS", "0", cur(0)],
      ["emerald", "PARTNER REV", cur(0), "0 won"],
      ["warn", "UNIQUE SOURCES", "0", "including direct"],
    ]);
    expect(root.children.map((c) => c.classes)).toEqual([["cad-page-header"], ["cad-stat-grid"], ["cad-dash-cols"]]);
    const body = dealsCard(root).children[1];
    expect(body.children.map((c) => [c.classes, c.text])).toEqual([[["cad-empty"], "No deals attributed to partners yet."]]);
  });
});

describe("renderReportPartners: tiers", () => {
  it("counts partners per tier, most first, with a tier accent and 'Untiered' for none", async () => {
    const { view, root } = setup(ALL);
    await view.renderReportPartners(root);
    const card = root.children[3];
    expect(card.style.margin).toBe("0 36px 18px 36px");
    expect(card.children[0].classes).toEqual(["cad-dash-card-body", "cad-mini-stat-row"]);
    expect(card.children[0].children.map((m) => [m.dataset.accent, ...m.children.map((c) => c.text)])).toEqual([
      ["warn", "2", "GOLD"],
      ["sky", "1", "SILVER"],
      ["sky", "1", "UNTIERED"],
      ["sky", "1", "PLATINUM"],
    ]);
  });

  it("uses each built-in tier's accent", async () => {
    const { view, root } = setup([partner("B", { tier: "Bronze" }), partner("S", { tier: "Standard" })]);
    await view.renderReportPartners(root);
    expect(root.children[3].children[0].children.map((m) => m.dataset.accent)).toEqual(["rose", "mint"]);
  });
});

describe("renderReportPartners: deals by partner", () => {
  it("lists sources by deal count, links partners and shows (direct) as text", async () => {
    const { view, root, links } = setup(ALL);
    await view.renderReportPartners(root);
    expect(dealsCard(root).children[0].children[0].text).toBe("DEALS BY PARTNER");
    expect(dealRows(root)).toEqual([
      ["", `3 deals · ${cur(1550)}`],
      ["(direct)", `2 deals · ${cur(400)}`],
      ["", `1 deal · ${cur(2000)}`],
    ]);
    const titles = dealsCard(root).children[1].children.map((r) => r.children[0]);
    expect(links.mock.calls).toEqual([[titles[0], "Acme", "partner"], [titles[2], "Beta", "partner"]]);
  });

  it("QUIRK: with only direct deals, the card lists (direct) rather than its empty message", async () => {
    const { view, root } = setup([deal("D", { value: 5 })]);
    await view.renderReportPartners(root);
    expect(dealRows(root)).toEqual([["(direct)", `1 deal · ${cur(5)}`]]);
  });

  it("keeps the top 10 sources", async () => {
    const files = Array.from({ length: 12 }, (_, i) => deal(`X${i}`, { value: 1, partner: `[[P${i}]]` }));
    const { view, root } = setup(files);
    await view.renderReportPartners(root);
    expect(dealRows(root)).toHaveLength(10);
  });
});

describe("renderReportPartners: certification expiries", () => {
  it("lists certs expiring from today to 90 days out, soonest first, with the partner linked", async () => {
    const { view, root, sections, app } = setup(ALL);
    await view.renderReportPartners(root);
    const [parent, title, rows, empty] = section(sections, "CERTS EXPIRING");
    expect(parent).toBe(cols(root).children[1]);
    expect(title).toBe("CERTS EXPIRING · NEXT 90 DAYS");
    const file = (n: string) => app.vault.getAbstractFileByPath(`Cadence/Certifications/${n}.md`);
    const exp = (s: string) => ` · expires ${fmtValue(new Date(s), "date")}`;
    expect(rows).toEqual([
      { title: "Today", metaParts: [{ text: "—", entityKey: "partner" }, { text: exp("2026-10-11") }], file: file("C7") },
      { title: "ISO", metaParts: [{ text: "[[Acme]]", entityKey: "partner" }, { text: exp("2026-10-20") }], file: file("C1") },
      { title: "C2", metaParts: [{ text: "—", entityKey: "partner" }, { text: exp("2026-12-31") }], file: file("C2") },
      { title: "Edge", metaParts: [{ text: "[[Beta]]", entityKey: "partner" }, { text: exp("2027-01-09") }], file: file("C8") },
    ]);
    expect(empty).toBe("No certifications expiring in the next 90 days.");
  });

  it("a cert expiring today is still upcoming, in every zone", async () => {
    for (const tz of ZONES) {
      await withTimezone(tz, async () => {
        const { view, root, sections } = setup([CERTS[6], CERTS[3]]);
        await view.renderReportPartners(root);
        expect(section(sections, "CERTS EXPIRING")[2].map((r: Any) => r.title)).toEqual(["Today"]);
        vi.useRealTimers();
        vi.restoreAllMocks();
      });
    }
  });

  it("caps the list at 8", async () => {
    const files = Array.from({ length: 10 }, (_, i) => cert(`E${i}`, { expires: `2026-11-${String(10 + i)}` }));
    const { view, root, sections } = setup(files);
    await view.renderReportPartners(root);
    expect(section(sections, "CERTS EXPIRING")[2].map((r: Any) => r.title)).toEqual(["E0", "E1", "E2", "E3", "E4", "E5", "E6", "E7"]);
  });

  it("a partner deal at a lower-case 'won' is partner revenue", async () => {
    const { view, root } = setup([deal("X", { stage: "won", value: 70, partner: "[[Acme]]" })]);
    await view.renderReportPartners(root);
    expect(stats(root).slice(1, 3)).toEqual([["mint", "PARTNER DEALS", "1", cur(70)], ["emerald", "PARTNER REV", cur(70), "1 won"]]);
  });
});
