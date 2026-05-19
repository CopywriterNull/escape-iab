import Link from "next/link";
import {
  getCurrentMerchant,
  getEnabledDashboardIabKinds,
  getSourceBreakdown,
  getTestFunnel,
  getUnattributedPurchaseStats,
  type Funnel,
  type SourceRow,
} from "@/lib/db";
import { evaluateTestValidity, getReportMetrics } from "@/lib/test-validity";
import { PixelIcon } from "@/components/PixelIcon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{ range?: string }>;
type Range = { key: string; label: string; days: number };

const RANGES: Range[] = [
  { key: "7d", label: "7d", days: 7 },
  { key: "14d", label: "14d", days: 14 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
];

function parseRange(v: string | undefined): Range {
  return RANGES.find((r) => r.key === v) ?? RANGES[2];
}

const compactNF = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return "-";
  return Math.abs(n) >= 10_000 ? compactNF.format(n) : n.toLocaleString();
}

function fmtUsdCents(cents: number, opts?: { compact?: boolean }): string {
  const dollars = cents / 100;
  if (!Number.isFinite(dollars)) return "-";
  if (opts?.compact && Math.abs(dollars) >= 10_000) return `$${compactNF.format(dollars)}`;
  return `$${dollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(v: number | null, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "-";
  return `${v > 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;
}

function fmtRate(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "-";
  return `${(v * 100).toFixed(2)}%`;
}

export default async function ClientReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [sp, merchant] = await Promise.all([searchParams, getCurrentMerchant()]);
  const range = parseRange(sp.range);

  if (!merchant) {
    return (
      <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)] p-6">
        <div className="text-[13px] text-[var(--color-fg-dim)]">No merchant yet.</div>
      </div>
    );
  }

  const [funnel, sources, unattributed] = await Promise.all([
    getTestFunnel(merchant.id, range.days),
    getSourceBreakdown(merchant.id, range.days, 6),
    getUnattributedPurchaseStats(merchant.id, range.days),
  ]);
  const metrics = getReportMetrics(funnel);
  const validity = evaluateTestValidity(funnel, {
    observedDays: range.days,
    minDays: Math.min(14, range.days),
    mdeRel: 0.3,
  });
  const platforms = getEnabledDashboardIabKinds(merchant)
    .map((k) => k[0].toUpperCase() + k.slice(1))
    .join(" + ");
  const confidencePct = validity.confidence == null ? null : Math.round(validity.confidence * 100);
  const projected = metrics.projectedRevenueDeltaCents;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
            Client report
          </div>
          <h1 className="mt-1.5 h-display text-[30px] tracking-tight">
            {merchant.name ?? "Merchant"} test readout
          </h1>
          <div className="mt-1 text-[12px] font-mono text-[var(--color-fg-muted)]">
            {merchant.domain ?? "no domain"} · {platforms} · last {range.label}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <RangeLinks active={range.key} />
          <button
            type="button"
            disabled
            title="Next step: public token or password-protected report links"
            className="h-8 rounded-md border border-[var(--color-border-soft)] px-3 text-[11.5px] font-medium text-[var(--color-fg-muted)]"
          >
            Share link soon
          </button>
        </div>
      </div>

      <section className={`rounded-lg border p-5 ${validityClass(validity.level)}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.16em] font-mono">Validity</span>
              <span className="pill pill-muted">{validity.label}</span>
              {confidencePct != null ? <span className="pill pill-muted">{confidencePct}% confidence</span> : null}
            </div>
            <div className="mt-2 text-[20px] md:text-[24px] font-semibold tracking-tight">
              {validity.headline}
            </div>
            <div className="mt-1.5 text-[12.5px] text-[var(--color-fg-dim)] max-w-3xl">
              This page is meant to be client-safe: directional numbers stay labeled directional until traffic,
              purchase signal, sample size, and confidence are strong enough.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-[280px]">
            <MiniStat label="Sample progress" value={`${Math.round(validity.sample.progress * 100)}%`} />
            <MiniStat label="Need / bucket" value={validity.sample.requiredPerBucket ? fmtCompact(validity.sample.requiredPerBucket) : "-"} />
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="RPV lift" value={fmtPct(metrics.rpvLift)} tone={toneFor(metrics.rpvLift)} sub={`A ${fmtRpv(metrics.rpv.a)} · B ${fmtRpv(metrics.rpv.b)}`} />
        <Kpi label="CVR lift" value={fmtPct(metrics.cvrLift)} tone={toneFor(metrics.cvrLift)} sub={`A ${fmtRate(metrics.cvr.a)} · B ${fmtRate(metrics.cvr.b)}`} />
        <Kpi label="Projected delta" value={projected == null ? "-" : fmtUsdCents(projected, { compact: true })} tone={toneFor(projected)} sub="if 100% got escape" />
        <Kpi label="Revenue tracked" value={fmtUsdCents(metrics.revenueCents.total, { compact: true })} sub={`${fmtCompact(metrics.purchases.total)} purchases`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="lg:col-span-7 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)]">
          <Header title="Funnel proof" sub="Bucket A is escape. Bucket B is control." />
          <FunnelProof funnel={funnel} />
        </section>

        <section className="lg:col-span-5 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)]">
          <Header title="Validity checks" sub="What must be true before calling the test." />
          <div className="px-4 py-3 space-y-2">
            {validity.checks.map((check) => (
              <div key={check.key} className="flex items-start gap-2 rounded-md border border-[var(--color-border-soft)] px-3 py-2">
                <PixelIcon
                  name={check.passed ? "check" : "clock"}
                  size={13}
                  className={check.passed ? "mt-0.5 text-[var(--color-success)]" : "mt-0.5 text-[var(--color-fg-muted)]"}
                />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium">{check.label}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)] font-mono tnum">{check.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="lg:col-span-7 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)]">
          <Header title="Traffic sources" sub="Where test population is coming from." />
          <Sources rows={sources} />
        </section>
        <section className="lg:col-span-5 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)]">
          <Header title="Client caveats" sub="Keep this visible until the test is ready." />
          <div className="px-4 py-3 space-y-3 text-[12.5px] text-[var(--color-fg-dim)] leading-relaxed">
            <p>
              {unattributed.count.toLocaleString()} purchase rows in this window were not joined to the A/B population
              {unattributed.revenue_cents > 0 ? ` (${fmtUsdCents(unattributed.revenue_cents, { compact: true })}).` : "."}
            </p>
            <p>
              Treat the headline as directional until the validity panel says ready. Early tests can swing from one or two high-AOV orders.
            </p>
            <p>
              The safest client phrasing is lift in revenue per visitor, not raw recovered revenue, until the test is fully powered.
            </p>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)] p-4">
        <div className="flex items-start gap-3">
          <PixelIcon name="arrow-up-right" size={15} className="mt-0.5 text-[var(--color-accent)]" />
          <div>
            <div className="text-[13px] font-semibold tracking-tight">Recommended next step</div>
            <div className="mt-1 text-[12.5px] text-[var(--color-fg-dim)]">
              {validity.level === "ready"
                ? "Package this page as a public report link with a token and expiry."
                : "Keep the A/B running, use this page internally on calls, and wait for the sample-size/confidence checks before calling a winner."}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function RangeLinks({ active }: { active: string }) {
  return (
    <div className="inline-flex rounded-md border border-[var(--color-border-soft)] bg-[var(--color-card)] p-[2px]">
      {RANGES.map((r) => (
        <Link
          key={r.key}
          href={r.key === "30d" ? "/dashboard/report" : `/dashboard/report?range=${r.key}`}
          className={`px-2.5 py-1 text-[11.5px] rounded font-mono ${
            active === r.key ? "bg-[var(--color-bg)] text-[var(--color-fg)]" : "text-[var(--color-fg-muted)]"
          }`}
          scroll={false}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="px-4 py-3 border-b border-[var(--color-border-soft)] flex items-baseline justify-between gap-3">
      <div>
        <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
        <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">{sub}</div>
      </div>
    </div>
  );
}

function FunnelProof({ funnel }: { funnel: Funnel }) {
  const rows = [
    { label: "Impressions", a: funnel.impressions.a, b: funnel.impressions.b },
    { label: "Add to cart", a: funnel.add_to_cart.a, b: funnel.add_to_cart.b },
    { label: "Checkout started", a: funnel.checkout_started.a, b: funnel.checkout_started.b },
    { label: "Purchase", a: funnel.purchases.a, b: funnel.purchases.b },
  ];
  const baseA = funnel.impressions.a;
  const baseB = funnel.impressions.b;

  return (
    <div className="px-4 py-3 divide-y divide-[var(--color-border-soft)]">
      {rows.map((row, idx) => {
        const rateA = baseA > 0 ? row.a / baseA : null;
        const rateB = baseB > 0 ? row.b / baseB : null;
        const lift = rateA != null && rateB != null && rateB > 0 ? (rateA - rateB) / rateB : null;
        return (
          <div key={row.label} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="text-[12.5px] font-medium">{row.label}</div>
                <div className="mt-0.5 text-[10.5px] font-mono text-[var(--color-fg-muted)]">
                  A {row.a.toLocaleString()} · B {row.b.toLocaleString()}
                </div>
              </div>
              <div className={`text-[12px] font-mono tnum ${toneText(lift)}`}>
                {idx === 0 ? "baseline" : fmtPct(lift)}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-[18px_1fr_52px] gap-2 items-center text-[10.5px] font-mono tnum">
              <span className="text-[var(--color-fg-muted)]">A</span>
              <Bar value={rateA ?? 0} tone="a" />
              <span className="text-right">{fmtRate(rateA)}</span>
              <span className="text-[var(--color-fg-muted)]">B</span>
              <Bar value={rateB ?? 0} tone="b" />
              <span className="text-right text-[var(--color-fg-muted)]">{fmtRate(rateB)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Sources({ rows }: { rows: SourceRow[] }) {
  if (rows.length === 0) {
    return <div className="px-4 py-8 text-center text-[12px] text-[var(--color-fg-muted)]">No source rows yet.</div>;
  }
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div className="px-4 py-3 space-y-3">
      {rows.map((row) => (
        <div key={row.utm_source}>
          <div className="flex items-center justify-between gap-3 text-[12px]">
            <span className="font-mono truncate">{row.utm_source}</span>
            <span className="font-mono text-[var(--color-fg-muted)]">{fmtCompact(row.total)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-[var(--color-bg-elev)] overflow-hidden">
            <div className="h-full bg-[var(--color-accent)]" style={{ width: `${Math.max(3, (row.total / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub: string; tone?: "good" | "bad" | "neutral" }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">{label}</div>
      <div className={`mt-1 text-[24px] font-semibold tracking-tight tnum ${tone === "good" ? "text-[var(--color-success)]" : tone === "bad" ? "text-[var(--color-danger)]" : ""}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[var(--color-fg-muted)] tnum">{sub}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-card)]/70 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-[var(--color-fg-muted)]">{label}</div>
      <div className="mt-1 text-[16px] font-mono tnum">{value}</div>
    </div>
  );
}

function Bar({ value, tone }: { value: number; tone: "a" | "b" }) {
  return (
    <div className="h-1.5 rounded-full bg-[var(--color-bg-elev)] overflow-hidden">
      <div
        className={tone === "a" ? "h-full bg-[var(--color-accent)]" : "h-full bg-[color-mix(in_srgb,var(--color-accent)_42%,transparent)]"}
        style={{ width: `${Math.max(1, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

function fmtRpv(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "-";
  return `$${(v / 100).toFixed(2)}`;
}

function toneFor(v: number | null): "good" | "bad" | "neutral" {
  if (v == null || !Number.isFinite(v) || Math.abs(v) < 0.0001) return "neutral";
  return v > 0 ? "good" : "bad";
}

function toneText(v: number | null): string {
  const tone = toneFor(v);
  if (tone === "good") return "text-[var(--color-success)]";
  if (tone === "bad") return "text-[var(--color-danger)]";
  return "text-[var(--color-fg-muted)]";
}

function validityClass(level: string): string {
  if (level === "ready") return "border-[var(--color-success)]/35 bg-[var(--color-success-soft)]";
  if (level === "directional") return "border-[var(--color-accent)]/35 bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]";
  if (level === "invalid") return "border-[var(--color-danger)]/35 bg-[var(--color-danger-soft)]/35";
  return "border-[var(--color-border-soft)] bg-[var(--color-card)]";
}
