import Link from "next/link";
import {
  getCurrentMerchant,
  getRollups,
  getSourceBreakdown,
  getTestFunnel,
  getUnattributedPurchaseStats,
  zTestTwoProp,
  sampleSizePerBucket,
  type DailyRollup,
  type Funnel,
  type SourceRow,
} from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardOverview() {
  const merchant = await getCurrentMerchant();
  if (!merchant) {
    return (
      <div className="card p-8">
        <h2 className="text-lg font-semibold tracking-tight">Setting up…</h2>
        <p className="mt-2 text-sm text-[var(--color-fg-dim)]">
          Reload in a moment — we&apos;re creating your merchant record.
        </p>
      </div>
    );
  }

  const [funnel, rollups, sources, unattributed] = await Promise.all([
    getTestFunnel(merchant.id, 14),
    getRollups(merchant.id, 14),
    getSourceBreakdown(merchant.id, 14, 10),
    getUnattributedPurchaseStats(merchant.id, 14),
  ]);

  const escapeRate =
    funnel.impressions.a > 0
      ? (100 * funnel.escape_attempts.a) / funnel.impressions.a
      : 0;

  return (
    <div className="space-y-8">
      <Header merchant={merchant} />
      <HeroKPI funnel={funnel} escapeRate={escapeRate} rollups={rollups} />
      <AttributionGapBanner
        unattributed={unattributed}
        attributedPurchases={funnel.purchases.a + funnel.purchases.b}
        attributedRevenueCents={funnel.revenue_cents.a + funnel.revenue_cents.b}
      />
      <FunnelTable funnel={funnel} />
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <SourcesCard sources={sources} />
        </div>
        <div className="lg:col-span-5">
          <RevenueLiftCard rollups={rollups} />
        </div>
      </div>
      <Definitions />
    </div>
  );
}

function Eyebrow({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div
      className="text-[10px] uppercase tracking-[0.22em] font-semibold inline-flex items-center gap-2"
      style={{ color: muted ? "var(--color-fg-muted)" : "var(--color-accent)" }}
    >
      <span className="size-1 rounded-full bg-[var(--color-accent)]" />
      {children}
    </div>
  );
}

function Header({
  merchant,
}: {
  merchant: { name: string | null; domain: string | null; ab_enabled: boolean };
}) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-4">
      <div>
        <Eyebrow>Overview · last 14 days</Eyebrow>
        <h1 className="mt-3 h-display text-4xl text-[var(--color-fg)]">
          {merchant.name ?? "Your store"}
        </h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-[var(--color-fg-dim)]">
          <span className="font-mono text-[13px]">
            {merchant.domain ?? "no domain set"}
          </span>
          <span className="text-[var(--color-fg-muted)]">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`size-1.5 rounded-full ${
                merchant.ab_enabled
                  ? "bg-[var(--color-success)] pulse-ring"
                  : "bg-[var(--color-fg-muted)]"
              }`}
            />
            {merchant.ab_enabled ? "A/B on · 50/50" : "A/B off · 100% bucket A"}
          </span>
        </div>
      </div>
      <Link
        href="/dashboard/install"
        className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
        style={{ boxShadow: "var(--shadow-cta)" }}
      >
        <span>Get install snippet</span>
        <span className="btn-icon">
          <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </Link>
    </div>
  );
}

