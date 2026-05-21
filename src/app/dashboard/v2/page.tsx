import Link from "next/link";
import {
  getCurrentMerchant,
  getEnabledDashboardIabKinds,
  getRollups,
  getSourceBreakdown,
  getTestFunnel,
  getUnattributedPurchaseStats,
  zTestTwoProp,
  type DailyRollup,
  type Funnel,
  type IabKind,
  type SourceRow,
} from "@/lib/db";
import { PixelIcon } from "@/components/PixelIcon";
import { PorscheMeter } from "../_components/porsche-meter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Range = { key: string; label: string; days: number };
type SearchParams = Promise<{ range?: string }>;

const RANGES: Range[] = [
  { key: "1h", label: "1h", days: 1 / 24 },
  { key: "6h", label: "6h", days: 6 / 24 },
  { key: "1d", label: "24h", days: 1 },
  { key: "7d", label: "7d", days: 7 },
  { key: "14d", label: "14d", days: 14 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
];

const compactNF = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function parseRange(value: string | undefined): Range {
  return RANGES.find((range) => range.key === value) ?? RANGES[4];
}

function fmtCompact(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) < 10_000) return value.toLocaleString();
  return compactNF.format(value);
}

function fmtUSD(value: number, compact = false): string {
  if (!Number.isFinite(value)) return "-";
  if (compact && Math.abs(value) >= 10_000) return `$${compactNF.format(value)}`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;
}

function platformLabel(kind: IabKind): string {
  switch (kind) {
    case "instagram":
      return "Instagram";
    case "threads":
      return "Threads";
    case "facebook":
      return "Facebook";
    case "messenger":
      return "Messenger";
    case "discord":
      return "Discord";
    default:
      return kind;
  }
}

function metricColor(value: number | null): string {
  if (value == null) return "text-[var(--color-fg)]";
  if (value > 0) return "text-[var(--color-success)]";
  if (value < 0) return "text-[var(--color-danger)]";
  return "text-[var(--color-fg)]";
}

type DailyIncrement = { day: string; value: number };

function computeDailyIncrementals(rollups: DailyRollup[], days: number): DailyIncrement[] {
  const byDay = new Map<string, { a?: DailyRollup; b?: DailyRollup }>();
  for (const row of rollups) {
    const slot = byDay.get(row.day) ?? {};
    slot[row.bucket] = row;
    byDay.set(row.day, slot);
  }
  const series: DailyIncrement[] = [];
  for (const [day, { a, b }] of byDay) {
    if (!a || !b || a.impressions <= 0 || b.impressions <= 0) {
      series.push({ day, value: 0 });
      continue;
    }
    const rpvA = a.revenue_cents / 100 / a.impressions;
    const rpvB = b.revenue_cents / 100 / b.impressions;
    series.push({ day, value: (rpvA - rpvB) * a.impressions });
  }
  series.sort((x, y) => (x.day < y.day ? -1 : 1));
  return series.slice(-days);
}

function computeCumulativeIncremental(rollups: DailyRollup[]): number {
  const byDay = new Map<string, { a?: DailyRollup; b?: DailyRollup }>();
  for (const row of rollups) {
    const slot = byDay.get(row.day) ?? {};
    slot[row.bucket] = row;
    byDay.set(row.day, slot);
  }
  let total = 0;
  for (const { a, b } of byDay.values()) {
    if (!a || !b) continue;
    if (a.impressions <= 0 || b.impressions <= 0) continue;
    const rpvA = a.revenue_cents / 100 / a.impressions;
    const rpvB = b.revenue_cents / 100 / b.impressions;
    total += (rpvA - rpvB) * a.impressions;
  }
  return total;
}

function summarize(funnel: Funnel) {
  const baseA = funnel.impressions.a;
  const baseB = funnel.impressions.b;
  const totalVisitors = baseA + baseB;
  const revA = funnel.revenue_cents.a / 100;
  const revB = funnel.revenue_cents.b / 100;
  const revenue = revA + revB;
  const purchases = funnel.purchases.a + funnel.purchases.b;
  const rpvA = baseA > 0 ? revA / baseA : null;
  const rpvB = baseB > 0 ? revB / baseB : null;
  const rpvLift = rpvA != null && rpvB != null && rpvB > 0 ? (rpvA - rpvB) / rpvB : null;
  const incrementalRevenue = rpvA != null && rpvB != null ? (rpvA - rpvB) * baseA : null;
  const rolloutIncrementalRevenue =
    rpvA != null && rpvB != null ? (rpvA - rpvB) * totalVisitors : null;
  const cvrA = baseA > 0 ? funnel.purchases.a / baseA : null;
  const cvrB = baseB > 0 ? funnel.purchases.b / baseB : null;
  const z = zTestTwoProp(funnel.purchases.a, baseA, funnel.purchases.b, baseB);
  const confidence = z?.pValue != null ? 1 - z.pValue : null;

  return {
    baseA,
    baseB,
    totalVisitors,
    revA,
    revB,
    revenue,
    purchases,
    rpvA,
    rpvB,
    rpvLift,
    incrementalRevenue,
    rolloutIncrementalRevenue,
    cvrA,
    cvrB,
    confidence,
    significant: z?.significant === true,
  };
}

