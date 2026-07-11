"use client";

import { useMemo, useState } from "react";

/* ----------------------------- model ----------------------------- */

type Inputs = {
  incomeGoalPerPerson: number;
  people: number;
  operatorSharePct: number; // your side's share of EH revenue; referrer = 100 - this
  baseFee: number;
  revSharePct: number;
  // "typical brand" profile that sets avg incremental revenue per brand / month
  ordersPerMonth: number;
  aov: number;
  liftPct: number; // measured vs control (RPV lift); incremental factor = L/(1+L)
};

const DEFAULTS: Inputs = {
  incomeGoalPerPerson: 20000,
  people: 3,
  operatorSharePct: 75,
  baseFee: 300,
  revSharePct: 10,
  ordersPerMonth: 1200,
  aov: 55,
  liftPct: 25,
};

function incPerBrand(i: Inputs): number {
  const L = Math.max(0, i.liftPct) / 100;
  const factor = L > 0 ? L / (1 + L) : 0; // vs-control basis (matches the dashboard)
  return Math.max(0, i.ordersPerMonth * i.aov * factor);
}

// EH revenue one brand throws off per month.
function ehPerBrand(i: Inputs): number {
  return Math.max(0, i.baseFee) + (Math.max(0, i.revSharePct) / 100) * incPerBrand(i);
}

function brandsNeeded(requiredEh: number, perBrand: number): number {
  if (perBrand <= 0) return 0;
  return Math.ceil(requiredEh / perBrand);
}

function compute(i: Inputs) {
  const operatorSide = Math.max(0, i.people) * Math.max(0, i.incomeGoalPerPerson);
  const opShare = Math.min(100, Math.max(1, i.operatorSharePct)) / 100;
  const requiredEh = operatorSide / opShare; // minimum monthly EH revenue to fund the goal
  const perBrand = ehPerBrand(i);
  const brands = brandsNeeded(requiredEh, perBrand);

  // Actuals at that (whole) brand count.
  const actualEh = brands * perBrand;
  const operatorActual = actualEh * opShare;
  const perPersonActual = i.people > 0 ? operatorActual / i.people : 0;
  const referrerActual = actualEh * (1 - opShare);
  const incrementalTotal = brands * incPerBrand(i);
  const baseFeePortion = brands * Math.max(0, i.baseFee);
  const revSharePortion = actualEh - baseFeePortion;

  return {
    operatorSide,
    requiredEh,
    perBrand,
    brands,
    actualEh,
    operatorActual,
    perPersonActual,
    referrerActual,
    incrementalTotal,
    baseFeePortion,
    revSharePortion,
    incBrand: incPerBrand(i),
  };
}

/* --------------------------- formatting -------------------------- */

