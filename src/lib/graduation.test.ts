import { describe, expect, it, vi, beforeEach } from "vitest";

// The trimmed-earnings read is the expensive part and has its own tests; here
// it's stubbed so each case can pin the exact money outcome the gate sees.
const trimmedByMerchant = new Map<
  string,
  { last30dIncrementalCents: number; last30dShareCents: number; liftPct: number | null }
>();

vi.mock("@/lib/billing/earnings", () => ({
  fetchTrimmedViewEarnings: (_sb: unknown, m: { id: string }) => {
    const t = trimmedByMerchant.get(m.id);
    if (!t) return Promise.reject(new Error("no stub"));
    return Promise.resolve({ ...t, firstTrackedAt: "2026-07-01T00:00:00Z" });
  },
}));

const { buildGraduationReport, draftPitch } = await import("@/lib/graduation");

type Merchant = Record<string, unknown>;
type Perf = Record<string, unknown>;

const NOW = new Date("2026-08-11T12:00:00Z").getTime();

function merchant(over: Partial<Merchant> = {}): Merchant {
  return {
    id: "m1",
    name: "Testco",
    domain: "testco.com",
    status: "live",
    escape_enabled: true,
    ab_enabled: true,
    billing_status: "none",
    billing_view_token: "tok1",
    billing_anchor: null,
    rev_share_pct: 10,
    base_fee_cents: 30000,
    base_fee_waived: false,
    referrer_id: null,
    referral_share_pct: null,
    created_at: "2026-07-01T00:00:00Z",
    ...over,
  };
}

/** Glimmr's real 14-day shape: comfortably significant, z ~3.9. */
function significantPerf(over: Partial<Perf> = {}): Perf {
  return {
    merchant_id: "m1",
    impressions_a: 13833,
    impressions_b: 16015,
    purchases_a: 341,
    purchases_b: 290,
    revenue_cents_a: 2379400,
    revenue_cents_b: 2020600,
    ...over,
  };
}

function fakeClient(merchants: Merchant[], perf: Perf[], alerts: Record<string, unknown>[]) {
  return {
    rpc: () => Promise.resolve({ data: perf, error: null }),
    from: (table: string) => ({
      select: () =>
        Promise.resolve({
          data: table === "merchants" ? merchants : table === "graduation_alerts" ? alerts : [],
          error: null,
        }),
    }),
  } as never;
}

beforeEach(() => {
  trimmedByMerchant.clear();
});