export default async function DashboardV2({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const merchant = await getCurrentMerchant();

  if (!merchant) {
    return (
      <main className="space-y-3">
        <Panel className="p-5">
          <div className="text-sm text-[var(--color-fg-muted)]">Provisioning merchant record…</div>
        </Panel>
      </main>
    );
  }

  const iabKinds = getEnabledDashboardIabKinds(merchant);
  const cumulativeDays = 365;
  const [funnel, sources, unattributed, rollups] = await Promise.all([
    getTestFunnel(merchant.id, range.days),
    getSourceBreakdown(merchant.id, range.days, 5),
    getUnattributedPurchaseStats(merchant.id, range.days),
    getRollups(merchant.id, cumulativeDays),
  ]);
  const s = summarize(funnel);
  const cumulativeIncremental = computeCumulativeIncremental(rollups);
  const dailySeries = computeDailyIncrementals(rollups, 14);
  const positiveDays = dailySeries.filter((d) => d.value > 0).length;
  const abPct =
    typeof merchant.ab_split_pct === "number" && Number.isFinite(merchant.ab_split_pct)
      ? Math.min(99, Math.max(1, Math.round(merchant.ab_split_pct)))
      : 50;
  const splitLabel = merchant.ab_enabled ? `${abPct}/${100 - abPct}` : "100/0";
  const lift = s.rpvLift;
  const confidencePct = s.confidence == null ? null : Math.round(s.confidence * 100);
  const liftTone = metricColor(lift);

  const phase: "testing" | "ready" | "rolled_out" = !merchant.ab_enabled
    ? "rolled_out"
    : s.significant && (s.rpvLift ?? 0) > 0
      ? "ready"
      : "testing";

  return (
    <main className="space-y-3">
      {/* Tight header: just merchant + range pills + nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-[12px] font-mono text-[var(--color-fg-muted)] truncate">
          {merchant.name ?? merchant.domain ?? "Merchant"}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangePills active={range.key} />
          <Link
            href={`/dashboard/v3?range=${range.key}`}
            className="inline-flex h-8 items-center rounded-md border border-[var(--color-success)]/25 bg-[var(--color-success)]/8 px-3 text-[11.5px] font-mono text-[var(--color-success)] hover:bg-[var(--color-success)]/12 focus-ring"
          >
            v3 board
          </Link>
          <Link
            href={`/dashboard?range=${range.key}`}
            className="inline-flex h-8 items-center rounded-md border border-[var(--color-border-soft)] px-3 text-[11.5px] font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus-ring"
          >
            Classic
          </Link>
        </div>
      </div>

      {/* Hero — % lift on the left, $ realized on the right, sparkline footer */}
      <Panel className="px-6 py-8 md:px-10 md:py-12">
        <div className="text-[11px] font-mono text-[var(--color-fg-muted)] tnum">
          <span className={merchant.escape_enabled === false ? "text-[var(--color-warn)]" : "text-[var(--color-success)]"}>
            {merchant.escape_enabled === false ? "Paused" : "Live"}
          </span>
          {"  ·  "}
          {splitLabel}
          {"  ·  "}
          {iabKinds.map(platformLabel).join(" + ")}
          {"  ·  last "}
          {range.label}
        </div>

        <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-4">
          <div>
            <div
              className={`text-[64px] leading-none tracking-tight font-semibold tnum md:text-[96px] ${liftTone}`}
            >
              {fmtPct(lift)}
            </div>
            <div className="mt-3 text-[12px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
              RPV lift
            </div>
            <div className="mt-1 text-[12.5px] font-mono text-[var(--color-fg-muted)] tnum">
              {confidencePct == null
                ? "Collecting"
                : `${confidencePct}% confidence${s.significant ? "" : " (not yet significant)"}`}
            </div>
          </div>

          <div className="md:text-right">
            <div
              className={`text-[44px] leading-none tracking-tight font-semibold tnum md:text-[64px] ${metricColor(cumulativeIncremental)}`}
            >
              {fmtUSD(cumulativeIncremental, true)}
            </div>
            <div className="mt-3 text-[12px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
              Realized
            </div>
            <div className="mt-1 text-[12.5px] font-mono text-[var(--color-fg-muted)] tnum">since launch</div>
          </div>
        </div>

        {dailySeries.some((d) => d.value !== 0) ? (
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-[var(--color-border-soft)] pt-4">
            <DailyLiftSparkline series={dailySeries} />
            <div className="text-[11px] font-mono text-[var(--color-fg-muted)] tnum">
              daily lift · {positiveDays}/{dailySeries.length} days positive
            </div>
          </div>
        ) : null}
      </Panel>

      {/* Supporting detail — collapsed by default, native disclosure, no JS */}
      <details className="group rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)] open:bg-transparent open:border-transparent open:p-0 [&>summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-[11.5px] font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus-ring rounded-md">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block transition-transform group-open:rotate-90">▸</span>
            Show supporting detail
          </span>
        </summary>

        <div className="mt-3 space-y-3">
          <PhaseStrip phase={phase} splitLabel={splitLabel} significant={s.significant} />

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Panel className="p-4">
              <SectionTitle title="A/B buckets" subtitle={`Last ${range.label}`} />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <BucketCard label="A escape" visitors={s.baseA} revenue={s.revA} rpv={s.rpvA} cvr={s.cvrA} active />
                <BucketCard label="B holdout" visitors={s.baseB} revenue={s.revB} rpv={s.rpvB} cvr={s.cvrB} />
              </div>
              <div className="mt-3 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)]/50 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[var(--color-fg-muted)]">
                  Attribution gap
                </div>
                <div className="mt-1 text-[16px] font-semibold tnum">
                  {unattributed.count.toLocaleString()} purchases · {fmtUSD(unattributed.revenue_cents / 100, true)}
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">not joined to the test population</div>
              </div>
            </Panel>

            <PorscheMeter
              incrementalRevenue={s.incrementalRevenue}
              rolloutIncrementalRevenue={s.rolloutIncrementalRevenue}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard label="Visitors" value={fmtCompact(s.totalVisitors)} sub={`A ${fmtCompact(s.baseA)} / B ${fmtCompact(s.baseB)}`} icon="eye" />
            <MetricCard label="Revenue" value={fmtUSD(s.revenue, true)} sub={`${s.purchases.toLocaleString()} purchases`} icon="cart" />
            <MetricCard label="RPV" value={fmtUSD(s.totalVisitors > 0 ? s.revenue / s.totalVisitors : 0)} sub={`A ${fmtUSD(s.rpvA ?? 0)} / B ${fmtUSD(s.rpvB ?? 0)}`} icon="dollar" />
            <MetricCard label="Escapes" value={fmtCompact(funnel.escape_attempts.a)} sub="bucket A opens" icon="bolt" />
          </div>

          <Panel className="p-4">
            <SectionTitle title="Source mix" subtitle={`Last ${range.label}`} />
            <div className="mt-3 space-y-2">
              {sources.length > 0 ? (
                sources.map((source) => <SourceLine key={source.utm_source} source={source} />)
              ) : (
                <div className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)]/40 p-3 text-[12px] text-[var(--color-fg-muted)]">
                  No source rows yet.
                </div>
              )}
            </div>
          </Panel>
        </div>
      </details>
    </main>
  );
}

