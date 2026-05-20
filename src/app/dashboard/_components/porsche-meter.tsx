"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type PorscheModel = {
  id: string;
  name: string;
  price: number;
};

const MODELS: PorscheModel[] = [
  { id: "gt2rs", name: "911 GT2 RS", price: 420_000 },
  { id: "gt3rs", name: "911 GT3 RS", price: 245_000 },
  { id: "turbos", name: "911 Turbo S", price: 230_000 },
  { id: "taycan", name: "Taycan Turbo GT", price: 235_000 },
  { id: "gt4rs", name: "718 GT4 RS", price: 165_000 },
];

type Mode = "incremental" | "rollout";

const compactUSD = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function PorscheMeter({
  incrementalRevenue,
  rolloutIncrementalRevenue,
}: {
  incrementalRevenue: number | null;
  rolloutIncrementalRevenue: number | null;
}) {
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [mode, setMode] = useState<Mode>("incremental");

  const model = MODELS.find((item) => item.id === modelId) ?? MODELS[0];
  const amount = useMemo(() => {
    if (mode === "rollout") return rolloutIncrementalRevenue ?? 0;
    return incrementalRevenue ?? 0;
  }, [incrementalRevenue, mode, rolloutIncrementalRevenue]);

  const fraction = model.price > 0 ? amount / model.price : 0;
  const pct = Math.max(0, Math.min(100, Math.abs(fraction) * 100));
  const readableFraction =
    Math.abs(fraction) < 0.01 ? fraction.toFixed(3) : fraction.toFixed(2);
  const amountTone =
    amount > 0
      ? "text-[var(--color-success)]"
      : amount < 0
        ? "text-[var(--color-danger)]"
        : "text-[var(--color-fg)]";
  const modeNote =
    mode === "rollout" ? "full IG rollout upside" : "A lift vs B holdout";
  const comparisonTone =
    amount > 0
      ? "border-[var(--color-success)]/30 bg-[var(--color-success)]/8"
      : amount < 0
        ? "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/8"
        : "border-[var(--color-border-soft)] bg-[var(--color-bg)]/60";

  return (
    <div className="relative overflow-hidden bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
            Incremental revenue
          </div>
          <div className={`mt-1 h-section text-[26px] md:text-[28px] tnum ${amountTone}`}>
            {compactUSD.format(amount)}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)] tnum">
            {modeNote}
          </div>
        </div>
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as Mode)}
          className="max-w-[112px] rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)] px-2 py-1 text-[10.5px] font-mono text-[var(--color-fg-dim)] focus-ring"
          aria-label="Revenue basis"
        >
          <option value="incremental">Incremental</option>
          <option value="rollout">Rollout</option>
        </select>
      </div>

      <div className={`mt-3 rounded-md border px-2.5 py-2 ${comparisonTone}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[var(--color-fg-muted)]">
              GT benchmark
            </div>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className={`font-mono text-[18px] font-semibold tnum ${amountTone}`}>
                {readableFraction}x
              </span>
              <span className="text-[10.5px] text-[var(--color-fg-muted)]">
                of a {model.name}
              </span>
            </div>
          </div>
          <select
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            className="max-w-[92px] rounded-md border border-[var(--color-border-soft)] bg-[var(--color-card)] px-1.5 py-1 text-[10px] font-mono text-[var(--color-fg-dim)] focus-ring"
            aria-label="Porsche model"
          >
            {MODELS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <Image
          src="/porsche-gt2rs.png"
          alt=""
          width={174}
          height={48}
          className="mx-auto mt-1 h-10 w-full max-w-[172px] object-contain opacity-95"
          draggable={false}
        />
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] font-mono text-[var(--color-fg-muted)] tnum">
          <span>{compactUSD.format(amount)}</span>
          <span>{compactUSD.format(model.price)}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-border-soft)]">
          <div
            className={`h-full rounded-full transition-[width] duration-200 ${
              amount < 0 ? "bg-[var(--color-danger)]" : "bg-[var(--color-success)]"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