describe("buildGraduationReport", () => {
  it("surfaces a significant test with real trimmed incremental", async () => {
    trimmedByMerchant.set("m1", {
      last30dIncrementalCents: 1_200_000, // $12k incremental
      last30dShareCents: 120_000, // $1,200 at 10%
      liftPct: 31,
    });
    const r = await buildGraduationReport(
      fakeClient([merchant()], [significantPerf()], []),
      NOW,
      "https://x.test",
    );
    expect(r.candidates).toHaveLength(1);
    const c = r.candidates[0];
    expect(c.name).toBe("Testco");
    expect(c.z).toBeGreaterThan(3);
    expect(c.liftPct).toBeCloseTo(36.1, 0);
    // $1,200 share + $300 base
    expect(c.projectedMonthlyCents).toBe(150_000);
    expect(c.isNew).toBe(true);
    expect(r.heldBack).toHaveLength(0);
  });

  it("holds back a significant test whose incremental vanishes after trimming", async () => {
    // The failure this gate exists for: CVR lift is real, but the revenue that
    // drove it was one whale order the trim removed.
    trimmedByMerchant.set("m1", {
      last30dIncrementalCents: 0,
      last30dShareCents: 0,
      liftPct: -2,
    });
    const r = await buildGraduationReport(
      fakeClient([merchant()], [significantPerf()], []),
      NOW,
      "https://x.test",
    );
    expect(r.candidates).toHaveLength(0);
    expect(r.heldBack).toHaveLength(1);
    expect(r.heldBack[0].reason).toMatch(/outliers/i);
  });

  it("holds back when the rev share is too small to pitch", async () => {
    trimmedByMerchant.set("m1", {
      last30dIncrementalCents: 100_000,
      last30dShareCents: 10_000, // $100/mo, under the $250 floor
      liftPct: 12,
    });
    const r = await buildGraduationReport(
      fakeClient([merchant()], [significantPerf()], []),
      NOW,
      "https://x.test",
    );
    expect(r.candidates).toHaveLength(0);
    expect(r.heldBack[0].reason).toMatch(/more volume/i);
  });

  it("ignores a test that has not reached significance", async () => {
    trimmedByMerchant.set("m1", {
      last30dIncrementalCents: 1_200_000,
      last30dShareCents: 120_000,
      liftPct: 31,
    });
    // Vitanics' real shape: plenty of orders, lift under the noise floor.
    const perf = significantPerf({
      impressions_a: 2925,
      impressions_b: 3222,
      purchases_a: 73,
      purchases_b: 74,
    });
    const r = await buildGraduationReport(
      fakeClient([merchant()], [perf], []),
      NOW,
      "https://x.test",
    );
    expect(r.candidates).toHaveLength(0);
    expect(r.heldBack).toHaveLength(0);
  });

  it("ignores a big lift carried by too few control orders", async () => {
    trimmedByMerchant.set("m1", {
      last30dIncrementalCents: 1_200_000,
      last30dShareCents: 120_000,
      liftPct: 200,
    });
    // LIFX: +193% off 4 control orders. Must never reach a client.
    const perf = significantPerf({
      impressions_a: 926,
      impressions_b: 986,
      purchases_a: 11,
      purchases_b: 4,
    });
    const r = await buildGraduationReport(
      fakeClient([merchant()], [perf], []),
      NOW,
      "https://x.test",
    );
    expect(r.candidates).toHaveLength(0);
  });

  it("suppresses a brand posted within the repost window, then releases it", async () => {
    trimmedByMerchant.set("m1", {
      last30dIncrementalCents: 1_200_000,
      last30dShareCents: 120_000,
      liftPct: 31,
    });
    const recent = [
      {
        merchant_id: "m1",
        first_ready_at: "2026-08-01T00:00:00Z",
        last_posted_at: "2026-08-09T00:00:00Z", // 2 days ago
        posts: 1,
        dismissed_at: null,
      },
    ];
    const suppressedRun = await buildGraduationReport(
      fakeClient([merchant()], [significantPerf()], recent),
      NOW,
      "https://x.test",
    );
    expect(suppressedRun.candidates).toHaveLength(0);
    expect(suppressedRun.suppressed).toBe(1);

    const stale = [{ ...recent[0], last_posted_at: "2026-08-01T00:00:00Z" }]; // 10 days ago
    const releasedRun = await buildGraduationReport(
      fakeClient([merchant()], [significantPerf()], stale),
      NOW,
      "https://x.test",
    );
    expect(releasedRun.candidates).toHaveLength(1);
    // The original ready date survives the re-post, so "how long has this sat"
    // stays answerable.
    expect(releasedRun.candidates[0].firstReadyAt).toBe("2026-08-01T00:00:00Z");
    expect(releasedRun.candidates[0].isNew).toBe(false);
  });

  it("stays quiet about a dismissed brand forever", async () => {
    trimmedByMerchant.set("m1", {
      last30dIncrementalCents: 1_200_000,
      last30dShareCents: 120_000,
      liftPct: 31,
    });
    const dismissed = [
      {
        merchant_id: "m1",
        first_ready_at: "2026-06-01T00:00:00Z",
        last_posted_at: "2026-06-01T00:00:00Z",
        posts: 3,
        dismissed_at: "2026-06-02T00:00:00Z",
      },
    ];
    const r = await buildGraduationReport(
      fakeClient([merchant()], [significantPerf()], dismissed),
      NOW,
      "https://x.test",
    );
    expect(r.candidates).toHaveLength(0);
    expect(r.suppressed).toBe(1);
  });

  it("never considers a merchant already on a plan", async () => {
    trimmedByMerchant.set("m1", {
      last30dIncrementalCents: 1_200_000,
      last30dShareCents: 120_000,
      liftPct: 31,
    });
    const r = await buildGraduationReport(
      fakeClient([merchant({ billing_status: "active" })], [significantPerf()], []),
      NOW,
      "https://x.test",
    );
    expect(r.candidates).toHaveLength(0);
  });
});

describe("draftPitch", () => {
  const base = {
    name: "Testco",
    liftPct: 36.1,
    ordersA: 341,
    ordersB: 290,
    shareCents: 120_000,
    baseFeeCents: 30_000,
    revSharePct: 10,
    shareUrl: "https://x.test/share/tok1",
  };

  it("quotes the lift, the order count and both fees", () => {
    const d = draftPitch(base);
    expect(d).toContain("+36%");
    expect(d).toContain("631 orders");
    expect(d).toContain("$1,200");
    expect(d).toContain("$300");
    expect(d).toContain("https://x.test/share/tok1");
  });

  it("uses no em-dashes", () => {
    expect(draftPitch(base)).not.toMatch(/—/);
  });

  it("omits the dashboard line when there is no share token", () => {
    const d = draftPitch({ ...base, shareUrl: null });
    expect(d).not.toContain("no login needed");
  });
});
