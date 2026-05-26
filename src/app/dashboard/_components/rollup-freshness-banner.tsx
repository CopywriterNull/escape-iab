import type { RollupFreshness } from "@/lib/db";

/**
 * Stale-rollup warning. Renders nothing when rollups are fresh.
 *
 * 24h ranges fall back to live events automatically when rollups are stale —
 * this banner is the operator-facing signal for 7d+ ranges where rollups
 * stay in use (the exact RPC is too slow over multi-day windows).
 */
export function RollupFreshnessBanner({ freshness }: { freshness: RollupFreshness }) {
  if (!freshness.stale) return null;

  const ageLabel = Number.isFinite(freshness.ageHours)
    ? `${freshness.ageHours.toFixed(1)}h`
    : "many hours";

  return (
    <div className="rounded-lg border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 px-4 py-3 text-[12px] text-[var(--color-warn)]">
      <div className="font-semibold tracking-tight">
        Rollups stale — multi-day totals may be missing the last {ageLabel} of traffic.
      </div>
      <div className="mt-1 text-[11px] font-mono text-[var(--color-fg-muted)]">
        Last refresh: {freshness.lastRefresh ?? "never"}. 24h falls back to live events; 7d+ uses
        whatever has been rolled up. Check /api/cron/retention status if this persists.
      </div>
    </div>
  );
}
