import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  fetchReferrerEarnings,
  type Referrer,
  type ReferredMerchantRow,
} from "@/lib/referrals";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Partner dashboard — Escape Hatch",
  robots: { index: false, follow: false },
};

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// ISO date slice — deterministic across server render + client hydration.
function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

// Tokened, read-only, no-login partner (affiliate/referral) dashboard:
// referred brands, collected billing, the partner's cut, and deep links into
// each brand's live shared dashboard.
export default async function PartnerDashboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[0-9a-f]{32}$/i.test(token)) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const { data: r } = await admin
    .from("referrers")
    .select("*")
    .eq("view_token", token)
    .maybeSingle();
  if (!r) notFound();
  const referrer = r as Referrer;

  const { data: ms } = await admin
    .from("merchants")
    .select(
      "id, name, domain, escape_enabled, billing_status, billing_view_token, referral_share_pct, referrer_id, created_at, billing_anchor, rev_share_pct, base_fee_cents, base_fee_waived",
    )
    .eq("referrer_id", referrer.id)
    .order("created_at", { ascending: true });
  const merchants = (ms ?? []) as ReferredMerchantRow[];

  const earnings = await fetchReferrerEarnings(admin, referrer, merchants, {
    includeAccruing: true,
  });
  const merchantNames = new Map(merchants.map((m) => [m.id, m.name ?? "(unnamed)"]));
  const pendingPlusAccruing = earnings.pendingShareCents + earnings.accruingShareCents;

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] grain">
      <header className="border-b border-[var(--color-border-soft)] bg-[var(--color-bg)]/90">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-block size-2 rounded-full bg-[var(--color-accent)]" />
            <span className="text-[13px] font-semibold tracking-tight">Escape Hatch</span>
            <span className="text-[11px] font-mono text-[var(--color-fg-muted)] truncate">
              / partner / {referrer.name}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">
            Read-only
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-7">
        <div>
          <div className="eyebrow">Partner dashboard</div>
          <h1 className="mt-2 h-display text-[26px] sm:text-[32px] tracking-tight">
            {referrer.name}
          </h1>
          <p className="mt-1 text-[12.5px] text-[var(--color-fg-dim)]">
            Your share is {Number(referrer.default_share_pct)}% of collected billing from brands you
            referred{merchants.some((m) => m.referral_share_pct != null)
              ? " (some brands carry a custom rate — shown per brand below)"
              : ""}
            . Figures update as invoices are collected.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-5 py-5">
            <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
              Earned (collected)
            </div>
            <div className="mt-2 tnum font-semibold text-[34px] leading-[1] text-[var(--color-success)]">
              {money(earnings.paidShareCents)}
            </div>
            <div className="mt-2 text-[12px] text-[var(--color-fg-dim)]">
              your cut of {money(earnings.paidTotalCents)} collected
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-5 py-5">
            <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
              Pending
            </div>
            <div className="mt-2 tnum font-semibold text-[34px] leading-[1]">
              {money(pendingPlusAccruing)}
            </div>
            <div className="mt-2 text-[12px] text-[var(--color-fg-dim)]">
              {earnings.accruingShareCents > 0
                ? `${money(earnings.accruingShareCents)} accruing this period · ${money(earnings.pendingShareCents)} invoiced, not yet collected`
                : "on invoices not yet collected"}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-5 py-5">
            <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
              Referred brands
            </div>
            <div className="mt-2 tnum font-semibold text-[34px] leading-[1]">{merchants.length}</div>
            <div className="mt-2 text-[12px] text-[var(--color-fg-dim)]">
              {merchants.filter((m) => m.billing_status === "active").length} on live billing
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border-soft)] text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
            Your brands
          </div>
          {merchants.length === 0 ? (
            <div className="px-5 py-8 text-[13px] text-[var(--color-fg-dim)]">
              No brands assigned yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-[12.5px]">
                <thead className="text-[9.5px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)] border-b border-[var(--color-border-soft)]">
                  <tr>
                    <th className="text-left px-5 py-2.5 font-medium">Brand</th>
                    <th className="text-left px-3 py-2.5 font-medium">Status</th>
                    <th className="text-right px-3 py-2.5 font-medium">Your %</th>
                    <th className="text-right px-3 py-2.5 font-medium">Collected</th>
                    <th className="text-right px-3 py-2.5 font-medium">Your cut</th>
                    <th className="text-right px-3 py-2.5 font-medium">Pending cut</th>
                    <th className="text-right px-5 py-2.5 font-medium">Live data</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.merchants.map(({ merchant: m, effectivePct, paidTotalCents, paidShareCents, pendingShareCents, accruingShareCents }) => (
                    <tr key={m.id} className="border-b border-[var(--color-border-soft)]/60 last:border-b-0">
                      <td className="px-5 py-3 align-middle">
                        <div className="font-medium tracking-tight">{m.name ?? "(unnamed)"}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]">
                          {m.domain ?? "—"}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span
                          className={
                            m.billing_status === "active"
                              ? "pill pill-success"
                              : m.escape_enabled !== false
                                ? "pill pill-info"
                                : "pill pill-muted"
                          }
                        >
                          {m.billing_status === "active"
                            ? "BILLING LIVE"
                            : m.escape_enabled !== false
                              ? "TESTING"
                              : "PAUSED"}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-middle text-right font-mono tnum">{effectivePct}%</td>
                      <td className="px-3 py-3 align-middle text-right font-mono tnum text-[var(--color-fg-dim)]">
                        {money(paidTotalCents)}
                      </td>
                      <td className="px-3 py-3 align-middle text-right font-mono tnum font-semibold text-[var(--color-success)]">
                        {money(paidShareCents)}
                      </td>
                      <td className="px-3 py-3 align-middle text-right font-mono tnum text-[var(--color-fg-dim)]">
                        {pendingShareCents + accruingShareCents > 0
                          ? money(pendingShareCents + accruingShareCents)
                          : "—"}
                      </td>
                      <td className="px-5 py-3 align-middle text-right">
                        {m.billing_view_token ? (
                          <a
                            href={`/share/${m.billing_view_token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-accent)] hover:underline underline-offset-2"
                          >
                            View dashboard
                            <svg viewBox="0 0 20 20" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </a>
                        ) : (
                          <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border-soft)] text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
            Invoice ledger
          </div>
          {earnings.invoices.length === 0 && earnings.accruing.length === 0 ? (
            <div className="px-5 py-8 text-[13px] text-[var(--color-fg-dim)]">
              No invoices yet — your brands are still in their test or pre-billing phase. Your cut
              starts accruing the moment their first invoice is collected.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-[12.5px]">
                <thead className="text-[9.5px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)] border-b border-[var(--color-border-soft)]">
                  <tr>
                    <th className="text-left px-5 py-2.5 font-medium">Brand</th>
                    <th className="text-left px-3 py-2.5 font-medium">Period</th>
                    <th className="text-left px-3 py-2.5 font-medium">Status</th>
                    <th className="text-right px-3 py-2.5 font-medium">Invoice</th>
                    <th className="text-right px-5 py-2.5 font-medium">Your cut</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.accruing.map((a) => (
                    <tr key={`accruing-${a.merchant_id}`} className="border-b border-[var(--color-border-soft)]/60 last:border-b-0">
                      <td className="px-5 py-3 align-middle font-medium tracking-tight">
                        {merchantNames.get(a.merchant_id) ?? a.merchant_id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-3 align-middle font-mono text-[11px] text-[var(--color-fg-dim)] whitespace-nowrap">
                        {fmtDate(a.periodStart)} → {fmtDate(a.periodEnd)}
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span className="pill pill-info">ACCRUING</span>
                      </td>
                      <td className="px-3 py-3 align-middle text-right font-mono tnum text-[var(--color-fg-dim)]">
                        {money(a.totalCents)}
                        <span className="ml-1 text-[10px] text-[var(--color-fg-muted)]">est.</span>
                      </td>
                      <td className="px-5 py-3 align-middle text-right font-mono tnum font-semibold">
                        {money(a.shareCents)}
                        <span className="ml-1.5 text-[10px] text-[var(--color-fg-muted)]">
                          ({a.effectivePct}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                  {earnings.invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-[var(--color-border-soft)]/60 last:border-b-0">
                      <td className="px-5 py-3 align-middle font-medium tracking-tight">
                        {merchantNames.get(inv.merchant_id) ?? inv.merchant_id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-3 align-middle font-mono text-[11px] text-[var(--color-fg-dim)] whitespace-nowrap">
                        {fmtDate(inv.period_start)} → {fmtDate(inv.period_end)}
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span className={inv.status === "paid" ? "pill pill-success" : "pill pill-warn"}>
                          {inv.status === "paid" ? "COLLECTED" : "IN FLIGHT"}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-middle text-right font-mono tnum text-[var(--color-fg-dim)]">
                        {money(inv.total_cents)}
                      </td>
                      <td className="px-5 py-3 align-middle text-right font-mono tnum font-semibold">
                        <span className={inv.status === "paid" ? "text-[var(--color-success)]" : ""}>
                          {money(inv.shareCents)}
                        </span>
                        <span className="ml-1.5 text-[10px] text-[var(--color-fg-muted)]">
                          ({inv.effectivePct}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-[11px] font-mono text-[var(--color-fg-muted)] leading-relaxed">
          Your share is computed on collected (paid) invoices only. ACCRUING rows are live estimates
          of the brand&apos;s currently open billing period — the same math their next invoice will
          use — and move with performance until the period closes. In-flight invoices settle into
          &quot;Earned&quot; once collected; voided invoices never count. Questions or payouts:
          hi@getescapehatch.com.
        </p>
      </div>
    </div>
  );
}
