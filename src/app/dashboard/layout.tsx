import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMerchant } from "@/lib/db";
import { supabaseConfigured, getSupabaseServer } from "@/lib/supabase/server";
import { brand } from "@/lib/branding";
import { signOut } from "@/app/actions/auth";
import { TabStrip } from "./_components/tab-strip";

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

  const merchant = await getCurrentMerchant();

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)]">
      {/* Top nav — sticky, Vercel-style */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-border-soft)] bg-[var(--color-bg)]/85 backdrop-blur">
        {/* Row 1: brand mark + breadcrumb + status + user */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 focus-ring rounded-md shrink-0"
            >
              <span aria-hidden className="inline-flex size-5 items-center justify-center rounded-md bg-[var(--color-accent)]">
                <svg viewBox="0 0 24 24" className="size-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 4h6v6" />
                  <path d="M20 4l-8 8" />
                  <path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
                </svg>
              </span>
              <span className="text-[13.5px] font-semibold tracking-tight">{brand.name}</span>
            </Link>
            {merchant?.name ? (
              <>
                <span className="text-[var(--color-fg-muted)] text-[13px] select-none">/</span>
                <span className="text-[13px] font-medium truncate" title={merchant.name}>
                  {merchant.name}
                </span>
                {merchant.domain ? (
                  <span className="hidden sm:inline text-[11.5px] font-mono text-[var(--color-fg-muted)] truncate">
                    · {merchant.domain}
                  </span>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-mono ${
                merchant?.ab_enabled
                  ? "border-[var(--color-border-soft)] text-[var(--color-fg-dim)] bg-[var(--color-bg-elev)]/40"
                  : "border-[var(--color-border-soft)] text-[var(--color-fg-muted)] bg-[var(--color-bg-elev)]/40"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  merchant?.ab_enabled ? "bg-[var(--color-success)] pulse-ring" : "bg-[var(--color-fg-muted)]"
                }`}
              />
              {merchant?.ab_enabled ? "A/B running" : "A/B off"}
            </span>
            <span className="hidden md:inline-flex items-center gap-1.5 text-[12px] text-[var(--color-fg-dim)] max-w-[180px] truncate" title={user.email ?? ""}>
              <span className="size-5 rounded-full bg-[var(--color-accent)]/15 grid place-items-center text-[10.5px] font-semibold text-[var(--color-accent)] shrink-0">
                {user.email?.[0]?.toUpperCase() ?? "?"}
              </span>
              <span className="truncate">{user.email}</span>
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-[12px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus-ring rounded-md px-2 py-1 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/* Row 2: tab strip */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <TabStrip />
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">{children}</main>

      {!merchant ? (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-[var(--color-fg-muted)] font-mono">
          Provisioning your merchant record…
        </div>
      ) : null}
    </div>
  );
}
