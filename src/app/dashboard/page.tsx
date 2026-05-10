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
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ActivityRow = {
  event_type: string;
  bucket: "a" | "b";
  in_test: boolean;
  value_cents: number | null;
  utm_source: string | null;
  iab_kind: string | null;
  created_at: string;
};

async function getRecentActivity(merchantId: string, limit = 14): Promise<ActivityRow[]> {
  const supabase = await getSupabaseServer();
  if (!supabase) return [];
  const { data } = await supabase
    .from("escape_events")
    .select("event_type,bucket,in_test,value_cents,utm_source,iab_kind,created_at")
    .eq("merchant_id", merchantId)
    .in("event_type", ["purchase", "checkout_started", "add_to_cart", "escape_attempt"])
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ActivityRow[];
}

export default async function DashboardOverview() {
  const merchant = await getCurrentMerchant();
  if (!merchant) {
    return (
      <Page title="Overview">
        <Card><CardBody><MutedText>Provisioning merchant record…</MutedText></CardBody></Card>
      </Page>
    );
  }

  const [funnel, rollups, sources, unattributed, activity] = await Promise.all([
    getTestFunnel(merchant.id, 14),
    getRollups(merchant.id, 14),
    getSourceBreakdown(merchant.id, 14, 8),
    getUnattributedPurchaseStats(merchant.id, 14),
    getRecentActivity(merchant.id, 12),
  ]);

  const escapeRate =
    funnel.impressions.a > 0
      ? (100 * funnel.escape_attempts.a) / funnel.impressions.a
      : 0;

  const baseA = funnel.impressions.a;
  const baseB = funnel.impressions.b;
  const revA = funnel.revenue_cents.a / 100;
  const revB = funnel.revenue_cents.b / 100;
  const rpsA = baseA > 0 ? revA / baseA : 0;
  const rpsB = baseB > 0 ? revB / baseB : 0;
  const liftRel = rpsB > 0 ? (rpsA - rpsB) / rpsB : null;
  const z = zTestTwoProp(funnel.purchases.a, baseA, funnel.purchases.b, baseB);
  const totalImpressions = baseA + baseB;
  const totalEscapes = funnel.escape_attempts.a;

  return (
    <Page
      title={merchant.name ?? "Your store"}
      subtitle={
        <span className="font-mono text-[12px] text-[var(--color-fg-muted)]">
          {merchant.domain ?? "—"} · last 14d ·{" "}
          {merchant.ab_enabled ? "A/B 50/50" : "A/B off"}
        </span>
      }
      action={
        <Link
          href="/dashboard/install"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-[12.5px] font-medium press lift focus-ring"
        >
          Install snippet
          <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      }
    >
      <Banner unattributed={unattributed} attributedPurchases={funnel.purchases.a + funnel.purchases.b} attributedRevenueCents={funnel.revenue_cents.a + funnel.revenue_cents.b} />

      <KPIGrid
        impressions={totalImpressions}
        escapeAttempts={totalEscapes}
        escapeRate={escapeRate}
        revenue={revA + revB}
        purchases={funnel.purchases.a + funnel.purchases.b}
        liftRel={liftRel}
        pValue={z?.pValue ?? null}
      />

      <FunnelTable funnel={funnel} />

      <Layout>
        <LayoutCol size="primary">
          <SourcesCard sources={sources} />
        </LayoutCol>
        <LayoutCol size="secondary">
          <ChartCard rollups={rollups} />
          <SampleSizeCard funnel={funnel} />
        </LayoutCol>
      </Layout>

      <ActivityCard rows={activity} />
    </Page>
  );
}

/* -------- Polaris-inspired primitives -------- */

function Page({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3 pb-2 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight leading-tight">
            {title}
          </h1>
          {subtitle ? <div className="mt-1">{subtitle}</div> : null}
        </div>
        {action}
      </div>
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
      className={`bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg ${className}`}
    >
      {title || action ? (
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border-soft)]">
          {title ? (
            <h2 className="text-[13.5px] font-semibold tracking-tight">{title}</h2>
          ) : null}
          {action}
        </header>
      ) : null}
      {padded ? <div className="px-4 py-3.5">{children}</div> : children}
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
    <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)] font-medium font-mono">
      {children}
    </div>
  );
}

/* -------- Banner — Polaris-style attribution gap notice -------- */

