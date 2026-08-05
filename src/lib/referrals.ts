import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAccruing } from "@/lib/billing/earnings";

// Referral earnings are computed at read time from the billing_invoices
// ledger — no separate payout table. Basis: PAID invoice total_cents ×
// effective share pct (merchant override ?? referrer default). "Pending"
// covers invoices still in flight (pending_review / charging / failed);
// voided invoices never count. With includeAccruing, active-billing merchants
// also get the currently-open period's estimate via computeAccruing — the
// SAME lib the /admin/billing console uses, so partner and admin numbers
// can never disagree.

export type Referrer = {
  id: string;
  name: string;
  email: string | null;
  default_share_pct: number;
  view_token: string | null;
  created_at: string;
};

export type ReferredMerchantRow = {
  id: string;
  name: string | null;
  domain: string | null;
  escape_enabled: boolean | null;
  billing_status: string;
  billing_view_token: string | null;
  referral_share_pct: number | null;
  referrer_id: string | null;
  created_at: string;
  // Billing fields — required only when includeAccruing is requested.
  billing_anchor?: string | null;
  rev_share_pct?: number | string;
  base_fee_cents?: number;
  base_fee_waived?: boolean;
};

/** Currently-open billing period estimate for one referred merchant. */
export type AccruingShare = {
  merchant_id: string;
  periodStart: string;
  periodEnd: string;
  totalCents: number;
  shareCents: number;
  effectivePct: number;
};

export type PartnerInvoice = {
  id: string;
  merchant_id: string;
  period_start: string;
  period_end: string;
  total_cents: number;
  status: string;
  charged_at: string | null;
  created_at: string;
  shareCents: number;
  effectivePct: number;
};

export type ReferredMerchantEarnings = {
  merchant: ReferredMerchantRow;
  effectivePct: number;
  paidTotalCents: number;
  paidShareCents: number;
  pendingTotalCents: number;
  pendingShareCents: number;
  /** Currently-open billing period (0 when not on a plan / not requested). */
  accruingTotalCents: number;
  accruingShareCents: number;
};

export type ReferrerEarnings = {
  merchants: ReferredMerchantEarnings[];
  invoices: PartnerInvoice[]; // newest first, paid + in-flight
  accruing: AccruingShare[]; // open-period estimates for active-billing merchants
  paidShareCents: number;
  pendingShareCents: number;
  accruingShareCents: number;
  paidTotalCents: number;
};

export function effectiveSharePct(referrer: Referrer, m: ReferredMerchantRow): number {
  return m.referral_share_pct != null ? Number(m.referral_share_pct) : Number(referrer.default_share_pct);
}

function shareOf(totalCents: number, pct: number): number {
  return Math.round((totalCents * pct) / 100);
}

const PENDING_STATUSES = ["pending_review", "charging", "failed"];

export async function fetchReferrerEarnings(
  sb: SupabaseClient,
  referrer: Referrer,
  merchants: ReferredMerchantRow[],
  opts?: { includeAccruing?: boolean },
): Promise<ReferrerEarnings> {
  const ids = merchants.map((m) => m.id);
  const pctByMerchant = new Map(merchants.map((m) => [m.id, effectiveSharePct(referrer, m)]));

  // Open-period estimates, computed concurrently with the invoice read. A
  // failure on one merchant degrades to no accruing row, never a page error.
  const accruingPromise: Promise<AccruingShare[]> = !opts?.includeAccruing
    ? Promise.resolve([])
    : Promise.all(
        merchants
          .filter((m) => m.billing_status === "active" && m.billing_anchor)
          .map(async (m): Promise<AccruingShare | null> => {
            try {
              const a = await computeAccruing(sb, {
                id: m.id,
                billing_anchor: m.billing_anchor as string,
                rev_share_pct: Number(m.rev_share_pct ?? 0),
                base_fee_cents: m.base_fee_cents ?? 0,
                base_fee_waived: m.base_fee_waived ?? false,
              });
              const pct = pctByMerchant.get(m.id)!;
              return {
                merchant_id: m.id,
                periodStart: a.periodStart,
                periodEnd: a.periodEnd,
                totalCents: a.totalCents,
                shareCents: shareOf(a.totalCents, pct),
                effectivePct: pct,
              };
            } catch {
              return null;
            }
          }),
      ).then((rows) => rows.filter((r): r is AccruingShare => r !== null));

  type InvRow = {
    id: string;
    merchant_id: string;
    period_start: string;
    period_end: string;
    total_cents: number;
    status: string;
    charged_at: string | null;
    created_at: string;
  };
  let invRows: InvRow[] = [];
  if (ids.length > 0) {
    const { data, error } = await sb
      .from("billing_invoices")
      .select("id, merchant_id, period_start, period_end, total_cents, status, charged_at, created_at")
      .in("merchant_id", ids)
      .in("status", ["paid", ...PENDING_STATUSES])
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(`referral invoices: ${error.message}`);
    invRows = (data ?? []) as InvRow[];
  }

  const invoices: PartnerInvoice[] = invRows.map((r) => {
    const pct = pctByMerchant.get(r.merchant_id) ?? Number(referrer.default_share_pct);
    return { ...r, effectivePct: pct, shareCents: shareOf(r.total_cents, pct) };
  });

  const byMerchant = new Map<string, { paidT: number; paidS: number; pendT: number; pendS: number }>();
  for (const inv of invoices) {
    const s = byMerchant.get(inv.merchant_id) ?? { paidT: 0, paidS: 0, pendT: 0, pendS: 0 };
    if (inv.status === "paid") {
      s.paidT += inv.total_cents;
      s.paidS += inv.shareCents;
    } else {
      s.pendT += inv.total_cents;
      s.pendS += inv.shareCents;
    }
    byMerchant.set(inv.merchant_id, s);
  }

  const accruing = await accruingPromise;
  const accruingByMerchant = new Map(accruing.map((a) => [a.merchant_id, a]));

  const merchantEarnings: ReferredMerchantEarnings[] = merchants.map((m) => {
    const s = byMerchant.get(m.id) ?? { paidT: 0, paidS: 0, pendT: 0, pendS: 0 };
    const a = accruingByMerchant.get(m.id);
    return {
      merchant: m,
      effectivePct: pctByMerchant.get(m.id)!,
      paidTotalCents: s.paidT,
      paidShareCents: s.paidS,
      pendingTotalCents: s.pendT,
      pendingShareCents: s.pendS,
      accruingTotalCents: a?.totalCents ?? 0,
      accruingShareCents: a?.shareCents ?? 0,
    };
  });

  return {
    merchants: merchantEarnings,
    invoices,
    accruing,
    paidShareCents: merchantEarnings.reduce((n, m) => n + m.paidShareCents, 0),
    pendingShareCents: merchantEarnings.reduce((n, m) => n + m.pendingShareCents, 0),
    accruingShareCents: merchantEarnings.reduce((n, m) => n + m.accruingShareCents, 0),
    paidTotalCents: merchantEarnings.reduce((n, m) => n + m.paidTotalCents, 0),
  };
}
