"use client";

import { useState } from "react";

/**
 * Configurable A/B split percentage. Value is the % of in-test traffic
 * placed in bucket A (the escape arm). 50 = even split, 70 = 70/30
 * favoring escape, etc. Clamped to [1, 99] — extremes defeat the
 * purpose of an A/B; merchants who want 100% escape should flip the
 * "A/B testing" toggle off instead.
 *
 * Form posts as `ab_split_pct` int; server action re-clamps.
 */
export function SplitSlider({ defaultPct }: { defaultPct: number }) {
  const [pct, setPct] = useState<number>(defaultPct);
  const a = pct;
  const b = 100 - pct;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="text-sm font-medium tracking-tight">A/B split</div>
          <div className="mt-1 text-xs text-[var(--color-fg-muted)] leading-relaxed">
            Percent of in-test traffic placed in bucket A (escape). The rest is silent control. 50 = even, raise to favor escape.
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">A · B</div>
          <div className="mt-0.5 font-mono tnum text-sm text-[var(--color-fg)]">
            <span className="text-[var(--color-accent)]">{a}%</span>
            <span className="text-[var(--color-fg-muted)] mx-1">/</span>
            <span>{b}%</span>
          </div>
        </div>
      </div>

      <div className="relative h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-[var(--color-accent)] transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>

      <input
        type="range"
        name="ab_split_pct"
        min={1}
        max={99}
        step={1}
        value={pct}
        onChange={(e) => setPct(parseInt(e.target.value, 10) || 50)}
        className="w-full accent-[var(--color-accent)] cursor-pointer"
        aria-label="A/B split percent for bucket A"
      />

      <div className="flex items-center justify-between text-[10px] font-mono tracking-wider text-[var(--color-fg-muted)] tnum">
        <button
          type="button"
          className="hover:text-[var(--color-fg)] transition-colors"
          onClick={() => setPct(50)}
        >
          50/50 reset
        </button>
        <div className="flex gap-1.5">
          {[20, 30, 50, 70, 80].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setPct(preset)}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                pct === preset
                  ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                  : "hover:bg-[var(--color-bg-elev)] hover:text-[var(--color-fg)]"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