function Banner({
  unattributed,
  attributedPurchases,
  attributedRevenueCents,
}: {
  unattributed: { count: number; revenue_cents: number };
  attributedPurchases: number;
  attributedRevenueCents: number;
}) {
  if (unattributed.count === 0 && attributedPurchases === 0) return null;
  const total = unattributed.count + attributedPurchases;
  const totalRev = (unattributed.revenue_cents + attributedRevenueCents) / 100;
  const attribPct = total > 0 ? Math.round((100 * attributedPurchases) / total) : 0;
  const warn = unattributed.count > attributedPurchases * 2;
  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-3 rounded-lg border ${
        warn
          ? "border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]"
          : "border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)]"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`size-7 rounded-md grid place-items-center shrink-0 ${
            warn ? "text-[var(--color-danger)]" : "text-[var(--color-accent)]"
          }`}
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4.5v4M8 11v0.5" strokeLinecap="round" />
          </svg>
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-medium tracking-tight">
            {total.toLocaleString()} purchases · ${totalRev.toLocaleString(undefined, { maximumFractionDigits: 0 })} (all sources)
          </div>
          <div className="mt-0.5 text-[11.5px] text-[var(--color-fg-dim)] font-mono tnum">
            {attributedPurchases} attributed ({attribPct}%) · {unattributed.count} unattributed
          </div>
        </div>
      </div>
      {warn ? (
        <div className="text-[11px] text-[var(--color-fg-dim)] hidden md:block max-w-[280px] text-right">
          Most orders skip our cookie chain — Shopify checkout breaks attribution. Cart-token join is enabled, watch this fall.
        </div>
      ) : null}
    </div>
  );
}

/* -------- KPI grid — 4 dense tiles -------- */

