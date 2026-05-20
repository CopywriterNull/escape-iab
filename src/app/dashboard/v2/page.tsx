import Link from "next/link";
import {
  getCurrentMerchant,
  getEnabledDashboardIabKinds,
  getSourceBreakdown,
  getTestFunnel,
  getUnattributedPurchaseStats,
  zTestTwoProp,
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
  if (value == null || !Number.isFinite(value)) return "-";
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
          <div className="text-sm text-[var(--color-fg-muted)]">Provisioning merchant record...</div>
        </Panel>
      </main>
    );
  }

  const iabKinds = getEnabledDashboardIabKinds(merchant);
  const [funnel, sources, unattributed] = await Promise.all([
    getTestFunnel(merchant.id, range.days),
    getSourceBreakdown(merchant.id, range.days, 5),
    getUnattributedPurchaseStats(merchant.id, range.days),
  ]);
  const s = summarize(funnel);
  const abPct =
    typeof merchant.ab_split_pct === "number" && Number.isFinite(merchant.ab_split_pct)
      ? Math.min(99, Math.max(1, Math.round(merchant.ab_split_pct)))
      : 50;
  const splitLabel = merchant.ab_enabled ? `${abPct}/${100 - abPct}` : "100/0";
  const primaryLift = s.rpvLift;
  const incremental = s.incrementalRevenue ?? 0;
  const confidenceLabel =
    s.confidence == null ? "Collecting" : `${Math.round(s.confidence * 100)}% conf`;

  // Rollout phase — derived locally because there's no baseline table yet.
  // Testing: A/B still running; Ready to graduate: A/B running and statistically clean;
  // Rolled out: A/B off, escaping 100% of eligible traffic.
  const phase: "testing" | "ready" | "rolled_out" = !merchant.ab_enabled
    ? "rolled_out"
    : s.significant && (s.rpvLift ?? 0) > 0
      ? "ready"
      : "testing";

  return (
    <main className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
            Client snapshot
          </div>
          <h1 className="mt-1 text-[20px] font-semibold tracking-tight text-[var(--color-fg)]">
            {merchant.name ?? merchant.domain ?? "Merchant"} performance
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangePills active={range.key} />
          <Link
            href={`/dashboard?range=${range.key}`}
            className="inline-flex h-8 items-center rounded-md border border-[var(--color-border-soft)] px-3 text-[11.5px] font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus-ring"
          >
            Classic
          </Link>
        </div>
      </div>

      <PhaseStrip
       phase={phase}
       splitLabel={splitLabel}
       confidenceLabel={confidenceLabel}
       significant={s.significant}
       primaryLift={primaryLift}
       incremental={s.incrementalRevenue}
       rolloutUpside={s.rolloutIncrementalRevenue}
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <Panel className="overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
            <div className="p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={merchant.escape_enabled === false ? "warn" : "success"}>
                  {merchant.escape_enabled === false ? "Paused" : "Live"}
                </Badge>
                <Badge>{iabKinds.map(platformLabel).join(" + ")}</Badge>
                <Badge>{splitLabel} split</Badge>
                <Badge>{merchant.paid_only ? "Paid only" : "Paid + organic"}</Badge>
              </div>

              <div className="mt-5 text-[11px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
                Incremental revenue
              </div>
              <div className={`mt-1 text-[44px] leading-none md:text-[62px] font-semibold tracking-tight tnum ${metricColor(incremental)}`}>
                {fmtUSD(incremental, true)}
              </div>
              <div className="mt-2 max-w-xl text-[13px] text-[var(--color-fg-dim)]">
                Based on A/B revenue per visitor: bucket A escape vs bucket B holdout over the last {range.label}.
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <MiniReadout label="Lift" value={fmtPct(primaryLift)} tone={metricColor(primaryLift)} />
                <MiniReadout label="Confidence" value={confidenceLabel} tone={s.significant ? "text-[var(--color-success)]" : "text-[var(--color-fg)]"} />
                <MiniReadout label="Rollout upside" value={fmtUSD(s.rolloutIncrementalRevenue ?? 0, true)} tone={metricColor(s.rolloutIncrementalRevenue)} />
              </div>
            </div>

            <div className="border-t border-[var(--color-border-soft)] p-4 lg:border-l lg:border-t-0">
              <div className="grid grid-cols-2 gap-2">
                <BucketCard label="A escape" visitors={s.baseA} revenue={s.revA} rpv={s.rpvA} cvr={s.cvrA} active />
                <BucketCard label="B holdout" visitors={s.baseB} revenue={s.revB} rpv={s.rpvB} cvr={s.cvrB} />
              </div>
              <div className="mt-3 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)]/50 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[var(--color-fg-muted)]">
                  Attribution gap
                </div>
                <div className="mt-1 text-[17px] font-semibold tracking-tight tnum">
                  {unattributed.count.toLocaleString()} purchases
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)] tnum">
                  {fmtUSD(unattributed.revenue_cents / 100, true)} not joined to the test population
                </div>
              </div>
            </div>
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

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <SectionTitle title="A/B readout" subtitle="Screenshot-safe proof points" />
            <Badge tone={s.significant ? "success" : "warn"}>
              {s.significant ? "Ready" : "Keep collecting"}
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <ProofTile label="RPV lift" value={fmtPct(s.rpvLift)} helper={`A ${fmtUSD(s.rpvA ?? 0)} vs B ${fmtUSD(s.rpvB ?? 0)}`} tone={metricColor(s.rpvLift)} />
            <ProofTile label="CVR" value={`${((s.cvrA ?? 0) * 100).toFixed(2)}% / ${((s.cvrB ?? 0) * 100).toFixed(2)}%`} helper="A escape / B holdout" />
            <ProofTile label="Revenue delta" value={fmtUSD((s.revA / Math.max(1, s.baseA) - s.revB / Math.max(1, s.baseB)) * s.baseA, true)} helper="realized on escaped traffic" tone={metricColor(s.incrementalRevenue)} />
          </div>
        </Panel>

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

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "success" | "warn" }) {
  const cls =
    tone === "success"
      ? "border-[var(--color-success)]/25 bg-[var(--color-success)]/10 text-[var(--color-success)]"
      : tone === "warn"
        ? "border-[var(--color-warn)]/30 bg-[var(--color-warn)]/10 text-[var(--color-warn)]"
        : "border-[var(--color-border-soft)] bg-[var(--color-bg)]/60 text-[var(--color-fg-muted)]";
  return (
    <span className={`inline-flex h-6 items-center rounded-full border px-2 text-[10.5px] font-mono ${cls}`}>
      {children}
    </span>
  );
}

