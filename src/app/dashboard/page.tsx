import Link from "next/link";
import { Suspense, cache } from "react";
import {
  getCurrentMerchant,
  getPeriodDelta,
  getRollupFreshness,
  getRollups,
  getEnabledDashboardIabKinds,
  getSourceBreakdown,
  getTestFunnel,
  getUnattributedPurchaseStats,
  zTestTwoProp,
  sampleSizePerBucket,
  type DailyRollup,
  type Funnel,
  type Merchant,
  type PeriodDelta,
  type SourceRow,
  type IabKind,
} from "@/lib/db";
import { RollupFreshnessBanner } from "./_components/rollup-freshness-banner";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import {
  ActivitySkeleton,
  BannerSkeleton,
  ChartSkeleton,
  FunnelSkeleton,
  HeroSkeleton,
  KPIGridSkeleton,
  SampleSizeSkeleton,
  SourcesSkeleton,
} from "./_components/skeletons";
import { TimeRangeSelector } from "./_components/time-range-selector";
import { LiveActivity } from "./_components/live-activity";
import { SampleSizeCalculator } from "./_components/sample-size-calc";
import { PixelIcon } from "@/components/PixelIcon";
import { parseDashboardRange, type DashboardRange } from "@/lib/dashboard-ranges";

/* -------- Number formatters -------- */

const compactNF = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) < 10_000) return n.toLocaleString();
  return compactNF.format(n);
}

