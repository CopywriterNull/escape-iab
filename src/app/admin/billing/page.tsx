import { getSupabaseAdmin } from "@/lib/supabase/server";
import { MerchantRow, type BillingMerchant } from "./_components/merchant-row";
import { InvoiceCard, type InvoiceRow } from "./_components/invoice-card";
import { MerchantEarningsCard, StatTile } from "./_components/earnings-section";
import { computeAccruing, fetchEarnings, type AccruingPeriod } from "@/lib/billing/earnings";

export const dynamic = "force-dynamic";

const INVOICE_COLUMNS =
  "id, merchant_id, kind, period_start, period_end, snapshot, base_fee_cents, rev_share_cents, total_cents, edited, note, status, stripe_invoice_id, charge_attempts, created_at, charged_at";

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// ISO date slice — deterministic across server render + client hydration.
function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

export default async function AdminBillingPage() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return <EmptyState title="Service role unavailable" detail="Set SUPABASE_SERVICE_ROLE_KEY to load billing." />;
  }

  const [merchantsRes, actionableRes, historyRes, paidRes] = await Promise.all([
    admin
      .from("merchants")
      .select(
        "id, name, billing_status, billing_anchor, ab_split_pct, stripe_customer_id, card_saved, billing_setup_token, base_fee_cents, base_fee_waived, rev_share_pct",
      )
      .order("name", { ascending: true }),
    // Actionable rows must never be truncated out of view, no matter how
    // much settled history has piled up — hence no limit (500 is a sanity
    // bound, not an expected ceiling).
    admin
      .from("billing_invoices")
      .select(INVOICE_COLUMNS)
      .in("status", ["pending_review", "failed", "charging"])
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("billing_invoices")
      .select(INVOICE_COLUMNS)
      .in("status", ["paid", "voided"])
      .order("created_at", { ascending: false })
      .limit(100),
    // Billed-to-date sums come from ALL paid rows (thin projection, no cap
    // tied to the display list above).
    admin
      .from("billing_invoices")
      .select("merchant_id, rev_share_cents, total_cents")
      .eq("status", "paid")
      .limit(5000),
  ]);

  if (merchantsRes.error) {
    return <EmptyState title="Could not load merchants" detail={merchantsRes.error.message} />;
  }
  if (actionableRes.error) {
    return <EmptyState title="Could not load invoices" detail={actionableRes.error.message} />;
  }
  if (historyRes.error) {
    return <EmptyState title="Could not load invoices" detail={historyRes.error.message} />;
  }
  if (paidRes.error) {
    return <EmptyState title="Could not load invoices" detail={paidRes.error.message} />;
  }

  const merchants = (merchantsRes.data ?? []) as BillingMerchant[];
  const merchantNames = new Map(merchants.map((m) => [m.id, m.name ?? "(unnamed)"]));

  // "Needs attention" covers invoices awaiting operator review, invoices
  // whose last charge attempt failed, and invoices mid-charge — fetched
  // without a truncating limit so none of them can silently fall off the
  // queue. Settled rows (paid, voided) go to the plain History list below.
  const attention = (actionableRes.data ?? []) as InvoiceRow[];
  const history = (historyRes.data ?? []) as InvoiceRow[];

  const billedShare = new Map<string, number>();
  const billedTotal = new Map<string, number>();
  for (const r of paidRes.data ?? []) {
    billedShare.set(r.merchant_id, (billedShare.get(r.merchant_id) ?? 0) + r.rev_share_cents);
    billedTotal.set(r.merchant_id, (billedTotal.get(r.merchant_id) ?? 0) + r.total_cents);
  }

  // Earnings estimates (one RPC) + the real trimmed accruing number per
  // active merchant. Failures degrade to "—" rather than taking the whole
  // billing console down with them.
  let earnings: Awaited<ReturnType<typeof fetchEarnings>> = new Map();
  let earningsError: string | null = null;
  try {
    earnings = await fetchEarnings(
      admin,
      merchants.map((m) => ({ id: m.id, rev_share_pct: Number(m.rev_share_pct) })),
    );
  } catch (e) {
    earningsError = e instanceof Error ? e.message : String(e);
  }

  const actives = merchants.filter((m) => m.billing_status === "active" && m.billing_anchor);
  const accruingByMerchant = new Map<string, AccruingPeriod | null>();
  await Promise.all(
    actives.map(async (m) => {
      try {
        accruingByMerchant.set(
          m.id,
          await computeAccruing(admin, {
            id: m.id,
            billing_anchor: m.billing_anchor as string,
            rev_share_pct: Number(m.rev_share_pct),
            base_fee_cents: m.base_fee_cents,
            base_fee_waived: m.base_fee_waived,
          }),
        );
      } catch {
        accruingByMerchant.set(m.id, null);
      }
    }),
  );

  const accruingNow = actives.reduce(
    (sum, m) => sum + (accruingByMerchant.get(m.id)?.revShareCents ?? 0),
    0,
  );
  const billedShareAll = Array.from(billedShare.values()).reduce((a, b) => a + b, 0);
  const billedTotalAll = Array.from(billedTotal.values()).reduce((a, b) => a + b, 0);
  let est30dAll = 0;
  let estTodayAll = 0;
  for (const e of earnings.values()) {
    est30dAll += e.last30dShareCents;
    estTodayAll += e.todayShareCents;
  }

  // Accordion groups, most actionable first. Active plans and card-saved
  // merchants render expanded; the long tail starts collapsed.
  const hasCard = (m: BillingMerchant) => m.stripe_customer_id != null && m.card_saved;
  const linkSent = (m: BillingMerchant) =>
    !hasCard(m) && (m.stripe_customer_id != null || m.billing_setup_token != null);
  const groups: { title: string; detail: string; open: boolean; rows: BillingMerchant[] }[] = [
    {
      title: "Active plans",
      detail: "Billing live — 90/10 split, monthly invoices drafting on the anchor.",
      open: true,
      rows: merchants.filter((m) => m.billing_status === "active"),
    },
    {
      title: "Card saved — ready to start",
      detail: "Setup complete. Starting the plan flips to 90/10 and charges the base fee.",
      open: true,
      rows: merchants.filter((m) => m.billing_status !== "active" && hasCard(m)),
    },
    {
      title: "Setup link sent",
      detail: "Awaiting the merchant's card via the setup link.",
      open: false,
      rows: merchants.filter((m) => m.billing_status !== "active" && !hasCard(m) && linkSent(m)),
    },
    {
      title: "Not started",
      detail: "No setup link generated yet.",
      open: false,
      rows: merchants.filter((m) => m.billing_status !== "active" && !hasCard(m) && !linkSent(m)),
    },
  ];

  return (
    <div className="space-y-7">
      <div>
        <div className="eyebrow">Admin · Billing</div>
        <h1 className="mt-2 h-display text-[28px] tracking-tight">Billing</h1>
        <p className="mt-1 text-[13px] text-[var(--color-fg-dim)] max-w-3xl">
          Merchant billing controls and invoice review — the operator&apos;s click is the approval for every charge.
        </p>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Accruing now"
          value={money(accruingNow)}
          hint="next invoices, trimmed math"
          accent
        />
        <StatTile
          label="Billed to date"
          value={money(billedTotalAll)}
          hint={`${money(billedShareAll)} of it rev share`}
        />
        <StatTile label="Est. share · 30d" value={money(est30dAll)} hint="all merchants, untrimmed" />
        <StatTile label="Est. share · today" value={money(estTodayAll)} hint="all merchants, untrimmed" />
      </section>

      {earningsError ? (
        <div className="rounded-xl border border-[rgba(245,158,11,0.30)] bg-[rgba(245,158,11,0.10)] px-4 py-3 text-[12px]">
          Earnings estimates unavailable: {earningsError}
        </div>
      ) : null}

      {actives.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-[14px] font-semibold tracking-tight">Earnings</h2>
          <div className="grid gap-3 xl:grid-cols-2">
            {actives.map((m) => {
              const e = earnings.get(m.id);
              if (!e) return null;
              return (
                <MerchantEarningsCard
                  key={m.id}
                  name={m.name ?? "(unnamed)"}
                  earnings={e}
                  accruing={accruingByMerchant.get(m.id) ?? null}
                  billedShareCents={billedShare.get(m.id) ?? 0}
                  billedTotalCents={billedTotal.get(m.id) ?? 0}
                  revSharePct={Number(m.rev_share_pct)}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-semibold tracking-tight">Pending review</h2>
          <span className="pill pill-muted">{attention.length}</span>
        </div>
        {attention.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5 text-[12.5px] text-[var(--color-fg-muted)]">
            No invoices need review right now.
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {attention.map((inv) => (
              <InvoiceCard key={inv.id} invoice={inv} merchantName={merchantNames.get(inv.merchant_id) ?? "(unknown)"} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-[14px] font-semibold tracking-tight">Merchants</h2>
        {groups.map((g) => (
          <details
            key={g.title}
            open={g.open && g.rows.length > 0}
            className="group rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden"
          >
            <summary className="flex items-center justify-between gap-3 px-5 py-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-[var(--color-bg-elev)] transition-colors">
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-mono text-[var(--color-fg-muted)] transition-transform group-open:rotate-90">
                  ▸
                </span>
                <span className="text-[13px] font-semibold tracking-tight">{g.title}</span>
                <span className="pill pill-muted">{g.rows.length}</span>
              </div>
              <span className="hidden sm:block text-[11px] text-[var(--color-fg-muted)]">{g.detail}</span>
            </summary>
            {g.rows.length === 0 ? (
              <div className="px-5 py-4 border-t border-[var(--color-border-soft)] text-[12px] text-[var(--color-fg-muted)]">
                No merchants here.
              </div>
            ) : (
              <div className="overflow-x-auto border-t border-[var(--color-border-soft)]">
                <table className="min-w-[980px] w-full text-left text-[12px]">
                  <thead className="text-[9.5px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)] border-b border-[var(--color-border-soft)]">
                    <tr>
                      <Th>Merchant</Th>
                      <Th>Status</Th>
                      <Th>Split</Th>
                      <Th>Card</Th>
                      <Th>Base fee</Th>
                      <Th>Rev share</Th>
                      <Th>Est. earned</Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((m) => (
                      <MerchantRow
                        key={m.id}
                        merchant={m}
                        estShareSinceStartCents={earnings.get(m.id)?.sinceStartShareCents ?? null}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>
        ))}
        <div className="text-[10.5px] text-[var(--color-fg-muted)]">
          Est. earned = {""}
          rev-share % of incremental revenue since tracking started, untrimmed — directional, not the invoice number.
          Card on file = a Stripe customer with a saved payment method.
        </div>
      </section>

      <details className="group rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-5 py-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-[var(--color-bg-elev)] transition-colors">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-mono text-[var(--color-fg-muted)] transition-transform group-open:rotate-90">
              ▸
            </span>
            <span className="text-[13px] font-semibold tracking-tight">History</span>
            <span className="pill pill-muted">{history.length}</span>
          </div>
          <span className="hidden sm:block text-[11px] text-[var(--color-fg-muted)]">
            Settled invoices — paid or voided. In-flight charges stay in Pending review.
          </span>
        </summary>
        {history.length === 0 ? (
          <div className="px-5 py-4 border-t border-[var(--color-border-soft)] text-[12.5px] text-[var(--color-fg-muted)]">
            No invoice history yet.
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-[var(--color-border-soft)]">
            <table className="min-w-[820px] w-full text-left text-[12px]">
              <thead className="text-[9.5px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)] border-b border-[var(--color-border-soft)]">
                <tr>
                  <Th>Merchant</Th>
                  <Th>Kind</Th>
                  <Th>Period</Th>
                  <Th>Total</Th>
                  <Th>Status</Th>
                  <Th>Charged</Th>
                </tr>
              </thead>
              <tbody>
                {history.map((inv) => (
                  <tr key={inv.id} className="border-b border-[var(--color-border-soft)] last:border-b-0">
                    <Td>{merchantNames.get(inv.merchant_id) ?? "(unknown)"}</Td>
                    <Td>{inv.kind === "plan_start" ? "Plan start" : "Monthly"}</Td>
                    <Td className="font-mono text-[11px]">
                      {fmtDate(inv.period_start)} → {fmtDate(inv.period_end)}
                    </Td>
                    <Td className="font-mono tnum">{money(inv.total_cents)}</Td>
                    <Td>
                      <span
                        className={
                          inv.status === "paid"
                            ? "pill pill-success"
                            : inv.status === "charging"
                              ? "pill pill-info"
                              : "pill pill-muted"
                        }
                      >
                        {inv.status}
                      </span>
                    </Td>
                    <Td className="font-mono text-[11px]">{inv.charged_at ? fmtDate(inv.charged_at) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-6">
      <div className="eyebrow">Admin · Billing</div>
      <h1 className="mt-2 h-display text-[24px] tracking-tight">{title}</h1>
      <p className="mt-2 text-[13px] text-[var(--color-fg-dim)]">{detail}</p>
    </div>
  );
}
