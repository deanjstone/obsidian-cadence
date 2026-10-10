import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeElement, Notice, type MockFileSpec } from "../mocks/obsidian";
import { flush, makeAppView } from "../helpers/app-view";
import { ENTITIES } from "../../src/constants/entities";
import { ensureDefaultTemplates } from "../../src/utils/templates";

/* Characterization tests for the template builder's section controls,
   _renderTemplateSectionWithDelete (drag to reorder, × to delete), and for
   the propagation behind them: _getFilesUsingTemplateSection,
   _propagateTemplateSectionAdd and _propagateTemplateSectionDelete, run
   against a mock vault of several notes. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Notice.messages.length = 0;
});

const T = "Cadence/Templates";
const C = "Cadence/Contacts";
const TEMPLATE = "---\ntype: contact\n---\n\n# {{name}}\n\n## Bio #notes\n_bio_\n\n## Tasks #tasks\n- [ ] a\n\n## Links #cross-deal-contact-table\n";

function setup(files: MockFileSpec[] = [], settings: Record<string, unknown> = {}) {
  const made = makeAppView({ files: [{ path: `${T}/contact.md`, body: TEMPLATE }, ...files], settings });
  const rendered = vi.spyOn(made.view, "render").mockResolvedValue(undefined);
  /* The live widget: a card with a head, like the real section renderers draw. */
  const widget = vi.spyOn(made.view, "_renderDynamicH2Section").mockImplementation((parent: Any) => {
    const card = parent.createDiv({ cls: "cad-pd-card" });
    card.createDiv({ cls: "cad-pd-card-head" });
  });
  const file = (path: string) => made.app.vault.getAbstractFileByPath(path) as Any;
  const read = (path: string) => made.app.vault.read(file(path));
  const parent = new FakeElement("div");
  const draw = (rawKey: string, path = `${T}/contact.md`, sections: Record<string, string> = {}, flash = () => {}) => {
    made.view._renderTemplateSectionWithDelete(parent, file(path), sections, rawKey, flash);
    return parent.children[parent.children.length - 1];
  };
  return { ...made, rendered, widget, file, read, parent, draw };
}

const note = (name: string, body: string, folder = C): MockFileSpec => ({ path: `${folder}/${name}.md`, body });
const ctrlRow = (wrap: FakeElement) => wrap.querySelector(".cad-pd-card-head")!.children[0];
const delButton = (wrap: FakeElement) => ctrlRow(wrap).children[1];

function dataTransfer(data: Record<string, string> = {}) {
  const store: Record<string, string> = { ...data };
  return {
    store,
    dropEffect: "",
    effectAllowed: "",
    getData: (k: string) => store[k] ?? "",
    setData: (k: string, v: string) => {
      store[k] = v;
    },
  };
}

describe("_renderTemplateSectionWithDelete: the card", () => {
  it("wraps the live widget in a draggable block and passes it the section", async () => {
    const { draw, widget, file } = setup();
    const flash = () => {};
    const sections = { "Bio #notes": "_bio_" };
    const wrap = draw("Bio #notes", `${T}/contact.md`, sections, flash);
    expect(wrap.attrs.style).toBe("position: relative; margin-bottom: 12px; transition: transform 0.2s ease;");
    expect(wrap.draggable).toBe(true);
    expect(widget.mock.calls).toEqual([[wrap, file(`${T}/contact.md`), sections, "Bio #notes", flash]]);
  });

  it("appends a grip and a × button to the widget's card head", async () => {
    const { draw } = setup();
    const wrap = draw("Bio #notes");
    const row = ctrlRow(wrap);
    expect(row.attrs.style).toBe("display: flex; align-items: center; gap: 8px; margin-left: 8px; flex-shrink: 0;");
    const [grip, del] = row.children;
    expect([grip.title, grip.icon]).toEqual(["Drag card to reorder", "grip-vertical"]);
    expect([del.localName, del.text, del.title]).toEqual(["button", "×", 'Remove section "Bio" from template']);
  });

  it("adds no controls when the widget draws no card head", async () => {
    const { draw, widget } = setup();
    widget.mockImplementation((parent: Any) => {
      parent.createDiv({ cls: "cad-pd-card" });
    });
    const wrap = draw("Bio #notes");
    expect(wrap.querySelectorAll("button")).toEqual([]);
    expect(wrap.children.map((c) => c.classes)).toEqual([["cad-pd-card"]]);
  });
});

