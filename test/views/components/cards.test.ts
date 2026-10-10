import { describe, expect, it, vi } from "vitest";
import { FakeElement, TFile } from "../../mocks/obsidian";
import { makeAppView } from "../../helpers/app-view";

/* Characterization tests for _dashCardSection, the titled row list used by
   the CRM dashboard, PRM analytics and the four reports. */

function setup() {
  const { view } = makeAppView();
  const parent = new FakeElement("div");
  return { view, parent };
}

const bodyOf = (parent: FakeElement) => parent.children[0].children[1];

describe("_dashCardSection", () => {
  it("renders a card with its title head and a body", () => {
    const { view, parent } = setup();
    view._dashCardSection(parent, "Hot deals", [{ title: "x" }], "none");
    const [card] = parent.children;
    expect(card.classes).toEqual(["cad-dash-card"]);
    expect(card.children.map((c) => c.classes[0])).toEqual(["cad-dash-card-head", "cad-dash-card-body"]);
    expect(card.children[0].children[0].classes).toEqual(["cad-dash-card-title"]);
    expect(card.children[0].children[0].text).toBe("Hot deals");
  });

  it.each([
    [undefined, "No deals", "No deals"],
    [[], undefined, "Nothing here yet."],
    [null, "", "Nothing here yet."],
  ])("shows the empty message when rows are %j", (rows, emptyMsg, shown) => {
    const { view, parent } = setup();
    view._dashCardSection(parent, "T", rows, emptyMsg);
    const body = bodyOf(parent);
    expect(body.children.map((c) => [c.classes[0], c.text])).toEqual([["cad-empty", shown]]);
  });

  it("renders plain titles and meta strings, blank when missing", () => {
    const { view, parent } = setup();
    view._dashCardSection(parent, "T", [{ title: "Acme", meta: "Lead · $5" }, {}]);
    const rows = bodyOf(parent).children;
    expect(rows.map((r) => r.classes[0])).toEqual(["cad-dash-row", "cad-dash-row"]);
    expect(rows.map((r) => r.children.map((c) => [c.classes[0], c.text]))).toEqual([
      [["cad-dash-row-title", "Acme"], ["cad-dash-row-meta", "Lead · $5"]],
      [["cad-dash-row-title", ""], ["cad-dash-row-meta", ""]],
    ]);
  });

  it("renders an entity-linked title through _renderEntityLinks", () => {
    const { view, parent } = setup();
    const links = vi.spyOn(view, "_renderEntityLinks");
    view._dashCardSection(parent, "T", [{ title: "[[Acme Corp]]", titleEntityKey: "company" }]);
    const titleDiv = bodyOf(parent).children[0].children[0];
    expect(links.mock.calls).toEqual([[titleDiv, "[[Acme Corp]]", "company"]]);
    expect(titleDiv.findAll("a").map((a) => [a.text, a.classes[0]])).toEqual([["Acme Corp", "cad-company-link"]]);
  });

  it("QUIRK: renders meta parts back to back, linking parts with an entityKey, with no separator", () => {
    const { view, parent } = setup();
    view._dashCardSection(parent, "T", [{
      meta: "ignored",
      metaParts: [{ text: "[[Jane Doe]]", entityKey: "contact" }, { text: " · Lead" }, {}],
    }]);
    const meta = bodyOf(parent).children[0].children[1];
    expect(meta.text).toBe("");
    expect(meta.children.map((c) => [c.localName, c.text])).toEqual([["a", "Jane Doe"], ["span", " · Lead"], ["span", ""]]);
  });

  it("makes rows with a file clickable, opening the file's detail form", () => {
    const { view, parent } = setup();
    const open = vi.spyOn(view, "openEntityDetailFromFile").mockResolvedValue(undefined);
    const file = new TFile("Cadence/Pipeline/A.md");
    view._dashCardSection(parent, "T", [{ title: "A", file }, { title: "B" }]);
    const [withFile, without] = bodyOf(parent).children;
    expect(withFile.style.cursor).toBe("pointer");
    expect(without.style.cursor).toBeUndefined();
    withFile.trigger("click");
    without.trigger("click");
    expect(open.mock.calls).toEqual([[file]]);
  });
});
