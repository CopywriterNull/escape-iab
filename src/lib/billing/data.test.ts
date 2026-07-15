import { describe, expect, it } from "vitest";
import { nextMonthlyPeriod } from "@/lib/billing/data";

describe("nextMonthlyPeriod", () => {
  const anchor = new Date("2026-07-15T21:00:00Z");
  it("first monthly period starts at the anchor", () => {
    const p = nextMonthlyPeriod(anchor, null);
    expect(p.start.toISOString()).toBe("2026-07-15T21:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-08-15T21:00:00.000Z");
  });
  it("subsequent periods chain from the last monthly end", () => {
    const p = nextMonthlyPeriod(anchor, new Date("2026-08-15T21:00:00Z"));
    expect(p.start.toISOString()).toBe("2026-08-15T21:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-09-15T21:00:00.000Z");
  });
});
