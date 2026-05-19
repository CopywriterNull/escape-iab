import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMerchant, getImpersonationStatus } from "@/lib/db";
import { supabaseConfigured, getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";
import { brand } from "@/lib/branding";
import { signOut } from "@/app/actions/auth";
import { stopImpersonating } from "@/app/actions/admin";
import { SidebarNav } from "./_components/sidebar-nav";
import { MerchantSwitcher, type SwitcherRow } from "./_components/merchant-switcher";
import { PixelIcon } from "@/components/PixelIcon";

const ADMIN_EMAIL = "lennyhuynh526@gmail.com";

type LiveRow = {
  event_type: string;
  value_cents: number | null;
  created_at: string;
};

async function getRecentForSidebar(merchantId: string, limit = 3): Promise<LiveRow[]> {
  const supabase = getSupabaseAdmin() ?? (await getSupabaseServer());
  if (!supabase) return [];
  const { data } = await supabase
    .from("escape_events")
    .select("event_type, value_cents, created_at")
    .eq("merchant_id", merchantId)
    .in("event_type", ["purchase", "escape_attempt", "checkout_started"])
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as LiveRow[];
}

function ago(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const delta = Math.max(0, Date.now() - t);
  const s = Math.floor(delta / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseConfigured) {
    return (
      <div className="min-h-dvh grid place-items-center px-5">
        <div className="max-w-md card-hi p-8">
          <h1 className="text-xl font-semibold tracking-tight">Backend not configured</h1>
          <p className="mt-2 text-sm text-[var(--color-fg-dim)]">
            Set <code className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_URL</code> and friends in your env to enable the dashboard.
          </p>
          <Link href="/" className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--color-accent)] link-grow">
            Back to home →
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase!.auth.getUser();
  if (!user) redirect("/login");
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const adminClient = isAdmin ? getSupabaseAdmin() : null;

  // Parallelize the four independent fetches that previously ran serial
  // on every dashboard navigation. Live activity still depends on merchant
  // so it's chained inside the same promise — the chain still runs in
  // parallel with the impersonation + switcher fetches. Cuts ~4 round
  // trips down to ~2.
  const [merchantAndLive, impersonation, switcherDataRaw] = await Promise.all([
    (async () => {
      const merchant = await getCurrentMerchant();
      const live = merchant ? await getRecentForSidebar(merchant.id, 3) : [];
      return { merchant, live };
    })(),
    getImpersonationStatus(),
    adminClient
      ? adminClient
          .from("merchants")
          .select("id, name, domain, user_id, created_at")
          .order("created_at", { ascending: true })
          .then((r: { data: unknown }) => r.data)
      : Promise.resolve(null),
  ]);
  const { merchant, live } = merchantAndLive;
  const impersonationMismatch =
    impersonation.active && merchant?.id && impersonation.merchant?.id
      ? merchant.id !== impersonation.merchant.id
      : false;

  const switcherRows: SwitcherRow[] = (
    (switcherDataRaw ?? []) as { id: string; name: string | null; domain: string | null; user_id: string | null }[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    domain: r.domain,
    ownedByMe: r.user_id === user.id,
  }));

  return (
    <>
      {/* Impersonation banner — flows above the layout when admin is viewing as another merchant */}
      {impersonation.active ? (
        <div className="bg-[var(--color-accent)] text-white px-4 py-1.5 flex items-center justify-between gap-3 text-[12px] font-mono sticky top-0 z-50">
          <span className="inline-flex items-center gap-2 min-w-0">
            <span className="size-1.5 rounded-full bg-white animate-pulse shrink-0" />
            <span>VIEWING AS</span>
            <strong className="font-semibold truncate">{impersonation.merchant?.name ?? "merchant"}</strong>
            <span className="opacity-70 truncate hidden sm:inline">· {impersonation.merchant?.domain ?? ""}</span>
            <span className="opacity-70 truncate hidden md:inline">· {impersonation.merchant?.id ?? ""}</span>
          </span>
          <form action={stopImpersonating}>
            <button
              type="submit"
              className="text-white/90 hover:text-white underline decoration-white/50 hover:decoration-white px-2 py-0.5 whitespace-nowrap"
            >
              Exit →
            </button>
          </form>
        </div>
      ) : null}
      <div className="min-h-dvh flex flex-col md:flex-row bg-[var(--color-bg)] text-[var(--color-fg)]">
      {impersonationMismatch ? (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100vw-24px)] rounded-lg border border-[var(--color-danger)]/50 bg-[var(--color-danger-soft)] px-4 py-2 text-[12px] font-mono text-[var(--color-danger)] shadow-lg">
          Merchant mismatch: current {merchant?.id} but impersonation cookie points to {impersonation.merchant?.id}. Exit impersonation and re-enter before editing.
        </div>
      ) : null}
      {/* ─── Desktop sidebar ─── */}
      <aside className="hidden md:flex w-[220px] shrink-0 flex-col border-r border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/30 sticky top-0 h-dvh z-30">
        {/* Brand */}
        <div className="h-12 px-4 flex items-center gap-2 border-b border-[var(--color-border-soft)]">
          <Link href="/dashboard" className="flex items-center gap-2 focus-ring rounded-md shrink-0">
            <span aria-hidden className="inline-flex size-5 items-center justify-center rounded-md bg-[var(--color-accent)]">
              <PixelIcon name="arrow-up-right" size={12} className="text-white" />
            </span>
            <span className="text-[13.5px] font-semibold tracking-tight">{brand.name}</span>
          </Link>
        </div>

        {/* Workspace nav */}
        <div className="px-3 pt-4 pb-1.5 text-[10px] uppercase tracking-[0.12em] font-mono text-[var(--color-fg-muted)] font-medium">
          Workspace
        </div>
        <SidebarNav />

        {/* Test status card */}
        <div className="mt-5 mx-3 px-3 py-2.5 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-card)]">
          <div className="text-[10px] uppercase tracking-[0.1em] font-mono text-[var(--color-fg-muted)] font-medium">
            Test status
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px]">
            <span
              className={`size-1.5 rounded-full ${
                merchant?.ab_enabled ? "bg-[var(--color-success)] pulse-ring" : "bg-[var(--color-fg-muted)]"
              }`}
            />
            {merchant?.ab_enabled ? "A/B 50/50" : "A/B off"}
          </div>
          {merchant?.domain ? (
            <div className="mt-1 text-[10.5px] font-mono text-[var(--color-fg-muted)] truncate">
              {merchant.domain}
            </div>
          ) : null}
          {merchant?.id ? (
            <div className="mt-1 text-[10px] font-mono text-[var(--color-fg-muted)] truncate" title={merchant.id}>
              {merchant.id.slice(0, 8)}…
            </div>
          ) : null}
        </div>

        {/* Live activity preview */}
        {live.length > 0 ? (
          <>
            <div className="mt-5 px-3 pb-1.5 text-[10px] uppercase tracking-[0.12em] font-mono text-[var(--color-fg-muted)] font-medium">
              Live
            </div>
            <div className="px-3 space-y-1.5 text-[11.5px]">
              {live.map((row, i) => {
                const icon =
                  row.event_type === "purchase"
                    ? ("dollar" as const)
                    : row.event_type === "escape_attempt"
                      ? ("bolt" as const)
                      : ("cart" as const);
                const iconClass =
                  row.event_type === "purchase"
                    ? "text-[var(--color-success)]"
                    : row.event_type === "escape_attempt"
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-fg-muted)]";
                const label =
                  row.event_type === "purchase" && row.value_cents != null
                    ? `$${(row.value_cents / 100).toFixed(0)}`
                    : row.event_type === "escape_attempt"
                      ? "Escape"
                      : "Checkout";
                return (
                  <div key={i} className="flex items-center gap-1.5 text-[var(--color-fg-dim)]">
                    <PixelIcon name={icon} size={11} className={iconClass} />
                    <span className="font-mono tnum">
                      {label} · {ago(row.created_at)} ago
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        <div className="mt-auto" />

        {/* User pill */}
        <div className="px-3 py-3 border-t border-[var(--color-border-soft)]">
          <div className="px-1 pb-2 flex items-center gap-2 min-w-0">
            <span className="size-6 rounded-full bg-[var(--color-accent)]/15 grid place-items-center text-[10px] font-semibold text-[var(--color-accent)] shrink-0">
              {user.email?.[0]?.toUpperCase() ?? "?"}
            </span>
            <div className="min-w-0">
              <div className="text-[11.5px] truncate" title={user.email ?? ""}>
                {user.email}
              </div>
              <div className="text-[10px] font-mono text-[var(--color-fg-muted)]">prod</div>
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full text-left text-[11.5px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus-ring rounded-md px-2 py-1 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* ─── Mobile top bar ─── */}
      <header className="md:hidden sticky top-0 z-30 border-b border-[var(--color-border-soft)] bg-[var(--color-bg)]/95 backdrop-blur">
        <div className="px-4 h-12 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight text-[14px]">
            <span aria-hidden className="inline-flex size-5 items-center justify-center rounded-md bg-[var(--color-accent)]">
              <PixelIcon name="arrow-up-right" size={12} className="text-white" />
            </span>
            {brand.name}
          </Link>
          <div className="flex items-center gap-1 text-[12px]">
            {isAdmin && switcherRows.length > 0 ? (
              <MerchantSwitcher
                current={merchant ? { id: merchant.id, name: merchant.name, domain: merchant.domain } : null}
                rows={switcherRows}
                impersonating={impersonation.active}
              />
            ) : null}
            <nav className="flex items-center gap-1">
              <Link href="/dashboard" className="px-2 py-1 text-[var(--color-fg)] font-medium">Overview</Link>
              <Link href="/dashboard/install" className="px-2 py-1 text-[var(--color-fg-muted)]">Install</Link>
              <Link href="/dashboard/settings" className="px-2 py-1 text-[var(--color-fg-muted)]">Settings</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* ─── Main area ─── */}
      <main className="flex-1 min-w-0">
        {/* Slim desktop top bar — breadcrumb + cmd-K hint */}
        <div className="hidden md:flex items-center justify-between gap-3 px-6 h-11 border-b border-[var(--color-border-soft)] bg-[var(--color-bg)]/85 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center gap-2 text-[12.5px] min-w-0">
            <PixelIcon name="home" size={12} className="text-[var(--color-fg-muted)]" />
            {isAdmin && switcherRows.length > 0 ? (
              <MerchantSwitcher
                current={merchant ? { id: merchant.id, name: merchant.name, domain: merchant.domain } : null}
                rows={switcherRows}
                impersonating={impersonation.active}
              />
            ) : (
              <span className="text-[var(--color-fg-muted)]">{merchant?.name ?? "Workspace"}</span>
            )}
            <span className="text-[var(--color-fg-muted)]">/</span>
            <span className="font-medium">Overview</span>
            {merchant?.domain ? (
              <span className="hidden lg:inline text-[var(--color-fg-muted)] font-mono text-[11px] ml-2 truncate">
                {merchant.domain}
              </span>
            ) : null}
            {merchant?.id ? (
              <span className="hidden xl:inline text-[var(--color-fg-muted)] font-mono text-[11px] truncate" title={merchant.id}>
                {merchant.id.slice(0, 8)}…
              </span>
            ) : null}
          </div>
          <div className="hidden lg:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono text-[var(--color-fg-muted)] bg-[var(--color-bg-elev)]/60 border border-[var(--color-border-soft)]">
            <PixelIcon name="search" size={10} />
            <span>Search</span>
            <span className="ml-2 px-1 py-0.5 rounded bg-[var(--color-card)] text-[var(--color-fg-dim)]">⌘K</span>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5 sm:py-6">{children}</div>
      </main>

      {!merchant ? (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-[var(--color-fg-muted)] font-mono">
          Provisioning your merchant record…
        </div>
      ) : null}
      </div>
    </>
  );
}
