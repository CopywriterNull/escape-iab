import type { Metadata } from "next";
import {
  getSourceBreakdown,
  getTestFunnel,
  getUnattributedPurchaseStats,
  type Merchant,
} from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { ReportView, parseReportRange } from "@/app/dashboard/report/report-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Public share link — no login. noindex so tokens don't leak into search.
export const metadata: Metadata = {
  title: "EscapeHatch · Live test readout",
  robots: { index: false, follow: false },
};

const TOKEN_RE = /^[a-f0-9]{16,64}$/i;

async function resolveMerchant(token: string): Promise<Merchant | null> {
  if (!TOKEN_RE.test(token)) return null;
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("merchants")
    .select("*")
    .eq("report_token", token)
    .maybeSingle();
  return (data as Merchant | null) ?? null;
}

type Params = Promise<{ token: string }>;
type SearchParams = Promise<{ range?: string }>;

export default async function PublicReportPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const merchant = await resolveMerchant(token);
  const range = parseReportRange(sp.range);

  if (!merchant) {
    return (
      <Shell>
        <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-8 text-center">
          <div className="text-[13px] text-[var(--color-fg-dim)]">
            This report link is invalid or has been revoked.
          </div>
        </div>
      </Shell>
    );
  }

  const [funnel, sources, unattributed] = await Promise.all([
    getTestFunnel(merchant.id, range.days),
    getSourceBreakdown(merchant.id, range.days, 6),
    getUnattributedPurchaseStats(merchant.id, range.days),
  ]);

  return (
    <Shell>
      <ReportView
        merchant={merchant}
        funnel={funnel}
        sources={sources}
        unattributed={unattributed}
        range={range}
        basePath={`/r/${token}`}
        publicView
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)]">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 md:py-12">{children}</div>
    </div>
  );
}
