"use client";

import { useMemo, useState } from "react";

/* ----------------------------- model ----------------------------- */

type Basis = "control" | "simple";

type Inputs = {
  ordersPerMonth: number;
  aov: number;
  liftPct: number;
  basis: Basis;
  eligibleSharePct: number;
  baseFee: number;
  revSharePct: number;
};

type Outputs = {
  eligibleRevenue: number; // monthly revenue on escape-eligible traffic
  incremental: number; // monthly incremental revenue attributable to escape
  ehTake: number; // monthly EscapeHatch revenue
  merchantNet: number; // monthly incremental left with the merchant after EH
  takeRate: number; // EH take as a share of incremental (0..1)
  roi: number; // merchant net / EH take (x)
};

const DEFAULTS: Inputs = {
  ordersPerMonth: 1200,
  aov: 55,
  liftPct: 25,
  basis: "control",
  eligibleSharePct: 100,
  baseFee: 300,
  revSharePct: 10,
};

// Incremental revenue from escape, then split by the deal terms.
//
// basis="control": liftPct is the RPV/CVR lift measured vs the control bucket
// (how the dashboard reports it). Orders/AOV describe the escape-eligible
// traffic AS IT IS TODAY (post-escape), so the incremental slice of that actual
// revenue is L/(1+L).
// basis="simple": liftPct is just "incremental as a % of that traffic's
// revenue" — incremental = revenue x L. Easier to reason about, less rigorous.
function compute(i: Inputs): Outputs {
  const eligibleOrders = i.ordersPerMonth * (i.eligibleSharePct / 100);
  const eligibleRevenue = Math.max(0, eligibleOrders * i.aov);
  const L = Math.max(0, i.liftPct) / 100;
  const incFactor = i.basis === "control" ? (L > 0 ? L / (1 + L) : 0) : L;
  const incremental = eligibleRevenue * incFactor;
  const ehTake = Math.max(0, i.baseFee) + incremental * (Math.max(0, i.revSharePct) / 100);
  const merchantNet = incremental - ehTake;
  const takeRate = incremental > 0 ? ehTake / incremental : 0;
  const roi = ehTake > 0 ? merchantNet / ehTake : 0;
  return { eligibleRevenue, incremental, ehTake, merchantNet, takeRate, roi };
}

const PRESETS: { label: string; baseFee: number; revSharePct: number }[] = [
  { label: "$300 + 10%", baseFee: 300, revSharePct: 10 },
  { label: "$500 + 8%", baseFee: 500, revSharePct: 8 },
  { label: "$0 + 15%", baseFee: 0, revSharePct: 15 },
  { label: "Flat $750", baseFee: 750, revSharePct: 0 },
];

/* --------------------------- formatting -------------------------- */

function usd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: abs >= 1000 ? 0 : abs >= 100 ? 0 : 2,
  });
}

function usdCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000) return `${n < 0 ? "-" : ""}$${(abs / 1000).toLocaleString("en-US", { maximumFractionDigits: abs >= 10000 ? 0 : 1 })}k`;
  return usd(n);
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/* ----------------------------- page ------------------------------ */

type SweepVar = "liftPct" | "ordersPerMonth" | "aov";

