import Link from "next/link";
import { getRollupFreshness, zTestTwoProp } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { PixelIcon } from "@/components/PixelIcon";
import { RollupFreshnessBanner } from "@/app/dashboard/_components/rollup-freshness-banner";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ range?: string }>;
type Range = { key: string; label: string; days: number };

const RANGES: Range[] = [
  { key: "24h", label: "24h", days: 1 },
  { key: "7d", label: "7d", days: 7 },
  { key: "14d", label: "14d", days: 14 },
  { key: "30d", label: "30d", days: 30 },
];

type RpcRow = {
  merchant_id: string;
  merchant_name: string | null;
  merchant_domain: string | null;
  ab_enabled: boolean | null;
  ab_split_pct: number | string | null;
  impressions_a: number | string | null;
  impressions_b: number | string | null;
  escapes_a: number | string | null;
  purchases_a: number | string | null;
  purchases_b: number | string | null;
  revenue_cents_a: number | string | null;
  revenue_cents_b: number | string | null;
};

type BrandPerf = {
  id: string;
  name: string;
  domain: string | null;
  split: number;
  abEnabled: boolean;
  visitorsA: number;
  visitorsB: number;
  escapesA: number;
  purchasesA: number;
  purchasesB: number;
  revenueA: number;
  revenueB: number;
  cvrA: number | null;
  cvrB: number | null;
  rpvA: number | null;
  rpvB: number | null;
  rpvDelta: number | null;
  rpvLift: number | null;
  cvrLift: number | null;
  projectedDelta: number | null;
  confidence: number | null;
  pValue: number | null;
};

const compactNF = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function parseRange(v: string | undefined): Range {
  return RANGES.find((r) => r.key === v) ?? RANGES[1];
}