function fmtUSD(n: number, opts?: { compact?: boolean; signed?: boolean }): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : opts?.signed && n > 0 ? "+" : "";
  const abs = Math.abs(n);
  if (opts?.compact && abs >= 10_000) return `${sign}$${compactNF.format(abs)}`;
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: abs < 10 ? 2 : 0 })}`;
}

function clampBlocks(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.round(value)));
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* -------- Range types + constants -------- */

type Range = DashboardRange;

type ActivityRow = {
  event_type: string;
  bucket: "a" | "b";
  in_test: boolean;
  value_cents: number | null;
  utm_source: string | null;
  iab_kind: string | null;
  created_at: string;
};

/* -------- Cached fetchers (React.cache dedupes within a single render) -------- */

const fetchFunnel = cache(getTestFunnel);
const fetchUnattributed = cache(getUnattributedPurchaseStats);
const fetchRollups = cache(getRollups);
const fetchSources = cache(getSourceBreakdown);
const fetchPeriodDelta = cache(getPeriodDelta);

const fetchActivity = cache(async function fetchActivity(
  merchantId: string,
  days: number,
  iabKinds: IabKind[],
  limit = 12,
): Promise<ActivityRow[]> {
  const supabase = getSupabaseAdmin() ?? (await getSupabaseServer());
  if (!supabase) return [];
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data } = await supabase
    .from("escape_events")
    .select("event_type,bucket,in_test,value_cents,utm_source,iab_kind,created_at")
    .eq("merchant_id", merchantId)
    .in("event_type", ["purchase", "checkout_started", "add_to_cart", "escape_attempt"])
    .in("iab_kind", iabKinds)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ActivityRow[];
});

type FunnelMode = "raw" | "corrected";
type SearchParams = Promise<{ range?: string; funnel?: string }>;

function parseFunnelMode(v: string | undefined): FunnelMode {
  return v === "raw" ? "raw" : "corrected";
}

/* -------- Page (shell; data streams via Suspense children) -------- */

export default async function DashboardOverview({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const range = parseDashboardRange(sp.range);
  const funnelMode = parseFunnelMode(sp.funnel);

  const merchant = await getCurrentMerchant();
  if (!merchant) {
    return (
      <Page range={range}>
        <Card><CardBody><MutedText>Provisioning merchant record…</MutedText></CardBody></Card>
      </Page>
    );
  }

  const m = merchant.id;
  const d = range.days;
  const rollupFreshness = await getRollupFreshness();

  return (
    <Page
      range={range}
      funnelMode={funnelMode}
      subtitle={<span>Last {range.label}</span>}
      action={
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/install"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-[12.5px] font-medium press lift focus-ring"
          >
            Install snippet
            <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      }
    >
      <ScopeBanner merchant={merchant} />

      <RollupFreshnessBanner freshness={rollupFreshness} />

      <Suspense key={`hero-${range.key}`} fallback={<HeroSkeleton />}>
        <HeroSection merchantId={m} days={d} rangeLabel={range.label} />
      </Suspense>

      <Suspense key={`banner-${range.key}`} fallback={<BannerSkeleton />}>
        <BannerSection merchantId={m} days={d} rangeLabel={range.label} />
      </Suspense>

      <Suspense key={`kpi-${range.key}`} fallback={<KPIGridSkeleton />}>
        <KPISection merchantId={m} days={d} />
      </Suspense>

      <Suspense key={`funnel-${range.key}-${funnelMode}`} fallback={<FunnelSkeleton />}>
        <FunnelSection merchantId={m} days={d} mode={funnelMode} rangeKey={range.key} />
      </Suspense>

      <Layout>
        <LayoutCol size="primary">
          <Suspense key={`sources-${range.key}`} fallback={<SourcesSkeleton rangeLabel={range.label} />}>
            <SourcesSection merchantId={m} days={d} rangeLabel={range.label} />
          </Suspense>
        </LayoutCol>
        <LayoutCol size="secondary">
          <Suspense key={`chart-${range.key}`} fallback={<ChartSkeleton rangeLabel={range.label} />}>
            <ChartSection merchantId={m} days={d} rangeLabel={range.label} />
          </Suspense>
          <Suspense key={`sample-${range.key}`} fallback={<SampleSizeSkeleton />}>
            <SampleSizeSection merchantId={m} days={d} />
          </Suspense>
          <SampleSizeCalculator />

        </LayoutCol>
      </Layout>

      <Suspense key={`activity-${range.key}`} fallback={<ActivitySkeleton />}>
        <ActivitySection merchantId={m} days={d} iabKinds={getEnabledDashboardIabKinds(merchant)} />
      </Suspense>
    </Page>
  );
}

/* -------- Section components — each owns its own fetch -------- */

function ScopeBanner({ merchant }: { merchant: Merchant }) {
  const platformLabels = getEnabledDashboardIabKinds(merchant).map(platformLabel);
  const abPct =
    typeof merchant.ab_split_pct === "number" && Number.isFinite(merchant.ab_split_pct)
      ? Math.min(99, Math.max(1, Math.round(merchant.ab_split_pct)))
      : 50;
  const engine = merchant.escape_enabled === false ? "Paused" : "Live";
  const split = merchant.ab_enabled ? `A/B ${abPct}/${100 - abPct}` : "100% escape";
  const sourceMode = merchant.paid_only === true ? "Paid only" : "Paid + organic";

  return (
    <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)] px-4 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
            Reporting scope
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={merchant.escape_enabled === false ? "pill pill-warn" : "pill pill-success"}>
              {engine}
            </span>
            <span className="pill pill-info">{platformLabels.join(" + ")}</span>
            <span className="pill pill-muted">{split}</span>
            <span className="pill pill-muted">{sourceMode}</span>
          </div>
        </div>
        <Link
          href="/dashboard/settings"
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] px-3 text-[12px] font-medium transition-colors hover:bg-[var(--color-bg-elev)] focus-ring"
        >
          Adjust scope
        </Link>
      </div>
    </div>
  );
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

async function HeroSection({
  merchantId,
  days,
  rangeLabel,
}: {
  merchantId: string;
  days: number;
  rangeLabel: string;
}) {
  const funnel = await fetchFunnel(merchantId, days);
  const baseA = funnel.impressions.a;
  const baseB = funnel.impressions.b;
  const revA = funnel.revenue_cents.a / 100;
  const revB = funnel.revenue_cents.b / 100;
  const rpsA = baseA > 0 ? revA / baseA : 0;
  const rpsB = baseB > 0 ? revB / baseB : 0;
  const liftRel = rpsB > 0 ? (rpsA - rpsB) / rpsB : null;
  const z = zTestTwoProp(funnel.purchases.a, baseA, funnel.purchases.b, baseB);

  const totalImpressions = baseA + baseB;
  const currentRev = revA + revB;
  // If every impression got bucket-A treatment, projected revenue would be:
  const projectedRev = totalImpressions * rpsA;
  const revenueDelta = projectedRev - currentRev;

  // No test data → friendly empty state.
  if (totalImpressions === 0) {
    return (
      <div className="px-1 py-1">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-accent)]">
          Test performance
        </div>
        <div className="mt-2 h-display text-[32px] md:text-[44px] tracking-tight text-[var(--color-fg-dim)]">
          Waiting for traffic
        </div>
        <div className="mt-2 text-[13px] text-[var(--color-fg-muted)] max-w-xl">
          Paid Instagram clicks will populate this within minutes of install.
        </div>
      </div>
    );
  }

  const liftStr = liftRel == null ? "—" : `${liftRel > 0 ? "+" : ""}${(liftRel * 100).toFixed(1)}%`;
  const liftColor =
    liftRel == null
      ? "text-[var(--color-fg-dim)]"
      : liftRel > 0
        ? "text-[var(--color-success)]"
        : "text-[var(--color-danger)]";

  // Plain-English confidence sentence.
  const confidence =
    z?.pValue != null ? Math.round((1 - z.pValue) * 100) : null;
  const sig = z?.significant === true;
  const winner = liftRel != null && liftRel > 0 ? "A (escape)" : "B (control)";

  let confidenceText: React.ReactNode;
  if (confidence == null) {
    confidenceText = (
      <>Gathering data · not enough impressions for a verdict.</>
    );
  } else if (sig) {
    confidenceText = (
      <>
        <span className="text-[var(--color-fg)] font-medium">{confidence}% confident</span>
        <span className="text-[var(--color-fg-muted)]"> · winner: {winner}</span>
      </>
    );
  } else {
    confidenceText = (
      <>
        <span className="text-[var(--color-fg-dim)]">{confidence}% confident</span>
        <span className="text-[var(--color-fg-muted)]"> · need 95% to call it. Keep the test running.</span>
      </>
    );
  }

  return (
    <div className="px-1 py-1">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-accent)]">
          Test performance · last {rangeLabel}
        </div>
      </div>
      <div className={`mt-2 h-display tracking-tight text-[36px] md:text-[56px] leading-[1.05] tnum ${liftColor}`}>
        {liftStr}
      </div>
      <div className="mt-2 text-[14px] text-[var(--color-fg-dim)]">
        {liftRel == null ? (
          <>Need both buckets to have revenue to compute lift.</>
        ) : revenueDelta >= 0 ? (
          <>
            Projected{" "}
            <span className="text-[var(--color-fg)] font-medium tnum">{fmtUSD(revenueDelta, { compact: true, signed: true })}</span>{" "}
            more revenue if 100% of traffic got the escape.
          </>
        ) : (
          <>
            Escape currently{" "}
            <span className="text-[var(--color-danger)] font-medium tnum">underperforming</span>{" "}
            control by {fmtUSD(Math.abs(revenueDelta), { compact: true })}.
          </>
        )}
      </div>
      <div className="mt-1 text-[12.5px] font-mono">
        {confidenceText}
      </div>
    </div>
  );
}

async function BannerSection({
  merchantId,
  days,
  rangeLabel,
}: {
  merchantId: string;
  days: number;
  rangeLabel: string;
}) {
  const [funnel, unattributed] = await Promise.all([
    fetchFunnel(merchantId, days),
    fetchUnattributed(merchantId, days),
  ]);
  const baseA = funnel.impressions.a;
  const baseB = funnel.impressions.b;
  const revA = funnel.revenue_cents.a / 100;
  const revB = funnel.revenue_cents.b / 100;
  const rpsA = baseA > 0 ? revA / baseA : 0;
  const rpsB = baseB > 0 ? revB / baseB : 0;
  const liftRel = rpsB > 0 ? (rpsA - rpsB) / rpsB : null;
  const z = zTestTwoProp(funnel.purchases.a, baseA, funnel.purchases.b, baseB);
  return (
    <Banner
      unattributed={unattributed}
      attributedPurchases={funnel.purchases.a + funnel.purchases.b}
      attributedRevenueCents={funnel.revenue_cents.a + funnel.revenue_cents.b}
      liftRel={liftRel}
      pValue={z?.pValue ?? null}
      rangeLabel={rangeLabel}
    />
  );
}

async function KPISection({ merchantId, days }: { merchantId: string; days: number }) {
  const [funnel, period] = await Promise.all([
    fetchFunnel(merchantId, days),
    fetchPeriodDelta(merchantId, days),
  ]);
  const baseA = funnel.impressions.a;
  const baseB = funnel.impressions.b;
  const revA = funnel.revenue_cents.a / 100;
  const revB = funnel.revenue_cents.b / 100;
  const rpsA = baseA > 0 ? revA / baseA : 0;
  const rpsB = baseB > 0 ? revB / baseB : 0;
  const liftRel = rpsB > 0 ? (rpsA - rpsB) / rpsB : null;
  const z = zTestTwoProp(funnel.purchases.a, baseA, funnel.purchases.b, baseB);
  const totalImpressions = baseA + baseB;
  const totalRevenue = revA + revB;
  const prevImpressions = period.previous.impressions;
  const prevRevenue = period.previous.revenue_cents / 100;
  const prevRpv = prevImpressions > 0 ? prevRevenue / prevImpressions : 0;
  const revPerVisitor = totalImpressions > 0 ? totalRevenue / totalImpressions : 0;
  const rpvDelta = prevRpv > 0 ? (revPerVisitor - prevRpv) / prevRpv : null;

  // Per-bucket RPV for the A vs B comparison on the RPV tile.
  const rpvA = baseA > 0 ? revA / baseA : null;
  const rpvB = baseB > 0 ? revB / baseB : null;
  const rpvLift = rpvA != null && rpvB != null && rpvB > 0 ? (rpvA - rpvB) / rpvB : null;
  const incrementalRevenue =
    rpvA != null && rpvB != null ? (rpvA - rpvB) * baseA : null;
  const rolloutIncrementalRevenue =
    rpvA != null && rpvB != null ? (rpvA - rpvB) * totalImpressions : null;

  // Purchase CVR per bucket — for the lift tile's comparison sub-line.
  const cvrA = baseA > 0 ? funnel.purchases.a / baseA : null;
  const cvrB = baseB > 0 ? funnel.purchases.b / baseB : null;

  return (
    <KPIGrid
      impressions={totalImpressions}
      escapeAttempts={funnel.escape_attempts.a}
      revenue={totalRevenue}
      incrementalRevenue={incrementalRevenue}
      rolloutIncrementalRevenue={rolloutIncrementalRevenue}
      purchases={funnel.purchases.a + funnel.purchases.b}
      revPerVisitor={revPerVisitor}
      rpvPrior={prevRpv > 0 ? prevRpv : null}
      rpvDelta={rpvDelta}
      rpvA={rpvA}
      rpvB={rpvB}
      rpvLift={rpvLift}
      cvrA={cvrA}
      cvrB={cvrB}
      liftRel={liftRel}
      pValue={z?.pValue ?? null}
      period={period}
    />
  );
}

async function FunnelSection({
  merchantId,
  days,
  mode,
  rangeKey,
}: {
  merchantId: string;
  days: number;
  mode: FunnelMode;
  rangeKey: string;
}) {
  const funnel = await fetchFunnel(merchantId, days);
  return <FunnelTable funnel={funnel} mode={mode} rangeKey={rangeKey} />;
}

async function SourcesSection({
  merchantId,
  days,
  rangeLabel,
}: {
  merchantId: string;
  days: number;
  rangeLabel: string;
}) {
  const sources = await fetchSources(merchantId, days, 8);
  return <SourcesCard sources={sources} rangeLabel={rangeLabel} />;
}

async function ChartSection({
  merchantId,
  days,
  rangeLabel,
}: {
  merchantId: string;
  days: number;
  rangeLabel: string;
}) {
  const rollups = await fetchRollups(merchantId, days);
  return <ChartCard rollups={rollups} rangeLabel={rangeLabel} />;
}

async function SampleSizeSection({ merchantId, days }: { merchantId: string; days: number }) {
  const funnel = await fetchFunnel(merchantId, days);
  return <SampleSizeCard funnel={funnel} />;
}

async function ActivitySection({
  merchantId,
  days,
  iabKinds,
}: {
  merchantId: string;
  days: number;
  iabKinds: IabKind[];
}) {
  const rows = await fetchActivity(merchantId, days, iabKinds, 12);
  return <ActivityCard rows={rows} days={days} />;
}

/* -------- Polaris-inspired primitives -------- */

function Page({
  subtitle,
  action,
  range,
  funnelMode = "corrected",
  children,
}: {
  // Title was redundant with the top-nav breadcrumb + tab strip — dropped.
  title?: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  range?: Range;
  funnelMode?: FunnelMode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 md:space-y-5">
      {/* Slim toolbar — just the range pills + actions. */}
      {(range || action || subtitle) ? (
        <div className="flex items-center justify-between gap-3 flex-wrap pb-2 mb-1">
          <div className="min-w-0 text-[11.5px] font-mono text-[var(--color-fg-muted)] tnum">
            {subtitle}
          </div>
          <div className="flex items-center gap-2 flex-wrap -mx-1 md:mx-0 overflow-x-auto md:overflow-visible scrollbar-none">
            {range ? (
              <TimeRangeSelector
                key={range.key}
                active={range.key}
                basePath="/dashboard"
                extraParams={funnelMode === "raw" ? { funnel: "raw" } : undefined}
              />
            ) : null}
            {action}
          </div>
        </div>
      ) : null}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Card({
  title,
  action,
  children,
  padded = true,
  className = "",
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg ${className}`}
    >
      {title || action ? (
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border-soft)]">
          {title ? (
            typeof title === "string" ? (
              <h2 className="h-section text-[14px]">{title}</h2>
            ) : (
              <h2>{title}</h2>
            )
          ) : null}
          {action}
        </header>
      ) : null}
      {padded ? <div className="px-4 py-3">{children}</div> : children}
    </section>
  );
}

