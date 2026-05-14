import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const admin = getSupabaseAdmin();
  const since24 = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [merchantsRes, events24Res, purchases24Res] = await Promise.all([
    admin!.from("merchants").select("id, name, created_at", { count: "exact" }),
    admin!.from("escape_events").select("merchant_id, event_type", { count: "exact", head: false }).gte("created_at", since24),
    admin!.from("escape_events").select("value_cents", { head: false }).eq("event_type", "purchase").gte("created_at", since24),
  ]);

  const merchantCount = merchantsRes.count ?? 0;
  const eventRows = (events24Res.data ?? []) as { merchant_id: string }[];
  const events24 = eventRows.length;
  const liveMerchants = new Set(eventRows.map((e) => e.merchant_id)).size;
  const purchaseRows = (purchases24Res.data ?? []) as { value_cents: number | null }[];
  const purchases24 = purchaseRows.length;
  const revenue24 = purchaseRows.reduce((sum, r) => sum + (r.value_cents ?? 0), 0);

  // Most recent merchants
  const recent = ((merchantsRes.data as { id: string; name: string | null; created_at: string }[]) ?? [])
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);

  return (
    <div className="space-y-7">
      <div>
        <div className="eyebrow">Admin · Overview</div>
        <h1 className="mt-2 h-display text-[28px] tracking-tight">Operator dashboard</h1>
        <p className="mt-1 text-[13px] text-[var(--color-fg-dim)] max-w-xl">
          Bird&apos;s-eye view of the platform. Manage merchants, troubleshoot installs, and run diagnostics from the sidebar.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Merchants" value={merchantCount.toString()} />
        <Stat label="Live (24h)" value={liveMerchants.toString()} sub={`${events24} events`} />
        <Stat label="Purchases (24h)" value={purchases24.toString()} />
        <Stat label="Revenue (24h)" value={`$${(revenue24 / 100).toFixed(0)}`} mono />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Card href="/admin/merchants" title="Merchants" desc="Create, rename, configure shopify domain, view-as, claim, delete." cta="Manage merchants →" />
        <Card href="/admin/guides" title="Guides" desc="Install gotchas, cache busting, kill switch, paid-only mode, pixel + webhook setup." cta="Open guides →" />
        <Card href="/admin/diagnostics" title="Diagnostics" desc="Live config snapshot per merchant — kill switch state, paid-only, last event, webhook routing." cta="Run diagnostics →" />
        <Card href="/dashboard" title="My dashboard" desc="Jump back to the operator-side dashboard (impersonate via the workspace switcher)." cta="Back to dashboard →" />
      </div>

      {recent.length > 0 ? (
        <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border-soft)] flex items-center justify-between">
            <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
              Recent merchants
            </div>
            <Link href="/admin/merchants" className="text-[11px] font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
              all →
            </Link>
          </div>
          <ul>
            {recent.map((m) => (
              <li key={m.id} className="px-5 py-2.5 border-b border-[var(--color-border-soft)] last:border-b-0 flex items-center justify-between gap-3 text-[12.5px]">
                <span className="font-medium truncate">{m.name ?? "(unnamed)"}</span>
                <span className="text-[10.5px] font-mono text-[var(--color-fg-muted)] tnum">
                  {new Date(m.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, sub, mono }: { label: string; value: string; sub?: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">{label}</div>
      <div className={`mt-1 text-[22px] tracking-tight ${mono ? "font-mono tnum" : "font-semibold"}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-[10.5px] font-mono text-[var(--color-fg-muted)]">{sub}</div> : null}
    </div>
  );
}

function Card({ href, title, desc, cta }: { href: string; title: string; desc: string; cta: string }) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5 hover:border-[var(--color-border)] transition-colors group"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[14px] font-semibold tracking-tight">{title}</div>
      </div>
      <p className="mt-1.5 text-[12.5px] text-[var(--color-fg-dim)] leading-relaxed">{desc}</p>
      <div className="mt-3 text-[11.5px] font-mono text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)] transition-colors">
        {cta}
      </div>
    </Link>
  );
}
