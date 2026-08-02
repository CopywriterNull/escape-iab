import type { SupabaseClient } from "@supabase/supabase-js";
import { computeInvoice } from "@/lib/billing/math";
import { computePeriodMetrics, nextMonthlyPeriod } from "@/lib/billing/data";

// Dashboard earnings estimates. All numbers here are UNTRIMMED (no outlier
// pass — that needs order-level reads, too heavy for a page load across every
// merchant). The invoice pipeline (computePeriodMetrics + computeInvoice)
// stays the authority on billable amounts; treat these as directional.

type EarningsRpcRow = {
  merchant_id: string;
  day: string | null;
  bucket: string;
  impressions: number;
  revenue_cents: number;
  first_hour: string | null;
};

export type DailyShare = {
  day: string; // YYYY-MM-DD (UTC)
  incrementalCents: number;
  shareCents: number;
};

export type MerchantEarnings = {
  firstTrackedAt: string | null;
  /** All-time per-bucket sums — for RPV/lift display on merchant-facing views. */
  allTime: { impA: number; revACents: number; impB: number; revBCents: number };
  sinceStartIncrementalCents: number;
  sinceStartShareCents: number;
  last30dIncrementalCents: number;
  last30dShareCents: number;
  todayIncrementalCents: number;
  todayShareCents: number;
  daily: DailyShare[]; // oldest → newest, every one of the last 30 UTC days
};

export type AccruingPeriod = {
  periodStart: string;
  periodEnd: string;
  incrementalCents: number;
  revShareCents: number;
  baseFeeCents: number;
  totalCents: number;
};

/** Conservative estimate, mirroring computeInvoice's no-control rule:
 *  without control impressions the lift is 0, never "all of revenue A". */
function estIncremental(impA: number, revA: number, impB: number, revB: number): number {
  if (impB <= 0) return 0;
  const counterfactual = Math.round((impA * revB) / impB);
  return Math.max(0, revA - counterfactual);
}

function shareOf(incrementalCents: number, revSharePct: number): number {
  return Math.round((incrementalCents * revSharePct) / 100);
}

function utcDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const WINDOW_DAYS = 30;

/** One RPC round trip → per-merchant since-start / 30d / today estimates
 *  plus the 30-day daily series. Merchants absent from the rollups map to
 *  all-zero earnings. */
