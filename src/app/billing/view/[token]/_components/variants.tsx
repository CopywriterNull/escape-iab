// Three visual takes on the merchant-facing billing view, all rendering the
// same ViewData. ?v=1|2|3 picks one (default: statement). Server components —
// no client JS; hover detail rides on native SVG <title>.

import { PixelIcon } from "@/components/PixelIcon";
import type { MerchantEarnings, AccruingPeriod } from "@/lib/billing/earnings";

export type ViewInvoice = {
  id: string;
  kind: "plan_start" | "monthly";
  period_start: string;
  period_end: string;
  total_cents: number;
  status: string;
  charged_at: string | null;
  created_at: string;
};

export type ViewData = {
  merchantName: string;
  planActive: boolean;
  baseFeeCents: number;
  baseFeeWaived: boolean;
  revSharePct: number;
  earnings: MerchantEarnings;
  accruing: AccruingPeriod | null;
  invoices: ViewInvoice[];
  liftPct: number | null; // all-time RPV lift A vs B, null when no control
};

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function money0(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDayLabel(day: string): string {
  const [, m, d] = day.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

function fmtLongDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
}

function invoiceLabel(inv: ViewInvoice): string {
  return inv.kind === "plan_start"
    ? "Escape Hatch - Unlimited Plan"
    : `Unlimited Plan · ${fmtDate(inv.period_start)} → ${fmtDate(inv.period_end)}`;
}

function invoiceStatusLabel(status: string): { label: string; cls: string } {
  if (status === "paid") return { label: "paid", cls: "pill pill-success" };
  return { label: "processing", cls: "pill pill-info" };
}

/* ---------- shared pieces ---------- */

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block size-2 rounded-full bg-[var(--color-accent)]" />
      <span className="text-[13px] font-semibold tracking-tight">Escape Hatch</span>
    </div>
  );
}

