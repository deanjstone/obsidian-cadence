import { afterAll, beforeAll, describe } from "vitest";

/* The suite runs under TZ=UTC (vitest.config.ts), where a date parsed as UTC
   and one parsed as local are the same. These helpers run a block under other
   zones. Node re-reads its zone when process.env.TZ is assigned, and the test
   files run in forked processes, so the change reaches every Date in the file. */

/* West of UTC, UTC itself, and east of UTC (with DST on both sides). */
export const ZONES = ["America/Los_Angeles", "UTC", "Australia/Sydney"] as const;
export type Zone = (typeof ZONES)[number];

/* getTimezoneOffset() of local 2026-01-01 in each zone, in minutes. */
export const JAN_OFFSET: Record<Zone, number> = {
  "America/Los_Angeles": 480,
  UTC: 0,
  "Australia/Sydney": -660,
};

/* Run `fn` with process.env.TZ set to `tz`, then put the old zone back. */
export async function withTimezone<T>(tz: string, fn: () => T | Promise<T>): Promise<T> {
  const before = process.env.TZ;
  process.env.TZ = tz;
  try {
    return await fn();
  } finally {
    process.env.TZ = before;
  }
}

/* describe() once per zone in ZONES, with TZ set for the whole block. */
export function describeInZones(name: string, fn: (tz: Zone) => void): void {
  describe.each(ZONES)(`${name} (TZ=%s)`, (tz) => {
    let before: string | undefined;
    beforeAll(() => {
      before = process.env.TZ;
      process.env.TZ = tz;
    });
    afterAll(() => {
      process.env.TZ = before;
    });
    fn(tz);
  });
}
