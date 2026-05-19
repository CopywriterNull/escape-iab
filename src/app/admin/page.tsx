import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const admin = getSupabaseAdmin();

  const [merchantsRes, platformRes] = await Promise.all([
    admin!.from("merchants").select("id, name, created_at"),
    admin!.rpc("eh_admin_platform_24h"),
  ]);

  const platform = Array.isArray(platformRes.data)
    ? (platformRes.data[0] as {
        merchant_count: number | string;
        events_24h: number | string;
        live_merchants_24h: number | string;
        purchases_24h: number | string;
        revenue_cents_24h: number | string;
      } | undefined)
    : undefined;

  const merchantCount = toInt(platform?.merchant_count) || ((merchantsRes.data as unknown[] | null) ?? []).length;
  const events24 = toInt(platform?.events_24h);
  const liveMerchants = toInt(platform?.live_merchants_24h);
  const purchases24 = toInt(platform?.purchases_24h);
  const revenue24 = toInt(platform?.revenue_cents_24h);

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
        <Card href="/admin/performance" title="Performance" desc="Revenue-per-visitor lift, projected delta, and exec notes across all brands." cta="Review performance →" />
        <Card href="/admin/health" title="Health center" desc="Install, pixel, webhook, and recent IG activity status for every merchant." cta="Check installs →" />
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

function toInt(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
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
