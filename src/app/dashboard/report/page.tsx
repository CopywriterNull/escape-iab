import {
  getCurrentMerchant,
  getSourceBreakdown,
  getTestFunnel,
  getUnattributedPurchaseStats,
} from "@/lib/db";
import { ReportView, parseReportRange } from "./report-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{ range?: string }>;

export default async function ClientReportPage({ searchParams }: { searchParams: SearchParams }) {
  const [sp, merchant] = await Promise.all([searchParams, getCurrentMerchant()]);
  const range = parseReportRange(sp.range);

  if (!merchant) {
    return (
      <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)] p-6">
        <div className="text-[13px] text-[var(--color-fg-dim)]">No merchant yet.</div>
      </div>
    );
  }

  const [funnel, sources, unattributed] = await Promise.all([
    getTestFunnel(merchant.id, range.days),
    getSourceBreakdown(merchant.id, range.days, 6),
    getUnattributedPurchaseStats(merchant.id, range.days),
  ]);

  return (
    <ReportView
      merchant={merchant}
      funnel={funnel}
      sources={sources}
      unattributed={unattributed}
      range={range}
      basePath="/dashboard/report"
    />
  );
}