describe("_renderTemplateSectionWithDelete: drag to reorder", () => {
  it("dragstart dims the card and carries its raw key; dragend restores it", async () => {
    const { draw } = setup();
    const wrap = draw("Bio #notes");
    const dt = dataTransfer();
    wrap.trigger("dragstart", { dataTransfer: dt });
    expect([wrap.style.opacity, dt.effectAllowed, dt.store]).toEqual(["0.5", "move", { "text/cadence-template-section": "Bio #notes" }]);
    wrap.addClass("drag-over");
    wrap.trigger("dragend");
    expect([wrap.style.opacity, wrap.hasClass("drag-over")]).toEqual(["1", false]);
  });

  it("dragover highlights the card; dragleave clears it", async () => {
    const { draw } = setup();
    const wrap = draw("Bio #notes");
    const dt = dataTransfer();
    const ev = wrap.trigger("dragover", { dataTransfer: dt });
    expect([ev.defaultPrevented, dt.dropEffect, wrap.hasClass("drag-over"), wrap.style.border, wrap.style.borderRadius]).toEqual([
      true, "move", true, "2px dashed var(--interactive-accent)", "6px",
    ]);
    wrap.trigger("dragleave");
    expect([wrap.hasClass("drag-over"), wrap.style.border, wrap.style.borderRadius]).toEqual([false, "none", "0"]);
  });

  it("a drop moves the dragged section before this one and re-renders", async () => {
    const { draw, read, rendered } = setup();
    const wrap = draw("Bio #notes");
    const ev = wrap.trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-template-section": "Tasks #tasks" }) });
    await flush();
    expect(ev.defaultPrevented).toBe(true);
    expect([wrap.style.border, wrap.style.borderRadius]).toEqual(["none", "0"]);
    expect(await read(`${T}/contact.md`)).toBe(
      "---\ntype: contact\n---\n\n# {{name}}\n\n## Tasks #tasks\n- [ ] a\n\n## Bio #notes\n_bio_\n\n## Links #cross-deal-contact-table\n",
    );
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("moving a section down lands it directly before the target", async () => {
    const { draw, read } = setup();
    const wrap = draw("Links #cross-deal-contact-table");
    wrap.trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-template-section": "Bio #notes" }) });
    await flush();
    expect(await read(`${T}/contact.md`)).toBe(
      "---\ntype: contact\n---\n\n# {{name}}\n\n## Tasks #tasks\n- [ ] a\n\n## Bio #notes\n_bio_\n\n## Links #cross-deal-contact-table\n",
    );
  });

  it("QUIRK: moving the last section up keeps its (missing) trailing blank line, so it runs into the next heading", async () => {
    const { draw, read } = setup([], {});
    const wrap = draw("Tasks #tasks");
    wrap.trigger("drop", { dataTransfer: dataTransfer({ "text/cadence-template-section": "Links #cross-deal-contact-table" }) });
    await flush();
    expect(await read(`${T}/contact.md`)).toBe(
      "---\ntype: contact\n---\n\n# {{name}}\n\n## Bio #notes\n_bio_\n\n## Links #cross-deal-contact-table\n\n## Tasks #tasks\n- [ ] a\n",
    );
  });

  it("ignores a drop of itself, of nothing, or of a key not in the file", async () => {
    const { draw, app, rendered } = setup();
    const wrap = draw("Bio #notes");
    for (const key of ["Bio #notes", "", "Ghost #notes"]) {
      wrap.trigger("drop", { dataTransfer: dataTransfer(key ? { "text/cadence-template-section": key } : {}) });
    }
    await flush();
    expect(app.vault.modified).toEqual([]);
    expect(rendered).not.toHaveBeenCalled();
  });
});

describe("_renderTemplateSectionWithDelete: × delete", () => {
  it("asks to remove an unused section; declining changes nothing", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const { draw, app, rendered } = setup([note("Ann", "## Bio\n_Background, interests, and how we met..._\n")]);
    const ev = delButton(draw("Bio #notes")).trigger("click");
    await flush();
    expect(ev.propagationStopped).toBe(true);
    expect(confirm.mock.calls).toEqual([['Remove the section "Bio" from this template?']]);
    expect(app.vault.modified).toEqual([]);
    expect(rendered).not.toHaveBeenCalled();
  });

  it("warns with the names of notes whose section has content", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const { draw } = setup([note("Ann", "## Bio #notes\nLikes tea\n"), note("Bob", "## bio\nchess\n"), note("Cy", "## Other\nx\n")]);
    delButton(draw("Bio #notes")).trigger("click");
    await flush();
    expect(confirm.mock.calls).toEqual([
      ['Warning: The section "Bio" has active content in the following files:\nAnn, Bob\n\nAre you sure you want to delete it from the template?'],
    ]);
  });

  it("warns, naming the one note, when a single note has content", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const { draw } = setup([note("Ann", "## Bio #notes\nLikes tea\n")]);
    delButton(draw("Bio #notes")).trigger("click");
    await flush();
    expect(confirm.mock.calls).toEqual([
      ['Warning: The section "Bio" has active content in the following files:\nAnn\n\nAre you sure you want to delete it from the template?'],
    ]);
  });

  it("removes the section from the template up to the next H2, propagates, notices and re-renders", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const { draw, view, read, rendered } = setup();
    const propagate = vi.spyOn(view, "_propagateTemplateSectionDelete").mockResolvedValue(undefined);
    delButton(draw("Tasks #tasks")).trigger("click");
    await flush();
    expect(await read(`${T}/contact.md`)).toBe(
      "---\ntype: contact\n---\n\n# {{name}}\n\n## Bio #notes\n_bio_\n\n## Links #cross-deal-contact-table\n",
    );
    expect(propagate.mock.calls).toEqual([["contact", "Tasks #tasks"]]);
    expect(Notice.messages).toEqual(['Section "Tasks" removed.']);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("removes the last section to the end of the file", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const { draw, read } = setup();
    delButton(draw("Links #cross-deal-contact-table")).trigger("click");
    await flush();
    expect(await read(`${T}/contact.md`)).toBe("---\ntype: contact\n---\n\n# {{name}}\n\n## Bio #notes\n_bio_\n\n## Tasks #tasks\n- [ ] a\n");
  });

  it("does nothing more when the section is no longer in the template", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const { draw, view, app, rendered } = setup();
    const propagate = vi.spyOn(view, "_propagateTemplateSectionDelete").mockResolvedValue(undefined);
    delButton(draw("Gone #notes")).trigger("click");
    await flush();
    expect(app.vault.modified).toEqual([]);
    expect(propagate).not.toHaveBeenCalled();
    expect(Notice.messages).toEqual([]);
    expect(rendered).not.toHaveBeenCalled();
  });

  it("deletes the matching notes' sections too (end to end)", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const { draw, read } = setup([note("Ann", "# Ann\n\n## Bio #notes\nLikes tea\n\n## Tasks #tasks\n- [ ] call\n")]);
    delButton(draw("Bio #notes")).trigger("click");
    await flush();
    expect(await read(`${C}/Ann.md`)).toBe("# Ann\n\n## Tasks #tasks\n- [ ] call\n");
  });

  it("QUIRK: the template delete matches the first line equal to the raw key, heading or not", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const body = "# x\nBio #notes\nkeep?\n\n## Tasks #tasks\n- [ ] a\n\n## Bio #notes\n_bio_\n";
    const { draw, read } = setup([{ path: `${T}/lead.md`, body }]);
    delButton(draw("Bio #notes", `${T}/lead.md`)).trigger("click");
    await flush();
    expect(await read(`${T}/lead.md`)).toBe("# x\n## Tasks #tasks\n- [ ] a\n\n## Bio #notes\n_bio_\n");
  });

  it("QUIRK: the entity key is the template's basename, so a plural-named template (Contacts.md) never propagates its deletes", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const { draw, read } = setup([{ path: `${T}/Contacts.md`, body: TEMPLATE }, note("Ann", "## Bio #notes\nLikes tea\n")]);
    delButton(draw("Bio #notes", `${T}/Contacts.md`)).trigger("click");
    await flush();
    expect(await read(`${T}/Contacts.md`)).not.toContain("## Bio");
    expect(await read(`${C}/Ann.md`)).toBe("## Bio #notes\nLikes tea\n");
  });

  it("deleting from the daily template removes the section from every daily note", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const { draw, read } = setup(
      [
        { path: `${T}/daily.md`, body: "# {{date}}\n\n## Today\n- [ ] \n\n## Journal\n\n" },
        note("2026-10-07", "# d\n\n## Today\n- [x] shipped\n\n## Journal\nok\n", "Days"),
        note("2026-10-08", "# d\n\n## Journal\nfine\n", "Days/2026"),
      ],
      { dailyNoteFolder: "Days" },
    );
    delButton(draw("Today", `${T}/daily.md`)).trigger("click");
    await flush();
    expect(await read("Days/2026-10-07.md")).toBe("# d\n\n## Journal\nok\n");
    expect(await read("Days/2026/2026-10-08.md")).toBe("# d\n\n## Journal\nfine\n");
  });
});