function HeroKPI({
  funnel,
  escapeRate,
  rollups,
}: {
  funnel: Funnel;
  escapeRate: number;
  rollups: DailyRollup[];
}) {
  const baseA = funnel.impressions.a;
  const baseB = funnel.impressions.b;
  const revA = funnel.revenue_cents.a / 100;
  const revB = funnel.revenue_cents.b / 100;
  const rpsA = baseA > 0 ? revA / baseA : 0;
  const rpsB = baseB > 0 ? revB / baseB : 0;
  const liftRel = rpsB > 0 ? (rpsA - rpsB) / rpsB : null;
  const monthlyRecovery =
    liftRel != null && liftRel > 0
      ? ((rpsA - rpsB) * (baseA + baseB) * 30) / 14
      : 0;

  const z = zTestTwoProp(
    funnel.purchases.a,
    baseA,
    funnel.purchases.b,
    baseB,
  );
  const liftClass =
    liftRel == null
      ? "text-[var(--color-fg-muted)]"
      : liftRel > 0
        ? "text-[var(--color-success)]"
        : "text-[var(--color-danger)]";

  const totalImpressions = baseA + baseB;
  const totalEscapes = funnel.escape_attempts.a;
  const totalRevenue = revA + revB;
  const totalPurchases = funnel.purchases.a + funnel.purchases.b;

  const series = buildDailySeries(rollups);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="card-hi p-7 lg:col-span-7 relative overflow-hidden">
        <div className="absolute inset-0 mesh-bg opacity-50 pointer-events-none" />
        <div className="relative">
          <Eyebrow muted>Revenue per impression — A vs B</Eyebrow>
          <div className={`mt-3 h-display text-6xl tnum ${liftClass}`}>
            {liftRel == null
              ? "—"
              : `${liftRel > 0 ? "+" : ""}${(liftRel * 100).toFixed(1)}%`}
          </div>
          <div className="mt-3 text-sm text-[var(--color-fg-dim)] max-w-prose leading-relaxed">
            {liftRel == null
              ? "Need impressions in both buckets to compute lift."
              : liftRel > 0
                ? `Bucket A (escape) is converting at $${rpsA.toFixed(2)} per impression vs $${rpsB.toFixed(2)} for control.`
                : `Control is currently outperforming the test bucket. Wait for more data — early results are noisy.`}
            {z?.pValue != null ? (
              <>
                {" "}
                <span className="font-mono text-[12px] text-[var(--color-fg-muted)] tnum">
                  p = {z.pValue < 0.001 ? "<.001" : z.pValue.toFixed(3)}
                </span>
              </>
            ) : null}
          </div>
          {monthlyRecovery > 0 ? (
            <div className="mt-6 inline-flex items-baseline gap-2 rounded-full border border-[var(--color-success)]/30 bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] px-3.5 py-1.5">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-success)] font-semibold">
                Projected monthly
              </span>
              <span className="font-mono tnum text-[var(--color-success)] font-semibold">
                ${monthlyRecovery.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="lg:col-span-5 grid grid-cols-2 gap-3">
        <KPI
          label="Impressions"
          value={totalImpressions.toLocaleString()}
          sub="in test population"
          spark={series.impressions}
        />
        <KPI
          label="Escapes"
          value={totalEscapes.toLocaleString()}
          sub={`${escapeRate.toFixed(0)}% of bucket A`}
          spark={series.escapes}
        />
        <KPI
          label="Revenue"
          value={`$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          sub={`${totalPurchases.toLocaleString()} purchases`}
          spark={series.revenue}
          color="var(--color-success)"
        />
        <KPI
          label="A vs B split"
          value={
            totalImpressions > 0
              ? `${Math.round((100 * baseA) / totalImpressions)}/${Math.round((100 * baseB) / totalImpressions)}`
              : "—"
          }
          sub="should hover ~50/50"
        />
      </div>
    </div>
  );
}

function AttributionGapBanner({
  unattributed,
  attributedPurchases,
  attributedRevenueCents,
}: {
  unattributed: { count: number; revenue_cents: number };
  attributedPurchases: number;
  attributedRevenueCents: number;
}) {
  if (unattributed.count === 0 && attributedPurchases === 0) return null;
  const totalPurchases = unattributed.count + attributedPurchases;
  const totalRevenue =
    (unattributed.revenue_cents + attributedRevenueCents) / 100;
  const attribPct =
    totalPurchases > 0
      ? Math.round((100 * attributedPurchases) / totalPurchases)
      : 0;
  const showWarning = unattributed.count > attributedPurchases * 2;

  return (
    <div className={`card-hi p-6 ${showWarning ? "border-[var(--color-danger)]/30" : ""}`}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`size-10 rounded-xl grid place-items-center shrink-0 ${
              showWarning
                ? "bg-[var(--color-danger)]/15 text-[var(--color-danger)]"
                : "bg-[var(--color-accent)]/12 text-[var(--color-accent)]"
            }`}
          >
            <svg viewBox="0 0 16 16" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 2v4M8 10v4M2 8h4M10 8h4" strokeLinecap="round" />
              <circle cx="8" cy="8" r="2" />
            </svg>
          </span>
          <div>
            <Eyebrow muted>All purchases (pixel-recorded)</Eyebrow>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="h-section text-2xl tnum">
                {totalPurchases.toLocaleString()} purchases · ${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-right">
            <div className="text-[11px] text-[var(--color-fg-muted)]">Attributed to A/B</div>
            <div className="font-mono tnum text-[var(--color-fg)] font-medium">
              {attributedPurchases} ({attribPct}%)
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-[var(--color-fg-muted)]">Unattributed</div>
            <div className={`font-mono tnum font-medium ${showWarning ? "text-[var(--color-danger)]" : "text-[var(--color-fg-dim)]"}`}>
              {unattributed.count} (${(unattributed.revenue_cents / 100).toFixed(0)})
            </div>
          </div>
        </div>
      </div>
      {showWarning ? (
        <p className="mt-4 text-[11px] text-[var(--color-fg-dim)] leading-relaxed border-t border-[var(--color-border-soft)] pt-3">
          Most purchases aren&apos;t joining to a test impression. Likely cause:
          Shopify checkout uses a different cookie context (Shop Pay subdomain
          or new checkout extensibility) so <code className="font-mono text-[10px]">event.clientId</code> at
          <code className="font-mono text-[10px]"> checkout_completed</code> doesn&apos;t match the storefront
          <code className="font-mono text-[10px]"> _shopify_y</code>. Multi-key join (fbclid / cart_token) and
          server-side order webhook are the proper fixes — see NOTES.md.
        </p>
      ) : null}
    </div>
  );
}

function KPI({
  label,
  value,
  sub,
  spark,
  color = "var(--color-accent)",
}: {
  label: string;
  value: string;
  sub?: string;
  spark?: number[];
  color?: string;
}) {
  return (
    <div className="card p-4 lift relative overflow-hidden">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-semibold">
        {label}
      </div>
      <div className="mt-2 h-section text-2xl tnum">{value}</div>
      <div className="mt-1 flex items-end justify-between gap-2">
        {sub ? (
          <div className="text-[11px] text-[var(--color-fg-muted)] leading-tight">{sub}</div>
        ) : <span />}
        {spark && spark.length > 1 ? (
          <Sparkline data={spark} color={color} />
        ) : null}
      </div>
    </div>
  );
}

function Sparkline({
  data,
  color = "var(--color-accent)",
  width = 64,
  height = 22,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const path = data
    .map((v, i) => {
      const x = i * step;
      const y = height - 2 - ((height - 4) * v) / max;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const fillPath = `${path} L ${width.toFixed(1)} ${height} L 0 ${height} Z`;
  const lastV = data[data.length - 1];
  const lastY = height - 2 - ((height - 4) * lastV) / max;
  const id = `sg-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(data.length - 1) * step} cy={lastY} r="1.8" fill={color} />
    </svg>
  );
}

