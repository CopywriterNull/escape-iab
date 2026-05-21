import Image from "next/image";
import Link from "next/link";
import {
  getCurrentMerchant,
  getEnabledDashboardIabKinds,
  getIabBreakdown,
  getPeriodDelta,
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
import { TimeRangeSelector } from "../_components/time-range-selector";
import { parseDashboardRange } from "@/lib/dashboard-ranges";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{ range?: string }>;

const PORSCHE_PRICE = 420_000;

const compactNF = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

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

function metricColor(value: number | null): string {
  if (value == null) return "text-[var(--color-fg)]";
  if (value > 0) return "text-[var(--color-success)]";
  if (value < 0) return "text-[var(--color-danger)]";
  return "text-[var(--color-fg)]";
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

type DailyIncrement = { day: string; value: number };

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
  const holdoutCost = rpvA != null && rpvB != null ? (rpvA - rpvB) * baseB : null;
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
    holdoutCost,
    cvrA,
    cvrB,
    confidence,
    significant: z?.significant === true,
  };
}

function dailyIncrementals(rollups: DailyRollup[], limit: number): DailyIncrement[] {
  const byDay = new Map<string, { a?: DailyRollup; b?: DailyRollup }>();
  for (const row of rollups) {
    const slot = byDay.get(row.day) ?? {};
    slot[row.bucket] = row;
    byDay.set(row.day, slot);
  }

  const out: DailyIncrement[] = [];
  for (const [day, buckets] of byDay) {
    const a = buckets.a;
    const b = buckets.b;
    if (!a || !b || a.impressions <= 0 || b.impressions <= 0) {
      out.push({ day, value: 0 });
      continue;
    }
    const rpvA = a.revenue_cents / 100 / a.impressions;
    const rpvB = b.revenue_cents / 100 / b.impressions;
    out.push({ day, value: (rpvA - rpvB) * a.impressions });
  }

  out.sort((a, b) => (a.day < b.day ? -1 : 1));
  return out.slice(-limit);
}

function cumulativeIncremental(rollups: DailyRollup[]): number {
  return dailyIncrementals(rollups, rollups.length).reduce((sum, row) => sum + row.value, 0);
}

function pickBestSource(sources: SourceRow[]): SourceRow | null {
  let best: SourceRow | null = null;
  for (const source of sources) {
    if (!source.utm_source || source.utm_source === "unknown") continue;
    if (source.revenue_cents <= 0) continue;
    if (!best || source.revenue_cents > best.revenue_cents) best = source;
  }
  return best;
}

function pickPlatformWinner(
  breakdown: Record<IabKind, number>,
  enabled: IabKind[],
): { kind: IabKind; impressions: number } | null {
  let best: { kind: IabKind; impressions: number } | null = null;
  for (const kind of enabled) {
    const impressions = breakdown[kind] ?? 0;
    if (impressions <= 0) continue;
    if (!best || impressions > best.impressions) best = { kind, impressions };
  }
  return best;
}