describe("_getFilesUsingTemplateSection", () => {
  it("returns the entity notes whose same-named section (any tag, any case) has content", async () => {
    const { view, file } = setup([
      note("Ann", "## Bio #notes\nLikes tea\n"),
      note("Bob", "## BIO\nchess\n"),
      note("Cy", "## Bio #notes\n\n   \n"),
      note("Di", "## Biography\nlong\n"),
      note("Ed", "no sections"),
      note("Fay", "## Bio #notes\nnested\n", `${C}/Archive`),
    ]);
    const used = await view._getFilesUsingTemplateSection("contact", "Bio #notes");
    expect(used).toEqual([file(`${C}/Ann.md`), file(`${C}/Bob.md`), file(`${C}/Archive/Fay.md`)]);
  });

  it("skips the known placeholder bodies", async () => {
    const bodies = [
      "_Enter your notes here..._",
      "_Company description and profile..._",
      "_Background, interests, and how we met..._",
      "_The outcome we want, why now._",
      "- [ ] First task in template",
      "- [ ] First milestone",
    ];
    const { view } = setup(bodies.map((b, i) => note(`N${i}`, `## Notes #notes\n${b}\nmore\n`)));
    expect(await view._getFilesUsingTemplateSection("contact", "Notes #notes")).toEqual([]);
  });

  it("QUIRK: the default '_Context and general notes..._' and a dated first milestone count as content", async () => {
    const { view, file } = setup([
      note("A", "## Notes #notes\n_Context and general notes..._\n"),
      note("B", "## Notes #milestones\n- [ ] 2026-10-08 — First milestone in template\n"),
      note("C", "## Notes #tasks\n- [ ] Follow up in 2 weeks\n"),
    ]);
    expect(await view._getFilesUsingTemplateSection("contact", "Notes #notes")).toEqual([
      file(`${C}/A.md`), file(`${C}/B.md`), file(`${C}/C.md`),
    ]);
  });

  it("only a body that starts with a placeholder is skipped; one later in the body still counts", async () => {
    const { view, file } = setup([note("A", "## Notes\nReal notes\n_Enter your notes here..._\n"), note("B", "## Notes\n_Enter your notes here..._ and more\n")]);
    expect(await view._getFilesUsingTemplateSection("contact", "Notes")).toEqual([file(`${C}/A.md`)]);
  });

  it("returns nothing for an unknown entity key", async () => {
    const { view } = setup([note("Ann", "## Bio\nx\n")]);
    expect(await view._getFilesUsingTemplateSection("Contacts", "Bio")).toEqual([]);
  });

  it("QUIRK: over notes made fresh from each of the 12 default templates, these untouched sections already count as content", async () => {
    const made = makeAppView();
    await ensureDefaultTemplates(made.app as Any);
    const templates = made.app.vault.getFiles().filter((f) => f.path.startsWith(`${T}/`));
    expect(templates.map((f) => f.basename).sort()).toEqual([...Object.keys(ENTITIES), "daily"].sort());
    for (const key of Object.keys(ENTITIES)) {
      const content = await made.app.vault.read(made.app.vault.getAbstractFileByPath(`${T}/${key}.md`) as Any);
      made.app.vault.addFile({ path: `${ENTITIES[key as keyof typeof ENTITIES].folder}/Fresh ${key}.md`, body: content });
    }
    const used: Record<string, string[]> = {};
    for (const key of Object.keys(ENTITIES)) {
      for (const label of ["Notes", "Bio", "Description", "Tasks", "Brief", "Milestones"]) {
        const files = await made.view._getFilesUsingTemplateSection(key, `${label} #notes`);
        if (files.length) (used[key] ??= []).push(label);
      }
    }
    expect(used).toEqual({
      partner: ["Notes"], registration: ["Notes"], commission: ["Notes"], lead: ["Notes"], certification: ["Notes"],
      activity: ["Notes"], sequence: ["Notes"], deal: ["Notes"],
      contact: ["Tasks"],
      project: ["Tasks", "Milestones"],
    });
  });
});

