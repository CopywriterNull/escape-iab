import Link from "next/link";
import {
  getCurrentMerchant,
  getRollups,
  getIabBreakdown,
  totalize,
  zTestTwoProp,
  sampleSizePerBucket,
  type DailyRollup,
  type IabKind,
} from "@/lib/db";

const IAB_LABELS: Record<IabKind, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  messenger: "Messenger",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  pinterest: "Pinterest",
  line: "LINE",
  wechat: "WeChat",
  webview: "WebView",
};

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

  const [rollups, iab] = await Promise.all([
    getRollups(merchant.id, 14),
    getIabBreakdown(merchant.id, 14),
  ]);
  const totals = totalize(rollups);
  const totalImpressions = totals.impressions.a + totals.impressions.b;
  const totalEscapes = totals.escape_attempts.a + totals.escape_attempts.b;
  const escapeRateA =
    totals.impressions.a > 0
      ? (100 * totals.escape_attempts.a) / totals.impressions.a
      : 0;
  const totalIabSum = Object.values(iab).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {merchant.name ?? "Your store"}
          </h1>
          <p className="text-sm text-[var(--color-fg-muted)]">
            Last 14 days · {merchant.domain ?? "no domain set"}
          </p>
        </div>
        <Link
          href="/dashboard/install"
          className="text-sm font-medium px-3.5 py-1.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] hover:opacity-90"
        >
          Get install snippet
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Impressions" value={totalImpressions.toLocaleString()} sub="all bucketed sessions" />
        <Stat label="Escape attempts" value={totalEscapes.toLocaleString()} sub="auto-redirect fired" />
        <Stat label="Bucket A escape rate" value={`${escapeRateA.toFixed(1)}%`} sub="of A impressions" />
        <Stat
          label="Fallback shown"
          value={(totals.fallback_shown.a + totals.fallback_shown.b).toLocaleString()}
          sub={`${(totals.fallback_clicked.a + totals.fallback_clicked.b).toLocaleString()} clicked`}
        />
      </div>

      <RevenueLift totals={totals} />


      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">A/B comparison</h2>
          <span className="text-[11px] text-[var(--color-fg-muted)] font-mono">
            {merchant.ab_enabled ? "A/B on · 50/50" : "A/B off · 100% bucket A"}
          </span>
        </div>
        <ABTable totals={totals} />
        {!merchant.ab_enabled ? (
          <p className="mt-3 text-[11px] text-[var(--color-fg-muted)]">
            Enable A/B testing in <Link href="/dashboard/settings" className="underline">Settings</Link> to start collecting a control bucket.
          </p>
        ) : null}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-6">
          <h2 className="font-semibold">Daily impressions vs escapes</h2>
          <DailyChart rollups={rollups} />
        </div>
        <div className="card p-6">
          <h2 className="font-semibold">In-app browser breakdown</h2>
          {totalIabSum === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-fg-dim)]">
              Nothing yet. Install the snippet and traffic from in-app browsers will appear here.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {(Object.keys(IAB_LABELS) as IabKind[])
                .map((k) => ({ k, n: iab[k] }))
                .filter((r) => r.n > 0)
                .sort((a, b) => b.n - a.n)
                .map(({ k, n }) => (
                  <li key={k} className="flex items-center gap-3">
                    <span className="w-24 text-sm">{IAB_LABELS[k]}</span>
                    <span className="flex-1 h-2 rounded-full bg-[var(--color-bg-elev)] overflow-hidden">
                      <span
                        className="block h-full"
                        style={{
                          width: `${(100 * n) / totalIabSum}%`,
                          background:
                            k === "instagram"
                              ? "var(--color-accent)"
                              : "var(--color-fg-muted)",
                        }}
                      />
                    </span>
                    <span className="text-sm font-mono text-[var(--color-fg-dim)] w-16 text-right">
                      {n.toLocaleString()}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function RevenueLift({ totals }: { totals: ReturnType<typeof totalize> }) {
  const z = zTestTwoProp(
    totals.purchases.a,
    totals.impressions.a,
    totals.purchases.b,
    totals.impressions.b,
  );
  const cvrA = totals.impressions.a > 0 ? (100 * totals.purchases.a) / totals.impressions.a : 0;
  const cvrB = totals.impressions.b > 0 ? (100 * totals.purchases.b) / totals.impressions.b : 0;
  const revenueA = totals.revenue_cents.a / 100;
  const revenueB = totals.revenue_cents.b / 100;
  const rpsA = totals.impressions.a > 0 ? revenueA / totals.impressions.a : 0;
  const rpsB = totals.impressions.b > 0 ? revenueB / totals.impressions.b : 0;
  const rpsLift = rpsB > 0 ? (rpsA - rpsB) / rpsB : null;

  // Sample size: assume baseline ~bucket B CVR (or default 2% if no data yet),
  // 30% MDE for low-volume default.
  const baseline = cvrB > 0 ? cvrB / 100 : 0.02;
  const needed = sampleSizePerBucket(baseline, 0.3);
  const haveA = totals.impressions.a;
  const haveB = totals.impressions.b;
  const havePerBucket = Math.min(haveA, haveB);
  const progressPct = needed > 0 ? Math.min(100, (havePerBucket / needed) * 100) : 0;

  const noData = totals.purchases.a + totals.purchases.b === 0;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold">Revenue lift</h2>
        {noData ? (
          <span className="text-[11px] text-[var(--color-fg-muted)] font-mono">
            no purchases tracked yet · install the Shopify pixel
          </span>
        ) : z?.significant ? (
          <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 text-[var(--color-success)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] border border-[color-mix(in_srgb,var(--color-success)_28%,transparent)]">
            statistically significant · p = {z.pValue.toFixed(3)}
          </span>
        ) : (
          <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">
            {z ? `p = ${z.pValue.toFixed(3)} · need more data` : "—"}
          </span>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <RevTile
          label="CVR · A (escape)"
          value={`${cvrA.toFixed(2)}%`}
          sub={`${totals.purchases.a.toLocaleString()} purchases / ${totals.impressions.a.toLocaleString()}`}
          accent
        />
        <RevTile
          label="CVR · B (control)"
          value={`${cvrB.toFixed(2)}%`}
          sub={`${totals.purchases.b.toLocaleString()} purchases / ${totals.impressions.b.toLocaleString()}`}
        />
        <RevTile
          label="Lift"
          value={
            z?.liftRel != null
              ? `${z.liftRel > 0 ? "+" : ""}${(z.liftRel * 100).toFixed(1)}%`
              : "—"
          }
          sub={z?.liftRel != null ? "relative CVR change" : "need both buckets > 0"}
          positive={z?.liftRel != null && z.liftRel > 0}
        />
        <RevTile
          label="Revenue / session lift"
          value={rpsLift != null ? `${rpsLift > 0 ? "+" : ""}${(rpsLift * 100).toFixed(1)}%` : "—"}
          sub={`A: $${rpsA.toFixed(2)} · B: $${rpsB.toFixed(2)}`}
          positive={rpsLift != null && rpsLift > 0}
        />
      </div>

      <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-4">
        <div className="flex items-center justify-between text-[11px] text-[var(--color-fg-muted)]">
          <span>Sample size · 30% MDE @ 95% confidence, 80% power</span>
          <span className="font-mono">
            {havePerBucket.toLocaleString()} / {Number.isFinite(needed) ? needed.toLocaleString() : "—"} per bucket
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
            ? "Enough data to detect a 30% relative lift. Smaller MDEs need more sessions."
            : "Keep traffic flowing; we'll declare a winner once you cross the threshold."}
        </p>
      </div>
    </div>
  );
}

function RevTile({
  label,
  value,
  sub,
  accent,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-3.5">
      <div className="text-[11px] text-[var(--color-fg-muted)]">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold tracking-tight ${
          accent ? "text-[var(--color-accent)]" : positive ? "text-[var(--color-success)]" : ""
        }`}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-[11px] text-[var(--color-fg-muted)]">{sub}</div> : null}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] text-[var(--color-fg-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {sub ? <div className="mt-1 text-[11px] text-[var(--color-fg-muted)]">{sub}</div> : null}
    </div>
  );
}

function ABTable({ totals }: { totals: ReturnType<typeof totalize> }) {
  const escA = totals.impressions.a > 0
    ? (100 * totals.escape_attempts.a) / totals.impressions.a
    : 0;
  const skipA = totals.impressions.a > 0
    ? (100 * totals.escape_skipped.a) / totals.impressions.a
    : 0;
  return (
    <div className="mt-4 rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div className="grid grid-cols-5 px-4 py-2 text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] bg-[var(--color-bg-elev)]">
        <div>Bucket</div>
        <div className="text-right">Impressions</div>
        <div className="text-right">Escape attempts</div>
        <div className="text-right">Escape rate</div>
        <div className="text-right">Fallback clicked</div>
      </div>
      <Row
        bucket="A · escape"
        accent="text-[var(--color-accent)]"
        impressions={totals.impressions.a}
        escapes={totals.escape_attempts.a}
        rate={`${escA.toFixed(1)}%`}
        fbc={totals.fallback_clicked.a}
      />
      <Row
        bucket="B · control"
        accent="text-[var(--color-fg-muted)]"
        impressions={totals.impressions.b}
        escapes={totals.escape_attempts.b}
        rate="—"
        fbc={totals.fallback_clicked.b}
      />
      <div className="grid grid-cols-5 px-4 py-3 text-sm text-[var(--color-fg-dim)] border-t border-[var(--color-border)]">
        <div className="col-span-2">Skipped (loop guard)</div>
        <div className="text-right font-mono">{totals.escape_skipped.a.toLocaleString()}</div>
        <div className="text-right font-mono">{`${skipA.toFixed(1)}%`}</div>
        <div className="text-right font-mono">{totals.escape_skipped.b.toLocaleString()}</div>
      </div>
    </div>
  );
}

function Row({
  bucket,
  accent,
  impressions,
  escapes,
  rate,
  fbc,
}: {
  bucket: string;
  accent: string;
  impressions: number;
  escapes: number;
  rate: string;
  fbc: number;
}) {
  return (
    <div className="grid grid-cols-5 px-4 py-3 text-sm border-b border-[var(--color-border)] last:border-b-0">
      <div className={`font-medium ${accent}`}>{bucket}</div>
      <div className="text-right font-mono text-[var(--color-fg-dim)]">{impressions.toLocaleString()}</div>
      <div className="text-right font-mono text-[var(--color-fg-dim)]">{escapes.toLocaleString()}</div>
      <div className="text-right font-mono text-[var(--color-fg)]">{rate}</div>
      <div className="text-right font-mono text-[var(--color-fg-dim)]">{fbc.toLocaleString()}</div>
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
  // Aggregate by day across both buckets.
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
          <line key={yy} x1="20" x2={w - 20} y1={yy} y2={yy} stroke="var(--color-border)" strokeDasharray="2 4" />
        ))}
        <path d={linePath("impressions")} fill="none" stroke="var(--color-fg-muted)" strokeWidth="2" />
        <path d={linePath("escapes")} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" />
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