function RangePills({ active }: { active: string }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] p-[3px] text-[12px]">
      {RANGES.map((range) => {
        const selected = active === range.key;
        return (
          <Link
            key={range.key}
            href={`/dashboard/v2?range=${range.key}`}
            scroll={false}
            className={`rounded-full px-2.5 py-[5px] font-mono tnum focus-ring ${
              selected
                ? "bg-[var(--color-bg)] text-[var(--color-fg)] shadow-[0_0_0_1px_var(--color-border-soft)_inset]"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            {range.label}
          </Link>
        );
      })}
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)] ${className}`}>
      {children}
    </section>
  );
}

function DailyLiftSparkline({ series }: { series: DailyIncrement[] }) {
  const w = 200;
  const h = 36;
  const padX = 2;
  const padY = 4;
  const values = series.map((d) => d.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const points = values.map((v, i) => {
    const x = padX + (i * (w - padX * 2)) / Math.max(1, values.length - 1);
    const y = padY + (1 - (v - min) / span) * (h - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lastValue = values[values.length - 1] ?? 0;
  const zeroY = padY + (1 - (0 - min) / span) * (h - padY * 2);
  const stroke =
    lastValue > 0
      ? "var(--color-success)"
      : lastValue < 0
        ? "var(--color-danger)"
        : "var(--color-fg-muted)";

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      role="img"
      aria-label="Daily incremental revenue trend"
      className="shrink-0"
    >
      <line
        x1={padX}
        x2={w - padX}
        y1={zeroY}
        y2={zeroY}
        stroke="var(--color-border-soft)"
        strokeDasharray="2 2"
        strokeWidth={1}
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.length > 0 ? (
        <circle
          cx={Number(points[points.length - 1].split(",")[0])}
          cy={Number(points[points.length - 1].split(",")[1])}
          r={2}
          fill={stroke}
        />
      ) : null}
    </svg>
  );
}

function PhaseStrip({
  phase,
  splitLabel,
  significant,
}: {
  phase: "testing" | "ready" | "rolled_out";
  splitLabel: string;
  significant: boolean;
}) {
  const steps: { key: "testing" | "ready" | "rolled_out"; label: string; helper: string }[] = [
    { key: "testing", label: "Testing", helper: `Live A/B · ${splitLabel}` },
    { key: "ready", label: "Ready to graduate", helper: significant ? "Significant · positive lift" : "Awaiting significance" },
    { key: "rolled_out", label: "Rolled out", helper: "100% escape · use locked baseline" },
  ];
  const activeIndex = steps.findIndex((step) => step.key === phase);

  return (
    <Panel className="p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
        Rollout phase
      </div>
      <ol className="mt-2 grid gap-2 sm:grid-cols-3">
        {steps.map((step, idx) => {
          const isActive = idx === activeIndex;
          const isPast = idx < activeIndex;
          const tone = isActive
            ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 text-[var(--color-fg)]"
            : isPast
              ? "border-[var(--color-success)]/25 bg-[var(--color-success)]/8 text-[var(--color-fg-dim)]"
              : "border-[var(--color-border-soft)] bg-[var(--color-bg)]/40 text-[var(--color-fg-muted)]";
          const dot = isActive
            ? "bg-[var(--color-accent)]"
            : isPast
              ? "bg-[var(--color-success)]"
              : "bg-[var(--color-fg-muted)]/40";
          return (
            <li key={step.key} className={`rounded-md border px-3 py-2 ${tone}`}>
              <div className="flex items-center gap-2">
                <span className={`size-1.5 rounded-full ${dot}`} aria-hidden />
                <span className="text-[10.5px] uppercase tracking-[0.16em] font-semibold">
                  {idx + 1} · {step.label}
                </span>
              </div>
              <div className="mt-1 text-[11.5px] font-mono tnum">{step.helper}</div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function BucketCard({
  label,
  visitors,
  revenue,
  rpv,
  cvr,
  active = false,
}: {
  label: string;
  visitors: number;
  revenue: number;
  rpv: number | null;
  cvr: number | null;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        active
          ? "border-[var(--color-success)]/25 bg-[var(--color-success)]/8"
          : "border-[var(--color-border-soft)] bg-[var(--color-bg)]/45"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--color-fg-muted)]">
        {label}
      </div>
      <div className="mt-2 text-[18px] font-semibold tnum">{fmtCompact(visitors)}</div>
      <div className="mt-1 space-y-0.5 text-[10.5px] text-[var(--color-fg-muted)] tnum">
        <div>{fmtUSD(revenue, true)} revenue</div>
        <div>{fmtUSD(rpv ?? 0)} RPV</div>
        <div>{((cvr ?? 0) * 100).toFixed(2)}% CVR</div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: "dollar" | "eye" | "bolt" | "cart";
}) {
  return (
    <Panel className="p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[var(--color-fg-muted)]">
          {label}
        </div>
        <PixelIcon name={icon} size={12} className="text-[var(--color-fg-muted)]" />
      </div>
      <div className="mt-2 text-[22px] font-semibold tracking-tight tnum">{value}</div>
      <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)] tnum">{sub}</div>
    </Panel>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
      <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">{subtitle}</p>
    </div>
  );
}

function SourceLine({ source }: { source: SourceRow }) {
  const aShare = source.total > 0 ? source.bucket_a / source.total : 0;
  return (
    <div className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)]/45 p-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 truncate text-[12px] font-medium">{source.utm_source || "unknown"}</div>
        <div className="shrink-0 text-[11px] font-mono text-[var(--color-fg-muted)] tnum">
          {fmtCompact(source.total)}
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border-soft)]">
        <div className="h-full rounded-full bg-[var(--color-success)]" style={{ width: `${Math.round(aShare * 100)}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-mono text-[var(--color-fg-muted)] tnum">
        <span>A {source.bucket_a.toLocaleString()}</span>
        <span>{fmtUSD(source.revenue_cents / 100, true)}</span>
      </div>
    </div>
  );
}