describe("_propagateTemplateSectionAdd over a vault", () => {
  it("appends the section to every entity note without a same-named one, and only writes those", async () => {
    const { view, app, read } = setup([
      note("Ann", "# Ann\n\n## Bio #notes\nhi\n\n\n"),
      note("Bob", "# Bob\n\n## ideas #tasks\n- [ ] x\n"),
      note("Cy", "# Cy\n"),
      note("Di", "# Di", `${C}/Old`),
      { path: `${C}/scan.pdf`, body: "%PDF" },
      note("Eve", "# Eve\n", "Cadence/Companies"),
    ]);
    await view._propagateTemplateSectionAdd("contact", "Ideas", "#notes", "_Enter your notes here..._");
    expect(app.vault.modified).toEqual([`${C}/Ann.md`, `${C}/Cy.md`, `${C}/Old/Di.md`]);
    expect(await read(`${C}/Ann.md`)).toBe("# Ann\n\n## Bio #notes\nhi\n\n## Ideas #notes\n_Enter your notes here..._\n");
    expect(await read(`${C}/Bob.md`)).toBe("# Bob\n\n## ideas #tasks\n- [ ] x\n");
    expect(await read(`${C}/Cy.md`)).toBe("# Cy\n\n## Ideas #notes\n_Enter your notes here..._\n");
    expect(await read(`${C}/Old/Di.md`)).toBe("# Di\n\n## Ideas #notes\n_Enter your notes here..._\n");
    expect(await read("Cadence/Companies/Eve.md")).toBe("# Eve\n");
  });

  it("defaults the body to empty", async () => {
    const { view, read } = setup([note("Cy", "# Cy\n")]);
    await view._propagateTemplateSectionAdd("contact", "Deals", "#cross-deal-contact-table");
    expect(await read(`${C}/Cy.md`)).toBe("# Cy\n\n## Deals #cross-deal-contact-table\n\n");
  });

  it("an indented heading is not a section, so the note still gets one", async () => {
    const { view, read } = setup([note("Cy", "# Cy\n  ## Ideas\n")]);
    await view._propagateTemplateSectionAdd("contact", "Ideas", "#notes", "");
    expect(await read(`${C}/Cy.md`)).toBe("# Cy\n  ## Ideas\n\n## Ideas #notes\n\n");
  });

  it("does nothing for an entity with no notes", async () => {
    const { view, app } = setup();
    await view._propagateTemplateSectionAdd("deal", "Ideas", "#notes", "");
    expect(app.vault.modified).toEqual([]);
  });

  it("QUIRK: a null title (a cancelled prompt) appends '## null' to notes with no sections, and throws on one with sections", async () => {
    const { view, read } = setup([note("Cy", "# Cy\n")]);
    await view._propagateTemplateSectionAdd("contact", null, "#notes", "");
    expect(await read(`${C}/Cy.md`)).toBe("# Cy\n\n## null #notes\n\n");
    const other = setup([note("Ann", "## Bio\nx\n")]);
    await expect(other.view._propagateTemplateSectionAdd("contact", null, "#notes", "")).rejects.toThrow(TypeError);
  });
});

