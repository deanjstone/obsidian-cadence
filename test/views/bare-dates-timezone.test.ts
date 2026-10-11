import { expect, it } from "vitest";
import { TFile } from "../mocks/obsidian";
import { describeInZones } from "../helpers/timezone";
import { ENTITIES } from "../../src/constants/entities";
import { ymd } from "../../src/utils/dates";
import { fmtValue } from "../../src/utils/format";
import { computeBriefing, selectUpcomingItems, type BriefingData } from "../../src/views/home";
import { activityReport } from "../../src/views/reports";
import type { Entity } from "../../src/types/entities";

/* #70: every read of a bare YYYY-MM-DD field is local midnight (parseYmd), so
   nothing is a day early or dropped west of UTC, or a day late east of it.
   Full ISO timestamps parse as before. Each `now` is built inside the test,
   under the zone describeInZones set. */

function entity(path: string, frontmatter: Record<string, unknown> = {}): Entity {
  const file = new TFile(path);
  return { file: file as never, frontmatter, basename: file.basename };
}

const empty: BriefingData = { openTasks: 0, deals: [], contacts: [], projects: [] };

describeInZones("Home Upcoming bare dates", () => {
  it("keeps a project due, registration and cert expiring today, dated today", () => {
    const project = entity("Cadence/Projects/P.md", { name: "P", due: "2026-10-11" });
    const reg = entity("Cadence/Registrations/R.md", { expires: "2026-10-11" });
    const cert = entity("Cadence/Certifications/C.md", { name: "C", expires: "2026-10-11" });
    const out = selectUpcomingItems({ projects: [project], projectNext: [], registrations: [reg], certifications: [cert] }, new Date(2026, 9, 11, 9));
    expect(out.map((i) => [i.title, ymd(i.date)])).toEqual([["P", "2026-10-11"], ["R", "2026-10-11"], ["C", "2026-10-11"]]);
  });

  it("keeps the seventh day out and drops the eighth", () => {
    const p = (due: string) => entity(`Cadence/Projects/${due}.md`, { due });
    const out = selectUpcomingItems({ projects: [p("2026-10-18"), p("2026-10-19")], projectNext: [], registrations: [], certifications: [] }, new Date(2026, 9, 11, 9));
    expect(out.map((i) => i.title)).toEqual(["2026-10-18"]);
  });

  it("reads a full ISO timestamp as before", () => {
    const due = "2026-10-12T00:00:00Z";
    const out = selectUpcomingItems({ projects: [entity("Cadence/Projects/T.md", { due })], projectNext: [], registrations: [], certifications: [] }, new Date(2026, 9, 11, 9));
    expect(out.map((i) => i.date.getTime())).toEqual([new Date(due).getTime()]);
  });
});

describeInZones("Home briefing closing this week", () => {
  it("counts a deal closing today and one closing seven days out", () => {
    const out = computeBriefing({
      ...empty,
      deals: [
        entity("Cadence/Pipeline/A.md", { stage: "Lead", value: 100, closeBy: "2026-10-11" }),
        entity("Cadence/Pipeline/B.md", { stage: "Lead", value: 50, closeBy: "2026-10-18" }),
        entity("Cadence/Pipeline/C.md", { stage: "Lead", value: 1, closeBy: "2026-10-19" }),
      ],
    }, new Date(2026, 9, 11, 9));
    expect(out.map((i) => i.text)).toEqual(["2 deals close this week · $150"]);
  });
});

describeInZones("Home briefing stale contacts", () => {
  const briefing = (lastContact: string) => computeBriefing({
    ...empty,
    deals: [entity("Cadence/Pipeline/Deal.md", { stage: "Lead", contact: "Jane", title: "Big" })],
    contacts: [entity("Cadence/Contacts/Jane.md", { name: "Jane", lastContact })],
  }, new Date(2026, 11, 15, 9)).map((i) => i.text);

  /* December, so the 30 days back cross no DST change in any zone. */
  it("is not stale at 30 days and counts 31 days quiet after that", () => {
    expect(briefing("2026-11-15")).toEqual([]);
    expect(briefing("2026-11-14")).toEqual(["Jane — 31 days quiet · Big"]);
  });
});

describeInZones("fmtValue bare dates", () => {
  it("shows the stored day", () => {
    expect(fmtValue("2026-10-08", "date")).toBe("Oct 8, 2026");
    expect(fmtValue(["2026-10-08"], "date")).toBe("Oct 8, 2026");
  });

  it("formats a full ISO timestamp as before", () => {
    const iso = "2026-10-08T12:00:00Z";
    expect(fmtValue(iso, "date")).toBe(new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }));
  });
});

describeInZones("activityReport weekly buckets", () => {
  const activity = ENTITIES.activity;
  const act = (when: string) => entity(`Cadence/Activities/${when}.md`, { when });

  it("puts a bare-date activity on a week's first day in that week", () => {
    const report = activityReport([act("2026-10-12"), act("2026-10-11")], activity, new Date(2026, 9, 14, 9), 1);
    expect(report.weeks.map((w) => [ymd(w.start), w.count]).slice(-2)).toEqual([["2026-10-05", 1], ["2026-10-12", 1]]);
  });

  it("buckets a full ISO timestamp as before", () => {
    const when = "2026-10-12T03:00:00Z";
    const t = new Date(when).getTime();
    const report = activityReport([act(when)], activity, new Date(2026, 9, 14, 9), 1);
    expect(report.weeks.filter((w) => w.count).map((w) => t >= w.start.getTime() && t < w.end.getTime())).toEqual([true]);
  });
});
