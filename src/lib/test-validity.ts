import { sampleSizePerBucket, zTestTwoProp, type Funnel } from "@/lib/db";

export type ValidityLevel = "ready" | "directional" | "collecting" | "invalid";

export type ValidityCheck = {
  key: string;
  label: string;
  detail: string;
  passed: boolean;
};

export type TestValidity = {
  level: ValidityLevel;
  label: string;
  headline: string;
  confidence: number | null;
  pValue: number | null;
  checks: ValidityCheck[];
  sample: {
    a: number;
    b: number;
    minBucket: number;
    requiredPerBucket: number | null;
    progress: number;
  };
};

export type ReportMetrics = {
  impressions: { a: number; b: number; total: number };
  purchases: { a: number; b: number; total: number };
  revenueCents: { a: number; b: number; total: number };
  cvr: { a: number | null; b: number | null };
  rpv: { a: number | null; b: number | null };
  cvrLift: number | null;
  rpvLift: number | null;
  projectedRevenueDeltaCents: number | null;
  z: ReturnType<typeof zTestTwoProp>;
};

export function getReportMetrics(funnel: Funnel): ReportMetrics {
  const impressionsA = funnel.impressions.a;
  const impressionsB = funnel.impressions.b;
  const totalImpressions = impressionsA + impressionsB;
  const purchasesA = funnel.purchases.a;
  const purchasesB = funnel.purchases.b;
  const totalPurchases = purchasesA + purchasesB;
  const revenueA = funnel.revenue_cents.a;
  const revenueB = funnel.revenue_cents.b;
  const totalRevenue = revenueA + revenueB;
  const cvrA = impressionsA > 0 ? purchasesA / impressionsA : null;
  const cvrB = impressionsB > 0 ? purchasesB / impressionsB : null;
  const rpvA = impressionsA > 0 ? revenueA / impressionsA : null;
  const rpvB = impressionsB > 0 ? revenueB / impressionsB : null;
  const cvrLift = cvrA != null && cvrB != null && cvrB > 0 ? (cvrA - cvrB) / cvrB : null;
  const rpvLift = rpvA != null && rpvB != null && rpvB > 0 ? (rpvA - rpvB) / rpvB : null;
  const projectedRevenueDeltaCents =
    rpvA != null && totalImpressions > 0
      ? Math.round(totalImpressions * rpvA - totalRevenue)
      : null;

  return {
    impressions: { a: impressionsA, b: impressionsB, total: totalImpressions },
    purchases: { a: purchasesA, b: purchasesB, total: totalPurchases },
    revenueCents: { a: revenueA, b: revenueB, total: totalRevenue },
    cvr: { a: cvrA, b: cvrB },
    rpv: { a: rpvA, b: rpvB },
    cvrLift,
    rpvLift,
    projectedRevenueDeltaCents,
    z: zTestTwoProp(purchasesA, impressionsA, purchasesB, impressionsB),
  };
}

export function evaluateTestValidity(
  funnel: Funnel,
  opts: { minDays?: number; observedDays?: number; mdeRel?: number } = {},
): TestValidity {
  const metrics = getReportMetrics(funnel);
  const mdeRel = opts.mdeRel ?? 0.3;
  const minDays = opts.minDays ?? 7;
  const observedDays = opts.observedDays ?? 14;
  const minBucket = Math.min(metrics.impressions.a, metrics.impressions.b);
  const baseline = metrics.cvr.b ?? metrics.cvr.a ?? null;
  const requiredPerBucket =
    baseline != null && baseline > 0 && baseline < 1
      ? sampleSizePerBucket(baseline, mdeRel)
      : null;
  const progress =
    requiredPerBucket && Number.isFinite(requiredPerBucket) && requiredPerBucket > 0
      ? Math.min(1, minBucket / requiredPerBucket)
      : 0;
  const confidence = metrics.z?.pValue != null ? Math.max(0, Math.min(0.999, 1 - metrics.z.pValue)) : null;

  const checks: ValidityCheck[] = [
    {
      key: "both-buckets",
      label: "Both buckets receiving traffic",
      detail: `${metrics.impressions.a.toLocaleString()} escape / ${metrics.impressions.b.toLocaleString()} control impressions`,
      passed: metrics.impressions.a > 0 && metrics.impressions.b > 0,
    },
    {
      key: "purchase-signal",
      label: "Purchase signal present",
      detail: `${metrics.purchases.total.toLocaleString()} attributed purchases in the test window`,
      passed: metrics.purchases.total >= 5,
    },
    {
      key: "minimum-runtime",
      label: "Minimum runtime",
      detail: `${observedDays.toLocaleString()}d observed / ${minDays.toLocaleString()}d minimum`,
      passed: observedDays >= minDays,
    },
    {
      key: "sample-size",
      label: "Sample size for 30% MDE",
      detail:
        requiredPerBucket && Number.isFinite(requiredPerBucket)
          ? `${minBucket.toLocaleString()} / ${requiredPerBucket.toLocaleString()} per bucket`
          : "Needs purchases in control to estimate required sample",
      passed: requiredPerBucket != null && Number.isFinite(requiredPerBucket) && minBucket >= requiredPerBucket,
    },
    {
      key: "confidence",
      label: "Statistical confidence",
      detail: confidence == null ? "Waiting for both buckets" : `${Math.round(confidence * 100)}% confidence`,
      passed: metrics.z?.significant === true,
    },
  ];

  const hardInvalid = !checks[0].passed || metrics.impressions.total === 0;
  const ready = checks.every((c) => c.passed);
  const directional =
    !hardInvalid &&
    checks.filter((c) => c.passed).length >= 3 &&
    metrics.purchases.total > 0;

  if (ready) {
    return {
      level: "ready",
      label: "Ready to call",
      headline: "The test has enough signal for a client-facing readout.",
      confidence,
      pValue: metrics.z?.pValue ?? null,
      checks,
      sample: { a: metrics.impressions.a, b: metrics.impressions.b, minBucket, requiredPerBucket, progress },
    };
  }

  if (directional) {
    return {
      level: "directional",
      label: "Directional",
      headline: "Useful readout, but keep the caveats visible.",
      confidence,
      pValue: metrics.z?.pValue ?? null,
      checks,
      sample: { a: metrics.impressions.a, b: metrics.impressions.b, minBucket, requiredPerBucket, progress },
    };
  }

  if (hardInvalid) {
    return {
      level: "invalid",
      label: "Not valid yet",
      headline: "The report should not be used as proof yet.",
      confidence,
      pValue: metrics.z?.pValue ?? null,
      checks,
      sample: { a: metrics.impressions.a, b: metrics.impressions.b, minBucket, requiredPerBucket, progress },
    };
  }

  return {
    level: "collecting",
    label: "Collecting",
    headline: "Tracking is live, but the test needs more conversions.",
    confidence,
    pValue: metrics.z?.pValue ?? null,
    checks,
    sample: { a: metrics.impressions.a, b: metrics.impressions.b, minBucket, requiredPerBucket, progress },
  };
}
