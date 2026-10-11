import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FakeElement, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";
import { describeInZones, JAN_OFFSET } from "../helpers/timezone";
import { parseMilestones, stringifyMilestones } from "../../src/utils/parsing";
import { commitMilestones, milestoneDateFromInput, milestoneDateValue } from "../../src/views/project-detail";

/* #46: a milestone's bare YYYY-MM-DD is a local date, read and written the
   same way, so no edit moves a date in any zone. Each block runs under a zone
   west of UTC, UTC itself and a zone east of UTC. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const MILESTONES = "- [x] 2026-01-01 — New year\n    Went well\n- [ ] 2026-03-08 — DST west\n- [ ] 2026-04-05 — DST east\n- [ ] 2026-10-04 — Spring\n- [ ] 2026-11-01 — Beta\n- [ ] 2026-12-31 — Year end\n- [ ] Launch";
const BODY = `## Brief\nGo\n## Milestones\n${MILESTONES}\n\n## Tasks\n- [ ] Plan\n`;
const APOLLO: MockFileSpec = { path: "Cadence/Projects/Apollo.md", frontmatter: { name: "Apollo" }, body: BODY };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup() {
  const made = makeAppView({ files: [APOLLO] });
  const parent = new FakeElement("div");
  vi.spyOn(made.view, "render").mockResolvedValue(undefined);
  const file = made.app.vault.getAbstractFileByPath(APOLLO.path) as Any;
  const section = async () => {
    const content = await made.app.vault.read(file);
    const rest = content.slice(content.indexOf("## Milestones\n") + "## Milestones\n".length);
    return rest.slice(0, rest.indexOf("\n## "));
  };
  const list = parseMilestones(MILESTONES);
  made.view._renderMilestoneSection(parent, file, list, vi.fn());
  const row = (idx: number) => parent.children[0].children[1].children[idx].children[0];
  const addButton = parent.children[0].children[0].children[1];
  return { section, row, addButton, list };
}

const dates = (text: string) => text.match(/\d{4}-\d{2}-\d{2}/g);

describeInZones("timezone", (tz) => {
  it("TZ takes effect for Node Date", () => {
    expect(process.env.TZ).toBe(tz);
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(JAN_OFFSET[tz]);
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(tz);
  });
});

describeInZones("#46 row 1: milestone dates survive every write", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 9, 10, 9));
  });

  it("parse → stringify is the identity, and so is the section commit", () => {
    expect(stringifyMilestones(parseMilestones(MILESTONES))).toBe(MILESTONES);
    expect(commitMilestones(BODY, parseMilestones(MILESTONES))).toBe(BODY);
  });

  it("ticking one milestone moves no date", async () => {
    const { section, row } = setup();
    const tick = row(4).children[0];
    tick.checked = true;
    tick.trigger("change");
    await flush();
    const after = await section();
    expect(dates(after)).toEqual(dates(MILESTONES));
    expect(after).toContain("- [x] 2026-11-01 — Beta\n");
  });

  it("a title edit, a delete and an add move no date", async () => {
    const { section, row, addButton } = setup();
    const name = row(1).children[2];
    name.value = "DST in the west";
    name.trigger("input");
    await vi.advanceTimersByTimeAsync(400);
    expect(dates(await section())).toEqual(dates(MILESTONES));
    row(0).children[3].trigger("click");
    await flush();
    expect(dates(await section())).toEqual(dates(MILESTONES)!.slice(1));
    addButton.trigger("click");
    await flush();
    expect(await section()).toBe(`${MILESTONES.split("\n").slice(2).join("\n").replace("DST west", "DST in the west")}\n- [ ] 2026-10-10\n`);
  });
});

describeInZones("#46 row 2: the milestone date input shows the written date", () => {
  it("shows each written date, and a picked date is written as picked", () => {
    for (const m of parseMilestones(MILESTONES).filter((x) => x.date)) {
      const value = milestoneDateValue(m.date)!;
      expect(MILESTONES).toContain(`${value} — ${m.title}`);
      expect(milestoneDateValue(milestoneDateFromInput(value))).toBe(value);
      expect(stringifyMilestones([{ title: "X", date: milestoneDateFromInput(value) }])).toBe(`- [ ] ${value} — X`);
    }
  });
});
