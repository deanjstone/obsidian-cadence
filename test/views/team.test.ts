import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeElement, type MockFileSpec } from "../mocks/obsidian";
import { makeAppView } from "../helpers/app-view";

/* Characterization tests for Team, renderTeam: the contact list through
   renderEntityList, titled Team, filtered to contacts whose role mentions
   team, admin or member, with name, role, email and company first. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(files: MockFileSpec[] = []) {
  const made = makeAppView({ files });
  made.view.mode = "team";
  const root = new FakeElement("div");
  const list = vi.spyOn(made.view, "renderEntityList").mockResolvedValue("listed" as Any);
  return { ...made, root, list };
}

const entity = (frontmatter: Record<string, unknown>) => ({ basename: "X", frontmatter }) as Any;

describe("renderTeam", () => {
  it("renders the contact list titled Team with name, role, email and company first, and returns its result", async () => {
    const { view, root, list } = setup();
    expect(await view.renderTeam(root)).toBe("listed");
    expect(list.mock.calls).toEqual([[root, "contact", { title: "Team", filter: expect.any(Function), columns: ["name", "role", "email", "company"] }]]);
  });

  it("keeps a contact whose role contains team, admin or member in any case", async () => {
    const { view, root, list } = setup();
    await view.renderTeam(root);
    const { filter } = list.mock.calls[0][2] as Any;
    const roles = ["Team lead", "ADMIN", "Board Member", "Sales", "", undefined, null];
    expect(roles.map((role) => filter(entity({ role })))).toEqual([true, true, true, false, false, false, false]);
  });

  it("QUIRK: the match is a substring, so 'Teammate', 'Administrator' and 'Remember' count, and a role list is joined", async () => {
    const { view, root, list } = setup();
    await view.renderTeam(root);
    const { filter } = list.mock.calls[0][2] as Any;
    expect(["Teammate", "Administrator", "Remember", "Steam"].map((role) => filter(entity({ role })))).toEqual([true, true, true, true]);
    expect(filter(entity({ role: ["Sales", "Admin"] }))).toBe(true);
    expect(filter(entity({ role: ["Sales"] }))).toBe(false);
  });

  it("lists only matching contacts when the real list renders", async () => {
    const files: MockFileSpec[] = [
      { path: "Cadence/Contacts/Ann.md", frontmatter: { role: "Admin" } },
      { path: "Cadence/Contacts/Bob.md", frontmatter: { role: "Customer" } },
    ];
    const { view, root, list } = setup(files);
    list.mockRestore();
    await view.renderTeam(root);
    expect(root.children[0].children[0].children.map((c) => c.text)).toEqual(["CADENCE", "Team", "1 contact in Cadence/Contacts"]);
  });

  it("shows only the name, role, email and company columns", async () => {
    const { view, root, list } = setup([{ path: "Cadence/Contacts/Ann.md", frontmatter: { role: "Admin", phone: ["555"], tags: ["vip"] } }]);
    list.mockRestore();
    await view.renderTeam(root);
    const heads = root.children[2].querySelectorAll("th").map((th) => th.children[0].text);
    expect(heads).toEqual(["Name ", "Role ", "Email ", "Company "]);
  });
});