function KPIGrid({
  impressions,
  escapeAttempts,
  escapeRate,
  revenue,
  purchases,
  liftRel,
  pValue,
}: {
  impressions: number;
  escapeAttempts: number;
  escapeRate: number;
  revenue: number;
  purchases: number;
  liftRel: number | null;
  pValue: number | null;
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KPI label="Impressions" value={impressions.toLocaleString()} sub="in test population" />
      <KPI label="Escape rate" value={`${escapeRate.toFixed(0)}%`} sub={`${escapeAttempts.toLocaleString()} of bucket A`} />
      <KPI label="Revenue (test)" value={`$${revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub={`${purchases.toLocaleString()} attributed`} />
      <KPI
        label="Lift · A vs B"
        value={liftStr}
        valueClass={liftColor}
        sub={pValue != null ? `p = ${pValue < 0.001 ? "<.001" : pValue.toFixed(3)}` : "need more data"}
      />
    </div>
  );
}

function KPI({
  label,
  value,
  sub,
  valueClass = "",
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-4 py-3">
      <MonoLabel>{label}</MonoLabel>
      <div className={`mt-1.5 text-[22px] font-semibold tracking-tight tnum ${valueClass}`}>
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)] font-mono tnum">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

/* -------- Funnel table — IndexTable-style -------- */

function FunnelTable({ funnel }: { funnel: Funnel }) {
  type Row = { label: string; a: number; b: number; sub: string };
  const rows: Row[] = [
    { label: "Impressions", a: funnel.impressions.a, b: funnel.impressions.b, sub: "test landings" },
    { label: "Product viewed", a: funnel.product_viewed.a, b: funnel.product_viewed.b, sub: "/products/*" },
    { label: "Add to cart", a: funnel.add_to_cart.a, b: funnel.add_to_cart.b, sub: "added a SKU" },
    { label: "Checkout started", a: funnel.checkout_started.a, b: funnel.checkout_started.b, sub: "reached /checkouts" },
    { label: "Purchase", a: funnel.purchases.a, b: funnel.purchases.b, sub: "completed" },
  ];
  const baseA = funnel.impressions.a;
  const baseB = funnel.impressions.b;
  const empty = baseA + baseB === 0;

  return (
    <Card title="Funnel · A vs B">
      {empty ? (
        <div className="px-4 py-12 text-center">
          <div className="mx-auto inline-flex size-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)]">
            <svg viewBox="0 0 24 24" className="size-4 text-[var(--color-fg-muted)]" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 19V5m0 14h18M7 15l4-4 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="mt-3 text-[13px] font-medium">No test data yet</div>
          <div className="mt-1 text-[11.5px] text-[var(--color-fg-muted)]">Paid IG ad clicks will populate here within minutes of install.</div>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-12 px-4 py-2 border-b border-[var(--color-border-soft)]">
            <div className="col-span-4">
              <MonoLabel>Stage</MonoLabel>
            </div>
            <div className="col-span-3 text-right"><MonoLabel>A · escape</MonoLabel></div>
            <div className="col-span-3 text-right"><MonoLabel>B · control</MonoLabel></div>
            <div className="col-span-1 text-right"><MonoLabel>Lift</MonoLabel></div>
            <div className="col-span-1 text-right"><MonoLabel>p</MonoLabel></div>
          </div>
          {rows.map((row, i) => {
            const cvrA = baseA > 0 ? row.a / baseA : 0;
            const cvrB = baseB > 0 ? row.b / baseB : 0;
            const z = i === 0 ? null : zTestTwoProp(row.a, baseA, row.b, baseB);
            const lift = z?.liftRel != null ? `${z.liftRel > 0 ? "+" : ""}${(z.liftRel * 100).toFixed(0)}%` : "—";
            const liftColor =
              z?.liftRel == null
                ? "text-[var(--color-fg-muted)]"
                : z.liftRel > 0
                  ? "text-[var(--color-success)]"
                  : "text-[var(--color-danger)]";
            const p =
              z?.pValue != null
                ? z.pValue < 0.001
                  ? "<.001"
                  : z.pValue.toFixed(3)
                : "—";
            const sig = z?.significant === true;
            return (
              <div
                key={row.label}
                className="grid grid-cols-12 items-center px-4 py-2.5 border-b border-[var(--color-border-soft)] last:border-b-0 hover:bg-[var(--color-bg-elev)]/50 transition-colors"
              >
                <div className="col-span-4">
                  <div className="text-[13px] font-medium tracking-tight">{row.label}</div>
                  <div className="text-[11px] text-[var(--color-fg-muted)] font-mono">{row.sub}</div>
                </div>
                <div className="col-span-3 text-right">
                  <div className="font-mono tnum text-[13px]">{row.a.toLocaleString()}</div>
                  {i > 0 ? <div className="text-[10.5px] text-[var(--color-fg-muted)] font-mono tnum">{(cvrA * 100).toFixed(2)}%</div> : null}
                </div>
                <div className="col-span-3 text-right">
                  <div className="font-mono tnum text-[13px]">{row.b.toLocaleString()}</div>
                  {i > 0 ? <div className="text-[10.5px] text-[var(--color-fg-muted)] font-mono tnum">{(cvrB * 100).toFixed(2)}%</div> : null}
                </div>
                <div className={`col-span-1 text-right font-mono tnum text-[13px] font-semibold ${liftColor}`}>{lift}</div>
                <div className={`col-span-1 text-right font-mono tnum text-[11.5px] ${sig ? "text-[var(--color-success)]" : "text-[var(--color-fg-muted)]"}`}>{p}</div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* -------- Sources card — ResourceItem-style rows -------- */

function SourcesCard({ sources }: { sources: SourceRow[] }) {
  if (sources.length === 0) {
    return (
      <Card title="Top sources" action={<MonoLabel>14d</MonoLabel>}>
        <MutedText>No source data yet.</MutedText>
      </Card>
    );
  }
  return (
    <Card title="Top sources" action={<MonoLabel>14d</MonoLabel>}>
      <div className="-mx-4 -my-3.5">
        {sources.map((s) => {
          const cvr = s.total > 0 ? (100 * s.purchases) / s.total : 0;
          return (
            <div
              key={s.utm_source}
              className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-[var(--color-border-soft)] last:border-b-0 hover:bg-[var(--color-bg-elev)]/50 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-medium tracking-tight truncate">{s.utm_source}</div>
                <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)] font-mono tnum">
                  {s.bucket_a.toLocaleString()} A / {s.bucket_b.toLocaleString()} B {cvr > 0 ? `· ${cvr.toFixed(2)}% CVR` : ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono tnum text-[13px]">{s.total.toLocaleString()}</div>
                <div className="font-mono tnum text-[11px] text-[var(--color-fg-muted)]">${(s.revenue_cents / 100).toFixed(0)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* -------- Daily chart -------- */

function ChartCard({ rollups }: { rollups: DailyRollup[] }) {
  return (
    <Card title="Impressions vs escapes" action={<MonoLabel>14d</MonoLabel>}>
      <DailyChart rollups={rollups} />
    </Card>
  );
}

function DailyChart({ rollups }: { rollups: DailyRollup[] }) {
  if (rollups.length === 0) {
    return <MutedText>Once events arrive, you&apos;ll see a 14-day trend here.</MutedText>;
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

function ActivityCard({ rows }: { rows: ActivityRow[] }) {
  return (
    <Card
      title="Recent activity"
      action={
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-fg-muted)] font-mono">
          <span className="size-1.5 rounded-full bg-[var(--color-success)] pulse-ring" />
          live
        </span>
      }
    >
      {rows.length === 0 ? (
        <MutedText>No events yet.</MutedText>
      ) : (
        <div className="-mx-4 -my-3.5 row-divide">
          {rows.map((r, i) => (
            <ActivityRow key={i} row={r} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ActivityRow({ row }: { row: ActivityRow }) {
  const dot =
    row.event_type === "purchase"
      ? "bg-[var(--color-success)]"
      : row.event_type === "escape_attempt"
        ? "bg-[var(--color-accent)]"
        : "bg-[var(--color-fg-muted)]";
  const label =
    row.event_type === "purchase"
      ? "Purchase"
      : row.event_type === "checkout_started"
        ? "Checkout started"
        : row.event_type === "add_to_cart"
          ? "Added to cart"
          : row.event_type === "escape_attempt"
            ? "Escape fired"
            : row.event_type;
  const value = row.value_cents != null ? `$${(row.value_cents / 100).toFixed(2)}` : "";
  const ts = formatRelative(row.created_at);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-[var(--color-bg-elev)]/50 transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`size-1.5 rounded-full ${dot}`} />
        <span className="text-[12.5px] font-medium tracking-tight">{label}</span>
        <span className="kbd">bucket {row.bucket}</span>
        {row.utm_source ? <span className="kbd">{row.utm_source}</span> : null}
        {!row.in_test ? <span className="kbd">unattributed</span> : null}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {value ? <span className="font-mono tnum text-[12px]">{value}</span> : null}
        <span className="font-mono text-[11px] text-[var(--color-fg-muted)] tnum">{ts}</span>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const delta = Math.max(0, Date.now() - t);
  const s = Math.floor(delta / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