export function PricingModel() {
  const [i, setI] = useState<Inputs>(DEFAULTS);
  const [sweep, setSweep] = useState<SweepVar>("liftPct");

  const out = useMemo(() => compute(i), [i]);

  const set = <K extends keyof Inputs>(key: K, value: Inputs[K]) =>
    setI((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)]">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 md:py-14">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--color-fg-muted)]">
              Internal · Deal model
            </div>
            <h1 className="mt-2 text-[26px] md:text-[32px] font-semibold tracking-tight">
              EscapeHatch pricing calculator
            </h1>
            <p className="mt-1.5 max-w-2xl text-[13px] text-[var(--color-fg-dim)]">
              Model what a deal earns: a monthly base fee plus a share of the incremental revenue escape
              generates. Enter the merchant&apos;s traffic and the measured lift.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setI(DEFAULTS)}
            className="rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] px-3.5 py-1.5 text-[12px] font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Reset
          </button>
        </header>

        {/* Pricing presets */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--color-fg-muted)]">
            Deal terms
          </span>
          {PRESETS.map((p) => {
            const active = i.baseFee === p.baseFee && i.revSharePct === p.revSharePct;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setI((prev) => ({ ...prev, baseFee: p.baseFee, revSharePct: p.revSharePct }))}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-mono transition-colors ${
                  active
                    ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-fg)]"
                    : "border-[var(--color-border-soft)] bg-[var(--color-card)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* Inputs */}
          <section className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5">
            <h2 className="text-[13px] font-semibold tracking-tight">Inputs</h2>

            <div className="mt-4 space-y-5">
              <Group title="Deal terms">
                <NumberField
                  label="Base fee"
                  prefix="$"
                  suffix="/mo"
                  value={i.baseFee}
                  min={0}
                  max={5000}
                  step={25}
                  onChange={(v) => set("baseFee", v)}
                />
                <NumberField
                  label="Revenue share (of incremental)"
                  suffix="%"
                  value={i.revSharePct}
                  min={0}
                  max={50}
                  step={0.5}
                  onChange={(v) => set("revSharePct", v)}
                />
              </Group>

              <Group title="Merchant metrics">
                <NumberField
                  label="Orders / month (escape-eligible)"
                  value={i.ordersPerMonth}
                  min={0}
                  max={50000}
                  step={50}
                  onChange={(v) => set("ordersPerMonth", v)}
                />
                <NumberField
                  label="Average order value"
                  prefix="$"
                  value={i.aov}
                  min={0}
                  max={1000}
                  step={1}
                  onChange={(v) => set("aov", v)}
                />
                <NumberField
                  label="Escape lift"
                  suffix="%"
                  value={i.liftPct}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => set("liftPct", v)}
                />
                <div>
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-fg-muted)]">
                    Lift basis
                  </div>
                  <div className="inline-flex rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-bg)] p-[3px]">
                    {([
                      { key: "control", label: "vs control (RPV)" },
                      { key: "simple", label: "% of revenue" },
                    ] as const).map((b) => (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => set("basis", b.key)}
                        className={`rounded-md px-3 py-1.5 text-[12px] font-mono transition-colors ${
                          i.basis === b.key
                            ? "bg-[var(--color-card)] text-[var(--color-fg)]"
                            : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
                    {i.basis === "control"
                      ? "Lift measured against the control bucket (how the dashboard reports it). Incremental = actual revenue × L/(1+L)."
                      : "Lift treated as incremental revenue as a share of escape-eligible revenue. Incremental = revenue × L."}
                  </p>
                </div>
                <NumberField
                  label="Escape-eligible share of those orders"
                  suffix="%"
                  value={i.eligibleSharePct}
                  min={1}
                  max={100}
                  step={1}
                  onChange={(v) => set("eligibleSharePct", v)}
                  hint="Set below 100% if Orders/month is total store orders and only part is IG/paid-social in-app."
                />
              </Group>
            </div>
          </section>

          {/* Results */}
          <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Result
                label="EscapeHatch revenue"
                monthly={out.ehTake}
                accent="accent"
                sub={`${usd(i.baseFee)}/mo base + ${i.revSharePct}% of incremental`}
              />
              <Result
                label="Merchant net gain"
                monthly={out.merchantNet}
                accent={out.merchantNet >= 0 ? "success" : "danger"}
                sub="Incremental revenue kept after EscapeHatch"
              />
              <Result
                label="Incremental revenue"
                monthly={out.incremental}
                accent="fg"
                sub={`On ${usdCompact(out.eligibleRevenue)}/mo escape-eligible revenue`}
              />
              <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">
                  Deal quality
                </div>
                <dl className="mt-2 space-y-1.5">
                  <Row k="Effective take rate" v={pct(out.takeRate)} hint="of incremental revenue" />
                  <Row k="Merchant ROI" v={`${out.roi.toFixed(1)}×`} hint="net gain per $1 to EH" />
                  <Row k="EscapeHatch / year" v={usdCompact(out.ehTake * 12)} />
                  <Row k="Merchant net / year" v={usdCompact(out.merchantNet * 12)} />
                </dl>
              </div>
            </div>

            {/* Chart */}
            <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-[13px] font-semibold tracking-tight">Sensitivity</div>
                <div className="inline-flex rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-bg)] p-[3px]">
                  {([
                    { key: "liftPct", label: "Lift %" },
                    { key: "ordersPerMonth", label: "Orders" },
                    { key: "aov", label: "AOV" },
                  ] as const).map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSweep(s.key)}
                      className={`rounded-md px-2.5 py-1 text-[11.5px] font-mono transition-colors ${
                        sweep === s.key
                          ? "bg-[var(--color-card)] text-[var(--color-fg)]"
                          : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <SensitivityChart inputs={i} sweep={sweep} />
              <div className="mt-2 flex items-center gap-4 text-[11px] font-mono text-[var(--color-fg-muted)]">
                <Legend color="var(--color-accent)" label="EscapeHatch / mo" />
                <Legend color="var(--color-success)" label="Merchant net / mo" />
                <span className="ml-auto">monthly · dashed = current</span>
              </div>
            </div>
          </section>
        </div>

        <p className="mt-6 text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
          Model only — not a quote. Incremental revenue assumes the lift holds at the entered escape-eligible
          volume. &ldquo;vs control&rdquo; basis matches how the performance dashboard measures RPV lift.
        </p>
      </div>
    </div>
  );
}

/* --------------------------- chart ------------------------------- */

function SensitivityChart({ inputs, sweep }: { inputs: Inputs; sweep: SweepVar }) {
  const W = 640;
  const H = 260;
  const padL = 52;
  const padR = 16;
  const padT = 14;
  const padB = 28;

  const { points, xMax, curX } = useMemo(() => {
    const ranges: Record<SweepVar, number> = {
      liftPct: Math.max(60, inputs.liftPct * 2),
      ordersPerMonth: Math.max(2000, inputs.ordersPerMonth * 2),
      aov: Math.max(100, inputs.aov * 2),
    };
    const xMax = ranges[sweep];
    const N = 48;
    const pts = Array.from({ length: N + 1 }, (_, k) => {
      const x = (xMax * k) / N;
      const o = compute({ ...inputs, [sweep]: x });
      return { x, eh: o.ehTake, net: o.merchantNet };
    });
    return { points: pts, xMax, curX: inputs[sweep] };
  }, [inputs, sweep]);

  const yMax = Math.max(1, ...points.map((p) => Math.max(p.eh, p.net))) * 1.08;
  const yMin = Math.min(0, ...points.map((p) => p.net));

  const sx = (x: number) => padL + (x / xMax) * (W - padL - padR);
  const sy = (y: number) => padT + (1 - (y - yMin) / (yMax - yMin)) * (H - padT - padB);

  const line = (key: "eh" | "net") =>
    points.map((p, idx) => `${idx === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p[key]).toFixed(1)}`).join(" ");

  const yTicks = 4;
  const xTicks = 4;
  const fmtX = (x: number) =>
    sweep === "liftPct" ? `${Math.round(x)}%` : sweep === "aov" ? `$${Math.round(x)}` : `${Math.round(x / 1000)}k`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Sensitivity chart">
      {/* y gridlines + labels */}
      {Array.from({ length: yTicks + 1 }, (_, k) => {
        const val = yMin + ((yMax - yMin) * k) / yTicks;
        const y = sy(val);
        return (
          <g key={`y${k}`}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--color-border-soft)" strokeWidth={1} opacity={0.5} />
            <text x={padL - 8} y={y + 3} textAnchor="end" className="fill-[var(--color-fg-muted)]" fontSize={9} fontFamily="monospace">
              {usdCompact(val)}
            </text>
          </g>
        );
      })}
      {/* x labels */}
      {Array.from({ length: xTicks + 1 }, (_, k) => {
        const val = (xMax * k) / xTicks;
        return (
          <text key={`x${k}`} x={sx(val)} y={H - padB + 16} textAnchor="middle" className="fill-[var(--color-fg-muted)]" fontSize={9} fontFamily="monospace">
            {fmtX(val)}
          </text>
        );
      })}
      {/* current-value marker */}
      <line x1={sx(curX)} y1={padT} x2={sx(curX)} y2={H - padB} stroke="var(--color-fg-muted)" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
      {/* series */}
      <path d={line("net")} fill="none" stroke="var(--color-success)" strokeWidth={2} />
      <path d={line("eh")} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
      {/* current dots */}
      <circle cx={sx(curX)} cy={sy(compute(inputs).ehTake)} r={3.5} fill="var(--color-accent)" />
      <circle cx={sx(curX)} cy={sy(compute(inputs).merchantNet)} r={3.5} fill="var(--color-success)" />
    </svg>
  );
}