type DailySeries = {
  impressions: number[];
  escapes: number[];
  revenue: number[];
};

function buildDailySeries(rollups: DailyRollup[]): DailySeries {
  const map = new Map<string, { imp: number; esc: number; rev: number }>();
  for (const r of rollups) {
    const cur = map.get(r.day) ?? { imp: 0, esc: 0, rev: 0 };
    cur.imp += r.impressions ?? 0;
    cur.esc += r.escape_attempts ?? 0;
    cur.rev += (r.revenue_cents ?? 0) / 100;
    map.set(r.day, cur);
  }
  const days = Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
  return {
    impressions: days.map(([, v]) => v.imp),
    escapes: days.map(([, v]) => v.esc),
    revenue: days.map(([, v]) => v.rev),
  };
}

function FunnelTable({ funnel }: { funnel: Funnel }) {
  type Row = {
    label: string;
    a: number;
    b: number;
    description: string;
  };
  const rows: Row[] = [
    {
      label: "Impressions",
      a: funnel.impressions.a,
      b: funnel.impressions.b,
      description: "Test-population landings",
    },
    {
      label: "Product viewed",
      a: funnel.product_viewed.a,
      b: funnel.product_viewed.b,
      description: "Visited a /products/ page",
    },
    {
      label: "Add to cart",
      a: funnel.add_to_cart.a,
      b: funnel.add_to_cart.b,
      description: "Added something to cart",
    },
    {
      label: "Checkout started",
      a: funnel.checkout_started.a,
      b: funnel.checkout_started.b,
      description: "Reached the checkout page",
    },
    {
      label: "Purchase",
      a: funnel.purchases.a,
      b: funnel.purchases.b,
      description: "Completed checkout",
    },
  ];

  const baseA = funnel.impressions.a;
  const baseB = funnel.impressions.b;
  const empty = baseA + baseB === 0;

  if (empty) {
    return <EmptyState />;
  }

  return (
    <div className="card-hi p-7">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Eyebrow>Funnel</Eyebrow>
          <h2 className="mt-2 h-section text-2xl">Bucket A vs Bucket B</h2>
        </div>
        <div className="inline-flex items-center gap-4 text-[11px] text-[var(--color-fg-dim)] font-mono tnum">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[var(--color-accent)]" /> A · escape
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[var(--color-fg-muted)]" /> B · control
          </span>
        </div>
      </div>

      <div className="mt-6 -mx-2">
        <div className="grid grid-cols-12 px-3 pb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-semibold border-b border-[var(--color-border)]">
          <div className="col-span-3">Stage</div>
          <div className="col-span-3 text-right">A</div>
          <div className="col-span-3 text-right">B</div>
          <div className="col-span-2 text-right">Lift</div>
          <div className="col-span-1 text-right">p</div>
        </div>
        {rows.map((row, i) => {
          const cvrA = baseA > 0 ? row.a / baseA : 0;
          const cvrB = baseB > 0 ? row.b / baseB : 0;
          const z =
            i === 0
              ? null
              : zTestTwoProp(row.a, baseA, row.b, baseB);
          const liftStr =
            z?.liftRel != null
              ? `${z.liftRel > 0 ? "+" : ""}${(z.liftRel * 100).toFixed(0)}%`
              : "—";
          const pStr =
            z?.pValue != null
              ? z.pValue < 0.001
                ? "<.001"
                : z.pValue.toFixed(3)
              : "—";
          const sig = z?.significant === true;
          const liftColor =
            z?.liftRel == null
              ? "text-[var(--color-fg-muted)]"
              : z.liftRel > 0
                ? "text-[var(--color-success)]"
                : "text-[var(--color-danger)]";
          const aShare = baseA > 0 ? row.a / baseA : 0;
          const bShare = baseB > 0 ? row.b / baseB : 0;
          const maxShare = Math.max(aShare, bShare, 0.01);
          return (
            <div
              key={row.label}
              className="grid grid-cols-12 px-3 py-4 items-center border-b border-[var(--color-border-soft)] last:border-b-0 hover:bg-[var(--color-card-hi)]/40 transition-colors"
            >
              <div className="col-span-3">
                <div className="text-sm font-medium tracking-tight">{row.label}</div>
                <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
                  {row.description}
                </div>
              </div>
              <div className="col-span-3 text-right">
                <div className="font-mono tnum text-sm">{row.a.toLocaleString()}</div>
                {i > 0 ? (
                  <div className="mt-1.5 flex items-center justify-end gap-2">
                    <span className="h-1.5 w-20 rounded-full bg-[var(--color-bg-elev)] overflow-hidden">
                      <span
                        className="block h-full bg-[var(--color-accent)]"
                        style={{ width: `${(100 * aShare) / maxShare}%` }}
                      />
                    </span>
                    <span className="text-[11px] text-[var(--color-fg-muted)] font-mono tnum w-12 text-right">
                      {(cvrA * 100).toFixed(2)}%
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="col-span-3 text-right">
                <div className="font-mono tnum text-sm">{row.b.toLocaleString()}</div>
                {i > 0 ? (
                  <div className="mt-1.5 flex items-center justify-end gap-2">
                    <span className="h-1.5 w-20 rounded-full bg-[var(--color-bg-elev)] overflow-hidden">
                      <span
                        className="block h-full bg-[var(--color-fg-muted)]"
                        style={{ width: `${(100 * bShare) / maxShare}%` }}
                      />
                    </span>
                    <span className="text-[11px] text-[var(--color-fg-muted)] font-mono tnum w-12 text-right">
                      {(cvrB * 100).toFixed(2)}%
                    </span>
                  </div>
                ) : null}
              </div>
              <div
                className={`col-span-2 text-right font-mono tnum text-sm font-semibold ${liftColor}`}
              >
                {liftStr}
              </div>
              <div
                className={`col-span-1 text-right font-mono tnum text-[12px] ${
                  sig ? "text-[var(--color-success)]" : "text-[var(--color-fg-muted)]"
                }`}
              >
                {pStr}
              </div>
            </div>
          );
        })}
      </div>

      <SampleSizeWidget funnel={funnel} />
    </div>
  );
}

function SampleSizeWidget({ funnel }: { funnel: Funnel }) {
  const baseA = funnel.impressions.a;
  const baseB = funnel.impressions.b;
  const pCvr = baseB > 0 ? funnel.purchases.b / baseB : 0.02;
  const needed = sampleSizePerBucket(pCvr, 0.3);
  const have = Math.min(baseA, baseB);
  const progressPct = needed > 0 ? Math.min(100, (have / needed) * 100) : 0;

  const dailyRate = baseA / 14;
  const remaining = Math.max(0, needed - have);
  const etaDays =
    dailyRate > 0 && Number.isFinite(needed)
      ? Math.ceil(remaining / dailyRate)
      : null;

  return (
    <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
      <div className="flex items-baseline justify-between flex-wrap gap-2 text-[11px]">
        <span className="uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
          Sample size · 30% MDE @ 95% confidence
        </span>
        <span className="font-mono tnum text-[var(--color-fg-dim)]">
          {have.toLocaleString()} / {Number.isFinite(needed) ? needed.toLocaleString() : "—"}
        </span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${progressPct}%`,
            background: "var(--color-accent)",
          }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-[12px] text-[var(--color-fg-dim)]">
        <span>
          {progressPct >= 100
            ? "Enough data to detect a 30% lift with 95% confidence."
            : "Don't stop the test early — peeking inflates false-positive rate."}
        </span>
        {etaDays != null && progressPct < 100 ? (
          <span className="font-mono tnum text-[var(--color-fg)]">
            ETA {etaDays}d at current pace
          </span>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-12 text-center">
      <div className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev)]">
        <svg viewBox="0 0 24 24" className="size-6 text-[var(--color-fg-muted)]" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 19V5m0 14h18M7 15l4-4 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="mt-5 h-section text-xl">No test data yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-fg-dim)] leading-relaxed">
        Once paid IG / FB ad traffic lands on your store, the funnel populates here. The first events typically arrive within a few minutes of install.
      </p>
      <div className="mt-6 flex items-center justify-center gap-2">
        <Link
          href="/dashboard/install"
          className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
          style={{ boxShadow: "var(--shadow-cta)" }}
        >
          <span>Verify install</span>
          <span className="btn-icon">
            <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </Link>
      </div>
    </div>
  );
}

function SourcesCard({ sources }: { sources: SourceRow[] }) {
  if (sources.length === 0) {
    return (
      <div className="card p-7 h-full">
        <Eyebrow>Top traffic sources</Eyebrow>
        <h2 className="mt-2 h-section text-xl">Where visitors come from</h2>
        <p className="mt-4 text-sm text-[var(--color-fg-dim)]">
          Once impressions arrive with UTM params, source breakdown will populate here.
        </p>
      </div>
    );
  }
  const max = Math.max(...sources.map((s) => s.total));
  return (
    <div className="card p-7 h-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Eyebrow>Top traffic sources</Eyebrow>
          <h2 className="mt-2 h-section text-xl">Where visitors come from</h2>
        </div>
        <span className="text-[11px] text-[var(--color-fg-muted)] font-mono">
          all traffic · 14d
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {sources.map((s) => {
          const cvr = s.total > 0 ? (100 * s.purchases) / s.total : 0;
          const widthPct = (100 * s.total) / max;
          return (
            <div key={s.utm_source} className="group">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium tracking-tight truncate">{s.utm_source}</span>
                <span className="font-mono tnum text-[12px] text-[var(--color-fg-dim)]">
                  {s.total.toLocaleString()} {cvr > 0 ? `· ${cvr.toFixed(2)}% CVR` : ""}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-[var(--color-bg-elev)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${widthPct}%`,
                    background: "var(--color-accent)",
                  }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--color-fg-muted)] font-mono">
                <span>
                  A {s.bucket_a.toLocaleString()} · B {s.bucket_b.toLocaleString()}
                </span>
                <span>${(s.revenue_cents / 100).toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RevenueLiftCard({ rollups }: { rollups: DailyRollup[] }) {
  const series = buildBucketedRevPerImpression(rollups);
  return (
    <div className="card p-7 h-full">
      <Eyebrow>Revenue per impression</Eyebrow>
      <h2 className="mt-2 h-section text-xl">Lift over time · A vs B</h2>
      {series.days.length === 0 ? (
        <p className="mt-5 text-sm text-[var(--color-fg-dim)]">
          Once revenue events arrive, you&apos;ll see the daily lift trend here.
        </p>
      ) : (
        <RevPerImpressionChart series={series} />
      )}
    </div>
  );
}

type BucketedSeries = {
  days: string[];
  rpsA: number[];
  rpsB: number[];
};

function buildBucketedRevPerImpression(rollups: DailyRollup[]): BucketedSeries {
  const map = new Map<
    string,
    { aRev: number; aImp: number; bRev: number; bImp: number }
  >();
  for (const r of rollups) {
    const cur = map.get(r.day) ?? { aRev: 0, aImp: 0, bRev: 0, bImp: 0 };
    if (r.bucket === "b") {
      cur.bRev += (r.revenue_cents ?? 0) / 100;
      cur.bImp += r.impressions ?? 0;
    } else {
      cur.aRev += (r.revenue_cents ?? 0) / 100;
      cur.aImp += r.impressions ?? 0;
    }
    map.set(r.day, cur);
  }
  const ordered = Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
  return {
    days: ordered.map(([d]) => d),
    rpsA: ordered.map(([, v]) => (v.aImp > 0 ? v.aRev / v.aImp : 0)),
    rpsB: ordered.map(([, v]) => (v.bImp > 0 ? v.bRev / v.bImp : 0)),
  };
}

function RevPerImpressionChart({ series }: { series: BucketedSeries }) {
  const w = 560;
  const h = 160;
  const n = series.days.length;
  const max = Math.max(0.01, ...series.rpsA, ...series.rpsB);
  const x = (i: number) => 16 + (i * (w - 32)) / Math.max(1, n - 1);
  const y = (v: number) => h - 22 - ((h - 38) * v) / max;
  const path = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const fillA = `${path(series.rpsA)} L ${x(n - 1)} ${h - 22} L ${x(0)} ${h - 22} Z`;
  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[160px]">
        <defs>
          <linearGradient id="liftA" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 80, 120].map((yy) => (
          <line key={yy} x1="16" x2={w - 16} y1={yy} y2={yy} stroke="var(--color-border)" strokeDasharray="2 4" />
        ))}
        <path d={fillA} fill="url(#liftA)" />
        <path
          d={path(series.rpsB)}
          fill="none"
          stroke="var(--color-fg-muted)"
          strokeWidth="2"
          strokeDasharray="3 4"
          strokeLinecap="round"
        />
        <path
          d={path(series.rpsA)}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {n > 0 ? (
          <>
            <circle cx={x(n - 1)} cy={y(series.rpsA[n - 1])} r="4" fill="var(--color-accent)" />
            <circle cx={x(n - 1)} cy={y(series.rpsA[n - 1])} r="8" fill="var(--color-accent)" opacity="0.18" />
          </>
        ) : null}
      </svg>
      <div className="mt-2 flex items-center justify-between gap-4 text-[11px] text-[var(--color-fg-dim)]">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[var(--color-accent)]" /> A · escape
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[var(--color-fg-muted)]" /> B · control
          </span>
        </div>
        <span className="font-mono text-[var(--color-fg-muted)] tnum">$/impression</span>
      </div>
    </div>
  );
}

