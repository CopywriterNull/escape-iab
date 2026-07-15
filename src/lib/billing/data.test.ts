import { describe, expect, it } from "vitest";
import { computePeriodMetrics, nextMonthlyPeriod } from "@/lib/billing/data";

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

type FakeRow = { value_cents: number };
type RangeCall = { bucket: string | undefined; from: number; to: number };

/** Minimal chainable stub covering both the pre-fix (.limit) call shape and
 *  the post-fix (.order().order().range()) paginated call shape, so the same
 *  fake can be used for RED (against current code) and GREEN (post-fix). */
function makeFakeClient(
  rollupData: Array<{ bucket: string; impressions: number; revenue_cents: number }>,
  rowsByBucket: Record<string, FakeRow[]>,
) {
  const rangeCalls: RangeCall[] = [];

  function build(filters: Record<string, unknown>): Record<string, unknown> {
    const self: Record<string, unknown> = {
      select: () => build(filters),
      eq: (col: string, val: unknown) => build({ ...filters, [col]: val }),
      gte: () => build(filters),
      lt: () => build(filters),
      not: () => build(filters),
      order: () => build(filters),
      limit: (n: number) => {
        const bucket = filters["bucket"] as string | undefined;
        const rows = bucket ? (rowsByBucket[bucket] ?? []) : [];
        return Promise.resolve({ data: rows.slice(0, n), error: null });
      },
      range: (from: number, to: number) => {
        const bucket = filters["bucket"] as string | undefined;
        rangeCalls.push({ bucket, from, to });
        const rows = bucket ? (rowsByBucket[bucket] ?? []) : [];
        return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
      },
    };
    return self;
  }

  const client = {
    rpc: (_name: string, _args: unknown) => Promise.resolve({ data: rollupData, error: null }),
    from: (_table: string) => build({}),
  };

  return { client, rangeCalls };
}

describe("computePeriodMetrics purchase pagination", () => {
  it("consumes ALL purchase rows for a bucket via deterministic pagination, not a single capped page", async () => {
    const bucketARows: FakeRow[] = Array.from({ length: 2500 }, () => ({ value_cents: 100 }));
    const bucketBRows: FakeRow[] = Array.from({ length: 5 }, () => ({ value_cents: 100 }));
    const { client, rangeCalls } = makeFakeClient(
      [
        { bucket: "a", impressions: 100, revenue_cents: 50000 },
        { bucket: "b", impressions: 100, revenue_cents: 40000 },
      ],
      { a: bucketARows, b: bucketBRows },
    );

    const controlFrom = new Date("2026-06-15T00:00:00Z");
    const periodStart = new Date("2026-07-15T00:00:00Z");
    const periodEnd = new Date("2026-08-15T00:00:00Z");

    const metrics = await computePeriodMetrics(
      client as never,
      "merchant-1",
      controlFrom,
      periodStart,
      periodEnd,
    );

    expect(metrics.rawRevACents).toBe(50000);

    // The current (unfixed) implementation never calls .range() at all — it
    // takes a single .limit(10000) page — so this fails until pagination is
    // implemented. Post-fix, 2500 rows at PAGE_SIZE=1000 must take 3 pages.
    const bucketARangeCalls = rangeCalls.filter((c) => c.bucket === "a");
    expect(bucketARangeCalls.length).toBe(3);
  });
});