function MiniReadout({
  label,
  value,
  tone = "text-[var(--color-fg)]",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)]/45 p-2">
      <div className="text-[9.5px] uppercase tracking-[0.14em] font-semibold text-[var(--color-fg-muted)]">
        {label}
      </div>
      <div className={`mt-1 text-[15px] font-semibold tnum ${tone}`}>{value}</div>
    </div>
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

function ProofTile({
  label,
  value,
  helper,
  tone = "text-[var(--color-fg)]",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)]/45 p-3">
      <div className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--color-fg-muted)]">
        {label}
      </div>
      <div className={`mt-2 text-[24px] font-semibold tracking-tight tnum ${tone}`}>{value}</div>
      <div className="mt-1 text-[11px] text-[var(--color-fg-muted)] tnum">{helper}</div>
    </div>
  );
}

function PhaseStrip({
  phase,
  splitLabel,
  confidenceLabel,
  significant,
  primaryLift,
  incremental,
  rolloutUpside,
}: {
  phase: "testing" | "ready" | "rolled_out";
  splitLabel: string;
  confidenceLabel: string;
  significant: boolean;
  primaryLift: number | null;
  incremental: number | null;
  rolloutUpside: number | null;
}) {
  const steps: { key: "testing" | "ready" | "rolled_out"; label: string; helper: string }[] = [
    { key: "testing", label: "Testing", helper: `Live A/B · ${splitLabel}` },
    { key: "ready", label: "Ready to graduate", helper: significant ? `${confidenceLabel} · positive lift` : "Awaiting significance" },
    { key: "rolled_out", label: "Rolled out", helper: "100% escape · use locked baseline" },
  ];
  const activeIndex = steps.findIndex((step) => step.key === phase);
  const headline =
    phase === "rolled_out"
      ? "Reporting against locked baseline"
      : phase === "ready"
        ? "Test is statistically clean — safe to graduate"
        : "Collecting evidence";
  const body =
    phase === "rolled_out"
      ? "Live A/B is off. Compare current RPV against the locked control RPV from the winning test window. Show as 'estimated incremental revenue', not live A/B proof."
      : phase === "ready"
        ? "Hold a tiny 90/10 or 95/5 holdout when you flip to rollout — that keeps live incremental math honest and proves lift over time."
        : "Keep the 50/50 split running until confidence ≥ 95%. Bucket B is silent by design; do not confuse it with broken.";

  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
            Rollout phase
          </div>
          <div className="mt-1 text-[15px] font-semibold tracking-tight">{headline}</div>
          <p className="mt-1 max-w-2xl text-[12px] text-[var(--color-fg-dim)]">{body}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-[11px] font-mono tnum text-[var(--color-fg-muted)]">
          <span>Lift {fmtPct(primaryLift)}</span>
          <span aria-hidden>·</span>
          <span>Realized {fmtUSD(incremental ?? 0, true)}</span>
          {phase !== "rolled_out" ? (
            <>
              <span aria-hidden>·</span>
              <span>Upside {fmtUSD(rolloutUpside ?? 0, true)}</span>
            </>
          ) : null}
        </div>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-3">
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
