import { describe, expect, it } from "vitest";
import { addOneMonthClamped, computeInvoice, trimOutliers } from "@/lib/billing/math";

describe("trimOutliers", () => {
  it("returns everything kept when under 8 orders (no trim below min sample)", () => {
    const r = trimOutliers([4000, 4100, 320000]); // $3,200 whale, but n=3
    expect(r.outliers).toEqual([]);
    expect(r.keptTotalCents).toBe(328100);
  });

  it("trims a whale that violates BOTH rules (Q3+3*IQR and 8x median)", () => {
    const base = [3800, 4000, 4100, 4200, 4300, 4400, 4500, 4600];
    const r = trimOutliers([...base, 320000]);
    expect(r.outliers).toEqual([320000]);
    expect(r.keptTotalCents).toBe(base.reduce((a, b) => a + b, 0));
    expect(r.trimmedTotalCents).toBe(320000);
  });

  it("does NOT trim a merely-large order that fails the 8x-median rule", () => {
    const base = [3800, 4000, 4100, 4200, 4300, 4400, 4500, 4600];
    // 11600 = under 8*median (~33200): kept even if > Q3+3*IQR
    const r = trimOutliers([...base, 11600]);
    expect(r.outliers).toEqual([]);
  });
});

describe("computeInvoice", () => {
  const base = {
    impA: 10000,
    trimmedRevACents: 2_000_000, // $20,000
    impB: 1100,
    trimmedRevBCents: 110_000, // $1,000 → control RPV = $1.00
    revSharePct: 10,
    baseFeeCents: 30000,
    baseFeeWaived: false,
  };

  it("computes incremental = revA - impA*controlRPV, fee = base + 10%", () => {
    const r = computeInvoice(base);
    expect(r.controlRpvMicroCents).toBe(100_000_000); // $1.00/imp in micro-cents
    expect(r.counterfactualCents).toBe(1_000_000);
    expect(r.incrementalCents).toBe(1_000_000);
    expect(r.revShareCents).toBe(100_000);
    expect(r.totalCents).toBe(130_000);
  });

  it("floors negative lift at zero (base fee still bills)", () => {
    const r = computeInvoice({ ...base, trimmedRevACents: 500_000 });
    expect(r.incrementalCents).toBe(0);
    expect(r.revShareCents).toBe(0);
    expect(r.totalCents).toBe(30000);
  });

  it("waived base + zero lift = $0 total", () => {
    const r = computeInvoice({ ...base, trimmedRevACents: 0, baseFeeWaived: true });
    expect(r.totalCents).toBe(0);
  });

  it("guards divide-by-zero when control has no impressions", () => {
    const r = computeInvoice({ ...base, impB: 0, trimmedRevBCents: 0 });
    expect(r.controlRpvMicroCents).toBe(0);
    expect(r.incrementalCents).toBe(0); // no control data → never bill lift
    expect(r.totalCents).toBe(30000);
  });
});

describe("addOneMonthClamped", () => {
  it("adds a month normally", () => {
    expect(addOneMonthClamped(new Date("2026-07-15T21:10:00Z")).toISOString()).toBe(
      "2026-08-15T21:10:00.000Z",
    );
  });
  it("clamps Jan 31 → Feb 28 instead of Mar 3", () => {
    expect(addOneMonthClamped(new Date("2026-01-31T12:00:00Z")).toISOString()).toBe(
      "2026-02-28T12:00:00.000Z",
    );
  });
});