export async function fetchEarnings(
  sb: SupabaseClient,
  merchants: { id: string; rev_share_pct: number }[],
): Promise<Map<string, MerchantEarnings>> {
  const { data, error } = await sb.rpc("eh_admin_billing_earnings", { p_days: WINDOW_DAYS });
  if (error) throw new Error(`earnings rollup: ${error.message}`);
  const rows = (data ?? []) as EarningsRpcRow[];

  type BucketSums = { impA: number; revA: number; impB: number; revB: number };
  const zero = (): BucketSums => ({ impA: 0, revA: 0, impB: 0, revB: 0 });
  const addRow = (s: BucketSums, r: EarningsRpcRow) => {
    if (r.bucket === "a") {
      s.impA += Number(r.impressions);
      s.revA += Number(r.revenue_cents);
    } else if (r.bucket === "b") {
      s.impB += Number(r.impressions);
      s.revB += Number(r.revenue_cents);
    }
  };

  const allTime = new Map<string, BucketSums>();
  const firstHour = new Map<string, string>();
  const byDay = new Map<string, Map<string, BucketSums>>(); // merchant → day → sums
  for (const r of rows) {
    if (r.day === null) {
      const s = allTime.get(r.merchant_id) ?? zero();
      addRow(s, r);
      allTime.set(r.merchant_id, s);
      if (r.first_hour) {
        const prev = firstHour.get(r.merchant_id);
        if (!prev || r.first_hour < prev) firstHour.set(r.merchant_id, r.first_hour);
      }
    } else {
      let days = byDay.get(r.merchant_id);
      if (!days) {
        days = new Map();
        byDay.set(r.merchant_id, days);
      }
      const s = days.get(r.day) ?? zero();
      addRow(s, r);
      days.set(r.day, s);
    }
  }

  // The last 30 UTC days, oldest first, today included — fixed-length so the
  // chart never shifts with data sparsity.
  const today = new Date();
  const dayKeys: string[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    dayKeys.push(utcDayString(new Date(today.getTime() - i * 86_400_000)));
  }

  const out = new Map<string, MerchantEarnings>();
  for (const m of merchants) {
    const at = allTime.get(m.id) ?? zero();
    const days = byDay.get(m.id) ?? new Map<string, BucketSums>();

    const w = zero();
    for (const s of days.values()) {
      w.impA += s.impA;
      w.revA += s.revA;
      w.impB += s.impB;
      w.revB += s.revB;
    }

    // Daily estimates share one control RPV so day-to-day movement reflects
    // escape revenue, not control noise. Prefer the 30d control; fall back
    // to all-time when the window has no control impressions (e.g. after a
    // 90/10 flip on a quiet store).
    const rpvSource = w.impB > 0 ? w : at;
    const daily: DailyShare[] = dayKeys.map((day) => {
      const s = days.get(day) ?? zero();
      const inc = estIncremental(s.impA, s.revA, rpvSource.impB, rpvSource.revB);
      return { day, incrementalCents: inc, shareCents: shareOf(inc, m.rev_share_pct) };
    });

    const sinceStartInc = estIncremental(at.impA, at.revA, at.impB, at.revB);
    const last30dInc = estIncremental(w.impA, w.revA, rpvSource.impB, rpvSource.revB);
    const todayPoint = daily[daily.length - 1];

    out.set(m.id, {
      firstTrackedAt: firstHour.get(m.id) ?? null,
      allTime: { impA: at.impA, revACents: at.revA, impB: at.impB, revBCents: at.revB },
      sinceStartIncrementalCents: sinceStartInc,
      sinceStartShareCents: shareOf(sinceStartInc, m.rev_share_pct),
      last30dIncrementalCents: last30dInc,
      last30dShareCents: shareOf(last30dInc, m.rev_share_pct),
      todayIncrementalCents: todayPoint?.incrementalCents ?? 0,
      todayShareCents: todayPoint?.shareCents ?? 0,
      daily,
    });
  }
  return out;
}

export type TrimmedViewEarnings = MerchantEarnings & {
  /** All-time RPV lift, outlier-trimmed both sides. Null without control. */
  liftPct: number | null;
};

/** Merchant-facing earnings: same outlier-trimmed running-control math the
 *  invoices use, so a single whale order can't flip the page negative the
 *  way the untrimmed admin estimates can. Heavier (reads raw purchase rows)
 *  — fine for a single-merchant page, not for the all-merchants admin list. */