function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3.5">{children}</div>;
}

function Layout({ children }: { children: React.ReactNode }) {
  return <div className="grid lg:grid-cols-12 gap-4">{children}</div>;
}

function LayoutCol({ children, size }: { children: React.ReactNode; size: "primary" | "secondary" }) {
  return <div className={`flex flex-col gap-4 ${size === "primary" ? "lg:col-span-7" : "lg:col-span-5"}`}>{children}</div>;
}

function MutedText({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-[var(--color-fg-dim)]">{children}</p>;
}

function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
      {children}
    </div>
  );
}

function FunnelModeToggle({ active, rangeKey }: { active: FunnelMode; rangeKey: string }) {
  const opts: { key: FunnelMode; label: string; title: string }[] = [
    { key: "corrected", label: "Corrected", title: "Each stage clamped to ≥ every later stage. Purchase counts (from webhook) are authoritative." },
    { key: "raw", label: "Raw", title: "Unaltered pixel-side counts. Useful for spotting Shopify pixel firing anomalies." },
  ];
  return (
    <div
      role="tablist"
      aria-label="Funnel data mode"
      className="inline-flex items-center gap-0.5 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-card)] p-[2px] text-[10.5px]"
    >
      {opts.map((o) => {
        const isActive = o.key === active;
        const href =
          o.key === "corrected"
            ? `/dashboard?range=${rangeKey}`
            : `/dashboard?range=${rangeKey}&funnel=raw`;
        return (
          <Link
            key={o.key}
            href={href}
            role="tab"
            aria-selected={isActive}
            title={o.title}
            className={`px-2 py-[3px] rounded font-mono uppercase tracking-[0.1em] transition-colors focus-ring ${
              isActive
                ? "bg-[var(--color-bg)] text-[var(--color-fg)] font-medium shadow-[0_0_0_1px_var(--color-border-soft)_inset]"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            }`}
            scroll={false}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

/* -------- Banner — Polaris-style attribution gap notice -------- */

function Banner({
  unattributed,
  attributedPurchases,
  attributedRevenueCents,
  liftRel,
  pValue,
  rangeLabel,
}: {
  unattributed: { count: number; revenue_cents: number };
  attributedPurchases: number;
  attributedRevenueCents: number;
  liftRel: number | null;
  pValue: number | null;
  rangeLabel: string;
}) {
  if (unattributed.count === 0 && attributedPurchases === 0) return null;

  // "Test is winning" mode — when we have a positive significant lift
  const winning = liftRel != null && liftRel > 0 && pValue != null && pValue < 0.1;
  const total = unattributed.count + attributedPurchases;
  const totalRev = (unattributed.revenue_cents + attributedRevenueCents) / 100;
  const confidence = pValue != null ? Math.round((1 - pValue) * 100) : null;

  if (winning) {
    return (
      <div
        className="rounded-2xl p-4 md:p-5 border flex items-start gap-3 md:gap-4"
        style={{
          background: "var(--color-success-soft)",
          borderColor: "color-mix(in srgb, var(--color-success) 18%, transparent)",
        }}
      >
        <div
          aria-hidden
          className="size-10 md:size-11 rounded-xl grid place-items-center shrink-0"
          style={{ background: "var(--color-card)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
        >
          <PixelIcon name="check" size={18} className="text-[var(--color-success)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[var(--color-success)]">
            Test is winning
          </div>
          <div className="mt-1 text-[16px] md:text-[20px] font-semibold tracking-tight leading-tight">
            Bucket A converts{" "}
            <span className="tnum text-[var(--color-success)]">
              +{(liftRel * 100).toFixed(1)}%
            </span>{" "}
            better than control
          </div>
          <div className="mt-1.5 text-[12.5px] text-[var(--color-fg-dim)]">
            {confidence}% confident over the last {rangeLabel} · {fmtCompact(total)} purchases · {fmtUSD(totalRev, { compact: true })}
          </div>
        </div>
      </div>
    );
  }

  // Fallback: quiet info banner
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-card)]">
      <div className="flex items-center gap-3 min-w-0">
        <span className="size-1.5 rounded-full bg-[var(--color-accent)] shrink-0" />
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium tracking-tight">
            {fmtCompact(total)} purchases · {fmtUSD(totalRev, { compact: true })}{" "}
            <span className="text-[var(--color-fg-muted)] font-normal">all sources · last {rangeLabel}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)] font-mono tnum">
            {attributedPurchases} attributed · {unattributed.count} unattributed
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------- KPI grid — 4 dense tiles -------- */

function KPIGrid({
  impressions,
  escapeAttempts,
  revenue,
  incrementalRevenue,
  rolloutIncrementalRevenue,
  purchases,
  revPerVisitor,
  rpvPrior,
  rpvDelta,
  rpvA,
  rpvB,
  rpvLift,
  cvrA,
  cvrB,
  liftRel,
  pValue,
  period,
}: {
  impressions: number;
  escapeAttempts: number;
  revenue: number;
  incrementalRevenue: number | null;
  rolloutIncrementalRevenue: number | null;
  purchases: number;
  revPerVisitor: number;
  rpvPrior: number | null;
  rpvDelta: number | null;
  rpvA: number | null;
  rpvB: number | null;
  rpvLift: number | null;
  cvrA: number | null;
  cvrB: number | null;
  liftRel: number | null;
  pValue: number | null;
  period: PeriodDelta;
}) {
  const liftStr =
    liftRel == null
      ? "—"
      : `${liftRel > 0 ? "+" : ""}${(liftRel * 100).toFixed(1)}%`;
  const liftColor =
    liftRel == null
      ? "text-[var(--color-fg)]"
      : liftRel > 0
        ? "text-[var(--color-success)]"
        : "text-[var(--color-danger)]";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <KPI
        label="Rev / visitor"
        icon="dollar"
        value={fmtUSD(revPerVisitor)}
        valueClass="text-[var(--color-success)]"
        sub={
          rpvA != null && rpvB != null
            ? `A $${rpvA.toFixed(2)} · B $${rpvB.toFixed(2)}${
                rpvLift != null
                  ? ` · ${rpvLift > 0 ? "+" : ""}${(rpvLift * 100).toFixed(1)}%`
                  : ""
              }`
            : rpvPrior != null
              ? `vs $${rpvPrior.toFixed(2)} ${period.priorLabel}`
              : `over ${fmtCompact(impressions)} visitors`
        }
        delta={rpvDelta}
        deltaLabel={period.priorLabel}
      />
      <KPI
        label="Impressions"
        icon="eye"
        value={fmtCompact(impressions)}
        sub={`${escapeAttempts.toLocaleString()} escapes (A)`}
        delta={period.deltas.impressions}
        deltaLabel={period.priorLabel}
      />
      <KPI
        label="Incremental"
        icon="dollar"
        value={incrementalRevenue != null ? fmtUSD(incrementalRevenue, { compact: true, signed: true }) : "—"}
        valueClass={
          incrementalRevenue == null
            ? ""
            : incrementalRevenue > 0
              ? "text-[var(--color-success)]"
              : incrementalRevenue < 0
                ? "text-[var(--color-danger)]"
                : ""
        }
        sub={
          rolloutIncrementalRevenue != null
            ? `${fmtUSD(rolloutIncrementalRevenue, { compact: true, signed: true })} at full rollout`
            : "A vs B revenue per visitor"
        }
      />
      <KPI
        label="Revenue (test)"
        icon="cart"
        value={fmtUSD(revenue, { compact: true })}
        sub={`${purchases.toLocaleString()} purchases`}
        delta={period.deltas.revenue_cents}
        deltaLabel={period.priorLabel}
      />
      <KPI
        label="Lift · A vs B"
        icon="chart"
        value={liftStr}
        valueClass={liftColor}
        sub={
          cvrA != null && cvrB != null
            ? `A ${(cvrA * 100).toFixed(2)}% · B ${(cvrB * 100).toFixed(2)}%${
                pValue != null ? ` · ${Math.round((1 - pValue) * 100)}%` : ""
              }`
            : pValue != null
              ? `${Math.round((1 - pValue) * 100)}% confident`
              : "need more data"
        }
      />
    </div>
  );
}

function KPI({
  label,
  icon,
  value,
  sub,
  valueClass = "",
  delta,
  deltaLabel,
}: {
  label: string;
  icon: "dollar" | "eye" | "bolt" | "cart" | "chart";
  value: string;
  sub?: string;
  valueClass?: string;
  delta?: number | null;
  deltaLabel?: string;
}) {
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <MonoLabel>{label}</MonoLabel>
        <PixelIcon name={icon} size={12} className="text-[var(--color-fg-muted)]" />
      </div>
      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        <div className={`h-section text-[22px] md:text-[24px] tnum ${valueClass}`}>{value}</div>
        {delta != null && Number.isFinite(delta) ? (
          <span
            className={`text-[11px] font-mono tnum font-medium tracking-tight inline-flex items-center gap-0.5 ${
              delta > 0.001
                ? "text-[var(--color-success)]"
                : delta < -0.001
                  ? "text-[var(--color-danger)]"
                  : "text-[var(--color-fg-muted)]"
            }`}
            title={deltaLabel}
          >
            {delta > 0 ? <PixelIcon name="arrow-up" size={9} /> : null}
            {Math.abs(delta * 100).toFixed(1)}%
          </span>
        ) : null}
      </div>
      {sub ? (
        <div className="mt-1 text-[11px] text-[var(--color-fg-muted)] tnum">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

/* -------- Funnel table — IndexTable-style -------- */

function FunnelTable({
  funnel,
  mode,
  rangeKey,
}: {
  funnel: Funnel;
  mode: FunnelMode;
  rangeKey: string;
}) {
  type Stage = { label: string; a: number; b: number; sub: string };
  const hasProductViewedSignal = funnel.product_viewed.a + funnel.product_viewed.b > 0;
  const stages: Stage[] = [
    { label: "Impressions", a: funnel.impressions.a, b: funnel.impressions.b, sub: "test landings" },
    ...(hasProductViewedSignal
      ? [{ label: "Product viewed", a: funnel.product_viewed.a, b: funnel.product_viewed.b, sub: "/products/*" }]
      : []),
    { label: "Add to cart", a: funnel.add_to_cart.a, b: funnel.add_to_cart.b, sub: "added a SKU" },
    { label: "Checkout started", a: funnel.checkout_started.a, b: funnel.checkout_started.b, sub: "reached /checkouts" },
    { label: "Purchase", a: funnel.purchases.a, b: funnel.purchases.b, sub: "completed" },
  ];
  // In "corrected" mode, back-propagate each stage so it's ≥ every later
  // stage (the Shopify pixel can under-fire checkout_started / add_to_cart;
  // purchases are authoritative via the webhook). "raw" preserves the
  // unaltered pixel-side counts so you can spot pixel-firing anomalies.
  if (mode === "corrected") {
    for (let i = stages.length - 2; i >= 0; i--) {
      stages[i].a = Math.max(stages[i].a, stages[i + 1].a);
      stages[i].b = Math.max(stages[i].b, stages[i + 1].b);
    }
  }
  const baseA = funnel.impressions.a;
  const baseB = funnel.impressions.b;
  const empty = baseA + baseB === 0;

  return (
    <Card
      title="Funnel · A vs B"
      action={<FunnelModeToggle active={mode} rangeKey={rangeKey} />}
    >
      {empty ? (
        <div className="px-4 py-12 text-center">
          <div className="mx-auto inline-flex size-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)]">
            <PixelIcon name="chart" size={16} className="text-[var(--color-fg-muted)]" />
          </div>
          <div className="mt-3 text-[13px] font-medium">No test data yet</div>
          <div className="mt-1 text-[11.5px] text-[var(--color-fg-muted)]">Paid IG ad clicks will populate here within minutes of install.</div>
        </div>
      ) : (
        <div className="px-4 py-3">
          {stages.map((stage, i) => {
            const prev = i > 0 ? stages[i - 1] : null;
            const cvrA = baseA > 0 ? stage.a / baseA : 0;
            const cvrB = baseB > 0 ? stage.b / baseB : 0;
            const z = i === 0 ? null : zTestTwoProp(stage.a, baseA, stage.b, baseB);
            const liftStr =
              z?.liftRel != null ? `${z.liftRel > 0 ? "+" : ""}${(z.liftRel * 100).toFixed(1)}%` : null;
            const liftColor =
              z?.liftRel == null
                ? "text-[var(--color-fg-muted)]"
                : z.liftRel > 0
                  ? "text-[var(--color-success)]"
                  : "text-[var(--color-danger)]";
            const sig = z?.significant === true;
            const pStr =
              z?.pValue != null ? (z.pValue < 0.001 ? "<.001" : z.pValue.toFixed(3)) : null;
            // Corrected funnel mode can show later stages above the measured
            // impression denominator. Clamp the visual bars, keep counts exact.
            const aBlocks40 = clampBlocks(cvrA * 40, 40);
            const bBlocks40 = clampBlocks(cvrB * 40, 40);
            const aBlocks24 = clampBlocks(cvrA * 24, 24);
            const bBlocks24 = clampBlocks(cvrB * 24, 24);
            const prevTotal = prev ? prev.a + prev.b : null;
            const stageTotal = stage.a + stage.b;
            const dropPct =
              prev && prevTotal && prevTotal > 0
                ? Math.round((1 - stageTotal / prevTotal) * 100)
                : null;

            return (
              <div key={stage.label}>
                {i > 0 && dropPct != null ? (
                  <div className="flex items-center gap-2 py-1.5 text-[10.5px] font-mono text-[var(--color-fg-muted)] tnum">
                    <PixelIcon name="arrow-down-right" size={11} />
                    <span>{dropPct}% drop-off</span>
                  </div>
                ) : null}

                <div className="flex items-baseline justify-between gap-3 mt-1">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium tracking-tight">{stage.label}</div>
                    <div className="text-[10.5px] text-[var(--color-fg-muted)] font-mono">{stage.sub}</div>
                  </div>
                  <div className="shrink-0 flex items-baseline gap-2">
                    {liftStr ? (
                      <>
                        <span className={`font-mono tnum text-[12.5px] font-semibold ${liftColor}`}>
                          {liftStr}
                        </span>
                        {pStr ? (
                          <span className={`text-[10px] font-mono tnum ${sig ? "text-[var(--color-success)]" : "text-[var(--color-fg-muted)]"}`}>
                            p {pStr}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">baseline</span>
                    )}
                  </div>
                </div>

                {/* Desktop ASCII (40 wide) */}
                <pre
                  className="mt-1.5 leading-[1.45] text-[11px] tnum hidden sm:block"
                  style={{ fontFamily: "var(--font-mono), ui-monospace, monospace", margin: 0 }}
                >
                  <span style={{ color: "var(--color-fg-muted)" }}>A│</span>
                  <span style={{ color: "var(--color-accent)" }}>{"█".repeat(aBlocks40)}</span>
                  <span style={{ color: "var(--color-border-soft)" }}>{"░".repeat(40 - aBlocks40)}</span>
                  <span style={{ color: "var(--color-fg-muted)" }}>│ </span>
                  <span style={{ color: "var(--color-fg)" }}>
                    {stage.a.toLocaleString().padStart(7)} {(cvrA * 100).toFixed(i === 0 ? 0 : 1).padStart(5)}%
                  </span>
                  {"\n"}
                  <span style={{ color: "var(--color-fg-muted)" }}>B│</span>
                  <span style={{ color: "color-mix(in srgb, var(--color-accent) 45%, transparent)" }}>{"█".repeat(bBlocks40)}</span>
                  <span style={{ color: "var(--color-border-soft)" }}>{"░".repeat(40 - bBlocks40)}</span>
                  <span style={{ color: "var(--color-fg-muted)" }}>│ </span>
                  <span style={{ color: "var(--color-fg-dim)" }}>
                    {stage.b.toLocaleString().padStart(7)} {(cvrB * 100).toFixed(i === 0 ? 0 : 1).padStart(5)}%
                  </span>
                </pre>
                {/* Mobile ASCII (24 wide) */}
                <pre
                  className="mt-1.5 leading-[1.45] text-[10.5px] tnum sm:hidden"
                  style={{ fontFamily: "var(--font-mono), ui-monospace, monospace", margin: 0 }}
                >
                  <span style={{ color: "var(--color-fg-muted)" }}>A│</span>
                  <span style={{ color: "var(--color-accent)" }}>{"█".repeat(aBlocks24)}</span>
                  <span style={{ color: "var(--color-border-soft)" }}>{"░".repeat(24 - aBlocks24)}</span>
                  <span style={{ color: "var(--color-fg-muted)" }}>│ </span>
                  <span style={{ color: "var(--color-fg)" }}>
                    {fmtCompact(stage.a)} {(cvrA * 100).toFixed(i === 0 ? 0 : 1)}%
                  </span>
                  {"\n"}
                  <span style={{ color: "var(--color-fg-muted)" }}>B│</span>
                  <span style={{ color: "color-mix(in srgb, var(--color-accent) 45%, transparent)" }}>{"█".repeat(bBlocks24)}</span>
                  <span style={{ color: "var(--color-border-soft)" }}>{"░".repeat(24 - bBlocks24)}</span>
                  <span style={{ color: "var(--color-fg-muted)" }}>│ </span>
                  <span style={{ color: "var(--color-fg-dim)" }}>
                    {fmtCompact(stage.b)} {(cvrB * 100).toFixed(i === 0 ? 0 : 1)}%
                  </span>
                </pre>
              </div>
            );
          })}
          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-[var(--color-border-soft)] flex flex-wrap items-center gap-x-4 gap-y-2 text-[10.5px] font-mono text-[var(--color-fg-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono text-[var(--color-accent)]">█</span> A · escape
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono" style={{ color: "color-mix(in srgb, var(--color-accent) 45%, transparent)" }}>█</span> B · control
            </span>
            <span className="ml-auto hidden md:inline">Bar width = CVR from impressions</span>
          </div>
        </div>
      )}
    </Card>
  );
}

/* -------- Sources card — ResourceItem-style rows -------- */

function SourcesCard({ sources, rangeLabel = "14d" }: { sources: SourceRow[]; rangeLabel?: string }) {
  if (sources.length === 0) {
    return (
      <Card title="Top sources" action={<MonoLabel>{rangeLabel}</MonoLabel>}>
        <MutedText>No source data yet.</MutedText>
      </Card>
    );
  }
  const max = Math.max(...sources.map((s) => s.total));
  return (
    <Card title="Top sources" action={<MonoLabel>{rangeLabel}</MonoLabel>}>
      <div className="space-y-2">
        {sources.map((s) => {
          const sharePct = max > 0 ? s.total / max : 0;
          const blocks = clampBlocks(sharePct * 28, 28);
          const cvr = s.total > 0 ? (s.purchases / s.total) * 100 : 0;
          return (
            <div key={s.utm_source} className="flex items-baseline gap-3">
              <div className="w-[80px] sm:w-[100px] shrink-0 text-[12.5px] font-medium tracking-tight truncate">
                {s.utm_source}
              </div>
              <pre
                className="flex-1 leading-none text-[10.5px] tnum overflow-hidden"
                style={{ fontFamily: "var(--font-mono), ui-monospace, monospace", margin: 0 }}
              >
                <span style={{ color: "var(--color-accent)" }}>{"█".repeat(blocks)}</span>
                <span style={{ color: "var(--color-border-soft)" }}>{"░".repeat(28 - blocks)}</span>
              </pre>
              <span className="text-right shrink-0 text-[10.5px] font-mono tnum">
                <span className="text-[var(--color-fg)]">{fmtCompact(s.total)}</span>
                <span className="text-[var(--color-fg-muted)]"> · ${(s.revenue_cents / 100).toFixed(0)}</span>
                {cvr > 0 ? <span className="hidden md:inline text-[var(--color-fg-muted)]"> · {cvr.toFixed(1)}%</span> : null}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* -------- Daily chart -------- */

function ChartCard({ rollups, rangeLabel = "14d" }: { rollups: DailyRollup[]; rangeLabel?: string }) {
  return (
    <Card title="Impressions vs escapes" action={<MonoLabel>{rangeLabel}</MonoLabel>}>
      <DailyChart rollups={rollups} rangeLabel={rangeLabel} />
    </Card>
  );
}

function DailyChart({ rollups, rangeLabel }: { rollups: DailyRollup[]; rangeLabel: string }) {
  if (rollups.length === 0) {
    return <MutedText>Once events arrive, you&apos;ll see a {rangeLabel} trend here.</MutedText>;
  }
  const byDay = new Map<string, { day: string; impressions: number; escapes: number }>();
  for (const r of rollups) {
    const cur = byDay.get(r.day) ?? { day: r.day, impressions: 0, escapes: 0 };
    cur.impressions += r.impressions ?? 0;
    cur.escapes += r.escape_attempts ?? 0;
    byDay.set(r.day, cur);
  }
  const days = Array.from(byDay.values()).sort((a, b) => (a.day < b.day ? -1 : 1));
  const maxV = Math.max(1, ...days.flatMap((d) => [d.impressions, d.escapes]));
  const w = 480;
  const h = 110;
  const x = (i: number) => 6 + (i * (w - 12)) / Math.max(1, days.length - 1);
  const y = (v: number) => h - 12 - ((h - 24) * v) / maxV;
  const linePath = (key: "impressions" | "escapes") =>
    days.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[key])}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[110px]">
        {[35, 60, 85].map((yy) => (
          <line
            key={yy}
            x1="6"
            x2={w - 6}
            y1={yy}
            y2={yy}
            stroke="var(--color-border-soft)"
          />
        ))}
        <path d={linePath("impressions")} fill="none" stroke="var(--color-fg-muted)" strokeWidth="1.5" />
        <path d={linePath("escapes")} fill="none" stroke="var(--color-accent)" strokeWidth="1.75" />
      </svg>
      <div className="mt-1 flex items-center gap-3 text-[10.5px] text-[var(--color-fg-muted)] font-mono">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-[var(--color-fg-muted)]" /> impressions
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-[var(--color-accent)]" /> escapes
        </span>
      </div>
    </div>
  );
}

/* -------- Sample size widget -------- */

function SampleSizeCard({ funnel }: { funnel: Funnel }) {
  const baseA = funnel.impressions.a;
  const baseB = funnel.impressions.b;
  const pCvr = baseB > 0 ? funnel.purchases.b / baseB : 0.02;
  const needed = sampleSizePerBucket(pCvr, 0.3);
  const have = Math.min(baseA, baseB);
  const progressPct = needed > 0 ? Math.min(100, (have / needed) * 100) : 0;
  return (
    <Card title="Sample size" action={<MonoLabel>30% MDE · 95% conf</MonoLabel>}>
      <div className="flex items-center justify-between gap-3 mb-2 text-[12px] text-[var(--color-fg-muted)] font-mono tnum">
        <span>{have.toLocaleString()}</span>
        <span>{Number.isFinite(needed) ? needed.toLocaleString() : "—"} / bucket</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
        <div
          className="h-full bg-[var(--color-accent)] transition-[width] duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-fg-muted)] leading-relaxed">
        {progressPct >= 100
          ? "Sample size sufficient for 95% confidence at 30% MDE."
          : "Don't peek and stop — fixed-horizon test reduces false positives."}
      </p>
    </Card>
  );
}

/* -------- Activity log — recent events -------- */

function ActivityCard({ rows, days }: { rows: ActivityRow[]; days: number }) {
  return (
    <Card
      title="Recent activity"
      action={
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-fg-muted)] font-mono">
          <span className="size-1.5 rounded-full bg-[var(--color-success)] pulse-ring" />
          live · polling every 6s
        </span>
      }
    >
      <div className="-mx-4 -my-3.5">
        <LiveActivity initialRows={rows} days={days} limit={12} />
      </div>
    </Card>
  );
}

/* ActivityRow + formatRelative moved into LiveActivity client component. */
