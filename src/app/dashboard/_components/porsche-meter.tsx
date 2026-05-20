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

type Mode = "incremental" | "rollout" | "tracked";

const compactMoney = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function PorscheMeter({
  trackedRevenue,
  incrementalRevenue,
  rolloutIncrementalRevenue,
}: {
  trackedRevenue: number;
  incrementalRevenue: number | null;
  rolloutIncrementalRevenue: number | null;
}) {
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [mode, setMode] = useState<Mode>("incremental");

  const model = MODELS.find((item) => item.id === modelId) ?? MODELS[0];
  const amount = useMemo(() => {
    if (mode === "tracked") return trackedRevenue;
    if (mode === "rollout") return rolloutIncrementalRevenue ?? 0;
    return incrementalRevenue ?? 0;
  }, [incrementalRevenue, mode, rolloutIncrementalRevenue, trackedRevenue]);

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
    mode === "tracked"
      ? "gross test revenue"
      : mode === "rollout"
        ? "if all IG traffic matched A lift"
        : "A lift vs B holdout";

  return (
    <div className="relative overflow-hidden bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
            Porsche meter
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <div className={`h-section text-[22px] md:text-[24px] tnum ${amountTone}`}>
              {readableFraction}x
            </div>
            <div className="text-[11px] text-[var(--color-fg-muted)] tnum">
              of a {model.name}
            </div>
          </div>
        </div>
        <select
          value={modelId}
          onChange={(event) => setModelId(event.target.value)}
          className="max-w-[104px] rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)] px-2 py-1 text-[10.5px] font-mono text-[var(--color-fg-dim)] focus-ring"
          aria-label="Porsche model"
        >
          {MODELS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex items-end gap-3">
        <Image
          src="/porsche-gt2rs.png"
          alt=""
          width={174}
          height={48}
          className="h-12 w-[136px] shrink-0 object-contain opacity-95"
          draggable={false}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono text-[var(--color-fg-muted)] tnum">
            <span>${compactMoney.format(amount)}</span>
            <span>${compactMoney.format(model.price)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-border-soft)]">
            <div
              className={`h-full rounded-full transition-[width] duration-200 ${
                amount < 0 ? "bg-[var(--color-danger)]" : "bg-[var(--color-success)]"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as Mode)}
          className="min-w-0 flex-1 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg)] px-2 py-1 text-[10.5px] font-mono text-[var(--color-fg-dim)] focus-ring"
          aria-label="Revenue mode"
        >
          <option value="incremental">Incremental lift</option>
          <option value="rollout">Full-rollout upside</option>
          <option value="tracked">Tracked revenue</option>
        </select>
        <span className="shrink-0 text-[10.5px] font-mono text-[var(--color-fg-muted)] tnum">
          {pct.toFixed(0)}%
        </span>
      </div>

      <div className="mt-2 text-[11px] text-[var(--color-fg-muted)] tnum">{modeNote}</div>
    </div>
  );
}
