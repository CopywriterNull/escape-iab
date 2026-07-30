import type { AccruingPeriod, MerchantEarnings } from "@/lib/billing/earnings";

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

function fmtDayLabel(day: string): string {
  const [, m, d] = day.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1]} ${Number(d)}`;
}

export function StatTile({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-4 py-3.5">
      <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">{label}</div>
      <div
        className={`mt-1 text-[22px] font-semibold tracking-tight tnum ${accent ? "text-[var(--color-accent)]" : ""}`}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[10.5px] font-mono text-[var(--color-fg-muted)]">{hint}</div> : null}
    </div>
  );
}

/** 30-day single-series bar sparkline of the daily est. rev share. Bars are
 *  thin, baseline-anchored, rounded only at the data end; native <title>
 *  supplies the per-bar hover tooltip. Identity lives in the surrounding
 *  card copy (one series — no legend). */
function DailyBars({ daily }: { daily: MerchantEarnings["daily"] }) {
  const W = 30 * 10 - 2; // 8px bar + 2px surface gap, minus trailing gap
  const H = 56;
  const R = 2; // rounded data-end radius
  const max = Math.max(1, ...daily.map((d) => d.shareCents));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-[56px]"
      role="img"
      aria-label="Daily estimated revenue share, last 30 days"
      preserveAspectRatio="none"
    >
      {daily.map((d, i) => {
        const x = i * 10;
        const h = Math.round((d.shareCents / max) * (H - R - 2));
        const label = `${fmtDayLabel(d.day)} — ${money(d.shareCents)} est. share`;
        if (h <= 0) {
          return (
            <g key={d.day}>
              <title>{label}</title>
              <rect x={x} y={H - 2} width={8} height={2} fill="var(--color-border)" />
            </g>
          );
        }
        const y = H - h;
        return (
          <g key={d.day}>
            <title>{label}</title>
            <path
              d={`M ${x},${y + R} Q ${x},${y} ${x + R},${y} L ${x + 8 - R},${y} Q ${x + 8},${y} ${x + 8},${y + R} L ${x + 8},${H} L ${x},${H} Z`}
              fill="var(--color-accent)"
            />
          </g>
        );
      })}
    </svg>
  );
}

export function MerchantEarningsCard({
  name,
  earnings,
  accruing,
  billedShareCents,
  billedTotalCents,
  revSharePct,
}: {
  name: string;
  earnings: MerchantEarnings;
  accruing: AccruingPeriod | null;
  billedShareCents: number;
  billedTotalCents: number;
  revSharePct: number;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[14px] font-medium tracking-tight">{name}</div>
          <div className="mt-0.5 text-[10.5px] font-mono text-[var(--color-fg-muted)]">
            {earnings.firstTrackedAt
              ? `tracking since ${fmtDate(earnings.firstTrackedAt)}`
              : "no tracked traffic yet"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">
            Accruing this period
          </div>
          <div className="text-[24px] font-semibold tracking-tight tnum text-[var(--color-accent)]">
            {accruing ? money(accruing.revShareCents) : "—"}
          </div>
          {accruing ? (
            <div className="text-[10.5px] font-mono text-[var(--color-fg-muted)]">
              {revSharePct}% of {money(accruing.incrementalCents)} incremental ·{" "}
              {fmtDate(accruing.periodStart)} → {fmtDate(accruing.periodEnd)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-[12px] font-mono">
        <Metric label="today (est.)" value={money(earnings.todayShareCents)} />
        <Metric label="30d (est.)" value={money(earnings.last30dShareCents)} />
        <Metric label="since start (est.)" value={money(earnings.sinceStartShareCents)} />
        <Metric
          label="billed to date"
          value={money(billedShareCents)}
          hint={`${money(billedTotalCents)} incl. base fees`}
        />
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">
            Daily est. share — last 30 days
          </div>
          <div className="text-[10.5px] font-mono text-[var(--color-fg-muted)]">
            incremental 30d: {money(earnings.last30dIncrementalCents)}
          </div>
        </div>
        <div className="mt-2">
          <DailyBars daily={earnings.daily} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-[0.14em] text-[var(--color-fg-muted)]">{label}</div>
      <div className="mt-0.5 tnum text-[13px] text-[var(--color-fg)]">{value}</div>
      {hint ? <div className="text-[9.5px] text-[var(--color-fg-muted)]">{hint}</div> : null}
    </div>
  );
}
