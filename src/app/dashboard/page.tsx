import Link from "next/link";
import {
  getCurrentMerchant,
  getRollups,
  getSourceBreakdown,
  getTestFunnel,
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

  const [funnel, rollups, sources] = await Promise.all([
    getTestFunnel(merchant.id, 14),
    getRollups(merchant.id, 14),
    getSourceBreakdown(merchant.id, 14, 10),
  ]);

  const escapeRate =
    funnel.impressions.a > 0
      ? (100 * funnel.escape_attempts.a) / funnel.impressions.a
      : 0;

  return (
    <div className="space-y-8">
      <Header merchant={merchant} />
      <HeroKPI funnel={funnel} escapeRate={escapeRate} />
      <FunnelTable funnel={funnel} />
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <SourcesCard sources={sources} />
        </div>
        <div className="lg:col-span-5">
          <DailyChartCard rollups={rollups} />
        </div>
      </div>
      <Definitions />
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
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
          Overview · last 14 days
        </div>
        <h1 className="mt-1.5 h-display text-4xl text-[var(--color-fg)]">
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
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
        style={{ boxShadow: "var(--shadow-cta)" }}
      >
        Get install snippet
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
}

function HeroKPI({
  funnel,
  escapeRate,
}: {
  funnel: Funnel;
  escapeRate: number;
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="card-hi p-7 lg:col-span-7">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
          Revenue per impression — A vs B
        </div>
        <div className={`mt-3 h-display text-6xl ${liftClass}`}>
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
              <span className="font-mono text-[12px] text-[var(--color-fg-muted)]">
                p = {z.pValue < 0.001 ? "<.001" : z.pValue.toFixed(3)}
              </span>
            </>
          ) : null}
        </div>
        {monthlyRecovery > 0 ? (
          <div className="mt-6 inline-flex items-baseline gap-2 rounded-full border border-[var(--color-success)]/30 bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] px-3.5 py-1.5">
            <span className="text-[11px] uppercase tracking-wider text-[var(--color-success)] font-medium">
              Projected monthly
            </span>
            <span className="font-mono tnum text-[var(--color-success)] font-semibold">
              ${monthlyRecovery.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        ) : null}
      </div>

      <div className="lg:col-span-5 grid grid-cols-2 gap-3">
        <KPI label="Impressions" value={totalImpressions.toLocaleString()} sub="in test population" />
        <KPI label="Escapes" value={totalEscapes.toLocaleString()} sub={`${escapeRate.toFixed(0)}% of bucket A`} />
        <KPI
          label="Revenue"
          value={`$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          sub={`${totalPurchases.toLocaleString()} purchases`}
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

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4 lift">
      <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] font-medium">
        {label}
      </div>
      <div className="mt-2 h-section text-2xl tnum">{value}</div>
      {sub ? (
        <div className="mt-1 text-[11px] text-[var(--color-fg-muted)]">{sub}</div>
      ) : null}
    </div>
  );
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
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
            Funnel
          </div>
          <h2 className="mt-1 h-section text-2xl">Bucket A vs Bucket B</h2>
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
        <div className="grid grid-cols-12 px-3 pb-2 text-[10px] uppercase tracking-[0.15em] text-[var(--color-fg-muted)] font-medium border-b border-[var(--color-border)]">
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
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <span className="h-1 w-12 rounded-full bg-[var(--color-bg-elev)] overflow-hidden">
                      <span
                        className="block h-full bg-[var(--color-accent)]"
                        style={{ width: `${(100 * aShare) / maxShare}%` }}
                      />
                    </span>
                    <span className="text-[11px] text-[var(--color-fg-muted)] font-mono tnum">
                      {(cvrA * 100).toFixed(2)}%
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="col-span-3 text-right">
                <div className="font-mono tnum text-sm">{row.b.toLocaleString()}</div>
                {i > 0 ? (
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <span className="h-1 w-12 rounded-full bg-[var(--color-bg-elev)] overflow-hidden">
                      <span
                        className="block h-full bg-[var(--color-fg-muted)]"
                        style={{ width: `${(100 * bShare) / maxShare}%` }}
                      />
                    </span>
                    <span className="text-[11px] text-[var(--color-fg-muted)] font-mono tnum">
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

  return (
    <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="flex items-center justify-between text-[11px] text-[var(--color-fg-muted)]">
        <span className="uppercase tracking-wider font-medium">
          Sample size · 30% MDE @ 95% confidence
        </span>
        <span className="font-mono tnum text-[var(--color-fg-dim)]">
          {have.toLocaleString()} / {Number.isFinite(needed) ? needed.toLocaleString() : "—"}
        </span>
      </div>
      <div className="mt-2.5 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${progressPct}%`,
            background:
              "linear-gradient(90deg, var(--color-accent) 0%, var(--color-accent-2) 100%)",
          }}
        />
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-fg-muted)]">
        {progressPct >= 100
          ? "Enough data to detect a 30% lift with 95% confidence."
          : "Keep traffic flowing. Don’t stop the test early — peeking inflates false-positive rate."}
      </p>
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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
          style={{ boxShadow: "var(--shadow-cta)" }}
        >
          Verify install
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

