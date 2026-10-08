import { describe, expect, it } from "vitest";
import {
  parseH2Sections,
  parseHeaderKey,
  parseLinkValues,
  parseMilestones,
  parseSections,
  parseTasksList,
  replaceSection,
  stringifyMilestones,
  stringifyTasks,
} from "../../src/utils/parsing";

/* Characterization tests for the markdown/string helpers. */

const SETTINGS = { tasksHeading: "## Today", journalHeading: "## Journal" };

describe("parseH2Sections", () => {
  it("maps each H2 heading to the lines under it", () => {
    const content = "# Title\nintro\n## Brief\nWhy now.\n\n## Scope\n- a\n- b";
    expect(parseH2Sections(content)).toEqual({ Brief: "Why now.\n", Scope: "- a\n- b" });
  });
  it("ignores content before the first H2 and keeps H3+ inside the section", () => {
    expect(parseH2Sections("preamble\n## A\n### Sub\nx")).toEqual({ A: "### Sub\nx" });
  });
  it("needs whitespace after ## and trims the heading text", () => {
    expect(parseH2Sections("##NoSpace\n##   Spaced   \nbody")).toEqual({ Spaced: "body" });
  });
  it("lets a later duplicate heading overwrite an earlier one", () => {
    expect(parseH2Sections("## A\none\n## A\ntwo")).toEqual({ A: "two" });
  });
  it("returns an empty map when there are no H2s", () => {
    expect(parseH2Sections("")).toEqual({});
    expect(parseH2Sections("# only h1")).toEqual({});
  });
  it("keeps the inline #tag as part of the key", () => {
    expect(Object.keys(parseH2Sections("## Milestones #milestones\n- [ ] x"))).toEqual(["Milestones #milestones"]);
  });
});

describe("parseHeaderKey", () => {
  it("splits a trailing #tag from the label", () => {
    expect(parseHeaderKey("Contacts #cross-contact-company-table")).toEqual({
      cleanLabel: "Contacts",
      tag: "#cross-contact-company-table",
    });
  });
  it("returns an empty tag when there is none", () => {
    expect(parseHeaderKey("  Notes  ")).toEqual({ cleanLabel: "Notes", tag: "" });
  });
  it("only recognises a tag at the very end", () => {
    expect(parseHeaderKey("Foo #bar baz")).toEqual({ cleanLabel: "Foo #bar baz", tag: "" });
  });
  it("does not need whitespace before the tag", () => {
    expect(parseHeaderKey("Label#tag")).toEqual({ cleanLabel: "Label", tag: "#tag" });
  });
  it("treats a bare tag as an empty label", () => {
    expect(parseHeaderKey("#notes")).toEqual({ cleanLabel: "", tag: "#notes" });
  });
  it("takes only the last tag when there are several", () => {
    expect(parseHeaderKey("A #one #two")).toEqual({ cleanLabel: "A #one", tag: "#two" });
  });
});

