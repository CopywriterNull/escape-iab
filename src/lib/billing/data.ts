import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addOneMonthClamped,
  computeInvoice,
  trimOutliers,
  type InvoiceComputation,
} from "@/lib/billing/math";

export type PeriodMetrics = {
  impA: number;
  impB: number;
  rawRevACents: number;
  rawRevBCents: number;
  trimmedRevACents: number;
  trimmedRevBCents: number;
  outliersA: number[];
  outliersB: number[];
};

export function nextMonthlyPeriod(anchor: Date, lastMonthlyEnd: Date | null) {
  const start = lastMonthlyEnd ?? anchor;
  return { start, end: addOneMonthClamped(start) };
}

/** Rev-share window = [periodStart, periodEnd). Control RPV window =
 *  [controlFrom (= billing_anchor, the split flip), periodEnd) — the
 *  running control. Both trimmed. Purchases read must use the same
 *  date_trunc-hour lower bound as the rollup RPC (boundary rule). */
export async function computePeriodMetrics(
  sb: SupabaseClient,
  merchantId: string,
  controlFrom: Date,
  periodStart: Date,
  periodEnd: Date,
): Promise<PeriodMetrics> {
  const [aSums, bSums] = await Promise.all([
    sb.rpc("eh_billing_rollup_sums", {
      p_merchant: merchantId,
      p_from: periodStart.toISOString(),
      p_to: periodEnd.toISOString(),
    }),
    sb.rpc("eh_billing_rollup_sums", {
      p_merchant: merchantId,
      p_from: controlFrom.toISOString(),
      p_to: periodEnd.toISOString(),
    }),
  ]);
  if (aSums.error) throw new Error(`rollup sums (period): ${aSums.error.message}`);
  if (bSums.error) throw new Error(`rollup sums (control): ${bSums.error.message}`);

  type SumRow = { bucket: string; impressions: number; revenue_cents: number };
  const period = Object.fromEntries((aSums.data as SumRow[]).map((r) => [r.bucket, r]));
  const control = Object.fromEntries((bSums.data as SumRow[]).map((r) => [r.bucket, r]));

  const truncHour = (d: Date) => {
    const t = new Date(d);
    t.setUTCMinutes(0, 0, 0);
    return t;
  };

  async function purchaseValues(bucket: "a" | "b", from: Date, to: Date): Promise<number[]> {
    const { data, error } = await sb
      .from("escape_events")
      .select("value_cents")
      .eq("merchant_id", merchantId)
      .eq("event_type", "purchase")
      .eq("in_test", true)
      .eq("bucket", bucket)
      .gte("created_at", truncHour(from).toISOString())
      .lt("created_at", to.toISOString())
      .not("value_cents", "is", null)
      .limit(10000);
    if (error) throw new Error(`purchases ${bucket}: ${error.message}`);
    return (data ?? []).map((r) => r.value_cents as number);
  }

  const [aVals, bVals] = await Promise.all([
    purchaseValues("a", periodStart, periodEnd),
    purchaseValues("b", controlFrom, periodEnd),
  ]);
  const aTrim = trimOutliers(aVals);
  const bTrim = trimOutliers(bVals);

  const rawA = Number(period["a"]?.revenue_cents ?? 0);
  const rawB = Number(control["b"]?.revenue_cents ?? 0);
  return {
    impA: Number(period["a"]?.impressions ?? 0),
    impB: Number(control["b"]?.impressions ?? 0),
    rawRevACents: rawA,
    rawRevBCents: rawB,
    // Rollup revenue minus the trimmed whale total (rollups are the
    // authoritative revenue; raw purchase rows exist only to find whales).
    trimmedRevACents: Math.max(0, rawA - aTrim.trimmedTotalCents),
    trimmedRevBCents: Math.max(0, rawB - bTrim.trimmedTotalCents),
    outliersA: aTrim.outliers,
    outliersB: bTrim.outliers,
  };
}

export function buildSnapshot(
  m: PeriodMetrics,
  comp: InvoiceComputation,
  merchant: { rev_share_pct: number; base_fee_cents: number; base_fee_waived: boolean },
) {
  return {
    ...m,
    ...comp,
    revSharePct: merchant.rev_share_pct,
    baseFeeConfigCents: merchant.base_fee_cents,
    baseFeeWaived: merchant.base_fee_waived,
    computedAt: new Date().toISOString(),
  };
}

export { computeInvoice };
