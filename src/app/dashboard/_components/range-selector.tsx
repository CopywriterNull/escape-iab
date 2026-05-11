"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Range = { key: string; label: string; days: number };

const RANGES: Range[] = [
  { key: "1h", label: "1h", days: 1 / 24 },
  { key: "6h", label: "6h", days: 6 / 24 },
  { key: "1d", label: "24h", days: 1 },
  { key: "7d", label: "7d", days: 7 },
  { key: "14d", label: "14d", days: 14 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
];

export function RangeSelector({ active }: { active: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <>
      {/* Top-of-viewport progress bar — visible only while transition pending */}
      <div
        aria-hidden
        className={`pointer-events-none fixed top-0 left-0 right-0 z-[100] h-[2px] bg-[var(--color-accent)] origin-left transition-[transform,opacity] duration-300 ease-out ${
          isPending ? "scale-x-[0.75] opacity-100" : "scale-x-0 opacity-0"
        }`}
        style={isPending ? { animation: "progress-creep 8s ease-out forwards" } : undefined}
      />

      <div
        role="tablist"
        aria-label="Date range"
        className={`inline-flex items-center gap-0.5 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] p-[3px] text-[12px] transition-opacity ${
          isPending ? "opacity-70" : "opacity-100"
        }`}
      >
        {RANGES.map((r) => {
          const isActive = r.key === active;
          return (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() =>
                startTransition(() => {
                  router.push(`/dashboard?range=${r.key}`, { scroll: false });
                })
              }
              disabled={isPending}
              className={`relative px-2.5 py-[5px] rounded-full font-mono tnum focus-ring select-none transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.97] ${
                isActive
                  ? "bg-[var(--color-bg)] text-[var(--color-fg)] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_var(--color-border-soft)_inset]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-elev)]/60"
              } disabled:cursor-wait`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
