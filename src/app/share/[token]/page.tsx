import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Merchant } from "@/lib/db";
import { DashboardView } from "@/app/dashboard/page";

export const dynamic = "force-dynamic";

// Tokened, read-only, no-login share of the full merchant dashboard.
// Reuses the merchant's stable billing_view_token (same hex the billing view
// uses), so one link per merchant covers both. All range params work:
// /share/<token>?range=abtest, ?range=plan, ?range=14d, ?funnel=raw, etc.
export default async function SharedDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f]{32}$/i.test(token)) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();
  const { data: m } = await admin
    .from("merchants")
    .select("*")
    .eq("billing_view_token", token)
    .maybeSingle();
  if (!m) notFound();
  const merchant = m as Merchant;

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] grain">
      <header className="border-b border-[var(--color-border-soft)] bg-[var(--color-bg)]/90">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-block size-2 rounded-full bg-[var(--color-accent)]" />
            <span className="text-[13px] font-semibold tracking-tight">Escape Hatch</span>
            <span className="text-[11px] font-mono text-[var(--color-fg-muted)] truncate">
              / {merchant.name ?? "dashboard"}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">
            Read-only
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5 sm:py-6">
        <DashboardView merchant={merchant} sp={sp} basePath={`/share/${token}`} readonly />
      </div>
    </div>
  );
}
