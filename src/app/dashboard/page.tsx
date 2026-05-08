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

// Force fresh data on every request — the dashboard reads Supabase directly,
// no caching. Otherwise Next.js may serve a cached render with stale counts.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardOverview() {
  const merchant = await getCurrentMerchant();
  if (!merchant) {
    return (
      <div className="card p-8">
        <h2 className="text-lg font-semibold">Setting up…</h2>
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
    <div className="space-y-6">
      <Header merchant={merchant} />
      <Definitions />
      <TopMetrics funnel={funnel} escapeRate={escapeRate} />
      <FunnelTable funnel={funnel} />
      <RevenueLift funnel={funnel} />
      <SourcesCard sources={sources} />
      <DailyChartCard rollups={rollups} />
    </div>
  );
}

function Header({
  merchant,
}: {
  merchant: { name: string | null; domain: string | null; ab_enabled: boolean };
}) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {merchant.name ?? "Your store"}
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Last 14 days · {merchant.domain ?? "no domain set"} ·{" "}
          {merchant.ab_enabled ? "A/B on (50/50)" : "A/B off (100% bucket A)"}
        </p>
      </div>
      <Link
        href="/dashboard/install"
        className="text-sm font-medium px-3.5 py-1.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] hover:opacity-90"
      >
        Get install snippet
      </Link>
    </div>
  );
}

function Definitions() {
  return (
    <div className="card p-6 text-sm">
      <h2 className="font-semibold">How this dashboard works</h2>
      <p className="mt-3 text-[var(--color-fg-dim)] leading-relaxed">
        We measure the <strong>conversion lift</strong> of escaping
        Instagram&apos;s in-app browser, restricted to the population that
        actually benefits from the escape: <strong>visitors who landed on your
        store from a paid Meta ad while inside the Instagram app</strong>.
        Visitors from any other source (organic, email, Google ads, direct,
        Safari, etc.) are excluded — they would never have been in the IAB in
        the first place, so escaping them is irrelevant.
      </p>
      <ul className="mt-4 space-y-2 text-[var(--color-fg-dim)]">
        <li>
          <strong className="text-[var(--color-fg)]">Test population:</strong>{" "}
          IG IAB visitors with <code className="font-mono text-[12px]">fbclid</code> in the URL,
          OR <code className="font-mono text-[12px]">utm_source=facebook|instagram</code> with
          <code className="font-mono text-[12px]"> utm_medium=paid|cpc|ad</code>. They&apos;re bucketed 50/50.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Bucket A (test):</strong>{" "}
          We auto-redirect them out of the IAB into Safari/Chrome via{" "}
          <code className="font-mono text-[12px]">instagram://extbrowser</code>. Apple Pay, Shop Pay
          autofill, and saved sessions all work normally there.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Bucket B (control):</strong>{" "}
          They stay in Instagram&apos;s IAB. A small fraction will manually tap
          the three-dot menu to open in Safari — that&apos;s noise that makes
          our measured lift slightly conservative (real impact is at least
          what we report).
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Impression:</strong> One
          test-population landing on your store. Counted once per visitor per
          page load.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Escape attempt:</strong>{" "}
          We fired the redirect for a Bucket A visitor.
        </li>
        <li>
          <strong className="text-[var(--color-fg)]">Escape rate:</strong>{" "}
          escape_attempts / impressions in Bucket A. Should approach 100%
          unless visitors are hitting the loop guard (already escaped this
          session).
        </li>
      </ul>
    </div>
  );
}