function SourcesCard({ sources }: { sources: SourceRow[] }) {
  if (sources.length === 0) {
    return (
      <div className="card p-7 h-full">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
          Top traffic sources
        </div>
        <h2 className="mt-1 h-section text-xl">Where visitors come from</h2>
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
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
            Top traffic sources
          </div>
          <h2 className="mt-1 h-section text-xl">Where visitors come from</h2>
        </div>
        <span className="text-[11px] text-[var(--color-fg-muted)] font-mono">
          all traffic · 14d
        </span>
      </div>
      <div className="mt-5 space-y-2.5">
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
                    background:
                      "linear-gradient(90deg, var(--color-accent) 0%, var(--color-accent-2) 100%)",
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

function DailyChartCard({ rollups }: { rollups: DailyRollup[] }) {
  return (
    <div className="card p-7 h-full">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
        Daily volume
      </div>
      <h2 className="mt-1 h-section text-xl">Impressions vs escapes</h2>
      <DailyChart rollups={rollups} />
    </div>
  );
}

function DailyChart({ rollups }: { rollups: DailyRollup[] }) {
  if (rollups.length === 0) {
    return (
      <p className="mt-5 text-sm text-[var(--color-fg-dim)]">
        Once events arrive, you&apos;ll see a 14-day trend here.
      </p>
    );
  }
  const byDay = new Map<
    string,
    { day: string; impressions: number; escapes: number }
  >();
  for (const r of rollups) {
    const cur = byDay.get(r.day) ?? { day: r.day, impressions: 0, escapes: 0 };
    cur.impressions += r.impressions ?? 0;
    cur.escapes += r.escape_attempts ?? 0;
    byDay.set(r.day, cur);
  }
  const days = Array.from(byDay.values()).sort((a, b) => (a.day < b.day ? -1 : 1));
  const maxV = Math.max(1, ...days.flatMap((d) => [d.impressions, d.escapes]));
  const w = 560;
  const h = 160;
  const x = (i: number) => 16 + (i * (w - 32)) / Math.max(1, days.length - 1);
  const y = (v: number) => h - 18 - ((h - 32) * v) / maxV;
  const linePath = (key: "impressions" | "escapes") =>
    days.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[key])}`).join(" ");
  const areaPath = (() => {
    const pts = days
      .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.escapes)}`)
      .join(" ");
    return `${pts} L ${x(days.length - 1)} ${h - 18} L ${x(0)} ${h - 18} Z`;
  })();
  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[160px]">
        <defs>
          <linearGradient id="dailyA" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 80, 120].map((yy) => (
          <line
            key={yy}
            x1="16"
            x2={w - 16}
            y1={yy}
            y2={yy}
            stroke="var(--color-border)"
            strokeDasharray="2 4"
          />
        ))}
        <path d={areaPath} fill="url(#dailyA)" />
        <path
          d={linePath("impressions")}
          fill="none"
          stroke="var(--color-fg-muted)"
          strokeWidth="2"
          strokeDasharray="3 3"
        />
        <path
          d={linePath("escapes")}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-[var(--color-fg-dim)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--color-fg-muted)]" /> Impressions
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--color-accent)]" /> Escape attempts
        </span>
      </div>
    </div>
  );
}

function Definitions() {
  return (
    <details className="card p-7 group">
      <summary className="flex items-center justify-between cursor-pointer list-none">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
            Methodology
          </div>
          <h2 className="mt-1 h-section text-xl">How this dashboard works</h2>
        </div>
        <span className="text-[var(--color-fg-dim)] group-open:rotate-45 transition-transform">+</span>
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