function usd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: abs >= 100 ? 0 : 2 });
}
function usdC(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${n < 0 ? "-" : ""}$${(a / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`;
  if (a >= 1000) return `${n < 0 ? "-" : ""}$${(a / 1000).toLocaleString("en-US", { maximumFractionDigits: a >= 10000 ? 0 : 1 })}k`;
  return usd(n);
}
function num(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/* ------------------------- brand presets ------------------------- */

const BRAND_PRESETS: { label: string; ordersPerMonth: number; aov: number; liftPct: number }[] = [
  { label: "Small", ordersPerMonth: 400, aov: 45, liftPct: 25 },
  { label: "Mid", ordersPerMonth: 1200, aov: 55, liftPct: 25 },
  { label: "Large", ordersPerMonth: 4000, aov: 70, liftPct: 25 },
];

/* ----------------------------- page ------------------------------ */

export function TeamModel() {
  const [i, setI] = useState<Inputs>(DEFAULTS);
  const out = useMemo(() => compute(i), [i]);
  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setI((p) => ({ ...p, [k]: v }));
  const referrerPct = Math.min(99, Math.max(0, 100 - i.operatorSharePct));

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)]">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 md:py-14">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--color-fg-muted)]">
              Internal · Goal model
            </div>
            <h1 className="mt-2 text-[26px] md:text-[32px] font-semibold tracking-tight">
              How many brands to hit the number
            </h1>
            <p className="mt-1.5 max-w-2xl text-[13px] text-[var(--color-fg-dim)]">
              Set the income goal and deal terms; see the brands and incremental revenue it takes. Deal is a
              monthly base fee + a share of incremental, split {i.operatorSharePct}% you / {referrerPct}% referrer.
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

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* Inputs */}
          <section className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5">
            <h2 className="text-[13px] font-semibold tracking-tight">Inputs</h2>
            <div className="mt-4 space-y-5">
              <Group title="Income goal">
                <Field label="Take-home / person" prefix="$" value={i.incomeGoalPerPerson} min={0} max={100000} step={500} onChange={(v) => set("incomeGoalPerPerson", v)} />
                <Field label="People sharing your side" value={i.people} min={1} max={10} step={1} onChange={(v) => set("people", v)} />
                <Field label="Your share of EH revenue" suffix="%" value={i.operatorSharePct} min={1} max={100} step={1} onChange={(v) => set("operatorSharePct", v)} hint={`Referrer gets the other ${referrerPct}%.`} />
              </Group>

              <Group title="Deal terms">
                <Field label="Base fee" prefix="$" suffix="/mo" value={i.baseFee} min={0} max={5000} step={25} onChange={(v) => set("baseFee", v)} />
                <Field label="Revenue share (of incremental)" suffix="%" value={i.revSharePct} min={0} max={50} step={0.5} onChange={(v) => set("revSharePct", v)} />
              </Group>

              <Group title="Typical brand">
                <div className="flex flex-wrap items-center gap-2">
                  {BRAND_PRESETS.map((p) => {
                    const active = i.ordersPerMonth === p.ordersPerMonth && i.aov === p.aov;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setI((prev) => ({ ...prev, ordersPerMonth: p.ordersPerMonth, aov: p.aov, liftPct: p.liftPct }))}
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
                <Field label="Orders / month" value={i.ordersPerMonth} min={0} max={100000} step={100} stepFor={(v) => (v >= 2000 ? 1000 : 100)} onChange={(v) => set("ordersPerMonth", v)} />
                <Field label="Average order value" prefix="$" value={i.aov} min={0} max={1000} step={1} onChange={(v) => set("aov", v)} />
                <Field label="Escape lift (vs control)" suffix="%" value={i.liftPct} min={0} max={100} step={1} onChange={(v) => set("liftPct", v)} hint={`≈ ${usdC(out.incBrand)}/mo incremental per brand.`} />
              </Group>
            </div>
          </section>

          {/* Results */}
          <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Big label="Brands needed" value={num(out.brands)} accent="accent" sub={`each ≈ ${usdC(out.perBrand)}/mo to EscapeHatch`} />
              <Big label="Incremental / mo" value={usdC(out.incrementalTotal)} accent="fg" sub={`${usdC(out.incrementalTotal * 12)}/yr generated for brands`} />
              <Big label="EscapeHatch revenue / mo" value={usdC(out.actualEh)} accent="fg" sub={`${usdC(out.baseFeePortion)} base + ${usdC(out.revSharePortion)} rev-share`} />
              <Big label={`Your side (${i.people}×)`} value={usdC(out.operatorActual)} accent="success" sub={`${usd(out.perPersonActual)}/person · referrers ${usdC(out.referrerActual)}/mo`} />
            </div>

            <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-semibold tracking-tight">Brands needed vs brand size</div>
                <div className="text-[11px] font-mono text-[var(--color-fg-muted)]">x = incremental / brand / mo</div>
              </div>
              <BrandsChart inputs={i} />
              <div className="mt-2 text-[11px] font-mono text-[var(--color-fg-muted)]">
                Bigger brands → fewer needed. Dashed = your current typical brand.
              </div>
            </div>
          </section>
        </div>

        {/* Screenshot summary */}
        <section className="mt-9">
          <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--color-fg-muted)]">The math</span>
            <span className="text-[10.5px] font-mono text-[var(--color-fg-muted)]">— screenshot-ready</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SumCard
              accent="var(--color-success)"
              title="The goal"
              big={`${usd(i.incomeGoalPerPerson)}/mo`}
              lines={[`× ${i.people} people = ${usdC(out.operatorSide)}/mo`, `= ${i.operatorSharePct}% of EH revenue`, `Referrers earn ${usdC(out.referrerActual)}/mo`]}
            />
            <SumCard
              accent="var(--color-accent)"
              title="What it takes"
              big={`${num(out.brands)} brands`}
              lines={[`${usdC(out.incrementalTotal)}/mo incremental`, `${usdC(out.incrementalTotal * 12)}/yr generated`, `${usdC(out.actualEh)}/mo EH revenue`]}
            />
            <SumCard
              accent="var(--color-fg)"
              title="Per brand"
              big={`${usdC(out.perBrand)}/mo`}
              lines={[`${usd(i.baseFee)}/mo base + ${i.revSharePct}% of incremental`, `≈ ${usdC(out.incBrand)}/mo incremental each`, `${num(i.ordersPerMonth)} orders · ${usd(i.aov)} AOV · ${i.liftPct}% lift`]}
            />
          </div>
        </section>

        <p className="mt-6 text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
          Model only — not a forecast. Assumes every brand hits the typical profile and the lift holds. Lift is
          measured vs control (incremental = revenue × L/(1+L)), matching the performance dashboard. Related:{" "}
          <a href="/model" className="underline underline-offset-2 hover:text-[var(--color-fg)]">per-deal model</a>.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------- chart ------------------------------ */

function BrandsChart({ inputs }: { inputs: Inputs }) {
  const W = 640, H = 240, padL = 46, padR = 16, padT = 14, padB = 28;
  const opShare = Math.min(100, Math.max(1, inputs.operatorSharePct)) / 100;
  const requiredEh = (inputs.people * inputs.incomeGoalPerPerson) / opShare;
  const revShare = Math.max(0, inputs.revSharePct) / 100;

  const { pts, xMax, curX, curY } = useMemo(() => {
    const curInc = incPerBrand(inputs);
    const xMax = Math.max(50000, curInc * 2);
    const N = 48;
    const pts = Array.from({ length: N + 1 }, (_, k) => {
      const x = (xMax * k) / N;
      const perBrand = Math.max(0, inputs.baseFee) + revShare * x;
      const y = perBrand > 0 ? Math.ceil(requiredEh / perBrand) : 0;
      return { x, y };
    });
    const curPerBrand = Math.max(0, inputs.baseFee) + revShare * curInc;
    const curY = curPerBrand > 0 ? Math.ceil(requiredEh / curPerBrand) : 0;
    return { pts, xMax, curX: curInc, curY };
  }, [inputs, requiredEh, revShare]);

  const yMax = Math.max(1, ...pts.map((p) => p.y)) * 1.08;
  const sx = (x: number) => padL + (x / xMax) * (W - padL - padR);
  const sy = (y: number) => padT + (1 - y / yMax) * (H - padT - padB);
  const path = pts.map((p, idx) => `${idx === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Brands needed vs brand size">
      {Array.from({ length: 5 }, (_, k) => {
        const val = (yMax * k) / 4;
        const y = sy(val);
        return (
          <g key={k}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--color-border-soft)" strokeWidth={1} opacity={0.5} />
            <text x={padL - 8} y={y + 3} textAnchor="end" className="fill-[var(--color-fg-muted)]" fontSize={9} fontFamily="monospace">{Math.round(val)}</text>
          </g>
        );
      })}
      {Array.from({ length: 5 }, (_, k) => {
        const val = (xMax * k) / 4;
        return (
          <text key={k} x={sx(val)} y={H - padB + 16} textAnchor="middle" className="fill-[var(--color-fg-muted)]" fontSize={9} fontFamily="monospace">{usdC(val)}</text>
        );
      })}
      <line x1={sx(curX)} y1={padT} x2={sx(curX)} y2={H - padB} stroke="var(--color-fg-muted)" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
      <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
      <circle cx={sx(curX)} cy={sy(curY)} r={3.5} fill="var(--color-accent)" />
      <text x={sx(curX) + 6} y={sy(curY) - 6} className="fill-[var(--color-fg)]" fontSize={10} fontFamily="monospace">{num(curY)} brands</text>
    </svg>
  );
}

/* ---------------------------- bits ------------------------------- */

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">{title}</div>
      <div className="space-y-3.5">{children}</div>
    </div>
  );
}