describe("parseMilestones", () => {
  it("returns [] for empty input", () => {
    expect(parseMilestones("")).toEqual([]);
    expect(parseMilestones(undefined)).toEqual([]);
  });
  it("parses done state, date and title with em dash, en dash, hyphen or no separator", () => {
    const text = [
      "- [x] 2026-05-15 — Launch",
      "- [ ] 2026-06-01 – Review",
      "- [X] 2026-07-01 - Ship",
      "- [ ] 2026-08-01 Retro",
    ].join("\n");
    const items = parseMilestones(text);
    expect(items.map((m: { done: boolean }) => m.done)).toEqual([true, false, true, false]);
    expect(items.map((m: { title: string }) => m.title)).toEqual(["Launch", "Review", "Ship", "Retro"]);
    expect(items[0].date).toEqual(new Date("2026-05-15"));
    expect(items[0].notes).toBe("");
  });
  it("keeps undated milestones with a null date", () => {
    expect(parseMilestones("- [ ] Write spec")).toEqual([{ done: false, date: null, title: "Write spec", notes: "" }]);
  });
  it("gives a date-only milestone an empty title", () => {
    expect(parseMilestones("- [ ] 2026-01-01")).toEqual([{ done: false, date: new Date("2026-01-01"), title: "", notes: "" }]);
  });
  it("drops an invalid date but still strips it from the title", () => {
    expect(parseMilestones("- [ ] 2026-13-45 — Bad")).toEqual([{ done: false, date: null, title: "Bad", notes: "" }]);
  });
  it("collects indented lines as notes, stripping up to four spaces or one tab", () => {
    const text = "- [ ] 2026-01-01 — A\n    first\n\tsecond\n        deeper\n  two-space\n- [ ] B";
    const [a, b] = parseMilestones(text);
    expect(a.notes).toBe("first\nsecond\n    deeper\ntwo-space");
    expect(b.notes).toBe("");
  });
  it("accepts indented checkbox lines as milestones, not notes", () => {
    expect(parseMilestones("- [ ] A\n  - [x] B").map((m: { title: string }) => m.title)).toEqual(["A", "B"]);
  });
  it("ignores blank and non-indented non-milestone lines", () => {
    expect(parseMilestones("intro\n- [ ] A\n\nnot a note\n    note")).toEqual([
      { done: false, date: null, title: "A", notes: "note" },
    ]);
  });
  it("needs a space inside the box and after it", () => {
    expect(parseMilestones("- [] A\n-[ ] B\n- [ ]C")).toEqual([]);
  });
  it("reads done from ' [x] ' anywhere in the line", () => {
    // An indented "- [ ]" line whose title contains " [x] " is reported done.
    expect(parseMilestones("- [ ] mention [x] inline")[0].done).toBe(true);
  });
});

describe("stringifyMilestones", () => {
  it("returns '' for empty input", () => {
    expect(stringifyMilestones([])).toBe("");
    expect(stringifyMilestones(null)).toBe("");
  });
  it("writes box, date and em-dash title", () => {
    expect(
      stringifyMilestones([
        { done: true, date: new Date(2026, 4, 15), title: "Launch" },
        { done: false, date: null, title: "Undated" },
        { done: false, date: new Date(2026, 0, 2), title: "" },
        { done: false, date: new Date("nope"), title: "Invalid date" },
      ]),
    ).toBe("- [x] 2026-05-15 — Launch\n- [ ] Undated\n- [ ] 2026-01-02\n- [ ] Invalid date");
  });
  it("indents notes four spaces and skips whitespace-only notes", () => {
    expect(stringifyMilestones([{ done: false, date: null, title: "A", notes: "one\n  two" }])).toBe("- [ ] A\n    one\n      two");
    expect(stringifyMilestones([{ done: false, date: null, title: "A", notes: "  \n " }])).toBe("- [ ] A");
  });
  it("round-trips through parseMilestones", () => {
    const text = "- [x] 2026-05-15 — Launch\n    shipped it\n- [ ] Next";
    expect(stringifyMilestones(parseMilestones(text))).toBe(text);
  });
});

describe("parseTasksList / stringifyTasks", () => {
  it("parses checkbox lines and skips everything else", () => {
    expect(parseTasksList("- [ ] one\nnot a task\n  - [x] two\n- [X] three")).toEqual([
      { done: false, title: "one" },
      { done: true, title: "two" },
      { done: true, title: "three" },
    ]);
  });
  it("returns [] for empty input", () => {
    expect(parseTasksList("")).toEqual([]);
    expect(parseTasksList(null)).toEqual([]);
  });
  it("keeps the title verbatim, trailing whitespace included", () => {
    expect(parseTasksList("- [ ] padded  ")).toEqual([{ done: false, title: "padded  " }]);
  });
  it("stringifies tasks back to checkbox lines", () => {
    expect(stringifyTasks([{ done: true, title: "a" }, { done: false }])).toBe("- [x] a\n- [ ] ");
    expect(stringifyTasks([])).toBe("");
    expect(stringifyTasks(undefined)).toBe("");
  });
});

