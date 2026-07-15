import { getSupabaseAdmin } from "@/lib/supabase/server";
import { MerchantRow, type BillingMerchant } from "./_components/merchant-row";
import { InvoiceCard, type InvoiceRow } from "./_components/invoice-card";

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

  const [merchantsRes, actionableRes, historyRes] = await Promise.all([
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

  const merchants = (merchantsRes.data ?? []) as BillingMerchant[];
  const merchantNames = new Map(merchants.map((m) => [m.id, m.name ?? "(unnamed)"]));

  // "Needs attention" covers invoices awaiting operator review, invoices
  // whose last charge attempt failed, and invoices mid-charge — fetched
  // without a truncating limit so none of them can silently fall off the
  // queue. Settled rows (paid, voided) go to the plain History list below.
  const attention = (actionableRes.data ?? []) as InvoiceRow[];
  const history = (historyRes.data ?? []) as InvoiceRow[];

  return (
    <div className="space-y-7">
      <div>
        <div className="eyebrow">Admin · Billing</div>
        <h1 className="mt-2 h-display text-[28px] tracking-tight">Billing</h1>
        <p className="mt-1 text-[13px] text-[var(--color-fg-dim)] max-w-3xl">
          Merchant billing controls and invoice review — the operator&apos;s click is the approval for every charge.
        </p>
      </div>

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

      <section className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border-soft)]">
          <h2 className="text-[14px] font-semibold tracking-tight">Merchants</h2>
          <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
            Card on file = a Stripe customer with a saved payment method. Starting the performance plan flips the
            A/B split to 90/10 and charges the month-1 base fee (unless waived).
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-[12px]">
            <thead className="text-[9.5px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)] border-b border-[var(--color-border-soft)]">
              <tr>
                <Th>Merchant</Th>
                <Th>Status</Th>
                <Th>Split</Th>
                <Th>Card</Th>
                <Th>Base fee</Th>
                <Th>Rev share</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((m) => (
                <MerchantRow key={m.id} merchant={m} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border-soft)]">
          <h2 className="text-[14px] font-semibold tracking-tight">History</h2>
          <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
            Settled invoices — paid or voided. In-flight charges stay in Pending review until the
            Stripe webhook settles them to paid/failed.
          </div>
        </div>
        {history.length === 0 ? (
          <div className="px-5 py-4 text-[12.5px] text-[var(--color-fg-muted)]">No invoice history yet.</div>
        ) : (
          <div className="overflow-x-auto">
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
      </section>
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