describe("_propagateTemplateSectionDelete over a vault", () => {
  it("removes the first same-named section (any tag, any case) from each note, and only writes those", async () => {
    const { view, app, read } = setup([
      note("Ann", "# Ann\n\n## Bio #notes\nhi\n\n## Tasks\n- [ ] x\n"),
      note("Bob", "# Bob\n\n## BIO\nchess\n"),
      note("Cy", "# Cy\n\n## Tasks\n- [ ] y\n"),
      note("Di", "## Bio\none\n## Bio #notes\ntwo\n", `${C}/Old`),
    ]);
    await view._propagateTemplateSectionDelete("contact", "Bio #notes");
    expect(app.vault.modified).toEqual([`${C}/Ann.md`, `${C}/Bob.md`, `${C}/Old/Di.md`]);
    expect(await read(`${C}/Ann.md`)).toBe("# Ann\n\n## Tasks\n- [ ] x\n");
    expect(await read(`${C}/Bob.md`)).toBe("# Bob\n");
    expect(await read(`${C}/Cy.md`)).toBe("# Cy\n\n## Tasks\n- [ ] y\n");
    expect(await read(`${C}/Old/Di.md`)).toBe("## Bio #notes\ntwo\n");
  });

  it("ignores an indented heading and a plain line with the same text", async () => {
    const { view, app } = setup([note("Ann", "  ## Bio\nBio\n")]);
    await view._propagateTemplateSectionDelete("contact", "Bio");
    expect(app.vault.modified).toEqual([]);
  });

  it("does nothing for an unknown entity key", async () => {
    const { view, app } = setup([note("Ann", "## Bio\nx\n")]);
    await view._propagateTemplateSectionDelete("Contacts", "Bio");
    expect(app.vault.modified).toEqual([]);
  });
});
