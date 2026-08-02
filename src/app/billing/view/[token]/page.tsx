import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  computeAccruing,
  fetchTrimmedViewEarnings,
  type AccruingPeriod,
} from "@/lib/billing/earnings";
import {
  ChartLedView,
  ConsoleView,
  StatementView,
  type ViewData,
  type ViewInvoice,
} from "./_components/variants";

export const dynamic = "force-dynamic";

// Merchant-facing, token-addressed, read-only. Value-first: leads with the
// incremental revenue story, then fees. ?v=1|2|3 switches design variations
// (1 = statement default) — kept as a quiet override after a winner is picked.
export default async function BillingViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const [{ token }, { v }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f]{32}$/i.test(token)) notFound();
  const sb = getSupabaseAdmin();
  if (!sb) notFound();

  const { data: m } = await sb
    .from("merchants")
    .select(
      "id, name, billing_status, billing_anchor, base_fee_cents, base_fee_waived, rev_share_pct",
    )
    .eq("billing_view_token", token)
    .single();
  if (!m) notFound();

  const [earnings, invoicesRes] = await Promise.all([
    // Trimmed running-control math (same as invoices) — the untrimmed admin
    // estimates can be flipped negative by a single whale control order.
    fetchTrimmedViewEarnings(sb, { id: m.id, rev_share_pct: Number(m.rev_share_pct) }),
    // Merchant sees settled + in-flight charges only — never internal
    // pending_review drafts (not yet operator-approved) or voided rows.
    sb
      .from("billing_invoices")
      .select("id, kind, period_start, period_end, total_cents, status, charged_at, created_at")
      .eq("merchant_id", m.id)
      .in("status", ["paid", "charging"])
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  let accruing: AccruingPeriod | null = null;
  if (m.billing_status === "active" && m.billing_anchor) {
    try {
      accruing = await computeAccruing(sb, {
        id: m.id,
        billing_anchor: m.billing_anchor,
        rev_share_pct: Number(m.rev_share_pct),
        base_fee_cents: m.base_fee_cents,
        base_fee_waived: m.base_fee_waived,
      });
    } catch {
      accruing = null;
    }
  }

  const data: ViewData = {
    merchantName: m.name ?? "Your store",
    planActive: m.billing_status === "active",
    baseFeeCents: m.base_fee_cents,
    baseFeeWaived: m.base_fee_waived,
    revSharePct: Number(m.rev_share_pct),
    earnings,
    accruing,
    invoices: (invoicesRes.data ?? []) as ViewInvoice[],
    liftPct: earnings.liftPct,
  };

  if (v === "3") return <ChartLedView data={data} />;
  if (v === "2") return <ConsoleView data={data} />;
  return <StatementView data={data} />;
}