/* --------------------------- bits -------------------------------- */

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">
        {title}
      </div>
      <div className="space-y-3.5">{children}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">{label}</span>
        <div className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1">
          {prefix ? <span className="text-[12px] text-[var(--color-fg-muted)]">{prefix}</span> : null}
          <input
            type="number"
            value={Number.isFinite(value) ? value : ""}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
            className="w-20 bg-transparent text-right text-[13px] font-mono tabular-nums text-[var(--color-fg)] outline-none"
          />
          {suffix ? <span className="text-[12px] text-[var(--color-fg-muted)]">{suffix}</span> : null}
        </div>
      </div>
      <input
        type="range"
        value={Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--color-accent)]"
      />
      {hint ? <p className="mt-1 text-[10.5px] leading-snug text-[var(--color-fg-muted)]">{hint}</p> : null}
    </label>
  );
}

function Result({
  label,
  monthly,
  sub,
  accent,
}: {
  label: string;
  monthly: number;
  sub: string;
  accent: "accent" | "success" | "danger" | "fg";
}) {
  const color =
    accent === "accent"
      ? "text-[var(--color-accent)]"
      : accent === "success"
        ? "text-[var(--color-success)]"
        : accent === "danger"
          ? "text-[var(--color-danger)]"
          : "text-[var(--color-fg)]";
  return (
    <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-4">
      <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">{label}</div>
      <div className={`mt-1.5 text-[28px] font-semibold tracking-tight tabular-nums ${color}`}>{usd(monthly)}</div>
      <div className="text-[11px] font-mono text-[var(--color-fg-muted)]">
        {usdCompact(monthly * 12)}/yr
      </div>
      <div className="mt-1.5 text-[11.5px] leading-snug text-[var(--color-fg-dim)]">{sub}</div>
    </div>
  );
}

function Row({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12px] text-[var(--color-fg-dim)]">
        {k}
        {hint ? <span className="ml-1 text-[10.5px] text-[var(--color-fg-muted)]">({hint})</span> : null}
      </dt>
      <dd className="text-[13px] font-mono tabular-nums text-[var(--color-fg)]">{v}</dd>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-[2px] w-4 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
