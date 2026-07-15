// Pure billing math. No I/O — everything here is unit-tested and every
// number that lands on an invoice snapshot is produced by this module.

export type InvoiceInput = {
  impA: number;
  trimmedRevACents: number;
  impB: number;
  trimmedRevBCents: number;
  revSharePct: number; // e.g. 10
  baseFeeCents: number; // e.g. 30000
  baseFeeWaived: boolean;
};

export type InvoiceComputation = {
  controlRpvMicroCents: number; // micro-cents per impression, integer
  counterfactualCents: number;
  incrementalCents: number;
  revShareCents: number;
  baseFeeCents: number; // 0 when waived
  totalCents: number;
};

const MIN_ORDERS_FOR_TRIM = 8;

function quantileSorted(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Same rule as eh_admin_brand_performance_outliers:
 *  outlier iff value > Q3 + 3*IQR AND value > 8*median; needs >= 8 orders. */
export function trimOutliers(valuesCents: number[]): {
  keptTotalCents: number;
  trimmedTotalCents: number;
  outliers: number[];
} {
  const total = valuesCents.reduce((a, b) => a + b, 0);
  if (valuesCents.length < MIN_ORDERS_FOR_TRIM) {
    return { keptTotalCents: total, trimmedTotalCents: 0, outliers: [] };
  }
  const sorted = [...valuesCents].sort((a, b) => a - b);
  const q1 = quantileSorted(sorted, 0.25);
  const q3 = quantileSorted(sorted, 0.75);
  const median = quantileSorted(sorted, 0.5);
  const cutoff = q3 + 3 * (q3 - q1);
  const outliers = valuesCents.filter((v) => v > cutoff && v > 8 * median);
  const trimmed = outliers.reduce((a, b) => a + b, 0);
  return { keptTotalCents: total - trimmed, trimmedTotalCents: trimmed, outliers };
}

export function computeInvoice(input: InvoiceInput): InvoiceComputation {
  const hasControl = input.impB > 0 && input.trimmedRevBCents >= 0;
  const controlRpvMicroCents = hasControl
    ? Math.round((input.trimmedRevBCents * 1_000_000) / input.impB)
    : 0;
  // No control data → never bill lift (conservative).
  const counterfactualCents = hasControl
    ? Math.round((input.impA * controlRpvMicroCents) / 1_000_000)
    : input.trimmedRevACents;
  const incrementalCents = Math.max(0, input.trimmedRevACents - counterfactualCents);
  const revShareCents = Math.round((incrementalCents * input.revSharePct) / 100);
  const baseFeeCents = input.baseFeeWaived ? 0 : input.baseFeeCents;
  return {
    controlRpvMicroCents,
    counterfactualCents: hasControl ? counterfactualCents : input.trimmedRevACents,
    incrementalCents,
    revShareCents,
    baseFeeCents,
    totalCents: revShareCents + baseFeeCents,
  };
}

/** Anniversary month-add: Jul 15 → Aug 15; Jan 31 → Feb 28 (clamped). */
export function addOneMonthClamped(d: Date): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const lastDayNextMonth = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
  return new Date(
    Date.UTC(y, m + 1, Math.min(day, lastDayNextMonth), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()),
  );
}