export default async function DashboardV3({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const range = parseDashboardRange(sp.range);
  const merchant = await getCurrentMerchant();

  if (!merchant) {
    return (
      <main>
        <ShellPanel className="p-6">
          <p className="text-sm text-[var(--color-fg-muted)]">Provisioning merchant record...</p>
        </ShellPanel>
      </main>
    );
  }

  const iabKinds = getEnabledDashboardIabKinds(merchant);
  const cumulativeDays = Math.max(range.days, 90);
  const [funnel, sources, unattributed, rollups, period, iabBreakdown] = await Promise.all([
    getTestFunnel(merchant.id, range.days),
    getSourceBreakdown(merchant.id, range.days, 8),
    getUnattributedPurchaseStats(merchant.id, range.days),
    getRollups(merchant.id, cumulativeDays),
    getPeriodDelta(merchant.id, range.days),
    getIabBreakdown(merchant.id, range.days),
  ]);

  const s = summarize(funnel);
  const series = dailyIncrementals(rollups, 14);
  const cumulative = cumulativeIncremental(rollups);
  const bestSource = pickBestSource(sources);
  const platformWinner = pickPlatformWinner(iabBreakdown, iabKinds);
  const revenueDelta = period.comparable ? period.deltas.revenue_cents : null;
  const abPct =
    typeof merchant.ab_split_pct === "number" && Number.isFinite(merchant.ab_split_pct)
      ? Math.min(99, Math.max(1, Math.round(merchant.ab_split_pct)))
      : 50;
  const splitLabel = merchant.ab_enabled ? `${abPct}/${100 - abPct}` : "100/0";
  const phase = !merchant.ab_enabled
    ? "Rolled out"
    : s.significant && (s.rpvLift ?? 0) > 0
      ? "Ready"
      : "Testing";
  const confidenceLabel =
    s.confidence == null ? "Collecting" : `${Math.round(s.confidence * 100)}% confidence`;
  const incremental = s.incrementalRevenue ?? 0;
  const gt2Ratio = incremental / PORSCHE_PRICE;
  const gt2Progress = Math.max(0, Math.min(100, Math.abs(gt2Ratio) * 100));
  const positiveDays = series.filter((row) => row.value > 0).length;

  return (
    <main className="space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--color-fg-muted)]">
            Escape Hatch client board
          </div>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight">
            {merchant.name ?? merchant.domain ?? "Merchant"}
          </h1>
          <p className="mt-0.5 text-[12px] text-[var(--color-fg-muted)]">
            {iabKinds.map(platformLabel).join(" + ")} traffic, last {range.label}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TimeRangeSelector key={range.key} active={range.key} basePath="/dashboard/v3" />
          <LinkButton href={`/dashboard/v2?range=${range.key}`}>v2</LinkButton>
          <LinkButton href={`/dashboard?range=${range.key}`}>Classic</LinkButton>
        </div>
      </header>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.95fr)]">
        <ShellPanel className="overflow-hidden">
          <div className="grid min-h-[396px] lg:grid-cols-[minmax(0,1fr)_310px]">
            <div className="p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill tone={merchant.escape_enabled === false ? "warn" : "success"}>
                  {merchant.escape_enabled === false ? "Paused" : "Live"}
                </Pill>
                <Pill tone={phase === "Ready" ? "success" : "muted"}>{phase}</Pill>
                <Pill>{splitLabel} split</Pill>
                <Pill>{merchant.paid_only ? "Paid only" : "Paid + organic"}</Pill>
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_180px]">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--color-fg-muted)]">
                    Incremental revenue
                  </div>
                  <div className={`mt-1 text-[54px] font-semibold leading-none tracking-tight md:text-[76px] tnum ${metricColor(incremental)}`}>
                    {fmtUSD(incremental, true)}
                  </div>
                  <p className="mt-3 max-w-[52ch] text-[13px] leading-relaxed text-[var(--color-fg-dim)]">
                    Calculated from revenue per visitor lift: A escape minus B holdout, multiplied by escaped visitors.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                  <Score label="Lift" value={fmtPct(s.rpvLift)} tone={metricColor(s.rpvLift)} />
                  <Score label="Confidence" value={confidenceLabel} tone={s.significant ? "text-[var(--color-success)]" : "text-[var(--color-fg)]"} />
                  <Score label="Rollout upside" value={fmtUSD(s.rolloutIncrementalRevenue ?? 0, true)} tone={metricColor(s.rolloutIncrementalRevenue)} />
                </div>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <StatLine label="Visitors" value={fmtCompact(s.totalVisitors)} helper={`A ${fmtCompact(s.baseA)} / B ${fmtCompact(s.baseB)}`} />
                <StatLine label="Revenue" value={fmtUSD(s.revenue, true)} helper={`${s.purchases.toLocaleString()} purchases`} />
                <StatLine
                  label="Revenue trend"
                  value={revenueDelta == null ? "-" : fmtPct(revenueDelta)}
                  helper={period.comparable ? period.priorLabel : "sub-day comparison unavailable"}
                  tone={metricColor(revenueDelta)}
                />
              </div>
            </div>

            <aside className="border-t border-[var(--color-border-soft)] bg-[var(--color-bg)]/35 p-4 lg:border-l lg:border-t-0">
              <DecisionCard
                phase={phase}
                significant={s.significant}
                confidenceLabel={confidenceLabel}
                lift={s.rpvLift}
                abEnabled={merchant.ab_enabled}
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Bucket label="A escape" visitors={s.baseA} rpv={s.rpvA} cvr={s.cvrA} revenue={s.revA} active />
                <Bucket label="B holdout" visitors={s.baseB} rpv={s.rpvB} cvr={s.cvrB} revenue={s.revB} />
              </div>
              {s.holdoutCost != null && s.holdoutCost > 0 ? (
                <div className="mt-3 rounded-md border border-[var(--color-warn)]/25 bg-[var(--color-warn)]/8 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[var(--color-warn)]">
                    Holdout cost
                  </div>
                  <div className="mt-1 text-[18px] font-semibold tnum text-[var(--color-warn)]">
                    {fmtUSD(s.holdoutCost, true)}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-[var(--color-fg-muted)]">
                    Estimated revenue left in B during the test.
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </ShellPanel>

        <ShellPanel className="overflow-hidden">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--color-fg-muted)]">
                  GT2 RS benchmark
                </div>
                <div className={`mt-1 text-[34px] font-semibold leading-none tnum ${metricColor(incremental)}`}>
                  {Math.abs(gt2Ratio) < 0.01 ? gt2Ratio.toFixed(3) : gt2Ratio.toFixed(2)}x
                </div>
                <p className="mt-1 text-[11.5px] text-[var(--color-fg-muted)]">
                  of a 911 GT2 RS
                </p>
              </div>
              <div className="rounded-full border border-[var(--color-border-soft)] px-2 py-1 text-[10.5px] font-mono text-[var(--color-fg-muted)]">
                {fmtUSD(PORSCHE_PRICE, true)}
              </div>
            </div>

            <div className="mt-4 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)]/45 px-3 py-3">
              <Image
                src="/porsche-gt2rs.png"
                alt=""
                width={360}
                height={100}
                className="mx-auto h-[76px] w-full object-contain"
                priority={false}
              />
              <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-mono text-[var(--color-fg-muted)] tnum">
                <span>{fmtUSD(incremental, true)}</span>
                <span>{fmtUSD(PORSCHE_PRICE, true)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-border-soft)]">
                <div
                  className={`h-full rounded-full ${incremental < 0 ? "bg-[var(--color-danger)]" : "bg-[var(--color-success)]"}`}
                  style={{ width: `${gt2Progress}%` }}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Score label="Realized to date" value={fmtUSD(cumulative, true)} tone={metricColor(cumulative)} />
              <Score label="Positive days" value={`${positiveDays}/${series.length || 0}`} />
            </div>
          </div>
        </ShellPanel>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <ShellPanel className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeading title="Proof stack" subtitle="The client-safe readout behind the headline" />
            <Sparkline series={series} />
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <Proof label="A RPV" value={fmtUSD(s.rpvA ?? 0)} helper={`${fmtCompact(s.baseA)} visitors`} tone="text-[var(--color-success)]" />
            <Proof label="B RPV" value={fmtUSD(s.rpvB ?? 0)} helper={`${fmtCompact(s.baseB)} visitors`} />
            <Proof label="CVR A/B" value={`${((s.cvrA ?? 0) * 100).toFixed(2)}% / ${((s.cvrB ?? 0) * 100).toFixed(2)}%`} helper="escape vs holdout" />
            <Proof label="Attribution gap" value={unattributed.count.toLocaleString()} helper={`${fmtUSD(unattributed.revenue_cents / 100, true)} outside test`} tone={unattributed.count > 0 ? "text-[var(--color-warn)]" : undefined} />
          </div>
        </ShellPanel>

        <ShellPanel className="p-4">
          <SectionHeading title="Traffic notes" subtitle="Useful context for screenshots" />
          <div className="mt-3 space-y-2">
            <NoteLine
              label="Top platform"
              value={platformWinner ? `${platformLabel(platformWinner.kind)} (${fmtCompact(platformWinner.impressions)})` : "Collecting"}
            />
            <NoteLine
              label="Top source"
              value={bestSource ? `${bestSource.utm_source} (${fmtUSD(bestSource.revenue_cents / 100, true)})` : "Collecting"}
            />
            <NoteLine
              label="Measurement"
              value={merchant.ab_enabled ? "Live A/B proof" : "Needs locked baseline"}
            />
          </div>
        </ShellPanel>
      </section>

      <ShellPanel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeading title="Source mix" subtitle={`Last ${range.label}`} />
          <div className="text-[11px] font-mono text-[var(--color-fg-muted)]">
            A share shown as green bar
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {sources.length > 0 ? (
            sources.slice(0, 4).map((source) => <SourceCard key={source.utm_source} source={source} />)
          ) : (
            <div className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)]/45 p-3 text-[12px] text-[var(--color-fg-muted)]">
              No source rows yet.
            </div>
          )}
        </div>
      </ShellPanel>
    </main>
  );
}

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center rounded-md border border-[var(--color-border-soft)] px-3 text-[11.5px] font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus-ring"
    >
      {children}
    </Link>
  );
}

function ShellPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)] ${className}`}>
      {children}
    </section>
  );
}

function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "success" | "warn" }) {
  const cls =
    tone === "success"
      ? "border-[var(--color-success)]/25 bg-[var(--color-success)]/10 text-[var(--color-success)]"
      : tone === "warn"
        ? "border-[var(--color-warn)]/30 bg-[var(--color-warn)]/10 text-[var(--color-warn)]"
        : "border-[var(--color-border-soft)] bg-[var(--color-bg)]/60 text-[var(--color-fg-muted)]";
  return <span className={`inline-flex h-6 items-center rounded-full border px-2 text-[10.5px] font-mono ${cls}`}>{children}</span>;
}

function Score({ label, value, tone = "text-[var(--color-fg)]" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)]/45 p-2.5">
      <div className="text-[9.5px] uppercase tracking-[0.14em] font-semibold text-[var(--color-fg-muted)]">
        {label}
      </div>
      <div className={`mt-1 text-[15px] font-semibold tnum ${tone}`}>{value}</div>
    </div>
  );
}

function StatLine({
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
      <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[var(--color-fg-muted)]">
        {label}
      </div>
      <div className={`mt-1.5 text-[20px] font-semibold tracking-tight tnum ${tone}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)] tnum">{helper}</div>
    </div>
  );
}

