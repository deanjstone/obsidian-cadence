import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectRegistrations } from "../helpers/load-bundle";

/* registrations.original.json was captured by running collectRegistrations()
   against the hand-written main.js at 035b3de (v0.15.0, before the TypeScript
   migration), with the clock pinned to the same instant used below. The
   built bundle must register exactly the same surface with Obsidian. */
const original = JSON.parse(readFileSync("test/fixtures/registrations.original.json", "utf8"));

describe("built main.js registration parity", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers the same commands, views, ribbon icons, setting tab, events, settings and templates as v0.15.0", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-01-15T10:00:00Z") });
    const built = await collectRegistrations("main.js");
    expect(built).toEqual(original);
  });

  it("exports the plugin class directly as module.exports, like the original", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-01-15T10:00:00Z") });
    const built = await collectRegistrations("main.js");
    expect(built.exportIsClass).toBe(true);
    expect(built.commands.map((c) => c.id)).toEqual([
      "open-cadence",
      "open-cadence-home",
      "open-cadence-today",
      "open-cadence-calendar",
      "open-cadence-pipeline",
      "new-daily-entry",
      "quick-capture",
      "open-cadence-inbox",
      "cadence-import-csv",
    ]);
    expect(built.views).toEqual(["cadence-app"]);
  });
});