function TopMetrics({
  funnel,
  escapeRate,
}: {
  funnel: Funnel;
  escapeRate: number;
}) {
  const totalImpressions = funnel.impressions.a + funnel.impressions.b;
  const totalEscapes = funnel.escape_attempts.a;
  const totalRevenue =
    (funnel.revenue_cents.a + funnel.revenue_cents.b) / 100;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Stat
        label="Impressions (in test)"
        value={totalImpressions.toLocaleString()}
        sub="paid IG ad clicks in IAB"
      />
      <Stat
        label="Escape attempts"
        value={totalEscapes.toLocaleString()}
        sub={`${funnel.impressions.a.toLocaleString()} bucket A impressions`}
      />
      <Stat
        label="Escape rate"
        value={`${escapeRate.toFixed(1)}%`}
        sub="of bucket A successfully redirected"
      />
      <Stat
        label="Revenue (both buckets)"
        value={`$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        sub={`${(funnel.purchases.a + funnel.purchases.b).toLocaleString()} purchases`}
      />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] text-[var(--color-fg-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
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

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold">Funnel · A vs B</h2>
        <span className="text-[11px] text-[var(--color-fg-muted)] font-mono">
          conversion rate computed off impressions
        </span>
      </div>
      <div className="mt-4 rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] bg-[var(--color-bg-elev)]">
          <div className="col-span-3">Stage</div>
          <div className="col-span-3 text-right">A · escape</div>
          <div className="col-span-3 text-right">B · control</div>
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
          return (
            <div
              key={row.label}
              className="grid grid-cols-12 px-4 py-3 text-sm border-t border-[var(--color-border)] items-center"
            >
              <div className="col-span-3">
                <div className="font-medium">{row.label}</div>
                <div className="text-[11px] text-[var(--color-fg-muted)]">
                  {row.description}
                </div>
              </div>
              <div className="col-span-3 text-right">
                <div className="font-mono">{row.a.toLocaleString()}</div>
                {i > 0 ? (
                  <div className="text-[11px] text-[var(--color-fg-muted)] font-mono">
                    {(cvrA * 100).toFixed(2)}%
                  </div>
                ) : null}
              </div>
              <div className="col-span-3 text-right">
                <div className="font-mono">{row.b.toLocaleString()}</div>
                {i > 0 ? (
                  <div className="text-[11px] text-[var(--color-fg-muted)] font-mono">
                    {(cvrB * 100).toFixed(2)}%
                  </div>
                ) : null}
              </div>
              <div
                className={`col-span-2 text-right font-mono font-semibold ${
                  z?.liftRel != null && z.liftRel > 0
                    ? "text-[var(--color-success)]"
                    : z?.liftRel != null && z.liftRel < 0
                      ? "text-[var(--color-danger)]"
                      : ""
                }`}
              >
                {liftStr}
              </div>
              <div
                className={`col-span-1 text-right font-mono text-[12px] ${
                  sig ? "text-[var(--color-success)]" : "text-[var(--color-fg-muted)]"
                }`}
              >
                {pStr}
              </div>
            </div>
          );
        })}
      </div>
      {funnel.impressions.a + funnel.impressions.b === 0 ? (
        <p className="mt-3 text-[11px] text-[var(--color-fg-muted)]">
          No test-population impressions yet. Once paid IG/FB ad traffic hits
          your store, the funnel populates.
        </p>
      ) : null}
    </div>
  );
}

function RevenueLift({ funnel }: { funnel: Funnel }) {
  const baseA = funnel.impressions.a;
  const baseB = funnel.impressions.b;
  const revA = funnel.revenue_cents.a / 100;
  const revB = funnel.revenue_cents.b / 100;
  const rpsA = baseA > 0 ? revA / baseA : 0;
  const rpsB = baseB > 0 ? revB / baseB : 0;
  const liftRel = rpsB > 0 ? (rpsA - rpsB) / rpsB : null;

  const pCvr = baseB > 0 ? funnel.purchases.b / baseB : 0.02;
  const needed = sampleSizePerBucket(pCvr, 0.3);
  const have = Math.min(baseA, baseB);
  const progressPct = needed > 0 ? Math.min(100, (have / needed) * 100) : 0;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold">Revenue impact</h2>
        <span className="text-[11px] text-[var(--color-fg-muted)] font-mono">
          revenue per impression
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Revenue · A"
          value={`$${revA.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`$${rpsA.toFixed(2)} per impression`}
        />
        <Stat
          label="Revenue · B"
          value={`$${revB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`$${rpsB.toFixed(2)} per impression`}
        />
        <Stat
          label="Revenue / impression lift"
          value={
            liftRel != null
              ? `${liftRel > 0 ? "+" : ""}${(liftRel * 100).toFixed(1)}%`
              : "—"
          }
          sub={liftRel != null ? "A vs B" : "need both buckets > 0"}
        />
        <Stat
          label="Estimated monthly recovery"
          value={
            liftRel != null && liftRel > 0
              ? `$${((rpsA - rpsB) * (baseA + baseB) * 30 / 14).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : "—"
          }
          sub="if escape applied to all test traffic"
        />
      </div>
      <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-4">
        <div className="flex items-center justify-between text-[11px] text-[var(--color-fg-muted)]">
          <span>Sample size · 30% MDE @ 95% confidence, 80% power</span>
          <span className="font-mono">
            {have.toLocaleString()} / {Number.isFinite(needed) ? needed.toLocaleString() : "—"}{" "}
            per bucket
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
          <div
            className="h-full bg-[var(--color-accent)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-fg-muted)]">
          {progressPct >= 100
            ? "Enough data to detect a 30% lift with 95% confidence."
            : "Keep traffic flowing. Don&apos;t stop the test early — peeking inflates false positives."}
        </p>
      </div>
    </div>
  );
}

function SourcesCard({ sources }: { sources: SourceRow[] }) {
  if (sources.length === 0) {
    return (
      <div className="card p-6">
        <h2 className="font-semibold">Top traffic sources</h2>
        <p className="mt-3 text-sm text-[var(--color-fg-dim)]">
          Once impressions arrive with UTM params, source breakdown will populate here.
        </p>
      </div>
    );
  }
  const max = Math.max(...sources.map((s) => s.total));
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Top traffic sources</h2>
        <span className="text-[11px] text-[var(--color-fg-muted)] font-mono">
          all traffic, last 14 days
        </span>
      </div>
      <div className="mt-4 rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] bg-[var(--color-bg-elev)]">
          <div className="col-span-4">Source</div>
          <div className="col-span-3 text-right">Sessions</div>
          <div className="col-span-2 text-right">A / B</div>
          <div className="col-span-1 text-right">Buys</div>
          <div className="col-span-2 text-right">Revenue</div>
        </div>
        {sources.map((s) => {
          const cvr = s.total > 0 ? (100 * s.purchases) / s.total : 0;
          return (
            <div
              key={s.utm_source}
              className="grid grid-cols-12 px-4 py-3 text-sm border-t border-[var(--color-border)]"
            >
              <div className="col-span-4 flex items-center gap-2">
                <span className="font-medium truncate">{s.utm_source}</span>
                {cvr > 0 ? (
                  <span className="text-[10px] font-mono text-[var(--color-fg-muted)]">
                    {cvr.toFixed(2)}% CVR
                  </span>
                ) : null}
              </div>
              <div className="col-span-3 flex items-center gap-2">
                <span className="flex-1 h-1.5 rounded-full bg-[var(--color-bg-elev)] overflow-hidden">
                  <span
                    className="block h-full bg-[var(--color-accent)]"
                    style={{ width: `${(100 * s.total) / max}%` }}
                  />
                </span>
                <span className="font-mono text-[12px] text-[var(--color-fg-dim)] w-14 text-right">
                  {s.total.toLocaleString()}
                </span>
              </div>
              <div className="col-span-2 text-right font-mono text-[12px] text-[var(--color-fg-dim)]">
                {s.bucket_a.toLocaleString()} / {s.bucket_b.toLocaleString()}
              </div>
              <div className="col-span-1 text-right font-mono text-[12px] text-[var(--color-fg-dim)]">
                {s.purchases.toLocaleString()}
              </div>
              <div className="col-span-2 text-right font-mono text-[12px]">
                ${(s.revenue_cents / 100).toFixed(2)}
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
    <div className="card p-6">
      <h2 className="font-semibold">Daily impressions vs escapes</h2>
      <DailyChart rollups={rollups} />
    </div>
  );
}

function DailyChart({ rollups }: { rollups: DailyRollup[] }) {
  if (rollups.length === 0) {
    return (
      <p className="mt-3 text-sm text-[var(--color-fg-dim)]">
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
  const h = 140;
  const x = (i: number) => 20 + (i * (w - 40)) / Math.max(1, days.length - 1);
  const y = (v: number) => h - 16 - ((h - 32) * v) / maxV;
  const linePath = (key: "impressions" | "escapes") =>
    days.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[key])}`).join(" ");
  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[140px]">
        {[40, 70, 100].map((yy) => (
          <line
            key={yy}
            x1="20"
            x2={w - 20}
            y1={yy}
            y2={yy}
            stroke="var(--color-border)"
            strokeDasharray="2 4"
          />
        ))}
        <path
          d={linePath("impressions")}
          fill="none"
          stroke="var(--color-fg-muted)"
          strokeWidth="2"
        />
        <path
          d={linePath("escapes")}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
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
