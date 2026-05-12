"use client";

import { useMemo, useState } from "react";

/** Sample size per bucket — same math as lib/db.ts (inlined to avoid pulling
 *  server-only imports into a client component). */
function sampleSizePerBucket(pB: number, mdeRel: number): number {
  if (pB <= 0 || pB >= 1) return Infinity;
  const pA = pB * (1 + mdeRel);
  if (pA <= 0 || pA >= 1) return Infinity;
  const zAlpha = 1.96;
  const zBeta = 0.84;
  const sd1 = Math.sqrt(2 * pB * (1 - pB));
  const sd2 = Math.sqrt(pA * (1 - pA) + pB * (1 - pB));
  const n = Math.pow(zAlpha * sd1 + zBeta * sd2, 2) / Math.pow(pA - pB, 2);
  return Math.ceil(n);
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
}

export function SampleSizeCalculator({
  defaultBaselinePct = 2,
  defaultMdePct = 30,
  trafficPerDay,
}: {
  defaultBaselinePct?: number;
  defaultMdePct?: number;
  /** Optional — bucket A's actual daily escape rate, used to estimate days-to-significance. */
  trafficPerDay?: number;
}) {
  const [baseline, setBaseline] = useState(defaultBaselinePct);
  const [mde, setMde] = useState(defaultMdePct);

  const { needed, daysEstimate } = useMemo(() => {
    const n = sampleSizePerBucket(baseline / 100, mde / 100);
    const d = trafficPerDay && trafficPerDay > 0 ? Math.ceil(n / trafficPerDay) : null;
    return { needed: n, daysEstimate: d };
  }, [baseline, mde, trafficPerDay]);

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border-soft)]">
        <h2 className="text-[14px] font-semibold tracking-tight">Plan a test</h2>
        <span className="text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--color-fg-muted)]">
          calculator
        </span>
      </header>
      <div className="px-4 py-4 space-y-4">
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <label htmlFor="ssc-baseline" className="text-[12px] font-medium">Baseline CVR</label>
            <span className="text-[12px] font-mono tnum text-[var(--color-fg)]">{baseline.toFixed(1)}%</span>
          </div>
          <input
            id="ssc-baseline"
            type="range"
            min={0.1}
            max={10}
            step={0.1}
            value={baseline}
            onChange={(e) => setBaseline(parseFloat(e.target.value))}
            className="w-full accent-[var(--color-accent)]"
          />
          <div className="flex items-center justify-between text-[10px] font-mono text-[var(--color-fg-muted)] mt-0.5">
            <span>0.1%</span><span>10%</span>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <label htmlFor="ssc-mde" className="text-[12px] font-medium">Minimum detectable lift</label>
            <span className="text-[12px] font-mono tnum text-[var(--color-fg)]">+{mde.toFixed(0)}%</span>
          </div>
          <input
            id="ssc-mde"
            type="range"
            min={5}
            max={100}
            step={1}
            value={mde}
            onChange={(e) => setMde(parseFloat(e.target.value))}
            className="w-full accent-[var(--color-accent)]"
          />
          <div className="flex items-center justify-between text-[10px] font-mono text-[var(--color-fg-muted)] mt-0.5">
            <span>+5%</span><span>+100%</span>
          </div>
        </div>

        <div className="pt-3 border-t border-[var(--color-border-soft)]">
          <div className="text-[10.5px] uppercase tracking-[0.16em] font-mono font-medium text-[var(--color-fg-muted)]">
            Need per bucket
          </div>
          <div className="mt-1 flex items-baseline gap-3 flex-wrap">
            <div className="h-section text-[24px] tnum text-[var(--color-fg)]">{fmt(needed)}</div>
            {daysEstimate != null ? (
              <div className="text-[11.5px] font-mono tnum text-[var(--color-fg-dim)]">
                ≈ <span className="text-[var(--color-fg)] font-medium">{daysEstimate}</span> days at current pace
              </div>
            ) : (
              <div className="text-[11.5px] font-mono text-[var(--color-fg-muted)]">
                visitors per bucket · 95% conf
              </div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-fg-muted)] leading-relaxed">
            Power 80% · α = 0.05 · two-sided. Drag the sliders to see how baseline CVR and target lift shift required sample.
          </p>
        </div>
      </div>
    </div>
  );
}