export async function fetchTrimmedViewEarnings(
  sb: SupabaseClient,
  merchant: { id: string; rev_share_pct: number },
): Promise<TrimmedViewEarnings> {
  const zeroOut = (daily: DailyShare[]): TrimmedViewEarnings => ({
    firstTrackedAt: null,
    allTime: { impA: 0, revACents: 0, impB: 0, revBCents: 0 },
    sinceStartIncrementalCents: 0,
    sinceStartShareCents: 0,
    last30dIncrementalCents: 0,
    last30dShareCents: 0,
    todayIncrementalCents: 0,
    todayShareCents: 0,
    daily,
    liftPct: null,
  });

  const now = new Date();
  const dayKeys: string[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    dayKeys.push(utcDayString(new Date(now.getTime() - i * 86_400_000)));
  }
  const emptyDaily = dayKeys.map((day) => ({ day, incrementalCents: 0, shareCents: 0 }));

  const { data: firstRow, error: firstErr } = await sb
    .from("hourly_funnel_rollups")
    .select("hour")
    .eq("merchant_id", merchant.id)
    .order("hour", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (firstErr) throw new Error(`first hour: ${firstErr.message}`);
  if (!firstRow) return zeroOut(emptyDaily);
  const first = new Date(firstRow.hour as string);

  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const [allMetrics, winMetrics, dailyRes] = await Promise.all([
    // All-time: period == control window == [first, now).
    computePeriodMetrics(sb, merchant.id, first, first, now),
    // 30d escape window against the same running control [first, now).
    computePeriodMetrics(sb, merchant.id, first, windowStart < first ? first : windowStart, now),
    sb.rpc("eh_admin_billing_earnings", { p_days: WINDOW_DAYS }),
  ]);
  if (dailyRes.error) throw new Error(`earnings rollup: ${dailyRes.error.message}`);

  // Trimmed running-control RPV (micro-cents/impression) shared by every
  // estimate below — mirrors computeInvoice's no-control conservatism.
  const hasControl = allMetrics.impB > 0;
  const rpvMicro = hasControl
    ? Math.round((allMetrics.trimmedRevBCents * 1_000_000) / allMetrics.impB)
    : 0;
  const incAgainstControl = (impA: number, revACents: number): number => {
    if (!hasControl) return 0;
    return Math.max(0, revACents - Math.round((impA * rpvMicro) / 1_000_000));
  };

  type Row = { merchant_id: string; day: string | null; bucket: string; impressions: number; revenue_cents: number };
  const dayA = new Map<string, { imp: number; rev: number }>();
  for (const r of (dailyRes.data ?? []) as Row[]) {
    if (r.merchant_id !== merchant.id || r.day === null || r.bucket !== "a") continue;
    const s = dayA.get(r.day) ?? { imp: 0, rev: 0 };
    s.imp += Number(r.impressions);
    s.rev += Number(r.revenue_cents);
    dayA.set(r.day, s);
  }
  const daily: DailyShare[] = dayKeys.map((day) => {
    const s = dayA.get(day) ?? { imp: 0, rev: 0 };
    const inc = incAgainstControl(s.imp, s.rev);
    return { day, incrementalCents: inc, shareCents: shareOf(inc, merchant.rev_share_pct) };
  });

  const sinceStartInc = incAgainstControl(allMetrics.impA, allMetrics.trimmedRevACents);
  const last30dInc = incAgainstControl(winMetrics.impA, winMetrics.trimmedRevACents);
  const todayPoint = daily[daily.length - 1];
  const rpvA = allMetrics.impA > 0 ? allMetrics.trimmedRevACents / allMetrics.impA : 0;
  const rpvB = hasControl ? allMetrics.trimmedRevBCents / allMetrics.impB : 0;

  return {
    firstTrackedAt: first.toISOString(),
    allTime: {
      impA: allMetrics.impA,
      revACents: allMetrics.trimmedRevACents,
      impB: allMetrics.impB,
      revBCents: allMetrics.trimmedRevBCents,
    },
    sinceStartIncrementalCents: sinceStartInc,
    sinceStartShareCents: shareOf(sinceStartInc, merchant.rev_share_pct),
    last30dIncrementalCents: last30dInc,
    last30dShareCents: shareOf(last30dInc, merchant.rev_share_pct),
    todayIncrementalCents: todayPoint?.incrementalCents ?? 0,
    todayShareCents: todayPoint?.shareCents ?? 0,
    daily,
    liftPct: hasControl && rpvB > 0 ? ((rpvA - rpvB) / rpvB) * 100 : null,
  };
}

/** What the NEXT monthly invoice is accruing toward for an active merchant —
 *  the real billable number: same trimmed math the cron will run, over the
 *  currently open period. */
export async function computeAccruing(
  sb: SupabaseClient,
  merchant: {
    id: string;
    billing_anchor: string;
    rev_share_pct: number;
    base_fee_cents: number;
    base_fee_waived: boolean;
  },
): Promise<AccruingPeriod> {
  const { data: last } = await sb
    .from("billing_invoices")
    .select("period_end")
    .eq("merchant_id", merchant.id)
    .eq("kind", "monthly")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  const anchor = new Date(merchant.billing_anchor);
  const period = nextMonthlyPeriod(anchor, last ? new Date(last.period_end) : null);
  const metrics = await computePeriodMetrics(sb, merchant.id, anchor, period.start, period.end);
  const comp = computeInvoice({
    impA: metrics.impA,
    trimmedRevACents: metrics.trimmedRevACents,
    impB: metrics.impB,
    trimmedRevBCents: metrics.trimmedRevBCents,
    revSharePct: Number(merchant.rev_share_pct),
    baseFeeCents: merchant.base_fee_cents,
    baseFeeWaived: merchant.base_fee_waived,
  });
  return {
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    incrementalCents: comp.incrementalCents,
    revShareCents: comp.revShareCents,
    baseFeeCents: comp.baseFeeCents,
    totalCents: comp.totalCents,
  };
}