export default async function AdminPerformancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const admin = getSupabaseAdmin();
  if (!admin) {
    return <EmptyState title="Service role unavailable" detail="Set SUPABASE_SERVICE_ROLE_KEY to load performance." />;
  }

  const since = new Date(new Date().getTime() - range.days * 86400_000).toISOString();

  // Defense in depth: this RPC reads from hourly_funnel_rollups only. If the
  // refresh cron has stalled, every row below silently under-reports. Surface
  // it via the shared freshness banner so we don't repeat the 3-day blackout.
  const [rollupFreshness, { data, error }] = await Promise.all([
    getRollupFreshness(),
    admin.rpc("eh_admin_brand_performance", { p_since: since }),
  ]);
  if (error) {
    return <EmptyState title="Could not load performance" detail={error.message} />;
  }

  const rows = ((data ?? []) as RpcRow[]).map(toPerf);
  const activeRows = rows.filter((r) => r.visitorsA + r.visitorsB > 0);
  const portfolio = summarizePortfolio(activeRows);
  const notes = buildExecNotes(activeRows, portfolio, range);

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow">Admin · Performance</div>
          <h1 className="mt-2 h-display text-[28px] tracking-tight">Brand performance</h1>
          <p className="mt-1 text-[13px] text-[var(--color-fg-dim)] max-w-3xl">
            Revenue-per-visitor lift across brands, using unique IG in-app browser visitors as the denominator.
          </p>
        </div>
        <RangeLinks active={range.key} />
      </div>

      <RollupFreshnessBanner freshness={rollupFreshness} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Portfolio RPV delta"
          value={money(portfolio.rpvDelta)}
          tone={tone(portfolio.rpvDelta)}
          sub={`A ${money(portfolio.rpvA)} · B ${money(portfolio.rpvB)}`}
        />
        <Stat
          label="RPV lift"
          value={pct(portfolio.rpvLift)}
          tone={tone(portfolio.rpvLift)}
          sub="Escape vs control"
        />
        <Stat
          label="Projected delta"
          value={money(portfolio.projectedDelta, { compact: true })}
          tone={tone(portfolio.projectedDelta)}
          sub={`if all ${fmt(portfolio.visitors)} visitors got escape`}
        />
        <Stat
          label="Escaped visitors"
          value={fmt(portfolio.escapes)}
          sub={`${pctRaw(portfolio.escapeRate)} of IG IAB visitors`}
        />
      </div>

      <section className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)]">
        <div className="px-5 py-3 border-b border-[var(--color-border-soft)] flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-semibold tracking-tight">Exec notes</h2>
            <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
              Copy-safe talking points for the latest {range.label}.
            </div>
          </div>
          <span className="pill pill-muted">{activeRows.length} active brands</span>
        </div>
        <div className="p-5 grid gap-3 lg:grid-cols-3">
          {notes.map((note) => (
            <div key={note.title} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/30 p-4">
              <div className={`text-[10px] uppercase tracking-[0.14em] font-mono ${note.tone === "good" ? "text-[var(--color-success)]" : note.tone === "bad" ? "text-[var(--color-danger)]" : "text-[var(--color-accent)]"}`}>
                {note.label}
              </div>
              <div className="mt-1 text-[13px] font-semibold tracking-tight">{note.title}</div>
              <p className="mt-1.5 text-[12.5px] text-[var(--color-fg-dim)] leading-relaxed">{note.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border-soft)]">
          <h2 className="text-[14px] font-semibold tracking-tight">Brand table</h2>
          <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
            RPV is revenue / unique IG IAB visitors. Delta = bucket A minus bucket B.
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-[12px]">
            <thead className="text-[9.5px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)] border-b border-[var(--color-border-soft)]">
              <tr>
                <Th>Brand</Th>
                <Th>Split</Th>
                <Th>Visitors</Th>
                <Th>RPV A</Th>
                <Th>RPV B</Th>
                <Th>Delta</Th>
                <Th>Lift</Th>
                <Th>CVR A/B</Th>
                <Th>Revenue delta</Th>
                <Th>Signal</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--color-border-soft)] last:border-b-0">
                  <Td>
                    <div className="font-medium tracking-tight">{row.name}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-[var(--color-fg-muted)] truncate max-w-[180px]">
                      {row.domain ?? row.id.slice(0, 8)}
                    </div>
                  </Td>
                  <Td>
                    <span className={row.abEnabled ? "pill pill-info" : "pill pill-muted"}>
                      {row.abEnabled ? `${row.split}/${100 - row.split}` : "off"}
                    </span>
                  </Td>
                  <Td>
                    <div className="font-mono tnum">{fmt(row.visitorsA + row.visitorsB)}</div>
                    <div className="mt-0.5 text-[10px] text-[var(--color-fg-muted)] font-mono">
                      A {fmt(row.visitorsA)} · B {fmt(row.visitorsB)}
                    </div>
                  </Td>
                  <Td>{money(row.rpvA)}</Td>
                  <Td>{money(row.rpvB)}</Td>
                  <Td><span className={toneClass(row.rpvDelta)}>{money(row.rpvDelta)}</span></Td>
                  <Td><span className={toneClass(row.rpvLift)}>{pct(row.rpvLift)}</span></Td>
                  <Td>
                    <div className="font-mono tnum">{rate(row.cvrA)} / {rate(row.cvrB)}</div>
                    <div className="mt-0.5 text-[10px] text-[var(--color-fg-muted)] font-mono">
                      {row.purchasesA} / {row.purchasesB} orders
                    </div>
                  </Td>
                  <Td><span className={toneClass(row.projectedDelta)}>{money(row.projectedDelta, { compact: true })}</span></Td>
                  <Td>
                    <Signal row={row} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)] px-4 py-3 text-[12px] text-[var(--color-fg-dim)] leading-relaxed">
        <strong className="text-[var(--color-fg)]">Read this carefully:</strong>{" "}
        The table is operationally useful, but small order counts can swing revenue-per-visitor hard. Use the exec notes for direction,
        not as a final winner call, until the signal column says ready/directional with enough purchases.
      </div>
    </div>
  );
}