function Field({
  label, value, onChange, min, max, step, stepFor, prefix, suffix, hint,
}: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number;
  stepFor?: (v: number) => number; prefix?: string; suffix?: string; hint?: string;
}) {
  const safe = Number.isFinite(value) ? value : 0;
  const curStep = stepFor ? stepFor(safe) : step;
  const snap = (raw: number) => (stepFor ? Math.round(raw / stepFor(raw)) * stepFor(raw) : raw);
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">{label}</span>
        <div className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1">
          {prefix ? <span className="text-[12px] text-[var(--color-fg-muted)]">{prefix}</span> : null}
          <input
            type="number" inputMode="numeric" value={Number.isFinite(value) ? value : ""} min={min} max={max} step={curStep}
            onChange={(e) => onChange(e.target.value === "" ? 0 : snap(Number(e.target.value)))}
            className="w-16 sm:w-20 bg-transparent text-right text-[13px] font-mono tabular-nums text-[var(--color-fg)] outline-none"
          />
          {suffix ? <span className="text-[12px] text-[var(--color-fg-muted)]">{suffix}</span> : null}
        </div>
      </div>
      <input
        type="range" value={Math.min(max, Math.max(min, safe))} min={min} max={max} step={curStep}
        onChange={(e) => onChange(snap(Number(e.target.value)))}
        className="mt-2 h-5 w-full accent-[var(--color-accent)] touch-manipulation"
      />
      {hint ? <p className="mt-1 text-[10.5px] leading-snug text-[var(--color-fg-muted)]">{hint}</p> : null}
    </label>
  );
}

function Big({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: "accent" | "success" | "fg" }) {
  const color = accent === "accent" ? "text-[var(--color-accent)]" : accent === "success" ? "text-[var(--color-success)]" : "text-[var(--color-fg)]";
  return (
    <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-4">
      <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">{label}</div>
      <div className={`mt-1.5 text-[28px] font-semibold tracking-tight tabular-nums ${color}`}>{value}</div>
      <div className="mt-1 text-[11.5px] leading-snug text-[var(--color-fg-dim)]">{sub}</div>
    </div>
  );
}

function SumCard({ accent, title, big, lines }: { accent: string; title: string; big: string; lines: string[] }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
      <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">{title}</div>
      <div className="mt-2 text-[26px] sm:text-[30px] font-semibold tracking-tight tabular-nums" style={{ color: accent }}>{big}</div>
      <div className="mt-3 space-y-0.5 border-t border-[var(--color-border-soft)] pt-3 text-[11.5px] leading-relaxed text-[var(--color-fg-muted)]">
        {lines.map((l, k) => (<div key={k}>{l}</div>))}
      </div>
    </div>
  );
}