function DecisionCard({
  phase,
  significant,
  confidenceLabel,
  lift,
  abEnabled,
}: {
  phase: string;
  significant: boolean;
  confidenceLabel: string;
  lift: number | null;
  abEnabled: boolean;
}) {
  const title = !abEnabled
    ? "Baseline needed"
    : significant && (lift ?? 0) > 0
      ? "Ready to graduate"
      : "Keep test running";
  const body = !abEnabled
    ? "100% escape should report against a locked test baseline, not live A/B."
    : significant && (lift ?? 0) > 0
      ? "Flip to 90/10 or 95/5 to preserve a live holdout while scaling the win."
      : "Wait for stronger confidence before calling the test.";

  return (
    <div className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-card)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[var(--color-fg-muted)]">
          Decision
        </div>
        <Pill tone={phase === "Ready" ? "success" : "muted"}>{phase}</Pill>
      </div>
      <div className="mt-2 text-[17px] font-semibold tracking-tight">{title}</div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-fg-muted)]">{body}</p>
      <div className="mt-2 text-[11px] font-mono text-[var(--color-fg-muted)] tnum">
        {confidenceLabel} / lift {fmtPct(lift)}
      </div>
    </div>
  );
}

function Bucket({
  label,
  visitors,
  rpv,
  cvr,
  revenue,
  active = false,
}: {
  label: string;
  visitors: number;
  rpv: number | null;
  cvr: number | null;
  revenue: number;
  active?: boolean;
}) {
  return (
    <div className={`rounded-md border p-2.5 ${active ? "border-[var(--color-success)]/25 bg-[var(--color-success)]/8" : "border-[var(--color-border-soft)] bg-[var(--color-bg)]/45"}`}>
      <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--color-fg-muted)]">{label}</div>
      <div className="mt-1.5 text-[17px] font-semibold tnum">{fmtCompact(visitors)}</div>
      <div className="mt-1 space-y-0.5 text-[10.5px] text-[var(--color-fg-muted)] tnum">
        <div>{fmtUSD(revenue, true)}</div>
        <div>{fmtUSD(rpv ?? 0)} RPV</div>
        <div>{((cvr ?? 0) * 100).toFixed(2)}% CVR</div>
      </div>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
      <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">{subtitle}</p>
    </div>
  );
}

function Proof({
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
      <div className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--color-fg-muted)]">{label}</div>
      <div className={`mt-2 text-[23px] font-semibold tracking-tight tnum ${tone}`}>{value}</div>
      <div className="mt-1 text-[11px] text-[var(--color-fg-muted)] tnum">{helper}</div>
    </div>
  );
}

function Sparkline({ series }: { series: DailyIncrement[] }) {
  const values = series.map((row) => row.value);
  if (values.length === 0 || values.every((value) => value === 0)) {
    return <div className="text-[11px] font-mono text-[var(--color-fg-muted)]">No daily signal yet</div>;
  }

  const width = 150;
  const height = 34;
  const pad = 3;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = pad + (index * (width - pad * 2)) / Math.max(1, values.length - 1);
    const y = pad + (1 - (value - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const zeroY = pad + (1 - (0 - min) / span) * (height - pad * 2);
  const last = values[values.length - 1] ?? 0;
  const stroke =
    last > 0 ? "var(--color-success)" : last < 0 ? "var(--color-danger)" : "var(--color-fg-muted)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="Daily incremental revenue sparkline"
      className="shrink-0"
    >
      <line x1={pad} x2={width - pad} y1={zeroY} y2={zeroY} stroke="var(--color-border-soft)" strokeDasharray="2 2" />
      <polyline points={points.join(" ")} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NoteLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)]/45 px-3 py-2">
      <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--color-fg-muted)]">{label}</span>
      <span className="min-w-0 truncate text-right text-[12px] font-medium">{value}</span>
    </div>
  );
}

function SourceCard({ source }: { source: SourceRow }) {
  const aShare = source.total > 0 ? source.bucket_a / source.total : 0;
  return (
    <div className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)]/45 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 truncate text-[12px] font-semibold">{source.utm_source || "unknown"}</div>
        <div className="shrink-0 text-[11px] font-mono text-[var(--color-fg-muted)]">{fmtCompact(source.total)}</div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border-soft)]">
        <div className="h-full rounded-full bg-[var(--color-success)]" style={{ width: `${Math.round(aShare * 100)}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px] font-mono text-[var(--color-fg-muted)] tnum">
        <span>A {source.bucket_a.toLocaleString()}</span>
        <span>{fmtUSD(source.revenue_cents / 100, true)}</span>
      </div>
    </div>
  );
}