function toPerf(row: RpcRow): BrandPerf {
  const visitorsA = toInt(row.impressions_a);
  const visitorsB = toInt(row.impressions_b);
  const revenueA = toInt(row.revenue_cents_a);
  const revenueB = toInt(row.revenue_cents_b);
  const purchasesA = toInt(row.purchases_a);
  const purchasesB = toInt(row.purchases_b);
  const rpvA = visitorsA > 0 ? revenueA / visitorsA / 100 : null;
  const rpvB = visitorsB > 0 ? revenueB / visitorsB / 100 : null;
  const cvrA = visitorsA > 0 ? purchasesA / visitorsA : null;
  const cvrB = visitorsB > 0 ? purchasesB / visitorsB : null;
  const rpvDelta = rpvA != null && rpvB != null ? rpvA - rpvB : null;
  const rpvLift = rpvDelta != null && rpvB != null && rpvB > 0 ? rpvDelta / rpvB : null;
  const cvrLift = cvrA != null && cvrB != null && cvrB > 0 ? (cvrA - cvrB) / cvrB : null;
  const totalVisitors = visitorsA + visitorsB;
  const projectedDelta = rpvA != null ? totalVisitors * rpvA - (revenueA + revenueB) / 100 : null;
  const z = zTestTwoProp(purchasesA, visitorsA, purchasesB, visitorsB);

  return {
    id: row.merchant_id,
    name: row.merchant_name ?? "(unnamed)",
    domain: row.merchant_domain,
    split: toInt(row.ab_split_pct) || 50,
    abEnabled: row.ab_enabled !== false,
    visitorsA,
    visitorsB,
    escapesA: toInt(row.escapes_a),
    purchasesA,
    purchasesB,
    revenueA,
    revenueB,
    cvrA,
    cvrB,
    rpvA,
    rpvB,
    rpvDelta,
    rpvLift,
    cvrLift,
    projectedDelta,
    confidence: z ? 1 - z.pValue : null,
    pValue: z?.pValue ?? null,
  };
}

function summarizePortfolio(rows: BrandPerf[]) {
  const visitorsA = rows.reduce((sum, r) => sum + r.visitorsA, 0);
  const visitorsB = rows.reduce((sum, r) => sum + r.visitorsB, 0);
  const visitors = visitorsA + visitorsB;
  const revenueA = rows.reduce((sum, r) => sum + r.revenueA, 0);
  const revenueB = rows.reduce((sum, r) => sum + r.revenueB, 0);
  const escapes = rows.reduce((sum, r) => sum + r.escapesA, 0);
  const rpvA = visitorsA > 0 ? revenueA / visitorsA / 100 : null;
  const rpvB = visitorsB > 0 ? revenueB / visitorsB / 100 : null;
  const rpvDelta = rpvA != null && rpvB != null ? rpvA - rpvB : null;
  const rpvLift = rpvDelta != null && rpvB != null && rpvB > 0 ? rpvDelta / rpvB : null;
  const projectedDelta = rpvA != null ? visitors * rpvA - (revenueA + revenueB) / 100 : null;
  return {
    visitors,
    visitorsA,
    visitorsB,
    escapes,
    escapeRate: visitors > 0 ? escapes / visitors : null,
    rpvA,
    rpvB,
    rpvDelta,
    rpvLift,
    projectedDelta,
  };
}

function buildExecNotes(rows: BrandPerf[], portfolio: ReturnType<typeof summarizePortfolio>, range: Range) {
  const notes: { label: string; title: string; body: string; tone: "good" | "bad" | "neutral" }[] = [];
  const positive = rows
    .filter((r) => (r.purchasesA + r.purchasesB) >= 5 && (r.rpvDelta ?? 0) > 0)
    .sort((a, b) => (b.rpvDelta ?? 0) - (a.rpvDelta ?? 0));
  const biggest = positive[0];
  const readyRows = rows.filter((r) => (r.purchasesA + r.purchasesB) >= 10 && r.visitorsA > 500 && r.visitorsB > 500);

  notes.push({
    label: portfolio.rpvDelta != null && portfolio.rpvDelta > 0 ? "positive" : "watch",
    title:
      portfolio.rpvDelta != null && portfolio.rpvDelta > 0
        ? `Portfolio RPV is ${pct(portfolio.rpvLift)} higher on escaped traffic`
        : "Portfolio revenue lift is not ready to claim yet",
    body:
      portfolio.rpvDelta != null && portfolio.rpvDelta > 0
        ? `Across ${fmt(portfolio.visitors)} IG in-app browser visitors in the last ${range.label}, escaped traffic is producing ${money(portfolio.rpvDelta)} more revenue per visitor than control.`
        : `Across ${fmt(portfolio.visitors)} IG in-app browser visitors in the last ${range.label}, the current revenue-per-visitor read is control-favored. Treat this as a measurement checkpoint, not a final conclusion.`,
    tone: portfolio.rpvDelta != null && portfolio.rpvDelta > 0 ? "good" : "neutral",
  });

  notes.push({
    label: "operational",
    title: `${fmt(portfolio.escapes)} visitors escaped cleanly`,
    body: `EscapeHatch is routing ${pctRaw(portfolio.escapeRate)} of tracked IG IAB visitors into the escape arm, which is consistent with the configured A/B splits across active brands.`,
    tone: "good",
  });

  if (biggest) {
    notes.push({
      label: "notable",
      title: `${biggest.name} is the strongest positive read`,
      body: `${biggest.name} shows ${money(biggest.rpvDelta)} higher revenue per visitor on escaped traffic (${pct(biggest.rpvLift)} lift), with ${biggest.purchasesA + biggest.purchasesB} attributed purchases in-window.`,
      tone: "good",
    });
  } else {
    notes.push({
      label: "caveat",
      title: "Purchase signal is still thin/noisy",
      body: `${readyRows.length} brands currently have enough visitor and order volume for a more serious read. Keep the exec message focused on clean routing and measurement until more purchases accumulate.`,
      tone: "neutral",
    });
  }

  return notes;
}

