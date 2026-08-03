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
  /** Which window produced the control arm (kept in invoice snapshots). */
  controlSource: "ab_test" | "running";
  controlFromIso: string;
  controlToIso: string;
};

// Below this, an A/B-window control arm isn't a credible baseline and we fall
// back to the running control.
const MIN_LOCKED_CONTROL_IMPRESSIONS = 300;

export function nextMonthlyPeriod(anchor: Date, lastMonthlyEnd: Date | null) {
  const start = lastMonthlyEnd ?? anchor;
  return { start, end: addOneMonthClamped(start) };
}

/** Rev-share window = [periodStart, periodEnd). Control RPV window: the
 *  LOCKED BASELINE — the historical 50/50 A/B window (eh_ab_test_window) —
 *  whenever it has a real control sample. After a merchant is ramped (e.g.
 *  90/10) the running control is starved; its noisy RPV understates the
 *  counterfactual and inflates the bill. Falls back to the running window
 *  [controlFrom (= billing_anchor, the split flip), periodEnd) when no usable
 *  A/B window exists. Both trimmed. Purchases read must use the same
 *  date_trunc-hour lower bound as the rollup RPC (boundary rule). */
export async function computePeriodMetrics(
  sb: SupabaseClient,
  merchantId: string,
  controlFrom: Date,
  periodStart: Date,
  periodEnd: Date,
): Promise<PeriodMetrics> {
  // Resolve the control window: locked A/B baseline when detected.
  let controlWindow = { from: controlFrom, to: periodEnd, source: "running" as PeriodMetrics["controlSource"] };
  const abRes = await sb.rpc("eh_ab_test_window", { p_merchant_id: merchantId });
  if (!abRes.error && Array.isArray(abRes.data) && abRes.data.length > 0) {
    const row = abRes.data[0] as { start_ts?: string | null; end_ts?: string | null };
    if (typeof row?.start_ts === "string" && typeof row?.end_ts === "string") {
      controlWindow = { from: new Date(row.start_ts), to: new Date(row.end_ts), source: "ab_test" };
    }
  }

  const controlSums = async () =>
    sb.rpc("eh_billing_rollup_sums", {
      p_merchant: merchantId,
      p_from: controlWindow.from.toISOString(),
      p_to: controlWindow.to.toISOString(),
    });

  const [aSums, bSumsFirst] = await Promise.all([
    sb.rpc("eh_billing_rollup_sums", {
      p_merchant: merchantId,
      p_from: periodStart.toISOString(),
      p_to: periodEnd.toISOString(),
    }),
    controlSums(),
  ]);
  if (aSums.error) throw new Error(`rollup sums (period): ${aSums.error.message}`);
  if (bSumsFirst.error) throw new Error(`rollup sums (control): ${bSumsFirst.error.message}`);

  // If the locked window's control arm is too thin to be a baseline, fall
  // back to the running control (conservative: never bill from a tiny arm).
  let bData = bSumsFirst.data;
  if (controlWindow.source === "ab_test") {
    type ImpRow = { bucket: string; impressions: number };
    const b = (bData as ImpRow[] | null)?.find((r) => r.bucket === "b");
    if (Number(b?.impressions ?? 0) < MIN_LOCKED_CONTROL_IMPRESSIONS) {
      controlWindow = { from: controlFrom, to: periodEnd, source: "running" };
      const retry = await controlSums();
      if (retry.error) throw new Error(`rollup sums (control fallback): ${retry.error.message}`);
      bData = retry.data;
    }
  }

  type SumRow = { bucket: string; impressions: number; revenue_cents: number };
  const period = Object.fromEntries((aSums.data as SumRow[]).map((r) => [r.bucket, r]));
  const control = Object.fromEntries(((bData ?? []) as SumRow[]).map((r) => [r.bucket, r]));

  const truncHour = (d: Date) => {
    const t = new Date(d);
    t.setUTCMinutes(0, 0, 0);
    return t;
  };

  const PURCHASE_PAGE_SIZE = 1000;
  const PURCHASE_ROW_SAFETY_CEILING = 200_000;

  async function purchaseValues(bucket: "a" | "b", from: Date, to: Date): Promise<number[]> {
    const values: number[] = [];
    let offset = 0;
    for (;;) {
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
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + PURCHASE_PAGE_SIZE - 1);
      if (error) throw new Error(`purchases ${bucket}: ${error.message}`);
      const rows = data ?? [];
      for (const r of rows) values.push(r.value_cents as number);
      if (values.length > PURCHASE_ROW_SAFETY_CEILING) {
        throw new Error(`purchases ${bucket}: row count exceeds safety ceiling`);
      }
      if (rows.length < PURCHASE_PAGE_SIZE) break;
      offset += PURCHASE_PAGE_SIZE;
    }
    return values;
  }

  const [aVals, bVals] = await Promise.all([
    purchaseValues("a", periodStart, periodEnd),
    purchaseValues("b", controlWindow.from, controlWindow.to),
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
    controlSource: controlWindow.source,
    controlFromIso: controlWindow.from.toISOString(),
    controlToIso: controlWindow.to.toISOString(),
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