describe("parseSections", () => {
  it("collects checkbox lines under the tasks heading and text under the journal heading", () => {
    const content = "# 2026-01-01\n\n## Today\n- [ ] a\nnot a task\n- [x] b\n\n## Journal\nline 1\n\nline 2\n\n\n## Other\nignored";
    expect(parseSections(content, SETTINGS)).toEqual({
      tasks: ["- [ ] a", "- [x] b"],
      journal: "line 1\n\nline 2",
      raw: content,
    });
  });
  it("matches headings after trimming and stops a section at any other H2", () => {
    const content = "## Today   \n- [ ] a\n## Notes\n- [ ] not collected";
    expect(parseSections(content, SETTINGS).tasks).toEqual(["- [ ] a"]);
  });
  it("drops leading blank journal lines (no separator is added while the journal is empty)", () => {
    expect(parseSections("## Journal\n\n\nentry\n\nmore", SETTINGS).journal).toBe("entry\n\nmore");
  });
  it("returns empty results when headings are missing", () => {
    expect(parseSections("plain", SETTINGS)).toEqual({ tasks: [], journal: "", raw: "plain" });
  });
});

describe("replaceSection", () => {
  it("replaces the body under an existing heading up to the next H2", () => {
    const content = "# Day\n\n## Today\n- [ ] old\n\n## Journal\nhi";
    expect(replaceSection(content, "## Today", "- [ ] new")).toBe("# Day\n\n## Today\n- [ ] new\n\n## Journal\nhi");
  });
  it("appends the section when the heading is missing", () => {
    expect(replaceSection("# Day\n\n\n", "## Today", "- [ ] x")).toBe("# Day\n\n## Today\n- [ ] x\n");
  });
  it("replaces to end of file when it is the last section", () => {
    expect(replaceSection("## Journal\nold\nmore", "## Journal", "new")).toBe("## Journal\nnew\n");
  });
  it("collapses runs of three or more newlines anywhere in the file", () => {
    expect(replaceSection("# A\n\n\n\nkeep\n## Today\nx", "## Today", "y")).toBe("# A\n\nkeep\n## Today\ny\n");
  });
  it("matches the first line equal to the heading after trimming", () => {
    expect(replaceSection("  ## Today  \nold", "## Today", "new")).toBe("  ## Today  \nnew\n");
  });
});

describe("parseLinkValues", () => {
  it("returns [] for null, undefined and empty string", () => {
    expect(parseLinkValues(null)).toEqual([]);
    expect(parseLinkValues(undefined)).toEqual([]);
    expect(parseLinkValues("")).toEqual([]);
  });
  it("extracts wiki links from a string", () => {
    expect(parseLinkValues("[[Acme]], [[Jane Doe|Jane]]")).toEqual([
      { target: "Acme", display: "Acme" },
      { target: "Jane Doe", display: "Jane" },
    ]);
  });
  it("splits plain strings on commas", () => {
    expect(parseLinkValues(" a, b ,,c ")).toEqual([
      { target: "a", display: "a" },
      { target: "b", display: "b" },
      { target: "c", display: "c" },
    ]);
  });
  it("falls back to comma split when brackets contain only whitespace, then drops the empty link", () => {
    expect(parseLinkValues("[[ ]], x")).toEqual([{ target: "x", display: "x" }]);
  });
  it("ignores text outside links when the string contains any link", () => {
    expect(parseLinkValues("plain, [[Linked]]")).toEqual([{ target: "Linked", display: "Linked" }]);
  });
  it("handles arrays, unwrapping brackets and stringifying values", () => {
    expect(parseLinkValues(["[[A]]", " B ", 42, "[[C|See]]"])).toEqual([
      { target: "A", display: "A" },
      { target: "B", display: "B" },
      { target: "42", display: "42" },
      { target: "C", display: "See" },
    ]);
  });
  it("drops entries whose target is empty", () => {
    expect(parseLinkValues(["", "[[]]", "|alias"])).toEqual([]);
  });
  it("stringifies numbers", () => {
    expect(parseLinkValues(7)).toEqual([{ target: "7", display: "7" }]);
  });
});