function RangeLinks({ active }: { active: string }) {
  return (
    <div className="inline-flex rounded-md border border-[var(--color-border-soft)] bg-[var(--color-card)] p-[2px]">
      {RANGES.map((r) => (
        <Link
          key={r.key}
          href={r.key === "7d" ? "/admin/performance" : `/admin/performance?range=${r.key}`}
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

function Signal({ row }: { row: BrandPerf }) {
  const purchases = row.purchasesA + row.purchasesB;
  const ready = purchases >= 10 && row.visitorsA >= 500 && row.visitorsB >= 500;
  const directional = purchases >= 5 && row.visitorsA >= 250 && row.visitorsB >= 250;
  const label = ready ? "Ready-ish" : directional ? "Directional" : "Collecting";
  const cls = ready ? "pill pill-success" : directional ? "pill pill-info" : "pill pill-muted";
  return (
    <div>
      <span className={cls}>{label}</span>
      <div className="mt-1 text-[10px] text-[var(--color-fg-muted)] font-mono">
        {row.confidence == null ? "no p-value" : `${Math.round(row.confidence * 100)}% conf`}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone: toneName = "neutral" }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "neutral" }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">{label}</div>
        <PixelIcon name="chart" size={12} className="text-[var(--color-fg-muted)]" />
      </div>
      <div className={`mt-1 text-[24px] tracking-tight font-semibold tnum ${toneName === "good" ? "text-[var(--color-success)]" : toneName === "bad" ? "text-[var(--color-danger)]" : ""}`}>
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-[10.5px] font-mono text-[var(--color-fg-muted)]">{sub}</div> : null}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle">{children}</td>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-6">
      <div className="eyebrow">Admin · Performance</div>
      <h1 className="mt-2 h-display text-[24px] tracking-tight">{title}</h1>
      <p className="mt-2 text-[13px] text-[var(--color-fg-dim)]">{detail}</p>
    </div>
  );
}

function toInt(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "-";
  return Math.abs(n) >= 10_000 ? compactNF.format(n) : n.toLocaleString();
}

function money(v: number | null, opts?: { compact?: boolean }): string {
  if (v == null || !Number.isFinite(v)) return "-";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (opts?.compact && abs >= 10_000) return `${sign}$${compactNF.format(abs)}`;
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: abs < 10 ? 2 : 0 })}`;
}

function pct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "-";
  return `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

function pctRaw(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "-";
  return `${(v * 100).toFixed(1)}%`;
}

function rate(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "-";
  return `${(v * 100).toFixed(2)}%`;
}

function tone(v: number | null): "good" | "bad" | "neutral" {
  if (v == null || !Number.isFinite(v) || Math.abs(v) < 0.00001) return "neutral";
  return v > 0 ? "good" : "bad";
}

function toneClass(v: number | null): string {
  const t = tone(v);
  if (t === "good") return "text-[var(--color-success)] font-medium";
  if (t === "bad") return "text-[var(--color-danger)] font-medium";
  return "text-[var(--color-fg)]";
}
