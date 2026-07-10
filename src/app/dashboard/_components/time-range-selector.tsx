"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { DASHBOARD_RANGES } from "@/lib/dashboard-ranges";

type ExtraParams = Record<string, string | number | boolean | null | undefined>;

function buildHref(basePath: string, rangeKey: string, extraParams?: ExtraParams): string {
  const params = new URLSearchParams();
  params.set("range", rangeKey);

  for (const [key, value] of Object.entries(extraParams ?? {})) {
    if (value == null || value === false || value === "") continue;
    params.set(key, String(value));
  }

  return `${basePath}?${params.toString()}`;
}

function parseActive(active: string): { amount: string; unit: "h" | "d" } {
  const match = active.match(/^(\d{1,3})(h|d)$/);
  if (!match) return { amount: "14", unit: "d" };
  return { amount: match[1], unit: match[2] as "h" | "d" };
}

export function TimeRangeSelector({
  active,
  basePath,
  extraParams,
  abTest,
}: {
  active: string;
  basePath: string;
  extraParams?: ExtraParams;
  abTest?: { active: boolean; label: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const parsed = useMemo(() => parseActive(active), [active]);
  const [amount, setAmount] = useState(parsed.amount);
  const [unit, setUnit] = useState<"h" | "d">(parsed.unit);
  const inputId = basePath.replace(/[^a-z0-9_-]/gi, "-");

  function go(rangeKey: string) {
    startTransition(() => {
      router.push(buildHref(basePath, rangeKey, extraParams), { scroll: false });
    });
  }

  function applyCustom() {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) return;

    const whole = Math.floor(numeric);
    const clamped =
      unit === "h" ? Math.min(168, Math.max(1, whole)) : Math.min(365, Math.max(1, whole));
    go(`${clamped}${unit}`);
  }

  return (
    <>
      <div
        aria-hidden
        className={`pointer-events-none fixed left-0 right-0 top-0 z-[100] h-[2px] origin-left bg-[var(--color-accent)] transition-[transform,opacity] duration-300 ease-out ${
          isPending ? "scale-x-[0.75] opacity-100" : "scale-x-0 opacity-0"
        }`}
        style={isPending ? { animation: "progress-creep 8s ease-out forwards" } : undefined}
      />

      <div
        className={`flex flex-wrap items-center gap-1.5 transition-opacity ${isPending ? "opacity-70" : "opacity-100"}`}
      >
        <div
          role="tablist"
          aria-label="Date range"
          className="inline-flex items-center gap-0.5 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] p-[3px] text-[12px]"
        >
          {DASHBOARD_RANGES.map((range) => {
            const selected = active === range.key;
            return (
              <button
                key={range.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => go(range.key)}
                disabled={isPending}
                className={`rounded-full px-2.5 py-[5px] font-mono tnum transition-[background-color,color,transform] duration-200 ease-out select-none focus-ring active:scale-[0.97] ${
                  selected
                    ? "bg-[var(--color-bg)] text-[var(--color-fg)] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_var(--color-border-soft)_inset]"
                    : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-elev)]/60 hover:text-[var(--color-fg)]"
                } disabled:cursor-wait`}
              >
                {range.label}
              </button>
            );
          })}
        </div>

        {abTest ? (
          <button
            type="button"
            onClick={() => go("abtest")}
            disabled={isPending}
            title="Only the historical dates when the A/B split was live (control present)"
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-[6px] font-mono tnum text-[12px] transition-[background-color,color,transform] duration-200 ease-out select-none focus-ring active:scale-[0.97] disabled:cursor-wait ${
              abTest.active
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-fg)] font-medium"
                : "border-[var(--color-border-soft)] bg-[var(--color-card)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            <span
              aria-hidden
              className={`size-1.5 rounded-full ${abTest.active ? "bg-[var(--color-accent)]" : "bg-[var(--color-fg-muted)]"}`}
            />
            {abTest.label}
          </button>
        ) : null}

        <div className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] p-[3px] text-[12px]">
          <label className="sr-only" htmlFor={`${inputId}-custom-range-amount`}>
            Custom lookback amount
          </label>
          <input
            id={`${inputId}-custom-range-amount`}
            type="number"
            min={1}
            max={unit === "h" ? 168 : 365}
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyCustom();
            }}
            disabled={isPending}
            className="h-full w-12 rounded-full border border-transparent bg-[var(--color-bg)] px-2 text-center font-mono tnum text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)] disabled:cursor-wait"
          />
          <label className="sr-only" htmlFor={`${inputId}-custom-range-unit`}>
            Custom lookback unit
          </label>
          <select
            id={`${inputId}-custom-range-unit`}
            value={unit}
            onChange={(event) => setUnit(event.target.value as "h" | "d")}
            disabled={isPending}
            className="h-full rounded-full border border-transparent bg-transparent px-1.5 font-mono text-[var(--color-fg-muted)] outline-none focus:border-[var(--color-accent)] disabled:cursor-wait"
          >
            <option value="h">hr</option>
            <option value="d">day</option>
          </select>
          <button
            type="button"
            onClick={applyCustom}
            disabled={isPending}
            className="h-full rounded-full bg-[var(--color-bg)] px-2.5 font-mono text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)] focus-ring disabled:cursor-wait"
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
}