function InvoiceTable({ invoices }: { invoices: ViewInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <div className="text-[12px] text-[var(--color-fg-muted)] py-3">No invoices yet.</div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-[12px]">
        <thead className="text-[9.5px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)] border-b border-[var(--color-border-soft)]">
          <tr>
            <th className="py-2 pr-4 font-medium">Invoice</th>
            <th className="py-2 pr-4 font-medium">Date</th>
            <th className="py-2 pr-4 font-medium text-right">Amount</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const s = invoiceStatusLabel(inv.status);
            return (
              <tr key={inv.id} className="border-b border-[var(--color-border-soft)] last:border-b-0">
                <td className="py-2.5 pr-4">{invoiceLabel(inv)}</td>
                <td className="py-2.5 pr-4 font-mono text-[11px]">
                  {fmtDate(inv.charged_at ?? inv.created_at)}
                </td>
                <td className="py-2.5 pr-4 font-mono tnum text-right">{money(inv.total_cents)}</td>
                <td className="py-2.5">
                  <span className={s.cls}>{s.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DailyBars({ daily, height = 64 }: { daily: MerchantEarnings["daily"]; height?: number }) {
  const W = 30 * 10 - 2;
  const H = height;
  const R = 2;
  const max = Math.max(1, ...daily.map((d) => d.incrementalCents));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height }}
      role="img"
      aria-label="Daily incremental revenue, last 30 days"
      preserveAspectRatio="none"
    >
      {daily.map((d, i) => {
        const x = i * 10;
        const h = Math.round((d.incrementalCents / max) * (H - R - 2));
        const label = `${fmtDayLabel(d.day)} — ${money(d.incrementalCents)} incremental`;
        if (h <= 0) {
          return (
            <g key={d.day}>
              <title>{label}</title>
              <rect x={x} y={H - 2} width={8} height={2} fill="var(--color-border)" />
            </g>
          );
        }
        const y = H - h;
        return (
          <g key={d.day}>
            <title>{label}</title>
            <path
              d={`M ${x},${y + R} Q ${x},${y} ${x + R},${y} L ${x + 8 - R},${y} Q ${x + 8},${y} ${x + 8},${y + R} L ${x + 8},${H} L ${x},${H} Z`}
              fill="var(--color-accent)"
            />
          </g>
        );
      })}
    </svg>
  );
}

/** Cumulative incremental area chart over the 30-day window. */
function CumulativeArea({ daily }: { daily: MerchantEarnings["daily"] }) {
  const W = 600;
  const H = 180;
  const PAD = 4;
  let acc = 0;
  const cum = daily.map((d) => (acc += d.incrementalCents));
  const max = Math.max(1, cum[cum.length - 1] ?? 0);
  const px = (i: number) => PAD + (i / Math.max(1, daily.length - 1)) * (W - PAD * 2);
  const py = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const line = cum.map((v, i) => `${i === 0 ? "M" : "L"} ${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const area = `${line} L ${px(daily.length - 1).toFixed(1)},${H - PAD} L ${px(0).toFixed(1)},${H - PAD} Z`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-[180px]"
      role="img"
      aria-label="Cumulative incremental revenue, last 30 days"
      preserveAspectRatio="none"
    >
      <path d={area} fill="var(--color-accent)" opacity={0.14} />
      <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
      {daily.map((d, i) => (
        <g key={d.day}>
          <title>{`${fmtDayLabel(d.day)} — ${money(cum[i])} cumulative`}</title>
          <circle cx={px(i)} cy={py(cum[i])} r={8} fill="transparent" />
        </g>
      ))}
      <circle cx={px(daily.length - 1)} cy={py(cum[cum.length - 1] ?? 0)} r={3.5} fill="var(--color-accent)" />
    </svg>
  );
}

function FooterNote() {
  return (
    <div className="text-[10.5px] text-[var(--color-fg-muted)] leading-relaxed">
      Incremental revenue is estimated from your live A/B test: what shoppers who were escaped to a
      real browser spent, minus what they would have spent at your in-app-browser baseline.
      Invoiced amounts are computed with outlier orders excluded and are final on the invoice.
    </div>
  );
}

function planLine(d: ViewData): string {
  const base = d.baseFeeWaived ? "base fee waived" : `${money0(d.baseFeeCents)}/mo`;
  return `Unlimited Plan — ${base} + ${d.revSharePct}% of incremental revenue`;
}

/* ---------- V0 · Dash (default) — mirrors the product dashboard's visual
   language: KPI cards with pixel icons + mono labels, Card sections. ---------- */

function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
      {children}
    </div>
  );
}

function DashCard({
  title,
  action,
  children,
  padded = true,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <section className="bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg">
      {title || action ? (
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border-soft)]">
          {title ? <h2 className="h-section text-[14px]">{title}</h2> : null}
          {action}
        </header>
      ) : null}
      {padded ? <div className="px-4 py-3">{children}</div> : children}
    </section>
  );
}

function DashKPI({
  label,
  icon,
  value,
  sub,
  valueClass = "",
}: {
  label: string;
  icon: "dollar" | "eye" | "bolt" | "cart" | "chart";
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <MonoLabel>{label}</MonoLabel>
        <PixelIcon name={icon} size={12} className="text-[var(--color-fg-muted)]" />
      </div>
      <div className="mt-2 h-section text-[22px] md:text-[24px] tnum">
        <span className={valueClass}>{value}</span>
      </div>
      {sub ? <div className="mt-1 text-[11px] text-[var(--color-fg-muted)] tnum">{sub}</div> : null}
    </div>
  );
}

export function DashView({ data }: { data: ViewData }) {
  const e = data.earnings;
  const { impA, revACents, impB, revBCents } = e.allTime;
  const rpvA = impA > 0 ? revACents / impA / 100 : null;
  const rpvB = impB > 0 ? revBCents / impB / 100 : null;
  const liftStr =
    data.liftPct != null ? `${data.liftPct > 0 ? "+" : ""}${data.liftPct.toFixed(1)}%` : "—";
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-4 md:space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap pb-1">
        <Wordmark />
        <div className="text-[11.5px] font-mono text-[var(--color-fg-muted)] tnum">
          {data.merchantName} · Billing
          {e.firstTrackedAt ? ` · tracking since ${fmtDate(e.firstTrackedAt)}` : ""}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DashKPI
          label="Incremental revenue"
          icon="dollar"
          value={money0(e.sinceStartIncrementalCents)}
          valueClass="text-[var(--color-success)]"
          sub={e.firstTrackedAt ? `all time · since ${fmtDate(e.firstTrackedAt)}` : "all time"}
        />
        <DashKPI
          label="Incremental · 30d"
          icon="chart"
          value={money0(e.last30dIncrementalCents)}
          sub={`today ${money(e.todayIncrementalCents)}`}
        />
        <DashKPI
          label="Rev / visitor lift"
          icon="bolt"
          value={liftStr}
          valueClass={
            data.liftPct == null
              ? ""
              : data.liftPct > 0
                ? "text-[var(--color-success)]"
                : "text-[var(--color-danger)]"
          }
          sub={rpvA != null && rpvB != null ? `A $${rpvA.toFixed(2)} · B $${rpvB.toFixed(2)}` : "vs in-app baseline"}
        />
        <DashKPI
          label="Accruing this period"
          icon="cart"
          value={data.accruing ? money(data.accruing.totalCents) : "—"}
          sub={
            data.accruing
              ? `bills ${fmtDate(data.accruing.periodEnd)} · ${money(data.accruing.revShareCents)} performance + ${money(data.accruing.baseFeeCents)} base`
              : "plan not active"
          }
        />
      </div>

      <DashCard title="Daily incremental revenue" action={<MonoLabel>30d</MonoLabel>}>
        <DailyBars daily={e.daily} height={110} />
        <div className="mt-1 flex items-center justify-between text-[10.5px] text-[var(--color-fg-muted)] font-mono">
          <span>{fmtDayLabel(e.daily[0]?.day ?? "")}</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[var(--color-accent)]" /> incremental $
          </span>
          <span>{fmtDayLabel(e.daily[e.daily.length - 1]?.day ?? "")}</span>
        </div>
      </DashCard>

      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <DashCard title="Invoices" padded={false}>
            <div className="px-4 py-3">
              <InvoiceTable invoices={data.invoices} />
            </div>
          </DashCard>
        </div>
        <div className="lg:col-span-5 space-y-4">
          <DashCard title="Your plan">
            <div className="text-[13px]">{planLine(data)}</div>
            {data.accruing ? (
              <div className="mt-2 text-[11.5px] text-[var(--color-fg-muted)] tnum">
                Current period {fmtDate(data.accruing.periodStart)} → {fmtDate(data.accruing.periodEnd)} ·{" "}
                {money(data.accruing.incrementalCents)} incremental so far
              </div>
            ) : null}
          </DashCard>
          <DashCard>
            <FooterNote />
          </DashCard>
        </div>
      </div>
    </div>
  );
}

/* ---------- V1 · Statement ---------- */

export function StatementView({ data }: { data: ViewData }) {
  const e = data.earnings;
  return (
    <div className="mx-auto max-w-[640px] px-5 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <Wordmark />
        <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">{data.merchantName}</span>
      </div>

      <div className="pt-2">
        <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
          Incremental revenue generated
          {e.firstTrackedAt ? ` · since ${fmtLongDate(e.firstTrackedAt)}` : ""}
        </div>
        <div className="mt-2 text-[44px] leading-none font-semibold tracking-tight tnum">
          {money0(e.sinceStartIncrementalCents)}
        </div>
        {data.liftPct != null ? (
          <div className="mt-2 text-[12.5px] text-[var(--color-fg-dim)]">
            {data.liftPct > 0 ? "+" : ""}
            {data.liftPct.toFixed(1)}% revenue per visitor vs your in-app-browser baseline
          </div>
        ) : null}
      </div>

      <div className="border-t border-[var(--color-border-soft)] pt-5 space-y-2.5">
        <RowKV k="Your plan" v={planLine(data)} />
        {data.accruing ? (
          <>
            <RowKV
              k="Accruing this period"
              v={`${money(data.accruing.revShareCents)} performance + ${money(data.accruing.baseFeeCents)} base`}
            />
            <RowKV k="Next bill date" v={fmtLongDate(data.accruing.periodEnd)} />
          </>
        ) : null}
        <RowKV k="Last 30 days incremental" v={money(e.last30dIncrementalCents)} />
      </div>

      <div className="border-t border-[var(--color-border-soft)] pt-5">
        <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)] mb-2">
          Invoices
        </div>
        <InvoiceTable invoices={data.invoices} />
      </div>

      <FooterNote />
    </div>
  );
}

function RowKV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[13px]">
      <span className="text-[var(--color-fg-muted)]">{k}</span>
      <span className="text-right tnum">{v}</span>
    </div>
  );
}

/* ---------- V2 · Console ---------- */

export function ConsoleView({ data }: { data: ViewData }) {
  const e = data.earnings;
  return (
    <div className="mx-auto max-w-[860px] px-5 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <Wordmark />
        <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">{data.merchantName}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile
          label="Incremental · all time"
          value={money0(e.sinceStartIncrementalCents)}
          hint={e.firstTrackedAt ? `since ${fmtDate(e.firstTrackedAt)}` : undefined}
          accent
        />
        <Tile label="Incremental · 30d" value={money0(e.last30dIncrementalCents)} />
        <Tile
          label="RPV lift"
          value={data.liftPct != null ? `${data.liftPct > 0 ? "+" : ""}${data.liftPct.toFixed(1)}%` : "—"}
          hint="vs in-app-browser baseline"
        />
        <Tile
          label="Accruing this period"
          value={data.accruing ? money(data.accruing.totalCents) : "—"}
          hint={data.accruing ? `bills ${fmtDate(data.accruing.periodEnd)}` : undefined}
        />
      </div>

      <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5">
        <div className="flex items-baseline justify-between">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">
            Daily incremental revenue — last 30 days
          </div>
          <div className="text-[10.5px] font-mono text-[var(--color-fg-muted)]">
            today: {money(e.todayIncrementalCents)}
          </div>
        </div>
        <div className="mt-3">
          <DailyBars daily={e.daily} height={72} />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[13px] font-semibold tracking-tight">Your plan</div>
          <div className="text-[12px] text-[var(--color-fg-dim)]">{planLine(data)}</div>
        </div>
        <InvoiceTable invoices={data.invoices} />
      </div>

      <FooterNote />
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-4 py-3.5">
      <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">{label}</div>
      <div className={`mt-1 text-[20px] font-semibold tracking-tight tnum ${accent ? "text-[var(--color-accent)]" : ""}`}>
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[10px] font-mono text-[var(--color-fg-muted)]">{hint}</div> : null}
    </div>
  );
}

/* ---------- V3 · Chart-led ---------- */

export function ChartLedView({ data }: { data: ViewData }) {
  const e = data.earnings;
  return (
    <div className="mx-auto max-w-[760px] px-5 py-10 space-y-7">
      <div className="flex items-center justify-between">
        <Wordmark />
        <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">{data.merchantName}</span>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
          Incremental revenue — last 30 days
        </div>
        <div className="mt-1 flex items-baseline gap-3 flex-wrap">
          <span className="text-[38px] leading-none font-semibold tracking-tight tnum text-[var(--color-accent)]">
            {money0(e.last30dIncrementalCents)}
          </span>
          {data.liftPct != null ? (
            <span className="text-[13px] text-[var(--color-fg-dim)]">
              {data.liftPct > 0 ? "+" : ""}
              {data.liftPct.toFixed(1)}% RPV vs baseline
            </span>
          ) : null}
        </div>
        <div className="mt-4 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-4">
          <CumulativeArea daily={e.daily} />
          <div className="mt-1 flex justify-between text-[10px] font-mono text-[var(--color-fg-muted)]">
            <span>{fmtDayLabel(e.daily[0]?.day ?? "")}</span>
            <span>{fmtDayLabel(e.daily[e.daily.length - 1]?.day ?? "")}</span>
          </div>
        </div>
        <div className="mt-2 text-[11.5px] text-[var(--color-fg-muted)]">
          {money0(e.sinceStartIncrementalCents)} generated all-time
          {e.firstTrackedAt ? ` since ${fmtLongDate(e.firstTrackedAt)}` : ""}.
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-4 py-3.5">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">
            Your plan
          </div>
          <div className="mt-1 text-[13px]">{planLine(data)}</div>
        </div>
        <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-4 py-3.5">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">
            Accruing this period
          </div>
          <div className="mt-1 text-[13px] tnum">
            {data.accruing
              ? `${money(data.accruing.totalCents)} · bills ${fmtLongDate(data.accruing.periodEnd)}`
              : "—"}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5">
        <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)] mb-2">
          Invoices
        </div>
        <InvoiceTable invoices={data.invoices} />
      </div>

      <FooterNote />
    </div>
  );
}