function Definitions() {
  return (
    <details className="card p-7 group">
      <summary className="flex items-center justify-between cursor-pointer list-none">
        <div>
          <Eyebrow muted>Methodology</Eyebrow>
          <h2 className="mt-2 h-section text-xl">How this dashboard works</h2>
        </div>
        <span className="size-8 rounded-full grid place-items-center border border-[var(--color-border)] text-[var(--color-fg-dim)] group-open:rotate-45 group-open:bg-[var(--color-accent)] group-open:text-white group-open:border-transparent transition-all duration-200">
          <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M6 2v8M2 6h8" strokeLinecap="round" />
          </svg>
        </span>
      </summary>
      <div className="mt-5 grid md:grid-cols-2 gap-x-10 gap-y-4 text-sm text-[var(--color-fg-dim)]">
        <p className="md:col-span-2 leading-relaxed">
          We measure the <strong className="text-[var(--color-fg)]">conversion lift</strong> of
          escaping Instagram&apos;s in-app browser, restricted to the population that actually
          benefits: <strong className="text-[var(--color-fg)]">visitors who landed from a paid
          Meta ad while inside the Instagram app</strong>. Visitors from any other source are
          excluded — they wouldn&apos;t have been in the IAB anyway.
        </p>
        <DefRow term="Test population">
          IG IAB visitors with <code className="font-mono text-[12px]">fbclid</code> in the URL,
          OR <code className="font-mono text-[12px]">utm_source=facebook|instagram</code> with
          <code className="font-mono text-[12px]"> utm_medium=paid|cpc|ad</code>. 50/50 bucketed.
        </DefRow>
        <DefRow term="Bucket A · escape">
          Auto-redirected out of the IAB into Safari/Chrome via <code className="font-mono text-[12px]">instagram://extbrowser</code>. Apple Pay, Shop Pay, saved sessions all work.
        </DefRow>
        <DefRow term="Bucket B · control">
          Stays in IAB. Some users will manually tap the three-dot menu — that&apos;s noise that makes our measured lift conservative.
        </DefRow>
        <DefRow term="Impression">
          One test-population landing. Counted once per pageview.
        </DefRow>
        <DefRow term="Escape attempt">
          We fired the redirect for a Bucket A visitor.
        </DefRow>
        <DefRow term="Escape rate">
          escape_attempts / Bucket A impressions. Approaches 100% unless visitors hit the loop guard.
        </DefRow>
      </div>
    </details>
  );
}

function DefRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[var(--color-fg)] font-medium">{term}</div>
      <div className="mt-1 leading-relaxed">{children}</div>
    </div>
  );
}
